import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Deck, DeckWithStats } from '../../types/deck';
import { useTtsStore } from '../../stores/ttsStore';
import { useAppStore } from '../../stores/appStore';
import { t } from '../../i18n';
import { ttsApi } from '../../services/tts';
import { BulkGenerationProgress } from '../../types/tts';
import { Sparkles, Play, Pause, X, CheckCircle, Disc3, HardDrive } from 'lucide-react';

interface BulkAudioGeneratorProps {
  deck: DeckWithStats | Deck | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BulkAudioGenerator: React.FC<BulkAudioGeneratorProps> = ({
  deck,
  isOpen,
  onClose,
}) => {
  const { language } = useAppStore();
  const { currentProvider, selectedVoice, speechSpeed, loadCacheStats } = useTtsStore();

  const [onlyMissing, setOnlyMissing] = useState(true);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState<BulkGenerationProgress | null>(null);
  const [isDone, setIsDone] = useState(false);
  const pollTimerRef = useRef<number | null>(null);

  // Approximate metrics
  const cardCount = (deck as DeckWithStats)?.stats?.total_cards || 0;
  const estimatedChars = cardCount * 25;
  const estimatedSizeMb = ((cardCount * 18) / 1024).toFixed(1);

  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setTaskId(null);
      setProgress(null);
      setIsDone(false);
    }
  }, [isOpen]);

  const handleStart = async () => {
    if (!deck) return;
    try {
      const id = await ttsApi.generateBulk({
        deck_id: deck.id,
        provider: currentProvider,
        voice: selectedVoice !== 'default' ? selectedVoice : null,
        speed: speechSpeed,
        only_missing: onlyMissing,
      });

      setTaskId(id);
      setIsDone(false);

      // Start polling
      pollTimerRef.current = window.setInterval(async () => {
        const prog = await ttsApi.getBulkProgress(id);
        if (prog) {
          setProgress(prog);
          if (prog.status === 'completed') {
            setIsDone(true);
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            loadCacheStats();
          } else if (prog.status === 'cancelled' || prog.status === 'failed') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          }
        }
      }, 400);
    } catch (e) {
      console.error('Failed to start bulk TTS generation:', e);
    }
  };

  const handleCancel = async () => {
    if (taskId) {
      await ttsApi.cancelBulk(taskId);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setProgress((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
    }
  };

  const percentage = progress && progress.total_cards > 0
    ? Math.round((progress.processed_cards / progress.total_cards) * 100)
    : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('bulkAudioTitle', language)}
      maxWidth="md"
    >
      <div className="space-y-6">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('bulkAudioDesc', language)}
        </p>

        {/* Deck Estimation Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-center">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase">
              {t('estimatedCards', language)}
            </span>
            <strong className="text-lg font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5 block">
              {cardCount}
            </strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-center">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase">
              {t('estimatedChars', language)}
            </span>
            <strong className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
              ~{estimatedChars.toLocaleString()}
            </strong>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-center">
            <span className="block text-[11px] font-semibold text-slate-400 uppercase">
              {t('estimatedStorage', language)}
            </span>
            <strong className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono mt-0.5 block">
              ~{estimatedSizeMb} MB
            </strong>
          </div>
        </div>

        {/* Progress Bar if active */}
        {taskId && progress && (
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                {isDone ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Disc3 className="w-4 h-4 text-emerald-600 animate-spin" />
                )}
                <span>
                  {isDone
                    ? t('bulkCompleted', language)
                    : `${t('bulkGenerating', language)} (${progress.processed_cards}/${progress.total_cards})`}
                </span>
              </span>
              <span className="font-mono text-emerald-700 dark:text-emerald-300">
                {percentage}%
              </span>
            </div>

            {/* Bar */}
            <div className="w-full h-2.5 bg-emerald-200 dark:bg-emerald-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                style={{ width: `${percentage}%` }}
              />
            </div>

            {progress.current_word && !isDone && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                <span>Current: <strong className="text-slate-700 dark:text-slate-200">"{progress.current_word}"</strong></span>
                <span className="capitalize text-emerald-600 dark:text-emerald-400 font-medium">
                  {progress.status}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Options */}
        {!taskId && (
          <div className="space-y-3">
            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyMissing}
                onChange={(e) => setOnlyMissing(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 accent-emerald-600"
              />
              <span>{t('onlyMissingAudio', language)}</span>
            </label>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          {taskId && !isDone ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon={<X className="w-4 h-4" />}
              onClick={handleCancel}
            >
              {t('cancel', language)}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>
              {isDone ? 'Close' : t('cancel', language)}
            </Button>
          )}

          {!taskId && (
            <Button
              type="button"
              variant="primary"
              icon={<Sparkles className="w-4 h-4" />}
              onClick={handleStart}
              disabled={cardCount === 0}
            >
              {t('startBulkGeneration', language)}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
