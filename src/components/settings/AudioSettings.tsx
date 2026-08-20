import React, { useState, useEffect } from 'react';
import { Volume2, Sparkles, Key, CheckCircle, Trash2, RefreshCw, Radio } from 'lucide-react';
import { useTtsStore } from '../../stores/ttsStore';
import { useAppStore } from '../../stores/appStore';
import { t } from '../../i18n';
import { Button } from '../common/Button';
import { VoiceSelector } from '../audio/VoiceSelector';
import { SpeedSelector } from '../audio/SpeedSelector';
import { ttsApi } from '../../services/tts';

export const AudioSettings: React.FC = () => {
  const { language, showToast } = useAppStore();
  const {
    currentProvider,
    setProvider,
    selectedVoice,
    setVoice,
    speechSpeed,
    setSpeed,
    autoPlayOnStudy,
    setAutoPlayOnStudy,
    providers,
    loadProviders,
    cacheStats,
    loadCacheStats,
  } = useTtsStore();

  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);

  useEffect(() => {
    loadProviders();
    loadCacheStats();
  }, []);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setIsSavingKey(true);
    try {
      await ttsApi.saveProviderCredentials(currentProvider, apiKey.trim());
      await loadProviders();
      showToast(t('savedSuccessfully', language));
      setApiKey('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleTestVoice = async () => {
    setIsTesting(true);
    setTestSuccess(false);
    try {
      const result = await ttsApi.testProvider(currentProvider, apiKey ? apiKey.trim() : undefined);
      if (result.base64_data) {
        const audio = new Audio(`data:${result.mime_type};base64,${result.base64_data}`);
        await audio.play();
        setTestSuccess(true);
        loadCacheStats();
        setTimeout(() => setTestSuccess(false), 4000);
      }
    } catch (e) {
      console.error('TTS test failed:', e);
      showToast('Speech test failed. Please verify provider credentials.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearCache = async (unusedOnly: boolean) => {
    try {
      const count = await ttsApi.clearCache(unusedOnly);
      await loadCacheStats();
      showToast(`Cleaned ${count} cached audio files.`);
    } catch (e) {
      console.error(e);
    }
  };

  const selectedProviderInfo = providers.find((p) => p.id === currentProvider);

  return (
    <div className="space-y-6">
      {/* Provider Selector */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-emerald-600" />
          <span>{t('ttsProvider', language)}</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {providers.map((p) => {
            const isSelected = currentProvider === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {p.name}
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {p.description}
                </p>

                <div className="mt-3 flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                      p.is_configured
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {p.is_configured ? 'Ready' : 'Requires Key'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* API Key Configuration if Cloud Provider */}
        {selectedProviderInfo?.requires_key && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {selectedProviderInfo.name} {t('ttsApiKey', language)}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  selectedProviderInfo.is_configured
                    ? '•••••••••••••••• (API Key Configured)'
                    : t('ttsApiKeyPlaceholder', language)
                }
                className="flex-1 px-3.5 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={handleSaveKey}
                disabled={isSavingKey || !apiKey.trim()}
              >
                Save Key
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              Your API key is securely encrypted locally and never transmitted to the browser context.
            </p>
          </div>
        )}

        {/* Voice & Speed */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              {t('ttsVoice', language)}
            </label>
            <VoiceSelector
              provider={currentProvider}
              selectedVoice={selectedVoice}
              onChange={setVoice}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              {t('ttsSpeed', language)}
            </label>
            <SpeedSelector speed={speechSpeed} onChange={setSpeed} />
          </div>
        </div>

        {/* Test Voice Action */}
        <div className="pt-2 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Volume2 className="w-4 h-4 text-emerald-600" />}
            onClick={handleTestVoice}
            disabled={isTesting}
          >
            {isTesting ? t('ttsTesting', language) : t('ttsTestVoice', language)}
          </Button>

          {testSuccess && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 animate-fade-in">
              <CheckCircle className="w-4 h-4" />
              Pronunciation verified successfully!
            </span>
          )}
        </div>
      </div>

      {/* Auto-Play Preferences */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('ttsAutoPlay', language)}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('ttsAutoPlayDesc', language)}
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoPlayOnStudy}
              onChange={(e) => setAutoPlayOnStudy(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
          </label>
        </div>
      </div>

      {/* Cache Management */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-blue-500" />
          <span>{t('ttsCacheTitle', language)}</span>
        </h4>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-center">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase">
              {t('ttsCachedFiles', language)}
            </span>
            <strong className="text-lg font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5 block">
              {cacheStats?.total_files || 0}
            </strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-center">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase">
              {t('ttsCacheSize', language)}
            </span>
            <strong className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
              {cacheStats ? (cacheStats.total_size_bytes / (1024 * 1024)).toFixed(2) : '0.00'} MB
            </strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-center">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase">
              {t('ttsTotalPlays', language)}
            </span>
            <strong className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono mt-0.5 block">
              {cacheStats?.total_plays || 0}
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleClearCache(true)}
          >
            {t('ttsClearUnused', language)}
          </Button>

          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => handleClearCache(false)}
          >
            {t('ttsClearAll', language)}
          </Button>
        </div>
      </div>
    </div>
  );
};
