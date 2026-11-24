import { AlertCircle, CheckCircle2, FileSpreadsheet, Search, Upload } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { DatasetRecord } from '../types/dataguard';

interface DataSourcesPageProps {
  sourceDataset: DatasetRecord | null;
  targetDataset: DatasetRecord | null;
  maxPreviewRows: number;
  onUploadDataset: (role: 'source' | 'target', fileName: string, csvContent: string) => boolean;
  onLoadSample: (mode: 'dirty' | 'clean') => void;
}

export const DataSourcesPage: React.FC<DataSourcesPageProps> = ({
  sourceDataset,
  targetDataset,
  maxPreviewRows,
  onUploadDataset,
  onLoadSample,
}) => {
  const [activePreviewRole, setActivePreviewRole] = useState<'source' | 'target'>('source');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (
    role: 'source' | 'target',
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setUploadError(null);
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
      setUploadError(`Invalid file "${file.name}". Please upload a valid .csv file.`);
      return;
    }

    if (file.size === 0) {
      setUploadError(`File "${file.name}" is 0 bytes. Empty CSV files cannot be ingested.`);
      return;
    }

    try {
      const content = await file.text();
      const ok = onUploadDataset(role, file.name, content);
      if (ok) {
        setActivePreviewRole(role);
      } else {
        setUploadError(`Failed to parse "${file.name}". Verify CSV headers and formatting.`);
      }
    } catch {
      setUploadError(`Unable to read "${file.name}".`);
    }
  };

  const activeDataset = activePreviewRole === 'source' ? sourceDataset : targetDataset;

  const filteredRows = useMemo(() => {
    if (!activeDataset) return [];
    const q = searchQuery.trim().toLowerCase();
    const rows = q
      ? activeDataset.rows.filter((row) =>
          activeDataset.headers.some((h) => String(row[h] ?? '').toLowerCase().includes(q))
        )
      : activeDataset.rows;
    return rows.slice(0, maxPreviewRows);
  }, [activeDataset, searchQuery, maxPreviewRows]);

  return (
    <div className="space-y-6">
      {/* Sample Loader Banner */}
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            CSV Ingestion & Sample Datasets
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upload custom source/target CSV extracts or load curated Deloitte QA benchmark pairs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => onLoadSample('dirty')}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            Load Dirty Sample Pair
          </button>
          <button
            type="button"
            onClick={() => onLoadSample('clean')}
            className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
          >
            Load Clean Sample Pair
          </button>
        </div>
      </section>

      {uploadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Source & Target Upload Panels */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {(
          [
            { role: 'source', title: 'Source Dataset (Extract)', ds: sourceDataset, ref: sourceInputRef },
            { role: 'target', title: 'Target Dataset (Warehouse Load)', ds: targetDataset, ref: targetInputRef },
          ] as const
        ).map(({ role, title, ds, ref }) => (
          <div
            key={role}
            className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {title}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {ds
                    ? `${ds.fileName} · ${ds.rowCount} records · ${ds.columnCount} columns`
                    : 'No CSV loaded'}
                </p>
              </div>
              <div>
                <input
                  ref={ref}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleFileSelected(role, e)}
                  className="hidden"
                  aria-label={`Upload ${role} CSV`}
                />
                <button
                  type="button"
                  onClick={() => ref.current?.click()}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload {role === 'source' ? 'Source' : 'Target'} CSV
                </button>
              </div>
            </div>

            {ds && ds.parseWarnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                {ds.parseWarnings[0]}
              </div>
            )}

            {ds ? (
              <div className="mt-4 overflow-x-auto border-t border-slate-200 pt-3 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-1.5 pr-3 font-medium">Column</th>
                      <th className="py-1.5 pr-3 font-medium">Inferred Type</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Nulls</th>
                      <th className="py-1.5 text-right font-medium">Unique</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {ds.schema.map((col) => (
                      <tr key={col.name}>
                        <td className="py-2 pr-3 font-mono font-medium text-slate-800 dark:text-slate-200">
                          {col.name}
                        </td>
                        <td className="py-2 pr-3 font-mono text-blue-600 dark:text-blue-400">
                          {col.inferredType}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {col.nullCount}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {col.uniqueCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4 text-xs text-slate-400 dark:border-slate-800">
                <FileSpreadsheet className="h-4 w-4" />
                Upload a CSV file to inspect schema and inferred data types.
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Searchable Data Preview */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setActivePreviewRole('source')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  activePreviewRole === 'source'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Source Preview ({sourceDataset?.rowCount ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewRole('target')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  activePreviewRole === 'target'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Target Preview ({targetDataset?.rowCount ?? 0})
              </button>
            </div>
            {activeDataset && (
              <span className="hidden items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 md:inline-flex">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Showing up to {maxPreviewRows} rows
              </span>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search records..."
              className="min-h-[40px] w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {!activeDataset ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No {activePreviewRole} dataset loaded. Upload a CSV or load a sample dataset above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-mono">#</th>
                  {activeDataset.headers.map((h) => (
                    <th key={h} className="px-4 py-3 font-mono whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeDataset.headers.length + 1}
                      className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      No records match "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-2.5 font-mono text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      {activeDataset.headers.map((h) => {
                        const val = row[h] ?? '';
                        const isEmpty = val.trim() === '';
                        return (
                          <td
                            key={h}
                            className={`px-4 py-2.5 font-mono whitespace-nowrap ${
                              isEmpty
                                ? 'text-red-500 italic dark:text-red-400'
                                : 'text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {isEmpty ? '<empty>' : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
