import React, { useState, Suspense } from 'react';
import Navigation, { SECTIONS } from './bench/Navigation';
import useDataset from './bench/useDataset';
// dhtmlx-react-gantt ships its own theme CSS — imported once at the
// application root so every page can render the Gantt without
// duplicating the import.
import '@dhtmlx/trial-react-gantt/dist/react-gantt.css';

// Lazy-load every benchmark page so each appears as its own code-split chunk.
// The webpackChunkName magic comment tells Webpack to name the chunk after
// the page, which makes it easy to identify per-page bundle sizes in the
// bundle analyzer output.
const LandingPage = React.lazy(() =>
  import(/* webpackChunkName: "page-landing" */ './bench/LandingPage.lazy')
);

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

// Reusable loading fallback shown while a lazy chunk is being fetched.
const PageLoader = ({ label = 'Loading…' }) => (
  <div
    style={{
      padding: '40px 20px',
      textAlign: 'center',
      color: '#64748b',
      fontSize: '14px'
    }}
  >
    <div
      style={{
        display: 'inline-block',
        width: '24px',
        height: '24px',
        border: '3px solid #cbd5e1',
        borderTopColor: '#0ea5e9',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        marginRight: '10px',
        verticalAlign: 'middle'
      }}
    />
    <span>{label}</span>
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

  // Pick a friendly loading label per page so the user knows what's
  // being fetched. The fallback is otherwise generic.
  const loaderLabel =
    {
      landing: 'Loading landing page…',
      'initial-load': 'Loading initial-load benchmark…',
      scroll: 'Loading scroll benchmark…',
      interaction: 'Loading interaction-latency benchmark…',
      hierarchy: 'Loading hierarchy benchmark…',
      dependency: 'Loading dependency benchmark…',
      memory: 'Loading memory benchmark…',
      bundle: 'Loading bundle analysis dashboard…',
      stress: 'Loading stress test…'
    }[activeId] || 'Loading…';

  // Landing page receives extra props; every other page just receives the
  // dataset object. We always wrap in Suspense so React.lazy() can resolve.
  const page = (
    <Suspense fallback={<PageLoader label={loaderLabel} />}>
      {activeId === 'landing' ? (
        <PageComponent
          dataset={dataset}
          onSelect={setActiveId}
          sections={SECTIONS}
        />
      ) : (
        <PageComponent dataset={dataset} />
      )}
    </Suspense>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <Navigation activeId={activeId} onSelect={setActiveId} />
      <main>{page}</main>
    </div>
  );
}