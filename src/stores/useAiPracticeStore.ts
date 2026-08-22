import { create } from 'zustand';
import { aiPracticeApi } from '../services/aiPracticeApi';
import {
  AnswerResultDto,
  FilterOptionsDto,
  PracticeFilter,
  PracticeQuestionDto,
  PracticeSessionDto,
  SessionSummaryDto,
} from '../types/ai_practice';

export type PracticeStage = 'setup' | 'generating' | 'quiz' | 'summary';

interface AiPracticeState {
  filterOptions: FilterOptionsDto | null;
  activeFilter: PracticeFilter;
  questionCount: number;
  practiceStage: PracticeStage;

  currentSession: PracticeSessionDto | null;
  currentQuestionIndex: number;
  isGenerating: boolean;
  isSubmittingAnswer: boolean;
  lastAnswerResult: AnswerResultDto | null;
  sessionSummary: SessionSummaryDto | null;
  answeredQuestionsMap: Record<number, AnswerResultDto>;

  loadFilterOptions: () => Promise<void>;
  setActiveFilter: (filter: Partial<PracticeFilter>) => void;
  setQuestionCount: (count: number) => void;
  startSession: () => Promise<void>;
  submitAnswer: (chosen: string) => Promise<AnswerResultDto | null>;
  nextQuestion: () => void;
  loadSummary: (sessionId: number) => Promise<void>;
  retryMistakesOnly: () => Promise<void>;
  generateFreshForSameFilter: () => Promise<void>;
  resetPractice: () => void;
}

export const useAiPracticeStore = create<AiPracticeState>((set, get) => ({
  filterOptions: null,
  activeFilter: {
    filter_type: 'combined',
    exclude_previously_practiced: true,
  },
  questionCount: 10,
  practiceStage: 'setup',

  currentSession: null,
  currentQuestionIndex: 0,
  isGenerating: false,
  isSubmittingAnswer: false,
  lastAnswerResult: null,
  sessionSummary: null,
  answeredQuestionsMap: {},

  loadFilterOptions: async () => {
    try {
      const options = await aiPracticeApi.getFilterOptions();
      set({ filterOptions: options });
    } catch (err) {
      console.error('Failed to load practice filter options:', err);
    }
  },

  setActiveFilter: (filterUpdates) => {
    set((state) => ({
      activeFilter: { ...state.activeFilter, ...filterUpdates },
    }));
  },

  setQuestionCount: (questionCount) => {
    set({ questionCount: Math.max(1, Math.min(30, questionCount)) });
  },

  startSession: async () => {
    const { activeFilter, questionCount } = get();
    const effectiveFilter: PracticeFilter = {
      ...activeFilter,
      filter_type: activeFilter.filter_type || 'combined',
      exclude_previously_practiced: activeFilter.exclude_previously_practiced ?? true,
    };

    set({
      isGenerating: true,
      practiceStage: 'generating',
      currentQuestionIndex: 0,
      lastAnswerResult: null,
      answeredQuestionsMap: {},
      sessionSummary: null,
    });

    try {
      const session = await aiPracticeApi.startSession(effectiveFilter, questionCount);
      set({
        currentSession: session,
        practiceStage: 'quiz',
        isGenerating: false,
        currentQuestionIndex: 0,
      });
    } catch (err: any) {
      console.error('Failed to start AI practice session:', err);
      set({ isGenerating: false, practiceStage: 'setup' });
      throw err;
    }
  },

  submitAnswer: async (chosen: string) => {
    const { currentSession, currentQuestionIndex, isSubmittingAnswer } = get();
    if (!currentSession || isSubmittingAnswer) return null;

    const question = currentSession.questions[currentQuestionIndex];
    if (!question) return null;

    set({ isSubmittingAnswer: true });
    try {
      const result = await aiPracticeApi.submitAnswer(question.id, chosen);

      // Update question locally
      const updatedQuestions = [...currentSession.questions];
      updatedQuestions[currentQuestionIndex] = {
        ...question,
        user_answer: chosen,
        is_correct: result.is_correct,
        explanation: result.explanation,
      };

      set((state) => ({
        isSubmittingAnswer: false,
        lastAnswerResult: result,
        currentSession: {
          ...currentSession,
          correct_count: result.session_correct_count,
          questions: updatedQuestions,
        },
        answeredQuestionsMap: {
          ...state.answeredQuestionsMap,
          [question.id]: result,
        },
      }));

      return result;
    } catch (err) {
      console.error('Failed to submit answer:', err);
      set({ isSubmittingAnswer: false });
      throw err;
    }
  },

  nextQuestion: () => {
    const { currentSession, currentQuestionIndex } = get();
    if (!currentSession) return;

    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < currentSession.questions.length) {
      set({
        currentQuestionIndex: nextIndex,
        lastAnswerResult: null,
      });
    } else {
      // Reached the end -> load summary
      get().loadSummary(currentSession.id);
    }
  },

  loadSummary: async (sessionId: number) => {
    try {
      const summary = await aiPracticeApi.getSummary(sessionId);
      set({
        sessionSummary: summary,
        practiceStage: 'summary',
      });
    } catch (err) {
      console.error('Failed to load session summary:', err);
    }
  },

  retryMistakesOnly: async () => {
    const { sessionSummary, currentSession } = get();
    if (!sessionSummary) return;

    const incorrectCardIds = sessionSummary.questions
      .filter((q) => !q.is_correct)
      .map((q) => q.card_id);

    if (incorrectCardIds.length === 0) return;

    set({
      activeFilter: {
        filter_type: 'specific_cards',
        card_ids: incorrectCardIds,
      },
      questionCount: incorrectCardIds.length,
    });

    await get().startSession();
  },

  generateFreshForSameFilter: async () => {
    const { activeFilter } = get();
    set({
      activeFilter: {
        ...activeFilter,
        bypass_cache: true,
      },
    });
    await get().startSession();
  },

  resetPractice: () => {
    set({
      practiceStage: 'setup',
      currentSession: null,
      currentQuestionIndex: 0,
      lastAnswerResult: null,
      sessionSummary: null,
      answeredQuestionsMap: {},
    });
    get().loadFilterOptions();
  },
}));
