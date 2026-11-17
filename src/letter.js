// Builds a letter for one project and one official, in the form of the chapter's own template letter:
// a formal address block, a rights-based opening, the project's facts as the tracker records them,
// numbered asks that fit the office, and a courteous close. The "oppose" letter keeps that template's
// wording; the short form and the two other tones (questions, conditions) are built from the same facts.
// Anything the tracker does not know is written around rather than left as a blank or asserted.
const DCF_LETTER = (() => {
  const n = (v) => DCF.count(v);
  // Label and caption resolve in the interface language each time they are read.
  const captioned = (prefix) => ({ get label() { return t(`${prefix}_label`); }, get short() { return t(`${prefix}_short`); } });

  // Slider order, least to most firm. The chapter's template letter is the last stop.
  const TONES = {
    questions: captioned('letter.tone_questions'),
    conditions: captioned('letter.tone_conditions'),
    oppose: captioned('letter.tone_oppose'),
  };
  const TONE_ORDER = ['questions', 'conditions', 'oppose'];
  // What each detail stop adds is the same in every tone, so the captions stay true for every office.
  const DETAILS = {
    brief: captioned('letter.detail_brief'),
    standard: captioned('letter.detail_standard'),
    full: captioned('letter.detail_full'),
  };
  const DETAIL_ORDER = ['brief', 'standard', 'full'];
  const LIST_MAX = { brief: 3, standard: 4, full: Infinity };

  // Once a project is being built or is running, the zoning vote is behind us: the asks turn to
  // permits, rates, enforcement and expansions. Withdrawn or rejected projects are spoken of in the past.
  const LATE = new Set(['construction', 'operational', 'expansion']);
  const PAST = new Set(['withdrawn', 'rejected', 'retired']);

  // How to address someone, from their title. Specific titles come before the general ones they contain.
  const MR_MS = 'letter.hon_mr_ms';
  function honorificKey(p) {
    const t = String(p.title || '');
    const tests = [
      [/chief of staff|deputy chief|\baide\b|assistant to/i, MR_MS],
      [/lieutenant governor/i, 'letter.hon_lieutenant_governor'], [/governor/i, 'letter.hon_governor'],
      [/attorney general/i, 'letter.hon_attorney_general'], [/secretary of state/i, 'letter.hon_secretary'],
      [/vice mayor/i, 'letter.hon_vice_mayor'], [/deputy mayor/i, 'letter.hon_deputy_mayor'], [/mayor pro tem/i, 'letter.hon_mayor_pro_tem'], [/mayor(?!al)/i, 'letter.hon_mayor'],
      [/county executive/i, 'letter.hon_county_executive'], [/judge/i, 'letter.hon_judge'], [/county manager|administrator/i, MR_MS],
      [/council vice president/i, 'letter.hon_council_vice_president'], [/council president/i, 'letter.hon_council_president'], [/speaker/i, 'letter.hon_speaker'],
      [/secretary/i, 'letter.hon_secretary'], [/commissioner/i, 'letter.hon_commissioner'], [/supervisor/i, 'letter.hon_supervisor'],
      [/senator/i, 'letter.hon_senator'], [/delegate/i, 'letter.hon_delegate'], [/representative/i, 'letter.hon_representative'], [/assembly/i, 'letter.hon_assemblymember'], [/legislator/i, 'letter.hon_legislator'],
      [/council ?(member|woman|man|person)|councilor|councillor/i, 'letter.hon_councilmember'],
      [/vice president/i, 'letter.hon_vice_president'], [/president/i, 'letter.hon_president'], [/vice chair/i, 'letter.hon_vice_chair'], [/chair/i, 'letter.hon_chair'],
      [/alderwoman/i, 'letter.hon_alderwoman'], [/alderperson/i, 'letter.hon_alderperson'], [/alderman/i, 'letter.hon_alderman'],
      [/selectwoman/i, 'letter.hon_selectwoman'], [/selectman/i, 'letter.hon_selectman'], [/selectperson/i, 'letter.hon_selectperson'],
      [/trustee/i, 'letter.hon_trustee'], [/magistrate|justice of the peace/i, 'letter.hon_magistrate'],
      [/director|officer|planner|clerk|manager|engineer|attorney|solicitor|counsel/i, MR_MS],
    ];
    for (const [re, h] of tests) if (re.test(t)) return h;
    return '';
  }
  function honorific(p, lang = 'en') {
    const L = (k, v) => DCF_I18N.tIn(lang, k, v);
    const key = honorificKey(p);
    return key ? L(key) : '';
  }
  function lastName(name) {
    const words = String(name).replace(/["“”(].*?["“”)]/g, ' ').trim().split(/\s+/)
      .filter((w) => !/^(Jr|Sr|II|III|IV|Esq)\.?,?$/i.test(w));
    return (words[words.length - 1] || name).replace(/,$/, '');
  }
  function salutation(p, lang = 'en') {
    const L = (k, v) => DCF_I18N.tIn(lang, k, v);
    const key = honorificKey(p);
    if (key === MR_MS) return L('letter.salutation_name', { name: p.name });
    return key ? L('letter.salutation_title', { honorific: L(key), last: lastName(p.name) }) : L('letter.salutation_name', { name: p.name });
  }
  // "Mayor Hollis", "Commissioner Bubb", or the full name when the title gives no form of address.
  function shortAddress(p, lang = 'en') {
    const L = (k, v) => DCF_I18N.tIn(lang, k, v);
    const key = honorificKey(p);
    return key && key !== MR_MS ? L('letter.short_address', { honorific: L(key), last: lastName(p.name) }) : p.name;
  }
  // Elected officials take "The Honorable" on the address block; staff and appointed boards do not.
  const ELECTED = /governor|attorney general|secretary of state|treasurer|auditor|mayor|county executive|judge|senator|delegate|representative|assembly|legislator|council|alder|select(man|woman|person)|supervisor|trustee|commissioner|freeholder|magistrate/i;
  function honorable(p, ctx) {
    if (!p.title || honorificKey(p) === MR_MS) return false;
    return (ctx.role === 'governing' || ctx.tier === 'state') && ELECTED.test(p.title);
  }

  // What to ask for depends on who holds the pen and on how far the project has got.
  function asks(ctx, f, L) {
    const { tier, role, title } = ctx;
    const { project, dev, late, past, nextDate } = f;
    const t = String(title || '').toLowerCase();
    const common = [
      L('letter.ask_moratorium'),
      L('letter.ask_require_full_cost'),
    ];
    const federal = L('letter.ask_federal');
    const unless = L('letter.ask_unless', { dev });
    if (tier === 'state') {
      if (/utilit|public service|psc|puc|bpu|pura|commerce commission|icc|power agency|regulatory authority|regulatory staff|public counsel|siting council|siting board|site evaluation|\benergy\b(?! and environmental)/i.test(t)) {
        return [
          L('letter.ask_utility_pay'),
          L('letter.ask_utility_interconnection', { project }),
          common[1],
        ];
      }
      // Word boundaries: "dep" must not match "Department of Commerce".
      if (/environment|natural resources|\b(dep|deq|dec|mde|dnr|dnrec|dem|des|epd)\b/i.test(t)) {
        return [
          L('letter.ask_env_permits', { project }),
          common[0],
          federal,
        ];
      }
      if (/commerce|economic|development|eda/i.test(t)) {
        return [
          L('letter.ask_commerce_withhold', { project }),
          L('letter.ask_commerce_publish'),
          common[0],
        ];
      }
      return [
        L('letter.ask_state_moratorium'),
        L('letter.ask_state_direct_agencies', { project }),
        L('letter.ask_state_federal'),
      ];
    }
    if (role === 'planning') {
      return [
        late
          ? L('letter.ask_planning_late', { project, unless })
          : past
            ? L('letter.ask_planning_past', { project })
            : L('letter.ask_planning', { project }),
        ...common,
      ];
    }
    if (role === 'zoning') {
      return [
        L('letter.ask_zoning', { project, expansion: late ? L('letter.ask_or_expansion') : '', dev }),
        ...common,
      ];
    }
    if (role === 'staff') {
      return [
        L('letter.ask_staff', { project }),
        ...common,
      ];
    }
    return [
      late
        ? L('letter.ask_governing_late', { project, unless })
        : past
          ? L('letter.ask_governing_past', { project })
          : L('letter.ask_governing', { project, onDate: nextDate ? L('letter.ask_on_date', { date: nextDate }) : '' }),
      ...common,
      federal,
    ];
  }

  // Questions an official can be asked to answer in writing before any decision.
  function questions(ctx, f, L) {
    const { project, dev, gensText, past } = f;
    const list = [
      L('letter.q_who_pays', { project, dev }),
      gensText
        ? L('letter.q_noise_gens', { gens: gensText })
        : L('letter.q_noise'),
      L('letter.q_abatements'),
      L('letter.q_jobs'),
      L('letter.q_water'),
      past
        ? L('letter.q_hearing_past')
        : L('letter.q_hearing'),
    ];
    if (ctx.tier === 'state') list[2] = L('letter.q_state_incentives', { project });
    return list;
  }

  // Binding conditions for an official who may approve the project anyway.
  function conditions(ctx, f, L) {
    const { dev } = f;
    const list = [
      L('letter.c_full_cost', { dev }),
      L('letter.c_disclosure'),
      L('letter.c_limits'),
      L('letter.c_jobs'),
      L('letter.c_bond'),
      L('letter.c_hearing'),
    ];
    return list;
  }

  // The next pending decision on the tracker's record, if it has a date that is still ahead.
  function nextDate(rec) {
    const today = new Date().toISOString().slice(0, 10);
    const iso = (s) => { const [y, m, d] = String(s || '').split('-'); return y && m ? `${y}-${m.padStart(2, '0')}-${(d || '1').padStart(2, '0')}` : ''; };
    const pending = (Array.isArray(rec.approvals) ? rec.approvals : [])
      .map((a) => ({ date: a.date, iso: iso(a.date), status: String(a.status || '') }))
      .filter((a) => a.iso && a.iso >= today && a.status === 'pending')
      .sort((a, b) => a.iso.localeCompare(b.iso));
    return pending[0] ? DCF.fmtDate(pending[0].date) : '';
  }

  // Facts shared by every tone, written around whatever the tracker does not know.
  function facts(rec, hit, L) {
    const site = hit.site || {};
    const muni = site.municipality || rec.municipality || {};
    const town = (muni.towns || [])[0] || '';
    const county = (muni.counties || [])[0] || '';
    const project = rec.name || L('letter.fact_this_data_center');
    const dev = (rec.stakeholders && Array.isArray(rec.stakeholders.D) && rec.stakeholders.D[0]) || (rec.companies || [])[0] || L('letter.fact_the_developer');
    const where = [site.address || rec.address, town, county].filter(Boolean).join(', ') || L('letter.fact_proposed_site');
    const mw = DCF.metric(rec, 'capacityMw', 'capacityMaxMw');
    const acres = DCF.metric(rec, 'sizeAcres', 'sizeAcresMax');
    const gens = DCF.metric(rec, 'numberOfGenerators', 'numberOfGeneratorsMax');
    const top = mw.max || mw.min;
    const phase = String(rec.phase || '').toLowerCase();
    const late = LATE.has(phase);
    const past = PAST.has(phase);
    const waterRow = (Array.isArray(rec.waterUse) ? rec.waterUse : []).find((w) => w && w.amount != null && w.unit);
    // DCF.metric only keeps max when it is a number above min, so a single figure stands alone.
    const rangeTo = (r) => (r.max ? L('letter.range_to', { min: n(r.min), max: n(r.max) }) : n(r.min));
    return {
      town, county, project, dev, where, mw, acres, gens, top, phase, late, past, rangeTo,
      verb: phase === 'operational' ? L('letter.verb_operates') : phase === 'expansion' ? L('letter.verb_is_expanding') : phase === 'construction' ? L('letter.verb_is_building') : past ? L('letter.verb_proposed_to_build') : L('letter.verb_proposes_to_build'),
      homes: top ? DCF.powerCompare(top, rec.state).homes : '',
      gensText: gens.min ? rangeTo(gens) : '',
      water: waterRow ? L('letter.fact_water', { amount: DCF.friendly(waterRow.amount), unit: waterRow.unit, ofType: waterRow.type ? L('letter.fact_water_type', { type: waterRow.type }) : '' }) : '',
      jobsL: DCF.metric(rec, 'jobsLongTerm').min,
      jobsC: DCF.metric(rec, 'jobsConstruction').min,
      nextDate: nextDate(rec),
    };
  }

  // ctx: { person, tier: 'municipal'|'county'|'state', role: 'governing'|'planning'|'zoning'|'staff'|'', title, place,
  //        address, constituent: true|false, originPlace: 'Scranton', near: false when the writer lives far from the site,
  //        combined: true when one letter goes to several officials }
  // you: { name, street, town, email, phone }   opts: { tone, detail, personal, lang }
  // The formatting helpers in finder.js (friendly, fmtDate, durationText) follow the interface language,
  // so the letter's language is made current while it is built and restored after.
  function inLang(fn) {
    return (rec, hit, ctx, you = {}, opts = {}) => {
      const keep = DCF_I18N.lang;
      DCF_I18N.lang = opts.lang || 'en';
      try { return fn(rec, hit, ctx, you, opts); } finally { DCF_I18N.lang = keep; }
    };
  }
  const build = inLang(buildIn);
  function buildIn(rec, hit, ctx, you = {}, opts = {}) {
    const lang = opts.lang || 'en';
    const L = (k, v) => DCF_I18N.tIn(lang, k, v);
    const tone = TONES[opts.tone] ? opts.tone : 'oppose';
    // 0.2.x stored prefs said length: 'short'; it maps to the brief stop.
    const detail = DETAILS[opts.detail] ? opts.detail : opts.length === 'short' ? 'brief' : 'full';
    const brief = detail === 'brief';
    const full = detail === 'full';
    const f = facts(rec, hit, L);
    const { town, county, project, dev, where, acres, gens, top, late, past, verb } = f;
    const today = new Date();
    const date = L('letter.date', { month: L(`letter.month_${today.getMonth() + 1}`), day: today.getDate(), year: today.getFullYear() });
    const p = ctx.person;
    // "As your constituent" only when the searched ZIP is inside this official's jurisdiction.
    const who = ctx.constituent === false
      ? L('letter.who_resident', { place: ctx.originPlace ? `${ctx.near === false ? '' : L('letter.who_nearby')}${ctx.originPlace}` : L('letter.who_nearby_community') })
      : L('letter.who_constituent');
    const personal = String(opts.personal || '').trim();
    // Tense follows the stage: "would draw" for a proposal, "will draw" while it is built, "draws" once it runs.
    const v = (base, present) => (f.phase === 'operational' ? L(present) : late ? L('letter.tense_will', { verb: L(base) }) : L('letter.tense_would', { verb: L(base) }));

    // Paragraph 2: the costs.
    const power = top
      ? L('letter.power_known', { project, draw: v('letter.verb_draw', 'letter.verb_draws'), mw: n(top), homes: f.homes, dev })
      : L('letter.power_unknown', { project, draw: v('letter.verb_draw', 'letter.verb_draws'), dev });
    // Water is mentioned only when the tracker records a figure; otherwise it stays in the questions list.
    const water = f.water ? L('letter.water_known', { use: v('letter.verb_use', 'letter.verb_uses'), water: f.water }) : '';
    const noise = gens.min
      ? L('letter.noise_gens', { hum: v('letter.verb_hum', 'letter.verb_hums'), gens: f.gensText, add: v('letter.verb_add', 'letter.verb_add_present'), place: town || L('letter.our_community') })
      : L('letter.noise', { hum: v('letter.verb_hum', 'letter.verb_hums'), add: v('letter.verb_add', 'letter.verb_add_present'), place: town || L('letter.our_community') });

    // Paragraph 3: the benefits that do not come.
    const land = L('letter.land', { occupy: v('letter.verb_occupy', 'letter.verb_occupies'), tract: acres.min ? L('letter.land_acres', { acres: f.rangeTo(acres) }) : L('letter.land_large_tract'), place: town || county || L('letter.our_community') });
    const jobs = f.jobsL ? L('letter.jobs_known', { n: n(f.jobsL) }) : L('letter.jobs_unknown');
    const abate = L('letter.abate');
    const promised = f.jobsC ? L('letter.promised_known', { n: n(f.jobsC) }) : L('letter.promised');

    const about = L('letter.about', { project, dev, verb, where });
    const opening = {
      oppose: late
        ? L('letter.opening_oppose_late', { who, about })
        : past
          ? L('letter.opening_oppose_past', { who, about })
          : L('letter.opening_oppose', { who, about }),
      questions: past
        ? L('letter.opening_questions_past', { who, about })
        : L('letter.opening_questions', { who, about, decision: late ? L('letter.decision_late') : L('letter.decision') }),
      conditions: late
        ? L('letter.opening_conditions_late', { who, about })
        : past
          ? L('letter.opening_conditions_past', { who, about })
          : L('letter.opening_conditions', { who, about }),
    }[tone];

    const head = ctx.combined
      ? [date, ``, L('letter.to_officials_copied'), ``, opening]
      : [date, ``, `${honorable(p, ctx) ? L('letter.the_honorable') : ''}${p.name}`, ctx.place ? L('letter.address_title_place', { title: p.title, place: ctx.place }) : `${p.title}`, ...(ctx.address ? [ctx.address] : []), ``, salutation(p, lang), ``, opening];
    if (personal) head.push(``, personal);

    // Nothing is rewritten between the detail stops; sentences and list items are only left out.
    let middle;
    let list;
    let listIntro;
    let closing;
    const stand = ctx.role === 'governing' && ctx.tier !== 'state' && !late && !past ? L('letter.stand_vote', { project }) : L('letter.stand_where', { project });
    const rights = L('letter.rights');
    const benefits = L('letter.benefits', { land, jobs, abate });
    if (tone === 'oppose') {
      list = asks(ctx, f, L);
      listIntro = L('letter.intro_urge');
      closing = L('letter.closing_oppose', { stand });
      const p1 = L('letter.p1_oppose', { rights, power, water, noise });
      const p2 = L('letter.p2_oppose', { benefits });
      const p3 = L('letter.p3_oppose', { promised });
      const p4 = L('letter.p4_oppose', { project });
      middle = brief ? [`${rights} ${power} ${water}`] : full ? [p1, ``, p2, ``, p3, ``, p4] : [p1, ``, p2];
    } else if (tone === 'questions') {
      list = questions(ctx, f, L);
      listIntro = L('letter.intro_questions');
      closing = past
        ? L('letter.closing_questions_past')
        : L('letter.closing_questions', { vote: late ? L('letter.further_approval') : L('letter.vote') });
      middle = [brief ? L('letter.middle_brief', { power, water }) : L('letter.middle_standard', { power, water, noise, benefits, extra: full ? L('letter.promises_not_commitments') : '' })];
    } else {
      list = conditions(ctx, f, L);
      // A planning body recommends rather than approves; its intro says what the conditions attach to.
      listIntro = ctx.role === 'planning' ? L('letter.intro_conditions_planning') : L('letter.intro_conditions');
      closing = L('letter.closing_conditions');
      middle = [brief ? L('letter.middle_brief', { power, water }) : L('letter.middle_standard', { power, water, noise, benefits, extra: full ? ` ${promised}` : '' })];
    }
    list = list.slice(0, LIST_MAX[detail]);

    // Optional signature lines are left out rather than left as blanks.
    const contact = you.email && you.phone ? L('letter.signature_contact', { email: you.email, phone: you.phone }) : you.email || you.phone || '';
    const signature = [you.name || L('letter.your_full_name'), you.street, you.town || you.address, contact].filter(Boolean);
    const body = [
      ...head,
      ``,
      ...middle,
      ``,
      listIntro,
      ``,
      ...list.map((a, i) => L('letter.list_item', { n: i + 1, text: a })),
      ``,
      closing,
      ``,
      L('letter.sincerely'),
      ``,
      ...signature,
    ];
    const inTown = town ? L('letter.in_town', { town }) : '';
    const subject = {
      oppose: late ? L('letter.subject_oppose_late', { project, inTown }) : past ? L('letter.subject_oppose_past', { project, inTown }) : L('letter.subject_oppose', { project, inTown }),
      questions: L('letter.subject_questions', { project, inTown }),
      conditions: L('letter.subject_conditions', { project, inTown }),
    }[tone];
    // An empty sentence slot (no water figure) leaves a doubled space behind; close it up.
    return { subject, body: body.join('\n').replace(/ {2,}/g, ' ').replace(/ +\n/g, '\n').replace(/\n{3,}/g, '\n\n') };
  }

  // A 30-second phone script for officials with no email, and a voicemail version.
  const callScript = inLang(callScriptIn);
  function callScriptIn(rec, hit, ctx, you = {}, opts = {}) {
    const lang = opts.lang || 'en';
    const L = (k, v) => DCF_I18N.tIn(lang, k, v);
    const f = facts(rec, hit, L);
    const tone = TONES[opts.tone] ? opts.tone : 'oppose';
    const me = you.name ? L('letter.call_my_name', { name: you.name }) : L('letter.call_my_name_blank');
    const from = you.town ? L('letter.call_i_live_in', { town: you.town }) : (ctx.originPlace ? L('letter.call_i_live_in', { town: ctx.originPlace }) : '');
    const stage = f.phase === 'operational' ? L('letter.call_stage_operating') : f.phase === 'expansion' ? L('letter.call_stage_expanded') : f.late ? L('letter.call_stage_built') : L('letter.call_stage_proposed');
    const what = L('letter.call_what', { project: f.project, stage, inTown: f.town ? L('letter.in_town', { town: f.town }) : '' });
    const official = shortAddress(ctx.person, lang);
    const ask = {
      oppose: f.late
        ? L('letter.call_ask_oppose_late', { official })
        : L('letter.call_ask_oppose', { official }),
      questions: L('letter.call_ask_questions', { vote: f.late ? L('letter.further_approval') : L('letter.vote') }),
      conditions: L('letter.call_ask_conditions'),
    }[tone];
    const call = L('letter.call_script', { me, from, what, ask });
    const voicemail = L('letter.voicemail_script', { name: you.name || L('letter.call_your_name'), from, phone: you.phone || L('letter.call_your_phone'), what, ask });
    return { call, voicemail };
  }

  return { build, salutation, honorific, shortAddress, callScript, TONES, TONE_ORDER, DETAILS, DETAIL_ORDER };
})();
