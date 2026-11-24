import {
  ColumnSchema,
  DatasetRecord,
  InferredDataType,
  ValidationConfig,
} from '../types/dataguard';
import { parseCsv } from './csvParser';

const NULL_TOKENS = new Set(['', 'null', 'na', 'n/a', 'nan', 'undefined', 'none']);

export function isNullLike(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return true;
  return NULL_TOKENS.has(value.trim().toLowerCase());
}

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
}

export function isValidCalendarDate(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  // Support YYYY-MM-DD and YYYY/MM/DD
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return checkCalendarYMD(year, month, day);
  }

  // Support MM/DD/YYYY
  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (usMatch) {
    const month = Number(usMatch[1]);
    const day = Number(usMatch[2]);
    const year = Number(usMatch[3]);
    return checkCalendarYMD(year, month, day);
  }

  return false;
}

function checkCalendarYMD(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isNumericValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^-?\d+(\.\d+)?$/.test(trimmed) && Number.isFinite(Number(trimmed));
}

export function isIntegerValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^-?\d+$/.test(trimmed) && Number.isSafeInteger(Number(trimmed));
}

export function isBooleanValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ['true', 'false', '0', '1', 'yes', 'no'].includes(normalized);
}

export function inferColumnType(values: string[], columnName: string): InferredDataType {
  const nonNull = values.filter((v) => !isNullLike(v));
  if (nonNull.length === 0) return 'string';

  const lowerCol = columnName.toLowerCase();

  // Check email match ratio
  const emailMatches = nonNull.filter((v) => isValidEmail(v)).length;
  if (
    emailMatches / nonNull.length >= 0.7 ||
    (lowerCol.includes('email') && emailMatches > 0)
  ) {
    return 'email';
  }

  // Check date match ratio or explicit date column name
  const dateMatches = nonNull.filter((v) => isValidCalendarDate(v)).length;
  if (
    dateMatches / nonNull.length >= 0.7 ||
    (lowerCol.includes('date') && dateMatches > 0)
  ) {
    return 'date';
  }

  // Check numeric / integer
  const intMatches = nonNull.filter((v) => isIntegerValue(v)).length;
  if (intMatches / nonNull.length >= 0.8) {
    return 'integer';
  }

  const numMatches = nonNull.filter((v) => isNumericValue(v)).length;
  if (
    numMatches / nonNull.length >= 0.75 ||
    ((lowerCol.includes('amount') ||
      lowerCol.includes('price') ||
      lowerCol.includes('total') ||
      lowerCol.includes('balance')) &&
      numMatches > 0)
  ) {
    return 'number';
  }

  // Check boolean
  const boolMatches = nonNull.filter((v) => isBooleanValue(v)).length;
  if (boolMatches / nonNull.length >= 0.9) {
    return 'boolean';
  }

  return 'string';
}

export function detectSchema(
  headers: string[],
  rows: Record<string, string>[]
): ColumnSchema[] {
  return headers.map((header) => {
    const colValues = rows.map((r) => r[header] ?? '');
    const nonNullValues = colValues.filter((v) => !isNullLike(v));
    const uniqueValues = new Set(nonNullValues.map((v) => v.trim()));

    return {
      name: header,
      inferredType: inferColumnType(colValues, header),
      nonNullCount: nonNullValues.length,
      nullCount: colValues.length - nonNullValues.length,
      uniqueCount: uniqueValues.size,
      sampleValues: nonNullValues.slice(0, 3),
    };
  });
}

export function buildDatasetFromCsv(params: {
  id: string;
  role: 'source' | 'target';
  name: string;
  fileName: string;
  csvContent: string;
  isSample?: boolean;
}): { dataset: DatasetRecord | null; error?: string } {
  const parsed = parseCsv(params.csvContent);
  if (parsed.error) {
    return { dataset: null, error: parsed.error };
  }

  const schema = detectSchema(parsed.headers, parsed.rows);
  return {
    dataset: {
      id: params.id,
      role: params.role,
      name: params.name,
      fileName: params.fileName,
      uploadedAt: new Date().toISOString(),
      headers: parsed.headers,
      rows: parsed.rows,
      rowCount: parsed.rows.length,
      columnCount: parsed.headers.length,
      schema,
      parseWarnings: parsed.warnings,
      isSample: params.isSample,
    },
  };
}

export function suggestValidationConfig(
  dataset: DatasetRecord,
  existing?: Partial<ValidationConfig>
): ValidationConfig {
  const headers = dataset.headers;
  const schemaMap = new Map(dataset.schema.map((s) => [s.name, s.inferredType]));

  const primaryKeyColumn =
    headers.find((h) => h.toLowerCase() === 'transaction_id') ||
    headers.find((h) => h.toLowerCase().endsWith('_id')) ||
    headers[0] ||
    '';

  const emailColumns = headers.filter(
    (h) => schemaMap.get(h) === 'email' || h.toLowerCase().includes('email')
  );
  const amountColumns = headers.filter(
    (h) =>
      h.toLowerCase().includes('amount') ||
      h.toLowerCase().includes('price') ||
      h.toLowerCase().includes('total') ||
      schemaMap.get(h) === 'number'
  );
  const dateColumns = headers.filter(
    (h) => schemaMap.get(h) === 'date' || h.toLowerCase().includes('date')
  );

  const expectedTypes: Record<string, InferredDataType> = {};
  for (const col of dataset.schema) {
    expectedTypes[col.name] = col.inferredType;
  }

  return {
    targetRole: existing?.targetRole ?? dataset.role,
    enabledRules: existing?.enabledRules ?? {
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
    requiredColumns: headers.slice(0, Math.min(5, headers.length)),
    primaryKeyColumn,
    emailColumns,
    amountColumns,
    dateColumns,
    expectedTypes,
    trimWhitespace: existing?.trimWhitespace ?? true,
    caseSensitive: existing?.caseSensitive ?? false,
  };
}
