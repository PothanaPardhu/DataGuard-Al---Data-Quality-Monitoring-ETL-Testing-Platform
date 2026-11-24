import {
  Activity,
  CheckSquare,
  Database,
  FileSpreadsheet,
  GitCompare,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  Play,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { PageId } from '../types/dataguard';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview Dashboard', icon: LayoutDashboard },
  { id: 'sources', label: 'Data Sources', icon: Database },
  { id: 'validation', label: 'Data Validation', icon: ShieldCheck },
  { id: 'reconciliation', label: 'ETL Reconciliation', icon: GitCompare },
  { id: 'test-cases', label: 'Test Case Management', icon: CheckSquare },
  { id: 'history', label: 'Execution History', icon: History },
  { id: 'reports', label: 'Reports & Exports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface LayoutShellProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onExecuteSuite: () => void;
  isBusy: boolean;
  sourceName: string;
  targetName: string;
  children: React.ReactNode;
}

export const LayoutShell: React.FC<LayoutShellProps> = ({
  activePage,
  onNavigate,
  theme,
  onToggleTheme,
  onExecuteSuite,
  isBusy,
  sourceName,
  targetName,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeItem = NAV_ITEMS.find((n) => n.id === activePage) ?? NAV_ITEMS[0];

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [mobileMenuOpen]);

  const handleSelectPage = (id: PageId) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const renderNavContent = () => (
    <div className="flex h-full flex-col bg-[#0B1120] text-slate-200">
      <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-5">
        <button
          type="button"
          onClick={() => handleSelectPage('overview')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Activity className="h-4.5 w-4.5" />
          </div>
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            DataGuard AI
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Primary Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectPage(item.id)}
              className={`flex min-h-[42px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-800/80 p-4 text-xs text-slate-400">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Source</span>
            <span className="truncate font-mono text-slate-300 max-w-[140px]" title={sourceName}>
              {sourceName}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500">Target</span>
            <span className="truncate font-mono text-slate-300 max-w-[140px]" title={targetName}>
              {targetName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop persistent dark navy sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-800 lg:block">
        <div className="sticky top-0 h-screen">{renderNavContent()}</div>
      </aside>

      {/* Mobile slide-out drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-50 w-72 max-w-[85vw] shadow-2xl">
            {renderNavContent()}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-slate-400 sm:inline whitespace-nowrap">
                Quality Platform
              </span>
              <span className="hidden text-slate-300 dark:text-slate-600 sm:inline">/</span>
              <h1 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                {activeItem.label}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={onExecuteSuite}
              disabled={isBusy}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 sm:px-4 sm:text-sm whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5 shrink-0" />
              <span>{isBusy ? 'Running...' : 'Run Test Suite'}</span>
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
};
