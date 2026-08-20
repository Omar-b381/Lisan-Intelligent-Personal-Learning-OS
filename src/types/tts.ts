export type TtsProviderType = 'system' | 'google' | 'elevenlabs';

export interface TtsRequest {
  text: string;
  language?: string | null;
  provider?: string | null;
  voice?: string | null;
  speed?: number | null;
  pitch?: number | null;
  output_format?: string | null;
}

export interface TtsResult {
  id: string;
  text_hash: string;
  text: string;
  language: string;
  provider: string;
  voice: string;
  speed: number;
  pitch: number;
  file_path: string;
  base64_data: string | null;
  mime_type: string;
  file_size: number;
  duration_ms: number;
  cached: boolean;
}

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: string | null;
  provider: string;
  is_default: boolean;
}

export interface Language {
  code: string;
  display_name: string;
  native_name: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  is_configured: boolean;
  requires_key: boolean;
}

export interface TtsCacheStats {
  total_files: number;
  total_size_bytes: number;
  total_plays: number;
}

export interface BulkGenerationRequest {
  deck_id: string;
  provider?: string | null;
  voice?: string | null;
  speed?: number | null;
  only_missing: boolean;
}

export interface BulkGenerationProgress {
  task_id: string;
  deck_id: string;
  total_cards: number;
  processed_cards: number;
  current_word: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  error?: string | null;
}

export interface AudioPlayOptions {
  speed?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: string) => void;
}

export interface ElevenLabsAccountInfo {
  tier: string;
  character_count: number;
  character_limit: number;
  status: string;
}
