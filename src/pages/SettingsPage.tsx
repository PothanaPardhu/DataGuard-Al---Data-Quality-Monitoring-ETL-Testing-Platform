import { RotateCcw, Save } from 'lucide-react';
import React, { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AppSettings } from '../types/dataguard';

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onResetDemo: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  onResetDemo,
}) => {
  const [tolerance, setTolerance] = useState(String(settings.numericTolerance));
  const [trimWhitespace, setTrimWhitespace] = useState(settings.trimWhitespace);
  const [caseSensitive, setCaseSensitive] = useState(settings.caseSensitive);
  const [maxPreviewRows, setMaxPreviewRows] = useState(String(settings.maxPreviewRows));
  const [storageMode, setStorageMode] = useState(settings.storageMode);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      numericTolerance: Math.max(0, Number(tolerance) || 0),
      trimWhitespace,
      caseSensitive,
      maxPreviewRows: Math.max(5, Math.min(500, Number(maxPreviewRows) || 50)),
      storageMode,
    });
  };

  return (
    <div className="space-y-6">
      {/* Application Info */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Application Information
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-slate-500 dark:text-slate-400">Platform</div>
            <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
              DataGuard AI
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Domain Focus</div>
            <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
              Data Quality & ETL Testing
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Validation Coverage</div>
            <div className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
              9 Rules + PK Reconciliation
            </div>
          </div>
          <div>
            <div className="text-slate-500 dark:text-slate-400">Export Formats</div>
            <div className="mt-1 font-mono font-semibold text-slate-900 dark:text-slate-100">
              CSV · 5-Sheet XLSX · PDF
            </div>
          </div>
        </div>
      </section>

      {/* Theme & Comparison Preferences */}
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-6"
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Appearance & Comparison Preferences
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Configure theme polarity, reconciliation tolerances, preview limits, and persistence mode.
            </p>
          </div>
          <div className="inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => onUpdateSettings({ theme: 'light' })}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                settings.theme === 'light'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Light Theme
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ theme: 'dark' })}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                settings.theme === 'dark'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
              }`}
            >
              Dark Theme
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Default Numeric Tolerance
            </label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Maximum Preview Rows
            </label>
            <input
              type="number"
              min="5"
              max="500"
              value={maxPreviewRows}
              onChange={(e) => setMaxPreviewRows(e.target.value)}
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Storage Mode
            </label>
            <select
              value={storageMode}
              onChange={(e) =>
                setStorageMode(e.target.value as AppSettings['storageMode'])
              }
              className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="local_hybrid">Local Persistent (Express + Browser Demo)</option>
              <option value="browser_only">Browser LocalStorage Only</option>
              <option value="firebase_optional">Firebase Firestore (Optional Adapter)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-6 text-xs text-slate-700 dark:text-slate-300">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={trimWhitespace}
              onChange={(e) => setTrimWhitespace(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Trim leading/trailing whitespace during validation and reconciliation
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Enforce case-sensitive string & key matching
          </label>
        </div>

        {storageMode === 'firebase_optional' && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            Firebase Firestore integration is optional. When Firebase credentials are not configured in environment variables, DataGuard AI automatically operates in zero-config local demo mode without blocking any features.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/30 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Demo Data
          </button>

          <button
            type="submit"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            Save Preferences
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset Demo Environment"
        description="This will restore the initial sample datasets, default 10 QA test cases, baseline execution history, and default comparison preferences. Any custom uploaded CSVs or test cases will be replaced."
        confirmLabel="Reset Demo Data"
        destructive
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={() => {
          onResetDemo();
          setResetConfirmOpen(false);
        }}
      />
    </div>
  );
};
