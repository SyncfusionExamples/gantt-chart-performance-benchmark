import { useState, useRef } from 'react';

// Drop-in replacement for the data-loader that lived in App.js. Returns the
// same shape (ganttRef, dataSource, isLoading, currentSize, loaders, ...)
// so benchmark pages can drive the Gantt without re-implementing the chunked
// rAF pipeline.
//
// Render-time measurement starts before data generation and ends on Bryntum's
// first paint after the new task set is applied:
//   - `startLoadTime` is captured synchronously *before* the data write
//   - the timer is closed from each page's Bryntum `paint` listener
//     handler via `measureRender`, with a single-shot guard so
//     sub-operations on the chart (sort, filter, ...) don't reset it.
export default function useDataset() {
  const ganttRef = useRef(null);
  const dataIdRef = useRef(0);
  const dataVersionRef = useRef(0);
  // Synchronous high-resolution timer set the moment the loader fires.
  // We capture it here (not in a useEffect) so the wall clock includes
  // commits + render.
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
  // -------------------------------------------------------------------------
  // 2,500-record dataset for the Dependency / Critical-Path benchmark.
  // Built by hand (not via `generateDataAsync`) because we need fine
  // control over the cascade offset and the child chain shape to
  // match the Syncfusion reference sample:
  //
  //   * 50 parent groups × 50 records/group = 2,500 records.
  //   * Each parent row cascades 3 days after the previous one
  //     (Feb 9, Feb 12, Feb 15, Feb 18, Feb 22, …) for the row's
  //     StartDate cell.
  //   * Parent dates and duration roll up automatically from their children.
  //   * Inside every group, 49 children form an EndToStart chain
  //     (child i depends on child i-1). Children are 5 days each
  //     EXCEPT the last group, whose children are 6 days each —
  //     that makes the last group's chain 49 × 6 = 294 days,
  //     strictly longer than every other group's 49 × 5 = 245
  //     days. No cross-group edges, so each chain is independent.
  //     Bryntum's `criticalPaths` therefore picks the *last*
  //     group's chain as the project's unique longest path, and
  //     the last parent lights up as the critical-path bar. The
  //     6-day duration keeps the project end close to the rest
  //     of the cascade.
  // -------------------------------------------------------------------------
  const loadDependency = (parentCount) => {
    setIsLoading(true);
    const version = ++dataVersionRef.current;

    // Start the render timer the same way the generic loader does, so
    // the dependency page's InitialLoadPage-style listener can close
    // it from the project's `dataReady` event.
    renderStartRef.current = performance.now();
    measureEnabledRef.current = true;
    setRenderSeconds(null);
    setDataSource([]);

    const childCount = 49;
    const total = parentCount * (1 + childCount);
    const result = new Array(total);
    const rand = () => Math.floor(Math.random() * 100);

    // Pre-compute the parent ids so the child rows can reference them
    // explicitly. Parent 0 → id 1, parent 1 → id 51, …, parent 49 →
    // id 2451.
    const parentIds = Array.from({ length: parentCount }, (_, k) => k * 50 + 1);

    for (let k = 0; k < parentCount; k++) {
      const parentId = parentIds[k];
      // Cascade by 3 days so visible rows fan out across the
      // timeline (Feb 9, Feb 12, Feb 15, Feb 18, Feb 22, …).
      const parentStart = new Date(2017, 1, 9 + k * 3);
      const baseIdx = k * (1 + childCount);
      result[baseIdx] = {
        ID: parentId,
        TaskName: `Task ${parentId}`,
        StartDate: parentStart,
        Progress: rand(),
        ParentId: null,
        Predecessor: ''
      };

      // Children: 49 tasks forming an EndToStart chain inside the
      // group. Every child is 5 days long (matches the original
      // `loadDependency5000` shape the user wants back); the
      // sibling chain is i → predecessor (childId - 1) so a change
      // to any one child's date re-schedules everything after it.
      //
      // The *last* group's children are 6 days each instead of 5,
      // so its 49-step chain is 49 × 6 = 294 days — strictly
      // longer than every other group's 49 × 5 = 245-day chain.
      // With no cross-group edge between groups, that makes the
      // last group's chain the project's unique longest path, and
      // `criticalPaths` lights up the *last* parent (not the
      // first). The 6-day duration keeps the project end close
      // to the cascade — the last group only extends ~50 days
      // past the 245-day mark, not 245 days past it.
      const isLastGroup = k === parentCount - 1;
      const childDuration = isLastGroup ? 6 : 5;
      for (let i = 0; i < childCount; i++) {
        const childId = parentId + i + 1;
        const childStart = new Date(
          parentStart.getFullYear(),
          parentStart.getMonth(),
          parentStart.getDate() + i * 0.5
        );
        result[baseIdx + 1 + i] = {
          ID: childId,
          TaskName: `Task ${childId}`,
          StartDate: childStart,
          Duration: childDuration,
          Progress: rand(),
          ParentId: parentId,
          // Keep the first child as this group's date anchor. Later
          // children remain automatically scheduled by their predecessor.
          ...(i === 0 ? { manuallyScheduled: true } : {}),
          // Child i depends on child i-1 inside the same group;
          // child 0 has no predecessor so the first child of
          // every group starts at the parent's explicit start
          // date. No cross-group edge — each group's chain is
          // independent.
          Predecessor: i > 0 ? (childId - 1).toString() : ''
        };
      }
    }

    // Hand off through a rAF so the loading-state flip is visible
    // to the user (the dataset is small enough to apply in one tick).
    requestAnimationFrame(() => {
      if (version !== dataVersionRef.current) return;
      dataIdRef.current = parentIds[parentCount - 1] + childCount;
      setDataSource(result);
      setCurrentSize(result.length);
      setIsLoading(false);
      forceRender((v) => v + 1);
    });
  };
  const loadDependency5000 = () => loadDependency(100);
  const loadDependency10000 = () => loadDependency(200);
  const loadDependency25000 = () => loadDependency(500);
  const loadDependency50000 = () => loadDependency(1000);
  const load10000 = () => generateDataAsync(200, 49);
  const load25000 = () => generateDataAsync(500, 49);
  const load75000 = () => generateDataAsync(1500, 49);
  const load80000 = () => generateDataAsync(1600, 49);
  // -------------------------------------------------------------------------
  // Looped 5-level parent/child chain. Produces `target` records in a
  // strict repeating pattern of length `depth`, where the first record
  // of every cycle is a new Level-0 parent and each subsequent record
  // is a child of the previous one. With depth = 5 and target = 25,000
  // the dataset is exactly 5,000 parent chains, each 5 records deep:
  //
  //     1 → 2 → 3 → 4 → 5
  //     6 → 7 → 8 → 9 → 10
  //     11 → 12 → 13 → 14 → 15
  //     …
  //
  // The spec asks for "every 5th record = deepest child, every 6th
  // record = new parent". Those two are mutually exclusive — a 5-record
  // chain resets on record 6, and a 6-record chain puts record 5 one
  // level short of max depth. The example tree in the spec
  // (`1→2→3→4→5`, then `6→7→8→9→10`, then `11→…`) matches the
  // 5-record-cycle interpretation, so the implementation uses that
  // one. To switch to a 6-record cycle, change `CYCLE` to 6 — the
  // helper below is keyed off it and everything else follows.
  //
  // Suitable for the same suite the spec calls out: Gantt hierarchy,
  // expand/collapse, virtualization, scrolling, drag-and-drop, and
  // dependency testing. Predecessor points to the previous record in
  // the chain (so the deepest child has predecessor = level-4 parent),
  // and the first record of every cycle is an unscheduled root so the
  // chain start date is well-defined.
  // -------------------------------------------------------------------------
  const CYCLE = 5;
  const buildLoopedChain = (target, depth) => {
    setIsLoading(true);
    const version = ++dataVersionRef.current;
    renderStartRef.current = performance.now();
    measureEnabledRef.current = true;
    setRenderSeconds(null);
    setDataSource([]);

    const result = new Array(target);
    const rand = () => Math.floor(Math.random() * 100);
    const baseStart = new Date(2017, 1, 9);
    let previousId = null;
    let chainStart = null;

    for (let i = 0; i < target; i++) {
      const id = i + 1;
      const positionInCycle = i % depth; // 0..depth-1
      const isChainRoot = positionInCycle === 0;
      const isDeepest = positionInCycle === depth - 1;

      if (isChainRoot) {
        // Each new chain starts 5 days after the previous one so the
        // Gantt timeline fans out, mirroring the cascade used by
        // loadDependency2500.
        chainStart = new Date(
          baseStart.getFullYear(),
          baseStart.getMonth(),
          baseStart.getDate() + Math.floor(i / depth) * 5
        );
      }

      const start = isChainRoot
        ? chainStart
        : new Date(
          chainStart.getFullYear(),
          chainStart.getMonth(),
          chainStart.getDate() + positionInCycle
        );

      result[i] = {
        ID: id,
        TaskName: `Task ${id}`,
        StartDate: start,
        Duration: 5,
        Progress: rand(),
        // positionInCycle 0 = new Level-0 parent, otherwise child of
        // the previous record in the chain.
        ParentId: isChainRoot ? null : previousId,
        // First record of the chain is the date anchor (matches the
        // manuallyScheduled contract used elsewhere in this file);
        // every later record is chained EndToStart to its predecessor
        // so dependency tests see a real chain.
        ...(isChainRoot ? { manuallyScheduled: true } : {}),
        Predecessor: !isChainRoot && previousId !== null
          ? previousId.toString()
          : ''
      };

      previousId = id;
      // `isDeepest` is informational here; the contract is encoded by
      // `positionInCycle === depth - 1` and is the deepest child when
      // depth === CYCLE. Reference it so eslint doesn't flag it.
      void isDeepest;
    }

    requestAnimationFrame(() => {
      if (version !== dataVersionRef.current) return;
      dataIdRef.current = target;
      setDataSource(result);
      setCurrentSize(result.length);
      setIsLoading(false);
      forceRender((v) => v + 1);
    });
  };
  const loadLoopedChain25000 = () => buildLoopedChain(25000, 5);
  const loadLoopedChain50000 = () => buildLoopedChain(50000, 10);
  const loadLoopedChain75000 = () => buildLoopedChain(75000, 10);
  const loadLoopedChain100000 = () => buildLoopedChain(100000, 10);
  const loadHierarchy5000 = () => generateDataAsync(100, 49, 10, false, true);
  const loadHierarchy10000 = () => generateDataAsync(200, 49, 10, false, true);
  const loadHierarchy25000 = () => generateDataAsync(500, 49, 10, false, true);
  const loadHierarchy50000 = () => generateDataAsync(1000, 49, 10, false, true);
  const loadHierarchy75000 = () => generateDataAsync(1500, 49, 10, false, true);
  const loadHierarchy100000 = () => generateDataAsync(2000, 49, 10, false, true);
  const load50000 = () => generateDataAsync(1000, 49);
  const load100000 = () => generateDataAsync(2000, 49);
  const load200000 = () => generateDataAsync(4000, 49);
  const load500000 = () => generateDataAsync(10000, 49);

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

  // Wired into each page's Bryntum `paint` listener. Only the first paint
  // after a load
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
      loadHierarchy75000,
      loadHierarchy100000,
      loadLoopedChain25000,
      loadLoopedChain50000,
      loadLoopedChain75000,
      loadLoopedChain100000,
      load50000,
      load100000,
      load200000,
      load500000
    },
    refreshData,
    clearData
  };
}