import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactGantt from '@dhtmlx/trial-react-gantt';
import BenchSection from './BenchSection';
import {
  defaultConfig,
  defaultPlugins,
  defaultScales,
  minimalColumns
} from './ganttSetup';
import closeAfterPaint from './useRenderClose';

// DHTMLX Gantt's real scrollbar containers (found by inspecting the
// rendered DOM in the live benchmark):
//
//   <div class="gantt_layout_cell gantt_ver_scroll ..." style="width:15px; height:699px">
//     <div style="height: 901802px;"></div>     ← inner spacer with the full virtual height
//   </div>
//
//   <div class="gantt_layout_cell gantt_hor_scroll" style="width:1211px; height:15px">
//     <div style="width: 199751px;"></div>      ← inner spacer with the full virtual width
//   </div>
//
// Each cell is itself the scrollable element (setting `scrollTop` /
// `scrollLeft` on it drives the corresponding axis of the chart).
// We pick the cells directly and fall back to legacy selectors if
// the gantt version exposes different markup.
const pickAxisScroller = (chart, axis) => {
  if (!chart) return null;
  if (axis === 'vertical') {
    return (
      chart.querySelector('.gantt_ver_scroll') ||
      chart.querySelector('.gantt_grid') ||
      chart.querySelector('.gantt_data_area') ||
      chart.querySelector('.gantt_container') ||
      chart
    );
  }
  return (
    chart.querySelector('.gantt_hor_scroll') ||
    chart.querySelector('.gantt_task') ||
    chart.querySelector('.gantt_container .gantt_task_bg') ||
    chart
  );
};

const benchmark = async (scrollEl, axis) => {
  const beforeDOM = document.querySelectorAll('*').length;

  // Cap only the vertical distance so a 25K-row chart (whose
  // `.gantt_ver_scroll > div` spacer is ~900 000 px tall) doesn't
  // run the loop for minutes. Horizontal scrolling uses the full
  // available timeline width below.
  const MAX_SCROLL_PX = 60000;
  const STEP_PX = 20;

  let frames = 0;
  let running = true;

  const counter = () => {
    if (!running) return;
    frames += 1;
    requestAnimationFrame(counter);
  };

  requestAnimationFrame(counter);

  const start = performance.now();

  if (axis === 'vertical') {
    const max = Math.min(
      scrollEl.scrollHeight - scrollEl.clientHeight,
      MAX_SCROLL_PX
    );
    const ceil = Math.max(max, 5000);
    for (let y = 0; y < ceil; y += STEP_PX) {
      scrollEl.scrollTop = y;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  } else {
    const max = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
    for (let x = 0; x < max; x += STEP_PX) {
      scrollEl.scrollLeft = x;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    // Ensure the benchmark ends at the scrollbar's exact maximum,
    // including ranges that are not divisible by STEP_PX.
    scrollEl.scrollLeft = max;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  const duration = (performance.now() - start) / 1000;
  running = false;

  const afterDOM = document.querySelectorAll('*').length;

  return {
    FPS: (frames / duration).toFixed(2),
    DOM_Before: beforeDOM,
    DOM_After: afterDOM,
    durationSeconds: duration
  };
};

export default function ScrollPage({ dataset }) {
  const {
    tasks,
    links,
    isLoading,
    chartInstance,
    measureRender
  } = dataset;
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const scrollTasks = useMemo(
    () => tasks.map((task) => task.type === 'project' ? { ...task, open: false } : task),
    [tasks]
  );

  // Stable ref. The DHTMLX React wrapper exposes
  // `node.instance` as a live getter that always returns the
  // current gantt instance. Reading `ganttRef.current.instance`
  // lazily never holds a stale reference, even after a
  // `key={chartInstance}`-driven remount.
  const ganttRef = useRef(null);

  const datasetStatus = isLoading
    ? 'Loading records…'
    : tasks.length === 0
      ? 'Awaiting dataset…'
      : `${tasks.length.toLocaleString()} records loaded`;

  useEffect(() => {
    setResult(null);
  }, [chartInstance]);

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

  const runScrollTest = useCallback(async () => {
    if (runningRef.current) return;
    const gantt = ganttRef.current && ganttRef.current.instance;
    const chart = gantt ? gantt.$container : null;
    if (!chart) return;

    runningRef.current = true;
    setRunning(true);
    setResult(null);

    await new Promise((r) => requestAnimationFrame(() => r()));
    await new Promise((r) => requestAnimationFrame(() => r()));

    const verticalScroller = pickAxisScroller(chart, 'vertical');
    const horizontalScroller = pickAxisScroller(chart, 'horizontal');

    const vertical = verticalScroller
      ? await benchmark(verticalScroller, 'vertical')
      : null;
    const horizontal = horizontalScroller
      ? await benchmark(horizontalScroller, 'horizontal')
      : null;

    if (verticalScroller) verticalScroller.scrollTop = 0;

    setResult({
      vertical,
      horizontal,
      domBefore:
        (vertical && vertical.DOM_Before) ||
        (horizontal && horizontal.DOM_Before) ||
        document.querySelectorAll('*').length,
      domAfter:
        (vertical && vertical.DOM_After) ||
        (horizontal && horizontal.DOM_After) ||
        document.querySelectorAll('*').length
    });
    setRunning(false);
    runningRef.current = false;
  }, []);

  const showChart = tasks.length > 0 && chartInstance > 0;

  return (
    <BenchSection
      dataset={dataset}
      title="Scroll Performance"
      presets={['load5000', 'load10000', 'load25000', 'load50000']}
      showRefresh={false}
      actions={
        <button
          onClick={runScrollTest}
          disabled={running || isLoading || tasks.length === 0}
        >
          {running ? 'Running…' : isLoading ? 'Loading…' : 'Scroll test'}
        </button>
      }
      summary={
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '13px',
            marginTop: '8px',
            fontFamily: 'monospace',
            color: '#0f172a'
          }}
        >
          <div style={{ color: '#64748b' }}>{datasetStatus}</div>
          {result && (
            <div
              data-testid="scroll-report"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontSize: '13px',
                fontFamily: 'monospace',
                color: '#0f172a'
              }}
            >
              {result.vertical && (
                <div>
                  Vertical Scroll FPS: <b>{result.vertical.FPS}</b>
                </div>
              )}
              {result.horizontal && (
                <div>
                  Horizontal Scroll FPS: <b>{result.horizontal.FPS}</b>
                </div>
              )}
            </div>
          )}
        </div>
      }
    >
      {showChart && (
        <div style={{ height: '750px' }}>
          <ReactGantt
            ref={ganttRef}
            tasks={scrollTasks}
            links={links}
            key={chartInstance}
            theme="terrace"
            config={{ ...defaultConfig, open_tree_initially: false }}
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
