export interface AiProviderDto {
  id: number;
  provider_key: string;
  display_name: string;
  provider_type: 'preset' | 'custom';
  base_url?: string | null;
  model_id?: string | null;
  has_key: boolean;
  key_masked: string;
  is_active: boolean;
  is_enabled: boolean;
  last_test_status: 'untested' | 'ok' | 'failed';
  last_test_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiProviderInput {
  provider_key: string;
  display_name: string;
  provider_type: 'preset' | 'custom';
  base_url?: string | null;
  api_key?: string | null;
  model_id?: string | null;
  is_active?: boolean;
  is_enabled?: boolean;
}

export interface ProviderTestResult {
  success: boolean;
  status: string;
  message: string;
  latency_ms: number;
  available_models: string[];
}

export interface DeckFilterOption {
  id: string;
  name: string;
  card_count: number;
}

export interface TagFilterOption {
  name: string;
  card_count: number;
}

export interface CardFilterOption {
  id: string;
  front: string;
  back: string;
  deck_name: string;
  created_at: string;
}

export interface FilterOptionsDto {
  decks: DeckFilterOption[];
  tags: TagFilterOption[];
  specific_cards: CardFilterOption[];
  min_date_added?: string | null;
  max_date_added?: string | null;
  total_cards_count: number;
  active_provider?: AiProviderDto | null;
}

export interface PracticeFilter {
  filter_type: 'all_due' | 'deck' | 'tag' | 'specific_cards' | 'date_added' | 'combined';
  card_ids?: string[];
  deck_id?: string;
  tag?: string;
  date_from?: string;
  date_to?: string;
  exclude_previously_practiced?: boolean;
  bypass_cache?: boolean;
}

export interface PracticeQuestionDto {
  id: number;
  session_id: number;
  card_id: string;
  card_front: string;
  card_back: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  grounded_sentence?: string | null;
  source_citation?: string | null;
  source_url?: string | null;
  is_source_verified: boolean;
  user_answer?: string | null;
  is_correct?: boolean | null;
  explanation?: string | null;
}

export interface PracticeSessionDto {
  id: number;
  provider_id?: number | null;
  provider_name?: string | null;
  filter_type: string;
  question_count: number;
  correct_count: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  completed_at?: string | null;
  questions: PracticeQuestionDto[];
}

export interface AnswerResultDto {
  question_id: number;
  is_correct: boolean;
  correct_option: string;
  explanation: string;
  user_answer: string;
  session_correct_count: number;
  session_completed: boolean;
}

export interface QuestionSummaryItem {
  id: number;
  card_id: string;
  card_front: string;
  card_back: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  user_answer?: string | null;
  is_correct?: boolean | null;
  explanation?: string | null;
  grounded_sentence?: string | null;
  source_citation?: string | null;
  source_url?: string | null;
  is_source_verified: boolean;
}

export interface SessionSummaryDto {
  session_id: number;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  accuracy_percentage: number;
  started_at: string;
  completed_at?: string | null;
  questions: QuestionSummaryItem[];
}
