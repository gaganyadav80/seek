// Seek — background service worker.
// Opens the palette as an overlay iframe on normal pages. On pages Chrome
// won't let extensions touch (chrome://, the Web Store, the New Tab page…)
// it falls back to a small centered popup window instead.

let popupWindowId = null;

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-palette') openPalette(tab);
});

chrome.action.onClicked.addListener((tab) => openPalette(tab));

chrome.windows.onRemoved.addListener((id) => {
  if (id === popupWindowId) popupWindowId = null;
});

async function openPalette(tab) {
  // Shortcut pressed while the fallback window is open → close it (toggle).
  if (popupWindowId !== null) {
    try { await chrome.windows.remove(popupWindowId); } catch {}
    popupWindowId = null;
    return;
  }

  if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  if (tab?.id != null) {
    const src = chrome.runtime.getURL(`palette.html?mode=frame&tab=${tab.id}`);
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: togglePaletteFrame,
        args: [src],
      });
      return;
    } catch {
      // Restricted page — fall through to the popup window.
    }
  }

  await openPaletteWindow(tab);
}

async function openPaletteWindow(tab) {
  const width = 720;
  const height = 500;
  const base = await chrome.windows.getLastFocused().catch(() => null);
  const pos = base
    ? {
        left: Math.round(base.left + (base.width - width) / 2),
        top: Math.round(base.top + (base.height - height) / 2.5),
      }
    : {};

  const win = await chrome.windows.create({
    url: chrome.runtime.getURL(`palette.html?mode=window&tab=${tab?.id ?? ''}`),
    type: 'popup',
    width,
    height,
    focused: true,
    ...pos,
  });
  popupWindowId = win.id;
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
