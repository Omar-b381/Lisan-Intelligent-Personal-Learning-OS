export type BookSourceFormat = 'epub' | 'pdf' | 'txt' | 'mobi_drm_free';

export interface Book {
  id: number;
  title: string;
  author: string | null;
  source_format: BookSourceFormat;
  original_filename: string;
  cover_image_path: string | null;
  cover_base64?: string | null;
  total_passages: number;
  last_passage_index: number;
  imported_at: string;
  progress_percent: number;
}

export interface Passage {
  id: number;
  book_id: number;
  chapter_title: string | null;
  passage_index: number;
  raw_text: string;
  word_count: number;
  total_passages: number;
}

export type WordLookupSource = 'dictionary' | 'ai' | 'none';

export interface WordLookupResult {
  word: string;
  definition_en: string | null;
  translation_ar: string | null;
  example_sentence: string | null;
  source: WordLookupSource;
}

export interface WordTimestamp {
  word: string;
  start_secs: number;
  end_secs: number;
  word_index: number;
}

export interface AudioWithAlignment {
  base64_data: string;
  mime_type: string;
  duration_ms: number;
  word_timestamps: WordTimestamp[];
  has_alignment: boolean;
  provider: string;
}

export interface ReadingCardCreatedResult {
  card_id: string;
  front: string;
  back: string;
  cloze_word: string;
}
