import React, { useMemo } from 'react';
import { BryntumGantt } from '@bryntum/gantt-react';
import { columns } from './ganttSetup';

export const waitForTimelinePaint = (gantt, callback) => {
  const check = () => {
    const currentGantt = typeof gantt === 'function' ? gantt() : gantt;
    const element = currentGantt?.element;
    const projectLines = element?.querySelectorAll(
      '.b-gantt-project-line-canvas .b-gantt-project-line'
    );
    const linesArePositioned = projectLines?.length >= 2 && [...projectLines].every(
      (line) => Number.parseFloat(getComputedStyle(line).insetInlineStart) >= 0
    );
    if (linesArePositioned) {
      requestAnimationFrame(() => requestAnimationFrame(callback));
      return;
    }

    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
};

export default function BenchmarkGantt({
  dataSource,
  hierarchyRecords,
  ganttRef,
  id,
  listeners,
  projectListeners,
  columns: configuredColumns = columns,
  features = {},
  tbar,
  defaultExpanded = true
}) {
  // `hierarchyRecords` (page-specific flat records with ParentId) wins
  // over the shared `dataSource` so callers like the Hierarchy benchmark
  // can swap in a custom dataset without touching the global loader.
  const records = hierarchyRecords || dataSource;

  const project = useMemo(
    () => {
      const taskMap = new Map();
      const parentById = new Map();
      const roots = [];
      const dependencies = [];

      records.forEach((task) => {
        const isParent = task.ParentId === null;
        taskMap.set(task.ID, {
          id: task.ID,
          name: task.TaskName,
          startDate: new Date(task.StartDate),
          ...(task.Duration == null ? {} : { duration: Number(task.Duration) }),
          durationUnit: 'day',
          percentDone: Number(task.Progress),
          // Default to expanded so the rendered tree reflects the full
          // parent/child relation the benchmark is measuring, instead
          // of hiding every non-root row behind a click. Pages that
          // need a collapsed default can opt out via the
          // `defaultExpanded` prop (e.g. the Scroll benchmark, which
          // scrolls the rendered rows rather than the dataset's full
          // parent/child tree).
          expanded: defaultExpanded,
          ...(task.manuallyScheduled ? { manuallyScheduled: true } : {}),
          children: []
        });
        parentById.set(task.ID, task.ParentId);
      });

      records.forEach((task) => {
        const currentTask = taskMap.get(task.ID);
        const parentTask = task.ParentId === null
          ? null
          : taskMap.get(task.ParentId);

        if (parentTask) parentTask.children.push(currentTask);
        else roots.push(currentTask);

        const predecessorId = String(task.Predecessor || '').match(/\d+/)?.[0];
        let ancestorId = task.ParentId;
        let isAncestorDependency = false;
        while (ancestorId !== null && ancestorId !== undefined) {
          if (ancestorId === Number(predecessorId)) {
            isAncestorDependency = true;
            break;
          }
          ancestorId = parentById.get(ancestorId);
        }

        if (
          predecessorId &&
          taskMap.has(Number(predecessorId)) &&
          !isAncestorDependency
        ) {
          dependencies.push({
            from: Number(predecessorId),
            to: task.ID,
            type: 2
          });
        }
      });

      const removeEmptyChildren = (task) => {
        if (task.children.length === 0) delete task.children;
        else task.children.forEach(removeEmptyChildren);
      };
      roots.forEach(removeEmptyChildren);

      return {
        tasks: roots,
        dependencies,
        ...(projectListeners ? { listeners: projectListeners } : {})
      };
    },
    [records, projectListeners, defaultExpanded]
  );

  const completeListeners = useMemo(() => {
    if (!listeners?.paint || projectListeners?.dataReady) return listeners;

    return {
      ...listeners,
      paint: (...args) => {
        const gantt = ganttRef.current?.instance;
        const commit = gantt?.project?.commitAsync?.();
        const measureAfterPaint = () => (
          waitForTimelinePaint(gantt, () => listeners.paint(...args))
        );

        if (commit && typeof commit.then === 'function') {
          commit.then(measureAfterPaint, measureAfterPaint);
        } else {
          measureAfterPaint();
        }
      }
    };
  }, [ganttRef, listeners]);

  return (
    <BryntumGantt
      ref={ganttRef}
      id={id}
      project={project}
      columns={configuredColumns}
      height="750px"
      rowHeight={40}
      tbar={tbar}
      features={{
        projectLines: true,
        dependencies: true,
        ...features,
        ...(features.rowReorder
          ? {
            rowReorder: {
              ...(typeof features.rowReorder === 'object' ? features.rowReorder : {}),
              disabled: false,
              showGrip: true
            }
          }
          : {})
      }}
      listeners={completeListeners}
    />
  );
}