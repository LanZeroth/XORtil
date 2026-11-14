# Harmattan: harmonization method

Team XORTil (Abdullah Shittu) · NASA Space Apps Challenge 2026 · *Harmonization of MODIS and VIIRS Hot Spots*

> Code and this document were drafted with help from an AI coding assistant (Claude Code). The scientific choices below were reviewed and accepted by the team.

## 1. The problem
Active-fire hotspots for Nigeria come from two sensor families:

| Sensor | Satellites | Pixel at nadir | Record used |
|---|---|---|---|
| MODIS C6.1 | Terra (from Nov 2000), Aqua (from Jul 2002) | ~1 km | 2000-11 → present |
| VIIRS 375 m | Suomi NPP (from Jan 2012), NOAA-20 (NRT) | 375 m | 2012-01 → present |

VIIRS detects far more small fires than MODIS. Raw detection counts therefore jump when VIIRS enters the record.
MODIS Terra and Aqua are also near the end of their missions, so any long-term record has to move onto VIIRS.
If nothing is done, that switch looks like a sudden increase in burning that never happened.

## 2. Pipeline (`pipeline/harmonize.py`)
1. **Quality filter.** For MODIS, keep confidence ≥ 30 (nominal + high). For VIIRS, keep confidence `n` or `h` (drop `l`).
   Keep only `type = 0` (presumed vegetation fire), which drops volcanoes, static industrial sources (gas flares in the Niger Delta) and offshore detections.
2. **Common unit: active-fire cell-day (AFCD).** Each detection is mapped to a 0.1° grid cell and its UTC day.
   A cell-day counts as burning if the sensor family has at least one detection there that day.
   This removes most of the pixel-size effect: several 375 m VIIRS pixels inside one fire collapse to a single cell-day.
3. **Terra-only gap (Nov 2000 – Jun 2002).** Before Aqua there was one MODIS overpass per day.
   We scale Terra-only AFCD by the ratio `AFCD(Terra ∪ Aqua) / AFCD(Terra)`, fitted for each calendar month on 2003–2011.
4. **VIIRS → MODIS-equivalent calibration.** For each 1° tile:
   `k_tile = (M_tile + n0 · k_nat) / (V_tile + n0)`, where `M` and `V` are MODIS and VIIRS AFCD over the training years **2012–2021**, `k_nat` is the national ratio, and `n0 = 200` shrinks tiles with little data toward the national value.
   Calibrated VIIRS for a cell-day is `v_eq = v · k_tile`.
5. **Fusion.**
   * Before VIIRS: `h = MODIS (adjusted)`.
   * Overlap: `h = ½ (MODIS + v_eq)`, an average of two independent observing systems that reduces noise from missed overpasses and clouds.
   * VIIRS only (after MODIS ends): `h = v_eq`.
6. **Validation.** The calibration is applied to the held-out years **2022–2025** and compared with MODIS at 1° tile × month and at national × month level.
   We report r², bias and mean absolute error before and after harmonization (shown in the app's *Harmonization* tab and in `web/data/meta.json`).

## 3. Calendar analytics (`web/js/analytics.js`), for any area of interest
* **Fire year (Jul–Jun).** Nigeria's dry-season burning runs from November to March, across New Year, so each season is kept in one row.
* **Climatology.** 15-day smoothed daily harmonized AFCD, with the 10th, 50th and 90th percentiles for each day of the fire year over the 2003–2021 fire years.
* **Critical period.** The continuous window around the climatological peak where mean activity is at least 50% of the peak. We report its dates, length and share of annual burning.
* **Season onset and end.** The days when cumulative climatological burning reaches 10% and 90%.
* **Anomalies.** Fire-year totals and monthly totals as z-scores against the baseline.
* **Early-warning status.** The last 7 days of burning compared with the same 7-day calendar window in each baseline year, giving a percentile.
  The labels are Below normal (< 25th percentile), Normal, Above normal (≥ 75th) and Extreme (≥ 90th), together with whether the area is inside its critical period or how many days remain until it starts.

## 4. Areas of interest
* All of Nigeria, any of its 37 states (geoBoundaries ADM1), or a rectangle drawn on the map, built from 0.5° tiles.

## 5. Known limitations
* AFCD counts how often and how widely fires are detected. It does not measure burned area. Small, short or cloud-covered fires can still be missed by both sensors.
* The archive for the current year is published by FIRMS with a delay. The gap between the last archive date and the most recent 7-day near-real-time window is shown as "no data", not as zero.
* One national calibration family is used. Calibrating separately by land cover (e.g. with a Planetary Computer land-cover layer) and by day/night overpass is the next step.
* The near-real-time window uses NOAA-20 VIIRS (Suomi NPP's NRT feed was empty when we downloaded) with the S-NPP calibration, and NRT processing can differ slightly from the final archive. The early-warning status should be read as indicative.
* NOAA-20 is used only in the near-real-time window. A full NOAA-20/NOAA-21 archive calibration is future work.

## 6. Data and references
* NASA FIRMS, MODIS Collection 6.1 Active Fire product (MCD14ML), Terra and Aqua (cite per the FIRMS citation guidance)
* NASA FIRMS, VIIRS 375 m Active Fire product (VNP14IMGTDL_NRT / VNP14IMGML), Suomi NPP (cite per the FIRMS citation guidance)
* NASA FIRMS, VIIRS 375 m NOAA-20 (VJ114IMGTDL_NRT) (cite per the FIRMS citation guidance)
* NASA GIBS, VIIRS Black Marble night-lights base map.
* geoBoundaries, Nigeria ADM0/ADM1 (Runfola et al. 2020, CC BY 4.0).
* Giglio, L. et al. (2016), *The collection 6 MODIS active fire detection algorithm and fire products*, Remote Sensing of Environment 178.
* Schroeder, W. et al. (2014), *The New VIIRS 375 m active fire detection data product*, Remote Sensing of Environment 143.
* Libraries: MapLibre GL JS (BSD-3), D3 (ISC), pandas, NumPy, Shapely.
