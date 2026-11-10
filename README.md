# Zpěvník na hody 2026

Statický zpěvník lidových a hodových písní — texty na mobil, žádné akordy, žádný build.

**Živě:** <https://endurovojta173.github.io/Zpevniq/>

## Co to umí

- prostý seznam písní — klepnutím se otevře text
- odkaz na konkrétní píseň přes `#/pisen/<slug>` (dá se sdílet)
- tři velikosti písma — volba se pamatuje
- **funguje offline** (PWA): jednou načíst a přidat si zpěvník na plochu
- tisk / PDF: každá píseň na vlastní stránce

Záměrně tam **není** vyhledávání ani tmavý režim — u ohně chceš otevřít seznam
a klepnout, ne lovit v inputu. Kdyby to někdy chybělo, dá se to doplnit.


## Struktura

```
index.html              kostra stránky (seznam + detail písně)
assets/styles.css       styly, mobil-first, tmavý režim, tisk
assets/lib.js           čistá logika (slugy, dělení na sloky) — testovatelná
assets/app.js           chování stránky (routing, vykreslování, nastavení)
data/songs.js           texty písní — jediné, co běžně upravuješ
icons/                  ikony pro PWA (generuje tools/generate-icons.mjs)
manifest.webmanifest    PWA manifest
sw.js                   service worker pro offline režim
tests/songs.test.mjs    testy (node --test)
tools/generate-icons.mjs generátor ikon bez závislostí
```

Žádné `npm install`, žádný bundler, žádné CDN. Stránka má do 40 kB i s ikonami.

## Přidání nebo úprava písně

Všechno je v **`data/songs.js`**. Zkopíruj šablonu z konce souboru a vyplň:

```js
{
  slug: 'jmena-pisne',          // malá písmena bez diakritiky, pomlčky místo mezer
  title: 'Jméno písně',
  text: `
První řádek první sloky,
druhý řádek první sloky.

První řádek druhé sloky.
`,
},
```

Pravidla, která hlídají testy:

- `slug` musí odpovídat názvu (`slugify(title)`), jinak test spadne
- prázdný řádek odděluje sloky, řádky uvnitř sloky se zalamují podle šířky displeje
- **žádné akordy** — hranaté závorky v textu test odmítne
- pořadí v poli = pořadí ve zpěvníku

## Lokální spuštění

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

Nebo stačí otevřít `index.html` v prohlížeči (offline režim se v tom případě nespustí,
protože service worker potřebuje http/https).

## Testy

```bash
node --test
```

Kontroluje logiku (slugy, dělení na sloky), správnost dat, existenci odkazovaných
souborů a provázání HTML ↔ JS ↔ CSS.

## Ikony

```bash
node tools/generate-icons.mjs
```

Skript nakreslí PNG bez jakékoli knihovny (jen `node:zlib`). Když chceš jinou ikonu,
uprav `icons/icon.svg` a barvy/geometrii v `tools/generate-icons.mjs`.

## Nasazení na GitHub Pages

1. Repozitář musí být **public** a jmenovat se `Zpevniq`.
2. Pushni `main`větev.
3. V repozitáři: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**.
4. Za chvíli běží na `https://endurovojta173.github.io/Zpevniq/`.

Všechny cesty jsou relativní (`./assets/...`), takže zpěvník funguje i v podadresáři.
Soubor `.nojekyll` vypíná zpracování přes Jekyll.

### Aktualizace obsahu

Po úpravě písní **zvedni verzi cache** v `sw.js`:

```js
const CACHE_VERSION = 'zpevnik-v1';  // → 'zpevnik-v2'
```

Bez toho si prohlížeč, který už zpěvník navštívil, může držet starou verzi.

## Autorská práva

Publikované texty musí být volné. Lidové písně volné jsou, moderní trampské a folkové
písně obvykle **ne** (chráněné 70 let po smrti autora). Texty, které sem přidáš, musíš
mít právo zveřejnit — repozitář je veřejný.
