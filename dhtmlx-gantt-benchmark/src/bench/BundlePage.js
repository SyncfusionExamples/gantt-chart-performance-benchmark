import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactGantt from '@dhtmlx/trial-react-gantt';
import BenchSection from './BenchSection';
import {
  defaultConfig,
  defaultPlugins,
  defaultScales,
  minimalColumns
} from './ganttSetup';
import closeAfterPaint from './useRenderClose';

/**
 * BundlePage Dashboard
 *
 * Polls bundle-stats.json every 5 seconds and renders a dashboard showing:
 * - Total JS payload
 * - Shared bundle breakdown (main, runtime, vendor, shared)
 * - Per-page lazy-loaded chunk sizes
 * - Package-level attribution (top by bytes)
 * - Link to stand-alone HTML report
 *
 * All sections are conditionally hidden if their data is missing (no placeholders).
 */

// Customize this for your project
const HIGHLIGHTED_PACKAGES = [
  '@dhtmlx/trial-react-gantt',
  '@dhtmlx/gantt',
  'react',
  'react-dom'
];

const formatMB = (bytes) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

export default function BundlePage({ dataset }) {
  const { tasks, links, isLoading, loaders, chartInstance, measureRender } = dataset;

  const ganttRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch bundle stats every 5 seconds
  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        const res = await fetch(`${process.env.PUBLIC_URL || ''}/bundle-stats.json`, {
          cache: 'no-store'
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setStats(data);
        setLoadError(null);
        setLastUpdated(new Date());
      } catch (err) {
        if (cancelled) return;
        setLoadError(err.message);
        setStats(null);
      }
    };

    // Fetch immediately and then every 5 seconds
    fetchStats();
    const interval = setInterval(fetchStats, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (tasks.length !== 50000 && !isLoading) loaders.load50000();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the render-time timer on the last event in the
  // parse chain. `getTaskCount() > 0` guard ensures the empty
  // initial render from `gantt.init()` does NOT close the
  // timer prematurely.
  const handleAfterAutoSchedule = useCallback(() => {
    const gantt = ganttRef.current && ganttRef.current.instance;
    if (!gantt) return;
    if (gantt.getTaskCount && gantt.getTaskCount() === 0) return;
    closeAfterPaint(measureRender);
  }, [measureRender]);

  const handleGanttRender = useCallback(() => {
    const gantt = ganttRef.current && ganttRef.current.instance;
    if (!gantt) return;
    if (gantt.getTaskCount && gantt.getTaskCount() === 0) return;
    closeAfterPaint(measureRender);
  }, [measureRender]);

  // === Render helper for conditional sections ===
  const renderCard = (label, value, unit = '') => {
    if (!value && value !== 0) return null;
    return (
      <div
        style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '12px',
          flex: '1 1 160px'
        }}
      >
        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
          {label}
        </div>
        <div
          style={{
            fontSize: '18px',
            fontWeight: '700',
            fontFamily: 'monospace',
            marginTop: '4px'
          }}
        >
          {value}
          {unit && <span style={{ fontSize: '12px', marginLeft: '2px' }}>{unit}</span>}
        </div>
      </div>
    );
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Bundle Size"
      showControls={false}
      summary={
        <div
          data-testid="bundle-report"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '13px',
            marginTop: '8px'
          }}
        >
          {/* Error message */}
          {loadError && (
            <div style={{ color: '#b91c1c', padding: '8px', background: '#fee2e2', borderRadius: '4px' }}>
              Failed to load bundle-stats.json: {loadError}
            </div>
          )}

          {/* Main dashboard cards */}
          {stats && (
            <div>
              {/* Overview cards */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {renderCard('Total JS Payload', formatMB(stats.totalBytes))}
                {stats.shared && stats.shared.totalBytes > 0 &&
                  renderCard('Shared Bundle', formatMB(stats.shared.totalBytes))}
                {stats.pages && stats.pages.length > 0 &&
                  renderCard('Lazy-Loaded Pages', stats.pages.length)}
                {stats.generatedAt &&
                  renderCard('Generated', new Date(stats.generatedAt).toLocaleTimeString())}
              </div>

              {/* Shared bundle breakdown */}
              {stats.shared && stats.shared.totalBytes > 0 && (
                <div
                  style={{
                    fontSize: '12px',
                    padding: '8px 12px',
                    background: '#f1f5f9',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '4px' }}>Shared Bundle Breakdown:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '4px' }}>
                    {stats.shared.mainBytes > 0 && (
                      <div style={{ color: '#475569' }}>
                        <span style={{ color: '#64748b' }}>main:</span> {formatMB(stats.shared.mainBytes)}
                      </div>
                    )}
                    {stats.shared.runtimeBytes > 0 && (
                      <div style={{ color: '#475569' }}>
                        <span style={{ color: '#64748b' }}>runtime:</span> {formatMB(stats.shared.runtimeBytes)}
                      </div>
                    )}
                    {stats.shared.vendorBytes > 0 && (
                      <div style={{ color: '#475569' }}>
                        <span style={{ color: '#64748b' }}>vendor:</span> {formatMB(stats.shared.vendorBytes)}
                      </div>
                    )}
                    {stats.shared.sharedBytes > 0 && (
                      <div style={{ color: '#475569' }}>
                        <span style={{ color: '#64748b' }}>shared:</span> {formatMB(stats.shared.sharedBytes)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Per-page table */}
              {stats.pages && stats.pages.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>
                    Per-Page Chunks:
                  </div>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '11px',
                      background: 'white'
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '6px', textAlign: 'left', fontWeight: '600' }}>Page</th>
                        <th style={{ padding: '6px', textAlign: 'right', fontWeight: '600' }}>Size</th>
                        <th style={{ padding: '6px', textAlign: 'right', fontWeight: '600' }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.pages.map((page) => (
                        <tr key={page.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px' }}>{page.id}</td>
                          <td style={{ padding: '6px', textAlign: 'right' }}>
                            {formatMB(page.bytes)}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'right' }}>
                            {((page.bytes / stats.totalBytes) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Highlighted packages */}
              {stats.packages && stats.packages.length > 0 && HIGHLIGHTED_PACKAGES.length > 0 && (
                (() => {
                  const highlighted = HIGHLIGHTED_PACKAGES
                    .map((name) =>
                      stats.packages.find((p) => p.name === name || p.name.startsWith(name + '/'))
                    )
                    .filter(Boolean);

                  return highlighted.length > 0 ? (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>
                        Shared Dependencies:
                      </div>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '11px',
                          background: 'white'
                        }}
                      >
                        <thead>
                          <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '6px', textAlign: 'left', fontWeight: '600' }}>Package</th>
                            <th style={{ padding: '6px', textAlign: 'right', fontWeight: '600' }}>Size</th>
                            <th style={{ padding: '6px', textAlign: 'right', fontWeight: '600' }}>%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {highlighted.map((pkg) => (
                            <tr key={pkg.name} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '6px' }}>{pkg.name}</td>
                              <td style={{ padding: '6px', textAlign: 'right' }}>
                                {formatMB(pkg.bytes)}
                              </td>
                              <td style={{ padding: '6px', textAlign: 'right' }}>
                                {((pkg.bytes / stats.totalBytes) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null;
                })()
              )}

              {/* All packages table */}
              {stats.packages && stats.packages.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>
                    All Shared Packages (Top 50):
                  </div>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '11px',
                      background: 'white',
                      maxHeight: '300px',
                      overflow: 'auto'
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '6px', textAlign: 'left', fontWeight: '600' }}>Package</th>
                        <th style={{ padding: '6px', textAlign: 'right', fontWeight: '600' }}>Size</th>
                        <th style={{ padding: '6px', textAlign: 'right', fontWeight: '600' }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.packages.map((pkg) => (
                        <tr key={pkg.name} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px' }}>{pkg.name}</td>
                          <td style={{ padding: '6px', textAlign: 'right' }}>
                            {formatMB(pkg.bytes)}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'right' }}>
                            {((pkg.bytes / stats.totalBytes) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Link to static report */}
              {stats.generatedAt && (
                <div style={{ marginTop: '8px' }}>
                  <a
                    href={`${process.env.PUBLIC_URL || ''}/bundle-report.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '12px',
                      color: '#0ea5e9',
                      textDecoration: 'none',
                      padding: '6px 0'
                    }}
                  >
                    → View full static report
                  </a>
                </div>
              )}

              {lastUpdated && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
          )}
        </div>
      }
    >
    </BenchSection>
  );
}
