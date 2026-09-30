import React, { useEffect } from 'react';
import BenchSection from './BenchSection';
import { KendoBenchGantt, KENDO_COLUMNS } from './kendoGanttSetup';

export default function DependencyPage({ dataset }) {
  const { ganttRef, dataSource, loaders, renderSeconds } = dataset;

  useEffect(() => {
    loaders.load2500();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dataSource.length > 0 && typeof dataset.measureRender === 'function') {
      dataset.measureRender();
    }
  }, [dataSource.length, dataset]);

  return (
    <BenchSection
      dataset={dataset}
      title="Dependency / Critical-Path Recalculation"
      showControls={false}
      summary={
        <div style={{ fontSize: '13px', color: '#475569' }}>
          2.5K records with dependency links loaded. Critical-path feature is not available in Kendo React Gantt.
          <br />
          Initial render time:{' '}
          <b data-testid="dependency-render-s">{
            renderSeconds === null ? '—' : `${renderSeconds.toFixed(3)} s`
          }</b>
        </div>
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