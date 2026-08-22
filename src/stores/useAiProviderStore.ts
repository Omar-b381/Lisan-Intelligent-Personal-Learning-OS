import { create } from 'zustand';
import { aiPracticeApi } from '../services/aiPracticeApi';
import { AiProviderDto, AiProviderInput, ProviderTestResult } from '../types/ai_practice';

interface AiProviderState {
  providers: AiProviderDto[];
  activeProvider: AiProviderDto | null;
  isLoading: boolean;
  testingProviderId: number | null;
  testResults: Record<number, ProviderTestResult>;
  providerModels: Record<number, string[]>;
  isLoadingModels: Record<number, boolean>;

  loadProviders: () => Promise<void>;
  saveProvider: (input: AiProviderInput) => Promise<AiProviderDto>;
  testProvider: (providerId: number) => Promise<ProviderTestResult>;
  listModels: (providerId: number) => Promise<string[]>;
  setActiveProvider: (providerId: number) => Promise<void>;
  deleteProvider: (providerId: number) => Promise<void>;
}

export const useAiProviderStore = create<AiProviderState>((set, get) => ({
  providers: [],
  activeProvider: null,
  isLoading: false,
  testingProviderId: null,
  testResults: {},
  providerModels: {},
  isLoadingModels: {},

  loadProviders: async () => {
    set({ isLoading: true });
    try {
      const providers = await aiPracticeApi.listProviders();
      const active = providers.find((p) => p.is_active && p.is_enabled) || null;
      set({ providers, activeProvider: active, isLoading: false });
    } catch (err) {
      console.error('Failed to load AI providers:', err);
      set({ isLoading: false });
    }
  },

  saveProvider: async (input: AiProviderInput) => {
    try {
      const saved = await aiPracticeApi.saveProvider(input);
      await get().loadProviders();
      return saved;
    } catch (err) {
      console.error('Failed to save AI provider:', err);
      throw err;
    }
  },

  testProvider: async (providerId: number) => {
    set({ testingProviderId: providerId });
    try {
      const result = await aiPracticeApi.testProvider(providerId);
      set((state) => ({
        testingProviderId: null,
        testResults: { ...state.testResults, [providerId]: result },
        providerModels: result.available_models.length > 0
          ? { ...state.providerModels, [providerId]: result.available_models }
          : state.providerModels,
      }));
      await get().loadProviders();
      return result;
    } catch (err: any) {
      const failedResult: ProviderTestResult = {
        success: false,
        status: 'failed',
        message: err?.message || 'فشل اختبار الاتصال بالمزود',
        latency_ms: 0,
        available_models: [],
      };
      set((state) => ({
        testingProviderId: null,
        testResults: { ...state.testResults, [providerId]: failedResult },
      }));
      return failedResult;
    }
  },

  listModels: async (providerId: number) => {
    set((state) => ({
      isLoadingModels: { ...state.isLoadingModels, [providerId]: true },
    }));
    try {
      const models = await aiPracticeApi.listModels(providerId);
      set((state) => ({
        providerModels: { ...state.providerModels, [providerId]: models },
        isLoadingModels: { ...state.isLoadingModels, [providerId]: false },
      }));
      return models;
    } catch (err) {
      console.error('Failed to list provider models:', err);
      set((state) => ({
        isLoadingModels: { ...state.isLoadingModels, [providerId]: false },
      }));
      return [];
    }
  },

  setActiveProvider: async (providerId: number) => {
    try {
      await aiPracticeApi.setActiveProvider(providerId);
      await get().loadProviders();
    } catch (err) {
      console.error('Failed to set active AI provider:', err);
      throw err;
    }
  },

  deleteProvider: async (providerId: number) => {
    try {
      await aiPracticeApi.deleteProvider(providerId);
      await get().loadProviders();
    } catch (err) {
      console.error('Failed to delete AI provider:', err);
      throw err;
    }
  },
}));
