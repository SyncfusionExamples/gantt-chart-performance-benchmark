import React, { useEffect, useMemo, useState } from 'react';
import BenchSection from './BenchSection';
import BenchmarkGantt, { waitForTimelinePaint } from './BenchmarkGantt';

export default function MemoryPage({ dataset }) {
  const { ganttRef, dataSource, isLoading, loaders } = dataset;

  const [memoryUsage, setMemoryUsage] = useState(null);

  useEffect(() => {
    if (dataSource.length === 0 && !isLoading) {
      loaders.load5000();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setMemoryUsage(null);
  }, [dataSource]);

  const projectListeners = useMemo(
 () => ({
 dataReady: () => {
 waitForTimelinePaint(
 () => ganttRef.current?.instance,
 () => {
 if (typeof dataset.measureRender === 'function') {
 dataset.measureRender();
 }

 setMemoryUsage(prev => {
 if (prev !== null || !performance.memory) {
 return prev;
 }

 return (
 performance.memory.usedJSHeapSize /
 (1024 * 1024)
 );
 });
 }
 );
 }
 }),
 [] // IMPORTANT
);

  return (
    <BenchSection
      dataset={dataset}
      title="Memory Usage"
      presets={['load5000', 'load10000', 'load25000', 'load50000']}
      summary={
        <div
          style={{
            fontSize: '13px',
            fontFamily: 'monospace',
            color: '#0f172a'
          }}
        >
          Memory Consumption:{' '}
          <b>
            {memoryUsage === null
              ? '—'
              : `${memoryUsage.toFixed(2)} MB`}
          </b>
        </div>
      }
    >
      {dataSource.length > 0 && (
        <BenchmarkGantt
          ganttRef={ganttRef}
          id="memory-gantt"
          dataSource={dataSource}
          projectListeners={projectListeners}
        />
      )}
    </BenchSection>
  );
}