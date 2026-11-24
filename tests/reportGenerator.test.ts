import { describe, expect, it } from 'vitest';
import {
  buildExcelWorkbook,
  buildPdfDocument,
  buildReportData,
  exportSheetToCsvString,
  generateInsights,
} from '../src/engine/reportGenerator';
import { buildInitialDemoState } from '../src/services/storageService';

describe('reportGenerator', () => {
  it('generates all 5 required Excel sheets and actionable insights from real data', () => {
    const state = buildInitialDemoState('dirty');
    const reportData = buildReportData({
      validation: state.latestValidation,
      reconciliation: state.latestReconciliation,
      latestRun: state.executionHistory[0] ?? null,
    });

    const wb = buildExcelWorkbook(reportData);
    expect(wb.SheetNames).toEqual([
      'Executive Summary',
      'Validation Summary',
      'Failed Record Details',
      'Field Mismatches',
      'Orphan Records',
    ]);

    expect(reportData['Executive Summary'].length).toBeGreaterThanOrEqual(12);
    expect(reportData['Validation Summary'].length).toBe(9);
    expect(reportData['Failed Record Details'].length).toBeGreaterThan(0);
    expect(reportData['Field Mismatches'].length).toBeGreaterThan(0);
    expect(reportData['Orphan Records'].length).toBe(5);

    const insights = generateInsights({
      validation: state.latestValidation,
      reconciliation: state.latestReconciliation,
      latestRun: state.executionHistory[0] ?? null,
    });
    expect(insights.length).toBe(4);
    expect(insights[0].severity).toBe('FAIL');
  });

  it('serializes report sections to valid CSV strings', () => {
    const state = buildInitialDemoState('dirty');
    const reportData = buildReportData({
      validation: state.latestValidation,
      reconciliation: state.latestReconciliation,
      latestRun: state.executionHistory[0] ?? null,
    });

    const csv = exportSheetToCsvString(reportData['Validation Summary']);
    expect(csv).toContain('Rule ID,Rule Name,Records Checked');
    expect(csv).toContain('Non-empty Dataset Validation');
  });

  it('builds a valid multi-section PDF document with insights and tables', () => {
    const state = buildInitialDemoState('dirty');
    const doc = buildPdfDocument({
      validation: state.latestValidation,
      reconciliation: state.latestReconciliation,
      latestRun: state.executionHistory[0] ?? null,
    });

    const bytes = new Uint8Array(doc.output('arraybuffer'));
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe('%PDF-');
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
