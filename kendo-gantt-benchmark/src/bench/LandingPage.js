import React from 'react';
import DatasetControls from './DatasetControls';

export default function LandingPage({ dataset, onSelect, sections }) {
  const { loaders, refreshData, clearData, isLoading, currentSize } = dataset;
  return (
    <section style={{ padding: '15px' }}>
      <h3>Pick a benchmark section</h3>
      <p>
        The same dataset and Kendo Gantt drive every page. Choose a size,
        then jump into one of the benchmark areas:
      </p>
      <ul style={{ columns: 2, listStyle: 'none', padding: 0 }}>
        {sections.map((s) => (
          <li key={s.id} style={{ marginBottom: '6px' }}>
            <button
              onClick={() => onSelect(s.id)}
              style={{
                background: 'transparent',
                border: '1px solid #cbd5f5',
                padding: '6px 10px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
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