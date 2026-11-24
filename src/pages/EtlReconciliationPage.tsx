import { Play, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { StatusIndicator } from '../components/StatusIndicator';
import {
  ComparisonRecordStatus,
  DatasetRecord,
  ReconciliationConfig,
  ReconciliationSummary,
} from '../types/dataguard';

interface EtlReconciliationPageProps {
  sourceDataset: DatasetRecord | null;
  targetDataset: DatasetRecord | null;
  config: ReconciliationConfig;
  summary: ReconciliationSummary | null;
  onRunReconciliation: (config: ReconciliationConfig) => void;
}

export const EtlReconciliationPage: React.FC<EtlReconciliationPageProps> = ({
  sourceDataset,
  targetDataset,
  config,
  summary,
  onRunReconciliation,
}) => {
  const [localConfig, setLocalConfig] = useState<ReconciliationConfig>(config);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ComparisonRecordStatus>('ALL');
  const [search, setSearch] = useState('');

  const sharedHeaders = useMemo(() => {
    if (!sourceDataset || !targetDataset) return sourceDataset?.headers ?? [];
    return sourceDataset.headers.filter((h) => targetDataset.headers.includes(h));
  }, [sourceDataset, targetDataset]);

  const filteredComparisons = useMemo(() => {
    if (!summary) return [];
    const q = search.trim().toLowerCase();
    return summary.comparisons.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.primaryKey.toLowerCase().includes(q) ||
        item.mismatchedFields.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [summary, statusFilter, search]);

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Source-to-Target ETL Reconciliation
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Compare primary keys, row counts, orphan records, and field-level transformations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRunReconciliation(localConfig)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5" />
            Run Reconciliation
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Primary Key
            </label>
            <select
              value={localConfig.primaryKey}
              onChange={(e) => {
                const pk = e.target.value;
                setLocalConfig((prev) => ({
                  ...prev,
                  primaryKey: pk,
                  compareColumns: sharedHeaders.filter((h) => h !== pk),
                }));
              }}
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {sharedHeaders.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Numeric Tolerance
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={localConfig.numericTolerance}
              onChange={(e) =>
                setLocalConfig((prev) => ({
                  ...prev,
                  numericTolerance: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex items-end pb-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={localConfig.trimWhitespace}
                onChange={(e) =>
                  setLocalConfig((prev) => ({
                    ...prev,
                    trimWhitespace: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              Trim Whitespace
            </label>
          </div>

          <div className="flex items-end pb-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={localConfig.caseSensitive}
                onChange={(e) =>
                  setLocalConfig((prev) => ({
                    ...prev,
                    caseSensitive: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              Case-Sensitive Comparison
            </label>
          </div>
        </div>
      </section>

      {/* Reconciliation KPI Strip */}
      {summary && (
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Match Rate</div>
            <div className="mt-1 font-mono text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {summary.reconciliationMatchRate.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Source / Target</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {summary.sourceCount} / {summary.targetCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Matched Records</div>
            <div className="mt-1 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {summary.matchingRecords}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Field Mismatches</div>
            <div className="mt-1 font-mono text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">
              {summary.mismatchedRecords}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Missing in Target</div>
            <div className="mt-1 font-mono text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {summary.missingInTargetCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Extra in Target</div>
            <div className="mt-1 font-mono text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {summary.extraInTargetCount}
            </div>
          </div>
        </section>
      )}

      {/* Field-Level Mismatch Details */}
      {summary && summary.fieldMismatches.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Field-Level Mismatches ({summary.fieldMismatches.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Primary Key</th>
                  <th className="px-4 py-3">Field</th>
                  <th className="px-4 py-3">Source Value</th>
                  <th className="px-4 py-3">Target Value</th>
                  <th className="px-4 py-3 text-right">Numeric Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {summary.fieldMismatches.map((m, idx) => (
                  <tr
                    key={`${m.primaryKey}-${m.field}-${idx}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-2.5 font-mono font-medium text-slate-900 dark:text-slate-100">
                      {m.primaryKey}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-blue-600 dark:text-blue-400">
                      {m.field}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-200">
                      {m.sourceValue || '<empty>'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-red-600 dark:text-red-400">
                      {m.targetValue || '<empty>'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {m.numericDifference !== null ? m.numericDifference : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Record-Level Comparison Table */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'MATCH', label: 'Matched' },
                { id: 'MISMATCH', label: 'Mismatched' },
                { id: 'MISSING_IN_TARGET', label: 'Missing Target' },
                { id: 'EXTRA_IN_TARGET', label: 'Extra Target' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by key or field..."
              className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Primary Key</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Src Row</th>
                <th className="px-4 py-3 text-right">Tgt Row</th>
                <th className="px-4 py-3">Mismatched Fields</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredComparisons.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No comparison records match your current filter.
                  </td>
                </tr>
              ) : (
                filteredComparisons.map((item, idx) => (
                  <tr
                    key={`${item.primaryKey}-${idx}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-2.5 font-mono font-medium text-slate-900 dark:text-slate-100">
                      {item.primaryKey}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusIndicator status={item.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {item.sourceRowIndex ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {item.targetRowIndex ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                      {item.mismatchedFields.length > 0
                        ? item.mismatchedFields.join(', ')
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
