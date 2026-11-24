import {
  CLEAN_SOURCE_CSV,
  CLEAN_TARGET_CSV,
  DIRTY_SOURCE_CSV,
  DIRTY_TARGET_CSV,
  getDefaultSettings,
  getDefaultTestCases,
} from '../data/sampleDatasets';
import { runReconciliationEngine } from '../engine/reconciliationEngine';
import { buildDatasetFromCsv, suggestValidationConfig } from '../engine/schemaDetector';
import { executeTestSuite } from '../engine/testSuiteEngine';
import { AppPersistedState } from '../types/dataguard';

const LOCAL_STORAGE_KEY = 'dataguard_ai_state_v1';

export function buildInitialDemoState(mode: 'dirty' | 'clean' = 'dirty'): AppPersistedState {
  const settings = getDefaultSettings();
  const srcCsv = mode === 'dirty' ? DIRTY_SOURCE_CSV : CLEAN_SOURCE_CSV;
  const tgtCsv = mode === 'dirty' ? DIRTY_TARGET_CSV : CLEAN_TARGET_CSV;

  const srcRes = buildDatasetFromCsv({
    id: `ds-src-${mode}`,
    role: 'source',
    name: mode === 'dirty' ? 'dirty_source.csv' : 'clean_source.csv',
    fileName: mode === 'dirty' ? 'dirty_source.csv' : 'clean_source.csv',
    csvContent: srcCsv,
    isSample: true,
  });

  const tgtRes = buildDatasetFromCsv({
    id: `ds-tgt-${mode}`,
    role: 'target',
    name: mode === 'dirty' ? 'dirty_target.csv' : 'clean_target.csv',
    fileName: mode === 'dirty' ? 'dirty_target.csv' : 'clean_target.csv',
    csvContent: tgtCsv,
    isSample: true,
  });

  const sourceDataset = srcRes.dataset!;
  const targetDataset = tgtRes.dataset!;

  const validationConfig = suggestValidationConfig(sourceDataset, {
    trimWhitespace: settings.trimWhitespace,
    caseSensitive: settings.caseSensitive,
  });

  const reconciliationConfig = {
    primaryKey: validationConfig.primaryKeyColumn || 'transaction_id',
    compareColumns: sourceDataset.headers.filter(
      (h) => h !== (validationConfig.primaryKeyColumn || 'transaction_id')
    ),
    numericTolerance: settings.numericTolerance,
    trimWhitespace: settings.trimWhitespace,
    caseSensitive: settings.caseSensitive,
  };

  const defaultTests = getDefaultTestCases();
  const suiteOutput = executeTestSuite({
    testCases: defaultTests,
    trigger: 'Full Suite',
    sourceDataset,
    targetDataset,
    validationConfig,
    reconciliationConfig,
  });

  // Also run clean baseline if starting in dirty mode so regression view works immediately
  const history = [suiteOutput.run];
  if (mode === 'dirty') {
    const cleanSrc = buildDatasetFromCsv({
      id: 'ds-src-baseline',
      role: 'source',
      name: 'clean_source.csv',
      fileName: 'clean_source.csv',
      csvContent: CLEAN_SOURCE_CSV,
      isSample: true,
    }).dataset!;
    const cleanTgt = buildDatasetFromCsv({
      id: 'ds-tgt-baseline',
      role: 'target',
      name: 'clean_target.csv',
      fileName: 'clean_target.csv',
      csvContent: CLEAN_TARGET_CSV,
      isSample: true,
    }).dataset!;
    const baselineSuite = executeTestSuite({
      testCases: defaultTests,
      trigger: 'Full Suite',
      sourceDataset: cleanSrc,
      targetDataset: cleanTgt,
      validationConfig: suggestValidationConfig(cleanSrc),
      reconciliationConfig,
    });
    baselineSuite.run.id = 'exec-baseline-clean';
    baselineSuite.run.executedAt = new Date(Date.now() - 3600 * 1000).toISOString();
    history.push(baselineSuite.run);
  }

  return {
    sourceDataset,
    targetDataset,
    validationConfig,
    reconciliationConfig,
    latestValidation: suiteOutput.sourceValidation,
    latestReconciliation:
      suiteOutput.reconciliation ??
      runReconciliationEngine(sourceDataset, targetDataset, reconciliationConfig),
    testCases: suiteOutput.updatedTestCases,
    executionHistory: history,
    datasetHistory: [
      {
        id: sourceDataset.id,
        name: sourceDataset.name,
        role: 'source',
        rowCount: sourceDataset.rowCount,
        columnCount: sourceDataset.columnCount,
        uploadedAt: sourceDataset.uploadedAt,
        qualityScore: suiteOutput.sourceValidation.qualityScore,
      },
      {
        id: targetDataset.id,
        name: targetDataset.name,
        role: 'target',
        rowCount: targetDataset.rowCount,
        columnCount: targetDataset.columnCount,
        uploadedAt: targetDataset.uploadedAt,
        qualityScore: null,
      },
    ],
    settings,
  };
}

export async function loadPersistedState(): Promise<AppPersistedState> {
  try {
    const localRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localRaw) {
      const parsed = JSON.parse(localRaw) as AppPersistedState;
      if (parsed && parsed.settings && Array.isArray(parsed.testCases)) {
        return parsed;
      }
    }
  } catch {
    // Fall back to server or default demo state
  }

  try {
    const resp = await fetch('/api/state');
    if (resp.ok) {
      const json = await resp.json();
      if (json && json.state && Array.isArray(json.state.testCases)) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json.state));
        return json.state as AppPersistedState;
      }
    }
  } catch {
    // Express API optional in static hosting
  }

  const initial = buildInitialDemoState('dirty');
  savePersistedState(initial).catch(() => {});
  return initial;
}

export async function savePersistedState(state: AppPersistedState): Promise<void> {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }

  if (state.settings.storageMode === 'local_hybrid') {
    try {
      await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
    } catch {
      // Static mode fallback works silently
    }
  }
}

export async function resetPersistedState(): Promise<AppPersistedState> {
  const fresh = buildInitialDemoState('dirty');
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fresh));
  } catch {
    // Ignore
  }
  try {
    await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: fresh }),
    });
  } catch {
    // Ignore
  }
  return fresh;
}
