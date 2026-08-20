import React from 'react';
import { Award, CheckCircle2, RotateCcw, LayoutDashboard } from 'lucide-react';
import { Button } from '../common/Button';
import { useAppStore } from '../../stores/appStore';
import { useStudyStore } from '../../stores/studyStore';
import { t } from '../../i18n';

export const SessionCompleteModal: React.FC = () => {
  const { language, setActiveTab } = useAppStore();
  const { isSessionFinished, sessionStats, resetSession } = useStudyStore();

  if (!isSessionFinished) return null;

  const accuracy =
    sessionStats.cardsStudied > 0
      ? Math.round((sessionStats.correct / sessionStats.cardsStudied) * 100)
      : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl z-10 text-center animate-slide-up">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
          {t('sessionCompleteTitle', language)}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {t('sessionCompleteSubtitle', language)}
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs text-slate-400 font-medium block mb-1">
              {t('cardsStudied', language)}
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              {sessionStats.cardsStudied}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs text-slate-400 font-medium block mb-1">
              {t('accuracyRate', language)}
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {accuracy}%
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs text-slate-400 font-medium block mb-1">
              {t('xpBonus', language)}
            </span>
            <span className="text-xl font-bold text-amber-500 font-mono flex items-center justify-center gap-1">
              <Award className="w-4 h-4" />+{sessionStats.xpGained}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            variant="primary"
            className="w-full"
            icon={<LayoutDashboard className="w-4 h-4" />}
            onClick={() => {
              resetSession();
              setActiveTab('dashboard');
            }}
          >
            {t('returnToDashboard', language)}
          </Button>

          <Button
            variant="outline"
            className="w-full"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={() => {
              resetSession();
              setActiveTab('decks');
            }}
          >
            {t('continueStudying', language)}
          </Button>
        </div>
      </div>
    </div>
  );
};
