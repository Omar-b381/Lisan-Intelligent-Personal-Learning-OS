import React, { useState, useEffect } from 'react';
import { Search, Filter, Trash2, PauseCircle, PlayCircle, Edit3, Tag } from 'lucide-react';
import { api } from '../../services/api';
import { CardWithDeckInfo } from '../../types/card';
import { useDeckStore } from '../../stores/deckStore';
import { useAppStore } from '../../stores/appStore';
import { Badge } from '../common/Badge';
import { t } from '../../i18n';

export const CardBrowser: React.FC = () => {
  const { language, showToast } = useAppStore();
  const { openCreateCardModal } = useDeckStore();
  const [cards, setCards] = useState<CardWithDeckInfo[]>([]);
  const [query, setQuery] = useState('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchCards = async () => {
    setIsLoading(true);
    try {
      const res = await api.searchCards(query, undefined, undefined, selectedState || undefined, 100, 0);
      setCards(res);
    } catch (err) {
      console.error('Failed to search cards:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCards();
    }, 200);
    return () => clearTimeout(timer);
  }, [query, selectedState]);

  const handleToggleSuspend = async (id: string) => {
    try {
      const isSuspended = await api.toggleSuspendCard(id);
      showToast(isSuspended ? 'Card suspended' : 'Card unsuspended');
      fetchCards();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (window.confirm(t('deleteCardPrompt', language))) {
      try {
        await api.deleteCard(id);
        showToast('Card deleted');
        fetchCards();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder', language)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs placeholder-slate-400"
          />
        </div>

        {/* State Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          >
            <option value="">{t('filterAll', language)}</option>
            <option value="new">{t('filterNew', language)}</option>
            <option value="learning">{t('filterLearning', language)}</option>
            <option value="review">{t('filterReview', language)}</option>
            <option value="relearning">Relearning</option>
          </select>
        </div>
      </div>

      {/* Cards Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Card Front</th>
                <th className="px-6 py-4">Back Answer</th>
                <th className="px-4 py-4">Deck</th>
                <th className="px-4 py-4">State</th>
                <th className="px-4 py-4">Interval</th>
                <th className="px-4 py-4">Lapses</th>
                <th className="px-6 py-4 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {cards.map((c) => (
                <tr
                  key={c.id}
                  className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                    c.suspended ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-6 py-4 max-w-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    {c.front}
                  </td>
                  <td className="px-6 py-4 max-w-xs text-slate-600 dark:text-slate-400 truncate">
                    {c.back}
                  </td>
                  <td className="px-4 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5"
                      style={{ backgroundColor: c.deck_color || '#3b82f6' }}
                    />
                    {c.deck_name}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <Badge
                      variant={
                        c.suspended
                          ? 'default'
                          : c.state === 'new'
                          ? 'info'
                          : c.state === 'learning' || c.state === 'relearning'
                          ? 'warning'
                          : 'success'
                      }
                      size="sm"
                    >
                      {c.suspended ? 'suspended' : c.state}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {c.interval_days > 0 ? `${c.interval_days.toFixed(1)}d` : '-'}
                  </td>
                  <td className="px-4 py-4 text-xs font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {c.lapses}
                  </td>
                  <td className="px-6 py-4 text-end whitespace-nowrap space-x-1">
                    <button
                      onClick={() => openCreateCardModal(c)}
                      title="Edit Card"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleSuspend(c.id)}
                      title={c.suspended ? 'Unsuspend' : 'Suspend'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                    >
                      {c.suspended ? (
                        <PlayCircle className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <PauseCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteCard(c.id)}
                      title="Delete Card"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {cards.length === 0 && !isLoading && (
            <div className="p-12 text-center text-slate-400 text-sm">
              No flashcards match your current search criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
