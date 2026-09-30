import React, { useEffect, useState, useCallback } from 'react';
import BenchSection from './BenchSection';

// ---------------------------------------------------------------------------
// BundlePage
// ----------
// Stand-alone dashboard for `bundle-stats.json`. It does NOT mount a Gantt
// — the previous implementation was a leftover that rendered a 50K-task
// dataset, which is unrelated to bundle analysis.
//
// Behavior:
//   * On mount + every 5 s, fetches /bundle-stats.json with cache: 'no-store'
//   * 200 OK      → state { stats, lastUpdated, error: null }
//   * non-2xx     → state { error } so the UI shows the message; nothing else
//                   renders until a successful response arrives
//
// Sections are conditionally mounted — they only appear when their backing
// metric is positive. There is intentionally NO placeholder text ("—",
// "awaiting build", "No data available") anywhere on the page.
//
// `dataset` is kept in the signature so the page still slots into the
// existing chrome; it's unused by the analyzer itself.
// ---------------------------------------------------------------------------

// Packages the dashboard surfaces in the "Shared Dependencies" call-out.
// This is the only project-specific bit in this file. To remove the call-out
// entirely, set this to `[]` — the section hides itself when zero rows
// match. The "All Shared Packages" table still renders below.
const HIGHLIGHTED_PACKAGES = [
  // The framework that drives this benchmark — surfaced first so it can't
  // hide behind a long tail of small packages.
  '@bryntum/gantt',
  '@bryntum/gantt-react',
  // React itself + the scheduler helper.
  'react',
  'react-dom',
  'react-scripts'
];

const POLL_INTERVAL_MS = 5000;
const STATS_URL = '/bundle-stats.json';

// ---- Number formatting helpers --------------------------------------------
const KB = 1024;
const MB = 1024 * 1024;
const fmtMB = (bytes) => (bytes / MB).toFixed(2);
const fmtKB = (bytes) => (bytes / KB).toFixed(2);
const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString();
  } catch (_e) {
    return iso;
  }
};

// ---- Section subcomponents -------------------------------------------------
// Each card is its own component so the parent's `return` only renders the
// ones that have data. Missing sections are completely absent from the DOM.

function Card({ label, value, sub }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: 16,
        boxShadow: '0 1px 2px rgba(15,23,42,.06)',
        minWidth: 180
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '.04em',
          marginBottom: 4
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: '#0f172a' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: 20,
        boxShadow: '0 1px 2px rgba(15,23,42,.06)',
        marginTop: 16
      }}
    >
      <h3 style={{ margin: '0 0 4px' }}>{title}</h3>
      {description && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569' }}>
          {description}
        </p>
      )}
      {children}
    </section>
  );
}

function Table({ columns, rows, getRowKey }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13
        }}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: col.align || 'left',
                  padding: '8px 10px',
                  background: '#f1f5f9',
                  borderBottom: '1px solid #e2e8f0',
                  fontWeight: 600,
                  color: '#334155'
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={getRowKey ? getRowKey(row) : i}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid #e2e8f0',
                    verticalAlign: 'top',
                    textAlign: col.align || 'left'
                  }}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Main page -------------------------------------------------------------
export default function BundlePage({ dataset }) {
  // `dataset` is intentionally unused by the analyzer but kept in the
  // signature so this component still slots into the existing
  // `<BenchSection>` chrome elsewhere in the suite.
  void dataset;

  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(STATS_URL, { cache: 'no-store' });
      if (!res.ok) {
        setError(
          `[bundle-stats] HTTP ${res.status} ${res.statusText} — ` +
            'is the build artifact present in /public?'
        );
        return;
      }
      const data = await res.json();
      setStats(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        `[bundle-stats] fetch failed: ${err && err.message ? err.message : err}`
      );
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStats]);

  // ---- Error state: nothing else renders --------------------------------
  if (error) {
    return (
      <BenchSection dataset={dataset} title="Bundle Size" showControls={false}>
        <div
          style={{
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: 16,
            fontSize: 13
          }}
        >
          {error}
          <div style={{ marginTop: 8, color: '#7f1d1d' }}>
            Run <code>npm run build</code> to generate{' '}
            <code>public/bundle-stats.json</code>.
          </div>
        </div>
      </BenchSection>
    );
  }

  // ---- Loading state: render nothing until first response arrives -------
  if (!stats) {
    return (
      <BenchSection dataset={dataset} title="Bundle Size" showControls={false}>
        <div style={{ fontSize: 13, color: '#475569' }}>
          Loading bundle stats…
        </div>
      </BenchSection>
    );
  }

  // ---- Data-driven sections --------------------------------------------
  const totalBytes = stats.totalBytes || 0;
  const shared = stats.shared || {};
  const sharedTotalBytes = shared.totalBytes || 0;
  const pages = Array.isArray(stats.pages) ? stats.pages : [];
  const packages = Array.isArray(stats.packages) ? stats.packages : [];
  const chunks = Array.isArray(stats.chunks) ? stats.chunks : [];
  const largestPage = stats.largestPage || null;

  // Pages with positive bytes only — keeps the table honest.
  const pagesWithBytes = pages.filter((p) => (p.bytes || 0) > 0);

  // Highlighted (call-out) packages: intersect HIGHLIGHTED_PACKAGES with the
  // analyzer's output. Hidden entirely if zero rows match.
  const highlighted = HIGHLIGHTED_PACKAGES
    .map((name) => packages.find((p) => p.pkg === name))
    .filter(Boolean)
    .filter((p) => (p.bytes || 0) > 0);

  return (
    <BenchSection
      dataset={dataset}
      title="Bundle Size"
      showControls={false}
      summary={
        lastUpdated ? (
          <div style={{ fontSize: 13, color: '#475569' }}>
            Last updated: <b>{lastUpdated.toLocaleTimeString()}</b> · auto-refresh every {POLL_INTERVAL_MS / 1000}s
          </div>
        ) : null
      }
    >
      {/* Summary tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginTop: 4
        }}
      >
        {totalBytes > 0 && (
          <Card
            label="Total JS Payload"
            value={`${fmtMB(totalBytes)} MB`}
            sub={`${stats.chunkCount || 0} chunks · ${fmtKB(totalBytes)} KB`}
          />
        )}
        {sharedTotalBytes > 0 && (
          <Card
            label="Shared Bundle Size"
            value={`${fmtMB(sharedTotalBytes)} MB`}
            sub={`${shared.percent || 0}% of total · runtime + main + vendors + shared`}
          />
        )}
        {pagesWithBytes.length > 0 && (
          <Card
            label="Lazy-Loaded Pages"
            value={`${pagesWithBytes.length}`}
            sub={
              largestPage
                ? `Largest: ${largestPage.id} (${fmtMB(largestPage.bytes)} MB)`
                : null
            }
          />
        )}
        {stats.generatedAt && (
          <Card
            label="Bundle Report Generated"
            value={fmtDate(stats.generatedAt)}
            sub={`Node ${stats.nodeVersion || ''}`}
          />
        )}
      </div>

      {/* Per-page table */}
      {pagesWithBytes.length > 0 && (
        <Section
          title="Lazy-Loaded Pages"
          description="Detected from page-<id>.<hash>.chunk.js filenames produced by webpackChunkName magic comments."
        >
          <Table
            rows={pagesWithBytes}
            columns={[
              { key: 'id', label: 'ID', render: (p) => <code>{p.id}</code> },
              { key: 'label', label: 'Label', render: (p) => p.label || p.id },
              { key: 'kb', label: 'Size', align: 'right', render: (p) => `${fmtKB(p.bytes)} KB` },
              { key: 'percent', label: '% of total', align: 'right', render: (p) => `${p.percent}%` },
              { key: 'chunks', label: 'Chunks', render: (p) => <code style={{ fontSize: 12 }}>{p.chunks.join(', ')}</code> }
            ]}
            getRowKey={(p) => p.id}
          />
        </Section>
      )}

      {/* Shared breakdown — runtime / main / vendor / other */}
      {sharedTotalBytes > 0 && (
        <Section
          title="Shared Bundle Breakdown"
          description="Eagerly-loaded code (runtime, entry, vendor splits). Compare against the page table to see how much each lazy page saves."
        >
          <Table
            rows={[
              { bucket: 'Runtime', bytes: shared.runtime?.bytes || 0 },
              { bucket: 'Main', bytes: shared.main?.bytes || 0 },
              { bucket: 'Vendors', bytes: shared.vendor?.bytes || 0 },
              { bucket: 'Other shared', bytes: shared.shared?.bytes || 0 }
            ]}
            columns={[
              { key: 'bucket', label: 'Bucket' },
              { key: 'kb', label: 'Size', align: 'right', render: (r) => `${fmtKB(r.bytes)} KB` },
              {
                key: 'percent',
                label: '% of total',
                align: 'right',
                render: (r) => `${((r.bytes / totalBytes) * 100).toFixed(1)}%`
              }
            ]}
            getRowKey={(r) => r.bucket}
          />
        </Section>
      )}

      {/* Highlighted (framework) call-out */}
      {highlighted.length > 0 && (
        <Section
          title="Shared Dependencies"
          description="Framework + key packages surfaced from the analyzer. Approximate attribution via source maps."
        >
          <Table
            rows={highlighted}
            columns={[
              { key: 'pkg', label: 'Package', render: (p) => <code>{p.pkg}</code> },
              { key: 'kb', label: 'Size', align: 'right', render: (p) => `${fmtKB(p.bytes)} KB` },
              { key: 'percent', label: '% of total', align: 'right', render: (p) => `${p.percent}%` },
              { key: 'chunkRefs', label: 'Chunks', align: 'right' },
              { key: 'fileRefs', label: 'File refs', align: 'right' }
            ]}
            getRowKey={(p) => p.pkg}
          />
        </Section>
      )}

      {/* All shared packages */}
      {packages.length > 0 && (
        <Section
          title="All Shared Packages"
          description="Per-package attribution derived from chunk source maps. Bytes are approximated by file-count share."
        >
          <Table
            rows={packages.slice(0, 30)}
            columns={[
              { key: 'pkg', label: 'Package', render: (p) => <code>{p.pkg}</code> },
              { key: 'kb', label: 'Size', align: 'right', render: (p) => `${fmtKB(p.bytes)} KB` },
              { key: 'percent', label: '% of total', align: 'right', render: (p) => `${p.percent}%` },
              { key: 'chunkRefs', label: 'Chunks', align: 'right' },
              { key: 'fileRefs', label: 'File refs', align: 'right' }
            ]}
            getRowKey={(p) => p.pkg}
          />
        </Section>
      )}

      {/* Top chunks */}
      {chunks.length > 0 && (
        <Section
          title="Top Chunks"
          description="The 25 largest JS chunks after `npm run build`."
        >
          <Table
            rows={chunks}
            columns={[
              { key: 'file', label: 'File', render: (c) => <code style={{ fontSize: 12 }}>{c.file}</code> },
              {
                key: 'classification',
                label: 'Kind',
                render: (c) => (c.pageId ? `${c.classification} / ${c.pageId}` : c.classification)
              },
              { key: 'kb', label: 'Size', align: 'right', render: (c) => `${fmtKB(c.bytes)} KB` },
              {
                key: 'topPackages',
                label: 'Top packages',
                render: (c) => (
                  <code style={{ fontSize: 12 }}>
                    {c.topPackages && c.topPackages.length > 0
                      ? c.topPackages.map((p) => `${p.pkg}×${p.count}`).join(', ')
                      : '—'}
                  </code>
                )
              }
            ]}
            getRowKey={(c) => c.file}
          />
        </Section>
      )}
    </BenchSection>
  );
}