# Officials data: how it was collected, how to refresh it, and where the gaps are

The panel's "Who decides" section comes from three generated files per state in `extension/data/`: `leaders/xx.js` (state, county and municipal officials), `photos/xx.js` (their official portraits, 96 px) and the shared `extension/states.js` (the state registry). All three are built from research files that the chapter keeps; the research files and the PowerShell build scripts are **not yet in this repository**. Until they are added, the generated files are the source of truth here and should be edited with care, or not at all.

## What is covered (October 2026)

- **Projects:** every state the tracker covered. East Coast: Pennsylvania (93), New York (21), North Carolina (28), Maryland (14), New Jersey (12), Maine (6), Connecticut (5), Massachusetts (4), Delaware (3), New Hampshire (1), Rhode Island (1). Midwest and South: Ohio (56), Indiana (39), Missouri (31), Michigan (26), Iowa (23), Kentucky (19), Alabama (14), Tennessee (14), West Virginia (12), Mississippi (9), North Dakota (8), Arkansas (7), South Dakota (3), Alaska (2), Hawaii (1).
- **Registered ahead of the tracker:** DC, Virginia, Illinois, Georgia, South Carolina and Florida had no rows in the tracker's API, so their ZIPs land on the nearest covered project; their state officials and comparison figures are in place. Iowa has rows but no tracker page, so the panel says "coming soon" and keeps the national map.
- **State leaders:** all 31 states and DC: governor, lieutenant governor or senate president, utility regulator, environment agency, economic agency, and the siting board where one exists.
- **Counties:** all 67 Pennsylvania counties, all 24 Maryland jurisdictions, DC, and every county with a project in the other states, about 300 in all, including consolidated governments (Indianapolis-Marion County, Louisville Metro, Lexington-Fayette, Metro Nashville, Cuyahoga County, Honolulu). County planning commissions and boards of adjustment where published.
- **Municipalities:** the governing body, planning board and zoning board of the municipality each project sits in, about 310 in all, in every state except Pennsylvania. Connecticut, Massachusetts and Rhode Island have no county governments, so their towns carry the full set; Hawaii has no governments below the county.
- **Emails:** only from official government websites: the research first, then `mailto:` links harvested from the officials' own pages and matched by name (1,114 individuals). Where a person has no published address, the letter goes to their board's or office's mailbox, or opens the office's contact form. 3,005 of 3,174 people are reachable one of those ways; every board has at least a phone number and a mailing address.
- **Portraits:** official portraits from government websites only, reduced to 96 px squares. 1,907 of 1,947 links resolve; the rest show initials.

Where the tracker misspells a place ("Marlon County", "Southhaven", "Carrollton County") the research carries an alias so the lookup still works.

## Data shapes

`leaders/xx.js` exports `AS_OF`, `STATE`, `COUNTIES` and `MUNIS`.

- `STATE`: `{ leaders: [person], note, contact, contactNote }`.
- `COUNTIES["Name County"]`: `{ seat, website, leadershipPage, governmentType, leaders: [person], bodies: [board], staff: [person], contact, confidence, note }`.
- `MUNIS["County|Town"]`: `{ municipality, type, website, bodies: [board], staff: [person], contact, confidence, note }`.
- `person`: `{ name, title, party?, email?, url?, photo?, role? }`. `photo` is an id into `photos/xx.js`.
- `board`: `{ name, role: 'governing'|'planning'|'zoning'|'staff', url?, email?, form?, phone?, address?, social?, members: [person] }`.
- `contact`: `{ email?, form?, phone?, address?, label?, social? }`, the office's own channels, used when a board or person has none.
- `confidence`: anything but `"high"` makes the panel show "check the official website".

`states.js` carries one record per state: name, postal code, demonym, tracker page slug, whether counties have a zoning role, which city's electricity to compare against, population, teacher salary, pupils per teacher, spending per pupil, average farm size, grid CO₂ rate and year, the "who decides" tip (with `{here}` for the project's town), the directory link and the election note.

## Refreshing

The chapter's pipeline, to be committed under `tools/` once the research files are reviewed for publication:

```
states.json           the state registry → build-states.ps1 → extension/states.js
list-projects.ps1     what the tracker has: counts per state, or one state's counties, towns and projects
build-zips.ps1        GeoNames postal codes → extension/data/zips.js
research/*.json       raw research, one file per batch, with sources and confidence
scan-emails.ps1       harvests mailto: links from every known official page
build-leaders.ps1     research + scan → extension/data/leaders/xx.js + a photo manifest
build-photos.ps1      manifest → downloads, 96 px squares → extension/data/photos/xx.js
```

A later research file for the same jurisdiction merges with, rather than replaces, an earlier one. Some sites block scripted fetching (St. Louis County, Kansas City, Joplin, Maryville, Peculiar, Platte County, and about 230 portrait hosts); those were read once in a browser and cached.

**Dates to watch.** Maryland, North Carolina and New Jersey county boards change in December 2026 after the November 3 election. Missouri commissions change in January 2027. Governors elected on November 3, 2026 in Illinois, Connecticut, Maine, Massachusetts, Rhode Island, New Hampshire, Georgia, South Carolina, Florida, Ohio, Michigan, Iowa, Alabama, Tennessee, South Dakota, Alaska, Hawaii and Arkansas take office in January 2027, and agency heads usually change with them. Kentucky's fiscal courts, and county boards in North Dakota, Arkansas, South Dakota, Indiana, Michigan and most of Ohio, reorganise in January 2027. Pennsylvania boards and New York councils reorganise each January. DC gets a new mayor in January 2027. Connecticut towns vote in November 2027.

## Known gaps (October 2026)

Research ran against a per-session web-search cap, so some batches worked from official websites only. Where a site blocked automated reading, the record is marked low confidence and the panel says so.

- **Pennsylvania:** the 76 townships and boroughs with projects are not yet researched; county and state officials are.
- **Sites that blocked reading:** Greensboro, Statesville, Matthews, Buffalo and Tonawanda boards; Holyoke's council (taken from search summaries); Nottingham, NH (CivicPlus outage; low confidence); Rhode Island's state sites (no portraits); Dundee Township, Ypsilanti Township and Kent County, MI; Mingo County, WV; Hinds and Madison counties, MS; Stanton, ND; Mount Vernon, AL; Hawesville, KY. Those records hold contact details but no names.
- **Rosters published only in agendas or PDFs:** St. Louis County and Kansas City planning and zoning bodies; Indianapolis, Memphis, Louisville, Nashville, Lexington, Auburn, Montgomery, Southaven, Davenport, Dubuque and others. Those bodies carry the office mailbox and no members.
- **Thin or missing:** Baltimore County, Charles County and Westmoreland County planning bodies; Brookhaven (Upton/Yaphank) boards; Montgomery County, MO (unreachable); Buchanan and Camden counties, MO; Delaware City (site did not resolve); Lewiston, Sanford and Wiscasset boards of appeals; Limestone, ME (bare list of names); Alaska's legislature and Mississippi's Senate leadership (bot checks or PDFs).
- **Contact forms instead of emails:** Franklin County, OH; Lake County, IN; Kalamazoo County; Scott and Pottawattamie counties, IA; Columbiana and Childersburg, AL; Louisville Metro. The panel offers the form, phone and address.
- **No email route at all:** three boards, in Monroe County (PA), Stokes County (NC) and Joplin (MO).
- **Portraits missing:** Stokes County and Mansfield Township (dead links); East Greenwich Township and New Florence (Google Sites refuses direct loads); Clinton County, IN (404); Sheridan, AR; one each for Oakland County, Cleveland County, Nodaway County, Carrollton, KY, and the Alabama, Indiana and West Virginia state pages. Georgia's economic development agency and New Hampshire's business agency sit on non-.gov domains, so those two commissioners have no portrait or email.
- **Comparison figures:** teacher salary and farm size are not filled for Iowa, Tennessee, West Virginia, Mississippi, North Dakota, Arkansas, South Dakota, Alaska and Hawaii, so those comparisons use the U.S. average.

Names that appeared only in search snippets were left out rather than guessed. Party labels appear only where a source states them.
