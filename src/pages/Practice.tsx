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

  useEffect(() => {
    loadFilterOptions();
    loadProviders();
  }, []);

  const activeProvider =
    filterOptions?.active_provider ||
    providers.find((p) => p.is_active && p.is_enabled) ||
    providers.find((p) => p.has_key && p.is_enabled) ||
    null;

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
    nextQuestion();
  };

  // Toggle card selection in Specific Cards filter
  const toggleCardSelection = (id: string) => {
    const next = selectedCardIds.includes(id)
      ? selectedCardIds.filter((x) => x !== id)
      : [...selectedCardIds, id];
    setSelectedCardIds(next);
    setActiveFilter({ card_ids: next });
  };

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 2: GENERATING
  // ───────────────────────────────────────────────────────────────────────────
  if (practiceStage === 'generating' || isGenerating) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6 max-w-md mx-auto animate-fade-in">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30 animate-pulse">
            <Sparkles className="w-10 h-10 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
            <BookOpen className="w-4 h-4 text-emerald-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {language === 'ar' ? 'جاري إعداد الأسئلة وتأصيل المصادر...' : 'Generating Grounded AI Practice...'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {language === 'ar'
              ? 'يقوم النظام بالبحث في قواعد البيانات اللغوية الموثقة (Tatoeba & Dictionaries) وصياغة أسئلة واقعية.'
              : 'Searching authentic language databases (Tatoeba & Dictionaries) and crafting context-rich MCQ questions.'}
          </p>
        </div>

        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 3: QUIZ (MCQ)
  // ───────────────────────────────────────────────────────────────────────────
  if (practiceStage === 'quiz' && currentSession) {
    const questions = currentSession.questions;
    const currentQ = questions[currentQuestionIndex];

    if (!currentQ) {
      return (
        <div className="text-center p-8">
          <Button variant="primary" onClick={resetPractice}>
            {language === 'ar' ? 'العودة' : 'Return'}
          </Button>
        </div>
      );
    }

    const isAnswered = lastAnswerResult !== null;
    const options: { key: 'a' | 'b' | 'c' | 'd'; text: string }[] = [
      { key: 'a', text: currentQ.option_a },
      { key: 'b', text: currentQ.option_b },
      { key: 'c', text: currentQ.option_c },
      { key: 'd', text: currentQ.option_d },
    ];

    const progressPct = ((currentQuestionIndex + 1) / questions.length) * 100;

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12 select-none">
        {/* Top Header & Progress */}
        <div className="flex items-center justify-between">
          <button
            onClick={resetPractice}
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            {language === 'ar' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            <span>{language === 'ar' ? 'إنهاء التدريب' : 'Exit Practice'}</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              {currentQuestionIndex + 1} / {questions.length}
            </span>
            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
              {currentSession.correct_count} {language === 'ar' ? 'صحيح' : 'Correct'}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Question Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
          {/* Target Word Tag */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 text-xs font-bold rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {currentQ.card_front}
              </span>
              <button
                type="button"
                onClick={() => playPronunciation(currentQ.card_front)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 transition-colors"
                title="Pronounce"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {/* Grounding Source Badge */}
            {currentQ.is_source_verified ? (
              <a
                href={currentQ.source_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:underline"
                title={currentQ.source_citation || 'Verified Source'}
              >
                <BookOpen className="w-3 h-3" />
                <span>{language === 'ar' ? '📖 مصدر واقعي موثّق' : '📖 Verified Source'}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <Sparkles className="w-3 h-3" />
                <span>{language === 'ar' ? '🤖 مثال بالذكاء الاصطناعي' : '🤖 AI Generated Context'}</span>
              </span>
            )}
          </div>

          {/* Question Text */}
          <div className="space-y-2">
            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white leading-relaxed">
              {currentQ.question_text}
            </h2>
            {currentQ.grounded_sentence && (
              <blockquote className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-s-4 border-emerald-500 text-xs italic text-slate-600 dark:text-slate-300">
                "{currentQ.grounded_sentence}"
              </blockquote>
            )}
          </div>

          {/* MCQ Options (4 options) */}
          <div className="grid grid-cols-1 gap-3 pt-2">
            {options.map(({ key, text }) => {
              let optionStyle =
                'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-emerald-500/50';

              if (isAnswered) {
                const isCorrectOption = lastAnswerResult.correct_option === key;
                const isUserChosen = lastAnswerResult.user_answer === key;

                if (isCorrectOption) {
                  optionStyle =
                    'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold ring-2 ring-emerald-500/30';
                } else if (isUserChosen && !lastAnswerResult.is_correct) {
                  optionStyle =
                    'bg-red-50 dark:bg-red-950/60 border-red-500 text-red-800 dark:text-red-200 font-bold ring-2 ring-red-500/30';
                } else {
                  optionStyle =
                    'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60';
                }
              } else if (selectedOption === key) {
                optionStyle =
                  'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/30';
              }

              return (
                <button
                  key={key}
                  disabled={isAnswered || isSubmittingAnswer}
                  onClick={() => handleOptionSelect(key)}
                  className={`w-full p-4 rounded-2xl border text-start transition-all flex items-center justify-between text-sm ${optionStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs uppercase text-slate-700 dark:text-slate-300">
                      {key}
                    </span>
                    <span className="font-medium">{text}</span>
                  </div>

                  {isAnswered && lastAnswerResult.correct_option === key && (
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  {isAnswered &&
                    lastAnswerResult.user_answer === key &&
                    !lastAnswerResult.is_correct && (
                      <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    )}
                </button>
              );
            })}
          </div>

          {/* Explanation & Feedback Box */}
          {isAnswered && (
            <div
              className={`p-5 rounded-2xl border space-y-3 animate-slide-up ${
                lastAnswerResult.is_correct
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {lastAnswerResult.is_correct ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span
                    className={`font-bold text-sm ${
                      lastAnswerResult.is_correct ? 'text-emerald-800 dark:text-emerald-200' : 'text-red-800 dark:text-red-200'
                    }`}
                  >
                    {lastAnswerResult.is_correct
                      ? language === 'ar'
                        ? 'إجابة صحيحة! أحسنت 🎯'
                        : 'Correct Answer! Well done 🎯'
                      : language === 'ar'
                      ? 'إجابة غير صحيحة 💡'
                      : 'Incorrect Answer 💡'}
                  </span>
                </div>

                <Button variant="primary" size="sm" onClick={handleNext}>
                  {currentQuestionIndex + 1 >= questions.length
                    ? language === 'ar'
                      ? 'عرض الملخص'
                      : 'View Summary'
                    : language === 'ar'
                    ? 'السؤال التالي'
                    : 'Next Question'}
                </Button>
              </div>

              {/* Explanation text */}
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {lastAnswerResult.explanation}
              </p>

              {/* Citation note if grounded */}
              {currentQ.source_citation && (
                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{currentQ.source_citation}</span>
                  {currentQ.source_url && (
                    <a
                      href={currentQ.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:underline flex items-center gap-0.5 font-semibold"
                    >
                      <span>{language === 'ar' ? 'عرض المصدر الأصلي' : 'View Source'}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STAGE 4: SUMMARY
  // ───────────────────────────────────────────────────────────────────────────
  if (practiceStage === 'summary' && sessionSummary) {
    const wrongQuestions = sessionSummary.questions.filter((q) => !q.is_correct);

    return (
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
        {/* Score Banner */}
        <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {language === 'ar' ? 'اكتملت جلسة التدريب!' : 'Practice Completed!'}
            </h2>
            <p className="text-xs text-slate-400">
              {sessionSummary.accuracy_percentage >= 80
                ? language === 'ar'
                  ? 'أداء رائع ومبهر في استرجاع الكلمات 🌟'
                  : 'Outstanding recall accuracy 🌟'
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
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {q.card_front}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {q.card_back}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {q.question_text}
                  </p>

                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 block">
                      {language === 'ar' ? 'الإجابة الصحيحة:' : 'Correct Answer:'}{' '}
                      <span className="uppercase font-mono">({q.correct_option})</span>
                    </span>
                    <p className="text-slate-600 dark:text-slate-300">{q.explanation}</p>
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
  // STAGE 1: SETUP & FILTER SCREEN (Default)
  // ───────────────────────────────────────────────────────────────────────────
  const filterType = activeFilter.filter_type || 'deck';

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          <span>{language === 'ar' ? 'التدريب الذكي بالذكاء الاصطناعي (AI Practice)' : 'AI Practice & Quiz'}</span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {language === 'ar'
            ? 'اختبارات اختيار من متعدد واقعية وموثّقة المصدر على مفرداتك وبطاقاتك'
            : 'Grounded real-world multiple-choice quizzes tailored to your vocabulary cards'}
        </p>
      </div>

      {/* Active AI Provider Card / Alert */}
      {activeProvider ? (
        <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  {activeProvider.display_name}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-semibold">
                  {activeProvider.model_id || 'default model'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'ar' ? 'المزود النشط لتوليد الأسئلة' : 'Active model generating practice questions'}
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

      {/* Main Filter Selection Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-600" />
          <span>{language === 'ar' ? 'حدد معايير البطاقات للتدريب' : 'Select Target Cards Filter'}</span>
        </h4>

        {/* Filter Type Segmented Control */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'deck', label: language === 'ar' ? 'حسب الرزمة' : 'By Deck', icon: <Layers className="w-4 h-4" /> },
            { id: 'tag', label: language === 'ar' ? 'حسب الوسم' : 'By Tag', icon: <Tag className="w-4 h-4" /> },
            { id: 'date_added', label: language === 'ar' ? 'تاريخ الإضافة' : 'Date Added', icon: <Calendar className="w-4 h-4" /> },
            { id: 'specific_cards', label: language === 'ar' ? 'بطاقات محددة' : 'Specific Cards', icon: <CheckSquare className="w-4 h-4" /> },
          ].map((tab) => {
            const isSelected = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter({ filter_type: tab.id as any })}
                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Filter Details View */}
        <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60">
          {/* DECK FILTER */}
          {filterType === 'deck' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'اختر الرزمة المستهدفة' : 'Select Target Deck'}
              </label>
              <select
                value={activeFilter.deck_id || filterOptions?.decks[0]?.id || ''}
                onChange={(e) => setActiveFilter({ deck_id: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {filterOptions?.decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.card_count} {language === 'ar' ? 'بطاقة' : 'cards'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* TAG FILTER */}
          {filterType === 'tag' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'اختر الوسم' : 'Select Target Tag'}
              </label>
              <select
                value={activeFilter.tag || filterOptions?.tags[0]?.name || ''}
                onChange={(e) => setActiveFilter({ tag: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {filterOptions?.tags.map((t) => (
                  <option key={t.name} value={t.name}>
                    #{t.name} ({t.card_count} {language === 'ar' ? 'بطاقة' : 'cards'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* DATE ADDED FILTER */}
          {filterType === 'date_added' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                {language === 'ar' ? 'تاريخ إضافة الكلمات (مطابقة لتاريخ إنشاء البطاقة)' : 'Filter by Card Creation Date'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-slate-400 mb-1">
                    {language === 'ar' ? 'من تاريخ' : 'From Date'}
                  </span>
                  <input
                    type="date"
                    value={activeFilter.date_from || ''}
                    onChange={(e) => setActiveFilter({ date_from: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
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
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SPECIFIC CARDS FILTER */}
          {filterType === 'specific_cards' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {language === 'ar'
                    ? `اختر البطاقات المحددة (${selectedCardIds.length} محددة)`
                    : `Select Cards (${selectedCardIds.length} selected)`}
                </label>

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

              {/* Card search */}
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

              {/* Scrollable list */}
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
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
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
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

        {/* Question Count Slider */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'عدد أسئلة الاختبار' : 'Number of Questions'}
            </span>
            <span className="font-mono text-emerald-600 font-bold text-sm">
              {questionCount} {language === 'ar' ? 'سؤال' : 'Questions'}
            </span>
          </div>

          <input
            type="range"
            min={3}
            max={30}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>3</span>
            <span>10</span>
            <span>20</span>
            <span>30</span>
          </div>
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
