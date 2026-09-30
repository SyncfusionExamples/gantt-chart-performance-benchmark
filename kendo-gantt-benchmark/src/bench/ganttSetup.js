// Syncfusion-specific constants used by every page. Each page inlines the
// actual `<GanttComponent>` markup so the Gantt code physically lives in
// every page; this module provides only the field mapping, column set and
// services so pages don't repeat *Syncfusion knowledge*.

import { Selection, VirtualScroll } from '@syncfusion/ej2-react-gantt';

export const taskFields = {
  id: 'ID',
  name: 'TaskName',
  startDate: 'StartDate',
  duration: 'Duration',
  progress: 'Progress',
  parentID: 'ParentId',
  dependency: 'Predecessor'
};

// Only the services need to be shared; the `<ColumnDirective>` JSX list is
// declared inline in every page.
export const SERVICES = [Selection, VirtualScroll];