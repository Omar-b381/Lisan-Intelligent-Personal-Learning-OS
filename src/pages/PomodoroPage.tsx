import React, { useState } from 'react';
import { PomodoroWidget } from '../components/pomodoro/PomodoroWidget';
import { usePomodoroStore } from '../stores/pomodoroStore';
import { useAppStore } from '../stores/appStore';
import { Button } from '../components/common/Button';
import { GraduationCap, Sliders, Volume2, VolumeX, Bell } from 'lucide-react';
import { t } from '../i18n';

export const PomodoroPage: React.FC = () => {
  const { language, startStudyForDeck } = useAppStore();
  const { config, updateConfig } = usePomodoroStore();
  const [focusMins, setFocusMins] = useState(Math.floor(config.focus_duration_secs / 60));
  const [shortMins, setShortMins] = useState(Math.floor(config.short_break_duration_secs / 60));
  const [longMins, setLongMins] = useState(Math.floor(config.long_break_duration_secs / 60));
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateConfig({
      ...config,
      focus_duration_secs: focusMins * 60,
      short_break_duration_secs: shortMins * 60,
      long_break_duration_secs: longMins * 60,
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('navPomodoro', language)}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Integrated study focus timer with real-time active recall tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            icon={<GraduationCap className="w-4 h-4" />}
            onClick={() => startStudyForDeck(null)}
          >
            Study Cards in Focus
          </Button>

          <Button
            size="sm"
            variant="outline"
            icon={<Sliders className="w-4 h-4" />}
            onClick={() => setIsEditing(!isEditing)}
          >
            Settings
          </Button>
        </div>
      </div>

      {/* Main Timer Display */}
      <PomodoroWidget />

      {/* Inline Config Panel */}
      {isEditing && (
        <form
          onSubmit={handleSaveSettings}
          className="max-w-xl mx-auto p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4 animate-slide-up"
        >
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Pomodoro Interval Customization
          </h4>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Focus (min)</label>
              <input
                type="number"
                min={1}
                max={90}
                value={focusMins}
                onChange={(e) => setFocusMins(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Short Break (min)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={shortMins}
                onChange={(e) => setShortMins(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Long Break (min)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={longMins}
                onChange={(e) => setLongMins(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() =>
                updateConfig({ ...config, sound_enabled: !config.sound_enabled })
              }
              className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              {config.sound_enabled ? (
                <Volume2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
              <span>Sound Notifications: {config.sound_enabled ? 'ON' : 'OFF'}</span>
            </button>

            <Button size="sm" type="submit" variant="primary">
              Save Durations
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
