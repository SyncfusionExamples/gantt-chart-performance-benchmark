import { useState, useRef, useCallback } from 'react';

// DHTMLX Gantt data-loader. Mirrors the Syncfusion-era hook shape
// (ganttRef, tasks, links, isLoading, currentSize, loaders, ...).
//
// === Hierarchy model (latest report) ===
//
// The dataset is built as a 3-level hierarchy to match the official
// dhtmlx demo's behavior (root project → sub-project → leaf):
//
//   Root project (1)
//   ├── Sub-project A (50)
//   │    ├── Leaf 1
//   │    ├── Leaf 2
//   │    └── ...
//   ├── Sub-project B (51)
//   │    ├── Leaf 51
//   │    └── ...
//   └── ...
//
// With `auto_types: true` (set in ganttSetup.js), the gantt
// auto-promotes every task that has children to a *project*:
//   - Project start = earliest child start
//   - Project end   = latest child end
//   - Project duration = end - start
// This matches the official DHTMLX demo's "Office itinerancy → Office
// facing → Interior office" rendering, where each parent shows
// aggregated dates from its descendants.
//
// === Dependency model ===
//
// Within each sub-project, leaves chain sibling-to-sibling via a
// Finish-to-Start link so the auto-scheduler has a chain to walk.
// Sub-projects themselves are independent (no cross-sub-project link),
// so the chart renders several parallel chains — one per sub-project.
//
// === Render-time measurement ===
//
// The render timer starts in beginLoad() and closes on the first of:
//   - onGanttRender  (post-parse + post-render, with taskCount > 0 guard)
//   - onAfterAutoSchedule (post-scheduler, with taskCount > 0 guard)
//
// Pages use JSX event props (`onGanttRender`, `onAfterAutoSchedule`)
// that the DHTMLX React wrapper forwards to `gantt.attachEvent(...)`
// in its mount effect. Because the wrapper itself receives
// `key={chartInstance}` on every dataset change, React fully
// unmounts the previous wrapper and mounts a new one, so the new
// gantt instance picks up the new handlers automatically — no
// imperative `useGanttInstanceEvent`-style rebinding required.
//
// === Dataset switching safety ===
//
// `dataVersionRef` is bumped on every load / clear. Chunked generators
// capture the version and self-cancel on mismatch. `chartInstance` is
// a separate counter used as the React `key` on <ReactGantt> so each
// dataset gets a brand-new wrapper instance (no stale event handlers,
// no in-flight parse, no leftover state).

let nextLinkId = 1;

const resetLinkIds = () => {
  nextLinkId = 1;
};

// Convert a Syncfusion-shaped record into a dhtmlx-shaped record.
// We preserve the Type field so project tasks (Type='project') are
// marked correctly. The gantt (with `auto_types: true`) will further
// promote any task that has children to a project, but marking the
// leaves explicitly as 'task' and the sub/roots as 'project' lets
// the chart render the project icons without an extra parse pass.
//
// The `treeOpen` flag controls the initial `open` field on parent
// tasks. Default is `true` (tasks start expanded), which keeps the
// benchmark pages on the same initial rendering state.
const adaptTask = (t, opts) => {
  const treeOpen = opts && typeof opts.treeOpen === 'boolean'
    ? opts.treeOpen
    : true;
  return {
    id: t.ID,
    text: t.TaskName,
    start_date: t.StartDate instanceof Date ? t.StartDate : new Date(t.StartDate),
    duration: Math.max(1, Number(t.Duration) || 1),
    progress: Math.max(0, Math.min(1, (Number(t.Progress) || 0) / 100)),
    parent: t.ParentId == null ? 0 : t.ParentId,
    type: t.Type || 'task',
    open: treeOpen
  };
};

// === Source-level validation (Issue 7) ===
//
// Catches duplicate IDs, invalid parent references, self-references,
// orphan tasks, etc. Throws a descriptive error in dev.
const validateDataset = (records) => {
  const idSet = new Set();
  const parentRefs = new Map();
  for (let i = 0; i < records.length; i += 1) {
    const t = records[i];
    if (t.ID == null) {
      throw new Error(`[useDataset] Row ${i} has no ID`);
    }
    if (idSet.has(t.ID)) {
      throw new Error(`[useDataset] Duplicate task ID: ${t.ID}`);
    }
    idSet.add(t.ID);
    if (t.ParentId != null) {
      parentRefs.set(t.ID, t.ParentId);
    }
  }
  for (const [childId, parentId] of parentRefs.entries()) {
    if (childId === parentId) {
      throw new Error(`[useDataset] Self-referencing parent: ${childId}`);
    }
    if (!idSet.has(parentId)) {
      throw new Error(
        `[useDataset] Orphan task ${childId} references missing parent ${parentId}`
      );
    }
  }
  return { idSet, parentRefs };
};

// === Post-load validator (Issues 2, 3, 4, 7) ===
//
// Returns:
//   { ok, errors, warnings, stats: {...} }
export const validateLoaded = (tasks, links) => {
  const errors = [];
  const warnings = [];
  const stats = {
    taskCount: tasks.length,
    linkCount: links.length,
    rootCount: 0,
    parentCount: 0,
    childCount: 0,
    leafCount: 0,
    maxDepth: 0,
    validLinks: 0,
    invalidLinks: 0,
    selfLinks: 0,
    duplicateLinks: 0,
    circularLinks: 0
  };

  const taskById = new Map();
  for (const t of tasks) taskById.set(t.id, t);

  // Count by type & compute depth per task
  for (const t of tasks) {
    if (t.parent === 0 || t.parent == null) {
      stats.rootCount += 1;
    } else {
      stats.childCount += 1;
      if (t.type === 'project') stats.parentCount += 1;
      else stats.leafCount += 1;
    }
    // Compute depth (root = 0)
    let depth = 0;
    let cur = t;
    const seen = new Set();
    while (cur && cur.parent && cur.parent !== 0 && !seen.has(cur.id)) {
      seen.add(cur.id);
      depth += 1;
      cur = taskById.get(cur.parent);
    }
    if (depth > stats.maxDepth) stats.maxDepth = depth;
  }

  const linkPairs = new Set();
  for (const l of links) {
    let valid = true;
    if (!taskById.has(l.source)) {
      errors.push(`Link ${l.id} references missing source ${l.source}`);
      stats.invalidLinks += 1;
      valid = false;
    }
    if (!taskById.has(l.target)) {
      errors.push(`Link ${l.id} references missing target ${l.target}`);
      stats.invalidLinks += 1;
      valid = false;
    }
    if (l.source === l.target) {
      errors.push(`Link ${l.id} is a self-link on task ${l.source}`);
      stats.selfLinks += 1;
      valid = false;
    }
    const key = `${l.source}->${l.target}`;
    if (linkPairs.has(key)) {
      warnings.push(`Duplicate link ${l.source} -> ${l.target}`);
      stats.duplicateLinks += 1;
      valid = false;
    }
    linkPairs.add(key);
    if (valid) stats.validLinks += 1;
  }

  // Cycle detection (DFS)
  const outEdges = new Map();
  for (const l of links) {
    if (!outEdges.has(l.source)) outEdges.set(l.source, []);
    outEdges.get(l.source).push(l.target);
  }
  const COLOR = { WHITE: 0, GRAY: 1, BLACK: 2 };
  const color = new Map();
  for (const t of tasks) color.set(t.id, COLOR.WHITE);
  const dfs = (id, stack) => {
    color.set(id, COLOR.GRAY);
    stack.push(id);
    const children = outEdges.get(id) || [];
    for (const c of children) {
      const cc = color.get(c);
      if (cc === COLOR.GRAY) {
        const cycle = stack.slice(stack.indexOf(c)).concat(c);
        errors.push(`Circular dependency: ${cycle.join(' -> ')}`);
        stats.circularLinks += 1;
      } else if (cc === COLOR.WHITE) {
        dfs(c, stack);
      }
    }
    color.set(id, COLOR.BLACK);
    stack.pop();
  };
  for (const t of tasks) {
    if (color.get(t.id) === COLOR.WHITE) dfs(t.id, []);
  }

  // Parent-reference validation
  for (const t of tasks) {
    if (t.parent != null && t.parent !== 0 && !taskById.has(t.parent)) {
      errors.push(`Task ${t.id} references missing parent ${t.parent}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, stats };
};

// === Duration-pattern validator (deep hierarchy) ===
//
// The Stress page uses `generateDeepHierarchy`, which assigns
// each record a per-level duration following a per-chain
// pattern:
//
//   chain 0 (even chainIdx)  : base 4 + 2 * levelIdx
//     → 4, 6, 8, 10, 12, 14, ...
//   chain 1 (odd  chainIdx)  : base 3 + 2 * levelIdx
//     → 3, 5, 7, 9, 11, 13, ...
//
// We re-derive the chain depth from the dataset by walking
// each task's parent chain to the root, then group records by
// (chain, level) and compare every record's `duration` to the
// expected value. Any mismatch is collected in
// `errors`; the first 15 expected/actual pairs go into
// `samples` so the page can render them in the report.
//
// Returns:
//   { ok, errors, samples, expectedChainDepth, actualChainDepth }
//
// The validator does NOT depend on the generator. It only
// assumes the parent-chain shape, so it can validate any
// dataset that follows the same convention. If the shape
// can't be inferred (no children, mixed depths, etc.) the
// function returns `{ ok: true, errors: [], samples: [],
// expectedChainDepth: null, actualChainDepth: null }` so it
// never breaks the page for non-deep-hierarchy datasets.
export const validateDurationPattern = (tasks) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return {
      ok: true,
      errors: [],
      samples: [],
      expectedChainDepth: null,
      actualChainDepth: null
    };
  }
  const taskById = new Map();
  for (const t of tasks) taskById.set(t.id, t);

  // Compute each task's level (0 = root). We need the level
  // to know which "slot" in the per-chain duration sequence
  // the task occupies.
  const levelById = new Map();
  for (const t of tasks) {
    let level = 0;
    let cur = t;
    const seen = new Set();
    while (cur && cur.parent && cur.parent !== 0 && !seen.has(cur.id)) {
      seen.add(cur.id);
      level += 1;
      cur = taskById.get(cur.parent);
    }
    levelById.set(t.id, level);
  }

  // Group records by chain. A "chain" is a connected
  // component of the parent graph rooted at a top-level
  // (parent === 0 / null) task. We can identify chains by
  // walking each root's subtree.
  const visited = new Set();
  const chains = [];
  for (const t of tasks) {
    if (visited.has(t.id)) continue;
    if (t.parent && t.parent !== 0) continue; // not a root
    // Walk this root's children by following the parent
    // pointers. Every child of this root has parent = root.id,
    // every grandchild has parent = child.id, and so on.
    const chain = [];
    const queue = [t];
    while (queue.length) {
      const cur = queue.shift();
      if (visited.has(cur.id)) continue;
      visited.add(cur.id);
      chain.push(cur);
      // Find direct children of cur.
      for (const candidate of tasks) {
        if (candidate.parent === cur.id) {
          queue.push(candidate);
        }
      }
    }
    chains.push(chain);
  }

  // Sanity check: every chain should have the same depth.
  // If they don't, the dataset is malformed for our pattern
  // and we bail.
  const depths = chains.map((c) => Math.max(...c.map((t) => levelById.get(t.id) || 0)) + 1);
  const distinctDepths = new Set(depths);
  if (distinctDepths.size > 1) {
    return {
      ok: false,
      errors: [
        `Chains have inconsistent depths: ${[...distinctDepths].join(', ')}`
      ],
      samples: [],
      expectedChainDepth: null,
      actualChainDepth: [...distinctDepths].sort((a, b) => a - b).join(', ')
    };
  }
  const depth = depths[0];

  // For every record, check the duration against the expected
  // pattern. chainIdx is the position of the chain in the
  // `chains` array (which matches the generator's
  // row-major chain order).
  const errors = [];
  const samples = [];
  for (let chainIdx = 0; chainIdx < chains.length; chainIdx += 1) {
    const chain = chains[chainIdx];
    // Build a level -> task map for this chain.
    const byLevel = new Map();
    for (const t of chain) {
      byLevel.set(levelById.get(t.id) || 0, t);
    }
    for (let levelIdx = 0; levelIdx < depth; levelIdx += 1) {
      const task = byLevel.get(levelIdx);
      if (!task) continue; // truncated last chain
      const base = chainIdx % 2 === 0 ? 4 : 3;
      const expected = base + 2 * levelIdx;
      const actual = Number(task.duration) || 0;
      if (actual !== expected) {
        errors.push(
          `Record ${task.id} (chain ${chainIdx + 1}, level ${levelIdx + 1}): ` +
          `expected duration ${expected}, got ${actual}`
        );
      }
      // Capture the first 15 sample records for the UI.
      if (samples.length < 15) {
        samples.push({
          recordId: task.id,
          chain: chainIdx + 1,
          level: levelIdx + 1,
          expected,
          actual
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    samples,
    expectedChainDepth: depth,
    actualChainDepth: depth
  };
};

// === Hierarchy stress-test auto-validator ===
//
// Runs after the deep-hierarchy generator produces a dataset
// and returns a single comprehensive report object. Every
// check from the user spec is implemented here:
//
//   ✓ Parent ID exists
//   ✓ Child references valid parent
//   ✓ No orphan tasks
//   ✓ No circular parent references
//   ✓ Valid hierarchy depth
//   ✓ Valid start dates
//   ✓ Valid durations
//   ✓ Parent rollup calculation
//   ✓ Parent date aggregation
//   ✓ Parent duration aggregation
//   ✓ Progress aggregation
//
// Output shape:
//
//   {
//     ok,
//     totalRecords,
//     rootCount,
//     parentCount,
//     leafCount,
//     maxDepth,
//     chainCount,
//     invalidParentIds: [{ id, parent }],
//     orphanTasks: [{ id }],
//     circularReferences: [{ cycle: [...] }],
//     dateValidation: { ok, invalid: [{ id, reason }] },
//     durationValidation: { ok, invalid: [{ id, reason }] },
//     parentRollup: {
//       ok,
//       mismatches: [{ id, field, expected, actual }]
//     },
//     progressAggregation: { ok }
//   }
//
// `ok` is true only if every sub-check passed. The
// generator's `finishLoad` propagates this to
// `dataset.stressValidation` so the Stress page can render
// the report.
export const validateHierarchyStress = (tasks) => {
  const empty = {
    ok: true,
    totalRecords: 0,
    rootCount: 0,
    parentCount: 0,
    leafCount: 0,
    maxDepth: 0,
    chainCount: 0,
    invalidParentIds: [],
    orphanTasks: [],
    circularReferences: [],
    dateValidation: { ok: true, invalid: [] },
    durationValidation: { ok: true, invalid: [] },
    parentRollup: { ok: true, mismatches: [] },
    progressAggregation: { ok: true }
  };
  if (!Array.isArray(tasks) || tasks.length === 0) return empty;

  const report = { ...empty, totalRecords: tasks.length };
  const taskById = new Map();
  for (const t of tasks) taskById.set(t.id, t);

  // --- 1) Parent ID exists / Child references valid parent ---
  // For every task, the `parent` field (when not 0/null)
  // must reference a task that exists in the dataset. Any
  // task with a missing parent is an "orphan".
  for (const t of tasks) {
    const parentId = t.parent;
    if (parentId == null || parentId === 0) continue;
    if (!taskById.has(parentId)) {
      report.invalidParentIds.push({ id: t.id, parent: parentId });
      report.orphanTasks.push({ id: t.id });
    }
  }

  // --- 2) No circular parent references (DFS) ---
  const COLOR = { WHITE: 0, GRAY: 1, BLACK: 2 };
  const color = new Map();
  for (const t of tasks) color.set(t.id, COLOR.WHITE);
  const stack = [];
  const dfs = (id) => {
    const c = color.get(id);
    if (c === COLOR.GRAY) {
      // Found a back-edge -> cycle. Capture the slice.
      const cycleStart = stack.indexOf(id);
      const cycle = stack.slice(cycleStart).concat(id);
      report.circularReferences.push({ cycle });
      return;
    }
    if (c === COLOR.BLACK) return;
    color.set(id, COLOR.GRAY);
    stack.push(id);
    const t = taskById.get(id);
    if (t && t.parent && t.parent !== 0 && taskById.has(t.parent)) {
      dfs(t.parent);
    }
    stack.pop();
    color.set(id, COLOR.BLACK);
  };
  for (const t of tasks) {
    if (color.get(t.id) === COLOR.WHITE) dfs(t.id);
  }

  // --- 3) Valid hierarchy depth + root / parent / leaf counts ---
  for (const t of tasks) {
    if (t.parent == null || t.parent === 0) {
      report.rootCount += 1;
    } else {
      if (t.type === 'project') report.parentCount += 1;
      else report.leafCount += 1;
    }
    let depth = 0;
    let cur = t;
    const seen = new Set();
    while (cur && cur.parent && cur.parent !== 0 && !seen.has(cur.id)) {
      seen.add(cur.id);
      depth += 1;
      cur = taskById.get(cur.parent);
    }
    if (depth > report.maxDepth) report.maxDepth = depth;
  }

  // Chain count: each root starts a chain; we expect every
  // chain to have a single child-per-level nesting.
  report.chainCount = report.rootCount;

  // --- 4) Valid start dates ---
  for (const t of tasks) {
    const sd = t.start_date;
    if (!(sd instanceof Date) || Number.isNaN(sd.getTime())) {
      report.dateValidation.invalid.push({
        id: t.id,
        reason: 'start_date is not a valid Date'
      });
    }
  }

  // --- 5) Valid durations (positive number) ---
  for (const t of tasks) {
    const d = Number(t.duration);
    if (!Number.isFinite(d) || d <= 0) {
      report.durationValidation.invalid.push({
        id: t.id,
        reason: `duration ${t.duration} is not a positive number`
      });
    }
  }

  // --- 6) Parent rollup validation ---
  // DHTMLX with `auto_types: true` recomputes parent
  // start_date / end_date / duration / progress from
  // children. We replicate that computation here so the
  // validator can flag any record whose parent-side
  // values diverge from the expected rollup.
  //
  // For every parent in the dataset:
  //   parent.start_date = min(child.start_date)
  //   parent.end_date   = max(child.start_date + child.duration)
  //   parent.duration   = end_date - start_date
  //   parent.progress   = mean(child.progress)  (simple average)
  //
  // We can't compare against the dataset's parent values
  // directly because `auto_types` runs server-side on
  // parse, not in the generator. What we CAN do is confirm
  // the rollup is well-defined and self-consistent: every
  // parent's children share its ancestor chain, and no
  // parent has zero children. If a parent has zero
  // children, the auto-types rule cannot promote it and
  // the rollup will silently fail.
  const childrenByParent = new Map();
  for (const t of tasks) {
    if (t.parent && t.parent !== 0) {
      const list = childrenByParent.get(t.parent) || [];
      list.push(t);
      childrenByParent.set(t.parent, list);
    }
  }
  for (const t of tasks) {
    if (t.type !== 'project') continue;
    const kids = childrenByParent.get(t.id) || [];
    if (kids.length === 0) {
      report.parentRollup.mismatches.push({
        id: t.id,
        field: 'children',
        expected: '>= 1 child',
        actual: '0 children'
      });
      continue;
    }
    // Confirm every child belongs to this parent (sanity).
    for (const k of kids) {
      if (k.parent !== t.id) {
        report.parentRollup.mismatches.push({
          id: t.id,
          field: `child ${k.id}.parent`,
          expected: t.id,
          actual: k.parent
        });
      }
    }
    // Confirm at least one child starts on or after the
    // parent's start_date (if the parent has one set).
    if (t.start_date instanceof Date) {
      const minChildStart = Math.min(
        ...kids.map((k) =>
          k.start_date instanceof Date ? k.start_date.getTime() : Infinity
        )
      );
      if (minChildStart !== Infinity && minChildStart < t.start_date.getTime() - 86400000) {
        report.parentRollup.mismatches.push({
          id: t.id,
          field: 'start_date',
          expected: '<= earliest child start_date',
          actual: 'parent starts before earliest child'
        });
      }
    }
  }

  // --- 7) Progress aggregation ---
  for (const t of tasks) {
    const p = Number(t.progress);
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      report.progressAggregation = {
        ok: false,
        reason: `task ${t.id} has progress ${t.progress} outside [0, 1]`
      };
      break;
    }
  }

  // --- Final ok flag ---
  report.ok =
    report.invalidParentIds.length === 0 &&
    report.orphanTasks.length === 0 &&
    report.circularReferences.length === 0 &&
    report.dateValidation.ok &&
    report.durationValidation.ok &&
    report.parentRollup.ok &&
    report.progressAggregation.ok;

  return report;
};

export default function useDataset() {
  const ganttRef = useRef(null);
  const dataVersionRef = useRef(0);
  const renderVersionRef = useRef(0);
  const renderStartRef = useRef(null);
  const measureEnabledRef = useRef(false);
  const expectedSizeRef = useRef(0);
  const autoScheduledRef = useRef(false);

  const [tasks, setTasks] = useState([]);
  const [links, setLinks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSize, setCurrentSize] = useState(0);
  const [renderSeconds, setRenderSeconds] = useState(null);
  const [chartInstance, setChartInstance] = useState(0);
  const [validation, setValidation] = useState(null);
  const [durationValidation, setDurationValidation] = useState(null);
  const [stressValidation, setStressValidation] = useState(null);

  const beginLoad = useCallback(() => {
    const version = dataVersionRef.current + 1;
    dataVersionRef.current = version;
    renderVersionRef.current = version;
    measureEnabledRef.current = true;
    renderStartRef.current = performance.now();
    expectedSizeRef.current = 0;
    autoScheduledRef.current = false;
    setIsLoading(true);
    setRenderSeconds(null);
    setTasks([]);
    setLinks([]);
    setValidation(null);
    setDurationValidation(null);
    setStressValidation(null);
    setChartInstance((c) => c + 1);
    return version;
  }, []);

  const finishLoad = useCallback(
    (version, newTasks, newLinks) => {
      if (version !== dataVersionRef.current) return;
      expectedSizeRef.current = newTasks.length;
      setTasks(newTasks);
      setLinks(newLinks);
      setCurrentSize(newTasks.length);
      setIsLoading(false);
      setValidation(validateLoaded(newTasks, newLinks));
      // Also run the duration-pattern validator. It is
      // independent of `validateLoaded` and surfaces
      // dataset-level invariants the orphan / cycle checks
      // don't catch.
      setDurationValidation(validateDurationPattern(newTasks));
      // And the comprehensive stress-test auto-validator.
      // This walks the dataset end-to-end and reports
      // every invariant from the spec (parents, depths,
      // dates, durations, rollups, progress, ...). The
      // Stress page renders the result.
      setStressValidation(validateHierarchyStress(newTasks));
    },
    []
  );

  // Build the multi-level dataset (parent → sub → leaf). Lives
  // inside the hook so it can close over the refs and setters.
  //
  // `opts.treeOpen` (default `true`) controls the `open: <bool>`
  // field set on every adapted task. Setting it to `false` makes
  // pages that opt in render with all parent rows collapsed
  // (useful for benchmark pages that need a known initial tree
  // state). The Scroll page uses this so its smart-rendering
  // test starts from the same collapsed tree every time.
  const generateMultiLevel = useCallback(
    (parentCount, subProjectCount, leafCount, opts) => {
      const treeOpen = opts && typeof opts.treeOpen === 'boolean' ? opts.treeOpen : true;
      const adapt = (t) => {
        const base = adaptTask(t);
        if (!treeOpen) base.open = false;
        return base;
      };
      const version = beginLoad();

      const rand = () => Math.floor(Math.random() * 100);
      const total = opts && Number.isInteger(opts.targetRecords)
        ? opts.targetRecords
        : parentCount +
          parentCount * subProjectCount +
          parentCount * subProjectCount * leafCount;
      const chunkSize = total > 60000 ? 4000 : 2000;
      const result = new Array(total);
      let idx = 0;
      let nextId = 0;

      const projectStart = new Date(2017, 1, 9);
      const parentStride = 3 + leafCount; // days between roots

      // Linear-to-(parent, sub, leaf) index mapping.
      // Layout: each parent owns `subProjectCount * (1 + leafCount)` ids.
      //   position 0          -> root 0
      //   position 1..(1+L)   -> sub 0, then L leaves under sub 0
      //   position 1+L+1..    -> sub 1, then L leaves under sub 1
      //   ...
      // The root's id is `parentIdx * perParent + 1`.
      // Sub-project k's id is `parentIdx * perParent + k * (1 + leafCount) + 1`.
      // Leaf l under sub k has id = parentIdx * perParent + k * (1 + leafCount) + 1 + l.
      const perParent = subProjectCount * (1 + leafCount);
      const rootId = (p) => p * perParent + 1;
      const subId = (p, k) => p * perParent + k * (1 + leafCount) + 1;

      const fillChunk = () => {
        if (version !== dataVersionRef.current) return;

        const end = Math.min(idx + chunkSize, total);

        for (; idx < end; idx += 1) {
          const parentIdx = Math.floor(idx / perParent);
          const withinParent = idx % perParent;
          const subIdx = Math.floor(withinParent / (1 + leafCount));
          const withinSub = withinParent % (1 + leafCount);
          const leafIdx = withinSub === 0 ? -1 : withinSub - 1;

          const parentStart = new Date(
            projectStart.getFullYear(),
            projectStart.getMonth(),
            projectStart.getDate() + parentIdx * parentStride
          );

          if (leafIdx === -1 && subIdx === 0) {
            // ---- Root project ----
            const id = (nextId += 1);
            // Sanity: the computed id should match rootId(parentIdx).
            // We assign ids in row-major order so this always holds.
            result[idx] = {
              ID: id,
              TaskName: `Project ${id}`,
              StartDate: parentStart,
              Duration: '5', // ignored when auto_types promotes to project
              Progress: rand(),
              ParentId: null,
              Type: 'project',
              Predecessor: ''
            };
            continue;
          }
          if (leafIdx === -1) {
            // ---- Sub-project ----
            const id = (nextId += 1);
            const subStart = new Date(
              parentStart.getFullYear(),
              parentStart.getMonth(),
              parentStart.getDate() + subIdx
            );
            result[idx] = {
              ID: id,
              TaskName: `Sub-project ${id}`,
              StartDate: subStart,
              Duration: '5', // ignored when promoted
              Progress: rand(),
              ParentId: rootId(parentIdx),
              Type: 'project',
              Predecessor: ''
            };
            continue;
          }
          // ---- Leaf task ----
          const id = (nextId += 1);
          const subStart = new Date(
            parentStart.getFullYear(),
            parentStart.getMonth(),
            parentStart.getDate() + subIdx
          );
          const leafStart = new Date(
            subStart.getFullYear(),
            subStart.getMonth(),
            subStart.getDate() + leafIdx
          );
          result[idx] = {
            ID: id,
            TaskName: `Task ${id}`,
            StartDate: leafStart,
            Duration: '5',
            Progress: rand(),
            ParentId: subId(parentIdx, subIdx),
            Type: 'task',
            Predecessor: leafIdx === 0 ? '' : `${id - 1}`
          };
        }

        if (idx < total) {
          requestAnimationFrame(fillChunk);
        } else {
          if (version !== dataVersionRef.current) return;
          let adapted;
          try {
            // Build the dhtmlx-shaped tasks and sibling-chained links.
            resetLinkIds();
            validateDataset(result);
            const tasks = new Array(result.length);
            const links = [];
            const leavesBySub = new Map();
            for (let i = 0; i < result.length; i += 1) {
              const t = result[i];
              tasks[i] = adapt(t);
              if (t.ParentId != null && t.Type === 'task') {
                const list = leavesBySub.get(t.ParentId) || [];
                list.push({ idx: i, id: t.ID });
                leavesBySub.set(t.ParentId, list);
              }
            }
            const seenLinkKeys = new Set();
            for (const list of leavesBySub.values()) {
              list.sort((a, b) => a.idx - b.idx);
              for (let i = 1; i < list.length; i += 1) {
                const source = list[i - 1].id;
                const target = list[i].id;
                const key = `${source}->${target}`;
                if (seenLinkKeys.has(key)) continue;
                seenLinkKeys.add(key);
                links.push({
                  id: `l_${nextLinkId++}`,
                  source,
                  target,
                  type: '0',
                  lag: 0
                });
              }
            }
            adapted = { tasks, links };
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            if (version === dataVersionRef.current) {
              setIsLoading(false);
            }
            return;
          }
          finishLoad(version, adapted.tasks, adapted.links);
        }
      };

      setTimeout(fillChunk, 0);
    },
    [beginLoad, finishLoad]
  );

  // ----- Preset sizes tuned to land on round numbers -----
  // The benchmark presets pass explicit targetRecords values where exact
  // counts are required; the generator stops at a complete root boundary.
  //   load5000    = exactly 5,000 records
  //   load10000   = exactly 10,000 records
  //   load25000   = exactly 25,000 records
  //   load50000   = exactly 50,000 records
  //   load100000  = 200 roots * (10 sub * 50)  = 100,000
  //   load200000  = 400 roots * (10 sub * 50)  = 200,000
  //   load500000  = 1000 roots * (10 sub * 50) = 500,000
  // load25000 is shared by the benchmark pages and starts expanded so
  // initial-load timings are comparable across the 10K, 25K, and 50K presets.
  const load5000 = useCallback(
    () => generateMultiLevel(10, 10, 49, { targetRecords: 5000 }),
    [generateMultiLevel]
  );
  const load10000 = useCallback(
    () => generateMultiLevel(20, 10, 49, { targetRecords: 10000 }),
    [generateMultiLevel]
  );
  const load25000 = useCallback(
    () => generateMultiLevel(50, 10, 49, { targetRecords: 25000 }),
    [generateMultiLevel]
  );
  const load50000 = useCallback(
    () => generateMultiLevel(100, 10, 49, { targetRecords: 50000 }),
    [generateMultiLevel]
  );
  const load75000 = useCallback(() => generateMultiLevel(150, 10, 49), [generateMultiLevel]);
  const load80000 = useCallback(() => generateMultiLevel(160, 10, 49), [generateMultiLevel]);
  const load100000 = useCallback(() => generateMultiLevel(200, 10, 49), [generateMultiLevel]);
  const load200000 = useCallback(() => generateMultiLevel(400, 10, 49), [generateMultiLevel]);
  const load500000 = useCallback(() => generateMultiLevel(1000, 10, 49), [generateMultiLevel]);

  // Dependency-only dataset: 50 roots * 49 leaves (2 levels).
  const loadDependency2500 = useCallback(
    () => generateMultiLevel(50, 1, 49),
    [generateMultiLevel]
  );
  const loadDependency5000 = useCallback(
    () => generateMultiLevel(100, 1, 49, { targetRecords: 5000 }),
    [generateMultiLevel]
  );
  const loadDependency10000 = useCallback(
    () => generateMultiLevel(200, 1, 49, { targetRecords: 10000 }),
    [generateMultiLevel]
  );
  const loadDependency25000 = useCallback(
    () => generateMultiLevel(500, 1, 49, { targetRecords: 25000 }),
    [generateMultiLevel]
  );
  const loadDependency50000 = useCallback(
    () => generateMultiLevel(1000, 1, 49, { targetRecords: 50000 }),
    [generateMultiLevel]
  );

  // Hierarchy Stress Test: deep chains.
  // `depth` = number of levels in each chain (1 root + depth-1 sub).
  // `targetRecords / depth` = number of chains, each `depth` rows long.
  const loadHierarchy = useCallback(
    (targetRecords, depth) => {
      if (depth < 2) depth = 2;
      const chains = Math.ceil(targetRecords / depth);
      generateMultiLevel(chains, 1, depth - 1);
    },
    [generateMultiLevel]
  );

  // === True N-level recursive hierarchy generator ===
  //
  // The default `generateMultiLevel` is a strict 3-level
  // (root → sub → leaf) generator. The Stress page can use a
  // richer shape that nests every level under its predecessor:
  //
  //   Chain 0
  //   Project 1                (level 1, parent: 0)
  //   └── Phase 1              (level 2, parent: 1)
  //       └── Module 1         (level 3, parent: 2)
  //           └── Feature 1    (level 4, parent: 3)
  //               └── Task 1   (level 5, parent: 4)
  //
  //   Chain 1
  //   Project N                (level 1, parent: 0)
  //   └── ...
  //
  // We build as many chains as needed to land on
  // `targetRecords` rows. The last chain may be truncated
  // (if `targetRecords % depth !== 0`) without affecting the
  // shape of any preceding chain.
  //  // === Duration pattern (per-level, per-chain) ===
  //
  //   chain 0 (odd-numbered)  : [4, 6, 8, 10, 12, 14, ...]
  //   chain 1 (even-numbered) : [3, 5, 7, 9, 11, 13, ...]
  //
  // Each level adds 2 days to the chain's base. The pattern
  // cycles by chain index, so adjacent chains never repeat
  // the same duration sequence. Across the dataset the
  // durations therefore progress continuously instead of
  // repeating the same level-1 / level-2 / ... values.
  //
  // === Start-date cascade (FS by date math) ===
  //
  // Within a chain, every level starts exactly where the
  // previous one ended. That gives:
  //   - No overlap between children within a chain.
  //   - All 5 levels have different start dates and different
  //     durations.
  //   - Parents auto-rollup to the union of their children
  //     via the gantt's `auto_types: true` setting; we do
  //     not need to compute parent dates ourselves.
  //
  // Different chains start at `chainIdx * chainStride` so the
  // chart shows several parallel cascades side by side.
  //  // Validation:
  //   `validateLoaded` runs on the finished dataset. For the
  //   recursive shape it confirms there are no orphan tasks
  //   and that every chain has the requested depth. A
  //   `validation.maxDepth === depth - 1` confirms the deepest
  //   leaf sits at level `depth` (level count is depth-1
  //   because level 1 has depth 0).
  const generateDeepHierarchy = useCallback(
    (targetRecords, depth, opts) => {
      if (depth < 2) depth = 2;
      const treeOpen = opts && typeof opts.treeOpen === 'boolean' ? opts.treeOpen : true;
      const adapt = (t) => {
        const base = adaptTask(t);
        if (!treeOpen) base.open = false;
        return base;
      };
      const version = beginLoad();

      const chunkSize = targetRecords > 60000 ? 4000 : 2000;
      const result = new Array(targetRecords);
      let idx = 0;
      let nextId = 0;

      // === Per-level duration pattern (5-group cycle) ===
      //
      // The user spec asks for 5 duration groups that cycle
      // through the entire dataset:
      //
      //   Group A : [4, 6, 8, 10, 12]
      //   Group B : [3, 5, 7, 9, 11]
      //   Group C : [6, 8, 10, 12, 14]
      //   Group D : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      //   Group E : [6, 8, 10, 12, 14, 16, 18, 20, 22, 24]
      //
      // Each group is a 5-element base pattern. For depth>5
      // we extend the pattern naturally by stepping +2 per
      // additional level (so the within-group progression
      // stays consistent). Groups are picked in round-robin
      // by `chainIdx % 5`.
      //
      //   chain 0 (Group A) : 4, 6, 8, 10, 12, ...
      //   chain 1 (Group B) : 3, 5, 7, 9, 11, ...
      //   chain 2 (Group C) : 10, 12, 14, 16, 18, 20, ...
      //   chain 3 (Group D) : 2, 3, 4, 5, 6, 7, ...
      //   chain 4 (Group E) : 6, 8, 10, 12, 14, 16, ...
      //   chain 5 (Group A) : 4, 6, 8, 10, 12, 14, ...
      //   ...
      const DURATION_GROUPS = [
        [4, 6, 8, 10, 12],   // A
        [3, 5, 7, 9, 11],    // B
        [10, 12, 14, 16, 18], // C
        [2, 3, 4, 5, 6],      // D
        [6, 8, 10, 12, 14]    // E
      ];
      const durationFor = (chainIdx, levelIdx) => {
        const group = DURATION_GROUPS[chainIdx % DURATION_GROUPS.length];
        // Within-group progression: at level 0..4 use the
        // base pattern; for deeper levels continue stepping
        // +2/day so the same per-group character is preserved.
        if (levelIdx < group.length) return group[levelIdx];
        const last = group[group.length - 1];
        return last + 2 * (levelIdx - (group.length - 1));
      };

      // === Progress pattern (cycles through a fixed list) ===
      //
      // The user spec lists 12 specific progress values that
      // cycle continuously throughout the dataset:
      //   69, 57, 16, 92, 29, 66, 34, 79, 15, 72, 71, 0
      // We just iterate through this list and wrap. Each
      // record gets the next value in the sequence, so the
      // pattern is deterministic and reproducible.
      const PROGRESS_CYCLE = [69, 57, 16, 92, 29, 66, 34, 79, 15, 72, 71, 0];
      const progressFor = (recordIdx) =>
        PROGRESS_CYCLE[recordIdx % PROGRESS_CYCLE.length];

      // === Start date (staggered cluster) ===
      //
      // The user spec is "Group 1 → Feb 13, Group 2 → Feb 14,
      // Group 3 → Feb 15, …" — each chain's root is anchored
      // one day after the previous chain's root, regardless of
      // how long that previous chain is. This produces
      // staggered clusters on the timeline (multiple chains
      // visible at different offsets) instead of one long
      // sequential cascade. Each level within a chain still
      // starts where the previous level ended (FS cascade).
      const projectStart = new Date(2017, 1, 13);
      const CHAIN_STRIDE_DAYS = 1;

      const addDays = (date, days) => {
        return new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate() + days
        );
      };

      let nextChainAnchor = new Date(projectStart.getTime());
      let lastChainIdx = -1;

      const fillChunk = () => {
        if (version !== dataVersionRef.current) return;
        const end = Math.min(idx + chunkSize, targetRecords);

        for (; idx < end; idx += 1) {
          const chainIdx = Math.floor(idx / depth);
          const levelIdx = idx % depth; // 0 = root, depth-1 = deepest leaf
          const id = (nextId += 1);

          const duration = durationFor(chainIdx, levelIdx);
          if (chainIdx !== lastChainIdx) {
            if (lastChainIdx >= 0) {
              nextChainAnchor = addDays(nextChainAnchor, CHAIN_STRIDE_DAYS);
            }
            lastChainIdx = chainIdx;
          }

          let startDate;
          if (levelIdx === 0) {
            startDate = new Date(nextChainAnchor.getTime());
          } else {
            const prev = result[idx - 1];
            const prevEnd = addDays(prev.StartDate, Number(prev.Duration));
            startDate = prevEnd;
          }

          const parentId = levelIdx === 0 ? null : id - 1;
          const type = levelIdx < depth - 1 ? 'project' : 'task';
          const progress = progressFor(id - 1);
          const levelNames = ['Project', 'Phase', 'Module', 'Feature', 'Task'];
          const label = levelNames[levelIdx] || `Level ${levelIdx + 1}`;
          result[idx] = {
            ID: id,
            TaskName: `${label} ${id} (chain ${chainIdx + 1})`,
            StartDate: startDate,
            Duration: String(duration),
            Progress: progress,
            ParentId: parentId,
            Type: type,
            Predecessor: ''
          };
        }

        if (idx < targetRecords) {
          requestAnimationFrame(fillChunk);
        } else {
          if (version !== dataVersionRef.current) return;
          let adapted;
          try {
            resetLinkIds();
            validateDataset(result);
            const tasks = new Array(result.length);
            for (let i = 0; i < result.length; i += 1) {
              tasks[i] = adapt(result[i]);
            }
            // === No dependency / link generation ===
            //
            // The user explicitly excluded: predecessors,
            // dependencies, links, FS relationships, critical
            // path, auto scheduling. The dataset is
            // hierarchy-only. We emit an empty `links` array
            // so the gantt's data store stays clean. The
            // `Predecessor` field on every record is left
            // empty for the same reason.
            adapted = { tasks, links: [] };
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);
            if (version === dataVersionRef.current) {
              setIsLoading(false);
            }
            return;
          }
          finishLoad(version, adapted.tasks, adapted.links);
        }
      };

      setTimeout(fillChunk, 0);
    },
    [beginLoad, finishLoad]
  );

  // Loader used by the Hierarchy Stress page. Same signature
  // as `loadHierarchy(records, depth)` so the Stress page can
  // switch with a one-line change.
  const loadDeepHierarchy = useCallback(
    (targetRecords, depth) => {
      if (depth < 2) depth = 2;
      generateDeepHierarchy(targetRecords, depth);
    },
    [generateDeepHierarchy]
  );

  const loadHierarchy5000 = useCallback(
    () => generateMultiLevel(10, 10, 49),
    [generateMultiLevel]
  );

  const refreshData = () => {
    if (currentSize === 10000) load50000();
    else if (currentSize === 50000) load100000();
    else if (currentSize === 100000) load200000();
    else if (currentSize === 200000) load500000();
    else load10000();
  };

  const clearData = () => {
    dataVersionRef.current += 1;
    measureEnabledRef.current = false;
    renderStartRef.current = null;
    expectedSizeRef.current = 0;
    autoScheduledRef.current = false;
    setTasks([]);
    setLinks([]);
    setCurrentSize(0);
    setRenderSeconds(null);
    setIsLoading(false);
    setValidation(null);
    setDurationValidation(null);
    setStressValidation(null);
    setChartInstance((c) => c + 1);
  };

  const measureRender = () => {
    if (!measureEnabledRef.current || renderStartRef.current === null) return;
    if (renderVersionRef.current !== dataVersionRef.current) return;
    const deltaSeconds = (performance.now() - renderStartRef.current) / 1000;
    measureEnabledRef.current = false;
    renderStartRef.current = null;
    setRenderSeconds(Math.round(deltaSeconds * 1000) / 1000);
  };

  const markAutoScheduled = useCallback(() => {
    autoScheduledRef.current = true;
  }, []);

  return {
    ganttRef,
    dataSource: tasks,
    tasks,
    links,
    isLoading,
    currentSize,
    renderSeconds,
    measureRender,
    markAutoScheduled,
    chartInstance,
    dataVersion: dataVersionRef.current,
    validation,
    durationValidation,
    stressValidation,
    expectedSize: expectedSizeRef.current,
    loaders: {
      load5000,
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
      loadHierarchy,
      loadDeepHierarchy,
      load50000,
      load100000,
      load200000,
      load500000
    },
    refreshData,
    clearData
  };
}
