# DataGuard AI – Data Quality Monitoring & ETL Testing Platform

An enterprise-grade Data Quality Monitoring, 9-Rule Validation, Source-to-Target ETL Reconciliation, Test Case Management, Regression Analytics, and Multi-Sheet Excel Reporting platform.

Built as a portfolio project targeting the **Quality Engineer – Data Analytics** engineering workflow.

## Core Capabilities

1. **Overview Dashboard**: Real-time KPIs computed from active datasets (Total Datasets, Validation Runs, Passed/Failed Checks, Overall Data Quality Score), Quality Score Trend chart, Error Distribution chart, Recent Datasets table, and Quick Actions.
2. **Data Sources**: Source & Target CSV upload with validation, automatic schema detection, data type inference (`number`, `integer`, `date`, `email`, `boolean`, `string`), searchable data preview, and one-click loading of Clean and Dirty sample pairs.
3. **Data Validation (9 Real Rules)**:
   - Non-empty dataset validation
   - Required column validation
   - Missing and null value detection (`""`, `NULL`, `NA`, `N/A`, `NaN`, `undefined`)
   - Duplicate row detection
   - Primary key uniqueness validation
   - Data type validation
   - Email format validation
   - Negative & non-numeric amount validation
   - Date format and real calendar validation (rejects `2026-02-30`, month `13`, etc.)
4. **ETL Reconciliation**: Primary key matching, source/target record count parity, missing-in-target & extra-in-target orphan detection, field-level diffs, numeric comparison tolerance, whitespace trimming, and case-sensitivity controls.
5. **Test Case Management**: Full CRUD (Create, Edit, Delete), category/severity classification, individual test execution, and full test suite execution.
6. **Execution History & Regression Comparison**: Chronological execution log with pass/fail filters, per-run detail inspection, and side-by-side Baseline vs Current regression deltas.
7. **Reports & Exports**: Live previews and downloads for CSV and 5-sheet Excel (`.xlsx`) workbooks (`Executive Summary`, `Validation Summary`, `Failed Record Details`, `Field Mismatches`, `Orphan Records`).
8. **Settings & Theme**: Light/Dark theme switcher, comparison preferences, hybrid local persistence (Express API + browser `localStorage`) with zero external setup required, and demo reset confirmation.

## Project Structure

```text
├── public/sample-data/          # Clean and dirty sample CSV pairs
├── python-validation/           # Standalone Python, Pandas & Pytest QA module
├── server/index.ts              # Express server with local JSON persistence & Vite SSR/static serving
├── src/
│   ├── components/              # LayoutShell, ConfirmDialog, StatusIndicator
│   ├── data/                    # Sample CSV strings, default test cases, default settings
│   ├── engine/                  # csvParser, schemaDetector, validationEngine, reconciliationEngine, testSuiteEngine, reportGenerator
│   ├── hooks/                   # useDataGuardStore
│   ├── pages/                   # All 8 application pages
│   ├── services/                # Hybrid localStorage + Express persistence
│   └── types/                   # TypeScript interfaces
└── tests/                       # Vitest automated test suites
```

## Quick Start (Local Development)

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Running Automated Tests

### Frontend & Engine Tests (Vitest)

```bash
npm test
```

### Type Check & Production Build

```bash
npm run lint
npm run build
npm start
```

### Python Automation Module (Standalone CLI)

```bash
cd python-validation
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest -v
```

> Note: The Python/Pandas/Pytest module is a standalone QA verification suite and executes via Python CLI/CI, not inside the browser React bundle.

## GitHub Push Instructions (`dataguard-ai`)

```bash
git init
git add .
git commit -m "Initial commit: DataGuard AI Enterprise Data Quality & ETL Testing Platform"
git branch -M main
git remote add origin https://github.com/<your-username>/dataguard-ai.git
git push -u origin main
```

## Deployment Instructions

- **Full-Stack Node.js Hosting (Render, Railway, Cloud Run, Fly.io)**:
  - Build Command: `npm install && npm run build`
  - Start Command: `npm start`
  - Port: `3000` (or `process.env.PORT`)
- **Static Frontend Hosting (Vercel, Netlify, GitHub Pages)**:
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Note: Client-side `localStorage` persistence works automatically when Express API routes are not present.

## Responsive & Screenshot Verification Checklist

Verify all 8 pages at **390px (mobile)**, **768px (tablet)**, and **1440px (desktop)**:
1. Overview Dashboard
2. Data Sources
3. Data Validation
4. ETL Reconciliation
5. Test Case Management
6. Test Execution History
7. Reports & Exports
8. Settings
