# Datawriter, By CUAI (Beta 0.5)

Datawriter, By CUAI, is an extension for Chrome and Edge: type a ZIP code or a town ("Scranton, PA") and see the nearest data center tracked by
[trackdatacenters.com](https://trackdatacenters.com/usa/pennsylvania), with a satellite view, its
size and cost put in human terms, the officials who decide whether it gets built, and a letter
ready to send them.

## Coverage

- Projects searched: every state the tracker covered in October 2026. East Coast:
  Pennsylvania (93), New York (21), North Carolina (28), Maryland (14), New Jersey (12), Maine (6),
  Connecticut (5), Massachusetts (4), Delaware (3), New Hampshire (1) and Rhode Island (1).
  Midwest and South: Ohio (56), Indiana (39), Missouri (31), Michigan (26), Iowa (23), Kentucky
  (19), Alabama (14), Tennessee (14), West Virginia (12), Mississippi (9), North Dakota (8),
  Arkansas (7), South Dakota (3), Alaska (2) and Hawaii (1). DC, Virginia, Illinois, Georgia,
  South Carolina and Florida are registered ahead of the tracker (its API had no rows for them,
  and its Illinois page said "coming soon"), so their ZIPs land on the nearest covered project
  until rows appear; their state officials and comparison figures are already in place. Iowa has
  rows in the API but no state page yet, so the panel says "coming soon" and keeps the national map.
  ZIP codes for every registered state and its neighbors (27,473 ZIPs in 34 states and DC) are
  bundled from GeoNames by `tools/build-zips.ps1`; any other ZIP is looked up online, and the
  nearest covered project is still found.
- Officials: state leaders for all 31 states and DC (governor, lieutenant governor or
  senate president, the utility regulator, the environment agency, the economic agency, and the
  siting board where one exists); county leadership for all 67 PA counties, all 24 MD
  jurisdictions, DC, and every county with a project in the other states (about 300 counties in
  all, including consolidated governments such as Indianapolis-Marion County, Louisville Metro,
  Lexington-Fayette, Metro Nashville, Cuyahoga County and the City and County of Honolulu);
  county planning commissions and boards of adjustment where published; and the governing body,
  planning board and zoning board of the municipality each project sits in (about 310
  municipalities, townships and boroughs, all states except Pennsylvania). Connecticut,
  Massachusetts and Rhode Island have no county governments, so their towns carry the full set;
  Hawaii has no governments below the county. Where the tracker misspells a place ("Marlon
  County", "BDeSoto County", "Southhaven", "Marysvile", "Carrollton County"), the research carries
  an alias so the lookup still works. See "Known gaps".
- Stage colors and the letter-writing window: every project carries one color for its stage,
  used on the status chip, the band beside the title, the dots in the "closest" list and a stage
  card under the title. Red = Proposed (a decision is pending; letters matter most), amber =
  Preliminary activity (nothing filed yet; ask for rules first), purple = Delayed (stalled; pressure
  decides), orange = Expanding (new approvals needed), brown = Under construction, green =
  Active (zoning settled; letters shift to permits, rates and the next phase), grey = Withdrawn,
  Rejected or Retired (nothing pending). The card says in one line whether letters are most
  effective, still useful or of limited effect at that stage, with a legend. Definitions live in
  `STAGES` in `finder.js`.
- When nothing is tracked near you: if the nearest project is in another state or more than
  40 miles away, a note explains why the tracker shows nothing for the area: the state is not
  covered by the tracker, its page is still "coming soon", the extension has not researched that
  state's officials, or simply nothing has surfaced publicly yet (projects often begin under code
  names and non-disclosure agreements), with a pointer to local planning agendas.
- Languages: English, Spanish and Simplified Chinese for the interface, the tutorial, the stage texts,
  the comparisons, the call scripts, the popup, the About page and the instructions sheet. The letter sent
  to officials is always English; the composer shows a translated copy beneath it. The language follows the
  browser and can be overridden from the panel header or the popup. Strings live in `tools/i18n/`.
- Sidebar or full screen: the full-screen button (⤢) in the panel header switches between the sidebar
  (beside the tracker's map) and a full-screen view with the same content at a readable width;
  the choice is remembered. In sidebar mode the tracker's own map flies to whichever project the
  panel is showing (the service worker runs a small script in the page that talks to the site's
  Mapbox map), and "Show on the tracker's map" also opens the site's own card for that project.
  The tracker's map only holds the projects of the state page that is open, so when the project
  is in another state the panel first switches the tab to that state's map and resumes the search
  there (North Carolina has no tracker page, so its projects are shown on whatever page is open).
- Town and project search: the box in the popup and the panel takes a ZIP or a town. After four
  letters of a town name, matching towns from the bundled ZIP table appear (optionally narrowed by
  ", ST" or ", State"); choosing one, or pressing Find, searches from that town's central ZIP.
  The index is built from `data/zips.js` on first use, so no network call is involved. The panel's
  box also matches project names from the tracker's data once it is loaded; choosing a project shows
  it directly, with distances still measured from the searched ZIP when there is one.
- Most impactful contacts: the panel picks up to five people per project (no more than two
  from one board) and lists them first under "Start here", with a one-line reason: the chair and
  members of the body that casts the binding vote, the zoning board that rules on variances, the
  planning body that recommends, and the governor and regulators. Scoring lives in `impact()` in
  `panel.js`; a person with their own email ranks slightly higher because the letter reaches them
  directly.

## What the panel shows

1. Picture: satellite view with the project boundary outlined, a wider view, and a map from your
   ZIP to the site.
2. By the numbers: flat cards with big figures (power, land, building size, cost, and where the
   tracker records them carbon at full load, permanent jobs and the announcement-to-opening span),
   each translated into football fields, Central Park, the Pentagon, homes, how long a year
   of its electricity would run the project's own state (New York City for Pennsylvania, New York
   and New Jersey; Washington for Maryland, Virginia and DC), and dollars per state resident.
3. "…could instead" comparisons: each card shows two randomly chosen comparisons tied to a
   missed benefit; "Another comparison" shows the next two. There are 36:

   | Card | Comparisons |
   | --- | --- |
   | Electricity (6) | schools and their students · hospitals and their admissions · homes and the people in them · electric cars and avoided tailpipe CO₂ · electric school buses and the kids riding them · clean drinking water for a year |
   | Money (14) | teachers and the students they would teach · lives saved with bed nets · college degrees · free school lunches · lead pipes replaced · a year of public school · a year of child care · a year of SNAP food aid · Medicaid coverage · Pell Grants · community-health-center care · firefighters or paramedics · a year of household energy bills · a year of opioid addiction treatment |
   | Land (10) | forest and the CO₂ it absorbs · family farms · homes on typical lots · parkland · a solar farm · wetland floodwater storage · trees planted · high-school campuses · garden apartments · food grown for people |
   | Floor space (6) | schools · hospital beds and patient stays · family homes · apartments · child care places · emergency shelter |

   Money comparisons use the low end of a cost range. A note under the cards says these show scale,
   not where the money or land would otherwise go.
4. Who decides: three tiers, each with official portraits where the government publishes them:
   - the municipality: governing body, planning board, zoning board, and key staff;
   - the county (or DC): elected leaders, planning commission, board of appeals, planning
     director, with election notes;
   - the state: governor, lieutenant governor, utility commission chair, environmental and
     economic-development agency heads, each with a one-line "why they matter".
   A short tip explains who holds the zoning power in that state. Entries whose 2026 titles
   could not be confirmed show a "check the official website" warning.
5. Write to them: a sticky bar under the project title shows the faces of the three to five
   people whose decision matters most and one button, "Write to the N people who decide" (N being how many); the full
   roster with portraits stays below it, with a write (or call) button on every official. The composer
   writes a letter for that person: the right salutation (Governor, Commissioner, Senator, Judge…),
   the asks that match their role (vote against the rezoning; recommend denial; deny the variance;
   make the developer pay for grid upgrades; withhold incentives), and the project's facts from the
   tracker (developer, site, megawatts and the homes they equal, generators, acres, jobs). A Tone
   slider (Ask questions, Set conditions, Oppose) and a Detail slider (Brief, Standard, Full); the full
   Oppose letter is the chapter's original wording, and the other stops only leave sentences and asks
   out. "As your constituent" appears only when the writer's ZIP is inside the official's
   jurisdiction; otherwise the letter says "as a resident of nearby <town>", or just "of <town>" when
   the writer lives more than 60 miles away. The writer's ZIP is the home ZIP when one is saved (popup
   or composer), else the searched ZIP. A one-line personal note slots in after the opening. The name
   is required (offices set unsigned letters aside), the town is filled from the writer's ZIP until
   edited, and street, email and phone are optional.
   Send options stay side by side: Gmail, Outlook, Yahoo Mail, the desktop mail app, and copy
   (letter, address, subject); the one used last is highlighted. Letters routed through a shared
   office mailbox carry "For <name>:" in the subject and open with an "Attention" line, with the office
   phone beside the send buttons. Letters too long for a mail link are copied first and the message
   opens with a one-line note to paste over. Officials with only a web form get the form
   opened beside the panel plus copy buttons; officials with only a phone get a 30-second call
   script, a voicemail version and a print-ready letter with the mailing address. After a send link is
   used, the panel waits for the mail window to open and asks the writer to confirm the send; only
   then is the person marked as sent, and Sent can be undone. The bar shows "2 of 4 sent", "Write to
   everyone" advances to the next unsent person, and a Done box offers a calendar reminder: the next
   dated pending decision when the tracker records one, otherwise an interval set by the project's
   stage, with a link to the municipal or county website. Your details are saved on your computer only. The extension never sends
   anything itself.
6. Details, companies, approvals, sources, and the closest projects (six, then up to fifteen).

## Install (about one minute)

1. Open `chrome://extensions` (in Edge, `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `datawriter` folder. If an earlier version is
   installed, click its reload button (the circular arrow) instead.
3. Pin the extension's icon. Click it (or press **Alt + Shift + D**), type a ZIP, press Enter.

See `INSTRUCTIONS.html` (also shipped as a PDF) for the plain-language guide that goes with the zip archive.

## Name and versions

The project is **Datawriter, By CUAI**, created by **CU Amnesty International (CUAI)**, the Columbia
University chapter of Amnesty International; that name appears in
the manifest, the toolbar popup, the About page (`about.html`, linked from the popup and the panel's
footer), this README and the instructions sheet. The manifest's `version` is numeric (`0.5.0`) because
Chrome requires it; `version_name` carries the public label (`Beta 0.5`).

Versions move conservatively:

| Change | Bump | Example |
| --- | --- | --- |
| Data refresh, bug fix, wording | third number | 0.1.0 → 0.1.1 (label stays "Beta 0.1") |
| New state, new panel feature | second number | 0.1.x → 0.2.0 ("Beta 0.2") |
| Leaving beta | first number | 1.0.0 ("Datawriter 1.0") |

Zip archives are named `datawriter-beta-<version>-<date>.zip` with the full number, so builds stay
distinguishable. History: 0.1.0 (October 23, 2026) first beta; 0.1.1 (October 24, 2026) code review:
officials and portraits bundled per state, popup loads lazily, accessibility and letter fixes;
0.2.0 (October 27, 2026) letter flow simplified so a letter takes fewer steps: sticky "write to the
people who decide" bar, tones and lengths, constituency wording, personal line, name guard, Outlook
and Yahoo send options, copy package, call script and print for phone-only officials, sent tracking
with calendar nudge, plain-comma mailto fix; 0.2.1 (October 28, 2026) three-step tutorial card on the
panel's first open (stored under `dcfTourSeen`, so it shows once); 0.2.2 (October 30, 2026) About page
naming CU Amnesty International as the creator, linked from the popup and the panel footer, and a
plainer interface: text labels and simple line icons in place of emoji, flat cards with small
radii, no tinted figure cards or accent rails, and the popup label reads its version from the manifest;
0.2.3 (November 1, 2026) letters brought back to the chapter's template (formal address block, stage-aware
wording for projects already under construction or running, hedged facts, the next hearing date in the ask),
and a wording and grammar pass over the panel, popup and documents; 0.3.0 (November 2, 2026) tone and
detail sliders in the composer with a Standard stop between Brief and Full, confirmed sends with undo,
copy-first for letters too long for a mail link, a home ZIP, project-name search, a longer "closest"
list, stage-based reminders, and an Attention line for letters routed through a shared mailbox;
0.4.0 (November 2, 2026) Spanish and Simplified Chinese: every interface string goes through `i18n.js`
(generated by `tools/build-i18n.ps1` from `tools/i18n/catalog.json`, `es.json` and `zh_CN.json`), the
language follows the browser with a menu in the panel header and the popup to override it (`dcfLang`),
letters to officials stay in English with a translated copy shown under the letter, and the
instructions sheet ships in all three languages; 0.4.1 (November 3, 2026) red accents for urgency: while a
project's stage still allows a decision, the distance figure, the "Start here" box and the starred rows turn red; 0.5.0 (November 3, 2026) three more figures (carbon at full
load from the state grid rate in `states.json`, or the gas rate for an on-site gas plant; permanent jobs per acre
and investment per job; years from announcement to planned opening), a "Did you know?" box under the figures with
one sourced fact at a time (server depreciation, the tracker's own median job counts, the DOE/LBNL 2024 share of
U.S. electricity), and water left out of the letters unless the tracker records a figure, with the water question
moved down the questions list.

## How it works

- The tracker only serves its data to its own pages, so the panel runs on trackdatacenters.com and
  reads the same data the tracker's map loads (cached 30 minutes).
- Six small scripts load with the tracker's pages (about 180 KB, no network requests). The big
  tables are ES modules imported only when needed: the ZIP table (1.7 MB) the first time you open
  the panel, and the officials and portraits of one state (`data/leaders/<xx>.js`, typically
  30–150 KB, and `data/photos/<xx>.js`, typically 50–600 KB) the first time a project in that state
  is shown. Browsing the tracker without the panel costs nothing, and a search never parses the
  other 30 states' data.
- Satellite and street imagery comes from Esri's public map services.

## Keeping it current, and adding states

`tools/NEW-STATE.md` is the step-by-step checklist. In short: every state-specific fact (name,
postal code, tracker page, reference figures, who-decides text, election note) lives in
`tools/states.json`; `states.js` is generated from it and read by every script, so adding a state
is a JSON entry plus research files, with no JavaScript edits.

```
tools/states.json          the state registry (edit this) → tools/build-states.ps1 → states.js
tools/list-projects.ps1    what the tracker has: counts per state, or one state's counties, towns and projects
tools/build-zips.ps1       GeoNames postal codes → data/zips.js for every registry state and its neighbors
tools/research/SCHEMA.md   the JSON shapes research agents must produce
tools/research/*.json      raw research, one file per batch, with sources and confidence
                           (xx_state, xx_counties_*, xx_boards_*, xx_muni_*, xx_emails_*; xx = postal code)
tools/scan-emails.ps1      fetches every known official page and harvests mailto: links → research/mailto_scan.json
tools/build-leaders.ps1    research + scan → data/leaders/<xx>.js (one per state) + tools/photo-manifest.json
tools/build-photos.ps1     manifest → downloads, 96 px squares → data/photos/<xx>.js (one per state)
```

### When a board publishes no email

Each board and office shows a contact line with whatever the
official site gives: the clerk's or department's mailbox, a contact form, a phone number, the
mailing address of the hall or planning office, and the jurisdiction's official social accounts
(only accounts linked from the official website, never personal ones). A person whose board has
none of the email routes still gets a call button: the composer then shows the phone number, the
mailing address with a "copy" button for a printed letter, and the official accounts to post to,
alongside the letter text. The "Write to everyone" note says how many officials fall into each
group. The data lives in `xx_contacts_*.json` research files (see `tools/research/SCHEMA.md`).

Email addresses come only from official government websites: the agents' research first, then
addresses harvested from the officials' own pages and matched by name (1,114 individuals). Where a
person has no published address, the letter goes to their board's or office's mailbox, or opens the
office's contact form (3,005 of 3,174 people are reachable in one of those ways; every board has at
least a phone number and a mailing address, and only three boards, in Monroe County (PA), Stokes
County (NC) and Joplin (MO), have no email route at all). A few small towns
publish personal-domain addresses for board members on their official pages; those are included
only when the agent found them on the official site.

Edit or add a research file (same shape as its neighbors), then run the builds from the
extension folder:

```bash
powershell -ExecutionPolicy Bypass -File tools/build-states.ps1; powershell -ExecutionPolicy Bypass -File tools/build-leaders.ps1; powershell -ExecutionPolicy Bypass -File tools/build-photos.ps1
```

Dates to watch: Maryland, North Carolina and New Jersey county boards change in December 2026 after the November 3 election;
Missouri commissions change in January 2027; Illinois elects its governor on November 3, 2026 and gets a
new lieutenant governor in January 2027; Connecticut, Maine, Massachusetts, Rhode Island, New
Hampshire, Georgia, South Carolina and Florida all elect governors on November 3, 2026 (Maine, Georgia,
South Carolina and Florida get new ones, and their agency heads usually change in early 2027);
Connecticut towns vote in November 2027; Pennsylvania boards and New York councils reorganize each January; DC
gets a new mayor in January 2027; New Jersey's lieutenant governor seat is vacant until the
governor names a replacement (November 2026). In the 2026 batch: Ohio, Michigan, Iowa, Alabama,
Tennessee, South Dakota, Alaska, Hawaii and Arkansas elect governors on November 3, 2026 (Ohio,
Michigan, Iowa, Alabama, Tennessee, South Dakota and Alaska get new ones, so their agency heads
change in January 2027); Kentucky's fiscal courts and city councils, North Dakota, Arkansas and
South Dakota county boards, Indiana and Michigan county boards and most Ohio commissions have seats
on the same ballot and reorganize in January 2027; Tennessee county boards took office September 1,
2026 and some rosters still show the old term; Mississippi's supervisors run through 2027;
Alabama municipal terms began November 2025; West Virginia's county commissions and the Louisville and
Indianapolis councils have staggered seats.

Some official sites block scripted fetching (St. Louis County, Kansas City, Joplin, Maryville,
Peculiar, Platte County). Those were read in a browser and recorded in `mo_counties_z.json` and
`mo_muni_z.json`; a later research file for the same jurisdiction merges with, rather than
replaces, an earlier one. The photo downloader uses curl with ordinary browser headers, which most
of those sites accept; the handful that still refuse (OpenCities sites such as Charlotte,
Fayetteville, Genesee and Jackson County, plus Kansas City and St. Louis County) were fetched once
in a browser and sit in `tools/photo-cache/`, so a rebuild does not need to download them again.

## Known gaps (October 2026)

Research ran against a per-session web-search cap, so some batches worked from official websites
only. Where a site blocked automated fetching, the record is marked low confidence and the panel
says so. Missing or thin: Pennsylvania municipal boards (not yet researched: the 76 townships and
boroughs with projects); Greensboro, Statesville, Matthews, Buffalo and Tonawanda boards (sites
blocked); Baltimore County, Charles County and Westmoreland County planning bodies; Brookhaven
(Upton/Yaphank) boards; several county planning commission rosters that are not published online.
In Missouri: Montgomery County's site could not be reached; Buchanan County and Camden County
records are thin; St. Louis County and Kansas City publish their planning commission and zoning
board rosters only inside meeting agendas, so those bodies have an office address but no members.
In Connecticut: Wallingford hides its staff and mayoral emails behind scripts, so those go to the
council or economic development mailbox; the Siting Council's chair seat was vacant in October
2026, so its vice chair is listed; Waterford's selectmen page is undated.
In New England and Delaware (October 2026): Nottingham, NH's website was offline during a
CivicPlus outage, so its boards come from search summaries of the official pages (low confidence);
Delaware City's site did not resolve, so its council is empty; Holyoke blocks scripted fetching
and its council was taken from search summaries; Limestone, ME publishes only a bare list of
names; Lewiston and Sanford do not publish their board of appeals rosters; Wiscasset's board of
appeals page lists no members; Rhode Island's state sites block scripted fetching, so its state
leaders have no portraits; Georgia's economic development agency and New Hampshire's business
agency sit on non-.gov domains, so those two commissioners have no portrait or email.
In the Midwest and South (October 2026): a few official sites could not be read at all, so those
records hold contact details but no names: Dundee Township, MI (site unreachable); Ypsilanti
Township, MI; Mingo County, WV; Hinds and Madison counties, MS (site outage); Stanton, ND;
Mount Vernon, AL (bot check); Hawesville, KY (expired certificate); and Kent County, MI. Names
that appeared only in search snippets were left out rather than guessed. Many councils publish contact forms instead of emails (Franklin
County, OH; Lake County, IN; Kalamazoo County; Scott and Pottawattamie counties, IA; Columbiana and
Childersburg, AL; Louisville Metro), so the panel offers the form, phone and address instead.
Planning commission and zoning board rosters are often published only inside agendas or PDFs
(Indianapolis, Memphis, Louisville, Nashville, Lexington, Auburn, Montgomery, Southaven, Davenport,
Dubuque and others); those bodies carry the office mailbox and no members. Alaska's legislature
and Mississippi's Senate leadership sit behind bot checks or PDFs, so those two seats are missing.
Teacher salary and farm size figures are not yet filled for Iowa, Tennessee, West Virginia,
Mississippi, North Dakota, Arkansas, South Dakota, Alaska and Hawaii, so those comparisons use the
U.S. average. `confidence` in the research files marks each one.

Photos are official portraits from government websites only, reduced to 96 px; none come from news
sites or social media. 1,907 of the 1,947 portrait links resolve; the rest (Stokes County and
Mansfield Township, whose image links are dead, East Greenwich Township and New Florence, whose
Google Sites images refuse direct loads, Clinton County, IN, whose image links return 404,
Sheridan, AR, whose image host refuses direct loads, and one each for Oakland County, Cleveland
County, Nodaway County, Carrollton, KY, and the Alabama, Indiana and West Virginia state pages)
show initials instead. About 230 portraits sit on hosts that block scripted downloads and were
fetched once in a browser into `tools/photo-cache/`; a rebuild reuses them. Party
labels appear only where a source states them.

## Comparison sources

| Reference | Value | Source |
| --- | --- | --- |
| Average U.S. home | 10,791 kWh/year | EIA, 2022 |
| New York City electricity | 53,360 GWh/year | Con Edison Zone J (2018), via NYC Planning environmental reviews |
| Washington, DC electricity | 10,142,915 MWh/year | EIA State Electricity Profile, 2024 |
| North Carolina electricity | 136,904,526 MWh/year | EIA State Electricity Profile, 2024 |
| Missouri electricity | 77,776,034 MWh/year | EIA State Electricity Profile, 2024 |
| Illinois electricity | 133,226,907 MWh/year | EIA State Electricity Profile, 2024 |
| Connecticut electricity | 27,351,355 MWh/year | EIA State Electricity Profile, 2024 |
| Delaware · Maine · Massachusetts · Rhode Island · New Hampshire electricity | 11,373,916 · 11,341,591 · 49,418,575 · 7,414,247 · 10,913,961 MWh/year | EIA State Electricity Profiles, 2024 |
| Georgia · South Carolina · Florida electricity | 150,003,965 · 83,961,428 · 255,095,458 MWh/year | EIA State Electricity Profiles, 2024 |
| Ohio · Indiana · Michigan · Iowa · Kentucky electricity | 153,707,376 · 99,219,607 · 98,991,014 · 54,930,422 · 74,405,871 MWh/year | EIA State Electricity Profiles, 2024 |
| Alabama · Tennessee · West Virginia · Mississippi electricity | 87,522,932 · 102,962,435 · 32,990,570 · 48,684,612 MWh/year | EIA State Electricity Profiles, 2024 |
| North Dakota · Arkansas · South Dakota · Alaska · Hawaii electricity | 29,769,698 · 49,895,812 · 13,637,204 · 6,046,503 · 8,952,134 MWh/year | EIA State Electricity Profiles, 2024 |
| Teacher salary, farm size, pupils per teacher, per state | see `tools/states.json` | NEA 2024–25, USDA 2022 Census of Agriculture, NCES 2023–24 |
| Football field | 57,600 sq ft | NFL field including end zones |
| Central Park | 843 acres | NYC Parks |
| Pentagon | 6.5 million sq ft | Pentagon facts |
| Population | PA 13,059,432 · MD 6,265,347 · VA 8,880,107 · DC 693,645 · NC 11,197,968 · NY 20,002,427 · NJ 9,548,215 · MO 6,270,541 · IL 12,719,141 · CT 3,688,496 · DE 1,059,952 · ME 1,414,874 · MA 7,154,084 · RI 1,114,521 · NH 1,415,342 · GA 11,302,748 · SC 5,570,274 · FL 23,462,518 · OH 11,900,510 · IN 6,973,333 · MI 10,127,884 · IA 3,238,387 · KY 4,606,864 · AL 5,193,088 · TN 7,315,076 · WV 1,766,147 · MS 2,954,160 · ND 799,358 · AR 3,114,791 · SD 935,094 · AK 737,270 · HI 1,432,820 | Census Vintage 2025 |
| Grid CO2 rate per state | `co2LbPerMwh` in `tools/states.json` (280 in NH to 1,912 in WV) | EIA State Electricity Profiles, Table 1, 2024 data |
| On-site gas plant CO2 rate | 800 lb CO2/MWh (`gasLbPerMwh` in `tools/states.json`) | EPA 40 CFR 60 Subpart TTTTa, standard for new base-load combined-cycle gas turbines |
| Server useful life | Amazon 5 years (2025), Microsoft 6 (2022), Alphabet 6 (2023), Meta 5.5 (2025) | each company's annual report (Form 10-K) |
| Data center share of U.S. electricity | 4.4% in 2023; 6.7% to 12% by 2028 | LBNL for the U.S. Department of Energy, December 2024 |
| Build cost | $8.9M–$23.3M per MW | Cushman & Wakefield 2026 Data Center Development Cost Guide |
| K-12 school electricity | 96.4 billion kWh ÷ 49.3M public students; 497 students per school | EIA CBECS 2018; NCES 2024–25 |
| Hospital electricity, admissions, beds | 65 billion kWh ÷ 6,100 hospitals; 35,658,583 admissions; 907,216 beds | EIA CBECS 2018; AHA Fast Facts 2026 |
| Electric car / school bus | ~4,000 kWh/yr; ~18,000 kWh/yr, ~50 riders | EPA, FHWA 2024; EPA Clean School Bus |
| Gasoline car | 4.29 t CO₂e/yr | EPA Greenhouse Gas Equivalencies (2022 data) |
| Drinking water | 2,069 kWh per million gallons; 82 gal/person/day | EPRI via EPA WaterSense; USGS 2015 |
| Household size | 2.5 people | Census CPS ASEC 2025 |
| Teacher salary / pupils per teacher | US $74,495 · PA $79,078 · MD $87,409 · NC $60,323 · NY $98,655 · NJ $84,974; 15.2 / 13.1 / 14.2 / 15.3 / 11.6 / 11.8 | NEA 2024–25; NCES 2023–24 |
| Cost per life saved | $5,500 (Against Malaria Foundation) | GiveWell, 2026 |
| Public four-year tuition and fees | $11,950/yr | College Board Trends in College Pricing 2025 |
| Free school lunch | $4.76 per meal × 180 days | USDA, SY 2026–27 |
| Lead service line | $7,000 (EPA range $6,507–$8,519) | EPA LCRI economic analysis |
| School spending per pupil | US $17,619 · PA $21,091 · MD $20,208 · NY $31,918 · NJ $27,234 (NC uses the U.S. figure) | Census School System Finances, FY2024 |
| Child care | $13,184/yr | Child Care Aware of America 2025 |
| SNAP | $187.91 per person per month | USDA FNS FY2025 via KFF |
| Medicaid | $7,407 per enrollee | KFF, 2023 |
| Pell Grant | $7,395 maximum | U.S. Dept. of Education 2026–27 |
| Community health center | $1,672 per patient per year | HRSA UDS 2025 |
| Firefighter / paramedic wage | $59,280 / $48,150 median | BLS, May 2025 |
| Household energy bill | $1,728/yr | EIA, 2024 |
| Opioid treatment | $13,982/yr (methadone, bundled rate) | CMS 2025 |
| Forest CO₂ uptake | 1.00 t per acre per year | EPA Greenhouse Gas Equivalencies (2021–22) |
| Average farm | PA 144 · MD 158 · NC 190 · NY 212 · NJ 71 acres | USDA 2022 Census of Agriculture |
| New-home lot | 8,543 sq ft median, minus 25% for streets | NAHB from Census Survey of Construction, 2025 |
| Parkland | 10 acres per 1,000 residents | NRPA Agency Performance Review 2026 |
| Solar | 5.6 acres per MW; 23.2% capacity factor | LBNL 2022; EIA 2024 |
| Wetland | 1 million gallons of floodwater per acre | EPA |
| Reforestation | 436 seedlings per acre (10 × 10 ft) | state forestry guidance |
| High school site | 30 acres + 1 per 100 students | CEFPI guideline |
| Garden apartments | 19 units per acre (low end of 19–25) | planning references |
| Farmland per person | 2.67 acres on the current U.S. diet | Peters et al., Elementa 2016 |
| New home / apartment | 2,142 / 1,000 sq ft median | Census Characteristics of New Housing, 2025 |
| School / hospital floor space | ~180 sq ft per student; ~2,500 sq ft per bed | School Planning & Management; Definitive Healthcare 2025 |
| Child care / emergency shelter | 35 sq ft per child; 37.7 sq ft per person | state licensing (e.g. Florida); UNHCR/Sphere |

Values live in `REF` (`finder.js`) and `BENCH` (`perspectives.js`).

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension definition (Manifest V3) |
| `popup.html/.css/.js` | Toolbar popup where you enter the ZIP |
| `background.js` | Opens or focuses the tracker tab; looks up ZIPs outside the bundled states |
| `panel.js`, `panel-css.js` | The side panel shown on trackdatacenters.com |
| `finder.js` | Distance, ranking, comparisons, cost estimate, imagery, formatting |
| `perspectives.js` | "Could instead" benchmarks and comparison templates |
| `data/zips.js` | 27,473 ZIP code locations (GeoNames, CC BY 4.0), loaded on demand |
| `data/leaders/<xx>.js` | One module per state: its state, county and municipal officials, loaded when a project there is shown |
| `data/photos/<xx>.js` | One module per state: official portraits as 96 px data URLs, loaded with the state's officials |
| `tools/` | Research files and the build scripts (see "Keeping it current, and adding states") |
