export type PageId =
  | 'overview'
  | 'sources'
  | 'validation'
  | 'reconciliation'
  | 'test-cases'
  | 'history'
  | 'reports'
  | 'settings';

export type InferredDataType = 'number' | 'integer' | 'date' | 'email' | 'boolean' | 'string';

export interface ColumnSchema {
  name: string;
  inferredType: InferredDataType;
  nonNullCount: number;
  nullCount: number;
  uniqueCount: number;
  sampleValues: string[];
}

export interface DatasetRecord {
  id: string;
  role: 'source' | 'target';
  name: string;
  fileName: string;
  uploadedAt: string;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  columnCount: number;
  schema: ColumnSchema[];
  parseWarnings: string[];
  isSample?: boolean;
}

export type ValidationRuleId =
  | 'non_empty'
  | 'required_columns'
  | 'missing_null'
  | 'duplicate_rows'
  | 'primary_key_unique'
  | 'data_type'
  | 'email_format'
  | 'negative_amount'
  | 'date_format';

export type ValidationStatus = 'PASS' | 'FAIL' | 'SKIPPED';

export interface ValidationRowError {
  rowIndex: number; // 1-based data row index
  ruleId: ValidationRuleId;
  ruleName: string;
  column: string;
  value: string;
  reason: string;
  primaryKeyValue?: string;
}

export interface ValidationRuleResult {
  ruleId: ValidationRuleId;
  ruleName: string;
  description: string;
  recordsChecked: number;
  passedRecords: number;
  failedRecords: number;
  passRate: number;
  status: ValidationStatus;
  rowErrors: ValidationRowError[];
}

export interface ValidationConfig {
  targetRole: 'source' | 'target';
  enabledRules: Record<ValidationRuleId, boolean>;
  requiredColumns: string[];
  primaryKeyColumn: string;
  emailColumns: string[];
  amountColumns: string[];
  dateColumns: string[];
  expectedTypes: Record<string, InferredDataType>;
  trimWhitespace: boolean;
  caseSensitive: boolean;
}

export interface ValidationSummary {
  id: string;
  datasetId: string;
  datasetName: string;
  datasetRole: 'source' | 'target';
  executedAt: string;
  totalRows: number;
  totalRulesExecuted: number;
  passedRules: number;
  failedRules: number;
  totalChecksEvaluated: number;
  passedChecksCount: number;
  failedChecksCount: number;
  qualityScore: number;
  ruleResults: ValidationRuleResult[];
  allErrors: ValidationRowError[];
}

export interface ReconciliationConfig {
  primaryKey: string;
  compareColumns: string[];
  numericTolerance: number;
  trimWhitespace: boolean;
  caseSensitive: boolean;
}

export interface FieldMismatch {
  primaryKey: string;
  field: string;
  sourceValue: string;
  targetValue: string;
  numericDifference: number | null;
  sourceRowIndex: number;
  targetRowIndex: number;
}

export type ComparisonRecordStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'MISSING_IN_TARGET'
  | 'EXTRA_IN_TARGET';

export interface RecordComparisonItem {
  primaryKey: string;
  status: ComparisonRecordStatus;
  sourceRowIndex: number | null;
  targetRowIndex: number | null;
  mismatchedFields: string[];
  sourceData: Record<string, string> | null;
  targetData: Record<string, string> | null;
}

export interface OrphanRecord {
  primaryKey: string;
  side: 'MISSING_IN_TARGET' | 'EXTRA_IN_TARGET';
  rowIndex: number;
  data: Record<string, string>;
}

export interface ReconciliationSummary {
  id: string;
  executedAt: string;
  sourceName: string;
  targetName: string;
  primaryKey: string;
  sourceCount: number;
  targetCount: number;
  matchingRecords: number;
  mismatchedRecords: number;
  missingInTargetCount: number;
  extraInTargetCount: number;
  duplicateKeysInSource: string[];
  duplicateKeysInTarget: string[];
  reconciliationMatchRate: number;
  fieldMismatches: FieldMismatch[];
  orphanRecords: OrphanRecord[];
  comparisons: RecordComparisonItem[];
  config: ReconciliationConfig;
}

export type TestCaseCategory =
  | 'Completeness'
  | 'Uniqueness'
  | 'Validity'
  | 'Accuracy'
  | 'Reconciliation';

export type TestSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export type TestRuleTarget = ValidationRuleId | 'etl_reconciliation';

export interface TestCase {
  id: string;
  testId: string;
  title: string;
  description: string;
  category: TestCaseCategory;
  ruleTarget: TestRuleTarget;
  datasetTarget: 'source' | 'target' | 'both';
  expectedResult: string;
  severity: TestSeverity;
  lastStatus?: 'PASS' | 'FAIL' | 'NOT_RUN';
  lastExecutedAt?: string;
  lastActualResult?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestCaseExecutionDetail {
  testCaseId: string;
  testId: string;
  title: string;
  category: TestCaseCategory;
  severity: TestSeverity;
  ruleTarget: TestRuleTarget;
  status: 'PASS' | 'FAIL';
  expectedResult: string;
  actualResult: string;
  recordsChecked: number;
  failedRecords: number;
}

export interface TestExecutionRun {
  id: string;
  executedAt: string;
  trigger: 'Full Suite' | 'Single Test' | 'Validation Run' | 'Reconciliation Run';
  sourceDatasetName: string;
  targetDatasetName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  qualityScore: number;
  status: 'PASS' | 'FAIL';
  details: TestCaseExecutionDetail[];
}

export interface AppSettings {
  theme: 'light' | 'dark';
  numericTolerance: number;
  trimWhitespace: boolean;
  caseSensitive: boolean;
  maxPreviewRows: number;
  storageMode: 'local_hybrid' | 'browser_only' | 'firebase_optional';
}

export interface AppPersistedState {
  sourceDataset: DatasetRecord | null;
  targetDataset: DatasetRecord | null;
  validationConfig: ValidationConfig;
  reconciliationConfig: ReconciliationConfig;
  latestValidation: ValidationSummary | null;
  latestReconciliation: ReconciliationSummary | null;
  testCases: TestCase[];
  executionHistory: TestExecutionRun[];
  datasetHistory: {
    id: string;
    name: string;
    role: 'source' | 'target';
    rowCount: number;
    columnCount: number;
    uploadedAt: string;
    qualityScore: number | null;
  }[];
  settings: AppSettings;
}
