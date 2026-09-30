# gantt-chart-performance-benchmark

A side-by-side performance benchmark of four React Gantt chart libraries —
**Syncfusion**, **Kendo UI**, **Bryntum**, and **DHTMLX** — wrapped around the
same dataset, the same UI, and the same measurement harness, so the numbers
are directly comparable.

## What it measures

| Page               | What is timed / observed                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Initial Load       | First-paint render time & time-to-interactive across 1K / 5K / 10K / 25K task presets. |
| Interaction Latency| Response time for row click, selection, hover, and inline edit operations.                |
| Hierarchy          | Expand / collapse latency on multi-level parent–child trees.                             |
| Dependency         | Critical-path recalculation when predecessor / successor links change.                   |
| Memory             | JS heap usage across dataset sizes (in-browser memory profiler snapshots).              |
| Bundle Size        | Static asset weight breakdown produced via `source-map-explorer`.                        |
| Stress Test        | Breaking-point discovery — progressive loading until the UI becomes unresponsive.        |

## Repository layout

This repo has **no history** and no checked-in build artefacts; each
library lives in its own self-contained Create React App sub-project so
its `node_modules`, `bundle-stats`, and dev server don't clash with the
others.

```
gantt-chart-performance-benchmark/
├── syncfusion-gantt-benchmark/    React 19 + @syncfusion/ej2-react-gantt
├── kendo-gantt-benchmark/         React 19 + @progress/kendo-react-gantt
├── bryntum-gantt-benchmark/       React 19 + @bryntum/gantt-react (trial)
├── dhtmlx-gantt-benchmark/        React 19 + @dhtmlx/trial-react-gantt
└── README.md                      (you are here)
```

Every sub-project exposes the **same** benchmark pages listed above, the
**same** dataset presets (1K / 5K / 10K / 25K tasks), and the **same**
`useDataset` hook, so a score recorded on one page can be compared
directly against the equivalent page in another sub-project.

## Getting started

Each sub-project is independent — `cd` into the one you want to run.

```bash
# Pick a library
cd syncfusion-gantt-benchmark     # or kendo- / bryntum- / dhtmlx-

# Install
npm install

# Run the dev server (http://localhost:3000)
npm start

# Build for production + emit bundle stats (Syncfusion / Bryntum / DHTMLX)
npm run build

# Just regenerate the bundle report without rebuilding
npm run analyze:bundle
```

> **Note:** `npm run build` writes `public/bundle-report.html` and
> `public/bundle-stats.json` for the Syncfusion / Bryntum / DHTMLX
> sub-projects. Open the HTML report in a browser for an interactive
> treemap of the production bundle.

## How the benchmark pages are wired

Inside each sub-project, `src/App.js` mounts a `<Navigation>` bar with the
page list above. Every page is loaded through `React.lazy` with a stable
`webpackChunkName` (e.g. `page-hierarchy`, `page-dependency`) so the
heavy Gantt code only ships when the user navigates to it; the initial
bundle stays in the low-hundreds-of-KB range.

Shared building blocks per sub-project:

- `src/bench/useDataset.js` — generates 1K / 5K / 10K / 25K task datasets
  on demand and exposes a `measureRender` flag so the empty-state render
  doesn't pollute the measurement.
- `src/bench/Navigation.js` — top-nav with the seven benchmark pages.
- `src/bench/DatasetControls.js` — preset selector + "measure" toggle.
- `src/bench/BenchSection.js` — shared layout / summary card.
- `src/bench/ganttSetup.js` (Bryntum) — config / models / feature
  registration, kept separate so it can be shared across pages.

## Comparing libraries

Because every sub-project runs the same pages against the same dataset
shapes, you can sweep across them like this:

```bash
# Terminal 1
cd syncfusion-gantt-benchmark && npm start

# Terminal 2
cd kendo-gantt-benchmark && BROWSER=none PORT=3001 npm start

# Terminal 3
cd bryntum-gantt-benchmark && BROWSER=none PORT=3002 npm start

# Terminal 4
cd dhtmlx-gantt-benchmark  && BROWSER=none PORT=3003 npm start
```

Then navigate to the **same page** (e.g. Hierarchy or Dependency) on
each origin and compare the metric summaries side-by-side.

## Common scripts (all sub-projects)

| Script           | Purpose                                                    |
| ---------------- | ---------------------------------------------------------- |
| `npm start`      | Run the dev server with HMR.                               |
| `npm test`       | Run the React Testing Library suite in watch mode.         |
| `npm run build`  | Production build to `build/` (and bundle stats if wired).  |
| `npm run eject`  | One-way eject from CRA — not recommended for benchmarks.   |

## Notes & gotchas

- **Bryntum** ships as the trial package via the npm alias
  `@bryntum/gantt → @bryntum/gantt-trial@^7.3.5`. Expected ~50% of the
  trial overlay is watermarked UI; perf numbers are unaffected.
- **DHTMLX** ships as the trial via `@dhtmlx/trial-react-gantt`. The
  wrapper auto-promotes parents to projects (`auto_types: true`) — turn
  it off in `defaultConfig` if the cascaded bar length surprises you.
- **Kendo** ships against `@progress/kendo-theme-default`. Some pages
  require their own theme import; check `src/App.js` for the current
  setup.
- **Syncfusion** defaults to its bundled Material theme; pass `cssClass`
  to `<GanttComponent>` if you want to A/B visually with Kendo.
