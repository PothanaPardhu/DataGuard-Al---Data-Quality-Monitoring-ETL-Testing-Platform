import {
  DatasetRecord,
  ReconciliationConfig,
  ReconciliationSummary,
  TestCase,
  TestCaseExecutionDetail,
  TestExecutionRun,
  ValidationConfig,
  ValidationSummary,
} from '../types/dataguard';
import { runReconciliationEngine } from './reconciliationEngine';
import { runValidationEngine } from './validationEngine';

export function evaluateTestCase(
  testCase: TestCase,
  sourceDataset: DatasetRecord | null,
  targetDataset: DatasetRecord | null,
  validationConfig: ValidationConfig,
  reconciliationConfig: ReconciliationConfig,
  cachedSourceVal?: ValidationSummary,
  cachedTargetVal?: ValidationSummary,
  cachedReconciliation?: ReconciliationSummary
): TestCaseExecutionDetail {
  if (testCase.ruleTarget === 'etl_reconciliation') {
    const rec =
      cachedReconciliation ??
      runReconciliationEngine(sourceDataset, targetDataset, reconciliationConfig);
    const totalIssues =
      rec.mismatchedRecords + rec.missingInTargetCount + rec.extraInTargetCount;
    const passed =
      sourceDataset !== null &&
      targetDataset !== null &&
      totalIssues === 0 &&
      rec.duplicateKeysInSource.length === 0 &&
      rec.duplicateKeysInTarget.length === 0;

    return {
      testCaseId: testCase.id,
      testId: testCase.testId,
      title: testCase.title,
      category: testCase.category,
      severity: testCase.severity,
      ruleTarget: testCase.ruleTarget,
      status: passed ? 'PASS' : 'FAIL',
      expectedResult: testCase.expectedResult,
      actualResult:
        !sourceDataset || !targetDataset
          ? 'Source or target dataset not loaded.'
          : `${rec.matchingRecords} matched, ${rec.mismatchedRecords} mismatched, ${rec.missingInTargetCount} missing in target, ${rec.extraInTargetCount} extra in target (${rec.reconciliationMatchRate}% match rate).`,
      recordsChecked: Math.max(rec.sourceCount, rec.targetCount),
      failedRecords: totalIssues,
    };
  }

  const targetDatasetToCheck =
    testCase.datasetTarget === 'target' ? targetDataset : sourceDataset;

  const val =
    testCase.datasetTarget === 'target'
      ? cachedTargetVal ??
        runValidationEngine(targetDatasetToCheck, {
          ...validationConfig,
          targetRole: 'target',
          enabledRules: {
            ...validationConfig.enabledRules,
            [testCase.ruleTarget]: true,
          },
        })
      : cachedSourceVal ??
        runValidationEngine(targetDatasetToCheck, {
          ...validationConfig,
          targetRole: 'source',
          enabledRules: {
            ...validationConfig.enabledRules,
            [testCase.ruleTarget]: true,
          },
        });

  const ruleResult = val.ruleResults.find((r) => r.ruleId === testCase.ruleTarget);
  const status = ruleResult?.status === 'PASS' ? 'PASS' : 'FAIL';

  return {
    testCaseId: testCase.id,
    testId: testCase.testId,
    title: testCase.title,
    category: testCase.category,
    severity: testCase.severity,
    ruleTarget: testCase.ruleTarget,
    status,
    expectedResult: testCase.expectedResult,
    actualResult: ruleResult
      ? ruleResult.status === 'SKIPPED'
        ? `Rule skipped: no matching columns configured.`
        : `${ruleResult.passedRecords}/${ruleResult.recordsChecked} records passed, ${ruleResult.failedRecords} failed (${ruleResult.passRate}%).`
      : 'Rule not evaluated.',
    recordsChecked: ruleResult?.recordsChecked ?? 0,
    failedRecords: ruleResult?.failedRecords ?? 0,
  };
}

export function executeTestSuite(params: {
  testCases: TestCase[];
  trigger: TestExecutionRun['trigger'];
  sourceDataset: DatasetRecord | null;
  targetDataset: DatasetRecord | null;
  validationConfig: ValidationConfig;
  reconciliationConfig: ReconciliationConfig;
}): {
  run: TestExecutionRun;
  updatedTestCases: TestCase[];
  sourceValidation: ValidationSummary;
  reconciliation: ReconciliationSummary;
} {
  const {
    testCases,
    trigger,
    sourceDataset,
    targetDataset,
    validationConfig,
    reconciliationConfig,
  } = params;

  const allEnabledConfig: ValidationConfig = {
    ...validationConfig,
    enabledRules: {
      non_empty: true,
      required_columns: true,
      missing_null: true,
      duplicate_rows: true,
      primary_key_unique: true,
      data_type: true,
      email_format: true,
      negative_amount: true,
      date_format: true,
    },
  };

  const sourceValidation = runValidationEngine(sourceDataset, {
    ...allEnabledConfig,
    targetRole: 'source',
  });
  const targetValidation = runValidationEngine(targetDataset, {
    ...allEnabledConfig,
    targetRole: 'target',
  });
  const reconciliation = runReconciliationEngine(
    sourceDataset,
    targetDataset,
    reconciliationConfig
  );

  const details = testCases.map((tc) =>
    evaluateTestCase(
      tc,
      sourceDataset,
      targetDataset,
      validationConfig,
      reconciliationConfig,
      sourceValidation,
      targetValidation,
      reconciliation
    )
  );

  const executedAt = new Date().toISOString();
  const passedTests = details.filter((d) => d.status === 'PASS').length;
  const failedTests = details.filter((d) => d.status === 'FAIL').length;

  const updatedTestCases = testCases.map((tc) => {
    const match = details.find((d) => d.testCaseId === tc.id);
    if (!match) return tc;
    return {
      ...tc,
      lastStatus: match.status,
      lastExecutedAt: executedAt,
      lastActualResult: match.actualResult,
    };
  });

  const run: TestExecutionRun = {
    id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    executedAt,
    trigger,
    sourceDatasetName: sourceDataset?.name ?? 'None',
    targetDatasetName: targetDataset?.name ?? 'None',
    totalTests: details.length,
    passedTests,
    failedTests,
    qualityScore: sourceValidation.qualityScore,
    status: failedTests === 0 && details.length > 0 ? 'PASS' : 'FAIL',
    details,
  };

  return {
    run,
    updatedTestCases,
    sourceValidation,
    reconciliation,
  };
}
