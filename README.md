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
Type a shortcut (`yt`, `gh`, `w`…) or the first letters of a site's name and press **Tab**. The site's name replaces the search icon as a pill in the site's color (picked from its favicon), results narrow to your tabs, bookmarks and history on that site, and Enter searches the site itself. Chrome doesn't let extensions read its own site search list, so manage yours in Seek settings, using the same `%s` URL format as `chrome://settings/searchEngines`.

## Settings
Right-click the toolbar icon → **Options**, or search "Seek settings" in Seek. There you can pick a light, dark or system theme, see the shortcut (Chrome owns extension shortcuts, so **Change** opens `chrome://extensions/shortcuts`), and add, edit or delete site search entries. Settings sync through your Chrome profile.

## How it works
- On normal pages the palette is injected as an iframe overlay (an extension page, so the site can't read it or style it).
- On pages extensions can't touch (`chrome://`, the New Tab page, Chrome Web Store) it opens as the toolbar icon's popup instead, still inside the same window.
- Seek makes no network requests. Only your settings leave the machine, through Chrome's own profile sync.
