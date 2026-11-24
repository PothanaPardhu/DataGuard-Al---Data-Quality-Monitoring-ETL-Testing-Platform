/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useState } from 'react';
import { LayoutShell } from './components/LayoutShell';
import { useDataGuardStore } from './hooks/useDataGuardStore';
import { DataSourcesPage } from './pages/DataSourcesPage';
import { DataValidationPage } from './pages/DataValidationPage';
import { EtlReconciliationPage } from './pages/EtlReconciliationPage';
import { ExecutionHistoryPage } from './pages/ExecutionHistoryPage';
import { OverviewPage } from './pages/OverviewPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TestCasesPage } from './pages/TestCasesPage';
import { PageId } from './types/dataguard';

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('overview');
  const {
    state,
    isBusy,
    notification,
    dismissNotification,
    uploadDataset,
    loadSamplePair,
    runValidation,
    runReconciliation,
    createTestCase,
    updateTestCase,
    deleteTestCase,
    executeSingleTest,
    executeAllTests,
    updateSettings,
    resetDemo,
  } = useDataGuardStore();

  const toggleTheme = () => {
    updateSettings({
      theme: state.settings.theme === 'dark' ? 'light' : 'dark',
    });
  };

  return (
    <LayoutShell
      activePage={activePage}
      onNavigate={setActivePage}
      theme={state.settings.theme}
      onToggleTheme={toggleTheme}
      onExecuteSuite={executeAllTests}
      isBusy={isBusy}
      sourceName={state.sourceDataset?.name ?? 'None'}
      targetName={state.targetDataset?.name ?? 'None'}
    >
      {notification && (
        <div
          role="status"
          className={`mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            notification.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
              : notification.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : notification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <Info className="h-4 w-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={dismissNotification}
            className="rounded-md p-1 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {activePage === 'overview' && (
        <OverviewPage
          state={state}
          onNavigate={setActivePage}
          onLoadSample={loadSamplePair}
          onExecuteAll={executeAllTests}
        />
      )}

      {activePage === 'sources' && (
        <DataSourcesPage
          sourceDataset={state.sourceDataset}
          targetDataset={state.targetDataset}
          maxPreviewRows={state.settings.maxPreviewRows}
          onUploadDataset={uploadDataset}
          onLoadSample={loadSamplePair}
        />
      )}

      {activePage === 'validation' && (
        <DataValidationPage
          key={`${state.sourceDataset?.id ?? 'no-src'}-${state.targetDataset?.id ?? 'no-tgt'}-${state.settings.trimWhitespace}-${state.settings.caseSensitive}`}
          sourceDataset={state.sourceDataset}
          targetDataset={state.targetDataset}
          config={state.validationConfig}
          summary={state.latestValidation}
          onRunValidation={runValidation}
        />
      )}

      {activePage === 'reconciliation' && (
        <EtlReconciliationPage
          key={`${state.sourceDataset?.id ?? 'no-src'}-${state.targetDataset?.id ?? 'no-tgt'}-${state.settings.numericTolerance}-${state.settings.trimWhitespace}-${state.settings.caseSensitive}`}
          sourceDataset={state.sourceDataset}
          targetDataset={state.targetDataset}
          config={state.reconciliationConfig}
          summary={state.latestReconciliation}
          onRunReconciliation={runReconciliation}
        />
      )}

      {activePage === 'test-cases' && (
        <TestCasesPage
          testCases={state.testCases}
          onCreateTestCase={createTestCase}
          onUpdateTestCase={updateTestCase}
          onDeleteTestCase={deleteTestCase}
          onExecuteSingle={executeSingleTest}
          onExecuteAll={executeAllTests}
        />
      )}

      {activePage === 'history' && (
        <ExecutionHistoryPage executionHistory={state.executionHistory} />
      )}

      {activePage === 'reports' && (
        <ReportsPage
          validation={state.latestValidation}
          reconciliation={state.latestReconciliation}
          latestRun={state.executionHistory[0] ?? null}
        />
      )}

      {activePage === 'settings' && (
        <SettingsPage
          settings={state.settings}
          onUpdateSettings={updateSettings}
          onResetDemo={resetDemo}
        />
      )}
    </LayoutShell>
  );
}
