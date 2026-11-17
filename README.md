# Datawriter, By CUAI

**Type your ZIP code. See the data center planned near you, the officials who decide, and a letter ready to send them.**

Datawriter is a free Chrome and Edge extension from CU Amnesty International (CUAI), the Columbia University chapter of Amnesty International. It works on [trackdatacenters.com](https://trackdatacenters.com), the public Data Center Tracker.

Every community has a right to clean water, breathable air and affordable energy. Data centers are approved by local boards, often with little notice and under code names, and the costs fall on the people who live nearby. Datawriter closes the gap between a resident and the hearing room: it finds the project, puts its size in human terms, names the people with a vote, and drafts the letter.

Current release: **Beta 0.5** (build 0.5.1). Officials data: October 2026. Coverage: 31 states and the District of Columbia.

## What it does

1. **Finds the nearest project.** A ZIP code, a town ("Scranton, PA") or a project name. Satellite view, boundary outline, distance, and the project's stage: proposed, under construction, running, withdrawn.
2. **Puts the numbers in human terms.** Megawatts become homes powered and days of a whole state's electricity. Acres become football fields and Central Park. Dollars become teachers, school lunches and lives saved. Every comparison is sourced ([docs/sources.md](docs/sources.md)).
3. **Names who decides.** Three tiers with official portraits: the municipality's council, planning and zoning boards; the county's commissioners and planning commission; the governor, utility regulator and permitting agencies. A "Start here" box picks the handful of people whose vote matters most.
4. **Writes the letter.** The right salutation, the asks that fit the office, the project's own facts, and the writer's standing as a constituent or a neighbour. Three tones (ask questions, set conditions, oppose), three lengths. It opens in Gmail, Outlook, Yahoo or the desktop mail app. Nothing is sent by the extension; the writer presses Send.
5. **Reaches people without email.** A contact form opened beside the panel, a 30-second call script with a voicemail version, or a print-ready letter with the mailing address.

Interface in English, Spanish and Simplified Chinese. Letters to officials are always English, with a translated copy shown underneath.

## Install

Until the Chrome Web Store listing is live, load it as an unpacked extension:

1. Download the latest zip from [`dist/`](dist/) (or a Release) and unzip it. Keep the folder somewhere permanent.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and choose the folder that contains `manifest.json`.
4. Pin the icon. Click it, or press **Alt + Shift + D**, type a ZIP and press Enter.

A plain-language guide for people who will use it is in [docs/instructions/](docs/instructions/), in all three languages.

## How it works

The tracker serves its data only to its own pages, so the panel runs as a content script on trackdatacenters.com and reads the same data the site's map loads (cached for 30 minutes). Six small scripts load with the page, about 180 KB and no network requests. The large tables are ES modules loaded on first use: the ZIP table once, and one state's officials and portraits when a project in that state is shown. Imagery comes from Esri's public map services. Full details on how officials were collected and where the gaps are: [docs/data.md](docs/data.md).

## Repository layout

```
extension/            the unpacked extension (load this folder in the browser)
  manifest.json       Manifest V3
  popup.*             toolbar popup: ZIP or town entry, home ZIP, language
  background.js       opens or focuses the tracker tab; looks up ZIPs outside the bundled states
  panel.js, panel-css.js   the side panel on trackdatacenters.com
  finder.js           distance, ranking, comparisons, cost estimate, imagery, formatting
  perspectives.js     "could instead" benchmarks
  letter.js           the letter and call-script builder
  states.js           generated registry of covered states (figures, who-decides text, routing)
  i18n.js             generated string tables for en, es and zh_CN
  data/zips.js        27,473 ZIP centroids (GeoNames, CC BY 4.0)
  data/leaders/xx.js  one module per state: state, county and municipal officials
  data/photos/xx.js   one module per state: official portraits as 96 px data URLs
tools/
  i18n/               en.json (source), es.json, zh_CN.json, runtime.js
  build-i18n.mjs      regenerates extension/i18n.js and checks every translation
  build-zip.sh        packages extension/ into dist/
  harness/            loads the panel in headless Chromium against a stub tracker API
docs/
  sources.md          every comparison figure and where it comes from
  data.md             how officials were collected, how to refresh them, known gaps
  instructions/       the user guide (en, es, zh_CN)
dist/                 packaged zips, one per build
CHANGELOG.md          release history
PRIVACY.md            what the extension stores and contacts
```

The research files and PowerShell build scripts that produce `states.js`, `data/leaders/` and `data/photos/` are kept by the chapter and are not in this repository yet. See [docs/data.md](docs/data.md).

## Building

Edit a string in `tools/i18n/en.json`, translate it in `es.json` and `zh_CN.json`, then:

```
node tools/build-i18n.mjs      # rewrites extension/i18n.js; fails if a translation is missing or drops a {placeholder}
sh tools/build-zip.sh          # writes dist/datawriter-<version>.zip from extension/
node tools/harness/run.mjs     # renders the panel headlessly and writes screenshots to tools/harness/out/
```

Versions move slowly. Wording, data refreshes and fixes bump the last number; a new state or panel feature bumps the middle one; `version_name` in the manifest carries the public label ("Beta 0.5").

## Privacy

Datawriter sends nothing on its own. A writer's name, address, email and phone stay in the browser's local storage and appear only in letters they choose to send. The only outside services it contacts are the tracker, Esri's map service for pictures, and a public ZIP lookup for ZIPs outside the bundled states. Details in [PRIVACY.md](PRIVACY.md).

## Found a wrong name?

Officials change after every election and appointment. Check the official site linked on the card, then open an issue naming the jurisdiction and the page you checked, so the next build can fix it.

## Credits

Created by student volunteers of CU Amnesty International. Project data from the Data Center Tracker (trackdatacenters.com), read live. Officials and portraits from government websites. ZIP locations from GeoNames (CC BY 4.0). Imagery © Esri, Maxar, Earthstar Geographics.

Datawriter is not affiliated with trackdatacenters.com or any government body it lists, and it does not speak for Amnesty International as a whole. Free to use and share; a formal license is still to be chosen by the chapter.
