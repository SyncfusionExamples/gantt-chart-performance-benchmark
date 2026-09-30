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
  { key: 'p5k_10',   label: 'Run 5K / 10 levels',   records: 5000, depth: 10 },
  { key: 'p10k_10',  label: 'Run 10K / 10 levels',  records: 10000, depth: 10 },
  { key: 'p25k_10',  label: 'Run 25K / 10 levels',  records: 25000, depth: 10 },
  { key: 'p50k_10',  label: 'Run 50K / 10 levels',  records: 50000, depth: 10 }
];

export default function StressPage({ dataset }) {
  const {
    tasks,
    links,
    isLoading,
    loaders,
    currentSize,
    clearData,
    chartInstance,
    measureRender
  } = dataset;
  const [runningKey, setRunningKey] = useState(null);
  const [expandMs, setExpandMs] = useState(null);
  const [collapseMs, setCollapseMs] = useState(null);
  const expandStartRef = useRef(null);
  const collapseStartRef = useRef(null);

  // Stable ref. The DHTMLX React wrapper exposes
  // `node.instance` as a live getter that always returns the
  // current gantt instance. Reading `ganttRef.current.instance`
  // lazily never holds a stale reference, even after a
  // `key={chartInstance}`-driven remount.
  const ganttRef = useRef(null);

  const expandAllTree = useCallback((gantt) => {
  if (typeof gantt.eachTask !== 'function') return;

  gantt.eachTask((task) => {
    task.$open = true;
  });

  gantt.render();
}, []);

const collapseAllTree = useCallback((gantt) => {
  if (typeof gantt.eachTask !== 'function') return;

  gantt.eachTask((task) => {
    task.$open = false;
  });

  gantt.render();
}, []);

  const measureAround = useCallback((startTimeRef, setMs) => {
    requestAnimationFrame(() => {
      if (startTimeRef.current === null) return;
      const delta = performance.now() - startTimeRef.current;
      startTimeRef.current = null;
      setMs(delta);
    });
  }, []);

  const expandAll = useCallback(() => {
    const gantt = ganttRef.current && ganttRef.current.instance;
    if (!gantt) return;
    expandStartRef.current = performance.now();
    expandAllTree(gantt);
    measureAround(expandStartRef, setExpandMs);
  }, [expandAllTree, measureAround]);

  const collapseAll = useCallback(() => {
    const gantt = ganttRef.current && ganttRef.current.instance;
    if (!gantt) return;
    collapseStartRef.current = performance.now();
    collapseAllTree(gantt);
    measureAround(collapseStartRef, setCollapseMs);
  }, [collapseAllTree, measureAround]);

  useEffect(() => {
    setExpandMs(null);
    setCollapseMs(null);
  }, [chartInstance]);

  // Close the render-time timer on the last event in the
  // parse chain. `getTaskCount() > 0` guard ensures the empty
  // initial render from `gantt.init()` does NOT close the
  // timer prematurely. The `measureRender` dedupe guard makes
  // the secondary close-point (onGanttRender) a no-op.
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

  const runPreset = useCallback(
    (preset) => {
      if (runningKey) return;
      setRunningKey(preset.key);
      if (typeof clearData === 'function') clearData();
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
  }, [runningKey, clearData]);

  const showChart = tasks.length > 0 && chartInstance > 0;

  return (
    <BenchSection
      dataset={dataset}
      title="Hierarchy — Expand / Collapse latency"
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
          <button onClick={expandAll} disabled={Boolean(runningKey) || isLoading || tasks.length === 0}>
            Expand all
          </button>
          <button onClick={collapseAll} disabled={Boolean(runningKey) || isLoading || tasks.length === 0}>
            Collapse all
          </button>
        </>
      }
      summary={
        <div style={{ fontSize: '13px', color: '#64748b' }}>
          Current records: <b>{currentSize}</b>
          {' | '}
          Expand all: <b>{expandMs === null ? '—' : `${expandMs.toFixed(2)} ms`}</b>
          {' | '}
          Collapse all: <b>{collapseMs === null ? '—' : `${collapseMs.toFixed(2)} ms`}</b>
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
