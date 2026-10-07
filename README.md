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
| Tab (on a site shortcut) | Search that site, e.g. `yt` Tab `lofi` ↵ |
| ⌫ on empty / Esc | Leave site search |
| Esc | Close |

Words are matched independently, so `gh flutter` finds `github.com/flutter/flutter`.

## Site search
Type a shortcut (`yt`, `gh`, `w`…) or the first letters of a site's name and press **Tab**. The site's name replaces the search icon, results narrow to your tabs, bookmarks and history on that site, and Enter searches the site itself. Chrome doesn't let extensions read its own site search list, so add yours to `SITES` in `settings.js` using the same `%s` URL format.

## How it works
- On normal pages the palette is injected as an iframe overlay (an extension page, so the site can't read it or style it).
- On pages extensions can't touch (`chrome://`, the New Tab page, Chrome Web Store) it opens as the toolbar icon's popup instead, still inside the same window.
- Nothing leaves your machine; there's no network access.
