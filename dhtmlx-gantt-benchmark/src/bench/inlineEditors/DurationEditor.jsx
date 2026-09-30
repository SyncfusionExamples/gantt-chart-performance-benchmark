import React, {
  useState,
  forwardRef,
  useImperativeHandle
} from 'react';

// Plain-HTML fallback of the official DHTMLX React Gantt
// `DurationEditor`. Uses `<input type="number">` instead of MUI
// `TextField` so we don't pull MUI into this project's deps.
//
// DHTMLX expects `getValue()` to return a number (the new
// duration in days). Anything non-numeric the user types is
// rejected with `isValid() === false`.
const DurationEditor = forwardRef((props, ref) => {
  const {
    initialValue = 1,
    task,
    save,
    cancel,
    ganttInstance
  } = props || {};
  const initial = Number(initialValue) || 1;
  const [value, setValue] = useState(String(initial));
  const [originalNumeric] = useState(initial);

  useImperativeHandle(ref, () => ({
    getValue: () => Number(value) || 0,
    setValue: (val) => setValue(String(val)),
    isValid: () =>
      value !== '' && !Number.isNaN(Number(value)) && Number(value) > 0,
    isChanged: (originalValue) => Number(originalValue) !== Number(value),
    focus: () => {},
    save: () => {}
  }));

  return (
    <input
      type="number"
      min="1"
      max="99999"
      step="1"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && typeof cancel === 'function') cancel();
        else if (e.key === 'Enter' && typeof save === 'function') save();
      }}
      autoFocus
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: '0 6px',
        border: '1px solid #2563eb',
        outline: 'none',
        font: 'inherit',
        color: 'inherit',
        background: '#fff'
      }}
    />
  );
});

export default DurationEditor;
