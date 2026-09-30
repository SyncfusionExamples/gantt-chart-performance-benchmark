import React, { useEffect, useRef, useState } from 'react';
import {
  GanttComponent,
  ColumnsDirective,
  ColumnDirective,
  Inject
} from '@syncfusion/ej2-react-gantt';
import BenchSection from './BenchSection';
import { taskFields, SERVICES } from './ganttSetup';

export default function InteractionLatencyPage({ dataset }) {
  const { ganttRef, dataSource, isLoading, loaders } = dataset;

  const crudRecordIdRef = useRef(null);
  const addStartRef = useRef(null);
  const updateStartRef = useRef(null);
  const deleteStartRef = useRef(null);

  const [latest, setLatest] = useState({
    add: null,
    update: null,
    delete: null
  });

  useEffect(() => {
    if (dataSource.length !== 5000 && !isLoading) {
      loaders.load5000();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetLatency = () => {
    addStartRef.current = null;
    updateStartRef.current = null;
    deleteStartRef.current = null;
    crudRecordIdRef.current = null;
    setLatest({ add: null, update: null, delete: null });
  };

  const addRecord = () => {
    const recordId = dataSource.reduce((highestId, record) => (
      Math.max(highestId, Number(record.ID) || 0)
    ), 0) + 1;
    const record = {
      ID: recordId,
      TaskName: `CRUD Task ${recordId}`,
      StartDate: new Date(2017, 1, 9),
      Duration: '5',
      Progress: 0,
      ParentId: null,
      Predecessor: ''
    };

    addStartRef.current = performance.now();
    ganttRef.current.addRecord(record, 'Above');
    crudRecordIdRef.current = recordId;
  };

  const updateRecord = () => {
    updateStartRef.current = performance.now();
    ganttRef.current.updateRecordByID({
      ID: 201,
      TaskName: 'Updated Task',
      Progress: 50
    });
  };

  const deleteRecord = () => {
    deleteStartRef.current = performance.now();
    ganttRef.current.deleteRecord(4901);
  };

  const handleActionComplete = (args) => {
    const requestType = args?.requestType;
    const operation = requestType === 'add'
      ? ['add', addStartRef]
      : requestType === 'save'
        ? ['update', updateStartRef]
        : requestType === 'delete'
          ? ['delete', deleteStartRef]
          : null;

    if (operation === null || operation[1].current === null) return;

    const latency = performance.now() - operation[1].current;
    operation[1].current = null;
    setLatest((prev) => ({ ...prev, [operation[0]]: latency }));
  };

  return (
    <BenchSection
      dataset={dataset}
      title="CRUD Operation Latency"
      presets={['load5000', 'load10000', 'load25000', 'load50000']}
      labelSuffix="Records"
      onPresetClick={resetLatency}
      actions={
        <>
          <button onClick={addRecord} disabled={isLoading || dataSource.length === 0}>
            Add record
          </button>
          <button onClick={updateRecord} disabled={isLoading || dataSource.length === 0}>
            Update record (ID: 201)
          </button>
          <button onClick={deleteRecord} disabled={isLoading || dataSource.length === 0}>
            Delete record (ID: 4901)
          </button>
        </>
      }
      summary={
        isLoading || dataSource.length === 0 ? (
          <span style={{ color: '#64748b', fontSize: '13px' }}>
            {isLoading ? 'Loading 5K dataset…' : 'Awaiting dataset…'}
          </span>
        ) : (
          <div
            data-testid="interaction-report"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              fontSize: '13px',
              marginTop: '8px',
              fontFamily: 'monospace',
              color: '#0f172a'
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>addRecord : </span>
              {latest.add !== null ? (
                <b>{latest.add.toFixed(2)} ms</b>
              ) : (
                <span style={{ color: '#94a3b8' }}>add a record to record</span>
              )}
            </div>
            <div>
              <span style={{ color: '#64748b' }}>updateRecordByID : </span>
              {latest.update !== null ? (
                <b>{latest.update.toFixed(2)} ms</b>
              ) : (
                <span style={{ color: '#94a3b8' }}>update the added record to record</span>
              )}
            </div>
            <div>
              <span style={{ color: '#64748b' }}>deleteRecord : </span>
              {latest.delete !== null ? (
                <b>{latest.delete.toFixed(2)} ms</b>
              ) : (
                <span style={{ color: '#94a3b8' }}>delete the added record to record</span>
              )}
            </div>
          </div>
        )
      }
    >
      {dataSource.length > 0 && (
        <GanttComponent
          ref={ganttRef}
          id="interaction-gantt"
          dataSource={dataSource}
          taskFields={taskFields}
          height="450px"
          enableVirtualization={true}
          enableTimelineVirtualization={true}
          treeColumnIndex={1}
          editSettings={{
            allowAdding: true,
            allowEditing: true,
            allowDeleting: true
          }}
          actionComplete={handleActionComplete}
        >
          <ColumnsDirective>
            <ColumnDirective field="ID" headerText="ID" width="80" />
            <ColumnDirective field="TaskName" headerText="Task Name" width="250" />
            <ColumnDirective field="StartDate" headerText="StartDate"/>
            <ColumnDirective field="Predecessor"/>
          </ColumnsDirective>
          <Inject services={[...SERVICES]} />
        </GanttComponent>
      )}
    </BenchSection>
  );
}