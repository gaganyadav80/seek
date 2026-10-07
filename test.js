// Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreItem, siteFor } from './fuzzy.js';
import { SITES } from './settings.js';
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
