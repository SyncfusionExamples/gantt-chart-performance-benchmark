import React, { Suspense, useState } from 'react';
import Navigation, { SECTIONS } from './bench/Navigation';
import useDataset from './bench/useDataset';
import LandingPage from './bench/LandingPage';

// Each benchmark page lives in its own dynamic chunk. Loading them via
// `React.lazy` means the heavy Syncfusion Gantt code only ships when the
// user actually navigates to that page, keeping the initial bundle small.
//
// Naming convention: `Page.lazy.js` is a tiny re-export wrapper. The wrapper
// is what `lazy()` imports; it in turn does a static import of the real
// page module. This avoids the dynamic-import-expression-in-template
// footgun that CRA's webpack config dislikes, and gives every page a
// predictable chunk name in the build output.
const InitialLoadPage = React.lazy(() =>
  import(/* webpackChunkName: "page-initial-load" */ './bench/InitialLoadPage.lazy')
);
// Disabled for bundle-size measurement — re-enable by uncommenting.
// const FilterPage = React.lazy(() =>
//   import(/* webpackChunkName: "page-filter" */ './bench/FilterPage.lazy')
// );
// const SortPage = React.lazy(() =>
//   import(/* webpackChunkName: "page-sort" */ './bench/SortPage.lazy')
// );
const InteractionLatencyPage = React.lazy(() =>
  import(/* webpackChunkName: "page-interaction" */ './bench/InteractionLatencyPage.lazy')
);
const HierarchyPage = React.lazy(() =>
  import(/* webpackChunkName: "page-hierarchy" */ './bench/HierarchyPage.lazy')
);
const DependencyPage = React.lazy(() =>
  import(/* webpackChunkName: "page-dependency" */ './bench/DependencyPage.lazy')
);
const MemoryPage = React.lazy(() =>
  import(/* webpackChunkName: "page-memory" */ './bench/MemoryPage.lazy')
);
const BundlePage = React.lazy(() =>
  import(/* webpackChunkName: "page-bundle" */ './bench/BundlePage.lazy')
);
const StressPage = React.lazy(() =>
  import(/* webpackChunkName: "page-stress" */ './bench/StressPage.lazy')
);

const PAGE_MAP = {
  landing: LandingPage,
  'initial-load': InitialLoadPage,
  // filter: FilterPage,
  // sort: SortPage,
  interaction: InteractionLatencyPage,
  hierarchy: HierarchyPage,
  dependency: DependencyPage,
  memory: MemoryPage,
  bundle: BundlePage,
  stress: StressPage
};

// Inline loading state used while a lazy chunk is being fetched. The
// benchmark pages can take a second or two to land on a cold cache, so
// give the user something visible rather than a blank pane.
const PageFallback = () => (
  <div
    role="status"
    aria-live="polite"
    style={{
      padding: '32px',
      color: '#475569',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px'
    }}
  >
    Loading benchmark page…
  </div>
);

export default function App() {
  const initialLoadDataset = useDataset();
  const scrollDataset = useDataset();
  const interactionDataset = useDataset();
  const hierarchyDataset = useDataset();
  const dependencyDataset = useDataset();
  const memoryDataset = useDataset();
  const bundleDataset = useDataset();
  const stressDataset = useDataset();
  // const sortDataset = useDataset();
  const [activeId, setActiveId] = useState('initial-load');

  const datasets = {
    'initial-load': initialLoadDataset,
    // filter: scrollDataset,
    interaction: interactionDataset,
    hierarchy: hierarchyDataset,
    dependency: dependencyDataset,
    memory: memoryDataset,
    bundle: bundleDataset,
    stress: stressDataset
    // sort: sortDataset
  };
  const dataset = datasets[activeId] || initialLoadDataset;

  const PageComponent = PAGE_MAP[activeId] || InitialLoadPage;
  const page =
    activeId === 'landing' ? (
      <PageComponent
        dataset={dataset}
        onSelect={setActiveId}
        sections={SECTIONS}
      />
    ) : (
      <PageComponent dataset={dataset} />
    );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navigation activeId={activeId} onSelect={setActiveId} />
      <main>
        <Suspense fallback={<PageFallback />}>{page}</Suspense>
      </main>
    </div>
  );
}