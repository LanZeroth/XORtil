"""Download NASA FIRMS active-fire archives (yearly, per country) plus the latest 7-day NRT files.

Sources (public, no key required):
  https://firms.modaps.eosdis.nasa.gov/data/country/<product>/<year>/<product>_<year>_<Country>.csv
  https://firms.modaps.eosdis.nasa.gov/data/active_fire/<...>/csv/<...>_Global_7d.csv

Part of FireCal (team XORTil, NASA Space Apps 2026). Code written with AI assistance (Claude Code).
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import requests

BASE = "https://firms.modaps.eosdis.nasa.gov/data"
RAW = Path(__file__).resolve().parents[1] / "data" / "raw"

ARCHIVES = {
    "modis": range(2000, 2026),        # Terra from Nov 2000, Aqua from Jul 2002
    "viirs-snpp": range(2012, 2026),   # S-NPP from Jan 2012
}
NRT = {
    "modis_nrt_7d.csv": f"{BASE}/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_7d.csv",
    "viirs_snpp_nrt_7d.csv": f"{BASE}/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_7d.csv",
    "viirs_noaa20_nrt_7d.csv": f"{BASE}/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_7d.csv",
}


def fetch(url: str, dest: Path, force: bool = False) -> None:
    if dest.exists() and dest.stat().st_size > 0 and not force:
        print(f"  skip {dest.name}")
        return
    for attempt in range(4):
        try:
            with requests.get(url, stream=True, timeout=180) as r:
                if r.status_code == 404:
                    print(f"  404  {url}")
                    return
                r.raise_for_status()
                tmp = dest.with_suffix(".part")
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
                tmp.replace(dest)
                print(f"  ok   {dest.name} ({dest.stat().st_size/1e6:.1f} MB)")
                return
        except requests.RequestException as e:
            print(f"  retry {attempt+1} {dest.name}: {e}")
            time.sleep(5 * (attempt + 1))
    print(f"  FAILED {url}", file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--country", default="Nigeria")
    ap.add_argument("--nrt-only", action="store_true")
    args = ap.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)

    print("NRT 7-day files (global):")
    for name, url in NRT.items():
        fetch(url, RAW / name, force=True)
    if args.nrt_only:
        return
    for product, years in ARCHIVES.items():
        print(f"{product} archive for {args.country}:")
        for y in years:
            fname = f"{product}_{y}_{args.country}.csv"
            fetch(f"{BASE}/country/{product}/{y}/{fname}", RAW / fname)


if __name__ == "__main__":
    main()
