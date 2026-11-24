import { describe, expect, it } from 'vitest';
import {
  CLEAN_SOURCE_CSV,
  CLEAN_TARGET_CSV,
  DIRTY_SOURCE_CSV,
  DIRTY_TARGET_CSV,
} from '../src/data/sampleDatasets';
import { runReconciliationEngine } from '../src/engine/reconciliationEngine';
import { buildDatasetFromCsv } from '../src/engine/schemaDetector';

describe('reconciliationEngine', () => {
  it('achieves 100% match rate on clean source and target datasets', () => {
    const src = buildDatasetFromCsv({
      id: 'c-s',
      role: 'source',
      name: 'clean_source.csv',
      fileName: 'clean_source.csv',
      csvContent: CLEAN_SOURCE_CSV,
    }).dataset!;
    const tgt = buildDatasetFromCsv({
      id: 'c-t',
      role: 'target',
      name: 'clean_target.csv',
      fileName: 'clean_target.csv',
      csvContent: CLEAN_TARGET_CSV,
    }).dataset!;

    const summary = runReconciliationEngine(src, tgt, {
      primaryKey: 'transaction_id',
      compareColumns: src.headers.filter((h) => h !== 'transaction_id'),
      numericTolerance: 0.01,
      trimWhitespace: true,
      caseSensitive: false,
    });

    expect(summary.reconciliationMatchRate).toBe(100);
    expect(summary.matchingRecords).toBe(20);
    expect(summary.mismatchedRecords).toBe(0);
    expect(summary.missingInTargetCount).toBe(0);
    expect(summary.extraInTargetCount).toBe(0);
  });

  it('detects missing records, extra records, and field-level mismatches in dirty datasets', () => {
    const src = buildDatasetFromCsv({
      id: 'd-s',
      role: 'source',
      name: 'dirty_source.csv',
      fileName: 'dirty_source.csv',
      csvContent: DIRTY_SOURCE_CSV,
    }).dataset!;
    const tgt = buildDatasetFromCsv({
      id: 'd-t',
      role: 'target',
      name: 'dirty_target.csv',
      fileName: 'dirty_target.csv',
      csvContent: DIRTY_TARGET_CSV,
    }).dataset!;

    const summary = runReconciliationEngine(src, tgt, {
      primaryKey: 'transaction_id',
      compareColumns: src.headers.filter((h) => h !== 'transaction_id'),
      numericTolerance: 0.01,
      trimWhitespace: true,
      caseSensitive: false,
    });

    expect(summary.missingInTargetCount).toBe(3);
    expect(summary.extraInTargetCount).toBe(2);
    expect(summary.mismatchedRecords).toBe(3);

    const missingKeys = summary.orphanRecords
      .filter((o) => o.side === 'MISSING_IN_TARGET')
      .map((o) => o.primaryKey);
    expect(missingKeys).toEqual(
      expect.arrayContaining(['TXN-1008', 'TXN-1012', 'TXN-1015'])
    );

    const extraKeys = summary.orphanRecords
      .filter((o) => o.side === 'EXTRA_IN_TARGET')
      .map((o) => o.primaryKey);
    expect(extraKeys).toEqual(expect.arrayContaining(['TXN-9001', 'TXN-9002']));

    // TXN-1022 (500.00 vs 500.004) should match within 0.01 tolerance
    // TXN-1023 ("  EMEA  " vs "emea") should match with trimWhitespace + !caseSensitive
    const txn1022 = summary.comparisons.find((c) => c.primaryKey === 'TXN-1022');
    const txn1023 = summary.comparisons.find((c) => c.primaryKey === 'TXN-1023');
    expect(txn1022?.status).toBe('MATCH');
    expect(txn1023?.status).toBe('MATCH');
  });

  it('respects strict tolerance=0 and caseSensitive=true when configured', () => {
    const src = buildDatasetFromCsv({
      id: 'd-s2',
      role: 'source',
      name: 'dirty_source.csv',
      fileName: 'dirty_source.csv',
      csvContent: DIRTY_SOURCE_CSV,
    }).dataset!;
    const tgt = buildDatasetFromCsv({
      id: 'd-t2',
      role: 'target',
      name: 'dirty_target.csv',
      fileName: 'dirty_target.csv',
      csvContent: DIRTY_TARGET_CSV,
    }).dataset!;

    const strictSummary = runReconciliationEngine(src, tgt, {
      primaryKey: 'transaction_id',
      compareColumns: src.headers.filter((h) => h !== 'transaction_id'),
      numericTolerance: 0,
      trimWhitespace: false,
      caseSensitive: true,
    });

    const txn1022 = strictSummary.comparisons.find((c) => c.primaryKey === 'TXN-1022');
    const txn1023 = strictSummary.comparisons.find((c) => c.primaryKey === 'TXN-1023');
    expect(txn1022?.status).toBe('MISMATCH');
    expect(txn1023?.status).toBe('MISMATCH');
  });
});
