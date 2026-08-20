import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useDeckStore } from '../../stores/deckStore';
import { useAppStore } from '../../stores/appStore';
import { t } from '../../i18n';

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#64748b', // slate
];

export const DeckModal: React.FC = () => {
  const { isCreateDeckModalOpen, closeCreateDeckModal, editingDeck, decks, createDeck, updateDeck } = useDeckStore();
  const { language } = useAppStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [color, setColor] = useState(COLORS[0]);
  const [priority, setPriority] = useState(5);

  const flatDecks: { id: string; name: string }[] = [];
  const collect = (list: typeof decks) => {
    for (const d of list) {
      if (editingDeck && d.id === editingDeck.id) continue;
      flatDecks.push({ id: d.id, name: d.name });
      if (d.children?.length) collect(d.children);
    }
  };
  collect(decks);

  useEffect(() => {
    if (editingDeck) {
      setName(editingDeck.name);
      setDescription(editingDeck.description || '');
      setParentId(editingDeck.parent_id || '');
      setColor(editingDeck.color || COLORS[0]);
      setPriority(editingDeck.priority);
    } else {
      setName('');
      setDescription('');
      setParentId('');
      setColor(COLORS[0]);
      setPriority(5);
    }
  }, [editingDeck, isCreateDeckModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingDeck) {
      await updateDeck({
        id: editingDeck.id,
        name,
        description: description.trim() ? description : null,
        parent_id: parentId ? parentId : null,
        color,
        priority,
      });
    } else {
      await createDeck({
        name,
        description: description.trim() ? description : null,
        parent_id: parentId ? parentId : null,
        color,
        priority,
      });
    }
  };

  return (
    <Modal
      isOpen={isCreateDeckModalOpen}
      onClose={closeCreateDeckModal}
      title={editingDeck ? t('editDeck', language) : t('createDeck', language)}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            {t('deckName', language)}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Advanced Biology or Rust Concurrency"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
            required
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            {t('deckDescription', language)}
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief overview of the deck topics..."
            className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
          />
        </div>

        {/* Parent Deck (Subdecks) */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            {t('parentDeck', language)}
          </label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">None (Top-level Deck)</option>
            {flatDecks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
            {t('deckColor', language)}
          </label>
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform active:scale-95 ${
                  color === c ? 'ring-2 ring-offset-2 ring-slate-700 dark:ring-slate-300 scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={closeCreateDeckModal}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save Deck
          </Button>
        </div>
      </form>
    </Modal>
  );
};
