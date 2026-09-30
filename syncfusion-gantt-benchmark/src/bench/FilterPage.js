import React, { useEffect, useRef, useState } from 'react';
import {
  GanttComponent,
  ColumnsDirective,
  ColumnDirective,
  Inject,
  Filter
} from '@syncfusion/ej2-react-gantt';
import BenchSection from './BenchSection';
import { taskFields, SERVICES } from './ganttSetup';

// This page needs the shared services (Selection + VirtualScroll) plus the
// Filter module so `filterByColumn` is wired up. Compose locally instead of
// mutating the shared SERVICES list used by other pages.
const FILTER_SERVICES = [...SERVICES, Filter];

// Dataset size → TaskName value used for the filter benchmark. Each dataset
// has sequential task names ("Task 1" .. "Task N"), so the matching
// startswith filter exercises the full filter pipeline on that dataset.
const FILTER_VALUES = {
  5000: 'Task 4951',
  10000: 'Task 9951',
  25000: 'Task 24951',
  50000: 'Task 49951',
};

const pickFilterValue = (size) => FILTER_VALUES[size] || null;

export default function FilterPage({ dataset }) {
  const { ganttRef, dataSource, isLoading, currentSize, loaders } = dataset;
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  // Holds the active filter benchmark's start time + expected filter value.
  // The `actionComplete` handler reads this to know when filtering (and
  // the subsequent grid refresh) has fully finished.
  const pendingFilterRef = useRef(null);

  const datasetStatus = isLoading
    ? `Loading ${Math.max(currentSize || 25000, 25000).toLocaleString()} records…`
    : dataSource.length === 0
      ? 'Awaiting dataset…'
      : `${dataSource.length.toLocaleString()} records loaded`;

  const handleDataBound = () => {
    if (typeof dataset.measureRender === 'function') dataset.measureRender();
  };

  // Completion signal for the filter benchmark. Syncfusion's `actionComplete`
  // event fires after a filter request has been applied AND the grid has
  // been refreshed with the filtered records. We stop the timer only when
  // the event matches the active benchmark's request type ('filtering').
  const handleActionComplete = (args) => {
    const pending = pendingFilterRef.current;
    if (!pending) return;
    const requestType = args?.requestType;
    if (requestType !== 'filtering') return;

    const elapsedSeconds = (
      (performance.now() - pending.start) / 1000
    ).toFixed(3);

    pendingFilterRef.current = null;

    setResult({
      filterValue: pending.filterValue,
      elapsedSeconds,
    });
    setRunning(false);
    runningRef.current = false;
  };

  // Auto-load 25K on mount so the chart is ready when the user clicks
  // "Run Filter Test" before selecting another dataset.
  useEffect(() => {
    if (dataSource.length === 0 && !isLoading) {
      loaders.load25000();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runFilterTest = () => {
    const gantt = ganttRef.current;
    if (!gantt || runningRef.current) return;
    if (typeof gantt.filterByColumn !== 'function') return;

    // Pick the filter value for the currently loaded dataset size.
    const activeSize = currentSize || dataSource.length;
    const filterValue = pickFilterValue(activeSize);
    if (!filterValue) return;

    runningRef.current = true;
    setRunning(true);
    setResult(null);

    // Arm the completion handler before issuing filterByColumn so we don't
    // miss the actionComplete event when the filter resolves synchronously.
    pendingFilterRef.current = {
      filterValue,
      start: performance.now(),
    };

    gantt.filterByColumn('TaskName', 'startswith', filterValue, 'and');

    // Safety net: if actionComplete never fires, release the locked UI
    // state after a generous timeout so the user isn't stuck.
    setTimeout(() => {
      if (!pendingFilterRef.current) return;
      pendingFilterRef.current = null;
      setRunning(false);
      runningRef.current = false;
    }, 10000);
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Filter Performance"
      presets={['load5000', 'load10000', 'load25000', 'load50000']}
      labelSuffix="Records"
      onPresetClick={() => setResult(null)}
      actions={
        <button
          onClick={runFilterTest}
          disabled={running || isLoading || dataSource.length === 0}
        >
          {running ? 'Running…' : isLoading ? 'Loading…' : 'Run Filter Test'}
        </button>
      }
      summary={
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '13px',
            marginTop: '8px',
            fontFamily: 'monospace',
            color: '#0f172a'
          }}
        >
          <div style={{ color: '#64748b' }}>{datasetStatus}</div>
          {result && (
            <div
              data-testid="filter-report"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontSize: '13px',
                fontFamily: 'monospace',
                color: '#0f172a'
              }}
            >
              <div>
                Filter Value : <b>{result.filterValue}</b>
              </div>
              <div>
                Filter Time : <b>{result.elapsedSeconds} s</b>
              </div>
            </div>
          )}
        </div>
      }
    >
      {dataSource.length > 0 && (
        <GanttComponent
          ref={ganttRef}
          id="filter-gantt"
          dataSource={dataSource}
          taskFields={taskFields}
          height="450px"
          enableVirtualization={true}
          enableTimelineVirtualization={true}
          treeColumnIndex={1}
          //collapseAllParentTasks={true}
          dataBound={handleDataBound}
          actionComplete={handleActionComplete}
          allowFiltering={true}
        >
          <ColumnsDirective>
            <ColumnDirective field="ID" headerText="ID" width="80" />
            <ColumnDirective field="TaskName" headerText="Task Name" width="250" />
            <ColumnDirective field="StartDate" headerText="StartDate" width="250" />
            <ColumnDirective field="Predecessor"/>
          </ColumnsDirective>
          <Inject services={FILTER_SERVICES} />
        </GanttComponent>
      )}
    </BenchSection>
  );
}