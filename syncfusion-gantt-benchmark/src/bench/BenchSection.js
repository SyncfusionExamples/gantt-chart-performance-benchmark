import React from 'react';
import DatasetControls from './DatasetControls';

// Layout shell used by every benchmark page. Renders the top-level heading,
// the dataset controls strip and page-specific actions / summary / footer /
// children. Each page is responsible for rendering its own `<GanttComponent>`
// markup (inline as required by the project convention) and typically passes
// it via the `children` slot below.
export default function BenchSection({
  title,
  description,
  dataset,
  presets,
  toolbar,
  summary,
  actions,
  footer,
  showRefresh = true,
  showControls = true,
  labelSuffix = 'Tasks',
  onPresetClick,
  children
}) {
  return (
    <section style={{ padding: '15px' }}>
      {title && <h3>{title}</h3>}
      {description && (
        <p style={{ fontSize: '14px', color: '#475569', marginTop: 0 }}>
          {description}
        </p>
      )}

      {showControls && (
        <DatasetControls
          loaders={dataset.loaders}
          refreshData={dataset.refreshData}
          clearData={dataset.clearData}
          isLoading={dataset.isLoading}
          currentSize={dataset.currentSize}
          showRefresh={showRefresh}
          presets={presets}
          labelSuffix={labelSuffix}
          onPresetClick={onPresetClick}
        />
      )}

      {showControls && toolbar && <div style={{ marginTop: '10px' }}>{toolbar}</div>}
      {actions && (
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
      {summary && <div style={{ marginTop: '8px' }}>{summary}</div>}

      {children}

      {footer && (
        <div style={{ marginTop: '8px', fontSize: '13px', color: '#475569' }}>
          {footer}
        </div>
      )}
    </section>
  );
}