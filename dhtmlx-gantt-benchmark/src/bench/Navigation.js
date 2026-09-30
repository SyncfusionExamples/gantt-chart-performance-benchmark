import React from 'react';

const SECTIONS = [
  { id: 'initial-load', label: 'Initial Load', detail: 'Render time & time-to-interactive' },
  { id: 'scroll', label: 'Scrolling', detail: 'Scroll performance' },
  { id: 'interaction', label: 'Interaction Latency', detail: 'Click/select/hover response time' },
  { id: 'hierarchy', label: 'Hierarchy', detail: 'Expand / collapse latency' },
  { id: 'dependency', label: 'Dependency', detail: 'Critical-path recalculation' },
  { id: 'memory', label: 'Memory', detail: 'Heap usage across dataset sizes' },
  { id: 'bundle', label: 'Bundle Size', detail: 'Static asset weight breakdown' },
  { id: 'stress', label: 'Stress Test', detail: 'Breaking-point discovery' }
];

export default function Navigation({ activeId, onSelect }) {
  return (
    <nav
      data-testid="bench-nav"
      style={{
        background: '#0f172a',
        color: '#e2e8f0',
        padding: '12px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.18)'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <strong style={{ fontSize: '16px' }}>DHTMLX Gantt Benchmark</strong>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
          Performance suite
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginLeft: 'auto'
        }}
      >
        {SECTIONS.map((s) => {
          const isActive = s.id === activeId;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              title={s.detail}
              style={{
                background: isActive ? '#2563eb' : 'transparent',
                color: isActive ? '#ffffff' : '#cbd5f5',
                border: '1px solid ' + (isActive ? '#2563eb' : '#334155'),
                fontWeight: isActive ? 600 : 400,
                boxShadow: 'none'
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { SECTIONS };