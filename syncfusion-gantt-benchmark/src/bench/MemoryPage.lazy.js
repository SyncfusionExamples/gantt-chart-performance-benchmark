// Code-split re-export. `App.js` imports this file via `React.lazy`, which
// is what triggers webpack to put the real module in its own chunk.
export { default } from './MemoryPage';