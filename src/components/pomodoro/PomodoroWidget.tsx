import React, { useEffect } from 'react';
import { Play, Pause, RotateCcw, Award } from 'lucide-react';
import { usePomodoroStore } from '../../stores/pomodoroStore';
import { useAppStore } from '../../stores/appStore';
import { t } from '../../i18n';
import { Button } from '../common/Button';

export const PomodoroWidget: React.FC = () => {
  const {
    mode,
    isActive,
    remainingSeconds,
    totalDurationSeconds,
    completedFocusSessions,
    lastSummary,
    startTimer,
    pauseTimer,
    resetTimer,
    tick,
    switchMode,
  } = usePomodoroStore();
  const { language } = useAppStore();

  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 250);
    return () => clearInterval(interval);
  }, [tick]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent =
    totalDurationSeconds > 0
      ? ((totalDurationSeconds - remainingSeconds) / totalDurationSeconds) * 100
      : 0;

  return (
    <div className="w-full max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 shadow-xl shadow-slate-200/40 dark:shadow-none text-center">
      {/* Mode Selectors */}
      <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 mb-8 max-w-xs mx-auto">
        <button
          onClick={() => switchMode('focus')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            mode === 'focus'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {t('pomodoroFocus', language)}
        </button>
        <button
          onClick={() => switchMode('short_break')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            mode === 'short_break'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {t('pomodoroShortBreak', language)}
        </button>
        <button
          onClick={() => switchMode('long_break')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            mode === 'long_break'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {t('pomodoroLongBreak', language)}
        </button>
      </div>

      {/* Big Digital Timer Display */}
      <div className="relative my-6">
        <div className="text-7xl md:text-8xl font-mono font-black tracking-tighter text-slate-900 dark:text-white">
          {formatTime(remainingSeconds)}
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-2">
          {mode === 'focus' ? 'Active Focus' : 'Rest & Recharge'}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-8">
        <div
          className={`h-full transition-all duration-300 ${
            mode === 'focus' ? 'bg-emerald-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mb-6">
        {isActive ? (
          <Button
            size="lg"
            variant="secondary"
            icon={<Pause className="w-5 h-5" />}
            onClick={pauseTimer}
            className="w-36"
          >
            {t('pause', language)}
          </Button>
        ) : (
          <Button
            size="lg"
            variant="primary"
            icon={<Play className="w-5 h-5 fill-current" />}
            onClick={startTimer}
            className="w-36 bg-emerald-600 hover:bg-emerald-500"
          >
            {t('resume', language)}
          </Button>
        )}

        <Button
          size="lg"
          variant="outline"
          icon={<RotateCcw className="w-4 h-4" />}
          onClick={resetTimer}
        >
          {t('reset', language)}
        </Button>
      </div>

      {/* Session Progress */}
      <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span>{t('sessionCount', language)}:</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full ${
                completedFocusSessions % 4 >= s
                  ? 'bg-emerald-500'
                  : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>
        <span className="font-mono">({completedFocusSessions} total)</span>
      </div>

      {/* Last Session Achievement Card */}
      {lastSummary && (
        <div className="mt-8 p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50 text-start animate-slide-up">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm mb-2">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Focus Session Logged!</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs text-slate-600 dark:text-slate-300">
            <div>
              <span className="text-slate-400 block">Focus</span>
              <span className="font-bold">{lastSummary.focus_minutes}m</span>
            </div>
            <div>
              <span className="text-slate-400 block">Reviewed</span>
              <span className="font-bold">{lastSummary.cards_reviewed} cards</span>
            </div>
            <div>
              <span className="text-slate-400 block">Accuracy</span>
              <span className="font-bold text-emerald-600">{lastSummary.success_rate}%</span>
            </div>
            <div>
              <span className="text-slate-400 block">Bonus XP</span>
              <span className="font-bold text-amber-600">+{lastSummary.xp_earned}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
