import React, { useEffect, useMemo, useRef, useState } from 'react';
import BenchSection from './BenchSection';
import BenchmarkGantt from './BenchmarkGantt';

const MAX_DEPTH = 10;
const computeHierarchyInfo = (records) => {
  const parentById = new Map(records.map((record) => [record.ID, record.ParentId]));
  const counts = new Array(MAX_DEPTH + 1).fill(0);

  records.forEach((record) => {
    let depth = 0;
    let parentId = record.ParentId;
    while (parentId !== null && parentId !== undefined) {
      depth += 1;
      parentId = parentById.get(parentId);
    }
    counts[Math.min(depth, MAX_DEPTH)] += 1;
  });

  return {
    topLevelParents: counts[0],
    populatedLevels: counts.filter((count) => count > 0).length
  };
};

export default function HierarchyPage({ dataset }) {
  const { ganttRef, dataSource, currentSize } = dataset;
  const [expandMs, setExpandMs] = useState(null);
  const [collapseMs, setCollapseMs] = useState(null);
  const expandStartRef = useRef(null);
  const collapseStartRef = useRef(null);

  useEffect(() => {
    setExpandMs(null);
    setCollapseMs(null);
  }, [dataSource]);

  const hierarchyInfo = useMemo(
    () => computeHierarchyInfo(dataSource),
    [dataSource]
  );

  const handleDataBound = () => {
    if (typeof dataset.measureRender === 'function') dataset.measureRender();
  };

  // Bryntum's tree events ship the affected record + a `collapse` flag
  // (true = about to collapse, false = about to expand). The previous
  // implementation assumed a `node` object with an `isExpanded` field,
  // which threw `Cannot read properties of undefined (reading
  // 'isExpanded')` because the payload is `{ source, record, collapse }`.
  const handleBeforeToggleNode = ({ collapse }) => {
    if (collapse) collapseStartRef.current = performance.now();
    else expandStartRef.current = performance.now();
  };

  const handleToggleNode = ({ collapse }) => {
    if (collapse) {
      if (collapseStartRef.current === null) return;
      setCollapseMs(performance.now() - collapseStartRef.current);
      collapseStartRef.current = null;
    } else {
      if (expandStartRef.current === null) return;
      setExpandMs(performance.now() - expandStartRef.current);
      expandStartRef.current = null;
    }
  };

  // Time the entire `gantt.expandAll()` / `gantt.collapseAll()` cycle.
  // Bryntum exposes these on the Gantt instance directly, so we don't
  // need to walk the tree ourselves — the same code path is used by
  // the toolbar buttons shipped with the Gantt.
  const handleExpandAll = () => {
    const gantt = ganttRef.current?.instance;
    if (!gantt) return;
    expandStartRef.current = performance.now();
    const result = gantt.expandAll();
    if (result && typeof result.then === 'function') {
      result.then(() => {
        if (expandStartRef.current === null) return;
        setExpandMs(performance.now() - expandStartRef.current);
        expandStartRef.current = null;
      });
    } else {
      setExpandMs(performance.now() - expandStartRef.current);
      expandStartRef.current = null;
    }
  };

  const handleCollapseAll = () => {
    const gantt = ganttRef.current?.instance;
    if (!gantt) return;
    collapseStartRef.current = performance.now();
    const result = gantt.collapseAll();
    if (result && typeof result.then === 'function') {
      result.then(() => {
        if (collapseStartRef.current === null) return;
        setCollapseMs(performance.now() - collapseStartRef.current);
        collapseStartRef.current = null;
      });
    } else {
      setCollapseMs(performance.now() - collapseStartRef.current);
      collapseStartRef.current = null;
    }
  };

  // Build the Bryntum-native `tbar` config. The two buttons mirror the
  // toolbar items shown in the Bryntum Advanced demo: expand-all /
  // collapse-all using double-angle FA icons. They invoke the same
  // methods Bryntum itself exposes (`gantt.expandAll` /
  // `gantt.collapseAll`).
  const tbar = [
    {
      type: 'button',
      ref: 'expandAll',
      icon: 'b-fa b-fa-angle-double-down',
      text: 'Expand all',
      tooltip: 'Expand all',
      onAction: handleExpandAll
    },
    {
      type: 'button',
      ref: 'collapseAll',
      icon: 'b-fa b-fa-angle-double-up',
      text: 'Collapse all',
      tooltip: 'Collapse all',
      onAction: handleCollapseAll
    }
  ];

  return (
    <BenchSection
      dataset={dataset}
      title="Hierarchy — Expand / Collapse latency"
      presets={[
        'loadHierarchy5000',
        'loadHierarchy10000',
        'loadHierarchy25000',
        'loadHierarchy50000'
      ]}
      summary={
        <div
          data-testid="hierarchy-report"
          style={{ fontSize: '13px', color: '#475569' }}
        >
          <div>
            Dataset: <b>{currentSize.toLocaleString()}</b> records
            {' | '}
            <b>{hierarchyInfo.topLevelParents}</b> top-level parents
            {' | '}
            Levels 0–{MAX_DEPTH} (<b>{hierarchyInfo.populatedLevels}</b> populated)
          </div>
          <div>
            Expand all:{' '}
            <b>
              {expandMs === null ? '—' : `${expandMs.toFixed(2)} ms`}
            </b>
            {' | '}
            Collapse all:{' '}
            <b>
              {collapseMs === null ? '—' : `${collapseMs.toFixed(2)} ms`}
            </b>
          </div>
        </div>
      }
    >
      {dataSource.length > 0 && (
        <BenchmarkGantt
          ganttRef={ganttRef}
          id="hierarchy-gantt"
          dataSource={dataSource}
          tbar={tbar}
          listeners={{
            paint: handleDataBound,
            beforeToggleNode: handleBeforeToggleNode,
            toggleNode: handleToggleNode
          }}
        />
      )}
    </BenchSection>
  );
}
