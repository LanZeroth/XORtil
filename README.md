# Harmattan: a 25-year burning calendar from MODIS + VIIRS

**Team XORTil** (Abdullah Shittu) · NASA Space Apps Challenge 2026 · Local Event: Lagos, Nigeria
**Challenge:** Harmonization of MODIS and VIIRS Hot Spots

Harmattan merges NASA's two active-fire records, MODIS (2000–) and VIIRS (2012–), into one consistent record of burning activity for Nigeria.
It then turns that record into an interactive **burning activity calendar**. Emergency responders, scientists and land managers can pick any state or draw an area and see:

- **Fire clock:** a spiral with one turn per year, showing every day since November 2000.
- **Calendar:** a year × day heat grid, using fire years (Jul–Jun) or calendar years.
- **Seasons:** what is normal for each day of the year, the **critical period**, the typical peak date, and the season's start and end.
- **Anomalies:** unusual fire years and months.
- **Early warning:** the last 7 days compared with the same week in 20 baseline years, labelled Below normal / Normal / Above normal / Extreme.
- **Harmonization proof:** before/after agreement between the sensors on held-out years.
- **Time-lapse map:** 300+ months of burning on a NASA Black Marble globe, plus the latest near-real-time detections.

## Run it

```bash
python -m venv .venv
.venv/Scripts/pip install pandas numpy requests shapely   # (Linux/macOS: .venv/bin/pip)
.venv/Scripts/python pipeline/download.py      # ~600 MB of FIRMS CSVs into data/raw (no API key needed)
.venv/Scripts/python pipeline/harmonize.py     # writes web/data/*.json (~12 MB)
python -m http.server 8000 -d web              # open http://localhost:8000
```

`web/` is a static site with no backend, so it can be hosted on GitHub Pages, Azure Static Web Apps or any static host.
To refresh the near-real-time layer, run `download.py --nrt-only` and then `harmonize.py`.

## Structure
```
pipeline/download.py    FIRMS yearly country archives + global 7-day NRT files
pipeline/harmonize.py   quality filter → 0.1° cell-days → Terra-gap fix → VIIRS→MODIS calibration → fusion → validation → web JSON
web/                    static app (MapLibre GL globe + D3), js/analytics.js holds all calendar logic
docs/METHOD.md          the harmonization method and its limitations
docs/SUBMISSION.md      drafts for the Space Apps project form
docs/DEMO.md            7-slide deck outline and 30-second video script
```

## Data
NASA FIRMS active-fire hotspots: MODIS C6.1 (Terra, Aqua) and VIIRS 375 m (Suomi NPP, NOAA-20). The base map is NASA GIBS VIIRS Black Marble, and the boundaries come from geoBoundaries (CC BY 4.0). See `docs/METHOD.md` for the full method and references.

## AI disclosure
The code and documentation in this repository were written with the help of an AI coding assistant (Claude Code).
The challenge choice, the solution idea and the review of all scientific choices are the team's own.
