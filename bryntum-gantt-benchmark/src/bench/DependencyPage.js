import React, { useEffect, useMemo } from 'react';
import BenchSection from './BenchSection';
import BenchmarkGantt, { waitForTimelinePaint } from './BenchmarkGantt';

// Page-local metadata for the dataset used here. Kept beside the page so
// every other benchmark (InitialLoad, Scroll, Stress, …) keeps using the
// shared loaders untouched.
export default function DependencyPage({ dataset }) {
  const { ganttRef, dataSource, isLoading, loaders, renderSeconds } = dataset;

  // Auto-load the smallest dependency dataset on first mount so
  // the user lands on a populated grid ready to benchmark.
  useEffect(() => {
    if (dataSource.length === 0 && !isLoading) {
      loaders.loadDependency5000();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial-load render-time measurement, lifted from InitialLoadPage.
  // Bryntum fires `dataReady` on the project once the initial commit +
  // dependency-walk settles. We then wait for the timeline project-line
  // element to be painted before closing the timer, so the reported
  // number includes dependency resolution + the very first render
  // frame.
  const handleDataReady = () => {
    if (typeof dataset.measureRender === 'function') dataset.measureRender();
  };

  const projectListeners = useMemo(
    () => ({
      dataReady: () => waitForTimelinePaint(
        () => ganttRef.current?.instance,
        handleDataReady
      )
    }),
    // handleDataReady closes over `dataset` which is stable across
    // renders (same object reference from the parent). The ref-based
    // measureRender also reads from the dataset hook's ref, so this
    // memoised listener is safe to build once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // The Bryntum `criticalPaths` feature is enabled declaratively
  // through `features` below, but Bryntum also recomputes the critical
  // path lazily on certain dataset events. We poke the feature once
  // the Gantt instance is mounted and again whenever the dataset
  // changes so the longest chain is highlighted immediately, every
  // time. The 0-ms timeout defers the call to after React has had a
  // chance to attach the ref to the underlying BryntumGantt.
  useEffect(() => {
    const handle = setTimeout(() => {
      const gantt = ganttRef.current?.instance;
      if (!gantt) return;
      const feature = gantt.features?.criticalPaths;
      if (!feature) return;
      // Force the visualisation on (in case the declarative config
      // didn't apply) and ask it to recompute against the current
      // project state.
      feature.disabled = false;
      if (typeof feature.updateCriticalPaths === 'function') {
        feature.updateCriticalPaths();
      } else if (
        gantt.project && typeof gantt.project.criticalPaths === 'function'
      ) {
        gantt.project.criticalPaths();
      }
    }, 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource]);

  const isReady = dataSource.length > 0;
  const summary = isReady ? (
    <div
      data-testid="dependency-report"
      style={{ fontSize: '13px', color: '#475569' }}
    >
      <div>
        {dataSource.length.toLocaleString()} records with dependency and
        critical-path render time:{' '}
        <b data-testid="dependency-render-s">
          {renderSeconds === null ? '—' : `${renderSeconds.toFixed(3)} s`}
        </b>
      </div>
      <div style={{ color: '#94a3b8', marginTop: '2px' }}>
        Uses the same dependency and predecessor pattern for every dataset
        size; critical-path calculation runs for the selected records.
      </div>
    </div>
  ) : null;

  return (
    <BenchSection
      dataset={dataset}
      title="Dependency / Critical-Path Recalculation"
      presets={[
        'loadDependency5000',
        'loadDependency10000',
        'loadDependency25000',
        'loadDependency50000'
      ]}
      summary={summary}
    >
      {isReady && (
        <BenchmarkGantt
          ganttRef={ganttRef}
          id="dependency-gantt"
          dataSource={dataSource}
          // Critical-path feature. Bryntum disables the visualisation
          // by default — the `criticalPaths` boolean alone is not
          // enough to surface the longest dependency chain on screen.
          // The object form below is the configuration called out in
          // the official docs:
          //   https://bryntum.com/products/gantt/docs/api/Gantt/feature/CriticalPaths
          //   criticalPathsFeature : { disabled: false, highlightCriticalRows: true }
          // `disabled: false` turns the visualisation on; the
          // `highlightCriticalRows` flag also paints the critical row
          // band in the grid so the user can see which task owns the
          // highlighted bar segment.
          features={{
            criticalPaths: {
              disabled: false,
              highlightCriticalRows: true
            }
          }}
          // Project-level listener drives the initial-load timer; the
          // gantt's own `paint` listener would fire on every re-paint
          // and short-circuit the measurement.
          projectListeners={projectListeners}
        />
      )}
    </BenchSection>
  );
}
