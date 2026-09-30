import React, { useState } from 'react';
import Navigation, { SECTIONS } from './bench/Navigation';
import useDataset from './bench/useDataset';
import LandingPage from './bench/LandingPage';
import InitialLoadPage from './bench/InitialLoadPage';
import ScrollPage from './bench/ScrollPage';
import InteractionLatencyPage from './bench/InteractionLatencyPage';
import HierarchyPage from './bench/HierarchyPage';
import DependencyPage from './bench/DependencyPage';
import MemoryPage from './bench/MemoryPage';
import BundlePage from './bench/BundlePage';
import StressPage from './bench/StressPage';

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
      <PageComponent dataset={dataset} />
    );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navigation activeId={activeId} onSelect={setActiveId} />
      <main>{page}</main>
    </div>
  );
}
