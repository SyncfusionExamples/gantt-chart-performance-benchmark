// BundlePage.lazy.js
// ------------------
// 1-line re-export so App.js can do:
//
//     const BundlePage = React.lazy(() =>
//       import(/* webpackChunkName: "page-bundle" */ './bench/BundlePage.lazy')
//     );
//
// The `page-bundle` chunk name is what `generateBundleStats.js` looks for
// when classifying the file as a page chunk (`page-<id>.<hash>.chunk.js`).
// Without the magic comment the chunk would be numbered (`109.<hash>.chunk.js`)
// and wouldn't show up in the per-page table.
export { default } from './BundlePage';