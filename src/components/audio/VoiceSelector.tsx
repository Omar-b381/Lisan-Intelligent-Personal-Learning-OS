import React, { useEffect } from 'react';
import { useTtsStore } from '../../stores/ttsStore';

interface VoiceSelectorProps {
  provider?: string;
  selectedVoice: string;
  onChange: (voiceId: string) => void;
  className?: string;
}

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

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectedVoice}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoadingVoices || voices.length === 0}
        className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
      >
        {voices.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} ({v.language}) {v.gender ? `• ${v.gender}` : ''}
          </option>
        ))}
      </select>
    </div>
  );
};
