import { SITES, loadPrefs, watchPrefs, validateSite, sitesUpdate, shortcutKeys, faviconUrl } from './settings.js';

const $ = (id) => document.getElementById(id);
const prefs = await loadPrefs();

// ---------- theme ----------

const radios = document.querySelectorAll('input[name="theme"]');
for (const radio of radios) radio.checked = radio.value === prefs.theme;
// Commit the saved choice while the page is still unthemed (transitions off),
// so the switch's thumb doesn't slide into place on load.
getComputedStyle(document.querySelector('.seg'), '::before').transform;
watchPrefs(prefs, (changes) => {
  renderControls();
  if (changes.sites) renderSites();
});

for (const radio of radios) {
  radio.addEventListener('change', () => chrome.storage.sync.set({ theme: radio.value }));
}

// ---------- search sources and opening results ----------

const switches = document.querySelectorAll('[data-source]');

// Shows the saved settings; also runs when they change in another tab or device.
function renderControls() {
  for (const radio of radios) radio.checked = radio.value === prefs.theme;
  for (const box of switches) box.checked = prefs.sources[box.dataset.source] !== false;
  $('enter-opens').value = prefs.enterOpens;
  $('new-tab').value = prefs.newTab;
  $('style').value = prefs.style;
  $('web-search').replaceChildren(
    new Option('Browser default', ''),
    ...prefs.sites.map((s) => new Option(s.name, s.keyword))
  );
  $('web-search').value = prefs.sites.some((s) => s.keyword === prefs.webSearch) ? prefs.webSearch : '';
  $('restore-sites').hidden = JSON.stringify(prefs.sites) === JSON.stringify(SITES);
}

for (const box of switches) {
  box.addEventListener('change', () => {
    chrome.storage.sync.set({ sources: { ...prefs.sources, [box.dataset.source]: box.checked } });
  });
}
$('enter-opens').addEventListener('change', (e) => chrome.storage.sync.set({ enterOpens: e.target.value }));
$('new-tab').addEventListener('change', (e) => chrome.storage.sync.set({ newTab: e.target.value }));
$('web-search').addEventListener('change', (e) => chrome.storage.sync.set({ webSearch: e.target.value }));
$('style').addEventListener('change', (e) => {
  chrome.storage.sync.set({ style: e.target.value });
  // Soften the swap: the preview restyles itself a moment later, under a brief blur.
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('preview').animate([{ opacity: 0.6, filter: reduce ? 'none' : 'blur(3px)' }, { opacity: 1, filter: 'none' }],
    { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
});

// The preview is a 1280×800 new tab scaled down to the row's width. It follows
// the saved theme and style by itself, like any open Seek page.
new ResizeObserver(([entry]) => {
  $('preview').style.setProperty('--scale', entry.contentRect.width / 1280);
}).observe($('preview'));

// ---------- keyboard shortcut ----------

function kbd(text) {
  const el = document.createElement('kbd');
  el.textContent = text;
  return el;
}

async function renderShortcut() {
  const cmd = (await chrome.commands.getAll()).find((c) => c.name === 'open-palette');
  const keys = shortcutKeys(cmd?.shortcut);
  $('keys').replaceChildren(...(keys.length ? keys.map(kbd) : ['Not set']));
  $('change-shortcut').textContent = keys.length ? 'Change' : 'Set shortcut';
}

// Extensions can't set their own shortcut; the browser's shortcuts page can.
$('change-shortcut').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
window.addEventListener('focus', renderShortcut); // pick up a change made there
renderShortcut();

// ---------- site search ----------

const FIELDS = ['name', 'keyword', 'url'];
const $dialog = $('editor');
const $form = $('site-form');
let editing = -1; // index being edited, -1 when adding

function renderSites() {
  if (!prefs.sites.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No sites yet. Add one to search it from Seek.';
    $('sites').replaceChildren(li);
    return;
  }
  $('sites').replaceChildren(
    ...prefs.sites.map((site, i) => {
      const li = $('site-row').content.firstElementChild.cloneNode(true);
      const icon = Object.assign(new Image(16, 16), { className: 'favicon', alt: '', src: faviconUrl(new URL(site.url).origin) });
      li.querySelector('.site').prepend(icon);
      li.querySelector('.site-name').textContent = site.name;
      li.querySelector('.site-key').textContent = site.keyword;
      li.querySelector('.site-url').textContent = site.url.replace(/^https?:\/\/(www\.)?/, '');
      li.querySelector('.site').addEventListener('click', () => openEditor(i));
      return li;
    })
  );
}

function showError(field, message) {
  $('e-' + field).textContent = message;
  $form.elements[field].setAttribute('aria-invalid', String(!!message));
}

// Destructive buttons ask for a second click instead of a confirm dialog.
function twoStep(button, confirmLabel, action) {
  const label = button.textContent;
  let timer;
  const disarm = () => {
    clearTimeout(timer);
    delete button.dataset.armed;
    button.textContent = label;
  };
  button.addEventListener('click', () => {
    if ('armed' in button.dataset) return disarm(), action();
    button.dataset.armed = '';
    button.textContent = confirmLabel;
    timer = setTimeout(disarm, 3000);
  });
  return disarm;
}

const disarmDelete = twoStep($('delete-site'), 'Click again to delete', async () => {
  if (await save(sitesUpdate(prefs, prefs.sites.filter((_, i) => i !== editing)))) $dialog.close();
});
twoStep($('restore-sites'), 'Click again to restore', () => save(sitesUpdate(prefs, SITES)));

function openEditor(i) {
  editing = i;
  const site = prefs.sites[i] || { name: '', keyword: '', url: '' };
  $('editor-title').textContent = i < 0 ? 'Add site' : `Edit ${site.name}`;
  for (const f of FIELDS) {
    $form.elements[f].value = site[f];
    showError(f, '');
  }
  $('e-form').textContent = '';
  $('delete-site').hidden = i < 0;
  disarmDelete();
  $dialog.showModal();
}

/** Saves a change to the site list (and the web search choice that follows it). */
async function save(patch) {
  try {
    await chrome.storage.sync.set(patch);
  } catch (err) {
    $('e-form').textContent = `Couldn't save: ${err.message}`;
    return false;
  }
  Object.assign(prefs, patch);
  renderSites();
  renderControls();
  return true;
}

$form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { site, errors } = validateSite(Object.fromEntries(new FormData($form)), prefs.sites, editing);
  for (const f of FIELDS) showError(f, errors[f] || '');
  const invalid = FIELDS.find((f) => errors[f]);
  if (invalid) return $form.elements[invalid].focus();
  const next = editing < 0 ? [...prefs.sites, site] : prefs.sites.with(editing, site);
  const renamed = editing < 0 ? {} : { [prefs.sites[editing].keyword]: site.keyword };
  if (await save(sitesUpdate(prefs, next, renamed))) $dialog.close();
});
$form.addEventListener('input', (e) => showError(e.target.name, ''));

$('cancel').addEventListener('click', () => $dialog.close());
$('add-site').addEventListener('click', () => openEditor(-1));
renderSites();
renderControls();
