import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Key,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Cpu,
  Server,
  Zap,
  Check,
} from 'lucide-react';
import { useAiProviderStore } from '../../stores/useAiProviderStore';
import { useAppStore } from '../../stores/appStore';
import { t } from '../../i18n';
import { Button } from '../common/Button';
import { AiProviderInput } from '../../types/ai_practice';

const PRESET_INFOS: Record<
  string,
  {
    name: string;
    description: string;
    docUrl: string;
    badge: string;
    iconColor: string;
    defaultModels: string[];
  }
> = {
  openai: {
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini & o3-mini models. Standard for precise language learning.',
    docUrl: 'https://platform.openai.com/api-keys',
    badge: 'Standard AI',
    iconColor: 'text-emerald-500',
    defaultModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  },
  anthropic: {
    name: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet & Haiku. World-class nuance, grammar analysis & pedagogy.',
    docUrl: 'https://console.anthropic.com/settings/keys',
    badge: 'High Nuance',
    iconColor: 'text-amber-500',
    defaultModels: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-opus-latest'],
  },
  google: {
    name: 'Google Gemini',
    description: 'Gemini 1.5 Flash & 2.0 Flash. Fast, generous free quota and multilingual.',
    docUrl: 'https://aistudio.google.com/app/apikey',
    badge: 'Generous Quota',
    iconColor: 'text-blue-500',
    defaultModels: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  },
  deepseek: {
    name: 'DeepSeek AI',
    description: 'DeepSeek-V3 & DeepSeek-R1. High intelligence at ultra-low token cost.',
    docUrl: 'https://platform.deepseek.com/api_keys',
    badge: 'Cost Efficient',
    iconColor: 'text-indigo-500',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  groq: {
    name: 'Groq Cloud',
    description: 'Ultra-low latency Llama 3.3 (70B) powered by LPU inference engine.',
    docUrl: 'https://console.groq.com/keys',
    badge: 'Ultra Fast',
    iconColor: 'text-orange-500',
    defaultModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  },
};

export const AiSettings: React.FC = () => {
  const { language, showToast } = useAppStore();
  const {
    providers,
    loadProviders,
    saveProvider,
    testProvider,
    setActiveProvider,
    deleteProvider,
    testingProviderId,
    testResults,
    providerModels,
    listModels,
    isLoadingModels,
  } = useAiProviderStore();

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Custom provider modal/form state
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [isSavingCustom, setIsSavingCustom] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    providers.forEach((p) => {
      if (p.model_id && !selectedModels[p.provider_key]) {
        setSelectedModels((prev) => ({ ...prev, [p.provider_key]: p.model_id! }));
      }
    });
  }, [providers]);

  const handleModelChange = async (providerKey: string, newModel: string) => {
    setSelectedModels((prev) => ({ ...prev, [providerKey]: newModel }));
    const prov = providers.find((p) => p.provider_key === providerKey);
    if (prov && (prov.has_key || prov.provider_type === 'custom')) {
      try {
        await saveProvider({
          provider_key: providerKey,
          display_name: prov.display_name,
          provider_type: prov.provider_type,
          base_url: prov.base_url,
          model_id: newModel,
          is_active: prov.is_active,
          is_enabled: true,
        });
        showToast(
          language === 'ar'
            ? `تم حفظ النموذج: ${newModel}`
            : `Model updated to: ${newModel}`
        );
      } catch (err: any) {
        console.error('Failed to update model:', err);
      }
    }
  };

  const handleSaveKey = async (providerKey: string, providerType: 'preset' | 'custom' = 'preset') => {
    const key = apiKeys[providerKey]?.trim() || '';
    const prov = providers.find((p) => p.provider_key === providerKey);
    const model = selectedModels[providerKey] || prov?.model_id || PRESET_INFOS[providerKey]?.defaultModels[0] || undefined;

    setSavingKey(providerKey);
    try {
      const input: AiProviderInput = {
        provider_key: providerKey,
        display_name: prov?.display_name || PRESET_INFOS[providerKey]?.name || providerKey,
        provider_type: providerType,
        base_url: prov?.base_url || null,
        api_key: key.length > 0 ? key : undefined,
        model_id: model,
        is_enabled: true,
        is_active: prov?.is_active ?? true, // Default to activating when saving
      };

      const saved = await saveProvider(input);
      setApiKeys((prev) => ({ ...prev, [providerKey]: '' }));
      showToast(
        language === 'ar'
          ? 'تم حفظ إعدادات المزود وتفعيله بنجاح!'
          : 'AI Provider saved and activated successfully!'
      );

      // Auto test after saving
      if (saved.id) {
        testProvider(saved.id);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to save provider settings');
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customBaseUrl.trim()) {
      showToast(
        language === 'ar'
          ? 'يرجى إدخال اسم الخادم ورابط Base URL'
          : 'Please provide server name and Base URL'
      );
      return;
    }

    setIsSavingCustom(true);
    const providerKey = `custom_${Date.now()}`;
    try {
      const input: AiProviderInput = {
        provider_key: providerKey,
        display_name: customName.trim(),
        provider_type: 'custom',
        base_url: customBaseUrl.trim(),
        api_key: customApiKey.trim() || undefined,
        model_id: customModel.trim() || undefined,
        is_enabled: true,
        is_active: providers.filter((p) => p.is_active).length === 0,
      };

      await saveProvider(input);
      setIsCustomModalOpen(false);
      setCustomName('');
      setCustomBaseUrl('');
      setCustomApiKey('');
      setCustomModel('');
      showToast(
        language === 'ar'
          ? 'تمت إضافة المزود المخصص بنجاح!'
          : 'Custom AI Provider added successfully!'
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to add custom provider');
    } finally {
      setIsSavingCustom(false);
    }
  };

  const presetProviders = providers.filter((p) => p.provider_type === 'preset');
  const customProviders = providers.filter((p) => p.provider_type === 'custom');

  // Fill in any missing presets in view if database is empty initially
  const allPresetKeys = ['openai', 'anthropic', 'google', 'deepseek', 'groq'];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Info Banner */}
      <div className="p-6 bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-indigo-600/10 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-indigo-950/40 border border-emerald-200/80 dark:border-emerald-800/80 rounded-3xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {language === 'ar' ? 'التدريب الذكي بالذكاء الاصطناعي (AI Practice)' : 'AI-Powered Practice & MCQ Engine'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? 'ربط نماذج الذكاء الاصطناعي مع تأصيل واقعي حقيقي (Tatoeba & Free Dictionary) لتوليد تدريبات موثوقة'
                  : 'Connect leading LLMs with real-world grounded citations (Tatoeba & Free Dictionary API)'}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCustomModalOpen(true)}
          >
            {language === 'ar' ? 'إضافة مزود مخصص (Ollama / OpenRouter)' : 'Add Custom Provider'}
          </Button>
        </div>

        {/* Currently Active Model Display */}
        {providers.some((p) => p.is_active) && (
          <div className="pt-2 border-t border-emerald-200/50 dark:border-emerald-800/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                {language === 'ar' ? 'المزود النشط حالياً:' : 'Active AI Engine:'}
              </span>
              <span className="font-bold text-slate-900 dark:text-white">
                {providers.find((p) => p.is_active)?.display_name}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono text-[11px]">
                {providers.find((p) => p.is_active)?.model_id || 'default'}
              </span>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'جاهز لتوليد الاختبارات' : 'Ready for Quizzes'}</span>
            </span>
          </div>
        )}
      </div>

      {/* Popular Preset Providers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>{language === 'ar' ? 'أشهر النماذج المدعومة' : 'Popular AI Providers'}</span>
          </h4>
          <span className="text-xs text-slate-400">
            {language === 'ar' ? 'اختر المزود النشط للتدريبات' : 'Select active provider for quizzes'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allPresetKeys.map((key) => {
            const info = PRESET_INFOS[key];
            const prov = presetProviders.find((p) => p.provider_key === key);
            const provId = prov?.id;
            const hasKey = prov?.has_key || false;
            const isActive = prov?.is_active || false;
            const testResult = provId ? testResults[provId] : null;
            const isTesting = provId ? testingProviderId === provId : false;
            const availableModels = provId && providerModels[provId]?.length
              ? providerModels[provId]
              : info.defaultModels;

            return (
              <div
                key={key}
                className={`p-5 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/80 ring-2 ring-emerald-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                } space-y-4`}
              >
                {/* Provider Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold ${info.iconColor}`}>
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {info.name}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {info.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {info.description}
                      </p>
                    </div>
                  </div>

                  {/* Active Radio */}
                  {hasKey && provId && (
                    <button
                      onClick={() => setActiveProvider(provId)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-xl flex items-center gap-1 transition-all ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {isActive && <Check className="w-3 h-3" />}
                      <span>{isActive ? (language === 'ar' ? 'النشط' : 'Active') : (language === 'ar' ? 'تفعيل' : 'Activate')}</span>
                    </button>
                  )}
                </div>

                {/* API Key Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Key className="w-3 h-3 text-slate-400" />
                      <span>API Key</span>
                    </label>
                    <a
                      href={info.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <span>{language === 'ar' ? 'الحصول على مفتاح' : 'Get Key'}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <div className="relative">
                    <input
                      type={showKeys[key] ? 'text' : 'password'}
                      placeholder={hasKey ? prov?.key_masked : 'Paste your API key here (sk-...)'}
                      value={apiKeys[key] ?? ''}
                      onChange={(e) => setApiKeys({ ...apiKeys, [key]: e.target.value })}
                      className="w-full px-3 py-2 pr-9 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeys({ ...showKeys, [key]: !showKeys[key] })}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showKeys[key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Model Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <span>{language === 'ar' ? 'النموذج المستخدم' : 'Model Selection'}</span>
                    {provId && (
                      <button
                        type="button"
                        onClick={() => listModels(provId)}
                        disabled={isLoadingModels[provId]}
                        className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${isLoadingModels[provId] ? 'animate-spin' : ''}`} />
                        <span>{language === 'ar' ? 'تحديث النماذج' : 'Fetch Models'}</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedModels[key] || prov?.model_id || availableModels[0] || ''}
                    onChange={(e) => handleModelChange(key, e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions & Status */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleSaveKey(key, 'preset')}
                      disabled={savingKey === key}
                    >
                      {savingKey === key ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ' : 'Save')}
                    </Button>

                    {provId && hasKey && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testProvider(provId)}
                        disabled={isTesting}
                        icon={
                          <RefreshCw
                            className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`}
                          />
                        }
                      >
                        {isTesting ? (language === 'ar' ? 'جاري الاختبار...' : 'Testing...') : (language === 'ar' ? 'اختبار الاتصال' : 'Test')}
                      </Button>
                    )}
                  </div>

                  {/* Test result indicator */}
                  {testResult && (
                    <div
                      className={`text-[11px] font-semibold flex items-center gap-1 ${
                        testResult.success ? 'text-emerald-600' : 'text-red-500'
                      }`}
                      title={testResult.message}
                    >
                      {testResult.success ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{testResult.latency_ms}ms</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[110px]">{testResult.message}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom AI Providers Section (Ollama / Local / OpenRouter / LM Studio) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-500" />
            <span>{language === 'ar' ? 'المزودات المخصصة وخوادم الذكاء الاصطناعي المحلية' : 'Custom & Local AI Endpoints (Ollama / OpenRouter / LM Studio)'}</span>
          </h4>
        </div>

        {customProviders.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
            <Server className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {language === 'ar'
                ? 'يمكنك ربط أي خادم محلي مثل Ollama (http://localhost:11434/v1) أو LM Studio أو OpenRouter مجاناً وبدون قيود'
                : 'Connect any OpenAI-compatible custom server like Ollama, LM Studio, or OpenRouter.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCustomModalOpen(true)}
            >
              {language === 'ar' ? 'إضافة مزود مخصص الآن' : 'Add Custom Server'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customProviders.map((prov) => {
              const provId = prov.id;
              const isActive = prov.is_active;
              const testResult = testResults[provId];
              const isTesting = testingProviderId === provId;

              return (
                <div
                  key={prov.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-500/80 ring-2 ring-indigo-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                  } space-y-3`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {prov.display_name}
                      </span>
                      <p className="text-[11px] font-mono text-slate-400 truncate max-w-[220px]">
                        {prov.base_url}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveProvider(provId)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-xl flex items-center gap-1 transition-all ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {isActive && <Check className="w-3 h-3" />}
                        <span>{isActive ? (language === 'ar' ? 'النشط' : 'Active') : (language === 'ar' ? 'تفعيل' : 'Activate')}</span>
                      </button>

                      <button
                        onClick={() => deleteProvider(provId)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all"
                        title={language === 'ar' ? 'حذف المزود' : 'Delete Provider'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span>Model: <strong className="font-mono text-slate-800 dark:text-slate-200">{prov.model_id || 'default'}</strong></span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testProvider(provId)}
                      disabled={isTesting}
                      icon={<RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />}
                    >
                      {isTesting ? 'Testing...' : 'Test'}
                    </Button>
                  </div>

                  {testResult && (
                    <p
                      className={`text-[11px] font-medium ${
                        testResult.success ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {testResult.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Custom Provider Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-500" />
              <span>{language === 'ar' ? 'إضافة مزود ذكاء اصطناعي مخصص' : 'Add Custom OpenAI-Compatible Server'}</span>
            </h3>

            <form onSubmit={handleCreateCustom} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {language === 'ar' ? 'اسم المزود / الخادم' : 'Display Name'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Local Ollama or OpenRouter"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Base URL (OpenAI compatible)
                </label>
                <input
                  type="text"
                  placeholder="e.g. http://localhost:11434/v1 or https://openrouter.ai/api/v1"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  API Key ({language === 'ar' ? 'اختياري في حالة الخادم المحلي' : 'Optional for local'})
                </label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Model ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. llama3:8b, mistral, or qwen2.5:7b"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCustomModalOpen(false)}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSavingCustom}
                >
                  {isSavingCustom ? (language === 'ar' ? 'جاري الإضافة...' : 'Adding...') : (language === 'ar' ? 'إضافة المزود' : 'Add Server')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
