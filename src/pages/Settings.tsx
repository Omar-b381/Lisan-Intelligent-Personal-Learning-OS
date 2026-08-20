import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Moon,
  Sun,
  Languages,
  Database,
  FileDown,
  FileUp,
  Save,
  CheckCircle,
  Volume2,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { Button } from '../components/common/Button';
import { BackupModal } from '../components/import_export/BackupModal';
import { ImportModal } from '../components/import_export/ImportModal';
import { AudioSettings } from '../components/settings/AudioSettings';
import { api } from '../services/api';
import { AppSettings } from '../types/settings';
import { t } from '../i18n';

export const Settings: React.FC = () => {
  const {
    language,
    setLanguage,
    theme,
    setTheme,
    showToast,
  } = useAppStore();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [retention, setRetention] = useState(90);
  const [maxInterval, setMaxInterval] = useState(36500);
  const [maxReviews, setMaxReviews] = useState(200);
  const [maxNew, setMaxNew] = useState(20);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    api.getAppSettings().then((s) => {
      setSettings(s);
      setRetention(Math.round(s.scheduler.desired_retention * 100));
      setMaxInterval(s.scheduler.maximum_interval_days);
      setMaxReviews(s.scheduler.max_reviews_per_day);
      setMaxNew(s.scheduler.max_new_cards_per_day);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    const updated: AppSettings = {
      ...settings,
      theme,
      language,
      scheduler: {
        ...settings.scheduler,
        desired_retention: retention / 100,
        maximum_interval_days: maxInterval,
        max_reviews_per_day: maxReviews,
        max_new_cards_per_day: maxNew,
      },
    };

    await api.saveAppSettings(updated);
    setSettings(updated);
    setIsSaved(true);
    showToast(t('savedSuccessfully', language));
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl space-y-8 animate-fade-in pb-12">
      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {t('navSettings', language)}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure memory scheduler formulas, visual themes, language, and local data vaults
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Appearance & Language */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>{t('appearance', language)}</span>
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                {t('theme', language)}
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="system">{t('themeSystem', language)}</option>
                <option value="dark">{t('themeDark', language)}</option>
                <option value="light">{t('themeLight', language)}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                {t('language', language)}
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="en">English (LTR)</option>
                <option value="ar">العربية (Arabic - RTL)</option>
              </select>
            </div>
          </div>
        </div>

        {/* FSRS Scheduler Parameters */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>{t('schedulerSettings', language)}</span>
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {t('desiredRetention', language)}: <strong className="font-mono text-emerald-600">{retention}%</strong>
              </label>
              <input
                type="range"
                min={70}
                max={98}
                value={retention}
                onChange={(e) => setRetention(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <span className="text-[10px] text-slate-400">
                Recommended 85% - 92% for optimal balance of time vs memory.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                {t('maxInterval', language)}
              </label>
              <input
                type="number"
                min={30}
                max={36500}
                value={maxInterval}
                onChange={(e) => setMaxInterval(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Max Reviews / Day
              </label>
              <input
                type="number"
                min={10}
                max={2000}
                value={maxReviews}
                onChange={(e) => setMaxReviews(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Max New Cards / Day
              </label>
              <input
                type="number"
                min={0}
                max={500}
                value={maxNew}
                onChange={(e) => setMaxNew(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Speech & Pronunciation (TTS) */}
        <AudioSettings />

        {/* Local Storage & Backup Management */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-500" />
            <span>{t('backupRestore', language)}</span>
          </h4>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              icon={<Database className="w-4 h-4" />}
              onClick={() => setIsBackupModalOpen(true)}
            >
              {t('createBackupNow', language)}
            </Button>

            <Button
              type="button"
              variant="outline"
              icon={<FileUp className="w-4 h-4" />}
              onClick={() => setIsImportModalOpen(true)}
            >
              {t('importData', language)}
            </Button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            size="lg"
            variant="primary"
            icon={<Save className="w-4 h-4" />}
          >
            Save All Preferences
          </Button>
          {isSaved && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 animate-fade-in">
              <CheckCircle className="w-4 h-4" />
              {t('savedSuccessfully', language)}
            </span>
          )}
        </div>
      </form>

      {/* Modals */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
};
