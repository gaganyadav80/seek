import { scoreItem, siteFor } from './fuzzy.js';
import { dominantColor, pillColors } from './color.js';
import { CHROME_PAGES, loadPrefs, watchPrefs, faviconUrl, isNewTab, displayUrl } from './settings.js';

const params = new URLSearchParams(location.search);
// frame: overlay on a page; popup: toolbar dropdown; page: Seek as a whole new tab
const MODE = ['popup', 'page'].includes(params.get('mode')) ? params.get('mode') : 'frame';
const ORIGIN_TAB_ID = Number(params.get('tab')) || null;
// Settings shows Seek as a live preview; it must not take focus from the settings page.
const PREVIEW = params.has('preview');
const IS_MAC = /mac/i.test(navigator.userAgentData?.platform || navigator.platform);
const SELF_PREFIX = chrome.runtime.getURL('');
const MAX_RESULTS = 60;

document.documentElement.dataset.mode = MODE;
if (MODE === 'page') {
  // Icon and fallback title come from palette.html; use the real new tab's title if it had one.
  chrome.storage.session.get('newTabTitle').then(({ newTabTitle }) => newTabTitle && (document.title = newTabTitle));
}
const prefs = await loadPrefs();
watchPrefs(prefs, (changes) => {
  if (changes.sites) updateHint();
  if (changes.sources) loadSources();
  if (changes.enterOpens) renderFooter();
  if (changes.webSearch) rank({ keepSelection: true });
});
// Seek shows now that the theme is set. Over a web page it taps in while the
// page blurs in (the page does that part, so tell it when).
if (MODE === 'frame') {
  document.body.classList.add('opening');
  setTimeout(() => document.body.classList.remove('opening'), 300);
  parent.postMessage('seek:open', '*');
}

const SCOPES = [
  { id: 'all', label: 'All' },
  { id: 'tab', label: 'Tabs' },
  { id: 'bookmark', label: 'Bookmarks' },
  { id: 'history', label: 'History' },
  { id: 'setting', label: 'Settings' },
];
const on = (type) => prefs.sources[type] !== false; // source turned on in settings
const visibleScopes = () => SCOPES.filter((s) => s.id === 'all' || on(s.id));
const KIND_LABEL = { tab: 'Tab', bookmark: 'Bookmark', history: 'History', setting: 'Setting', search: 'Web', site: 'Site' };

const state = {
  query: '',
  scope: 'all',
  items: { tab: [], bookmark: [], history: [], setting: [] },
  results: [],
  selected: 0,
  originTab: null,
  site: null, // active site search
  typed: '', // what was typed before entering site search; ⌫ on an empty field brings it back
  hint: null, // site that Tab would switch to
};

const $q = document.getElementById('q');
const $results = document.getElementById('results');
const $scopes = document.getElementById('scopes');
const $footer = document.getElementById('footer');
const $search = $q.closest('.search');
const $chip = document.getElementById('site-chip');
const $hint = document.getElementById('site-hint');
const PLACEHOLDER = $q.placeholder;

// ---------- helpers ----------

function normalizeUrl(url) {
  return (url || '').replace(/#.*$/, '').replace(/\/$/, '');
}

function close() {
  if (MODE === 'popup') window.close();
  else if (MODE === 'page') chrome.tabs.getCurrent().then((t) => t && chrome.tabs.remove(t.id));
  else parent.postMessage('seek:close', '*');
}

// Seek opened on an empty new tab (or is Seek's own new tab page): results fill
// that tab instead of leaving a blank one behind.
const onNewTab = () => MODE === 'page' || isNewTab(state.originTab?.url || state.originTab?.pendingUrl);

// ---------- data sources ----------

async function loadTabs() {
  const tabs = await chrome.tabs.query({});
  state.items.tab = tabs
    .filter((t) => t.id !== ORIGIN_TAB_ID && !(t.url || '').startsWith(SELF_PREFIX))
    .map((t) => ({
      type: 'tab',
      key: 'tab:' + t.id,
      tabId: t.id,
      windowId: t.windowId,
      title: t.title || t.url,
      url: t.url,
      displayUrl: displayUrl(t.url),
      lastAccessed: t.lastAccessed || 0,
    }));
}

async function loadBookmarks() {
  const tree = await chrome.bookmarks.getTree();
  const out = [];
  const walk = (nodes, path) => {
    for (const n of nodes) {
      if (n.url) {
        out.push({
          type: 'bookmark',
          key: 'bm:' + n.id,
          title: n.title || displayUrl(n.url),
          url: n.url,
          displayUrl: displayUrl(n.url),
          keywords: path.join(' '), // folder names are searchable
          dateAdded: n.dateAdded || 0,
        });
      } else if (n.children) {
        walk(n.children, n.title ? [...path, n.title] : path);
      }
    }
  };
  walk(tree, []);
  state.items.bookmark = out;
}

async function loadHistory() {
  const items = await chrome.history.search({ text: '', startTime: 0, maxResults: 5000 });
  state.items.history = items
    .filter((h) => h.url && !h.url.startsWith(SELF_PREFIX))
    .map((h) => ({
      type: 'history',
      key: 'h:' + h.id,
      title: h.title || displayUrl(h.url),
      url: h.url,
      displayUrl: displayUrl(h.url),
      visitCount: h.visitCount || 0,
      lastVisitTime: h.lastVisitTime || 0,
    }));
}

function loadSettings() {
  state.items.setting = CHROME_PAGES.map((p, i) => ({
    type: 'setting',
    key: 'set:' + i,
    title: p.title,
    url: p.url,
    displayUrl: displayUrl(p.url),
    keywords: p.keywords,
  }));
  state.items.setting.unshift({
    type: 'setting',
    key: 'set:seek',
    title: 'Seek settings',
    url: chrome.runtime.getURL('options.html'),
    displayUrl: 'Theme, shortcut, site search',
    keywords: 'seek options preferences',
  });
}

// Reads only the sources turned on in settings; one that's off isn't read at all.
function loadSources() {
  for (const type in state.items) if (!on(type)) state.items[type] = [];
  renderScopes();
  if (on('setting')) loadSettings();
  // Tabs first so the list appears instantly; bookmarks and history fill in after.
  (on('tab') ? loadTabs() : Promise.resolve()).then(() => rank());
  Promise.all([on('bookmark') && loadBookmarks(), on('history') && loadHistory()])
    .catch((err) => console.error('Seek:', err))
    .then(() => rank({ keepSelection: true }));
}

// "Search the web" row: Chrome's default engine, or the site picked in settings.
function webSearchItem(text) {
  const engine = prefs.sites.find((s) => s.keyword === prefs.webSearch);
  if (!engine) return { type: 'search', key: 'search', title: `Search the web for “${text}”`, displayUrl: '' };
  const url = engine.url.replace('%s', encodeURIComponent(text));
  return { type: 'search', key: 'search', title: `Search ${engine.name} for “${text}”`, url, displayUrl: '' };
}

// ---------- ranking ----------

function boost(item, now) {
  switch (item.type) {
    case 'tab': {
      const hours = (now - item.lastAccessed) / 3.6e6;
      return 120 + Math.max(0, 40 - hours * 4);
    }
    case 'bookmark':
      return 60;
    case 'setting':
      return 40;
    case 'history': {
      const days = (now - item.lastVisitTime) / 8.64e7;
      return Math.min(Math.log2(1 + item.visitCount) * 12, 80) + Math.max(0, 30 - days);
    }
    default:
      return 0;
  }
}

function emptyQueryResults(scope, onSite) {
  const byRecent = (key) => (a, b) => b[key] - a[key];
  switch (scope) {
    case 'tab':
      return [...state.items.tab].sort(byRecent('lastAccessed'));
    case 'bookmark':
      return [...state.items.bookmark].sort(byRecent('dateAdded'));
    case 'history':
      return state.items.history; // already newest first
    case 'setting':
      return state.items.setting;
    default: {
      const tabs = state.items.tab.filter(onSite).sort(byRecent('lastAccessed'));
      const open = new Set(tabs.map((t) => normalizeUrl(t.url)));
      const recent = state.items.history.filter((h) => onSite(h) && !open.has(normalizeUrl(h.url))).slice(0, 10);
      return [...tabs, ...recent];
    }
  }
}

function rank({ keepSelection = false } = {}) {
  const prevKey = keepSelection ? state.results[state.selected]?.item.key : null;
  const raw = state.query.trim();
  const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
  // Site search runs the "All" search limited to that site's domain.
  // ponytail: host match only, so Google Maps also lists other google.com pages.
  const { site } = state;
  const scope = site ? 'all' : state.scope;
  const host = site && new URL(site.url).hostname.replace(/^www\./, '');
  const onSite = site
    ? (item) => { const h = item.displayUrl.split(/[/?#]/)[0]; return h === host || h.endsWith('.' + host); }
    : () => true;
  let results;

  if (!tokens.length) {
    results = emptyQueryResults(scope, onSite).slice(0, MAX_RESULTS).map((item) => ({ item, hl: null }));
  } else {
    const pools = scope === 'all' ? ['tab', 'bookmark', 'setting', 'history'] : [scope];
    const now = Date.now();
    const scored = [];
    for (const type of pools) {
      for (const item of state.items[type]) {
        if (!onSite(item)) continue;
        const m = scoreItem(tokens, item);
        if (m) scored.push({ item, hl: m.titlePositions, urlHl: m.urlPositions, score: m.score + boost(item, now) });
      }
    }
    scored.sort((a, b) => b.score - a.score);

    // In "All", show each URL once (the tab beats the bookmark beats history).
    if (scope === 'all') {
      const seen = new Set();
      results = [];
      for (const r of scored) {
        const u = normalizeUrl(r.item.url);
        if (seen.has(u)) continue;
        seen.add(u);
        results.push(r);
        if (results.length >= MAX_RESULTS) break;
      }
      if (!site) results.unshift({ item: webSearchItem(raw), hl: null }); // always the first row
    } else {
      results = scored.slice(0, MAX_RESULTS);
    }
  }

  if (site && raw) {
    const url = site.url.replace('%s', encodeURIComponent(raw));
    results.unshift({ item: { type: 'site', key: 'site', title: `Search ${site.name} for “${raw}”`, url, displayUrl: '' }, hl: null });
  }

  state.results = results;
  const keep = prevKey ? results.findIndex((r) => r.item.key === prevKey) : -1;
  // The web search row sits on top, but the highlight starts on the best match
  // below it, so Enter still opens that; ↑ reaches the web search.
  const first = results[0]?.item.type === 'search' && results.length > 1 ? 1 : 0;
  state.selected = keep >= 0 ? keep : first;
  renderResults();
}

// ---------- rendering ----------

// Phosphor glyphs drawn by palette.css (each style picks its weight).
function iconFor(item) {
  if (item.type === 'setting') return glyph('gear');
  if (item.type === 'search' && !item.url) return glyph('search');
  const img = document.createElement('img');
  img.className = 'icon';
  img.alt = '';
  img.loading = 'lazy';
  img.src = faviconUrl(item.url);
  return img;
}

function glyph(name) {
  const el = document.createElement('span');
  el.className = 'icon glyph ' + name;
  return el;
}

function highlighted(text, positions, className) {
  const el = document.createElement('div');
  el.className = className;
  if (!positions || !positions.size) {
    el.textContent = text;
    return el;
  }
  let buf = '';
  let inMark = false;
  const flush = () => {
    if (!buf) return;
    if (inMark) {
      const m = document.createElement('mark');
      m.textContent = buf;
      el.append(m);
    } else {
      el.append(buf);
    }
    buf = '';
  };
  for (let i = 0; i < text.length; i++) {
    const hit = positions.has(i);
    if (hit !== inMark) { flush(); inMark = hit; }
    buf += text[i];
  }
  flush();
  return el;
}

function renderRow(r, i) {
  const li = document.createElement('li');
  li.className = 'row' + (i === state.selected ? ' selected' : '');
  li.id = 'row-' + i;
  li.dataset.index = i;
  li.dataset.type = r.item.type;
  li.setAttribute('role', 'option');
  li.setAttribute('aria-selected', i === state.selected);

  const text = document.createElement('div');
  text.className = 'text';
  text.append(highlighted(r.item.title, r.hl, 'title'));
  if (r.item.displayUrl) {
    text.append(highlighted(r.item.displayUrl, r.urlHl, 'url'));
  }

  const kind = document.createElement('span');
  kind.className = 'kind';
  kind.textContent = KIND_LABEL[r.item.type];

  li.append(iconFor(r.item), text, kind);
  return li;
}

function renderResults() {
  if (!state.results.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = state.site
      ? `Type to search ${state.site.name}.`
      : state.query.trim()
      ? 'No matches. Try fewer letters or switch the filter with Tab.'
      : 'Nothing here yet.';
    $results.replaceChildren(li);
    $q.removeAttribute('aria-activedescendant');
    return;
  }
  $results.replaceChildren(...state.results.map(renderRow));
  $results.scrollTop = 0;
  $q.setAttribute('aria-activedescendant', 'row-' + state.selected);
  document.getElementById('row-' + state.selected)?.scrollIntoView({ block: 'nearest' });
}

function setSelected(i) {
  if (!state.results.length) return;
  const n = state.results.length;
  i = ((i % n) + n) % n;
  const prev = document.getElementById('row-' + state.selected);
  prev?.classList.remove('selected');
  prev?.setAttribute('aria-selected', 'false');
  state.selected = i;
  const cur = document.getElementById('row-' + i);
  cur?.classList.add('selected');
  cur?.setAttribute('aria-selected', 'true');
  cur?.scrollIntoView({ block: 'nearest' });
  $q.setAttribute('aria-activedescendant', 'row-' + i);
}

function renderScopes() {
  if (!on(state.scope)) state.scope = 'all'; // its source was turned off
  $scopes.replaceChildren(
    ...visibleScopes().map((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'scope';
      b.textContent = s.label;
      b.setAttribute('aria-pressed', s.id === state.scope);
      b.tabIndex = -1;
      b.addEventListener('click', () => setScope(s.id));
      return b;
    })
  );
}

function setScope(id) {
  state.scope = id;
  renderScopes();
  rank();
  $q.focus();
}

// Site color from its favicon (same-origin, so the canvas stays readable),
// computed when the Tab hint appears so it's ready when Tab is pressed.
const siteColors = new Map();
function siteColor(site) {
  if (!siteColors.has(site.url)) {
    siteColors.set(site.url, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
          ctx.canvas.width = ctx.canvas.height = 32;
          ctx.drawImage(img, 0, 0, 32, 32);
          resolve(dominantColor(ctx.getImageData(0, 0, 32, 32).data));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = faviconUrl(new URL(site.url).origin);
    }));
  }
  return siteColors.get(site.url);
}

// Black-and-white icons get a pill in the theme's ink color.
const neutral = () => (document.documentElement.dataset.theme === 'light' ? [39, 39, 42] : [228, 228, 231]);

function paintSite(rgb) {
  const { bg, lightText } = pillColors(rgb);
  const s = document.documentElement.style;
  s.setProperty('--site', `rgb(${rgb})`);
  s.setProperty('--site-pill', `rgb(${bg})`);
  s.setProperty('--site-ink', lightText ? '#fafafa' : '#111113'); // fixed: the pill isn't themed
}

function updateHint() {
  state.hint = state.site ? null : siteFor(state.query, prefs.sites);
  $hint.hidden = !state.hint;
  if (!state.hint) return;
  siteColor(state.hint);
  const kbd = document.createElement('kbd');
  kbd.textContent = 'Tab';
  $hint.replaceChildren(kbd, `to search ${state.hint.name}`);
}

// `text` fills the field afterwards (entering a site search empties it).
function setSite(site, text = '') {
  if (site) state.typed = state.query;
  state.site = site;
  $search.toggleAttribute('data-site', !!site);
  $chip.hidden = !site;
  $chip.textContent = site ? site.name : '';
  $q.placeholder = site ? `Search ${site.name}` : PLACEHOLDER;
  $q.value = state.query = text;
  updateHint();
  rank();

  document.body.classList.remove('site-enter', 'opening');
  if (site) siteColor(site).then((rgb) => {
    if (state.site !== site) return;
    paintSite(rgb || neutral());
    void document.body.offsetWidth; // restart the entry animation
    document.body.classList.add('site-enter');
  });
}

function renderFooter() {
  const mod = IS_MAC ? '⌘' : 'Ctrl';
  const fill = onNewTab();
  const swap = !fill && prefs.enterOpens === 'current';
  const hints = [
    [['↑', '↓'], 'Move'],
    [['↵'], swap ? 'Open here' : 'Open'],
    [[mod, '↵'], fill || swap ? 'New tab' : 'Open here'],
    [['Tab'], 'Filter'],
    [['Esc'], 'Close'],
  ];
  $footer.replaceChildren(
    ...hints.map(([keys, label]) => {
      const span = document.createElement('span');
      keys.forEach((k) => {
        const kbd = document.createElement('kbd');
        kbd.textContent = k;
        span.append(kbd);
      });
      span.append(label);
      return span;
    })
  );
}

// ---------- actions ----------

async function activate(index, { here = false } = {}) {
  const r = state.results[index];
  if (!r) return;
  const fill = onNewTab();
  // ↵ fills an empty new tab (⌘↵ opens another); elsewhere the setting can swap ↵ and ⌘↵.
  here = fill ? !here : here !== (prefs.enterOpens === 'current');
  const item = r.item;
  const origin = state.originTab;

  try {
    if (item.type === 'tab') {
      await chrome.tabs.update(item.tabId, { active: true });
      await chrome.windows.update(item.windowId, { focused: true });
      if (fill && origin && MODE !== 'page') await chrome.tabs.remove(origin.id); // close() handles 'page'
    } else if (item.type === 'search' && !item.url) {
      const text = state.query.trim();
      if (here && origin) await chrome.search.query({ text, tabId: origin.id });
      else await chrome.search.query({ text, disposition: 'NEW_TAB' });
    } else if (here && origin) {
      await chrome.tabs.update(origin.id, { url: item.url });
    } else {
      await chrome.tabs.create(
        origin
          ? { url: item.url, windowId: origin.windowId, index: origin.index + 1, openerTabId: origin.id }
          : { url: item.url }
      );
    }
  } catch (err) {
    console.error('Seek:', err);
  }
  if (MODE === 'page' && here && item.type !== 'tab') return; // this tab is going to the result
  close();
}

// ---------- events ----------

$q.addEventListener('input', () => {
  state.query = $q.value;
  updateHint();
  rank();
});

window.addEventListener('keydown', (e) => {
  const ctrlOnly = e.ctrlKey && !e.metaKey && !e.altKey;
  if (e.key === 'ArrowDown' || (ctrlOnly && (e.key === 'n' || e.key === 'j'))) {
    e.preventDefault();
    setSelected(state.selected + 1);
  } else if (e.key === 'ArrowUp' || (ctrlOnly && (e.key === 'p' || e.key === 'k'))) {
    e.preventDefault();
    setSelected(state.selected - 1);
  } else if (e.key === 'PageDown') {
    e.preventDefault();
    setSelected(Math.min(state.selected + 8, state.results.length - 1));
  } else if (e.key === 'PageUp') {
    e.preventDefault();
    setSelected(Math.max(state.selected - 8, 0));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    activate(state.selected, { here: e.metaKey || e.ctrlKey });
  } else if (e.key === 'Escape') {
    e.preventDefault();
    if (state.site) setSite(null);
    else close();
  } else if (e.key === 'Backspace' && state.site && !$q.value) {
    e.preventDefault();
    setSite(null, state.typed); // back to what was typed before Tab; Esc leaves with it cleared
  } else if (e.key === 'Tab') {
    e.preventDefault();
    if (state.hint && !e.shiftKey) return setSite(state.hint);
    if (state.site) return;
    const scopes = visibleScopes();
    const i = scopes.findIndex((s) => s.id === state.scope);
    const next = (i + (e.shiftKey ? -1 : 1) + scopes.length) % scopes.length;
    setScope(scopes[next].id);
  }
});

$results.addEventListener('mousemove', (e) => {
  const row = e.target.closest('.row');
  if (row && Number(row.dataset.index) !== state.selected) setSelected(Number(row.dataset.index));
});
$results.addEventListener('click', (e) => {
  const row = e.target.closest('.row');
  if (row) activate(Number(row.dataset.index), { here: e.metaKey || e.ctrlKey });
});
$results.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the input

document.getElementById('backdrop').addEventListener('mousedown', close);
if (!PREVIEW) window.addEventListener('focus', () => $q.focus());

// ---------- start ----------

renderFooter();
if (!PREVIEW) $q.focus();

// The tab Seek acts on: the page it was opened over, or its own tab in 'page' mode.
(MODE === 'page' ? chrome.tabs.getCurrent() : ORIGIN_TAB_ID ? chrome.tabs.get(ORIGIN_TAB_ID) : Promise.resolve())
  .then((t) => {
    state.originTab = t;
    renderFooter(); // hints depend on whether that's an empty new tab
  })
  .catch(() => {});
loadSources();
