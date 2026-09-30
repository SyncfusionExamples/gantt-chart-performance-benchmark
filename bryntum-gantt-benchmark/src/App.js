import React, { Suspense, useState } from 'react';
import Navigation, { SECTIONS } from './bench/Navigation';
import useDataset from './bench/useDataset';
// LandingPage stays eager — the rest of the app needs it on first paint and
// it has no large deps to defer.
import LandingPage from './bench/LandingPage';

// Every other benchmark page is code-split via React.lazy(). Each `*.lazy.js`
// file is a 1-line re-export; the `webpackChunkName` magic comment gives the
// emitted chunk a stable, human-readable name (`page-<id>.<hash>.chunk.js`)
// so `scripts/generateBundleStats.js` can attribute it back to the page.
//
// Without the magic comment CRA auto-numbers the chunk (`109.<hash>.chunk.js`)
// and it would show up under "shared" instead of in the per-page table.
const InitialLoadPage = React.lazy(() =>
  import(/* webpackChunkName: "page-initial-load" */ './bench/InitialLoadPage.lazy')
);
const ScrollPage = React.lazy(() =>
  import(/* webpackChunkName: "page-scroll" */ './bench/ScrollPage.lazy')
);
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
  scroll: ScrollPage,
  interaction: InteractionLatencyPage,
  hierarchy: HierarchyPage,
  dependency: DependencyPage,
  memory: MemoryPage,
  bundle: BundlePage,
  stress: StressPage
};

export default function App() {
  const initialLoadDataset = useDataset();
  const scrollDataset = useDataset();
  const interactionDataset = useDataset();
  const hierarchyDataset = useDataset();
  const dependencyDataset = useDataset();
  const memoryDataset = useDataset();
  const bundleDataset = useDataset();
  const stressDataset = useDataset();
  const [activeId, setActiveId] = useState('initial-load');

  const datasets = {
    'initial-load': initialLoadDataset,
    scroll: scrollDataset,
    interaction: interactionDataset,
    hierarchy: hierarchyDataset,
    dependency: dependencyDataset,
    memory: memoryDataset,
    bundle: bundleDataset,
    stress: stressDataset
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
      <Suspense fallback={<div style={{ padding: 20 }}>Loading…</div>}>
        <PageComponent dataset={dataset} />
      </Suspense>
    );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navigation activeId={activeId} onSelect={setActiveId} />
      <main>{page}</main>
    </div>
  );
}