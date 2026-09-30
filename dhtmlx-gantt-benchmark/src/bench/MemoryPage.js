import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactGantt from '@dhtmlx/trial-react-gantt';
import BenchSection from './BenchSection';
import {
  defaultConfig,
  defaultPlugins,
  defaultScales,
  minimalColumns
} from './ganttSetup';
import closeAfterPaint from './useRenderClose';

export default function MemoryPage({ dataset }) {
  const { tasks, links, isLoading, loaders, chartInstance } = dataset;
  const [memoryConsumption, setMemoryConsumption] = useState(null);
  const capturedRef = useRef(false);

  // Stable ref. The DHTMLX React wrapper exposes
  // `node.instance` as a live getter that always returns the
  // current gantt instance. Reading `ganttRef.current.instance`
  // lazily never holds a stale reference, even after a
  // `key={chartInstance}`-driven remount.
  const ganttRef = useRef(null);

  useEffect(() => {
    if (tasks.length === 0 && !isLoading) loaders.load5000();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readHeap = () => {
    if (!performance.memory) return null;
    return performance.memory.usedJSHeapSize / (1024 * 1024);
  };

  const captureMemoryAfterPaint = useCallback(() => {
    if (capturedRef.current || tasks.length === 0) return;
    capturedRef.current = true;
    const heap = readHeap();
    if (heap !== null) setMemoryConsumption(heap);
  }, [tasks.length]);

  // Capture one heap reading after the loaded Gantt has rendered and painted.
  // The task-count guard excludes the wrapper's empty initial render.
  const handleAfterAutoSchedule = useCallback(() => {
    const gantt = ganttRef.current && ganttRef.current.instance;
    if (!gantt) return;
    if (gantt.getTaskCount && gantt.getTaskCount() === 0) return;
    closeAfterPaint(() => {
      captureMemoryAfterPaint();
    });
  }, [captureMemoryAfterPaint]);

  const handleDataRender = handleAfterAutoSchedule;
  const handleGanttRender = handleAfterAutoSchedule;

  useEffect(() => {
    capturedRef.current = false;
    setMemoryConsumption(null);
  }, [chartInstance]);

  return (
    <BenchSection
      dataset={dataset}
      title="Memory Usage"
      presets={['load5000', 'load10000', 'load25000', 'load50000']}
      showRefresh={false}
      summary={
        <div data-testid="memory-consumption" style={{ fontSize: '13px', fontFamily: 'monospace', color: '#0f172a' }}>
          Memory Consumption: <b>{memoryConsumption === null ? '—' : `${memoryConsumption.toFixed(2)} MB`}</b>
        </div>
      }
    >
      {tasks.length > 0 && chartInstance > 0 && (
        <div style={{ height: '750px' }}>
          <ReactGantt
            ref={ganttRef}
            tasks={tasks}
            links={links}
            key={chartInstance}
            theme="terrace"
            config={defaultConfig}
            plugins={defaultPlugins}
            columns={minimalColumns}
            scales={defaultScales}
            onDataRender={handleDataRender}
            onAfterAutoSchedule={handleAfterAutoSchedule}
            onGanttRender={handleGanttRender}
          />
        </div>
      )}
    </BenchSection>
  );
}
