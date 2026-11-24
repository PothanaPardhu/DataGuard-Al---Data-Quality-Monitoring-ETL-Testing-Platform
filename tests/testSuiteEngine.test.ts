import { describe, expect, it } from 'vitest';
import {
  CLEAN_SOURCE_CSV,
  CLEAN_TARGET_CSV,
  DIRTY_SOURCE_CSV,
  DIRTY_TARGET_CSV,
  getDefaultTestCases,
} from '../src/data/sampleDatasets';
import { buildDatasetFromCsv, suggestValidationConfig } from '../src/engine/schemaDetector';
import { evaluateTestCase, executeTestSuite } from '../src/engine/testSuiteEngine';

describe('testSuiteEngine', () => {
  it('passes all 10 default test cases on clean source and target datasets', () => {
    const src = buildDatasetFromCsv({
      id: 'cs',
      role: 'source',
      name: 'clean_source.csv',
      fileName: 'clean_source.csv',
      csvContent: CLEAN_SOURCE_CSV,
    }).dataset!;
    const tgt = buildDatasetFromCsv({
      id: 'ct',
      role: 'target',
      name: 'clean_target.csv',
      fileName: 'clean_target.csv',
      csvContent: CLEAN_TARGET_CSV,
    }).dataset!;

    const valConfig = suggestValidationConfig(src);
    const recConfig = {
      primaryKey: 'transaction_id',
      compareColumns: src.headers.filter((h) => h !== 'transaction_id'),
      numericTolerance: 0.01,
      trimWhitespace: true,
      caseSensitive: false,
    };

    const suite = executeTestSuite({
      testCases: getDefaultTestCases(),
      trigger: 'Full Suite',
      sourceDataset: src,
      targetDataset: tgt,
      validationConfig: valConfig,
      reconciliationConfig: recConfig,
    });

    expect(suite.run.status).toBe('PASS');
    expect(suite.run.passedTests).toBe(10);
    expect(suite.run.failedTests).toBe(0);
    expect(suite.run.qualityScore).toBe(100);
  });

  it('captures expected failures on dirty datasets and supports single test evaluation', () => {
    const src = buildDatasetFromCsv({
      id: 'ds',
      role: 'source',
      name: 'dirty_source.csv',
      fileName: 'dirty_source.csv',
      csvContent: DIRTY_SOURCE_CSV,
    }).dataset!;
    const tgt = buildDatasetFromCsv({
      id: 'dt',
      role: 'target',
      name: 'dirty_target.csv',
      fileName: 'dirty_target.csv',
      csvContent: DIRTY_TARGET_CSV,
    }).dataset!;

    const valConfig = suggestValidationConfig(src);
    const recConfig = {
      primaryKey: 'transaction_id',
      compareColumns: src.headers.filter((h) => h !== 'transaction_id'),
      numericTolerance: 0.01,
      trimWhitespace: true,
      caseSensitive: false,
    };

    const tests = getDefaultTestCases();
    const suite = executeTestSuite({
      testCases: tests,
      trigger: 'Full Suite',
      sourceDataset: src,
      targetDataset: tgt,
      validationConfig: valConfig,
      reconciliationConfig: recConfig,
    });

    expect(suite.run.status).toBe('FAIL');
    expect(suite.run.passedTests).toBe(2); // non_empty and required_columns pass
    expect(suite.run.failedTests).toBe(8);

    const single = evaluateTestCase(
      tests[9], // TC-ETL-010
      src,
      tgt,
      valConfig,
      recConfig
    );
    expect(single.status).toBe('FAIL');
    expect(single.failedRecords).toBe(8);
  });
});
