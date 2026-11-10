/**
 * Čistá logika zpěvníku — žádný DOM, žádné závislosti.
 * V prohlížeči je dostupná jako globální `ZpevnikLib`, v Node jako `module.exports`.
 */

const ZpevnikLib = (function () {
  'use strict';

  /** Povolený tvar slugu: malá písmena/číslice, části oddělené pomlčkou. */
  const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  /** Diakritika, která zůstane po rozkladu na NFD. */
  const DIACRITICS = /[\u0300-\u036f]/g;

  /**
   * Zbaví text diakritiky, sjednotí velikost písmen a mezery.
   * Díky tomu hledání "hradce" najde "Hradce" i "HRÁDCE".
   * @param {unknown} value
   * @returns {string}
   */
  function normalize(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(DIACRITICS, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Vytvoří slug z názvu písně ("Vysoký jalovec" → "vysoky-jalovec").
   * @param {string} title
   * @returns {string}
   */
  function slugify(title) {
    return normalize(title)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Rozdělí text písně na sloky a jejich řádky.
   * O jednu i víc prázdných řádků odděluje sloky.
   * @param {string} text
   * @returns {string[][]} pole slok, každá sloka je pole řádků
   */
  function parseStanzas(text) {
    return String(text == null ? '' : text)
      .replace(/\r\n?/g, '\n')
      .split(/\n[ \t]*\n/)
      .map(function (block) {
        return block
          .split('\n')
          .map(function (line) {
            return line.trim();
          })
          .filter(Boolean);
      })
      .filter(function (lines) {
        return lines.length > 0;
      });
  }

  /**
   * Vrátí true, pokud píseň obsahuje aspoň jeden řádek textu.
   * @param {{text?: string}} song
   * @returns {boolean}
   */
  function hasText(song) {
    return parseStanzas(song && song.text).length > 0;
  }

  /**
   * Text, ve kterém se hledá (název, autor, štítky i text písně).
   * @param {object} song
   * @returns {string}
   */
  function searchableText(song) {
    const tags = (song && song.tags) || [];
    return normalize([song && song.title, song && song.author, tags.join(' '), song && song.text].join(' '));
  }

  /**
   * Odpovídá píseň hledanému výrazu? Všechna slova musí sedět (AND).
   * @param {object} song
   * @param {string} query
   * @returns {boolean}
   */
  function matches(song, query) {
    const needle = normalize(query);
    if (!needle) {
      return true;
    }
    const haystack = searchableText(song);
    return needle.split(' ').every(function (term) {
      return haystack.indexOf(term) !== -1;
    });
  }

  /**
   * Vyfiltruje písně podle hledaného výrazu a štítku.
   * @param {object[]} songs
   * @param {{query?: string, tag?: string}} [options]
   * @returns {object[]}
   */
  function filterSongs(songs, options) {
    const opts = options || {};
    const query = opts.query || '';
    const tag = opts.tag || '';
    return (songs || []).filter(function (song) {
      if (tag) {
        const songTags = song.tags || [];
        if (songTags.indexOf(tag) === -1) {
          return false;
        }
      }
      return matches(song, query);
    });
  }

  /**
   * Všechny štítky bez duplikátů, seřazené česky.
   * @param {object[]} songs
   * @returns {string[]}
   */
  function collectTags(songs) {
    const seen = Object.create(null);
    const tags = [];
    (songs || []).forEach(function (song) {
      (song.tags || []).forEach(function (tag) {
        if (!tag || seen[tag]) {
          return;
        }
        seen[tag] = true;
        tags.push(tag);
      });
    });
    return tags.sort(function (a, b) {
      return a.localeCompare(b, 'cs');
    });
  }

  const songPluralRules = new Intl.PluralRules('cs');

  /**
   * České skloňování počtu písní: 1 píseň, 3 písně, 7 písní.
   * @param {number} count
   * @returns {string}
   */
  function formatSongCount(count) {
    const number = Number(count) || 0;
    const form = songPluralRules.select(number);
    const word = form === 'one' ? 'píseň' : form === 'few' ? 'písně' : 'písní';
    return number + ' ' + word;
  }

  return {
    SLUG_PATTERN: SLUG_PATTERN,
    normalize: normalize,
    slugify: slugify,
    parseStanzas: parseStanzas,
    hasText: hasText,
    searchableText: searchableText,
    matches: matches,
    filterSongs: filterSongs,
    collectTags: collectTags,
    formatSongCount: formatSongCount,
  };
})();

// Umožní použít logiku i v Node (testy), v prohlížeči je ZpevnikLib globální.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZpevnikLib;
}
