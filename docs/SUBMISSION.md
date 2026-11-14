# Space Apps project form: drafts (team XORTil)

Edit these in your own words before pasting. The judges read this page more than anything else.

---

## Project Name
**Harmattan: a 25-year burning calendar from MODIS + VIIRS**

## High-Level Project Summary
Harmattan is a web application that turns NASA's two active-fire records, MODIS (2000–) and VIIRS (2012–), into one consistent record.
It presents that record as an interactive burning activity calendar for Nigeria, for the whole country, any of its 37 states, or an area the user draws.
VIIRS detects far more small fires than MODIS, so the raw records cannot be compared: on held-out years, raw VIIRS overstates MODIS-scale burning by **+274%**.
We harmonized them using a common unit (0.1° active-fire cell-days), a correction for the early Terra-only years, and a per-tile VIIRS-to-MODIS calibration.
On held-out data from 2022–2025 this cuts the bias to **+3.6%** and raises agreement to **r² = 0.94**.
On top of this 26-year record, Harmattan shows when burning normally peaks, the **critical period** for each area, how unusual each season and month was, and whether the **last 7 days** are below normal, normal, above normal or extreme for the time of year.
It gives emergency responders, land managers and scientists in Nigeria a consistent picture of when and where burning happens, and the method works for any country FIRMS covers.

## Link to Project Demo
*(YouTube unlisted link to the 30-second video, or a public Google Slides link. See DEMO.md.)*

## Link to Final Project
*(GitHub Pages link to the live app, plus the GitHub repository.)*

## Detailed Project Description
**What it does**
- **Fire clock:** a spiral with one turn per year, showing every day from November 2000 to today. January is at the top, so the dry-season burning shows as a bright arc that repeats every year, and unusual years stand out.
- **Burning activity calendar:** a year × day heat grid. The "fire year" mode (July–June) keeps each dry season in one row, because Nigeria's season crosses New Year.
- **Seasons and critical periods:** the normal range for each day (10th–90th percentile over 2003–2022) and the median, compared with any chosen season. The critical period is detected automatically. For all of Nigeria it runs from **14 Dec to 13 Feb**, peaks around **11 Jan**, and holds **66% of yearly burning**; each state has its own window.
- **Anomalies:** z-scores for each fire year and each month. They show, for example, that Nigeria's burning in the 2019/20–2024/25 seasons averaged about **27% less** than in 2003/04–2007/08, consistent with the decline in savanna fire reported across Africa.
- **Early warning:** the last 7 days of near-real-time detections compared with the same week in 20 baseline years, as a percentile and a status, plus the number of days until the critical period starts.
- **Time-lapse map:** 300+ months of harmonized burning on a NASA Black Marble globe, with the last 7 days of detections pulsing on top.
- **Harmonization proof:** before/after bias, error and r², a national monthly comparison, a scatter plot per tile, and a sensor coverage timeline.

**How it works**
1. We download NASA FIRMS yearly country archives (MODIS C6.1 and VIIRS S-NPP 375 m) and the global 7-day near-real-time files, 6.3 million detections in total.
2. We keep only quality vegetation fires: MODIS confidence ≥ 30, VIIRS nominal or high, and `type = 0`, which removes gas flares and other static sources.
3. Every detection is mapped to a 0.1° cell-day, our common unit. This removes most of the 1 km vs 375 m pixel-size difference.
4. The Terra-only period (2000–2002) is scaled by monthly Terra+Aqua/Terra ratios fitted on 2003–2011.
5. VIIRS is calibrated to the MODIS scale for each 1° tile, fitted on 2012–2021 and shrunk toward the national ratio where data is sparse.
6. Where both sensors exist they are fused; after MODIS ends, calibrated VIIRS continues the record.
7. The calibration is validated on the held-out years 2022–2025.
8. The output is about 14 MB of JSON served by a static site (MapLibre GL + D3), with no server needed. The site runs on phones too.

**Benefits:** a single consistent record that will continue after MODIS retires; critical periods for each state to plan fire patrols, firebreaks and awareness campaigns; anomaly context for scientists; and a simple status that a non-specialist can act on.

**Tools:** Python (pandas, NumPy, Shapely), JavaScript (MapLibre GL JS, D3), NASA GIBS map tiles, GitHub Pages.

## Use of Super Intelligence (SI)
Yes. We used an AI coding assistant (Claude Code) to help write the data pipeline, the web application code and drafts of the documentation.
The challenge choice, the solution concept (a harmonized burning calendar for Nigeria with critical periods and early warning) and the review of every scientific choice were done by the team.
This is stated in the app footer and in the README. No AI-generated images are used in the project.

## NASA Data
- **FIRMS MODIS Collection 6.1 active fire product** (Terra and Aqua), yearly country archive for Nigeria 2000–2025, plus near-real-time data for the last 7 days.
- **FIRMS VIIRS 375 m active fire product**, Suomi NPP, yearly country archive 2012–2025, plus near-real-time NOAA-20 data for the last 7 days.
- **NASA GIBS VIIRS Black Marble** night-lights imagery, used as the base map.

## Space Agency Partner Data and Other References
- geoBoundaries, Nigeria ADM0/ADM1 boundaries (Runfola et al. 2020, CC BY 4.0).
- Giglio et al. (2016), *The collection 6 MODIS active fire detection algorithm and fire products*, RSE 178.
- Schroeder et al. (2014), *The New VIIRS 375 m active fire detection data product*, RSE 143.
- Andela et al. (2017), *A human-driven decline in global burned area*, Science 356.
- Open-source libraries: MapLibre GL JS (BSD-3), D3.js (ISC), pandas, NumPy, Shapely, Playwright (used for testing). Fonts: Space Grotesk and Inter (Google Fonts, OFL).
- No Space Agency Partner datasets were used in this version. NiSA (Nigeria's National Space Research and Development Agency) ground-truth data would be a natural next step.
