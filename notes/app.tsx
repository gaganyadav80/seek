// Seek Notes: the side panel. Three views share one header area:
// Notes (the list), Bin (deleted notes, read-only) and the editor.
// The editor is created once, outside Preact's render cycle, and reused.

import { render } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as db from './db';
import type { Meta } from './db';
import { formatDate, type PMNode } from './derive';
import { search, type Hit, type Range } from './search';
import { ICONS } from './icons';
import type { NoteEditor } from './editor';

const SAVE_DELAY = 400;
const SEARCH_DELAY = 100;
const ROW = 104; // fixed row height keeps the virtual list trivial
const OVERSCAN = 6;

type View = 'notes' | 'bin' | 'editor';
type Open = { id: string; createdAt: number; deleted: boolean };
type Menu = { x: number; y: number; id: string; confirm?: boolean } | null;

const Icon = ({ svg }: { svg: string }) => <span class="icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;

// ---------- editor session (plain module state, not Preact state) ----------

let ed: NoteEditor | null = null;
let editorLoad: Promise<NoteEditor> | null = null;
let open: Open | null = null;
let dirty = false;
let timer = 0;
let onSaved: (m: Meta | null, id: string) => void = () => {};

function loadEditor(host: HTMLElement) {
  return (editorLoad ??= import('./editor').then(({ createEditor }) => {
    ed = createEditor(host, () => {
      if (!open || open.deleted) return;
      dirty = true;
      clearTimeout(timer);
      timer = window.setTimeout(flush, SAVE_DELAY);
    });
    return ed;
  }));
}

/** Writes pending edits now. Called on a timer, on leaving the note and when the panel hides. */
async function flush() {
  clearTimeout(timer);
  if (!dirty || !open || !ed) return;
  dirty = false;
  const { id, createdAt } = open;
  onSaved(await db.save(id, ed.getJSON(), createdAt), id);
}

addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
addEventListener('pagehide', () => void flush());

// ---------- highlighted text ----------

function Marked({ text, ranges }: { text: string; ranges: Range[] }) {
  if (!ranges.length) return <>{text}</>;
  const out = [];
  let at = 0;
  for (const [s, e] of ranges) {
    out.push(text.slice(at, s), <mark>{text.slice(s, e)}</mark>);
    at = e;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

// ---------- list ----------

type Row = { meta: Meta; date: number; hit?: Hit };

function List({ rows, selected, onOpen, onMenu, onHover }: {
  rows: Row[];
  selected: number;
  onOpen: (m: Meta) => void;
  onMenu: (e: MouseEvent, m: Meta) => void;
  onHover: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [height, setHeight] = useState(800);

  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the keyboard selection in view.
  useEffect(() => {
    const el = ref.current!;
    if (selected < 0) return;
    const y = selected * ROW;
    if (y < el.scrollTop) el.scrollTop = y;
    else if (y + ROW > el.scrollTop + el.clientHeight) el.scrollTop = y + ROW - el.clientHeight;
  }, [selected]);

  const first = Math.max(0, Math.floor(top / ROW) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((top + height) / ROW) + OVERSCAN);

  return (
    <div class="list" ref={ref} onScroll={(e) => setTop((e.currentTarget as HTMLElement).scrollTop)} role="listbox">
      <div style={{ height: rows.length * ROW }}>
        {rows.slice(first, last).map(({ meta, date, hit }, k) => {
          const i = first + k;
          return (
            <div
              key={meta.id}
              class="row"
              role="option"
              aria-selected={i === selected}
              style={{ transform: `translateY(${i * ROW}px)` }}
              onClick={() => onOpen(meta)}
              onContextMenu={(e) => onMenu(e, meta)}
              onMouseMove={() => i !== selected && onHover(i)}
            >
              <div class="title">{hit ? <Marked text={meta.title} ranges={hit.titleHl} /> : meta.title}</div>
              <div class="preview">{hit ? <Marked text={hit.snippet} ranges={hit.snippetHl} /> : meta.preview}</div>
              <div class="date">{formatDate(date)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- app ----------

function App() {
  const [metas, setMetas] = useState<Meta[] | null>(null);
  const [view, setView] = useState<View>('notes');
  const [listView, setListView] = useState<'notes' | 'bin'>('notes');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [texts, setTexts] = useState<Map<string, string> | null>(null);
  const [selected, setSelected] = useState(-1);
  const [menu, setMenu] = useState<Menu>(null);
  const [switcher, setSwitcher] = useState(false);
  const [copied, setCopied] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const refresh = () => db.listMeta().then(setMetas);

  useEffect(() => {
    refresh();
    // Warm the editor once the list is up, so the first open is instant.
    const warm = () => loadEditor(host.current!);
    'requestIdleCallback' in window ? requestIdleCallback(warm) : setTimeout(warm, 300);

    onSaved = (meta, id) => {
      setTexts(null); // re-read on the next search
      setMetas((ms) => {
        const rest = (ms || []).filter((m) => m.id !== id);
        return meta ? [...rest, meta] : rest;
      });
    };

    // Another panel changed something: refresh the list and, if this panel
    // shows that note with no unsaved edits, the note too.
    return db.onChange(async ({ id }) => {
      setTexts(null);
      refresh();
      if (open?.id !== id || dirty || !ed) return;
      const [meta, doc] = await Promise.all([db.getMeta(id), db.getDoc(id)]);
      if (!meta || !doc) return backToList();
      open.deleted = !!meta.deletedAt;
      ed.load(doc, { editable: !open.deleted, keepSelection: true });
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), SEARCH_DELAY);
    return () => clearTimeout(t);
  }, [query]);

  // Body text loads on the first search, never for the plain list.
  useEffect(() => {
    if (searching && debounced.trim() && !texts) db.getTexts().then(setTexts);
  }, [searching, debounced, texts]);

  const rows: Row[] = useMemo(() => {
    const all = metas || [];
    if (listView === 'bin') {
      return all.filter((m) => m.deletedAt).sort((a, b) => b.deletedAt! - a.deletedAt!).map((meta) => ({ meta, date: meta.deletedAt! }));
    }
    const live = all.filter((m) => !m.deletedAt);
    if (searching && debounced.trim()) {
      return search(debounced, live, texts || new Map()).map((hit) => ({ meta: hit.meta, date: hit.meta.updatedAt, hit }));
    }
    return live.sort((a, b) => b.updatedAt - a.updatedAt).map((meta) => ({ meta, date: meta.updatedAt }));
  }, [metas, listView, searching, debounced, texts]);

  // The first search result starts selected, as in a palette.
  useEffect(() => setSelected(searching && debounced.trim() && rows.length ? 0 : -1), [debounced, searching, listView]);

  async function openNote(meta: Meta | null) {
    const e = await loadEditor(host.current!);
    if (meta) {
      const doc = await db.getDoc(meta.id);
      if (!doc) return;
      open = { id: meta.id, createdAt: meta.createdAt, deleted: !!meta.deletedAt };
      e.load(doc, { editable: !open.deleted });
    } else {
      const { EMPTY_DOC } = await import('./editor');
      open = { id: crypto.randomUUID(), createdAt: Date.now(), deleted: false };
      e.load(EMPTY_DOC as PMNode);
    }
    dirty = false;
    setMenu(null);
    setView('editor');
    // The caret starts on the first line (load() puts it there).
    requestAnimationFrame(() => !open?.deleted && e.focus());
  }

  function newNote() {
    setListView('notes');
    exitSearch();
    openNote(null);
  }

  async function backToList() {
    await flush();
    open = null;
    setView(listView);
    setCopied(false);
  }

  function startSearch() {
    setListView('notes');
    setSearching(true);
  }

  // Focus the field as soon as it exists, so the first keystroke lands in it.
  useLayoutEffect(() => void (searching && searchInput.current?.focus()), [searching]);

  function exitSearch() {
    setSearching(false);
    setQuery('');
    setDebounced('');
  }

  function showMenu(e: MouseEvent, meta: Meta) {
    e.preventDefault();
    setMenu({ x: Math.min(e.clientX, innerWidth - 200), y: Math.min(e.clientY, innerHeight - 100), id: meta.id });
  }

  async function act(fn: (id: string) => Promise<void>) {
    if (!menu) return;
    await fn(menu.id);
    setMenu(null);
    refresh();
  }

  async function copyMarkdown() {
    if (!ed) return;
    await navigator.clipboard.writeText(ed.getMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  // Keys for the list views; the editor handles its own except Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (menu || switcher) {
        if (e.key === 'Escape') setMenu(null), setSwitcher(false);
        return;
      }
      if (view === 'editor') return; // Esc there: see below
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (rows.length) setSelected((s) => (e.key === 'ArrowDown' ? Math.min(rows.length - 1, s + 1) : Math.max(0, s - 1)));
      } else if (e.key === 'Enter' && selected >= 0 && rows[selected]) {
        e.preventDefault();
        openNote(rows[selected].meta);
      } else if (e.key === 'Escape' && searching) {
        exitSearch();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        startSearch();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  // Esc leaves the note. ProseMirror prevents default on every Esc, so this
  // listens in the capture phase, and steps aside for an open slash or table
  // menu and the code block language field, which use Esc themselves.
  useEffect(() => {
    if (view !== 'editor') return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.menu.slash, .table-menu')) return;
      if ((e.target as Element).closest?.('.fence')) return;
      backToList();
    };
    addEventListener('keydown', onEsc, true);
    return () => removeEventListener('keydown', onEsc, true);
  });

  const inBin = listView === 'bin';
  const empty = metas && !rows.length;

  return (
    <>
      <div class="view" hidden={view === 'editor'} onClick={() => (setMenu(null), setSwitcher(false))}>
        {searching ? (
          <header class="bar">
            <label class="search">
              <Icon svg={ICONS.search} />
              <input
                ref={searchInput}
                value={query}
                placeholder="Search notes"
                spellcheck={false}
                onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              />
              <button class="clear" title="Close search" onClick={exitSearch}>
                <Icon svg={ICONS.clear} />
              </button>
            </label>
          </header>
        ) : (
          <header class="bar">
            <button class="switcher" onClick={(e) => (e.stopPropagation(), setSwitcher(!switcher))} aria-expanded={switcher}>
              {inBin ? 'Bin' : 'Notes'}
              <Icon svg={ICONS.caretDown} />
            </button>
            <span class="spacer" />
            <button class="tool" title="New note" onClick={newNote}>
              <Icon svg={ICONS.notePencil} />
            </button>
            <button class="tool" title="Search (⌘F)" onClick={startSearch}>
              <Icon svg={ICONS.search} />
            </button>
            {switcher && (
              <div class="menu switch-menu" role="menu">
                {(['notes', 'bin'] as const).map((v) => (
                  <div class="menu-item" role="menuitemradio" aria-checked={listView === v} onClick={() => (setListView(v), setView(v), setSwitcher(false))}>
                    {v === 'notes' ? 'Notes' : 'Bin'}
                    {listView === v && <Icon svg={ICONS.check} />}
                  </div>
                ))}
              </div>
            )}
          </header>
        )}
        {empty ? (
          <p class="empty">{searching ? 'No matching notes' : inBin ? 'The Bin is empty' : 'No notes yet'}</p>
        ) : (
          <List rows={rows} selected={selected} onOpen={openNote} onMenu={showMenu} onHover={(i) => searching && setSelected(i)} />
        )}
        {menu && (
          <div class="menu context" role="menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
            {inBin ? (
              <>
                <div class="menu-item" role="menuitem" onClick={() => act(db.restore)}>
                  <Icon svg={ICONS.restore} />
                  Restore
                </div>
                <div
                  class={'menu-item danger' + (menu.confirm ? ' confirm' : '')}
                  role="menuitem"
                  onClick={() => (menu.confirm ? act(db.purge) : setMenu({ ...menu, confirm: true }))}
                >
                  <Icon svg={ICONS.trash} />
                  {menu.confirm ? 'Click again to delete forever' : 'Delete permanently'}
                </div>
              </>
            ) : (
              <div class="menu-item" role="menuitem" onClick={() => act(db.softDelete)}>
                <Icon svg={ICONS.trash} />
                Delete
              </div>
            )}
          </div>
        )}
      </div>

      <div class="view editor-view" hidden={view !== 'editor'}>
        <header class="bar">
          <button class="tool back" title="Back (Esc)" onClick={backToList}>
            <Icon svg={ICONS.caretLeft} />
          </button>
          {open?.deleted && <span class="badge">In Bin · read-only</span>}
          <span class="spacer" />
          <button class="tool" title={copied ? 'Copied' : 'Copy as Markdown'} onClick={copyMarkdown}>
            <Icon svg={copied ? ICONS.check : ICONS.copy} />
          </button>
        </header>
        {/* Tiptap owns everything inside this element. */}
        <div class="editor" ref={host} />
      </div>
    </>
  );
}

render(<App />, document.getElementById('app')!);
