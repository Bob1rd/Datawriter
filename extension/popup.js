// Toolbar popup: take a ZIP code or "Town, ST" and hand the ZIP to the panel on trackdatacenters.com.
// The ZIP table (1.7 MB) is imported on demand so the popup paints at once; it is prefetched right after.
let zipsPromise = null;
const zips = () => {
  if (!zipsPromise) zipsPromise = import('./data/zips.js').then((m) => m.ZIPS || {}, () => ({}));
  return zipsPromise;
};

const form = document.getElementById('f');
const input = document.getElementById('zip');
const hint = document.getElementById('hint');
const recentBox = document.getElementById('recent');
const sugList = document.getElementById('sug');

document.getElementById('states').textContent = DCF_STATES.states.filter((s) => s.listed !== false).map((s) => s.abbr).join(' · ');
function setBy() {
  document.getElementById('by').textContent = t('popup.by_version', { version: chrome.runtime.getManifest().version_name });
}
setBy();

async function describe(zip) {
  const z = (await zips())[zip]; // [lat, lon, place, county, state]
  return z ? `${z[2]}, ${z[4]}` : t('popup.outside_hint');
}

// ---- town suggestions (after four letters) ----
let suggestions = []; let active = -1;
function showSuggestions(list) {
  suggestions = list; active = list.length ? 0 : -1;
  sugList.hidden = !list.length;
  input.setAttribute('aria-expanded', String(!!list.length));
  sugList.textContent = '';
  list.forEach((p, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'option'); li.dataset.i = String(i);
    li.className = i === active ? 'on' : '';
    li.setAttribute('aria-selected', String(i === active));
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = `${p.name}, ${p.abbr}`;
    const st = document.createElement('span'); st.className = 'st'; st.textContent = `${p.county ? t('popup.sug_county_sep', { county: p.county }) : ''}${t('popup.sug_zip', { zip: p.zip })}`;
    li.append(nm, st);
    sugList.appendChild(li);
  });
}
function markActive() {
  [...sugList.children].forEach((li, i) => { li.classList.toggle('on', i === active); li.setAttribute('aria-selected', String(i === active)); });
}
function choosePlace(p) {
  input.value = p.label;
  showSuggestions([]);
  go(p.zip, p.label);
}
sugList.addEventListener('mousedown', (e) => {
  const li = e.target.closest('li[data-i]');
  if (li) { e.preventDefault(); choosePlace(suggestions[Number(li.dataset.i)]); }
});

input.addEventListener('input', async () => {
  hint.classList.remove('err');
  const raw = input.value;
  if (/^\s*\d/.test(raw)) {
    input.value = raw.replace(/\D/g, '').slice(0, 5);
    showSuggestions([]);
    const z = input.value;
    hint.textContent = '';
    if (z.length !== 5) return;
    const text = await describe(z);
    if (input.value === z) hint.textContent = text;
    return;
  }
  hint.textContent = '';
  const { name, bad } = DCF.parsePlace(raw);
  if (bad) { hint.textContent = t('popup.not_a_state', { bad }); showSuggestions([]); return; }
  if (name.replace(/[^A-Za-z0-9]/g, '').length < 4) { showSuggestions([]); return; }
  const ZIPS = await zips();
  if (input.value !== raw) return; // typed on while the table loaded
  const list = DCF.searchPlaces(ZIPS, raw, 8);
  showSuggestions(list);
  if (!list.length) hint.textContent = t('popup.no_town');
});
input.addEventListener('keydown', (e) => {
  if (sugList.hidden) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % suggestions.length; markActive(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + suggestions.length) % suggestions.length; markActive(); }
  else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choosePlace(suggestions[active]); }
  else if (e.key === 'Escape' || e.key === 'Tab') showSuggestions([]);
});

async function go(zip, label = '') {
  if (!/^\d{5}$/.test(zip)) {
    hint.textContent = t('popup.enter_zip_or_town');
    hint.classList.add('err');
    input.focus();
    return;
  }
  const { dcfRecent = [] } = await chrome.storage.local.get('dcfRecent');
  await chrome.storage.local.set({ dcfRecent: [zip, ...dcfRecent.filter((z) => z !== zip)].slice(0, 5) });
  hint.classList.remove('err');
  hint.textContent = t('popup.opening', { label: label || zip });
  const z = (await zips())[zip];
  const r = await chrome.runtime.sendMessage({ type: 'dcf-open', zip, state: z ? DCF.stateCode(z[4]) : '', label });
  if (r && r.ok === false) {
    hint.textContent = t('popup.open_failed', { error: r.error || t('popup.unknown_error') });
    hint.classList.add('err');
    return;
  }
  window.close();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (/^\d/.test(q)) { go(q); return; }
  const [best] = DCF.searchPlaces(await zips(), q, 1);
  if (best) choosePlace(best);
  else {
    hint.textContent = q.length >= 4 ? t('popup.no_town') : t('popup.type_zip_or_letters');
    hint.classList.add('err');
  }
});

function applyLanguage() {
  DCF_I18N.applyI18n(document);
  setBy();
  if (!sugList.hidden) showSuggestions(suggestions);
  if (/^\d{5}$/.test(input.value) && !hint.classList.contains('err')) {
    const z = input.value;
    describe(z).then((text) => { if (input.value === z) hint.textContent = text; });
  }
  showHome();
}

(async () => {
  await DCF_I18N.init();
  applyLanguage();
  addLanguageSelect();
  const { dcfRecent = [], dcfPrefs = {} } = await chrome.storage.local.get(['dcfRecent', 'dcfPrefs']);
  if (dcfPrefs.zip) {
    input.value = dcfPrefs.zip;
    input.select();
  }
  if (dcfRecent.length) {
    recentBox.hidden = false;
    const chips = recentBox.querySelector('.chips');
    for (const zip of dcfRecent) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = zip;
      b.addEventListener('click', () => go(zip));
      chips.appendChild(b);
    }
  }
  // Now that the popup is painted, load the ZIP table and fill in the place names.
  const ZIPS = await zips();
  if (/^\d{5}$/.test(dcfPrefs.zip || '') && input.value === dcfPrefs.zip) hint.textContent = await describe(dcfPrefs.zip);
  recentBox.querySelectorAll('.chips button').forEach((b) => { const z = ZIPS[b.textContent]; if (z) b.textContent = `${b.textContent} · ${z[2]}`; });
})();

// Home ZIP: where the writer lives, so letters sign from there and say "as your constituent" only to
// that town's, county's and state's officials, whatever ZIP is searched. Bundled ZIPs only here; the
// panel on the tracker can look up any other ZIP. The listener is attached at once, so a submit before
// the ZIP table has loaded cannot fall through to the form's native submission and reload the popup.
const homeForm = document.getElementById('home');
const homeInput = document.getElementById('homezip');
const homeHint = document.getElementById('homehint');
homeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const z = homeInput.value.replace(/\D/g, '').slice(0, 5);
  if (!z) { await chrome.storage.local.remove('dcfHome'); homeHint.textContent = t('popup.home_cleared'); return; }
  if (z.length < 5) { homeHint.textContent = t('popup.home_five_digits'); return; }
  const info = DCF.zipInfo(z, await zips());
  if (!info) { homeHint.textContent = t('popup.home_outside'); return; }
  await chrome.storage.local.set({ dcfHome: { ...info, ts: Date.now() } });
  homeHint.textContent = t('popup.home_set', { label: info.label });
});
function showHome() {
  chrome.storage.local.get('dcfHome').then(({ dcfHome }) => {
    if (dcfHome && dcfHome.zip) { homeInput.value = dcfHome.zip; homeHint.textContent = t('popup.home_set', { label: dcfHome.label }); }
  });
}

// Language select under the home form: writes the dcfLang override and re-applies every text.
function addLanguageSelect() {
  const sel = document.createElement('select');
  sel.id = 'lang';
  sel.setAttribute('aria-label', DCF_I18N.langs.map((c) => DCF_I18N.NAMES[c] || c).join(' / '));
  for (const code of DCF_I18N.langs) {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = DCF_I18N.NAMES[code] || code;
    sel.appendChild(o);
  }
  sel.value = DCF_I18N.lang;
  sel.addEventListener('change', async () => {
    DCF_I18N.lang = sel.value;
    await chrome.storage.local.set({ dcfLang: DCF_I18N.lang });
    applyLanguage();
  });
  homeForm.insertAdjacentElement('afterend', sel);
}
