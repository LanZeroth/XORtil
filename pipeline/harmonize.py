"""FireCal harmonization pipeline: MODIS (2000-) + VIIRS (2012-) -> one consistent burning-activity record.

Method (see docs/METHOD.md for details):
  1. Quality filter: MODIS confidence >= 30, VIIRS confidence in {nominal, high}, vegetation fires only (type 0).
  2. Common unit: the "active fire cell-day" (AFCD), meaning a 0.1 deg grid cell with >= 1 detection on a UTC day.
     It is much less sensitive to pixel size (1 km vs 375 m) than raw detection counts.
  3. Terra-only gap (Nov 2000 - Jun 2002): scale by the Terra+Aqua / Terra ratio per calendar month (fit 2003-2011).
  4. VIIRS -> MODIS-equivalent: per 1 deg tile ratio  k = MODIS AFCD / VIIRS AFCD  (fit 2012-2021, shrunk
     toward the national ratio), applied at cell-day level.
  5. Harmonized AFCD = MODIS (pre-VIIRS), the mean of MODIS and calibrated VIIRS (overlap), or calibrated VIIRS (no MODIS).
  6. Validation on held-out years 2022-2025.

Part of FireCal (team XORTil, NASA Space Apps 2026). Code written with AI assistance (Claude Code).
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import shapely
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "web" / "data"

LAT0, LON0, RES = 4.0, 2.5, 0.1     # 0.1 deg analysis grid
NROW, NCOL = 100, 125               # 4.0-14.0 N, 2.5-15.0 E
TILE = 5                            # 0.5 deg tiles = 5x5 cells (AOI building blocks)
CAL = 10                            # 1 deg calibration tiles = 10x10 cells
EPOCH = date(2000, 11, 1)
AQUA_START = pd.Timestamp("2002-07-04")
VIIRS_START = pd.Timestamp("2012-01-20")
TRAIN = (2012, 2021)
TEST = (2022, 2025)
BASELINE = (2003, 2022)
SHRINK_N0 = 200.0                   # pseudo-count (VIIRS AFCD) for shrinkage toward national ratio

COLS = ["latitude", "longitude", "acq_date", "satellite", "confidence", "frp", "type"]


# ----------------------------------------------------------------------------- loading
def load_country() -> tuple[shapely.Geometry, list[dict]]:
    adm0 = json.loads((RAW / "nga_adm0.geojson").read_text(encoding="utf-8"))
    nga = shapely.union_all([shape(f["geometry"]) for f in adm0["features"]])
    adm1 = json.loads((RAW / "nga_adm1.geojson").read_text(encoding="utf-8"))
    return nga, adm1["features"]


def read_firms(path: Path, sensor: str) -> pd.DataFrame:
    df = pd.read_csv(path, usecols=lambda c: c in COLS, dtype={"confidence": str})
    if df.empty:
        return df
    if "type" in df:
        df = df[df["type"].fillna(0).astype(int) == 0]
    if sensor == "modis":
        df = df[pd.to_numeric(df["confidence"], errors="coerce") >= 30]
        df["sensor"] = np.where(df["satellite"].str.startswith("A"), "aqua", "terra")
    else:
        df = df[df["confidence"].str.lower().str[0].isin(["n", "h"])]
        sat = df["satellite"].astype(str).str.upper()
        df["sensor"] = np.select([sat.isin(["N", "NPP", "SUOMI NPP"]), sat.isin(["1", "N20", "NOAA-20", "J1"])],
                                 ["snpp", "noaa20"], "noaa21")
    df["date"] = pd.to_datetime(df["acq_date"])
    return df[["latitude", "longitude", "date", "sensor", "frp"]]


def load_all(nga) -> pd.DataFrame:
    parts = []
    for p in sorted(RAW.glob("modis_20*_Nigeria.csv")):
        parts.append(read_firms(p, "modis"))
    for p in sorted(RAW.glob("viirs-snpp_20*_Nigeria.csv")):
        parts.append(read_firms(p, "viirs"))
    df = pd.concat(parts, ignore_index=True)
    last_archive = df["date"].max()

    # near-real-time (global) files: clip to Nigeria, keep only days after the archive
    minx, miny, maxx, maxy = nga.bounds
    nrt = []
    for name, sensor in [("modis_nrt_7d.csv", "modis"), ("viirs_snpp_nrt_7d.csv", "viirs"),
                         ("viirs_noaa20_nrt_7d.csv", "viirs")]:
        p = RAW / name
        if not p.exists() or p.stat().st_size < 200:
            continue
        d = read_firms(p, sensor)
        d = d[d.latitude.between(miny, maxy) & d.longitude.between(minx, maxx)]
        d = d[shapely.contains_xy(nga, d.longitude.values, d.latitude.values)]
        nrt.append(d[d["date"] > last_archive])
    nrt = pd.concat(nrt, ignore_index=True) if nrt else df.iloc[:0]
    return df, nrt, last_archive


# ----------------------------------------------------------------------------- gridding
def add_cells(df: pd.DataFrame) -> pd.DataFrame:
    r = np.floor((df.latitude.values - LAT0) / RES).astype(int).clip(0, NROW - 1)
    c = np.floor((df.longitude.values - LON0) / RES).astype(int).clip(0, NCOL - 1)
    df = df.copy()
    df["cell"] = r * NCOL + c
    df["day"] = (df["date"] - pd.Timestamp(EPOCH)).dt.days
    return df


def cell_days(df: pd.DataFrame) -> pd.DataFrame:
    """Per (cell, day): AFCD flag per sensor family + detection counts and FRP."""
    df = df.assign(fam=np.where(df.sensor.isin(["terra", "aqua"]), "modis", "viirs"))
    g = df.groupby(["cell", "day", "fam"]).agg(n=("frp", "size"), frp=("frp", "sum")).unstack("fam", fill_value=0)
    g.columns = [f"{a}_{b}" for a, b in g.columns]
    for c in ["n_modis", "n_viirs", "frp_modis", "frp_viirs"]:
        if c not in g:
            g[c] = 0.0
    g = g.reset_index()
    g["m"] = (g.n_modis > 0).astype(float)
    g["v"] = (g.n_viirs > 0).astype(float)
    # Terra-only flag for the pre-Aqua period
    terra = df[df.sensor == "terra"].groupby(["cell", "day"]).size().rename("n_terra")
    g = g.merge(terra, on=["cell", "day"], how="left").fillna({"n_terra": 0})
    g["t"] = (g.n_terra > 0).astype(float)
    g["month"] = (pd.Timestamp(EPOCH) + pd.to_timedelta(g.day, unit="D")).dt.month
    g["year"] = (pd.Timestamp(EPOCH) + pd.to_timedelta(g.day, unit="D")).dt.year
    g["cal"] = (g.cell // NCOL // CAL) * 1000 + (g.cell % NCOL // CAL)
    return g


# ----------------------------------------------------------------------------- harmonization
def fit_terra_ratio(g: pd.DataFrame) -> dict[int, float]:
    s = g[g.year.between(2003, 2011)].groupby("month")[["m", "t"]].sum()
    return {int(k): float(v) for k, v in (s.m / s.t.clip(lower=1)).items()}


def fit_viirs_ratio(g: pd.DataFrame) -> tuple[float, dict[int, float]]:
    tr = g[g.year.between(*TRAIN)]
    k_nat = tr.m.sum() / tr.v.sum()
    s = tr.groupby("cal")[["m", "v"]].sum()
    k_tile = (s.m + SHRINK_N0 * k_nat) / (s.v + SHRINK_N0)
    return float(k_nat), {int(k): float(v) for k, v in k_tile.items()}


def harmonize(g: pd.DataFrame, k_terra, k_nat, k_tile, modis_end_day: int) -> pd.DataFrame:
    date_ = pd.Timestamp(EPOCH) + pd.to_timedelta(g.day, unit="D")
    m_adj = np.where(date_ < AQUA_START, g.t * g.month.map(k_terra).fillna(1.0), g.m)
    v_eq = g.v * g.cal.map(k_tile).fillna(k_nat)
    has_v = date_ >= VIIRS_START
    has_m = g.day <= modis_end_day
    h = np.where(has_v & has_m, 0.5 * (m_adj + v_eq), np.where(has_v, v_eq, m_adj))
    g = g.assign(m_adj=m_adj, v_eq=v_eq, h=h)
    return g


def validate(g: pd.DataFrame) -> dict:
    """Held-out comparison: MODIS vs calibrated VIIRS, monthly AFCD per 1 deg tile and nationally."""
    te = g[g.year.between(*TEST)]
    mt = te.groupby(["cal", "year", "month"])[["m", "v", "v_eq"]].sum()
    mt = mt[(mt.m + mt.v) > 0]
    def stats(a, b):
        r = float(np.corrcoef(a, b)[0, 1]) if len(a) > 2 else float("nan")
        bias = float((b.sum() - a.sum()) / max(a.sum(), 1))
        mae = float(np.mean(np.abs(b - a)))
        if not np.isfinite(r):
            r = 0.0
        return {"r": round(r, 3), "r2": round(r * r, 3), "bias_pct": round(100 * bias, 1), "mae": round(mae, 2), "n": int(len(a))}
    nat = te.groupby(["year", "month"])[["m", "v", "v_eq"]].sum()
    sample = mt.sample(min(len(mt), 1500), random_state=1).reset_index()
    return {
        "test_years": list(TEST),
        "tile_month_raw": stats(mt.m.values, mt.v.values),
        "tile_month_harmonized": stats(mt.m.values, mt.v_eq.values),
        "national_month_raw": stats(nat.m.values, nat.v.values),
        "national_month_harmonized": stats(nat.m.values, nat.v_eq.values),
        "scatter": sample[["m", "v", "v_eq"]].round(1).values.tolist(),
        "national_series": [[f"{y}-{m:02d}", int(r.m), int(r.v), round(float(r.v_eq), 1)]
                            for (y, m), r in nat.iterrows()],
    }


# ----------------------------------------------------------------------------- exports
def cell_states(states: list[dict], nga) -> np.ndarray:
    """State index per 0.1 deg cell (-1 = outside Nigeria; border cells -> nearest state)."""
    geoms = [shape(f["geometry"]) for f in states]
    rr, cc = np.divmod(np.arange(NROW * NCOL), NCOL)
    lat = LAT0 + (rr + 0.5) * RES
    lon = LON0 + (cc + 0.5) * RES
    out = np.full(NROW * NCOL, -1, dtype=int)
    for i, gm in enumerate(geoms):
        out[shapely.contains_xy(gm, lon, lat)] = i
    near = shapely.dwithin(nga, shapely.points(lon, lat), 0.15) & (out < 0)
    tree = shapely.STRtree(geoms)
    idx = np.where(near)[0]
    if len(idx):
        out[idx] = tree.nearest(shapely.points(lon[idx], lat[idx]))
    return out


def series(g: pd.DataFrame, key: str, ndays: int, cols=("h",), decimals=1) -> dict:
    res = {}
    for k, sub in g.groupby(key):
        d = sub.groupby("day")[list(cols)].sum()
        arrs = {}
        for c in cols:
            a = np.zeros(ndays)
            a[d.index.values] = d[c].values
            arrs[c] = a
        res[int(k)] = arrs
    return res


def sparse(a: np.ndarray, decimals=1) -> list:
    nz = np.nonzero(np.round(a, decimals))[0]
    return [[int(i), round(float(a[i]), decimals)] for i in nz]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    nga, states = load_country()
    print("loading FIRMS files ...")
    df, nrt, last_archive = load_all(nga)
    print(f"  archive detections: {len(df):,}  (last {last_archive.date()}),  NRT after archive: {len(nrt):,}")
    full = add_cells(pd.concat([df, nrt], ignore_index=True))
    g = cell_days(full)
    ndays = int(g.day.max()) + 1
    modis_end_day = int(full.loc[full.sensor.isin(["terra", "aqua"]), "day"].max())

    last_arch_day = int((last_archive - pd.Timestamp(EPOCH)).days)
    nrt_first = int(full.loc[full.date > last_archive, "day"].min()) if len(nrt) else None
    missing = [last_arch_day + 1, nrt_first - 1] if nrt_first and nrt_first > last_arch_day + 1 else None

    k_terra = fit_terra_ratio(g)
    k_nat, k_tile = fit_viirs_ratio(g)
    print(f"  VIIRS->MODIS national ratio k = {k_nat:.3f}; tiles: {len(k_tile)}")
    g = harmonize(g, k_terra, k_nat, k_tile, modis_end_day)
    val = validate(g)
    print("  validation (tile-month):", val["tile_month_raw"], "->", val["tile_month_harmonized"])

    cs = cell_states(states, nga)
    g["state"] = cs[g.cell.values]
    g["tile"] = (g.cell // NCOL // TILE) * 100 + (g.cell % NCOL // TILE)

    dates = pd.date_range(EPOCH, periods=ndays, freq="D")
    nat = g.groupby("day")[["h", "m", "v", "m_adj", "v_eq", "n_modis", "n_viirs", "frp_modis", "frp_viirs"]].sum()
    nat = nat.reindex(range(ndays), fill_value=0)

    # 1) national daily
    (OUT / "national.json").write_text(json.dumps({
        "start": str(EPOCH), "ndays": ndays,
        "h": np.round(nat.h.values, 1).tolist(),
        "m": nat.m.astype(int).tolist(), "v": nat.v.astype(int).tolist(),
        "n_modis": nat.n_modis.astype(int).tolist(), "n_viirs": nat.n_viirs.astype(int).tolist(),
        "frp": np.round(nat.frp_modis.values + nat.frp_viirs.values).astype(int).tolist(),
    }, separators=(",", ":")))

    # 2) per-state daily (sparse)
    st = g[g.state >= 0]
    sts = series(st, "state", ndays, cols=("h", "m", "v"))
    (OUT / "states.json").write_text(json.dumps({
        "names": [f["properties"].get("shapeName", f"State {i}") for i, f in enumerate(states)],
        "series": {k: {c: sparse(v[c]) for c in v} for k, v in sts.items()},
    }, separators=(",", ":")))

    # 3) per-0.5-deg-tile daily harmonized (sparse) for custom AOIs
    tls = series(g, "tile", ndays, cols=("h",))
    (OUT / "tiles.json").write_text(json.dumps({
        "lat0": LAT0, "lon0": LON0, "size": RES * TILE,
        "series": {k: sparse(v["h"]) for k, v in tls.items()},
    }, separators=(",", ":")))

    # 4) monthly 0.1-deg grid for the time-lapse animation
    g["ym"] = (g.year - 2000) * 12 + g.month - 1
    mg = g.groupby(["ym", "cell"]).h.sum().reset_index()
    frames = {}
    for ym, sub in mg.groupby("ym"):
        sub = sub[sub.h >= 0.5]
        frames[int(ym)] = np.column_stack([sub.cell.values, np.round(sub.h.values).astype(int)]).ravel().tolist()
    (OUT / "frames.json").write_text(json.dumps({
        "lat0": LAT0, "lon0": LON0, "res": RES, "ncol": NCOL, "frames": frames}, separators=(",", ":")))

    # 5) latest NRT detections as points (the "now" layer)
    recent = full[full.day > ndays - 8]
    (OUT / "recent.geojson").write_text(json.dumps({
        "type": "FeatureCollection",
        "features": [{"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(x, 4), round(y, 4)]},
                      "properties": {"s": s, "d": str(d.date()), "frp": round(float(f), 1)}}
                     for x, y, s, d, f in zip(recent.longitude, recent.latitude, recent.sensor, recent.date, recent.frp)],
    }, separators=(",", ":")))

    # 6) state boundaries (simplified)
    feats = []
    for i, f in enumerate(states):
        geom = shapely.simplify(shape(f["geometry"]), 0.01, preserve_topology=True)
        feats.append({"type": "Feature", "id": i, "properties": {"id": i, "name": f["properties"].get("shapeName")},
                      "geometry": shapely.geometry.mapping(geom)})
    (OUT / "states.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats},
                                                  separators=(",", ":")))

    # 7) meta + validation
    sensor_years = full.assign(y=full.date.dt.year).groupby(["y", "sensor"]).size().unstack(fill_value=0)
    (OUT / "meta.json").write_text(json.dumps({
        "generated": pd.Timestamp.now("UTC").isoformat(timespec="minutes"),
        "start": str(EPOCH), "end": str(dates[-1].date()), "last_archive": str(last_archive.date()),
        "missing": missing,
        "grid": {"lat0": LAT0, "lon0": LON0, "res": RES, "nrow": NROW, "ncol": NCOL, "tile": TILE},
        "baseline": list(BASELINE), "train": list(TRAIN),
        "k_viirs_national": round(k_nat, 4),
        "k_viirs_tiles": {str(k): round(v, 4) for k, v in k_tile.items()},
        "k_terra_month": {str(k): round(v, 4) for k, v in k_terra.items()},
        "validation": val,
        "detections_by_year": {str(y): {s: int(n) for s, n in r.items()} for y, r in sensor_years.iterrows()},
        "totals": {"detections": int(len(full)), "cell_days": int(len(g))},
    }, separators=(",", ":")))

    for p in sorted(OUT.glob("*")):
        print(f"  wrote {p.name:16s} {p.stat().st_size/1e6:6.2f} MB")


if __name__ == "__main__":
    main()
