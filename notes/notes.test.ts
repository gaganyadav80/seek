import 'fake-indexeddb/auto';
import { test, assert } from 'vitest';
import { derive, formatDate, UNTITLED, type PMNode } from './derive';
import { search, snippet } from './search';
import { save, listMeta, getDoc, getTexts, softDelete, restore, purge, type Meta } from './db';

const p = (text: string): PMNode => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const h1 = (text: string): PMNode => ({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text }] });
const doc = (...content: PMNode[]): PMNode => ({ type: 'doc', content });

test('title is the first non-empty block, preview the rest without markup', () => {
  const d = doc(
    p(''),
    h1('Improve zsh time'),
    { type: 'paragraph', content: [{ type: 'text', text: 'It was ' }, { type: 'text', text: 'nvm', marks: [{ type: 'code' }] } as PMNode, { type: 'text', text: '  taking up' }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [p('one')] }] },
    { type: 'codeBlock', content: [{ type: 'text', text: 'zmodload\n  zsh/zprof' }] },
  );
  const r = derive(d);
  assert.strictEqual(r.title, 'Improve zsh time');
  assert.strictEqual(r.preview, 'It was nvm taking up one zmodload zsh/zprof');
  assert.strictEqual(r.body, 'It was nvm taking up\none\nzmodload zsh/zprof');
  assert.strictEqual(r.empty, false);
});

test('an empty note is untitled and empty; preview is truncated', () => {
  assert.deepEqual(derive(doc(p(''), p('  '))), { title: UNTITLED, preview: '', body: '', empty: true });
  assert.strictEqual(derive(doc(p('t'), p('x'.repeat(500)))).preview.length, 200);
});

test('dates are relative within a day, then "12 Jul 2024"', () => {
  const now = Date.UTC(2024, 6, 14, 12);
  assert.strictEqual(formatDate(now - 10_000, now), 'Just now');
  assert.strictEqual(formatDate(now - 2 * 60_000, now), '2 minutes ago');
  assert.strictEqual(formatDate(now - 3 * 3600_000, now), '3 hours ago');
  assert.strictEqual(formatDate(Date.UTC(2024, 6, 12, 12), now), '12 Jul 2024');
});

const meta = (id: string, title: string, updatedAt: number): Meta => ({ id, title, preview: '', createdAt: 0, updatedAt, deletedAt: null });

test('search: case-insensitive, title hits first, snippet starts near the match', () => {
  const metas = [meta('a', 'Sundar’s Advice', 3), meta('b', 'Improve zsh time', 1), meta('c', 'Groceries', 2)];
  const texts = new Map([
    ['a', 'Be kind 1. Stay curious 2. Keep learning 3. Continuous improvement 4. Problems'],
    ['b', 'TLDR lazy load nvm'],
    ['c', 'milk eggs'],
  ]);
  const hits = search('IMPROVE', metas, texts);
  assert.deepEqual(hits.map((h) => h.meta.id), ['b', 'a']);
  assert.deepEqual(hits[0].titleHl, [[0, 7]]);
  const body = hits[1];
  assert.ok(body.snippet.startsWith('… '), body.snippet);
  const [s, e] = body.snippetHl[0];
  assert.strictEqual(body.snippet.slice(s, e).toLowerCase(), 'improve');
  assert.deepEqual(search('  ', metas, texts), []);
  assert.deepEqual(search('nothing', metas, texts), []);
});

test('snippet keeps short leading text whole and marks every match', () => {
  const r = snippet('improve and improve', 'improve');
  assert.strictEqual(r.snippet, 'improve and improve');
  assert.deepEqual(r.hl, [[0, 7], [12, 19]]);
});

test('save, bin, restore, delete permanently, and empty notes are removed', async () => {
  const m = await save('n1', doc(h1('Books to read'), p('Stealing fire')), 100);
  assert.strictEqual(m?.title, 'Books to read');
  assert.strictEqual(m?.createdAt, 100);
  assert.deepEqual(await getDoc('n1'), doc(h1('Books to read'), p('Stealing fire')));
  assert.strictEqual((await getTexts()).get('n1'), 'Stealing fire');

  await softDelete('n1');
  assert.ok((await listMeta())[0].deletedAt);
  // Editing elsewhere keeps it in the Bin, and createdAt sticks.
  const again = await save('n1', doc(h1('Books to read!')), 999);
  assert.ok(again?.deletedAt);
  assert.strictEqual(again?.createdAt, 100);

  await restore('n1');
  assert.strictEqual((await listMeta())[0].deletedAt, null);

  await purge('n1');
  assert.deepEqual(await listMeta(), []);
  assert.strictEqual(await getDoc('n1'), undefined);
  assert.strictEqual((await getTexts()).size, 0);

  // A note cleared to nothing disappears instead of lingering as "New note".
  await save('n2', doc(p('draft')), 1);
  assert.strictEqual(await save('n2', doc(p('')), 1), null);
  assert.deepEqual(await listMeta(), []);
});
