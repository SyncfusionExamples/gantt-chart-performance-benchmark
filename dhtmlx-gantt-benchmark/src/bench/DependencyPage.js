import React, { useCallback, useEffect, useRef } from 'react';
import ReactGantt from '@dhtmlx/trial-react-gantt';
import BenchSection from './BenchSection';
import {
  defaultConfig,
  defaultPlugins,
  defaultScales,
  minimalColumns
} from './ganttSetup';
import closeAfterPaint from './useRenderClose';

export default function DependencyPage({ dataset }) {
  const {
    tasks,
    links,
    loaders,
    currentSize,
    renderSeconds,
    chartInstance,
    measureRender,
    markAutoScheduled
  } = dataset;

  // Stable ref. The DHTMLX React wrapper exposes
  // `node.instance` as a live getter that always returns the
  // current gantt instance. Reading `ganttRef.current.instance`
  // lazily never holds a stale reference, even after a
  // `key={chartInstance}`-driven remount.
  const ganttRef = useRef(null);

  useEffect(() => {
    loaders.loadDependency5000();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the render-time timer on `onAfterAutoSchedule` (the
  // canonical "benchmark complete" event for scheduler pages).
  // The `getTaskCount() > 0` guard ensures the empty initial
  // render from `gantt.init()` does NOT close the timer
  // prematurely. The `measureRender` dedupe guard makes the
  // secondary close-point (onGanttRender) a no-op.
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

  const showChart = tasks.length > 0 && chartInstance > 0;

  return (
    <BenchSection
      dataset={dataset}
      title="Dependency / Critical-Path Recalculation"
      presets={[
        'loadDependency5000',
        'loadDependency10000',
        'loadDependency25000',
        'loadDependency50000'
      ]}
      showRefresh={false}
      summary={
        <div style={{ fontSize: '13px', color: '#475569' }}>
          {currentSize.toLocaleString()} records with dependency and critical path render time:{' '}
          <b data-testid="dependency-render-s">
            {renderSeconds === null ? '—' : `${renderSeconds.toFixed(3)} s`}
          </b>
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
            config={{
              ...defaultConfig,
              auto_scheduling: {
                enabled: true,
                schedule_on_parse: true,
                move_projects: false,
                descendant_links: false
              }
            }}
            plugins={{ ...defaultPlugins, critical_path: true }}
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
