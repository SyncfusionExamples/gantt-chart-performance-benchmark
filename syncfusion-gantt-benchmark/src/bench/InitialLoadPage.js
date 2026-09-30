import React from 'react';
import {
  GanttComponent,
  ColumnsDirective,
  ColumnDirective,
  Inject
} from '@syncfusion/ej2-react-gantt';
import BenchSection from './BenchSection';
import { taskFields, SERVICES } from './ganttSetup';

export default function InitialLoadPage({ dataset }) {
  const { ganttRef, dataSource, renderSeconds } = dataset;

  // Inline handler that closes the timer the first time the Gantt fires
  // `dataBound` after a fresh dataset write.
  const handleDataBound = () => {
    if (typeof dataset.measureRender === 'function') dataset.measureRender();
  };

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
        <GanttComponent
          ref={ganttRef}
          id="initial-load-gantt"
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
            <ColumnDirective field="TaskName" headerText="Task Name"/>
            <ColumnDirective field="StartDate" headerText="StartDate"/>
            <ColumnDirective field="Predecessor"/>
          </ColumnsDirective>
          <Inject services={SERVICES} />
        </GanttComponent>
      )}
    </BenchSection>
  );
}