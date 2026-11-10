/**
 * Zpěvník — chování stránky.
 * Bez závislostí, bez buildu. Logika je v lib.js, data v data/songs.js.
 */

(function () {
  'use strict';

  const STORAGE_THEME = 'zpevnik:theme';
  const STORAGE_FONT = 'zpevnik:font';
  const FONT_SIZES = ['small', 'medium', 'large'];
  const DEFAULT_FONT = 'medium';
  const THEME_COLORS = { light: '#fbf7f0', dark: '#141110' };
  const TITLE = 'Zpěvník';

  const $ = function (selector) {
    return document.querySelector(selector);
  };

  const el = {
    viewList: $('#view-list'),
    viewSong: $('#view-song'),
    list: $('#song-list'),
    empty: $('#empty'),
    count: $('#count'),
    search: $('#q'),
    tags: $('#tags'),
    themeToggle: $('#theme-toggle'),
    skipLink: $('.skip-link'),
    main: $('#main'),
    songTitle: $('#song-title'),
    songMeta: $('#song-meta'),
    songText: $('#song-text'),
    fontButtons: Array.prototype.slice.call(document.querySelectorAll('[data-font-size]')),
  };

  const state = {
    query: '',
    tag: '',
    font: readStorage(STORAGE_FONT, DEFAULT_FONT),
  };

  let firstRoute = true;

  /* ------------------------------------------------------------------ *
   * Úložiště nastavení
   * ------------------------------------------------------------------ */

  function readStorage(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      /* soukromý režim nebo plný disk — nastavení prostě nepřežije obnovení */
    }
  }

  /* ------------------------------------------------------------------ *
   * Světlý / tmavý režim
   * ------------------------------------------------------------------ */

  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function currentTheme() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', THEME_COLORS[next]);
    }

    const label = next === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim';
    el.themeToggle.setAttribute('aria-label', label);
    el.themeToggle.setAttribute('title', label);

    if (persist) {
      writeStorage(STORAGE_THEME, next);
    }
  }

  function toggleTheme() {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
  }

  /* ------------------------------------------------------------------ *
   * Velikost písma
   * ------------------------------------------------------------------ */

  function applyFont(size, persist) {
    const next = FONT_SIZES.indexOf(size) === -1 ? DEFAULT_FONT : size;
    state.font = next;
    document.documentElement.dataset.font = next;

    el.fontButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.fontSize === next));
    });

    if (persist) {
      writeStorage(STORAGE_FONT, next);
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

  function songHref(song) {
    return '#/pisen/' + song.slug;
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
    link.href = songHref(song);

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
    const total = songs().length;
    const visible = ZpevnikLib.filterSongs(songs(), { query: state.query, tag: state.tag });

    el.list.replaceChildren.apply(el.list, visible.map(createSongItem));

    el.count.textContent = visible.length === total && !state.query && !state.tag
      ? ZpevnikLib.formatSongCount(total)
      : 'Nalezeno: ' + ZpevnikLib.formatSongCount(visible.length);

    const isFiltered = Boolean(state.query || state.tag);
    el.empty.hidden = visible.length > 0;
    el.empty.textContent = isFiltered
      ? 'Nic jsme nenašli. Zkus jiné slovo nebo zruš filtr.'
      : 'Zpěvník je zatím prázdný.';
  }

  function renderTags() {
    const tags = ZpevnikLib.collectTags(songs());
    el.tags.replaceChildren();

    // Jeden štítek nemá cenu filtrovat — lišta se schová.
    if (tags.length < 2) {
      el.tags.hidden = true;
      return;
    }

    el.tags.hidden = false;
    el.tags.appendChild(createTagButton('Vše', ''));
    tags.forEach(function (tag) {
      el.tags.appendChild(createTagButton(tag, tag));
    });
  }

  function createTagButton(label, tag) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tag';
    button.textContent = label;
    button.dataset.tag = tag;
    button.setAttribute('aria-pressed', String(state.tag === tag));
    button.addEventListener('click', function () {
      state.tag = tag;
      renderTags();
      renderList();
    });
    return button;
  }

  /* ------------------------------------------------------------------ *
   * Vykreslení jedné písně
   * ------------------------------------------------------------------ */

  const listHeading = $('#list-heading');

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

    if (focusHeading && listHeading) {
      listHeading.focus({ preventScroll: true });
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
    el.search.addEventListener('input', function () {
      state.query = el.search.value;
      renderList();
    });

    el.search.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && el.search.value) {
        event.preventDefault();
        el.search.value = '';
        state.query = '';
        renderList();
      }
    });

    el.themeToggle.addEventListener('click', toggleTheme);

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

    // Bez ruční volby tématu se držíme systémového nastavení.
    const onSystemThemeChange = function () {
      if (!readStorage(STORAGE_THEME, '')) {
        applyTheme(darkModeQuery.matches ? 'dark' : 'light', false);
      }
    };

    if (typeof darkModeQuery.addEventListener === 'function') {
      darkModeQuery.addEventListener('change', onSystemThemeChange);
    } else if (typeof darkModeQuery.addListener === 'function') {
      darkModeQuery.addListener(onSystemThemeChange);
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
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', false);
    applyFont(state.font, false);
    renderTags();
    renderList();
    renderRoute();
    wireEvents();
    registerServiceWorker();
  }

  init();
})();


