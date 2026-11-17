# Changelog

The public label (`version_name`) stays "Beta 0.5" across the 0.5.x builds. Wording, data refreshes and fixes bump the last number; a new state or panel feature bumps the middle one; the first non-beta release will be 1.0.

## 0.5.1 · November 17, 2026

- Repository reorganised: the extension lives in `extension/`, the user guide and technical notes in `docs/`, build scripts in `tools/`, packaged zips in `dist/`.
- String catalogs (`tools/i18n/`) and a cross-platform build (`tools/build-i18n.mjs`) that regenerates `i18n.js` and refuses a build when a translation is missing or drops a placeholder.
- Writing pass over the interface in all three languages: shorter notes under the comparisons, the composer and the coverage banners; the "Versions" section of the instructions sheet rebuilt after a find-and-replace had relabelled every release "Beta 0.5".
- Fix: the sticky "Write to the people who decide" bar compared an official's honorific against the English string "Mr./Ms.", so in Spanish and Chinese staff were addressed with a title they do not carry.
- The letter builder and the reminder now share one lookup for the next pending approval on the tracker's record.
- The medians behind the "Did you know?" jobs fact are computed once per download instead of on every render; the send links are rebuilt once per pause while typing in the letter rather than on every keystroke.
- Headless harness (`tools/harness/`) that renders the panel against a stub tracker API.

## 0.5.0 · November 3, 2026

- Three more figures: carbon at full load (the state's grid rate from the registry, or the gas rate for an on-site gas plant), permanent jobs per acre and investment per job, and years from announcement to planned opening.
- "Did you know?" box under the figures with one sourced fact at a time: server depreciation, the tracker's own median job counts, the DOE/LBNL 2024 share of U.S. electricity.
- Water is mentioned in letters only where the tracker records a figure; the water question moved down the questions list.

## 0.4.1 · November 3, 2026

- Red accents for urgency: while a project's stage still allows a decision, the distance figure, the "Start here" box and the starred rows turn red.

## 0.4.0 · November 2, 2026

- Spanish and Simplified Chinese. Every interface string goes through `i18n.js`; the language follows the browser, with a menu in the panel header and the popup to override it.
- Letters to officials stay in English, with a translated copy shown under the letter. The instructions sheet ships in all three languages.

## 0.3.0 · November 2, 2026

- Tone and Detail sliders in the composer, with a Standard stop between Brief and Full.
- Confirmed sends with undo; copy-first for letters too long for a mail link.
- Home ZIP, project-name search, a longer "closest" list, stage-based reminders, and an Attention line for letters routed through a shared mailbox.

## 0.2.3 · November 1, 2026

- Letters returned to the chapter's template: formal address block, stage-aware wording for projects already under construction or running, hedged facts, the next hearing date in the ask.
- Wording and grammar pass over the panel, popup and documents.

## 0.2.2 · October 30, 2026

- About page naming CU Amnesty International as the creator, linked from the popup and the panel footer.
- Plainer interface: text labels and line icons in place of emoji, flat cards, no tinted figure cards; the popup reads its version from the manifest.

## 0.2.1 · October 28, 2026

- Three-step tutorial card on the panel's first open.

## 0.2.0 · October 27, 2026

- Letter flow simplified: sticky "write to the people who decide" bar, tones and lengths, constituency wording, personal line, name guard.
- Outlook and Yahoo send options, copy package, call script and print for phone-only officials, sent tracking with a calendar nudge, plain-comma mailto fix.

## 0.1.1 · October 24, 2026

- Code review: officials and portraits bundled per state, popup loads lazily, accessibility and letter fixes.

## 0.1.0 · October 23, 2026

- First beta.
