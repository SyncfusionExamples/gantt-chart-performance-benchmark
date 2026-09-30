import React from 'react';
import DatasetControls from './DatasetControls';

// Tiny landing state shown when the dataset hasn't been populated yet. Mirrors
// the empty-state styling the original App had so the navigation header
// always has something to sit above.
export default function LandingPage({ dataset, onSelect, sections }) {
  const { loaders, refreshData, clearData, isLoading, currentSize } = dataset;
  return (
    <section style={{ padding: '15px' }}>
      <h3>Pick a benchmark section</h3>
      <p>
        The same dataset and DHTMLX Gantt drive every page. Choose a size,
        then jump into one of the seven probe areas:
      </p>
      <ul style={{ columns: 2, listStyle: 'none', padding: 0 }}>
        {sections.map((s) => (
          <li key={s.id} style={{ marginBottom: '6px' }}>
            <button onClick={() => onSelect(s.id)}>
              <b>{s.label}</b> — <span style={{ color: '#475569' }}>{s.detail}</span>
            </button>
          </li>
        ))}
      </ul>
      <DatasetControls
        loaders={loaders}
        refreshData={refreshData}
        clearData={clearData}
        isLoading={isLoading}
        currentSize={currentSize}
      />
    </section>
  );
}