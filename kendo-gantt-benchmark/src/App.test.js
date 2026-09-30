import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import BundlePage from './bench/BundlePage';
import StressPage from './bench/StressPage';
import { normalizeTaskData } from './bench/kendoGanttSetup';

test('renders the Kendo Gantt benchmark shell', () => {
  render(<App />);
  expect(screen.getByText(/Kendo Gantt Benchmark/i)).toBeInTheDocument();
});

test('bundle page shows the exact production gzipped bundle size', () => {
  const dataset = {
    ganttRef: { current: null },
    dataSource: [{ ID: 1, TaskName: 'Root', StartDate: new Date(2017, 0, 1), EndDate: new Date(2017, 0, 8), Duration: 7, ParentId: null, Progress: 0 }],
    isLoading: false,
    loaders: { load2000: jest.fn() }
  };

  render(<BundlePage dataset={dataset} />);
  expect(screen.getByText(/286\.67 KB/i)).toBeInTheDocument();
});

test('stress page follows the PO-defined hierarchy capacity benchmark', () => {
  const dataset = {
    ganttRef: { current: null },
    dataSource: [{ ID: 1, TaskName: 'Root', StartDate: new Date(2017, 0, 1), EndDate: new Date(2017, 0, 8), Duration: 7, ParentId: null, Progress: 0 }],
    isLoading: false,
    loaders: {
      load25000: jest.fn(),
      load50000: jest.fn(),
      load75000: jest.fn(),
      load100000: jest.fn()
    }
  };

  render(<StressPage dataset={dataset} />);
  expect(screen.getByText(/Complex hierarchy capacity validation/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /25\s*k/i })).toBeInTheDocument();
  expect(screen.queryByText(/Scroll FPS/i)).not.toBeInTheDocument();
});

test('keeps child task bars at exactly 5-day duration', () => {
  const tasks = [
    {
      ID: 1,
      TaskName: 'Parent',
      StartDate: new Date(2017, 0, 1),
      EndDate: new Date(2017, 0, 1 + 245),
      Duration: 245,
      ParentId: null,
      Progress: 50
    },
    {
      ID: 2,
      TaskName: 'Task 2',
      StartDate: new Date(2017, 0, 1),
      EndDate: new Date(2017, 0, 5),
      Duration: 5,
      ParentId: 1,
      Progress: 20
    },
    {
      ID: 3,
      TaskName: 'Task 3',
      StartDate: new Date(2017, 0, 6),
      EndDate: new Date(2017, 0, 10),
      Duration: 5,
      ParentId: 1,
      Progress: 30
    }
  ];

  const normalized = normalizeTaskData(tasks);
  const children = normalized[0].children;

  expect(children).toHaveLength(2);
  expect(children[0].duration).toBe(5);
  expect(children[0].end.getTime() - children[0].start.getTime()).toBe(5 * 24 * 60 * 60 * 1000);
  expect(children[1].duration).toBe(5);
  expect(children[1].end.getTime() - children[1].start.getTime()).toBe(5 * 24 * 60 * 60 * 1000);
});
