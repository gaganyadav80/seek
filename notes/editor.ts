// The note editor: Tiptap with live-preview Markdown (typed Markdown turns into
// formatting as you type), a "/" menu, tables and highlighted code blocks.
// Loaded with import() the first time a note opens, so the list never pays for it.

import { Editor, Extension } from '@tiptap/core';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { createLowlight } from 'lowlight';
import bash from 'highlight.js/lib/languages/bash';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import dart from 'highlight.js/lib/languages/dart';
import yaml from 'highlight.js/lib/languages/yaml';
import { SlashMenu } from './slash';
import { TableMenu } from './table-menu';
import { codeBlock } from './code-block';
import type { PMNode } from './derive';

const lowlight = createLowlight({ bash, javascript, typescript, json, python, sql, dart, yaml });
lowlight.registerAlias({ bash: ['sh', 'shell', 'zsh'], javascript: ['js'], typescript: ['ts'], python: ['py'], yaml: ['yml'] });

/** A new note starts as an empty title line. */
export const EMPTY_DOC: PMNode = { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 } }] };

// Pasted text that reads as Markdown (headings, lists, fences, quotes, tables,
// emphasis) becomes rich content. Rich HTML from web pages pastes as HTML.
const MARKDOWN = /^(#{1,6} |\s*([-*+]|\d+\.) |\s*> |```|\|.*\|)|\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)/m;
const RICH_HTML = /<(h[1-6]|ul|ol|table|pre|blockquote)\b/i;

const Keys = Extension.create({
  name: 'seekKeys',
  priority: 50, // after lists and tables, so their Tab handling wins
  addKeyboardShortcuts() {
    const e = this.editor;
    return {
      'Mod-Shift-x': () => e.commands.toggleStrike(),
      // Tab never leaves the editor: lists and tables handle it first; in a code block it indents.
      Tab: () => (e.isActive('codeBlock') ? e.commands.insertContent('  ') : true),
      'Shift-Tab': () => true,
      // Tables: rows and columns from the keyboard; outside a table these do nothing.
      'Mod-Alt-ArrowDown': () => e.commands.addRowAfter(),
      'Mod-Alt-ArrowUp': () => e.commands.addRowBefore(),
      'Mod-Alt-ArrowRight': () => e.commands.addColumnAfter(),
      'Mod-Alt-ArrowLeft': () => e.commands.addColumnBefore(),
      'Mod-Alt-Backspace': () => e.commands.deleteRow(),
      'Mod-Alt-Shift-Backspace': () => e.commands.deleteColumn(),
    };
  },
});

export function createEditor(element: HTMLElement, onChange: () => void) {
  const editor = new Editor({
    element,
    content: EMPTY_DOC,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
        link: { autolink: true, linkOnPaste: true, openOnClick: true, defaultProtocol: 'https' },
      }),
      codeBlock(lowlight),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: ({ editor: ed }) => (ed.isEmpty ? 'Title' : ''), showOnlyCurrent: true }),
      Markdown,
      SlashMenu,
      TableMenu,
      Keys,
    ],
    editorProps: {
      attributes: { class: 'prose', spellcheck: 'true' },
      handlePaste(view, event) {
        const data = event.clipboardData;
        if (!data) return false;
        const text = data.getData('text/plain');
        // No attachments: a pasted file or image with no text is dropped.
        if (!text && data.files.length) return true;
        if (view.state.selection.$from.parent.type.spec.code) return false;
        if (text && MARKDOWN.test(text) && !RICH_HTML.test(data.getData('text/html'))) {
          editor.commands.insertContent(text, { contentType: 'markdown' });
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => !!(event as DragEvent).dataTransfer?.files.length,
    },
    onUpdate: ({ transaction }) => {
      if (transaction.docChanged) onChange();
    },
  });

  return {
    editor,
    /** Shows a note with a fresh undo history, so undo never reaches another note. */
    load(doc: PMNode, { editable = true, keepSelection = false } = {}) {
      const node = editor.schema.nodeFromJSON(doc);
      const old = editor.state.selection;
      const at = (pos: number) => node.resolve(Math.min(pos, node.content.size));
      const selection = keepSelection ? TextSelection.between(at(old.anchor), at(old.head)) : TextSelection.atStart(node);
      editor.view.updateState(EditorState.create({ doc: node, selection, plugins: editor.state.plugins }));
      editor.setEditable(editable, false);
      if (!keepSelection) element.scrollTop = 0;
    },
    getJSON: () => editor.getJSON() as PMNode,
    getMarkdown: () => editor.getMarkdown(),
    focus: () => editor.view.focus(),
  };
}

export type NoteEditor = ReturnType<typeof createEditor>;
