import React, { useEffect } from 'react';
import BenchSection from './BenchSection';
import { KendoBenchGantt, KENDO_COLUMNS } from './kendoGanttSetup';

export default function InitialLoadPage({ dataset }) {
  const { ganttRef, dataSource, renderSeconds } = dataset;

  useEffect(() => {
    if (dataSource.length > 0 && typeof dataset.measureRender === 'function') {
      dataset.measureRender();
    }
  }, [dataSource.length, dataset]);

  return (
    <BenchSection
      dataset={dataset}
      title="Initial Load — Gantt Render Time"
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