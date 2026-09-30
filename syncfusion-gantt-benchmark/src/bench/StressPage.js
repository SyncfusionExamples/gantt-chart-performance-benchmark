import React, { useEffect, useState } from 'react';
import {
  GanttComponent,
  ColumnsDirective,
  ColumnDirective,
  Inject
} from '@syncfusion/ej2-react-gantt';
import BenchSection from './BenchSection';
import { taskFields, SERVICES } from './ganttSetup';

// Hierarchy Stress Test presets: target record count + tree depth.
// The generator (exposed via dataset.loaders.loadHierarchy) builds a real
// parent -> child -> grandchild -> ... chain down to `depth` levels so
// "5 levels" actually means a 5-level tree.
const STRESS_PRESETS = [
  { key: 'p25k_5',   label: 'Run 25K / 5 levels',   records: 25000,  depth: 5  },
  { key: 'p50k_10',  label: 'Run 50K / 10 levels',  records: 50000,  depth: 10 },
  { key: 'p75k_10',  label: 'Run 75K / 10 levels',  records: 75000,  depth: 10 },
  { key: 'p100k_10', label: 'Run 100K / 10 levels', records: 100000, depth: 10 }
];

export default function StressPage({ dataset }) {
  // Mirrors HierarchyPage's destructure order so the two pages read from
  // the dataset the same way: ganttRef + dataSource + isLoading + loaders.
  // We additionally pull renderSeconds / currentSize / clearData so the
  // page can report the initial-render time and reset the Gantt between
  // presets.
  const { ganttRef, dataSource, isLoading, loaders, renderSeconds, currentSize, clearData } = dataset;
  const [report, setReport] = useState([]);
  const [activePreset, setActivePreset] = useState(null);
  const [runningKey, setRunningKey] = useState(null);

  // No auto-load on mount — the page must stay empty until the user
  // explicitly picks a preset. This matches the user requirement of
  // "directly record loading i don't want". Data is only ever populated
  // by `runPreset`, triggered by a button click.

  // Whenever the dataset hook closes the render timer (renderSeconds goes
  // from null to a number) we snapshot it into the report row tagged with
  // the currently active preset. This is the dataset-driven equivalent of
  // the per-page `pendingRunRef`/`waitForDataBound` handshake that other
  // pages use — the source of truth is the same `dataset.measureRender`
  // call HierarchyPage's `dataBound` handler makes.
  useEffect(() => {
    if (renderSeconds === null || renderSeconds === undefined) return;
    if (!activePreset) return;
    setReport([
      {
        key: activePreset.key,
        records: activePreset.records,
        depth: activePreset.depth,
        actual: currentSize,
        initialRenderSeconds: renderSeconds
      }
    ]);
  }, [renderSeconds, activePreset, currentSize]);

  // Same one-liner HierarchyPage uses: hand the render-time off to the
  // dataset hook. No manual promise plumbing in this page.
  const handleDataBound = () => {
    if (typeof dataset.measureRender === 'function') dataset.measureRender();
  };

  const runPreset = (preset) => {
    if (runningKey) return;
    setRunningKey(preset.key);
    // Always drop the previous dataset so the Gantt only ever shows the
    // current preset's rows. clearData bumps the version so any in-flight
    // dataBound from a prior load is ignored.
    if (typeof clearData === 'function') clearData();
    setReport([]);
    setActivePreset(preset);
    loaders.loadHierarchy(preset.records, preset.depth);
    // Release the running lock on the next tick; the report row is filled
    // by the `useEffect` above once renderSeconds lands.
    Promise.resolve().then(() => setRunningKey(null));
  };

  const handleClear = () => {
    if (runningKey) return;
    if (typeof clearData === 'function') clearData();
    setReport([]);
    setActivePreset(null);
  };

  return (
    <BenchSection
      dataset={dataset}
      title="Hierarchy Stress Test"
      showControls={false}
      actions={
        <>
          {STRESS_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => runPreset(preset)}
              disabled={Boolean(runningKey) || isLoading}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={handleClear}
            disabled={Boolean(runningKey) || isLoading || dataSource.length === 0}
            style={{ marginLeft: '8px' }}
          >
            Clear
          </button>
        </>
      }
      summary={
        <div style={{ fontSize: '13px', color: '#64748b' }}>
          Initial hierarchy rendering report only.
          {report.length > 0 && (
            <table style={{ borderCollapse: 'collapse', marginTop: '4px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '2px 10px 2px 0', textAlign: 'left', fontWeight: 'normal' }}>Records</th>
                  <th style={{ padding: '2px 10px 2px 0', textAlign: 'left', fontWeight: 'normal' }}>Depth</th>
                  <th style={{ padding: '2px 0', textAlign: 'left', fontWeight: 'normal' }}>Initial render</th>
                </tr>
              </thead>
              <tbody>
                {report.map((row) => (
                  <tr key={row.key}>
                    <td style={{ padding: '2px 10px 2px 0' }}>
                      {row.records.toLocaleString()}
                      {row.actual !== row.records && row.actual
                        ? <span style={{ color: '#94a3b8' }}> ({row.actual.toLocaleString()})</span>
                        : null}
                    </td>
                    <td style={{ padding: '2px 10px 2px 0' }}>{row.depth}</td>
                    <td style={{ padding: '2px 0' }}>
                      {row.initialRenderSeconds === null || row.initialRenderSeconds === undefined
                        ? '—'
                        : `${row.initialRenderSeconds.toFixed(3)} s`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      }
    >
      {dataSource.length > 0 && (
        <GanttComponent
          ref={ganttRef}
          id="stress-gantt"
          dataSource={dataSource}
          taskFields={taskFields}
          height="450px"
          enableVirtualization={true}
          enableTimelineVirtualization={true}
          treeColumnIndex={1}
          dataBound={handleDataBound}
        >
          <ColumnsDirective>
            <ColumnDirective field="ID" headerText="ID" width="80" />
            <ColumnDirective field="TaskName" headerText="Task Name" width="250" />
            <ColumnDirective field="StartDate" headerText="StartDate" width="250" />
            <ColumnDirective field="Predecessor"/>
          </ColumnsDirective>
          <Inject services={SERVICES} />
        </GanttComponent>
      )}
    </BenchSection>
  );
}