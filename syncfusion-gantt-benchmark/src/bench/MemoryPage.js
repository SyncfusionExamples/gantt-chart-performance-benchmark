import React, { useEffect, useState } from 'react';
import {
  GanttComponent,
  ColumnsDirective,
  ColumnDirective,
  Inject
} from '@syncfusion/ej2-react-gantt';
import BenchSection from './BenchSection';
import { taskFields, SERVICES } from './ganttSetup';

export default function MemoryPage({ dataset }) {
  const { ganttRef, dataSource, isLoading, loaders, currentSize } = dataset;
  const [memoryUsage, setMemoryUsage] = useState(null);

  useEffect(() => {
    if (dataSource.length !== 25000 && !isLoading) loaders.load25000();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetMemoryUsage = () => {
    setMemoryUsage(null);
  };

  const handleDataBound = () => {
    if (typeof dataset.measureRender === 'function') dataset.measureRender();
    if (memoryUsage !== null || !performance.memory) return;

    setMemoryUsage(
      performance.memory.usedJSHeapSize / (1024 * 1024)
    );
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Memory Usage"
      presets={['load5000', 'load10000', 'load25000', 'load50000']}
      labelSuffix="Records"
      onPresetClick={resetMemoryUsage}
      summary={
        <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#0f172a' }}>
          {isLoading
            ? `Loading ${Math.max(currentSize || 25000, 25000).toLocaleString()} records... `
            : `${(currentSize || dataSource.length).toLocaleString()} Records - Memory Consumption: `}
          <b>{memoryUsage === null ? '—' : `${memoryUsage.toFixed(2)} MB`}</b>
        </div>
      }
    >
      {dataSource.length > 0 && (
        <GanttComponent
          ref={ganttRef}
          id="memory-gantt"
          dataSource={dataSource}
          taskFields={taskFields}
          height="450px"
          enableVirtualization={true}
          enableTimelineVirtualization={true}
          treeColumnIndex={1}
          dataBound={handleDataBound}
        >
          <ColumnsDirective>
            <ColumnDirective field="ID" headerText="ID" width="80" />
            <ColumnDirective field="TaskName" headerText="Task Name" width="250" />
            <ColumnDirective field="StartDate" headerText="StartDate"/>
            <ColumnDirective field="Predecessor"/>
          </ColumnsDirective>
          <Inject services={SERVICES} />
        </GanttComponent>
      )}
    </BenchSection>
  );
}