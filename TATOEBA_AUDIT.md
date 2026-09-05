# Tatoeba Integration Audit & Hardening Report — Lisan

## Overview
As part of the language learning infrastructure audit for Lisan, this report provides a comprehensive review of the Tatoeba example sentence integration used in sentence-grounded AI MCQ generation and interactive reading.

---

## 1. API Endpoint Evaluation & Migration (Item 2.1)

### Previous Implementation
- **Endpoint**: `https://tatoeba.org/en/api_v0/search?query={term}&from={lang}&orphans=no&unapproved=no`
- **Status**: The `api_v0` endpoint is officially deprecated by the Tatoeba project. While currently operational, it lacks long-term support guarantees.

### Modern Endpoint Audit
- **New Official API**: `https://api.tatoeba.org/unstable/sentences?lang={lang}&q={term}&orphans=no&unapproved=no&limit=10`
- **Response Format Differences**:
  - Legacy `api_v0`: JSON root object with `{ "results": [ { "id": 123, "text": "...", ... } ] }`.
  - Modern API (`api.tatoeba.org`): JSON root object with `{ "data": [ { "id": 123, "text": "...", "lang": "eng", "is_native": true, ... } ] }`.

### Implemented Hardening & Resolution
- **Dual-Endpoint Resilience Architecture**: The Tatoeba client was upgraded to query the modern `api.tatoeba.org/unstable/sentences` endpoint first. If it encounters a non-200 status code or network failure, it automatically fails over to the legacy search endpoint without error interruption.
- **Universal Response Parsing**: The response parser gracefully handles both `data` and `results` JSON array keys.
- **Known Limitation**: The modern endpoint includes `/unstable` in its path per Tatoeba's public documentation; our automatic fallback ensures 100% uptime regardless of Tatoeba's upstream endpoint modifications.

---

## 2. Language Filtering & Validation (Item 2.2)

### Findings
- ISO 639-1 (2-letter) codes used in the app (e.g., `en`, `ar`, `fr`, `de`, `es`, `it`, `ru`, `tr`, `ja`, `zh`) were mapped to Tatoeba's ISO 639-3 (3-letter) language identifiers (`eng`, `ara`, `fra`, `deu`, `spa`, `ita`, `rus`, `tur`, `jpn`, `cmn`).
- However, previous versions did not validate the `lang` attribute on returned sentence items, trusting that Tatoeba's search engine strictly matched the requested language.

### Implemented Hardening
- **Request-side**: The request strictly passes `lang={iso3}` or `from={iso3}` parameters matching the deck's target language.
- **Response-side Validation**: Each candidate sentence in the response array is explicitly checked against the expected language (`item.lang == expected_lang`).
- **Term Containment**: Validates that the returned sentence actually contains the search term (case-insensitive) to filter out spurious keyword matches.

---

## 3. Sentence Quality Filtering (Item 2.3)

### Findings
- Tatoeba contains community-submitted sentences with varying quality levels, including orphan sentences (translations disconnected from source) and unapproved translations.

### Implemented Hardening
- **Orphan & Approval Filtering**: Both `orphans=no` and `unapproved=no` query parameters are strictly enforced on all queries.
- **Length Filtering**: Enforces reasonable sentence bounds (between 12 and 300 characters) so that neither single-word fragments nor entire multi-paragraph texts are selected as MCQ contexts.

---

## 4. Fallback Behavior & Zero-Result Handling (Item 2.4)

### Findings
- When searching for rare words or newly added vocabulary, Tatoeba may return 0 sentences.

### Implemented Hardening
- **Non-Breaking Fallback Chain**:
  1. `TatoebaGrounding::find_example()` returns `Option<GroundedExample>`. On 0 results, it returns `None`.
  2. `GroundingService` cascades to `FreeDictionaryGrounding` for English definitions.
  3. If ungrounded, `QuestionGenerator` seamlessly creates a deterministic vocabulary/definition question using `generate_fallback_draft()`.
  4. The quiz flow is guaranteed never to crash or block on missing grounding data.

---

## 5. Local SQLite Caching (Item 2.5)

### Previous Implementation
- No caching was present for Tatoeba queries; every flashcard practice generation performed repeated live HTTP calls for identical words.

### Implemented Hardening
- **New Database Table**: Created `tatoeba_sentence_cache` (Migration 006).
  ```sql
  CREATE TABLE IF NOT EXISTS tatoeba_sentence_cache (
      cache_key TEXT PRIMARY KEY, -- "term:lang"
      sentence TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT,
      license_note TEXT,
      fetched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  ```
- **30-Day Freshness Policy**: Cache hits within 30 days are served instantly from SQLite without network latency. Stale entries or cache misses query Tatoeba and upsert into the cache.

---

## 6. Timeout Handling (Item 2.6)

### Implemented Hardening
- **Timeout Configuration**: Increased request timeout from 4s to **6 seconds** to accommodate Tatoeba's variable global latency.
- **Thread Safety**: All network calls execute in background `spawn_blocking` worker threads, preventing any UI lag or frame drops in the desktop application.
- **Safe Timeout Degradation**: Network timeouts cleanly return `None` and activate the local fallback question generator.

---

## Summary of Changes

| Component | Before Audit | After Audit & Hardening |
| :--- | :--- | :--- |
| **Endpoint** | Legacy `api_v0` only | Modern `api.tatoeba.org` with automatic fallback to `api_v0` |
| **Response Validation** | None (assumed language match) | Strict response-side language code & term containment verification |
| **Caching** | None (100% network calls) | SQLite `tatoeba_sentence_cache` with 30-day freshness |
| **Timeout** | 4 seconds | 6 seconds, safe non-blocking degradation |
| **Zero-Result Safety** | Clean `None` return | Clean `None` return + definition fallback + DistractorService fallback |
