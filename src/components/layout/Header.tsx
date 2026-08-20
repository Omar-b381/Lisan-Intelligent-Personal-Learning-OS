import React from 'react';
import {
  Flame,
  Award,
  Search,
  Plus,
  Moon,
  Sun,
  Languages,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useDeckStore } from '../../stores/deckStore';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import { t } from '../../i18n';
import { Button } from '../common/Button';

export const Header: React.FC = () => {
  const {
    activeTab,
    theme,
    setTheme,
    language,
    setLanguage,
    setCommandPaletteOpen,
  } = useAppStore();
  const { openCreateCardModal, openCreateDeckModal } = useDeckStore();
  const { overallStats, dailyPlan } = useAnalyticsStore();

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return t('navDashboard', language);
      case 'study':
        return t('navStudy', language);
      case 'decks':
        return t('navDecks', language);
      case 'browser':
        return t('navBrowser', language);
      case 'analytics':
        return t('navAnalytics', language);
      case 'pomodoro':
        return t('navPomodoro', language);
      case 'settings':
        return t('navSettings', language);
      default:
        return 'Lisan';
    }
  };

  const toggleTheme = () => {
    if (theme === 'dark') setTheme('light');
    else setTheme('dark');
  };

  const toggleLanguage = () => {
    if (language === 'en') setLanguage('ar');
    else setLanguage('en');
  };

  return (
    <header className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between select-none">
      {/* Title & Search Trigger */}
      <div className="flex items-center gap-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {getTitle()}
        </h2>

        {/* Global Quick Search / Cmd+K */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-xs font-medium border border-slate-200/80 dark:border-slate-700/60 transition-all"
        >
          <Search className="w-3.5 h-3.5" />
          <span>{t('searchPlaceholder', language).slice(0, 20)}...</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-500 dark:text-slate-300">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Badges & Actions */}
      <div className="flex items-center gap-3">
        {/* Streak Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 text-xs font-semibold">
          <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
          <span>
            {dailyPlan?.current_streak_days ?? overallStats?.current_streak_days ?? 0}{' '}
            {t('days', language)}
          </span>
        </div>

        {/* XP Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          <Award className="w-4 h-4 text-emerald-600" />
          <span>{overallStats?.total_xp ?? 0} XP</span>
        </div>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Create Card Button */}
        <Button
          size="sm"
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => openCreateCardModal()}
        >
          {t('createCard', language)}
        </Button>

        {/* Create Deck Button */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => openCreateDeckModal()}
        >
          {t('createDeck', language)}
        </Button>

        {/* Language Switcher */}
        <button
          onClick={toggleLanguage}
          title="Toggle English / Arabic"
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
        >
          <Languages className="w-4 h-4" />
        </button>

        {/* Theme Switcher */}
        <button
          onClick={toggleTheme}
          title="Toggle Light / Dark"
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
