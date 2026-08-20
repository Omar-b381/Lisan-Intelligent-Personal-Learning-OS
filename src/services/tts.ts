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
    return handleWebPreviewTts<T>(cmd, args);
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

// Direct Web Fetch handler when running in browser mode without Tauri backend
async function handleWebPreviewTts<T>(cmd: string, args?: any): Promise<T> {
  switch (cmd) {
    case 'tts_get_providers': {
      const elevenKey = localStorage.getItem('lisan_tts_apikey_elevenlabs') || '';
      const googleKey = localStorage.getItem('lisan_tts_apikey_google') || '';
      return [
        {
          id: 'system',
          name: 'System Speech Synthesizer',
          description: 'Built-in native offline OS speech engine. Fast, zero configuration, zero internet required.',
          is_configured: true,
          requires_key: false,
        },
        {
          id: 'elevenlabs',
          name: 'ElevenLabs Prime Voice AI',
          description: 'Ultra-realistic human generative voice AI in 29+ languages.',
          is_configured: Boolean(elevenKey.trim()),
          requires_key: true,
        },
        {
          id: 'google',
          name: 'Google Cloud Text-to-Speech',
          description: 'High quality neural voices (Wavenet & Neural2).',
          is_configured: Boolean(googleKey.trim()),
          requires_key: true,
        },
      ] as unknown as T;
    }

    case 'tts_get_voices': {
      const provider = args?.provider || 'elevenlabs';
      if (provider === 'elevenlabs') {
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
          {
            id: 'AZnzlk1XvdvUeBnXmlld',
            name: 'Domi (Strong, Energetic Female)',
            language: 'en-US',
            gender: 'female',
            provider: 'elevenlabs',
            is_default: false,
          },
          {
            id: 'ErXwobaYiN019PkySvjV',
            name: 'Antoni (Expressive Male)',
            language: 'en-US',
            gender: 'male',
            provider: 'elevenlabs',
            is_default: false,
          },
          {
            id: 'EXAVITQu4vr4xnSDxMaL',
            name: 'Bella (Soft, Gentle Female)',
            language: 'en-US',
            gender: 'female',
            provider: 'elevenlabs',
            is_default: false,
          },
        ] as unknown as T;
      }
      return [
        {
          id: 'default',
          name: 'System Default Voice',
          language: 'en-US',
          provider: 'system',
          is_default: true,
        },
      ] as unknown as T;
    }

    case 'tts_save_provider_credentials': {
      const prov = args?.provider;
      const key = args?.apiKey;
      if (prov && key) {
        localStorage.setItem(`lisan_tts_apikey_${prov}`, key);
      }
      return undefined as unknown as T;
    }

    case 'tts_test_provider':
    case 'tts_synthesize': {
      const req: TtsRequest = args?.request || {
        text: args?.provider === 'elevenlabs' ? 'Testing ElevenLabs generative voice in Lisan.' : 'Testing speech in Lisan.',
        provider: args?.provider || 'system',
      };

      const provider = req.provider || 'system';
      const storedKey = localStorage.getItem(`lisan_tts_apikey_${provider}`) || args?.apiKey || '';

      // If ElevenLabs and we have an API Key, make actual fetch
      if (provider === 'elevenlabs' && storedKey.trim()) {
        try {
          const voiceId =
            req.voice && req.voice.trim() !== 'default'
              ? req.voice.trim()
              : '21m00Tcm4TlvDq8ikWAM';
          const speed = Math.max(0.7, Math.min(1.2, req.speed || 1.0));

          const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'xi-api-key': storedKey.trim(),
              },
              body: JSON.stringify({
                text: req.text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.75,
                  speed: speed,
                },
              }),
            }
          );

          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64Data = btoa(binary);

            return {
              id: 'elevenlabs-web-id',
              text_hash: 'web-hash',
              text: req.text,
              language: req.language || 'en-US',
              provider: 'elevenlabs',
              voice: voiceId,
              speed: req.speed || 1.0,
              pitch: 1.0,
              file_path: 'elevenlabs.mp3',
              base64_data: base64Data,
              mime_type: 'audio/mp3',
              file_size: arrayBuffer.byteLength,
              duration_ms: 1500,
              cached: false,
            } as unknown as T;
          } else {
            const errText = await response.text();
            console.error('ElevenLabs API error response:', errText);
            throw new Error(`ElevenLabs API Error: ${errText}`);
          }
        } catch (e: any) {
          console.error('Failed to call ElevenLabs web API:', e);
          throw e;
        }
      }

      // Fallback: Browser Web Speech API
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(req.text);
        utterance.rate = req.speed || 1.0;
        window.speechSynthesis.speak(utterance);
      }

      return {
        id: 'mock-tts-id',
        text_hash: 'mock-hash',
        text: req.text,
        language: req.language || 'en-US',
        provider: provider,
        voice: req.voice || 'default',
        speed: req.speed || 1.0,
        pitch: 1.0,
        file_path: 'local.wav',
        base64_data: null,
        mime_type: 'audio/wav',
        file_size: 1024,
        duration_ms: 500,
        cached: true,
      } as unknown as T;
    }

    case 'tts_get_cache_stats':
      return {
        total_files: 12,
        total_size_bytes: 340000,
        total_plays: 45,
      } as unknown as T;

    case 'tts_clear_cache':
      return 0 as unknown as T;

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
