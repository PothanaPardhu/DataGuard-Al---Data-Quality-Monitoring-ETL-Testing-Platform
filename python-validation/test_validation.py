from pathlib import Path
import pandas as pd
from validation import (
    run_all_validations,
    validate_amounts,
    validate_dates,
    validate_duplicates,
    validate_emails,
    validate_missing_values,
    validate_primary_key_uniqueness,
)

SAMPLE_DIR = Path(__file__).resolve().parent.parent / "public" / "sample-data"


def test_clean_dataset_passes_all_validations():
    df = pd.read_csv(SAMPLE_DIR / "clean_source.csv", dtype=str, keep_default_na=False)
    report = run_all_validations(df)
    assert report["overall_status"] == "PASS"
    assert report["failed_rules"] == 0


def test_dirty_dataset_detects_missing_values():
    df = pd.read_csv(SAMPLE_DIR / "dirty_source.csv", dtype=str, keep_default_na=False)
    res = validate_missing_values(df)
    assert res["status"] == "FAIL"
    assert res["failed_records"] >= 4


def test_dirty_dataset_detects_duplicate_rows_and_primary_keys():
    df = pd.read_csv(SAMPLE_DIR / "dirty_source.csv", dtype=str, keep_default_na=False)
    dup_res = validate_duplicates(df)
    pk_res = validate_primary_key_uniqueness(df, "transaction_id")
    assert dup_res["status"] == "FAIL"
    assert dup_res["failed_records"] >= 1
    assert pk_res["status"] == "FAIL"
    assert pk_res["failed_records"] >= 2


def test_dirty_dataset_detects_invalid_emails_amounts_and_dates():
    df = pd.read_csv(SAMPLE_DIR / "dirty_source.csv", dtype=str, keep_default_na=False)
    email_res = validate_emails(df)
    amount_res = validate_amounts(df)
    date_res = validate_dates(df)

    assert email_res["status"] == "FAIL"
    assert email_res["failed_records"] == 3

    assert amount_res["status"] == "FAIL"
    assert amount_res["failed_records"] == 4

    assert date_res["status"] == "FAIL"
    assert date_res["failed_records"] == 3
