import React, {
  useState,
  forwardRef,
  useImperativeHandle
} from 'react';

// Plain-HTML number editor for the progress column. Stores
// the value as a fraction (0..1) in the data store; the
// progress column template renders it as a percentage.
//
// DHTMLX reads `getValue()` as a number when committing the
// cell edit.
const ProgressEditor = forwardRef((props, ref) => {
  const {
    initialValue = 0,
    task,
    save,
    cancel,
    ganttInstance
  } = props || {};
  const initialPct = Math.round(Number(initialValue) * 100);
  const [value, setValue] = useState(String(initialPct));

  useImperativeHandle(ref, () => ({
    getValue: () => Math.max(0, Math.min(1, Number(value) / 100 || 0)),
    setValue: (val) => {
      if (typeof val === 'number' && val <= 1) {
        setValue(String(Math.round(val * 100)));
      } else {
        setValue(String(val));
      }
    },
    isValid: () => {
      const n = Number(value);
      return value !== '' && !Number.isNaN(n) && n >= 0 && n <= 100;
    },
    isChanged: (originalValue) =>
      Math.round(Number(originalValue) * 100) !== Number(value),
    focus: () => {},
    save: () => {}
  }));

  return (
    <input
      type="number"
      min="0"
      max="100"
      step="5"
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

export default ProgressEditor;
