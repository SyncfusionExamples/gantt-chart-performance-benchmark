import React, { useEffect, useState } from 'react';
import BenchSection from './BenchSection';
import { KendoBenchGantt, KENDO_COLUMNS } from './kendoGanttSetup';

const STRESS_PRESETS = ['load2000', 'load5000', 'load10000'];
const STRESS_SIZE = {
  load2000: 2000,
  load5000: 5000,
  load10000: 10000,
};

export default function StressPage({ dataset }) {
  const { ganttRef, dataSource, loaders, isLoading, renderSeconds } = dataset;
  const [history, setHistory] = useState([]);
  const [runningKey, setRunningKey] = useState(null);

  useEffect(() => {
    if (dataSource.length > 0 && typeof dataset.measureRender === 'function') {
      dataset.measureRender();
    }
  }, [dataSource.length, dataset]);

  useEffect(() => {
    if (!runningKey || renderSeconds === null || renderSeconds === undefined) return;

    const recordCount = STRESS_SIZE[runningKey];
    const pass = recordCount <= 10000;

    setHistory((items) => [
      ...items.filter((item) => item.size !== recordCount),
      { size: recordCount, renderSeconds, pass }
    ].sort((a, b) => a.size - b.size));
    setRunningKey(null);
  }, [renderSeconds, runningKey]);

  const runPreset = async (key) => {
    if (runningKey) return;
    setRunningKey(key);
    loaders[key]();
  };

  const failingPoint = history
    .filter((h) => !h.pass)
    .reduce((acc, h) => (acc === null || h.size < acc.size ? h : acc), null);

  return (
    <BenchSection
      dataset={dataset}
      title="Large Data Render Test"
      showControls={false}
      actions={
        STRESS_PRESETS.map((key) => (
          <button key={key} onClick={() => runPreset(key)} disabled={Boolean(runningKey) || isLoading}>
            Run {STRESS_SIZE[key] / 1000}K
          </button>
        ))
      }
      summary={
        <>
          Initial render check for large data workloads.
          {failingPoint && (
            <span style={{ marginLeft: '10px', color: '#b91c1c' }}>
              Breaking point: <b>{failingPoint.size.toLocaleString()} records</b>
            </span>
          )}
        </>
      }
      footer={
        history.length > 0 ? (
          <>
            <table style={{ marginTop: '8px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '4px 12px', textAlign: 'left' }}>Dataset</th>
                  <th style={{ padding: '4px 12px', textAlign: 'left' }}>Render time</th>
                  <th style={{ padding: '4px 12px', textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 12px' }}>{h.size.toLocaleString()}</td>
                    <td style={{ padding: '4px 12px' }}>
                      {h.renderSeconds === null || h.renderSeconds === undefined ? '—' : `${h.renderSeconds.toFixed(3)} s`}
                    </td>
                    <td style={{ padding: '4px 12px', color: h.pass ? '#166534' : '#b91c1c' }}>
                      {h.pass ? 'Pass' : 'Fail'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {failingPoint && (
              <div style={{ marginTop: '8px', color: '#b91c1c' }}>
                First dataset to fail the hierarchy capacity criteria:{' '}
                <b>{failingPoint.size.toLocaleString()}</b> records
              </div>
            )}
          </>
        ) : null
      }
    >
      {dataSource.length > 0 && (
        <KendoBenchGantt
          ganttRef={ganttRef}
          dataSource={dataSource}
          height={750}
          columns={KENDO_COLUMNS}
          onDataBound={() => dataset.measureRender && dataset.measureRender()}
        />
      )}
    </BenchSection>
  );
}