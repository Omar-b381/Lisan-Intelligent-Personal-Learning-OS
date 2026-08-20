import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CardType } from '../../types/card';
import { useDeckStore } from '../../stores/deckStore';
import { useAppStore } from '../../stores/appStore';
import { t } from '../../i18n';
import { Bold, Italic, Code, Eye, Sparkles } from 'lucide-react';

export const CardEditorModal: React.FC = () => {
  const { isCreateCardModalOpen, closeCreateCardModal, editingCard, decks, createCard, updateCard } = useDeckStore();
  const { language } = useAppStore();

  const [deckId, setDeckId] = useState('');
  const [cardType, setCardType] = useState<CardType>('basic');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [activeField, setActiveField] = useState<'front' | 'back' | 'notes'>('front');

  // Flatten deck list for dropdown
  const flatDecks: { id: string; name: string }[] = [];
  const collect = (list: typeof decks) => {
    for (const d of list) {
      flatDecks.push({ id: d.id, name: d.name });
      if (d.children?.length) collect(d.children);
    }
  };
  collect(decks);

  useEffect(() => {
    if (editingCard) {
      setDeckId(editingCard.deck_id);
      setCardType(editingCard.card_type);
      setFront(editingCard.front);
      setBack(editingCard.back);
      setNotes(editingCard.notes || '');
      setTagsStr(editingCard.tags.join(', '));
    } else {
      setDeckId(flatDecks[0]?.id || '');
      setCardType('basic');
      setFront('');
      setBack('');
      setNotes('');
      setTagsStr('');
    }
  }, [editingCard, isCreateCardModalOpen]);

  const handleInsertFormatting = (prefix: string, suffix: string) => {
    const applyTo = (val: string, setter: (v: string) => void) => {
      setter(`${val}${prefix}text${suffix}`);
    };
    if (activeField === 'front') applyTo(front, setFront);
    else if (activeField === 'back') applyTo(back, setBack);
    else applyTo(notes, setNotes);
  };

  const handleInsertCloze = () => {
    const applyTo = (val: string, setter: (v: string) => void) => {
      // Find next cloze number
      const matches = val.match(/\{\{c(\d+)::/g);
      const nextNum = matches ? matches.length + 1 : 1;
      setter(`${val}{{c${nextNum}::hidden phrase}}`);
    };
    setCardType('cloze');
    if (activeField === 'front') applyTo(front, setFront);
    else applyTo(back, setBack);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !deckId) return;

    const tags = tagsStr
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);

    if (editingCard) {
      await updateCard({
        id: editingCard.id,
        deck_id: deckId,
        card_type: cardType,
        front,
        back,
        notes: notes.trim() ? notes : null,
        tags,
      });
    } else {
      await createCard({
        deck_id: deckId,
        card_type: cardType,
        front,
        back,
        notes: notes.trim() ? notes : null,
        tags,
      });
    }
  };

  return (
    <Modal
      isOpen={isCreateCardModalOpen}
      onClose={closeCreateCardModal}
      title={editingCard ? 'Edit Flashcard' : t('createCard', language)}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Deck & Card Type Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Deck
            </label>
            <select
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {flatDecks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              {t('cardType', language)}
            </label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value as CardType)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="basic">{t('typeBasic', language)}</option>
              <option value="cloze">{t('typeCloze', language)}</option>
            </select>
          </div>
        </div>

        {/* Formatting Toolbar */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => handleInsertFormatting('**', '**')}
            title="Bold (**text**)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleInsertFormatting('*', '*')}
            title="Italic (*text*)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleInsertFormatting('`', '`')}
            title="Inline Code (`code`)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleInsertCloze}
            title="Insert Cloze Deletion ({{c1::...}})"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            <span>Cloze [..]</span>
          </button>
        </div>

        {/* Front */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            {t('frontQuestion', language)}
          </label>
          <textarea
            rows={3}
            value={front}
            onFocus={() => setActiveField('front')}
            onChange={(e) => setFront(e.target.value)}
            placeholder="Type your question or cloze passage here..."
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400 font-sans"
            required
          />
        </div>

        {/* Back */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            {t('backAnswer', language)}
          </label>
          <textarea
            rows={3}
            value={back}
            onFocus={() => setActiveField('back')}
            onChange={(e) => setBack(e.target.value)}
            placeholder="Type the answer or full context explanation..."
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400 font-sans"
            required
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            {t('notesAdditional', language)}
          </label>
          <input
            type="text"
            value={notes}
            onFocus={() => setActiveField('notes')}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional mnemonic, memory peg, or context..."
            className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            {t('tags', language)}
          </label>
          <input
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            placeholder="vocabulary, grammar, high-priority"
            className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={closeCreateCardModal}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {t('saveCard', language)}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
