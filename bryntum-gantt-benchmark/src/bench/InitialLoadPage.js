import React, { useMemo } from 'react';
import BenchSection from './BenchSection';
import BenchmarkGantt, { waitForTimelinePaint } from './BenchmarkGantt';
export default function InitialLoadPage({ dataset }) {
  const { ganttRef, dataSource, renderSeconds } = dataset;
  const handleDataReady = () => {
    if (typeof dataset.measureRender === 'function') dataset.measureRender();
  };
  const projectListeners = useMemo(
    () => ({
      dataReady: () => waitForTimelinePaint(
        () => ganttRef.current?.instance,
        handleDataReady
      )
    }),
    []
  );
  return (
    <BenchSection
      dataset={dataset}
      title="Initial Load — Gantt Render Time"
      showRefresh={false}
      presets={['load5000', 'load10000', 'load25000', 'load50000']}
      summary={
        <>
          Render time of Gantt chart:{' '}
          <b data-testid="initial-load-render-s">
            {renderSeconds !== null ? `${renderSeconds.toFixed(3)} s` : '—'}
          </b>
        </>
      }
    >
      {dataSource.length > 0 && (
        <BenchmarkGantt
          ganttRef={ganttRef}
          id="initial-load-gantt"
          dataSource={dataSource}
          projectListeners={projectListeners}
        />
      )}
    </BenchSection>
  );
}