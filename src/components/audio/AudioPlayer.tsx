import React, { useState } from 'react';
import { Play, Square, Loader2, Volume2 } from 'lucide-react';
import { useTtsStore } from '../../stores/ttsStore';
import { SpeedSelector } from './SpeedSelector';

interface AudioPlayerProps {
  text: string;
  language?: string;
  voice?: string;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  text,
  language,
  voice,
  className = '',
}) => {
  const { playPronunciation, isPlaying, activeWord, stopAudio, speechSpeed } = useTtsStore();
  const [speed, setSpeed] = useState(speechSpeed);
  const [loading, setLoading] = useState(false);

  const isCurrentPlaying = isPlaying && activeWord === text.trim();

  const handleToggle = async () => {
    if (isCurrentPlaying) {
      stopAudio();
      return;
    }

    setLoading(true);
    try {
      await playPronunciation(text, {
        language,
        voice,
        speed,
        onDone: () => setLoading(false),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 ${className}`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading || !text.trim()}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 ${
            isCurrentPlaying
              ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isCurrentPlaying ? (
            <Square className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <span>{text}</span>
            {isCurrentPlaying && <Volume2 className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />}
          </div>
          <span className="text-xs text-slate-400">
            {isCurrentPlaying ? 'Playing pronunciation' : 'Click to preview speech'}
          </span>
        </div>
      </div>

      <SpeedSelector speed={speed} onChange={setSpeed} />
    </div>
  );
};
