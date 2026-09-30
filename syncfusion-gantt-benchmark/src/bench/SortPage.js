import React, { useEffect, useRef, useState } from 'react';
import {
  GanttComponent,
  ColumnsDirective,
  ColumnDirective,
  Inject,
  Sort
} from '@syncfusion/ej2-react-gantt';
import BenchSection from './BenchSection';
import { taskFields, SERVICES } from './ganttSetup';

// This page needs the shared services (Selection + VirtualScroll) plus the
// Sort module so `sortColumn` is wired up. Compose locally instead of
// mutating the shared SERVICES list used by other pages.
const SORT_SERVICES = [...SERVICES, Sort];

export default function SortPage({ dataset }) {
  const { ganttRef, dataSource, isLoading, currentSize, loaders } = dataset;
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  // Holds the active sort benchmark's start time + column + direction.
  // The `actionComplete` handler reads this to know when sorting has
  // finished and the grid has been refreshed.
  const pendingSortRef = useRef(null);

  const datasetStatus = isLoading
    ? `Loading ${Math.max(currentSize || 25000, 25000).toLocaleString()} records…`
    : dataSource.length === 0
      ? 'Awaiting dataset…'
      : `${dataSource.length.toLocaleString()} records loaded`;

  const handleDataBound = () => {
    if (typeof dataset.measureRender === 'function') dataset.measureRender();
  };

  // Completion signal for the sort benchmark. Syncfusion's `actionComplete`
  // event fires after a sort request has been applied AND the grid has
  // been refreshed with the sorted records. We stop the timer only when
  // the event matches the active benchmark's request type ('sorting').
  const handleActionComplete = (args) => {
    const pending = pendingSortRef.current;
    if (!pending) return;
    const requestType = args?.requestType;
    if (requestType !== 'sorting') return;

    const elapsedSeconds = (
      (performance.now() - pending.start) / 1000
    ).toFixed(3);

    pendingSortRef.current = null;

    setResult({
      sortColumn: pending.sortColumn,
      sortDirection: pending.sortDirection,
      elapsedSeconds,
    });
    setRunning(false);
    runningRef.current = false;
  };

  // Auto-load 25K on mount so the chart is ready when the user clicks
  // "Run Sort Test" before selecting another dataset.
  useEffect(() => {
    if (dataSource.length === 0 && !isLoading) {
      loaders.load25000();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSortTest = () => {
    const gantt = ganttRef.current;
    if (!gantt || runningRef.current) return;
    const sortModule = gantt.sortModule;
    if (!sortModule || typeof sortModule.sortColumn !== 'function') return;

    runningRef.current = true;
    setRunning(true);
    setResult(null);

    const sortColumn = 'ID';
    const sortDirection = 'Decending';

    // Arm the completion handler before issuing sortColumn so we don't
    // miss the actionComplete event when the sort resolves synchronously.
    pendingSortRef.current = {
      sortColumn,
      sortDirection,
      start: performance.now(),
    };

    sortModule.sortColumn(sortColumn, sortDirection, false);

    // Safety net: if actionComplete never fires, release the locked UI
    // state after a generous timeout so the user isn't stuck.
    setTimeout(() => {
      if (!pendingSortRef.current) return;
      pendingSortRef.current = null;
      setRunning(false);
      runningRef.current = false;
    }, 10000);
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Sort Performance"
      presets={['load5000', 'load10000', 'load25000', 'load50000']}
      labelSuffix="Records"
      onPresetClick={() => setResult(null)}
      actions={
        <button
          onClick={runSortTest}
          disabled={running || isLoading || dataSource.length === 0}
        >
          {running ? 'Running…' : isLoading ? 'Loading…' : 'Run Sort Test'}
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
              data-testid="sort-report"
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
                Sort Column : <b>{result.sortColumn}</b>
              </div>
              <div>
                Sort Direction : <b>{result.sortDirection}</b>
              </div>
              <div>
                Sort Time : <b>{result.elapsedSeconds} s</b>
              </div>
            </div>
          )}
        </div>
      }
    >
      {dataSource.length > 0 && (
        <GanttComponent
          ref={ganttRef}
          id="sort-gantt"
          dataSource={dataSource}
          taskFields={taskFields}
          height="450px"
          enableVirtualization={true}
          enableTimelineVirtualization={true}
          treeColumnIndex={1}
          //collapseAllParentTasks={true}
          dataBound={handleDataBound}
          actionComplete={handleActionComplete}
          allowSorting={true}
        >
          <ColumnsDirective>
            <ColumnDirective field="ID" headerText="ID" width="80" />
            <ColumnDirective field="TaskName" headerText="Task Name" width="250" />
            <ColumnDirective field="StartDate" headerText="StartDate" width="250" />
            <ColumnDirective field="Predecessor"/>
          </ColumnsDirective>
          <Inject services={SORT_SERVICES} />
        </GanttComponent>
      )}
    </BenchSection>
  );
}