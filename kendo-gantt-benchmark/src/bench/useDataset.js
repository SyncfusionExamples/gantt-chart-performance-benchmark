import { useState, useRef } from 'react';

// Drop-in replacement for the data-loader that lived in App.js. Returns the
// same shape (ganttRef, dataSource, isLoading, currentSize, loaders, ...)
// so benchmark pages can drive the Gantt without re-implementing the chunked
// rAF pipeline.
//
// Render-time measurement mirrors Syncfusion's remote-data demo:
//   - `startLoadTime` is captured synchronously *before* the data write
//   - the timer is closed from each page's inline GanttComponent `dataBound`
//     handler via `measureRender`, with a single-shot guard so
//     sub-operations on the chart (sort, filter, ...) don't reset it.
export default function useDataset() {
  const ganttRef = useRef(null);
  const dataIdRef = useRef(0);
  const dataVersionRef = useRef(0);
  // Synchronous high-resolution timer set the moment the loader fires.
  // We capture it here (not in a useEffect) so the wall clock includes
  // commits + render, exactly like Syncfusion's remote-data demo.
  const renderStartRef = useRef(null);
  const measureEnabledRef = useRef(false);

  const [dataSource, setDataSource] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSize, setCurrentSize] = useState(0);
  const [renderSeconds, setRenderSeconds] = useState(null);
  const [, forceRender] = useState(0);

  const generateDataAsync = (
    parentCount,
    childCount,
    maxDepth = 1,
    includePredecessor = true,
    dateByGroup = false,
    chainGroups = false,
    commonDate = false,
    chainDates = false
  ) => {
    setIsLoading(true);
    const version = ++dataVersionRef.current;

    // Start the render timer *before* every async work so the delta
    // covers data construction + commit + paint.
    renderStartRef.current = performance.now();
    measureEnabledRef.current = true;
    setRenderSeconds(null);

    // Clear immediately so the Gantt releases its previous rows.
    setDataSource([]);

    const rand = () => 0;
    const effectiveChildCount = Math.max(1, childCount || 50);
    const total = parentCount * (1 + effectiveChildCount);
    const chunkSize = total > 60000 ? 4000 : 2000;

    const result = new Array(total);
    let idx = 0;
    let id = 0;

    const fillChunk = () => {
      if (version !== dataVersionRef.current) return;

      const end = Math.min(idx + chunkSize, total);

      for (; idx < end; idx++) {
        const groupIndex = Math.floor(idx / (effectiveChildCount + 1));
        const childIndex = idx % (effectiveChildCount + 1);

        if (childIndex === 0) {
          const parentId = ++id;
          const groupStartDate = new Date(2017, 0, 1 + groupIndex * 10);
          const parentEnd = new Date(groupStartDate);
          parentEnd.setDate(parentEnd.getDate() + 245);
          result[idx] = {
            ID: parentId,
            TaskName: 'Task ' + parentId,
            StartDate: groupStartDate,
            EndDate: parentEnd,
            Duration: '245',
            Progress: rand(),
            ParentId: null,
            Predecessor: ''
          };
          continue;
        }

        const parentId = groupIndex * (effectiveChildCount + 1) + 1;
        const childId = ++id;
        const groupStartDate = new Date(2017, 0, 1 + groupIndex * 10);
        const childStart = new Date(groupStartDate);
        childStart.setDate(groupStartDate.getDate() + (childIndex - 1) * 5);
        const childEnd = new Date(childStart);
        childEnd.setDate(childEnd.getDate() + 5);

        result[idx] = {
          ID: childId,
          TaskName: 'Task ' + childId,
          StartDate: childStart,
          EndDate: childEnd,
          Duration: '5',
          Progress: rand(),
          ParentId: parentId,
          Predecessor: childIndex > 1 ? (childId - 1).toString() : ''
        };
      }

      if (idx < total) {
        requestAnimationFrame(fillChunk);
      } else {
        dataIdRef.current = id;
        setDataSource(result);
        setCurrentSize(result.length);
        setIsLoading(false);
        forceRender((v) => v + 1);
      }
    };

    setTimeout(fillChunk, 0);
  };

  const load1000 = () => generateDataAsync(20, 50);
  const load100 = () => generateDataAsync(10, 10, 5, false, true);
  const load2000 = () => generateDataAsync(40, 50, 5, false, true);
  const load2500 = () => generateDataAsync(50, 50);
  const load5000 = () => generateDataAsync(100, 50, 5, false, true);
  const loadDependency5000 = () => generateDataAsync(100, 50, 1, true, false, false, false, true);
  const load10000 = () => generateDataAsync(196, 50);
  const load25000 = () => generateDataAsync(490, 50);
  const load75000 = () => generateDataAsync(1470, 50);
  const load80000 = () => generateDataAsync(1568, 50);
  const loadHierarchy5000 = () => generateDataAsync(100, 50, 10, false, true);
  const load50000 = () => generateDataAsync(980, 50);
  const load100000 = () => generateDataAsync(1960, 50);
  const load200000 = () => generateDataAsync(3920, 50);
  const load500000 = () => generateDataAsync(9800, 50);

  const refreshData = () => {
    if (currentSize === 10000) load50000();
    else if (currentSize === 50000) load100000();
    else if (currentSize === 100000) load200000();
    else if (currentSize === 200000) load500000();
    else load10000();
  };

  const clearData = () => {
    dataVersionRef.current++;
    measureEnabledRef.current = false;
    renderStartRef.current = null;
    setDataSource([]);
    setCurrentSize(0);
    setRenderSeconds(null);
  };

  // Wired into each page's inline GanttComponent `dataBound`. Same flag-and-
  // reset pattern Syncfusion uses so only the *first* paint after a load
  // counts.
  const measureRender = () => {
    if (!measureEnabledRef.current || renderStartRef.current === null) return;
    const deltaSeconds = (performance.now() - renderStartRef.current) / 1000;
    measureEnabledRef.current = false;
    renderStartRef.current = null;
    setRenderSeconds(Math.round(deltaSeconds * 1000) / 1000);
  };

  return {
    ganttRef,
    dataSource,
    isLoading,
    currentSize,
    renderSeconds,
    measureRender,
    loaders: {
      load100,
      load1000,
      load2000,
      load2500,
      load5000,
      loadDependency5000,
      load10000,
      load25000,
      load75000,
      load80000,
      loadHierarchy5000,
      load50000,
      load100000,
      load200000,
      load500000
    },
    refreshData,
    clearData
  };
}