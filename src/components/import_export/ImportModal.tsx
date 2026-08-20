import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../services/api';
import { useDeckStore } from '../../stores/deckStore';
import { useAppStore } from '../../stores/appStore';
import { ImportPreview } from '../../types/settings';
import { FileUp, CheckCircle, AlertCircle } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const { decks, fetchDecks } = useDeckStore();
  const { showToast } = useAppStore();

  const [content, setContent] = useState('');
  const [targetDeckId, setTargetDeckId] = useState('');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const flatDecks: { id: string; name: string }[] = [];
  const collect = (list: typeof decks) => {
    for (const d of list) {
      flatDecks.push({ id: d.id, name: d.name });
      if (d.children?.length) collect(d.children);
    }
  };
  collect(decks);

  const handleContentChange = async (text: string) => {
    setContent(text);
    if (!text.trim()) {
      setPreview(null);
      return;
    }

    if (format === 'csv') {
      try {
        const p = await api.previewCsv(text);
        setPreview(p);
      } catch (e) {
        setPreview(null);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isJson = file.name.endsWith('.json');
    setFormat(isJson ? 'json' : 'csv');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleContentChange(text);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!content.trim()) return;
    setIsProcessing(true);
    try {
      if (format === 'json') {
        const count = await api.importJson(content, targetDeckId || undefined);
        showToast(`Successfully imported ${count} cards from JSON!`);
      } else {
        const deckId = targetDeckId || flatDecks[0]?.id;
        if (!deckId) {
          showToast('Please select or create a deck first.');
          setIsProcessing(false);
          return;
        }
        const count = await api.importCsv(deckId, content);
        showToast(`Successfully imported ${count} cards!`);
      }
      await fetchDecks();
      onClose();
    } catch (err: any) {
      alert(`Import failed: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Flashcards (CSV / JSON)" maxWidth="lg">
      <div className="space-y-4">
        {/* Format Selector */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as any)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="csv">CSV / TSV (Front, Back, Tags)</option>
              <option value="json">Lisan / Deck JSON</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Destination Deck
            </label>
            <select
              value={targetDeckId}
              onChange={(e) => setTargetDeckId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Auto-create from file (or select)</option>
              {flatDecks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* File Drop Area */}
        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-2xl cursor-pointer bg-slate-50/50 dark:bg-slate-800/40 transition-colors">
          <FileUp className="w-8 h-8 text-slate-400 mb-2" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Click to upload CSV or JSON file
          </span>
          <span className="text-xs text-slate-400 mt-0.5">
            Or paste raw text in the box below
          </span>
          <input
            type="file"
            accept=".csv,.tsv,.txt,.json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {/* Text Area */}
        <div>
          <textarea
            rows={4}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Front text, Back text, tag1;tag2..."
            className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
          />
        </div>

        {/* Live CSV Preview */}
        {preview && (
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-semibold mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Detected {preview.total_cards_found} valid flashcards</span>
            </div>
            {preview.sample_front && (
              <p className="text-slate-600 dark:text-slate-300 truncate">
                <strong>Sample:</strong> {preview.sample_front} &rarr; {preview.sample_back}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!content.trim() || isProcessing}
            onClick={handleImport}
          >
            {isProcessing ? 'Importing...' : 'Confirm Import'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
