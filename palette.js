import { scoreItem } from './fuzzy.js';
import { CHROME_PAGES } from './settings.js';

const params = new URLSearchParams(location.search);
const MODE = params.get('mode') === 'popup' ? 'popup' : 'frame';
const ORIGIN_TAB_ID = Number(params.get('tab')) || null;
const IS_MAC = /mac/i.test(navigator.userAgentData?.platform || navigator.platform);
const SELF_PREFIX = chrome.runtime.getURL('');
const MAX_RESULTS = 60;

document.documentElement.dataset.mode = MODE;

const SCOPES = [
  { id: 'all', label: 'All' },
  { id: 'tab', label: 'Tabs' },
  { id: 'bookmark', label: 'Bookmarks' },
  { id: 'history', label: 'History' },
  { id: 'setting', label: 'Settings' },
];
const KIND_LABEL = { tab: 'Tab', bookmark: 'Bookmark', history: 'History', setting: 'Setting', search: 'Web' };

const state = {
  query: '',
  scope: 'all',
  items: { tab: [], bookmark: [], history: [], setting: [] },
  results: [],
  selected: 0,
  originTab: null,
};

const $q = document.getElementById('q');
const $results = document.getElementById('results');
const $scopes = document.getElementById('scopes');
const $footer = document.getElementById('footer');

// ---------- helpers ----------

function displayUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return url;
    return (u.host.replace(/^www\./, '') + u.pathname + u.search + u.hash).replace(/\/$/, '');
  } catch {
    return url || '';
  }
}

function faviconUrl(pageUrl) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl);
  u.searchParams.set('size', '32');
  return u.toString();
}

function normalizeUrl(url) {
  return (url || '').replace(/#.*$/, '').replace(/\/$/, '');
}

function close() {
  if (MODE === 'popup') window.close();
  else parent.postMessage('seek:close', '*');
}

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
    displayUrl: p.url,
    keywords: p.keywords,
  }));
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

function emptyQueryResults() {
  const byRecent = (key) => (a, b) => b[key] - a[key];
  switch (state.scope) {
    case 'tab':
      return [...state.items.tab].sort(byRecent('lastAccessed'));
    case 'bookmark':
      return [...state.items.bookmark].sort(byRecent('dateAdded'));
    case 'history':
      return state.items.history; // already newest first
    case 'setting':
      return state.items.setting;
    default: {
      const tabs = [...state.items.tab].sort(byRecent('lastAccessed'));
      const open = new Set(tabs.map((t) => normalizeUrl(t.url)));
      const recent = state.items.history.filter((h) => !open.has(normalizeUrl(h.url))).slice(0, 10);
      return [...tabs, ...recent];
    }
  }
}

function rank({ keepSelection = false } = {}) {
  const prevKey = keepSelection ? state.results[state.selected]?.item.key : null;
  const raw = state.query.trim();
  const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
  let results;

  if (!tokens.length) {
    results = emptyQueryResults().slice(0, MAX_RESULTS).map((item) => ({ item, hl: null }));
  } else {
    const pools = state.scope === 'all' ? ['tab', 'bookmark', 'setting', 'history'] : [state.scope];
    const now = Date.now();
    const scored = [];
    for (const type of pools) {
      for (const item of state.items[type]) {
        const m = scoreItem(tokens, item);
        if (m) scored.push({ item, hl: m.titlePositions, urlHl: m.urlPositions, score: m.score + boost(item, now) });
      }
    }
    scored.sort((a, b) => b.score - a.score);

    // In "All", show each URL once (the tab beats the bookmark beats history).
    if (state.scope === 'all') {
      const seen = new Set();
      results = [];
      for (const r of scored) {
        const u = normalizeUrl(r.item.url);
        if (seen.has(u)) continue;
        seen.add(u);
        results.push(r);
        if (results.length >= MAX_RESULTS) break;
      }
      results.push({ item: { type: 'search', key: 'search', title: `Search the web for “${raw}”`, displayUrl: '' }, hl: null });
    } else {
      results = scored.slice(0, MAX_RESULTS);
    }
  }

  state.results = results;
  const keep = prevKey ? results.findIndex((r) => r.item.key === prevKey) : -1;
  state.selected = keep >= 0 ? keep : 0;
  renderResults();
}

// ---------- rendering ----------

const GEAR_SVG =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm7.4 5.1 1.6 1.2-1.8 3.1-1.9-.7a7.5 7.5 0 0 1-2 1.1l-.3 2h-3.6l-.3-2a7.5 7.5 0 0 1-2-1.1l-1.9.7L3 14.8l1.6-1.2a7.6 7.6 0 0 1 0-2.3L3 10.1 4.8 7l1.9.7a7.5 7.5 0 0 1 2-1.1l.3-2h3.6l.3 2a7.5 7.5 0 0 1 2 1.1l1.9-.7 1.8 3.1-1.6 1.2a7.6 7.6 0 0 1 0 2.3Z"/></svg>';
const SEARCH_SVG =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function iconFor(item) {
  if (item.type === 'setting') return svgEl(GEAR_SVG);
  if (item.type === 'search') return svgEl(SEARCH_SVG);
  const img = document.createElement('img');
  img.className = 'icon';
  img.alt = '';
  img.loading = 'lazy';
  img.src = faviconUrl(item.url);
  return img;
}

function svgEl(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup; // static markup only, never page data
  return t.content.firstElementChild;
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
    li.textContent = state.query.trim()
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
  $scopes.replaceChildren(
    ...SCOPES.map((s) => {
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

function renderFooter() {
  const mod = IS_MAC ? '⌘' : 'Ctrl';
  const hints = [
    [['↑', '↓'], 'Move'],
    [['↵'], 'Open'],
    [[mod, '↵'], 'Open here'],
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
  const item = r.item;
  const origin = state.originTab;

  try {
    if (item.type === 'tab') {
      await chrome.tabs.update(item.tabId, { active: true });
      await chrome.windows.update(item.windowId, { focused: true });
    } else if (item.type === 'search') {
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
  close();
}

// ---------- events ----------

$q.addEventListener('input', () => {
  state.query = $q.value;
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
    close();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const i = SCOPES.findIndex((s) => s.id === state.scope);
    const next = (i + (e.shiftKey ? -1 : 1) + SCOPES.length) % SCOPES.length;
    setScope(SCOPES[next].id);
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
window.addEventListener('focus', () => $q.focus());

// ---------- start ----------

renderScopes();
renderFooter();
loadSettings();
$q.focus();

if (ORIGIN_TAB_ID) chrome.tabs.get(ORIGIN_TAB_ID).then((t) => (state.originTab = t)).catch(() => {});

// Tabs first so the list appears instantly; bookmarks and history fill in after.
loadTabs().then(() => rank());
Promise.all([loadBookmarks(), loadHistory()])
  .catch((err) => console.error('Seek:', err))
  .then(() => rank({ keepSelection: true }));
