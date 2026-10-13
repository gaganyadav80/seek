// Case-insensitive search over note titles and bodies, with the snippet and
// highlight ranges the results list shows.

import type { Meta } from './db';

export type Range = [start: number, end: number];
export type Hit = { meta: Meta; titleHl: Range[]; snippet: string; snippetHl: Range[] };

const LEAD = 30; // characters of context kept before a body match

function ranges(text: string, q: string): Range[] {
  const out: Range[] = [];
  const hay = text.toLowerCase();
  for (let i = hay.indexOf(q); i !== -1; i = hay.indexOf(q, i + q.length)) out.push([i, i + q.length]);
  return out;
}

/** Body text around the first match, starting at a word with a leading "… ". */
export function snippet(text: string, q: string): { snippet: string; hl: Range[] } {
  const flat = text.replace(/\s+/g, ' ');
  const at = flat.toLowerCase().indexOf(q);
  if (at === -1) return { snippet: flat, hl: [] };
  let start = Math.max(0, at - LEAD);
  if (start > 0) {
    const space = flat.indexOf(' ', start);
    start = space !== -1 && space < at ? space + 1 : start;
  }
  const out = (start > 0 ? '… ' : '') + flat.slice(start);
  return { snippet: out, hl: ranges(out, q) };
}

/**
 * Notes whose title or body contains the query. Title matches come first,
 * then body matches, each newest first. `texts` maps id to body text without
 * the title line.
 */
export function search(query: string, metas: Meta[], texts: Map<string, string>): Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const title: Hit[] = [];
  const body: Hit[] = [];
  for (const meta of metas) {
    const titleHl = ranges(meta.title, q);
    const text = texts.get(meta.id) ?? meta.preview;
    const inBody = text.toLowerCase().includes(q);
    if (!titleHl.length && !inBody) continue;
    const s = inBody ? snippet(text, q) : { snippet: meta.preview, hl: [] };
    (titleHl.length ? title : body).push({ meta, titleHl, snippet: s.snippet, snippetHl: s.hl });
  }
  const byDate = (a: Hit, b: Hit) => b.meta.updatedAt - a.meta.updatedAt;
  return [...title.sort(byDate), ...body.sort(byDate)];
}
