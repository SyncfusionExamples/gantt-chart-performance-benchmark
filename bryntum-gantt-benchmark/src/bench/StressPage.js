import React, { useMemo, useRef, useState } from 'react';
import BenchSection from './BenchSection';
import BenchmarkGantt, { waitForTimelinePaint } from './BenchmarkGantt';

const STRESS_PRESETS = [
  // 25K uses the looped 5-level parent/child chain — every 5th record
  // is the deepest child, every 6th starts a new parent chain. The
  // 50K/75K/100K presets keep the existing balanced tree from
  // useDataset.js so we still have a wide-tree reference for
  // virtualization.
  { key: 'loadLoopedChain25000', size: 25000, depth: 5 },
  { key: 'loadHierarchy50000', size: 50000, depth: 10 },
  { key: 'loadHierarchy75000', size: 75000, depth: 10 },
  { key: 'loadHierarchy100000', size: 100000, depth: 10 }
];

export default function StressPage({ dataset }) {
  const { ganttRef, dataSource, loaders, isLoading } = dataset;
  const [history, setHistory] = useState([]);
  const [runningKey, setRunningKey] = useState(null);
  const pendingRunRef = useRef(null);

  const projectListeners = useMemo(() => ({
    dataReady: () => waitForTimelinePaint(
      () => ganttRef.current?.instance,
      () => {
        if (typeof dataset.measureRender === 'function') dataset.measureRender();
        if (pendingRunRef.current) {
          pendingRunRef.current(performance.now());
          pendingRunRef.current = null;
        }
      }
    )
  // Keep the listener identity stable while the report state updates,
  // matching the initial-load benchmark lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const waitForInitialRender = () => new Promise((resolve) => {
    pendingRunRef.current = resolve;
  });

  const runPreset = async (preset) => {
    if (runningKey) return;
    setRunningKey(preset.key);
    const start = performance.now();
    const renderComplete = waitForInitialRender();
    loaders[preset.key]();
    const renderEnd = await renderComplete;
    const renderSeconds = (renderEnd - start) / 1000;
    setHistory((items) => [
      ...items.filter((item) => item.size !== preset.size),
      {
        size: preset.size,
        depth: preset.depth,
        renderSeconds,
        success: true
      }
    ].sort((a, b) => a.size - b.size));
    setRunningKey(null);
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Hierarchy Stress Test"
      showControls={false}
      actions={
        STRESS_PRESETS.map((preset) => (
          <button key={preset.key} onClick={() => runPreset(preset)} disabled={Boolean(runningKey) || isLoading}>
            Run {preset.size / 1000}K / {preset.depth} levels
          </button>
        ))
      }
      summary={
        <>
          Initial hierarchy rendering report only.
          {history.length > 0 && (
            <table style={{ marginTop: '8px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '4px 12px', textAlign: 'left' }}>Records</th>
                  <th style={{ padding: '4px 12px', textAlign: 'left' }}>Depth</th>
                  <th style={{ padding: '4px 12px', textAlign: 'left' }}>Initial render</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 12px' }}>{h.size.toLocaleString()}</td>
                    <td style={{ padding: '4px 12px' }}>{h.depth}</td>
                    <td style={{ padding: '4px 12px' }}>{h.renderSeconds.toFixed(3)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      }
    >
      {dataSource.length > 0 ? (
        <BenchmarkGantt
          ganttRef={ganttRef}
          id="stress-gantt"
          dataSource={dataSource}
          projectListeners={projectListeners}
        />
      ) : isLoading ? <div style={{ marginTop: '12px' }}>Loading hierarchy records...</div> : null}
    </BenchSection>
  );
}