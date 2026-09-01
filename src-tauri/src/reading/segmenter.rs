use super::importers::ParsedBook;

#[derive(Debug, Clone)]
pub struct SegmentedPassage {
    pub chapter_title: Option<String>,
    pub passage_index: i64,
    pub raw_text: String,
    pub word_count: i64,
}

pub struct Segmenter {
    target_words_per_passage: usize,
}

impl Segmenter {
    pub fn new(target_words: Option<usize>) -> Self {
        Self {
            target_words_per_passage: target_words.unwrap_or(120),
        }
    }

    /// Split a chapter text into complete grammatical sentences
    pub fn split_into_sentences(text: &str) -> Vec<String> {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return Vec::new();
        }

        // Common abbreviations that shouldn't trigger sentence split
        let abbrevs = [
            "Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Sr.", "Jr.", "St.",
            "e.g.", "i.e.", "etc.", "vs.", "inc.", "ltd.", "co.",
            "u.s.", "u.k.", "a.m.", "p.m.", "jan.", "feb.", "mar.",
            "apr.", "aug.", "sept.", "oct.", "nov.", "dec.", "no.",
            "vol.", "dept.", "est.", "approx."
        ];

        let mut sentences = Vec::new();
        let mut current_sentence = String::new();
        let chars: Vec<char> = trimmed.chars().collect();
        let len = chars.len();
        let mut i = 0;

        while i < len {
            let c = chars[i];
            current_sentence.push(c);

            // Check if current character is a sentence end candidate (., !, ?, Arabic ؟, \n\n)
            let is_punct = c == '.' || c == '!' || c == '?' || c == '؟';
            let is_double_newline = c == '\n' && i + 1 < len && chars[i + 1] == '\n';

            if is_punct || is_double_newline {
                // Check if this period is part of an abbreviation
                let mut is_abbrev = false;
                if c == '.' {
                    let cur_trimmed = current_sentence.trim_end();
                    for &abbr in &abbrevs {
                        if cur_trimmed.ends_with(abbr) || cur_trimmed.to_lowercase().ends_with(&abbr.to_lowercase()) {
                            is_abbrev = true;
                            break;
                        }
                    }

                    // Check if part of decimal number e.g. "3.14"
                    if i > 0 && i + 1 < len && chars[i - 1].is_ascii_digit() && chars[i + 1].is_ascii_digit() {
                        is_abbrev = true;
                    }

                    // Check if part of ellipsis "..."
                    if (i + 1 < len && chars[i + 1] == '.') || (i > 0 && chars[i - 1] == '.') {
                        is_abbrev = true;
                    }
                }

                if !is_abbrev {
                    // Check if closing quotation / bracket follows immediately e.g. "!" or )
                    while i + 1 < len && (chars[i + 1] == '"' || chars[i + 1] == '\'' || chars[i + 1] == '”' || chars[i + 1] == '’' || chars[i + 1] == ')' || chars[i + 1] == ']') {
                        i += 1;
                        current_sentence.push(chars[i]);
                    }

                    // Must be followed by whitespace or EOF to count as sentence boundary
                    let next_is_space_or_eof = i + 1 >= len || chars[i + 1].is_whitespace();

                    if next_is_space_or_eof {
                        let clean = current_sentence.trim().to_string();
                        if !clean.is_empty() {
                            sentences.push(clean);
                        }
                        current_sentence = String::new();
                    }
                }
            }

            i += 1;
        }

        let remaining = current_sentence.trim().to_string();
        if !remaining.is_empty() {
            sentences.push(remaining);
        }

        // Clean any empty items
        sentences.into_iter().filter(|s| !s.is_empty()).collect()
    }

    /// Segment a parsed book into sequential passages
    pub fn segment_book(&self, book: &ParsedBook) -> Vec<SegmentedPassage> {
        let mut passages = Vec::new();
        let mut passage_index: i64 = 0;

        for chapter in &book.chapters {
            let chapter_sentences = Self::split_into_sentences(&chapter.raw_text);
            if chapter_sentences.is_empty() {
                continue;
            }

            let mut current_passage_sentences: Vec<String> = Vec::new();
            let mut current_word_count = 0;

            for sentence in chapter_sentences {
                let sentence_words = sentence.split_whitespace().count();

                // If adding this sentence would significantly exceed target words and we already have words
                if current_word_count > 0 && (current_word_count + sentence_words) > (self.target_words_per_passage + 30) {
                    let passage_text = current_passage_sentences.join(" ");
                    let words = passage_text.split_whitespace().count();

                    passages.push(SegmentedPassage {
                        chapter_title: chapter.title.clone(),
                        passage_index,
                        raw_text: passage_text,
                        word_count: words as i64,
                    });

                    passage_index += 1;
                    current_passage_sentences = Vec::new();
                    current_word_count = 0;
                }

                current_passage_sentences.push(sentence);
                current_word_count += sentence_words;

                // If current word count reached target
                if current_word_count >= self.target_words_per_passage {
                    let passage_text = current_passage_sentences.join(" ");
                    let words = passage_text.split_whitespace().count();

                    passages.push(SegmentedPassage {
                        chapter_title: chapter.title.clone(),
                        passage_index,
                        raw_text: passage_text,
                        word_count: words as i64,
                    });

                    passage_index += 1;
                    current_passage_sentences = Vec::new();
                    current_word_count = 0;
                }
            }

            // Flush remaining sentences for the chapter
            if !current_passage_sentences.is_empty() {
                let passage_text = current_passage_sentences.join(" ");
                let words = passage_text.split_whitespace().count();

                passages.push(SegmentedPassage {
                    chapter_title: chapter.title.clone(),
                    passage_index,
                    raw_text: passage_text,
                    word_count: words as i64,
                });

                passage_index += 1;
            }
        }

        passages
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::importers::ParsedChapter;

    #[test]
    fn test_sentence_splitter_handles_abbreviations_and_quotes() {
        let text = "Dr. Watson met Mr. Holmes at 3.14 Baker St. \"Elementary!\" he said. It was true.";
        let sentences = Segmenter::split_into_sentences(text);

        assert_eq!(sentences.len(), 3);
        assert_eq!(sentences[0], "Dr. Watson met Mr. Holmes at 3.14 Baker St.");
        assert_eq!(sentences[1], "\"Elementary!\" he said.");
        assert_eq!(sentences[2], "It was true.");
    }

    #[test]
    fn test_segmenter_never_breaks_mid_sentence() {
        let sentences = vec![
            "Sentence one is short.".to_string(),
            "Sentence two is also relatively short.".to_string(),
            "Sentence three contains more words to test the boundary clustering logic accurately.".to_string(),
        ];

        let book = ParsedBook {
            title: "Test Book".to_string(),
            author: None,
            source_format: "txt".to_string(),
            cover_image: None,
            chapters: vec![ParsedChapter {
                title: Some("Chapter 1".to_string()),
                raw_text: sentences.join(" "),
            }],
        };

        let segmenter = Segmenter::new(Some(10));
        let passages = segmenter.segment_book(&book);

        assert!(!passages.is_empty());
        for p in &passages {
            // Verify every passage ends with valid sentence terminator
            let trimmed = p.raw_text.trim();
            assert!(
                trimmed.ends_with('.') || trimmed.ends_with('!') || trimmed.ends_with('?') || trimmed.ends_with('"') || trimmed.ends_with('”')
            );
        }
    }
}
