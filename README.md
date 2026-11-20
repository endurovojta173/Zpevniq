# Zpevniq

A cross-platform, offline-first songbook application for musicians (**Android**, **iOS**, **Web/PC**). It acts as a smart reader, manager, and editor for songs in **ChordPro** format, featuring local client-side search across external song sources directly from the user's mobile device.

## Key Features

### Core Features (Free)
- **Offline-First Database:** Local song storage with fast, diacritic- and case-insensitive full-text search.
- **ChordPro Engine:** Automatic chord transposition (Czech `H`/`B` and International `B`/`Bb` notation), chord diagrams, and adjustable typography.
- **Client-Side Search (Mobile):** Fetches and parses songs directly on the device via modular adapters with no intermediary backend server.
- **Import / Export:** Native support for importing and exporting `.txt` and `.cho` (ChordPro) files.

### Premium Features (Pro Tools)
- **Auto-Scroll & Stage Mode:** Smooth 60/120 FPS auto-scrolling, high-contrast dark stage theme, and automatic screen wake lock.
- **Hardware Pedal Support:** Hands-free scrolling and page turns via Bluetooth and USB foot pedals (HID keyboard emulation).
- **Cloud Sync (PC ↔ Mobile):** Private, offline-resilient synchronization of your song library and playlists across devices.
- **Band Mode:** Low-latency, real-time synchronization of the active song, key, and scroll state across bandmates over Wi-Fi / WebSockets.
- **PDF Export:** Printable songbooks and setlists generated from your library.

## Tech Stack

- **Frontend:** React + TypeScript (`strict`) + Vite + Tailwind CSS
- **Mobile Runtime:** Capacitor (iOS & Android)
- **Client-Side HTTP & HTML Parsing:** `CapacitorHttp` (`@capacitor/core`) + native WebView `DOMParser` (zero extra parser bundle overhead)
- **Local Storage:** `@capacitor-community/sqlite` with FTS5 (iOS/Android) + IndexedDB via `Dexie.js` (Web/PWA)
- **Song Format:** ChordPro (isolated behind an internal pure-TS facade in `src/core/chordpro/`)
- **Backend & Sync:** Supabase (Auth, PostgreSQL with Row-Level Security, Realtime Broadcast)
- **Billing & Entitlements:** RevenueCat (`@revenuecat/purchases-capacitor` + Web Billing / Stripe) with local offline caching
- **Testing:** Vitest (unit tests for pure core/parsers + shared repository contract tests)

## Architecture: Mobile vs. PC (Web)

| Capability | Android & iOS (Capacitor) | PC (Web / PWA) |
| :--- | :--- | :--- |
| **Local Storage** | Native SQLite + FTS5 | IndexedDB via Dexie.js |
| **Client-Side Scraping** | Enabled (`CapacitorHttp` bypasses CORS) | Disabled (browser CORS; prompts file import or cloud sync) |
| **Stage & Hardware** | Wake Lock, Safe Areas, BT/USB Pedals | Web Wake Lock (where supported), Keyboard/USB Pedals |
| **Primary Role** | Live performance, discovery, offline songbook | Comfortable editing, setlist management, PDF printing |

### Key Architectural Decisions
- **Pure Core (`src/core/`):** ChordPro parsing, transposition, and chords-over-lyrics conversion are written in framework-agnostic TypeScript with zero React, DOM, or Capacitor dependencies.
- **Single Source of Truth for Song Data:** `chordpro_content` is the canonical song representation. Indexed database columns (`title`, `artist`, `key`, `capo`, `search_text`) are automatically derived projections maintained by `SongRepository` on every write.
- **Sync-Ready Offline Schema:** All entities use client-generated UUIDs, `updated_at` timestamps, and `deleted_at` tombstones (soft deletes) to support simple, reliable Last-Write-Wins (LWW) synchronization with Supabase.
- **Capability-Driven Platform Abstraction:** Platform checks live centrally in `src/services/platform.ts`; UI components query semantic capabilities (e.g., `platform.canScrape`) instead of calling Capacitor APIs directly.

## Project Structure

```text
src/
├── core/
│   ├── chordpro/        # Pure TS parser, transposer, converter, and serializer
│   ├── types/           # Shared domain models (Song, Playlist, Chord, Entitlements)
│   └── utils/           # Pure helpers (e.g., diacritic-insensitive normalization)
├── db/
│   ├── schema.ts        # Shared schema version, sync fields, and projection helpers
│   ├── repository.ts    # Unified SongRepository & PlaylistRepository
│   ├── sqlite.adapter.ts# Native SQLite + FTS5 storage driver (iOS/Android)
│   └── web.adapter.ts   # IndexedDB / Dexie.js storage driver (Web/PWA)
├── services/
│   ├── platform.ts      # Centralized platform & capability abstraction
│   ├── scrapers/        # Modular client-side adapters for external sources
│   │   ├── http.ts      # Shared CapacitorHttp client (timeouts, headers, typed errors)
│   │   ├── provider.interface.ts
│   │   ├── registry.ts
│   │   └── providers/   # Site-specific parsers and copyright-safe __fixtures__/
│   ├── sync/            # Supabase offline LWW sync & Realtime Broadcast band mode
│   └── billing/         # Unified Entitlements service (RevenueCat + offline grace cache)
├── i18n/                # Localization files (cs.json, en.json)
├── hooks/               # Reusable React hooks (useEntitlements, useAutoScroll, usePedalControls)
├── components/          # Thin, presentational UI components (SongView, ChordDiagram)
└── pages/               # Route-level screens
```

## Getting Started

```bash
# Install dependencies
npm install

# Start local Web/PC development server
npm run dev

# Run typechecking and unit tests
npm run typecheck
npm run test

# Build production web bundle and sync with native Capacitor projects
npm run build
npx cap sync

# Open native IDEs
npx cap open android
npx cap open ios
```

## Legal & Architectural Principles

This application **does not host any public database of copyrighted lyrics or tabs**. All external song lookups execute locally on the user's device, acting as a specialized reader/browser. Cloud storage (Supabase) is protected by strict Row-Level Security (RLS) and is used solely for private user backups and cross-device synchronization of the user's own library. Monetization applies exclusively to advanced productivity and stage tools—never to song content itself.

> For AI coding agents and contributors, see [AGENTS.md](./AGENTS.md) for strict architectural invariants, coding standards, and verification rules.
