import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Sparkles,
  Key,
  CheckCircle,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Cpu,
  Mic,
  Cloud,
  Check,
  AlertTriangle,
} from 'lucide-react';
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
    playPronunciation,
  } = useTtsStore();

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [accountInfo, setAccountInfo] = useState<import('../../types/tts').ElevenLabsAccountInfo | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    loadProviders();
    loadCacheStats();

    // Listen for TTS errors from ttsStore (IPC errors shown to user)
    const onTtsError = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail || 'TTS error';
      showToast(language === 'ar' ? `خطأ في الصوت: ${msg}` : `Audio error: ${msg}`);
    };
    window.addEventListener('lisan-tts-error', onTtsError);
    return () => window.removeEventListener('lisan-tts-error', onTtsError);
  }, [language]);

  const handleVerifyAccount = async (overrideKey?: string) => {
    const keyToTest =
      overrideKey ||
      apiKey.trim() ||
      localStorage.getItem('lisan_tts_apikey_elevenlabs') ||
      '';
    if (!keyToTest) {
      showToast(
        language === 'ar' ? 'يرجى إدخال مفتاح الـ API أولاً' : 'Please enter an API key first'
      );
      return;
    }
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const info = await ttsApi.verifyElevenLabsAccount(keyToTest);
      setAccountInfo(info);
      showToast(
        language === 'ar'
          ? 'تم التحقق من الحساب والرصيد بنجاح!'
          : 'Account verified successfully!'
      );
    } catch (e: any) {
      console.error('Account verification failed:', e);
      const msg = e?.message || (typeof e === 'string' ? e : 'Unknown verification error');
      setVerifyError(msg);
      showToast(`فشل التحقق: ${msg}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveKey = async (providerId: string) => {
    if (!apiKey.trim()) return;
    setIsSavingKey(true);
    const keyToSave = apiKey.trim().replace(/^["']|["']$/g, '').replace(/^xi-api-key:\s*/i, '');
    try {
      await ttsApi.saveProviderCredentials(providerId, keyToSave);
      localStorage.setItem(`lisan_tts_apikey_${providerId}`, keyToSave);
      await loadProviders();
      setProvider(providerId);
      showToast(
        language === 'ar'
          ? 'تم حفظ مفتاح API وتفعيل المزود بنجاح!'
          : 'API Key saved & provider activated successfully!'
      );
      setApiKey('');
      // Auto verify account if ElevenLabs
      if (providerId === 'elevenlabs') {
        handleVerifyAccount(keyToSave);
      }
      // Immediate audio playback verification
      handleTestVoice(providerId);
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Failed to save API key');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleTestVoice = async (providerId?: string) => {
    const prov = providerId || currentProvider;
    setIsTesting(true);
    setTestSuccess(false);
    try {
      await playPronunciation(
        language === 'ar'
          ? 'مرحباً، محرك النطق الصوتي يعمل بنجاح.'
          : 'Testing voice pronunciation in Lisan.',
        {
          language: language === 'ar' ? 'ar' : 'en-US',
          voice: selectedVoice || 'pNInz6obpgDQGcFmaJgB',
          speed: speechSpeed,
          onDone: () => {
            setTestSuccess(true);
            setTimeout(() => setTestSuccess(false), 4000);
          },
        }
      );
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 4000);
    } catch (e: any) {
      console.error('TTS test failed:', e);
      showToast(
        language === 'ar'
          ? `فشل اختبار الصوت: ${e?.message || 'تأكد من إعدادات المفتاح'}`
          : `Speech test failed: ${e?.message || 'Check API key'}`
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearCache = async (unusedOnly: boolean) => {
    try {
      const count = await ttsApi.clearCache(unusedOnly);
      await loadCacheStats();
      showToast(
        language === 'ar'
          ? `تم مسح ${count} ملف صوتي من الذاكرة المؤقتة`
          : `Cleaned ${count} cached audio files.`
      );
    } catch (e) {
      console.error(e);
    }
  };

  const isElevenLabsActive = currentProvider === 'elevenlabs';
  const elevenInfo = providers.find((p) => p.id === 'elevenlabs');
  const googleInfo = providers.find((p) => p.id === 'google');
  const systemInfo = providers.find((p) => p.id === 'system');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-emerald-900/20 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Volume2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {language === 'ar'
                  ? 'إعدادات النطق الصوتي وتحويل النص لكلام (TTS)'
                  : 'Speech & Pronunciation Engine (TTS)'}
              </h4>
            </div>
            <p className="text-xs text-slate-400">
              {language === 'ar'
                ? 'اختر المحرك الصوتي المستخدم لنطق البطاقات أثناء المراجعة وفي محرر البطاقات.'
                : 'Choose the default speech engine used for flashcard audio and pronunciation.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">
              {language === 'ar' ? 'المحرك النشط حالياً:' : 'Active Engine:'}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {currentProvider === 'elevenlabs'
                ? 'ElevenLabs (Event Lab AI)'
                : currentProvider === 'google'
                ? 'Google Cloud TTS'
                : 'System TTS (الكمبيوتر المحلي)'}
            </span>
          </div>
        </div>

        {/* Provider Cards Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* 1. System TTS */}
          <div
            onClick={() => setProvider('system')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
              currentProvider === 'system'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md shadow-emerald-900/10'
                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    System TTS
                  </span>
                </div>
                {currentProvider === 'system' && (
                  <Check className="w-4 h-4 text-emerald-500 font-bold" />
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? 'محرك النظام المدمج بالكمبيوتر. مجاني 100% ويعمل بدون إنترنت.'
                  : 'Native built-in OS speech synthesizer. Zero setup, offline.'}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {language === 'ar' ? 'جاهز مجاناً' : 'Free & Ready'}
              </span>
              <span className="text-[11px] text-slate-400">Offline</span>
            </div>
          </div>

          {/* 2. ElevenLabs (Event Lab) */}
          <div
            onClick={() => setProvider('elevenlabs')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
              currentProvider === 'elevenlabs'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md shadow-emerald-900/10'
                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    ElevenLabs (Event Lab)
                  </span>
                </div>
                {currentProvider === 'elevenlabs' && (
                  <Check className="w-4 h-4 text-emerald-500 font-bold" />
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? 'أصوات ذكاء اصطناعي بشرية فائقة الواقعية والنقاء بأكثر من 29 لغة.'
                  : 'Ultra-realistic human generative voice AI in 29+ languages.'}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  elevenInfo?.is_configured
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                }`}
              >
                {elevenInfo?.is_configured
                  ? language === 'ar'
                    ? 'المفتاح مفعّل'
                    : 'Configured'
                  : language === 'ar'
                  ? 'يتطلب API Key'
                  : 'Requires Key'}
              </span>
              <span className="text-[11px] text-purple-400 font-semibold">AI Neural</span>
            </div>
          </div>

          {/* 3. Google Cloud TTS */}
          <div
            onClick={() => setProvider('google')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
              currentProvider === 'google'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md shadow-emerald-900/10'
                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Google Cloud TTS
                  </span>
                </div>
                {currentProvider === 'google' && (
                  <Check className="w-4 h-4 text-emerald-500 font-bold" />
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? 'أصوات WaveNet و Neural2 السحابية بأكثر من 40 لغة عالمية.'
                  : 'Google WaveNet & Neural2 speech synthesis across 220+ voices.'}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  googleInfo?.is_configured
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                }`}
              >
                {googleInfo?.is_configured
                  ? language === 'ar'
                    ? 'المفتاح مفعّل'
                    : 'Configured'
                  : language === 'ar'
                  ? 'يتطلب API Key'
                  : 'Requires Key'}
              </span>
              <span className="text-[11px] text-blue-400 font-semibold">Cloud</span>
            </div>
          </div>
        </div>
      </div>

      {/* ElevenLabs API Configuration Card */}
      {(currentProvider === 'elevenlabs' || !elevenInfo?.is_configured) && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-purple-500/30 dark:border-purple-900/50 rounded-3xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-500" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {language === 'ar'
                  ? 'تهيئة مفتاح ElevenLabs (Event Lab API)'
                  : 'ElevenLabs (Event Lab) API Configuration'}
              </h4>
            </div>

            <a
              href="https://elevenlabs.io"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>{language === 'ar' ? 'احصل على مفتاح مجاني' : 'Get Free API Key'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {language === 'ar'
              ? 'أدخل مفتاح API الخاص بك من موقع ElevenLabs للاعتماد عليه كلياً في نطق الكلمات والجمل أثناء المذاكرة وفي محرر البطاقات.'
              : 'Enter your ElevenLabs API key to use ultra-realistic neural speech for all your cards and study sessions.'}
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    elevenInfo?.is_configured
                      ? '•••••••••••••••••••••••••••••••• (API Key مفعّل ومحفوظ)'
                      : 'sk_... أو xi-api-key'
                  }
                  className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Button
                type="button"
                variant="primary"
                size="md"
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => handleSaveKey('elevenlabs')}
                disabled={isSavingKey || !apiKey.trim()}
              >
                {isSavingKey
                  ? language === 'ar'
                    ? 'جاري التحقق...'
                    : 'Verifying...'
                  : language === 'ar'
                  ? 'حفظ وتفعيل'
                  : 'Save & Activate'}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
              <div className="flex items-center gap-3">
                {elevenInfo?.is_configured ? (
                  <span className="text-emerald-500 flex items-center gap-1.5 font-semibold">
                    <CheckCircle className="w-4 h-4" />
                    <span>
                      {language === 'ar'
                        ? 'مفتاح ElevenLabs محفوظ ومفعّل'
                        : 'ElevenLabs Key is active & ready'}
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400">
                    {language === 'ar'
                      ? 'قم بلصق المفتاح من لوحة ElevenLabs ثم اضغط حفظ وتفعيل'
                      : 'Paste your API key and click Save & Activate'}
                  </span>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-purple-600 border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-[11px]"
                  onClick={() => handleVerifyAccount()}
                  disabled={isVerifying}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  <span>
                    {isVerifying
                      ? language === 'ar'
                        ? 'جاري فحص الحساب...'
                        : 'Checking Account...'
                      : language === 'ar'
                      ? 'فحص الحساب والرصيد'
                      : 'Verify & Check Quota'}
                  </span>
                </Button>
              </div>

              <button
                type="button"
                onClick={() => handleTestVoice('elevenlabs')}
                disabled={isTesting}
                className="text-purple-600 dark:text-purple-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isTesting ? (language === 'ar' ? 'جاري النطق...' : 'Testing...') : (language === 'ar' ? 'اختبار النطق الصوتي الآن' : 'Test Speech Now')}</span>
              </button>
            </div>

            {/* Live Account Info Badge */}
            {accountInfo && (
              <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 text-xs space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {language === 'ar' ? 'حالة الحساب:' : 'Account Status:'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 uppercase text-[10px]">
                      {accountInfo.status} ({accountInfo.tier})
                    </span>
                  </div>

                  <div className="font-mono text-slate-600 dark:text-slate-300 font-semibold">
                    {language === 'ar' ? 'الرصيد المتبقي:' : 'Characters Left:'}{' '}
                    <span className="text-purple-600 dark:text-purple-400 font-bold">
                      {(accountInfo.character_limit - accountInfo.character_count).toLocaleString()}
                    </span>{' '}
                    / {accountInfo.character_limit.toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {/* Verification Error Box */}
            {verifyError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-xs space-y-1.5 text-rose-700 dark:text-rose-300 animate-fade-in">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>{language === 'ar' ? 'تعذر التحقق من المفتاح من خوادم ElevenLabs:' : 'ElevenLabs Verification Error:'}</span>
                </div>
                <p className="font-mono text-[11px] bg-rose-100/70 dark:bg-rose-900/40 p-2 rounded-lg break-all">
                  {verifyError}
                </p>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 pt-1 space-y-1">
                  <p>💡 {language === 'ar' ? 'خطوات التحقق السريع:' : 'Quick verification checklist:'}</p>
                  <ul className="list-disc list-inside pl-1 space-y-0.5 text-slate-500 dark:text-slate-400">
                    <li>{language === 'ar' ? 'تأكد من تأكيد بريدك الإلكتروني (Verify Email) في موقع ElevenLabs.' : 'Make sure you confirmed your email on ElevenLabs.io.'}</li>
                    <li>{language === 'ar' ? 'تأكد من نسخ المفتاح كاملاً من Settings > API Keys.' : 'Make sure the API Key is copied from Settings > API Keys.'}</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Google API Configuration Card if selected */}
      {currentProvider === 'google' && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-blue-500/30 dark:border-blue-900/50 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-500" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Google Cloud Text-to-Speech API
              </h4>
            </div>
            <a
              href="https://cloud.google.com/text-to-speech"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Google Cloud Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                googleInfo?.is_configured
                  ? '•••••••••••••••• (Google API Key مفعّل)'
                  : 'AIzaSy...'
              }
              className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <Button
              type="button"
              variant="primary"
              onClick={() => handleSaveKey('google')}
              disabled={isSavingKey || !apiKey.trim()}
            >
              {language === 'ar' ? 'حفظ المفتاح' : 'Save Key'}
            </Button>
          </div>
        </div>
      )}

      {/* Voice Selection & Speed Settings */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>{language === 'ar' ? 'تخصيص الصوت والسرعة' : 'Voice & Speed Customization'}</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              {t('ttsVoice', language)} ({currentProvider})
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

        {/* Test Voice Control */}
        <div className="pt-2 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Volume2 className="w-4 h-4 text-emerald-600" />}
            onClick={() => handleTestVoice()}
            disabled={isTesting}
          >
            {isTesting ? t('ttsTesting', language) : t('ttsTestVoice', language)}
          </Button>

          {testSuccess && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 animate-fade-in">
              <CheckCircle className="w-4 h-4" />
              {language === 'ar'
                ? 'تم اختبار ونطق الصوت بنجاح!'
                : 'Pronunciation verified successfully!'}
            </span>
          )}
        </div>
      </div>

      {/* Auto-Play Toggle */}
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

      {/* Local Cache Management */}
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
