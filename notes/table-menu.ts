// The ⋮ button on the table cell holding the caret, and its menu: align the
// column, add, move and delete rows and columns, delete the table.

import { Extension, type Editor } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import { cellAround, moveTableColumn, moveTableRow, selectedRect, isInTable, TableMap } from '@tiptap/pm/tables';
import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import dots from '@phosphor-icons/core/assets/bold/dots-three-vertical-bold.svg?raw';
import caret from '@phosphor-icons/core/assets/fill/caret-right-fill.svg?raw';

type Align = 'left' | 'center' | 'right' | null;
type Entry = { label: string; run: (e: Editor) => boolean } | 'divider' | 'align';

/** Sets text-align on every cell in the caret's column. */
function alignColumn(editor: Editor, align: Align) {
  return editor.commands.command(({ state, tr }) => {
    const rect = selectedRect(state);
    const seen = new Set<number>();
    for (let row = 0; row < rect.map.height; row++) {
      const pos = rect.tableStart + rect.map.map[row * rect.map.width + rect.left];
      if (seen.has(pos)) continue; // a cell spanning rows appears once per row
      seen.add(pos);
      const cell = tr.doc.nodeAt(pos)!;
      tr.setNodeMarkup(pos, null, { ...cell.attrs, align });
    }
    return true;
  });
}

function move(editor: Editor, axis: 'row' | 'column', by: number) {
  const { view } = editor;
  const rect = selectedRect(view.state);
  const [row, col] = [rect.top, rect.left];
  const from = axis === 'row' ? row : col;
  const to = from + by;
  if (to < 0 || to >= (axis === 'row' ? rect.map.height : rect.map.width)) return false;
  const cmd = axis === 'row' ? moveTableRow({ from, to, select: false }) : moveTableColumn({ from, to, select: false });
  if (!cmd(view.state, view.dispatch)) return false;
  // Keep the caret in the cell that moved, so the next action applies to it.
  // The table keeps its start position; only its contents moved.
  const map = TableMap.get(view.state.doc.nodeAt(rect.tableStart - 1)!);
  const pos = rect.tableStart + map.map[axis === 'row' ? to * map.width + col : row * map.width + to];
  view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos + 1))));
  return true;
}

const ENTRIES: Entry[] = [
  'align',
  'divider',
  { label: 'Add Row', run: (e) => e.commands.addRowAfter() },
  { label: 'Add Row Above', run: (e) => e.commands.addRowBefore() },
  { label: 'Add Column', run: (e) => e.commands.addColumnAfter() },
  { label: 'Add Column Before', run: (e) => e.commands.addColumnBefore() },
  'divider',
  { label: 'Move Row Up', run: (e) => move(e, 'row', -1) },
  { label: 'Move Row Down', run: (e) => move(e, 'row', 1) },
  { label: 'Move Column Left', run: (e) => move(e, 'column', -1) },
  { label: 'Move Column Right', run: (e) => move(e, 'column', 1) },
  'divider',
  { label: 'Delete Row', run: (e) => e.commands.deleteRow() },
  { label: 'Delete Column', run: (e) => e.commands.deleteColumn() },
  { label: 'Delete Table', run: (e) => e.commands.deleteTable() },
];

const ALIGNS: { label: string; value: Align }[] = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
];

const place = (anchor: Element, el: HTMLElement, placement: 'bottom-end' | 'right-start') =>
  computePosition(anchor, el, { strategy: 'fixed', placement, middleware: [offset(4), flip(), shift({ padding: 8 })] }).then(({ x, y }) =>
    Object.assign(el.style, { left: `${x}px`, top: `${y}px` }),
  );

function item(label: string, onPick: () => void) {
  const el = document.createElement('div');
  el.className = 'menu-item';
  el.setAttribute('role', 'menuitem');
  el.textContent = label;
  el.addEventListener('click', onPick);
  return el;
}

export const TableMenu = Extension.create({
  name: 'tableMenu',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        view(view) {
          // The editor's scroll container; the button scrolls with the text.
          const host = view.dom.parentElement!;
          const button = document.createElement('button');
          button.className = 'cell-menu-button';
          button.title = 'Table options';
          button.innerHTML = dots;
          button.hidden = true;
          host.append(button);

          let menu: HTMLElement | null = null;
          let sub: HTMLElement | null = null;

          function closeSub() {
            sub?.remove();
            sub = null;
          }
          function close() {
            closeSub();
            menu?.remove();
            menu = null;
            removeEventListener('mousedown', outside, true);
            removeEventListener('keydown', onKey, true);
          }
          function outside(e: MouseEvent) {
            const t = e.target as Node;
            if (!menu?.contains(t) && !sub?.contains(t) && !button.contains(t)) close();
          }
          // Capture phase, so Esc closes this menu without also leaving the note.
          function onKey(e: KeyboardEvent) {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            close();
            view.focus();
          }
          function pick(run: () => boolean) {
            close();
            run();
            view.focus();
          }

          function openSub(anchor: HTMLElement) {
            if (sub) return;
            sub = document.createElement('div');
            sub.className = 'menu table-menu';
            sub.setAttribute('role', 'menu');
            const rect = selectedRect(view.state);
            const current = view.state.doc.nodeAt(rect.tableStart + rect.map.map[rect.top * rect.map.width + rect.left])?.attrs.align ?? null;
            for (const a of ALIGNS) {
              const el = item(a.label, () => pick(() => alignColumn(editor, current === a.value ? null : a.value)));
              el.setAttribute('aria-checked', String(current === a.value));
              sub.append(el);
            }
            document.body.append(sub);
            place(anchor, sub, 'right-start');
          }

          function open() {
            menu = document.createElement('div');
            menu.className = 'menu table-menu';
            menu.setAttribute('role', 'menu');
            for (const entry of ENTRIES) {
              if (entry === 'divider') {
                menu.append(Object.assign(document.createElement('div'), { className: 'menu-divider' }));
              } else if (entry === 'align') {
                const el = item('Align Column', () => openSub(el));
                el.classList.add('has-sub');
                el.insertAdjacentHTML('beforeend', caret);
                el.addEventListener('mouseenter', () => openSub(el));
                menu.append(el);
              } else {
                const el = item(entry.label, () => pick(() => entry.run(editor)));
                el.addEventListener('mouseenter', closeSub);
                menu.append(el);
              }
            }
            document.body.append(menu);
            place(button, menu, 'bottom-end');
            addEventListener('mousedown', outside, true);
            addEventListener('keydown', onKey, true);
          }

          // mousedown, not click: keeps the editor's selection in the cell.
          button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            menu ? close() : open();
          });

          function update() {
            const { state } = view;
            const $cell = editor.isEditable && isInTable(state) ? cellAround(state.selection.$head) : null;
            const dom = $cell && (view.nodeDOM($cell.pos) as HTMLElement | null);
            button.hidden = !dom;
            if (!dom) return close();
            const cell = dom.getBoundingClientRect();
            const box = host.getBoundingClientRect();
            button.style.top = `${cell.top - box.top + host.scrollTop + cell.height / 2}px`;
            button.style.left = `${cell.right - box.left + host.scrollLeft - 6}px`;
          }

          return {
            update,
            destroy() {
              close();
              button.remove();
            },
          };
        },
      }),
    ];
  },
});
