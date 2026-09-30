import React, { useEffect, useRef, useState } from 'react';
import BenchSection from './BenchSection';
import { KendoBenchGantt, KENDO_COLUMNS } from './kendoGanttSetup';

const pickAxisScroller = (chart, axis) => {
  if (!chart) return null;
  const candidates = axis === 'vertical'
    ? [
        '.k-grid.k-grid-md.k-treelist-scrollable',
        '.k-grid-content',
        '.k-gantt-content',
        '.k-scroll-container',
        'div'
      ]
    : [
        '.k-grid.k-grid-md.k-treelist-scrollable',
        '.k-gantt-timeline',
        '.k-scroll-container',
        'div'
      ];

  for (const selector of candidates) {
    const node = selector === 'div' ? chart : chart.querySelector(selector);
    if (node) return node;
  }
  return chart;
};

const benchmark = async (scrollEl, axis) => {
  const beforeDOM = document.querySelectorAll('*').length;
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
    const max = Math.max(scrollEl.scrollHeight - scrollEl.clientHeight, 5000);
    for (let y = 0; y < max; y += 20) {
      scrollEl.scrollTop = y;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  } else {
    const max = Math.max(scrollEl.scrollWidth - scrollEl.clientWidth, 5000);
    for (let x = 0; x < max; x += 20) {
      scrollEl.scrollLeft = x;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
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
  const { ganttRef, dataSource, isLoading, loaders } = dataset;
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  useEffect(() => {
    if (dataSource.length === 0 && !isLoading) {
      loaders.load1000();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dataSource.length > 0 && typeof dataset.measureRender === 'function') {
      dataset.measureRender();
    }
  }, [dataSource.length, dataset]);

  const runScrollTest = async () => {
    if (runningRef.current) return;
    const chart = ganttRef.current?.element;
    if (!chart) return;

    runningRef.current = true;
    setRunning(true);
    setResult(null);

    await new Promise((r) => requestAnimationFrame(() => r()));
    await new Promise((r) => requestAnimationFrame(() => r()));

    const verticalScroller = pickAxisScroller(chart, 'vertical');
    const horizontalScroller = pickAxisScroller(chart, 'horizontal');

    const vertical = verticalScroller ? await benchmark(verticalScroller, 'vertical') : null;
    const horizontal = horizontalScroller ? await benchmark(horizontalScroller, 'horizontal') : null;

    if (verticalScroller) verticalScroller.scrollTop = 0;
    if (horizontalScroller) horizontalScroller.scrollLeft = 0;

    setResult({
      vertical,
      horizontal,
      domBefore: vertical?.DOM_Before ?? horizontal?.DOM_Before ?? document.querySelectorAll('*').length,
      domAfter: vertical?.DOM_After ?? horizontal?.DOM_After ?? document.querySelectorAll('*').length
    });
    setRunning(false);
    runningRef.current = false;
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Scroll Performance"
      showControls={false}
      actions={
        <button
          onClick={runScrollTest}
          disabled={running}
        >
          {running ? 'Running…' : 'Scroll test'}
        </button>
      }
      summary={
        <>
          <div style={{ marginBottom: '6px', fontSize: '13px', color: '#475569' }}>
            1K records loaded
          </div>
          {result && (
            <div
              data-testid="scroll-report"
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
              {result.vertical && (
                <div>
                  <span style={{ color: '#64748b' }}>Vertical Scroll — </span>
                  FPS: <b>{result.vertical.FPS}</b>
                  {' | '}DOM nodes (before scroll):{' '}
                  <b>{result.vertical.DOM_Before.toLocaleString()}</b>
                  {' | '}DOM nodes (after scroll):{' '}
                  <b>{result.vertical.DOM_After.toLocaleString()}</b>
                  <span style={{ color: '#94a3b8' }}>  (top → bottom)</span>
                </div>
              )}
              {result.horizontal && (
                <div>
                  <span style={{ color: '#64748b' }}>Horizontal Scroll — </span>
                  FPS: <b>{result.horizontal.FPS}</b>
                  {' | '}DOM nodes (before scroll):{' '}
                  <b>{result.horizontal.DOM_Before.toLocaleString()}</b>
                  {' | '}DOM nodes (after scroll):{' '}
                  <b>{result.horizontal.DOM_After.toLocaleString()}</b>
                  <span style={{ color: '#94a3b8' }}>  (start → end)</span>
                </div>
              )}
            </div>
          )}
        </>
      }
    >
      {dataSource.length > 0 && (
        <KendoBenchGantt
          ganttRef={ganttRef}
          dataSource={dataSource}
          height={750}
          columns={KENDO_COLUMNS}
        />
      )}
    </BenchSection>
  );
}