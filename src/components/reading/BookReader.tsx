import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Volume2,
  Play,
  Pause,
  Plus,
  Bookmark,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  X,
  BookOpen,
  Check,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { useReadingStore } from '../../stores/readingStore';
import { useAppStore } from '../../stores/appStore';
import { Button } from '../common/Button';

export const BookReader: React.FC = () => {
  const { language, showToast } = useAppStore();
  const {
    activeBook,
    currentPassage,
    isLoadingPassage,
    closeBook,
    nextPassage,
    prevPassage,
    goToPassage,
    openLookup,
    closeLookup,
    lookupWordText,
    lookupSentenceText,
    lookupResult,
    isLoadingLookup,
    isLookupOpen,
    addWordToReview,
    isAddingCard,
    audioData,
    isPlayingAudio,
    isLoadingAudio,
    playPassageAudio,
    pausePassageAudio,
    currentWordIndex,
    setCurrentWordIndex,
    fontSize,
    setFontSize,
  } = useReadingStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingWordAudio, setIsPlayingWordAudio] = useState(false);

  // Handle keyboard navigation (Left/Right arrow)
  useEffect(() => {
    if (!activeBook) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLookupOpen) return;
      if (e.key === 'ArrowRight') {
        if (language === 'ar') prevPassage();
        else nextPassage();
      } else if (e.key === 'ArrowLeft') {
        if (language === 'ar') nextPassage();
        else prevPassage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBook, isLookupOpen, language, prevPassage, nextPassage]);

  // Synchronize audio playback time with word-level timestamps
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let animationFrameId: number;

    const syncWordHighlight = () => {
      if (!audio.paused && audioData?.has_alignment && audioData.word_timestamps.length > 0) {
        const currentTime = audio.currentTime;
        const timestamps = audioData.word_timestamps;

        // Find active word timestamp
        let matchedIndex: number | null = null;
        for (let i = 0; i < timestamps.length; i++) {
          if (currentTime >= timestamps[i].start_secs && currentTime <= timestamps[i].end_secs + 0.05) {
            matchedIndex = timestamps[i].word_index;
            break;
          }
        }

        if (matchedIndex !== currentWordIndex) {
          setCurrentWordIndex(matchedIndex);
        }

        animationFrameId = requestAnimationFrame(syncWordHighlight);
      }
    };

    if (isPlayingAudio) {
      audio.play().catch(() => {});
      animationFrameId = requestAnimationFrame(syncWordHighlight);
    } else {
      audio.pause();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlayingAudio, audioData, currentWordIndex, setCurrentWordIndex]);

  // If no book is active, render nothing
  if (!activeBook) {
    return null;
  }

  // Clean word helper to extract sentence
  const handleWordClick = (word: string, fullText: string, wordIndex: number) => {
    const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [fullText];
    let matchedSentence = fullText;

    for (const s of sentences) {
      if (s.includes(word)) {
        matchedSentence = s.trim();
        break;
      }
    }

    openLookup(word, matchedSentence);
  };

  // Play single word pronunciation via speech synthesis
  const handlePlayWordAudio = (word: string) => {
    if ('speechSynthesis' in window) {
      setIsPlayingWordAudio(true);
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.onend = () => setIsPlayingWordAudio(false);
      utterance.onerror = () => setIsPlayingWordAudio(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const total = activeBook.total_passages || 1;
  const currentIdx = currentPassage ? currentPassage.passage_index : activeBook.last_passage_index;
  const progressPercent = Math.min(100, Math.max(0, Math.round(((currentIdx + 1) / total) * 100)));

  // Tokenize passage text into interactive words and whitespace
  const wordsWithWhitespace = currentPassage ? currentPassage.raw_text.split(/(\s+)/) : [];
  let wordCounter = 0;

  return (
    <div className="flex flex-col h-full space-y-4 max-w-4xl mx-auto animate-fade-in select-text pb-6">
      {/* Top Navigation Bar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="w-4 h-4 rtl:rotate-180" />}
            onClick={closeBook}
          >
            {language === 'ar' ? 'المكتبة' : 'Library'}
          </Button>

          <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-800" />

          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
              {activeBook.title}
            </h3>
            {currentPassage?.chapter_title && (
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {currentPassage.chapter_title}
              </p>
            )}
          </div>
        </div>

        {/* Audio & Font Controls */}
        <div className="flex items-center gap-2">
          {/* Font Zoom */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-slate-600 dark:text-slate-300">
            <button
              onClick={() => setFontSize(Math.max(14, fontSize - 2))}
              className="p-1 hover:text-slate-900 dark:hover:text-white rounded-lg"
              title="A-"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold px-1">{fontSize}px</span>
            <button
              onClick={() => setFontSize(Math.min(28, fontSize + 2))}
              className="p-1 hover:text-slate-900 dark:hover:text-white rounded-lg"
              title="A+"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Passage Audio Button */}
          <Button
            variant={isPlayingAudio ? 'primary' : 'outline'}
            size="sm"
            icon={
              isLoadingAudio ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPlayingAudio ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )
            }
            disabled={isLoadingAudio || !currentPassage}
            onClick={() => {
              if (isPlayingAudio) {
                pausePassageAudio();
              } else {
                playPassageAudio();
              }
            }}
          >
            <span className="hidden sm:inline">
              {isPlayingAudio
                ? language === 'ar'
                  ? 'إيقاف مؤقت'
                  : 'Pause'
                : language === 'ar'
                ? 'استماع للمقطع'
                : 'Listen'}
            </span>
          </Button>
        </div>
      </div>

      {/* Hidden Audio Element */}
      {audioData?.base64_data && (
        <audio
          ref={audioRef}
          src={`data:${audioData.mime_type};base64,${audioData.base64_data}`}
          onEnded={() => {
            pausePassageAudio();
            setCurrentWordIndex(null);
          }}
        />
      )}

      {/* Main Passage Content Area */}
      <div className="flex-1 min-h-[380px] p-8 md:p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between overflow-y-auto">
        {isLoadingPassage ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 my-auto py-20">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs text-slate-400">
              {language === 'ar' ? 'جاري فتح المقطع وتجهيز القراءة...' : 'Loading passage...'}
            </p>
          </div>
        ) : !currentPassage ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 my-auto py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              {language === 'ar' ? 'تعذّر تحميل هذا المقطع' : 'Could not load passage'}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm">
              {language === 'ar'
                ? 'حدث خطأ أثناء قراءة المقطع من قاعدة البيانات.'
                : 'An error occurred while reading the passage from database.'}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => goToPassage(0)}>
                {language === 'ar' ? 'البدء من المقطع الأول' : 'Start from Passage 1'}
              </Button>
              <Button variant="ghost" size="sm" onClick={closeBook}>
                {language === 'ar' ? 'العودة للمكتبة' : 'Back to Library'}
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="text-slate-800 dark:text-slate-100 leading-relaxed font-serif tracking-normal text-left dir-ltr select-text transition-all"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.85 }}
          >
            {wordsWithWhitespace.map((token, idx) => {
              if (/^\s+$/.test(token)) {
                return <span key={idx}>{token}</span>;
              }

              const thisWordIndex = wordCounter;
              wordCounter += 1;

              const isCurrentPlayingWord =
                isPlayingAudio &&
                audioData?.has_alignment &&
                currentWordIndex === thisWordIndex;

              return (
                <span
                  key={idx}
                  onClick={() => handleWordClick(token, currentPassage.raw_text, thisWordIndex)}
                  className={`cursor-pointer px-1 py-0.5 rounded-lg transition-all duration-150 ${
                    isCurrentPlayingWord
                      ? 'bg-emerald-300 dark:bg-emerald-700 text-emerald-950 dark:text-white font-bold scale-105 shadow-sm ring-2 ring-emerald-500/40 inline-block'
                      : 'hover:bg-emerald-100/80 dark:hover:bg-emerald-950/60 hover:text-emerald-800 dark:hover:text-emerald-200'
                  }`}
                  title={language === 'ar' ? 'اضغط للترجمة وإنشاء بطاقة' : 'Click to lookup & create card'}
                >
                  {token}
                </span>
              );
            })}
          </div>
        )}

        {/* Read-Along Synchronization Notice */}
        {audioData && !audioData.has_alignment && isPlayingAudio && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {language === 'ar'
                ? 'الصوت قيد التشغيل (تظليل الكلمات اللحظي متاح مع ElevenLabs)'
                : 'Audio playing (real-time word highlighting is active with ElevenLabs)'}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Passage Navigation Bar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 shadow-xs">
        <Button
          variant="outline"
          size="sm"
          icon={<ChevronLeft className="w-4 h-4 rtl:rotate-180" />}
          disabled={currentIdx === 0 || isLoadingPassage}
          onClick={prevPassage}
        >
          <span className="hidden sm:inline">{language === 'ar' ? 'المقطع السابق' : 'Previous'}</span>
        </Button>

        {/* Passage Progress Slider / Info */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>
              {language === 'ar'
                ? `المقطع ${currentIdx + 1} من ${total}`
                : `Passage ${currentIdx + 1} of ${total}`}
            </span>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              ({progressPercent}%)
            </span>
          </div>
          <div className="w-full max-w-xs bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={<ChevronRight className="w-4 h-4 rtl:rotate-180" />}
          disabled={currentIdx + 1 >= total || isLoadingPassage}
          onClick={nextPassage}
        >
          <span className="hidden sm:inline">{language === 'ar' ? 'المقطع التالي' : 'Next'}</span>
        </Button>
      </div>

      {/* Word Lookup Popover / Modal */}
      {isLookupOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-2xl font-bold font-serif text-slate-900 dark:text-white">
                    {lookupWordText}
                  </h3>
                  <button
                    onClick={() => lookupWordText && handlePlayWordAudio(lookupWordText)}
                    className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 hover:bg-emerald-100 transition-colors"
                    title={language === 'ar' ? 'نطق الكلمة' : 'Pronounce'}
                  >
                    <Volume2 className={`w-4 h-4 ${isPlayingWordAudio ? 'animate-pulse' : ''}`} />
                  </button>
                </div>

                {lookupResult?.source === 'ai' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                    <Sparkles className="w-3 h-3" />
                    <span>{language === 'ar' ? 'ترجمة سياقية ذكية' : 'Contextual AI Translation'}</span>
                  </span>
                )}
              </div>

              <button
                onClick={closeLookup}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Translation & Definition Body */}
            {isLoadingLookup ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                <span className="text-xs text-slate-400">
                  {language === 'ar' ? 'جاري البحث عن المعنى والسياق...' : 'Looking up context definition...'}
                </span>
              </div>
            ) : (
              <div className="space-y-3.5 text-xs">
                {/* Arabic Translation */}
                {lookupResult?.translation_ar && (
                  <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
                    <span className="block text-[10px] font-bold text-emerald-800 dark:text-emerald-400 mb-0.5">
                      {language === 'ar' ? 'الترجمة في هذا السياق:' : 'Contextual Translation:'}
                    </span>
                    <p className="text-base font-bold text-slate-900 dark:text-white font-arabic">
                      {lookupResult.translation_ar}
                    </p>
                  </div>
                )}

                {/* English Definition */}
                {lookupResult?.definition_en && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {language === 'ar' ? 'التعريف الإنجليزي:' : 'Definition:'}
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                      {lookupResult.definition_en}
                    </p>
                  </div>
                )}

                {/* Original Context Sentence */}
                {lookupSentenceText && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1 text-left dir-ltr">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Sentence Context:
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 italic font-serif">
                      "{lookupSentenceText}"
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" size="sm" onClick={closeLookup}>
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                icon={isAddingCard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                disabled={isAddingCard || isLoadingLookup}
                onClick={addWordToReview}
              >
                {isAddingCard
                  ? language === 'ar'
                    ? 'جاري الإنشاء...'
                    : 'Creating...'
                  : language === 'ar'
                  ? '➕ أضف للمراجعة'
                  : 'Add to Review'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
