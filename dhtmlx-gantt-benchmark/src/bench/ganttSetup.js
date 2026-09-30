// DHTMLX-specific defaults shared by every benchmark page.
//
// Each page inlines its own <ReactGantt> markup, so this module only owns
// the *configuration* that has to be identical across pages:
//   - defaultConfig     base gantt.config that mirrors what Syncfusion gave us
//                       (virtualization, indent, auto-types off, ...)
//   - defaultColumns    default grid column set
//   - minimalColumns    subset of the default column set
//   - defaultScales     timeline scale (month + day, like Syncfusion's default)
//   - defaultPlugins    base plugin flags
//
// Task field mapping is handled by the data adapter in useDataset.js:
// Syncfusion { ID, TaskName, StartDate, Duration, Progress, ParentId,
// Predecessor } -> DHTMLX { id, text, start_date, duration, progress,
// parent } with a separate `links` array.

export const defaultColumns = [
  { name: 'id', label: 'ID', align: 'left', width: 80, resize: true },
  { name: 'text', label: 'Task Name', tree: true, align: 'left', width: 250, resize: true },
  { name: 'start_date', label: 'Start Date', align: 'left', width: 120, resize: true },
];

// Subset of the columns that fits inside the grid area when the
// benchmark page only wants ID / Task Name / Progress (Initial Load,
// Scroll, Memory, Bundle, Stress). The full set above is used by
// Hierarchy, Dependency, and Interaction Latency.
export const minimalColumns = defaultColumns.filter((c) =>
  ['id', 'text', 'progress'].includes(c.name)
);

// `auto_types: true` matches the official DHTMLX demo: any task that has
// children is auto-promoted to a *project*. Project start = earliest
// child start, project end = latest child end, project duration =
// end - start. This is what produces the "Office itinerancy → Office
// facing → Interior office" rendering in the official demo, where
// each parent shows aggregated dates from its descendants.
export const defaultConfig = {
  auto_types: true,
  // Auto-scheduling is the feature that enforces Finish-to-Start
  // (FS) dependency chains. With `enabled: true` and
  // `schedule_on_parse: true`, the gantt walks every FS link after
  // `gantt.parse()` and shifts the successor's start_date to
  // `predecessor.end_date` (so successor.start >= predecessor.end).
  //
  // Note: the React wrapper's `useData` hook silently flips
  // `config.auto_scheduling.schedule_on_parse` back to `false`
  // before re-parsing, so a manual `gantt.autoSchedule()` call
  // is also required after each fresh parse. Pages that need the
  // cascade visible call `gantt.autoSchedule()` themselves (see
  // InitialLoadPage.js for the pattern).
  auto_scheduling: {
    enabled: true,
    schedule_on_parse: true,
    move_projects: false,
    descendant_links: false
  },
  smart_rendering: true,
  smart_scales: true,
  // Tree column behaviour.
  tree_indent: 20,
  // 8 weeks visible by default, like Syncfusion.
  scroll_on_click: true,
  // Highlight the critical path; Dependency page keeps this on, the rest
  // are unaffected because no chain has 0-slack edges unless links exist.
  highlight_critical_path: true,
  // Inline edit is always allowed so the Interaction Latency page works.
  // DHTMLX exposes this through gantt.config (no separate service).
  show_progress: true,
  show_grid: true,
  show_chart: true,
  // Link arrows are drawn for any defined link.
  show_links: true,
  // dhtmlx reads drag handles from these flags.
  drag_move: true,
  drag_resize: true,
  drag_progress: true,
  drag_links: true,
  row_drag: true,
  // Validate generated links (no cycles, valid source/target). Throws
  // an error in the console if any link is malformed.
  validate_links: true,
  // dhtmlx's `duration_unit` defaults to "day" but make it explicit so
  // auto-scheduling arithmetic doesn't depend on the user's locale.
  duration_unit: 'day'
};

// Scales configuration shared by every page. Two-row scale: month on
// top, day below, same look as the Syncfusion Gantt default.
export const defaultScales = [
  { unit: 'month', step: 1, format: '%F %Y' },
  { unit: 'day', step: 1, format: '%j' }
];

// Default plugins. The `auto_scheduling` plugin must be registered
// (via `<ReactGantt plugins={...}>`) before `gantt.init()` runs —
// that's the only point where plugin registration takes effect. The
// plugin is what enforces Finish-to-Start dependency chains: it
// walks every link, computes predecessor.end_date, and shifts the
// successor's start_date to match. Without the plugin, links are
// pure visuals (arrows) and dates stay where the dataset puts them.
export const defaultPlugins = {
  auto_scheduling: true,
  inline_editors: true,
};
