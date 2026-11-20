# Zpěvník

Multiplatformní offline-first aplikace pro hudebníky (Android, iOS, Web/PC). Funguje jako chytrá čtečka, správce a editor písní ve formátu **ChordPro** s podporou lokálního vyhledávání na externích zdrojích přímo ze zařízení uživatele.

## Klíčové vlastnosti

### Základní funkce (Zdarma)
- **Offline databáze:** Lokální úložiště písní s rychlým fulltextovým vyhledáváním.
- **ChordPro parser & renderer:** Automatická transpozice akordů, zobrazení hmatů, nastavitelná velikost písma.
- **Klientské vyhledávání (mobil):** Stahování a parsování písní přímo na zařízení přes modulární adaptéry (bez prostředního serveru).
- **Import/Export:** Podpora importu vlastních `.txt` a `.cho` (ChordPro) souborů.

### Prémiové funkce (Monetizace – nástroje)
- **Auto-scroll & Stage Mode:** Plynulé automatické posouvání textu a tmavý režim pro pódium.
- **Podpora hardwaru:** Ovládání otáčení/scrollování přes Bluetooth a USB nožní pedály.
- **Cloud Sync (PC ↔ Mobil):** Synchronizace vlastní knihovny a playlistů mezi zařízením a webovým editorem.
- **Kapelní mód:** Real-time synchronizace aktuálně zobrazené písně přes Wi-Fi / WebSockets.
- **Export do PDF:** Generování tisknutelných zpěvníků a playlistů.

## Tech Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Mobilní wrapper:** Capacitor (iOS & Android)
- **Klientský HTTP (bez CORS):** `CapacitorHttp` (`@capacitor/core`) + `cheerio` / `DOMParser`
- **Lokální databáze:** `@capacitor-community/sqlite` (iOS/Android) + IndexedDB / `Dexie.js` (Web fallback)
- **Formát písní:** ChordPro (`chordsheetjs` nebo vlastní parser)
- **Backend & Sync:** Supabase (Auth, PostgreSQL, Realtime)
- **Platby:** RevenueCat (`@revenuecat/purchases-capacitor`) + Stripe (Web)
- **Testy:** Vitest (unit testy pro parsery a transpozici)

## Architektura: Mobil vs. PC (Web)

| Funkce | Android & iOS (Capacitor) | PC (Web / PWA) |
| :--- | :--- | :--- |
| **Úložiště** | Nativní SQLite | IndexedDB (sync ze Supabase) |
| **Klientský scraping** | Aktivní (`CapacitorHttp` obchází CORS) | Vypnuto (omezení prohlížeče CORS) |
| **Primární role** | Hraní v terénu, vyhledávání, offline zpěvník | Pohodlný editor, správa playlistů, tisk |

## Struktura projektu

```text
src/
├── core/
│   ├── chordpro/        # Parser, transpozice, validace ChordPro
│   └── types/           # Sdílené TypeScript modely (Song, Playlist, Chord)
├── db/
│   ├── repository.ts    # Jednotné rozhraní pro práci s DB
│   ├── sqlite.adapter.ts# Implementace pro iOS/Android
│   └── web.adapter.ts   # Implementace pro prohlížeč (IndexedDB)
├── services/
│   ├── scrapers/        # Modulární adaptéry pro externí weby
│   │   ├── provider.interface.ts
│   │   └── registry.ts
│   ├── sync/            # Supabase synchronizace & kapelní mód
│   └── billing/         # RevenueCat / stav předplatného
├── components/          # UI komponenty (SongView, ChordDiagram, PedalListener)
└── pages/               # Obrazovky aplikace
```

## Spuštění a vývoj

```bash
# Instalace závislostí
npm install

# Lokální vývoj pro PC/Web
npm run dev

# Build webové aplikace a synchronizace do nativních projektů
npm run build
npx cap sync

# Otevření v nativních IDE
npx cap open android
npx cap open ios

# Spuštění testů (parsery, transpozice)
npm run test
```

## Právní a architektonický princip

Aplikace **nehostuje žádnou veřejnou databázi autorsky chráněných textů**. Veškerý scraping běží lokálně na straně klienta jako specializovaný prohlížeč/čtečka. Cloudové úložiště (Supabase) slouží výhradně pro soukromou zálohu uživatelských dat a synchronizaci mezi vlastními zařízeními. Monetizace je vázána výhradně na pokročilé softwarové funkce.