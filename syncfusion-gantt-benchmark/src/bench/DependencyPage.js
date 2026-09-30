import React, { useEffect } from 'react';
import {
  GanttComponent,
  ColumnsDirective,
  ColumnDirective,
  Inject,
  CriticalPath
} from '@syncfusion/ej2-react-gantt';
import BenchSection from './BenchSection';
import { taskFields, SERVICES } from './ganttSetup';

export default function DependencyPage({ dataset }) {
  const { ganttRef, dataSource, loaders, renderSeconds, currentSize, isLoading } = dataset;

  useEffect(() => {
    loaders.loadDependency5000();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDataBound = () => {
    if (typeof dataset.measureRender === 'function') dataset.measureRender();
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Dependency / Critical-Path Recalculation"
      presets={[
        'loadDependency5000',
        'loadDependency10000',
        'loadDependency25000',
        'loadDependency50000'
      ]}
      labelSuffix="Records"
      summary={
        <div style={{ fontSize: '13px', color: '#475569' }}>
          {isLoading
            ? `Loading ${Math.max(currentSize || 5000, 5000).toLocaleString()} records... `
            : `${(currentSize || dataSource.length).toLocaleString()} records with dependency and critical path render time: `}
          <b data-testid="dependency-render-s">{
            renderSeconds === null ? '—' : `${renderSeconds.toFixed(3)} s`
          }</b>
        </div>
      }
    >
      {dataSource.length > 0 && (
        <GanttComponent
          ref={ganttRef}
          id="dependency-gantt"
          dataSource={dataSource}
          taskFields={taskFields}
          height="450px"
          enableVirtualization={true}
          enableTimelineVirtualization={true}
          treeColumnIndex={1}
          dataBound={handleDataBound}
          enableCriticalPath={true}
        >
          <ColumnsDirective>
            <ColumnDirective field="ID" headerText="ID" width="80" />
            <ColumnDirective field="TaskName" headerText="Task Name"/>
            <ColumnDirective field="StartDate" headerText="StartDate"/>
            <ColumnDirective field="Predecessor"/>
          </ColumnsDirective>
          <Inject services={[...SERVICES, CriticalPath]} />
        </GanttComponent>
      )}
    </BenchSection>
  );
}