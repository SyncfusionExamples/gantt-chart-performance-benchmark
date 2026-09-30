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

    const rand = () => Math.floor(Math.random() * 100);
    const total = parentCount * (1 + childCount);
    const chunkSize = total > 60000 ? 4000 : 2000;

    const result = new Array(total);
    let idx = 0;
    // Always start the visible id at 1 for a fresh load so the TaskName
    // column reads "Task 1", "Task 2", … regardless of previous runs.
    let id = 0;
    let groupRootId = null;
    let groupStartDate = null;
    const levelIds = [];
    const taskDates = new Map();

    const fillChunk = () => {
      if (version !== dataVersionRef.current) return;

      const end = Math.min(idx + chunkSize, total);

      for (; idx < end; idx++) {
        const childIndex = idx % (childCount + 1);
        const groupIndex = Math.floor(idx / (childCount + 1));
        if (childIndex === 0) {
          const parentId = ++id;
          groupStartDate = dateByGroup || commonDate || chainDates
            ? new Date(2017, 1, 9 + (
              commonDate
                ? 0
                : (chainDates ? groupIndex * 5 : groupIndex * (maxDepth + 1))
            ))
            : null;
          groupRootId = parentId;
          levelIds.length = 0;
          levelIds.push([parentId]);
          taskDates.set(parentId, groupStartDate);
          result[idx] = {
            ID: parentId,
            TaskName: 'Task ' + parentId,
            StartDate: groupStartDate || new Date(2017, 1, 9),
            Duration: '5',
            Progress: rand(),
            ParentId: null,
            Predecessor: includePredecessor && chainGroups && groupIndex > 0
              ? (parentId - (childCount + 1)).toString()
              : ''
          };
        } else {
          const childId = ++id;
          const depth = maxDepth === 1
            ? 1
            : Math.min(maxDepth, Math.ceil((childIndex * maxDepth) / childCount));
          const parentIds = levelIds[depth - 1];
          const parentId = maxDepth === 1
            ? groupRootId
            : parentIds[(childIndex - 1) % parentIds.length];
          const taskDate = (dateByGroup || commonDate || chainDates) && depth < maxDepth
            ? new Date(
              groupStartDate.getFullYear(),
              groupStartDate.getMonth(),
              groupStartDate.getDate() + depth
            )
            : (dateByGroup || commonDate || chainDates ? taskDates.get(parentId) : null);

          if (!levelIds[depth]) levelIds[depth] = [];
          levelIds[depth].push(childId);
          taskDates.set(childId, taskDate);
          result[idx] = {
            ID: childId,
            TaskName: 'Task ' + childId,
            StartDate: taskDate || new Date(2017, 1, 7),
            Duration: '5',
            Progress: rand(),
            ParentId: parentId,
            Predecessor: includePredecessor ? (childId - 1).toString() : ''
          };
        }
      }

      if (idx < total) {
        requestAnimationFrame(fillChunk);
      } else {
        // Persist the highest id we produced so downstream refreshes keep
        // continuity if needed later, but generateDataAsync always restarts
        // fresh from 1 for *this* dataset.
        dataIdRef.current = id;
        setDataSource(result);
        setCurrentSize(result.length);
        setIsLoading(false);
        forceRender((v) => v + 1);
      }
    };

    setTimeout(fillChunk, 0);
  };

  const load5000 = () => generateDataAsync(100, 49);
  const loadDependency = (targetRecords) => (
    generateDataAsync(targetRecords / 50, 49, 1, true, false, false, false, true)
  );
  const loadDependency2500 = () => loadDependency(2500);
  const loadDependency5000 = () => loadDependency(5000);
  const loadDependency10000 = () => loadDependency(10000);
  const loadDependency25000 = () => loadDependency(25000);
  const loadDependency50000 = () => loadDependency(50000);
  const load10000 = () => generateDataAsync(200, 49);
  const load25000 = () => generateDataAsync(500, 49);
  const load75000 = () => generateDataAsync(1500, 49);
  const load80000 = () => generateDataAsync(1600, 49);
  const loadHierarchy5000 = () => generateDataAsync(100, 49, 10, false, true);
  const load50000 = () => generateDataAsync(1000, 49);
  const load100000 = () => generateDataAsync(2000, 49);
  const load200000 = () => generateDataAsync(4000, 49);
  const load300000 = () => generateDataAsync(6000, 49);
  const load400000 = () => generateDataAsync(8000, 49);
  const load500000 = () => generateDataAsync(10000, 49);
  const load1000000 = () => generateDataAsync(20000, 49);

  // Build a strictly-chained, repeating hierarchy. The dataset is split
  // into consecutive groups of `depth` records; inside each group record
  // k is the child of record (k-1) in the same group, and the first record
  // of every group has no parent (so a new chain starts). This produces
  // chains like:
  //
  //   1 -> 2 -> 3 -> 4 -> 5
  //   6 -> 7 -> 8 -> 9 -> 10
  //   11 -> 12 -> 13 -> 14 -> 15
  //   ...
  //
  // Total rows = ceil(targetRecords / depth) * depth, so 25K / 5 lands
  // exactly on 25,000 and 100K / 10 lands exactly on 100,000.
  const loadHierarchy = (targetRecords, depth) => {
    if (depth < 2) depth = 2;
    setIsLoading(true);
    const version = ++dataVersionRef.current;
    renderStartRef.current = performance.now();
    measureEnabledRef.current = true;
    setRenderSeconds(null);
    setDataSource([]);

    const rand = () => Math.floor(Math.random() * 100);
    const projectStart = new Date(2017, 1, 9);
    // Each chain spans 2 years; deeper chains are still distinguishable.
    const projectDays = 730;

    const total = Math.ceil(targetRecords / depth) * depth;
    const result = new Array(total);
    const chunkSize = total > 60000 ? 4000 : 2000;

    // Build the dataset lazily inside rAF chunks so the UI thread stays
    // responsive even at 100K rows.
    const fillChunk = () => {
      if (version !== dataVersionRef.current) return;
      const end = Math.min(idx + chunkSize, total);

      while (idx < end) {
        const position = idx; // 0-based row position in the dataset
        const level = position % depth; // 0 = chain start, depth-1 = leaf
        const newId = position + 1; // 1-based id
        // Parent is the immediately-preceding row, unless this row starts
        // a new chain (level === 0).
        const parentId = level === 0 ? null : newId - 1;

        // Anchor each row to the chain root's start (so a collapsed chain
        // still shows a single visible band) and add a per-level offset
        // so deeper rows sit slightly later on the timeline.
        const chainStartDay = Math.floor(position / depth);
        const stride = Math.max(1, Math.floor(projectDays / Math.max(Math.ceil(total / depth), 1)));
        const dayOffset = Math.min(chainStartDay * stride, projectDays - 1) + level;
        const startDate = new Date(
          projectStart.getFullYear(),
          projectStart.getMonth(),
          projectStart.getDate() + dayOffset
        );

        // Sibling predecessor: link each child to its parent with FS+1d so
        // the Gantt's dependency engine has a chain to walk inside every
        // hierarchy.
        const predecessor = parentId === null ? '' : `${parentId}FS+1d`;

        const duration = String(2 + ((newId * 7) % 11)); // 2-12 day tasks

        result[idx] = {
          ID: newId,
          TaskName: `Task ${newId}`,
          StartDate: startDate,
          Duration: duration,
          Progress: rand(),
          ParentId: parentId,
          Predecessor: predecessor
        };
        idx += 1;
      }

      if (idx < total) {
        requestAnimationFrame(fillChunk);
      } else {
        dataIdRef.current = total;
        setDataSource(result);
        setCurrentSize(result.length);
        setIsLoading(false);
        forceRender((v) => v + 1);
      }
    };

    let idx = 0;
    setTimeout(fillChunk, 0);
  };

  const loadHierarchy10000 = () => loadHierarchy(10000, 10);
  const loadHierarchy25000 = () => loadHierarchy(25000, 10);
  const loadHierarchy50000 = () => loadHierarchy(50000, 10);

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
      load5000,
      loadDependency,
      loadDependency2500,
      loadDependency5000,
      loadDependency10000,
      loadDependency25000,
      loadDependency50000,
      load10000,
      load25000,
      load75000,
      load80000,
      loadHierarchy5000,
      loadHierarchy10000,
      loadHierarchy25000,
      loadHierarchy50000,
      loadHierarchy,
      load50000,
      load100000,
      load200000,
      load300000,
      load400000,
      load500000,
      load1000000
    },
    refreshData,
    clearData
  };
}