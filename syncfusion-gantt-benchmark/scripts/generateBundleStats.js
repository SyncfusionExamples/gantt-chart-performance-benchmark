#!/usr/bin/env node

/**
 * generateBundleStats.js
 *
 * Post-build analyzer that walks build/static/js/*.js, classifies each chunk,
 * introspects source maps to attribute bytes to packages, and emits:
 *   - public/bundle-stats.json (machine-readable)
 *   - public/bundle-report.html (human-readable stand-alone report)
 *
 * Run after `react-scripts build` (or manually via `npm run analyze:bundle`).
 * The JSON is served statically and polled by the BundlePage dashboard every 5s.
 */

const fs = require('fs');
const path = require('path');

const VERSION = '1.0.0';
const BUILD_DIR = path.join(__dirname, '..', 'build', 'static', 'js');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ============================================================================
// Helpers
// ============================================================================

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return ((bytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i]).trim();
};

const parseSourceMap = (mapPath) => {
  try {
    if (!fs.existsSync(mapPath)) return null;
    const mapJson = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    if (!mapJson.sources) return null;

    const packageCounts = {};
    mapJson.sources.forEach((source) => {
      const match = source.match(/node_modules\/([^/]+)/);
      if (match) {
        const pkg = match[1];
        packageCounts[pkg] = (packageCounts[pkg] || 0) + 1;
      }
    });

    return { packageCounts, sourceCount: mapJson.sources.length };
  } catch (e) {
    return null;
  }
};

const classifyChunk = (filename) => {
  if (/^main\.[^.]+\.js$/.test(filename)) return { type: 'main', pageId: null };
  if (/^runtime\.[^.]+\.js$/.test(filename)) return { type: 'runtime', pageId: null };
  if (/^vendors?~?.*\.[^.]+\.js$/.test(filename)) return { type: 'vendor', pageId: null };

  // Lazy-loaded page chunk: e.g., page-bundle.bf4994b2.chunk.js
  // CRA emits hex hashes after the dot, so accept [A-Za-z0-9]+ as the hash.
  const pageMatch = filename.match(/^([^.]+)\.[A-Za-z0-9]+\.chunk\.js$/);
  if (pageMatch) {
    const pageId = pageMatch[1];
    return { type: 'page', pageId };
  }

  // Numbered chunk (shared or unknown): e.g., 299.943078e1.chunk.js
  // Filenames here are also hex hashes after the leading numeric prefix.
  if (/^\d+\.[A-Za-z0-9]+\.chunk\.js$/.test(filename)) {
    return { type: 'shared', pageId: null };
  }

  return { type: 'other', pageId: null };
};

// ============================================================================
// Main analyzer
// ============================================================================

function analyze() {
  if (!fs.existsSync(BUILD_DIR)) {
    console.error(`[bundle-stats] build/static/js not found. Run 'npm run build' first.`);
    process.exit(1);
  }

  const files = fs.readdirSync(BUILD_DIR).filter((f) => f.endsWith('.js'));
  const chunks = [];
  const pages = {};
  const sharedContribution = { main: 0, runtime: 0, vendor: 0, shared: 0 };
  const allPackages = {};

  files.forEach((filename) => {
    const filePath = path.join(BUILD_DIR, filename);
    const bytes = fs.statSync(filePath).size;
    const { type, pageId } = classifyChunk(filename);

    const mapPath = filePath + '.map';
    const sourceMapInfo = parseSourceMap(mapPath);

    const chunk = {
      name: filename,
      type,
      pageId,
      bytes,
      hasSourceMap: fs.existsSync(mapPath),
      packages: sourceMapInfo ? sourceMapInfo.packageCounts : {}
    };

    chunks.push(chunk);
    sharedContribution[type] = (sharedContribution[type] || 0) + bytes;

    // Accumulate packages across all chunks
    if (sourceMapInfo) {
      Object.entries(sourceMapInfo.packageCounts).forEach(([pkg, count]) => {
        if (!allPackages[pkg]) {
          allPackages[pkg] = { count: 0, bytes: 0, chunks: [] };
        }
        allPackages[pkg].count += count;
        allPackages[pkg].bytes += Math.ceil(bytes / sourceMapInfo.sourceCount);
        allPackages[pkg].chunks.push(filename);
      });
    }

    // Collect per-page stats
    if (type === 'page') {
      if (!pages[pageId]) {
        pages[pageId] = { bytes: 0, chunks: [] };
      }
      pages[pageId].bytes += bytes;
      pages[pageId].chunks.push(filename);
    }
  });

  const totalBytes = chunks.reduce((sum, c) => sum + c.bytes, 0);
  const sharedBytes =
    sharedContribution.main +
    sharedContribution.runtime +
    sharedContribution.vendor +
    sharedContribution.shared;

  const pagesArray = Object.entries(pages)
    .map(([id, data]) => ({
      id,
      bytes: data.bytes,
      chunks: data.chunks
    }))
    .sort((a, b) => b.bytes - a.bytes);

  const packagesArray = Object.entries(allPackages)
    .map(([name, data]) => ({
      name,
      bytes: data.bytes,
      sourceCount: data.count,
      chunks: data.chunks
    }))
    .sort((a, b) => b.bytes - a.bytes);

  const stats = {
    generatedAt: new Date().toISOString(),
    version: VERSION,
    totalBytes,
    totalKB: (totalBytes / 1024).toFixed(2),
    totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
    shared: {
      mainBytes: sharedContribution.main,
      runtimeBytes: sharedContribution.runtime,
      vendorBytes: sharedContribution.vendor,
      sharedBytes: sharedContribution.shared,
      totalBytes: sharedBytes,
      totalKB: (sharedBytes / 1024).toFixed(2),
      totalMB: (sharedBytes / (1024 * 1024)).toFixed(2)
    },
    pages: pagesArray,
    packages: packagesArray.slice(0, 50), // Top 50 packages
    chunks: chunks.sort((a, b) => b.bytes - a.bytes),
    notes: [
      'totalBytes = sum of all .js files in build/static/js',
      'shared = main + runtime + vendor + shared chunks',
      'packages = extracted from source map sources field (approximate)',
      'chunks = sorted by size descending'
    ]
  };

  // Write JSON
  const jsonPath = path.join(PUBLIC_DIR, 'bundle-stats.json');
  fs.writeFileSync(jsonPath, JSON.stringify(stats, null, 2));
  console.log(`[bundle-stats] wrote ${jsonPath}`);

  // Write HTML report
  const htmlPath = path.join(PUBLIC_DIR, 'bundle-report.html');
  const html = generateHTMLReport(stats);
  fs.writeFileSync(htmlPath, html);
  console.log(`[bundle-stats] wrote ${htmlPath}`);

  console.log(
    `[bundle-stats] ${stats.totalMB} MB total (${stats.shared.totalMB} MB shared, ${pagesArray.length} page chunks)`
  );
}

function generateHTMLReport(stats) {
  const pageRows = stats.pages
    .map(
      (page) => `
    <tr>
      <td>${page.id}</td>
      <td>${formatBytes(page.bytes)}</td>
      <td>${((page.bytes / stats.totalBytes) * 100).toFixed(1)}%</td>
      <td style="font-size: 11px; color: #666;">${page.chunks.join(', ')}</td>
    </tr>
  `
    )
    .join('');

  const packageRows = stats.packages
    .slice(0, 25)
    .map(
      (pkg) => `
    <tr>
      <td>${pkg.name}</td>
      <td>${formatBytes(pkg.bytes)}</td>
      <td>${((pkg.bytes / stats.totalBytes) * 100).toFixed(1)}%</td>
      <td style="font-size: 11px; color: #666;">${pkg.sourceCount} sources</td>
    </tr>
  `
    )
    .join('');

  const formatKind = (type, pageId) => {
    if (type === 'page' && pageId) return `page / ${pageId.replace(/^page-/, '')}`;
    return type;
  };

  const topPackagesFor = (chunk, limit = 3) => {
    const entries = Object.entries(chunk.packages || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([pkg, count]) => `${pkg}<span style="color:#94a3b8">x${count}</span>`);
    return entries.join(', ');
  };

  const chunkRows = stats.chunks
    .slice(0, 25)
    .map(
      (chunk) => `
    <tr>
      <td>${chunk.name}</td>
      <td>${formatKind(chunk.type, chunk.pageId)}</td>
      <td>${formatBytes(chunk.bytes)}</td>
      <td style="font-size: 11px; color: #475569;">${topPackagesFor(chunk) || '—'}</td>
    </tr>
  `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bundle Report — ${new Date().toLocaleDateString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1, h2 { margin-top: 30px; margin-bottom: 12px; }
    h1 { font-size: 28px; }
    h2 { font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin: 20px 0;
    }
    .card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 16px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .card-label {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .card-value {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      font-family: 'Courier New', monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      background: white;
      font-size: 13px;
    }
    th {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      color: #475569;
    }
    td {
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
    }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #f1f5f9; }
    .meta {
      color: #64748b;
      font-size: 12px;
      margin-top: 20px;
      padding: 12px;
      background: #f1f5f9;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📦 Bundle Report</h1>
    <div class="meta">Generated: ${stats.generatedAt}</div>

    <h2>Overview</h2>
    <div class="summary">
      <div class="card">
        <div class="card-label">Total JS Payload</div>
        <div class="card-value">${stats.totalMB} MB</div>
      </div>
      <div class="card">
        <div class="card-label">Shared Bundle</div>
        <div class="card-value">${stats.shared.totalMB} MB</div>
      </div>
      <div class="card">
        <div class="card-label">Page Chunks</div>
        <div class="card-value">${stats.pages.length}</div>
      </div>
      <div class="card">
        <div class="card-label">Unique Packages</div>
        <div class="card-value">${stats.packages.length}</div>
      </div>
    </div>

    ${
      stats.pages.length > 0
        ? `
    <h2>Per-Page Lazy-Loaded Chunks</h2>
    <table>
      <thead>
        <tr>
          <th>Page ID</th>
          <th>Size</th>
          <th>% of Total</th>
          <th>Files</th>
        </tr>
      </thead>
      <tbody>
        ${pageRows}
      </tbody>
    </table>
    `
        : ''
    }

    ${
      stats.packages.length > 0
        ? `
    <h2>Top 25 Packages by Contribution</h2>
    <table>
      <thead>
        <tr>
          <th>Package</th>
          <th>Bytes</th>
          <th>% of Total</th>
          <th>Source Count</th>
        </tr>
      </thead>
      <tbody>
        ${packageRows}
      </tbody>
    </table>
    `
        : ''
    }

    <h2>Top 25 Chunks</h2>
    <table>
      <thead>
        <tr>
          <th>File</th>
          <th>Kind</th>
          <th>Size</th>
          <th>Top packages</th>
        </tr>
      </thead>
      <tbody>
        ${chunkRows}
      </tbody>
    </table>

    <div class="meta">
      <strong>Notes:</strong>
      <ul style="margin-left: 20px; margin-top: 8px;">
        ${stats.notes.map((note) => `<li>${note}</li>`).join('')}
      </ul>
    </div>
  </div>
</body>
</html>`;
}

// ============================================================================
// Run
// ============================================================================

try {
  analyze();
} catch (err) {
  console.error('[bundle-stats] Error:', err.message);
  process.exit(1);
}
