import { isTauri } from './api';
import {
  AiProviderDto,
  AiProviderInput,
  AnswerResultDto,
  FilterOptionsDto,
  PracticeFilter,
  PracticeSessionDto,
  ProviderTestResult,
  SessionSummaryDto,
} from '../types/ai_practice';

async function callAiTauri<T>(cmd: string, args?: Record<string, unknown>, fallback?: T): Promise<T> {
  if (!isTauri()) {
    console.warn(`[Lisan Web Preview] AI command '${cmd}' using local fallback.`);
    if (fallback !== undefined) return fallback;
    return getFallbackAiData<T>(cmd, args);
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch (err: any) {
    console.error(`[AI IPC Error] ${cmd}:`, err);
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

function getFallbackAiData<T>(cmd: string, args?: any): T {
  const now = new Date().toISOString();

  switch (cmd) {
    case 'ai_provider_list':
      return [
        {
          id: 1,
          provider_key: 'openai',
          display_name: 'OpenAI (GPT-4o / GPT-4o-mini)',
          provider_type: 'preset',
          base_url: null,
          model_id: 'gpt-4o-mini',
          has_key: false,
          key_masked: '',
          is_active: false,
          is_enabled: true,
          last_test_status: 'untested',
          last_test_at: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: 2,
          provider_key: 'anthropic',
          display_name: 'Anthropic (Claude 3.5 Sonnet / Haiku)',
          provider_type: 'preset',
          base_url: null,
          model_id: 'claude-3-5-haiku-latest',
          has_key: false,
          key_masked: '',
          is_active: false,
          is_enabled: true,
          last_test_status: 'untested',
          last_test_at: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: 3,
          provider_key: 'google',
          display_name: 'Google Gemini (1.5 Flash / 2.0 Flash)',
          provider_type: 'preset',
          base_url: null,
          model_id: 'gemini-1.5-flash',
          has_key: false,
          key_masked: '',
          is_active: false,
          is_enabled: true,
          last_test_status: 'untested',
          last_test_at: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: 4,
          provider_key: 'deepseek',
          display_name: 'DeepSeek (V3 / R1)',
          provider_type: 'preset',
          base_url: null,
          model_id: 'deepseek-chat',
          has_key: false,
          key_masked: '',
          is_active: false,
          is_enabled: true,
          last_test_status: 'untested',
          last_test_at: null,
          created_at: now,
          updated_at: now,
        },
        {
          id: 5,
          provider_key: 'groq',
          display_name: 'Groq (Ultra-fast Llama 3.3)',
          provider_type: 'preset',
          base_url: null,
          model_id: 'llama-3.3-70b-versatile',
          has_key: false,
          key_masked: '',
          is_active: false,
          is_enabled: true,
          last_test_status: 'untested',
          last_test_at: null,
          created_at: now,
          updated_at: now,
        },
      ] as unknown as T;

    case 'ai_provider_test':
      return {
        success: true,
        status: 'ok',
        message: 'تم الاتصال بنجاح (وضع المعاينة)',
        latency_ms: 120,
        available_models: ['gpt-4o-mini', 'gpt-4o'],
      } as unknown as T;

    case 'ai_provider_list_models':
      return ['gpt-4o-mini', 'gpt-4o', 'claude-3-5-haiku-latest', 'gemini-1.5-flash'] as unknown as T;

    case 'ai_practice_get_filter_options':
      return {
        decks: [
          { id: 'deck-1', name: 'Core English Vocabulary', card_count: 24 },
          { id: 'deck-2', name: 'Arabic Rhetoric', card_count: 18 },
        ],
        tags: [
          { name: 'vocabulary', card_count: 24 },
          { name: 'idiom', card_count: 8 },
        ],
        specific_cards: [
          {
            id: 'card-1',
            front: 'ubiquitous',
            back: 'موجود في كل مكان في نفس الوقت',
            deck_name: 'Core English Vocabulary',
            created_at: now,
          },
          {
            id: 'card-2',
            front: 'pragmatic',
            back: 'عملي / واقعي',
            deck_name: 'Core English Vocabulary',
            created_at: now,
          },
        ],
        min_date_added: '2026-01-01T00:00:00Z',
        max_date_added: now,
        total_cards_count: 42,
        active_provider: null,
      } as unknown as T;

    case 'ai_practice_start_session':
      return {
        id: 101,
        provider_id: 1,
        provider_name: 'OpenAI (GPT-4o-mini)',
        filter_type: args?.filter?.filter_type || 'deck',
        question_count: 2,
        correct_count: 0,
        status: 'in_progress',
        started_at: now,
        completed_at: null,
        questions: [
          {
            id: 1,
            session_id: 101,
            card_id: 'card-1',
            card_front: 'ubiquitous',
            card_back: 'موجود في كل مكان في نفس الوقت',
            question_text: 'Choose the correct word to complete the sentence: "Smartphones have become _____ in modern society."',
            option_a: 'ubiquitous',
            option_b: 'scarce',
            option_c: 'obsolete',
            option_d: 'fragile',
            grounded_sentence: 'Smartphones have become ubiquitous in modern society.',
            source_citation: 'Tatoeba — Sentence #482910 (CC BY 2.0 FR)',
            source_url: 'https://tatoeba.org/sentences/show/482910',
            is_source_verified: true,
            user_answer: null,
            is_correct: null,
            explanation: null,
          },
          {
            id: 2,
            session_id: 101,
            card_id: 'card-2',
            card_front: 'pragmatic',
            card_back: 'عملي / واقعي',
            question_text: 'What is the most accurate definition of "pragmatic"?',
            option_a: 'Overly emotional and impulsive',
            option_b: 'Dealing with things sensibly and realistically based on practical considerations',
            option_c: 'Theoretical with no real application',
            option_d: 'Strictly traditional and rigid',
            grounded_sentence: null,
            source_citation: null,
            source_url: null,
            is_source_verified: false,
            user_answer: null,
            is_correct: null,
            explanation: null,
          },
        ],
      } as unknown as T;

    case 'ai_practice_submit_answer':
      return {
        question_id: args?.question_id || 1,
        is_correct: args?.chosen === 'a' || args?.chosen === 'b',
        correct_option: args?.question_id === 2 ? 'b' : 'a',
        explanation: 'الإجابة الصحيحة تعتمد على السياق اللغوي ومعنى الكلمة.',
        user_answer: args?.chosen || 'a',
        session_correct_count: 1,
        session_completed: false,
      } as unknown as T;

    case 'ai_practice_get_summary':
      return {
        session_id: args?.session_id || 101,
        total_questions: 2,
        correct_count: 2,
        incorrect_count: 0,
        accuracy_percentage: 100.0,
        started_at: now,
        completed_at: now,
        questions: [],
      } as unknown as T;

    case 'ai_practice_list_history':
      return [] as unknown as T;

    case 'generate_distractors':
      return ['alternative context', 'opposite meaning', 'unrelated concept'] as unknown as T;

    default:
      return null as unknown as T;
  }
}

export const aiPracticeApi = {
  saveProvider: (input: AiProviderInput) =>
    callAiTauri<AiProviderDto>('ai_provider_save', { input }),

  testProvider: (providerId: number) =>
    callAiTauri<ProviderTestResult>('ai_provider_test', { providerId }),

  listModels: (providerId: number) =>
    callAiTauri<string[]>('ai_provider_list_models', { providerId }),

  listProviders: () =>
    callAiTauri<AiProviderDto[]>('ai_provider_list'),

  setActiveProvider: (providerId: number) =>
    callAiTauri<void>('ai_provider_set_active', { providerId }),

  deleteProvider: (providerId: number) =>
    callAiTauri<void>('ai_provider_delete', { providerId }),

  getFilterOptions: () =>
    callAiTauri<FilterOptionsDto>('ai_practice_get_filter_options'),

  startSession: (filter: PracticeFilter, questionCount: number = 10) =>
    callAiTauri<PracticeSessionDto>('ai_practice_start_session', {
      filter,
      questionCount,
    }),

  submitAnswer: (questionId: number, chosen: string) =>
    callAiTauri<AnswerResultDto>('ai_practice_submit_answer', {
      questionId,
      chosen,
    }),

  getSummary: (sessionId: number) =>
    callAiTauri<SessionSummaryDto>('ai_practice_get_summary', { sessionId }),

  listHistory: (limit: number = 20) =>
    callAiTauri<PracticeSessionDto[]>('ai_practice_list_history', { limit }),

  generateDistractors: (word: string, count: number = 3) =>
    callAiTauri<string[]>('generate_distractors', { word, count }),
};
