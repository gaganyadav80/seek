// Chrome settings pages and internal pages. `keywords` are extra words the
// fuzzy search matches against, so "wifi" or "cache" still finds the right page.
export const CHROME_PAGES = [
  ['Settings', 'chrome://settings', 'preferences options'],
  ['Autofill and passwords', 'chrome://settings/autofill', 'forms'],
  ['Password manager', 'chrome://password-manager/passwords', 'passwords logins credentials'],
  ['Payment methods', 'chrome://settings/payments', 'credit card cards'],
  ['Addresses', 'chrome://settings/addresses', 'autofill address'],
  ['Privacy and security', 'chrome://settings/privacy', 'tracking'],
  ['Clear browsing data', 'chrome://settings/clearBrowserData', 'cache cookies delete history clear'],
  ['Third-party cookies', 'chrome://settings/cookies', 'cookies tracking'],
  ['Site settings', 'chrome://settings/content', 'permissions sites'],
  ['Notifications', 'chrome://settings/content/notifications', 'site permissions push'],
  ['Location', 'chrome://settings/content/location', 'site permissions gps'],
  ['Camera', 'chrome://settings/content/camera', 'site permissions webcam'],
  ['Microphone', 'chrome://settings/content/microphone', 'site permissions mic audio'],
  ['Pop-ups and redirects', 'chrome://settings/content/popups', 'site permissions popup'],
  ['JavaScript', 'chrome://settings/content/javascript', 'site permissions js'],
  ['Security', 'chrome://settings/security', 'safe browsing https dns'],
  ['Performance', 'chrome://settings/performance', 'memory saver energy battery'],
  ['Appearance', 'chrome://settings/appearance', 'theme font zoom dark mode bookmarks bar'],
  ['Search engine', 'chrome://settings/search', 'google default search'],
  ['Manage search engines', 'chrome://settings/searchEngines', 'site search shortcuts keywords'],
  ['Default browser', 'chrome://settings/defaultBrowser', 'default'],
  ['On startup', 'chrome://settings/onStartup', 'startup pages restore'],
  ['Languages', 'chrome://settings/languages', 'translate spell check'],
  ['Downloads settings', 'chrome://settings/downloads', 'download location folder'],
  ['Accessibility', 'chrome://settings/accessibility', 'captions a11y'],
  ['System', 'chrome://settings/system', 'proxy hardware acceleration background'],
  ['Reset settings', 'chrome://settings/reset', 'restore defaults'],
  ['You and Google', 'chrome://settings/people', 'profile account sync'],
  ['Sync', 'chrome://settings/syncSetup', 'google account'],
  ['About this browser', 'chrome://settings/help', 'update version chrome brave edge'],
  ['Extensions', 'chrome://extensions', 'addons plugins'],
  ['Extension keyboard shortcuts', 'chrome://extensions/shortcuts', 'hotkeys keybindings commands'],
  ['Downloads', 'chrome://downloads', 'files'],
  ['History', 'chrome://history', 'visited'],
  ['Bookmark manager', 'chrome://bookmarks', 'favorites organize'],
  ['Experiments (flags)', 'chrome://flags', 'flags experimental features'],
  ['Version info', 'chrome://version', 'about build'],
  ['GPU info', 'chrome://gpu', 'graphics webgl'],
  ['Inspect devices', 'chrome://inspect', 'devtools remote debugging'],
].map(([title, url, keywords]) => ({ title, url, keywords }));

// Default site search entries, like chrome://settings/searchEngines (extensions
// can't read Chrome's own list). People edit theirs in Seek settings. Type a
// shortcut, or 2+ letters of a name, then press Tab to search that site.
// %s is replaced by the query.
export const SITES = [
  ['YouTube', 'yt', 'https://www.youtube.com/results?search_query=%s'],
  ['Google', 'g', 'https://www.google.com/search?q=%s'],
  ['GitHub', 'gh', 'https://github.com/search?q=%s'],
  ['Wikipedia', 'w', 'https://en.wikipedia.org/wiki/Special:Search?search=%s'],
  ['Google Maps', 'maps', 'https://www.google.com/maps/search/%s'],
  ['Reddit', 'r', 'https://www.reddit.com/search/?q=%s'],
  ['MDN', 'mdn', 'https://developer.mozilla.org/en-US/search?q=%s'],
].map(([name, keyword, url]) => ({ name, keyword, url }));

// ---------- saved preferences (settings page and palette) ----------

// ponytail: sites live in one synced item (8 KB), ~70 entries; split per site if people hit it.
export const DEFAULT_PREFS = {
  theme: 'dark',
  sites: SITES,
  sources: { tab: true, bookmark: true, history: true, setting: true }, // what the palette reads
  enterOpens: 'new', // 'new' tab, or 'current' tab (⌘↵ does the other)
  webSearch: '', // keyword of a site to search the web with; '' = Chrome's default engine
};

/** Saved preferences, falling back to the defaults. */
export function loadPrefs() {
  return chrome.storage.sync.get(DEFAULT_PREFS).catch(() => DEFAULT_PREFS);
}

/** Sets data-theme on <html> to light or dark; 'system' follows the OS. */
export function applyTheme(mode) {
  const light = mode === 'light' || (mode === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
}

/**
 * Applies the theme, then keeps `prefs` and the theme current while the page
 * is open: saved changes (from the settings page or another device) and OS
 * light/dark switches. `onChange(changes)` runs after a saved change.
 */
export function watchPrefs(prefs, onChange = () => {}) {
  const apply = () => applyTheme(prefs.theme);
  apply();
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', apply);
  chrome.storage.sync.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key in DEFAULT_PREFS) prefs[key] = newValue ?? DEFAULT_PREFS[key];
    }
    apply();
    onChange(changes);
  });
}

/** Checks a site search entry from the settings form. Returns { site, errors }; no errors means valid. */
export function validateSite({ name = '', keyword = '', url = '' }, sites, editing = -1) {
  const site = { name: name.trim(), keyword: keyword.trim().toLowerCase(), url: url.trim() };
  const errors = {};
  if (!site.name) errors.name = 'Add a name.';
  if (!site.keyword) errors.keyword = 'Add a shortcut.';
  else if (/\s/.test(site.keyword)) errors.keyword = 'Use one word, no spaces.';
  else if (sites.some((s, i) => i !== editing && s.keyword === site.keyword)) {
    errors.keyword = `“${site.keyword}” is already used.`;
  }
  let parsed = null;
  try { parsed = new URL(site.url.replace('%s', 'seek')); } catch {}
  if (!site.url) errors.url = 'Add a search URL.';
  else if (!/^https?:$/.test(parsed?.protocol)) errors.url = 'Enter a web address starting with https://';
  else if (!site.url.includes('%s')) errors.url = 'Put %s where the search text goes.';
  return { site, errors };
}

/**
 * Storage update for a new site list. The web search choice follows a renamed
 * shortcut (`renamed` maps old keyword to new) and falls back to Chrome's
 * default if its site is gone.
 */
export function sitesUpdate(prefs, next, renamed = {}) {
  const patch = { sites: next };
  const engine = renamed[prefs.webSearch] ?? prefs.webSearch;
  const kept = next.some((s) => s.keyword === engine) ? engine : '';
  if (kept !== prefs.webSearch) patch.webSearch = kept;
  return patch;
}

/** Splits a Chrome command shortcut ("⇧⌘K" on Mac, "Ctrl+Shift+K" elsewhere) into keys. */
export function shortcutKeys(shortcut) {
  if (!shortcut) return [];
  if (shortcut.includes('+')) return shortcut.split('+');
  const [, mods, key] = shortcut.match(/^([⌃⌥⇧⌘]*)(.*)$/);
  return [...mods, key].filter(Boolean);
}

/** Chrome's cached favicon for a page. Works from extension pages only. */
export function faviconUrl(pageUrl) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl);
  u.searchParams.set('size', '32');
  return u.toString();
}
