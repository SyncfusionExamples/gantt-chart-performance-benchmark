import React, { useEffect, useState } from 'react';
import BenchSection from './BenchSection';
import { KendoBenchGantt, KENDO_COLUMNS, normalizeTaskData } from './kendoGanttSetup';

const setExpandedState = (tasks, expanded) =>
  tasks.map((task) => ({
    ...task,
    expanded,
    isExpanded: expanded,
    children: task.children ? setExpandedState(task.children, expanded) : undefined
  }));

export default function MemoryPage({ dataset }) {
  const { ganttRef, dataSource, isLoading, loaders } = dataset;
  const [heapAfterLoad, setHeapAfterLoad] = useState(null);
  const [heapAfterCycles, setHeapAfterCycles] = useState(null);
  const [runningCycles, setRunningCycles] = useState(false);
  const [taskData, setTaskData] = useState([]);
  const [treeVersion, setTreeVersion] = useState(0);

  useEffect(() => {
    if (dataSource.length !== 2000 && !isLoading) loaders.load2000();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dataSource.length > 0 && typeof dataset.measureRender === 'function') {
      dataset.measureRender();
    }
    const heap = readHeap();
    if (heap !== null) setHeapAfterLoad(heap);
  }, [dataSource.length, dataset]);

  useEffect(() => {
    if (dataSource.length > 0) {
      setTaskData(normalizeTaskData(dataSource));
    } else {
      setTaskData([]);
    }
  }, [dataSource]);

  const readHeap = () => {
    if (!performance.memory) {
      return null;
    }
    return performance.memory.usedJSHeapSize / (1024 * 1024);
  };

  const runCycles = async () => {
    if (!taskData.length || runningCycles) return;

    setRunningCycles(true);

    let tree = taskData;
    for (let cycle = 0; cycle < 2; cycle += 1) {
      const shouldExpand = cycle % 2 === 0;
      tree = setExpandedState(tree, shouldExpand);
      setTaskData(tree);
      setTreeVersion((prev) => prev + 1);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    const heap = readHeap();
    setHeapAfterCycles(heap);
    setRunningCycles(false);
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Memory Usage"
      showControls={false}
      actions={
        <button onClick={runCycles} disabled={runningCycles || dataSource.length === 0}>
          {runningCycles ? 'Running 2 cycles...' : 'Run 2 expand/collapse cycles'}
        </button>
      }
      summary={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div>
            Heap after load:{' '}
            <b>{heapAfterLoad === null ? '—' : `${heapAfterLoad.toFixed(2)} MB`}</b>
          </div>
          <div>
            Heap after cycles:{' '}
            <b>{heapAfterCycles === null ? '—' : `${heapAfterCycles.toFixed(2)} MB`}</b>
          </div>
          <div>
            Delta:{' '}
            <b>
              {heapAfterLoad === null || heapAfterCycles === null
                ? '—'
                : `${heapAfterCycles - heapAfterLoad >= 0 ? '+' : ''}${(
                  heapAfterCycles - heapAfterLoad
                ).toFixed(2)} MB`}
            </b>
          </div>
          <div style={{ color: '#64748b', fontSize: '12px' }}>
            Delta &lt; 5 MB = Good • Delta 5–10 MB = Acceptable • Delta &gt; 10 MB = Investigate possible leak
          </div>
        </div>
      }
    >
      {taskData.length > 0 && (
        <KendoBenchGantt
          key={treeVersion}
          ganttRef={ganttRef}
          taskData={taskData}
          dependencyData={dataSource.length > 0 ? [] : []}
          height={750}
          columns={KENDO_COLUMNS}
        />
      )}
    </BenchSection>
  );
}