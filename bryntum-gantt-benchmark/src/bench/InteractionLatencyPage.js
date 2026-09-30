import React, { useCallback, useEffect, useRef, useState } from 'react';
import BenchSection from './BenchSection';
import BenchmarkGantt from './BenchmarkGantt';

export default function InteractionLatencyPage({ dataset }) {
  const { ganttRef, dataSource, isLoading } = dataset;

  const nextIdRef = useRef(1);
  const datasetVersionRef = useRef(0);
  const [latest, setLatest] = useState({
    addTask: null,
    updateTask: null,
    removeTask: null
  });

  useEffect(() => {
    datasetVersionRef.current += 1;
    const maxId = dataSource.reduce(
      (maximum, task) => Math.max(maximum, Number(task.ID) || 0),
      0
    );
    nextIdRef.current = maxId + 1;
    setLatest({
      addTask: null,
      updateTask: null,
      removeTask: null
    });
  }, [dataSource]);

  const recordLatency = useCallback((key, start) => {
    const datasetVersion = datasetVersionRef.current;
    requestAnimationFrame(() => {
      if (datasetVersion !== datasetVersionRef.current) return;
      const latency = performance.now() - start;

      setLatest(previous => ({
        ...previous,
        [key]: latency
      }));
    });
  }, []);

  const addTask = useCallback(() => {
    const gantt = ganttRef.current?.instance;
    const taskStore = gantt?.taskStore;

    if (!taskStore) return;

    const start = performance.now();
    const id = nextIdRef.current++;

    taskStore.add({
      id,
      name: `Benchmark Task ${id}`,
      startDate: new Date(2017, 1, 9),
      duration: 1
    });

    recordLatency('addTask', start);
  }, [ganttRef, recordLatency]);

  const updateTask = useCallback(() => {
    const gantt = ganttRef.current?.instance;
    const taskStore = gantt?.taskStore;
    const record = taskStore?.getById(201);

    if (!record) return;

    const start = performance.now();

    record.set({
      name: `Updated Task ${Date.now()}`
    });

    recordLatency('updateTask', start);
  }, [ganttRef, recordLatency]);

  const removeTask = useCallback(() => {
    const gantt = ganttRef.current?.instance;
    const taskStore = gantt?.taskStore;
    const record = taskStore?.getById(4901);

    if (!record) return;

    const start = performance.now();

    taskStore.remove(record);

    recordLatency('removeTask', start);
  }, [ganttRef, recordLatency]);

  const canRun = !isLoading && dataSource.length > 0;

  return (
    <BenchSection
      dataset={dataset}
      title="CRUD Operation Latency"
      presets={['load5000', 'load10000', 'load25000', 'load50000']}
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={addTask} disabled={!canRun}>
            Add Record
          </button>

          <button type="button" onClick={updateTask} disabled={!canRun}>
            Update Record (ID: 201)
          </button>

          <button type="button" onClick={removeTask} disabled={!canRun}>
            Delete Record (ID: 4901)
          </button>
        </div>
      }
      summary={
        <div
          data-testid="crud-latency-report"
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
            addTask :{' '}
            <b>
              {latest.addTask == null
                ? '—'
                : `${latest.addTask.toFixed(2)} ms`}
            </b>
          </div>

          <div>
            updateTask :{' '}
            <b>
              {latest.updateTask == null
                ? '—'
                : `${latest.updateTask.toFixed(2)} ms`}
            </b>
          </div>

          <div>
            removeTask :{' '}
            <b>
              {latest.removeTask == null
                ? '—'
                : `${latest.removeTask.toFixed(2)} ms`}
            </b>
          </div>
        </div>
      }
    >
      {dataSource.length > 0 && (
        <BenchmarkGantt
          ganttRef={ganttRef}
          id="crud-gantt"
          dataSource={dataSource}
        />
      )}
    </BenchSection>
  );
}