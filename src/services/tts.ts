import { isTauri } from './api';
import {
  TtsRequest,
  TtsResult,
  Voice,
  ProviderInfo,
  TtsCacheStats,
  BulkGenerationRequest,
  BulkGenerationProgress,
} from '../types/tts';

async function callTtsTauri<T>(cmd: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  if (!isTauri()) {
    console.warn(`[Lisan Web Preview] Running outside Tauri desktop runtime. TTS Command '${cmd}' using fallback.`);
    if (fallback !== undefined) return fallback;
    return getTtsFallback<T>(cmd, args);
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (err: any) {
    console.error(`[TTS IPC Error] ${cmd}:`, err);
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

function getTtsFallback<T>(cmd: string, args?: any): T {
  switch (cmd) {
    case 'tts_get_providers':
      return [
        {
          id: 'system',
          name: 'System Speech Synthesizer',
          description: 'Built-in native offline OS speech engine.',
          is_configured: true,
          requires_key: false,
        },
        {
          id: 'elevenlabs',
          name: 'ElevenLabs Prime Voice AI',
          description: 'Ultra-realistic human generative voice AI in 29+ languages.',
          is_configured: true,
          requires_key: true,
        },
        {
          id: 'google',
          name: 'Google Cloud Text-to-Speech',
          description: 'High quality neural voices (Wavenet & Neural2).',
          is_configured: false,
          requires_key: true,
        },
      ] as unknown as T;

    case 'tts_get_voices':
      return [
        {
          id: '21m00Tcm4TlvDq8ikWAM',
          name: 'Rachel (Calm, Warm Female)',
          language: 'en-US',
          gender: 'female',
          provider: 'elevenlabs',
          is_default: true,
        },
        {
          id: 'pNInz6obpgDQGcFmaJgB',
          name: 'Adam (Deep, Natural Male)',
          language: 'en-US',
          gender: 'male',
          provider: 'elevenlabs',
          is_default: false,
        },
      ] as unknown as T;

    case 'tts_get_cache_stats':
      return {
        total_files: 12,
        total_size_bytes: 340000,
        total_plays: 45,
      } as unknown as T;

    case 'tts_clear_cache':
      return 0 as unknown as T;

    case 'tts_synthesize':
    case 'tts_test_provider':
      // Fallback web speech synthesis
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const text = args?.request?.text || args?.text || 'Lisan Spaced Repetition';
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = args?.request?.speed || 1.0;
        window.speechSynthesis.speak(utterance);
      }
      return {
        id: 'mock-tts-id',
        text_hash: 'mock-hash',
        text: args?.request?.text || 'Test',
        language: 'en-US',
        provider: args?.request?.provider || 'system',
        voice: 'default',
        speed: 1.0,
        pitch: 1.0,
        file_path: 'mock.wav',
        base64_data: null,
        mime_type: 'audio/wav',
        file_size: 1024,
        duration_ms: 500,
        cached: true,
      } as unknown as T;

    default:
      return null as unknown as T;
  }
}

export const ttsApi = {
  synthesize: async (request: TtsRequest): Promise<TtsResult> => {
    return callTtsTauri<TtsResult>('tts_synthesize', { request });
  },

  getVoices: async (provider?: string, language?: string): Promise<Voice[]> => {
    return callTtsTauri<Voice[]>('tts_get_voices', { provider, language });
  },

  getProviders: async (): Promise<ProviderInfo[]> => {
    return callTtsTauri<ProviderInfo[]>('tts_get_providers');
  },

  testProvider: async (provider: string, apiKey?: string): Promise<TtsResult> => {
    return callTtsTauri<TtsResult>('tts_test_provider', { provider, apiKey });
  },

  getCacheStats: async (): Promise<TtsCacheStats> => {
    return callTtsTauri<TtsCacheStats>('tts_get_cache_stats');
  },

  clearCache: async (unusedOnly: boolean = false): Promise<number> => {
    return callTtsTauri<number>('tts_clear_cache', { unusedOnly });
  },

  saveProviderCredentials: async (provider: string, apiKey: string): Promise<void> => {
    return callTtsTauri<void>('tts_save_provider_credentials', { provider, apiKey });
  },

  generateBulk: async (request: BulkGenerationRequest): Promise<string> => {
    return callTtsTauri<string>('tts_generate_bulk', { request });
  },

  getBulkProgress: async (taskId: string): Promise<BulkGenerationProgress | null> => {
    return callTtsTauri<BulkGenerationProgress | null>('tts_get_bulk_progress', { taskId });
  },

  cancelBulk: async (taskId: string): Promise<void> => {
    return callTtsTauri<void>('tts_cancel_bulk', { taskId });
  },
};
