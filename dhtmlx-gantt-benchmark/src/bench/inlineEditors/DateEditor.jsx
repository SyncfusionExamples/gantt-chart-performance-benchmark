import React, {
  useState,
  forwardRef,
  useImperativeHandle
} from 'react';

// Plain-HTML fallback of the official DHTMLX React Gantt
// `DateEditor`. Uses native `<input type="date">` instead of
// MUI's DatePicker so we don't pull `@mui/x-date-pickers` into
// this benchmark project's deps.
//
// The `value` is a ISO `yyyy-mm-dd` string the native picker
// understands. DHTMLX reads `getValue()` and converts to a
// `Date` instance for the data store.
const DateEditor = forwardRef((props, ref) => {
  const {
    initialValue,
    task,
    save,
    cancel,
    ganttInstance
  } = props || {};
  const initialStr =
    initialValue instanceof Date
      ? initialValue.toISOString().slice(0, 10)
      : initialValue || '';
  const [value, setValue] = useState(initialStr);

  useImperativeHandle(ref, () => ({
    getValue: () => (value ? new Date(value) : null),
    setValue: (val) =>
      setValue(
        val instanceof Date ? val.toISOString().slice(0, 10) : val || ''
      ),
    isValid: () => true,
    isChanged: (originalValue) => {
      const originalStr =
        originalValue instanceof Date
          ? originalValue.toISOString().slice(0, 10)
          : originalValue || '';
      return originalStr !== value;
    },
    focus: () => {},
    save: () => {}
  }));

  return (
    <input
      type="date"
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

export default DateEditor;
