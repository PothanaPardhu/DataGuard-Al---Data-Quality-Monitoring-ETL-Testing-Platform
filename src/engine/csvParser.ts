export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  warnings: string[];
  error?: string;
}

/**
 * RFC 4180 compliant CSV parser with support for quoted fields, escaped quotes,
 * CRLF/LF line endings, empty dataset detection, and column mismatch warnings.
 */
export function parseCsv(content: string): ParsedCsvResult {
  if (!content || content.trim().length === 0) {
    return {
      headers: [],
      rows: [],
      warnings: [],
      error: 'CSV file is empty. Upload a file containing a header row and at least one data row.',
    };
  }

  // Strip UTF-8 BOM if present
  const normalized = content.replace(/^\uFEFF/, '');

  const matrix: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentField);
        matrix.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField);
        matrix.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  if (inQuotes) {
    return {
      headers: [],
      rows: [],
      warnings: [],
      error: 'Malformed CSV: unclosed quote character detected.',
    };
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    matrix.push(currentRow);
  }

  // Filter out completely blank trailing lines
  const nonEmptyLines = matrix.filter(
    (line) => !(line.length === 1 && line[0].trim() === '')
  );

  if (nonEmptyLines.length === 0) {
    return {
      headers: [],
      rows: [],
      warnings: [],
      error: 'CSV file contains no readable rows.',
    };
  }

  const rawHeaders = nonEmptyLines[0].map((h) => h.trim());
  if (rawHeaders.length === 0 || rawHeaders.every((h) => h === '')) {
    return {
      headers: [],
      rows: [],
      warnings: [],
      error: 'CSV header row is empty or invalid.',
    };
  }

  const headerSet = new Set<string>();
  const duplicateHeaders: string[] = [];
  const headers = rawHeaders.map((h, idx) => {
    const clean = h === '' ? `column_${idx + 1}` : h;
    if (headerSet.has(clean)) {
      duplicateHeaders.push(clean);
      return `${clean}_${idx + 1}`;
    }
    headerSet.add(clean);
    return clean;
  });

  const warnings: string[] = [];
  if (duplicateHeaders.length > 0) {
    warnings.push(`Duplicate header names renamed: ${duplicateHeaders.join(', ')}`);
  }

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < nonEmptyLines.length; r++) {
    const line = nonEmptyLines[r];
    if (line.length !== headers.length) {
      warnings.push(
        `Row ${r} has ${line.length} column(s) but expected ${headers.length}.`
      );
    }
    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      rowObj[headers[c]] = line[c] ?? '';
    }
    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    warnings,
  };
}

export function serializeToCsv(
  headers: string[],
  rows: Record<string, unknown>[]
): string {
  const escapeCell = (val: unknown): string => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ];

  return lines.join('\n');
}
