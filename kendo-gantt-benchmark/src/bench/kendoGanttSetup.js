import { Gantt, GanttDayView, GanttMonthView, GanttTextFilter, GanttWeekView } from '@progress/kendo-react-gantt';

export const KENDO_TASK_MODEL_FIELDS = {
  id: 'id',
  start: 'start',
  end: 'end',
  title: 'title',
  percentComplete: 'percentComplete',
  parentId: 'parentId',
  children: 'children',
  expanded: 'expanded'
};

export const KENDO_DEPENDENCY_MODEL_FIELDS = {
  id: 'id',
  fromId: 'fromId',
  toId: 'toId',
  type: 'type'
};

export const KENDO_COLUMNS = [
  { field: 'id', title: 'ID', width: 80 },
  { field: 'title', title: 'Task Name', width: 250, filter: GanttTextFilter },
  { field: 'start', title: 'Start Date', width: 140 },
  { field: 'end', title: 'End Date', width: 140 },
  { field: 'predecessor', title: 'Predecessor', width: 120 }
];

const toDate = (value) => {
  if (value instanceof Date) return value;
  if (!value && value !== 0) return new Date(2017, 1, 9);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(2017, 1, 9) : parsed;
};

const toTree = (flatTasks) => {
  const byId = new Map();
  const roots = [];

  flatTasks.forEach((item) => {
    const id = Number(item.ID ?? item.id);
    const start = toDate(item.StartDate ?? item.start);
    const duration = Number(item.Duration ?? item.duration ?? 5);
    const explicitEnd = toDate(item.EndDate ?? item.end ?? null);
    const end = new Date(start);

    if (!Number.isNaN(duration) && duration > 0) {
      end.setDate(start.getDate() + Number(duration));
    }

    if (explicitEnd && !Number.isNaN(explicitEnd.getTime()) && explicitEnd.getTime() >= start.getTime()) {
      const explicitDiff = (explicitEnd.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
      if (explicitDiff >= duration || duration <= 0) {
        end.setTime(explicitEnd.getTime());
      }
    }

    const rawPercent = Number(item.Progress ?? item.percentComplete ?? 0);
    const safePercent = Number.isFinite(rawPercent) ? Math.min(100, Math.max(0, rawPercent)) : 0;

    const task = {
      id,
      title: item.TaskName ?? item.title ?? `Task ${id}`,
      start,
      end,
      duration: Number(duration),
      predecessor: item.Predecessor ?? item.predecessor ?? '',
      percentComplete: safePercent,
      parentId: item.ParentId == null || item.ParentId === '' ? null : Number(item.ParentId),
      children: [],
      expanded: true,
      isExpanded: true
    };

    byId.set(id, task);
  });

  flatTasks.forEach((item) => {
    const id = Number(item.ID ?? item.id);
    const parentId = item.ParentId == null || item.ParentId === '' ? null : Number(item.ParentId);
    if (parentId !== null && byId.has(parentId)) {
      byId.get(parentId).children.push(byId.get(id));
    } else {
      roots.push(byId.get(id));
    }
  });

  return roots;
};

export const normalizeTaskData = (flatTasks = []) => {
  const tasks = toTree(flatTasks);
  return tasks.filter(Boolean);
};

export const normalizeDependencyData = (flatTasks = []) => {
  const dependencies = [];

  flatTasks.forEach((item, index) => {
    const predecessor = item.Predecessor ?? item.predecessor;
    if (predecessor === null || predecessor === undefined || predecessor === '') return;

    const value = String(predecessor).trim();
    const fromId = Number(value);
    if (Number.isNaN(fromId)) return;

    dependencies.push({
      id: `${item.ID ?? item.id}-${fromId}-${index}`,
      fromId,
      toId: Number(item.ID ?? item.id),
      type: 'FS'
    });
  });

  return dependencies;
};

export const KendoBenchGantt = ({
  dataSource = [],
  taskData,
  dependencyData,
  columns = KENDO_COLUMNS,
  ganttRef,
  style,
  height = 750,
  children,
  ...props
}) => (
  <Gantt
    {...props}
    ref={ganttRef}
    defaultView="week"
    taskData={taskData ?? normalizeTaskData(dataSource)}
    dependencyData={dependencyData ?? normalizeDependencyData(dataSource)}
    taskModelFields={KENDO_TASK_MODEL_FIELDS}
    dependencyModelFields={KENDO_DEPENDENCY_MODEL_FIELDS}
    columns={columns}
    style={{ ...style, height }}
  >
    <GanttDayView slotWidth={12} slotDuration={24 * 60 * 60 * 1000} />
    <GanttWeekView slotWidth={12} />
    <GanttMonthView slotWidth={12} />
    {children}
  </Gantt>
);

export const KendoGantt = KendoBenchGantt;
