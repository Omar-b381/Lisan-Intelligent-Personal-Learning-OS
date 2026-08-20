import React from 'react';
import { CardStudyItem } from '../../types/card';
import { Badge } from '../common/Badge';
import { Tag } from 'lucide-react';

interface CardViewerProps {
  item: CardStudyItem;
  isRevealed: boolean;
  onReveal: () => void;
}

export const CardViewer: React.FC<CardViewerProps> = ({ item, isRevealed, onReveal }) => {
  const { card, deck_name } = item;

  // Simple rich-text formatter for bold, italic, code, and cloze
  const renderFormattedText = (text: string, isBack: boolean = false) => {
    if (!text) return null;

    // Cloze processor: {{c1::hidden text}} -> replace with [ ... ] on front, highlighted on back
    let processed = text;
    if (card.card_type === 'cloze') {
      if (!isBack && !isRevealed) {
        processed = processed.replace(/\{\{c\d+::(.*?)\}\}/g, '【 ··· 】');
      } else {
        processed = processed.replace(
          /\{\{c\d+::(.*?)\}\}/g,
          '<span class="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700/50">$1</span>'
        );
      }
    }

    // Markdown bold: **text**
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Markdown italic: *text*
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code: `code`
    processed = processed.replace(
      /`(.*?)`/g,
      '<code class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-emerald-600 dark:text-emerald-400 text-sm">$1</code>'
    );
    // Line breaks
    processed = processed.replace(/\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Deck & Tags Meta */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {deck_name}
        </span>
        <div className="flex items-center gap-1.5">
          {card.tags.map((tag) => (
            <Badge key={tag} variant="default" size="sm" className="gap-1">
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </Badge>
          ))}
          <Badge
            variant={
              card.state === 'new'
                ? 'info'
                : card.state === 'learning' || card.state === 'relearning'
                ? 'warning'
                : 'success'
            }
            size="sm"
          >
            {card.state}
          </Badge>
        </div>
      </div>

      {/* Main Flashcard Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 md:p-12 shadow-xl shadow-slate-200/40 dark:shadow-none min-h-[320px] flex flex-col justify-between transition-all">
        {/* Front / Question */}
        <div className="text-xl md:text-2xl font-medium text-slate-900 dark:text-slate-100 leading-relaxed text-center my-auto">
          {renderFormattedText(card.front, false)}
        </div>

        {/* Answer Section */}
        {isRevealed ? (
          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800/80 animate-fade-in">
            <div className="text-base md:text-lg text-slate-700 dark:text-slate-300 leading-relaxed text-center">
              {renderFormattedText(card.back, true)}
            </div>

            {/* Notes if present */}
            {card.notes && (
              <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 text-xs text-slate-500 dark:text-slate-400 text-start">
                <span className="font-semibold block mb-1 text-slate-700 dark:text-slate-300">
                  Note:
                </span>
                {renderFormattedText(card.notes, false)}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 text-center">
            <button
              onClick={onReveal}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer"
            >
              <span>Show Answer</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-500">
                Space
              </kbd>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
