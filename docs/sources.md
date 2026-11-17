# Comparison sources

Every figure the panel turns into a human-scale comparison has a published source. Values live in `REF` in `extension/finder.js`, `BENCH` in `extension/perspectives.js`, and per state in `extension/states.js` (generated from the chapter's `states.json`). Money comparisons use the low end of a cost range. The panel says, under the cards, that comparisons show scale rather than where the money or land would otherwise go.

## Headline figures

| Reference | Value | Source |
| --- | --- | --- |
| Average U.S. home | 10,791 kWh/year | EIA, 2022 |
| New York City electricity | 53,360 GWh/year | Con Edison Zone J (2018), via NYC Planning environmental reviews |
| Washington, DC electricity | 10,142,915 MWh/year | EIA State Electricity Profile, 2024 |
| Each other state's electricity | `electricityMwh` in `states.js` | EIA State Electricity Profiles, 2024 |
| Population, per state | `population` in `states.js` | Census Bureau Vintage 2025 (July 1, 2025) |
| Football field | 57,600 sq ft | NFL field including end zones (360 × 160 ft) |
| Central Park | 843 acres | NYC Parks |
| Pentagon | 6.5 million sq ft | Pentagon gross floor area |
| Build cost | $8.9M to $23.3M per MW, all-in, excluding servers and chips | Cushman & Wakefield, 2026 Data Center Development Cost Guide |
| Grid CO₂ rate, per state | `co2LbPerMwh` in `states.js` (280 lb/MWh in NH to 1,912 in WV) | EIA State Electricity Profiles, Table 1, 2024 data |
| On-site gas plant CO₂ rate | 800 lb CO₂/MWh | EPA, 40 CFR 60 Subpart TTTTa, standard for new base-load combined-cycle gas turbines |
| Gasoline car | 4.29 t CO₂e/year | EPA Greenhouse Gas Equivalencies (2022 data) |

## "Did you know?" facts

| Fact | Value | Source |
| --- | --- | --- |
| Server useful life | Amazon 5 years (2025), Microsoft 6 (2022), Alphabet 6 (2023), Meta 5.5 (2025) | each company's annual report (Form 10-K) |
| Data center share of U.S. electricity | 4.4% in 2023; 6.7% to 12% by 2028 | Lawrence Berkeley National Laboratory for the U.S. Department of Energy, December 2024 |
| Typical jobs promised | median of the tracker's own records, computed live | trackdatacenters.com |

## Electricity comparisons

| Reference | Value | Source |
| --- | --- | --- |
| K-12 school electricity | 96.4 billion kWh ÷ 49.3M public students; 497 students per school | EIA CBECS 2018; NCES 2024–25 |
| Hospital electricity, admissions, beds | 65 billion kWh ÷ 6,100 hospitals; 35,658,583 admissions; 907,216 staffed beds | EIA CBECS 2018; AHA Fast Facts 2026 |
| Electric car | about 4,000 kWh/year (0.367 kWh/mi × 10,787 mi) | EPA; FHWA 2024 |
| Electric school bus | about 18,000 kWh/year; about 50 riders | EPA Clean School Bus program |
| Drinking water | 2,069 kWh per million gallons; 82 gallons per person per day | EPRI via EPA WaterSense; USGS 2015 |
| Household size | 2.5 people | Census CPS ASEC 2025 |

## Money comparisons

| Reference | Value | Source |
| --- | --- | --- |
| Teacher salary | US $74,495; per state in `states.js` | NEA Rankings & Estimates, 2024–25 |
| Pupils per teacher | US 15.2; per state in `states.js` | NCES, 2023–24 |
| Cost per life saved | $5,500 (Against Malaria Foundation bed nets) | GiveWell, 2026 |
| Public four-year tuition and fees | $11,950/year, in-state | College Board, Trends in College Pricing 2025 |
| Free school lunch | $4.76 per meal × 180 days | USDA, SY 2026–27 reimbursement, contiguous states |
| Lead service line | $7,000 (EPA range $6,507 to $8,519) | EPA, Lead and Copper Rule Improvements economic analysis |
| School spending per pupil | US $17,619; per state in `states.js` | Census Annual Survey of School System Finances, FY2024 |
| Child care | $13,184/year | Child Care Aware of America, 2025 |
| SNAP | $187.91 per person per month | USDA FNS FY2025, via KFF |
| Medicaid | $7,407 per enrollee | KFF, 2023 |
| Pell Grant | $7,395 maximum | U.S. Department of Education, 2026–27 |
| Community health center | $1,672 per patient per year | HRSA Uniform Data System, 2025 |
| Firefighter and paramedic wages | $59,280 and $48,150 median | BLS, May 2025 |
| Household energy bill | $1,728/year ($144/month) | EIA, 2024 |
| Opioid use disorder treatment | $13,982/year (methadone, bundled rate) | CMS, 2025 |

## Land comparisons

| Reference | Value | Source |
| --- | --- | --- |
| Forest CO₂ uptake | 1.0 t per acre per year | EPA Greenhouse Gas Equivalencies (2021–22) |
| Average farm, per state | `farmAcres` in `states.js` | USDA 2022 Census of Agriculture |
| New-home lot | 8,543 sq ft median, less 25% for streets and open space | NAHB from Census Survey of Construction, 2025 |
| Parkland | 10 acres per 1,000 residents (median) | NRPA Agency Performance Review 2026 |
| Solar | 5.6 acres per MWac; 23.2% capacity factor | LBNL (Bolinger & Bolinger 2022); EIA Electric Power Monthly 2024 |
| Wetland | 1 million gallons of floodwater per acre | EPA |
| Reforestation | 436 seedlings per acre (10 × 10 ft spacing) | state forestry guidance |
| High school site | 30 acres + 1 per 100 students, for 1,000 students | CEFPI guideline |
| Garden apartments | 19 units per acre (low end of 19 to 25) | planning references |
| Farmland per person | 2.67 acres on the current U.S. diet | Peters et al., Elementa, 2016 |

## Floor-space comparisons

| Reference | Value | Source |
| --- | --- | --- |
| New single-family home | 2,142 sq ft median, completed 2025 | Census Characteristics of New Housing |
| New rental apartment | 1,000 sq ft median, completed 2025 | Census Characteristics of New Housing |
| School floor space | about 180 sq ft per student, new schools | School Planning & Management |
| Hospital floor space | about 2,500 sq ft per bed, hospitals with 50+ beds | Definitive Healthcare, Medicare cost reports, 2025 |
| Child care | 35 sq ft of indoor space per child | state licensing rules (e.g. Florida Statutes 402.305) |
| Emergency shelter | 37.7 sq ft (3.5 m²) of covered space per person | UNHCR / Sphere standard |

## Other data

| Data | Source |
| --- | --- |
| Projects, sizes, stages, approvals, companies | trackdatacenters.com, read live from its own pages |
| ZIP code centroids (27,473 ZIPs in 34 states and DC) | GeoNames postal codes, CC BY 4.0 |
| Satellite and street imagery | Esri World Imagery and World Street Map (© Esri, Maxar, Earthstar Geographics, HERE, Garmin, OpenStreetMap contributors) |
| Officials, titles, contacts, portraits | government websites, October 2026; see [data.md](data.md) |
