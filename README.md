# Seek

Press **⌘⇧K** (Mac) or **Ctrl+Shift+K** (Windows/Linux) anywhere in Chrome to fuzzy search open tabs, bookmarks, history and Chrome settings.

## Install
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Check `chrome://extensions/shortcuts`. If Chrome didn't assign the shortcut (it skips keys that clash), set one there.

## Keys
| Key | Action |
| --- | --- |
| ↑ ↓ / Ctrl+N Ctrl+P | Move |
| ↵ | Switch to tab, or open in a new tab |
| ⌘↵ / Ctrl+↵ | Open in the current tab |
| Tab / Shift+Tab | Cycle filter: All, Tabs, Bookmarks, History, Settings |
| Esc | Close |

Words are matched independently, so `gh flutter` finds `github.com/flutter/flutter`.

## How it works
- On normal pages the palette is injected as an iframe overlay (an extension page, so the site can't read it or style it).
- On pages extensions can't touch (`chrome://`, the New Tab page, Chrome Web Store) it opens as the toolbar icon's popup instead, still inside the same window.
- Nothing leaves your machine; there's no network access.
