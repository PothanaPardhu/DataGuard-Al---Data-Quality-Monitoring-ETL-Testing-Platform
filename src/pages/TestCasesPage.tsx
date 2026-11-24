import { Edit3, Play, Plus, Search, Trash2, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusIndicator } from '../components/StatusIndicator';
import { VALIDATION_RULE_METADATA } from '../engine/validationEngine';
import {
  TestCase,
  TestCaseCategory,
  TestRuleTarget,
  TestSeverity,
} from '../types/dataguard';

interface TestCasesPageProps {
  testCases: TestCase[];
  onCreateTestCase: (
    input: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'lastStatus'>
  ) => void;
  onUpdateTestCase: (id: string, patch: Partial<TestCase>) => void;
  onDeleteTestCase: (id: string) => void;
  onExecuteSingle: (id: string) => void;
  onExecuteAll: () => void;
}

const CATEGORIES: TestCaseCategory[] = [
  'Completeness',
  'Uniqueness',
  'Validity',
  'Accuracy',
  'Reconciliation',
];

const SEVERITIES: TestSeverity[] = ['Critical', 'High', 'Medium', 'Low'];

const RULE_TARGETS: { value: TestRuleTarget; label: string }[] = [
  ...Object.entries(VALIDATION_RULE_METADATA).map(([k, v]) => ({
    value: k as TestRuleTarget,
    label: v.name,
  })),
  { value: 'etl_reconciliation', label: 'Source-to-Target ETL Reconciliation' },
];

export const TestCasesPage: React.FC<TestCasesPageProps> = ({
  testCases,
  onCreateTestCase,
  onUpdateTestCase,
  onDeleteTestCase,
  onExecuteSingle,
  onExecuteAll,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | TestCaseCategory>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestCase | null>(null);

  const [formTestId, setFormTestId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<TestCaseCategory>('Validity');
  const [formRuleTarget, setFormRuleTarget] = useState<TestRuleTarget>('missing_null');
  const [formDatasetTarget, setFormDatasetTarget] = useState<'source' | 'target' | 'both'>(
    'source'
  );
  const [formExpected, setFormExpected] = useState('');
  const [formSeverity, setFormSeverity] = useState<TestSeverity>('High');

  const openCreateModal = () => {
    setEditingId(null);
    const nextNum = String(testCases.length + 1).padStart(3, '0');
    setFormTestId(`TC-DQ-${nextNum}`);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('Validity');
    setFormRuleTarget('missing_null');
    setFormDatasetTarget('source');
    setFormExpected('Zero rule violations across evaluated records.');
    setFormSeverity('High');
    setModalOpen(true);
  };

  const openEditModal = (tc: TestCase) => {
    setEditingId(tc.id);
    setFormTestId(tc.testId);
    setFormTitle(tc.title);
    setFormDescription(tc.description);
    setFormCategory(tc.category);
    setFormRuleTarget(tc.ruleTarget);
    setFormDatasetTarget(tc.datasetTarget);
    setFormExpected(tc.expectedResult);
    setFormSeverity(tc.severity);
    setModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTestId.trim() || !formTitle.trim()) return;

    const payload = {
      testId: formTestId.trim(),
      title: formTitle.trim(),
      description: formDescription.trim(),
      category: formCategory,
      ruleTarget: formRuleTarget,
      datasetTarget: formRuleTarget === 'etl_reconciliation' ? 'both' : formDatasetTarget,
      expectedResult: formExpected.trim(),
      severity: formSeverity,
    };

    if (editingId) {
      onUpdateTestCase(editingId, payload);
    } else {
      onCreateTestCase(payload);
    }
    setModalOpen(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return testCases.filter((tc) => {
      if (categoryFilter !== 'ALL' && tc.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        tc.testId.toLowerCase().includes(q) ||
        tc.title.toLowerCase().includes(q) ||
        tc.description.toLowerCase().includes(q)
      );
    });
  }, [testCases, search, categoryFilter]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            QA Test Case Repository ({testCases.length})
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create, configure, and execute automated data quality and ETL reconciliation test cases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            New Test Case
          </button>
          <button
            type="button"
            onClick={onExecuteAll}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5" />
            Execute Full Suite
          </button>
        </div>
      </section>

      {/* Filters + Table */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['ALL', ...CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {cat === 'ALL' ? 'All Categories' : cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search test cases..."
              className="min-h-[38px] w-full rounded-lg border border-slate-200 bg-white py-1.5 pr-3 pl-8 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Test ID</th>
                <th className="px-4 py-3">Title & Actual Result</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No test cases found. Create a new test case to begin.
                  </td>
                </tr>
              ) : (
                filtered.map((tc) => (
                  <tr
                    key={tc.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {tc.testId}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {tc.title}
                      </div>
                      <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                        {tc.description}
                      </div>
                      {tc.lastActualResult && (
                        <div className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          Result: {tc.lastActualResult}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {tc.category}
                    </td>
                    <td className="px-4 py-3">
                      <StatusIndicator status={tc.severity} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusIndicator status={tc.lastStatus ?? 'NOT_RUN'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onExecuteSingle(tc.id)}
                          title="Execute test case"
                          aria-label={`Execute ${tc.testId}`}
                          className="rounded-md p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(tc)}
                          title="Edit test case"
                          aria-label={`Edit ${tc.testId}`}
                          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(tc)}
                          title="Delete test case"
                          aria-label={`Delete ${tc.testId}`}
                          className="rounded-md p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingId ? 'Edit Test Case' : 'Create Test Case'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Test ID
                  </label>
                  <input
                    required
                    type="text"
                    value={formTestId}
                    onChange={(e) => setFormTestId(e.target.value)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Severity
                  </label>
                  <select
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value as TestSeverity)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Title
                </label>
                <input
                  required
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Primary Key Uniqueness Gate"
                  className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as TestCaseCategory)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Validation Rule / Check
                  </label>
                  <select
                    value={formRuleTarget}
                    onChange={(e) => setFormRuleTarget(e.target.value as TestRuleTarget)}
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {RULE_TARGETS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formRuleTarget !== 'etl_reconciliation' && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300">
                    Target Dataset
                  </label>
                  <select
                    value={formDatasetTarget}
                    onChange={(e) =>
                      setFormDatasetTarget(e.target.value as 'source' | 'target')
                    }
                    className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="source">Source Dataset</option>
                    <option value="target">Target Dataset</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300">
                  Expected Result
                </label>
                <input
                  type="text"
                  value={formExpected}
                  onChange={(e) => setFormExpected(e.target.value)}
                  className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[40px] rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  {editingId ? 'Save Changes' : 'Create Test Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Test Case"
        description={`Are you sure you want to remove "${deleteTarget?.testId} — ${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDeleteTestCase(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
