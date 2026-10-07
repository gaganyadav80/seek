// Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreItem } from './fuzzy.js';

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
