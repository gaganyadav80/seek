# Seek

Press **⌘⇧K** (Mac) or **Ctrl+Shift+K** (Windows/Linux) anywhere in your browser to fuzzy search open tabs, bookmarks, history and browser settings.

## Install
1. Open your browser's extensions page and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Open **Keyboard shortcuts** from the extensions page. If the browser didn't assign Seek's shortcut (it skips keys that clash), set one there.

## Keys
| Key | Action |
| --- | --- |
| ↑ ↓ / Ctrl+N Ctrl+P | Move |
| ↵ | Switch to tab, or open in a new tab |
| ⌘↵ / Ctrl+↵ | Open in the current tab |
| Tab / Shift+Tab | Cycle filter: All, Tabs, Bookmarks, History, Settings |
| Tab (on a site shortcut) | Search that site, e.g. `yt` Tab `lofi` ↵ |
| ⌫ on empty | Leave site search, back to what you typed before Tab |
| Esc | Leave site search with the field cleared, or close |

Words are matched independently, so `gh flutter` finds `github.com/flutter/flutter`.

## Site search
Type a shortcut (`yt`, `gh`, `w`…) or the first letters of a site's name and press **Tab**. The site's name replaces the search icon as a pill in the site's color (picked from its favicon), results narrow to your tabs, bookmarks and history on that site, and Enter searches the site itself. Browsers don't let extensions read their own site search list, so manage yours in Seek settings, using the same `%s` URL format as your browser's site search settings.

## Settings
Right-click the toolbar icon → **Options**, or search "Seek settings" in Seek. There you can pick a light, dark or system theme, see the shortcut (the browser owns extension shortcuts, so **Change** opens its shortcuts page), have Seek open whenever you open a new tab (as a dropdown, or as the whole page), turn search sources (tabs, bookmarks, history, browser settings) on or off, swap what ↵ and ⌘↵ do, choose which site "Search the web" uses, and add, edit, delete or restore the default site search entries. Settings sync through your browser profile.

## How it works
- On normal pages the palette is injected as an iframe overlay (an extension page, so the site can't read it or style it).
- On pages extensions can't touch (the browser's own pages, the New Tab page, the extension store) it opens as the toolbar icon's popup instead, still inside the same window.
- Seek makes no network requests. Only your settings leave the machine, through your browser's own profile sync.
