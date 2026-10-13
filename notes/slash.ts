// The "/" menu: typing / at the start of a line or after a space lists
// formatting commands in sections. Typing filters them (fuzzy, Seek's own
// matcher); ↑/↓ moves, Enter or Tab applies, Esc closes and keeps the text.

import { Extension, type Editor, type Range } from '@tiptap/core';
import Suggestion, { exitSuggestion, type SuggestionProps } from '@tiptap/suggestion';
import { shift } from '@floating-ui/dom';
import { scoreItem } from '../fuzzy.js';

import h from '@phosphor-icons/core/assets/regular/text-h.svg?raw';
import b from '@phosphor-icons/core/assets/regular/text-b.svg?raw';
import i from '@phosphor-icons/core/assets/regular/text-italic.svg?raw';
import s from '@phosphor-icons/core/assets/regular/text-strikethrough.svg?raw';
import u from '@phosphor-icons/core/assets/regular/text-underline.svg?raw';
import code from '@phosphor-icons/core/assets/regular/code.svg?raw';
import codeBlock from '@phosphor-icons/core/assets/regular/code-block.svg?raw';
import quote from '@phosphor-icons/core/assets/regular/quotes.svg?raw';
import table from '@phosphor-icons/core/assets/regular/table.svg?raw';
import minus from '@phosphor-icons/core/assets/regular/minus.svg?raw';
import ol from '@phosphor-icons/core/assets/regular/list-numbers.svg?raw';
import ul from '@phosphor-icons/core/assets/regular/list-bullets.svg?raw';
import tasks from '@phosphor-icons/core/assets/regular/list-checks.svg?raw';

type Item = { section: string; title: string; icon: string; keywords?: string; run: (e: Editor) => unknown };

// Each command runs after the "/query" text is removed, in one chain.
const ITEMS: Item[] = [
  { section: 'Headings', title: 'Heading 1', icon: h, keywords: 'h1 title', run: (e) => e.chain().focus().setHeading({ level: 1 }).run() },
  { section: 'Headings', title: 'Heading 2', icon: h, keywords: 'h2 subtitle', run: (e) => e.chain().focus().setHeading({ level: 2 }).run() },
  { section: 'Headings', title: 'Heading 3', icon: h, keywords: 'h3', run: (e) => e.chain().focus().setHeading({ level: 3 }).run() },
  // With nothing selected these set a stored mark, so the next typed text gets it.
  { section: 'Inline', title: 'Bold', icon: b, keywords: 'strong', run: (e) => e.chain().focus().toggleBold().run() },
  { section: 'Inline', title: 'Italic', icon: i, keywords: 'emphasis', run: (e) => e.chain().focus().toggleItalic().run() },
  { section: 'Inline', title: 'Strikethrough', icon: s, keywords: 'strike', run: (e) => e.chain().focus().toggleStrike().run() },
  { section: 'Inline', title: 'Underline', icon: u, run: (e) => e.chain().focus().toggleUnderline().run() },
  { section: 'Inline', title: 'Code', icon: code, keywords: 'inline monospace', run: (e) => e.chain().focus().toggleCode().run() },
  { section: 'Blocks', title: 'Code Block', icon: codeBlock, keywords: 'snippet pre', run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { section: 'Blocks', title: 'Blockquote', icon: quote, keywords: 'quote', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { section: 'Blocks', title: 'Table', icon: table, keywords: 'grid', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { section: 'Blocks', title: 'Divider', icon: minus, keywords: 'hr rule line separator', run: (e) => e.chain().focus().setHorizontalRule().run() },
  { section: 'Lists', title: 'Ordered List', icon: ol, keywords: 'numbered ol', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { section: 'Lists', title: 'Bullet List', icon: ul, keywords: 'unordered ul', run: (e) => e.chain().focus().toggleBulletList().run() },
  { section: 'Lists', title: 'Task List', icon: tasks, keywords: 'todo checkbox check', run: (e) => e.chain().focus().toggleTaskList().run() },
];

/** Items matching the query, in menu order. */
export function filterItems(query: string): Item[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return ITEMS;
  return ITEMS.filter((it) => scoreItem(tokens, { title: it.title, displayUrl: '', keywords: it.keywords }));
}

function menu() {
  const el = document.createElement('div');
  el.className = 'menu slash';
  el.setAttribute('role', 'listbox');
  let items: Item[] = [];
  let selected = 0;
  let props: SuggestionProps<Item, Item>;

  // mousedown, not click: keeps focus (and the selection) in the editor.
  el.addEventListener('mousedown', (e) => {
    const row = (e.target as Element).closest<HTMLElement>('[data-i]');
    e.preventDefault();
    if (row) props.command(items[Number(row.dataset.i)]);
  });
  el.addEventListener('mousemove', (e) => {
    const row = (e.target as Element).closest<HTMLElement>('[data-i]');
    if (row && Number(row.dataset.i) !== selected) select(Number(row.dataset.i), false);
  });

  function select(i: number, scroll = true) {
    el.querySelector('[aria-selected="true"]')?.setAttribute('aria-selected', 'false');
    selected = (i + items.length) % items.length;
    const row = el.querySelector(`[data-i="${selected}"]`);
    row?.setAttribute('aria-selected', 'true');
    if (scroll) row?.scrollIntoView({ block: 'nearest' });
  }

  function render(p: SuggestionProps<Item, Item>) {
    props = p;
    items = p.items;
    el.hidden = !items.length;
    el.replaceChildren();
    let section = '';
    items.forEach((it, i) => {
      if (it.section !== section) {
        section = it.section;
        const label = document.createElement('div');
        label.className = 'menu-label';
        label.textContent = section;
        el.append(label);
      }
      const row = document.createElement('div');
      row.className = 'menu-item';
      row.dataset.i = String(i);
      row.setAttribute('role', 'option');
      row.innerHTML = it.icon;
      row.append(it.title);
      el.append(row);
    });
    if (items.length) select(0);
  }

  const apply = () => props.command(items[selected]);
  return { el, render, apply, move: (d: number) => select(selected + d) };
}

export const SlashMenu = Extension.create({
  name: 'slashMenu',
  addProseMirrorPlugins() {
    return [
      Suggestion<Item, Item>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: true, // "/code block"; a query with no match still closes the menu
        // Not in code blocks, where a / is usually a path.
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ query }) => filterItems(query),
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: Item }) => {
          editor.chain().focus().deleteRange(range).run();
          props.run(editor);
        },
        floatingUi: { middleware: [shift({ padding: 8 })] },
        render: () => {
          const m = menu();
          let unmount: (() => void) | undefined;
          return {
            onStart: (p) => {
              m.render(p);
              unmount = p.mount(m.el);
            },
            onUpdate: (p) => {
              m.render(p);
              // No matches closes the menu, leaving the typed text.
              if (!p.loading && !p.items.length) queueMicrotask(() => exitSuggestion(p.editor.view));
            },
            onExit: () => unmount?.(),
            onKeyDown: ({ event, view }) => {
              if (m.el.hidden) return false;
              if (event.key === 'Escape') {
                exitSuggestion(view);
                return true;
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                m.move(event.key === 'ArrowDown' ? 1 : -1);
                return true;
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                m.apply();
                return true;
              }
              return false;
            },
          };
        },
      }),
    ];
  },
});
