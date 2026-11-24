import re
from datetime import datetime
from typing import Any, Dict, List, Optional
import pandas as pd


NULL_TOKENS = {"", "null", "na", "n/a", "nan", "none", "undefined"}
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def is_null_like(val: Any) -> bool:
    if pd.isna(val):
        return True
    return str(val).strip().lower() in NULL_TOKENS


def validate_non_empty(df: pd.DataFrame) -> Dict[str, Any]:
    passed = not df.empty and len(df.columns) > 0
    return {
        "rule": "non_empty",
        "records_checked": max(1, len(df)),
        "passed_records": len(df) if passed else 0,
        "failed_records": 0 if passed else 1,
        "status": "PASS" if passed else "FAIL",
        "errors": [] if passed else [{"row": 0, "reason": "Dataset is empty."}],
    }


def validate_required_columns(df: pd.DataFrame, required_columns: List[str]) -> Dict[str, Any]:
    missing = [col for col in required_columns if col not in df.columns]
    errors = [{"column": col, "reason": f"Missing required column: {col}"} for col in missing]
    checked = max(1, len(required_columns))
    failed = len(missing)
    return {
        "rule": "required_columns",
        "records_checked": checked,
        "passed_records": max(0, checked - failed),
        "failed_records": failed,
        "status": "PASS" if failed == 0 else "FAIL",
        "errors": errors,
    }


def validate_missing_values(df: pd.DataFrame) -> Dict[str, Any]:
    errors = []
    failed_rows = set()
    for idx, row in df.iterrows():
        for col in df.columns:
            if is_null_like(row[col]):
                failed_rows.add(idx)
                errors.append({
                    "row": int(idx) + 1,
                    "column": col,
                    "value": "" if pd.isna(row[col]) else str(row[col]),
                    "reason": f"Missing or null value in {col}",
                })
    checked = len(df)
    failed = len(failed_rows)
    return {
        "rule": "missing_null",
        "records_checked": checked,
        "passed_records": max(0, checked - failed),
        "failed_records": failed,
        "status": "PASS" if failed == 0 else "FAIL",
        "errors": errors,
    }


def validate_duplicates(df: pd.DataFrame) -> Dict[str, Any]:
    dup_mask = df.duplicated(keep="first")
    errors = [
        {"row": int(idx) + 1, "reason": "Exact duplicate row"}
        for idx in df.index[dup_mask]
    ]
    checked = len(df)
    failed = int(dup_mask.sum())
    return {
        "rule": "duplicate_rows",
        "records_checked": checked,
        "passed_records": max(0, checked - failed),
        "failed_records": failed,
        "status": "PASS" if failed == 0 else "FAIL",
        "errors": errors,
    }


def validate_primary_key_uniqueness(df: pd.DataFrame, primary_key: str) -> Dict[str, Any]:
    if primary_key not in df.columns:
        return {
            "rule": "primary_key_unique",
            "records_checked": len(df) or 1,
            "passed_records": 0,
            "failed_records": len(df) or 1,
            "status": "FAIL",
            "errors": [{"row": 0, "reason": f"Primary key column '{primary_key}' missing."}],
        }

    seen = {}
    errors = []
    failed_rows = set()
    for idx, val in enumerate(df[primary_key]):
        if is_null_like(val):
            failed_rows.add(idx)
            errors.append({"row": idx + 1, "column": primary_key, "reason": "Null primary key"})
            continue
        key = str(val).strip()
        if key in seen:
            failed_rows.add(idx)
            errors.append({
                "row": idx + 1,
                "column": primary_key,
                "value": key,
                "reason": f"Duplicate primary key '{key}' (first seen at row {seen[key]})",
            })
        else:
            seen[key] = idx + 1

    checked = len(df)
    failed = len(failed_rows)
    return {
        "rule": "primary_key_unique",
        "records_checked": checked,
        "passed_records": max(0, checked - failed),
        "failed_records": failed,
        "status": "PASS" if failed == 0 else "FAIL",
        "errors": errors,
    }


def validate_emails(df: pd.DataFrame, email_col: str = "email") -> Dict[str, Any]:
    if email_col not in df.columns:
        return {
            "rule": "email_format",
            "records_checked": 0,
            "passed_records": 0,
            "failed_records": 0,
            "status": "SKIPPED",
            "errors": [],
        }
    errors = []
    for idx, val in enumerate(df[email_col]):
        if is_null_like(val):
            continue
        s = str(val).strip()
        if not EMAIL_REGEX.match(s):
            errors.append({
                "row": idx + 1,
                "column": email_col,
                "value": s,
                "reason": f"Invalid email format: {s}",
            })
    checked = len(df)
    failed = len(errors)
    return {
        "rule": "email_format",
        "records_checked": checked,
        "passed_records": max(0, checked - failed),
        "failed_records": failed,
        "status": "PASS" if failed == 0 else "FAIL",
        "errors": errors,
    }


def validate_amounts(df: pd.DataFrame, amount_col: str = "amount") -> Dict[str, Any]:
    if amount_col not in df.columns:
        return {
            "rule": "negative_amount",
            "records_checked": 0,
            "passed_records": 0,
            "failed_records": 0,
            "status": "SKIPPED",
            "errors": [],
        }
    errors = []
    for idx, val in enumerate(df[amount_col]):
        if is_null_like(val):
            continue
        s = str(val).strip()
        try:
            num = float(s)
        except ValueError:
            errors.append({
                "row": idx + 1,
                "column": amount_col,
                "value": s,
                "reason": f"Non-numeric amount: {s}",
            })
            continue
        if num < 0:
            errors.append({
                "row": idx + 1,
                "column": amount_col,
                "value": s,
                "reason": f"Negative amount not permitted: {s}",
            })
    checked = len(df)
    failed = len(errors)
    return {
        "rule": "negative_amount",
        "records_checked": checked,
        "passed_records": max(0, checked - failed),
        "failed_records": failed,
        "status": "PASS" if failed == 0 else "FAIL",
        "errors": errors,
    }


def is_valid_calendar_date(value: str) -> bool:
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            datetime.strptime(value, fmt)
            return True
        except ValueError:
            continue
    return False


def validate_dates(df: pd.DataFrame, date_col: str = "transaction_date") -> Dict[str, Any]:
    if date_col not in df.columns:
        return {
            "rule": "date_format",
            "records_checked": 0,
            "passed_records": 0,
            "failed_records": 0,
            "status": "SKIPPED",
            "errors": [],
        }
    errors = []
    for idx, val in enumerate(df[date_col]):
        if is_null_like(val):
            continue
        s = str(val).strip()
        if not is_valid_calendar_date(s):
            errors.append({
                "row": idx + 1,
                "column": date_col,
                "value": s,
                "reason": f"Invalid calendar date: {s}",
            })
    checked = len(df)
    failed = len(errors)
    return {
        "rule": "date_format",
        "records_checked": checked,
        "passed_records": max(0, checked - failed),
        "failed_records": failed,
        "status": "PASS" if failed == 0 else "FAIL",
        "errors": errors,
    }


def run_all_validations(
    df: pd.DataFrame,
    required_columns: Optional[List[str]] = None,
    primary_key: str = "transaction_id",
    email_col: str = "email",
    amount_col: str = "amount",
    date_col: str = "transaction_date",
) -> Dict[str, Any]:
    req_cols = required_columns or [
        "transaction_id",
        "customer_id",
        "email",
        "transaction_date",
        "amount",
    ]
    results = [
        validate_non_empty(df),
        validate_required_columns(df, req_cols),
        validate_missing_values(df),
        validate_duplicates(df),
        validate_primary_key_uniqueness(df, primary_key),
        validate_emails(df, email_col),
        validate_amounts(df, amount_col),
        validate_dates(df, date_col),
    ]
    failed_rules = [r for r in results if r["status"] == "FAIL"]
    return {
        "total_rows": len(df),
        "rules_executed": len([r for r in results if r["status"] != "SKIPPED"]),
        "failed_rules": len(failed_rules),
        "overall_status": "PASS" if len(failed_rules) == 0 else "FAIL",
        "results": results,
    }
