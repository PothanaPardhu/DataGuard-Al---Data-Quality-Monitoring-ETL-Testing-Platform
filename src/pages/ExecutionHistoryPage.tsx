import { ArrowDownRight, ArrowUpRight, GitCompare, Minus } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { StatusIndicator } from '../components/StatusIndicator';
import { TestExecutionRun } from '../types/dataguard';

interface ExecutionHistoryPageProps {
  executionHistory: TestExecutionRun[];
}

export const ExecutionHistoryPage: React.FC<ExecutionHistoryPageProps> = ({
  executionHistory,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASS' | 'FAIL'>('ALL');
  const [selectedRunId, setSelectedRunId] = useState<string>(
    executionHistory[0]?.id ?? ''
  );
  const [currentCompareId, setCurrentCompareId] = useState<string>(
    executionHistory[0]?.id ?? ''
  );
  const [baselineCompareId, setBaselineCompareId] = useState<string>(
    executionHistory[1]?.id ?? executionHistory[0]?.id ?? ''
  );

  const filteredRuns = useMemo(() => {
    return executionHistory.filter((run) => {
      if (statusFilter === 'ALL') return true;
      return run.status === statusFilter;
    });
  }, [executionHistory, statusFilter]);

  const selectedRun =
    executionHistory.find((r) => r.id === selectedRunId) ?? executionHistory[0] ?? null;

  const currentRun =
    executionHistory.find((r) => r.id === currentCompareId) ?? executionHistory[0] ?? null;
  const baselineRun =
    executionHistory.find((r) => r.id === baselineCompareId) ??
    executionHistory[1] ??
    executionHistory[0] ??
    null;

  const scoreDelta =
    currentRun && baselineRun
      ? Math.round((currentRun.qualityScore - baselineRun.qualityScore) * 10) / 10
      : 0;
  const passedDelta =
    currentRun && baselineRun ? currentRun.passedTests - baselineRun.passedTests : 0;
  const failedDelta =
    currentRun && baselineRun ? currentRun.failedTests - baselineRun.failedTests : 0;

  const renderDelta = (value: number, suffix = '', invertGood = false) => {
    if (value === 0) {
      return (
        <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500 dark:text-slate-400">
          <Minus className="h-3.5 w-3.5" />0{suffix}
        </span>
      );
    }
    const isGood = invertGood ? value < 0 : value > 0;
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${
          isGood
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400'
        }`}
      >
        {value > 0 ? (
          <ArrowUpRight className="h-3.5 w-3.5" />
        ) : (
          <ArrowDownRight className="h-3.5 w-3.5" />
        )}
        {value > 0 ? `+${value}` : value}
        {suffix}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Regression Comparison Section */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Regression Comparison (Baseline vs Current)
          </h2>
        </div>

        {executionHistory.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Execute tests to compare quality regressions across runs.
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Baseline Execution
                </label>
                <select
                  value={baselineRun?.id ?? ''}
                  onChange={(e) => setBaselineCompareId(e.target.value)}
                  className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {executionHistory.map((run) => (
                    <option key={run.id} value={run.id}>
                      {new Date(run.executedAt).toLocaleString()} · {run.sourceDatasetName} ({run.qualityScore.toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Current Execution
                </label>
                <select
                  value={currentRun?.id ?? ''}
                  onChange={(e) => setCurrentCompareId(e.target.value)}
                  className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {executionHistory.map((run) => (
                    <option key={run.id} value={run.id}>
                      {new Date(run.executedAt).toLocaleString()} · {run.sourceDatasetName} ({run.qualityScore.toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {currentRun && baselineRun && (
              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Data Quality Score Delta
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {baselineRun.qualityScore.toFixed(1)}% → {currentRun.qualityScore.toFixed(1)}%
                    </span>
                    {renderDelta(scoreDelta, '%')}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Passed Checks Delta
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {baselineRun.passedTests} → {currentRun.passedTests}
                    </span>
                    {renderDelta(passedDelta)}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Failed Checks Delta
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between">
                    <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {baselineRun.failedTests} → {currentRun.failedTests}
                    </span>
                    {renderDelta(failedDelta, '', true)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Execution History Table + Selected Execution Details */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 xl:col-span-7">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Execution Log ({filteredRuns.length})
            </h3>
            <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {(['ALL', 'PASS', 'FAIL'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st === 'PASS' ? 'Passed' : 'Failed'}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Trigger / Dataset</th>
                  <th className="px-4 py-3 text-right">Pass / Total</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredRuns.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      No execution records match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredRuns.map((run) => {
                    const isSelected = selectedRun?.id === run.id;
                    return (
                      <tr
                        key={run.id}
                        onClick={() => setSelectedRunId(run.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/30'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {new Date(run.executedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {run.trigger}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {run.sourceDatasetName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                          {run.passedTests} / {run.totalTests}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                          {run.qualityScore.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3">
                          <StatusIndicator status={run.status} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 xl:col-span-5">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Execution Details
            </h3>
            {selectedRun && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {selectedRun.trigger} · {new Date(selectedRun.executedAt).toLocaleString()}
              </p>
            )}
          </div>
          {!selectedRun ? (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
              Select an execution run to inspect individual test outcomes.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {selectedRun.details.map((detail, idx) => (
                <div key={`${detail.testCaseId}-${idx}`} className="p-4 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {detail.testId} · {detail.title}
                    </span>
                    <StatusIndicator status={detail.status} />
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    {detail.actualResult}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
