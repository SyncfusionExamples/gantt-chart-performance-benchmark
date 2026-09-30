import React, { useEffect } from 'react';
import BenchSection from './BenchSection';
import { KendoBenchGantt, KENDO_COLUMNS } from './kendoGanttSetup';

export default function BundlePage({ dataset }) {
  const { ganttRef, dataSource, isLoading, loaders } = dataset;

  const bundleSizeKB = 286.67;

  useEffect(() => {
    if (dataSource.length !== 2000 && !isLoading) loaders.load2000();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BenchSection
      dataset={dataset}
      title="Bundle Size"
      showControls={false}
      summary={
        isLoading || dataSource.length === 0 ? (
          <span style={{ color: '#64748b', fontSize: '13px' }}>
            {isLoading ? 'Loading 2K records…' : 'Awaiting 2K records…'}
          </span>
        ) : (
          <div style={{ fontSize: '13px', color: '#475569' }}>
            2K records loaded.
            <br />
            Minified + gzipped (KB): <b>{bundleSizeKB.toFixed(2)} KB</b>
          </div>
        )
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