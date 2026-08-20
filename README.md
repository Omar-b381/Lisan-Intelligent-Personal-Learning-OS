# Lisan (لسان) - Intelligent Desktop Spaced-Repetition Learning OS

<div align="center">
  <h3>Active Recall &bull; FSRS Spaced Repetition &bull; Pomodoro Focus Sessions &bull; Deep Analytics &bull; Knowledge Heatmaps</h3>
  <p>A high-performance, native cross-platform desktop application built with Tauri 2.x, Rust, SQLite, and React + TypeScript.</p>
</div>

---

## 🌟 Features

- **FSRS-Powered Spaced Repetition**: Modern memory model (Free Spaced Repetition Scheduler) with mathematical formulas for Stability, Difficulty, and Retrievability.
- **Dynamic Review Estimates**: Real-time interval previews for *Again*, *Hard*, *Good*, and *Easy* buttons dynamically computed by Rust domain services.
- **Full Card States**: Support for `New`, `Learning`, `Review`, `Relearning`, `Suspended`, and `Buried` states with deterministic state transitions.
- **Rich Card Formats**: Basic (Front/Back) and Cloze deletion (`{{c1::...}}`) cards with Markdown formatting, inline code, and tag organization.
- **Integrated Pomodoro Productivity**: Focus sessions directly tied to card reviews, measuring active recall minutes, accuracy %, and XP rewards.
- **Knowledge Activity Heatmap**: GitHub-style 365-day grid tracking study consistency in cards reviewed and minutes studied.
- **Diagnostic Weakness Detection**: Flags high-lapse cards and difficult concepts for targeted review.
- **Hierarchical Deck Architecture**: Infinite subdeck nesting, custom deck priority, and aggregated deck statistics.
- **Fast Full-Text Search**: Search by text, `deck:`, `tag:`, and `state:` filters with instant response.
- **Offline-First SQLite Architecture**: Zero cloud dependencies, SQLite WAL mode, migrations, and atomic zero-downtime backups.
- **Internationalization (i18n) & RTL**: Complete English and Arabic language support with automatic RTL layout mirroring.

---

## 🏗️ Architecture Overview

```
React 19 + TypeScript + Zustand (Presentation)
       │
       ▼  Typed Tauri IPC
Tauri 2.x Rust Core Boundary
       │
  ┌────┴────────────────────────┬──────────────────────┐
  ▼                             ▼                      ▼
FSRS Spaced Repetition    Pomodoro Service       Database Layer
Scheduler Engine          Monotonic Timer        rusqlite + Migrations
  │                                                    │
  └─────────────────────────────┬──────────────────────┘
                                ▼
                      Local SQLite Database
                      (WAL Mode + FTS5 Search)
```

---

## 🚀 Quick Start & Development

### Prerequisites
- [Rust](https://rustup.rs/) (edition 2021+, rustc 1.75+)
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://npmjs.com/)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development App
```bash
# Starts Vite dev server and launches the native Tauri window
npm run tauri dev
```

### 3. Run Backend Unit Tests
```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

### 4. Build Production Desktop Binary
```bash
# Builds optimized release binary and OS installers (exe, dmg, deb/appimage)
npm run tauri build
```

---

## 📚 Technical Documentation

- [ARCHITECTURE.md](file:///d:/PROJECTSIMPORTANT/Lisan/ARCHITECTURE.md) - System design, IPC contracts, and domain layering.
- [DATABASE.md](file:///d:/PROJECTSIMPORTANT/Lisan/DATABASE.md) - SQLite schema, migrations, indexes, and queries.
- [SCHEDULER.md](file:///d:/PROJECTSIMPORTANT/Lisan/SCHEDULER.md) - FSRS memory formulas, intervals, and priority scoring.
- [CONTRIBUTING.md](file:///d:/PROJECTSIMPORTANT/Lisan/CONTRIBUTING.md) - Development guidelines and PR standards.

---

## 🛡️ License
MIT License. Built with ❤️ for lifelong learners.
