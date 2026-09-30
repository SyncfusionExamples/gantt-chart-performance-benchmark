import React, { useEffect, useRef, useState } from 'react';
import BenchSection from './BenchSection';
import { KendoBenchGantt, KENDO_COLUMNS } from './kendoGanttSetup';

const TARGET = 2000;

export default function InteractionLatencyPage({ dataset }) {
  const { ganttRef, dataSource, isLoading, loaders } = dataset;
  const dragLatencyRef = useRef(null);
  const resizeLatencyRef = useRef(null);
  const editLatencyRef = useRef(null);
  const rowDragLatencyRef = useRef(null);
  const taskbarStartRef = useRef(null);
  const editStartRef = useRef(null);
  const rowDragStartRef = useRef(null);

  const [latest, setLatest] = useState({
    drag: null,
    resize: null,
    edit: null,
    rowDrag: null
  });

  useEffect(() => {
    if (dataSource.length !== TARGET && !isLoading) {
      loaders.load1000();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dataSource.length > 0 && typeof dataset.measureRender === 'function') {
      dataset.measureRender();
    }
  }, [dataSource.length, dataset]);

  const recordAfterPaint = (startTime, ref, key) => {
    requestAnimationFrame(() => {
      const latency = performance.now() - startTime;
      ref.current = latency;
      setLatest((prev) => ({ ...prev, [key]: latency }));
    });
  };

  const handleTaskbarEditing = () => {
    taskbarStartRef.current = performance.now();
  };

  const handleTaskbarEdited = () => {
    if (taskbarStartRef.current === null) return;
    const startTime = taskbarStartRef.current;
    taskbarStartRef.current = null;
    recordAfterPaint(startTime, dragLatencyRef, 'drag');
  };

  const handleRowDragStart = () => {
    rowDragStartRef.current = performance.now();
  };

  const handleRowDrop = () => {
    if (rowDragStartRef.current === null) return;
    const startTime = rowDragStartRef.current;
    rowDragStartRef.current = null;
    recordAfterPaint(startTime, rowDragLatencyRef, 'rowDrag');
  };

  const handleActionBegin = (args) => {
    if (args && args.type === 'save') {
      editStartRef.current = performance.now();
    }
  };

  const handleActionComplete = (args) => {
    if (args && args.type === 'save' && editStartRef.current !== null) {
      const startTime = editStartRef.current;
      editStartRef.current = null;
      recordAfterPaint(startTime, editLatencyRef, 'edit');
    }
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Interaction Latency"
      showControls={false}
      summary={
        isLoading || dataSource.length === 0 ? (
          <span style={{ color: '#64748b', fontSize: '13px' }}>
            {isLoading ? 'Loading 2K dataset…' : 'Awaiting dataset…'}
          </span>
        ) : (
          <>
            <div style={{ marginBottom: '6px', fontSize: '13px', color: '#475569' }}>
              2K records loaded
            </div>
            <div
              data-testid="interaction-report"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '13px',
                marginTop: '8px',
                fontFamily: 'monospace',
                color: '#0f172a'
              }}
            >
              <div>
                <span style={{ color: '#64748b' }}>Drag task bar (move) :</span>{' '}
                <span style={{ color: '#b91c1c', fontWeight: 600 }}>Not supported</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Resize task bar :</span>{' '}
                <span style={{ color: '#b91c1c', fontWeight: 600 }}>Not supported</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Row drag and drop :</span>{' '}
                <span style={{ color: '#b91c1c', fontWeight: 600 }}>Not supported</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Inline cell edit commit :</span>{' '}
                <span style={{ color: '#b91c1c', fontWeight: 600 }}>Not supported</span>
              </div>
            </div>
          </>
        )
      }
    >
      {dataSource.length > 0 && (
        <KendoBenchGantt
          ganttRef={ganttRef}
          dataSource={dataSource}
          height={750}
          columns={KENDO_COLUMNS}
          onTaskBarEditStart={handleTaskbarEditing}
          onTaskBarEditEnd={handleTaskbarEdited}
          onRowDragStart={handleRowDragStart}
          onRowDragEnd={handleRowDrop}
          onDataStateChange={handleActionBegin}
          onEditComplete={handleActionComplete}
          editable={{
            create: true,
            update: true,
            destroy: true,
            mode: 'cell',
            add: true,
            remove: true
          }}
          tasksEditable
          dependenciesEditable
        />
      )}
    </BenchSection>
  );
}