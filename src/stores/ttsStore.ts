import { create } from 'zustand';
import { ttsApi } from '../services/tts';
import { ProviderInfo, TtsCacheStats, Voice } from '../types/tts';

interface TtsState {
  currentProvider: string;
  selectedVoice: string;
  speechSpeed: number;
  speechPitch: number;
  autoPlayOnStudy: boolean;
  
  // Runtime Playback
  isPlaying: boolean;
  activeWord: string | null;
  audioElement: HTMLAudioElement | null;

  // Metadata Cache
  providers: ProviderInfo[];
  voices: Voice[];
  cacheStats: TtsCacheStats | null;
  isLoadingVoices: boolean;

  // Actions
  setProvider: (provider: string) => void;
  setVoice: (voiceId: string) => void;
  setSpeed: (speed: number) => void;
  setPitch: (pitch: number) => void;
  setAutoPlayOnStudy: (enable: boolean) => void;
  
  loadProviders: () => Promise<void>;
  loadVoices: (provider?: string, language?: string) => Promise<void>;
  loadCacheStats: () => Promise<void>;
  
  playPronunciation: (
    text: string,
    options?: { language?: string; voice?: string; speed?: number; onDone?: () => void }
  ) => Promise<void>;
  stopAudio: () => void;
}

const STORAGE_PROVIDER = 'lisan_tts_provider';
const STORAGE_VOICE = 'lisan_tts_voice';
const STORAGE_SPEED = 'lisan_tts_speed';
const STORAGE_AUTOPLAY = 'lisan_tts_autoplay';

export const useTtsStore = create<TtsState>((set, get) => ({
  currentProvider: localStorage.getItem(STORAGE_PROVIDER) || 'system',
  selectedVoice: localStorage.getItem(STORAGE_VOICE) || 'default',
  speechSpeed: parseFloat(localStorage.getItem(STORAGE_SPEED) || '1.0'),
  speechPitch: 1.0,
  autoPlayOnStudy: localStorage.getItem(STORAGE_AUTOPLAY) === 'true',

  isPlaying: false,
  activeWord: null,
  audioElement: null,

  providers: [],
  voices: [],
  cacheStats: null,
  isLoadingVoices: false,

  setProvider: (currentProvider) => {
    localStorage.setItem(STORAGE_PROVIDER, currentProvider);
    set({ currentProvider });
    get().loadVoices(currentProvider);
  },

  setVoice: (selectedVoice) => {
    localStorage.setItem(STORAGE_VOICE, selectedVoice);
    set({ selectedVoice });
  },

  setSpeed: (speechSpeed) => {
    localStorage.setItem(STORAGE_SPEED, speechSpeed.toString());
    set({ speechSpeed });
  },

  setPitch: (speechPitch) => set({ speechPitch }),

  setAutoPlayOnStudy: (autoPlayOnStudy) => {
    localStorage.setItem(STORAGE_AUTOPLAY, autoPlayOnStudy ? 'true' : 'false');
    set({ autoPlayOnStudy });
  },

  loadProviders: async () => {
    try {
      const providers = await ttsApi.getProviders();
      set({ providers });
    } catch (e) {
      console.error('Failed to load TTS providers:', e);
    }
  },

  loadVoices: async (provider, language) => {
    set({ isLoadingVoices: true });
    try {
      const prov = provider || get().currentProvider;
      const voices = await ttsApi.getVoices(prov, language);
      set({ voices, isLoadingVoices: false });
      if (voices.length > 0 && !voices.some((v) => v.id === get().selectedVoice)) {
        set({ selectedVoice: voices[0].id });
      }
    } catch (e) {
      console.error('Failed to load TTS voices:', e);
      set({ isLoadingVoices: false });
    }
  },

  loadCacheStats: async () => {
    try {
      const cacheStats = await ttsApi.getCacheStats();
      set({ cacheStats });
    } catch (e) {
      console.error('Failed to load TTS cache stats:', e);
    }
  },

  playPronunciation: async (text, options) => {
    const clean = text.trim();
    if (!clean) return;

    const { audioElement, currentProvider, selectedVoice, speechSpeed, speechPitch } = get();

    // Stop current audio if playing
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }

    set({ isPlaying: true, activeWord: clean });

    try {
      const result = await ttsApi.synthesize({
        text: clean,
        language: options?.language || 'en-US',
        provider: currentProvider,
        voice: options?.voice || (selectedVoice !== 'default' ? selectedVoice : null),
        speed: options?.speed || speechSpeed,
        pitch: speechPitch,
      });

      if (!result.base64_data) {
        throw new Error('No audio data received from speech synthesis');
      }

      const audioSrc = `data:${result.mime_type};base64,${result.base64_data}`;
      const audio = new Audio(audioSrc);
      audio.playbackRate = options?.speed || speechSpeed;

      set({ audioElement: audio });

      audio.onended = () => {
        set({ isPlaying: false, activeWord: null, audioElement: null });
        options?.onDone?.();
        get().loadCacheStats();
      };

      audio.onerror = (err) => {
        console.error('Audio playback error:', err);
        set({ isPlaying: false, activeWord: null, audioElement: null });
      };

      await audio.play();
    } catch (err) {
      console.error('Speech synthesis/playback failed:', err);
      set({ isPlaying: false, activeWord: null, audioElement: null });
    }
  },

  stopAudio: () => {
    const { audioElement } = get();
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    set({ isPlaying: false, activeWord: null, audioElement: null });
  },
}));
