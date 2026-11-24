import {
  DatasetRecord,
  InferredDataType,
  ValidationConfig,
  ValidationRowError,
  ValidationRuleId,
  ValidationRuleResult,
  ValidationSummary,
} from '../types/dataguard';
import {
  isBooleanValue,
  isIntegerValue,
  isNullLike,
  isNumericValue,
  isValidCalendarDate,
  isValidEmail,
} from './schemaDetector';

export const VALIDATION_RULE_METADATA: Record<
  ValidationRuleId,
  { name: string; description: string }
> = {
  non_empty: {
    name: 'Non-empty Dataset Validation',
    description: 'Verifies the dataset contains headers and at least one data record.',
  },
  required_columns: {
    name: 'Required Column Validation',
    description: 'Ensures all mandatory schema columns exist in the dataset header.',
  },
  missing_null: {
    name: 'Missing & Null Value Detection',
    description: 'Flags blank strings, NULL, NA, N/A, NaN, and undefined values.',
  },
  duplicate_rows: {
    name: 'Duplicate Row Detection',
    description: 'Identifies exact duplicate records across every column.',
  },
  primary_key_unique: {
    name: 'Primary Key Uniqueness Validation',
    description: 'Checks that the primary key column is populated and unique per record.',
  },
  data_type: {
    name: 'Data Type Validation',
    description: 'Validates cell values against their expected schema data types.',
  },
  email_format: {
    name: 'Email Format Validation',
    description: 'Verifies email fields conform to RFC-aligned email syntax.',
  },
  negative_amount: {
    name: 'Negative Amount Validation',
    description: 'Detects negative numeric values in monetary/amount columns.',
  },
  date_format: {
    name: 'Date Format & Calendar Validation',
    description: 'Validates date syntax and real calendar dates (rejects Feb 30, month 13, etc.).',
  },
};

function matchesExpectedType(value: string, expectedType: InferredDataType): boolean {
  switch (expectedType) {
    case 'number':
      return isNumericValue(value);
    case 'integer':
      return isIntegerValue(value);
    case 'date':
      return isValidCalendarDate(value);
    case 'email':
      return isValidEmail(value);
    case 'boolean':
      return isBooleanValue(value);
    case 'string':
    default:
      return true;
  }
}

function getPkValue(
  row: Record<string, string>,
  pkColumn: string,
  rowIndex: number
): string {
  if (pkColumn && row[pkColumn] !== undefined && !isNullLike(row[pkColumn])) {
    return row[pkColumn].trim();
  }
  return `Row ${rowIndex}`;
}

export function runValidationEngine(
  dataset: DatasetRecord | null,
  config: ValidationConfig
): ValidationSummary {
  const executedAt = new Date().toISOString();
  const id = `val-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (!dataset) {
    const emptyRuleResult: ValidationRuleResult = {
      ruleId: 'non_empty',
      ruleName: VALIDATION_RULE_METADATA.non_empty.name,
      description: VALIDATION_RULE_METADATA.non_empty.description,
      recordsChecked: 0,
      passedRecords: 0,
      failedRecords: 1,
      passRate: 0,
      status: 'FAIL',
      rowErrors: [
        {
          rowIndex: 0,
          ruleId: 'non_empty',
          ruleName: VALIDATION_RULE_METADATA.non_empty.name,
          column: '*',
          value: '',
          reason: 'No dataset is currently loaded for validation.',
        },
      ],
    };

    return {
      id,
      datasetId: 'none',
      datasetName: 'No Dataset Loaded',
      datasetRole: config.targetRole,
      executedAt,
      totalRows: 0,
      totalRulesExecuted: 1,
      passedRules: 0,
      failedRules: 1,
      totalChecksEvaluated: 1,
      passedChecksCount: 0,
      failedChecksCount: 1,
      qualityScore: 0,
      ruleResults: [emptyRuleResult],
      allErrors: emptyRuleResult.rowErrors,
    };
  }

  const rows = dataset.rows;
  const headers = dataset.headers;
  const pkCol = config.primaryKeyColumn;
  const ruleResults: ValidationRuleResult[] = [];

  // 1. Non-empty dataset validation
  if (config.enabledRules.non_empty) {
    const passed = rows.length > 0 && headers.length > 0;
    const errors: ValidationRowError[] = passed
      ? []
      : [
          {
            rowIndex: 0,
            ruleId: 'non_empty',
            ruleName: VALIDATION_RULE_METADATA.non_empty.name,
            column: '*',
            value: '',
            reason: 'Dataset contains 0 data records.',
          },
        ];
    ruleResults.push({
      ruleId: 'non_empty',
      ruleName: VALIDATION_RULE_METADATA.non_empty.name,
      description: VALIDATION_RULE_METADATA.non_empty.description,
      recordsChecked: Math.max(1, rows.length),
      passedRecords: passed ? rows.length : 0,
      failedRecords: passed ? 0 : 1,
      passRate: passed ? 100 : 0,
      status: passed ? 'PASS' : 'FAIL',
      rowErrors: errors,
    });
  }

  // 2. Required column validation
  if (config.enabledRules.required_columns) {
    const reqCols = config.requiredColumns;
    const headerSet = new Set(
      config.caseSensitive ? headers : headers.map((h) => h.toLowerCase())
    );
    const errors: ValidationRowError[] = [];
    for (const col of reqCols) {
      const lookup = config.caseSensitive ? col : col.toLowerCase();
      if (!headerSet.has(lookup)) {
        errors.push({
          rowIndex: 0,
          ruleId: 'required_columns',
          ruleName: VALIDATION_RULE_METADATA.required_columns.name,
          column: col,
          value: 'MISSING_COLUMN',
          reason: `Required column "${col}" was not found in dataset headers.`,
        });
      }
    }
    const checked = Math.max(1, reqCols.length);
    const failed = errors.length;
    const passed = Math.max(0, checked - failed);
    ruleResults.push({
      ruleId: 'required_columns',
      ruleName: VALIDATION_RULE_METADATA.required_columns.name,
      description: VALIDATION_RULE_METADATA.required_columns.description,
      recordsChecked: checked,
      passedRecords: passed,
      failedRecords: failed,
      passRate: Math.round((passed / checked) * 1000) / 10,
      status: failed === 0 ? 'PASS' : 'FAIL',
      rowErrors: errors,
    });
  }

  // 3. Missing & null value detection
  if (config.enabledRules.missing_null) {
    const errors: ValidationRowError[] = [];
    const failedRowIndices = new Set<number>();
    const colsToCheck = headers;

    rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      for (const col of colsToCheck) {
        const val = row[col] ?? '';
        if (isNullLike(val)) {
          failedRowIndices.add(rowNum);
          errors.push({
            rowIndex: rowNum,
            ruleId: 'missing_null',
            ruleName: VALIDATION_RULE_METADATA.missing_null.name,
            column: col,
            value: val === '' ? '<empty>' : val,
            reason: `Missing or null-like value detected in column "${col}".`,
            primaryKeyValue: getPkValue(row, pkCol, rowNum),
          });
        }
      }
    });

    const checked = rows.length;
    const failed = failedRowIndices.size;
    const passed = Math.max(0, checked - failed);
    ruleResults.push({
      ruleId: 'missing_null',
      ruleName: VALIDATION_RULE_METADATA.missing_null.name,
      description: VALIDATION_RULE_METADATA.missing_null.description,
      recordsChecked: checked,
      passedRecords: passed,
      failedRecords: failed,
      passRate: checked === 0 ? 100 : Math.round((passed / checked) * 1000) / 10,
      status: failed === 0 ? 'PASS' : 'FAIL',
      rowErrors: errors,
    });
  }

  // 4. Duplicate row detection
  if (config.enabledRules.duplicate_rows) {
    const seen = new Map<string, number>();
    const errors: ValidationRowError[] = [];
    const failedRowIndices = new Set<number>();

    rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const key = headers
        .map((h) => {
          let v = row[h] ?? '';
          if (config.trimWhitespace) v = v.trim();
          if (!config.caseSensitive) v = v.toLowerCase();
          return v;
        })
        .join('\u0001');

      const firstSeen = seen.get(key);
      if (firstSeen !== undefined) {
        failedRowIndices.add(rowNum);
        errors.push({
          rowIndex: rowNum,
          ruleId: 'duplicate_rows',
          ruleName: VALIDATION_RULE_METADATA.duplicate_rows.name,
          column: '*',
          value: getPkValue(row, pkCol, rowNum),
          reason: `Exact duplicate of row ${firstSeen}.`,
          primaryKeyValue: getPkValue(row, pkCol, rowNum),
        });
      } else {
        seen.set(key, rowNum);
      }
    });

    const checked = rows.length;
    const failed = failedRowIndices.size;
    const passed = Math.max(0, checked - failed);
    ruleResults.push({
      ruleId: 'duplicate_rows',
      ruleName: VALIDATION_RULE_METADATA.duplicate_rows.name,
      description: VALIDATION_RULE_METADATA.duplicate_rows.description,
      recordsChecked: checked,
      passedRecords: passed,
      failedRecords: failed,
      passRate: checked === 0 ? 100 : Math.round((passed / checked) * 1000) / 10,
      status: failed === 0 ? 'PASS' : 'FAIL',
      rowErrors: errors,
    });
  }

  // 5. Primary key uniqueness validation
  if (config.enabledRules.primary_key_unique) {
    const errors: ValidationRowError[] = [];
    const failedRowIndices = new Set<number>();

    if (!pkCol || !headers.includes(pkCol)) {
      errors.push({
        rowIndex: 0,
        ruleId: 'primary_key_unique',
        ruleName: VALIDATION_RULE_METADATA.primary_key_unique.name,
        column: pkCol || '(none)',
        value: 'MISSING_COLUMN',
        reason: `Primary key column "${pkCol}" does not exist in dataset.`,
      });
      ruleResults.push({
        ruleId: 'primary_key_unique',
        ruleName: VALIDATION_RULE_METADATA.primary_key_unique.name,
        description: VALIDATION_RULE_METADATA.primary_key_unique.description,
        recordsChecked: rows.length || 1,
        passedRecords: 0,
        failedRecords: rows.length || 1,
        passRate: 0,
        status: 'FAIL',
        rowErrors: errors,
      });
    } else {
      const seenKeys = new Map<string, number>();
      rows.forEach((row, idx) => {
        const rowNum = idx + 1;
        const raw = row[pkCol] ?? '';
        if (isNullLike(raw)) {
          failedRowIndices.add(rowNum);
          errors.push({
            rowIndex: rowNum,
            ruleId: 'primary_key_unique',
            ruleName: VALIDATION_RULE_METADATA.primary_key_unique.name,
            column: pkCol,
            value: raw === '' ? '<empty>' : raw,
            reason: `Primary key "${pkCol}" is null or empty.`,
            primaryKeyValue: `Row ${rowNum}`,
          });
          return;
        }
        let norm = config.trimWhitespace ? raw.trim() : raw;
        if (!config.caseSensitive) norm = norm.toLowerCase();

        const firstRow = seenKeys.get(norm);
        if (firstRow !== undefined) {
          failedRowIndices.add(rowNum);
          errors.push({
            rowIndex: rowNum,
            ruleId: 'primary_key_unique',
            ruleName: VALIDATION_RULE_METADATA.primary_key_unique.name,
            column: pkCol,
            value: raw,
            reason: `Duplicate primary key "${raw}" (first seen at row ${firstRow}).`,
            primaryKeyValue: raw,
          });
        } else {
          seenKeys.set(norm, rowNum);
        }
      });

      const checked = rows.length;
      const failed = failedRowIndices.size;
      const passed = Math.max(0, checked - failed);
      ruleResults.push({
        ruleId: 'primary_key_unique',
        ruleName: VALIDATION_RULE_METADATA.primary_key_unique.name,
        description: VALIDATION_RULE_METADATA.primary_key_unique.description,
        recordsChecked: checked,
        passedRecords: passed,
        failedRecords: failed,
        passRate: checked === 0 ? 100 : Math.round((passed / checked) * 1000) / 10,
        status: failed === 0 ? 'PASS' : 'FAIL',
        rowErrors: errors,
      });
    }
  }

  // 6. Data type validation
  if (config.enabledRules.data_type) {
    const errors: ValidationRowError[] = [];
    const failedRowIndices = new Set<number>();

    rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      for (const col of headers) {
        const expected = config.expectedTypes[col];
        if (!expected || expected === 'string') continue;
        const val = row[col] ?? '';
        if (isNullLike(val)) continue; // Missing/null handled by rule 3
        if (!matchesExpectedType(val, expected)) {
          failedRowIndices.add(rowNum);
          errors.push({
            rowIndex: rowNum,
            ruleId: 'data_type',
            ruleName: VALIDATION_RULE_METADATA.data_type.name,
            column: col,
            value: val,
            reason: `Value "${val}" in "${col}" does not match expected type "${expected}".`,
            primaryKeyValue: getPkValue(row, pkCol, rowNum),
          });
        }
      }
    });

    const checked = rows.length;
    const failed = failedRowIndices.size;
    const passed = Math.max(0, checked - failed);
    ruleResults.push({
      ruleId: 'data_type',
      ruleName: VALIDATION_RULE_METADATA.data_type.name,
      description: VALIDATION_RULE_METADATA.data_type.description,
      recordsChecked: checked,
      passedRecords: passed,
      failedRecords: failed,
      passRate: checked === 0 ? 100 : Math.round((passed / checked) * 1000) / 10,
      status: failed === 0 ? 'PASS' : 'FAIL',
      rowErrors: errors,
    });
  }

  // 7. Email format validation
  if (config.enabledRules.email_format) {
    const emailCols = config.emailColumns.filter((c) => headers.includes(c));
    if (emailCols.length === 0) {
      ruleResults.push({
        ruleId: 'email_format',
        ruleName: VALIDATION_RULE_METADATA.email_format.name,
        description: VALIDATION_RULE_METADATA.email_format.description,
        recordsChecked: 0,
        passedRecords: 0,
        failedRecords: 0,
        passRate: 100,
        status: 'SKIPPED',
        rowErrors: [],
      });
    } else {
      const errors: ValidationRowError[] = [];
      const failedRowIndices = new Set<number>();
      rows.forEach((row, idx) => {
        const rowNum = idx + 1;
        for (const col of emailCols) {
          const val = row[col] ?? '';
          if (isNullLike(val)) continue;
          if (!isValidEmail(val)) {
            failedRowIndices.add(rowNum);
            errors.push({
              rowIndex: rowNum,
              ruleId: 'email_format',
              ruleName: VALIDATION_RULE_METADATA.email_format.name,
              column: col,
              value: val,
              reason: `Invalid email address syntax "${val}".`,
              primaryKeyValue: getPkValue(row, pkCol, rowNum),
            });
          }
        }
      });

      const checked = rows.length;
      const failed = failedRowIndices.size;
      const passed = Math.max(0, checked - failed);
      ruleResults.push({
        ruleId: 'email_format',
        ruleName: VALIDATION_RULE_METADATA.email_format.name,
        description: VALIDATION_RULE_METADATA.email_format.description,
        recordsChecked: checked,
        passedRecords: passed,
        failedRecords: failed,
        passRate: checked === 0 ? 100 : Math.round((passed / checked) * 1000) / 10,
        status: failed === 0 ? 'PASS' : 'FAIL',
        rowErrors: errors,
      });
    }
  }

  // 8. Negative amount validation
  if (config.enabledRules.negative_amount) {
    const amountCols = config.amountColumns.filter((c) => headers.includes(c));
    if (amountCols.length === 0) {
      ruleResults.push({
        ruleId: 'negative_amount',
        ruleName: VALIDATION_RULE_METADATA.negative_amount.name,
        description: VALIDATION_RULE_METADATA.negative_amount.description,
        recordsChecked: 0,
        passedRecords: 0,
        failedRecords: 0,
        passRate: 100,
        status: 'SKIPPED',
        rowErrors: [],
      });
    } else {
      const errors: ValidationRowError[] = [];
      const failedRowIndices = new Set<number>();
      rows.forEach((row, idx) => {
        const rowNum = idx + 1;
        for (const col of amountCols) {
          const val = row[col] ?? '';
          if (isNullLike(val)) continue;
          if (!isNumericValue(val)) {
            failedRowIndices.add(rowNum);
            errors.push({
              rowIndex: rowNum,
              ruleId: 'negative_amount',
              ruleName: VALIDATION_RULE_METADATA.negative_amount.name,
              column: col,
              value: val,
              reason: `Amount "${val}" in "${col}" is non-numeric.`,
              primaryKeyValue: getPkValue(row, pkCol, rowNum),
            });
          } else if (Number(val.trim()) < 0) {
            failedRowIndices.add(rowNum);
            errors.push({
              rowIndex: rowNum,
              ruleId: 'negative_amount',
              ruleName: VALIDATION_RULE_METADATA.negative_amount.name,
              column: col,
              value: val,
              reason: `Negative amount ${val} is not permitted in "${col}".`,
              primaryKeyValue: getPkValue(row, pkCol, rowNum),
            });
          }
        }
      });

      const checked = rows.length;
      const failed = failedRowIndices.size;
      const passed = Math.max(0, checked - failed);
      ruleResults.push({
        ruleId: 'negative_amount',
        ruleName: VALIDATION_RULE_METADATA.negative_amount.name,
        description: VALIDATION_RULE_METADATA.negative_amount.description,
        recordsChecked: checked,
        passedRecords: passed,
        failedRecords: failed,
        passRate: checked === 0 ? 100 : Math.round((passed / checked) * 1000) / 10,
        status: failed === 0 ? 'PASS' : 'FAIL',
        rowErrors: errors,
      });
    }
  }

  // 9. Date format & calendar validation
  if (config.enabledRules.date_format) {
    const dateCols = config.dateColumns.filter((c) => headers.includes(c));
    if (dateCols.length === 0) {
      ruleResults.push({
        ruleId: 'date_format',
        ruleName: VALIDATION_RULE_METADATA.date_format.name,
        description: VALIDATION_RULE_METADATA.date_format.description,
        recordsChecked: 0,
        passedRecords: 0,
        failedRecords: 0,
        passRate: 100,
        status: 'SKIPPED',
        rowErrors: [],
      });
    } else {
      const errors: ValidationRowError[] = [];
      const failedRowIndices = new Set<number>();
      rows.forEach((row, idx) => {
        const rowNum = idx + 1;
        for (const col of dateCols) {
          const val = row[col] ?? '';
          if (isNullLike(val)) continue;
          if (!isValidCalendarDate(val)) {
            failedRowIndices.add(rowNum);
            errors.push({
              rowIndex: rowNum,
              ruleId: 'date_format',
              ruleName: VALIDATION_RULE_METADATA.date_format.name,
              column: col,
              value: val,
              reason: `Invalid date or non-existent calendar date "${val}" in "${col}".`,
              primaryKeyValue: getPkValue(row, pkCol, rowNum),
            });
          }
        }
      });

      const checked = rows.length;
      const failed = failedRowIndices.size;
      const passed = Math.max(0, checked - failed);
      ruleResults.push({
        ruleId: 'date_format',
        ruleName: VALIDATION_RULE_METADATA.date_format.name,
        description: VALIDATION_RULE_METADATA.date_format.description,
        recordsChecked: checked,
        passedRecords: passed,
        failedRecords: failed,
        passRate: checked === 0 ? 100 : Math.round((passed / checked) * 1000) / 10,
        status: failed === 0 ? 'PASS' : 'FAIL',
        rowErrors: errors,
      });
    }
  }

  const executedRules = ruleResults.filter((r) => r.status !== 'SKIPPED');
  const passedRules = executedRules.filter((r) => r.status === 'PASS').length;
  const failedRules = executedRules.filter((r) => r.status === 'FAIL').length;

  const totalChecksEvaluated = executedRules.reduce((sum, r) => sum + r.recordsChecked, 0);
  const passedChecksCount = executedRules.reduce((sum, r) => sum + r.passedRecords, 0);
  const failedChecksCount = executedRules.reduce((sum, r) => sum + r.failedRecords, 0);

  const qualityScore =
    totalChecksEvaluated === 0
      ? 0
      : Math.round((passedChecksCount / totalChecksEvaluated) * 1000) / 10;

  const allErrors = ruleResults.flatMap((r) => r.rowErrors);

  return {
    id,
    datasetId: dataset.id,
    datasetName: dataset.name,
    datasetRole: dataset.role,
    executedAt,
    totalRows: rows.length,
    totalRulesExecuted: executedRules.length,
    passedRules,
    failedRules,
    totalChecksEvaluated,
    passedChecksCount,
    failedChecksCount,
    qualityScore,
    ruleResults,
    allErrors,
  };
}
