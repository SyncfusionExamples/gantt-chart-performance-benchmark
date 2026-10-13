# Gantt Chart Performance Benchmark

A reproducible, side-by-side performance benchmark of four React-based Gantt chart
components — **Syncfusion EJ2 Gantt**, **Kendo UI React Gantt**, **Bryntum Gantt**,
and **DHTMLX Gantt** — built on identical datasets, an identical page structure,
and an identical measurement approach so that the resulting numbers are directly
comparable.

---

## Table of Contents

1. [Overview](#overview)
2. [Purpose](#purpose)
3. [Benchmark Scope](#benchmark-scope)
4. [Tested Libraries](#tested-libraries)
5. [Version Information](#version-information)
6. [Test Environment](#test-environment)
7. [Benchmark Methodology](#benchmark-methodology)
8. [Test Scenarios](#test-scenarios)
9. [Running the Benchmark](#running-the-benchmark)
10. [Metrics Collected](#metrics-collected)
11. [Results Interpretation](#results-interpretation)
12. [Repository Structure](#repository-structure)
13. [Additional Notes](#additional-notes)

---

## Overview

This repository hosts an in-browser benchmark suite that exercises four production
Gantt chart libraries through a common set of workload scenarios. Each library is
wrapped in its own self-contained Create React App sub-project so that dependency
trees, build outputs, and dev servers cannot interfere with one another. Every
sub-project exposes the same navigation structure, the same dataset presets, the
same page components, and the same metric-recording surface, which makes a number
recorded on one page directly comparable to the equivalent page in any other
sub-project.

The project is published as an open benchmark. It is intended for engineers who
are evaluating JavaScript Gantt components and need a transparent, reproducible
view of how the major libraries behave under comparable workloads.

## Purpose

The benchmark exists to provide an impartial, reproducible basis for comparing the
runtime performance of popular React Gantt chart libraries. The objectives are:

- To measure the time required to render progressively larger Gantt datasets.
- To measure the responsiveness of common interactions (selection, expand/collapse,
  dependency editing, scrolling) on the same dataset shapes used for the render
  benchmarks.
- To measure the memory footprint of each library as the dataset grows.
- To measure the static asset weight of each library when bundled for production.
- To identify the dataset size at which each library begins to exhibit user-visible
  degradation.

The benchmark is **not** a feature comparison, an API usability review, a
licensing analysis, or a support-level comparison. Those dimensions are
deliberately out of scope.

## Benchmark Scope

The benchmark covers the following dimensions of runtime behaviour:

- **Cold render time** for first paint of a fresh dataset.
- **Interaction latency** for the most common user operations.
- **Hierarchy handling** under multi-level parent–child trees.
- **Dependency handling** when predecessor/successor relationships are added or
  modified.
- **Memory usage** as the dataset size grows.
- **Production bundle size** for each library and its required peer dependencies.
- **Stress behaviour** as the dataset is grown until the UI becomes unresponsive.

The benchmark deliberately does **not** measure:

- Feature parity or API surface area.
- Accessibility, internationalization, or theming fidelity.
- Documentation, support response times, or commercial licensing.
- Server-side rendering (SSR) — every measurement is taken in a client-side
  React 19 application.

## Tested Libraries

The following four Gantt chart libraries are benchmarked in this repository:

| Library                    | Distribution channel                | License (benchmark build)        |
|----------------------------|-------------------------------------|----------------------------------|
| Syncfusion EJ2 React Gantt | `@syncfusion/ej2-react-gantt` (npm) | Commercial (community licence)   |
| Kendo UI React Gantt       | `@progress/kendo-react-gantt` (npm) | Commercial (trial)               |
| Bryntum Gantt              | `@bryntum/gantt-react` (npm)        | Commercial (trial)               |
| DHTMLX Gantt               | `@dhtmlx/trial-react-gantt` (npm)   | Commercial (trial)               |

All four libraries are installed from their public npm registries. Bryntum and
DHTMLX are installed as trial packages in line with their npm distribution
model; vendor watermarks are present in the trial UI but are confined to
decorative overlays and do not influence the recorded metrics. Kendo is installed
as a regular commercial package and is also rendered without a license file.
Syncfusion is installed from the standard `@syncfusion` npm scope under the
public Essential JS 2 distribution.

## Version Information

The benchmark was captured against the package versions listed below. Two of the
four sub-projects declare a wildcard version range (`"*"`) for the Gantt
package; the version shown is the version that the wildcard resolves to on the
public npm registry at the time of publication.

| Component                          | Version | Source                              |
|------------------------------------|---------|-------------------------------------|
| `@syncfusion/ej2-react-gantt`      | 35.1.37 | Latest published on npm (resolved wildcard) |
| `@progress/kendo-react-gantt`      | 16.0.0  | Declared in `kendo-gantt-benchmark/package.json` (`^16.0.0`) |
| `@progress/kendo-react-common`     | 16.0.0  | Declared peer of Kendo Gantt        |
| `@progress/kendo-theme-default`    | 13.0.1  | Declared in `kendo-gantt-benchmark/package.json` |
| `@bryntum/gantt-react`             | 7.3.5   | Declared in `bryntum-gantt-benchmark/package.json` (`^7.3.5`) |
| `@bryntum/gantt` (aliased)         | 7.3.5   | npm alias → `@bryntum/gantt-trial` (`^7.3.5`) |
| `@dhtmlx/trial-react-gantt`        | 10.0.3  | Latest published on npm (resolved wildcard) |
| `react`                            | 19.2.8  | Declared in every sub-project (`^19.2.8`) |
| `react-dom`                        | 19.2.8  | Declared in every sub-project (`^19.2.8`) |
| `react-scripts`                    | 5.0.1   | Declared in every sub-project (Create React App) |
| `source-map-explorer`              | 2.5.3   | Dev dependency for the bundle report |

**To pin to a different version,** change the version range in the relevant
`package.json` and reinstall. The benchmark pages and dataset generator are
library-agnostic; no application code changes are required when upgrading.

## Test Environment

The benchmark is designed to be executed in a modern desktop browser on a
developer workstation. The following are the assumed baseline conditions for
reproducible results:

| Variable        | Expected value                                         |
|-----------------|--------------------------------------------------------|
| Node.js         | 18.x or 20.x LTS                                       |
| npm             | 9.x or 10.x                                            |
| Browser         | Latest stable Chromium-based browser (Chrome or Edge) |
| Display         | Hardware-accelerated, ≥ 60 Hz                          |
| OS              | Windows 10/11, macOS 12+, or current Linux LTS         |
| DevTools state  | Closed or detached during measurement                  |
| Browser extentions | Disabled during measurement                         |
| React StrictMode | Disabled in measurement runs to avoid double-render artifacts |

Hardware-specific results will vary. Memory measurements in particular are
sensitive to background load and to the availability of free RAM; run the
benchmark on an otherwise idle machine for comparable figures.

## Benchmark Methodology

### Measurement Approach

Every measurement is taken inside the browser. The dataset generator captures a
high-resolution timestamp (`performance.now()`) immediately before writing a
new dataset into React state. The corresponding page component subscribes to
the framework-specific render-complete event (`dataBound` for Syncfusion,
`dataReady` for Bryntum, `onDataRender` for DHTMLX, or a `useEffect` on
`dataSource.length` for Kendo) and closes the timer once the painted frame is
on screen. The elapsed interval covers data construction, React commit, the
library's own render pass, and the first paint — the same window a user
perceives as "waiting".

For paint-based metrics, the timer is closed from inside
`requestAnimationFrame` so the recorded value reflects the time at which the
first new frame is composited, not the time at which the last JavaScript
statement executes.

### Code Splitting

Each benchmark page is loaded through `React.lazy` with a stable
`webpackChunkName`. The Gantt code is therefore not present in the initial
JavaScript bundle; it is fetched on first navigation. This is intentional and
preserves the production-bundle size measurement, which counts the network
weight of every page chunk.

### Dataset Generator

A single `useDataset` hook is shared by all sub-projects. It exposes the
following shape:

- 5K, 10K, 25K, 50K, 100K, 200K, 300K, 400K, 500K, and 1M-task preset sizes.
- A `measureRender` flag that suppresses the empty-state render so the timer
  captures the populated render only.
- A `clearData` and `refreshData` action pair that the toolbar exposes.

Dataset generation is chunked into 2,000-row slices (4,000 for very large
datasets) and committed inside a `requestAnimationFrame` loop so the
generator itself does not block the main thread.

### Fairness Considerations

The benchmark is constructed to keep the variable surface as small as possible:

- All four sub-projects target the **same React version** (19.2.8) and the
  **same build tool** (Create React App 5.0.1).
- All four sub-projects load the **same dataset shapes** and the **same
  measurement hooks**.
- All four sub-projects lazy-load their Gantt component, so initial-bundle
  numbers are not biased by tree-shaking differences.
- All four sub-projects run against the same dev server defaults; no
  library-specific Webpack or Babel overrides are in effect.

What fairness **cannot** eliminate:

- The libraries have different default rendering strategies. Some render
  every row eagerly; others virtualize by default. Where the library exposes a
  virtualization toggle, it is enabled in the benchmark setup.
- The libraries have different default themes. Theme CSS is included but is
  not expected to materially affect render-time or memory measurements.
- The libraries have different event semantics. Each page closes the
  measurement timer on the event most faithful to "user-visible first paint"
  for that library, which is documented in the page source.

## Test Scenarios

The benchmark exposes the following pages in each sub-project:

| #  | Page              | What it measures                                                                                          |
|----|-------------------|-----------------------------------------------------------------------------------------------------------|
| 1  | Initial Load      | Render time of the populated Gantt on a fresh dataset, by preset size.                                   |
| 2  | Interaction Latency | Response time of row click, row selection, hover, and inline edit operations.                            |
| 3  | Hierarchy         | Expand/collapse latency on multi-level parent–child trees.                                                |
| 4  | Dependency        | Critical-path recalculation latency when predecessor or successor relationships are added or modified.   |
| 5  | Memory            | JavaScript heap usage after a render, recorded through the browser's memory API.                          |
| 6  | Bundle Size       | Production bundle weight, classified by package via `source-map-explorer`.                                |
| 7  | Stress Test       | Progressive dataset growth until the UI becomes unresponsive; the largest size that completes inside the budget is recorded. |
| 8  | Scrolling*        | Frame rate during vertical and horizontal scroll, measured via `requestAnimationFrame` deltas.           |

\* *The Scrolling page is present in the DHTMLX, Bryntum, and Kendo sub-projects.
It is not present in the Syncfusion sub-project in the current release and is
excluded from cross-library comparisons on that page.*

The following pages exist in the source tree but are **disabled** in the current
build and are not part of the published benchmark surface:

- Filtering (source available in `syncfusion-gantt-benchmark/src/bench/FilterPage.js`)
- Sorting (source available in `syncfusion-gantt-benchmark/src/bench/SortPage.js`)

## Running the Benchmark

### Prerequisites

- Node.js 18.x or 20.x LTS
- npm 9.x or 10.x

### Run a Single Library

Each sub-project is independent. To exercise one library in isolation:

```sh
cd <library>-gantt-benchmark        # syncfusion- | kendo- | bryntum- | dhtmlx-
npm install
npm start                            # opens the dev server
```

The dev server mounts a navigation bar with the pages listed above. Switch
between pages from the top navigation; the dataset preset toolbar is rendered
above the Gantt on every page.

### Compare Libraries Side by Side

To compare two or more libraries under identical conditions, start each one on
a different port from separate terminals:

```sh
# Terminal 1
cd syncfusion-gantt-benchmark && BROWSER=none PORT=3000 npm start

# Terminal 2
cd kendo-gantt-benchmark      && BROWSER=none PORT=3001 npm start

# Terminal 3
cd bryntum-gantt-benchmark    && BROWSER=none PORT=3002 npm start

# Terminal 4
cd dhtmlx-gantt-benchmark     && BROWSER=none PORT=3003 npm start
```

Navigate to the same page on each origin and record the displayed metric.
The summary card on every page reports the same shape across libraries, which
allows direct side-by-side reading.

### Production Build and Bundle Report

For the Syncfusion, Bryntum, and DHTMLX sub-projects, the production build
also emits a bundle report:

```sh
npm run build                       # builds + emits public/bundle-report.html
npm run analyze:bundle              # regenerates the bundle report without rebuilding
```

The HTML report is an interactive treemap of the production bundle, broken
down by package and module.

### Common npm Scripts

| Script                 | Purpose                                                              |
|------------------------|----------------------------------------------------------------------|
| `npm start`            | Run the dev server with hot-module reload.                           |
| `npm test`             | Run the React Testing Library suite.                                 |
| `npm run build`        | Production build to `build/` (and bundle report, where wired).       |
| `npm run analyze:bundle` | Regenerate the bundle report without rebuilding.                   |
| `npm run eject`        | Eject from Create React App — not recommended for benchmarks.        |

## Metrics Collected

The following metrics are recorded by the benchmark. Each metric is read from
the same surface in every sub-project.

| Metric                        | Source                                                                                  |
|-------------------------------|-----------------------------------------------------------------------------------------|
| Render time (s)               | `performance.now()` delta, closed on the framework's render-complete event.             |
| Interaction latency (ms)      | High-resolution timer around the simulated event, repeated for a configurable sample.  |
| Hierarchy latency (ms)        | Timer around `expand` / `collapse` on a parent row.                                     |
| Dependency recalculation (ms) | Timer around the recalculation triggered by a link edit.                                |
| Memory used (MB)              | `performance.memory.usedJSHeapSize` (Chromium) after the dataset is rendered.           |
| Bundle size (KB)              | Production `build/static/js` chunk sizes, classified by package.                         |
| Stress ceiling (rows)         | Largest dataset that completes render under a 60-second budget.                         |
| Scroll FPS                    | Frame delta over a fixed scroll distance, measured via `requestAnimationFrame`.         |

All metrics are surfaced live in the browser; no external telemetry is sent.

## Results Interpretation

The benchmark is designed to surface **relative** differences between libraries
under identical workloads, not absolute pass/fail thresholds. The following
guidance applies when reading the numbers:

- **Differences within ±10%** on render time and interaction latency are
  not considered meaningful; they fall inside the per-run variance of the
  measurement itself.
- **Memory measurements** are sensitive to background browser activity and
  should be read as a band rather than a single figure.
- **Bundle size** is reported as the gzipped-equivalent production output of
  each sub-project. The reported figure includes the framework's own code,
  its required peer dependencies, and the benchmark harness. Subtract the
  benchmark harness (~80 KB) to compare framework-only weights.
- **Stress ceiling** is the largest dataset size that the library rendered
  inside a 60-second budget. A library that does not complete a 1M-task
  render does not fail the benchmark — its ceiling is simply lower.
- **Trial-package watermarks** are present in the Bryntum and DHTMLX UIs
  but do not affect the recorded metrics.

Where a result cannot be produced (for example, when a library does not
expose the relevant event hook), the corresponding cell is left blank rather
than imputed.

## Repository Structure

```
gantt-chart-performance-benchmark/
├── syncfusion-gantt-benchmark/       React 19 + @syncfusion/ej2-react-gantt
├── kendo-gantt-benchmark/            React 19 + @progress/kendo-react-gantt
├── bryntum-gantt-benchmark/          React 19 + @bryntum/gantt-react (trial)
├── dhtmlx-gantt-benchmark/           React 19 + @dhtmlx/trial-react-gantt
└── README.md                         This file
```

Each sub-project is a standalone Create React App application. The shared
building blocks inside each sub-project are:

- `src/bench/useDataset.js` — shared dataset generator (5K–1M presets).
- `src/bench/Navigation.js` — top navigation with the seven (or eight) benchmark pages.
- `src/bench/DatasetControls.js` — preset selector and refresh/clear toolbar.
- `src/bench/BenchSection.js` — shared page layout and metric summary card.
- `src/bench/ganttSetup.js` — library-specific configuration (task fields,
  columns, plugins, models).
- `src/bench/<Page>Page.js` — the actual benchmark page for one scenario.
- `src/bench/<Page>Page.lazy.js` — a thin re-export wrapper used by
  `React.lazy` to give the chunk a stable `webpackChunkName`.
- `scripts/generateBundleStats.js` — post-build script that walks
  `build/static/js`, classifies each chunk, and emits `public/bundle-report.html`
  and `public/bundle-stats.json` (Syncfusion, Bryntum, and DHTMLX only).

The repository has no build artefacts checked in. Each sub-project owns its
own `node_modules`, its own `build/`, and its own dev server.

## Additional Notes

### Trial Builds and Vendor Watermarks

The Bryntum and DHTMLX Gantt packages are installed as their official trial
distributions. The trial UIs carry a vendor watermark on roughly 50% of the
viewport. The watermark is a decorative overlay and does not affect render
time, interaction latency, memory usage, or bundle size. Kendo is installed
as a regular commercial package and runs without a license file; if Kendo
detects the absence of a license, the page displays a one-time console
notice and continues to function.

### Kendo Theming

The Kendo sub-project loads `@progress/kendo-theme-default` at the application
root. Some Kendo controls require their own theme imports for full styling;
if a control renders unstyled, check `src/App.js` for the active theme
imports and add the missing module.

### Syncfusion Theming

The Syncfusion sub-project uses the bundled Material theme by default. To A/B
visually against another theme, pass a `cssClass` to the
`<GanttComponent>` instance in `src/App.js`.

### DHTMLX Project Promotion

The DHTMLX React wrapper auto-promotes parents to projects (`auto_types: true`)
by default, which can cause the rendered bar to extend beyond the visible
range. To disable this behaviour, set `auto_types: false` in
`src/bench/ganttSetup.js` under `defaultConfig`.

### React 19 Compatibility

The benchmark targets React 19.2.8. Some of the libraries included in this
benchmark may not formally list React 19 as a supported peer at the time of
publication; in practice all four run on React 19 in the configurations
shipped here. If you re-run the benchmark against a later React version,
re-record every metric — the framework layer is shared across all four
libraries and any change to it is a controlled-variable change, not a
library-level change.

### Reproducibility

The benchmark is interactive rather than automated. There is no Playwright
or Puppeteer runner wired in. A future release will add an automated
harness; until then, results are recorded by hand from the on-page metric
card. The `npm run build` step is fully reproducible.

### Out of Scope

The benchmark measures runtime performance only. It does not measure
developer experience, accessibility, internationalization, server-side
rendering, mobile or touch behaviour, server-side data binding performance,
or commercial terms. Readers evaluating Gantt libraries for production use
should weigh those dimensions separately.

### License

The benchmark harness is published under the MIT license. Each measured
library is third-party software, installed from its vendor's npm registry
under its vendor's own licence, and is not redistributed in this repository.
