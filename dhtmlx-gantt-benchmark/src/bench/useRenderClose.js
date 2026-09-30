// Shared helper: wrap a render-time close function in a double
// `requestAnimationFrame` so we measure AFTER the browser has
// actually committed the painted frame.
//
// Why two rAFs?
//
//   1st rAF — yields to the next animation frame, letting the
//             dhtmlx gantt finish its current render-pass.
//   2nd rAF — guarantees the browser has actually painted the
//             frame to the screen.
//
// The previous code closed the timer inside the gantt event
// callback, but the callback fires from inside dhtmlx's
// `render()` which is on the JS stack — the DOM is updated but
// not yet painted. Capturing `performance.now()` at that moment
// under-reports the user-perceived render time. Waiting two
// rAFs after the event gives an honest "chart is on screen" time.
//
// Single rAF is insufficient because the dhtmlx render itself
// can be triggered from inside a rAF, and capturing the
// timestamp on the very next rAF can still fire before paint.
const closeAfterPaint = (fn) => {
  if (typeof fn !== 'function') return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fn();
    });
  });
};

export default closeAfterPaint;
