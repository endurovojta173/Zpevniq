# AGENTS.md – Instrukce pro AI vývojové agenty

Tento dokument definuje architektonická pravidla, konvence a omezení pro práci na projektu multiplatformního zpěvníku postaveného na **Capacitoru** (iOS, Android, Web/PC).

## 1. Architektonické zásady (Neporušovat)

- **Offline-first:** Veškerá hlavní funkcionalita (čtení, vyhledávání v uložených písních, transpozice, auto-scroll, editace) musí fungovat 100 % offline.
- **Žádný server-side scraping:** Scraping a parsování externích webů se smí provádět **výhradně na klientovi** (nativní mobilní platforma přes `CapacitorHttp`). Nikdy nevytvářej backend proxy endpointy pro stahování cizích textů.
- **Platformní abstrakce:** Kód v UI komponentách nesmí přímo volat nativní Capacitor API ani SQLite dotazy. Vždy používej abstrakční vrstvy (`src/db/repository.ts`, `src/services/*`) a hlídej platformu přes `Capacitor.isNativePlatform()`.
- **Web/PC degradace:** Na webu (`!Capacitor.isNativePlatform()`) musí být funkce klientského scrapingu korektně skryté nebo nahrazené výzvou k importu souboru / synchronizaci z mobilu (kvůli CORS). Aplikace na webu nesmí padat na chybějících nativních pluginech.

## 2. Datový formát (ChordPro)

- Interním a jediným ukládaným formátem písní je **ChordPro** (akordy inline v hranatých závorkách, např. `[Am]Text písně`).
- Metadata ukládej jak v DB sloupcích (pro indexaci/vyhledávání), tak v direktivách ChordPro (`{title: ...}`, `{artist: ...}`, `{key: ...}`, `{capo: ...}`).
- Transpozice musí podporovat českou i mezinárodní notaci akordů (`H`/`B` vs. `B`/`Bb`) a správné enharmonické záměny.

## 3. Pravidla pro Scraper adaptéry (`src/services/scrapers/`)

Při přidávání nebo opravě parseru pro externí zdroj dodržuj toto oddělení:

1. Každý zdroj implementuje rozhraní `SongProvider` (`search(query)`, `fetchSong(url)`).
2. **Odděl HTTP od parsování:**
   - Síťový požadavek vždy posílej přes `CapacitorHttp.get()` (nikdy přes standardní prohlížečový `fetch()`, který podléhá CORS).
   - Samotné parsování HTML na `Song` objekt (ChordPro) napiš jako **čistou funkci** (`parseSearchHtml(html: string)`, `parseSongHtml(html: string)`).
3. **Konverze formátu:** Pokud zdrojový web zobrazuje akordy na samostatném řádku nad textem (tzv. *chords-over-lyrics*), použij centrální převodník v `src/core/chordpro/converter.ts` pro převod na inline ChordPro.
4. **Testování bez chráněného obsahu:** Do testovacích fixtures (`__fixtures__/`) nikdy neukládej skutečné autorsky chráněné texty. Používej anonymizované/syntetické HTML šablony se shodnou DOM strukturou a fiktivním textem (nebo lidové písně / public domain).

## 4. Databázová vrstva (`src/db/`)

- Veškeré operace procházejí přes `SongRepository`.
- Změny schématu vyžadují verzovanou migraci v obou adaptérech (`sqlite.adapter.ts` i `web.adapter.ts`).
- Fulltextové vyhledávání řeš na mobilu přes SQLite **FTS5**, na webu přes indexy v IndexedDB (ignoruj diakritiku a velikost písmen – ukládej normalizovaný sloupec `search_text`).

## 5. UI, UX a výkon ve WebView

- **Auto-scroll:** Pro plynulý běh ve WebView (60/120 FPS) používej `requestAnimationFrame` s časovou deltou (`deltaTime`), nikoliv `setInterval`.
- **Safe Areas:** Vždy respektuj iOS/Android výřezy a gesta (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`).
- **Hardwarové pedály:** Ovládání pedálem (Bluetooth/USB) implementuj jako globální listener na standardní `KeyboardEvent` (`PageUp`, `PageDown`, `ArrowUp`, `ArrowDown`, `Space`), protože většina hudebních pedálů emuluje HID klávesnici.

## 6. Monetizace a Feature Flags (`src/services/billing/`)

- Placené funkce (Pro) kontroluj výhradně přes centrální hook/službu `useEntitlements()` (napojenou na RevenueCat).
- Nikdy nepodmiňuj samotné zobrazení nebo import textů předplatným – za paywallem jsou pouze pokročilé nástroje (cloud sync, kapelní mód, PDF export, pedály, pokročilý auto-scroll).

## 7. Konvence kódu a ověření před dokončením úkolu

- **Jazyk kódu:** Identifikátory, komentáře v kódu a commit zprávy piš anglicky. UI texty drž v lokalizačních souborech (`src/i18n/cs.json`).
- **TypeScript:** Přísný režim (`strict: true`), zákaz používání `any`.
- Před odevzdáním jakékoliv změny spusť a ověř:
  1. `npm run typecheck` – nulové TS chyby.
  2. `npm run test` – všechny unit testy (zejména ChordPro a scraper parsery) musí projít.
  3. `npm run build` – čistý produkční build pro Web i Capacitor.