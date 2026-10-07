// Seek — background service worker.
// Opens the palette as an overlay iframe on normal pages. On pages Chrome
// won't let extensions touch (chrome://, the Web Store, the New Tab page…)
// it opens as the toolbar popup instead, which stays inside the same window.

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-palette') openPalette(tab);
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
    // Restricted page. The popup is set only long enough to open it, so
    // clicking the toolbar icon keeps going through onClicked.
    await chrome.action.setPopup({ tabId: tab.id, popup: `palette.html?mode=popup&tab=${tab.id}` });
    await chrome.action.openPopup({ windowId: tab.windowId }).catch((err) => console.error('Seek:', err));
    await chrome.action.setPopup({ tabId: tab.id, popup: '' });
  }
}

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
  // Inline !important so page CSS can't interfere. color-scheme: normal keeps
  // the iframe transparent even on pages that declare a dark color-scheme.
  frame.setAttribute(
    'style',
    [
      'position:fixed', 'inset:0', 'width:100vw', 'height:100vh',
      'max-width:none', 'max-height:none', 'margin:0', 'padding:0',
      'border:0', 'background:transparent', 'color-scheme:normal',
      'z-index:2147483647', 'display:block', 'opacity:1', 'transform:none',
    ].map((d) => d + ' !important').join(';')
  );

  const prevFocus = document.activeElement;
  const onMessage = (e) => {
    if (e.source === frame.contentWindow && e.data === 'seek:close') cleanup();
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
