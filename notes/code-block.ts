// Highlighted code blocks. While the caret is inside one, its Markdown fences
// show in a faint color, and the language after the opening ``` is an input:
// edit it to change the highlighting.

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { createLowlight } from 'lowlight';

export function codeBlock(lowlight: ReturnType<typeof createLowlight>) {
  return CodeBlockLowlight.extend({
    addNodeView() {
      return ({ node, getPos, editor }) => {
        const dom = document.createElement('div');
        dom.className = 'code-block';

        const top = document.createElement('div');
        top.className = 'fence';
        top.contentEditable = 'false';
        const lang = document.createElement('input');
        lang.className = 'fence-lang';
        lang.placeholder = 'language';
        lang.spellcheck = false;
        lang.value = node.attrs.language || '';
        top.append('```', lang);

        const pre = document.createElement('pre');
        const code = document.createElement('code');
        pre.append(code);

        const bottom = document.createElement('div');
        bottom.className = 'fence';
        bottom.contentEditable = 'false';
        bottom.textContent = '```';

        dom.append(top, pre, bottom);

        lang.addEventListener('input', () => {
          const pos = getPos();
          if (typeof pos !== 'number') return;
          const language = lang.value.trim().toLowerCase() || null;
          editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, null, { ...editor.state.doc.nodeAt(pos)!.attrs, language }));
        });
        // Enter, ↓ or Esc go back into the code.
        lang.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'Escape') return;
          e.preventDefault();
          e.stopPropagation();
          const pos = getPos();
          if (typeof pos === 'number') editor.chain().focus().setTextSelection(pos + 1).run();
        });

        return {
          dom,
          contentDOM: code,
          update(next) {
            if (next.type !== node.type) return false;
            node = next;
            if (document.activeElement !== lang) lang.value = next.attrs.language || '';
            return true;
          },
          // The fences are outside the editable text: ProseMirror leaves their events and DOM alone.
          stopEvent: (e) => top.contains(e.target as Node),
          ignoreMutation: (m) => m.type !== 'selection' && !code.contains(m.target),
        };
      };
    },

    addProseMirrorPlugins() {
      const name = this.name;
      return [
        ...(this.parent?.() ?? []),
        // Marks the code block holding the caret, which shows its fences.
        new Plugin({
          props: {
            decorations(state) {
              const { $head } = state.selection;
              for (let d = $head.depth; d > 0; d--) {
                if ($head.node(d).type.name === name) {
                  const pos = $head.before(d);
                  return DecorationSet.create(state.doc, [Decoration.node(pos, pos + $head.node(d).nodeSize, { class: 'is-active' })]);
                }
              }
              return null;
            },
          },
        }),
      ];
    },
  }).configure({ lowlight, defaultLanguage: null });
}
