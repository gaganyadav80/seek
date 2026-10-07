---
name: Seek
description: A keyboard-first command bar over tabs, bookmarks, history and browser settings, in two styles, Solid and Glass.
colors:
  match-blue-dark: "#8ea3ff"
  match-blue-light: "#3554d1"
  charcoal-canvas: "#09090a"
  charcoal-surface: "#131315"
  charcoal-raised: "#2a2a2e"
  pale-ink: "#e4e4e7"
  pale-ink-strong: "#fafafa"
  pale-muted: "#a1a1aa"
  pale-faint: "#85858d"
  mist-canvas: "#ececef"
  mist-surface: "#fbfbfc"
  graphite-ink: "#27272a"
  graphite-ink-strong: "#09090b"
  graphite-muted: "#5c5c66"
  graphite-faint: "#6b6b74"
  danger-dark: "#f87171"
  danger-light: "#c42b2b"
  tab-dot-dark: "#8fa8ff"
  bookmark-dot-dark: "#e5b649"
  history-dot-dark: "#9a9aa3"
  setting-dot-dark: "#4cc9a8"
  tab-dot-light: "#3554d1"
  bookmark-dot-light: "#a16207"
  history-dot-light: "#6b7280"
  setting-dot-light: "#0f766e"
  glass-dusk-canvas: "#0f1015"
  glass-dusk-material: "rgb(30 30 36 / 0.62)"
  glass-dusk-ink: "#e9e9ee"
  glass-dusk-muted: "#a8a8b2"
  glass-dusk-faint: "#91919b"
  glass-dawn-canvas: "#ebe9e6"
  glass-dawn-material: "rgb(250 250 251 / 0.72)"
  glass-dawn-ink: "#232328"
  glass-dawn-muted: "#55555f"
  glass-dawn-faint: "#61616b"
typography:
  query:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.01em"
  result-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.35
  filter-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1
  meta:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
  keycap:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
  dialog-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  settings-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
rounded:
  favicon: "3px"
  glass-favicon: "4px"
  key: "5px"
  menu-item: "6px"
  control: "8px"
  menu: "10px"
  row: "12px"
  group: "12px"
  bar: "20px"
  glass-bar: "22px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "18px"
components:
  command-bar:
    backgroundColor: "{colors.charcoal-surface}"
    rounded: "{rounded.bar}"
    width: "680px"
    height: "460px"
  command-bar-glass:
    backgroundColor: "{colors.glass-dusk-material}"
    rounded: "{rounded.glass-bar}"
    width: "680px"
    height: "460px"
  search-field:
    textColor: "{colors.pale-ink-strong}"
    typography: "{typography.query}"
    height: "58px"
    padding: "0 18px"
  filter-pill:
    textColor: "{colors.pale-muted}"
    typography: "{typography.filter-label}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  filter-pill-active:
    backgroundColor: "rgba(250, 250, 252, 0.1)"
    textColor: "{colors.pale-ink-strong}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  result-row:
    textColor: "{colors.pale-ink}"
    typography: "{typography.result-title}"
    rounded: "{rounded.row}"
    padding: "8px 12px"
  result-row-selected:
    backgroundColor: "rgba(255, 255, 255, 0.09)"
    textColor: "{colors.pale-ink-strong}"
    rounded: "{rounded.row}"
    padding: "8px 12px"
  keycap:
    backgroundColor: "#2c2c30"
    textColor: "{colors.pale-ink-strong}"
    typography: "{typography.keycap}"
    rounded: "{rounded.key}"
    padding: "3px 5px 4px"
  site-pill:
    textColor: "{colors.pale-ink-strong}"
    rounded: "{rounded.pill}"
    padding: "6px 11px"
  settings-group:
    backgroundColor: "{colors.charcoal-surface}"
    rounded: "{rounded.group}"
    padding: "10px 16px"
  settings-select:
    backgroundColor: "{colors.charcoal-canvas}"
    textColor: "{colors.pale-ink}"
    rounded: "{rounded.control}"
    height: "30px"
---

# Design System: Seek

## Overview

**Creative North Star: "The Quiet Instrument"**

Seek is a tool you reach for dozens of times a day, for a few seconds at a time. The system treats it like a precision instrument: the chrome recedes into neutral charcoal or soft mist, the finish shows only at the edges (a rim that catches light, keys with a lip, corners that nest), and the loudest thing on screen is always the result you were looking for, its matched letters in blue.

It comes in two styles that share one frame. **Solid** (the default) is an opaque bar, charcoal in dark and near-white in light, with a machined rim and layered shadow. **Glass** is a frosted material over a soft field of muted color, with a specular top edge, smooth corners and press feedback that springs back. The bar, its rows, its type and its keys are the same size in both; a style changes the surface, never the layout. Both work in all three places Seek appears: the overlay on a web page, the toolbar dropdown, and Seek's own new tab page.

Nothing performs. The bar has no open or close animation, keyboard selection moves instantly, and the one moment of motion is the short tap and glow when a site search starts.

**Key Characteristics:**
- Dark by default, with a finished light theme; every text color passes WCAG AA in both, in both styles, over any page.
- One accent: blue marks fuzzy-matched letters and nothing else.
- The site's own color, taken from its favicon, appears only in the site pill and the entry glow.
- System type throughout, no downloaded fonts.
- Phosphor icons, bold in Solid and regular in Glass.

## Colors

A neutral charcoal and mist palette with a single blue voice, plus color that each site lends for a moment.

### Primary
- **Match Blue** (match-blue-dark in dark, match-blue-light in light): the letters a fuzzy search matched, in titles and addresses. The only hue the interface owns.

### Secondary
- **Type Dots** (tab, bookmark, history and setting dots, one pair per theme): the small dot beside each result's type label. Solid shows them at full color; Glass mixes them 60% toward the faint gray so they whisper.

### Neutral
- **Charcoal Canvas** and **Mist Canvas**: the new tab page's ground in dark and light, lit faintly from above in Solid.
- **Charcoal Surface** and **Mist Surface**: the Solid bar, the dropdown and the settings groups.
- **Charcoal Raised**: the settings page's theme-switch thumb and open menus in dark. Solid keycaps use their own top-lit gradient (#2c2c30 to #222225 in dark).
- **Pale Ink / Graphite Ink** for text, with Strong for the query, selected titles and keys, Muted for addresses and footer labels, and Faint for the placeholder, the search icon and type labels.
- **Glass Dusk** and **Glass Dawn**: Glass's own canvas, translucent material and text colors for dark and light. The field behind the glass is four or five large, blurred regions of muted blue, plum, teal and sand (dusk) or peach, lilac, sage and wheat (dawn).
- Selection, hover, hairlines and keycap edges are white or near-black alphas over these surfaces (5 to 13%), never new hues.

### Named Rules
**The One Blue Rule.** Blue means "this matched". It is never used for focus, links, buttons or decoration. Where the theme's blue would fail AA, use the other theme's blue; never a new hue.

**The Borrowed Color Rule.** A site's color comes only from its favicon and appears only in the site pill and the site-search entry glow. Entering site search restyles nothing else: not the page, the bar, the rim, the selected row or the caret.

## Typography

**Body Font:** the platform's system UI stack (SF on Mac, Segoe UI Variable on Windows), with Roboto and Helvetica Neue behind it.

**Character:** one familiar face doing every job, so the bar feels native to the computer it runs on. Hierarchy comes from size and weight, not from a second family.

### Hierarchy
- **Query** (500, 18px, line-height 1, -0.01em): what you type and the placeholder (placeholder at 400). Glass sets it at 400.
- **Result title** (400, 14px, 1.35): one line, truncated with an ellipsis. Matched letters go to 600 in Match Blue.
- **Filter label** (500, 12.5px): All, Tabs, Bookmarks, History, Settings.
- **Meta** (400, 12px): addresses, type labels, footer hints, the Tab hint.
- **Keycap** (600, 11px; 500 in Glass): key glyphs in the footer and settings.
- **Settings title** (600, 26px, -0.02em), the site editor's dialog title (600, 17px) and section headings (600, 13px, muted) on the settings page only.

### Named Rules
**The One Family Rule.** No downloaded fonts. Seek makes no network requests, and the system face is what makes it feel at home in any browser.

## Layout

The bar is a fixed frame centered with margin auto (never translate, so text never lands on a half pixel): 680 by 460 pixels, shrinking to the window with a 16px gutter on the sides and 24px top and bottom. In the toolbar dropdown the bar is the whole 680 by 460 window. On Seek's new tab it floats centered on the page ground.

Inside, top to bottom: a 58px search row (18px side padding, 12px gaps), a filter row (12px sides, 10px below, 4px between pills), the results list (6px padding, rows of 8px by 12px with a 20px icon column and 12px gaps), and a footer of key hints (9px by 18px, 18px between hints). The rhythm is 4, 6, 8, 12 and 18px.

Below 520px wide the type labels and the last three footer hints hide, and rows drop to two columns.

The settings page is a single 640px column of grouped lists (12px radius groups, 56px rows, inset hairline dividers), in the spirit of a system settings app.

### Named Rules
**The Fixed Frame Rule.** Every style and mode uses the same frame and the same inner sizes. A new style may change color, material, edges, shadow, radius and weight; it may not change the bar's size or the size of anything in it.

## Elevation & Depth

Solid is lifted: a near-black 1px ring, a short close shadow and a long soft drop beneath the bar, plus a 1px rim drawn inside the edge that is brighter at the top and fades toward the bottom, like a machined edge catching light. In light theme the shadow is softer and the rim darkens toward the bottom instead.

Glass is layered: a translucent material blurred 44px and saturated 170% over the color field, a thin specular edge that is brightest along the top, and a four-step soft shadow. Over a web page the overlay can't blur what's behind it from inside its frame, so the page itself is blurred 20px (6px in Solid) and the material is denser (84% dark, 94% light) to keep every text color readable over any page. With reduced transparency it becomes a solid panel.

### Shadow Vocabulary
- **Solid lift, dark** (`box-shadow: 0 0 0 1px rgb(9 9 11 / 0.8), 0 2px 6px -2px rgb(9 9 11 / 0.6), 0 32px 80px -24px rgb(9 9 11 / 0.85)`): the bar.
- **Solid lift, light** (`box-shadow: 0 1px 2px rgb(9 9 11 / 0.06), 0 8px 20px -10px rgb(9 9 11 / 0.14), 0 36px 80px -28px rgb(9 9 11 / 0.3)`): the bar.
- **Glass lift, dark** (`box-shadow: 0 0 0 0.5px rgb(4 4 8 / 0.6), 0 1px 2px rgb(4 4 8 / 0.25), 0 10px 24px -8px rgb(4 4 8 / 0.45), 0 36px 90px -24px rgb(4 4 8 / 0.7)`): the bar.
- **Keycap** (`box-shadow: inset 0 1px 0 <shine>, inset 0 -1px 0 <lip>, 0 1px 1px rgb(9 9 11 / 0.18)`): a lit top edge and a darker bottom lip.

### Named Rules
**The Offset Shadow Rule.** Every shadow has an offset and a soft blur. No zero-offset colored glow as decoration; the only glow is the site-search entry wave, and it fades within a second.

## Shapes

Gently rounded and nested. The Solid bar has 20px corners; Glass uses 22px, or 32px continuous (squircle) corners where the browser supports them, with rows to match (17px). Result rows are 12px, filters and the site pill are full pills, keycaps are 5px in both styles, and favicons get 3px (4px in Glass). On the settings page, menus open as a 10px list of 6px items. Borders are 1px or less. A thicker edge is drawn as an inset shadow, never as a thicker border.

## Components

### Search field
- **Character:** quiet until you type.
- **Style:** no box; the search icon (Faint), the query, and on the right the Tab hint ("Tab to search YouTube") when a site shortcut matches. In site search the pill replaces the icon and the filters dim to 40%.

### Filters (chips)
- **Style:** full pills of 12.5px medium text, muted at rest.
- **State:** the active filter gets a light alpha fill and a 1px inner ring in Solid, a raised pill with a soft shadow in Glass. Tab cycles them; the change is instant.
- **Press:** scale to 0.97 in 140ms on the standard ease-out. In Glass it springs back on release.

### Result rows
- **Style:** 20px icon column (favicon, or a Phosphor glyph for web search and settings), title over address, type label with its dot on the right.
- **Selected:** a white or near-black alpha fill (9% dark, 6.5% light) and, in Solid, a faint inner ring; the title goes to Strong. Selection follows the keyboard instantly and follows the mouse on hover.
- **Press:** scale to 0.99.

### Keycaps
- **Style:** small keys with a top-lit gradient, a 1px edge and a 1px inset lip (Solid), or a flat translucent key with a hairline shadow (Glass). Settings uses the same lip on its own keys.

### Site pill
- **Style:** a full pill in the site's favicon color, darkened up to 30% until white text reaches 4.5:1 (or dark text when it can't), 600 weight, with an inner top highlight and an offset shadow in its own color.

### Settings page
- **Style:** grouped lists on the canvas; custom menus that keep native keyboard behavior; switches that fill with ink when on (no accent), their knob on a small soft shadow; a three-icon theme switch with a sliding thumb.
- **Style preview:** under the Style menu, Seek's real new tab page (your own tabs) at 1280 by 800, scaled to the row, non-interactive and never focused. It restyles itself when the theme or style changes, under a 220ms soften.

## Do's and Don'ts

### Do:
- **Do** keep the bar 680 by 460 with today's inner sizes in every style and mode (The Fixed Frame Rule).
- **Do** use blue only for matched letters (The One Blue Rule).
- **Do** use Phosphor icons, inlined or as masks: bold in Solid, regular in Glass.
- **Do** check every text color for AA over the real rendered background, including Glass over white, dark and busy pages.
- **Do** keep motion to press feedback (140ms ease-out, `cubic-bezier(0.23, 1, 0.32, 1)`) and the site-search entry (tap 200ms, tint 850ms, glow 1s), and drop press scale under reduced motion.

### Don't:
- **Don't** animate the bar opening or closing, or keyboard selection.
- **Don't** restyle anything when a site search starts beyond the pill and the entry glow (The Borrowed Color Rule).
- **Don't** put a browser's product name in any visible text, including addresses: browser pages show without their scheme (settings/privacy).
- **Don't** use solid pure black (#000) or pure white (#fff) for a surface or text. Translucent overlays (hover, selection, hairlines) are alphas over the surface.
- **Don't** draw icons by hand or use emoji or unicode glyphs as icons (key symbols on keycaps are text, not icons).
- **Don't** load web fonts.
