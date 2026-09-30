#!/usr/bin/env node
/* eslint-disable no-console */
//
// generateBundleStats.js
// ----------------------
// Post-build analyzer for any react-scripts / webpack project. Walks
// `build/static/js/*.js` after `react-scripts build` and emits:
//
//   * public/bundle-stats.json  – consumed by the in-app dashboard
//   * public/bundle-report.html  – stand-alone human-readable report
//
// Design goals:
//
//   * Zero runtime deps. Only `fs` and `path` from Node built-ins.
//   * Lazy-loaded page chunks are detected from the `page-<id>.<hash>.chunk.js`
//     naming pattern produced by `/* webpackChunkName: "page-<id>" *\/` magic
//     comments — no hardcoded list of pages.
//   * Shared / vendor / runtime / main attribution is done by *filename*
//     (so it works even when source maps are absent).
//   * Package-level attribution uses the .map file's `sources` array to
//     aggregate per-`node_modules/<package>` file counts. This is an
//     approximation (not a precise byte-count), but it's reliable enough
//     for ranking the heaviest packages.
//   * Empty sections are simply omitted from the JSON / HTML output — the
//     dashboard never has to render placeholder text.
//
// Usage:
//   node scripts/generateBundleStats.js
//   npm run analyze:bundle   # convenience wrapper
//
// ---------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');

// ---- Node version guard -----------------------------------------------------
const [maj] = process.versions.node.split('.').map(Number);
if (maj < 14) {
  console.error('[bundle-stats] requires Node 14+. Detected', process.versions.node);
  process.exit(1);
}

// ---- Paths ------------------------------------------------------------------
const ROOT = path.resolve(__dirname, '..');
const BUILD_JS_DIR = path.join(ROOT, 'build', 'static', 'js');
const PUBLIC_DIR = path.join(ROOT, 'public');
const STATS_OUT = path.join(PUBLIC_DIR, 'bundle-stats.json');
const HTML_OUT = path.join(PUBLIC_DIR, 'bundle-report.html');

if (!fs.existsSync(BUILD_JS_DIR)) {
  console.error(
    '[bundle-stats] build directory not found at',
    BUILD_JS_DIR,
    '— run `npm run build` first.'
  );
  process.exit(1);
}

// ---- Helpers ----------------------------------------------------------------
const KB = 1024;
const MB = 1024 * 1024;

function fmtBytes(bytes) {
  if (bytes >= MB) return (bytes / MB).toFixed(2) + ' MB';
  if (bytes >= KB) return (bytes / KB).toFixed(2) + ' KB';
  return bytes + ' B';
}

// Chunk filename patterns produced by react-scripts / webpack 5:
//
//   main.<hash>.js                       eagerly-imported entry
//   main.<hash>.chunk.js                 (older CRA, legacy split)
//   runtime.<hash>.js                    chunk loader
//   runtime-main.<hash>.js               combined runtime+main (webpack 5)
//   <n>.<hash>.chunk.js                  auto-numbered shared chunks (vendors)
//   <n>.<hash>.js                        auto-numbered vendors (webpack 5)
//   vendors~<subchunk>.<hash>.chunk.js   vendor splits for a subchunk
//   page-<id>.<hash>.chunk.js            lazy page chunk (from webpackChunkName)
//
// We classify each filename by *shape* — never by hardcoded name.
function classifyChunk(file) {
  const name = path.basename(file);

  if (/^runtime[-.]/.test(name)) return 'runtime';
  if (/^main[-.]/.test(name)) return 'main';

  // Lazy page chunk: page-<id>.<hash>.chunk.js  OR  page-<id>.<hash>.js
  const pageMatch = name.match(/^page-([A-Za-z0-9_-]+)[-.](?:[A-Za-z0-9_-]+)\.(?:chunk\.)?js$/);
  if (pageMatch) return { kind: 'page', id: pageMatch[1] };

  // Numbered shared chunks: 109.<hash>.chunk.js  /  109.<hash>.js
  // We treat any non-page, non-runtime, non-main chunk as "shared/vendor".
  return 'shared';
}

// Human-readable labels for the page chunk ids. Falls back to a slug → title
// conversion when an unknown id appears (e.g. someone adds a new lazy page
// without updating this map).
const PAGE_LABELS = {
  'initial-load': 'Initial Load',
  scroll: 'Scrolling',
  interaction: 'Interaction Latency',
  hierarchy: 'Hierarchy',
  dependency: 'Dependency',
  memory: 'Memory',
  bundle: 'Bundle Size',
  stress: 'Stress Test'
};
function humanizePageId(id) {
  if (PAGE_LABELS[id]) return PAGE_LABELS[id];
  // Fallback: kebab-case → Title Case, hyphens as spaces.
  return String(id)
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

// Walk a source-map's `sources` array and aggregate per-package counts.
// Each entry looks like "webpack:/./node_modules/<package>/<...>".
function aggregatePackagesFromSources(sources) {
  const counts = new Map(); // package -> file count
  for (const src of sources) {
    // Normalize webpack/normalize separators to forward-slash and strip the
    // leading `./` that webpack injects for project sources.
    const norm = String(src).replace(/\\/g, '/');
    const match = norm.match(/node_modules\/((?:@[^/]+\/[^/]+|[^/]+))\//);
    if (!match) continue;
    const pkg = match[1];
    counts.set(pkg, (counts.get(pkg) || 0) + 1);
  }
  return counts;
}

// ---- 1. Walk build/static/js and classify each chunk ----------------------
const entries = fs
  .readdirSync(BUILD_JS_DIR)
  .filter((f) => f.endsWith('.js') && !f.endsWith('.js.map'));

const chunks = [];
const pages = new Map(); // id -> { id, bytes, chunks: [] }
const shared = {
  runtime: { bytes: 0, files: [] },
  main: { bytes: 0, files: [] },
  vendor: { bytes: 0, files: [] },
  shared: { bytes: 0, files: [] }
};

let totalBytes = 0;

for (const file of entries) {
  const full = path.join(BUILD_JS_DIR, file);
  const stat = fs.statSync(full);
  const bytes = stat.size;
  totalBytes += bytes;

  const classification = classifyChunk(file);

  // Look for the .map sibling (if it exists) and aggregate package counts.
  let packageCounts = new Map();
  const mapPath = full + '.map';
  if (fs.existsSync(mapPath)) {
    try {
      const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      if (Array.isArray(map.sources)) {
        packageCounts = aggregatePackagesFromSources(map.sources);
      }
    } catch (err) {
      // Source map might be malformed; skip package attribution but keep the
      // chunk-level stats.
    }
  }

  chunks.push({
    file,
    bytes,
    classification:
      typeof classification === 'string' ? classification : classification.kind,
    pageId: typeof classification === 'object' ? classification.id : null,
    packageCounts: Array.from(packageCounts.entries())
      .map(([pkg, count]) => ({ pkg, count }))
      .sort((a, b) => b.count - a.count)
  });

  if (classification === 'runtime') {
    shared.runtime.bytes += bytes;
    shared.runtime.files.push(file);
  } else if (classification === 'main') {
    shared.main.bytes += bytes;
    shared.main.files.push(file);
  } else if (classification === 'page') {
    const id = classification.id;
    if (!pages.has(id)) {
      pages.set(id, { id, bytes: 0, chunks: [], label: humanizePageId(id) });
    }
    const p = pages.get(id);
    p.bytes += bytes;
    p.chunks.push(file);
  } else if (classification === 'shared') {
    // Numbered / vendor chunks. webpack 5's contenthash-based filenames
    // (e.g. `vendors~main.<hash>.js`) and CRA's legacy numbered chunks
    // (e.g. `109.<hash>.chunk.js`) both fall here.
    const isVendor = /vendor/i.test(file) || /^(\d+)[-.]/.test(file);
    if (isVendor) {
      shared.vendor.bytes += bytes;
      shared.vendor.files.push(file);
    } else {
      shared.shared.bytes += bytes;
      shared.shared.files.push(file);
    }
  }
}

// ---- 2. Roll up per-package attribution -----------------------------------
const packageTotals = new Map(); // pkg -> { bytes, chunks: number, files: number }
for (const chunk of chunks) {
  // Approximate byte attribution: chunk.bytes * (pkg-file-count / chunk-total-files)
  // We don't know chunk's total source-file count without re-walking the
  // source map, so we record the raw file counts. The HTML/JSON use these
  // counts directly as a ranking proxy.
  for (const { pkg, count } of chunk.packageCounts) {
    if (!packageTotals.has(pkg)) {
      packageTotals.set(pkg, { pkg, bytes: 0, fileRefs: 0, chunkRefs: 0 });
    }
    const row = packageTotals.get(pkg);
    row.fileRefs += count;
    row.chunkRefs += 1;
  }
}

// Now apportion bytes by chunk: each package's "weight" in a chunk is its
// file-count share of that chunk's source files. We re-walk source maps to
// get per-chunk total counts; if absent we fall back to chunk.byteRefs.
for (const chunk of chunks) {
  const mapPath = path.join(BUILD_JS_DIR, chunk.file + '.map');
  let totalFilesInChunk = 0;
  if (fs.existsSync(mapPath)) {
    try {
      const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      if (Array.isArray(map.sources)) totalFilesInChunk = map.sources.length;
    } catch (_e) {
      /* ignore */
    }
  }
  const denom = totalFilesInChunk > 0 ? totalFilesInChunk : chunk.packageCounts.reduce((s, c) => s + c.count, 0) || 1;
  for (const { pkg, count } of chunk.packageCounts) {
    const share = (count / denom) * chunk.bytes;
    const row = packageTotals.get(pkg);
    row.bytes += share;
  }
}

// ---- 3. Finalize JSON shape ------------------------------------------------
const sharedTotalBytes =
  shared.runtime.bytes + shared.main.bytes + shared.vendor.bytes + shared.shared.bytes;

const pageList = Array.from(pages.values()).sort((a, b) => b.bytes - a.bytes);
const packageList = Array.from(packageTotals.values())
  .map((p) => ({
    pkg: p.pkg,
    bytes: Math.round(p.bytes),
    fileRefs: p.fileRefs,
    chunkRefs: p.chunkRefs
  }))
  .sort((a, b) => b.bytes - a.bytes);

const largestPage =
  pageList.length > 0 ? pageList.reduce((a, b) => (a.bytes > b.bytes ? a : b)) : null;

// Percentages are computed against totalBytes for pages / packages / shared.
function pct(n) {
  if (!totalBytes) return 0;
  return Math.round((n / totalBytes) * 1000) / 10;
}

const stats = {
  generatedAt: new Date().toISOString(),
  nodeVersion: process.versions.node,
  totalBytes,
  totalKB: Math.round((totalBytes / KB) * 100) / 100,
  totalMB: Math.round((totalBytes / MB) * 1000) / 1000,
  chunkCount: chunks.length,
  shared: {
    runtime: { ...shared.runtime, kb: Math.round((shared.runtime.bytes / KB) * 100) / 100 },
    main: { ...shared.main, kb: Math.round((shared.main.bytes / KB) * 100) / 100 },
    vendor: { ...shared.vendor, kb: Math.round((shared.vendor.bytes / KB) * 100) / 100 },
    shared: { ...shared.shared, kb: Math.round((shared.shared.bytes / KB) * 100) / 100 },
    totalBytes: sharedTotalBytes,
    kb: Math.round((sharedTotalBytes / KB) * 100) / 100,
    percent: pct(sharedTotalBytes)
  },
  pages: pageList.map((p) => ({
    id: p.id,
    label: p.label,
    bytes: p.bytes,
    kb: Math.round((p.bytes / KB) * 100) / 100,
    percent: pct(p.bytes),
    chunks: p.chunks
  })),
  packages: packageList.map((p) => ({
    pkg: p.pkg,
    bytes: Math.round(p.bytes),
    kb: Math.round((p.bytes / KB) * 100) / 100,
    percent: pct(p.bytes),
    fileRefs: p.fileRefs,
    chunkRefs: p.chunkRefs
  })),
  largestPage: largestPage
    ? {
        id: largestPage.id,
        bytes: largestPage.bytes,
        kb: Math.round((largestPage.bytes / KB) * 100) / 100,
        percent: pct(largestPage.bytes)
      }
    : null,
  chunks: chunks
    .slice()
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 25)
    .map((c) => ({
      file: c.file,
      bytes: c.bytes,
      kb: Math.round((c.bytes / KB) * 100) / 100,
      classification: c.classification,
      pageId: c.pageId,
      topPackages: c.packageCounts.slice(0, 5)
    })),
  notes: [
    'Bytes are the on-disk size of the .js file (pre-gzip, post-minify).',
    'Package attribution is approximated from source-map `sources` (file-count share per chunk).',
    'Pages are detected from `page-<id>.<hash>.chunk.js` filenames produced by `webpackChunkName` magic comments.',
    'Empty sections are omitted from both JSON and HTML — if a section is missing, the data was absent.'
  ]
};

// ---- 4. Write the JSON -----------------------------------------------------
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.writeFileSync(STATS_OUT, JSON.stringify(stats, null, 2), 'utf8');

// ---- 5. Write the stand-alone HTML report ---------------------------------
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const generatedDisplay = escapeHtml(new Date(stats.generatedAt).toLocaleString());
const pageRows =
  stats.pages.length === 0
    ? ''
    : stats.pages
        .map(
          (p) => `
      <tr>
        <td><code>${escapeHtml(p.id)}</code></td>
        <td>${escapeHtml(p.label || p.id)}</td>
        <td>${(p.bytes / MB).toFixed(2)} MB</td>
        <td>${p.percent}%</td>
        <td><code>${escapeHtml(p.chunks.join(', '))}</code></td>
      </tr>`
        )
        .join('');

const pkgRows =
  stats.packages.length === 0
    ? ''
    : stats.packages
        .slice(0, 30)
        .map(
          (p) => `
      <tr>
        <td><code>${escapeHtml(p.pkg)}</code></td>
        <td>${(p.bytes / MB).toFixed(2)} MB</td>
        <td>${p.percent}%</td>
        <td>${p.chunkRefs}</td>
        <td>${p.fileRefs}</td>
      </tr>`
        )
        .join('');

const chunkRows =
  stats.chunks.length === 0
    ? ''
    : stats.chunks
        .map(
          (c) => `
      <tr>
        <td><code>${escapeHtml(c.file)}</code></td>
        <td>${escapeHtml(c.classification)}${c.pageId ? ' / ' + escapeHtml(c.pageId) : ''}</td>
        <td>${(c.bytes / MB).toFixed(2)} MB</td>
        <td><code>${escapeHtml(
          c.topPackages.map((p) => p.pkg + '×' + p.count).join(', ')
        )}</code></td>
      </tr>`
        )
        .join('');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bundle Report</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
  h1 { margin: 0 0 4px; }
  .meta { color: #475569; margin-bottom: 24px; font-size: 13px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
           gap: 12px; margin-bottom: 28px; }
  .tile { background: white; padding: 16px; border-radius: 8px;
          box-shadow: 0 1px 2px rgba(15,23,42,.08); }
  .tile .label { font-size: 12px; color: #64748b; text-transform: uppercase;
                 letter-spacing: .04em; margin-bottom: 4px; }
  .tile .value { font-size: 22px; font-weight: 600; }
  .tile .sub { font-size: 12px; color: #475569; margin-top: 4px; }
  section { background: white; padding: 20px; border-radius: 8px;
            box-shadow: 0 1px 2px rgba(15,23,42,.08); margin-bottom: 24px; }
  h2 { margin-top: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0;
           vertical-align: top; }
  th { background: #f1f5f9; font-weight: 600; }
  tr:hover td { background: #f8fafc; }
  code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px;
         font-size: 12px; }
  .empty { color: #64748b; font-style: italic; padding: 8px 0; }
  ol { margin: 0; padding-left: 18px; color: #475569; }
  ol li { margin-bottom: 4px; }
</style>
</head>
<body>
<h1>Bundle Report</h1>
<div class="meta">Generated ${generatedDisplay} · Node ${escapeHtml(stats.nodeVersion)} · ${stats.chunkCount} chunks</div>

<div class="tiles">
  <div class="tile">
    <div class="label">Total JS Payload</div>
    <div class="value">${stats.totalMB} MB</div>
    <div class="sub">${stats.totalKB} KB across ${stats.chunkCount} chunks</div>
  </div>
  <div class="tile">
    <div class="label">Shared Bundle</div>
    <div class="value">${(stats.shared.totalBytes / MB).toFixed(2)} MB</div>
    <div class="sub">${stats.shared.percent}% of total · runtime + main + vendors + shared</div>
  </div>
  <div class="tile">
    <div class="label">Lazy-Loaded Pages</div>
    <div class="value">${stats.pages.length}</div>
    <div class="sub">${
      stats.largestPage
        ? 'Largest: ' + escapeHtml(stats.largestPage.id) + ' (' + (stats.largestPage.bytes / MB).toFixed(2) + ' MB)'
        : 'No page chunks detected'
    }</div>
  </div>
  <div class="tile">
    <div class="label">Top Package</div>
    <div class="value">${
      stats.packages[0] ? escapeHtml(stats.packages[0].pkg) : '—'
    }</div>
    <div class="sub">${
      stats.packages[0] ? (stats.packages[0].bytes / MB).toFixed(2) + ' MB · ' + stats.packages[0].percent + '%' : 'No package attribution available'
    }</div>
  </div>
</div>

<section>
  <h2>Pages</h2>
  ${
    stats.pages.length === 0
      ? '<div class="empty">No lazy-loaded page chunks detected.</div>'
      : `<table>
        <thead>
          <tr><th>ID</th><th>Label</th><th>Size</th><th>% of total</th><th>Chunks</th></tr>
        </thead>
        <tbody>${pageRows}</tbody>
      </table>`
  }
</section>

<section>
  <h2>Shared Breakdown</h2>
  <table>
    <thead>
      <tr><th>Bucket</th><th>Files</th><th>Size</th><th>% of total</th></tr>
    </thead>
    <tbody>
      <tr><td>Runtime</td><td>${shared.runtime.files.length}</td><td>${(shared.runtime.bytes / MB).toFixed(2)} MB</td><td>${pct(shared.runtime.bytes)}%</td></tr>
      <tr><td>Main</td><td>${shared.main.files.length}</td><td>${(shared.main.bytes / MB).toFixed(2)} MB</td><td>${pct(shared.main.bytes)}%</td></tr>
      <tr><td>Vendors</td><td>${shared.vendor.files.length}</td><td>${(shared.vendor.bytes / MB).toFixed(2)} MB</td><td>${pct(shared.vendor.bytes)}%</td></tr>
      <tr><td>Other shared</td><td>${shared.shared.files.length}</td><td>${(shared.shared.bytes / MB).toFixed(2)} MB</td><td>${pct(shared.shared.bytes)}%</td></tr>
    </tbody>
  </table>
</section>

<section>
  <h2>Top Packages</h2>
  ${
    stats.packages.length === 0
      ? '<div class="empty">No source maps found — package attribution unavailable.</div>'
      : `<table>
        <thead>
          <tr><th>Package</th><th>Apportioned Size</th><th>% of total</th><th>Chunks</th><th>File refs</th></tr>
        </thead>
        <tbody>${pkgRows}</tbody>
      </table>`
  }
</section>

<section>
  <h2>Top 25 Chunks</h2>
  ${
    stats.chunks.length === 0
      ? '<div class="empty">No chunks found.</div>'
      : `<table>
        <thead>
          <tr><th>File</th><th>Kind</th><th>Size</th><th>Top packages</th></tr>
        </thead>
        <tbody>${chunkRows}</tbody>
      </table>`
  }
</section>

<section>
  <h2>Methodology</h2>
  <ol>
    ${stats.notes.map((n) => '<li>' + escapeHtml(n) + '</li>').join('')}
  </ol>
</section>
</body>
</html>
`;

fs.writeFileSync(HTML_OUT, html, 'utf8');

// ---- 6. Console summary ----------------------------------------------------
console.log('[bundle-stats] wrote', path.relative(ROOT, STATS_OUT));
console.log('[bundle-stats] wrote', path.relative(ROOT, HTML_OUT));
console.log(
  '[bundle-stats] summary:',
  stats.totalMB + ' MB total',
  '· ' + pageList.length + ' page chunk(s)',
  '· ' + packageList.length + ' package(s)'
);