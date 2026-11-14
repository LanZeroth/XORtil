# Project demo: Harmattan (team XORTil)

The rules allow **either** a 30-second video **or** up to 7 slides; projects that go over these limits are not eligible for global judging.
Recommendation: make the **30-second screen-recorded video**, because the animations are the strongest selling point. Keep the slides as a backup.
Any AI-generated image or video must carry a visible "AI-generated" watermark. A screen recording of the app is not AI-generated.

## 30-second video script (screen recording + voice-over, English subtitles)

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:02 | Intro screen: the HARMATTAN title rising out of the embers | "I'm Abdullah Shittu, team XORTil." |
| 0:02–0:05 | Spinning Black Marble globe | "Satellites have watched fires for 25 years, but MODIS and VIIRS can't be compared directly." |
| 0:05–0:10 | Click **Enter**; the globe flies into Nigeria | "Harmattan merges them into one burning calendar." |
| 0:10–0:20 | Time-lapse playing over the map, then the spiral fire clock drawing itself, then the Seasons tab showing the critical period | "Pick any state or draw an area. See when burning peaks, how this season compares, and whether today is normal or extreme, all from NASA FIRMS data." |
| 0:20–0:30 | Harmonization tab (before/after bias), then back to the red "Extreme" status pill | "For Nigeria's emergency managers and farmers, this is an early warning built from 25 years of space data, and it extends to any country on Earth." |

**How to record:** use Windows key + Alt + R (Xbox Game Bar), or OBS. Record the browser full-screen at 1920×1080, then trim to 30 seconds or less in Clipchamp, which comes with Windows.
Add English subtitles and upload to YouTube as *Unlisted* (not Private), so judges can open it without logging in.

## 7-slide backup deck
1. **Title.** Harmattan: a 25-year burning calendar from MODIS + VIIRS. Team XORTil, Abdullah Shittu, NASA Space Apps 2026, Lagos.
2. **The challenge.** *Harmonization of MODIS and VIIRS Hot Spots.* The fire record is split between sensors that see fire differently, and VIIRS detects far more small fires than MODIS.
3. **The problem in one picture.** Raw detections per year jump when VIIRS arrives in 2012 (from the Harmonization tab).
4. **Our method.** Quality filter, then 0.1° active-fire cell-days, then a fix for the Terra-only gap, then VIIRS-to-MODIS calibration per 1° tile, then fusion, then held-out validation (bias before and after).
5. **The product.** Screenshots of the fire clock, calendar, seasons and critical period, anomalies, and the time-lapse map.
6. **Who it helps.** Emergency responders (the early-warning status), land managers (critical periods by state), scientists (a consistent 25-year record). Built only from NASA open data.
7. **What's next.** Expand to all of Africa and the world, add SMS alerts in local languages, calibrate by land cover, and add NOAA-21. Link to the live app and the repo.
