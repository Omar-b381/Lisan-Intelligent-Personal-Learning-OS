import React, { useEffect } from 'react';
import { useTtsStore } from '../../stores/ttsStore';
import { Voice } from '../../types/tts';

interface VoiceSelectorProps {
  provider?: string;
  selectedVoice: string;
  onChange: (voiceId: string) => void;
  className?: string;
}

const DEFAULT_ELEVENLABS_VOICES: Voice[] = [
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Deep, Natural Male)', language: 'en-US', gender: 'male', provider: 'elevenlabs', is_default: true },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (Soft, Gentle Female)', language: 'en-US', gender: 'female', provider: 'elevenlabs', is_default: false },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (Warm, Clear Male)', language: 'en-US', gender: 'male', provider: 'elevenlabs', is_default: false },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (Authoritative Male)', language: 'en-US', gender: 'male', provider: 'elevenlabs', is_default: false },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Expressive Male)', language: 'en-US', gender: 'male', provider: 'elevenlabs', is_default: false },
];

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  provider,
  selectedVoice,
  onChange,
  className = '',
}) => {
  const { voices, loadVoices, isLoadingVoices } = useTtsStore();

  useEffect(() => {
    loadVoices(provider);
  }, [provider]);

  const displayVoices =
    voices.length > 0
      ? voices
      : provider === 'elevenlabs'
      ? DEFAULT_ELEVENLABS_VOICES
      : [{ id: 'default', name: 'Default Voice', language: 'en-US', provider: provider || 'system', is_default: true }];

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectedVoice || displayVoices[0]?.id || 'default'}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoadingVoices && displayVoices.length === 0}
        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
      >
        {displayVoices.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} ({v.language}) {v.gender ? `• ${v.gender}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
};
