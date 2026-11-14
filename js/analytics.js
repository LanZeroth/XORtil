// Harmattan analytics: calendar, climatology, critical periods, anomalies, early-warning status.
// Part of FireCal / Harmattan (team XORTil). Written with AI assistance (Claude Code).

const DAY = 86400000;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export class Timeline {
  constructor(startISO, ndays, missing = null) {
    this.t0 = Date.parse(startISO + "T00:00:00Z");
    this.n = ndays;
    this.missing = missing; // [firstMissingIdx, lastMissingIdx] or null
    this.year = new Int16Array(ndays);
    this.month = new Int8Array(ndays);
    this.doy = new Int16Array(ndays);   // 0..364 (Dec 31 of leap years folded into 364)
    this.fdoy = new Int16Array(ndays);  // fire-year day: 0 = Jul 1 .. 364
    this.fyear = new Int16Array(ndays); // fire year labelled by its starting July
    for (let i = 0; i < ndays; i++) {
      const d = new Date(this.t0 + i * DAY);
      const y = d.getUTCFullYear(), m = d.getUTCMonth();
      const doy = Math.min(364, Math.floor((Date.UTC(y, m, d.getUTCDate()) - Date.UTC(y, 0, 1)) / DAY) - (isLeap(y) && m > 1 ? 1 : 0));
      this.year[i] = y; this.month[i] = m; this.doy[i] = doy;
      this.fyear[i] = m >= 6 ? y : y - 1;
      this.fdoy[i] = (doy - 181 + 365) % 365; // Jul 1 = doy 181 (non-leap)
    }
  }
  date(i) { return new Date(this.t0 + i * DAY); }
  index(y, m, d) { return Math.round((Date.UTC(y, m, d) - this.t0) / DAY); }
  isMissing(i) { return this.missing && i >= this.missing[0] && i <= this.missing[1]; }
  fmt(i) { const d = this.date(i); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
}
function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

export function densify(sparse, n) {
  const a = new Float32Array(n);
  for (const [i, v] of sparse) a[i] = v;
  return a;
}
export function addInto(acc, sparse) { for (const [i, v] of sparse) acc[i] += v; return acc; }

export function smooth(a, w = 15) {
  const out = new Float32Array(a.length), h = Math.floor(w / 2);
  let s = 0, c = 0;
  for (let i = 0; i < a.length + h; i++) {
    if (i < a.length) { s += a[i]; c++; }
    if (i - w >= 0) { s -= a[i - w]; c--; }
    const j = i - h;
    if (j >= 0 && j < a.length) out[j] = s / c;
  }
  return out;
}

const quant = (arr, q) => {
  if (!arr.length) return 0;
  const s = Float64Array.from(arr).sort();
  const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
  return s[lo] + (s[hi] - s[lo]) * (p - lo);
};

/** Climatology by fire-year day (Jul 1 = 0) over baseline fire years. */
export function climatology(h, tl, base = [2003, 2021]) {
  const sm = smooth(h, 15);
  const buckets = Array.from({ length: 365 }, () => []);
  for (let i = 0; i < tl.n; i++) {
    if (tl.fyear[i] >= base[0] && tl.fyear[i] <= base[1] && !tl.isMissing(i)) buckets[tl.fdoy[i]].push(sm[i]);
  }
  const mean = new Float32Array(365), p10 = new Float32Array(365), p50 = new Float32Array(365), p90 = new Float32Array(365);
  buckets.forEach((b, k) => {
    mean[k] = b.reduce((x, y) => x + y, 0) / Math.max(1, b.length);
    p10[k] = quant(b, .1); p50[k] = quant(b, .5); p90[k] = quant(b, .9);
  });
  return { mean, p10, p50, p90, smooth: sm };
}

/** Critical period = contiguous (circular) window around the peak where mean >= 50% of peak. */
export function criticalPeriod(clim) {
  const m = clim.mean;
  let peak = 0;
  for (let k = 1; k < 365; k++) if (m[k] > m[peak]) peak = k;
  const thr = 0.5 * m[peak];
  let a = peak, b = peak;
  while (m[(a - 1 + 365) % 365] >= thr && ((peak - a + 365) % 365) < 364) a = (a - 1 + 365) % 365;
  while (m[(b + 1) % 365] >= thr && ((b - peak + 365) % 365) < 364) b = (b + 1) % 365;
  const total = m.reduce((x, y) => x + y, 0) || 1;
  let inside = 0;
  for (let k = a; ; k = (k + 1) % 365) { inside += m[k]; if (k === b) break; }
  // season onset / end: 10% and 90% of cumulative burning in the fire year
  let cum = 0, on = 0, off = 364;
  for (let k = 0; k < 365; k++) { cum += m[k]; if (cum >= .1 * total && !on) on = k; if (cum >= .9 * total) { off = k; break; } }
  return { start: a, end: b, peak, share: inside / total, length: ((b - a + 365) % 365) + 1, onset: on, offset: off, peakValue: m[peak] };
}

/** fire-year day -> "12 Jan" */
export function fdoyLabel(k) {
  const d = new Date(Date.UTC(2001, 6, 1) + k * DAY);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Totals per fire year (only complete, non-missing years flagged). */
export function fireYearTotals(h, tl) {
  const map = new Map();
  for (let i = 0; i < tl.n; i++) {
    const fy = tl.fyear[i];
    if (!map.has(fy)) map.set(fy, { fy, total: 0, days: 0, missing: 0 });
    const r = map.get(fy);
    if (tl.isMissing(i)) r.missing++; else { r.total += h[i]; r.days++; }
  }
  return [...map.values()].map(r => ({ ...r, complete: r.days >= 360 && r.missing === 0 }));
}

export function annualAnomalies(h, tl, base = [2003, 2021]) {
  const rows = fireYearTotals(h, tl);
  const b = rows.filter(r => r.complete && r.fy >= base[0] && r.fy <= base[1]).map(r => r.total);
  const mu = b.reduce((x, y) => x + y, 0) / b.length;
  const sd = Math.sqrt(b.reduce((x, y) => x + (y - mu) ** 2, 0) / Math.max(1, b.length - 1)) || 1;
  return { mu, sd, rows: rows.map(r => ({ ...r, z: r.complete ? (r.total - mu) / sd : null })) };
}

export function monthlyAnomalies(h, tl, base = [2003, 2022]) {
  const tot = new Map(); // key y*12+m
  const miss = new Set();
  for (let i = 0; i < tl.n; i++) {
    const k = tl.year[i] * 12 + tl.month[i];
    if (tl.isMissing(i)) { miss.add(k); continue; }
    tot.set(k, (tot.get(k) || 0) + h[i]);
  }
  const stats = Array.from({ length: 12 }, (_, m) => {
    const vals = [];
    for (let y = base[0]; y <= base[1]; y++) if (tot.has(y * 12 + m)) vals.push(tot.get(y * 12 + m));
    const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, vals.length - 1)) || 1;
    return { mu, sd };
  });
  const cells = [];
  for (const [k, v] of tot) {
    const y = Math.floor(k / 12), m = k % 12;
    if (miss.has(k)) continue;
    cells.push({ y, m, v, z: (v - stats[m].mu) / stats[m].sd });
  }
  return { cells, stats };
}

/** Early warning: last 7 valid days vs the same calendar window in baseline years. */
export function nowStatus(h, tl, crit, base = [2003, 2022]) {
  let end = tl.n - 1;
  while (end > 0 && tl.isMissing(end)) end--;
  const sum = (a, b) => { let s = 0; for (let i = Math.max(0, a); i <= b; i++) s += h[i]; return s; };
  const cur = sum(end - 6, end);
  const d = tl.date(end);
  const ref = [];
  for (let y = base[0]; y <= base[1]; y++) {
    const j = tl.index(y, d.getUTCMonth(), d.getUTCDate());
    if (j - 6 >= 0 && j < tl.n) ref.push(sum(j - 6, j));
  }
  const below = ref.filter(v => v < cur).length + 0.5 * ref.filter(v => v === cur).length;
  const pct = ref.length ? 100 * below / ref.length : 50;
  const med = quant(ref, .5);
  const k = tl.fdoy[end];
  const inCrit = crit.start <= crit.end ? (k >= crit.start && k <= crit.end) : (k >= crit.start || k <= crit.end);
  let level = "normal", label = "Normal";
  if (pct >= 90) { level = "extreme"; label = "Extreme"; }
  else if (pct >= 75) { level = "above"; label = "Above normal"; }
  else if (pct < 25) { level = "below"; label = "Below normal"; }
  const daysToCrit = inCrit ? 0 : ((crit.start - k + 365) % 365);
  return { end, cur, pct, med, level, label, inCrit, daysToCrit };
}

/** Monthly totals (index ym = (y-2000)*12+m) for sparkline / map label. */
export function monthlyTotals(h, tl) {
  const out = new Map();
  for (let i = 0; i < tl.n; i++) {
    if (tl.isMissing(i)) continue;
    const k = (tl.year[i] - 2000) * 12 + tl.month[i];
    out.set(k, (out.get(k) || 0) + h[i]);
  }
  return out;
}
