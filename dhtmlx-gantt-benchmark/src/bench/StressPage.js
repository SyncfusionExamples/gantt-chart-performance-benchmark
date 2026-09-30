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

// Presets per the user spec:
//
//   5K / 25K  → 5-level hierarchy (Project → Phase →
//                Module → Feature → Task)
//   50K / 75K / 100K → 10-level hierarchy
//                (Project → ... → Level 10)
//
// The generator produces a true recursive tree where:
//   - durations cycle through 5 groups A/B/C/D/E (each
//     group is a 5-element base pattern that extends +2
//     per level for depth>5)
//   - start dates cascade FS-style within each chain;
//     each chain's root is anchored one day after the
//     previous chain's root (staggered cluster)
//   - progress values cycle through a fixed 12-value
//     list (69, 57, 16, 92, ...)
//   - NO dependencies, links, predecessors, FS edges,
//     critical-path, or auto-scheduling
//   - the comprehensive `validateHierarchyStress`
//     validator runs after every load
const STRESS_PRESETS = [
  { key: 'p25k_5',   label: 'Run 25K / 5 levels',   records: 25000, depth: 5  },
  { key: 'p50k_10',  label: 'Run 50K / 10 levels',  records: 50000,  depth: 10 },
  { key: 'p75k_10',  label: 'Run 75K / 10 levels',  records: 75000,  depth: 10 },
  { key: 'p100k_10', label: 'Run 100K / 10 levels', records: 100000, depth: 10 }
];

export default function StressPage({ dataset }) {
  const {
    tasks,
    links,
    isLoading,
    loaders,
    renderSeconds,
    currentSize,
    clearData,
    chartInstance,
    measureRender,
    markAutoScheduled
  } = dataset;
  const [report, setReport] = useState([]);
  const [activePreset, setActivePreset] = useState(null);
  const [runningKey, setRunningKey] = useState(null);

  // Stable ref. The DHTMLX React wrapper exposes
  // `node.instance` as a live getter that always returns the
  // current gantt instance. Reading `ganttRef.current.instance`
  // lazily never holds a stale reference, even after a
  // `key={chartInstance}`-driven remount.
  const ganttRef = useRef(null);

  useEffect(() => {
    if (renderSeconds === null || renderSeconds === undefined) return;
    if (!activePreset) return;
    setReport([
      {
        key: activePreset.key,
        records: activePreset.records,
        depth: activePreset.depth,
        actual: currentSize,
        initialRenderSeconds: renderSeconds
      }
    ]);
  }, [renderSeconds, activePreset, currentSize]);

  // Close the render-time timer on the last event in the
  // parse chain. `getTaskCount() > 0` guard ensures the empty
  // initial render from `gantt.init()` does NOT close the
  // timer prematurely. The `measureRender` dedupe guard makes
  // the secondary close-point (onGanttRender) a no-op.
  const handleAfterAutoSchedule = useCallback(() => {
    const gantt = ganttRef.current && ganttRef.current.instance;
    if (!gantt) return;
    if (gantt.getTaskCount && gantt.getTaskCount() === 0) return;
    if (typeof markAutoScheduled === 'function') markAutoScheduled();
    closeAfterPaint(measureRender);
  }, [measureRender, markAutoScheduled]);

  const handleGanttRender = useCallback(() => {
    const gantt = ganttRef.current && ganttRef.current.instance;
    if (!gantt) return;
    if (gantt.getTaskCount && gantt.getTaskCount() === 0) return;
    closeAfterPaint(measureRender);
  }, [measureRender]);

  const runPreset = useCallback(
    (preset) => {
      if (runningKey) return;
      setRunningKey(preset.key);
      if (typeof clearData === 'function') clearData();
      setReport([]);
      setActivePreset(preset);
      // `loadDeepHierarchy(records, depth)` produces a true
      // N-level recursive nesting (one chain per `depth`
      // records).
      if (typeof loaders.loadDeepHierarchy === 'function') {
        loaders.loadDeepHierarchy(preset.records, preset.depth);
      } else {
        loaders.loadHierarchy(preset.records, preset.depth);
      }
      Promise.resolve().then(() => setRunningKey(null));
    },
    [runningKey, clearData, loaders]
  );

  const handleClear = useCallback(() => {
    if (runningKey) return;
    if (typeof clearData === 'function') clearData();
    setReport([]);
    setActivePreset(null);
  }, [runningKey, clearData]);

  const showChart = tasks.length > 0 && chartInstance > 0;

  return (
    <BenchSection
      dataset={dataset}
      title="Hierarchy Stress Test"
      showControls={false}
      actions={
        <>
          {STRESS_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => runPreset(preset)}
              disabled={Boolean(runningKey) || isLoading}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={Boolean(runningKey) || isLoading || tasks.length === 0}
            style={{ marginLeft: '8px' }}
          >
            Clear
          </button>
        </>
      }
      summary={
        <div style={{ fontSize: '13px', color: '#64748b' }}>
          Initial hierarchy rendering report only.
          {report.length > 0 && (
            <table style={{ borderCollapse: 'collapse', marginTop: '4px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '2px 10px 2px 0', textAlign: 'left', fontWeight: 'normal' }}>Records</th>
                  <th style={{ padding: '2px 10px 2px 0', textAlign: 'left', fontWeight: 'normal' }}>Depth</th>
                  <th style={{ padding: '2px 0', textAlign: 'left', fontWeight: 'normal' }}>Initial render</th>
                </tr>
              </thead>
              <tbody>
                {report.map((row) => (
                  <tr key={row.key}>
                    <td style={{ padding: '2px 10px 2px 0' }}>
                      {row.records.toLocaleString()}
                      {row.actual !== row.records && row.actual
                        ? <span style={{ color: '#94a3b8' }}> ({row.actual.toLocaleString()})</span>
                        : null}
                    </td>
                    <td style={{ padding: '2px 10px 2px 0' }}>{row.depth}</td>
                    <td style={{ padding: '2px 0' }}>
                      {row.initialRenderSeconds === null || row.initialRenderSeconds === undefined
                        ? '—'
                        : `${row.initialRenderSeconds.toFixed(3)} s`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      }
    >
      {showChart && (
        <div style={{ height: '750px' }}>
          <ReactGantt
            ref={ganttRef}
            tasks={tasks}
            links={links}
            key={chartInstance}
            theme="terrace"
            config={defaultConfig}
            plugins={defaultPlugins}
            columns={minimalColumns}
            scales={defaultScales}
            onAfterAutoSchedule={handleAfterAutoSchedule}
            onGanttRender={handleGanttRender}
          />
        </div>
      )}
    </BenchSection>
  );
}
