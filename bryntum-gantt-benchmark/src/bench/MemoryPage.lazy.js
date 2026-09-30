// MemoryPage.lazy.js
// ------------------
// 1-line re-export so App.js can do:
//
//     const MemoryPage = React.lazy(() =>
//       import(/* webpackChunkName: "page-memory" */ './bench/MemoryPage.lazy')
//     );
//
// The `page-memory` chunk name is what `generateBundleStats.js` looks for
// when classifying the file as a page chunk
// (`page-<id>.<hash>.chunk.js`). Without the magic comment CRA auto-numbers
// the chunk (`109.<hash>.chunk.js`) and it shows up under "shared" instead
// of in the per-page table.
export { default } from './MemoryPage';