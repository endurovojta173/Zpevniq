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

## 6. Mobile Design System, UI/UX & WebView Performance

Zpevniq follows a **mobile-first, cross-platform design language** grounded in **Material Design 3 (including M3 Expressive)** for Android and **iOS 26 Human Interface Guidelines (Liquid Glass)** for iOS, while degrading cleanly to Web/PC.

### 6.1 Cross-Platform Design Philosophy (Material 3 & iOS 26)

- **Shared Identity, Platform-Adaptive Chrome:** Maintain one cohesive visual identity and component architecture across platforms (KISS/DRY), while adapting navigation chrome, materials, and back gestures to feel native on each OS. Expose platform context centrally (e.g., a root `data-platform` attribute derived from `src/services/platform.ts`) instead of scattering OS conditionals across components.
- **Strict Separation of Chrome and Content (iOS 26 & M3 Invariant):**
  - **Chrome / Navigation Layer** (bottom navigation, floating toolbars, top app bars, modal sheets, floating action pills) floats *above* content and may use translucent glass aesthetics on iOS 26 (`backdrop-filter`, subtle specular borders) or M3 tonal elevated containers on Android.
  - **Content Layer** (song lists, lyrics, chords, search results, editors, settings cards) must **never** use Liquid Glass or heavy blur effects; keep content surfaces crisp, high-contrast, and opaque/tonal so text scrolls cleanly underneath floating chrome.
- **Thumb-Zone Ergonomics:** Place primary navigation and frequent live-performance controls (transpose, capo, auto-scroll, font size, search triggers) in the bottom third of the viewport for comfortable one-handed use.

### 6.2 Color System, Surface Hierarchy & Theme Modes

- **Semantic Design Tokens (DRY):** Define color roles, tonal surfaces, radii, and elevation centrally as CSS custom properties / Tailwind v4 `@theme` tokens in `src/index.css` (e.g., surface containers from lowest to highest, on-surface, primary/accent, outline, semantic status colors). Avoid scattering arbitrary raw palette utilities inconsistently across components.
- **Tonal Elevation Over Heavy Shadows (M3):** Express hierarchy primarily through Material 3 tonal surface container steps and subtle hairline borders rather than heavy drop shadows—especially in dark themes.
- **Theme Contexts:** Design all UI via semantic tokens to support:
  - **Dark Theme (Default):** Low-glare elevated dark tonal surfaces with warm, accessible accent colors for chords and active states.
  - **Light Theme (Daylight / Outdoor):** High-legibility tonal light surfaces for outdoor acoustic playing.
  - **Stage Mode:** True-black (`#000000`) OLED background with maximized lyric/chord legibility and minimal chrome glare on dark stages.
- **Color Independence:** Never communicate state (saved, error, offline, active tab) by color alone—always pair color with an icon, shape change, or text label.

### 6.3 Layout, Safe Areas, Touch Targets & Responsive Scaling

- **Edge-to-Edge & Safe Areas (Android M3 & iOS 26):** Render full-bleed canvases (`viewport-fit=cover`, `min-h-dvh`) edge-to-edge behind system bars, and always inset interactive chrome and readable content using `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-left)`, and `env(safe-area-inset-right)`. Never let text, buttons, or lyrics sit under notches, Dynamic Island, status bars, or gesture bars.
- **Spatial Grid & Concentric Radii:** Align padding, gaps, and component dimensions to an `8px` (`4px` sub-grid) rhythm. Preserve concentric corner radii (`innerRadius = outerRadius - padding`) across nested cards, pills, and sheets.
- **Minimum Touch Targets:** Every interactive element must provide at least a **48×48px** hit area (`min-h-12 min-w-12`, satisfying both M3's `48dp` and iOS's `44pt` standards) with at least **8px** separation between adjacent controls. For compact icons, clear buttons, or switches, expand the tappable hit area rather than shrinking the target.
- **Adaptive Breakpoints:** Support M3 / iOS size classes cleanly—single-column with bottom navigation on compact phones (`< 600px`), expanding to comfortable reading line lengths, navigation rail/sidebar, or master-detail panes on tablets, foldables, and Web/PC (`>= 840px`).

### 6.4 Navigation, Sheets & Interactive States

- **Top-Level Navigation (3–5 Destinations):** Keep primary sections fixed, parallel, and clearly labeled (concise single-word labels; never dynamically hide or disable tabs based on state).
  - *Android (M3):* Navigation Bar with pill-shaped active indicator (`64×32px`), filled vs. outlined icon state, and tonal surface background.
  - *iOS (iOS 26):* Floating inset Liquid Glass capsule tab bar with optional detached circular action/search island; minimize or retract smoothly during downward scrolling or active song reading.
- **Bottom Sheets for Contextual Tools:** Present song controls (transpose, capo, notation `H/B` vs. `B/Bb`, lyric font size, auto-scroll speed, share/export) in modal bottom sheets with a visible drag grabber, backdrop scrim, rounded top corners, and swipe/tap-outside dismissal so the musician retains visual context of the song. Avoid stacking modals on top of modals.
- **Distraction-Free Song Reading:** In Song View, prioritize maximum vertical space for lyrics and chords; allow top/bottom chrome to collapse cleanly while keeping back navigation and key stage controls one tap away.
- **System Back & Edge Gestures:** Respect Android hardware back / Predictive Back expectations (dismiss sheet → leave song view → root tab) and iOS edge-swipe gestures. Never place horizontal swipe controls inside the outer `24px` screen edge zones where they conflict with OS navigation gestures.
- **Complete UI States & Feedback:** Every async or data-driven view must explicitly handle **Loading** (geometry-matched skeletons, not blocking full-screen spinners when cached data exists), **Empty** (clear guidance + single primary CTA), **Offline**, and **Error** (localized, non-blocking banner/state with retry). Use non-blocking toasts/snackbars positioned above the bottom bar for confirmations, and require confirmation or provide Undo for destructive actions.

### 6.5 Typography & ChordPro Readability

- **Native System Typography & Scaling:** Prefer native system font stacks (`-apple-system`, `Roboto`, `system-ui`) for zero-latency platform familiarity, paired with `rem`-based sizing so UI respects OS font-scale / Dynamic Type preferences. Keep all text inputs at `>= 16px` (`text-base`) to prevent iOS WebView auto-zoom on focus.
- **Clear Hierarchy & Scanning:** Use clear weight and size contrast (aligned with M3 baseline/emphasized roles and iOS 26 bolder headers that remain legible near translucent chrome). Left-align body copy and lists; apply `tabular-nums` to numeric badges, capo numbers, transpose offsets, and BPM counters.
- **Song & Chord Presentation:** Separate UI font size from **user-adjustable song zoom**. Render chords with unmistakable contrast and vertical alignment above their anchor syllables while wrapping lyrics cleanly at word boundaries (never apply `whitespace-pre` across full lyric segments, and enforce `overflow-x: clip` at root) so live performance never triggers horizontal scrolling.

### 6.6 Motion, Haptics & Native WebView Polish

- **Fast, Interruptible, GPU-Only Motion:** Keep UI transitions snappy (`150–250ms`) with spring-like easing (M3 Expressive / iOS fluid motion). Animate exclusively compositor-friendly properties (`transform`, `opacity`)—never animate layout properties (`height`, `width`, `top`, `left`) during scroll or interaction.
- **Native WebView Tactile Hygiene:**
  - Apply `touch-action: manipulation` on interactive controls to remove tap latency.
  - Suppress default browser tap flashes (`-webkit-tap-highlight-color: transparent`) and provide deliberate pressed feedback (M3 tonal state layer or subtle tactile scale).
  - Set `user-select: none` on UI chrome (navigation, buttons, headers, list rows) while keeping text selection enabled in editors and raw ChordPro views.
  - Configure `overscroll-behavior` appropriately so scroll panes do not rubber-band fixed toolbars or trigger unintended parent scroll.
  - Ensure search fields and song editors remain visible above the on-screen keyboard without breaking fixed layouts.
- **Semantic Haptics (Native Only):** Route subtle haptic feedback through `src/services/platform.ts` (selection ticks for transpose/capo steps, light impact for toggles, notification haptics for save/error), degrading silently on Web.

### 6.7 Accessibility, Stage Performance & Hardware Controls

- **Contrast & OS Accessibility Preferences:** Meet at least **WCAG AA** contrast (`>= 4.5:1` for body text, `>= 3:1` for large text, icons, and chord labels; higher in Stage Mode). Always honor `@media (prefers-reduced-motion: reduce)` (disable non-essential transitions), `@media (prefers-reduced-transparency: reduce)` (replace translucent glass chrome with solid high-contrast surfaces), and `@media (prefers-contrast: more)`.
- **Semantic Markup & Focus:** Use native semantic elements (`<button>`, `<nav>`, `<main>`), accurate ARIA roles/states (`aria-current="page"`, `role="switch"`, `aria-checked`, `aria-live="polite"`), and clear `focus-visible` indicators for keyboard/PC users.
- **60/120 FPS Auto-Scroll:** Implement auto-scroll using `requestAnimationFrame` with `deltaTime` (never `setInterval`). Apply scroll offsets imperatively via a DOM `ref` rather than React state updates per frame to avoid unnecessary re-renders.
- **Stage Mode & Wake Lock:** Keep the screen awake during active song viewing / Stage Mode via `src/services/platform.ts` (native Wake Lock plugin on mobile, Web Wake Lock API where available).
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
