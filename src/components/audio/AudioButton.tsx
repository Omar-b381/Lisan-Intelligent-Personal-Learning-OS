import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Loader2, Sparkles } from 'lucide-react';
import { useTtsStore } from '../../stores/ttsStore';

interface AudioButtonProps {
  text: string;
  language?: string;
  voice?: string;
  speed?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'subtle' | 'pill';
  showLabel?: boolean;
  label?: string;
  autoPlay?: boolean;
  className?: string;
  onDone?: () => void;
}

export const AudioButton: React.FC<AudioButtonProps> = ({
  text,
  language,
  voice,
  speed,
  size = 'md',
  variant = 'subtle',
  showLabel = false,
  label = 'Listen',
  autoPlay = false,
  className = '',
  onDone,
}) => {
  const { playPronunciation, isPlaying, activeWord, stopAudio } = useTtsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const cleanText = text.trim();
  const isThisPlaying = isPlaying && activeWord === cleanText;

  useEffect(() => {
    if (autoPlay && cleanText) {
      handlePlay();
    }
  }, [autoPlay, cleanText]);

  const handlePlay = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (!cleanText) return;

    if (isThisPlaying) {
      stopAudio();
      return;
    }

    setIsLoading(true);
    setHasError(false);

    try {
      await playPronunciation(cleanText, {
        language,
        voice,
        speed,
        onDone: () => {
          setIsLoading(false);
          onDone?.();
        },
      });
    } catch (err) {
      console.error('Audio playback failed:', err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Size styling
  const sizeClasses = {
    sm: 'p-1 text-xs gap-1',
    md: 'p-1.5 text-sm gap-1.5',
    lg: 'px-3 py-2 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  // Variant styling
  const variantClasses = {
    ghost:
      'text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800',
    subtle:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 border border-slate-200/60 dark:border-slate-700/60',
    pill: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 rounded-full font-medium',
  };

  return (
    <button
      type="button"
      onClick={handlePlay}
      disabled={isLoading || !cleanText}
      title={isThisPlaying ? 'Stop playback (P)' : 'Play pronunciation (P)'}
      className={`inline-flex items-center justify-center rounded-xl transition-all cursor-pointer select-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${
        isThisPlaying ? 'ring-2 ring-emerald-500 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200' : ''
      } ${className}`}
    >
      {isLoading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin text-emerald-600`} />
      ) : hasError ? (
        <VolumeX className={`${iconSizes[size]} text-rose-500`} />
      ) : isThisPlaying ? (
        <Volume2 className={`${iconSizes[size]} text-emerald-600 animate-pulse`} />
      ) : (
        <Volume2 className={iconSizes[size]} />
      )}

      {showLabel && (
        <span className="font-semibold">
          {isLoading ? 'Loading...' : isThisPlaying ? 'Playing' : label}
        </span>
      )}
    </button>
  );
};
