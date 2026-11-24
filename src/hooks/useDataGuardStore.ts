import { useCallback, useEffect, useState } from 'react';
import {
  CLEAN_SOURCE_CSV,
  CLEAN_TARGET_CSV,
  DIRTY_SOURCE_CSV,
  DIRTY_TARGET_CSV,
} from '../data/sampleDatasets';
import { runReconciliationEngine } from '../engine/reconciliationEngine';
import { buildDatasetFromCsv, suggestValidationConfig } from '../engine/schemaDetector';
import { evaluateTestCase, executeTestSuite } from '../engine/testSuiteEngine';
import { runValidationEngine } from '../engine/validationEngine';
import {
  buildInitialDemoState,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from '../services/storageService';
import {
  AppPersistedState,
  AppSettings,
  DatasetRecord,
  ReconciliationConfig,
  TestCase,
  TestExecutionRun,
  ValidationConfig,
} from '../types/dataguard';

export function useDataGuardStore() {
  const [state, setState] = useState<AppPersistedState>(() => buildInitialDemoState('dirty'));
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4500);
    return () => clearTimeout(timer);
  }, [notification]);

  // Initial load from local/server persistence
  useEffect(() => {
    let active = true;
    loadPersistedState().then((loaded) => {
      if (!active) return;
      setState(loaded);
      setIsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Sync theme to document root
  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [state.settings.theme]);

  // Persist changes after initial load
  useEffect(() => {
    if (!isLoaded) return;
    savePersistedState(state);
  }, [state, isLoaded]);

  const uploadDataset = useCallback(
    (role: 'source' | 'target', fileName: string, csvContent: string): boolean => {
      const res = buildDatasetFromCsv({
        id: `ds-${role}-${Date.now()}`,
        role,
        name: fileName,
        fileName,
        csvContent,
        isSample: false,
      });

      if (!res.dataset || res.error) {
        notify('error', res.error || 'Failed to parse CSV file.');
        return false;
      }

      const dataset = res.dataset;

      setState((prev) => {
        const nextSource = role === 'source' ? dataset : prev.sourceDataset;
        const nextTarget = role === 'target' ? dataset : prev.targetDataset;

        const nextValConfig =
          role === 'source' || prev.validationConfig.targetRole === role
            ? suggestValidationConfig(dataset, {
                targetRole: prev.validationConfig.targetRole,
                enabledRules: prev.validationConfig.enabledRules,
                trimWhitespace: prev.settings.trimWhitespace,
                caseSensitive: prev.settings.caseSensitive,
              })
            : prev.validationConfig;

        const activeDatasetForVal =
          nextValConfig.targetRole === 'source' ? nextSource : nextTarget;
        const nextValidation = runValidationEngine(activeDatasetForVal, nextValConfig);

        const nextRecConfig: ReconciliationConfig = {
          ...prev.reconciliationConfig,
          primaryKey:
            nextSource && nextSource.headers.includes(prev.reconciliationConfig.primaryKey)
              ? prev.reconciliationConfig.primaryKey
              : nextValConfig.primaryKeyColumn,
          compareColumns:
            nextSource && nextTarget
              ? nextSource.headers.filter(
                  (h) =>
                    h !== (nextValConfig.primaryKeyColumn || prev.reconciliationConfig.primaryKey) &&
                    nextTarget.headers.includes(h)
                )
              : prev.reconciliationConfig.compareColumns,
        };

        const nextReconciliation =
          nextSource && nextTarget
            ? runReconciliationEngine(nextSource, nextTarget, nextRecConfig)
            : prev.latestReconciliation;

        return {
          ...prev,
          sourceDataset: nextSource,
          targetDataset: nextTarget,
          validationConfig: nextValConfig,
          reconciliationConfig: nextRecConfig,
          latestValidation: nextValidation,
          latestReconciliation: nextReconciliation,
          datasetHistory: [
            {
              id: dataset.id,
              name: dataset.name,
              role: dataset.role,
              rowCount: dataset.rowCount,
              columnCount: dataset.columnCount,
              uploadedAt: dataset.uploadedAt,
              qualityScore: role === 'source' ? nextValidation.qualityScore : null,
            },
            ...prev.datasetHistory,
          ].slice(0, 20),
        };
      });

      notify(
        'success',
        `Loaded ${role} dataset "${fileName}" (${dataset.rowCount} rows, ${dataset.columnCount} columns).`
      );
      return true;
    },
    [notify]
  );

  const loadSamplePair = useCallback(
    (mode: 'dirty' | 'clean') => {
      setIsBusy(true);
      const srcCsv = mode === 'dirty' ? DIRTY_SOURCE_CSV : CLEAN_SOURCE_CSV;
      const tgtCsv = mode === 'dirty' ? DIRTY_TARGET_CSV : CLEAN_TARGET_CSV;
      const srcName = mode === 'dirty' ? 'dirty_source.csv' : 'clean_source.csv';
      const tgtName = mode === 'dirty' ? 'dirty_target.csv' : 'clean_target.csv';

      const src = buildDatasetFromCsv({
        id: `ds-src-${mode}-${Date.now()}`,
        role: 'source',
        name: srcName,
        fileName: srcName,
        csvContent: srcCsv,
        isSample: true,
      }).dataset!;

      const tgt = buildDatasetFromCsv({
        id: `ds-tgt-${mode}-${Date.now()}`,
        role: 'target',
        name: tgtName,
        fileName: tgtName,
        csvContent: tgtCsv,
        isSample: true,
      }).dataset!;

      setState((prev) => {
        const valConfig = suggestValidationConfig(src, {
          targetRole: 'source',
          trimWhitespace: prev.settings.trimWhitespace,
          caseSensitive: prev.settings.caseSensitive,
        });
        const recConfig: ReconciliationConfig = {
          primaryKey: valConfig.primaryKeyColumn || 'transaction_id',
          compareColumns: src.headers.filter(
            (h) => h !== (valConfig.primaryKeyColumn || 'transaction_id')
          ),
          numericTolerance: prev.settings.numericTolerance,
          trimWhitespace: prev.settings.trimWhitespace,
          caseSensitive: prev.settings.caseSensitive,
        };

        const suite = executeTestSuite({
          testCases: prev.testCases,
          trigger: 'Full Suite',
          sourceDataset: src,
          targetDataset: tgt,
          validationConfig: valConfig,
          reconciliationConfig: recConfig,
        });

        return {
          ...prev,
          sourceDataset: src,
          targetDataset: tgt,
          validationConfig: valConfig,
          reconciliationConfig: recConfig,
          latestValidation: suite.sourceValidation,
          latestReconciliation: suite.reconciliation,
          testCases: suite.updatedTestCases,
          executionHistory: [suite.run, ...prev.executionHistory].slice(0, 50),
          datasetHistory: [
            {
              id: src.id,
              name: src.name,
              role: 'source' as const,
              rowCount: src.rowCount,
              columnCount: src.columnCount,
              uploadedAt: src.uploadedAt,
              qualityScore: suite.sourceValidation.qualityScore,
            },
            {
              id: tgt.id,
              name: tgt.name,
              role: 'target' as const,
              rowCount: tgt.rowCount,
              columnCount: tgt.columnCount,
              uploadedAt: tgt.uploadedAt,
              qualityScore: null,
            },
            ...prev.datasetHistory,
          ].slice(0, 20),
        };
      });

      setIsBusy(false);
      notify(
        'success',
        `Loaded ${mode === 'dirty' ? 'Dirty Anomaly' : 'Clean Baseline'} sample pair and executed validation & reconciliation.`
      );
    },
    [notify]
  );

  const runValidation = useCallback(
    (overrideConfig?: ValidationConfig) => {
      setIsBusy(true);
      setState((prev) => {
        const cfg = overrideConfig ?? prev.validationConfig;
        const targetDs: DatasetRecord | null =
          cfg.targetRole === 'source' ? prev.sourceDataset : prev.targetDataset;
        const summary = runValidationEngine(targetDs, cfg);

        const syntheticRun: TestExecutionRun = {
          id: `exec-val-${Date.now()}`,
          executedAt: summary.executedAt,
          trigger: 'Validation Run',
          sourceDatasetName: prev.sourceDataset?.name ?? 'None',
          targetDatasetName: prev.targetDataset?.name ?? 'None',
          totalTests: summary.totalRulesExecuted,
          passedTests: summary.passedRules,
          failedTests: summary.failedRules,
          qualityScore: summary.qualityScore,
          status: summary.failedRules === 0 ? 'PASS' : 'FAIL',
          details: summary.ruleResults
            .filter((r) => r.status !== 'SKIPPED')
            .map((r) => ({
              testCaseId: r.ruleId,
              testId: r.ruleId.toUpperCase(),
              title: r.ruleName,
              category: 'Validity',
              severity: 'High',
              ruleTarget: r.ruleId,
              status: r.status === 'PASS' ? 'PASS' : 'FAIL',
              expectedResult: '0 rule violations',
              actualResult: `${r.passedRecords}/${r.recordsChecked} passed (${r.failedRecords} failed)`,
              recordsChecked: r.recordsChecked,
              failedRecords: r.failedRecords,
            })),
        };

        return {
          ...prev,
          validationConfig: cfg,
          latestValidation: summary,
          executionHistory: [syntheticRun, ...prev.executionHistory].slice(0, 50),
        };
      });
      setIsBusy(false);
      notify('success', 'Data validation checks completed.');
    },
    [notify]
  );

  const runReconciliation = useCallback(
    (overrideConfig?: ReconciliationConfig) => {
      setIsBusy(true);
      setState((prev) => {
        const cfg = overrideConfig ?? prev.reconciliationConfig;
        const summary = runReconciliationEngine(prev.sourceDataset, prev.targetDataset, cfg);

        return {
          ...prev,
          reconciliationConfig: cfg,
          latestReconciliation: summary,
        };
      });
      setIsBusy(false);
      notify('success', 'Source-to-target ETL reconciliation completed.');
    },
    [notify]
  );

  const createTestCase = useCallback(
    (input: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'lastStatus'>) => {
      const now = new Date().toISOString();
      const newTc: TestCase = {
        ...input,
        id: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        lastStatus: 'NOT_RUN',
        createdAt: now,
        updatedAt: now,
      };
      setState((prev) => ({
        ...prev,
        testCases: [newTc, ...prev.testCases],
      }));
      notify('success', `Test case ${input.testId} created.`);
    },
    [notify]
  );

  const updateTestCase = useCallback(
    (id: string, patch: Partial<TestCase>) => {
      setState((prev) => ({
        ...prev,
        testCases: prev.testCases.map((tc) =>
          tc.id === id ? { ...tc, ...patch, updatedAt: new Date().toISOString() } : tc
        ),
      }));
      notify('success', 'Test case updated.');
    },
    [notify]
  );

  const deleteTestCase = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        testCases: prev.testCases.filter((tc) => tc.id !== id),
      }));
      notify('info', 'Test case deleted.');
    },
    [notify]
  );

  const executeSingleTest = useCallback(
    (testCaseId: string) => {
      setState((prev) => {
        const tc = prev.testCases.find((item) => item.id === testCaseId);
        if (!tc) return prev;

        const detail = evaluateTestCase(
          tc,
          prev.sourceDataset,
          prev.targetDataset,
          prev.validationConfig,
          prev.reconciliationConfig
        );

        const now = new Date().toISOString();
        const updatedTestCases = prev.testCases.map((item) =>
          item.id === testCaseId
            ? {
                ...item,
                lastStatus: detail.status,
                lastExecutedAt: now,
                lastActualResult: detail.actualResult,
              }
            : item
        );

        const run: TestExecutionRun = {
          id: `exec-single-${Date.now()}`,
          executedAt: now,
          trigger: 'Single Test',
          sourceDatasetName: prev.sourceDataset?.name ?? 'None',
          targetDatasetName: prev.targetDataset?.name ?? 'None',
          totalTests: 1,
          passedTests: detail.status === 'PASS' ? 1 : 0,
          failedTests: detail.status === 'FAIL' ? 1 : 0,
          qualityScore: detail.status === 'PASS' ? 100 : 0,
          status: detail.status,
          details: [detail],
        };

        return {
          ...prev,
          testCases: updatedTestCases,
          executionHistory: [run, ...prev.executionHistory].slice(0, 50),
        };
      });
      notify('success', 'Single test case executed.');
    },
    [notify]
  );

  const executeAllTests = useCallback(() => {
    setIsBusy(true);
    setState((prev) => {
      const suite = executeTestSuite({
        testCases: prev.testCases,
        trigger: 'Full Suite',
        sourceDataset: prev.sourceDataset,
        targetDataset: prev.targetDataset,
        validationConfig: prev.validationConfig,
        reconciliationConfig: prev.reconciliationConfig,
      });

      return {
        ...prev,
        latestValidation: suite.sourceValidation,
        latestReconciliation: suite.reconciliation,
        testCases: suite.updatedTestCases,
        executionHistory: [suite.run, ...prev.executionHistory].slice(0, 50),
      };
    });
    setIsBusy(false);
    notify('success', 'Full test suite execution recorded.');
  }, [notify]);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setState((prev) => {
        const nextSettings = { ...prev.settings, ...patch };
        const nextValConfig: ValidationConfig = {
          ...prev.validationConfig,
          trimWhitespace: nextSettings.trimWhitespace,
          caseSensitive: nextSettings.caseSensitive,
        };
        const nextRecConfig: ReconciliationConfig = {
          ...prev.reconciliationConfig,
          numericTolerance: nextSettings.numericTolerance,
          trimWhitespace: nextSettings.trimWhitespace,
          caseSensitive: nextSettings.caseSensitive,
        };

        return {
          ...prev,
          settings: nextSettings,
          validationConfig: nextValConfig,
          reconciliationConfig: nextRecConfig,
        };
      });
      notify('success', 'Settings updated.');
    },
    [notify]
  );

  const resetDemo = useCallback(async () => {
    setIsBusy(true);
    const fresh = await resetPersistedState();
    setState(fresh);
    setIsBusy(false);
    notify('info', 'Demo environment reset to initial dirty & baseline datasets.');
  }, [notify]);

  return {
    state,
    isLoaded,
    isBusy,
    notification,
    dismissNotification: () => setNotification(null),
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
  };
}
