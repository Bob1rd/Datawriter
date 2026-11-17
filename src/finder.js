// Pure helpers for the panel: geography, ranking, labels and formatting.
// No DOM access here, so the same file can be loaded by the popup and the content script.
const DCF = (() => {
  const EARTH_MILES = 3958.8;
  const MERC_R = 6378137;

  // Label tables mirror the ones the tracker uses on its own pages.
  const PHASES = {
    preliminary: 'finder.phase_preliminary',
    proposed: 'finder.phase_proposed',
    expansion: 'finder.phase_expansion',
    construction: 'finder.phase_construction',
    delayed: 'finder.phase_delayed',
    operational: 'finder.phase_operational',
    withdrawn: 'finder.phase_withdrawn',
    rejected: 'finder.phase_rejected',
    retired: 'finder.phase_retired',
  };
  const INACTIVE_PHASES = new Set(['withdrawn', 'rejected', 'retired']);

  // One color per stage, ordered by how much a letter can still change: red = decision pending.
  // window: how effective public letters are at this stage (high / medium / low).
  // label/short/note resolve through t() on every read, so a language change needs no rebuild.
  const stage = (key, color, bg, ink, win) => ({
    get label() { return t(`finder.stage_${key}_label`); },
    get short() { return t(`finder.stage_${key}_short`); },
    get note() { return t(`finder.stage_${key}_note`); },
    color, bg, ink, window: win,
  });
  const STAGES = {
    proposed: stage('proposed', '#c62828', '#ffe3e3', '#8e1a1a', 'high'),
    preliminary: stage('preliminary', '#e08a00', '#fff1d6', '#7a4a00', 'high'),
    delayed: stage('delayed', '#8e24aa', '#f3e5f5', '#5a1470', 'high'),
    expansion: stage('expansion', '#ef6c00', '#ffe9d6', '#8a3300', 'medium'),
    construction: stage('construction', '#6d4c41', '#efe7e4', '#4e342e', 'low'),
    operational: stage('operational', '#2e7d32', '#e1f1e2', '#1b5e20', 'low'),
    withdrawn: stage('withdrawn', '#607d8b', '#eceff1', '#37474f', 'medium'),
    rejected: stage('rejected', '#455a64', '#eceff1', '#263238', 'low'),
    retired: stage('retired', '#78909c', '#eceff1', '#37474f', 'low'),
  };
  const STAGE_ORDER = ['proposed', 'preliminary', 'delayed', 'expansion', 'construction', 'operational', 'withdrawn', 'rejected', 'retired'];
  const WINDOW_LABEL = {
    get high() { return t('finder.window_high'); },
    get medium() { return t('finder.window_medium'); },
    get low() { return t('finder.window_low'); },
  };
  const WINDOW_SHORT = {
    get high() { return t('finder.window_high_short'); },
    get medium() { return t('finder.window_medium_short'); },
    get low() { return t('finder.window_low_short'); },
  };
  const stageInfo = (phase) => STAGES[String(phase || '').toLowerCase()] || { label: phase ? label({}, String(phase)) : t('finder.stage_unknown_label'), color: '#9e9e9e', bg: '#f0f0f0', ink: '#424242', window: 'medium', short: phase ? t('finder.stage_unrecognized_short') : t('finder.stage_unrecorded_short'), note: t('finder.stage_unknown_note') };
  const ROLES = {
    A: 'finder.role_a', C: 'finder.role_c', D: 'finder.role_d', E: 'finder.role_e',
    F: 'finder.role_f', G: 'finder.role_g', H: 'finder.role_h', I: 'finder.role_i', L: 'finder.role_l',
    N: 'finder.role_n', O: 'finder.role_o', R: 'finder.role_r', T: 'finder.role_t', U: 'finder.role_u',
    V: 'finder.role_v', Y: 'finder.role_y',
  };
  const NICHES = {
    ai: 'finder.niche_ai', cloud: 'finder.niche_cloud', colocation: 'finder.niche_colocation', hpc: 'finder.niche_hpc',
    crypto: 'finder.niche_crypto', telecom: 'finder.niche_telecom', isp: 'finder.niche_isp', edge: 'finder.niche_edge',
    government: 'finder.niche_government', research: 'finder.niche_research', other: 'finder.niche_other',
  };
  const POWER = {
    gas: 'finder.power_gas', coal: 'finder.power_coal', nuclear: 'finder.power_nuclear', diesel: 'finder.power_diesel', hydro: 'finder.power_hydro',
    wind: 'finder.power_wind', solar: 'finder.power_solar', geothermal: 'finder.power_geothermal', biomass: 'finder.power_biomass', fuel_cell: 'finder.power_fuel_cell',
    grid: 'finder.power_grid', hybrid: 'finder.power_hybrid',
  };
  const COOLING_SOURCE = { air: 'finder.cooling_air', water: 'finder.cooling_water', hybrid: 'finder.cooling_hybrid' };
  const COOLING_TYPE = { closed: 'finder.cooling_type_closed', open: 'finder.cooling_type_open', fans: 'finder.cooling_type_fans' };
  const APPROVAL_TYPES = {
    discretionary_use: 'finder.approval_discretionary_use',
    variance: 'finder.approval_variance',
    rezoning: 'finder.approval_rezoning',
    site_development_plan: 'finder.approval_site_development_plan',
    subdivision_plat: 'finder.approval_subdivision_plat',
    other: 'finder.approval_other',
  };
  const APPROVAL_STATUS = {
    pending: 'finder.status_pending', approved: 'finder.status_approved', denied: 'finder.status_denied', withdrawn: 'finder.status_withdrawn', appealed: 'finder.status_appealed',
  };
  const CONFIDENCE = {
    exact: 'finder.confidence_exact',
    approximate: 'finder.confidence_approximate',
    uncertain: 'finder.confidence_uncertain',
  };

  // All-in greenfield build cost, US & Canada, excluding chips/GPUs.
  // Cushman & Wakefield, 2026 Data Center Development Cost Guide (Aug 2026).
  const COST_PER_MW = { low: 8.9e6, high: 23.3e6 };

  // Every covered state comes from states.js (generated from tools/states.json): names, figures, routing.
  // Projects in these states are searched; a state listed there before the tracker has rows for it
  // (Illinois in October 2026) simply sends its ZIPs to the nearest project in another covered state.
  const STATES = (typeof DCF_STATES !== 'undefined' ? DCF_STATES : globalThis.DCF_STATES || { states: [] }).states;
  const stateInfo = (name) => STATES.find((s) => s.name === name) || null;
  const DC_AREA = new Set(STATES.filter((s) => s.compare === 'dc').map((s) => s.name));
  const COVERED_STATES = new Set(STATES.map((s) => s.name));
  const STATE_ABBR = Object.fromEntries(STATES.map((s) => [s.name, s.abbr]));

  // Reference points for the plain-English comparisons.
  const REF = {
    homeKw: 10791 / 8760, // EIA: the average U.S. home used 10,791 kWh in 2022
    fieldSqft: 57600, // American football field incl. end zones, 360 × 160 ft
    fieldAcres: 57600 / 43560,
    centralParkAcres: 843, // NYC Parks
    pentagonSqft: 6.5e6, // Pentagon gross floor area
    sqmiAcres: 640,
    cities: {
      // Con Edison Zone J (New York City) used 53,360 GWh in 2018 (NYC Planning environmental reviews).
      nyc: { name: 'finder.city_nyc', short: 'NYC', avgMw: 53360000 / 8760 },
      // EIA State Electricity Profile, 2024 retail sales: DC 10,142,915 MWh. Other states carry their own
      // figure in states.json (compare: "self").
      dc: { name: 'finder.city_dc', short: 'DC', avgMw: 10142915 / 8760 },
    },
    // Census Bureau Vintage 2025 estimates (July 1, 2025), from states.json.
    population: Object.fromEntries(STATES.filter((s) => s.population).map((s) => [s.name, s.population])),
    demonym: Object.fromEntries(STATES.map((s) => [s.name, s.demonym])),
    carCo2: 4.29, // t CO2 a year for a typical gasoline car (EPA Greenhouse Gas Equivalencies, 2022 data)
    lbPerTon: 2204.62,
  };
  // Grid emission rates (lb CO2 per MWh) live in states.json as co2LbPerMwh with their EIA year. The gas
  // figure applies when a project generates its own power behind the meter from natural gas: EPA's
  // standard for a new base-load combined-cycle gas turbine (40 CFR 60 Subpart TTTTa), 800 lb/MWh gross.
  const GAS_LB_PER_MWH = 800;

  // Carbon from running at the given load all year: the state's grid rate, or the gas rate for a project
  // with its own gas plant. Null when the registry has no rate for the state.
  function carbonCompare(mw, rec) {
    const s = stateInfo(rec.state);
    const gas = String(rec.btmPower) === 'true' && (Array.isArray(rec.powerSource) ? rec.powerSource : []).includes('gas');
    const rate = gas ? GAS_LB_PER_MWH : s && s.co2LbPerMwh;
    if (!isNum(rate) || !isNum(mw)) return null;
    const tons = (mw * 8760 * rate) / REF.lbPerTon;
    return { tons, tonsText: friendly(tons), cars: friendly(tons / REF.carCo2), gas, year: gas ? '' : s.co2Year || '', rate };
  }

  // Years between the announcement and the expected opening, when the tracker has both dates.
  function timeline(rec) {
    const toDate = (v) => { const [y, m, d] = String(v || '').split('-').map((p) => parseInt(p, 10)); return y ? new Date(y, (m || 7) - 1, d || 1) : null; };
    const a = toDate(rec.dateAnnounced);
    const o = toDate(rec.dateOnline);
    if (!a || !o || o <= a) return null;
    const years = (o - a) / (365.25 * 24 * 3600 * 1000);
    return { years, yearsText: String(Number(years.toFixed(1))), announced: fmtDate(rec.dateAnnounced), online: fmtDate(rec.dateOnline) };
  }

  const month = (m) => (m >= 1 && m <= 12 ? t(`finder.month_${m}`) : '');

  const rad = (d) => (d * Math.PI) / 180;

  function distanceMiles(lat1, lon1, lat2, lon2) {
    const dLat = rad(lat2 - lat1);
    const dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_MILES * Math.asin(Math.sqrt(a));
  }

  function compass(lat1, lon1, lat2, lon2) {
    const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
    const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
    const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    return t(`finder.compass_${['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'][Math.round(deg / 45) % 8]}`);
  }

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  // A record can describe several sites (campuses); each may carry its own coordinates.
  function sitePoints(rec) {
    const sites = Array.isArray(rec.sites) ? rec.sites.filter((s) => isNum(s.lat) && isNum(s.lon)) : [];
    if (sites.length) return sites;
    if (isNum(rec.lat) && isNum(rec.lon)) {
      return [{ lat: rec.lat, lon: rec.lon, address: rec.address, municipality: rec.municipality, geojson: rec.geojson, locationConfidence: rec.locationConfidence }];
    }
    return [];
  }

  const inCoverage = (rec) => COVERED_STATES.has(rec.state);

  function rankByDistance(records, lat, lon, { includeInactive = false } = {}) {
    const out = [];
    for (const rec of records) {
      if (!inCoverage(rec)) continue;
      if (!includeInactive && INACTIVE_PHASES.has(String(rec.phase || '').toLowerCase())) continue;
      let best = null;
      for (const site of sitePoints(rec)) {
        const miles = distanceMiles(lat, lon, site.lat, site.lon);
        if (!best || miles < best.miles) best = { rec, site, miles, dir: compass(lat, lon, site.lat, site.lon) };
      }
      if (best) out.push(best);
    }
    return out.sort((a, b) => a.miles - b.miles);
  }

  // ---------- numbers & text ----------

  function trimNum(x) {
    return String(Number(x.toFixed(x >= 100 ? 0 : 1)));
  }

  function money(n) {
    if (!isNum(n)) return '';
    if (n >= 999.5e6) return `$${trimNum(n / 1e9)}B`;
    if (n >= 999500) return `$${trimNum(n / 1e6)}M`;
    return `$${Math.round(n).toLocaleString('en-US')}`;
  }

  const count = (n) => (isNum(n) ? Math.round(n).toLocaleString('en-US') : '');

  // Round for reading aloud: 757 -> "757", 12,345 -> "12,000", 1,790,000 -> "1.8 million".
  function friendly(n) {
    if (!isNum(n)) return '';
    if (n < 10) return String(Number(n.toFixed(1)));
    if (n < 1000) return count(n);
    // Chinese counts in ten-thousands (万) and hundred-millions (亿).
    if (DCF_I18N.lang === 'zh_CN' && n >= 9995) {
      if (n < 99995e3) return t('finder.wan', { n: trimNum(n / 1e4) });
      return t('finder.yi', { n: trimNum(n / 1e8) });
    }
    if (n < 999500) {
      const step = 10 ** (Math.floor(Math.log10(n)) - 1);
      return count(Math.round(n / step) * step);
    }
    if (n < 999.5e6) { const m = trimNum(n / 1e6); return t(m === '1' ? 'finder.million_one' : 'finder.million', { n: m }); }
    return t('finder.billion', { n: trimNum(n / 1e9) });
  }

  // 1.19 -> "1.2×", 0.38 -> "38%"
  function ratioText(r) {
    if (r >= 0.995) return t('finder.times', { n: String(Number(r.toFixed(r >= 10 ? 0 : 1))) });
    return t('finder.percent', { n: Math.max(1, Math.round(r * 100)) });
  }

  function durationText(days) {
    const unit = (k, w) => t(`finder.unit_${w}${k === 1 ? '' : 's'}`, { n: k });
    if (days < 1) return unit(Math.max(1, Math.round(days * 24)), 'hour');
    if (days < 14) return unit(Math.round(days), 'day');
    if (days < 60) return unit(Math.round(days / 7), 'week');
    if (days < 548) return unit(Math.round(days / 30.4), 'month');
    const years = Number((days / 365).toFixed(1));
    return unit(years, 'year');
  }

  // NYC for the Northeast, DC for the DC area, otherwise the state's own electricity use (states.json).
  function cityFor(state) {
    const s = stateInfo(state);
    const named = (c) => ({ name: t(c.name), short: c.short, avgMw: c.avgMw });
    if (s && s.compare === 'dc') return named(REF.cities.dc);
    if (s && s.compare === 'self' && s.electricityMwh) return { name: s.name, short: s.name, avgMw: s.electricityMwh / 8760 };
    return named(REF.cities.nyc);
  }

  // Power: homes, plus how long a full year of output would run a familiar city.
  function powerCompare(mw, state) {
    const city = cityFor(state);
    return {
      homes: friendly((mw * 1000) / REF.homeKw),
      city,
      cityTime: durationText((mw * 365) / city.avgMw),
      share: mw / city.avgMw,
    };
  }

  function landCompare(acres) {
    return {
      fields: friendly(acres / REF.fieldAcres),
      sqmi: acres >= REF.sqmiAcres / 2 ? String(Number((acres / REF.sqmiAcres).toFixed(1))) : '',
      park: acres >= REF.centralParkAcres * 0.05 ? ratioText(acres / REF.centralParkAcres) : '',
      parkShare: acres / REF.centralParkAcres,
    };
  }

  function floorCompare(sqft) {
    return {
      fields: friendly(sqft / REF.fieldSqft),
      pentagon: sqft >= REF.pentagonSqft * 0.05 ? ratioText(sqft / REF.pentagonSqft) : '',
      pentagonShare: sqft / REF.pentagonSqft,
    };
  }

  function perResident(low, high, state) {
    const pop = REF.population[state];
    if (!pop || !isNum(low)) return null;
    // Cents below a dollar, two decimals below ten, rounded figures above.
    const fmt = (v) => { const x = v / pop; return x < 1 ? `${Math.max(1, Math.round(x * 100))}¢` : x < 10 ? `$${x.toFixed(2)}` : `$${friendly(x)}`; };
    return { text: isNum(high) && high > low ? `${fmt(low)}–${fmt(high)}` : fmt(low), who: REF.demonym[state] || t('finder.resident'), state };
  }

  // "120–766" in the panel; letters pass ' to ' so a sentence reads "120 to 766".
  function range(min, max, fmt, sep = '–') {
    if (!isNum(min) && !isNum(max)) return '';
    if (isNum(min) && isNum(max) && max > min) return `${fmt(min)}${sep}${fmt(max)}`;
    return fmt(isNum(min) ? min : max);
  }

  // Prefer the tracker's aggregated totals (they sum multi-site campuses), then the flat field.
  function metric(rec, key, maxKey) {
    const t = rec.totals && rec.totals[key];
    const min = t && isNum(t.min) ? t.min : isNum(rec[key]) && rec[key] > 0 ? rec[key] : null;
    let max = t && isNum(t.max) ? t.max : null;
    if (max == null && maxKey && isNum(rec[maxKey])) max = rec[maxKey];
    return { min, max: isNum(max) && isNum(min) && max > min ? max : null };
  }

  function costInfo(rec) {
    const reported = metric(rec, 'projectCost', 'projectCostMax');
    if (reported.min) {
      return { kind: 'reported', low: reported.min, high: reported.max, text: range(reported.min, reported.max, money), qualifier: rec.projectCostQualifier || '' };
    }
    const mw = metric(rec, 'capacityMw', 'capacityMaxMw');
    if (mw.min) {
      const low = mw.min * COST_PER_MW.low;
      const high = (mw.max || mw.min) * COST_PER_MW.high;
      return { kind: 'estimate', low, high, text: range(low, high, money), basis: t('finder.cost_basis', { mw: range(mw.min, mw.max, count), low: money(COST_PER_MW.low), high: money(COST_PER_MW.high) }) };
    }
    return { kind: 'none' };
  }

  // Dates arrive as "2025", "2025-7" or "2025-7-28".
  function fmtDate(s) {
    if (!s) return '';
    const [y, m, d] = String(s).split('-').map((p) => parseInt(p, 10));
    if (!y) return String(s);
    if (!m || !month(m)) return String(y);
    return d ? t('finder.date_month_day_year', { month: month(m), day: d, year: y }) : t('finder.date_month_year', { month: month(m), year: y });
  }

  function placeLine(muni) {
    if (!muni) return '';
    const towns = Array.isArray(muni.towns) ? muni.towns : [];
    const counties = Array.isArray(muni.counties) ? muni.counties : [];
    return [...towns, ...counties].join(', ');
  }

  // ZIPS entries are [lat, lon, place, county, state]; county naming differs by state.
  function zipInfo(zip, ZIPS) {
    const z = ZIPS && ZIPS[zip];
    if (!z) return null;
    const [lat, lon, place, rawCounty, state] = z;
    let county = '';
    // GeoNames lists Connecticut's planning regions, not counties, so no county label there.
    if (state !== 'DC' && state !== 'District of Columbia' && state !== 'Connecticut' && rawCounty) {
      if (/\(city\)$/i.test(rawCounty)) county = t('finder.city_suffix', { name: rawCounty.replace(/\s*\(city\)$/i, '') });
      else if (/^city of /i.test(rawCounty) || /\b(County|Parish|Borough|Census Area|Municipality|City)$/i.test(rawCounty)) county = rawCounty;
      else county = t('finder.county_suffix', { name: rawCounty });
    }
    return { zip, lat, lon, place, county, state, label: [place, county, state].filter(Boolean).join(', ') };
  }

  // ---------- town search ("Wallingford, CT") ----------

  const US_STATES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
    DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
    IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
    NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
    NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
    RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
    VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  };
  const ABBR_OF = Object.fromEntries(Object.entries(US_STATES).map(([a, n]) => [n, a]));
  const isZip = (s) => /^\d{5}$/.test(String(s || '').trim());
  // Strip accents (combining marks U+0300–U+036F) so "Añasco" matches "anasco".
  const normText = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  // "town, ST" / "town, State" / "town" -> { name, state (full name or ''), bad (state text that matched nothing) }.
  function parsePlace(query) {
    const m = String(query || '').trim().match(/^([^,]*?)\s*(?:,\s*([A-Za-z .]+))?$/);
    const name = m ? m[1].trim() : '';
    const st = m && m[2] ? m[2].trim() : '';
    let state = '';
    if (st) {
      const up = st.toUpperCase().replace(/\./g, '');
      if (US_STATES[up]) state = US_STATES[up];
      else {
        const k = normText(st);
        state = Object.values(US_STATES).find((n) => normText(n) === k) || Object.values(US_STATES).find((n) => normText(n).startsWith(k)) || '';
      }
    }
    return { name, state, bad: st && !state ? st : '' };
  }

  // One entry per town+state in the ZIP table, with the ZIP nearest the town's centre.
  const indexCache = new WeakMap();
  function placeIndex(ZIPS) {
    if (!ZIPS) return [];
    let list = indexCache.get(ZIPS);
    if (list) return list;
    const map = new Map();
    for (const zip of Object.keys(ZIPS)) {
      const [lat, lon, place, county, state] = ZIPS[zip];
      if (!place) continue;
      const key = `${normText(place)}|${state}`;
      let p = map.get(key);
      if (!p) { p = { name: place, state, county: state === 'Connecticut' ? '' : (county || ''), key: normText(place), zips: [], pts: [] }; map.set(key, p); }
      p.zips.push(zip); p.pts.push([lat, lon]);
    }
    list = [...map.values()].map((p) => {
      const lat = p.pts.reduce((s, q) => s + q[0], 0) / p.pts.length;
      const lon = p.pts.reduce((s, q) => s + q[1], 0) / p.pts.length;
      let best = 0, bd = Infinity;
      p.pts.forEach(([a, o], i) => { const d = (a - lat) ** 2 + (o - lon) ** 2; if (d < bd) { bd = d; best = i; } });
      return { name: p.name, state: p.state, abbr: ABBR_OF[p.state] || p.state, county: p.county, key: p.key, zip: p.zips[best], count: p.zips.length, lat, lon, label: `${p.name}, ${ABBR_OF[p.state] || p.state}` };
    });
    indexCache.set(ZIPS, list);
    return list;
  }

  // Suggestions once the town part has 4+ letters: prefix matches first, then word-start matches, bigger towns first.
  function searchPlaces(ZIPS, query, limit = 8) {
    const { name, state, bad } = parsePlace(query);
    const k = normText(name);
    if (bad || k.replace(/ /g, '').length < 4) return [];
    const out = [];
    for (const p of placeIndex(ZIPS)) {
      if (state && p.state !== state) continue;
      let rank = -1;
      if (p.key === k) rank = 0;
      else if (p.key.startsWith(k)) rank = 1;
      else if (p.key.includes(` ${k}`)) rank = 2;
      if (rank >= 0) out.push({ p, rank });
    }
    out.sort((a, b) => a.rank - b.rank || b.p.count - a.p.count || a.p.name.localeCompare(b.p.name) || a.p.state.localeCompare(b.p.state));
    return out.slice(0, limit).map((o) => o.p);
  }

  const phaseLabel = (p) => (p ? label(PHASES, String(p).toLowerCase()) : t('finder.phase_unknown'));
  // Tables hold catalog keys; an unknown key falls back to the humanised key itself.
  const label = (table, key) => (table[key] ? t(table[key]) : key ? String(key).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '');

  // ---------- imagery ----------

  function toMerc(lon, lat) {
    const x = MERC_R * rad(lon);
    const y = MERC_R * Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2));
    return [x, y];
  }

  // Flatten any GeoJSON shape into a list of [lon, lat] rings.
  function rings(g) {
    if (!g || typeof g !== 'object') return [];
    switch (g.type) {
      case 'Feature': return rings(g.geometry);
      case 'FeatureCollection': return (g.features || []).flatMap(rings);
      case 'GeometryCollection': return (g.geometries || []).flatMap(rings);
      case 'Polygon': return g.coordinates || [];
      case 'MultiPolygon': return (g.coordinates || []).flat();
      default: return [];
    }
  }

  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

  function exportUrl(service, box, w, h) {
    const bbox = [box.xmin, box.ymin, box.xmax, box.ymax].map((v) => v.toFixed(2)).join(',');
    return `${ESRI}/${service}/MapServer/export?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=${w * 2},${h * 2}&format=jpg&f=image`;
  }

  // Grow a box around its centre so it has the image's aspect ratio.
  function fitBox(cx, cy, spanX, spanY, w, h) {
    const aspect = w / h;
    if (spanX / spanY < aspect) spanX = spanY * aspect;
    else spanY = spanX / aspect;
    return { xmin: cx - spanX / 2, xmax: cx + spanX / 2, ymin: cy - spanY / 2, ymax: cy + spanY / 2 };
  }

  function projector(box, w, h) {
    return ([lon, lat]) => {
      const [x, y] = toMerc(lon, lat);
      return [((x - box.xmin) / (box.xmax - box.xmin)) * w, ((box.ymax - y) / (box.ymax - box.ymin)) * h];
    };
  }

  // Ground metres -> Web Mercator units at a latitude.
  const mercScale = (lat) => 1 / Math.cos(rad(lat));

  // view: 'site' (tight satellite), 'area' (wider satellite), 'trip' (street map from the ZIP to the site)
  function imageView(site, view, origin, w = 480, h = 300) {
    const scale = mercScale(site.lat);
    const [cx, cy] = toMerc(site.lon, site.lat);
    const shapeRings = rings(site.geojson).filter((r) => Array.isArray(r) && r.length > 2);

    if (view === 'trip' && origin) {
      const [ox, oy] = toMerc(origin.lon, origin.lat);
      const spanX = Math.max(Math.abs(cx - ox) * 1.5, 4000 * scale);
      const spanY = Math.max(Math.abs(cy - oy) * 1.5, 4000 * scale);
      const box = fitBox((cx + ox) / 2, (cy + oy) / 2, spanX, spanY, w, h);
      const p = projector(box, w, h);
      return { url: exportUrl('World_Street_Map', box, w, h), w, h, site: p([site.lon, site.lat]), origin: p([origin.lon, origin.lat]), rings: [] };
    }

    let box;
    if (shapeRings.length) {
      const pts = shapeRings.flat().map(([lon, lat]) => toMerc(lon, lat));
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const minSpan = 450 * scale;
      box = fitBox((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2,
        Math.max((Math.max(...xs) - Math.min(...xs)) * 1.3, minSpan), Math.max((Math.max(...ys) - Math.min(...ys)) * 1.3, minSpan), w, h);
    } else {
      const ground = { exact: 900, approximate: 2500, uncertain: 6000 }[site.locationConfidence] || 2500;
      box = fitBox(cx, cy, ground * scale, ground * scale, w, h);
    }
    if (view === 'area') {
      const zx = (box.xmax - box.xmin) * 2.5;
      const zy = (box.ymax - box.ymin) * 2.5;
      box = { xmin: cx - zx, xmax: cx + zx, ymin: cy - zy, ymax: cy + zy };
    }
    const p = projector(box, w, h);
    return {
      url: exportUrl('World_Imagery', box, w, h),
      w, h,
      site: p([site.lon, site.lat]),
      rings: shapeRings.map((r) => r.map(p)),
    };
  }

  return {
    PHASES, INACTIVE_PHASES, ROLES, NICHES, POWER, COOLING_SOURCE, COOLING_TYPE, APPROVAL_TYPES, APPROVAL_STATUS, CONFIDENCE,
    COST_PER_MW, STATES, stateInfo, DC_AREA, COVERED_STATES, STATE_ABBR, REF, distanceMiles, compass, sitePoints, inCoverage, rankByDistance,
    money, count, friendly, range, metric, costInfo, powerCompare, landCompare, floorCompare, perResident, carbonCompare, timeline,
    STAGES, STAGE_ORDER, WINDOW_LABEL, WINDOW_SHORT, stageInfo,
    zipInfo, isZip, parsePlace, placeIndex, searchPlaces, US_STATES, stateCode: (name) => ABBR_OF[name] || (US_STATES[name] ? name : ''),
    stateName: (code) => US_STATES[String(code || '').toUpperCase()] || (ABBR_OF[code] ? code : ''),
    fmtDate, placeLine, phaseLabel, label, imageView,
  };
})();
