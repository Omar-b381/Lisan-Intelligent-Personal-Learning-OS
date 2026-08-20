import React from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { WeakCardInfo } from '../../types/analytics';
import { useAppStore } from '../../stores/appStore';
import { useDeckStore } from '../../stores/deckStore';
import { Badge } from '../common/Badge';

interface WeakCardsListProps {
  cards: WeakCardInfo[];
}

export const WeakCardsList: React.FC<WeakCardsListProps> = ({ cards }) => {
  const { startStudyForDeck } = useAppStore();
  const { openCreateCardModal } = useDeckStore();

  if (!cards || cards.length === 0) {
    return (
      <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          No critical weak cards detected
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Your retention across all active decks is above target thresholds.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Frequently Forgotten / Difficult Cards
          </h3>
        </div>
        <span className="text-xs text-slate-400">
          {cards.length} items flagged
        </span>
      </div>

      <div className="space-y-2.5">
        {cards.map((c) => (
          <div
            key={c.card_id}
            className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between gap-4 transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase text-slate-400">
                  {c.deck_name}
                </span>
                <Badge variant="danger" size="sm">
                  {c.lapses} lapses
                </Badge>
                <Badge variant="warning" size="sm">
                  Diff: {c.difficulty}
                </Badge>
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                {c.front}
              </p>
            </div>

            <button
              onClick={() => startStudyForDeck(null)}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex-shrink-0"
            >
              <span>Review</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
