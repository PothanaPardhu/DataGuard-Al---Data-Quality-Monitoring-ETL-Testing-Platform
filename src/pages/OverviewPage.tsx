import {
  ArrowUpRight,
  Database,
  Download,
  FileWarning,
  GitCompare,
  Play,
  ShieldCheck,
} from 'lucide-react';
import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatusIndicator } from '../components/StatusIndicator';
import {
  buildReportData,
  downloadExcelReport,
  downloadPdfReport,
} from '../engine/reportGenerator';
import { AppPersistedState, PageId } from '../types/dataguard';

interface OverviewPageProps {
  state: AppPersistedState;
  onNavigate: (page: PageId) => void;
  onLoadSample: (mode: 'dirty' | 'clean') => void;
  onExecuteAll: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  state,
  onNavigate,
  onLoadSample,
  onExecuteAll,
}) => {
  const { latestValidation, latestReconciliation, executionHistory, datasetHistory } = state;

  const totalDatasets = datasetHistory.length;
  const totalRuns = executionHistory.length;
  const passedChecks = latestValidation?.passedChecksCount ?? 0;
  const failedChecks = latestValidation?.failedChecksCount ?? 0;
  const qualityScore = latestValidation?.qualityScore ?? 0;

  const trendData = [...executionHistory]
    .slice(0, 12)
    .reverse()
    .map((run, idx) => ({
      runLabel: `Run ${idx + 1}`,
      timestamp: new Date(run.executedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      qualityScore: run.qualityScore,
      passedTests: run.passedTests,
      failedTests: run.failedTests,
    }));

  const errorDistributionData = (latestValidation?.ruleResults ?? [])
    .filter((r) => r.status !== 'SKIPPED')
    .map((r) => ({
      rule: r.ruleName
        .replace(' Validation', '')
        .replace(' Detection', '')
        .replace(' & Calendar', ''),
      failed: r.failedRecords,
      passed: r.passedRecords,
    }));

  const handleExportSummary = () => {
    const data = buildReportData({
      validation: latestValidation,
      reconciliation: latestReconciliation,
      latestRun: executionHistory[0] ?? null,
    });
    downloadExcelReport(data);
  };

  const handleExportPdf = () => {
    downloadPdfReport({
      validation: latestValidation,
      reconciliation: latestReconciliation,
      latestRun: executionHistory[0] ?? null,
    });
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions Bar */}
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Pipeline Quality Command
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Active Source: <span className="font-mono text-slate-700 dark:text-slate-200">{state.sourceDataset?.name ?? 'None'}</span>
            {' · '}
            Active Target: <span className="font-mono text-slate-700 dark:text-slate-200">{state.targetDataset?.name ?? 'None'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onLoadSample('dirty')}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <FileWarning className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            Load Dirty Sample
          </button>
          <button
            type="button"
            onClick={() => onLoadSample('clean')}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Load Clean Sample
          </button>
          <button
            type="button"
            onClick={handleExportSummary}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export XLSX
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={onExecuteAll}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5" />
            Execute Suite
          </button>
        </div>
      </section>

      {/* Primary KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Data Quality Score</span>
            <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {qualityScore.toFixed(1)}%
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {latestValidation
              ? `${latestValidation.passedRules}/${latestValidation.totalRulesExecuted} rules passing`
              : 'Run validation to score'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Datasets</span>
            <Database className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {totalDatasets}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Ingested in active session
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Validation Runs</span>
            <GitCompare className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {totalRuns}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Match rate: {(latestReconciliation?.reconciliationMatchRate ?? 0).toFixed(1)}%
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Passed Checks</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {passedChecks.toLocaleString()}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Record-level assertions
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Failed Checks</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            {failedChecks.toLocaleString()}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {latestValidation?.allErrors.length ?? 0} logged row violations
          </div>
        </div>
      </section>

      {/* Charts Section */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Data Quality Score Trend
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quality score progression across recorded execution runs
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap"
            >
              History
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-[260px] w-full">
            {trendData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Execute a validation or test suite run to view trends.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dgScoreFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis dataKey="runLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="qualityScore"
                    name="Quality Score (%)"
                    stroke="#2563EB"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#dgScoreFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Error Distribution by Validation Rule
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Failed records identified across the 9 active quality checks
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('validation')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap"
            >
              Inspect Rules
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-[260px] w-full">
            {errorDistributionData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No validation results available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={errorDistributionData}
                  margin={{ top: 10, right: 16, left: -12, bottom: 28 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis
                    dataKey="rule"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={0}
                    angle={-22}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="failed" name="Failed Records" fill="#DC2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Bottom Tables: Recent Datasets + Recent Validation Activity */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Datasets
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('sources')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap"
            >
              Manage Sources
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Dataset</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-right">Rows</th>
                  <th className="px-4 py-3 text-right">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {datasetHistory.slice(0, 6).map((ds) => (
                  <tr
                    key={ds.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                      {ds.name}
                    </td>
                    <td className="px-4 py-2.5 text-xs capitalize text-slate-600 dark:text-slate-300">
                      {ds.role}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                      {ds.rowCount}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                      {ds.qualityScore !== null ? `${ds.qualityScore.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Validation & Suite Activity
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap"
            >
              View All Runs
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Trigger</th>
                  <th className="px-4 py-3 text-right">Pass / Fail</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {executionHistory.slice(0, 6).map((run) => (
                  <tr
                    key={run.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {new Date(run.executedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200">
                      {run.trigger}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-slate-700 dark:text-slate-200 tabular-nums whitespace-nowrap">
                      {run.passedTests} / {run.failedTests}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusIndicator status={run.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
