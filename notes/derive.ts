// Title, preview and search text derived from a note's ProseMirror JSON, and
// list dates. Pure functions, so the tests and the list can use them without
// loading the editor.

export type PMNode = { type: string; text?: string; content?: PMNode[]; attrs?: Record<string, unknown> };

export const UNTITLED = 'New note';
const PREVIEW_CHARS = 200;

/** Text of one block, inline content joined without separators. */
function inlineText(node: PMNode): string {
  if (node.text) return node.text;
  if (node.type === 'hardBreak') return ' ';
  return (node.content || []).map(inlineText).join('');
}

/** Text of every textblock, one per line (lists, quotes and tables flattened). */
export function blocks(doc: PMNode): string[] {
  const out: string[] = [];
  const walk = (n: PMNode) => {
    if (n.type === 'paragraph' || n.type === 'heading' || n.type === 'codeBlock') out.push(inlineText(n));
    else (n.content || []).forEach(walk);
  };
  walk(doc);
  return out;
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * The first non-empty block is the title; the rest is the body, which the
 * preview shortens and search reads.
 */
export function derive(doc: PMNode): { title: string; preview: string; body: string; empty: boolean } {
  const lines = blocks(doc).map(squash).filter(Boolean);
  const body = lines.slice(1).join('\n');
  return {
    title: lines[0] || UNTITLED,
    preview: body.replace(/\n/g, ' ').slice(0, PREVIEW_CHARS),
    body,
    empty: !lines.length,
  };
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const dtf = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Just now", "2 minutes ago", "3 hours ago" within a day, then "12 Jul 2024". */
export function formatDate(ts: number, now = Date.now()): string {
  const s = Math.round((now - ts) / 1000);
  if (s < 45) return 'Just now';
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return dtf.format(ts);
}
