import { Play, Search, SlidersHorizontal } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { StatusIndicator } from '../components/StatusIndicator';
import { VALIDATION_RULE_METADATA } from '../engine/validationEngine';
import {
  DatasetRecord,
  InferredDataType,
  ValidationConfig,
  ValidationRuleId,
  ValidationSummary,
} from '../types/dataguard';

interface DataValidationPageProps {
  sourceDataset: DatasetRecord | null;
  targetDataset: DatasetRecord | null;
  config: ValidationConfig;
  summary: ValidationSummary | null;
  onRunValidation: (config: ValidationConfig) => void;
}

const RULE_ORDER: ValidationRuleId[] = [
  'non_empty',
  'required_columns',
  'missing_null',
  'duplicate_rows',
  'primary_key_unique',
  'data_type',
  'email_format',
  'negative_amount',
  'date_format',
];

export const DataValidationPage: React.FC<DataValidationPageProps> = ({
  sourceDataset,
  targetDataset,
  config,
  summary,
  onRunValidation,
}) => {
  const [localConfig, setLocalConfig] = useState<ValidationConfig>(config);
  const [showConfig, setShowConfig] = useState(true);
  const [selectedRuleFilter, setSelectedRuleFilter] = useState<string>('ALL');
  const [errorSearch, setErrorSearch] = useState('');

  const activeDataset =
    localConfig.targetRole === 'source' ? sourceDataset : targetDataset;
  const headers = activeDataset?.headers ?? [];

  const toggleRule = (ruleId: ValidationRuleId) => {
    setLocalConfig((prev) => ({
      ...prev,
      enabledRules: {
        ...prev.enabledRules,
        [ruleId]: !prev.enabledRules[ruleId],
      },
    }));
  };

  const toggleColumnInList = (
    key: 'requiredColumns' | 'emailColumns' | 'amountColumns' | 'dateColumns',
    col: string
  ) => {
    setLocalConfig((prev) => {
      const exists = prev[key].includes(col);
      return {
        ...prev,
        [key]: exists ? prev[key].filter((c) => c !== col) : [...prev[key], col],
      };
    });
  };

  const filteredErrors = useMemo(() => {
    if (!summary) return [];
    const q = errorSearch.trim().toLowerCase();
    return summary.allErrors.filter((err) => {
      if (selectedRuleFilter !== 'ALL' && err.ruleId !== selectedRuleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        err.ruleName.toLowerCase().includes(q) ||
        err.column.toLowerCase().includes(q) ||
        err.value.toLowerCase().includes(q) ||
        err.reason.toLowerCase().includes(q) ||
        (err.primaryKeyValue ?? '').toLowerCase().includes(q)
      );
    });
  }, [summary, selectedRuleFilter, errorSearch]);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            9-Rule Data Validation Engine
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Configure target dataset, schema rules, and inspect row-level quality exceptions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowConfig((v) => !v)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showConfig ? 'Hide Rule Config' : 'Configure Rules'}
          </button>
          <button
            type="button"
            onClick={() => onRunValidation(localConfig)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5" />
            Run Validation
          </button>
        </div>
      </section>

      {/* Configuration Panel */}
      {showConfig && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Dataset to Validate
              </label>
              <select
                value={localConfig.targetRole}
                onChange={(e) =>
                  setLocalConfig((prev) => ({
                    ...prev,
                    targetRole: e.target.value as 'source' | 'target',
                  }))
                }
                className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="source">
                  Source ({sourceDataset?.name ?? 'Not Loaded'})
                </option>
                <option value="target">
                  Target ({targetDataset?.name ?? 'Not Loaded'})
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Primary Key Column
              </label>
              <select
                value={localConfig.primaryKeyColumn}
                onChange={(e) =>
                  setLocalConfig((prev) => ({ ...prev, primaryKeyColumn: e.target.value }))
                }
                className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Comparison Normalization
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
                <label className="inline-flex items-center gap-2 cursor-pointer">
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
                <label className="inline-flex items-center gap-2 cursor-pointer">
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
                  Case Sensitive
                </label>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <h3 className="mb-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Active Validation Rules (9)
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {RULE_ORDER.map((ruleId, idx) => (
                <label
                  key={ruleId}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-xs transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <input
                    type="checkbox"
                    checked={localConfig.enabledRules[ruleId]}
                    onChange={() => toggleRule(ruleId)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {idx + 1}. {VALIDATION_RULE_METADATA[ruleId].name}
                    </div>
                    <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                      {VALIDATION_RULE_METADATA[ruleId].description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {headers.length > 0 && (
            <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Required Columns
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {headers.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => toggleColumnInList('requiredColumns', col)}
                      className={`rounded-md border px-2 py-1 font-mono text-xs transition-colors ${
                        localConfig.requiredColumns.includes(col)
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email Columns
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {headers.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => toggleColumnInList('emailColumns', col)}
                      className={`rounded-md border px-2 py-1 font-mono text-xs transition-colors ${
                        localConfig.emailColumns.includes(col)
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Amount Columns
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {headers.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => toggleColumnInList('amountColumns', col)}
                      className={`rounded-md border px-2 py-1 font-mono text-xs transition-colors ${
                        localConfig.amountColumns.includes(col)
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Date Columns
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {headers.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => toggleColumnInList('dateColumns', col)}
                      className={`rounded-md border px-2 py-1 font-mono text-xs transition-colors ${
                        localConfig.dateColumns.includes(col)
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {headers.length > 0 && (
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Expected Column Data Types
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {headers.map((col) => (
                  <div key={col} className="flex flex-col gap-1">
                    <span className="truncate font-mono text-xs text-slate-600 dark:text-slate-400">
                      {col}
                    </span>
                    <select
                      value={localConfig.expectedTypes[col] ?? 'string'}
                      onChange={(e) =>
                        setLocalConfig((prev) => ({
                          ...prev,
                          expectedTypes: {
                            ...prev.expectedTypes,
                            [col]: e.target.value as InferredDataType,
                          },
                        }))
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="integer">integer</option>
                      <option value="date">date</option>
                      <option value="email">email</option>
                      <option value="boolean">boolean</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Summary Bar */}
      {summary && (
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Quality Score</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {summary.qualityScore.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Rules Passed / Failed</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {summary.passedRules} / {summary.failedRules}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Records Evaluated</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {summary.totalRows}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400">Row-Level Errors</div>
            <div className="mt-1 font-mono text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">
              {summary.allErrors.length}
            </div>
          </div>
        </section>
      )}

      {/* Rule Results Table */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Validation Rule Results
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Rule Name</th>
                <th className="px-4 py-3 text-right">Checked</th>
                <th className="px-4 py-3 text-right">Passed</th>
                <th className="px-4 py-3 text-right">Failed</th>
                <th className="px-4 py-3 text-right">Pass Rate</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(summary?.ruleResults ?? []).map((rule) => (
                <tr
                  key={rule.ruleId}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {rule.ruleName}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {rule.recordsChecked}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {rule.passedRecords}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-red-600 dark:text-red-400">
                    {rule.failedRecords}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {rule.passRate.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    <StatusIndicator status={rule.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedRuleFilter(rule.ruleId)}
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 whitespace-nowrap"
                    >
                      Errors ({rule.rowErrors.length})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Row-Level Error Details */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Row-Level Validation Errors ({filteredErrors.length})
            </h3>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={selectedRuleFilter}
              onChange={(e) => setSelectedRuleFilter(e.target.value)}
              className="min-h-[38px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="ALL">All Rules</option>
              {RULE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {VALIDATION_RULE_METADATA[r].name}
                </option>
              ))}
            </select>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={errorSearch}
                onChange={(e) => setErrorSearch(e.target.value)}
                placeholder="Filter errors..."
                className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Row</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Rule</th>
                <th className="px-4 py-3">Column</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Failure Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredErrors.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No row-level validation violations match the current filter.
                  </td>
                </tr>
              ) : (
                filteredErrors.map((err, i) => (
                  <tr
                    key={`${err.ruleId}-${err.rowIndex}-${err.column}-${i}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {err.rowIndex}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {err.primaryKeyValue || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                      {err.ruleName}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-blue-600 dark:text-blue-400">
                      {err.column}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-red-600 dark:text-red-400">
                      {err.value || '<empty>'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      {err.reason}
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
