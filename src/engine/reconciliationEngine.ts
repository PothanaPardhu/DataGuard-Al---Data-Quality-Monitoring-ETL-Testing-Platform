import {
  DatasetRecord,
  FieldMismatch,
  OrphanRecord,
  ReconciliationConfig,
  ReconciliationSummary,
  RecordComparisonItem,
} from '../types/dataguard';
import { isNullLike, isNumericValue } from './schemaDetector';

function normalizeKey(value: string, config: ReconciliationConfig): string {
  let v = value ?? '';
  if (config.trimWhitespace) v = v.trim();
  if (!config.caseSensitive) v = v.toLowerCase();
  return v;
}

function valuesMatch(
  rawSource: string,
  rawTarget: string,
  config: ReconciliationConfig
): { match: boolean; numericDifference: number | null } {
  const sStr = config.trimWhitespace ? (rawSource ?? '').trim() : (rawSource ?? '');
  const tStr = config.trimWhitespace ? (rawTarget ?? '').trim() : (rawTarget ?? '');

  // Both null-like -> treat as equal
  if (isNullLike(sStr) && isNullLike(tStr)) {
    return { match: true, numericDifference: null };
  }

  // Numeric comparison with tolerance if both are numeric
  if (isNumericValue(sStr) && isNumericValue(tStr)) {
    const sNum = Number(sStr);
    const tNum = Number(tStr);
    const diff = Math.abs(sNum - tNum);
    return {
      match: diff <= config.numericTolerance,
      numericDifference: Math.round(diff * 1000000) / 1000000,
    };
  }

  const sCmp = config.caseSensitive ? sStr : sStr.toLowerCase();
  const tCmp = config.caseSensitive ? tStr : tStr.toLowerCase();
  return {
    match: sCmp === tCmp,
    numericDifference: null,
  };
}

export function runReconciliationEngine(
  source: DatasetRecord | null,
  target: DatasetRecord | null,
  config: ReconciliationConfig
): ReconciliationSummary {
  const executedAt = new Date().toISOString();
  const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (!source || !target) {
    return {
      id,
      executedAt,
      sourceName: source?.name ?? 'No Source Loaded',
      targetName: target?.name ?? 'No Target Loaded',
      primaryKey: config.primaryKey,
      sourceCount: source?.rowCount ?? 0,
      targetCount: target?.rowCount ?? 0,
      matchingRecords: 0,
      mismatchedRecords: 0,
      missingInTargetCount: 0,
      extraInTargetCount: 0,
      duplicateKeysInSource: [],
      duplicateKeysInTarget: [],
      reconciliationMatchRate: 0,
      fieldMismatches: [],
      orphanRecords: [],
      comparisons: [],
      config,
    };
  }

  const pk = config.primaryKey;
  const compareColumns =
    config.compareColumns.length > 0
      ? config.compareColumns
      : source.headers.filter((h) => h !== pk && target.headers.includes(h));

  // Build indexed maps while tracking duplicate keys
  const sourceMap = new Map<
    string,
    { rawKey: string; rowIndex: number; row: Record<string, string> }
  >();
  const duplicateKeysInSource: string[] = [];

  source.rows.forEach((row, idx) => {
    const rawKey = row[pk] ?? '';
    const normKey = normalizeKey(rawKey, config);
    if (!normKey) return;
    if (sourceMap.has(normKey)) {
      duplicateKeysInSource.push(rawKey);
    } else {
      sourceMap.set(normKey, { rawKey, rowIndex: idx + 1, row });
    }
  });

  const targetMap = new Map<
    string,
    { rawKey: string; rowIndex: number; row: Record<string, string> }
  >();
  const duplicateKeysInTarget: string[] = [];

  target.rows.forEach((row, idx) => {
    const rawKey = row[pk] ?? '';
    const normKey = normalizeKey(rawKey, config);
    if (!normKey) return;
    if (targetMap.has(normKey)) {
      duplicateKeysInTarget.push(rawKey);
    } else {
      targetMap.set(normKey, { rawKey, rowIndex: idx + 1, row });
    }
  });

  const fieldMismatches: FieldMismatch[] = [];
  const orphanRecords: OrphanRecord[] = [];
  const comparisons: RecordComparisonItem[] = [];

  let matchingRecords = 0;
  let mismatchedRecords = 0;
  let missingInTargetCount = 0;
  let extraInTargetCount = 0;

  // Iterate through source records
  for (const [normKey, srcEntry] of sourceMap.entries()) {
    const tgtEntry = targetMap.get(normKey);
    if (!tgtEntry) {
      missingInTargetCount++;
      orphanRecords.push({
        primaryKey: srcEntry.rawKey,
        side: 'MISSING_IN_TARGET',
        rowIndex: srcEntry.rowIndex,
        data: srcEntry.row,
      });
      comparisons.push({
        primaryKey: srcEntry.rawKey,
        status: 'MISSING_IN_TARGET',
        sourceRowIndex: srcEntry.rowIndex,
        targetRowIndex: null,
        mismatchedFields: [],
        sourceData: srcEntry.row,
        targetData: null,
      });
      continue;
    }

    const mismatchedFields: string[] = [];
    for (const col of compareColumns) {
      const sVal = srcEntry.row[col] ?? '';
      const tVal = tgtEntry.row[col] ?? '';
      const cmp = valuesMatch(sVal, tVal, config);
      if (!cmp.match) {
        mismatchedFields.push(col);
        fieldMismatches.push({
          primaryKey: srcEntry.rawKey,
          field: col,
          sourceValue: sVal,
          targetValue: tVal,
          numericDifference: cmp.numericDifference,
          sourceRowIndex: srcEntry.rowIndex,
          targetRowIndex: tgtEntry.rowIndex,
        });
      }
    }

    if (mismatchedFields.length === 0) {
      matchingRecords++;
      comparisons.push({
        primaryKey: srcEntry.rawKey,
        status: 'MATCH',
        sourceRowIndex: srcEntry.rowIndex,
        targetRowIndex: tgtEntry.rowIndex,
        mismatchedFields: [],
        sourceData: srcEntry.row,
        targetData: tgtEntry.row,
      });
    } else {
      mismatchedRecords++;
      comparisons.push({
        primaryKey: srcEntry.rawKey,
        status: 'MISMATCH',
        sourceRowIndex: srcEntry.rowIndex,
        targetRowIndex: tgtEntry.rowIndex,
        mismatchedFields,
        sourceData: srcEntry.row,
        targetData: tgtEntry.row,
      });
    }
  }

  // Extra records present in target but missing in source
  for (const [normKey, tgtEntry] of targetMap.entries()) {
    if (!sourceMap.has(normKey)) {
      extraInTargetCount++;
      orphanRecords.push({
        primaryKey: tgtEntry.rawKey,
        side: 'EXTRA_IN_TARGET',
        rowIndex: tgtEntry.rowIndex,
        data: tgtEntry.row,
      });
      comparisons.push({
        primaryKey: tgtEntry.rawKey,
        status: 'EXTRA_IN_TARGET',
        sourceRowIndex: null,
        targetRowIndex: tgtEntry.rowIndex,
        mismatchedFields: [],
        sourceData: null,
        targetData: tgtEntry.row,
      });
    }
  }

  const totalUniqueUnion =
    matchingRecords + mismatchedRecords + missingInTargetCount + extraInTargetCount;
  const reconciliationMatchRate =
    totalUniqueUnion === 0
      ? 0
      : Math.round((matchingRecords / totalUniqueUnion) * 1000) / 10;

  return {
    id,
    executedAt,
    sourceName: source.name,
    targetName: target.name,
    primaryKey: pk,
    sourceCount: source.rowCount,
    targetCount: target.rowCount,
    matchingRecords,
    mismatchedRecords,
    missingInTargetCount,
    extraInTargetCount,
    duplicateKeysInSource,
    duplicateKeysInTarget,
    reconciliationMatchRate,
    fieldMismatches,
    orphanRecords,
    comparisons,
    config,
  };
}
