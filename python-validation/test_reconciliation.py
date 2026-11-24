from pathlib import Path
import pandas as pd
from reconciliation import reconcile_datasets

SAMPLE_DIR = Path(__file__).resolve().parent.parent / "public" / "sample-data"


def test_clean_source_target_reconciliation_100_percent():
    src = pd.read_csv(SAMPLE_DIR / "clean_source.csv", dtype=str, keep_default_na=False)
    tgt = pd.read_csv(SAMPLE_DIR / "clean_target.csv", dtype=str, keep_default_na=False)
    summary = reconcile_datasets(src, tgt, primary_key="transaction_id")

    assert summary["reconciliation_match_rate"] == 100.0
    assert summary["mismatched_records"] == 0
    assert summary["missing_in_target"] == []
    assert summary["extra_in_target"] == []


def test_dirty_source_target_reconciliation_detects_orphans_and_mismatches():
    src = pd.read_csv(SAMPLE_DIR / "dirty_source.csv", dtype=str, keep_default_na=False)
    tgt = pd.read_csv(SAMPLE_DIR / "dirty_target.csv", dtype=str, keep_default_na=False)
    summary = reconcile_datasets(
        src,
        tgt,
        primary_key="transaction_id",
        numeric_tolerance=0.01,
        trim_whitespace=True,
        case_sensitive=False,
    )

    assert "TXN-1008" in summary["missing_in_target"]
    assert "TXN-1012" in summary["missing_in_target"]
    assert "TXN-1015" in summary["missing_in_target"]
    assert "TXN-9001" in summary["extra_in_target"]
    assert "TXN-9002" in summary["extra_in_target"]
    assert summary["mismatched_records"] >= 3
    assert len(summary["field_mismatches"]) >= 3
