// Harmattan charts: spiral fire clock, burning calendar, seasons, anomalies, harmonization diagnostics.
// Written with AI assistance (Claude Code).
import { MONTHS, fdoyLabel } from "./analytics.js";

const d3 = window.d3;
export const fire = d3.interpolateRgbBasis(["#1b120d", "#5c1408", "#b8240c", "#ff4a1c", "#ff8a1f", "#ffc857", "#fff4d6"]);
const EMPTY = "#171a22", MISSING = "#2a2d36";

function setupCanvas(canvas, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.height = h + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
function p99(a) {
  const nz = []; for (const v of a) if (v > 0) nz.push(v);
  if (!nz.length) return 1;
  nz.sort((x, y) => x - y);
  return nz[Math.floor(nz.length * 0.99)] || nz[nz.length - 1];
}
const fmt = d3.format(",.0f");

/* ====================================================================== spiral fire clock */
export class Spiral {
  constructor(canvas, tip, onPick) {
    this.canvas = canvas; this.tip = tip; this.onPick = onPick; this.anim = null;
    canvas.addEventListener("mousemove", e => this.hover(e));
    canvas.addEventListener("mouseleave", () => (this.tip.hidden = true));
    canvas.addEventListener("click", e => { const i = this.pick(e); if (i != null) onPick(i); });
    new ResizeObserver(() => this.data && this.draw(false)).observe(canvas.parentElement);
  }
  set(h, tl, crit, name) { this.data = { h, tl, crit, name }; this.draw(true); }
  geom() {
    const S = this.canvas.parentElement.clientWidth;
    return { S, cx: S / 2, cy: S / 2, R: S * 0.43, r0: S * 0.11 };
  }
  rad(i) { const g = this.g; return g.r0 + (g.R - g.r0) * (i / this.data.tl.n); }
  ang(i) { return -Math.PI / 2 + 2 * Math.PI * (this.data.tl.doy[i] + 0.5) / 365; }
  draw(animate) {
    cancelAnimationFrame(this.anim);
    const { h, tl, crit, name } = this.data;
    this.g = this.geom();
    const { S, cx, cy, R, r0 } = this.g;
    const ctx = setupCanvas(this.canvas, S, S);
    const vmax = p99(h);
    const lw = Math.max(1.2, (R - r0) * 365 / tl.n * 0.86);
    const dA = Math.PI / 365 * 1.08;

    const back = () => {
      ctx.clearRect(0, 0, S, S);
      // critical-period wedge (crit uses fire-year days; convert to calendar doy: +181)
      const a0 = -Math.PI / 2 + 2 * Math.PI * ((crit.start + 181) % 365) / 365;
      const a1 = -Math.PI / 2 + 2 * Math.PI * (((crit.end + 181) % 365) + 1) / 365;
      const grd = ctx.createRadialGradient(cx, cy, r0 * .6, cx, cy, R + 18);
      grd.addColorStop(0, "rgba(255,122,26,0)"); grd.addColorStop(1, "rgba(255,122,26,0.13)");
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R + 18, a0, a1); ctx.closePath();
      ctx.fillStyle = grd; ctx.fill();
      // month spokes + labels
      ctx.font = "11px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let m = 0; m < 12; m++) {
        const a = -Math.PI / 2 + 2 * Math.PI * m / 12;
        ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0 * .8, cy + Math.sin(a) * r0 * .8);
        ctx.lineTo(cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10)); ctx.stroke();
        const am = a + Math.PI / 12;
        ctx.fillStyle = "#8d919c";
        ctx.fillText(MONTHS[m], cx + Math.cos(am) * (R + 26), cy + Math.sin(am) * (R + 26));
      }
      // peak marker
      const ap = -Math.PI / 2 + 2 * Math.PI * ((crit.peak + 181) % 365 + .5) / 365;
      ctx.strokeStyle = "rgba(255,200,87,.8)"; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(ap) * r0, cy + Math.sin(ap) * r0);
      ctx.lineTo(cx + Math.cos(ap) * (R + 14), cy + Math.sin(ap) * (R + 14)); ctx.stroke(); ctx.setLineDash([]);
      // empty track
      ctx.lineCap = "butt";
      for (let i = 0; i < tl.n; i++) {
        ctx.strokeStyle = tl.isMissing(i) ? MISSING : EMPTY; ctx.lineWidth = lw;
        const a = this.ang(i);
        ctx.beginPath(); ctx.arc(cx, cy, this.rad(i), a - dA, a + dA); ctx.stroke();
      }
    };
    const day = i => {
      const v = h[i]; if (!(v > 0)) return;
      const t = Math.pow(Math.min(1, v / vmax), 0.7);
      const a = this.ang(i);
      ctx.strokeStyle = fire(0.04 + 0.96 * t); ctx.lineWidth = lw;
      ctx.shadowBlur = t > .55 ? 8 * t : 0; ctx.shadowColor = "rgba(255,120,30,.9)";
      ctx.beginPath(); ctx.arc(cx, cy, this.rad(i), a - dA, a + dA); ctx.stroke();
    };
    const front = () => {
      ctx.shadowBlur = 0;
      // year labels along the Jan-1 spoke
      ctx.font = "10px Inter, sans-serif"; ctx.textAlign = "left";
      for (let y = 2002; y <= tl.year[tl.n - 1]; y += 4) {
        const i = tl.index(y, 0, 1); if (i < 0 || i >= tl.n) continue;
        const r = this.rad(i);
        ctx.fillStyle = "rgba(10,11,16,.75)"; ctx.fillRect(cx + 3, cy - r - 6, 28, 12);
        ctx.fillStyle = "#c9c4bb"; ctx.fillText(String(y), cx + 5, cy - r);
      }
      // centre
      ctx.textAlign = "center";
      ctx.fillStyle = "#ece8e1"; ctx.font = "600 15px 'Space Grotesk', sans-serif";
      ctx.fillText(name.length > 18 ? name.slice(0, 17) + "…" : name, cx, cy - 8);
      ctx.fillStyle = "#8d919c"; ctx.font = "11px Inter, sans-serif";
      ctx.fillText(`${tl.year[0]}–${tl.year[tl.n - 1]}`, cx, cy + 10);
    };

    back();
    if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (let i = 0; i < tl.n; i++) day(i); front(); return;
    }
    const T = 3600, t0 = performance.now(); let done = 0;
    const step = now => {
      const p = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - p, 3);
      const upto = Math.floor(e * tl.n);
      for (; done < upto; done++) day(done);
      if (p < 1) this.anim = requestAnimationFrame(step); else { for (; done < tl.n; done++) day(done); front(); }
    };
    this.anim = requestAnimationFrame(step);
  }
  pick(e) {
    if (!this.g) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - this.g.cx, y = e.clientY - rect.top - this.g.cy;
    const r = Math.hypot(x, y);
    if (r < this.g.r0 - 4 || r > this.g.R + 6) return null;
    let a = Math.atan2(y, x) + Math.PI / 2; if (a < 0) a += 2 * Math.PI;
    const doy = Math.min(364, Math.floor(a / (2 * Math.PI) * 365));
    const { tl } = this.data;
    const est = Math.round((r - this.g.r0) / (this.g.R - this.g.r0) * tl.n);
    let best = null, bd = 1e9;
    for (let i = Math.max(0, est - 420); i < Math.min(tl.n, est + 420); i++) {
      if (tl.doy[i] !== doy) continue;
      const d = Math.abs(this.rad(i) - r); if (d < bd) { bd = d; best = i; }
    }
    return bd < (this.g.R - this.g.r0) * 365 / tl.n ? best : null;
  }
  hover(e) {
    const i = this.pick(e);
    if (i == null) { this.tip.hidden = true; return; }
    const { h, tl } = this.data;
    const rect = this.canvas.getBoundingClientRect();
    this.tip.hidden = false;
    this.tip.style.left = (e.clientX - rect.left) + "px"; this.tip.style.top = (e.clientY - rect.top) + "px";
    this.tip.innerHTML = tl.isMissing(i) ? `${tl.fmt(i)}<br><span class="muted">no archive data yet</span>`
      : `<b>${tl.fmt(i)}</b><br>${h[i].toFixed(1)} active-fire cell-days<br><span class="muted">click to show on map</span>`;
  }
}

/* ====================================================================== calendar grid */
export function calendarGrid(el, h, tl, crit, mode, onPick) {
  el.innerHTML = "";
  const W = el.clientWidth || 480, gutter = 46, top = 18, rowH = 10;
  const key = mode === "fire" ? tl.fyear : tl.year, col = mode === "fire" ? tl.fdoy : tl.doy;
  const y0 = key[0], y1 = key[tl.n - 1], rows = y1 - y0 + 1;
  const H = top + rows * rowH + 6;
  const canvas = document.createElement("canvas"); el.appendChild(canvas);
  const ctx = setupCanvas(canvas, W, H);
  const cw = (W - gutter) / 365, vmax = p99(h);
  ctx.fillStyle = EMPTY; ctx.fillRect(gutter, top, W - gutter, rows * rowH);
  // critical period bracket
  const cs = mode === "fire" ? crit.start : (crit.start + 181) % 365, ce = mode === "fire" ? crit.end : (crit.end + 181) % 365;
  ctx.fillStyle = "rgba(255,122,26,.55)";
  const bar = (a, b) => ctx.fillRect(gutter + a * cw, top - 5, (b - a + 1) * cw, 3);
  if (cs <= ce) bar(cs, ce); else { bar(cs, 364); bar(0, ce); }
  for (let i = 0; i < tl.n; i++) {
    const r = key[i] - y0, c = col[i];
    if (tl.isMissing(i)) ctx.fillStyle = MISSING;
    else if (h[i] > 0) ctx.fillStyle = fire(0.04 + 0.96 * Math.pow(Math.min(1, h[i] / vmax), 0.7));
    else continue;
    ctx.fillRect(gutter + c * cw, top + r * rowH, Math.max(cw, 1), rowH - 1);
  }
  ctx.font = "10px Inter, sans-serif"; ctx.fillStyle = "#8d919c"; ctx.textBaseline = "middle";
  for (let r = 0; r < rows; r++) {
    const y = y0 + r;
    if (rows > 16 && r % 2) continue;
    ctx.fillText(mode === "fire" ? `${y}/${String((y + 1) % 100).padStart(2, "0")}` : String(y), 0, top + r * rowH + rowH / 2);
  }
  const order = mode === "fire" ? [6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5] : [...Array(12).keys()];
  order.forEach((m, j) => ctx.fillText(MONTHS[m], gutter + j * (365 / 12) * cw + 2, 6));
  canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left - gutter) / cw), r = Math.floor((e.clientY - rect.top - top) / rowH);
    if (c < 0 || r < 0 || r >= rows) return;
    for (let i = 0; i < tl.n; i++) if (key[i] === y0 + r && col[i] === c) { onPick(i); break; }
  });
}

/* ====================================================================== seasons */
export function seasonChart(el, clim, crit, tl, fy) {
  el.innerHTML = "";
  const W = el.clientWidth || 480, H = 250, m = { t: 14, r: 10, b: 24, l: 40 };
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const x = d3.scaleLinear([0, 364], [m.l, W - m.r]);
  const sel = new Float32Array(365).fill(NaN);
  for (let i = 0; i < tl.n; i++) if (tl.fyear[i] === fy && !tl.isMissing(i)) sel[tl.fdoy[i]] = clim.smooth[i];
  const ymax = Math.max(d3.max(clim.p90), d3.max(sel.filter(v => !isNaN(v))) || 0) * 1.08 || 1;
  const y = d3.scaleLinear([0, ymax], [H - m.b, m.t]).nice();
  const rect = (a, b) => svg.append("rect").attr("x", x(a)).attr("width", x(b) - x(a) + 1).attr("y", m.t).attr("height", H - m.b - m.t).attr("fill", "rgba(255,122,26,.08)");
  if (crit.start <= crit.end) rect(crit.start, crit.end); else { rect(crit.start, 364); rect(0, crit.end); }
  const idx = d3.range(365);
  svg.append("path").attr("d", d3.area().x(k => x(k)).y0(k => y(clim.p10[k])).y1(k => y(clim.p90[k])).curve(d3.curveBasis)(idx)).attr("fill", "rgba(255,122,26,.25)");
  svg.append("path").attr("d", d3.line().x(k => x(k)).y(k => y(clim.p50[k])).curve(d3.curveBasis)(idx)).attr("fill", "none").attr("stroke", "#ffc857").attr("stroke-width", 2);
  const line = svg.append("path").attr("d", d3.line().defined(k => !isNaN(sel[k])).x(k => x(k)).y(k => y(sel[k]))(idx))
    .attr("fill", "none").attr("stroke", "#fff").attr("stroke-width", 1.6);
  const len = line.node().getTotalLength();
  line.attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len).transition().duration(1400).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0);
  const ticks = d3.range(12).map(j => j * 365 / 12);
  svg.append("g").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(ticks).tickFormat((_, j) => MONTHS[(j + 6) % 12]).tickSizeOuter(0));
  svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSizeOuter(0));
  svg.append("text").attr("x", x(crit.peak)).attr("y", m.t + 10).attr("text-anchor", "middle").style("fill", "#ffc857").text(`peak ≈ ${fdoyLabel(crit.peak)}`);
  const lg = svg.append("g").attr("transform", `translate(${W - m.r - 150},${m.t + 18})`);
  [["#ffc857", "Median 2003–2022"], ["rgba(255,122,26,.5)", "10–90th percentile"], ["#fff", `${fy}/${String((fy + 1) % 100).padStart(2, "0")}`]]
    .forEach(([c, t], j) => { lg.append("rect").attr("y", j * 15).attr("width", 12).attr("height", 3).attr("fill", c); lg.append("text").attr("x", 18).attr("y", j * 15 + 4).text(t); });
}

/* ====================================================================== anomalies */
export function annualChart(el, an) {
  el.innerHTML = "";
  const rows = an.rows.filter(r => r.fy >= 2000);
  const W = el.clientWidth || 480, H = 200, m = { t: 10, r: 8, b: 30, l: 34 };
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const x = d3.scaleBand(rows.map(r => r.fy), [m.l, W - m.r]).padding(.18);
  const zmax = Math.max(2.5, d3.max(rows, r => Math.abs(r.z ?? 0)));
  const y = d3.scaleLinear([-zmax, zmax], [H - m.b, m.t]);
  const col = z => z > 0 ? d3.interpolateRgb("#5c1408", "#ff7a1a")(Math.min(1, z / 2.5)) : d3.interpolateRgb("#16324a", "#4ea8de")(Math.min(1, -z / 2.5));
  svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "#3a3f4c");
  svg.selectAll("rect").data(rows).join("rect")
    .attr("x", r => x(r.fy)).attr("width", x.bandwidth()).attr("y", y(0)).attr("height", 0)
    .attr("fill", r => r.z == null ? "none" : col(r.z)).attr("stroke", r => r.z == null ? "#3a3f4c" : "none")
    .call(s => s.append("title").text(r => `${r.fy}/${String((r.fy + 1) % 100).padStart(2, "0")}: ${fmt(r.total)} cell-days` + (r.z == null ? " (incomplete year)" : `, z = ${r.z.toFixed(2)}`)))
    .transition().delay((_, j) => j * 35).duration(600)
    .attr("y", r => r.z == null ? y(0) - 4 : y(Math.max(0, r.z))).attr("height", r => r.z == null ? 8 : Math.abs(y(r.z) - y(0)));
  svg.append("g").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(rows.map(r => r.fy).filter(v => v % 4 === 0)).tickFormat(v => `${v}/${String((v + 1) % 100).padStart(2, "0")}`).tickSizeOuter(0));
  svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(v => (v > 0 ? "+" : "") + v + "σ"));
}

export function monthGrid(el, ma, onPick) {
  el.innerHTML = "";
  const years = [...new Set(ma.cells.map(c => c.y))].sort((a, b) => a - b);
  const W = el.clientWidth || 480, cw = (W - 40) / 12, rh = 11, H = 18 + years.length * rh;
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const col = z => d3.interpolateRdBu(0.5 - Math.max(-3, Math.min(3, z)) / 6);
  svg.selectAll("rect").data(ma.cells).join("rect")
    .attr("x", c => 40 + c.m * cw).attr("y", c => 16 + years.indexOf(c.y) * rh).attr("width", cw - 1).attr("height", rh - 1)
    .attr("fill", c => col(c.z)).attr("opacity", 0).style("cursor", "pointer")
    .on("click", (_, c) => onPick(c.y, c.m))
    .call(s => s.append("title").text(c => `${MONTHS[c.m]} ${c.y}: ${fmt(c.v)} cell-days, z = ${c.z.toFixed(2)}`))
    .transition().delay(c => (c.y - years[0]) * 18).duration(400).attr("opacity", 1);
  svg.selectAll("text.m").data(MONTHS).join("text").attr("x", (_, j) => 40 + j * cw + cw / 2).attr("y", 10).attr("text-anchor", "middle").text(d => d[0]);
  svg.selectAll("text.y").data(years.filter(y => y % 2 === 0)).join("text").attr("x", 0).attr("y", y => 16 + years.indexOf(y) * rh + rh - 2).text(y => y);
}

/* ====================================================================== harmonization diagnostics */
export function valCards(el, meta) {
  const v = meta.validation;
  const card = (k, val, s, hot) => `<div class="card ${hot ? "hot" : ""}"><div class="k">${k}</div><div class="v">${val}</div><div class="s">${s}</div></div>`;
  el.innerHTML =
    card("Raw bias", `${v.tile_month_raw.bias_pct > 0 ? "+" : ""}${v.tile_month_raw.bias_pct}%`, "VIIRS vs MODIS, before") +
    card("Harmonized bias", `${v.tile_month_harmonized.bias_pct > 0 ? "+" : ""}${v.tile_month_harmonized.bias_pct}%`, "held-out 2022–2025", true) +
    card("Agreement r²", v.tile_month_harmonized.r2.toFixed(2), `1° tile × month, n=${fmt(v.tile_month_harmonized.n)}`, true) +
    card("Mean abs. error", `${v.tile_month_raw.mae} → ${v.tile_month_harmonized.mae}`, "cell-days per tile-month") +
    card("VIIRS → MODIS k", meta.k_viirs_national.toFixed(2), "national scale factor");
}

export function valSeries(el, meta) {
  el.innerHTML = "";
  const data = meta.validation.national_series.map(([k, m, v, ve]) => ({ d: new Date(k + "-15"), m, v, ve }));
  const W = el.clientWidth || 480, H = 220, mg = { t: 34, r: 8, b: 24, l: 44 };
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const x = d3.scaleTime(d3.extent(data, d => d.d), [mg.l, W - mg.r]);
  const y = d3.scaleLinear([0, d3.max(data, d => Math.max(d.m, d.v)) * 1.05], [H - mg.b, mg.t]).nice();
  const series = [["v", "#6b7080", "VIIRS raw", "4 3"], ["m", "#ffc857", "MODIS", null], ["ve", "#ff7a1a", "VIIRS harmonized", null]];
  for (const [k, c, , dash] of series) {
    const p = svg.append("path").attr("d", d3.line().x(d => x(d.d)).y(d => y(d[k])).curve(d3.curveMonotoneX)(data))
      .attr("fill", "none").attr("stroke", c).attr("stroke-width", k === "v" ? 1.4 : 2);
    if (dash) p.attr("stroke-dasharray", dash);
  }
  svg.append("g").attr("transform", `translate(0,${H - mg.b})`).call(d3.axisBottom(x).ticks(5).tickSizeOuter(0));
  svg.append("g").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("~s")));
  svg.append("text").attr("x", mg.l).attr("y", 10).style("fill", "#ece8e1").text("National monthly active-fire cell-days · held-out years");
  series.forEach(([, c, t], j) => { svg.append("rect").attr("x", mg.l + j * 120).attr("y", 18).attr("width", 10).attr("height", 3).attr("fill", c); svg.append("text").attr("x", mg.l + 14 + j * 120).attr("y", 23).text(t); });
}

export function valScatter(el, meta) {
  el.innerHTML = "";
  const pts = meta.validation.scatter;
  const W = el.clientWidth || 480, H = Math.min(320, W * 0.7), mg = { t: 24, r: 10, b: 30, l: 44 };
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const mx = d3.max(pts, p => Math.max(p[0], p[1])) || 10;
  const x = d3.scaleSymlog([0, mx], [mg.l, W - mg.r]).constant(5), y = d3.scaleSymlog([0, mx], [H - mg.b, mg.t]).constant(5);
  svg.append("line").attr("x1", x(0)).attr("y1", y(0)).attr("x2", x(mx)).attr("y2", y(mx)).attr("stroke", "#3a3f4c").attr("stroke-dasharray", "4 4");
  svg.append("g").selectAll("circle").data(pts).join("circle").attr("cx", p => x(p[0])).attr("cy", p => y(p[1])).attr("r", 1.8).attr("fill", "#6b7080").attr("opacity", .45);
  svg.append("g").selectAll("circle").data(pts).join("circle").attr("cx", p => x(p[0])).attr("cy", p => y(p[0])).attr("r", 1.8).attr("fill", "#ff7a1a").attr("opacity", .55)
    .transition().delay((_, j) => j * 0.6).duration(900).attr("cy", p => y(p[2]));
  svg.append("g").attr("transform", `translate(0,${H - mg.b})`).call(d3.axisBottom(x).ticks(5, "~s"));
  svg.append("g").attr("transform", `translate(${mg.l},0)`).call(d3.axisLeft(y).ticks(5, "~s"));
  svg.append("text").attr("x", mg.l).attr("y", 10).style("fill", "#ece8e1").text("Per tile-month: MODIS (x) vs VIIRS (y) — grey raw, orange harmonized; dashed = 1:1");
  svg.append("text").attr("x", W - mg.r).attr("y", H - 2).attr("text-anchor", "end").text("MODIS cell-days");
}

export function sensorTimeline(el, meta, endYear) {
  el.innerHTML = "";
  const W = el.clientWidth || 480, H = 150, mg = { l: 112, r: 10, t: 22 };
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  const x = d3.scaleTime([new Date(2000, 0, 1), new Date(endYear + 1, 0, 1)], [mg.l, W - mg.r]);
  const rows = [
    ["MODIS Terra · 1 km", "2000-11-01", "#ffc857"], ["MODIS Aqua · 1 km", "2002-07-04", "#ffc857"],
    ["VIIRS S-NPP · 375 m", "2012-01-20", "#ff7a1a"], ["VIIRS NOAA-20 · 375 m", "2018-01-01", "#ff7a1a"],
    ["Harmattan record", "2000-11-01", "url(#hg)"],
  ];
  const defs = svg.append("defs").append("linearGradient").attr("id", "hg");
  defs.append("stop").attr("offset", "0").attr("stop-color", "#ffc857"); defs.append("stop").attr("offset", "1").attr("stop-color", "#ff3d2e");
  svg.append("text").attr("x", 0).attr("y", 10).style("fill", "#ece8e1").text("Sensor coverage → one continuous record");
  rows.forEach(([t, s, c], j) => {
    const yy = mg.t + j * 24;
    svg.append("text").attr("x", 0).attr("y", yy + 10).text(t);
    svg.append("rect").attr("x", x(new Date(s))).attr("y", yy).attr("height", j === 4 ? 14 : 10).attr("rx", 4).attr("fill", c).attr("width", 0)
      .transition().delay(j * 200).duration(900).attr("width", x(new Date(endYear + 1, 0, 1)) - x(new Date(s)));
  });
  svg.append("g").attr("transform", `translate(0,${H - 16})`).call(d3.axisBottom(x).ticks(6).tickSizeOuter(0));
}

export function sparkline(el, totals, nframes) {
  el.innerHTML = "";
  const W = el.clientWidth || 300, H = 26;
  const vals = d3.range(nframes).map(k => totals.get(k) || 0);
  const x = d3.scaleLinear([0, nframes - 1], [0, W]), y = d3.scaleLinear([0, d3.max(vals) || 1], [H, 2]);
  const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "none");
  svg.append("path").attr("d", d3.area().x((_, k) => x(k)).y0(H).y1(v => y(v)).curve(d3.curveMonotoneX)(vals)).attr("fill", "rgba(255,122,26,.35)");
  const cur = svg.append("line").attr("y1", 0).attr("y2", H).attr("stroke", "#fff").attr("stroke-width", 1.5);
  return k => cur.attr("x1", x(k)).attr("x2", x(k));
}
