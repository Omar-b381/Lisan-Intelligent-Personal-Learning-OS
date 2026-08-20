import React, { useEffect } from 'react';
import { NextReviewPreviews, Rating } from '../../types/card';
import { useAppStore } from '../../stores/appStore';
import { t } from '../../i18n';

interface RatingBarProps {
  previews: NextReviewPreviews;
  onRate: (rating: Rating) => void;
  isRevealed: boolean;
  onReveal: () => void;
}

export const RatingBar: React.FC<RatingBarProps> = ({
  previews,
  onRate,
  isRevealed,
  onReveal,
}) => {
  const { language } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!isRevealed) {
          onReveal();
        }
      }

      if (isRevealed) {
        if (e.key === '1') onRate('again');
        if (e.key === '2') onRate('hard');
        if (e.key === '3') onRate('good');
        if (e.key === '4') onRate('easy');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevealed, onReveal, onRate]);

  if (!isRevealed) {
    return null;
  }

  const buttons: {
    rating: Rating;
    label: string;
    interval: string;
    shortcut: string;
    colorClasses: string;
    hoverClasses: string;
  }[] = [
    {
      rating: 'again',
      label: t('ratingAgain', language),
      interval: previews.again_interval_desc,
      shortcut: '1',
      colorClasses: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60',
      hoverClasses: 'hover:bg-red-100 dark:hover:bg-red-900/60',
    },
    {
      rating: 'hard',
      label: t('ratingHard', language),
      interval: previews.hard_interval_desc,
      shortcut: '2',
      colorClasses: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60',
      hoverClasses: 'hover:bg-amber-100 dark:hover:bg-amber-900/60',
    },
    {
      rating: 'good',
      label: t('ratingGood', language),
      interval: previews.good_interval_desc,
      shortcut: '3',
      colorClasses: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60',
      hoverClasses: 'hover:bg-blue-100 dark:hover:bg-blue-900/60',
    },
    {
      rating: 'easy',
      label: t('ratingEasy', language),
      interval: previews.easy_interval_desc,
      shortcut: '4',
      colorClasses: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60',
      hoverClasses: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/60',
    },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto mt-6">
      <div className="grid grid-cols-4 gap-3">
        {buttons.map((btn) => (
          <button
            key={btn.rating}
            onClick={() => onRate(btn.rating)}
            className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all active:scale-[0.97] cursor-pointer shadow-xs ${btn.colorClasses} ${btn.hoverClasses}`}
          >
            <span className="text-xs opacity-75 font-mono mb-0.5">{btn.interval}</span>
            <span className="font-bold text-sm">{btn.label}</span>
            <kbd className="mt-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/70 dark:bg-black/30 text-current">
              {btn.shortcut}
            </kbd>
          </button>
        ))}
      </div>
    </div>
  );
};
