import React from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  FolderTree,
  Search,
  BarChart3,
  Timer,
  Settings,
  Sparkles,
} from 'lucide-react';
import { NavTab, useAppStore } from '../../stores/appStore';
import { usePomodoroStore } from '../../stores/pomodoroStore';
import { t } from '../../i18n';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, language } = useAppStore();
  const { isActive: isPomoActive, remainingSeconds, mode } = usePomodoroStore();

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: t('navDashboard', language), icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'study', label: t('navStudy', language), icon: <GraduationCap className="w-5 h-5" /> },
    { id: 'decks', label: t('navDecks', language), icon: <FolderTree className="w-5 h-5" /> },
    { id: 'browser', label: t('navBrowser', language), icon: <Search className="w-5 h-5" /> },
    { id: 'analytics', label: t('navAnalytics', language), icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'pomodoro', label: t('navPomodoro', language), icon: <Timer className="w-5 h-5" /> },
    { id: 'settings', label: t('navSettings', language), icon: <Settings className="w-5 h-5" /> },
  ];

  const formatPomoTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between h-full select-none">
      {/* Brand Header */}
      <div>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-slate-900 dark:text-white">
              {t('brandName', language)}
            </h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              {t('brandTagline', language)}
            </p>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span className={isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}>
                  {item.icon}
                </span>
                <span className="flex-1 text-start">{item.label}</span>
                {item.id === 'pomodoro' && isPomoActive && (
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 animate-pulse">
                    {formatPomoTime(remainingSeconds)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mini Pomodoro Status in Bottom */}
      <div className="p-4 m-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-emerald-600" />
            {mode === 'focus' ? 'Focus Session' : 'Break'}
          </span>
          <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
            {formatPomoTime(remainingSeconds)}
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{
              width: `${Math.min(100, Math.max(0, 100 - (remainingSeconds / (25 * 60)) * 100))}%`,
            }}
          />
        </div>
      </div>
    </aside>
  );
};
