# Database Architecture & Schema - Lisan

## 1. Overview
Lisan uses SQLite 3 with performance-oriented pragmas enabled on startup:
```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

---

## 2. Table Specifications

### `decks`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | UUID format `deck-<uuid>` |
| `parent_id` | `TEXT REFERENCES decks(id)` | Subdeck hierarchy |
| `name` | `TEXT NOT NULL` | Deck display name |
| `description` | `TEXT` | Optional deck description |
| `color` | `TEXT NOT NULL` | Hex color code |
| `icon` | `TEXT NOT NULL` | Icon identifier |
| `priority` | `INTEGER NOT NULL` | Study priority weight |
| `created_at` | `TEXT NOT NULL` | ISO 8601 timestamp |
| `updated_at` | `TEXT NOT NULL` | ISO 8601 timestamp |

### `cards`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | UUID format `card-<uuid>` |
| `deck_id` | `TEXT REFERENCES decks(id)` | Parent deck |
| `card_type` | `TEXT NOT NULL` | `basic`, `cloze`, `image`, `audio` |
| `front` | `TEXT NOT NULL` | Question or cloze deletion text |
| `back` | `TEXT NOT NULL` | Answer or expanded context |
| `notes` | `TEXT` | Additional mnemonics or explanation |
| `state` | `TEXT NOT NULL` | `new`, `learning`, `review`, `relearning`, `suspended`, `buried` |
| `stability` | `REAL NOT NULL` | FSRS memory stability $S$ (days) |
| `difficulty` | `REAL NOT NULL` | FSRS difficulty $D$ (1.0 to 10.0) |
| `reps` | `INTEGER NOT NULL` | Consecutive successful reviews |
| `lapses` | `INTEGER NOT NULL` | Number of times failed (`Again`) |
| `review_count` | `INTEGER NOT NULL` | Total review attempts |
| `last_review` | `TEXT` | ISO 8601 last review timestamp |
| `next_review` | `TEXT` | ISO 8601 next scheduled timestamp |
| `interval_days` | `REAL NOT NULL` | Current interval in days |
| `suspended` | `INTEGER NOT NULL` | 1 if paused from study |
| `buried` | `INTEGER NOT NULL` | 1 if buried for the day |

### `reviews`
Audit log recording every single review attempt for analytics, heatmaps, and FSRS optimization:
- `id`, `card_id`, `session_id`, `rating` (1..4), `review_state`, `scheduled_days`, `elapsed_days`, `last_stability`, `new_stability`, `last_difficulty`, `new_difficulty`, `response_time_ms`, `reviewed_at`.

### `pomodoro_sessions` & `study_sessions`
Tracks focus sessions, duration, accuracy rate %, and XP earned.

---

## 3. Migration Runner
Migrations are version-tracked in `schema_migrations` and executed transactionally:
- `001_initial.sql`: Complete schema and index creation.
- `002_seed.sql`: Starter sample decks (English A2, Rust Programming).
