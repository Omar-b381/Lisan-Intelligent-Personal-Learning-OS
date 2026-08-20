import React, { useEffect } from 'react';
import { Maximize2, Minimize2, RotateCcw, AlertCircle } from 'lucide-react';
import { useStudyStore } from '../stores/studyStore';
import { useAppStore } from '../stores/appStore';
import { CardViewer } from '../components/study/CardViewer';
import { RatingBar } from '../components/study/RatingBar';
import { SessionCompleteModal } from '../components/study/SessionCompleteModal';
import { Button } from '../components/common/Button';
import { t } from '../i18n';

export const Study: React.FC = () => {
  const { activeDeckIdForStudy, language, setActiveTab } = useAppStore();
  const {
    queue,
    currentIndex,
    isRevealed,
    isLoading,
    isFocusMode,
    loadQueue,
    revealAnswer,
    submitRating,
    toggleFocusMode,
  } = useStudyStore();

  useEffect(() => {
    loadQueue(activeDeckIdForStudy);
  }, [activeDeckIdForStudy]);

  const currentItem = queue[currentIndex];
  const total = queue.length;
  const currentNum = Math.min(currentIndex + 1, total);
  const progress = total > 0 ? (currentNum / total) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Calculating optimal memory schedule...</span>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          All Caught Up!
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          There are no cards due for review in this queue right now. Keep up the great work!
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <Button variant="primary" onClick={() => setActiveTab('dashboard')}>
            Back to Dashboard
          </Button>
          <Button variant="outline" onClick={() => loadQueue(null)}>
            Refresh Queue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-[calc(100vh-8rem)] flex flex-col justify-between ${
        isFocusMode
          ? 'fixed inset-0 z-50 bg-slate-950 p-8 text-white'
          : 'space-y-6 pb-12 animate-fade-in'
      }`}
    >
      {/* Top Study Bar: Progress & Focus Toggle */}
      <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            Card {currentNum} of {total}
          </span>
          <div className="w-32 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFocusMode}
            title={isFocusMode ? t('exitFocusMode', language) : 'Enter Focus Mode'}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Flashcard Card */}
      <div className="my-auto">
        <CardViewer
          item={currentItem}
          isRevealed={isRevealed}
          onReveal={revealAnswer}
        />
      </div>

      {/* Rating Bar */}
      <div>
        <RatingBar
          previews={currentItem.previews}
          onRate={submitRating}
          isRevealed={isRevealed}
          onReveal={revealAnswer}
        />
      </div>

      {/* Completion Modal */}
      <SessionCompleteModal />
    </div>
  );
};
