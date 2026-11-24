from typing import Any, Dict, List
import pandas as pd


def _normalize_str(val: Any, trim_whitespace: bool, case_sensitive: bool) -> str:
    if pd.isna(val):
        return ""
    s = str(val)
    if trim_whitespace:
        s = s.strip()
    if not case_sensitive:
        s = s.lower()
    return s


def _values_equal(
    src_val: Any,
    tgt_val: Any,
    numeric_tolerance: float,
    trim_whitespace: bool,
    case_sensitive: bool,
) -> bool:
    s_raw = "" if pd.isna(src_val) else str(src_val)
    t_raw = "" if pd.isna(tgt_val) else str(tgt_val)
    if trim_whitespace:
        s_raw = s_raw.strip()
        t_raw = t_raw.strip()

    try:
        s_num = float(s_raw)
        t_num = float(t_raw)
        return abs(s_num - t_num) <= numeric_tolerance
    except ValueError:
        pass

    s_cmp = s_raw if case_sensitive else s_raw.lower()
    t_cmp = t_raw if case_sensitive else t_raw.lower()
    return s_cmp == t_cmp


def reconcile_datasets(
    source_df: pd.DataFrame,
    target_df: pd.DataFrame,
    primary_key: str = "transaction_id",
    numeric_tolerance: float = 0.01,
    trim_whitespace: bool = True,
    case_sensitive: bool = False,
) -> Dict[str, Any]:
    if primary_key not in source_df.columns or primary_key not in target_df.columns:
        raise ValueError(f"Primary key '{primary_key}' must exist in both source and target.")

    compare_cols = [
        c for c in source_df.columns if c != primary_key and c in target_df.columns
    ]

    src_map: Dict[str, pd.Series] = {}
    for _, row in source_df.iterrows():
        k = _normalize_str(row[primary_key], trim_whitespace, case_sensitive)
        if k and k not in src_map:
            src_map[k] = row

    tgt_map: Dict[str, pd.Series] = {}
    for _, row in target_df.iterrows():
        k = _normalize_str(row[primary_key], trim_whitespace, case_sensitive)
        if k and k not in tgt_map:
            tgt_map[k] = row

    missing_in_target: List[str] = []
    extra_in_target: List[str] = []
    field_mismatches: List[Dict[str, Any]] = []
    matching_records = 0
    mismatched_records = 0

    for k, s_row in src_map.items():
        if k not in tgt_map:
            missing_in_target.append(str(s_row[primary_key]))
            continue
        t_row = tgt_map[k]
        row_diffs = []
        for col in compare_cols:
            if not _values_equal(
                s_row[col],
                t_row[col],
                numeric_tolerance,
                trim_whitespace,
                case_sensitive,
            ):
                row_diffs.append(col)
                field_mismatches.append({
                    "primary_key": str(s_row[primary_key]),
                    "field": col,
                    "source_value": "" if pd.isna(s_row[col]) else str(s_row[col]),
                    "target_value": "" if pd.isna(t_row[col]) else str(t_row[col]),
                })
        if row_diffs:
            mismatched_records += 1
        else:
            matching_records += 1

    for k, t_row in tgt_map.items():
        if k not in src_map:
            extra_in_target.append(str(t_row[primary_key]))

    total_union = (
        matching_records
        + mismatched_records
        + len(missing_in_target)
        + len(extra_in_target)
    )
    match_rate = round((matching_records / total_union) * 100, 1) if total_union else 0.0

    return {
        "source_count": len(source_df),
        "target_count": len(target_df),
        "matching_records": matching_records,
        "mismatched_records": mismatched_records,
        "missing_in_target": missing_in_target,
        "extra_in_target": extra_in_target,
        "field_mismatches": field_mismatches,
        "reconciliation_match_rate": match_rate,
    }
