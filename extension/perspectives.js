// "Could instead…" comparisons: each turns a figure into something people value and ties it to the
// human benefit at the same scale (students taught, lives saved, people housed, CO2 absorbed).
// They show scale and trade-offs, not where the money or land would otherwise go.
// Every benchmark below is sourced; see the "Comparison sources" table in README.md.
const DCF_PERSPECTIVES = (() => {
  // { stateName: value } for one field of states.json, skipping states without it.
  const stateColumn = (key) => Object.fromEntries(DCF.STATES.filter((s) => s[key] != null).map((s) => [s.name, s[key]]));
  const BENCH = {
    // ---- electricity ----
    // K-12 buildings used ~96.4 billion kWh (EIA CBECS 2018: 264k buildings × 365,000 kWh). Spread over public
    // enrollment only (49.3M, NCES 2024–25) that's ~1,957 kWh per student, a deliberately high per-student
    // figure, so the student counts err low. × 497 students per average public school (NCES).
    schoolStudents: 497,
    schoolKwh: 497 * (96.4e9 / 49.27e6),
    // Inpatient hospitals used ~65 billion kWh (EIA CBECS 2018), spread over the 6,100 U.S. hospitals,
    // which had 35,658,583 admissions and 907,216 staffed beds (AHA Fast Facts 2026, 2024 survey).
    hospitalKwh: 65e9 / 6100,
    hospitalAdmissions: 35658583 / 6100,
    hospitalBeds: 907216 / 6100,
    evKwh: 4000, //             kWh a year for an electric car: EPA 0.367 kWh/mi × 10,787 mi/yr (FHWA 2024)
    busKwh: 18000, //           electric school bus: EPA assumes 1.5 kWh/mi × 12,000 mi/yr
    busRiders: 50, //           ~25 million children ride ~500,000 school buses daily (EPA Clean School Bus)
    waterKwhPerMG: 2069, //     kWh to pump and treat a million gallons of drinking water (EPRI 2013 via EPA WaterSense)
    waterGalPerPerson: 82, //   gallons per person per day at home (USGS 2015 via EPA WaterSense)
    carCo2: 4.29, //            t CO2e a year, typical gasoline car (EPA GHG Equivalencies, 2022 data)
    household: 2.5, //          people per household (Census CPS ASEC 2025)
    homeKwh: 10791, //          kWh a year for an average home (EIA, 2022)
    // ---- money ----
    // NEA Rankings & Estimates, 2024–25 average teacher salary; NCES pupil/teacher ratio, 2023–24.
    // State values come from states.json; the U.S. figure fills any gap.
    teacherSalary: { US: 74495, ...stateColumn('teacherSalary') },
    pupilsPerTeacher: { US: 15.2, ...stateColumn('pupilsPerTeacher') },
    childCare: 13184, //        average annual price of child care, 2025 (Child Care Aware of America)
    snapMonthly: 187.91, //     average SNAP benefit per person per month, FY2025 (USDA FNS via KFF)
    medicaid: 7407, //          Medicaid spending per enrollee, 2023 (KFF)
    pell: 7395, //              maximum Pell Grant, 2026–27 (U.S. Dept. of Education)
    healthCenter: 1672, //      cost per patient per year at community health centers, 2025 (HRSA UDS)
    firefighter: 59280, //      median firefighter wage, May 2025 (BLS)
    paramedic: 48150, //        median EMT/paramedic wage, May 2025 (BLS)
    energyBill: 1728, //        average U.S. household energy bill, 2024 ($144/month, EIA)
    oudTreatment: 13982, //     a year of methadone treatment at the 2025 Medicare bundled rate (CMS)
    lifeCost: 5500, //          dollars per life saved, Against Malaria Foundation bed nets (GiveWell, 2026)
    tuition: 11950, //          published in-state tuition & fees, public four-year, 2025–26 (College Board)
    lunch: 4.76, //             federal free-lunch reimbursement, SY 2026–27, contiguous states (USDA)
    schoolDays: 180,
    leadLine: 7000, //          per lead service line replaced; EPA range $6,507–$8,519 (LCRI economic analysis)
    // Current spending per pupil, FY2024 (Census Annual Survey of School System Finances); states without a figure use the U.S. one.
    perPupil: { US: 17619, ...stateColumn('perPupil') },
    // ---- land ----
    forestCo2PerAcre: 1.0, //   t CO2 absorbed per acre of average U.S. forest a year (EPA GHG Equivalencies, 2021–22)
    farmAcres: stateColumn('farmAcres'), // USDA 2022 Census of Agriculture, per state in states.json
    wetlandGalPerAcre: 1e6, //  floodwater an acre of wetland can hold (EPA)
    treesPerAcre: 436, //       seedlings per acre at 10 × 10 ft spacing (state forestry guidance)
    highSchoolAcres: 40, //     30 acres + 1 per 100 students for a 1,000-student high school (CEFPI guideline)
    aptPerAcre: 19, //          low end of garden-apartment density, 19–25 units an acre
    farmAcresPerPerson: 2.67, // land to feed one person a year on the current U.S. diet (Peters et al., Elementa 2016)
    // Median new-home lot is 8,543 sq ft (NAHB from Census Survey of Construction, 2025): 5.1 lots an acre,
    // less a quarter of the land for streets and open space.
    homesPerAcre: (43560 / 8543) * 0.75,
    parkAcresPer1000: 10, //    median park acres per 1,000 residents (NRPA Agency Performance Review 2026)
    solarAcresPerMw: 5.6, //    acres per MWac, single-axis tracking PV (LBNL, Bolinger & Bolinger 2022)
    solarCapacityFactor: 0.232, // U.S. utility-scale PV, 2024 (EIA Electric Power Monthly)
    // ---- floor space ----
    homeSqft: 2142, //          median new single-family home completed in 2025 (Census)
    aptSqft: 1000, //           median new rental apartment completed in 2025 (Census)
    childCareSqft: 35, //       licensed child care centers: 35 sq ft of indoor space per child (e.g. Florida Statutes 402.305)
    shelterSqft: 37.7, //       3.5 m² of covered living space per person, emergency shelter standard (UNHCR / Sphere)
    schoolSqftPerStudent: 180, // median gross sq ft per student, new schools (School Planning & Management)
    hospitalSqftPerBed: 2500, // existing U.S. hospitals with 50+ beds (Definitive Healthcare, Medicare cost reports)
  };

  // These are counts of things (schools, farms, lives), so small ones round to whole numbers.
  const f = (n) => (n < 10 ? String(Math.round(n)) : DCF.friendly(n));
  // Below 1.5 a count would print as "1" beside a plural noun, so the comparison is skipped instead.
  const ok = (n) => Number.isFinite(n) && n >= 1.5;
  const byState = (table, state) => table[state] || table.US;

  // Each entry returns { text, a, b } or null when the benchmark is missing or the result rounds to nothing.
  // {a} and {b} are bolded in the panel; text continues the card's "…could instead" heading.
  const LISTS = {
    power: [ // input: MWh per year
      (mwh) => {
        const n = (mwh * 1000) / BENCH.schoolKwh;
        return ok(n) ? { text: t('perspectives.power_schools'), a: f(n), b: f(n * BENCH.schoolStudents) } : null;
      },
      (mwh) => {
        const n = (mwh * 1000) / BENCH.hospitalKwh;
        return ok(n) && BENCH.hospitalAdmissions ? { text: t('perspectives.power_hospitals'), a: f(n), b: f(n * BENCH.hospitalAdmissions) } : null;
      },
      (mwh) => {
        const people = ((mwh * 1000) / BENCH.homeKwh) * BENCH.household;
        return ok(people) ? { text: t('perspectives.power_homes'), a: f(people) } : null;
      },
      (mwh) => {
        const n = (mwh * 1000) / BENCH.evKwh;
        return ok(n) && BENCH.carCo2 ? { text: t('perspectives.power_evs'), a: f(n), b: f(n * BENCH.carCo2) } : null;
      },
      (mwh) => {
        const n = (mwh * 1000) / BENCH.busKwh;
        return ok(n) ? { text: t('perspectives.power_buses'), a: f(n), b: f(n * BENCH.busRiders) } : null;
      },
      (mwh) => {
        const people = ((mwh * 1000) / BENCH.waterKwhPerMG) * 1e6 / (BENCH.waterGalPerPerson * 365);
        return ok(people) ? { text: t('perspectives.power_water'), a: f(people) } : null;
      },
    ],
    money: [ // input: dollars
      (usd, ctx) => {
        const n = usd / byState(BENCH.teacherSalary, ctx.state);
        return ok(n) ? { text: t('perspectives.money_teachers'), a: f(n), b: f(n * byState(BENCH.pupilsPerTeacher, ctx.state)) } : null;
      },
      (usd) => {
        const n = usd / BENCH.lifeCost;
        return ok(n) ? { text: t('perspectives.money_bednets'), a: f(n) } : null;
      },
      (usd) => {
        const n = usd / (BENCH.tuition * 4);
        return ok(n) ? { text: t('perspectives.money_tuition'), a: f(n) } : null;
      },
      (usd) => {
        const meals = usd / BENCH.lunch;
        return ok(meals / BENCH.schoolDays) ? { text: t('perspectives.money_lunches'), a: f(meals), b: f(meals / BENCH.schoolDays) } : null;
      },
      (usd) => {
        const n = usd / BENCH.leadLine;
        return ok(n) && BENCH.household ? { text: t('perspectives.money_lead_lines'), a: f(n), b: f(n * BENCH.household) } : null;
      },
      (usd, ctx) => {
        const n = usd / byState(BENCH.perPupil, ctx.state);
        return ok(n) ? { text: t('perspectives.money_per_pupil'), a: f(n) } : null;
      },
      (usd) => {
        const n = usd / BENCH.childCare;
        return ok(n) ? { text: t('perspectives.money_child_care'), a: f(n) } : null;
      },
      (usd) => {
        const n = usd / (BENCH.snapMonthly * 12);
        return ok(n) ? { text: t('perspectives.money_snap'), a: f(n) } : null;
      },
      (usd) => {
        const n = usd / BENCH.medicaid;
        return ok(n) ? { text: t('perspectives.money_medicaid'), a: f(n) } : null;
      },
      (usd) => {
        const n = usd / BENCH.pell;
        return ok(n) ? { text: t('perspectives.money_pell'), a: f(n) } : null;
      },
      (usd) => {
        const n = usd / BENCH.healthCenter;
        return ok(n) ? { text: t('perspectives.money_health_centers'), a: f(n) } : null;
      },
      (usd) => {
        const fire = usd / BENCH.firefighter;
        return ok(fire) ? { text: t('perspectives.money_firefighters'), a: f(fire), b: f(usd / BENCH.paramedic) } : null;
      },
      (usd) => {
        const n = usd / BENCH.energyBill;
        return ok(n) && BENCH.household ? { text: t('perspectives.money_energy_bills'), a: f(n), b: f(n * BENCH.household) } : null;
      },
      (usd) => {
        const n = usd / BENCH.oudTreatment;
        return ok(n) ? { text: t('perspectives.money_oud'), a: f(n) } : null;
      },
    ],
    land: [ // input: acres
      (acres) => {
        const co2 = acres * BENCH.forestCo2PerAcre;
        return ok(co2) && BENCH.carCo2 && ok(co2 / BENCH.carCo2) ? { text: t('perspectives.land_forest'), a: f(co2), b: f(co2 / BENCH.carCo2) } : null;
      },
      (acres, ctx) => {
        const size = BENCH.farmAcres[ctx.state];
        const n = size ? acres / size : 0;
        return ok(n) ? { text: t('perspectives.land_farms', { state: ctx.state }), a: f(n) } : null;
      },
      (acres) => {
        const homes = acres * BENCH.homesPerAcre;
        return ok(homes) && BENCH.household ? { text: t('perspectives.land_homes'), a: f(homes), b: f(homes * BENCH.household) } : null;
      },
      (acres) => {
        const residents = (acres / BENCH.parkAcresPer1000) * 1000;
        return ok(residents) ? { text: t('perspectives.land_parks'), a: f(residents) } : null;
      },
      (acres) => {
        const mw = acres / BENCH.solarAcresPerMw;
        const homes = (mw * BENCH.solarCapacityFactor * 8760 * 1000) / BENCH.homeKwh;
        return ok(homes) ? { text: t('perspectives.land_solar'), a: f(homes) } : null;
      },
      (acres) => {
        const gal = acres * BENCH.wetlandGalPerAcre;
        return ok(gal / 1e6) ? { text: t('perspectives.land_wetland'), a: DCF.friendly(gal) } : null;
      },
      (acres) => {
        const n = acres * BENCH.treesPerAcre;
        return ok(n) ? { text: t('perspectives.land_trees'), a: f(n) } : null;
      },
      (acres) => {
        const n = acres / BENCH.highSchoolAcres;
        return ok(n) ? { text: t('perspectives.land_high_schools'), a: f(n), b: f(n * 1000) } : null;
      },
      (acres) => {
        const units = acres * BENCH.aptPerAcre;
        return ok(units) && BENCH.household ? { text: t('perspectives.land_apartments'), a: f(units), b: f(units * BENCH.household) } : null;
      },
      (acres) => {
        const n = acres / BENCH.farmAcresPerPerson;
        return ok(n) ? { text: t('perspectives.land_food'), a: f(n) } : null;
      },
    ],
    floor: [ // input: square feet
      (sqft) => {
        const students = sqft / BENCH.schoolSqftPerStudent;
        return ok(students) ? { text: t('perspectives.floor_schools'), a: f(students) } : null;
      },
      (sqft) => {
        const beds = sqft / BENCH.hospitalSqftPerBed;
        const perBed = BENCH.hospitalBeds ? BENCH.hospitalAdmissions / BENCH.hospitalBeds : 0;
        if (!ok(beds)) return null;
        return perBed
          ? { text: t('perspectives.floor_hospital_stays'), a: f(beds), b: f(beds * perBed) }
          : { text: t('perspectives.floor_hospital_beds'), a: f(beds) };
      },
      (sqft) => {
        const homes = sqft / BENCH.homeSqft;
        return ok(homes) && BENCH.household ? { text: t('perspectives.floor_homes'), a: f(homes), b: f(homes * BENCH.household) } : null;
      },
      (sqft) => {
        const units = sqft / BENCH.aptSqft;
        return ok(units) && BENCH.household ? { text: t('perspectives.floor_apartments'), a: f(units), b: f(units * BENCH.household) } : null;
      },
      (sqft) => {
        const kids = sqft / BENCH.childCareSqft;
        return ok(kids) ? { text: t('perspectives.floor_child_care'), a: f(kids) } : null;
      },
      (sqft) => {
        const people = sqft / BENCH.shelterSqft;
        return ok(people) ? { text: t('perspectives.floor_shelter'), a: f(people) } : null;
      },
    ],
  };

  const HEADINGS = {
    get power() { return t('perspectives.heading_power'); },
    get money() { return t('perspectives.heading_money'); },
    get land() { return t('perspectives.heading_land'); },
    get floor() { return t('perspectives.heading_floor'); },
  };

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // All comparisons that work for this value, in random order.
  function deck(kind, value, ctx) {
    const items = (LISTS[kind] || []).map((make) => {
      try { return make(value, ctx); } catch { return null; }
    }).filter(Boolean);
    return shuffle(items);
  }

  return { BENCH, HEADINGS, deck };
})();
