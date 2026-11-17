// In-page panel for trackdatacenters.com: type a ZIP, see the nearest tracked data center in a covered state.
// Runs as a content script, so data requests come from the tracker's own page, the same way its map loads them.
(() => {
  if (window.__dcfPanel) return;
  window.__dcfPanel = true;

  const DATA_URL = (cursor) => `/api/data/data-centers?limit=500&cursor=${cursor}&fields=complete`;
  // The cache holds the tracker's whole download; coverage is applied when ranking, so the key only
  // changes when the stored shape does.
  const CACHE_KEY = 'dcfCacheV3';
  const OLD_CACHE_KEYS = ['dcfCache', 'dcfCacheV2'];
  const PREFS_KEY = 'dcfPrefs';
  const PENDING_KEY = 'dcfPending';
  const CACHE_MS = 30 * 60 * 1000;
  const NEARBY_COUNT = 6; // "Closest" list at first
  const NEARBY_MAX = 15; // after "Show more"

  // ---------- small utilities ----------

  const RAW = Symbol('raw');
  const raw = (s) => ({ [RAW]: String(s) });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function show(v) {
    if (v == null || v === false) return '';
    if (Array.isArray(v)) return v.map(show).join('');
    if (typeof v === 'object' && RAW in v) return v[RAW];
    return esc(v);
  }
  // Tagged template that escapes every interpolated value unless it was built with html`` or raw().
  function html(strings, ...vals) {
    let out = strings[0];
    vals.forEach((v, i) => { out += show(v) + strings[i + 1]; });
    return raw(out);
  }
  const setHTML = (el, frag) => { el.innerHTML = frag[RAW]; };
  // A catalog string with html`` fragments dropped into its {slots}, so markup stays out of the catalog.
  function tx(key, vars, slots = {}) {
    return html`${t(key, vars).split(/\{(\w+)\}/).map((part, i) => (i % 2 ? (part in slots ? slots[part] : `{${part}}`) : part))}`;
  }

  function safeHref(u) {
    const s = String(u || '').trim();
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/') && !s.startsWith('//')) return s;
    return '';
  }

  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const memStore = {};
  const store = {
    async get(key) {
      if (!hasChrome) return memStore[key];
      try { return (await chrome.storage.local.get(key))[key]; } catch { return undefined; }
    },
    async set(key, value) {
      if (!hasChrome) { memStore[key] = value; return; }
      try { await chrome.storage.local.set({ [key]: value }); } catch { /* storage full or unavailable: keep going without cache */ }
    },
    async remove(key) {
      if (!hasChrome) { delete memStore[key]; return; }
      try { await chrome.storage.local.remove(key); } catch { /* ignore */ }
    },
  };

  // The big data tables (ZIP codes, officials, photos) are ES modules loaded on first use, so visiting
  // the tracker costs nothing until someone opens the panel. Officials and portraits are bundled per
  // state (data/leaders/<xx>.js, data/photos/<xx>.js), so a search loads only the state it shows.
  const extUrl = (p) => (hasChrome && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL(p) : (window.__dcfBase || '/') + p);
  const mods = {};
  function mod(name) {
    if (!/^[a-z]+(\/[a-z]{2})?$/.test(name)) return Promise.resolve({});
    if (!mods[name]) mods[name] = import(extUrl(`data/${name}.js`)).catch(() => ({}));
    return mods[name];
  }
  const NO_LEADERS = { state: null, counties: {}, munis: {}, asOf: '' };
  async function leadersFor(stateName) {
    const abbr = DCF.STATE_ABBR[stateName];
    if (!abbr) return NO_LEADERS;
    const m = await mod(`leaders/${abbr.toLowerCase()}`);
    return { state: m.STATE || null, counties: m.COUNTIES || {}, munis: m.MUNIS || {}, asOf: m.AS_OF || '' };
  }

  // First and last name initials, ignoring nicknames, middle initials and suffixes ("Aisha N. Braveboy" -> "AB").
  function initials(name) {
    const words = String(name).replace(/["“”(].*?["“”)]/g, ' ').split(/\s+/)
      .filter((w) => /^[A-Z]/.test(w) && !/^(Jr|Sr|II|III|IV|Dr)\.?,?$/.test(w) && !/^[A-Z]\.$/.test(w));
    return words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] || '?')[0];
  }
  const minutesAgo = (ts) => {
    const m = Math.round((Date.now() - ts) / 60000);
    return m < 1 ? t('panel.just_now') : m === 1 ? t('panel.one_minute_ago') : t('panel.minutes_ago', { m });
  };

  // ---------- data ----------

  let dataCache = null; // { ts, rows }

  async function fetchAllDataCenters() {
    const rows = [];
    let cursor = 0;
    for (let page = 0; page < 20; page++) {
      const res = await fetch(DATA_URL(cursor), { headers: { 'X-App-Request': '1' }, credentials: 'same-origin' });
      if (!res.ok) throw new Error(t('panel.http_error', { status: res.status }));
      const body = await res.json();
      const batch = Array.isArray(body.data) ? body.data : [];
      rows.push(...batch);
      if (body.nextCursor == null || !batch.length) break;
      cursor = body.nextCursor;
    }
    // Keep every state: rankByDistance applies coverage, so a later coverage change never needs a cache reset.
    return rows.filter((r) => r && typeof r === 'object');
  }

  async function loadData(force = false) {
    if (!force && dataCache && Date.now() - dataCache.ts < CACHE_MS) return dataCache;
    if (!force) {
      const saved = await store.get(CACHE_KEY);
      if (saved && Array.isArray(saved.rows) && Date.now() - saved.ts < CACHE_MS) return (dataCache = saved);
    }
    const rows = await fetchAllDataCenters();
    dataCache = { ts: Date.now(), rows };
    await store.set(CACHE_KEY, dataCache);
    for (const key of OLD_CACHE_KEYS) store.remove(key);
    return dataCache;
  }

  async function lookupZip(zip) {
    const { ZIPS } = await mod('zips');
    const hit = DCF.zipInfo(zip, ZIPS);
    if (hit) return hit;
    if (!hasChrome || !chrome.runtime || !chrome.runtime.sendMessage) return null;
    try {
      const r = await chrome.runtime.sendMessage({ type: 'dcf-zip-lookup', zip });
      return r && Number.isFinite(r.lat) ? { zip, ...r, county: '', label: [r.place, r.state].filter(Boolean).join(', ') } : null;
    } catch {
      return null;
    }
  }

  const outsideHint = () => t('panel.outside_hint');
  const LISTED = DCF.STATES.filter((s) => s.listed !== false);
  const STATE_STRIP = LISTED.map((s) => s.abbr).join(' · ');
  const STATE_COUNT = DCF.STATES.filter((s) => s.abbr !== 'DC').length;
  const stateNames = LISTED.map((s) => (s.abbr === 'DC' ? 'DC' : s.name));
  const idleText = () => t('panel.idle_text', { states: stateNames.slice(0, -1).join(', '), last: stateNames[stateNames.length - 1] });

  // ---------- shell ----------

  const host = document.createElement('div');
  host.id = 'dcf-root';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = DCF_CSS;
  root.appendChild(style);

  const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z"/></svg>';
  const RACK = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="4" width="22" height="7" rx="2" fill="#fff"/><rect x="5" y="12.5" width="22" height="7" rx="2" fill="#fff" opacity=".85"/><rect x="5" y="21" width="22" height="7" rx="2" fill="#fff" opacity=".7"/><circle cx="9.5" cy="7.5" r="1.4" fill="#4b7a4e"/><circle cx="9.5" cy="16" r="1.4" fill="#4b7a4e"/><circle cx="9.5" cy="24.5" r="1.4" fill="#4b7a4e"/></svg>';

  const wrap = document.createElement('div');
  const $ = (sel) => root.querySelector(sel);
  let launch, drawer, form, input, hint, inactiveBox, body, goBtn, sugList, fullBtn, langSel;

  const shellLaunch = () => html`<button class="launch" type="button" title="${t('panel.launch_title')}">${raw(PIN)}<span>${t('panel.launch_label')}</span></button>`;
  const shellHeader = () => html`<header class="top">
        ${raw(RACK)}
        <div><div class="t" id="dcf-title">${t('panel.drawer_title')}</div><div class="s" title="${STATE_STRIP}">${t('panel.drawer_sub', { count: STATE_COUNT })}</div></div>
        <select class="lang" aria-label="${t('panel.language')}">${DCF_I18N.langs.map((code) => html`<option value="${code}" ${code === DCF_I18N.lang ? 'selected' : ''}>${DCF_I18N.NAMES[code]}</option>`)}</select>
        <button class="full-btn" type="button" aria-label="${t('panel.full_screen')}" title="${t('panel.full_screen')}" aria-pressed="false">⤢</button>
        <button class="x" type="button" aria-label="${t('panel.close_panel')}">×</button>
      </header>`;
  const shellSearch = () => html`<form class="search" novalidate>
        <label class="lbl" for="dcf-zip">${t('panel.zip_label')}</label>
        <div class="row">
          <input id="dcf-zip" type="text" autocomplete="off" maxlength="48" placeholder="${t('panel.zip_placeholder')}" aria-describedby="dcf-hint" role="combobox" aria-autocomplete="list" aria-expanded="false">
          <button class="btn-go" type="submit">${t('panel.find')}</button>
          <ul class="sug" role="listbox" hidden></ul>
        </div>
        <div class="hint" id="dcf-hint" aria-live="polite"></div>
        <label class="toggle"><input type="checkbox" class="inactive"> ${t('panel.include_inactive')}</label>
      </form>`;

  // The launch button, drawer header and search form. After the first build they are replaced in place
  // (the drawer, its body and the composer stay), so a language change keeps the search and the result.
  function renderShell() {
    let keep = null;
    if (!drawer) {
      setHTML(wrap, html`
    ${shellLaunch()}
    <aside class="drawer" role="dialog" aria-modal="false" aria-labelledby="dcf-title">
      ${shellHeader()}
      ${shellSearch()}
      <div class="body" tabindex="-1"></div>
    </aside>`);
      root.appendChild(wrap);
      drawer = $('.drawer');
      body = $('.body');
    } else {
      keep = { hidden: launch.hidden, value: input.value, hint: hint.textContent, err: hint.classList.contains('err'), inactive: inactiveBox.checked, disabled: goBtn.disabled };
      replaceWith(launch, shellLaunch());
      replaceWith($('header.top'), shellHeader());
      replaceWith(form, shellSearch());
      suggestions = []; sugActive = -1;
    }
    launch = $('.launch');
    form = $('.search');
    input = $('#dcf-zip');
    hint = $('.hint');
    inactiveBox = $('.inactive');
    goBtn = $('.btn-go');
    sugList = $('.sug');
    fullBtn = $('.full-btn');
    langSel = $('.lang');
    if (keep) {
      launch.hidden = keep.hidden;
      input.value = keep.value;
      hint.textContent = keep.hint;
      hint.classList.toggle('err', keep.err);
      inactiveBox.checked = keep.inactive;
      goBtn.disabled = keep.disabled;
      syncFullBtn(drawer.classList.contains('full'));
    }
    wireShell();
  }

  function wireShell() {
    launch.addEventListener('click', openDrawer);
    $('.x').addEventListener('click', closeDrawer);
    fullBtn.addEventListener('click', () => setFull(!isFull()));
    langSel.addEventListener('change', () => { const code = langSel.value; store.set('dcfLang', code); setLang(code); });
    sugList.addEventListener('mousedown', (e) => {
      const li = e.target.closest('li[data-i]');
      if (li) { e.preventDefault(); choosePlace(suggestions[Number(li.dataset.i)]); }
    });

    input.addEventListener('input', async () => {
      hint.classList.remove('err');
      const raw = input.value;
      if (/^\s*\d/.test(raw)) {
        // A ZIP: digits only, five at most.
        input.value = raw.replace(/\D/g, '').slice(0, 5);
        showSuggestions([]);
        const z = input.value;
        if (z.length < 5) { hint.textContent = ''; return; }
        const { ZIPS } = await mod('zips');
        if (input.value !== z) return;
        const hit = DCF.zipInfo(z, ZIPS);
        hint.textContent = hit ? hit.label : outsideHint();
        return;
      }
      hint.textContent = '';
      const { name, bad } = DCF.parsePlace(raw);
      if (bad) { hint.textContent = t('panel.not_a_state', { bad }); showSuggestions([]); return; }
      if (name.replace(/[^A-Za-z0-9]/g, '').length < 4) { showSuggestions([]); return; }
      if (!dataCache) loadData().catch(() => {}); // so project names can appear on the next keystroke
      const { ZIPS } = await mod('zips');
      if (input.value !== raw) return;
      const towns = DCF.searchPlaces(ZIPS, raw, 6);
      const list = [...towns, ...searchProjects(raw, towns.length ? 3 : 6)];
      showSuggestions(list);
      if (!list.length) hint.textContent = t('panel.no_town_or_project');
    });
    input.addEventListener('keydown', (e) => {
      if (sugList.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); sugActive = (sugActive + 1) % suggestions.length; markActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sugActive = (sugActive - 1 + suggestions.length) % suggestions.length; markActive(); }
      else if (e.key === 'Enter' && sugActive >= 0) { e.preventDefault(); choosePlace(suggestions[sugActive]); }
      else if (e.key === 'Tab') showSuggestions([]);
    });
    input.addEventListener('blur', () => setTimeout(() => showSuggestions([]), 150));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      search(input.value);
    });

    inactiveBox.addEventListener('change', async () => {
      await savePrefs();
      if (state.origin) runRanking().catch(showRenderError);
    });
  }

  // The interface language: the drawer's own select or the popup's (through chrome.storage.onChanged).
  function setLang(code) {
    const next = DCF_I18N.langs.includes(code) ? code : 'en';
    if (next === DCF_I18N.lang) return;
    DCF_I18N.lang = next;
    state.altFor = null; // the comparison decks hold rendered text, so they are rebuilt in the new language
    renderShell();
    rerenderView();
  }
  // Redraw what is on screen in the current language: the result and the composer over it, or the idle text.
  function rerenderView() {
    if (body.querySelector('.hero') && state.ranked.length) {
      const y = body.scrollTop;
      renderResult().then(() => { body.scrollTop = y; if (!composer.hidden) renderComposer(); }, showRenderError);
      return;
    }
    if (body.querySelector('.state.idle') && !state.origin) setStatus('idle', idleText());
    if (!composer.hidden) renderComposer();
  }

  renderShell();

  // Follow the tracker's own light/dark switch.
  const syncTheme = () => host.classList.toggle('dark', document.documentElement.dataset.theme === 'dark');
  syncTheme();
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function openDrawer() {
    drawer.classList.add('open');
    launch.hidden = true;
    mod('zips'); // warm up the ZIP table so the as-you-type hint is instant
    setTimeout(() => input.focus(), 50);
    focusedKey = '';
    if (state.ranked.length) focusMap();
    showTour();
  }

  // First open only: three lines on what this tool is for, then out of the way for good.
  const TOUR_KEY = 'dcfTourSeen';
  let tourChecked = false;
  async function showTour() {
    if (tourChecked) return;
    tourChecked = true;
    if (await store.get(TOUR_KEY)) return;
    const tour = document.createElement('div');
    tour.className = 'tour';
    tour.setAttribute('role', 'dialog');
    tour.setAttribute('aria-labelledby', 'dcf-tour-title');
    setHTML(tour, html`<div class="tcard">
      <div class="tt" id="dcf-tour-title">${t('panel.tour_title')}</div>
      <ol>
        <li><span class="ti">1</span><span><b>${t('panel.tour_step1_lead')}</b> ${t('panel.tour_step1')}</span></li>
        <li><span class="ti">2</span><span><b>${t('panel.tour_step2_lead')}</b> ${t('panel.tour_step2')}</span></li>
        <li><span class="ti">3</span><span><b>${t('panel.tour_step3_lead')}</b> ${t('panel.tour_step3')}</span></li>
      </ol>
      <button type="button" class="btn primary">${t('panel.tour_got_it')}</button>
      <div class="tf">${t('panel.tour_footer')}</div>
    </div>`);
    drawer.appendChild(tour);
    const done = () => { tour.remove(); store.set(TOUR_KEY, Date.now()); input.focus(); };
    tour.querySelector('button').addEventListener('click', done);
    tour.addEventListener('click', (e) => { if (e.target === tour) done(); });
    tour.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(); } });
    setTimeout(() => tour.querySelector('button').focus(), 60);
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    launch.hidden = false;
    launch.focus();
  }
  // Full screen: the drawer fills the page instead of sitting beside the tracker's map.
  function syncFullBtn(on) {
    fullBtn.textContent = on ? '⤡' : '⤢';
    fullBtn.title = on ? t('panel.back_to_sidebar') : t('panel.full_screen');
    fullBtn.setAttribute('aria-label', fullBtn.title);
    fullBtn.setAttribute('aria-pressed', String(on));
  }
  function setFull(on, { save = true } = {}) {
    drawer.classList.toggle('full', on);
    syncFullBtn(on);
    if (save) savePrefs();
    focusedKey = ''; // the map may have moved meanwhile, so the next sidebar view refocuses it
    if (!on) focusMap(); // back in sidebar mode, show the chosen project on the tracker's map again
  }
  const isFull = () => drawer.classList.contains('full');

  // A short notice at the bottom of the drawer (map moved, or why it could not).
  let toastTimer = 0;
  function toast(text, isError = false) {
    let el = root.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; drawer.appendChild(el); }
    el.textContent = text;
    el.classList.toggle('err', isError);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), isError ? 7000 : 2200);
  }

  // In sidebar mode, fly the tracker's own map to the chosen project (open = also open its card there).
  let focusedKey = '';
  async function focusMap(open = false) {
    if (!hasChrome || !chrome.runtime || !chrome.runtime.sendMessage) return;
    if (!drawer.classList.contains('open') || (isFull() && !open)) return;
    const hit = state.ranked[state.idx];
    if (!hit || !Number.isFinite(hit.site.lat) || !Number.isFinite(hit.site.lon)) return;
    const key = `${hit.rec.id}#${hit.site.lat},${hit.site.lon}`;
    if (!open && key === focusedKey) return;
    focusedKey = key;
    // The tracker's map only holds the projects of the state page that is open. If the project is in
    // another state, switch the page to that state first and carry this search along.
    const pageState = (location.pathname.match(/^\/usa\/([^/]+)/) || [])[1] || '';
    const info = DCF.stateInfo(hit.rec.state) || {};
    const wantState = info.trackerPage || '';
    if (pageState && !wantState && info.name) {
      // Registered, with projects in the API, but the tracker has no page for the state yet (Iowa in Oct 2026).
      toast(t('panel.toast_no_map_page', { state: hit.rec.state, project: hit.rec.name }));
      return;
    }
    if (pageState && wantState && pageState !== wantState && state.noNavFor !== hit.rec.id) {
      toast(t('panel.toast_switching', { state: hit.rec.state }));
      try {
        await chrome.runtime.sendMessage({ type: 'dcf-goto-state', page: wantState, zip: state.origin.zip, query: state.origin.zip ? input.value : hit.rec.name, idx: state.idx, navFor: hit.rec.id });
      } catch (err) {
        toast(t('panel.toast_switch_failed', { error: err && err.message ? err.message : err }), true);
      }
      return;
    }
    let res = null;
    try {
      res = await chrome.runtime.sendMessage({ type: 'dcf-map-focus', lat: hit.site.lat, lon: hit.site.lon, zoom: 13, id: hit.rec.id, open });
    } catch (err) {
      focusedKey = '';
      toast(t('panel.toast_no_background', { error: err && err.message ? err.message : err }), true);
      return;
    }
    if (!res) { focusedKey = ''; toast(t('panel.toast_no_answer'), true); return; }
    if (res.ok === false) { focusedKey = ''; toast(t('panel.toast_map_failed', { error: res.error || t('panel.unknown_error') }), true); return; }
    toast(open && res.opened ? t('panel.toast_opened', { project: hit.rec.name }) : t('panel.toast_map_moved', { project: hit.rec.name, filtered: open && !res.opened ? t('panel.toast_marker_filtered') : '' }));
  }
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!sugList.hidden) { showSuggestions([]); return; } // first Escape closes the town list, the next the drawer
    closeDrawer();
  });

  // ---------- search state ----------

  const state = { origin: null, ranked: [], idx: 0, view: 'site', showAllSources: false, alt: null, altFor: null, animatedFor: null, pendingIdx: 0, noNavFor: null, topIdx: [], sites: { muni: '', county: '' }, nearMore: false, home: null, withInactive: false };

  // The box takes a ZIP code or "Town, ST". Town suggestions appear once four letters are typed.
  let suggestions = []; let sugActive = -1;
  function showSuggestions(list) {
    suggestions = list; sugActive = list.length ? 0 : -1;
    sugList.hidden = !list.length;
    input.setAttribute('aria-expanded', String(!!list.length));
    setHTML(sugList, html`${list.map((p, i) => html`<li role="option" data-i="${i}" class="${i === sugActive ? 'on' : ''}" aria-selected="${String(i === sugActive)}">${p.kind === 'project'
      ? html`<span class="nm">${p.name}</span><span class="st">${t('panel.sug_project', { sub: p.sub })}</span>`
      : html`<span class="nm">${p.name}, ${p.abbr}</span><span class="st">${p.county ? t('panel.sug_county_sep', { county: p.county }) : ''}${t('panel.sug_zip', { zip: p.zip })}</span>`}</li>`)}`);
  }
  function markActive() {
    [...sugList.children].forEach((li, i) => { li.classList.toggle('on', i === sugActive); li.setAttribute('aria-selected', String(i === sugActive)); });
  }
  function choosePlace(p) {
    input.value = p.label;
    showSuggestions([]);
    if (p.kind === 'project') pickProject(p.rec);
    else search(p.zip, false, p.label);
  }

  // Project names from the cached rows, for the search box. Exact, then word-start, then substring.
  const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function searchProjects(query, limit = 5) {
    const rows = (dataCache && dataCache.rows) || [];
    const k = normName(query);
    if (k.length < 4) return [];
    const scored = [];
    for (const rec of rows) {
      if (!DCF.inCoverage(rec)) continue;
      const name = normName(rec.name);
      if (!name) continue;
      const score = name === k ? 3 : name.startsWith(k) ? 2 : name.includes(k) ? 1 : 0;
      if (score) scored.push({ rec, score });
    }
    return scored.sort((a, b) => b.score - a.score || a.rec.name.localeCompare(b.rec.name)).slice(0, limit)
      .map(({ rec }) => ({ kind: 'project', rec, name: rec.name, label: rec.name, sub: t('panel.sug_phase_place', { phase: DCF.phaseLabel(rec.phase), place: DCF.placeLine(rec.municipality) }) }));
  }

  // Show one project chosen by name. Distances stay measured from the searched ZIP when there is one;
  // otherwise the project's own site stands in as the origin.
  async function pickProject(rec) {
    goBtn.disabled = true;
    setStatus('loading', t('panel.finding_project', { project: rec.name }));
    try {
      await loadData();
      if (!state.origin || !state.origin.zip) {
        const site = DCF.sitePoints(rec)[0];
        if (!site) { hint.textContent = t('panel.no_location', { project: rec.name }); hint.classList.add('err'); setStatus('idle', idleText()); return; }
        const muni = rec.municipality || {};
        state.origin = { zip: '', lat: site.lat, lon: site.lon, place: (muni.towns || [])[0] || rec.name, county: (muni.counties || [])[0] || '', state: DCF.stateCode(rec.state) || rec.state, label: DCF.placeLine(muni) };
      }
      // A withdrawn or rejected project is shown for this pick only; the checkbox and its saved preference stay as they are.
      state.withInactive = DCF.INACTIVE_PHASES.has(String(rec.phase || '').toLowerCase());
      if (state.withInactive && !inactiveBox.checked) toast(t('panel.inactive_toast', { name: rec.name, phase: DCF.phaseLabel(rec.phase).toLowerCase() }));
      state.view = 'site';
      const ranked = DCF.rankByDistance(dataCache.rows, state.origin.lat, state.origin.lon, { includeInactive: inactiveBox.checked || state.withInactive });
      const idx = ranked.findIndex((h) => h.rec.id === rec.id);
      if (idx < 0) toast(t('panel.no_location_nearest', { project: rec.name }), true);
      state.pendingIdx = Math.max(0, idx);
      await runRanking();
      state.nearMore = idx >= NEARBY_COUNT;
      const near = body.querySelector('section.near-blk');
      if (state.nearMore && near) replaceWith(near, nearby());
    } catch (err) {
      showRenderError(err);
    } finally {
      goBtn.disabled = false;
    }
  }
  // "Town, ST" -> the town's central ZIP; a bare ZIP passes through.
  async function resolveQuery(q) {
    q = String(q || '').trim();
    if (DCF.isZip(q)) return { zip: q, label: '' };
    const { ZIPS } = await mod('zips');
    const [best] = DCF.searchPlaces(ZIPS, q, 1);
    if (best) return { zip: best.zip, label: best.label };
    await loadData().catch(() => null);
    const [proj] = searchProjects(q, 1);
    return proj ? { project: proj.rec } : null;
  }

  async function savePrefs() {
    await store.set(PREFS_KEY, { zip: input.value, includeInactive: inactiveBox.checked, full: isFull() });
  }

  function setStatus(kind, text, extra) {
    if (kind === 'loading') {
      setHTML(body, html`<div class="state"><div class="spinner"></div><p>${text}</p></div>`);
    } else {
      setHTML(body, html`<div class="state ${kind}"><p>${text}</p>${extra || ''}</div>`);
      const retry = body.querySelector('.retry');
      if (retry) retry.addEventListener('click', () => search(input.value, true));
    }
  }

  async function search(query, force = false, shown = '') {
    goBtn.disabled = true;
    const resolved = await resolveQuery(query).finally(() => { goBtn.disabled = false; });
    if (!resolved) {
      hint.textContent = DCF.parsePlace(query).name.length >= 4
        ? t('panel.no_town_or_project_submit')
        : t('panel.enter_zip_or_town');
      hint.classList.add('err');
      input.focus();
      return;
    }
    if (resolved.project) { input.value = resolved.project.name; showSuggestions([]); return pickProject(resolved.project); }
    const zip = resolved.zip;
    input.value = shown || resolved.label || zip;
    showSuggestions([]);
    goBtn.disabled = true;
    setStatus('loading', t('panel.finding_nearest'));
    try {
      const origin = await lookupZip(zip);
      if (!origin) {
        hint.textContent = t('panel.zip_not_found', { zip });
        hint.classList.add('err');
        setStatus('idle', idleText());
        return;
      }
      hint.classList.remove('err');
      hint.textContent = origin.label;
      await loadData(force);
      state.origin = origin;
      state.view = 'site';
      state.withInactive = false;
      await savePrefs();
      await runRanking();
    } catch (err) {
      setStatus('error', t('panel.load_error', { error: err && err.message ? err.message : '' }), html`<button class="retry" type="button">${t('panel.try_again')}</button>`);
    } finally {
      goBtn.disabled = false;
    }
  }

  async function runRanking() {
    closeComposer(); // the roster is rebuilt below, so the composer's recipient indexes would point at the wrong people
    state.ranked = DCF.rankByDistance(dataCache.rows, state.origin.lat, state.origin.lon, { includeInactive: inactiveBox.checked || state.withInactive });
    state.idx = state.pendingIdx && state.pendingIdx < state.ranked.length ? state.pendingIdx : 0;
    state.pendingIdx = 0;
    state.showAllSources = false;
    state.nearMore = false;
    state.altFor = null;
    state.animatedFor = null;
    if (!state.ranked.length) {
      setStatus('idle', t('panel.no_match'));
      return;
    }
    await renderResult();
  }

  // ---------- rendering ----------

  function phaseChip(phase) {
    const key = String(phase || '').toLowerCase();
    return html`<span class="chip ph-${key.replace(/[^a-z]/g, '')}">${DCF.phaseLabel(phase)}</span>`;
  }

  function picture(hit) {
    const views = [['site', t('panel.view_satellite')], ['area', t('panel.view_area')], ...(state.origin && state.origin.zip ? [['trip', t('panel.view_trip')]] : [])];
    const v = DCF.imageView(hit.site, state.view, state.origin);
    const conf = hit.site.locationConfidence || hit.rec.locationConfidence;
    let overlay = '';
    if (state.view === 'trip') {
      const [ox, oy] = v.origin;
      const [sx, sy] = v.site;
      const badge = t('panel.pic_zip_badge', { zip: state.origin.zip });
      const badgeWidth = [...badge].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 14 : 9), 4);
      overlay = html`
        <line x1="${ox}" y1="${oy}" x2="${sx}" y2="${sy}" stroke="#c62828" stroke-width="3" stroke-dasharray="8 6" stroke-linecap="round"/>
        <circle cx="${ox}" cy="${oy}" r="8" fill="#1565c0" stroke="#fff" stroke-width="3"/>
        <rect x="${ox + 12}" y="${oy - 13}" width="${badgeWidth}" height="24" rx="6" fill="#1565c0"/>
        <text x="${ox + 20}" y="${oy + 4}" fill="#fff" font-size="13" font-weight="700" font-family="Roboto Flex, Arial, sans-serif">${badge}</text>
        <g transform="translate(${sx - 16} ${sy - 40}) scale(1.35)"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z" fill="#c62828" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></g>`;
    } else if (v.rings.length) {
      overlay = v.rings.map((ring) => html`<polygon points="${ring.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="rgba(255,213,79,.18)" stroke="#ffd54f" stroke-width="2.5" stroke-linejoin="round"/>`);
    } else {
      const [sx, sy] = v.site;
      const ring = conf === 'exact' ? '' : html`<circle cx="${sx}" cy="${sy}" r="${conf === 'uncertain' ? 90 : 60}" fill="rgba(255,213,79,.12)" stroke="#ffd54f" stroke-width="2" stroke-dasharray="7 5"/>`;
      overlay = html`${ring}<g transform="translate(${sx - 16} ${sy - 40}) scale(1.35)"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7z" fill="#c62828" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></g>`;
    }
    const outline = state.view === 'trip'
      ? t('panel.straight_line', { miles: hit.miles.toFixed(1) })
      : v.rings.length ? t('panel.outline_caption') : DCF.CONFIDENCE[conf] || t('panel.pin_caption');
    const attribution = state.view === 'trip' ? t('panel.attribution_map') : t('panel.attribution_imagery');
    return html`
      <figure class="pic">
        <div class="views" role="group" aria-label="${t('panel.picture_view_group')}">
          ${views.map(([key, text]) => html`<button type="button" data-view="${key}" aria-pressed="${String(state.view === key)}">${text}</button>`)}
        </div>
        <div class="frame">
          <div class="loading">${t('panel.loading_imagery')}</div>
          <img alt="${state.view === 'trip' ? t('panel.img_alt_trip', { zip: state.origin.zip, project: hit.rec.name }) : t('panel.img_alt_site', { project: hit.rec.name })}" src="${v.url}" referrerpolicy="no-referrer">
          <svg viewBox="0 0 ${v.w} ${v.h}" preserveAspectRatio="xMidYMid slice">${overlay}</svg>
        </div>
        <figcaption class="cap">${t('panel.caption_join', { outline, attribution })}</figcaption>
      </figure>`;
  }

  function mediaBlock(rec) {
    const items = (Array.isArray(rec.media) ? rec.media : []).filter((m) => safeHref(m.src));
    if (!items.length) return '';
    return items.slice(0, 2).map((m) => {
      const src = safeHref(m.src);
      const credit = m.credit ? (safeHref(m.creditUrl) ? html`<a href="${safeHref(m.creditUrl)}" target="_blank" rel="noopener">${m.credit}</a>` : m.credit) : '';
      const el = m.type === 'video'
        ? html`<video controls preload="metadata" src="${src}"></video>`
        : html`<img src="${src}" alt="${m.caption || rec.name}">`;
      const mcap = m.caption && credit ? tx('panel.media_caption_join', { caption: m.caption }, { credit }) : html`${m.caption || ''}${credit}`;
      return html`<div class="media">${el}<div class="mcap">${mcap}</div></div>`;
    });
  }

  const ICON_MAIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" d="M3.5 6.5h17v11h-17zM3.5 7l8.5 6 8.5-6"/></svg>';
  const ICON_PHONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M6.6 3.5h3l1.6 4-2 1.4a11 11 0 0 0 5.9 5.9l1.4-2 4 1.6v3a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 4.6 5.6a2 2 0 0 1 2-2.1z"/></svg>';
  const ICONS = {
    power: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 2 4 13.5h6.2L9 22l10-12.2h-6.3z"/></svg>',
    land: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 20h18v2H3zm4-2-4-6 4-6 4 6zm8-2-3-4.5L15 7l3 4.5zm-2.5 2L16 13l5 5z"/></svg>',
    building: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 21V8l9-5 9 5v13h-6v-6H9v6zm4-9h2v-2H7zm4 0h2v-2h-2zm4 0h2v-2h-2z"/></svg>',
    cost: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 2h2v2.1c2.3.3 4 1.8 4.2 4h-2.4c-.2-1.1-1.3-1.9-2.8-1.9-1.7 0-2.8.8-2.8 2 0 1.1.9 1.6 3.1 2.1 3.1.7 5.1 1.7 5.1 4.4 0 2.3-1.8 3.9-4.4 4.2V21h-2v-2.1c-2.6-.3-4.4-1.9-4.6-4.3h2.4c.2 1.3 1.5 2.2 3.2 2.2 1.8 0 3-.8 3-2.1 0-1.1-.8-1.7-3.3-2.2C8.8 11.9 7 10.8 7 8.3c0-2.1 1.6-3.8 4-4.2z"/></svg>',
    carbon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 19a5 5 0 0 1-.6-9.96A6.5 6.5 0 0 1 18.9 10.2 4.5 4.5 0 0 1 18 19z"/></svg>',
    jobs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm7 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 19.5C2 16.5 5.1 14 9 14s7 2.5 7 5.5V21H2zm15.5 1.5v-1.5c0-1.6-.6-3-1.6-4.2 3.3.3 6.1 2.3 6.1 4.7V21z"/></svg>',
    timeline: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h2v2h6V2h2v2h3v18H4V4h3zm-1 7v11h12V9zm2 2h3v3H8z"/></svg>',
  };

  // One "big figure" card: headline number, then plain-English comparisons.
  function figure(kind, labelText, big, unit, lines, extra = '') {
    return html`<div class="fig ${kind}">
      <div class="ico">${raw(ICONS[kind])}</div>
      <div class="fbody">
        <div class="fk">${labelText}</div>
        <div class="big"><span class="num">${big}</span>${unit ? html`<span class="unit">${unit}</span>` : ''}</div>
        ${lines.length ? html`<ul class="ana">${lines.map((text) => html`<li>${text}</li>`)}</ul>` : ''}
        ${extra}
      </div>
    </div>`;
  }

  function meter(share, caption) {
    const pct = Math.min(share, 1) * 100;
    return html`<div class="meter" role="img" aria-label="${caption}"><span data-w="${pct.toFixed(1)}"></span>${share > 1 ? html`<em>×${String(Number(share.toFixed(1)))}</em>` : ''}</div><div class="mcap">${caption}</div>`;
  }

  // Shuffle the "could instead…" comparisons once per project, so re-renders keep the same ones.
  function buildDecks(rec, inputs) {
    if (state.altFor === rec.id && state.alt) return;
    state.altFor = rec.id;
    state.alt = {};
    for (const { kind, value, heading } of inputs) {
      if (value) state.alt[kind] = { items: DCF_PERSPECTIVES.deck(kind, value, { state: rec.state }), i: 0, heading };
    }
  }

  function fillTemplate(item) {
    return item.text.split(/\{(\w+)\}/).map((part, i) => (i % 2 ? (item[part] != null ? html`<b>${item[part]}</b>` : `{${part}}`) : part));
  }

  function altBlock(kind) {
    const d = state.alt && state.alt[kind];
    if (!d || !d.items.length) return '';
    const shown = [...new Set([0, 1].map((k) => d.items[(d.i + k) % d.items.length]))];
    return html`<div class="alt" data-kind="${kind}">
      <div class="alt-h">${d.heading}</div>
      <ul>${shown.map((item) => html`<li>${fillTemplate(item)}</li>`)}</ul>
      ${d.items.length > 2 ? html`<button type="button" class="shuffle" data-kind="${kind}">${t('panel.another_comparison')}</button>` : ''}
    </div>`;
  }

  function numbers(rec) {
    const mw = DCF.metric(rec, 'capacityMw', 'capacityMaxMw');
    const acres = DCF.metric(rec, 'sizeAcres', 'sizeAcresMax');
    const sqft = DCF.metric(rec, 'facilitySizeSqft');
    const buildings = DCF.metric(rec, 'numberOfBuildings', 'numberOfBuildingsMax');
    const cost = DCF.costInfo(rec);
    const cards = [];
    const missing = [];
    const H = DCF_PERSPECTIVES.HEADINGS;
    // Ranges: size comparisons use the top of the range (matching "up to"); money uses the low end.
    buildDecks(rec, [
      { kind: 'power', value: (mw.max || mw.min) * 8760, heading: H.power },
      { kind: 'land', value: acres.max || acres.min, heading: H.land },
      { kind: 'floor', value: sqft.min, heading: H.floor },
      { kind: 'money', value: cost.low, heading: cost.high > cost.low ? t('panel.money_heading_low', { amount: DCF.money(cost.low) }) : H.money },
    ]);

    if (mw.min) {
      const top = mw.max || mw.min;
      const p = DCF.powerCompare(top, rec.state);
      const upTo = mw.max ? t('panel.up_to') : '';
      const shareText = p.share >= 0.995
        ? t('panel.share_times', { share: String(Number(p.share.toFixed(1))), city: p.city.name })
        : t('panel.share_percent', { percent: Math.max(1, Math.round(p.share * 100)), city: p.city.name });
      const atTop = upTo ? t('panel.at_top', { mw: DCF.count(top) }) : t('panel.it');
      cards.push(figure('power', t('panel.power_capacity'), DCF.range(mw.min, mw.max, DCF.count), t('panel.unit_mw'), [
        tx('panel.power_homes', { atTop }, { homes: html`<b>${p.homes}</b>` }),
        tx('panel.power_city', { city: p.city.name }, { time: html`<b>${p.cityTime}</b>` }),
      ], html`${meter(p.share, `${upTo ? t('panel.up_to_cap') : ''}${shareText}`)}${altBlock('power')}`));
    } else missing.push(t('panel.missing_power'));

    // Carbon at full load, from the state's grid rate or the gas rate for an on-site gas plant.
    const carbon = mw.min ? DCF.carbonCompare(mw.max || mw.min, rec) : null;
    if (carbon) {
      cards.push(figure('carbon', t('panel.carbon'), carbon.tonsText, t('panel.carbon_unit'), [
        tx('panel.carbon_cars', {}, { cars: html`<b>${carbon.cars}</b>` }),
      ], html`<div class="fnote">${carbon.gas ? t('panel.carbon_gas_note') : t('panel.carbon_grid_note', { state: rec.state, year: carbon.year })}</div>`));
    }

    if (acres.min) {
      const top = acres.max || acres.min;
      const l = DCF.landCompare(top);
      const upTo = acres.max ? t('panel.up_to_cap') : '';
      const lines = [tx('panel.land_fields', { upTo }, { fields: html`<b>${l.fields}</b>` })];
      if (l.park) lines.push(l.parkShare >= 0.95 && l.parkShare < 1.05 ? html`${t('panel.central_park_about')}` : l.parkShare >= 0.995 ? tx('panel.central_park_times', {}, { ratio: html`<b>${l.park}</b>` }) : tx('panel.central_park_share', {}, { ratio: html`<b>${l.park}</b>` }));
      cards.push(figure('land', t('panel.land'), DCF.range(acres.min, acres.max, DCF.count), l.sqmi ? t('panel.unit_acres_sqmi', { sqmi: l.sqmi }) : t('panel.unit_acres'), lines, altBlock('land')));
    } else missing.push(t('panel.missing_land'));

    if (sqft.min || buildings.min) {
      const lines = [];
      const noun = (buildings.max || buildings.min) === 1 ? t('panel.building_one') : t('panel.building_many');
      const bText = buildings.min ? t('panel.buildings_text', { range: DCF.range(buildings.min, buildings.max, DCF.count), noun }) : '';
      if (sqft.min) {
        const f = DCF.floorCompare(sqft.min);
        lines.push(tx('panel.floor_fields', {}, { fields: html`<b>${f.fields}</b>` }));
        if (f.pentagon) lines.push(f.pentagonShare >= 0.995 ? tx('panel.pentagon_times', {}, { ratio: html`<b>${f.pentagon}</b>` }) : tx('panel.pentagon_share', {}, { ratio: html`<b>${f.pentagon}</b>` }));
        if (bText) lines.push(tx('panel.spread_across', {}, { buildings: html`<b>${bText}</b>` }));
        cards.push(figure('building', t('panel.building_size'), DCF.count(sqft.min), t('panel.unit_sqft'), lines, altBlock('floor')));
      } else {
        cards.push(figure('building', t('panel.buildings_planned'), DCF.range(buildings.min, buildings.max, DCF.count), noun, []));
        missing.push(t('panel.missing_floor'));
      }
    } else missing.push(t('panel.missing_building'));

    const per = cost.kind !== 'none' ? DCF.perResident(cost.low, cost.high, rec.state) : null;
    const perLine = per ? [tx('panel.per_resident', { who: per.who }, { amount: html`<b>${per.text}</b>` })] : [];
    if (cost.kind === 'reported') {
      cards.push(figure('cost', html`${t('panel.project_cost')} <span class="tag rep">${t('panel.tag_reported')}</span>`, cost.text, '', perLine,
        html`${altBlock('money')}<div class="fnote">${t('panel.cost_published', { qualifier: cost.qualifier ? t('panel.cost_qualifier', { qualifier: cost.qualifier }) : '' })}</div>`));
    } else if (cost.kind === 'estimate') {
      cards.push(figure('cost', html`${t('panel.project_cost')} <span class="tag est">${t('panel.tag_estimate')}</span>`, cost.text, '', perLine,
        html`${altBlock('money')}<div class="fnote">${t('panel.cost_estimate_note', { basis: cost.basis })}</div>`));
    } else missing.push(t('panel.missing_cost'));

    // Permanent jobs, set against the land and the money.
    const jobsL = DCF.metric(rec, 'jobsLongTerm').min;
    const jobsC = DCF.metric(rec, 'jobsConstruction').min;
    if (jobsL) {
      const lines = [];
      const topAcres = acres.max || acres.min;
      if (topAcres && jobsL < topAcres) lines.push(tx('panel.jobs_per_acre', {}, { acres: html`<b>${DCF.friendly(topAcres / jobsL)}</b>` }));
      if (cost.kind !== 'none' && cost.low) lines.push(tx('panel.cost_per_job', {}, { amount: html`<b>${DCF.money(cost.low / jobsL)}</b>` }));
      if (jobsC) lines.push(tx('panel.jobs_construction_line', {}, { n: html`<b>${DCF.count(jobsC)}</b>` }));
      cards.push(figure('jobs', t('panel.jobs_card'), DCF.count(jobsL), jobsL === 1 ? t('panel.jobs_unit_one') : t('panel.jobs_unit_many'), lines,
        html`<div class="fnote">${t('panel.jobs_note')}</div>`));
    } else missing.push(t('panel.missing_jobs'));

    // Announcement to planned opening.
    const tl = DCF.timeline(rec);
    if (tl) {
      cards.push(figure('timeline', t('panel.timeline'), tl.yearsText, Number(tl.yearsText) === 1 ? t('panel.timeline_unit_one') : t('panel.timeline_unit_many'), [
        tx('panel.timeline_announced', {}, { date: html`<b>${tl.announced}</b>` }),
        tx('panel.timeline_online', {}, { date: html`<b>${tl.online}</b>` }),
      ], html`<div class="fnote">${t('panel.timeline_note')}</div>`));
    }

    const hasAlt = state.alt && Object.values(state.alt).some((d) => d.items.length);
    return html`<section class="numbers">
      <h3>${t('panel.by_the_numbers')}</h3>
      ${cards}
      ${missing.length ? html`<div class="missing">${t('panel.not_disclosed', { list: missing.join(', ') })}</div>` : ''}
      ${hasAlt ? html`<div class="missing">${t('panel.could_instead_note')}</div>` : ''}
    </section>`;
  }

  // "Did you know?": one short, sourced fact at a time, chosen by the project so it varies between
  // projects. The jobs fact is computed from the tracker's own records.
  const DYK = ['depreciation', 'jobs', 'power'];
  function dykFacts() {
    const rows = (dataCache && dataCache.rows) || [];
    const median = (key) => { const v = rows.map((r) => DCF.metric(r, key).min).filter((x) => x > 0).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; };
    const perm = median('jobsLongTerm');
    const build = median('jobsConstruction');
    return {
      depreciation: t('panel.dyk_depreciation'),
      jobs: perm && build ? t('panel.dyk_jobs', { perm: DCF.count(perm), build: DCF.count(build) }) : '',
      power: t('panel.dyk_power'),
    };
  }
  function didYouKnow(rec) {
    const facts = dykFacts();
    const keys = DYK.filter((k) => facts[k]);
    if (!keys.length) return '';
    const i = ((state.dykOffset || 0) + Math.abs(Number(rec.id) || 0)) % keys.length;
    return html`<section class="dyk" data-i="${i}">
      <h3>${t('panel.dyk_heading')}</h3>
      <p>${facts[keys[i]]}</p>
      ${keys.length > 1 ? html`<button type="button" class="shuffle" data-act="dyk-next">${t('panel.dyk_another')}</button>` : ''}
    </section>`;
  }

  // Count the headline figures up from zero, keeping their formatting ("$3.6B – $16.3B", "2,200").
  function animateNumbers(scope, countUp = true) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scope.querySelectorAll('.meter span[data-w]').forEach((bar) => {
      if (!countUp) bar.style.transition = 'none';
      requestAnimationFrame(() => { bar.style.width = `${bar.dataset.w}%`; });
    });
    if (reduce || !countUp) return;
    // The locale's grouping and decimal marks ("12,345.6" in English, "12.345,6" in Spanish).
    const locale = DCF_I18N.locale();
    const sample = (12345.6).toLocaleString(locale);
    const group = sample[2];
    const dec = sample[sample.length - 2];
    scope.querySelectorAll('.big .num').forEach((el) => {
      const final = el.textContent;
      const parts = final.split(/(\d[\d.,]*(?:[.,]\d+)?)/);
      const start = performance.now();
      const ms = 900;
      const step = (now) => {
        const t = Math.min(1, (now - start) / ms);
        const k = 1 - (1 - t) ** 3;
        el.textContent = t >= 1 ? final : parts.map((p, i) => {
          if (i % 2 === 0) return p;
          const decimals = (p.split(dec)[1] || '').length;
          const v = parseFloat(p.split(group).join('').replace(dec, '.')) * k;
          return v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: p.includes(group) });
        }).join('');
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  const yesNo = (v, yes, no) => (String(v) === 'true' ? yes : String(v) === 'false' ? no : '');

  function facts(rec, hit) {
    const jobsC = DCF.metric(rec, 'jobsConstruction').min;
    const jobsL = DCF.metric(rec, 'jobsLongTerm').min;
    const jobsT = DCF.metric(rec, 'jobsTotal').min;
    const jobs = [jobsC && t('panel.jobs_construction', { n: DCF.count(jobsC) }), jobsL && t('panel.jobs_permanent', { n: DCF.count(jobsL) }), !jobsC && !jobsL && jobsT && t('panel.jobs_total', { n: DCF.count(jobsT) })].filter(Boolean).join(' · ');
    const power = (Array.isArray(rec.powerSource) ? rec.powerSource : []).map((p) => DCF.label(DCF.POWER, p)).join(', ');
    const btm = (Array.isArray(rec.btmPowerName) ? rec.btmPowerName : []).join(', ');
    const cooling = [DCF.label(DCF.COOLING_SOURCE, rec.coolingSource), DCF.COOLING_TYPE[rec.coolingType] || ''].filter(Boolean).join(', ');
    const online = [DCF.fmtDate(rec.dateOnline), rec.dateOnlineMax ? t('panel.date_range_to', { date: DCF.fmtDate(rec.dateOnlineMax) }) : ''].filter(Boolean).join(' ');
    const gens = DCF.metric(rec, 'numberOfGenerators', 'numberOfGeneratorsMax');
    const water = (Array.isArray(rec.waterUse) ? rec.waterUse : []).map((w) => [w.amount != null ? DCF.friendly(w.amount) : '', w.unit, w.type, w.basis ? `(${w.basis})` : ''].filter(Boolean).join(' ')).filter(Boolean).join('; ');
    const rows = [
      [t('panel.fact_status'), DCF.phaseLabel(rec.phase)],
      [t('panel.fact_record_type'), rec.type && rec.type !== 'Data Center' ? rec.type : ''],
      [t('panel.fact_focus'), (Array.isArray(rec.niche) ? rec.niche : []).map((n) => DCF.label(DCF.NICHES, n)).join(', ')],
      [t('panel.fact_announced'), DCF.fmtDate(rec.dateAnnounced)],
      [t('panel.fact_expected_online'), online],
      [t('panel.fact_power_source'), power],
      [t('panel.fact_onsite_plant'), btm || yesNo(rec.btmPower, t('panel.planned_btm'), '')],
      [t('panel.fact_substation'), yesNo(rec.dedicatedSubstation, t('panel.planned'), t('panel.not_mentioned'))],
      [t('panel.fact_generators'), DCF.range(gens.min, gens.max, DCF.count)],
      [t('panel.fact_cooling'), cooling],
      [t('panel.fact_water_use'), water],
      [t('panel.fact_jobs'), jobs],
      [t('panel.fact_land_sold'), yesNo(rec.landSold, t('panel.yes'), t('panel.no'))],
      [t('panel.fact_zoned'), yesNo(rec.zoningAllowance, t('panel.yes'), t('panel.no'))],
      [t('panel.fact_nda'), rec.nda ? String(rec.nda) : ''],
      [t('panel.fact_address'), hit.site.address || rec.address],
      [t('panel.fact_sites'), Array.isArray(rec.sites) && rec.sites.length > 1 ? t('panel.sites_showing_closest', { n: rec.sites.length }) : ''],
      [t('panel.fact_accuracy'), DCF.CONFIDENCE[hit.site.locationConfidence || rec.locationConfidence] || ''],
      [t('panel.fact_updated'), DCF.fmtDate(rec.dateUpdated)],
    ].filter(([, v]) => v);
    return html`<section class="blk"><h3>${t('panel.key_details')}</h3><dl class="facts">${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl></section>`;
  }

  // Who decides land use differs by state; the wording, directory link and election note live in states.json.
  // In the tip, "{here}" becomes " (here: Town)" when the project's municipality is known.
  function tipHtml(tip, town) {
    const [head, ...rest] = String(tip).split('{here}');
    return html`${head}${rest.length ? html`${town ? tx('panel.tip_here', {}, { town: html`<b>${town}</b>` }) : ''}${rest.join('')}` : ''}`;
  }
  const GENERIC_GOV = {
    tip: () => html`${t('panel.generic_tip')}`,
    get directory() { return ['https://www.naco.org/counties', t('panel.generic_directory')]; },
    election: '',
    countyLevel: true,
  };
  function govFor(stateName) {
    const s = DCF.stateInfo(stateName);
    return s ? { tip: (town) => tipHtml(s.tip, town), directory: s.directory, election: s.election || '', countyLevel: s.countyLevel !== false, planningDecides: !!s.planningDecides } : GENERIC_GOV;
  }

  const norm = (s) => String(s || '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
  function lookupKey(table, key) {
    if (!table || !key) return null;
    const found = Object.keys(table).find((k) => norm(k) === norm(key));
    return found ? table[found] : null;
  }

  // L is the state's leaders module (see leadersFor): { state, counties, munis, asOf }.
  function leaderInfo(L, stateName, county) {
    if (stateName === 'District of Columbia') return L.counties['District of Columbia'] || null;
    return lookupKey(L.counties, county);
  }

  function muniInfo(L, county, town) {
    return lookupKey(L.munis, `${county}|${town}`);
  }

  const PARTY_NAMES = { D: 'panel.party_d', R: 'panel.party_r', I: 'panel.party_i' };

  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(s || ''));

  // Other ways to reach a board when nobody on it publishes an email: the board's (or the office's)
  // phone, mailing address and official social accounts.
  function altFor(body, record) {
    const office = (record && record.contact) || {};
    const pick = (k) => String((body && body[k]) || office[k] || '').trim();
    const asList = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? [x] : []);
    const socialSrc = asList(body && body.social).length ? asList(body.social) : asList(office.social);
    const alt = { phone: pick('phone'), address: pick('address'), social: socialSrc.filter((s) => s && safeHref(s.url)) };
    return alt.phone || alt.address || alt.social.length ? alt : null;
  }
  const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

  // Where a letter to this person can go: their own address, else the body's, else the office's, else a web form,
  // else only the phone / mailing address / social channels (alt).
  function contactFor(p, body, record) {
    const alt = altFor(body, record);
    const withAlt = (c) => (alt ? { ...c, alt } : c);
    if (isEmail(p.email)) return withAlt({ email: p.email, via: '' });
    if (body && isEmail(body.email)) return withAlt({ email: body.email, via: body.name });
    const office = (record && record.contact) || {};
    if (isEmail(office.email)) return withAlt({ email: office.email, via: office.label || t('panel.via_the_office') });
    const form = safeHref((body && body.form) || office.form);
    if (form) return withAlt({ form, via: body && body.form ? body.name : office.label || t('panel.via_the_office') });
    if (alt) return { alt, via: body ? body.name : t('panel.via_this_office') };
    return null;
  }

  // Contact line for a board or office: email, phone, mailing address, official accounts.
  function contactLine(src) {
    if (!src) return '';
    const parts = [];
    if (isEmail(src.email)) parts.push(html`<a href="mailto:${src.email}">${src.email}</a>`);
    if (safeHref(src.form)) parts.push(html`<a href="${safeHref(src.form)}" target="_blank" rel="noopener">${t('panel.contact_form')}</a>`);
    if (src.phone) parts.push(html`<a href="${telHref(src.phone)}">${src.phone}</a>`);
    if (src.address) parts.push(html`<span>${src.address}</span>`);
    for (const s of (Array.isArray(src.social) ? src.social : src.social && typeof src.social === 'object' ? [src.social] : [])) if (s && safeHref(s.url)) parts.push(html`<a href="${safeHref(s.url)}" target="_blank" rel="noopener">${s.name || t('panel.official_account')} ${t('panel.board_count_link')}</a>`);
    return parts.length ? html`<div class="bcontact">${parts}</div>` : '';
  }

  // Every person drawn in the current result, so the composer can find them by index.
  let recipients = [];

  // How much a letter to this person can change the outcome, with the reason shown on the badge.
  // The body that casts the binding vote scores highest; recommenders, staff and state officials lower.
  function impact(p, ctx) {
    const t = String(p.title || '').toLowerCase();
    const heads = /\b(chair|president|presiding|mayor|first selectman|supervisor|executive|director of the board)\b/.test(t) && !/vice|deputy|pro tem/.test(t);
    const local = ctx.tier === 'municipal' || (ctx.tier === 'county' && ctx.decides);
    // Secretaries, clerks and liaisons listed on a board are staff, not voting members.
    const role = ctx.role !== 'staff' && /\b(secretary|clerk|liaison|staff|administrator|coordinator)\b/.test(t) && !heads ? 'staff' : ctx.role;
    ctx = { ...ctx, role };
    // why is a catalog key, resolved with t() where the badge is drawn so it follows the language.
    let score = 0; let why = '';
    if (ctx.tier === 'state') {
      if (/governor/.test(t) && !/lieutenant/.test(t)) { score = 68; why = 'panel.why_governor'; }
      else if (/utilit|public service|psc|puc|bpu|pura|regulatory authority|commerce commission|power agency|regulatory staff|public counsel/.test(t)) { score = 58; why = 'panel.why_utility'; }
      else if (/siting council|siting board|site evaluation/.test(t)) { score = 56; why = 'panel.why_siting'; }
      else if (/environment|natural resources|\b(dep|deq|dec|mde|dnr|dnrec|dem|des|epd)\b/.test(t)) { score = 52; why = 'panel.why_environment'; }
      else if (/\benergy\b/.test(t)) { score = 50; why = 'panel.why_energy'; }
      else if (/state planning/.test(t)) { score = 46; why = 'panel.why_state_planning'; }
      else if (/commerce|economic|development|eda/.test(t)) { score = 42; why = 'panel.why_commerce'; }
      else { score = 30; why = 'panel.why_state_leadership'; }
    } else if (ctx.role === 'staff') {
      score = local ? 48 : 28; why = /manager|administrator|executive director/.test(t) ? 'panel.why_staff_manager' : 'panel.why_staff';
    } else if (ctx.role === 'governing') {
      score = (local ? 100 : 60) - (heads ? 0 : 16); why = heads ? 'panel.why_governing_chair' : 'panel.why_governing';
    } else if (ctx.role === 'zoning') {
      score = (local ? 88 : 52) - (heads ? 0 : 18); why = heads ? 'panel.why_zoning_chair' : 'panel.why_zoning';
    } else if (ctx.role === 'planning' && ctx.planningDecides) {
      // Connecticut-style: the planning and zoning commission itself casts the binding vote.
      score = (local ? 100 : 60) - (heads ? 0 : 16); why = heads ? 'panel.why_planning_decides_chair' : 'panel.why_planning_decides';
    } else if (ctx.role === 'planning') {
      score = (local ? 62 : 36) - (heads ? 0 : 14); why = heads ? 'panel.why_planning_chair' : 'panel.why_planning';
    } else { score = 20; }
    if (isEmail(p.email)) score += 6; // a letter that lands in their own inbox
    return { score, why };
  }

  // One person: photo (filled in once photos load) or initials, name, title, party and a write button.
  function person(p, ctx, small = false) {
    const party = String(p.party || '').toUpperCase();
    const url = safeHref(p.url);
    const contact = contactFor(p, ctx.body, ctx.record);
    const imp = impact(p, ctx);
    let write = '';
    let idx = -1;
    let sent = false;
    if (contact) {
      const r = { person: p, tier: ctx.tier, role: ctx.role, place: ctx.place, contact, impact: imp };
      recipients.push(r);
      idx = recipients.length - 1;
      sent = isSent(r);
      const altOnly = !contact.email && !contact.form;
      write = html`<button type="button" class="write ${altOnly ? 'alt' : ''}" data-write="${idx}" aria-label="${altOnly ? t('panel.write_call_or_post') : t('panel.write_a_letter')}" title="${contact.email ? t('panel.write_title_email', { email: contact.email }) : contact.form ? t('panel.write_title_form') : t('panel.write_title_alt')}">${raw(altOnly ? ICON_PHONE : ICON_MAIL)}</button>`;
    }
    return html`<li class="${small ? 'sm' : ''} ${sent ? 'sent' : ''}" data-score="${imp.score}" data-why="${imp.why}" data-ridx="${idx}">
      <span class="av"${p.photo ? html` data-photo="${p.photo}"` : ''} aria-hidden="true">${initials(p.name)}</span>
      <span class="who"><div class="nm">${url ? html`<a href="${url}" target="_blank" rel="noopener">${p.name}</a>` : p.name}</div><div class="ti">${p.title}${p.role ? tx('panel.role_sep', {}, { role: html`<i>${p.role}</i>` }) : ''}</div></span>
      ${sent ? html`<span class="sentmark" title="${t('panel.you_wrote')}">✓</span>` : ''}
      ${PARTY_NAMES[party] ? html`<span class="party ${party}" title="${t(PARTY_NAMES[party])}">${party}</span>` : ''}
      ${write}
    </li>`;
  }

  // After the result is drawn: star the handful of people whose decision matters most, and list them first.
  const STAR_COUNT = 5;
  function markImpact() {
    const who = body.querySelector('.who');
    if (!who) return;
    const ranked = [...who.querySelectorAll('.leaders li[data-score]')]
      .map((li) => ({ li, score: Number(li.dataset.score) || 0 }))
      .filter((x) => x.score >= 40)
      .sort((a, b) => b.score - a.score);
    // At most two people per board, so the chairs of other deciding bodies make the list too.
    const perBody = new Map();
    const items = [];
    for (const x of ranked) {
      const ul = x.li.parentElement;
      const n = perBody.get(ul) || 0;
      if (n >= 2) continue;
      perBody.set(ul, n + 1);
      items.push(x);
      if (items.length === STAR_COUNT) break;
    }
    if (!items.length) return;
    const list = document.createElement('ol');
    list.className = 'leaders start';
    for (const { li } of items) {
      li.classList.add('star');
      const badge = document.createElement('span');
      badge.className = 'why';
      badge.textContent = t(li.dataset.why);
      li.querySelector('.who').appendChild(badge);
      // Show the hidden board this person sits on, so the star is not buried.
      const det = li.closest('details.board');
      if (det) det.open = true;
      const clone = li.cloneNode(true);
      clone.classList.add('sm');
      list.appendChild(clone);
    }
    const box = document.createElement('div');
    box.className = 'starbox';
    setHTML(box, html`<div class="sh">${t('panel.start_here')}</div>`);
    box.appendChild(list);
    const anchor = who.querySelector('.writeall') || who.querySelector('h3');
    anchor.insertAdjacentElement('afterend', box);
    // The same people drive the sticky bar under the title, the first thing a reader can act on.
    state.topIdx = items.map(({ li }) => Number(li.dataset.ridx)).filter((i) => i >= 0);
    renderCta();
  }

  // Sticky call-to-action under the title: faces of the people who decide, one button, progress.
  function renderCta() {
    const bar = body.querySelector('.cta');
    if (!bar) return;
    const idx = (state.topIdx || []).filter((i) => recipients[i]);
    if (!idx.length) { bar.hidden = true; return; }
    const sent = idx.filter((i) => isSent(recipients[i])).length;
    const names = idx.map((i) => { const p = recipients[i].person; return `${DCF_LETTER.honorific(p) && DCF_LETTER.honorific(p) !== 'Mr./Ms.' ? `${DCF_LETTER.honorific(p)} ` : ''}${p.name}`; }).join(', ');
    setHTML(bar, html`<div class="row"><span class="faces"></span><button type="button" class="btn primary" data-act="write-top">${idx.length === 1 ? t('panel.cta_write_one') : t('panel.cta_write_many', { n: idx.length })}</button></div>
      <div class="sub">${sent ? html`<span class="prog">${t('panel.cta_progress', { sent, n: idx.length })}</span>` : ''}${names}</div>`);
    const faces = bar.querySelector('.faces');
    for (const i of idx) {
      const av = body.querySelector(`.leaders li[data-ridx="${i}"] .av`);
      if (av) faces.appendChild(av.cloneNode(true));
    }
    bar.hidden = false;
  }

  // A board or commission, collapsed unless it is the one that decides.
  function board(b, open, ctx) {
    const members = Array.isArray(b.members) ? b.members : [];
    if (!members.length) return '';
    const bctx = { ...ctx, body: b, role: b.role };
    return html`<details class="board" ${open ? 'open' : ''}>
      <summary><b>${b.name}</b> <span class="cnt">${members.length}</span>${b.url ? html` <a href="${safeHref(b.url)}" target="_blank" rel="noopener" class="blink">${t('panel.board_count_link')}</a>` : ''}</summary>
      ${contactLine(b)}
      <ul class="leaders">${members.map((m) => person(m, bctx, true))}</ul>
    </details>`;
  }

  function staffList(list, ctx) {
    const staff = Array.isArray(list) ? list : [];
    return staff.length ? html`<ul class="leaders staff">${staff.map((m) => person(m, { ...ctx, role: 'staff' }, true))}</ul>` : '';
  }

  function confidenceWarn(info) {
    return info && info.confidence && info.confidence !== 'high'
      ? html`<div class="warn">${t('panel.confidence_warn')}</div>` : '';
  }

  // kind: a small eyebrow naming the level of government (Municipality / County / State).
  function tier(kind, heading, sub, body) {
    return html`<div class="tier"><div class="th"><div class="tk">${kind}</div><div class="tt">${heading}</div>${sub ? html`<div class="ts">${sub}</div>` : ''}</div>${body}</div>`;
  }

  function leadership(L, stateName, county, town) {
    const gov = govFor(stateName);
    const isDC = stateName === 'District of Columbia';
    const tiers = [];
    recipients = [];
    state.sites = { muni: '', county: '' };

    // 1. The municipality: in most of these states this is where zoning is decided.
    const muni = !isDC && town ? muniInfo(L, county, town) : null;
    if (muni) {
      const bodies = Array.isArray(muni.bodies) ? muni.bodies : [];
      state.sites.muni = safeHref(muni.website);
      const unincorporated = !bodies.length && /unincorp|hamlet|military/i.test(muni.type || '');
      const sub = html`${muni.type || ''}${muni.website ? html` · <a href="${safeHref(muni.website)}" target="_blank" rel="noopener">${t('panel.website_link')}</a>` : ''}`;
      const mctx = { tier: 'municipal', place: muni.municipality || town, record: muni, planningDecides: gov.planningDecides };
      tiers.push(tier(t('panel.tier_municipality'), muni.municipality || town, sub, html`
        ${contactLine(muni.contact)}
        ${unincorporated ? html`<div class="fine">${t('panel.unincorporated')}</div>` : ''}
        ${bodies.map((b) => board(b, b.role === 'governing' || b.role === 'zoning', mctx))}
        ${staffList(muni.staff, mctx)}
        ${muni.note ? html`<div class="fine">${muni.note}</div>` : ''}
        ${!unincorporated && !bodies.length ? html`<div class="fine">${t('panel.no_rosters')}</div>` : ''}
        ${confidenceWarn(muni)}`));
    } else if (!isDC && town) {
      tiers.push(tier(t('panel.tier_municipality'), town, t('panel.muni_not_bundled_sub'), html`<div class="fine">${t('panel.muni_not_bundled')}</div>`));
    }

    // 2. The county (or DC itself). Skipped where the state has no county government (Connecticut).
    // place feeds the letter's address line, so it stays English; placeShown is the heading.
    const info = gov.countyLevel ? leaderInfo(L, stateName, county) : null;
    const place = isDC ? DCF_I18N.tIn('en', 'finder.city_dc') : gov.countyLevel ? county : '';
    const placeShown = isDC ? t('finder.city_dc') : place;
    if (info) {
      const bodies = Array.isArray(info.bodies) ? info.bodies : [];
      state.sites.county = safeHref(info.website);
      const countyDecides = !muni || !(muni.bodies || []).length;
      const cctx = { tier: 'county', place, record: info, role: 'governing', decides: countyDecides };
      tiers.push(tier(isDC ? t('panel.tier_district') : t('panel.tier_county'), placeShown, html`${info.governmentType}${info.seat && !isDC ? t('panel.county_seat', { seat: info.seat }) : ''}${info.website ? html` · <a href="${safeHref(info.website)}" target="_blank" rel="noopener">${t('panel.website_link')}</a>` : ''}`, html`
        ${contactLine(info.contact)}
        <ul class="leaders">${(info.leaders || []).map((p) => person(p, cctx))}</ul>
        ${bodies.map((b) => board(b, countyDecides && b.role !== 'planning', cctx))}
        ${staffList(info.staff, cctx)}
        ${info.note ? html`<div class="fine">${info.note}</div>` : ''}
        ${gov.election ? html`<div class="fine">${gov.election}</div>` : ''}
        ${confidenceWarn(info)}
        ${info.leadershipPage ? html`<div class="links"><a href="${safeHref(info.leadershipPage)}" target="_blank" rel="noopener">${t('panel.leadership_page')}</a></div>` : ''}`));
    } else if (place) {
      tiers.push(tier(t('panel.tier_county'), placeShown, t('panel.county_not_bundled'), html`<div class="links"><a href="${gov.directory[0]}" target="_blank" rel="noopener">${gov.directory[1]} ${t('panel.board_count_link')}</a></div>`));
    }

    // 3. The state: governor, utility regulators, environmental and economic agencies.
    const st = L.state;
    if (st && Array.isArray(st.leaders) && st.leaders.length) {
      const sctx = { tier: 'state', place: stateName, record: st, role: 'governing' };
      tiers.push(tier(t('panel.tier_state'), stateName, t('panel.state_sub'), html`
        <details class="board" open><summary><b>${t('panel.state_leaders')}</b> <span class="cnt">${st.leaders.length}</span></summary>
        ${contactLine(st.contact)}
        <ul class="leaders">${st.leaders.map((p) => person(p, sctx, true))}</ul></details>
        ${st.note ? html`<div class="fine">${st.note}</div>` : ''}`));
    }

    const emailable = recipients.filter((r) => r.contact.email).length;
    const formOnly = recipients.filter((r) => !r.contact.email && r.contact.form).length;
    const altOnly = recipients.length - emailable - formOnly;
    const reach = [t('panel.reach_email', { n: emailable }), formOnly ? t('panel.reach_form', { n: formOnly }) : '', altOnly ? t('panel.reach_alt', { n: altOnly }) : ''].filter(Boolean).join('; ');
    return html`<section class="blk who"><h3>${t('panel.who_decides')}</h3>
      <div class="fine">${gov.tip(town)}</div>
      ${recipients.length ? html`<div class="writeall">
        <button type="button" class="btn primary" data-act="write-all">${t('panel.write_to_everyone', { n: recipients.length })}</button>
        <div class="fine">${t('panel.write_all_note', { reach })}</div>
      </div>` : ''}
      ${tiers}
      <div class="fine">${t('panel.compiled', { asOf: L.asOf })}</div>
    </section>`;
  }

  // Swap initials for official portraits once the photo modules have loaded. Portrait ids start with the
  // state's postal code ("pa-…"), and each state's portraits live in their own module.
  async function fillPhotos() {
    const slots = [...body.querySelectorAll('.av[data-photo]')];
    if (!slots.length) return;
    const prefixes = [...new Set(slots.map((el) => el.dataset.photo.split('-')[0]))].filter((p) => /^[a-z]{2}$/.test(p));
    const tables = await Promise.all(prefixes.map((p) => mod(`photos/${p}`).then((m) => m.PHOTOS || {})));
    const PHOTOS = Object.assign({}, ...tables);
    for (const el of slots) {
      if (!el.isConnected) continue; // a newer result replaced this one while the module loaded
      const src = PHOTOS[el.dataset.photo];
      if (!src || !/^data:image\//.test(src)) continue;
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      el.replaceChildren(img);
      el.classList.add('has-photo');
    }
  }

  function companies(rec) {
    const groups = rec.stakeholders && typeof rec.stakeholders === 'object' ? rec.stakeholders : {};
    const chips = [];
    for (const [code, names] of Object.entries(groups)) {
      for (const name of Array.isArray(names) ? names : []) chips.push(html`<span class="chip">${tx('panel.company_role_chip', { role: DCF.ROLES[code] || code }, { name: html`<b>${name}</b>` })}</span>`);
    }
    if (!chips.length && Array.isArray(rec.companies)) rec.companies.forEach((n) => chips.push(html`<span class="chip"><b>${n}</b></span>`));
    if (!chips.length) return '';
    return html`<section class="blk"><h3>${t('panel.companies_involved')}</h3><div class="co">${chips}</div></section>`;
  }

  function approvals(rec) {
    const list = Array.isArray(rec.approvals) ? rec.approvals : [];
    if (!list.length) return '';
    return html`<section class="blk"><h3>${t('panel.local_approvals')}</h3><ul class="plain">${list.map((a) => {
      const notes = a.notes && !/^migrated from/i.test(a.notes) ? `: ${a.notes}` : '';
      const status = DCF.label(DCF.APPROVAL_STATUS, a.status) || t('panel.status_unknown');
      return html`<li>${tx('panel.approval_line', { type: DCF.label(DCF.APPROVAL_TYPES, a.type), by: a.body ? t('panel.by_body', { body: a.body }) : '', date: a.date ? ` (${DCF.fmtDate(a.date)})` : '', notes }, { status: html`<b>${status}</b>` })}</li>`;
    })}</ul></section>`;
  }

  function notes(rec) {
    const list = (Array.isArray(rec.notes) ? rec.notes : []).map((n) => String(n).replace(/\\n/g, ' ').trim()).filter(Boolean);
    if (!list.length) return '';
    return html`<section class="blk"><h3>${t('panel.notes_from_tracker')}</h3><ul class="plain">${list.map((n) => html`<li>${n}</li>`)}</ul></section>`;
  }

  function sources(rec) {
    const list = (Array.isArray(rec.sources) ? rec.sources : []).filter((s) => safeHref(s.id))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''), undefined, { numeric: true }));
    if (!list.length) return '';
    const shown = state.showAllSources ? list : list.slice(0, 5);
    return html`<section class="blk"><h3>${t('panel.sources', { n: list.length })}</h3><ul class="plain src">${shown.map((s) => html`<li><a href="${safeHref(s.id)}" target="_blank" rel="noopener">${s.text || s.id}</a>${s.date ? html` <span class="d">· ${DCF.fmtDate(s.date)}</span>` : ''}</li>`)}</ul>
      ${list.length > shown.length ? html`<button class="more" type="button" data-act="all-sources">${t('panel.show_all_sources', { n: list.length })}</button>` : ''}</section>`;
  }

  function nearby() {
    const shown = state.nearMore ? NEARBY_MAX : NEARBY_COUNT;
    const list = state.ranked.slice(0, shown);
    if (list.length < 2) return '';
    const rest = Math.min(NEARBY_MAX, state.ranked.length) - list.length;
    return html`<section class="blk near-blk"><h3>${t('panel.closest_to', { origin: originLabel() })}</h3><ol class="near">${list.map((h, i) => html`
      <li><button type="button" data-pick="${i}" aria-current="${String(i === state.idx)}"><span class="mi">${t('panel.miles_short', { miles: h.miles.toFixed(1) })}</span>
        <span class="nn"><div>${h.rec.name}</div><div class="sub"><span class="dot" style="background: ${DCF.stageInfo(h.rec.phase).color}"></span>${t('panel.sug_phase_place', { phase: DCF.phaseLabel(h.rec.phase), place: DCF.placeLine(h.site.municipality || h.rec.municipality) })}</div></span></button></li>`)}</ol>
      ${rest > 0 ? html`<button class="more" type="button" data-act="near-more">${t('panel.show_more', { n: rest })}</button>` : ''}
      <div class="fine">${t('panel.not_the_project')}</div></section>`;
  }
  // "ZIP 18503" for a ZIP search, or the project's own site when a project was chosen by name without a ZIP.
  function originLabel() {
    const o = state.origin || {};
    return o.zip ? t('panel.origin_zip', { zip: o.zip }) : t('panel.origin_site', { place: o.place || t('panel.origin_project') });
  }

  // The stage the project is in, what it means for letter-writing, and the color key.
  function stageBlock(phase) {
    const s = DCF.stageInfo(phase);
    const key = String(phase || '').toLowerCase();
    return html`<section class="stage win-${s.window}" style="--stage: ${s.color}; --stage-bg: ${s.bg}; --stage-ink: ${s.ink}">
      <div class="st-head"><span class="dot"></span><b>${s.label}</b><span class="win">${t(`finder.window_${s.window}`)}</span></div>
      <div class="st-short">${s.short}</div>
      <div class="st-note">${s.note}</div>
      <details class="legend"><summary>${t('panel.what_colors_mean')}</summary>
        <ul>${DCF.STAGE_ORDER.map((k) => { const st = DCF.STAGES[k]; return html`<li class="${k === key ? 'cur' : ''}"><span class="dot" style="background: ${st.color}"></span><b>${st.label}</b><span class="lw lw-${st.window}">${t(`finder.window_${st.window}_short`)}</span></li>`; })}</ul>
        <div class="fine">${t('panel.colors_note')}</div>
      </details>
    </section>`;
  }

  // Why the tracker may show nothing near the searched ZIP: not covered, not yet reported, or far away.
  function coverageNote(hit) {
    const origin = state.origin || {};
    const originState = origin.state ? (DCF.stateName(origin.state) || origin.state) : '';
    if (!originState) return '';
    const rows = (dataCache && dataCache.rows) || [];
    const inState = rows.filter((r) => r.state === originState).length;
    const covered = DCF.COVERED_STATES.has(originState);
    const reg = DCF.stateInfo(originState);
    const sameState = hit.rec.state === originState;
    const far = hit.miles > 40;
    const projects = inState === 1 ? t('panel.project_one') : t('panel.project_many');
    if (sameState && !far) {
      // The tracker's API lists the state's projects but it has no map page for the state yet (Iowa in Oct 2026).
      if (covered && reg && !reg.trackerPage && inState > 0) {
        return html`<section class="gap"><b>${t('panel.gap_no_map_lead', { state: originState })}</b>${t('panel.gap_no_map', { n: inState, projects, state: originState })}</section>`;
      }
      return '';
    }
    // The gap banner describes the nearest project; a project chosen by name or from the nearby list is not it.
    if (state.idx > 0) return '';
    let why;
    if (inState === 0 && covered) {
      const page = reg && reg.trackerPage ? t('panel.gap_page_soon', { state: originState }) : t('panel.gap_no_page', { state: originState });
      why = tx('panel.gap_none_recorded', { page, state: originState }, { lead: html`<b>${t('panel.gap_none_recorded_lead', { state: originState })}</b>` });
    } else if (inState === 0) {
      why = tx('panel.gap_not_covered', {}, { state: html`<b>${originState}</b>` });
    } else if (!covered) {
      // The count phrase is bold when the translation keeps it in one piece.
      const text = t('panel.gap_not_researched', { n: inState, projects, state: originState });
      const phrase = `${inState} ${projects} in ${originState}`;
      const [head, ...rest] = text.split(phrase);
      why = rest.length ? html`${head}<b>${phrase}</b>${rest.join(phrase)}` : html`${text}`;
    } else {
      why = html`${t('panel.gap_far', { origin: originLabel(), state: originState, n: inState, projects })}`;
    }
    return html`<section class="gap"><b>${t('panel.gap_lead', { inState: sameState ? '' : t('panel.in_state', { state: originState }) })}</b>${tx('panel.gap_nearest', { miles: hit.miles.toFixed(0), inState: sameState ? '' : t('panel.in_state', { state: hit.rec.state }) }, { why })}</section>`;
  }

  // The tracker's summaries mark paragraph breaks with a literal "\n".
  function paragraphs(text) {
    const parts = String(text || '').split(/\\n|\n/).map((p) => p.trim()).filter(Boolean);
    return parts.map((p) => html`<p class="summary">${p}</p>`);
  }

  let renderSeq = 0;
  async function renderResult() {
    const hit = state.ranked[state.idx];
    const { rec, site } = hit;
    const seq = ++renderSeq;
    const L = await leadersFor(rec.state);
    if (seq !== renderSeq) return; // a newer search or pick superseded this one while its officials loaded
    const muni = site.municipality || rec.municipality || {};
    const county = (muni.counties || [])[0] || '';
    const town = (muni.towns || [])[0] || '';
    const pageSlug = rec.stateSlug || (DCF.stateInfo(rec.state) || {}).trackerPage || '';
    const profile = rec.slug && pageSlug ? `/usa/${encodeURIComponent(pageSlug)}/data-centers/${encodeURIComponent(rec.slug)}` : '';
    const gmaps = `https://www.google.com/maps/search/?api=1&query=${site.lat},${site.lon}`;
    const stage = DCF.stageInfo(rec.phase);
    setHTML(body, html`
      ${coverageNote(hit)}
      <div class="hero" style="--stage: ${stage.color}">
        ${!state.origin.zip && hit.miles < 0.05
          ? html`<div class="dist"><span>${t('panel.chosen_by_name', { place: DCF.placeLine(muni) || rec.state })}</span></div>`
          : html`<div class="dist"><strong class="dnum">${t('panel.miles_short', { miles: hit.miles.toFixed(1) })}</strong> <span>${t('panel.dir_of_origin', { dir: hit.dir, origin: originLabel(), place: state.origin.zip && state.origin.place ? t('panel.place_sep', { place: state.origin.place }) : '' })}</span></div>`}
        <h2>${rec.name}</h2>
        <div class="where">${DCF.placeLine(muni)}</div>
        <div class="chips">${phaseChip(rec.phase)}${(rec.niche || []).map((n) => html`<span class="chip">${DCF.label(DCF.NICHES, n)}</span>`)}${rec.type && rec.type !== 'Data Center' ? html`<span class="chip">${rec.type}</span>` : ''}</div>
      </div>
      <div class="cta" hidden></div>
      ${stageBlock(rec.phase)}
      ${picture(hit)}
      ${mediaBlock(rec)}
      ${numbers(rec)}
      ${didYouKnow(rec)}
      ${paragraphs(rec.info)}
      ${leadership(L, rec.state, county, town)}
      ${facts(rec, hit)}
      ${companies(rec)}
      ${approvals(rec)}
      ${notes(rec)}
      ${sources(rec)}
      <div class="actions">
        ${hasChrome ? html`<button type="button" class="btn primary" data-act="map-open">${t('panel.show_on_map')}</button>` : ''}
        ${profile ? html`<a class="btn ${hasChrome ? '' : 'primary'}" href="${profile}" target="_blank" rel="noopener">${t('panel.full_profile')}</a>` : ''}
        <a class="btn" href="${gmaps}" target="_blank" rel="noopener">${t('panel.open_google_maps')}</a>
      </div>
      ${nearby()}
      <div class="foot">
        ${t('panel.foot_data', { ago: minutesAgo(dataCache.ts) })}<button type="button" data-act="refresh">${t('panel.refresh')}</button><br>
        ${t('panel.foot_zip')}<br>
        ${t('panel.foot_comparisons')}<br>
        ${t('panel.foot_credit')}${hasChrome && chrome.runtime && chrome.runtime.getURL ? html` · <a href="${chrome.runtime.getURL('about.html')}" target="_blank" rel="noopener">${t('panel.about_link')}</a>` : ''}
      </div>`);
    wireImage();
    // Count the figures up only when a new project appears, not when the same one re-renders.
    body.dataset.win = stage.window; // red accents appear only while a decision is still ahead
    animateNumbers(body, state.animatedFor !== rec.id);
    state.animatedFor = rec.id;
    body.scrollTop = 0;
    markImpact();
    fillPhotos();
    focusMap();
  }

  function showRenderError(err) {
    setStatus('error', t('panel.render_error', { error: err && err.message ? err.message : '' }), html`<button class="retry" type="button">${t('panel.try_again')}</button>`);
  }

  function wireImage() {
    const img = body.querySelector('.frame img');
    const loading = body.querySelector('.frame .loading');
    if (!img) return;
    img.addEventListener('load', () => loading && loading.remove());
    img.addEventListener('error', () => { if (loading) loading.textContent = t('panel.imagery_unavailable'); });
  }

  function replaceWith(el, frag) {
    const tmp = document.createElement('div');
    setHTML(tmp, frag);
    const next = tmp.firstElementChild;
    el.replaceWith(next);
    return next;
  }

  // One delegated handler for everything clickable in the results, so re-renders never stack listeners.
  body.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || !body.contains(t)) return;
    if (t.dataset.view) {
      state.view = t.dataset.view;
      replaceWith(body.querySelector('figure.pic'), picture(state.ranked[state.idx]));
      wireImage();
    } else if (t.dataset.pick != null) {
      state.idx = Number(t.dataset.pick);
      state.view = 'site';
      state.showAllSources = false;
      renderResult().catch(showRenderError);
    } else if (t.classList.contains('shuffle') && t.dataset.kind) {
      const d = state.alt[t.dataset.kind];
      d.i = (d.i + 2) % d.items.length;
      const next = replaceWith(t.closest('.alt'), altBlock(t.dataset.kind));
      next.classList.add('fresh');
      next.querySelector('.shuffle').focus();
    } else if (t.dataset.act === 'map-open') {
      if (isFull()) setFull(false);
      focusMap(true);
    } else if (t.dataset.act === 'all-sources') {
      state.showAllSources = true;
      const y = body.scrollTop;
      renderResult().then(() => { body.scrollTop = y; }, showRenderError);
    } else if (t.dataset.act === 'refresh') {
      if (state.origin.zip) search(state.origin.zip, true); else loadData(true).then(runRanking, showRenderError);
    } else if (t.dataset.act === 'dyk-next') {
      state.dykOffset = (state.dykOffset || 0) + 1;
      const next = replaceWith(t.closest('section.dyk'), didYouKnow(state.ranked[state.idx].rec));
      const b = next.querySelector('.shuffle'); if (b) b.focus();
    } else if (t.dataset.act === 'near-more') {
      state.nearMore = true;
      const y = body.scrollTop;
      replaceWith(body.querySelector('section.near-blk'), nearby());
      body.scrollTop = y;
    } else if (t.dataset.write != null) {
      openComposer([Number(t.dataset.write)]);
    } else if (t.dataset.act === 'write-all') {
      openComposer(recipients.map((_, i) => i));
    } else if (t.dataset.act === 'write-top') {
      openComposer(state.topIdx || []);
    }
  });

  // ---------- letter composer ----------
  // Opens over the result. Sending stays with the user: it hands the letter to Gmail, Outlook, Yahoo,
  // the mail app, the clipboard or the official's contact form. Nothing is sent by the extension itself.

  const YOU_KEY = 'dcfYou'; // { name, street, town, email, phone }
  const LETTER_PREFS_KEY = 'dcfLetter'; // { tone, detail, mail, personal }; 0.2.x wrote length: 'full'|'short'
  const SENT_KEY = 'dcfSent'; // { [projectId]: { [recipientKey]: timestamp } }
  const HOME_KEY = 'dcfHome'; // { zip, place, county, state, label, lat, lon, ts }: where the writer lives, if set
  const composer = document.createElement('div');
  composer.className = 'composer';
  composer.hidden = true;
  drawer.appendChild(composer);
  const comp = { list: [], i: 0, mode: 'each', you: {}, tone: 'oppose', detail: 'full', mail: 'gmail', personal: '', done: false };
  let sentAll = {};

  // Where a letter can be handed off. Every option stays visible; the one used last is highlighted.
  const q = encodeURIComponent;
  // label and name are catalog keys, resolved with t() where they are drawn.
  const MAIL = {
    gmail: { label: 'panel.mail_gmail', name: 'panel.mail_name_gmail', blank: true, url: (to, l) => `https://mail.google.com/mail/?view=cm&fs=1&to=${q(to)}&su=${q(l.subject)}&body=${q(l.body)}` },
    outlook: { label: 'panel.mail_outlook', name: 'panel.mail_name_outlook', blank: true, url: (to, l) => `https://outlook.office.com/mail/deeplink/compose?to=${q(to)}&subject=${q(l.subject)}&body=${q(l.body)}` },
    yahoo: { label: 'panel.mail_yahoo', name: 'panel.mail_name_yahoo', blank: true, url: (to, l) => `https://compose.mail.yahoo.com/?to=${q(to)}&subject=${q(l.subject)}&body=${q(l.body)}` },
    // RFC 6068: several addresses are separated by plain commas; an encoded comma breaks Outlook's parser.
    app: { label: 'panel.mail_app', name: 'panel.mail_name_app', blank: false, url: (to, l) => `mailto:${to.split(',').map((a) => q(a.trim())).filter(Boolean).join(',')}?subject=${q(l.subject)}&body=${q(l.body)}` },
  };
  // Beyond these lengths the compose page or the mail program silently cuts the body short: webmail
  // around 6,000 characters of URL; a mailto link far less on Windows, where the shell caps it near 2,000.
  const URL_MAX = { gmail: 6000, outlook: 6000, yahoo: 6000, app: /Win/.test(navigator.platform) ? 1900 : 6000 };
  const tooLong = (k, to, l) => MAIL[k].url(to, l).length > URL_MAX[k];
  const pasteNote = () => t('panel.paste_note');

  const rkey = (r) => `${r.person.name}|${r.contact.email || r.contact.form || ''}`;
  const projectSent = () => { const hit = currentHit(); return (hit && sentAll[String(hit.rec.id)]) || {}; };
  const isSent = (r) => !!projectSent()[rkey(r)];
  async function markSent(rs) {
    const id = String(currentHit().rec.id);
    const m = sentAll[id] || (sentAll[id] = {});
    for (const r of rs) m[rkey(r)] = Date.now();
    await store.set(SENT_KEY, sentAll);
    // The same person appears in the roster and, when starred, as a clone in the "Start here" box: tick both.
    for (const r of rs) {
      for (const li of body.querySelectorAll(`.leaders li[data-ridx="${recipients.indexOf(r)}"]`)) {
        if (li.classList.contains('sent')) continue;
        li.classList.add('sent');
        const who = li.querySelector('.who');
        if (who) { const s = document.createElement('span'); s.className = 'sentmark'; s.title = t('panel.you_wrote'); s.textContent = '✓'; li.insertBefore(s, who.nextSibling); }
      }
    }
    renderCta();
  }
  async function unmarkSent(rs) {
    const id = String(currentHit().rec.id);
    const m = sentAll[id];
    if (m) { for (const r of rs) delete m[rkey(r)]; if (!Object.keys(m).length) delete sentAll[id]; }
    await store.set(SENT_KEY, sentAll);
    for (const r of rs) {
      for (const li of body.querySelectorAll(`.leaders li[data-ridx="${recipients.indexOf(r)}"]`)) {
        li.classList.remove('sent');
        const mark = li.querySelector('.sentmark');
        if (mark) mark.remove();
      }
    }
    renderCta();
  }

  function currentHit() { return state.ranked[state.idx]; }

  // Where the writer lives: the home ZIP when one is saved, else the searched ZIP.
  // A project chosen by name with no ZIP borrows its own site as the ranking origin (pickProject); that
  // says nothing about where the writer lives, so it is not a residence.
  const residence = () => state.home || (state.origin && state.origin.zip ? state.origin : null);
  let homeSeq = 0;
  async function setHome(zip) {
    const seq = ++homeSeq;
    if (!zip) { state.home = null; await store.remove(HOME_KEY); return null; }
    const info = await lookupZip(zip);
    if (seq !== homeSeq) return undefined; // a later edit superseded this lookup: leave state alone
    if (!info) return null;
    state.home = { ...info, ts: Date.now() };
    await store.set(HOME_KEY, state.home);
    return state.home;
  }
  // False when the writer lives more than an hour's drive from the site, so the letter does not say "nearby".
  function nearSite() {
    const o = residence();
    const hit = currentHit();
    if (!o || !hit || !Number.isFinite(o.lat) || !Number.isFinite(hit.site.lat)) return true;
    return DCF.distanceMiles(o.lat, o.lon, hit.site.lat, hit.site.lon) <= 60;
  }

  // "Town, ST ZIP" from where the writer lives, offered as the signature's town line.
  function originTown() {
    const o = residence();
    if (!o) return '';
    const st = DCF.stateCode(o.state) || o.state || '';
    return `${[o.place, st].filter(Boolean).join(', ')}${o.zip ? ` ${o.zip}` : ''}`.trim();
  }

  // "As your constituent" only when the writer's ZIP sits inside this official's jurisdiction.
  function constituentFor(r) {
    const o = residence();
    const hit = currentHit();
    if (!hit) return true;
    if (!o) return false; // no ZIP given: never claim to be a constituent
    const strip = (s) => norm(s).replace(/ (county|city|borough|township|town|village)$/, '');
    const same = (a, b) => !!a && !!b && strip(a) === strip(b);
    const sameState = (DCF.stateName(o.state) || o.state) === hit.rec.state;
    if (r.tier === 'state') return sameState;
    if (r.tier === 'county') return sameState && same(o.county, r.place);
    return sameState && same(o.place, r.place);
  }

  async function openComposer(indexes) {
    comp.list = indexes.filter((i) => recipients[i]);
    if (!comp.list.length) return;
    comp.i = Math.max(0, comp.list.findIndex((i) => !isSent(recipients[i])));
    comp.mode = 'each';
    comp.done = false;
    comp.you = (await store.get(YOU_KEY)) || {};
    if (comp.you.address && !comp.you.street && !comp.you.town) { comp.you.street = comp.you.address; delete comp.you.address; }
    // The town line follows the searched ZIP until the writer edits it themselves.
    if (!comp.you.town || comp.you.townAuto) { comp.you.town = originTown(); comp.you.townAuto = true; }
    const lp = (await store.get(LETTER_PREFS_KEY)) || {};
    comp.tone = DCF_LETTER.TONES[lp.tone] ? lp.tone : 'oppose';
    comp.detail = DCF_LETTER.DETAILS[lp.detail] ? lp.detail : lp.length === 'short' ? 'brief' : 'full';
    comp.mail = MAIL[lp.mail] ? lp.mail : 'gmail';
    comp.personal = String(lp.personal || '');
    renderComposer();
    composer.hidden = false;
    composer.scrollTop = 0;
    if (!comp.you.name) { const f = composer.querySelector('input[data-you="name"]'); if (f) f.focus(); }
  }
  function closeComposer() { composer.hidden = true; comp.list = []; comp.i = 0; comp.done = false; }
  const saveLetterPrefs = () => store.set(LETTER_PREFS_KEY, { tone: comp.tone, detail: comp.detail, mail: comp.mail, personal: comp.personal });
  const letterOpts = (lang = 'en') => ({ tone: comp.tone, detail: comp.detail, personal: comp.personal, lang });
  // The letter that is sent is always English. When the interface is in another language, a second copy
  // in that language is shown read-only under the textarea (letter.translated); it is never sent.
  const en = (key, vars) => DCF_I18N.tIn('en', key, vars);
  const translatedLang = () => (DCF_I18N.lang === 'en' ? '' : DCF_I18N.lang);
  const forwardLines = (L, who, official, body) => `${L('panel.attention', { who })}\n${L('panel.please_forward', { official })}\n\n${body}`;

  function letterFor(r) {
    const hit = currentHit();
    const ctx = {
      person: r.person, tier: r.tier, role: r.role, title: r.person.title, place: r.place,
      address: (r.contact.alt && r.contact.alt.address) || '',
      constituent: constituentFor(r), originPlace: (residence() || {}).place || '', near: nearSite(),
    };
    const l = DCF_LETTER.build(hit.rec, hit, ctx, comp.you, letterOpts());
    const tl = translatedLang();
    const tr = tl ? DCF_LETTER.build(hit.rec, hit, ctx, comp.you, letterOpts(tl)) : null;
    // A letter routed through a shared mailbox (a clerk's or office inbox) says who it is for on the
    // subject line and on the first line of the body, so the clerk can forward it without reading it.
    if ((r.contact.email || r.contact.form) && r.contact.via) {
      const who = [r.person.name, r.person.title, r.place].filter(Boolean).join(', ');
      const official = DCF_LETTER.shortAddress(r.person);
      l.subject = en('panel.for_subject', { name: r.person.name, subject: l.subject });
      l.body = forwardLines(en, who, official, l.body);
      if (tr) tr.body = forwardLines(t, who, official, tr.body);
    }
    l.translated = tr ? tr.body : '';
    return l;
  }

  // One letter addressed to everyone with an email, for people who'd rather send once.
  function combinedLetter() {
    const hit = currentHit();
    const all = comp.list.map((i) => recipients[i]).filter((r) => r.contact.email);
    const o = residence() || {};
    const ctx = { person: { name: '', title: '' }, tier: 'county', role: 'governing', title: '', place: '', combined: true, constituent: all.length > 0 && all.every(constituentFor), originPlace: o.place || '', near: nearSite() };
    const letter = DCF_LETTER.build(hit.rec, hit, ctx, comp.you, letterOpts());
    const tl = translatedLang();
    const tr = tl ? DCF_LETTER.build(hit.rec, hit, ctx, comp.you, letterOpts(tl)) : null;
    // Officials reached through a shared mailbox are named up front, as in letterFor, so the clerk
    // knows who the one message is for and can forward it.
    const routed = all.filter((r) => r.contact.via);
    if (routed.length) {
      const names = routed.map((r) => [r.person.name, r.person.title, r.place].filter(Boolean).join(', ')).join('; ');
      const shorts = routed.map((r) => DCF_LETTER.shortAddress(r.person)).join(', ');
      letter.subject = en('panel.for_subject', { name: shorts, subject: letter.subject });
      letter.body = forwardLines(en, names, shorts, letter.body);
      if (tr) tr.body = forwardLines(t, names, shorts, tr.body);
    }
    return { ...letter, translated: tr ? tr.body : '', to: [...new Set(all.map((r) => r.contact.email))], recipients: all };
  }

  // When to check back, for the reminder offered after a letter. A dated pending approval on the
  // tracker's record wins; otherwise the project's stage sets the interval, since most records carry no
  // dated approval. Unknown stages fall to 30 days. The reminder links the municipal or county website.
  const REMIND_DAYS = { proposed: 14, preliminary: 30, delayed: 45, expansion: 21, construction: 60, operational: 90, withdrawn: 60, rejected: 90, retired: 0 };
  const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  function calendarLink(title, dayStart, details) {
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${q(title)}&dates=${ymd(dayStart)}/${ymd(dayEnd)}&details=${q(details)}`;
  }
  function reminder(rec) {
    const site = state.sites.muni || state.sites.county || '';
    const siteLine = site ? t('panel.agenda_and_minutes', { site }) : '';
    const today = new Date().toISOString().slice(0, 10);
    const iso = (s) => { const [y, m, d] = String(s || '').split('-'); return y && m ? `${y}-${m.padStart(2, '0')}-${(d || '1').padStart(2, '0')}` : ''; };
    const pending = (Array.isArray(rec.approvals) ? rec.approvals : [])
      .map((a) => ({ ...a, iso: iso(a.date) }))
      .filter((a) => a.iso && a.iso >= today && String(a.status || '') === 'pending')
      .sort((a, b) => a.iso.localeCompare(b.iso))[0];
    if (pending) {
      const [y, m, d] = pending.iso.split('-').map(Number);
      const text = `${DCF.label(DCF.APPROVAL_TYPES, pending.type)}${pending.body ? t('panel.by_body', { body: pending.body }) : ''}`;
      return { kind: 'decision', date: DCF.fmtDate(pending.date), text, site, calendar: calendarLink(t('panel.calendar_decision_title', { project: rec.name }), new Date(y, m - 1, d), t('panel.calendar_decision_details', { text, siteLine, url: 'https://trackdatacenters.com' })) };
    }
    const key = String(rec.phase || '').toLowerCase();
    const days = key in REMIND_DAYS ? REMIND_DAYS[key] : 30;
    if (!days) return null;
    const s = DCF.stageInfo(rec.phase);
    const when = new Date(); when.setDate(when.getDate() + days);
    const date = DCF.fmtDate(`${when.getFullYear()}-${when.getMonth() + 1}-${when.getDate()}`);
    return { kind: 'stage', date, days, text: t('panel.stage_label_short', { label: s.label, short: s.short }), site, calendar: calendarLink(t('panel.calendar_check_title', { project: rec.name }), when, t('panel.calendar_check_details', { label: s.label, note: s.note, siteLine, url: 'https://trackdatacenters.com' })) };
  }

  // A link whose letter is too long for its method is marked copy-first: the click copies the letter,
  // then opens the compose page with a one-line note, and the writer pastes over it.
  function sendLinks(to, l, canSend) {
    return Object.keys(MAIL).map((k) => {
      const long = tooLong(k, to, l);
      return html`<a class="btn ${k === comp.mail ? 'primary' : ''} ${canSend ? '' : 'off'}" href="${MAIL[k].url(to, long ? { ...l, body: pasteNote() } : l)}" data-mail="${k}"${long ? raw(' data-copy-first="1"') : ''}${MAIL[k].blank ? raw(' target="_blank" rel="noopener"') : ''}>${t(MAIL[k].label)}${long ? t('panel.copy_then_paste') : ''}</a>`;
    });
  }

  // Each slider reads one order list and one label table from letter.js. The range is the keyboard
  // control: the label names it and aria-valuetext reads the stop's name and meaning. The stop names
  // under the track are mouse targets only, hidden from assistive technology so nothing is read twice.
  const SLIDERS = {
    tone: { label: 'panel.slider_tone', order: 'TONE_ORDER', table: 'TONES' },
    detail: { label: 'panel.slider_detail', order: 'DETAIL_ORDER', table: 'DETAILS' },
  };
  function sliderStop(key, i) {
    const order = DCF_LETTER[SLIDERS[key].order];
    const k = order[Math.max(0, Math.min(order.length - 1, Number(i) || 0))];
    return { key: k, index: order.indexOf(k), ...DCF_LETTER[SLIDERS[key].table][k] };
  }
  function slider(key) {
    const order = DCF_LETTER[SLIDERS[key].order];
    const cur = sliderStop(key, order.indexOf(comp[key]));
    const id = `dcf-${key}`;
    return html`<div class="slide">
      <label class="sl" for="${id}">${t(SLIDERS[key].label)}</label>
      <input type="range" id="${id}" data-slider="${key}" min="0" max="${order.length - 1}" step="1" value="${cur.index}" aria-valuetext="${t('panel.slider_valuetext', { label: cur.label, short: cur.short })}">
      <div class="stops" aria-hidden="true">${order.map((k, j) => html`<button type="button" class="stop${j === cur.index ? ' on' : ''}" data-stop="${key}" data-value="${j}" tabindex="-1">${DCF_LETTER[SLIDERS[key].table][k].label}</button>`)}</div>
      <div class="sv" id="${id}-v">${cur.short}</div>
    </div>`;
  }
  // While a slider moves, only its caption and stop names follow the thumb; the letter is rebuilt on
  // 'change' (mouse release, or each keypress), so the control is never replaced under a drag.
  function previewSlider(s) {
    const stop = sliderStop(s.dataset.slider, s.value);
    s.setAttribute('aria-valuetext', t('panel.slider_valuetext', { label: stop.label, short: stop.short }));
    const cap = composer.querySelector(`#dcf-${s.dataset.slider}-v`);
    if (cap) cap.textContent = stop.short;
    composer.querySelectorAll(`.stop[data-stop="${s.dataset.slider}"]`).forEach((b) => b.classList.toggle('on', Number(b.dataset.value) === stop.index));
  }
  function applySlider(key, i) {
    const stop = sliderStop(key, i);
    if (comp[key] === stop.key) return;
    comp[key] = stop.key;
    personalPrev = '';
    saveLetterPrefs();
    const cbody = composer.querySelector('.cbody');
    const top = cbody ? cbody.scrollTop : 0;
    renderComposer();
    const nb = composer.querySelector('.cbody'); if (nb) nb.scrollTop = top;
    const f = composer.querySelector(`input[data-slider="${key}"]`); if (f) f.focus({ preventScroll: true });
  }

  // The home-ZIP caption under the composer's details form.
  const homeNote = () => (state.home ? t('panel.home_set_note', { label: state.home.label }) : t('panel.home_unset_note'));
  // panel.translated_copy (English for the catalog): What this letter says, in your language. The English above is what is sent.
  function translatedBlock(text) {
    return text ? html`<div class="translated"><div class="lbl">${t('panel.translated_copy')}</div><p class="tx" style="white-space: pre-wrap">${text}</p></div>` : '';
  }

  function renderComposer() {
    const you = comp.you;
    const total = comp.list.length;
    const canSend = !!you.name;
    const hit = currentHit();
    const youForm = html`<details class="you" ${canSend ? '' : 'open'}><summary>${t('panel.your_details')}${canSend ? html` · <span class="yn">${you.name}</span>` : ''}</summary>
      <div class="yf">
        <input data-you="name" placeholder="${t('panel.ph_full_name')}" value="${you.name || ''}" autocomplete="name">
        <input data-you="town" placeholder="${t('panel.ph_town')}" value="${you.town || ''}">
        <input data-home maxlength="5" inputmode="numeric" placeholder="${t('panel.ph_home_zip')}" value="${state.home ? state.home.zip : ''}">
        <div class="lbl">${homeNote()}</div>
        <input data-you="street" placeholder="${t('panel.ph_street')}" value="${you.street || ''}" autocomplete="street-address">
        <input data-you="email" placeholder="${t('panel.ph_email')}" value="${you.email || ''}" autocomplete="email">
        <input data-you="phone" placeholder="${t('panel.ph_phone')}" value="${you.phone || ''}" autocomplete="tel">
        <div class="lbl">${t('panel.details_note')}</div>
      </div></details>`;
    const toggles = html`<div class="sliders">${slider('tone')}${slider('detail')}</div>
    <input class="personal" data-personal maxlength="240" placeholder="${t('panel.ph_personal')}" value="${comp.personal}">`;
    const need = canSend ? '' : html`<div class="need">${t('panel.need_name')}</div>`;
    const longNote = html`<div class="need long">${t('panel.long_note')}</div>`;
    const failNote = html`<div class="fine">${t('panel.fail_note')}</div>`;
    const sentCount = comp.list.filter((i) => isSent(recipients[i])).length;
    let doneBox = '';
    if (comp.done || sentCount === total) {
      const rem = reminder(hit.rec);
      const siteLink = rem && rem.site ? html` <a href="${rem.site}" target="_blank" rel="noopener">${state.sites.muni ? t('panel.site_link_municipal') : t('panel.site_link_county')}</a>` : '';
      const addReminder = rem ? html`<a href="${rem.calendar}" target="_blank" rel="noopener">${t('panel.add_reminder')}</a>` : '';
      doneBox = html`<div class="done"><b>${t('panel.done_lead', { sent: sentCount, total })}</b> ${t('panel.thank_you')} ${rem
        ? rem.kind === 'decision'
          ? html`<div class="fine">${tx('panel.next_decision', { text: rem.text }, { date: html`<b>${rem.date}</b>` })} ${addReminder}${siteLink}</div>`
          : html`<div class="fine">${t('panel.check_again', { text: rem.text, days: rem.days, date: rem.date })} ${addReminder}${siteLink}</div>`
        : html`<div class="fine">${t('panel.nothing_pending')}</div>`}</div>`;
    }

    let main;
    if (comp.mode === 'all') {
      const l = combinedLetter();
      const to = l.to.join(',');
      const long = tooLong(comp.mail, to, l);
      const allSent = l.recipients.length > 0 && l.recipients.every(isSent);
      main = html`
        <div class="to"><b>${t('panel.to')}</b> ${l.to.length === l.recipients.length ? t('panel.to_all', { n: l.to.length }) : t('panel.to_addresses', { addresses: l.to.length, n: l.recipients.length })}<div class="fine">${l.to.join(', ')}</div></div>
        <textarea class="letter" spellcheck="false">${l.body}</textarea>
        ${translatedBlock(l.translated)}
        ${need}${long ? longNote : ''}
        <div class="send">${sendLinks(to, l, canSend)}</div>
        <div class="send2">
          <button type="button" class="btn" data-copy>${t('panel.copy_letter')}</button>
          <button type="button" class="btn" data-copy-text="${l.to.join(', ')}">${t('panel.copy_addresses')}</button>
          <button type="button" class="btn" data-copy-text="${l.subject}">${t('panel.copy_subject')}</button>
          <button type="button" class="btn" data-mark-all>${allSent ? t('panel.unmark_all') : t('panel.mark_all_sent')}</button>
        </div>
        ${failNote}`;
    } else {
      const r = recipients[comp.list[comp.i]];
      const l = letterFor(r);
      const c = r.contact;
      const altOnly = !c.email && !c.form;
      const sent = isSent(r);
      const how = c.email ? html`${c.email}${c.via ? t('panel.via', { via: c.via }) : ''}`
        : c.form ? html`${t('panel.form_only')}`
        : html`${t('panel.alt_only', { via: c.via || t('panel.this_board') })}`;
      const altBlock = c.alt ? html`<div class="altc">${altOnly ? '' : html`<span class="lbl">${t('panel.also')}</span>`}${c.alt.phone ? html`<a href="${telHref(c.alt.phone)}">${c.alt.phone}</a>` : ''}${c.alt.address ? html`<span>${c.alt.address}</span>` : ''}${c.alt.social.map((s) => html`<a href="${safeHref(s.url)}" target="_blank" rel="noopener">${s.name || t('panel.official_account')} ${t('panel.board_count_link')}</a>`)}</div>` : '';
      const long = c.email && tooLong(comp.mail, c.email, l);
      let sendRow;
      if (c.email) {
        // Through a shared mailbox, the office phone sits beside the send buttons for a follow-up call.
        const boardPhone = c.via && c.alt && c.alt.phone ? html`<a class="btn" href="${telHref(c.alt.phone)}">${t('panel.call_the_office', { phone: c.alt.phone })}</a>` : '';
        sendRow = html`${long ? longNote : ''}<div class="send">${sendLinks(c.email, l, canSend)}${boardPhone}</div>
          <div class="send2">
            <button type="button" class="btn" data-copy>${t('panel.copy_letter')}</button>
            <button type="button" class="btn" data-copy-text="${c.email}">${t('panel.copy_address')}</button>
            <button type="button" class="btn" data-copy-text="${l.subject}">${t('panel.copy_subject')}</button>
            <button type="button" class="btn" data-mark>${sent ? t('panel.sent_undo') : t('panel.mark_as_sent')}</button>
          </div>
          ${failNote}`;
      } else if (c.form) {
        sendRow = html`<div class="send">
            <button type="button" class="btn primary" data-form="${safeHref(c.form)}">${t('panel.open_contact_form')}</button>
            <button type="button" class="btn ${canSend ? '' : 'off'}" data-copy>${t('panel.copy_letter')}</button>
          </div>
          <div class="send2">
            <button type="button" class="btn" data-copy-text="${l.subject}">${t('panel.copy_subject')}</button>
            ${you.email ? html`<button type="button" class="btn" data-copy-text="${you.email}">${t('panel.copy_your_email')}</button>` : ''}
            <button type="button" class="btn" data-mark>${sent ? t('panel.sent_undo') : t('panel.mark_as_sent')}</button>
          </div>
          <div class="fine">${t('panel.form_note')}</div>`;
      } else {
        // The call is made in English; a copy in the interface language sits under each script.
        const callCtx = { person: r.person, originPlace: (residence() || {}).place || '' };
        const s = DCF_LETTER.callScript(hit.rec, hit, callCtx, you, { tone: comp.tone, lang: 'en' });
        const tl = translatedLang();
        const st = tl ? DCF_LETTER.callScript(hit.rec, hit, callCtx, you, { tone: comp.tone, lang: tl }) : null;
        sendRow = html`<div class="script">
            <h4>${t('panel.call_heading')}</h4><p>${s.call}</p>${st ? translatedBlock(st.call) : ''}
            <h4>${t('panel.voicemail_heading')}</h4><p>${s.voicemail}</p>${st ? translatedBlock(st.voicemail) : ''}
            <div class="send2"><button type="button" class="btn" data-copy-text="${s.call}">${t('panel.copy_call_script')}</button>${c.alt && c.alt.phone ? html`<a class="btn primary" href="${telHref(c.alt.phone)}">${t('panel.call_phone', { phone: c.alt.phone })}</a>` : ''}</div>
          </div>
          <div class="send">
            <button type="button" class="btn ${canSend ? 'primary' : 'off'}" data-print>${t('panel.print_letter')}</button>
            <button type="button" class="btn" data-copy>${t('panel.copy_letter')}</button>
          </div>
          <div class="send2">
            ${c.alt && c.alt.address ? html`<button type="button" class="btn" data-copy-text="${c.alt.address}">${t('panel.copy_mailing_address')}</button>` : ''}
            <button type="button" class="btn" data-mark>${sent ? t('panel.done_undo') : t('panel.mark_as_done')}</button>
          </div>`;
      }
      main = html`
        <div class="to"><b>${t('panel.to')}</b> ${t('panel.to_person', { name: r.person.name, title: r.person.title, place: r.place ? `, ${r.place}` : '' })}${sent ? html` <span class="sentmark">${t('panel.sent_mark')}</span>` : ''}
          <div class="fine">${how}</div>${altBlock}</div>
        <textarea class="letter" spellcheck="false">${l.body}</textarea>
        ${translatedBlock(l.translated)}
        ${need}
        ${sendRow}
        ${total > 1 ? html`<div class="steps"><button type="button" class="btn" data-step="-1" ${comp.i === 0 ? 'disabled' : ''}>${t('panel.previous')}</button><span>${t('panel.step_of', { i: comp.i + 1, total })}${sentCount ? html`<span class="prog">${t('panel.step_sent', { n: sentCount })}</span>` : ''}</span><button type="button" class="btn" data-step="1" ${comp.i === total - 1 ? 'disabled' : ''}>${sent ? t('panel.next') : t('panel.skip')}</button></div>` : ''}`;
    }

    const emailable = comp.list.filter((i) => recipients[i].contact.email).length;
    setHTML(composer, html`
      <div class="ctop"><div><div class="t">${total === 1 ? t('panel.write_to_this_official') : t('panel.write_to_n_officials', { n: total })}</div><div class="s">${t('panel.about_project', { project: hit.rec.name })}</div></div><button type="button" class="x" data-close aria-label="${t('panel.close')}">×</button></div>
      <div class="cbody">
        ${doneBox}
        ${youForm}
        ${toggles}
        ${total > 1 && emailable > 1 ? html`<div class="modes"><button type="button" data-mode="each" aria-pressed="${String(comp.mode === 'each')}">${t('panel.mode_each', { n: total })}</button><button type="button" data-mode="all" aria-pressed="${String(comp.mode === 'all')}">${t('panel.mode_all', { n: emailable })}</button></div>` : ''}
        ${main}
        <div class="fine">${t('panel.composer_footer')}</div>
      </div>`);
  }

  // Current letter text + subject, for the send links and the copy buttons.
  function currentLetter() {
    const ta = composer.querySelector('textarea.letter');
    const fresh = comp.mode === 'all' ? combinedLetter() : letterFor(recipients[comp.list[comp.i]]);
    return { subject: fresh.subject, body: ta ? ta.value : fresh.body, translated: fresh.translated, to: comp.mode === 'all' ? fresh.to.join(',') : recipients[comp.list[comp.i]].contact.email || '' };
  }
  function refreshLinks() {
    const l = currentLetter();
    composer.querySelectorAll('.send a[data-mail]').forEach((a) => {
      const k = a.dataset.mail;
      const long = tooLong(k, l.to, l);
      a.href = MAIL[k].url(l.to, long ? { ...l, body: pasteNote() } : l);
      a.toggleAttribute('data-copy-first', long);
      a.textContent = t(MAIL[k].label) + (long ? t('panel.copy_then_paste') : '');
      a.classList.toggle('off', !comp.you.name);
    });
    // The translated copy follows the regenerated English letter; it is never edited by hand.
    const tr = composer.querySelector('.translated .tx');
    if (tr && l.translated) tr.textContent = l.translated;
    composer.querySelectorAll('.send [data-copy], .send [data-print]').forEach((b) => {
      b.classList.toggle('off', !comp.you.name);
      if (b.dataset.print != null) b.classList.toggle('primary', !!comp.you.name);
    });
    const need = composer.querySelector('.need:not(.long)');
    if (need && comp.you.name) need.remove();
  }

  // The textarea always holds the English letter, so these match its English sign-off and salutation.
  const SINCERELY = () => `\n${DCF_I18N.tIn('en', 'letter.sincerely')}\n`;
  const SALUTATION_RE = /^(Dear |To the officials)/m;
  // Keep the edited letter's text but take the signature block from a freshly built one.
  function refreshSignature(ta, fresh) {
    const sig = fresh.split(SINCERELY())[1];
    if (sig != null) ta.value = `${ta.value.split(SINCERELY())[0]}${SINCERELY()}${sig}`;
  }

  // The personal line is swapped in place, so edits elsewhere in the letter survive.
  function applyPersonal(ta, prev, next) {
    let v = ta.value;
    if (prev && v.includes(`\n\n${prev}\n`)) { v = v.replace(`\n\n${prev}\n`, next ? `\n\n${next}\n` : '\n'); }
    else if (next) {
      const sal = v.search(SALUTATION_RE);
      const start = v.indexOf('\n\n', sal) + 2; // the opening paragraph
      const end = v.indexOf('\n\n', start);
      v = end > 0 ? `${v.slice(0, end)}\n\n${next}${v.slice(end)}` : `${v}\n\n${next}`;
    }
    ta.value = v;
  }

  // Keep the letter in sync with the signature and personal-line fields without re-rendering the textarea.
  let personalPrev = '';
  composer.addEventListener('input', (e) => {
    const ta = composer.querySelector('textarea.letter');
    const s = e.target.closest('input[data-slider]');
    if (s) { previewSlider(s); return; }
    const h = e.target.closest('[data-home]');
    if (h) {
      const z = h.value.replace(/\D/g, '').slice(0, 5);
      h.value = z;
      if (z.length && z.length < 5) return;
      // The letter as generated before the change, to tell an untouched letter from an edited one.
      const was = ta ? (comp.mode === 'all' ? combinedLetter() : letterFor(recipients[comp.list[comp.i]])).body : '';
      setHome(z).then((home) => {
        if (home === undefined || h.value !== z) return; // superseded, or typed on while the lookup ran
        if (z && !home) { toast(t('panel.home_zip_not_found', { zip: z }), true); return; }
        if (comp.you.townAuto) comp.you.town = originTown();
        // Update in place: a rebuild would drop letter edits and close the details panel being typed in.
        const town = composer.querySelector('input[data-you="town"]');
        if (town && comp.you.townAuto) town.value = comp.you.town;
        const cap = h.nextElementSibling;
        if (cap && cap.classList.contains('lbl')) cap.textContent = homeNote();
        if (ta) {
          const fresh = comp.mode === 'all' ? combinedLetter() : letterFor(recipients[comp.list[comp.i]]);
          if (ta.value === was) { ta.value = fresh.body; personalPrev = ''; }
          else refreshSignature(ta, fresh.body);
        }
        refreshLinks();
      });
      return;
    }
    const f = e.target.closest('[data-you]');
    if (f) {
      comp.you[f.dataset.you] = f.value.trim();
      if (f.dataset.you === 'town') comp.you.townAuto = false;
      store.set(YOU_KEY, comp.you);
      if (ta) {
        const fresh = comp.mode === 'all' ? combinedLetter() : letterFor(recipients[comp.list[comp.i]]);
        refreshSignature(ta, fresh.body);
      }
      refreshLinks();
      return;
    }
    const p = e.target.closest('[data-personal]');
    if (p) {
      const next = p.value.trim();
      if (ta) applyPersonal(ta, personalPrev || comp.personal, next);
      personalPrev = next;
      comp.personal = next;
      saveLetterPrefs();
      refreshLinks();
      return;
    }
    if (e.target === ta) refreshLinks();
  });
  composer.addEventListener('change', (e) => {
    const s = e.target.closest('input[data-slider]');
    if (s) applySlider(s.dataset.slider, s.value);
  });

  function printLetter(text, address) {
    const w = window.open('', '_blank', 'popup,width=720,height=900');
    if (!w) { toast(t('panel.popups_blocked'), true); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(t('panel.print_title'))}</title><style>body{font:14px/1.5 Georgia,"Times New Roman",serif;margin:1in;white-space:pre-wrap}</style></head><body>${esc(address ? `${address}\n\n` : '')}${esc(text)}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  // After a send, move on to the next person who hasn't been written to yet.
  function advance() {
    const next = comp.list.findIndex((i, k) => k > comp.i && !isSent(recipients[i]));
    if (next >= 0) comp.i = next; else comp.done = true;
    renderComposer();
    composer.scrollTop = 0;
  }

  // After a send link is used, wait for a sign that something opened: a new tab or the mail program
  // takes focus, so this page blurs or goes hidden. A mailto with no mail program does neither. The
  // recipient is never marked on a timer; the writer confirms, in the strip below, after pressing Send.
  // Chrome's own "Open Mail?" confirmation also blurs the page before anything launches. For the mail
  // app a blur counts only once it has lasted a second: Cancel hands focus straight back, a launched
  // mail program keeps it. A blur that ends sooner settles nothing, so the timer decides.
  const HANDOFF_MS = { gmail: 1500, outlook: 1500, yahoo: 1500, app: 6000 };
  const APP_SETTLE_MS = 1000;
  function awaitHandOff(key) {
    return new Promise((resolve) => {
      let settled = false;
      const fin = (ok) => { if (settled) return; settled = true; window.removeEventListener('blur', onBlur); document.removeEventListener('visibilitychange', onVis); resolve(ok); };
      const onBlur = () => {
        if (key !== 'app') { fin(true); return; }
        setTimeout(() => { if (!document.hasFocus()) fin(true); }, APP_SETTLE_MS);
      };
      const onVis = () => { if (document.hidden) fin(true); };
      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onVis);
      setTimeout(() => fin(false), HANDOFF_MS[key] || 1500);
    });
  }
  // The strip carries the recipients the link was clicked for, so a Skip or a slider change during the
  // wait cannot make the confirmation mark someone else. A re-render discards the strip and its target.
  function showHandOff(opened, key, who, target) {
    const old = composer.querySelector('.handoff');
    if (old) old.remove();
    const strip = document.createElement('div');
    strip.className = `handoff ${opened ? '' : 'err'}`;
    strip.handOffTarget = target;
    const where = t(MAIL[key].name);
    const tail = t('panel.handoff_tail');
    setHTML(strip, opened
      ? html`<span>${key === 'app' ? t('panel.handoff_app_opened') : t('panel.handoff_opened', { where })}</span><button type="button" class="btn primary" data-confirm-sent>${t('panel.mark_who_sent', { who })}</button><button type="button" class="btn" data-dismiss>${t('panel.not_yet')}</button>`
      : html`<span>${key === 'app' ? t('panel.handoff_nothing_opened', { tail }) : t('panel.handoff_not_opened', { where, tail })}</span><button type="button" class="btn" data-copy>${t('panel.copy_letter')}</button><button type="button" class="btn" data-confirm-sent>${t('panel.it_opened')}</button><button type="button" class="btn" data-dismiss>${t('panel.close')}</button>`);
    const anchor = composer.querySelector('.send2') || composer.querySelector('.send');
    if (!anchor) return;
    anchor.insertAdjacentElement('afterend', strip);
    strip.querySelector('button').focus();
  }
  async function confirmSent(target) {
    if (composer.hidden || !currentHit() || !target || !target.rs.length) return;
    await markSent(target.rs);
    if (target.all) { comp.done = true; renderComposer(); }
    else if (comp.mode === 'each' && recipients[comp.list[comp.i]] === target.rs[0]) advance();
    else renderComposer();
  }

  composer.addEventListener('click', async (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.close != null) { closeComposer(); return; }
    if (t.dataset.mode) { comp.mode = t.dataset.mode; renderComposer(); return; }
    if (t.dataset.stop) { applySlider(t.dataset.stop, t.dataset.value); return; }
    if (t.dataset.step) { comp.i = Math.max(0, Math.min(comp.list.length - 1, comp.i + Number(t.dataset.step))); personalPrev = ''; renderComposer(); composer.scrollTop = 0; return; }
    if (t.dataset.mark != null) {
      const r = recipients[comp.list[comp.i]];
      if (isSent(r)) { await unmarkSent([r]); comp.done = false; renderComposer(); } else { await markSent([r]); advance(); }
      return;
    }
    if (t.dataset.markAll != null) {
      const rs = combinedLetter().recipients;
      if (rs.length && rs.every(isSent)) { await unmarkSent(rs); comp.done = false; } else { await markSent(rs); comp.done = true; }
      renderComposer();
      return;
    }
    if (t.dataset.confirmSent != null) { const s = t.closest('.handoff'); await confirmSent(s && s.handOffTarget); return; }
    if (t.dataset.dismiss != null) { const s = t.closest('.handoff'); if (s) s.remove(); return; }
    if (t.dataset.form) { window.open(t.dataset.form, 'dcf-form', 'popup,width=760,height=900'); return; }
    if (t.dataset.print != null) {
      if (!comp.you.name) { toast(DCF_I18N.t('panel.name_first_print'), true); return; }
      printLetter(currentLetter().body, ''); // the letter's own head block carries the name, title and mailing address
      return;
    }
    if (t.dataset.copy != null || t.dataset.copyText != null) {
      if (t.dataset.copy != null && !comp.you.name) { toast(DCF_I18N.t('panel.name_first_copy'), true); composer.querySelector('details.you').open = true; return; }
      const text = t.dataset.copyText != null ? t.dataset.copyText : currentLetter().body;
      const label = t.textContent;
      try { await navigator.clipboard.writeText(text); t.textContent = DCF_I18N.t('panel.copied'); setTimeout(() => { t.textContent = label; }, 1500); } catch { t.textContent = DCF_I18N.t('panel.copy_manually'); }
      return;
    }
    // Send links: block until there is a signature, refresh the href from the edited text, remember the
    // method, then wait for a sign that the mail window opened and ask the writer to confirm the send.
    // Everything before the first await runs inside the click, so the link navigates with the edited letter.
    if (t.tagName === 'A' && t.dataset.mail) {
      if (!comp.you.name) {
        e.preventDefault();
        composer.querySelector('details.you').open = true;
        const f = composer.querySelector('input[data-you="name"]'); if (f) f.focus();
        toast(DCF_I18N.t('panel.name_first_send'), true);
        return;
      }
      const key = t.dataset.mail;
      const l = currentLetter();
      const long = tooLong(key, l.to, l);
      t.href = MAIL[key].url(l.to, long ? { ...l, body: pasteNote() } : l);
      comp.mail = key;
      saveLetterPrefs();
      const who = comp.mode === 'all' ? DCF_I18N.t('panel.everyone') : recipients[comp.list[comp.i]].person.name;
      const target = { all: comp.mode === 'all', rs: comp.mode === 'all' ? combinedLetter().recipients : [recipients[comp.list[comp.i]]] };
      if (long) {
        e.preventDefault();
        try { await navigator.clipboard.writeText(l.body); } catch { toast(DCF_I18N.t('panel.copy_failed'), true); return; }
        toast(DCF_I18N.t('panel.letter_copied'));
        if (MAIL[key].blank) window.open(t.href, '_blank', 'noopener'); else location.href = t.href;
      }
      const opened = await awaitHandOff(key);
      showHandOff(opened, key, who, target);
    }
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !composer.hidden) { e.stopPropagation(); closeComposer(); } }, true);

  // ---------- start-up ----------

  async function checkPending() {
    const pending = await store.get(PENDING_KEY);
    if (!pending || (!pending.zip && !pending.query) || Date.now() - pending.ts > 2 * 60 * 1000) return;
    await store.remove(PENDING_KEY);
    // A search carried over from another tracker page: keep the picked project and do not bounce again.
    state.pendingIdx = Number.isFinite(pending.idx) ? pending.idx : 0;
    state.noNavFor = pending.navFor || null;
    openDrawer();
    search(pending.zip || pending.query, false, pending.query || '');
  }

  (async () => {
    // The shell was built in English above; it joins the page only once the language is known.
    await DCF_I18N.init();
    if (DCF_I18N.lang !== 'en') renderShell();
    (document.body || document.documentElement).appendChild(host);
    const [prefs, sent, home] = await Promise.all([store.get(PREFS_KEY), store.get(SENT_KEY), store.get(HOME_KEY)]);
    sentAll = sent && typeof sent === 'object' ? sent : {};
    state.home = home && /^\d{5}$/.test(String(home.zip || '')) && Number.isFinite(home.lat) ? home : null;
    const p = prefs || {};
    if (p.zip) input.value = p.zip;
    inactiveBox.checked = !!p.includeInactive;
    if (p.full) setFull(true, { save: false });
    setStatus('idle', idleText());
    await checkPending();
  })();

  if (hasChrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'dcf-pending') { checkPending(); sendResponse({ ok: true }); }
    });
  }
  // The popup can change the language, or set or clear the home ZIP, while a tracker page is open.
  if (hasChrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.dcfLang) setLang(changes.dcfLang.newValue);
      if (!changes[HOME_KEY]) return;
      const next = changes[HOME_KEY].newValue || null;
      if ((next && next.ts) === (state.home && state.home.ts)) return; // this tab's own setHome already applied it
      state.home = next && /^\d{5}$/.test(String(next.zip || '')) && Number.isFinite(next.lat) ? next : null;
      if (composer.hidden) return; // openComposer recomputes the town line
      if (comp.you.townAuto) comp.you.town = originTown();
      personalPrev = '';
      renderComposer();
    });
  }

  // Exposed for the test harness only.
  window.__dcfSearch = (zip) => { openDrawer(); return search(zip); };
})();
