// Notes storage in IndexedDB. Three stores so the list never reads note bodies:
//   meta    { id, title, preview, createdAt, updatedAt, deletedAt }  read at startup
//   content { id, doc }   ProseMirror JSON, read when a note opens
//   search  { id, text }  body text, read on the first search
// Every change is announced on a BroadcastChannel so panels in other windows
// refresh their list and any open copy of the note.

import { openDB, type IDBPDatabase } from 'idb';
import { derive, type PMNode } from './derive';

export type Meta = {
  id: string;
  title: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type Change = { id: string; updatedAt: number; from: string };

const NAME = 'seek-notes';
let db: Promise<IDBPDatabase> | null = null;

function open() {
  return (db ??= openDB(NAME, 1, {
    upgrade(d) {
      d.createObjectStore('meta', { keyPath: 'id' });
      d.createObjectStore('content', { keyPath: 'id' });
      d.createObjectStore('search', { keyPath: 'id' });
    },
  }));
}

/** Identifies this panel so it can ignore its own broadcasts. */
export const PANEL = crypto.randomUUID();
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(NAME);
const announce = (id: string, updatedAt = Date.now()) => channel?.postMessage({ id, updatedAt, from: PANEL } satisfies Change);

export function onChange(fn: (c: Change) => void): () => void {
  const listener = (e: MessageEvent<Change>) => e.data.from !== PANEL && fn(e.data);
  channel?.addEventListener('message', listener);
  return () => channel?.removeEventListener('message', listener);
}

export const listMeta = async (): Promise<Meta[]> => (await open()).getAll('meta');
export const getMeta = async (id: string): Promise<Meta | undefined> => (await open()).get('meta', id);
export const getDoc = async (id: string): Promise<PMNode | undefined> => (await (await open()).get('content', id))?.doc;

export async function getTexts(): Promise<Map<string, string>> {
  const rows: { id: string; text: string }[] = await (await open()).getAll('search');
  return new Map(rows.map((r) => [r.id, r.text]));
}

/**
 * Saves a note. An empty note is removed instead, so a note left blank never
 * appears in the list. Returns the stored meta, or null when removed.
 */
export async function save(id: string, doc: PMNode, createdAt: number): Promise<Meta | null> {
  const d = await open();
  const { title, preview, body, empty } = derive(doc);
  const tx = d.transaction(['meta', 'content', 'search'], 'readwrite');
  let meta: Meta | null = null;
  if (empty) {
    await Promise.all([tx.objectStore('meta').delete(id), tx.objectStore('content').delete(id), tx.objectStore('search').delete(id)]);
  } else {
    const old: Meta | undefined = await tx.objectStore('meta').get(id);
    meta = { id, title, preview, createdAt: old?.createdAt ?? createdAt, updatedAt: Date.now(), deletedAt: old?.deletedAt ?? null };
    await Promise.all([
      tx.objectStore('meta').put(meta),
      tx.objectStore('content').put({ id, doc }),
      tx.objectStore('search').put({ id, text: body }),
    ]);
  }
  await tx.done;
  announce(id, meta?.updatedAt);
  return meta;
}

async function setDeleted(id: string, deletedAt: number | null) {
  const d = await open();
  const tx = d.transaction('meta', 'readwrite');
  const meta: Meta | undefined = await tx.store.get(id);
  if (meta) await tx.store.put({ ...meta, deletedAt });
  await tx.done;
  announce(id);
}

/** Moves a note to the Bin. */
export const softDelete = (id: string) => setDeleted(id, Date.now());
/** Brings a note back from the Bin. */
export const restore = (id: string) => setDeleted(id, null);

/** Deletes a note for good. */
export async function purge(id: string) {
  const d = await open();
  const tx = d.transaction(['meta', 'content', 'search'], 'readwrite');
  await Promise.all(['meta', 'content', 'search'].map((s) => tx.objectStore(s).delete(id)));
  await tx.done;
  announce(id);
}
