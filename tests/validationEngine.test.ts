import { describe, expect, it } from 'vitest';
import { CLEAN_SOURCE_CSV, DIRTY_SOURCE_CSV } from '../src/data/sampleDatasets';
import { buildDatasetFromCsv, suggestValidationConfig } from '../src/engine/schemaDetector';
import { runValidationEngine } from '../src/engine/validationEngine';

describe('validationEngine', () => {
  it('passes all 9 validation rules on the clean sample dataset', () => {
    const { dataset, error } = buildDatasetFromCsv({
      id: 'clean-src',
      role: 'source',
      name: 'clean_source.csv',
      fileName: 'clean_source.csv',
      csvContent: CLEAN_SOURCE_CSV,
    });
    expect(error).toBeUndefined();
    expect(dataset).not.toBeNull();

    const config = suggestValidationConfig(dataset!);
    const summary = runValidationEngine(dataset, config);

    expect(summary.qualityScore).toBe(100);
    expect(summary.failedRules).toBe(0);
    expect(summary.allErrors).toHaveLength(0);
  });

  it('detects all injected anomalies in the dirty sample dataset', () => {
    const { dataset } = buildDatasetFromCsv({
      id: 'dirty-src',
      role: 'source',
      name: 'dirty_source.csv',
      fileName: 'dirty_source.csv',
      csvContent: DIRTY_SOURCE_CSV,
    });
    expect(dataset).not.toBeNull();

    const config = suggestValidationConfig(dataset!);
    const summary = runValidationEngine(dataset, config);

    const byRule = Object.fromEntries(summary.ruleResults.map((r) => [r.ruleId, r]));

    expect(byRule.non_empty.status).toBe('PASS');
    expect(byRule.required_columns.status).toBe('PASS');

    // Missing/null values: blank email, blank customer_id, NULL email, NA customer_id
    expect(byRule.missing_null.status).toBe('FAIL');
    expect(byRule.missing_null.failedRecords).toBe(4);

    // Exact duplicate row (TXN-1002 repeated)
    expect(byRule.duplicate_rows.status).toBe('FAIL');
    expect(byRule.duplicate_rows.failedRecords).toBe(1);

    // Duplicate primary keys (TXN-1002 + TXN-1004)
    expect(byRule.primary_key_unique.status).toBe('FAIL');
    expect(byRule.primary_key_unique.failedRecords).toBe(2);

    // Data type validation (non-numeric amounts + invalid dates + invalid emails)
    expect(byRule.data_type.status).toBe('FAIL');
    expect(byRule.data_type.failedRecords).toBeGreaterThanOrEqual(5);

    // Email format validation (3 malformed emails)
    expect(byRule.email_format.status).toBe('FAIL');
    expect(byRule.email_format.failedRecords).toBe(3);

    // Negative / non-numeric amount validation (-450.00, -12.75, INVALID_AMT, USD_500)
    expect(byRule.negative_amount.status).toBe('FAIL');
    expect(byRule.negative_amount.failedRecords).toBe(4);

    // Calendar date validation (2026-02-30, 2026-13-05, not-a-date)
    expect(byRule.date_format.status).toBe('FAIL');
    expect(byRule.date_format.failedRecords).toBe(3);

    expect(summary.qualityScore).toBeLessThan(100);
  });

  it('fails required_columns when a configured column is absent', () => {
    const { dataset } = buildDatasetFromCsv({
      id: 'partial',
      role: 'source',
      name: 'partial.csv',
      fileName: 'partial.csv',
      csvContent: 'transaction_id,amount\nTXN-1,100',
    });
    const config = suggestValidationConfig(dataset!);
    config.requiredColumns = ['transaction_id', 'amount', 'missing_col'];
    const summary = runValidationEngine(dataset, config);
    const reqRule = summary.ruleResults.find((r) => r.ruleId === 'required_columns');
    expect(reqRule?.status).toBe('FAIL');
    expect(reqRule?.failedRecords).toBe(1);
  });
});
