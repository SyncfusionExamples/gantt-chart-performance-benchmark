import React, { useEffect, useRef, useState } from 'react';
import BenchSection from './BenchSection';
import BenchmarkGantt from './BenchmarkGantt';

const pickAxisScrollers = (chart, axis) => {
  if (!chart) return [];

  if (axis === 'vertical') {
    const verticalScroller = chart.querySelector(
      '.b-grid-body-container.b-vertical-overflow'
    );

    return verticalScroller &&
      verticalScroller.scrollHeight > verticalScroller.clientHeight
      ? [verticalScroller]
      : [];
  }

  const normalSubgrid = chart.querySelector('.b-grid-sub-grid-normal');

  return normalSubgrid &&
    normalSubgrid.scrollWidth > normalSubgrid.clientWidth
    ? [normalSubgrid]
    : [];
};

const benchmark = async (scrollElements, axis) => {
  let frames = 0;
  let running = true;

  const counter = () => {
    if (!running) return;

    frames += 1;
    requestAnimationFrame(counter);
  };

  requestAnimationFrame(counter);

  const start = performance.now();

  const maxScroll = Math.max(
    ...scrollElements.map(element =>
      axis === 'vertical'
        ? element.scrollHeight - element.clientHeight
        : element.scrollWidth - element.clientWidth
    ),
    0
  );

  const limit = Math.max(maxScroll, 5000);

  for (
    let offset = 0;
    offset < limit;
    offset += 20
  ) {
    scrollElements.forEach(element => {
      if (axis === 'vertical') {
        element.scrollTop = offset;
      } else {
        element.scrollLeft = offset;
      }
    });

    // eslint-disable-next-line no-await-in-loop
    await new Promise(resolve =>
      requestAnimationFrame(resolve)
    );
  }

  const duration = (performance.now() - start) / 1000;
  running = false;

  return {
    FPS: (frames / duration).toFixed(2)
  };
};

export default function ScrollPage({ dataset }) {
  const {
    ganttRef,
    dataSource,
    isLoading
  } = dataset;

  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  useEffect(() => {
    setResult(null);
  }, [dataSource]);

  const runScrollTest = async () => {
    if (runningRef.current) return;

    const chart = ganttRef.current?.element;
    if (!chart) return;

    runningRef.current = true;
    setRunning(true);
    setResult(null);

    await new Promise(resolve =>
      requestAnimationFrame(resolve)
    );

    await new Promise(resolve =>
      requestAnimationFrame(resolve)
    );

    const verticalScrollers = pickAxisScrollers(
      chart,
      'vertical'
    );

    const horizontalScrollers = pickAxisScrollers(
      chart,
      'horizontal'
    );

    const vertical = verticalScrollers.length
      ? await benchmark(verticalScrollers, 'vertical')
      : null;

    const horizontal = horizontalScrollers.length
      ? await benchmark(horizontalScrollers, 'horizontal')
      : null;

    verticalScrollers.forEach(element => {
      element.scrollTop = 0;
    });

    horizontalScrollers.forEach(element => {
      element.scrollLeft = 0;
    });

    setResult({
      vertical,
      horizontal
    });

    setRunning(false);
    runningRef.current = false;
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Scroll Performance"
      presets={['load5000', 'load10000', 'load25000', 'load50000']}
      actions={
        <button
          onClick={runScrollTest}
          disabled={
            running ||
            isLoading ||
            dataSource.length === 0
          }
        >
          {running ? 'Running…' : 'Scroll test'}
        </button>
      }
      summary={
        <>
          {result?.vertical && (
            <div>
              Vertical Scroll FPS:{' '}
              <b>{result.vertical.FPS}</b>
            </div>
          )}

          {result?.horizontal && (
            <div>
              Horizontal Scroll FPS:{' '}
              <b>{result.horizontal.FPS}</b>
            </div>
          )}
        </>
      }
    >
      {dataSource.length > 0 && (
        <BenchmarkGantt
          ganttRef={ganttRef}
          id="scroll-gantt"
          dataSource={dataSource}
          defaultExpanded={false}
        />
      )}
    </BenchSection>
  );
}