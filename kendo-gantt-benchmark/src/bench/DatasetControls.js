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
  presets = ['load1000', 'load25000', 'load50000', 'load100000'],
  showRefresh = true
}) {
  const labelMap = {
    load1000: '1K Tasks',
    load5000: '5K Tasks',
    load10000: '10K Tasks',
    load25000: '2.5K Tasks',
    load50000: '5K Tasks',
    load100000: '10K Tasks',
    load200000: '200K Tasks',
    load500000: '500K Tasks'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {presets.map((key) => (
          <button
            key={key}
            onClick={loaders[key]}
            disabled={isLoading}
          >
            {labelMap[key]}
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