import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  ReconciliationSummary,
  TestExecutionRun,
  ValidationSummary,
} from '../types/dataguard';
import { serializeToCsv } from './csvParser';

export interface ReportInsight {
  title: string;
  severity: 'PASS' | 'WARN' | 'FAIL';
  finding: string;
  recommendation: string;
}

export interface WorkbookSheetData {
  'Executive Summary': Record<string, string | number>[];
  'Validation Summary': Record<string, string | number>[];
  'Failed Record Details': Record<string, string | number>[];
  'Field Mismatches': Record<string, string | number>[];
  'Orphan Records': Record<string, string | number>[];
}

export function generateInsights(params: {
  validation: ValidationSummary | null;
  reconciliation: ReconciliationSummary | null;
  latestRun: TestExecutionRun | null;
}): ReportInsight[] {
  const { validation, reconciliation, latestRun } = params;
  const insights: ReportInsight[] = [];

  if (!validation && !reconciliation) {
    return [
      {
        title: 'No Execution Data',
        severity: 'WARN',
        finding: 'Validation and reconciliation have not been executed on the current datasets.',
        recommendation: 'Run the Data Validation Engine and ETL Reconciliation to generate insights.',
      },
    ];
  }

  if (validation) {
    const isHealthy = validation.qualityScore === 100 && validation.failedRules === 0;
    insights.push({
      title: 'Pipeline Release Readiness',
      severity: isHealthy ? 'PASS' : validation.qualityScore >= 90 ? 'WARN' : 'FAIL',
      finding: isHealthy
        ? `All ${validation.totalRulesExecuted} active validation rules passed with a 100.0% data quality score across ${validation.totalRows} records.`
        : `Data quality score is ${validation.qualityScore.toFixed(1)}% (${validation.failedRules} of ${validation.totalRulesExecuted} rules failed, ${validation.allErrors.length} row-level violations).`,
      recommendation: isHealthy
        ? 'Dataset satisfies automated data quality gates for downstream warehouse promotion.'
        : 'Quarantine failing records and resolve critical schema/key violations before production load.',
    });

    const failingRules = [...validation.ruleResults]
      .filter((r) => r.status === 'FAIL')
      .sort((a, b) => b.failedRecords - a.failedRecords);

    if (failingRules.length > 0) {
      const topRule = failingRules[0];
      const colCounts = new Map<string, number>();
      validation.allErrors.forEach((e) => {
        colCounts.set(e.column, (colCounts.get(e.column) ?? 0) + 1);
      });
      const topColEntry = [...colCounts.entries()].sort((a, b) => b[1] - a[1])[0];

      insights.push({
        title: 'Highest-Impact Quality Defect',
        severity: 'FAIL',
        finding: `"${topRule.ruleName}" failed on ${topRule.failedRecords} record(s) (${topRule.passRate.toFixed(1)}% pass rate). Most affected column: "${topColEntry?.[0] ?? 'multiple'}" (${topColEntry?.[1] ?? 0} violations).`,
        recommendation: `Prioritize upstream ETL cleansing on "${topColEntry?.[0] ?? 'affected fields'}" and enforce pre-load rejection for ${topRule.ruleName.toLowerCase()}.`,
      });
    }
  }

  if (reconciliation) {
    const totalOrphans =
      reconciliation.missingInTargetCount + reconciliation.extraInTargetCount;
    const recClean =
      reconciliation.reconciliationMatchRate === 100 &&
      reconciliation.mismatchedRecords === 0 &&
      totalOrphans === 0;

    insights.push({
      title: 'Source-to-Target ETL Parity',
      severity: recClean ? 'PASS' : reconciliation.reconciliationMatchRate >= 85 ? 'WARN' : 'FAIL',
      finding: recClean
        ? `100.0% ETL parity achieved across ${reconciliation.matchingRecords} records keyed on "${reconciliation.primaryKey}".`
        : `Match rate is ${reconciliation.reconciliationMatchRate.toFixed(1)}%: ${reconciliation.mismatchedRecords} record(s) have field value drift, ${reconciliation.missingInTargetCount} missing in target, and ${reconciliation.extraInTargetCount} extra in target.`,
      recommendation: recClean
        ? 'Target warehouse extract is fully synchronized with source.'
        : `Re-run incremental load for ${reconciliation.missingInTargetCount} missing target key(s) and audit transformation logic for ${reconciliation.fieldMismatches.length} mismatched field(s).`,
    });
  }

  if (latestRun) {
    insights.push({
      title: 'Automated QA Test Suite Verdict',
      severity: latestRun.status === 'PASS' ? 'PASS' : 'FAIL',
      finding: `Latest "${latestRun.trigger}" run: ${latestRun.passedTests} of ${latestRun.totalTests} test cases passed (${latestRun.failedTests} failed).`,
      recommendation:
        latestRun.status === 'PASS'
          ? 'All automated QA assertions passed; archive report for audit sign-off.'
          : 'Inspect failed test case assertions in Execution History and re-run after remediation.',
    });
  }

  return insights;
}

export function buildReportData(params: {
  validation: ValidationSummary | null;
  reconciliation: ReconciliationSummary | null;
  latestRun: TestExecutionRun | null;
}): WorkbookSheetData {
  const { validation, reconciliation, latestRun } = params;
  const insights = generateInsights(params);

  const executiveSummary: Record<string, string | number>[] = [
    {
      Metric: 'Generated Timestamp',
      Value: new Date().toISOString(),
      Context: 'DataGuard AI Automated QA & Insights Report',
    },
    {
      Metric: 'Active Source Dataset',
      Value: validation?.datasetName ?? reconciliation?.sourceName ?? 'None',
      Context: `${validation?.totalRows ?? reconciliation?.sourceCount ?? 0} records`,
    },
    {
      Metric: 'Active Target Dataset',
      Value: reconciliation?.targetName ?? 'None',
      Context: `${reconciliation?.targetCount ?? 0} records`,
    },
    {
      Metric: 'Overall Data Quality Score (%)',
      Value: validation ? validation.qualityScore : 0,
      Context: validation
        ? `${validation.passedChecksCount}/${validation.totalChecksEvaluated} checks passed`
        : 'Not yet validated',
    },
    {
      Metric: 'Validation Rules Passed / Failed',
      Value: validation
        ? `${validation.passedRules} Passed / ${validation.failedRules} Failed`
        : '0 / 0',
      Context: `${validation?.totalRulesExecuted ?? 0} rules executed`,
    },
    {
      Metric: 'Total Failed Record Exceptions',
      Value: validation?.allErrors.length ?? 0,
      Context: 'Row-level data quality violations',
    },
    {
      Metric: 'ETL Reconciliation Match Rate (%)',
      Value: reconciliation ? reconciliation.reconciliationMatchRate : 0,
      Context: reconciliation
        ? `${reconciliation.matchingRecords} matched, ${reconciliation.mismatchedRecords} mismatched`
        : 'Not yet reconciled',
    },
    {
      Metric: 'Missing in Target (Source Orphans)',
      Value: reconciliation?.missingInTargetCount ?? 0,
      Context: 'Records present in source only',
    },
    {
      Metric: 'Extra in Target (Target Orphans)',
      Value: reconciliation?.extraInTargetCount ?? 0,
      Context: 'Records present in target only',
    },
    {
      Metric: 'Latest Test Suite Run',
      Value: latestRun
        ? `${latestRun.passedTests}/${latestRun.totalTests} Passed (${latestRun.status})`
        : 'No test run recorded',
      Context: latestRun?.executedAt ?? 'N/A',
    },
    ...insights.map((ins) => ({
      Metric: `Insight: ${ins.title} [${ins.severity}]`,
      Value: ins.finding,
      Context: `Action: ${ins.recommendation}`,
    })),
  ];

  const validationSummary: Record<string, string | number>[] =
    validation?.ruleResults.map((r) => ({
      'Rule ID': r.ruleId,
      'Rule Name': r.ruleName,
      'Records Checked': r.recordsChecked,
      'Passed Records': r.passedRecords,
      'Failed Records': r.failedRecords,
      'Pass Rate (%)': r.passRate,
      Status: r.status,
    })) ?? [];

  const failedRecordDetails: Record<string, string | number>[] =
    validation?.allErrors.map((err) => ({
      'Row #': err.rowIndex,
      'Primary Key': err.primaryKeyValue ?? '',
      'Rule ID': err.ruleId,
      'Rule Name': err.ruleName,
      Column: err.column,
      'Invalid Value': err.value,
      Reason: err.reason,
    })) ?? [];

  const fieldMismatches: Record<string, string | number>[] =
    reconciliation?.fieldMismatches.map((m) => ({
      'Primary Key': m.primaryKey,
      Field: m.field,
      'Source Row #': m.sourceRowIndex,
      'Target Row #': m.targetRowIndex,
      'Source Value': m.sourceValue,
      'Target Value': m.targetValue,
      'Numeric Difference': m.numericDifference ?? '',
    })) ?? [];

  const orphanRecords: Record<string, string | number>[] =
    reconciliation?.orphanRecords.map((o) => ({
      'Primary Key': o.primaryKey,
      Classification: o.side,
      'Row #': o.rowIndex,
      'Record Payload': JSON.stringify(o.data),
    })) ?? [];

  return {
    'Executive Summary': executiveSummary,
    'Validation Summary': validationSummary,
    'Failed Record Details': failedRecordDetails,
    'Field Mismatches': fieldMismatches,
    'Orphan Records': orphanRecords,
  };
}

export function buildExcelWorkbook(data: WorkbookSheetData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const sheetNames: (keyof WorkbookSheetData)[] = [
    'Executive Summary',
    'Validation Summary',
    'Failed Record Details',
    'Field Mismatches',
    'Orphan Records',
  ];

  for (const name of sheetNames) {
    const rows = data[name];
    const sheet =
      rows.length > 0
        ? XLSX.utils.json_to_sheet(rows)
        : XLSX.utils.aoa_to_sheet([['No records in this section']]);
    XLSX.utils.book_append_sheet(wb, sheet, name);
  }

  return wb;
}

export function exportSheetToCsvString(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) {
    return 'Status\nNo records available for this report section';
  }
  const headers = Object.keys(rows[0]);
  return serializeToCsv(headers, rows);
}

export function triggerFileDownload(
  content: BlobPart,
  fileName: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadExcelReport(
  data: WorkbookSheetData,
  fileName = `dataguard-report-${new Date().toISOString().slice(0, 10)}.xlsx`
): void {
  const wb = buildExcelWorkbook(data);
  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  triggerFileDownload(
    arrayBuffer,
    fileName,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

export function downloadCsvReport(
  rows: Record<string, string | number>[],
  fileName: string
): void {
  const csv = exportSheetToCsvString(rows);
  triggerFileDownload(csv, fileName, 'text/csv;charset=utf-8;');
}

export function buildPdfDocument(params: {
  validation: ValidationSummary | null;
  reconciliation: ReconciliationSummary | null;
  latestRun: TestExecutionRun | null;
}): jsPDF {
  const { validation, reconciliation, latestRun } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const workbookData = buildReportData(params);
  const insights = generateInsights(params);

  // Title Header
  doc.setFillColor(11, 17, 32);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 74, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('DataGuard AI - Quality & ETL Insights Report', 40, 34);
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Generated: ${new Date().toLocaleString()} | Source: ${validation?.datasetName ?? reconciliation?.sourceName ?? 'None'} | Target: ${reconciliation?.targetName ?? 'None'}`,
    40,
    54
  );

  let cursorY = 96;

  // Section 1: Automated Insights & Recommendations
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text('1. Executive Insights & Recommendations', 40, cursorY);

  autoTable(doc, {
    startY: cursorY + 10,
    head: [['Area', 'Verdict', 'Finding', 'Recommended Action']],
    body: insights.map((ins) => [
      ins.title,
      ins.severity,
      ins.finding,
      ins.recommendation,
    ]),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 95, fontStyle: 'bold' },
      1: { cellWidth: 45 },
      2: { cellWidth: 190 },
      3: { cellWidth: 175 },
    },
  });

  cursorY =
    ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      cursorY + 80) + 22;

  // Section 2: Validation Summary (9 Rules)
  doc.setFontSize(12);
  doc.text('2. Data Validation Rule Summary', 40, cursorY);
  const valRows = workbookData['Validation Summary'];
  autoTable(doc, {
    startY: cursorY + 10,
    head: [['Rule Name', 'Checked', 'Passed', 'Failed', 'Pass %', 'Status']],
    body:
      valRows.length > 0
        ? valRows.map((r) => [
            String(r['Rule Name']),
            String(r['Records Checked']),
            String(r['Passed Records']),
            String(r['Failed Records']),
            `${r['Pass Rate (%)']}%`,
            String(r['Status']),
          ])
        : [['No validation results available', '-', '-', '-', '-', '-']],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
  });

  cursorY =
    ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      cursorY + 80) + 22;

  // Section 3: ETL Reconciliation Summary & Field Mismatches
  if (cursorY > 680) {
    doc.addPage();
    cursorY = 48;
  }
  doc.setFontSize(12);
  doc.text('3. ETL Reconciliation & Field Mismatches', 40, cursorY);

  const mismatchRows = workbookData['Field Mismatches'];
  autoTable(doc, {
    startY: cursorY + 10,
    head: [['Primary Key', 'Field', 'Source Value', 'Target Value', 'Delta']],
    body:
      mismatchRows.length > 0
        ? mismatchRows.slice(0, 40).map((m) => [
            String(m['Primary Key']),
            String(m['Field']),
            String(m['Source Value']),
            String(m['Target Value']),
            String(m['Numeric Difference']),
          ])
        : [['No field mismatches detected', '-', '-', '-', '-']],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
  });

  cursorY =
    ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      cursorY + 80) + 22;

  // Section 4: Orphan Records & Failed Record Sample
  if (cursorY > 680) {
    doc.addPage();
    cursorY = 48;
  }
  doc.setFontSize(12);
  doc.text('4. Orphan Records & Row-Level Validation Violations', 40, cursorY);

  const orphanRows = workbookData['Orphan Records'];
  autoTable(doc, {
    startY: cursorY + 10,
    head: [['Primary Key', 'Classification', 'Row #']],
    body:
      orphanRows.length > 0
        ? orphanRows.slice(0, 40).map((o) => [
            String(o['Primary Key']),
            String(o['Classification']),
            String(o['Row #']),
          ])
        : [['No orphan records detected', '-', '-']],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
  });

  cursorY =
    ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      cursorY + 60) + 18;

  const failedRows = workbookData['Failed Record Details'];
  if (failedRows.length > 0) {
    if (cursorY > 680) {
      doc.addPage();
      cursorY = 48;
    }
    autoTable(doc, {
      startY: cursorY,
      head: [['Row #', 'Primary Key', 'Rule', 'Column', 'Invalid Value', 'Reason']],
      body: failedRows.slice(0, 60).map((f) => [
        String(f['Row #']),
        String(f['Primary Key']),
        String(f['Rule Name']),
        String(f['Column']),
        String(f['Invalid Value']),
        String(f['Reason']),
      ]),
      styles: { fontSize: 7.5, cellPadding: 3.5 },
      headStyles: { fillColor: [185, 28, 28], textColor: 255 },
    });
  }

  // Footer note on test run
  if (latestRun) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `DataGuard AI · Suite Status: ${latestRun.status} (${latestRun.passedTests}/${latestRun.totalTests} passed) · Page ${i} of ${pageCount}`,
        40,
        doc.internal.pageSize.getHeight() - 22
      );
    }
  }

  return doc;
}

export function downloadPdfReport(
  params: {
    validation: ValidationSummary | null;
    reconciliation: ReconciliationSummary | null;
    latestRun: TestExecutionRun | null;
  },
  fileName = `dataguard-insights-report-${new Date().toISOString().slice(0, 10)}.pdf`
): void {
  const doc = buildPdfDocument(params);
  const arrayBuffer = doc.output('arraybuffer');
  triggerFileDownload(arrayBuffer, fileName, 'application/pdf');
}

