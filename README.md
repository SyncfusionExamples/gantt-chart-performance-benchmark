# React Gantt Chart Performance Benchmark

A reproducible, side-by-side performance benchmark of four React-based Gantt chart
components — **Syncfusion EJ2 Gantt**, , **Bryntum Gantt**,
and **DHTMLX Gantt** — built on identical datasets, an identical page structure,
and an identical measurement approach so that the resulting numbers are directly
comparable.

---

## Table of Contents

1. [Overview](#overview)
2. [Purpose](#purpose)
3. [Benchmark Scope](#benchmark-scope)
4. [Tested Libraries](#tested-libraries)
5. [Version Information](#version-information)
6. [Test Environment](#test-environment)
7. [Benchmark Methodology](#benchmark-methodology)
8. [Test Scenarios](#test-scenarios)
9. [Running the Benchmark](#running-the-benchmark)
10. [Metrics Collected](#metrics-collected)
11. [Results Interpretation](#results-interpretation)
12. [Repository Structure](#repository-structure)
13. [Additional Notes](#additional-notes)

---

## Overview

This repository hosts an in-browser benchmark suite that exercises four production
Gantt chart libraries through a common set of workload scenarios. Each library is
wrapped in its own self-contained Create React App sub-project so that dependency
trees, build outputs, and dev servers cannot interfere with one another. Every
sub-project exposes the same navigation structure, the same dataset presets, the
same...
