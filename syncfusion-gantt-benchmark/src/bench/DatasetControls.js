import React from 'react';

// Shared toolbar rendered above the Gantt on every section. Each page decides
// which preset buttons make sense (e.g. Stress Test exposes larger sizes),
// but the visual treatment is identical.
export default function DatasetControls({
  loaders,
  refreshData,
  clearData,
  isLoading,
  currentSize,
  presets = ['load10000', 'load50000', 'load100000'],
  showRefresh = true,
  labelSuffix = 'Tasks',
  onPresetClick
}) {
  const labelMap = {
    load5000: '5K Tasks',
    loadDependency5000: '5K Tasks',
    loadDependency10000: '10K Tasks',
    loadDependency25000: '25K Tasks',
    loadDependency50000: '50K Tasks',
    loadHierarchy5000: '5K Tasks',
    loadHierarchy10000: '10K Tasks',
    loadHierarchy25000: '25K Tasks',
    loadHierarchy50000: '50K Tasks',
    load10000: '10K Tasks',
    load25000: '25K Tasks',
    load50000: '50K Tasks',
    load100000: '100K Tasks',
    load200000: '2L Tasks',
    load300000: '3L Tasks',
    load400000: '4L Tasks',
    load500000: '5L Tasks',
    load1000000: '10L Tasks'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {presets.map((key) => (
          <button
            key={key}
            onClick={() => {
              if (onPresetClick) onPresetClick();
              loaders[key]();
            }}
            disabled={isLoading}
          >
            {labelMap[key]?.replace('Tasks', labelSuffix)}
          </button>
        ))}
        {showRefresh && (
          <button onClick={refreshData} disabled={isLoading}>Refresh</button>
        )}
        <button onClick={clearData} disabled={isLoading}>Clear data</button>
      </div>
      <div>
        Current records: <b>{currentSize}</b>
        {isLoading && (
          <span style={{ marginLeft: '10px' }}>Loading...</span>
        )}
      </div>
    </div>
  );
}