import { invoke } from '@tauri-apps/api/core';
import {
  TtsRequest,
  TtsResult,
  Voice,
  ProviderInfo,
  TtsCacheStats,
  BulkGenerationRequest,
  BulkGenerationProgress,
} from '../types/tts';

export const ttsApi = {
  synthesize: async (request: TtsRequest): Promise<TtsResult> => {
    return invoke<TtsResult>('tts_synthesize', { request });
  },

  getVoices: async (provider?: string, language?: string): Promise<Voice[]> => {
    return invoke<Voice[]>('tts_get_voices', { provider, language });
  },

  getProviders: async (): Promise<ProviderInfo[]> => {
    return invoke<ProviderInfo[]>('tts_get_providers');
  },

  testProvider: async (provider: string, apiKey?: string): Promise<TtsResult> => {
    return invoke<TtsResult>('tts_test_provider', { provider, apiKey });
  },

  getCacheStats: async (): Promise<TtsCacheStats> => {
    return invoke<TtsCacheStats>('tts_get_cache_stats');
  },

  clearCache: async (unusedOnly: boolean = false): Promise<number> => {
    return invoke<number>('tts_clear_cache', { unusedOnly });
  },

  saveProviderCredentials: async (provider: string, apiKey: string): Promise<void> => {
    return invoke<void>('tts_save_provider_credentials', { provider, apiKey });
  },

  generateBulk: async (request: BulkGenerationRequest): Promise<string> => {
    return invoke<string>('tts_generate_bulk', { request });
  },

  getBulkProgress: async (taskId: string): Promise<BulkGenerationProgress | null> => {
    return invoke<BulkGenerationProgress | null>('tts_get_bulk_progress', { taskId });
  },

  cancelBulk: async (taskId: string): Promise<void> => {
    return invoke<void>('tts_cancel_bulk', { taskId });
  },
};
