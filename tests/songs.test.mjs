/**
 * Testy zpěvníku — spuštění: node --test
 *
 * Testuje se čistá logika (assets/lib.js), konzistence dat (data/songs.js)
 * a provázání HTML ↔ JS ↔ CSS, aby chyba nešla na GitHub Pages.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const SONGS = require(join(ROOT, 'data', 'songs.js'));
const lib = require(join(ROOT, 'assets', 'lib.js'));

/* ---------- Logika ---------- */

test('normalize zvládne diakritiku, velikost písmen i mezery', () => {
  assert.equal(lib.normalize('Příliš žluťoučký kůň'), 'prilis zlutoucky kun');
  assert.equal(lib.normalize('  Vysoký   JALOVEC '), 'vysoky jalovec');
  assert.equal(lib.normalize(null), '');
  assert.equal(lib.normalize(undefined), '');
});

test('slugify vytvoří bezpečný slug', () => {
  assert.equal(lib.slugify('Vysoký jalovec'), 'vysoky-jalovec');
  assert.equal(lib.slugify('Nedaleko od Trenčína'), 'nedaleko-od-trencina');
  assert.equal(lib.slugify('  Kdyby byla Morava! '), 'kdyby-byla-morava');
  assert.match(lib.slugify('Vinečko bílé'), lib.SLUG_PATTERN);
});

test('parseStanzas dělí sloky podle prázdných řádků', () => {
  assert.deepEqual(lib.parseStanzas('první řádek\n druhý řádek\n\n\n třetí sloka\n\n'), [
    ['první řádek', 'druhý řádek'],
    ['třetí sloka'],
  ]);
  assert.deepEqual(lib.parseStanzas('jen jedna sloka'), [['jen jedna sloka']]);
});

test('parseStanzas zvládne prázdný text i Windows konce řádků', () => {
  assert.deepEqual(lib.parseStanzas(''), []);
  assert.deepEqual(lib.parseStanzas('   \n\n  '), []);
  assert.deepEqual(lib.parseStanzas('a\r\nb\r\n\r\nc'), [['a', 'b'], ['c']]);
});

test('hasText pozná píseň bez textu', () => {
  assert.equal(lib.hasText({ text: 'Nějaký text' }), true);
  assert.equal(lib.hasText({ text: '   \n\n ' }), false);
  assert.equal(lib.hasText({}), false);
});

/* ---------- Data ---------- */

test('data: každá píseň má povinné údaje', () => {
  assert.ok(Array.isArray(SONGS), 'data/songs.js musí exportovat pole');
  assert.ok(SONGS.length > 0, 'zpěvník nesmí být prázdný');

  SONGS.forEach((song) => {
    assert.match(song.slug, lib.SLUG_PATTERN, 'neplatný slug: ' + song.slug);
    assert.ok(
      typeof song.title === 'string' && song.title.trim().length > 0,
      'píseň bez názvu: ' + song.slug
    );
    assert.equal(typeof song.text, 'string', 'text musí být řetězec: ' + song.title);
    assert.ok(Array.isArray(song.tags), 'tagy musí být pole: ' + song.title);

    song.tags.forEach((tag) => {
      assert.ok(typeof tag === 'string' && tag.trim().length > 0, 'prázdný štítek: ' + song.title);
    });
  });
});

test('data: slug odpovídá názvu písně', () => {
  SONGS.forEach((song) => {
    assert.equal(song.slug, lib.slugify(song.title), 'slug u "' + song.title + '" nesedí s názvem');
  });
});

test('data: slugy jsou unikátní', () => {
  const slugs = SONGS.map((song) => song.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'dvě písně mají stejný slug');
});

test('data: v textech nejsou zbytky akordů', () => {
  SONGS.forEach((song) => {
    assert.ok(
      !/[\[\]]/.test(song.text),
      'v textu "' + song.title + '" zůstaly hranaté závorky — akordy do zpěvníku nepatří'
    );
  });
});

test('data: texty neobsahují Windows konce řádků', () => {
  SONGS.forEach((song) => {
    assert.ok(!song.text.includes('\r'), 'text "' + song.title + '" obsahuje \\r');
  });
});

/* ---------- Soubory ---------- */

const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');
const APP_JS = readFileSync(join(ROOT, 'assets', 'app.js'), 'utf8');
const CSS = readFileSync(join(ROOT, 'assets', 'styles.css'), 'utf8');

test('index.html odkazuje jen na existující soubory', () => {
  const refs = Array.from(HTML.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)).map((match) => match[1]);

  assert.ok(refs.length > 0, 'v index.html nejsou žádné relativní odkazy');
  refs.forEach((ref) => {
    assert.ok(existsSync(join(ROOT, ref)), 'chybí soubor ' + ref);
  });
});

test('manifest odkazuje na existující ikony', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));

  assert.equal(manifest.lang, 'cs');
  assert.ok(manifest.icons.length >= 2, 'manifest potřebuje aspoň dvě ikony');
  manifest.icons.forEach((icon) => {
    assert.ok(existsSync(join(ROOT, icon.src)), 'chybí ikona ' + icon.src);
  });
});

test('barvy v manifestu odpovídají světlému zpěvníku', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));

  assert.equal(manifest.theme_color, '#fbf7f0');
  assert.equal(manifest.background_color, '#fbf7f0');
  assert.ok(
    HTML.includes('name="theme-color" content="#fbf7f0"'),
    'theme-color v index.html nesedí s manifestem'
  );
  assert.ok(HTML.includes('content="light"'), 'color-scheme má být jen světlý');
});


test('service worker precachuje jen existující soubory', () => {
  const source = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const urls = Array.from(source.matchAll(/'(\.\/[^']*)'/g)).map((match) => match[1]);

  assert.ok(urls.length > 5, 'seznam precachovaných souborů je podezřele krátký');
  urls.forEach((url) => {
    const target = url === './' ? 'index.html' : url.slice(2);
    assert.ok(existsSync(join(ROOT, target)), 'service worker odkazuje na chybějící ' + url);
  });
});

test('app.js hledá jen ID, která v HTML existují', () => {
  const ids = Array.from(APP_JS.matchAll(/\$\('#([a-z0-9-]+)'\)/g)).map((match) => match[1]);

  assert.ok(ids.length > 3, 'v app.js je podezřele málo selektorů');
  ids.forEach((id) => {
    assert.ok(HTML.includes('id="' + id + '"'), 'v index.html chybí id="' + id + '"');
  });
});

test('třídy vytvářené v app.js mají styly v CSS', () => {
  const classes = Array.from(APP_JS.matchAll(/className = '([a-z0-9 -]+)'/g)).flatMap((match) =>
    match[1].split(' ')
  );

  const unique = Array.from(new Set(classes)).filter(Boolean);
  assert.ok(unique.length > 3, 'v app.js je podezřele málo tříd');

  unique.forEach((name) => {
    assert.ok(CSS.includes('.' + name), 'v CSS chybí styl pro .' + name);
  });
});

test('HTML nepoužívá zkratky, které kazí zoom', () => {
  assert.ok(!HTML.includes('user-scalable=no'), 'zoom na mobilu musí zůstat povolený');
  assert.ok(!HTML.includes('maximum-scale=1'), 'zoom na mobilu musí zůstat povolený');
});

test('zpěvník zůstává jen světlý', () => {
  assert.ok(!CSS.includes('prefers-color-scheme: dark'), 'tmavý režim byl odstraněn, nemá se vracet');
  assert.ok(!APP_JS.includes('theme'), 'app.js nemá řešit téma');
  assert.ok(!HTML.includes('theme-toggle'), 'v HTML nemá být přepínač tématu');
});

