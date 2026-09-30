import React, { useCallback, useRef } from 'react';
import ReactGantt from '@dhtmlx/trial-react-gantt';
import BenchSection from './BenchSection';
import {
  defaultConfig,
  defaultPlugins,
  defaultScales,
  minimalColumns
} from './ganttSetup';

// Measure render time after the painted frame is on screen.
const closeAfterPaint = (fn) => {
  if (typeof fn !== 'function') return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => fn());
  });
};

export default function InitialLoadPage({ dataset }) {
  const {
    tasks,
    links,
    renderSeconds,
    chartInstance,
    measureRender,
    validation
  } = dataset;

  // Stable ref. The DHTMLX React wrapper's `useImperativeHandle`
  // exposes `node.instance` as a live getter (it returns
  // `internalInstance.current`), so reading `ganttRef.current
  // .instance` on demand always gives us the latest gantt
  // instance — even after a `key`-driven remount.
  const ganttRef = useRef(null);

  // Capture the chart instance identifier at the moment the
  // handler fires, so a stale event from a previous (already-
  // destroyed) gantt cannot close the timer for the current parse.
  //
  // The DHTMLX React wrapper's mount effect calls
  // `gantt.init(container)` synchronously, which fires
  // `onGanttRender` and `onDataRender` ONCE for the empty
  // initial DOM — BEFORE `useData` runs `gantt.parse(dataset)`.
  // The wrapper's `useData` effect then fires `onDataRender`
  // again from inside `gantt.parse()`'s trailing `gantt.render()`
  // call. With auto-scheduling enabled, the plugin's `onParse`
  // listener may also trigger another `gantt.render()` that
  // fires `onDataRender` a third time.
  //
  // The ONLY event that is guaranteed to fire exactly ONCE per
  // fresh parse, AFTER the data is loaded AND the auto-scheduler
  // has reconciled the cascade, is `onAfterAutoSchedule`. It
  // cannot fire for the empty initial render because the auto-
  // scheduling engine has no tasks to schedule on the first
  // `gantt.init()` (the data store is empty at that point).
  // That's why we use it as the canonical close-point.
  //
  // We additionally gate by `getTaskCount() > 0` so that even
  // if a future code path triggers `onAfterAutoSchedule` with
  // an empty store, we don't close the timer prematurely.
  const handleAfterAutoSchedule = useCallback(() => {
    const gantt = ganttRef.current && ganttRef.current.instance;
    if (!gantt) return;
    const taskCount = gantt.getTaskCount ? gantt.getTaskCount() : 0;
    if (taskCount === 0) return;
    closeAfterPaint(measureRender);
  }, [measureRender]);

  // Backup close-point. `onGanttRender` fires after the FINAL
  // `gantt.render()` call — i.e. after the auto-scheduling
  // engine has caused a re-render with the rescheduled dates.
  // We also gate this by `getTaskCount() > 0` so the empty
  // initial render from `gantt.init()` does not count. The
  // `measureRender` dedupe guard (via `measureEnabledRef`)
  // makes the second arrival a no-op, so this is safe even if
  // `onAfterAutoSchedule` already closed the timer.
  const handleGanttRender = useCallback(() => {
    const gantt = ganttRef.current && ganttRef.current.instance;
    if (!gantt) return;
    const taskCount = gantt.getTaskCount ? gantt.getTaskCount() : 0;
    if (taskCount === 0) return;
    closeAfterPaint(measureRender);
  }, [measureRender]);

  const showChart = tasks.length > 0 && chartInstance > 0;

  return (
    <BenchSection
      dataset={dataset}
      title="Initial Load — Gantt Render Time"
      presets={['load5000', 'load10000', 'load25000', 'load50000']}
      showRefresh={false}
      summary={
        <>
          Render time of Gantt chart:{' '}
          <b data-testid="initial-load-render-s">
            {renderSeconds !== null ? `${renderSeconds.toFixed(3)} s` : '—'}
          </b>
        </>
      }
    >
      {showChart && (
        <div style={{ height: '750px' }}>
          <ReactGantt
            ref={ganttRef}
            tasks={tasks}
            links={links}
            theme="terrace"
            config={defaultConfig}
            plugins={defaultPlugins}
            columns={minimalColumns}
            scales={defaultScales}
            key={chartInstance}
            onAfterAutoSchedule={handleAfterAutoSchedule}
            onGanttRender={handleGanttRender}
          />
        </div>
      )}
    </BenchSection>
  );
}
