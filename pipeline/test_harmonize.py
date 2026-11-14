"""Unit tests for the harmonization steps. Run: python pipeline/test_harmonize.py  (written with AI assistance)."""
import io
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
import harmonize as H  # noqa: E402

MODIS_CSV = """latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight,type
9.01,7.01,320,1,1,2015-01-10,1030,Terra,MODIS,80,6.1,290,20,D,0
9.02,7.02,320,1,1,2015-01-10,1330,Aqua,MODIS,20,6.1,290,5,D,0
5.00,6.00,320,1,1,2015-01-10,1330,Aqua,MODIS,90,6.1,290,50,D,2
"""
VIIRS_CSV = """latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight,type
9.011,7.011,330,.4,.4,2015-01-10,1300,N,VIIRS,n,2,290,3,D,0
9.012,7.013,330,.4,.4,2015-01-10,1300,N,VIIRS,h,2,290,4,D,0
9.013,7.014,330,.4,.4,2015-01-10,1300,N,VIIRS,l,2,290,1,D,0
"""


def _read(text, sensor, tmp):
    p = tmp / f"{sensor}.csv"
    p.write_text(text)
    return H.read_firms(p, sensor)


def test_quality_filters(tmp):
    m = _read(MODIS_CSV, "modis", tmp)
    v = _read(VIIRS_CSV, "viirs", tmp)
    assert len(m) == 1 and m.sensor.iloc[0] == "terra", "low-confidence and static-source MODIS removed"
    assert len(v) == 2 and set(v.sensor) == {"snpp"}, "VIIRS low confidence removed"


def test_cell_day_collapses_pixels(tmp):
    df = pd.concat([_read(MODIS_CSV, "modis", tmp), _read(VIIRS_CSV, "viirs", tmp)])
    g = H.cell_days(H.add_cells(df))
    assert len(g) == 1, "all detections fall in one 0.1 deg cell-day"
    row = g.iloc[0]
    assert row.m == 1 and row.v == 1 and row.n_viirs == 2, "AFCD is binary per sensor family"


def test_calibration_shrinks_to_national():
    g = pd.DataFrame({"year": [2015] * 4, "cal": [1, 1, 2, 2], "m": [1, 1, 1, 0], "v": [1, 1, 1, 1]})
    k_nat, k_tile = H.fit_viirs_ratio(g)
    assert abs(k_nat - 0.75) < 1e-9
    assert min(k_tile.values()) > 0.5 and max(k_tile.values()) < 1.0, "sparse tiles pulled toward national ratio"


def test_fusion_rules():
    g = pd.DataFrame({"day": [100, 5000, 5000], "m": [1.0, 1.0, 0.0], "t": [1.0, 1.0, 0.0], "v": [0.0, 1.0, 1.0],
                      "month": [2, 2, 2], "cal": [1, 1, 1]})
    out = H.harmonize(g, {2: 3.0}, 0.8, {1: 0.8}, modis_end_day=6000)
    assert np.isclose(out.h.iloc[0], 3.0), "Terra-only period scaled"
    assert np.isclose(out.h.iloc[1], 0.5 * (1 + 0.8)), "overlap = mean of MODIS and calibrated VIIRS"
    assert np.isclose(out.h.iloc[2], 0.4)


if __name__ == "__main__":
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        for name, fn in list(globals().items()):
            if name.startswith("test_"):
                fn(tmp) if fn.__code__.co_argcount else fn()
                print("ok", name)
