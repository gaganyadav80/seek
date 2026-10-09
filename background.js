// Seek — background service worker.
// Opens the palette as an overlay iframe on normal pages. On pages the browser
// won't let extensions touch (its own pages, the extension store, the new tab
// page) it opens as the toolbar popup instead, which stays inside the same window.

import { DEFAULT_PREFS, isNewTab } from './settings.js';

// With "Ignore on new tab pages" on, the shortcut does nothing on a new tab
// page, the browser's or Seek's own.
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'open-palette') return;
  const url = tab?.pendingUrl || tab?.url;
  if (isNewTab(url) || url?.startsWith(chrome.runtime.getURL('palette.html'))) {
    const { quietOnNewTab } = await chrome.storage.sync.get({ quietOnNewTab: DEFAULT_PREFS.quietOnNewTab });
    if (quietOnNewTab) return;
  }
  openPalette(tab);
});

chrome.action.onClicked.addListener((tab) => openPalette(tab));

async function openPalette(tab) {
  if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id == null) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: togglePaletteFrame,
      args: [chrome.runtime.getURL(`palette.html?mode=frame&tab=${tab.id}`)],
    });
  } catch {
    await openPopup(tab); // restricted page
  }
}

// The popup is set only long enough to open it, so clicking the toolbar icon
// keeps going through onClicked.
async function openPopup(tab) {
  await chrome.action.setPopup({ tabId: tab.id, popup: `palette.html?mode=popup&tab=${tab.id}` });
  await chrome.action.openPopup({ windowId: tab.windowId }).catch((err) => console.error('Seek:', err));
  await chrome.action.setPopup({ tabId: tab.id, popup: '' });
}

// "When you open a new tab" setting. Browsers give a new tab's focus to the
// address bar and don't let an override be switched off, so instead of
// replacing the page in the manifest Seek reacts to new tabs here:
// 'popup' opens Seek on the browser's own new tab page; 'page' swaps the tab
// for Seek's page in a fresh tab, which (unlike a new tab page) gets focus.
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!isNewTab(tab.pendingUrl || tab.url)) return;
  const { newTab } = await chrome.storage.sync.get({ newTab: DEFAULT_PREFS.newTab });
  if (newTab === 'popup') {
    openPopup(tab);
  } else if (newTab === 'page') {
    // Seek's page copies the real new tab's title ("New tab" in some browsers).
    if (tab.title && !tab.title.includes('://')) await chrome.storage.session.set({ newTabTitle: tab.title });
    const url = chrome.runtime.getURL('palette.html?mode=page');
    await chrome.tabs.create({ url, index: tab.index, windowId: tab.windowId });
    chrome.tabs.remove(tab.id);
  }
});

// Runs inside the web page (isolated world). Must be self-contained.
function togglePaletteFrame(src) {
  const ID = '__seek_palette__';
  const existing = document.getElementById(ID);
  if (existing) {
    existing.__seekCleanup?.();
    return;
  }

  const frame = document.createElement('iframe');
  frame.id = ID;
  frame.src = src;
  frame.setAttribute('aria-label', 'Seek');
  // Inline !important so page CSS can't interfere. Chrome paints an iframe
  // opaque when its color-scheme differs from the document inside, and it
  // answers prefers-color-scheme inside the frame from the frame's scheme.
  // `light dark` on both (palette.css) keeps them equal and passes the OS
  // setting through for the System theme. `normal` isn't enough: pages with
  // <meta name="color-scheme" content="dark"> (scrimba.com) turn it dark.
  // The blur has to live here: a backdrop-filter inside the iframe can't see
  // the page, and without it the dark panel sinks into dark pages. It fades
  // in once Seek shows ('seek:open'), with the bar's tap; a transition, since
  // an animation couldn't override the !important.
  frame.setAttribute(
    'style',
    [
      'position:fixed', 'inset:0', 'width:100vw', 'height:100vh',
      'max-width:none', 'max-height:none', 'margin:0', 'padding:0',
      'border:0', 'background:transparent', 'color-scheme:light dark',
      'backdrop-filter:blur(0px)', 'transition:backdrop-filter 240ms cubic-bezier(0.33, 1, 0.68, 1)',
      'z-index:2147483647', 'display:block', 'opacity:1', 'transform:none',
    ].map((d) => d + ' !important').join(';')
  );

  const prevFocus = document.activeElement;
  const onMessage = (e) => {
    if (e.source !== frame.contentWindow) return;
    if (e.data === 'seek:open') frame.style.setProperty('backdrop-filter', 'blur(6px)', 'important');
    if (e.data === 'seek:close') cleanup();
  };
  function cleanup() {
    window.removeEventListener('message', onMessage);
    frame.remove();
    try { prevFocus?.focus?.({ preventScroll: true }); } catch {}
  }
  frame.__seekCleanup = cleanup;

  window.addEventListener('message', onMessage);
  frame.addEventListener('load', () => frame.focus());
  document.documentElement.appendChild(frame);

  // Put it in the top layer so it sits above the page's own modal dialogs.
  try {
    frame.popover = 'manual';
    frame.showPopover();
  } catch {}
}
