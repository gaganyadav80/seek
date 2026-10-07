// Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreItem, siteFor } from './fuzzy.js';
import { SITES, validateSite, shortcutKeys, sitesUpdate, isNewTab, displayUrl } from './settings.js';
import { dominantColor, pillColors, contrast } from './color.js';

const mdn = { title: 'MDN Web Docs', displayUrl: 'developer.mozilla.org' };
const gh = { title: 'flutter/flutter: Flutter makes apps', displayUrl: 'github.com/flutter/flutter' };

test('highlights each token in the line it matched better', () => {
  const title = scoreItem(['docs'], mdn);
  assert.deepEqual([...title.titlePositions], [8, 9, 10, 11]);
  assert.equal(title.urlPositions.size, 0);

  const url = scoreItem(['mozilla'], mdn);
  assert.equal(url.titlePositions.size, 0);
  assert.deepEqual([...url.urlPositions], [10, 11, 12, 13, 14, 15, 16]);

  const mixed = scoreItem(['gh', 'flutter'], gh);
  assert.ok(mixed.urlPositions.has(0), 'gh lands on github.com');
  assert.ok(mixed.titlePositions.has(0), 'flutter lands on the title');
});

test('site search triggers on a shortcut or a name prefix, one word only', () => {
  assert.equal(siteFor('yt', SITES)?.name, 'YouTube');
  assert.equal(siteFor('YouT ', SITES)?.name, 'YouTube');
  assert.equal(siteFor('gh', SITES)?.name, 'GitHub');
  assert.equal(siteFor('y', SITES), null, 'one letter only counts as an exact shortcut');
  assert.equal(siteFor('gh flutter', SITES), null, 'multi-word queries stay a normal search');
});

test('site color comes from the most common saturated hue, white text stays readable', () => {
  const px = (rgba, n) => Array.from({ length: n }, () => rgba).flat();
  const youtube = px([255, 0, 0, 255], 40).concat(px([255, 255, 255, 255], 20), px([0, 0, 0, 0], 40));
  assert.deepEqual(dominantColor(youtube), [255, 0, 0]);
  assert.equal(dominantColor(px([20, 20, 20, 255], 50).concat(px([250, 250, 250, 255], 50))), null, 'black-and-white icon');

  const red = pillColors([255, 0, 0]);
  assert.ok(red.lightText && contrast(red.bg, [250, 250, 250]) >= 4.5, 'red darkens slightly for white text');
  assert.equal(pillColors([255, 214, 0]).lightText, false, 'yellow gets dark text');
});

test('site entries from settings are checked before saving', () => {
  const ok = validateSite({ name: ' npm ', keyword: 'NPM', url: 'https://www.npmjs.com/search?q=%s' }, SITES);
  assert.deepEqual(ok.errors, {});
  assert.deepEqual(ok.site, { name: 'npm', keyword: 'npm', url: 'https://www.npmjs.com/search?q=%s' });

  const errorsFor = (entry, editing) => Object.keys(validateSite(entry, SITES, editing).errors).sort();
  assert.deepEqual(errorsFor({ name: '', keyword: 'two words', url: 'https://x.com/?q=' }), ['keyword', 'name', 'url']);
  assert.deepEqual(errorsFor({ name: 'Y', keyword: 'yt', url: 'https://y.com/?q=%s' }), ['keyword'], 'shortcut taken');
  assert.deepEqual(errorsFor({ name: 'Y', keyword: 'yt', url: 'https://y.com/?q=%s' }, 0), [], 'editing keeps its own shortcut');
  assert.deepEqual(errorsFor({ name: 'X', keyword: 'x', url: 'javascript:alert(%s)' }), ['url'], 'web addresses only');
});

test('shortcuts split into keys on Mac and elsewhere', () => {
  assert.deepEqual(shortcutKeys('⇧⌘K'), ['⇧', '⌘', 'K']);
  assert.deepEqual(shortcutKeys('Ctrl+Shift+K'), ['Ctrl', 'Shift', 'K']);
  assert.deepEqual(shortcutKeys(''), []);
});

test('web search choice follows its site through renames and deletes', () => {
  const prefs = { sites: SITES, webSearch: 'g' };
  const renamed = SITES.map((s) => (s.keyword === 'g' ? { ...s, keyword: 'goo' } : s));
  assert.deepEqual(sitesUpdate(prefs, renamed, { g: 'goo' }), { sites: renamed, webSearch: 'goo' });
  const without = SITES.filter((s) => s.keyword !== 'g');
  assert.equal(sitesUpdate(prefs, without).webSearch, '', 'deleted engine falls back to Chrome default');
  assert.ok(!('webSearch' in sitesUpdate(prefs, SITES.slice(0, 3))), 'unrelated change leaves it alone');
});

test('new tab pages are recognised across browsers, other pages are not', () => {
  for (const url of ['chrome://newtab/', 'brave://newtab', 'edge://newtab/', 'chrome://new-tab-page/']) assert.ok(isNewTab(url), url);
  for (const url of ['chrome://settings', 'https://newtab.example.com/', 'chrome-extension://x/palette.html?mode=page', '', undefined]) {
    assert.ok(!isNewTab(url), String(url));
  }
});

test('shows URLs without the scheme, and never the browser\'s name', () => {
  assert.equal(displayUrl('https://www.github.com/flutter/flutter/'), 'github.com/flutter/flutter');
  assert.equal(displayUrl('chrome://settings/privacy'), 'settings/privacy');
  assert.equal(displayUrl('brave://rewards/'), 'rewards/');
  assert.equal(displayUrl('file:///Users/me/notes.html'), 'file:///Users/me/notes.html');
  assert.equal(displayUrl('about:blank'), 'about:blank');
  assert.equal(displayUrl(undefined), '');
});

test('marks whole-word matches as exact and scattered letters as loose', () => {
  assert.equal(scoreItem(['stack'], { title: 'Stack Overflow', displayUrl: 'stackoverflow.com' }).exact, true);
  assert.equal(scoreItem(['stack'], { title: 'Approximate string matching - Wikipedia', displayUrl: 'en.wikipedia.org/wiki/Approximate_string_matching' }).exact, false);
  assert.equal(scoreItem(['gh', 'flutter'], gh).exact, false, 'gh only as letters of github');
  assert.equal(scoreItem(['git', 'flutter'], gh).exact, true);
});
