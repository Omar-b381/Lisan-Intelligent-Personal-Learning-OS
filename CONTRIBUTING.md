# Contributing to Lisan (لسان)

Thank you for your interest in contributing to Lisan!

## 🛠️ Architecture Principles

1. **Rust is the Source of Truth**: All domain logic, FSRS calculations, database operations, and file IO belong in `src-tauri/src/`.
2. **React is Presentational**: UI components render state from Zustand stores and call typed Tauri IPC methods. Avoid putting business calculations or SQL in React.
3. **Deterministic Spaced Repetition**: Ensure all changes to the FSRS scheduling formulas maintain test coverage and pass unit tests.
4. **Database Migrations**: Never modify tables directly in code. Always add a versioned migration in `src-tauri/src/database/migrations/`.
5. **Internationalization & RTL**: All user-facing strings must be defined in both `src/i18n/en.ts` and `src/i18n/ar.ts`.

---

## 🧪 Testing Checklist

Before opening a pull request, run:
```bash
# 1. Run Rust test suite (FSRS math, migrations, database repos)
cargo test --manifest-path src-tauri/Cargo.toml

# 2. Verify TypeScript types and Vite bundle
npm run build
```
