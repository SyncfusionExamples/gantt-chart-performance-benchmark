import React, { useEffect, useRef, useState } from 'react';
import ReactGantt from '@dhtmlx/trial-react-gantt';
import { defaultConfig, defaultPlugins } from './ganttSetup';
import BenchSection from './BenchSection';

const UPDATE_TASK_ID = 201;
const DELETE_TASK_ID = 4901;

const crudConfig = {
  ...defaultConfig,
  drag_move: false,
  drag_resize: false,
  drag_progress: false,
  drag_links: false,
  row_drag: false,
  editable: false,
  readonly: true
};

const crudPlugins = {
  ...defaultPlugins,
  inline_editors: false
};

export default function InteractionLatencyPage({ dataset }) {
  const {
    ganttRef,
    tasks,
    links,
    isLoading,
    loaders,
    chartInstance,
    currentSize
  } = dataset;

  const [latest, setLatest] = useState({
    add: null,
    update: null,
    delete: null
  });

  const nextAddedTaskIdRef = useRef(1);

  useEffect(() => {
    if (tasks.length === 0 && !isLoading) {
      loaders.load5000();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    nextAddedTaskIdRef.current = tasks.reduce(
      (maxId, task) => Math.max(maxId, Number(task.id) || 0),
      0
    ) + 1;
    setLatest({ add: null, update: null, delete: null });
  }, [chartInstance, tasks]);

  const recordCrudAfterPaint = (startTime, key) => {
    requestAnimationFrame(() => {
      const latency = performance.now() - startTime;
      setLatest((prev) => ({ ...prev, [key]: latency }));
    });
  };

  const handleAddRecord = () => {
    const gantt = ganttRef.current && ganttRef.current.instance;
    if (!gantt || typeof gantt.addTask !== 'function') return;

    const startTime = performance.now();
    const id = nextAddedTaskIdRef.current;
    nextAddedTaskIdRef.current += 1;
    gantt.addTask(
      {
        id,
        text: `Added task ${id}`,
        start_date: new Date(2017, 1, 9),
        duration: 5,
        progress: 0,
        type: "task",
        parent: 0
      },
      0,
      0
    );
    recordCrudAfterPaint(startTime, 'add');
  };

  const handleUpdateRecord = () => {
    const gantt = ganttRef.current && ganttRef.current.instance;
    if (!gantt || typeof gantt.getTask !== 'function' || typeof gantt.updateTask !== 'function') return;

    const task = gantt.getTask(UPDATE_TASK_ID);
    if (!task) return;
    const startTime = performance.now();
    task.text = task.text === 'Updated task 201' ? 'Task 201' : 'Updated task 201';
    gantt.updateTask(UPDATE_TASK_ID);
    recordCrudAfterPaint(startTime, 'update');
  };

  const handleDeleteRecord = () => {
    const gantt = ganttRef.current && ganttRef.current.instance;
    if (!gantt || typeof gantt.getTask !== 'function' || typeof gantt.deleteTask !== 'function') return;

    if (!gantt.getTask(DELETE_TASK_ID)) return;
    const startTime = performance.now();
    gantt.deleteTask(DELETE_TASK_ID);
    recordCrudAfterPaint(startTime, 'delete');
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Interaction Latency"
      presets={['load5000', 'load10000', 'load25000', 'load50000']}
      showRefresh={false}
      actions={
        <>
          <button onClick={handleAddRecord} disabled={isLoading || tasks.length === 0}>
            Add record
          </button>
          <button onClick={handleUpdateRecord} disabled={isLoading || tasks.length === 0}>
            Update record (ID: {UPDATE_TASK_ID})
          </button>
          <button onClick={handleDeleteRecord} disabled={isLoading || tasks.length === 0}>
            Delete record (ID: {DELETE_TASK_ID})
          </button>
        </>
      }
      summary={
        isLoading || tasks.length === 0 ? (
          <span style={{ color: '#64748b', fontSize: '13px' }}>
            {isLoading
              ? 'Loading dataset…'
              : `Awaiting dataset… (${currentSize.toLocaleString()} records)`}
          </span>
        ) : (
          <div
            data-testid="interaction-report"
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
            <div>
              Dataset: <b>{currentSize.toLocaleString()} records</b>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Add record : </span>
              {latest.add !== null ? (
                <b>{latest.add.toFixed(2)} ms</b>
              ) : (
                <span style={{ color: '#94a3b8' }}>click Add record to record</span>
              )}
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Update record (ID: {UPDATE_TASK_ID}) : </span>
              {latest.update !== null ? (
                <b>{latest.update.toFixed(2)} ms</b>
              ) : (
                <span style={{ color: '#94a3b8' }}>click Update record to record</span>
              )}
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Delete record (ID: {DELETE_TASK_ID}) : </span>
              {latest.delete !== null ? (
                <b>{latest.delete.toFixed(2)} ms</b>
              ) : (
                <span style={{ color: '#94a3b8' }}>click Delete record to record</span>
              )}
            </div>
          </div>
        )
      }
    >
      {tasks.length > 0 && (
        <div
          style={{
            height: '750px',
            width: '100%',
            minHeight: '420px',
            border: '1px solid #dfe7f1',
            background: '#fff'
          }}
        >
          <ReactGantt
            ref={ganttRef}
            tasks={tasks}
            links={links}
            key={chartInstance}
            theme="terrace"
            config={crudConfig}
            plugins={crudPlugins}
          />
        </div>
      )}
    </BenchSection>
  );
}
