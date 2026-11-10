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
   * Zbaví text diakritiky a sjednotí mezery i velikost písmen.
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
   * Jeden i víc prázdných řádků odděluje sloky.
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

  return {
    SLUG_PATTERN: SLUG_PATTERN,
    normalize: normalize,
    slugify: slugify,
    parseStanzas: parseStanzas,
    hasText: hasText,
  };
})();

// Umožní použít logiku i v Node (testy), v prohlížeči je ZpevnikLib globální.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZpevnikLib;
}
