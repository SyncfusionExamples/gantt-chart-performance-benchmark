import React, { useEffect, useRef, useState } from 'react';
import BenchSection from './BenchSection';
import { KendoBenchGantt, KENDO_COLUMNS, normalizeDependencyData, normalizeTaskData } from './kendoGanttSetup';

const setExpandedState = (tasks, expanded) =>
  tasks.map((task) => ({
    ...task,
    expanded,
    isExpanded: expanded,
    children: task.children ? setExpandedState(task.children, expanded) : undefined
  }));

export default function HierarchyPage({ dataset }) {
  const { ganttRef, dataSource, isLoading, loaders } = dataset;
  const [expandMs, setExpandMs] = useState(null);
  const [collapseMs, setCollapseMs] = useState(null);
  const [taskData, setTaskData] = useState([]);
  const [treeVersion, setTreeVersion] = useState(0);
  const expandStartRef = useRef(null);
  const collapseStartRef = useRef(null);

  useEffect(() => {
    if (dataSource.length === 0 && !isLoading) loaders.load2000();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dataSource.length > 0 && typeof dataset.measureRender === 'function') {
      dataset.measureRender();
    }
  }, [dataSource.length, dataset]);

  useEffect(() => {
    if (dataSource.length > 0) {
      setTaskData(normalizeTaskData(dataSource));
    } else {
      setTaskData([]);
    }
  }, [dataSource]);

  const measureTreeToggle = (expanded) => {
    const start = performance.now();
    const updated = taskData.length > 0 ? setExpandedState(taskData, expanded) : setExpandedState(normalizeTaskData(dataSource), expanded);
    setTaskData(updated);
    setTreeVersion((v) => v + 1);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const elapsed = performance.now() - start;
        if (expanded) {
          setExpandMs(elapsed);
        } else {
          setCollapseMs(elapsed);
        }
      });
    });
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Hierarchy — Expand / Collapse latency"
      showControls={false}
      actions={
        taskData.length > 0 && !isLoading ? (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                expandStartRef.current = performance.now();
                measureTreeToggle(true);
              }}
              style={{
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#eff6ff',
                color: '#1d4ed8',
                cursor: 'pointer'
              }}
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={() => {
                collapseStartRef.current = performance.now();
                measureTreeToggle(false);
              }}
              style={{
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#f8fafc',
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              Collapse all
            </button>
          </div>
        ) : null
      }
      summary={
        isLoading || dataSource.length === 0 ? (
          <span style={{ color: '#64748b', fontSize: '13px' }}>
            {isLoading ? 'Loading 2K records with 0 to 1 level parent/child rows…' : 'Awaiting 2K records with 0 to 1 level parent/child rows…'}
          </span>
        ) : (
          <div style={{ fontSize: '13px', color: '#475569' }}>
            2K records with 0 to 1 level parent/child loaded
            <br />
            Expand all: <b>{expandMs === null ? '—' : `${expandMs.toFixed(2)} ms`}</b>
            {' | '}
            Collapse all: <b>{collapseMs === null ? '—' : `${collapseMs.toFixed(2)} ms`}</b>
          </div>
        )
      }
    >
      {taskData.length > 0 && (
        <KendoBenchGantt
          key={treeVersion}
          ganttRef={ganttRef}
          taskData={taskData}
          dependencyData={dataSource.length > 0 ? normalizeDependencyData(dataSource) : []}
          height={750}
          columns={KENDO_COLUMNS}
        />
      )}
    </BenchSection>
  );
}