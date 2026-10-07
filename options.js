import { loadPrefs, watchPrefs, validateSite, shortcutKeys, faviconUrl } from './settings.js';

const $ = (id) => document.getElementById(id);
const prefs = await loadPrefs();

// ---------- theme ----------

const radios = document.querySelectorAll('input[name="theme"]');
for (const radio of radios) radio.checked = radio.value === prefs.theme;
// Commit the saved choice while the page is still unthemed (transitions off),
// so the switch's thumb doesn't slide into place on load.
getComputedStyle(document.querySelector('.seg'), '::before').transform;
watchPrefs(prefs, (changes) => {
  if (changes.theme) for (const radio of radios) radio.checked = radio.value === prefs.theme;
  if (changes.sites) renderSites();
});

for (const radio of radios) {
  radio.addEventListener('change', () => chrome.storage.sync.set({ theme: radio.value }));
}

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

// Extensions can't set their own shortcut; Chrome's shortcuts page can.
$('change-shortcut').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
window.addEventListener('focus', renderShortcut); // pick up a change made there
renderShortcut();

// ---------- site search ----------

const FIELDS = ['name', 'keyword', 'url'];
const $dialog = $('editor');
const $form = $('site-form');
const $delete = $('delete-site');
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
      li.querySelector('.favicon').src = faviconUrl(new URL(site.url).origin);
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

function openEditor(i) {
  editing = i;
  const site = prefs.sites[i] || { name: '', keyword: '', url: '' };
  $('editor-title').textContent = i < 0 ? 'Add site' : `Edit ${site.name}`;
  for (const f of FIELDS) {
    $form.elements[f].value = site[f];
    showError(f, '');
  }
  $('e-form').textContent = '';
  $delete.hidden = i < 0;
  disarmDelete();
  $dialog.showModal();
}

async function save(next) {
  try {
    await chrome.storage.sync.set({ sites: next });
  } catch (err) {
    $('e-form').textContent = `Couldn't save: ${err.message}`;
    return false;
  }
  prefs.sites = next;
  renderSites();
  return true;
}

$form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { site, errors } = validateSite(Object.fromEntries(new FormData($form)), prefs.sites, editing);
  for (const f of FIELDS) showError(f, errors[f] || '');
  const invalid = FIELDS.find((f) => errors[f]);
  if (invalid) return $form.elements[invalid].focus();
  if (await save(editing < 0 ? [...prefs.sites, site] : prefs.sites.with(editing, site))) $dialog.close();
});
$form.addEventListener('input', (e) => showError(e.target.name, ''));

// Delete asks for a second click instead of a confirm dialog on top of this one.
let armTimer;
function disarmDelete() {
  clearTimeout(armTimer);
  delete $delete.dataset.armed;
  $delete.textContent = 'Delete';
}
$delete.addEventListener('click', async () => {
  if (!('armed' in $delete.dataset)) {
    $delete.dataset.armed = '';
    $delete.textContent = 'Click again to delete';
    armTimer = setTimeout(disarmDelete, 3000);
    return;
  }
  disarmDelete();
  if (await save(prefs.sites.filter((_, i) => i !== editing))) $dialog.close();
});

$('cancel').addEventListener('click', () => $dialog.close());
$('add-site').addEventListener('click', () => openEditor(-1));
renderSites();
