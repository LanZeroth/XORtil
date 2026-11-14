// Harmattan: main app (map, AOI, time-lapse, intro). Team XORTil, NASA Space Apps 2026.
// Written with AI assistance (Claude Code).
import { Timeline, densify, addInto, climatology, criticalPeriod, fdoyLabel, annualAnomalies, monthlyAnomalies, nowStatus, monthlyTotals, MONTHS } from "./analytics.js";
import { Spiral, calendarGrid, seasonChart, annualChart, monthGrid, valCards, valSeries, valScatter, sensorTimeline, sparkline } from "./charts.js";

const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString("en-US");
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png";
const NIGERIA = { center: [8.6, 9.2], zoom: 5.3 };

const state = { aoi: "nga", h: null, frame: 0, playing: false, yearMode: "fire", tab: "calendar" };
let D = {}, tl, map, spiral, setSparkCursor = () => {};

/* ------------------------------------------------------------------ embers (intro) */
(function embers() {
  const c = $("#embers"), ctx = c.getContext("2d");
  let W, H, parts = [];
  const resize = () => { W = c.width = innerWidth; H = c.height = innerHeight; };
  resize(); addEventListener("resize", resize);
  const spawn = () => ({ x: Math.random() * W, y: H + 10, r: Math.random() * 2.2 + .6, vy: -(Math.random() * 1.1 + .4), vx: (Math.random() - .5) * .6, life: 0, max: 220 + Math.random() * 260, ph: Math.random() * 6 });
  for (let i = 0; i < 90; i++) { const p = spawn(); p.y = Math.random() * H; parts.push(p); }
  const tick = () => {
    if ($("#intro").classList.contains("gone")) return;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    for (const p of parts) {
      p.life++; p.x += p.vx + Math.sin((p.life + p.ph * 50) / 40) * .35; p.y += p.vy;
      const a = Math.max(0, 1 - p.life / p.max) * (0.6 + 0.4 * Math.sin(p.life / 6 + p.ph));
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
      g.addColorStop(0, `rgba(255,220,150,${a})`); g.addColorStop(.35, `rgba(255,120,30,${a * .6})`); g.addColorStop(1, "rgba(255,60,20,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2); ctx.fill();
      if (p.life > p.max || p.y < -20) Object.assign(p, spawn());
    }
    requestAnimationFrame(tick);
  };
  tick();
})();

/* ------------------------------------------------------------------ data */
async function load() {
  const get = f => fetch(`data/${f}`).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
  const [meta, national, states, tiles, frames, recent, statesGeo] = await Promise.all(
    ["meta.json", "national.json", "states.json", "tiles.json", "frames.json", "recent.geojson", "states.geojson"].map(get));
  D = { meta, national, states, tiles, frames, recent, statesGeo };
  tl = new Timeline(national.start, national.ndays, meta.missing);
}

/* ------------------------------------------------------------------ map */
function initMap() {
  map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      projection: { type: "globe" },
      sky: { "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 0.6, 7, 0] },
      sources: { bm: { type: "raster", tiles: [GIBS], tileSize: 256, maxzoom: 8, attribution: "NASA GIBS · VIIRS Black Marble · FIRMS" } },
      layers: [{ id: "bg", type: "background", paint: { "background-color": "#020306" } }, { id: "bm", type: "raster", source: "bm", paint: { "raster-brightness-max": 0.85 } }],
    },
    center: [20, 8], zoom: 1.5, attributionControl: { compact: true }, maxZoom: 10,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  return new Promise(res => map.on("load", res));
}

function spinGlobe() {
  let last = performance.now();
  const step = now => {
    if (!state.spinning) return;
    const c = map.getCenter(); c.lng += (now - last) * 0.006; last = now;
    map.jumpTo({ center: c }); requestAnimationFrame(step);
  };
  state.spinning = true; requestAnimationFrame(step);
}

function addLayers() {
  map.addSource("states", { type: "geojson", data: D.statesGeo });
  map.addLayer({ id: "states-fill", type: "fill", source: "states", paint: { "fill-color": "#ff7a1a", "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.08, 0] } });
  map.addLayer({ id: "states-line", type: "line", source: "states", paint: { "line-color": "rgba(255,255,255,0.18)", "line-width": 0.7 } });

  map.addSource("frame", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: "frame-heat", type: "heatmap", source: "frame",
    paint: {
      "heatmap-weight": ["interpolate", ["linear"], ["get", "v"], 0, 0, 2, 0.35, 12, 1],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.9, 6, 0.6, 9, 0.35],
      "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 3, 3, 5, 8, 7, 18, 9, 40],
      "heatmap-opacity": 0.92,
      "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.08, "rgba(92,20,8,0.55)", 0.25, "#b8240c", 0.45, "#ff4a1c", 0.65, "#ff8a1f", 0.85, "#ffc857", 1, "#fff4d6"],
    },
  });

  map.addSource("recent", { type: "geojson", data: D.recent });
  map.addLayer({ id: "recent-glow", type: "circle", source: "recent", paint: { "circle-radius": 6, "circle-color": "#ffb347", "circle-blur": 1, "circle-opacity": 0.5 } });
  map.addLayer({ id: "recent-core", type: "circle", source: "recent", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.4, 9, 3.5], "circle-color": ["match", ["get", "s"], ["terra", "aqua"], "#ffe08a", "#fff6e0"] } });

  map.addSource("aoi", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "aoi-line", type: "line", source: "aoi", paint: { "line-color": "#ffc857", "line-width": 2, "line-dasharray": [2, 1] } });

  // pulse the "now" layer
  const pulse = () => {
    const t = performance.now() / 1000;
    map.setPaintProperty("recent-glow", "circle-radius", 5 + 4 * (0.5 + 0.5 * Math.sin(t * 3)));
    map.setPaintProperty("recent-glow", "circle-opacity", 0.25 + 0.35 * (0.5 + 0.5 * Math.cos(t * 3)));
    setTimeout(() => requestAnimationFrame(pulse), 60);
  };
  pulse();

  // hover + click states
  let hov = null;
  map.on("mousemove", "states-fill", e => {
    if (state.drawing) return;
    if (hov !== null) map.setFeatureState({ source: "states", id: hov }, { hover: false });
    hov = e.features[0].id; map.setFeatureState({ source: "states", id: hov }, { hover: true });
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "states-fill", () => { if (hov !== null) map.setFeatureState({ source: "states", id: hov }, { hover: false }); hov = null; map.getCanvas().style.cursor = ""; });
  map.on("click", "states-fill", e => { if (!state.drawing) selectAOI(String(e.features[0].id)); });
  map.on("click", "recent-core", e => {
    const p = e.features[0].properties;
    new maplibregl.Popup({ closeButton: false }).setLngLat(e.lngLat)
      .setHTML(`<b>${p.s === "terra" || p.s === "aqua" ? "MODIS " + p.s : "VIIRS " + p.s.toUpperCase()}</b><br>${p.d}<br>FRP ${p.frp} MW`).addTo(map);
  });
}

/* ------------------------------------------------------------------ time-lapse */
function frameRange() {
  const keys = Object.keys(D.frames.frames).map(Number);
  return [Math.min(...keys), Math.max(...keys)];
}
function showFrame(ym) {
  state.frame = ym;
  const { lat0, lon0, res, ncol } = D.frames;
  const arr = D.frames.frames[ym] || [];
  const feats = [];
  for (let j = 0; j < arr.length; j += 2) {
    const cell = arr[j], r = Math.floor(cell / ncol), c = cell % ncol;
    feats.push({ type: "Feature", properties: { v: arr[j + 1] }, geometry: { type: "Point", coordinates: [lon0 + (c + .5) * res, lat0 + (r + .5) * res] } });
  }
  map.getSource("frame").setData({ type: "FeatureCollection", features: feats });
  const y = 2000 + Math.floor(ym / 12), m = ym % 12;
  $("#frameLabel").textContent = `${MONTHS[m]} ${y}`;
  const i = tl.index(y, m, 15);
  const tot = state.monthly.get(ym);
  $("#frameStat").textContent = tl.isMissing(i) ? "archive not yet published, see last-7-days layer" : `${fmt(tot || 0)} active-fire cell-days in ${state.aoiName}`;
  $("#frameSlider").value = ym;
  setSparkCursor(ym - +$("#frameSlider").min);
}
function play(on) {
  state.playing = on; $("#playBtn").textContent = on ? "❚❚" : "▶";
  $("#playBtn").setAttribute("aria-label", on ? "Pause time-lapse" : "Play time-lapse");
  if (!on) return;
  const [a, b] = frameRange();
  let last = 0;
  const step = now => {
    if (!state.playing) return;
    if (now - last > 140) { last = now; showFrame(state.frame >= b ? a : state.frame + 1); }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function jumpToDay(i) {
  play(false);
  showFrame((tl.year[i] - 2000) * 12 + tl.month[i]);
}

/* ------------------------------------------------------------------ AOI */
function bboxOf(geom) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const walk = c => typeof c[0] === "number" ? (x0 = Math.min(x0, c[0]), x1 = Math.max(x1, c[0]), y0 = Math.min(y0, c[1]), y1 = Math.max(y1, c[1])) : c.forEach(walk);
  walk(geom.coordinates); return [[x0, y0], [x1, y1]];
}
function selectAOI(key, box, fly = true) {
  state.aoi = key;
  let h, name;
  if (key === "nga") { h = Float32Array.from(D.national.h); name = "Nigeria"; map.getSource("aoi").setData({ type: "FeatureCollection", features: [] }); if (fly) map.flyTo({ ...NIGERIA, duration: 1500 }); }
  else if (key === "box") {
    const { lat0, lon0, size, series } = D.tiles;
    h = new Float32Array(tl.n);
    const [[x0, y0], [x1, y1]] = box;
    for (const id in series) {
      const tr = Math.floor(id / 100), tc = id % 100;
      const la = lat0 + tr * size, lo = lon0 + tc * size;
      if (la + size > y0 && la < y1 && lo + size > x0 && lo < x1) addInto(h, series[id]);
    }
    name = "Custom area";
    map.getSource("aoi").setData({ type: "Feature", geometry: { type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] } });
    map.fitBounds(box, { padding: 80, duration: 1200 });
  } else {
    const s = D.states.series[key];
    h = s ? densify(s.h, tl.n) : new Float32Array(tl.n);
    name = D.states.names[+key];
    const f = D.statesGeo.features.find(f => String(f.id) === key);
    map.getSource("aoi").setData(f);
    map.fitBounds(bboxOf(f.geometry), { padding: 60, duration: 1400 });
  }
  for (let i = 0; i < tl.n; i++) if (tl.isMissing(i)) h[i] = 0;
  state.h = h; state.aoiName = name;
  $("#aoiSelect").value = key === "box" ? "box" : key;
  refresh();
}

function refresh() {
  const { h } = state;
  const clim = climatology(h, tl, D.meta.baseline_fy || [2003, 2021]);
  const crit = criticalPeriod(clim);
  state.clim = clim; state.crit = crit;
  state.monthly = monthlyTotals(h, tl);

  // now status
  const ns = nowStatus(h, tl, crit);
  const pill = $("#nowPill");
  pill.className = `now-pill ${ns.level}`;
  pill.innerHTML = `Last 7 days to ${tl.fmt(ns.end)}: <span class="lvl">${ns.label}</span> · ${Math.round(ns.pct)}th pct · ` +
    (ns.inCrit ? "<b>inside critical period</b>" : `critical period in ${ns.daysToCrit} days`);

  // season cards + trend
  const an = annualAnomalies(h, tl);
  const comp = an.rows.filter(r => r.complete && r.fy >= 2003);
  const xs = comp.map(r => r.fy), ys = comp.map(r => r.total);
  const mx = d3.mean(xs), my = d3.mean(ys);
  const slope = d3.sum(xs.map((x, j) => (x - mx) * (ys[j] - my))) / d3.sum(xs.map(x => (x - mx) ** 2));
  const trend = 100 * slope * 10 / my;
  const card = (k, v, s, hot) => `<div class="card ${hot ? "hot" : ""}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  $("#seasonCards").innerHTML =
    card("Critical period", `${fdoyLabel(crit.start)} – ${fdoyLabel(crit.end)}`, `${crit.length} days · ${Math.round(crit.share * 100)}% of yearly burning`, true) +
    card("Typical peak", fdoyLabel(crit.peak), "median 2003–2022") +
    card("Fire season", `${fdoyLabel(clim.mean.some(v => v > 0) ? crit.onset : 0)} – ${fdoyLabel(crit.offset)}`, "10%–90% of burning") +
    card("Trend", `${trend > 0 ? "+" : ""}${trend.toFixed(0)}%`, "per decade, 2003–2025") +
    card("Now", ns.label, `${fmt(ns.cur)} vs typical ${fmt(ns.med)} cell-days / 7 d`, ns.level === "extreme" || ns.level === "above");

  spiral.set(h, tl, crit, state.aoiName);
  drawTab();

  const [a, b] = frameRange();
  setSparkCursor = sparkline($("#sparkline"), new Map([...state.monthly].map(([k, v]) => [k - a, v])), b - a + 1);
  showFrame(state.frame || a);
}

function drawTab() {
  const { h, clim, crit } = state;
  if (state.tab === "grid") calendarGrid($("#calGrid"), h, tl, crit, state.yearMode, jumpToDay);
  if (state.tab === "season") seasonChart($("#seasonChart"), clim, crit, tl, +$("#yearSelect").value);
  if (state.tab === "anomaly") {
    annualChart($("#annualChart"), annualAnomalies(h, tl));
    monthGrid($("#monthGrid"), monthlyAnomalies(h, tl), (y, m) => { play(false); showFrame((y - 2000) * 12 + m); });
  }
  if (state.tab === "science") {
    valCards($("#valCards"), D.meta); valSeries($("#valSeries"), D.meta);
    valScatter($("#valScatter"), D.meta); sensorTimeline($("#sensorTimeline"), D.meta, tl.year[tl.n - 1]);
  }
}

/* ------------------------------------------------------------------ UI wiring */
function wireUI() {
  const sel = $("#aoiSelect");
  const opts = [["nga", "All Nigeria"], ...D.states.names.map((n, i) => [String(i), n]).sort((a, b) => a[1].localeCompare(b[1]))];
  sel.innerHTML = opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("") + `<option value="box" disabled>Custom area</option>`;
  sel.onchange = () => selectAOI(sel.value);

  const fys = [...new Set(tl.fyear)].filter(fy => fy >= 2001);
  const ys = $("#yearSelect");
  ys.innerHTML = fys.reverse().map(fy => `<option value="${fy}">${fy}/${String((fy + 1) % 100).padStart(2, "0")}</option>`).join("");
  const lastComplete = annualAnomalies(D.national.h, tl).rows.filter(r => r.complete).pop();
  if (lastComplete) ys.value = lastComplete.fy;
  ys.onchange = drawTab;

  document.querySelectorAll(".tab").forEach(b => b.onclick = () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === b));
    document.querySelectorAll(".tabpanel").forEach(p => p.classList.toggle("active", p.id === "tab-" + b.dataset.tab));
    state.tab = b.dataset.tab; drawTab();
  });
  document.querySelectorAll(".seg-btn").forEach(b => b.onclick = () => {
    document.querySelectorAll(".seg-btn").forEach(x => x.classList.toggle("active", x === b));
    state.yearMode = b.dataset.year; drawTab();
  });

  const [a, b] = frameRange();
  const sl = $("#frameSlider"); sl.min = a; sl.max = b;
  sl.oninput = () => { play(false); showFrame(+sl.value); };
  $("#playBtn").onclick = () => play(!state.playing);

  // draw custom AOI
  const drawBtn = $("#drawBtn");
  let corner = null;
  const stop = () => { state.drawing = false; corner = null; drawBtn.classList.remove("on"); $("#drawHint").hidden = true; map.getCanvas().style.cursor = ""; };
  drawBtn.onclick = () => { state.drawing = !state.drawing; drawBtn.classList.toggle("on", state.drawing); $("#drawHint").hidden = !state.drawing; map.getCanvas().style.cursor = state.drawing ? "crosshair" : ""; corner = null; };
  map.on("click", e => {
    if (!state.drawing) return;
    if (!corner) { corner = e.lngLat; return; }
    const box = [[Math.min(corner.lng, e.lngLat.lng), Math.min(corner.lat, e.lngLat.lat)], [Math.max(corner.lng, e.lngLat.lng), Math.max(corner.lat, e.lngLat.lat)]];
    stop(); selectAOI("box", box);
  });
  map.on("mousemove", e => {
    if (!state.drawing || !corner) return;
    const c = corner, p = e.lngLat;
    map.getSource("aoi").setData({ type: "Feature", geometry: { type: "Polygon", coordinates: [[[c.lng, c.lat], [p.lng, c.lat], [p.lng, p.lat], [c.lng, p.lat], [c.lng, c.lat]]] } });
  });
  addEventListener("keydown", e => { if (e.key === "Escape" && state.drawing) stop(); });
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(drawTab, 200); });
}

/* ------------------------------------------------------------------ intro stats */
function countUp(el, to, ms = 1600) {
  const t0 = performance.now();
  const f = now => { const p = Math.min(1, (now - t0) / ms); el.textContent = fmt(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}
function introStats() {
  const m = D.meta;
  const items = [[m.totals.detections, "satellite fire detections"], [tl.year[tl.n - 1] - 2000, "years of record"], [4, "satellites harmonized"], [D.states.names.length - 1, "states + FCT"]];
  $("#introStats").innerHTML = items.map(([, t], j) => `<div style="animation-delay:${.15 * j}s"><b>0</b><span>${t}</span></div>`).join("");
  document.querySelectorAll("#introStats b").forEach((b, j) => countUp(b, items[j][0]));
}

/* ------------------------------------------------------------------ boot */
(async function boot() {
  const mapReady = initMap();
  try { await Promise.all([load(), mapReady]); }
  catch (err) {
    $("#enterBtn .lbl").textContent = "Data failed to load. Run the pipeline first.";
    console.error(err); return;
  }
  spinGlobe();
  addLayers();
  spiral = new Spiral($("#spiral"), $("#spiralTip"), jumpToDay);
  wireUI();
  introStats();
  const btn = $("#enterBtn");
  btn.disabled = false; btn.querySelector(".lbl").textContent = "Enter the fire calendar →";
  btn.onclick = () => {
    $("#intro").classList.add("gone");
    state.spinning = false;
    state.frame = frameRange()[0];
    selectAOI("nga", null, false);
    map.flyTo({ ...NIGERIA, duration: 4200, curve: 1.6, essential: true });
    map.once("moveend", () => play(true));
  };
  // deep links: #app skips the intro, #tab=season opens a tab
  if (location.hash.includes("app")) btn.click();
  const tab = (location.hash.match(/tab=(\w+)/) || [])[1];
  if (tab) document.querySelector(`.tab[data-tab="${tab}"]`)?.click();
  window.__ready = true;
})();
