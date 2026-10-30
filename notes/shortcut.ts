// Matches a keydown against a shortcut string from chrome.commands.getAll():
// "⇧⌘Y" on macOS, "Ctrl+Shift+Y" elsewhere.

const MODS: Record<string, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'> = {
  '⌃': 'ctrlKey', '⌥': 'altKey', '⇧': 'shiftKey', '⌘': 'metaKey',
  Ctrl: 'ctrlKey', Alt: 'altKey', Shift: 'shiftKey', Command: 'metaKey', MacCtrl: 'ctrlKey',
};

type Keys = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>;

// ponytail: compares letters and digits by code, anything else by key text;
// named keys like "Comma" or "Up" need a lookup table if anyone binds one.
export function matchesShortcut(e: Keys, shortcut: string): boolean {
  if (!shortcut) return false;
  const parts = shortcut.includes('+') ? shortcut.split('+') : [...shortcut];
  const key = parts.pop()!;
  const held = new Set(parts.map((p) => MODS[p]));
  if ((['ctrlKey', 'altKey', 'shiftKey', 'metaKey'] as const).some((m) => e[m] !== held.has(m))) return false;
  return e.code === `Key${key}` || e.code === `Digit${key}` || e.key.toUpperCase() === key.toUpperCase();
}
