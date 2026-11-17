// Service worker: routes toolbar searches to a tracker tab and looks up ZIPs outside the bundled states.
importScripts('states.js');
const SITE = 'https://trackdatacenters.com';
// Postal code -> tracker page slug, from states.json (a neighbor opens the page of the state it borders;
// an empty slug means the tracker has no page for that state, so the national map opens).
const STATE_PAGE = {};
for (const s of DCF_STATES.states) {
  STATE_PAGE[s.abbr] = s.trackerPage;
  for (const n of s.neighborZips || []) if (!(n in STATE_PAGE)) STATE_PAGE[n] = s.trackerPage;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'dcf-open') {
    openWithZip(msg.zip, msg.state).then(() => sendResponse({ ok: true }), (err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (msg && msg.type === 'dcf-zip-lookup') {
    lookupZip(msg.zip).then(sendResponse, () => sendResponse(null));
    return true;
  }
  if (msg && msg.type === 'dcf-goto-state') {
    // Switch this tracker tab to another state's map and carry the search along (the panel resumes it on load).
    if (!sender.tab || sender.tab.id == null) { sendResponse({ ok: false, error: 'no tab' }); return false; }
    const page = String(msg.page || '').replace(/[^a-z-]/g, '');
    if (!page) { sendResponse({ ok: false, error: 'no page' }); return false; }
    chrome.storage.local.set({ dcfPending: { zip: msg.zip, query: msg.query || '', idx: Number(msg.idx) || 0, navFor: msg.navFor || null, ts: Date.now() } })
      .then(() => chrome.tabs.update(sender.tab.id, { url: `${SITE}/usa/${page}` }))
      .then(() => sendResponse({ ok: true }), (err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
    return true;
  }
  if (msg && msg.type === 'dcf-map-focus') {
    if (!sender.tab || sender.tab.id == null) { sendResponse({ ok: false, error: 'no tab' }); return false; }
    if (!chrome.scripting || !chrome.scripting.executeScript) {
      sendResponse({ ok: false, error: 'the "scripting" permission is not active; remove and re-add the extension in chrome://extensions' });
      return false;
    }
    // The panel runs in the content-script world and cannot touch the page's map object, so this
    // runs in the page's own world and talks to the tracker's Mapbox map directly.
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      func: focusTrackerMap,
      args: [Number(msg.lat), Number(msg.lon), Number(msg.zoom) || 13, String(msg.id || ''), !!msg.open],
    }).then((r) => sendResponse(r && r[0] && r[0].result ? r[0].result : { ok: false, error: 'the page script returned nothing' }), (err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
    return true;
  }
  return false;
});

// Runs inside trackdatacenters.com: fly the site's map to a project and, if asked, open its detail card.
// The site keeps its Mapbox map on window.__padcMapRef once loaded; before that it is found through React.
function focusTrackerMap(lat, lon, zoom, id, open) {
  function findMap() {
    const ref = window.__padcMapRef;
    if (ref && ref.current && typeof ref.current.flyTo === 'function') return ref.current;
    const el = document.querySelector('.mapboxgl-map');
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'));
    let fiber = key ? el[key] : null;
    const seen = new Set();
    const scan = (obj, depth) => {
      if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > 3) return null;
      seen.add(obj);
      if (typeof obj.flyTo === 'function' && typeof obj.getCenter === 'function') return obj;
      for (const k of Object.keys(obj)) { try { const r = scan(obj[k], depth + 1); if (r) return r; } catch { /* ignore */ } }
      return null;
    };
    for (let i = 0; fiber && i < 30; i++, fiber = fiber.return) {
      const found = scan(fiber.memoizedProps, 0) || scan(fiber.memoizedState, 0);
      if (found) return found;
    }
    return null;
  }
  const map = findMap();
  if (!map) return { ok: false, error: 'map not found' };
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ok: false, error: 'no coordinates' };
  const center = [lon, lat];
  map.flyTo({ center, zoom, duration: 900, essential: true });
  if (!open) return { ok: true, opened: false };
  // After the move, click the project's own point so the site shows its card.
  return new Promise((resolve) => {
    const done = () => {
      let feature = null;
      try {
        const feats = map.querySourceFeatures('points-data-centers-src') || [];
        const mine = id ? feats.filter((f) => f.properties && f.properties.entryFeatureId === `dc-${id}`) : feats;
        const dist = (f) => { const [x, y] = f.geometry.coordinates; return (x - lon) ** 2 + (y - lat) ** 2; };
        feature = mine.sort((a, b) => dist(a) - dist(b))[0] || null;
        if (feature && !id && dist(feature) > 1e-4) feature = null;
      } catch { feature = null; }
      if (!feature) { resolve({ ok: true, opened: false }); return; }
      const point = map.project(feature.geometry.coordinates);
      map.fire('click', { point, lngLat: map.unproject(point), originalEvent: new MouseEvent('click') });
      resolve({ ok: true, opened: true });
    };
    map.once('moveend', () => setTimeout(done, 250));
    setTimeout(() => resolve({ ok: true, opened: false }), 4000);
  });
}

// The panel lives on the tracker itself, so show the result there:
// reuse the current or an open tracker tab, otherwise open the matching state map.
async function openWithZip(zip, state) {
  await chrome.storage.local.set({ dcfPending: { zip, ts: Date.now() } });
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  let tab = active && active.url && active.url.startsWith(SITE) ? active : null;
  if (!tab) [tab] = await chrome.tabs.query({ url: `${SITE}/*` });
  if (!tab) {
    const page = state in STATE_PAGE ? STATE_PAGE[state] : 'pennsylvania';
    const created = await chrome.tabs.create({ url: page ? `${SITE}/usa/${page}` : `${SITE}/usa`, active: true });
    // A new tab is active in its window; make sure that window is the one in front.
    await chrome.windows.update(created.windowId, { focused: true });
    return;
  }
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'dcf-pending' });
  } catch {
    // Tab was opened before the extension was installed, so the panel isn't there yet.
    await chrome.tabs.reload(tab.id);
  }
}

// Fallback for ZIPs outside the bundled area (e.g. just over the border in NJ, NY, OH, WV or DE).
async function lookupZip(zip) {
  if (!/^\d{5}$/.test(String(zip))) return null;
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!res.ok) return null;
  const body = await res.json();
  const place = body.places && body.places[0];
  if (!place) return null;
  return {
    lat: parseFloat(place.latitude),
    lon: parseFloat(place.longitude),
    place: place['place name'],
    state: place['state abbreviation'],
  };
}
