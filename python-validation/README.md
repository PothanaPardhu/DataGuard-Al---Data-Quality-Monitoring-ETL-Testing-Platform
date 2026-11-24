# DataGuard AI – Python Validation & ETL Reconciliation Module

Standalone Python, Pandas, and Pytest automation suite mirroring the data quality and ETL reconciliation checks used in DataGuard AI.

> Note: This Python module runs independently in a Python environment (CLI / CI pipeline). It does not execute inside the browser React application.

## Setup & Installation

```bash
cd python-validation
python3 -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Running Automated Pytest Suite

```bash
pytest -v
```

## Included Files

- `validation.py` — Missing values, duplicate rows, required columns, primary key uniqueness, email syntax, numeric/negative amount, and calendar date validation using Pandas.
- `reconciliation.py` — Source-to-target primary key reconciliation with missing/extra orphan detection, numeric tolerance, whitespace trimming, and case sensitivity options.
- `test_validation.py` — Pytest assertions against `../public/sample-data/clean_source.csv` and `../public/sample-data/dirty_source.csv`.
- `test_reconciliation.py` — Pytest assertions against clean and dirty source/target sample pairs.
