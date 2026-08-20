import { isTauri } from './api';
import {
  TtsRequest,
  TtsResult,
  Voice,
  ProviderInfo,
  TtsCacheStats,
  BulkGenerationRequest,
  BulkGenerationProgress,
  ElevenLabsAccountInfo,
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
            id: 'pNInz6obpgDQGcFmaJgB',
            name: 'Adam (Deep, Natural Male)',
            language: 'en-US',
            gender: 'male',
            provider: 'elevenlabs',
            is_default: true,
          },
          {
            id: 'EXAVITQu4vr4xnSDxMaL',
            name: 'Sarah (Soft, Gentle Female)',
            language: 'en-US',
            gender: 'female',
            provider: 'elevenlabs',
            is_default: false,
          },
          {
            id: 'JBFqnCBsd6RMkjVDRZzb',
            name: 'George (Warm, Clear Male)',
            language: 'en-US',
            gender: 'male',
            provider: 'elevenlabs',
            is_default: false,
          },
          {
            id: 'onwK4e9ZLuTAKqWW03F9',
            name: 'Daniel (Authoritative Male)',
            language: 'en-US',
            gender: 'male',
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
              : 'pNInz6obpgDQGcFmaJgB';
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
                  use_speaker_boost: true,
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

    case 'tts_verify_elevenlabs_account': {
      const storedKey = (args?.apiKey || localStorage.getItem('lisan_tts_apikey_elevenlabs') || '').trim();
      if (!storedKey) {
        throw new Error('Please enter an ElevenLabs API key first.');
      }

      // 1. Try subscription endpoint for full character quota details
      try {
        const res = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
          headers: { 'xi-api-key': storedKey },
        });
        if (res.ok) {
          const data = await res.json();
          return {
            tier: data.tier || 'free',
            character_count: data.character_count || 0,
            character_limit: data.character_limit || 10000,
            status: data.status || 'active',
          } as unknown as T;
        }
      } catch (_) {}

      // 2. Try models endpoint
      try {
        const modelsRes = await fetch('https://api.elevenlabs.io/v1/models', {
          headers: { 'xi-api-key': storedKey },
        });
        if (modelsRes.ok) {
          return {
            tier: 'Standard / Free',
            character_count: 0,
            character_limit: 10000,
            status: 'active (TTS Ready)',
          } as unknown as T;
        }
      } catch (_) {}

      // 3. Direct TTS ping with default free premade voice (Adam)
      try {
        const pingRes = await fetch(
          'https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB?output_format=mp3_44100_128',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'xi-api-key': storedKey,
            },
            body: JSON.stringify({
              text: 'Hi',
              model_id: 'eleven_multilingual_v2',
            }),
          }
        );
        if (pingRes.ok) {
          return {
            tier: 'Standard / Free',
            character_count: 0,
            character_limit: 10000,
            status: 'active (TTS Verified)',
          } as unknown as T;
        }
        const errText = await pingRes.text();
        let parsed = errText;
        try {
          const j = JSON.parse(errText);
          if (j.detail?.message) parsed = j.detail.message;
          else if (j.message) parsed = j.message;
        } catch (_) {}
        throw new Error(parsed);
      } catch (err: any) {
        console.error('ElevenLabs account verification error:', err);
        throw err;
      }
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

// ─────────────────────────────────────────────────────────────────────────────
// Direct synthesis — works in BOTH browser-dev (localhost:1420) AND Tauri .exe
// Tauri's WebView2 supports fetch() to external origins exactly like a browser.
// This completely bypasses the Rust IPC path for audio, fixing the .exe issue.
// ─────────────────────────────────────────────────────────────────────────────
async function synthesizeDirectly(request: TtsRequest): Promise<TtsResult> {
  const provider = request.provider || 'system';

  // ── ElevenLabs ────────────────────────────────────────────────────────────
  if (provider === 'elevenlabs') {
    const storedKey = localStorage.getItem('lisan_tts_apikey_elevenlabs') || '';
    if (!storedKey.trim()) {
      throw new Error('ElevenLabs API key not found. Please enter and save your API key in Settings → Audio.');
    }
    const voiceId =
      request.voice && request.voice.trim() && request.voice !== 'default'
        ? request.voice.trim()
        : 'pNInz6obpgDQGcFmaJgB'; // Adam (free default)

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': storedKey.trim() },
        body: JSON.stringify({
          text: request.text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      let friendly = errText;
      try {
        const j = JSON.parse(errText);
        if (j.detail?.message) friendly = j.detail.message;
        else if (j.message) friendly = j.message;
      } catch (_) {}
      throw new Error(`ElevenLabs error (${resp.status}): ${friendly}`);
    }

    const arrayBuffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64Data = btoa(binary);

    return {
      id: `elevenlabs-${Date.now()}`,
      text_hash: '',
      text: request.text,
      language: request.language || 'en-US',
      provider: 'elevenlabs',
      voice: voiceId,
      speed: request.speed || 1.0,
      pitch: request.pitch || 1.0,
      file_path: 'elevenlabs.mp3',
      base64_data: base64Data,
      mime_type: 'audio/mpeg',
      file_size: arrayBuffer.byteLength,
      duration_ms: 1500,
      cached: false,
    };
  }

  // ── System / Browser Web Speech API ───────────────────────────────────────
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(request.text);
    utterance.rate = request.speed || 1.0;
    window.speechSynthesis.speak(utterance);
  }

  return {
    id: `system-${Date.now()}`,
    text_hash: '',
    text: request.text,
    language: request.language || 'en-US',
    provider: 'system',
    voice: 'default',
    speed: request.speed || 1.0,
    pitch: 1.0,
    file_path: '',
    base64_data: null,
    mime_type: 'audio/wav',
    file_size: 0,
    duration_ms: 0,
    cached: false,
  };
}

export const ttsApi = {
  synthesize: async (request: TtsRequest): Promise<TtsResult> => {
    // ALWAYS use direct frontend fetch for synthesis (works in both browser dev and Tauri .exe)
    // Tauri webview supports fetch() to external APIs just like a browser does.
    // Going through Rust IPC was unreliable due to thread/runtime complexity.
    return synthesizeDirectly(request);
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

  verifyElevenLabsAccount: async (apiKey?: string): Promise<ElevenLabsAccountInfo> => {
    return callTtsTauri<ElevenLabsAccountInfo>('tts_verify_elevenlabs_account', { apiKey });
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
