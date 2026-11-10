/**
 * Zpěvník — chování stránky.
 * Bez závislostí, bez buildu. Logika je v lib.js, data v data/songs.js.
 */

(function () {
  'use strict';

  const STORAGE_FONT = 'zpevnik:font';
  const FONT_SIZES = ['small', 'medium', 'large'];
  const DEFAULT_FONT = 'medium';
  const TITLE = 'Zpěvník na hody 2026';

  const $ = function (selector) {
    return document.querySelector(selector);
  };

  const el = {
    viewList: $('#view-list'),
    viewSong: $('#view-song'),
    list: $('#song-list'),
    listHeading: $('#list-heading'),
    main: $('#main'),
    skipLink: $('.skip-link'),
    songTitle: $('#song-title'),
    songMeta: $('#song-meta'),
    songText: $('#song-text'),
    fontButtons: Array.prototype.slice.call(document.querySelectorAll('[data-font-size]')),
  };

  let firstRoute = true;

  /* ------------------------------------------------------------------ *
   * Nastavení: velikost písma
   * ------------------------------------------------------------------ */

  function readFont() {
    try {
      const stored = window.localStorage.getItem(STORAGE_FONT);
      return FONT_SIZES.indexOf(stored) === -1 ? DEFAULT_FONT : stored;
    } catch (error) {
      return DEFAULT_FONT;
    }
  }

  function applyFont(size, persist) {
    const next = FONT_SIZES.indexOf(size) === -1 ? DEFAULT_FONT : size;
    document.documentElement.dataset.font = next;

    el.fontButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.fontSize === next));
    });

    if (persist) {
      try {
        window.localStorage.setItem(STORAGE_FONT, next);
      } catch (error) {
        /* soukromý režim nebo plný disk — nastavení prostě nepřežije obnovení */
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Data
   * ------------------------------------------------------------------ */

  function songs() {
    return Array.isArray(SONGS) ? SONGS : [];
  }

  function findSong(slug) {
    const list = songs();
    for (let i = 0; i < list.length; i += 1) {
      if (list[i] && list[i].slug === slug) {
        return list[i];
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * Routing: "#/" = seznam, "#/pisen/<slug>" = jedna píseň
   * ------------------------------------------------------------------ */

  function parseHash() {
    const raw = String(window.location.hash || '').replace(/^#/, '');
    const match = /^\/pisen\/([^/?#]+)$/.exec(raw);
    if (match) {
      try {
        return { name: 'song', slug: decodeURIComponent(match[1]) };
      } catch (error) {
        return { name: 'list' };
      }
    }
    return { name: 'list' };
  }

  function metaLine(song) {
    return [song.author].concat(song.tags || []).filter(Boolean).join(' · ');
  }

  /* ------------------------------------------------------------------ *
   * Vykreslení seznamu
   * ------------------------------------------------------------------ */

  function createSongItem(song) {
    const li = document.createElement('li');
    li.className = 'song-item';

    const link = document.createElement('a');
    link.className = 'song-link';
    link.href = '#/pisen/' + song.slug;

    const main = document.createElement('span');
    main.className = 'song-item-main';

    const title = document.createElement('span');
    title.className = 'song-item-title';
    title.textContent = song.title;
    main.appendChild(title);

    const meta = metaLine(song);
    if (meta) {
      const metaNode = document.createElement('span');
      metaNode.className = 'song-item-meta';
      metaNode.textContent = meta;
      main.appendChild(metaNode);
    }

    link.appendChild(main);

    if (!ZpevnikLib.hasText(song)) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'chybí text';
      link.appendChild(badge);
    }

    li.appendChild(link);
    return li;
  }

  function renderList() {
    el.list.replaceChildren.apply(el.list, songs().map(createSongItem));
  }

  /* ------------------------------------------------------------------ *
   * Vykreslení jedné písně
   * ------------------------------------------------------------------ */

  function renderLyrics(song) {
    el.songText.replaceChildren();

    const stanzas = ZpevnikLib.parseStanzas(song.text);
    if (stanzas.length === 0) {
      const note = document.createElement('p');
      note.className = 'notice';
      note.textContent = 'Text téhle písně zatím chybí.';
      el.songText.appendChild(note);
      return;
    }

    stanzas.forEach(function (lines) {
      const stanza = document.createElement('p');
      stanza.className = 'stanza';
      stanza.textContent = lines.join('\n');
      el.songText.appendChild(stanza);
    });
  }

  function showSong(song, focusHeading) {
    el.viewList.hidden = true;
    el.viewSong.hidden = false;

    el.songTitle.textContent = song.title;
    el.songMeta.textContent = metaLine(song);
    renderLyrics(song);

    document.title = song.title + ' – ' + TITLE;
    window.scrollTo(0, 0);

    if (focusHeading) {
      el.songTitle.focus({ preventScroll: true });
    }
  }

  function showMissingSong(slug) {
    el.viewList.hidden = true;
    el.viewSong.hidden = false;

    el.songTitle.textContent = 'Píseň nenalezena';
    el.songMeta.textContent = '';
    el.songText.replaceChildren();

    const note = document.createElement('p');
    note.className = 'notice';
    note.textContent = 'Píseň „' + slug + '“ ve zpěvníku není. ';
    const link = document.createElement('a');
    link.href = '#/';
    link.textContent = 'Zpět na seznam';
    note.appendChild(link);
    el.songText.appendChild(note);

    document.title = 'Píseň nenalezena – ' + TITLE;
  }

  function showList(focusHeading) {
    el.viewList.hidden = false;
    el.viewSong.hidden = true;

    document.title = TITLE;
    window.scrollTo(0, 0);

    if (focusHeading && el.listHeading) {
      el.listHeading.focus({ preventScroll: true });
    }
  }

  function renderRoute() {
    const route = parseHash();
    const focusHeading = !firstRoute;
    firstRoute = false;

    if (route.name === 'song') {
      const song = findSong(route.slug);
      if (song) {
        showSong(song, focusHeading);
      } else {
        showMissingSong(route.slug);
      }
      return;
    }

    showList(focusHeading);
  }

  /* ------------------------------------------------------------------ *
   * Události a start
   * ------------------------------------------------------------------ */

  function wireEvents() {
    el.fontButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        applyFont(button.dataset.fontSize, true);
      });
    });

    window.addEventListener('hashchange', renderRoute);

    // Skip link míří na #main, což by rozbilo hash routing — posun děláme sami.
    if (el.skipLink) {
      el.skipLink.addEventListener('click', function (event) {
        event.preventDefault();
        if (el.main) {
          el.main.focus();
          el.main.scrollIntoView({ block: 'start' });
        }
      });
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return;
    }
    // Offline režim má smysl jen na http(s), ne při otevření souboru z disku.
    if (window.location.protocol !== 'https:' && window.location.protocol !== 'http:') {
      return;
    }

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {
        /* offline režim není k dispozici, zpěvník funguje i tak */
      });
    });
  }

  function init() {
    applyFont(readFont(), false);
    renderList();
    renderRoute();
    wireEvents();
    registerServiceWorker();
  }

  init();
})();

