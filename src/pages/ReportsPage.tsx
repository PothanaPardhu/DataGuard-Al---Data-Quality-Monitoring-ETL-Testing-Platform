import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  buildReportData,
  downloadCsvReport,
  downloadExcelReport,
  downloadPdfReport,
  generateInsights,
} from '../engine/reportGenerator';
import {
  ReconciliationSummary,
  TestExecutionRun,
  ValidationSummary,
} from '../types/dataguard';

interface ReportsPageProps {
  validation: ValidationSummary | null;
  reconciliation: ReconciliationSummary | null;
  latestRun: TestExecutionRun | null;
}

type ReportTab =
  | 'executive'
  | 'validation'
  | 'failed_records'
  | 'reconciliation'
  | 'field_mismatches'
  | 'orphan_records';

export const ReportsPage: React.FC<ReportsPageProps> = ({
  validation,
  reconciliation,
  latestRun,
}) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('executive');

  const workbookData = useMemo(
    () =>
      buildReportData({
        validation,
        reconciliation,
        latestRun,
      }),
    [validation, reconciliation, latestRun]
  );

  const insights = useMemo(
    () =>
      generateInsights({
        validation,
        reconciliation,
        latestRun,
      }),
    [validation, reconciliation, latestRun]
  );

  const reconciliationOverviewRows = useMemo<Record<string, string | number>[]>(() => {
    if (!reconciliation) return [];
    return [
      {
        Metric: 'Source Dataset',
        Value: reconciliation.sourceName,
        Count: reconciliation.sourceCount,
      },
      {
        Metric: 'Target Dataset',
        Value: reconciliation.targetName,
        Count: reconciliation.targetCount,
      },
      {
        Metric: 'Primary Key Column',
        Value: reconciliation.primaryKey,
        Count: '',
      },
      {
        Metric: 'Matching Records',
        Value: `${reconciliation.reconciliationMatchRate.toFixed(1)}% match rate`,
        Count: reconciliation.matchingRecords,
      },
      {
        Metric: 'Field Mismatched Records',
        Value: `${reconciliation.fieldMismatches.length} field diffs`,
        Count: reconciliation.mismatchedRecords,
      },
      {
        Metric: 'Missing in Target',
        Value: 'Source orphan records',
        Count: reconciliation.missingInTargetCount,
      },
      {
        Metric: 'Extra in Target',
        Value: 'Target orphan records',
        Count: reconciliation.extraInTargetCount,
      },
    ];
  }, [reconciliation]);

  const activeRows = useMemo(() => {
    switch (activeTab) {
      case 'executive':
        return workbookData['Executive Summary'];
      case 'validation':
        return workbookData['Validation Summary'];
      case 'failed_records':
        return workbookData['Failed Record Details'];
      case 'reconciliation':
        return reconciliationOverviewRows;
      case 'field_mismatches':
        return workbookData['Field Mismatches'];
      case 'orphan_records':
        return workbookData['Orphan Records'];
    }
  }, [activeTab, workbookData, reconciliationOverviewRows]);

  const handleDownloadCsv = () => {
    downloadCsvReport(
      activeRows,
      `dataguard-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const handleDownloadExcel = () => {
    downloadExcelReport(workbookData);
  };

  const handleDownloadPdf = () => {
    downloadPdfReport({
      validation,
      reconciliation,
      latestRun,
    });
  };

  const headers = activeRows.length > 0 ? Object.keys(activeRows[0]) : [];

  return (
    <div className="space-y-6">
      {/* Report Export Header */}
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Automated Quality Insights & Reconciliation Reports
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Generated dynamically from active validation results, reconciliation diffs, and test runs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <FileText className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            Download PDF (.pdf)
          </button>
          <button
            type="button"
            onClick={handleDownloadExcel}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Download Full Insights (.xlsx)
          </button>
        </div>
      </section>

      {/* Automated Insights Panel */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {insights.map((ins, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {ins.title}
              </h3>
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${
                  ins.severity === 'PASS'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : ins.severity === 'WARN'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-red-700 dark:text-red-400'
                }`}
              >
                {ins.severity === 'PASS' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : ins.severity === 'WARN' ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                {ins.severity === 'PASS'
                  ? 'Healthy'
                  : ins.severity === 'WARN'
                    ? 'Attention'
                    : 'Action Required'}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
              {ins.finding}
            </p>
            <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Recommended action: {ins.recommendation}
            </p>
          </div>
        ))}
      </section>

      {/* Report Selector Tabs + Preview Table */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                { id: 'executive', label: 'Executive Summary' },
                { id: 'validation', label: 'Data Validation Report' },
                { id: 'failed_records', label: 'Failed Record Report' },
                { id: 'reconciliation', label: 'ETL Reconciliation Report' },
                { id: 'field_mismatches', label: 'Field Mismatch Report' },
                { id: 'orphan_records', label: 'Missing & Orphan Records' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Excel workbook includes 5 sheets: Executive Summary (with QA Insights) · Validation Summary · Failed Record Details · Field Mismatches · Orphan Records.
          </p>
        </div>

        <div className="overflow-x-auto">
          {activeRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No records present in this report section for the active dataset.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {activeRows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    {headers.map((h) => (
                      <td
                        key={h}
                        className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-200"
                      >
                        {String(row[h] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};
