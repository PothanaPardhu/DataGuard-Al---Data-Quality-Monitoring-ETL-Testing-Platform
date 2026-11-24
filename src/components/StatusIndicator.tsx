import { AlertCircle, CheckCircle2, Clock, MinusCircle } from 'lucide-react';
import React from 'react';

interface StatusIndicatorProps {
  status:
    | 'PASS'
    | 'FAIL'
    | 'SKIPPED'
    | 'NOT_RUN'
    | 'MATCH'
    | 'MISMATCH'
    | 'MISSING_IN_TARGET'
    | 'EXTRA_IN_TARGET'
    | 'Critical'
    | 'High'
    | 'Medium'
    | 'Low';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  switch (status) {
    case 'PASS':
    case 'MATCH':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {status === 'PASS' ? 'Pass' : 'Matched'}
        </span>
      );
    case 'FAIL':
    case 'MISMATCH':
    case 'Critical':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 whitespace-nowrap">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {status === 'FAIL' ? 'Fail' : status === 'MISMATCH' ? 'Mismatch' : 'Critical'}
        </span>
      );
    case 'MISSING_IN_TARGET':
    case 'EXTRA_IN_TARGET':
    case 'High':
    case 'Medium':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {status === 'MISSING_IN_TARGET'
            ? 'Missing in Target'
            : status === 'EXTRA_IN_TARGET'
              ? 'Extra in Target'
              : status}
        </span>
      );
    case 'SKIPPED':
    case 'Low':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
          <MinusCircle className="h-3.5 w-3.5 shrink-0" />
          {status === 'SKIPPED' ? 'Skipped' : 'Low'}
        </span>
      );
    case 'NOT_RUN':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Not Run
        </span>
      );
  }
};
