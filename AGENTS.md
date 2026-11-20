# AGENTS.md – Instructions for AI Development Agents

This document defines the architectural invariants, engineering principles, conventions, and verification gates for **Zpevniq**, a cross-platform offline-first songbook built with **React, TypeScript, and Capacitor** (iOS, Android, Web/PC).

## 1. Non-Negotiable Architectural Invariants

- **Offline-First:** All core functionality (reading, searching saved songs, transposing, editing, auto-scroll, and cached Pro entitlements) must work 100% offline. Never block core flows on network availability.
- **Client-Side Scraping Only:** Fetching and parsing external song websites must happen **exclusively on the native mobile client** via `CapacitorHttp`. Never build backend proxy endpoints or server-side scrapers to fetch third-party lyrics.
- **Strict Platform Abstraction:** UI components and pages must never import or call native Capacitor APIs, `CapacitorHttp`, or SQLite queries directly. Route all access through abstraction layers (`src/services/platform.ts`, `src/db/repository.ts`, `src/services/*`). Check semantic capabilities (e.g., `platform.canScrape`) rather than scattering `Capacitor.isNativePlatform()` checks across the UI.
- **Graceful Web/PC Degradation:** On Web (`!platform.isNative`), client-side scraping features must be hidden or replaced with file import / cloud sync prompts (due to browser CORS). The web build must never crash due to missing native plugins.
- **Security & Privacy:** Never inject untrusted scraped HTML into the DOM (no `dangerouslySetInnerHTML`). Never hardcode secrets or API keys (use environment variables). Enforce Supabase Row-Level Security (RLS) on all user tables.

## 2. Engineering Principles (KISS, DRY, YAGNI & Clean Architecture)

- **KISS (Keep It Simple, Stupid):** Prefer straightforward, readable code over clever or premature abstractions. Use built-in Web/WebView APIs (`DOMParser`, `crypto.randomUUID()`, `Intl`, `requestAnimationFrame`) instead of adding heavy third-party libraries unless a concrete gap exists. Avoid heavy global state frameworks (e.g., Redux) when React state, context, or lightweight hooks suffice.
- **DRY (Don't Repeat Yourself) & Single Source of Truth:** Centralize domain invariants, data normalization, HTTP client boilerplate, and schema metadata so business rules exist in exactly one place. Apply the **Rule of Three** before extracting generic UI helpers—duplicate small local snippets briefly rather than creating a wrong abstraction.
- **YAGNI (You Aren't Gonna Need It):** Implement only what the current task requires. Do not add speculative hooks, unused configuration flags, or dead compatibility shims.
- **Separation of Concerns & Pure Core:**
  - `src/core/` must remain **100% pure TypeScript** with zero React, DOM, or Capacitor imports.
  - Keep `src/components/` thin and presentational; place business logic in `src/core/` and I/O or side effects in `src/services/` and `src/db/`.
- **Explicit Error Handling:** Use typed errors or discriminated result unions for recoverable failures (scraping, sync, file import). Never swallow errors silently; surface actionable, localized messages while keeping offline UX intact.

## 3. Song Data Format (`src/core/chordpro/`)

- **Sole Storage Format:** **ChordPro** (inline chords in square brackets, e.g., `[Am]Song lyrics`) is the only persisted song format.
- **Canonical Source of Truth (DRY):** `chordpro_content` (with directives like `{title: ...}`, `{artist: ...}`, `{key: ...}`, `{capo: ...}`) is canonical. Structured database columns (`title`, `artist`, `key`, `capo`, `search_text`) are **derived indexed projections** populated automatically inside `SongRepository` on every write—never maintain them separately in UI code.
- **Library Isolation:** Wrap any third-party ChordPro library (or custom parser) behind an internal facade in `src/core/chordpro/` exposing only Zpevniq's own types (`src/core/types/`).
- **Transposition & Rendering Performance:** Transposition must support both Czech/Central European (`H`/`B`) and International (`B`/`Bb`) chord notation with accurate enharmonic spelling. Memoize parsed and transposed song ASTs in UI components so rendering and scrolling never trigger redundant re-parses.

## 4. Scraper Adapters (`src/services/scrapers/`)

When adding or fixing an external song source adapter:

1. **Interface Compliance:** Every source implements `SongProvider` (`id`, `name`, `search(query)`, `fetchSong(url)`) and registers in `src/services/scrapers/registry.ts`.
2. **Separate HTTP from Parsing:**
   - Route all network calls through the shared `src/services/scrapers/http.ts` wrapper around `CapacitorHttp.get()` (handling timeouts, headers, and typed `ScraperError`s). Never use browser `fetch()`, which fails under CORS.
   - Implement `parseSearchHtml(html: string)` and `parseSongHtml(html: string)` as **pure, deterministic functions** using the standard `DOMParser` API (supported natively in WebViews and via `happy-dom`/`jsdom` in Vitest—avoid bundling `cheerio`).
3. **Central Format Conversion:** For sources displaying *chords-over-lyrics*, convert to inline ChordPro using the shared converter in `src/core/chordpro/converter.ts`. Never re-implement alignment logic per scraper.
4. **Sanitization:** Treat all external HTML as untrusted. Extract plain text and chord tokens only; output clean ChordPro.
5. **Copyright-Safe Fixtures:** Never commit copyrighted lyrics into `__fixtures__/`. Use anonymized/synthetic HTML templates preserving the target DOM structure with placeholder text or public-domain folk songs.

## 5. Database & Offline Sync Layer (`src/db/`, `src/services/sync/`)

- **Unified Repository:** All reads and writes go through `SongRepository` / `PlaylistRepository` (`src/db/repository.ts`). Storage drivers (`sqlite.adapter.ts`, `web.adapter.ts`) must stay thin—handling persistence and indexing only, with shared schema definitions, projections, and normalization in `src/db/schema.ts` and `src/core/utils/`.
- **Versioned Migrations & Contract Tests:** Any schema change requires a matching versioned migration in **both** adapters (`sqlite.adapter.ts` and `web.adapter.ts`) and must pass the shared repository contract test suite so native and web behavior never diverge.
- **Diacritic-Insensitive Full-Text Search:** Use SQLite **FTS5** on native and indexed `search_text` in IndexedDB (`Dexie.js`) on Web, both fed by the same pure normalization function (`normalizeSearchText` — lowercase, stripped diacritics).
- **Sync-Ready Schema (LWW):** Every synced entity uses client-generated UUIDs (`crypto.randomUUID()`), `created_at` / `updated_at` timestamps, soft-delete tombstones (`deleted_at`), and local dirty/sync tracking. Resolve sync conflicts via **Last-Write-Wins (LWW)** on `updated_at` (KISS).
- **Band Mode:** Use Supabase Realtime **Broadcast** channels (ephemeral pub/sub with zero database writes per song/scroll event) and degrade gracefully when offline.

## 6. UI, UX & WebView Performance

- **60/120 FPS Auto-Scroll:** Implement auto-scroll using `requestAnimationFrame` with `deltaTime` (never `setInterval`). Apply scroll offsets imperatively via a DOM `ref` rather than React state updates per frame to avoid unnecessary re-renders.
- **Stage Mode & Wake Lock:** Keep the screen awake during active song viewing / Stage Mode via `src/services/platform.ts` (native Wake Lock plugin on mobile, Web Wake Lock API where available).
- **Safe Areas:** Respect iOS/Android notches, home indicators, and gestures using `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- **Hardware Pedals:** Implement Bluetooth/USB pedal support via a centralized `usePedalControls` hook listening to standard `KeyboardEvent` keys (`PageUp`, `PageDown`, `ArrowUp`, `ArrowDown`, `Space`). Always ignore pedal shortcuts when focus is inside an editable element (`input`, `textarea`, `contenteditable`).

## 7. Monetization & Feature Flags (`src/services/billing/`)

- **Central Entitlement Gate:** Check Pro access exclusively via `useEntitlements()`, backed by a unified Billing Service (RevenueCat mobile + Web Billing / Stripe).
- **Offline Grace Cache:** Persist the latest verified entitlement state locally with an offline grace period so paying musicians never lose Pro tools on stage without internet.
- **Fair Paywall Boundary:** Never gate reading, editing, searching, or importing songs behind a subscription. Paywall only advanced tools (Cloud Sync, Band Mode, PDF Export, Hardware Pedals, Auto-Scroll / Stage Mode).

## 8. Code Conventions & Verification Gate

- **Language:** Write all code identifiers, comments, documentation, and commit messages in **English**. Keep all user-facing strings in localization files (`src/i18n/cs.json`, `src/i18n/en.json`).
- **Strict TypeScript:** Enforce `strict: true` with zero `any` (use `unknown` with type narrowing/guards). Prefer small, single-purpose functions, early returns over deep nesting, and comments that explain *why* rather than *what*.
- **Testing Focus:** Prioritize fast unit tests for `src/core/` and pure scraper parsers, plus repository contract tests across storage adapters.
- **Pre-Completion Checks:** Before finishing any code change, run and verify all three commands pass cleanly:
  1. `npm run typecheck` – zero TypeScript errors.
  2. `npm run test` – all unit and contract tests pass.
  3. `npm run build` – clean production build for Web and Capacitor.
