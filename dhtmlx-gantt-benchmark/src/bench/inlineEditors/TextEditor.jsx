import React, {
  useState,
  forwardRef,
  useImperativeHandle
} from 'react';

// Plain-HTML fallback of the official DHTMLX React Gantt
// `TextEditor`. Uses `<input type="text">` instead of the MUI
// `TextField` from the upstream example so we don't pull MUI
// into this benchmark project's deps.
//
// Satisfies the DHTMLX wrapper's `InlineEditorMethods` contract:
//   - getValue()    → current value the gantt should commit
//   - setValue(v)    → programmatic value update
//   - isValid()      → always true here
//   - isChanged(o)   → true if the user actually edited the value
//   - focus()        → focus the input on editor open
//   - save()         → forwarded hook (already a no-op in v10)
const TextEditor = forwardRef((props, ref) => {
  const {
    initialValue = '',
    task,
    save,
    cancel,
    ganttInstance
  } = props || {};
  const [value, setValue] = useState(initialValue || '');

  useImperativeHandle(ref, () => ({
    getValue: () => value,
    setValue: (val) => setValue(val),
    isValid: () => true,
    isChanged: (originalValue) => originalValue !== value,
    focus: () => {},
    save: () => {}
  }));

  return (
    <input
      type="text"
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

export default TextEditor;
