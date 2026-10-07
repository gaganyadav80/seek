# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
People who live in their browser and keep their hands on the keyboard: developers and other heavy tab users who summon Seek many times a day to jump to a tab, reopen a page, or search a site without touching the mouse.

## Product Purpose
Seek is a keyboard-first command bar browser extension. One shortcut fuzzy searches open tabs, bookmarks, history and the browser's own settings pages. Typing a site's shortcut and pressing Tab searches that site. Success is getting from intent to the right page in a few keystrokes, faster than the address bar.

## Positioning
A single command bar over everything the browser already knows (tabs, bookmarks, history, settings), plus site search, that works in any Chromium browser and makes no network requests.

## Operating Context
- Summoned by a shortcut (⌘⇧K / Ctrl+Shift+K) dozens of times a day, used for a few seconds, dismissed.
- Three presentations of the same command bar: an overlay on a web page (frame), the toolbar dropdown on pages extensions can't touch (popup), and the whole new tab page (page), when the user turns that on in settings.
- Keyboard flow: ↑ ↓ / Ctrl+N Ctrl+P move, ↵ opens, ⌘↵ opens the other way, Tab cycles filters (All, Tabs, Bookmarks, History, Settings), Tab on a site shortcut enters site search, ⌫ on empty or Esc leaves it, Esc closes.

## Capabilities and Constraints
- Manifest V3, plain HTML/CSS/JS, no build step, no dependencies.
- No network requests; only settings leave the machine, through the browser's own profile sync. Anything the UI needs (fonts, icons) ships inside the extension.
- Light, dark or system theme; dark is the default.
- Results highlight fuzzy-matched letters. Site search shows the site's name as a pill in the site's color, taken from its favicon.

## Brand Commitments
- Browser-neutral: no browser product names in UI text, README or store copy. Seek runs in any Chromium browser and may come to Firefox later.
- Icons are Phosphor (MIT), inlined.
- One accent hue: blue marks fuzzy-matched letters (#8ea3ff dark, #3554d1 light).
- No open or close animation on the command bar; it is summoned by a shortcut. The site search entry animation (tap, tint, glow) stays.

## Evidence on Hand
- Product icon and mark: `brand/`, `icons/`.
- No user research, metrics or testimonials exist; don't invent any.

## Product Principles
- Keyboard first: every action has a key, and the mouse is optional.
- Instant: nothing waits on animation, network or loading states that a keystroke can outrun.
- Quiet chrome, loud results: the interface recedes so the matched result is what you see.
- Works the same in every browser that can run it.

## Accessibility & Inclusion
WCAG AA contrast for all text in both themes. Respects reduced motion. The results list is a combobox/listbox with active-descendant, so screen readers follow the selection.
