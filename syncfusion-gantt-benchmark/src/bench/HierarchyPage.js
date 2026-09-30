import React, { useEffect, useRef, useState } from 'react';
import {
  GanttComponent,
  ColumnsDirective,
  ColumnDirective,
  Inject,
  Toolbar
} from '@syncfusion/ej2-react-gantt';
import BenchSection from './BenchSection';
import { taskFields, SERVICES } from './ganttSetup';

export default function HierarchyPage({ dataset }) {
  const { ganttRef, dataSource, isLoading, loaders } = dataset;
  const [expandMs, setExpandMs] = useState(null);
  const [collapseMs, setCollapseMs] = useState(null);
  const expandStartRef = useRef(null);
  const collapseStartRef = useRef(null);

  useEffect(() => {
    if (dataSource.length === 0 && !isLoading) loaders.loadHierarchy5000();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDataBound = () => {
    if (typeof dataset.measureRender === 'function') dataset.measureRender();
  };

  const handleExpanding = () => {
    expandStartRef.current = performance.now();
  };

  const handleExpanded = () => {
    if (expandStartRef.current === null) return;
    setExpandMs(performance.now() - expandStartRef.current);
    expandStartRef.current = null;
  };

  const handleCollapsing = () => {
    collapseStartRef.current = performance.now();
  };

  const handleCollapsed = () => {
    if (collapseStartRef.current === null) return;
    setCollapseMs(performance.now() - collapseStartRef.current);
    collapseStartRef.current = null;
  };

  const resetLatency = () => {
    expandStartRef.current = null;
    collapseStartRef.current = null;
    setExpandMs(null);
    setCollapseMs(null);
  };

  const toolbar = ['ExpandAll', 'CollapseAll'];

  return (
    <BenchSection
      dataset={dataset}
      title="Hierarchy — Expand / Collapse latency"
      presets={[
        'loadHierarchy5000',
        'loadHierarchy10000',
        'loadHierarchy25000',
        'loadHierarchy50000'
      ]}
      labelSuffix="Records"
      onPresetClick={resetLatency}
      summary={
        <div style={{ fontSize: '13px', color: '#475569' }}>
          Expand all: <b>{expandMs === null ? '—' : `${expandMs.toFixed(2)} ms`}</b>
          {' | '}
          Collapse all: <b>{collapseMs === null ? '—' : `${collapseMs.toFixed(2)} ms`}</b>
        </div>
      }
    >
      {dataSource.length > 0 && (
        <GanttComponent
          ref={ganttRef}
          id="hierarchy-gantt"
          dataSource={dataSource}
          taskFields={taskFields}
          height="450px"
          enableVirtualization={true}
          enableTimelineVirtualization={true}
          treeColumnIndex={1}
          collapseAllParentTasks={true}
          toolbar={toolbar}
          dataBound={handleDataBound}
          expanding={handleExpanding}
          expanded={handleExpanded}
          collapsing={handleCollapsing}
          collapsed={handleCollapsed}
        >
          <ColumnsDirective>
            <ColumnDirective field="ID" headerText="ID" width="80" />
            <ColumnDirective field="TaskName" headerText="Task Name"/>
            <ColumnDirective field="StartDate" headerText="StartDate"/>
            <ColumnDirective field="Predecessor"/>
          </ColumnsDirective>
          <Inject services={[...SERVICES, Toolbar]} />
        </GanttComponent>
      )}
    </BenchSection>
  );
}