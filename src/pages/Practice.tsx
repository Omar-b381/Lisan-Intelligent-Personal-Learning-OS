import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  BookOpen,
  Calendar,
  Layers,
  Tag,
  CheckSquare,
  Sliders,
  ExternalLink,
  Info,
  Award,
  AlertCircle,
  HelpCircle,
  Search,
  Volume2,
  Brain,
  Check,
  Zap,
} from 'lucide-react';
import { useAiPracticeStore } from '../stores/useAiPracticeStore';
import { useAiProviderStore } from '../stores/useAiProviderStore';
import { useAppStore } from '../stores/appStore';
import { useTtsStore } from '../stores/ttsStore';
import { t } from '../i18n';
import { Button } from '../components/common/Button';

export const Practice: React.FC = () => {
  const { language, setActiveTab, showToast } = useAppStore();
  const { playPronunciation } = useTtsStore();
  const { providers, loadProviders } = useAiProviderStore();
  const {
    filterOptions,
    loadFilterOptions,
    activeFilter,
    setActiveFilter,
    questionCount,
    setQuestionCount,
    practiceStage,
    currentSession,
    currentQuestionIndex,
    isGenerating,
    isSubmittingAnswer,
    lastAnswerResult,
    sessionSummary,
    startSession,
    submitAnswer,
    nextQuestion,
    retryMistakesOnly,
    generateFreshForSameFilter,
    resetPractice,
  } = useAiPracticeStore();

  const [cardSearch, setCardSearch] = useState('');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '3days' | '7days' | 'custom'>('all');
  const [showSpecificCards, setShowSpecificCards] = useState(false);
  const [isHintRevealed, setIsHintRevealed] = useState(false);

  useEffect(() => {
    loadFilterOptions();
    loadProviders();
  }, []);

  const activeProvider =
    filterOptions?.active_provider ||
    providers.find((p) => p.is_active && p.is_enabled) ||
    providers.find((p) => p.has_key && p.is_enabled) ||
    null;

  const handleDatePresetChange = (preset: 'all' | 'today' | '3days' | '7days' | 'custom') => {
    setDatePreset(preset);
    const today = new Date().toISOString().split('T')[0];
    if (preset === 'all') {
      setActiveFilter({ date_from: undefined, date_to: undefined });
    } else if (preset === 'today') {
      setActiveFilter({ date_from: today, date_to: today });
    } else if (preset === '3days') {
      const d = new Date();
      d.setDate(d.getDate() - 3);
      setActiveFilter({ date_from: d.toISOString().split('T')[0], date_to: today });
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setActiveFilter({ date_from: d.toISOString().split('T')[0], date_to: today });
    }
  };

  const handleStart = async () => {
    if (!activeProvider || !activeProvider.has_key) {
      showToast(
        language === 'ar'
          ? 'يرجى تفعيل أحد مزودي الذكاء الاصطناعي وإدخال مفتاح API في الإعدادات أولاً'
          : 'Please configure and activate an AI provider in Settings first'
      );
      setActiveTab('settings');
      return;
    }

    try {
      if (!activeProvider.is_active && activeProvider.id) {
        await useAiProviderStore.getState().setActiveProvider(activeProvider.id);
      }
      await startSession();
    } catch (err: any) {
      showToast(err?.message || 'Failed to start AI practice');
    }
  };

  const handleOptionSelect = async (optionKey: string) => {
    if (selectedOption || isSubmittingAnswer || lastAnswerResult) return;
    setSelectedOption(optionKey);
    try {
      await submitAnswer(optionKey);
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit answer');
    }
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsHintRevealed(false);
    nextQuestion();
  };

  const toggleCardSelection = (id: string) => {
    const next = selectedCardIds.includes(id)
      ? selectedCardIds.filter((x) => x !== id)
      : [...selectedCardIds, id];
    setSelectedCardIds(next);
    setActiveFilter({ card_ids: next });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 2: GENERATING LOADER
  // ───────────────────────────────────────────────────────────────────────────
  if (isGenerating || practiceStage === 'generating') {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6 animate-fade-in">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-indigo-500/20 border-b-indigo-500 animate-spin animate-reverse" />
          <div className="absolute inset-0 flex items-center justify-center text-emerald-500">
            <Sparkles className="w-8 h-8 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {language === 'ar'
              ? 'توليد متوازي فائق السرعة للأسئلة الذكية...'
              : 'Generating Intelligent AI Practice Questions...'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {language === 'ar'
              ? 'يتم اختبار الكلمات والمفردات من رزمك وتوليد أسئلة اختيار من متعدد بالتوازي في ثوانٍ معدودة ⚡'
              : 'Testing vocabulary strictly from your decks and crafting questions in parallel across threads ⚡'}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-mono">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>{activeProvider?.display_name || 'AI Engine'} ({activeProvider?.model_id || 'Active'})</span>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 3: QUIZ QUESTION VIEW
  // ───────────────────────────────────────────────────────────────────────────
  if (practiceStage === 'quiz' && currentSession) {
    const questions = currentSession.questions;
    const currentQ = questions[currentQuestionIndex];

    if (!currentQ) {
      return (
        <div className="text-center py-12">
          <p className="text-sm text-slate-500">No question available</p>
          <Button className="mt-4" onClick={resetPractice}>Back to Setup</Button>
        </div>
      );
    }

    const progressPct = ((currentQuestionIndex + 1) / questions.length) * 100;
    const hasAnswered = selectedOption !== null && lastAnswerResult !== null;

    const optionsList: { key: 'a' | 'b' | 'c' | 'd'; text: string }[] = [
      { key: 'a', text: currentQ.option_a },
      { key: 'b', text: currentQ.option_b },
      { key: 'c', text: currentQ.option_c },
      { key: 'd', text: currentQ.option_d },
    ];

    return (
      <div className="max-w-3xl mx-auto py-6 px-4 space-y-6 animate-fade-in">
        {/* Top Progress & Controls Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold">
                {language === 'ar'
                  ? `السؤال ${currentQuestionIndex + 1} من ${questions.length}`
                  : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
              </span>
              <span className="text-[11px] text-slate-400">
                {currentSession.provider_name || 'AI Engine'}
              </span>
            </div>

            <button
              onClick={resetPractice}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-medium transition-colors"
            >
              {language === 'ar' ? 'إنهاء الجلسة' : 'Exit Practice'}
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Question Text Box with Clear Question TTS Reader & Hint Button (No Card Term Spoiler) */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'سؤال الاختبار' : 'Practice Question'}</span>
            </span>

            <div className="flex items-center gap-2">
              {/* TTS Audio button to read the actual Question text */}
              <button
                type="button"
                onClick={() => playPronunciation(currentQ.question_text)}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title={language === 'ar' ? 'قراءة السؤال صوتياً' : 'Listen to question'}
              >
                <Volume2 className="w-4 h-4 text-emerald-600" />
                <span>{language === 'ar' ? 'قراءة السؤال' : 'Read Question'}</span>
              </button>

              {/* Reveal Hint Button */}
              <button
                type="button"
                onClick={() => setIsHintRevealed(!isHintRevealed)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isHintRevealed
                    ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {isHintRevealed
                    ? language === 'ar'
                      ? 'إخفاء التلميح'
                      : 'Hide Hint'
                    : language === 'ar'
                    ? '💡 تلميح (Hint)'
                    : '💡 Show Hint'}
                </span>
              </button>
            </div>
          </div>

          <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
            {currentQ.question_text}
          </p>

          {/* Hidden Hint Content */}
          {isHintRevealed && (
            <div className="p-3.5 bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 rounded-2xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2.5 animate-fade-in">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                {language === 'ar' ? 'تلميح المعنى من البطاقة:' : 'Card Meaning Hint:'}{' '}
                <strong className="font-bold text-slate-900 dark:text-white underline decoration-amber-400">
                  {currentQ.card_back}
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* Options (A / B / C / D) */}
        <div className="grid grid-cols-1 gap-3">
          {optionsList.map((opt) => {
            const isSelected = selectedOption === opt.key;
            const isCorrect = lastAnswerResult?.correct_option === opt.key;
            const isWrongChoice = isSelected && !lastAnswerResult?.is_correct;

            let optionStyle =
              'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-500/80 hover:bg-emerald-50/20';

            if (hasAnswered) {
              if (isCorrect) {
                optionStyle =
                  'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20';
              } else if (isWrongChoice) {
                optionStyle =
                  'bg-red-50 dark:bg-red-950/40 border-red-500 text-red-900 dark:text-red-100 ring-2 ring-red-500/20';
              } else {
                optionStyle =
                  'bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60';
              }
            }

            return (
              <div
                key={opt.key}
                onClick={() => !hasAnswered && !isSubmittingAnswer && handleOptionSelect(opt.key)}
                className={`w-full p-4 rounded-2xl border text-start transition-all flex items-center justify-between cursor-pointer ${optionStyle}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                      hasAnswered && isCorrect
                        ? 'bg-emerald-600 text-white'
                        : hasAnswered && isWrongChoice
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {opt.key}
                  </span>
                  <span className="text-sm font-semibold">{opt.text}</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Option TTS Pronounce */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playPronunciation(opt.text);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title={language === 'ar' ? 'استماع للخيار' : 'Listen to option'}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>

                  {hasAnswered && (
                    <div>
                      {isCorrect && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
                      {isWrongChoice && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Explanation & Next Controls */}
        {hasAnswered && lastAnswerResult && (
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  lastAnswerResult.is_correct
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600'
                    : 'bg-red-100 dark:bg-red-900/60 text-red-600'
                }`}
              >
                {lastAnswerResult.is_correct ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <HelpCircle className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-1">
                <span
                  className={`font-bold text-sm block ${
                    lastAnswerResult.is_correct
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {lastAnswerResult.is_correct
                    ? language === 'ar'
                      ? 'إجابة صحيحة ومتقنة! 🎉'
                      : 'Correct Answer! 🎉'
                    : language === 'ar'
                    ? `إجابة غير صحيحة. الإجابة الصحيحة هي: (${lastAnswerResult.correct_option.toUpperCase()})`
                    : `Incorrect. The correct option was (${lastAnswerResult.correct_option.toUpperCase()})`}
                </span>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {lastAnswerResult.explanation}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleNext}
                icon={
                  language === 'ar' ? (
                    <ArrowLeft className="w-4 h-4" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )
                }
              >
                {currentQuestionIndex + 1 >= questions.length
                  ? language === 'ar'
                    ? 'عرض النتيجة النهائية 🏆'
                    : 'View Final Summary 🏆'
                  : language === 'ar'
                  ? 'السؤال التالي'
                  : 'Next Question'}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 4: SUMMARY VIEW
  // ───────────────────────────────────────────────────────────────────────────
  if (practiceStage === 'summary' && sessionSummary) {
    const wrongQuestions = sessionSummary.questions.filter((q) => !q.is_correct);

    return (
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-8 animate-fade-in">
        {/* Header Hero Card */}
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {language === 'ar' ? 'اكتملت جلسة التدريب!' : 'Practice Session Complete!'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sessionSummary.accuracy_percentage >= 80
                ? language === 'ar'
                  ? 'أداء ممتاز! لقد أظهرت استيعاباً قوياً للمفردات.'
                  : 'Excellent performance! High vocabulary retention demonstrated.'
                : language === 'ar'
                ? 'تدريب جيد! مراجعة الأسئلة الخاطئة ستثبّت المفردات في الذاكرة طويلة المدى.'
                : 'Good practice! Reviewing missed cards strengthens long-term memory.'}
            </p>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
              <span className="block text-[11px] text-slate-400 font-semibold">
                {language === 'ar' ? 'الأسئلة' : 'Questions'}
              </span>
              <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                {sessionSummary.total_questions}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <span className="block text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {language === 'ar' ? 'صحيح' : 'Correct'}
              </span>
              <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300">
                {sessionSummary.correct_count}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
              <span className="block text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                {language === 'ar' ? 'الدقة' : 'Accuracy'}
              </span>
              <span className="text-lg font-bold font-mono text-blue-700 dark:text-blue-300">
                {sessionSummary.accuracy_percentage}%
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            {wrongQuestions.length > 0 && (
              <Button
                variant="primary"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={retryMistakesOnly}
              >
                {language === 'ar'
                  ? `إعادة التدريب على الأخطاء فقط (${wrongQuestions.length})`
                  : `Retry Missed (${wrongQuestions.length})`}
              </Button>
            )}

            <Button
              variant="outline"
              icon={<Sparkles className="w-4 h-4" />}
              onClick={generateFreshForSameFilter}
            >
              {language === 'ar' ? 'توليد أسئلة جديدة لنفس الكلمات' : 'Generate Fresh Questions'}
            </Button>

            <Button variant="ghost" onClick={resetPractice}>
              {language === 'ar' ? 'جلسة تدريب جديدة' : 'New Practice'}
            </Button>
          </div>
        </div>

        {/* Missed Questions Breakdown */}
        {wrongQuestions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>{language === 'ar' ? 'مراجعة الإجابات الخاطئة' : 'Review Missed Questions'}</span>
            </h3>

            <div className="space-y-3">
              {wrongQuestions.map((q) => (
                <div
                  key={q.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {q.card_front}
                    </span>
                    <span className="text-xs text-slate-400">{q.card_back}</span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {q.question_text}
                  </p>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <span>{language === 'ar' ? 'إجابتك:' : 'Your Answer:'}</span>
                      <span className="font-bold uppercase">({q.user_answer})</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <span>{language === 'ar' ? 'الإجابة الصحيحة:' : 'Correct Answer:'}</span>
                      <span className="font-bold uppercase">({q.correct_option})</span>
                    </div>
                    {q.explanation && (
                      <p className="text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 1: MULTI-FILTER SETUP VIEW
  // ───────────────────────────────────────────────────────────────────────────
  const isMemoryLocked = activeFilter.exclude_previously_practiced ?? true;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {language === 'ar' ? 'التدريب الذكي بالذكاء الاصطناعي' : 'AI-Powered Practice'}
          </h2>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {language === 'ar'
            ? 'اختبارات اختيار من متعدد واقعية وموثّقة المصدر مع دمج حر للمجموعات والتواريخ والتصفية'
            : 'Grounded real-world multiple-choice quizzes with flexible multi-filter combinations'}
        </p>
      </div>

      {/* Active AI Provider Card / Alert */}
      {activeProvider ? (
        <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  {activeProvider.display_name}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-semibold">
                  {activeProvider.model_id || 'default'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'المزود النشط لتوليد الأسئلة بالتوازي الفوري' : 'Active engine generating parallel quizzes'}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab('settings')}
          >
            {language === 'ar' ? 'تغيير المزود' : 'Change Provider'}
          </Button>
        </div>
      ) : (
        <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-amber-900 dark:text-amber-200 block">
                {language === 'ar' ? 'لا يوجد مزود ذكاء اصطناعي نشط' : 'No Active AI Provider Configured'}
              </span>
              <p className="text-amber-700 dark:text-amber-300 text-[11px]">
                {language === 'ar'
                  ? 'يرجى إدخال مفتاح API لأحد المزودين في الإعدادات لبدء التدريب'
                  : 'Add an API key for OpenAI, Claude, Gemini, DeepSeek, or Groq in Settings'}
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setActiveTab('settings')}
          >
            {language === 'ar' ? 'فتح الإعدادات' : 'Go to Settings'}
          </Button>
        </div>
      )}

      {/* Main Multi-Filter Selection Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>{language === 'ar' ? 'تخصيص معايير الفلترة المزدوجة' : 'Configure Multi-Filters'}</span>
          </h4>
          <span className="text-[11px] text-slate-400">
            {language === 'ar' ? 'يمكنك دمج الرزمة مع اليوم والوسم معاً' : 'Combine Deck, Day, and Tags simultaneously'}
          </span>
        </div>

        {/* 1. Deck + Tag Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Deck Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'ar' ? 'المجموعة / الرزمة' : 'Deck / Collection'}</span>
            </label>
            <select
              value={activeFilter.deck_id || 'all'}
              onChange={(e) => setActiveFilter({ deck_id: e.target.value === 'all' ? undefined : e.target.value })}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
            >
              <option value="all">
                {language === 'ar' ? '🌟 جميع المجموعات والبطاقات' : '🌟 All Decks & Cards'}
              </option>
              {filterOptions?.decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.card_count} {language === 'ar' ? 'بطاقة' : 'cards'})
                </option>
              ))}
            </select>
          </div>

          {/* Tag Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'ar' ? 'الوسم / التصنيف' : 'Tag / Category'}</span>
            </label>
            <select
              value={activeFilter.tag || 'all'}
              onChange={(e) => setActiveFilter({ tag: e.target.value === 'all' ? undefined : e.target.value })}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
            >
              <option value="all">
                {language === 'ar' ? '🏷️ جميع الأوسمة' : '🏷️ All Tags'}
              </option>
              {filterOptions?.tags.map((t) => (
                <option key={t.name} value={t.name}>
                  #{t.name} ({t.card_count} {language === 'ar' ? 'بطاقة' : 'cards'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2. Date Added Filter (Pills + Custom range) */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>{language === 'ar' ? 'تاريخ إضافة الكلمات (اليوم أو الفترة)' : 'Card Creation Date Filter'}</span>
          </label>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: language === 'ar' ? 'كل الأوقات' : 'All Time' },
              { id: 'today', label: language === 'ar' ? '⚡ المضافة اليوم' : '⚡ Added Today' },
              { id: '3days', label: language === 'ar' ? 'آخر 3 أيام' : 'Last 3 Days' },
              { id: '7days', label: language === 'ar' ? 'آخر أسبوع' : 'Last 7 Days' },
              { id: 'custom', label: language === 'ar' ? '📅 تاريخ مخصص...' : '📅 Custom Range...' },
            ].map((p) => {
              const isSelected = datePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleDatePresetChange(p.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Pickers */}
          {datePreset === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <span className="block text-[11px] text-slate-400 mb-1">
                  {language === 'ar' ? 'من تاريخ' : 'From Date'}
                </span>
                <input
                  type="date"
                  value={activeFilter.date_from || ''}
                  onChange={(e) => setActiveFilter({ date_from: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <span className="block text-[11px] text-slate-400 mb-1">
                  {language === 'ar' ? 'إلى تاريخ' : 'To Date'}
                </span>
                <input
                  type="date"
                  value={activeFilter.date_to || ''}
                  onChange={(e) => setActiveFilter({ date_to: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Memory Lock / Exclude Previously Practiced Words */}
        <div
          onClick={() =>
            setActiveFilter({
              exclude_previously_practiced: !isMemoryLocked,
            })
          }
          className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
            isMemoryLocked
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/80 ring-2 ring-emerald-500/20'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isMemoryLocked
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}
            >
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                {language === 'ar'
                  ? 'حفظ في الذاكرة (استبعاد الكلمات التي تم التدريب عليها مسبقاً)'
                  : 'Memory Lock: Focus Exclusively on New / Unpracticed Words'}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? 'يحفظ تقدمك في الذاكرة لتوليد أسئلة فقط على الكلمات الجديدة أو التي تحتاج تدريباً إضافياً'
                  : 'Saves your practice history and avoids repeating words you already mastered'}
              </p>
            </div>
          </div>

          <div
            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
              isMemoryLocked
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-slate-300 dark:border-slate-700'
            }`}
          >
            {isMemoryLocked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
        </div>

        {/* 4. Specific Cards Manual Selection Toggle (Optional) */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowSpecificCards(!showSpecificCards)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>
                {showSpecificCards
                  ? language === 'ar'
                    ? 'إخفاء محدد البطاقات الفردية'
                    : 'Hide Specific Cards Picker'
                  : language === 'ar'
                  ? `تحديد بطاقات فردية يدوياً (${selectedCardIds.length} محددة)...`
                  : `Select specific cards manually (${selectedCardIds.length} selected)...`}
              </span>
            </button>

            {selectedCardIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCardIds([]);
                  setActiveFilter({ card_ids: [] });
                }}
                className="text-[11px] text-red-500 hover:underline"
              >
                {language === 'ar' ? 'إلغاء التحديد' : 'Clear selection'}
              </button>
            )}
          </div>

          {showSpecificCards && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3 animate-fade-in">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'ابحث عن كلمة أو بطاقة...' : 'Search words...'}
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {filterOptions?.specific_cards
                  .filter(
                    (c) =>
                      c.front.toLowerCase().includes(cardSearch.toLowerCase()) ||
                      c.back.toLowerCase().includes(cardSearch.toLowerCase())
                  )
                  .map((c) => {
                    const isSelected = selectedCardIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleCardSelection(c.id)}
                        className={`p-2 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-semibold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] ${
                              isSelected
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {isSelected && '✓'}
                          </span>
                          <span className="font-bold">{c.front}</span>
                          <span className="text-slate-400 truncate max-w-[200px]">
                            — {c.back}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal shrink-0">
                          {c.deck_name}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* 5. Question Count Selection */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'عدد أسئلة الاختبار' : 'Number of Questions'}
            </span>
            <span className="font-mono text-emerald-600 font-bold text-sm">
              {questionCount} {language === 'ar' ? 'سؤال' : 'Questions'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {[5, 10, 15, 20, 25, 30].map((count) => {
              const isSelected = questionCount === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {count}
                </button>
              );
            })}
          </div>

          <input
            type="range"
            min={3}
            max={30}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
        </div>

        {/* Start Button */}
        <div className="pt-2">
          <Button
            type="button"
            size="lg"
            variant="primary"
            className="w-full py-3.5 text-base font-bold shadow-lg shadow-emerald-600/20"
            icon={<Sparkles className="w-5 h-5" />}
            onClick={handleStart}
          >
            {language === 'ar' ? 'بدء التدريب بالذكاء الاصطناعي 🚀' : 'Start AI Practice Quiz 🚀'}
          </Button>
        </div>
      </div>
    </div>
  );
};
