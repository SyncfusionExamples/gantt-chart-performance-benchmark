import React, { useEffect, useRef, useState } from 'react';
import BenchSection from './BenchSection';

// Package names we want to call out explicitly in the "Shared Dependencies"
// section, in the order they should appear. Anything not in this list is
// still shown in the package table, just not highlighted in the
// Syncfusion section.
const HIGHLIGHTED_PACKAGES = [
  '@syncfusion/ej2-react-gantt',
  '@syncfusion/ej2-gantt',
  '@syncfusion/ej2-treegrid',
  '@syncfusion/ej2-grids',
  'react',
  'react-dom',
  'scheduler'
];

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

const formatMB = (bytes) => {
  if (!Number.isFinite(bytes)) return '0.00';
  return (bytes / (1024 * 1024)).toFixed(2);
};

const formatKB = (bytes) => {
  if (!Number.isFinite(bytes)) return '0.00';
  return (bytes / 1024).toFixed(2);
};

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

// Syncfusion section: pick out the highlighted packages from the full
// package list, falling back gracefully when source-map attribution is
// missing.
const buildSyncfusionSection = (packages) => {
  if (!Array.isArray(packages) || packages.length === 0) return null;
  const byName = Object.fromEntries(packages.map((p) => [p.name, p]));
  const rows = HIGHLIGHTED_PACKAGES
    .map((name) => byName[name])
    .filter(Boolean)
    .map((pkg) => ({
      name: pkg.name,
      bytes: pkg.bytes,
      kb: pkg.kb,
      mb: pkg.mb,
      percentOfTotal: pkg.percentOfTotal,
      isSyncfusion: pkg.name.startsWith('@syncfusion/')
    }));
  return { rows };
};

export default function BundlePage({ dataset }) {
  // Bundle page doesn't drive any benchmark itself, but it still takes a
  // `dataset` so it slots into the same `BenchSection` chrome as every
  // other page. We keep the props referenced to silence lint.
  const { isLoading } = dataset;
  void isLoading;
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const pollRef = useRef(null);

  // Fetch /bundle-stats.json on mount and then poll every 5 seconds so
  // a fresh `npm run build` is reflected without reloading the tab.
  // `bundle-stats.json` is written into /public during `npm run build`,
  // so CRA serves it at /bundle-stats.json in both dev and production.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/bundle-stats.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setStats(data);
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        if (cancelled) return;
        setError(err.message || 'Failed to load bundle-stats.json');
      }
    };

    load();
    pollRef.current = setInterval(load, 5000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pages = Array.isArray(stats?.pages) ? stats.pages : [];
  const packages = Array.isArray(stats?.packages) ? stats.packages : [];
  const shared = stats?.shared || {};
  const syncfusion = buildSyncfusionSection(packages);

  const totalBytes = stats?.totalBytes ?? 0;
  const sharedTotal = shared?.totalBytes ?? 0;
  const totalPagesBytes = pages.reduce((acc, p) => acc + (p.bytes || 0), 0);

  const largestPage = pages
    .filter((p) => p.bytes > 0)
    .slice()
    .sort((a, b) => b.bytes - a.bytes)[0];
  const largestSharedPackage = packages
    .filter((p) => p.bytes > 0)
    .slice()
    .sort((a, b) => b.bytes - a.bytes)[0];
  const largestSyncfusionPackage = packages
    .filter((p) => p.bytes > 0 && p.name.startsWith('@syncfusion/'))
    .slice()
    .sort((a, b) => b.bytes - a.bytes)[0];

  const maxPageBytes = Math.max(1, ...pages.map((p) => p.bytes || 0));
  const maxPackageBytes = Math.max(
    1,
    ...packages.map((p) => p.bytes || 0)
  );

  // Dashboard cards ------------------------------------------------------------
  // Every card is gated on having a real value. Cards whose backing data
  // isn't present are dropped from the array entirely so the dashboard
  // never renders empty placeholders, "—", or "awaiting build" rows.
  const dashboardCards = [];
  if (Number.isFinite(totalBytes) && totalBytes > 0) {
    dashboardCards.push({
      label: 'Total JS Payload',
      value: `${formatMB(totalBytes)} MB`,
      sub: `${formatBytes(totalBytes)}`,
      accent: '#2563eb'
    });
  }
  if (Number.isFinite(sharedTotal) && sharedTotal > 0) {
    dashboardCards.push({
      label: 'Shared Bundle Size',
      value: `${formatMB(sharedTotal)} MB`,
      sub: `${formatBytes(sharedTotal)} (${(
        (sharedTotal / Math.max(totalBytes, 1)) *
        100
      ).toFixed(1)}% of total)`,
      accent: '#0ea5e9'
    });
  }
  if (pages.length > 0) {
    dashboardCards.push({
      label: 'Lazy-Loaded Pages',
      value: `${pages.length}`,
      sub: `${formatBytes(totalPagesBytes)} across all chunks`,
      accent: '#16a34a'
    });
  }
  if (stats?.generatedAt) {
    dashboardCards.push({
      label: 'Bundle Report Generated',
      value: formatDateTime(stats.generatedAt).split(',')[0],
      sub: formatDateTime(stats.generatedAt),
      accent: '#9333ea'
    });
  }

  return (
    <BenchSection
      dataset={dataset}
      title="Bundle Size"
      showControls={false}
      summary={
        <div style={{ fontSize: '13px', color: '#475569' }}>
          {error ? (
            <span style={{ color: '#b91c1c' }}>
              Could not read <code>/bundle-stats.json</code> — {error}. Run{' '}
              <code>npm run build</code> to generate the report.
            </span>
          ) : stats && lastUpdated ? (
            <div>
              Last refresh: <b>{lastUpdated.toLocaleTimeString()}</b>
              {' · '}auto-refreshes every 5s after each <code>npm run build</code>.
            </div>
          ) : null}
        </div>
      }
    >
      <BundleDashboardView
        ready={Boolean(stats)}
        dashboardCards={dashboardCards}
        pages={pages}
        maxPageBytes={maxPageBytes}
        syncfusion={syncfusion}
        packages={packages}
        maxPackageBytes={maxPackageBytes}
        totals={{
          totalBytes,
          sharedTotal,
          totalPagesBytes,
          largestPage,
          largestSharedPackage,
          largestSyncfusionPackage
        }}
      />
    </BenchSection>
  );
}

function BundleDashboardView({
  ready,
  dashboardCards,
  pages,
  maxPageBytes,
  syncfusion,
  packages,
  maxPackageBytes,
  totals
}) {
  // Each section is gated on real data — sections with no rows are
  // omitted from the rendered tree entirely, so the page never displays
  // placeholders, "—", "awaiting build", or any other empty state.
  // `ready` is only used to keep the underlying React tree stable across
  // the first fetch; it doesn't gate any empty-state fallback.
  void ready;

  const sortedPages = pages.slice().sort((a, b) => (b.bytes || 0) - (a.bytes || 0));
  const sortedPackages = packages
    .slice()
    .sort((a, b) => (b.bytes || 0) - (a.bytes || 0));

  const hasPageData = sortedPages.some((p) => (p.bytes || 0) > 0);
  const hasPackageData = sortedPackages.length > 0;
  const hasSyncfusionRows = (syncfusion?.rows || []).length > 0;

  // Final summary card list — each card is only added if its data is
  // actually available. No card is ever rendered with an empty value.
  const summaryCards = [];
  if (Number.isFinite(totals.totalBytes) && totals.totalBytes > 0) {
    summaryCards.push({
      label: 'Total Application Bundle Size',
      value: formatMB(totals.totalBytes),
      sub: `${formatKB(totals.totalBytes)} KB`
    });
  }
  if (Number.isFinite(totals.sharedTotal) && totals.sharedTotal > 0) {
    summaryCards.push({
      label: 'Shared Framework Bundle Size',
      value: formatMB(totals.sharedTotal),
      sub: `${((totals.sharedTotal / Math.max(totals.totalBytes, 1)) * 100).toFixed(1)}% of total`
    });
  }
  if (Number.isFinite(totals.totalPagesBytes) && totals.totalPagesBytes > 0) {
    summaryCards.push({
      label: 'Total Benchmark Page Bundle Size',
      value: formatMB(totals.totalPagesBytes),
      sub: `${pages.length} lazy chunks`
    });
  }
  if (totals.largestPage && totals.largestPage.bytes > 0) {
    summaryCards.push({
      label: 'Largest Page Chunk',
      value: totals.largestPage.label,
      sub: formatBytes(totals.largestPage.bytes)
    });
  }
  if (totals.largestSharedPackage && totals.largestSharedPackage.bytes > 0) {
    summaryCards.push({
      label: 'Largest Shared Dependency',
      value: totals.largestSharedPackage.name,
      sub: formatBytes(totals.largestSharedPackage.bytes)
    });
  }
  if (totals.largestSyncfusionPackage && totals.largestSyncfusionPackage.bytes > 0) {
    summaryCards.push({
      label: 'Largest Syncfusion Package',
      value: totals.largestSyncfusionPackage.name,
      sub: formatBytes(totals.largestSyncfusionPackage.bytes),
      accent: '#b91c1c'
    });
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top-row dashboard cards (only ones with real values) */}
      {dashboardCards.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px'
          }}
        >
          {dashboardCards.map((card) => (
            <div
              key={card.label}
              style={{
                background: '#ffffff',
                borderLeft: `4px solid ${card.accent}`,
                borderRadius: '6px',
                padding: '14px 16px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)'
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {card.label}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 600, color: '#0f172a', marginTop: '4px' }}>
                {card.value}
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                {card.sub}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Page-wise table — only when at least one page has bytes */}
      {hasPageData && (
        <section>
          <h3 style={{ margin: '0 0 8px', fontSize: '15px', color: '#0f172a' }}>
            Page-wise Bundle Size
          </h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Page Name</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Bundle Size (KB)</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>% of Total Bundle</th>
                <th style={thStyle}>Relative</th>
              </tr>
            </thead>
            <tbody>
              {sortedPages
                .filter((p) => (p.bytes || 0) > 0)
                .map((p) => {
                  const widthPct = Math.max(
                    2,
                    ((p.bytes || 0) / maxPageBytes) * 100
                  );
                  return (
                    <tr key={p.id}>
                      <td style={tdStyle}>
                        {p.label} <code style={codeStyle}>{p.id}</code>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {(p.kb ?? 0).toFixed(2)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {(p.percentOfTotal ?? 0).toFixed(2)}%
                      </td>
                      <td style={tdStyle}>
                        <div style={barTrackStyle}>
                          <div
                            style={{
                              ...barFillStyle,
                              width: `${widthPct}%`,
                              background: '#2563eb'
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      )}

      {/* Syncfusion / shared dependencies — only when source-map attribution found the highlighted packages */}
      {hasSyncfusionRows && (
        <section>
          <h3 style={{ margin: '0 0 8px', fontSize: '15px', color: '#0f172a' }}>
            Shared Dependencies (Syncfusion)
          </h3>
          <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 8px' }}>
            Syncfusion's Gantt framework is the dominant shared cost. The rows below are
            apportioned from each chunk's source map by source-file share.
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Package</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Size (KB)</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Size (MB)</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>% of Total Bundle</th>
              </tr>
            </thead>
            <tbody>
              {syncfusion.rows.map((p) => (
                <tr key={p.name} style={p.isSyncfusion ? { background: '#fef2f2' } : undefined}>
                  <td style={tdStyle}>
                    <code style={codeStyle}>{p.name}</code>
                    {p.isSyncfusion && (
                      <span
                        style={{
                          marginLeft: '6px',
                          color: '#b91c1c',
                          fontWeight: 600,
                          fontSize: '11px',
                          textTransform: 'uppercase'
                        }}
                      >
                        Syncfusion
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{(p.kb ?? 0).toFixed(2)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{(p.mb ?? 0).toFixed(2)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{(p.percentOfTotal ?? 0).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Full package table — only when there's at least one package with bytes */}
      {hasPackageData && (
        <section>
          <h3 style={{ margin: '0 0 8px', fontSize: '15px', color: '#0f172a' }}>
            All Shared Packages
          </h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Package Name</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Size (KB)</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Size (MB)</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>% of Total Bundle</th>
                <th style={thStyle}>Relative</th>
              </tr>
            </thead>
            <tbody>
              {sortedPackages.map((p) => {
                const widthPct = Math.max(
                  2,
                  ((p.bytes || 0) / maxPackageBytes) * 100
                );
                const isSyncfusion = p.name.startsWith('@syncfusion/');
                return (
                  <tr
                    key={p.name}
                    style={isSyncfusion ? { background: '#fef2f2' } : undefined}
                  >
                    <td style={tdStyle}>
                      <code style={codeStyle}>{p.name}</code>
                      {isSyncfusion && (
                        <span
                          style={{
                            marginLeft: '6px',
                            color: '#b91c1c',
                            fontWeight: 600,
                            fontSize: '11px',
                            textTransform: 'uppercase'
                          }}
                        >
                          Syncfusion
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{(p.kb ?? 0).toFixed(2)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{(p.mb ?? 0).toFixed(2)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{(p.percentOfTotal ?? 0).toFixed(2)}%</td>
                    <td style={tdStyle}>
                      <div style={barTrackStyle}>
                        <div
                          style={{
                            ...barFillStyle,
                            width: `${widthPct}%`,
                            background: isSyncfusion ? '#dc2626' : '#2563eb'
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Final summary — only cards whose underlying data is non-empty */}
      {summaryCards.length > 0 && (
        <section>
          <h3 style={{ margin: '0 0 8px', fontSize: '15px', color: '#0f172a' }}>
            Summary
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px'
            }}
          >
            {summaryCards.map((card) => (
              <SummaryCard key={card.label} {...card} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div
      style={{
        background: '#f8fafc',
        borderLeft: `4px solid ${accent || '#0f172a'}`,
        borderRadius: '6px',
        padding: '12px 14px'
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.04em'
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', marginTop: '4px', wordBreak: 'break-word' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
  background: '#ffffff'
};

const thStyle = {
  textAlign: 'left',
  padding: '8px 10px',
  background: '#f1f5f9',
  borderBottom: '1px solid #e2e8f0',
  color: '#0f172a',
  fontWeight: 600
};

const tdStyle = {
  padding: '8px 10px',
  borderBottom: '1px solid #e2e8f0',
  color: '#0f172a'
};

const codeStyle = {
  background: '#f1f5f9',
  padding: '1px 6px',
  borderRadius: '3px',
  fontSize: '12px',
  color: '#0f172a'
};

const barTrackStyle = {
  background: '#e2e8f0',
  borderRadius: '4px',
  height: '10px',
  width: '100%',
  minWidth: '120px'
};

const barFillStyle = {
  height: '10px',
  borderRadius: '4px'
};