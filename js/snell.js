// Shared parts for SnellClear: refractive indices and dispersion, Snell's law and Fresnel reflection,
// two ray tracers (a general 2D one for shapes made of straight edges and circular arcs, and a
// sequential one for lenses and the eye), live chart boards, glowing laser rays, angle wedges, and the
// layout helpers every chapter uses. Every model is drawn in the x–y plane (z = 0), +x right, +y up.
import { THREE, M, box, beam, sphere, rod, canvasTexture, clamp } from './kit.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

// ---------------------------------------------------------------- constants
export const C = 299792458;              // m/s, the speed of light in a vacuum (exact, SI definition)
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
// Refractive indices at the sodium D line, 589 nm. Air is 1.000293 at 0 °C and 1 atm; 1.000 is used
// where the difference doesn't matter. Water 1.333 (20 °C). Glass: ordinary soda-lime or crown glass
// about 1.50–1.52. Diamond 2.417 (2.42). Cubic zirconia about 2.15–2.18. Acrylic (PMMA) 1.49.
// Sources: refractiveindex.info; Hecht, Optics (5th ed.), table 4.1.
export const MEDIA = {
  air: { n: 1.0, name: 'Air', col: '#dfe8f5' },
  water: { n: 1.333, name: 'Water', col: '#4fa3ff' },
  glass: { n: 1.5, name: 'Glass', col: '#8fe3d0' },
  diamond: { n: 2.42, name: 'Diamond', col: '#e8f4ff' },
};
// Dispersion: n changes with wavelength. Cauchy's formula n(λ) = A + B ÷ λ² (λ in µm), fitted to each
// material's index at 589.3 nm (n_d) and its Abbe number V = (n_d − 1) ÷ (n_F − n_C), where F is 486.1 nm
// and C is 656.3 nm. So B = (n_d − 1) ÷ V ÷ (1/0.4861² − 1/0.6563²) and A = n_d − B ÷ 0.5893².
// Values: water n_d 1.3330, V ≈ 55.7; crown glass (Schott N-BK7) 1.5168, V 64.2; flint glass (Schott F2)
// 1.6200, V 36.4; diamond 2.4175, V ≈ 55.3; cubic zirconia 2.16, V ≈ 33; acrylic 1.4905, V ≈ 57.
const cauchy = (nd, V) => { const B = (nd - 1) / V / (1 / 0.4861 ** 2 - 1 / 0.6563 ** 2); return { A: nd - B / 0.5893 ** 2, B, nd }; };
export const DISP = {
  water: cauchy(1.333, 55.7), crown: cauchy(1.5168, 64.2), flint: cauchy(1.62, 36.4),
  diamond: cauchy(2.4175, 55.3), cz: cauchy(2.16, 33), acrylic: cauchy(1.4905, 57), bak4: cauchy(1.5688, 56.1),
};
export const nAt = (mat, nm = 589.3) => { const d = DISP[mat]; return d.A + d.B / (nm / 1000) ** 2; };
// Seven rainbow wavelengths, red to violet (nm).
export const SPECTRUM = [680, 620, 590, 560, 510, 470, 420];

// ---------------------------------------------------------------- Snell, critical angle, Fresnel
// Snell's law, n₁ sin θ₁ = n₂ sin θ₂. Angles in radians from the normal. null means total internal reflection.
export function refractAngle(n1, n2, th1) { const s = (n1 / n2) * Math.sin(th1); return Math.abs(s) > 1 ? null : Math.asin(s); }
// Critical angle: the angle of incidence that makes θ₂ = 90°. Only exists going into a lower n.
export const critical = (n1, n2) => (n1 > n2 ? Math.asin(n2 / n1) : null);
// Fresnel reflectance for unpolarised light (the average of s and p). cosi = cos θ₁.
export function fresnel(n1, n2, cosi) {
  cosi = Math.abs(cosi);
  const s2 = (n1 / n2) ** 2 * (1 - cosi * cosi);
  if (s2 >= 1) return 1;
  const cost = Math.sqrt(1 - s2);
  const rs = (n1 * cosi - n2 * cost) / (n1 * cosi + n2 * cost), rp = (n1 * cost - n2 * cosi) / (n1 * cost + n2 * cosi);
  return (rs * rs + rp * rp) / 2;
}

// ---------------------------------------------------------------- vectors in 2D
const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
const norm2 = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
// Refract unit direction d through a surface with unit normal N facing the ray (dot(N, d) < 0).
// Returns [direction, R] where R is the reflected fraction, or [null, 1] for total internal reflection.
export function refractDir(d, N, n1, n2) {
  const cosi = -dot2(N, d), eta = n1 / n2, k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return [null, 1];
  const t = [eta * d[0] + (eta * cosi - Math.sqrt(k)) * N[0], eta * d[1] + (eta * cosi - Math.sqrt(k)) * N[1]];
  return [norm2(t), fresnel(n1, n2, cosi)];
}
export const reflectDir = (d, N) => { const c = dot2(d, N); return [d[0] - 2 * c * N[0], d[1] - 2 * c * N[1]]; };

// ---------------------------------------------------------------- the 2D tracer
// A shape is { n: number | (nm) => number, edges, parent }. An edge is a straight segment
// { a: [x, y], b: [x, y] } or a circular arc { c: [x, y], r, a0, a1 } (angles in radians, a0 < a1).
// An edge can also be { mirror: true } (always reflects) or { scatter: true } (a white printed dot that
// throws the light back into the shape, nearly along the normal) or { stop: true } (a screen). Shapes can sit inside one another
// (a fibre's core inside its cladding) by giving the inner one a parent; an edge with `out` set says
// which shape light passes into when it leaves through that edge (null: outside). Light starts outside every
// shape, in a medium of index nOut, unless `start` names the shape it starts in.
export function shapePoly(pts, n, parent = null) {
  const edges = pts.map((a, i) => ({ a, b: pts[(i + 1) % pts.length] }));
  const s = { n, edges, parent }; edges.forEach((e) => { e.shape = s; });
  return s;
}
export function screenEdge(a, b) { const e = { a, b, stop: true }; e.shape = { n: 1, edges: [e], parent: null }; return e.shape; }
export function shapeCircle(c, r, n, parent = null) {
  const s = { n, edges: [{ c, r, a0: 0, a1: TAU }], parent }; s.edges[0].shape = s;
  return s;
}
function hitEdge(e, p, d) {
  if (e.a) {
    const ex = e.b[0] - e.a[0], ey = e.b[1] - e.a[1], den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-12) return null;
    const wx = e.a[0] - p[0], wy = e.a[1] - p[1];
    const t = (wx * ey - wy * ex) / den, u = (wx * d[1] - wy * d[0]) / den;
    if (t < 1e-7 || u < -1e-9 || u > 1 + 1e-9) return null;
    const N = norm2([ey, -ex]);
    return { t, N };
  }
  const ox = p[0] - e.c[0], oy = p[1] - e.c[1];
  const b = ox * d[0] + oy * d[1], cc = ox * ox + oy * oy - e.r * e.r, disc = b * b - cc;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [-b - sq, -b + sq]) {
    if (t < 1e-7) continue;
    const hx = ox + t * d[0], hy = oy + t * d[1];
    let a = Math.atan2(hy, hx); if (a < e.a0) a += TAU; if (a > e.a1 && a - TAU >= e.a0) a -= TAU;
    if (a >= e.a0 - 1e-9 && a <= e.a1 + 1e-9) return { t, N: [hx / e.r, hy / e.r] };
  }
  return null;
}
const nOfShape = (s, nm, nOut) => (!s ? nOut : typeof s.n === 'function' ? s.n(nm) : s.n);
// Trace one ray. Returns { segs: [{ a, b, I, inside }], ends: [{ p, d, I, inside }] }. I is the fraction of
// the starting light carried. With branch on, partial reflections are followed too while they carry at
// least minI. `far` is how far a ray runs after its last hit.
export function trace(shapes, p0, d0, { nm = 589.3, nOut = 1, branch = true, minI = 0.03, maxHits = 60, far = 30, start = null, stopAt = null } = {}) {
  const edges = shapes.flatMap((s) => s.edges);
  const segs = [], ends = [], stack = [{ p: p0, d: norm2(d0), I: 1, cur: start, k: 0 }];
  let guard = 0;
  while (stack.length && guard++ < 400) {
    const r = stack.pop();
    let best = null;
    for (const e of edges) { const h = hitEdge(e, r.p, r.d); if (h && (!best || h.t < best.t)) best = { ...h, e }; }
    if (!best || r.k >= maxHits) {
      const L = stopAt ? stopAt(r) : far;
      segs.push({ a: r.p, b: [r.p[0] + r.d[0] * L, r.p[1] + r.d[1] * L], I: r.I, inside: r.cur });
      ends.push(r); continue;
    }
    const q = [r.p[0] + r.d[0] * best.t, r.p[1] + r.d[1] * best.t];
    segs.push({ a: r.p, b: q, I: r.I, inside: r.cur });
    let N = best.N; if (dot2(N, r.d) > 0) N = [-N[0], -N[1]];
    const e = best.e;
    if (e.stop) { ends.push({ ...r, p: q, stopped: true }); continue; }
    if (e.mirror) { stack.push({ p: q, d: reflectDir(r.d, N), I: r.I * 0.95, cur: r.cur, k: r.k + 1 }); continue; }
    if (e.scatter) {
      // A white dot: light bounces back into the shape, spread around the normal (Lambertian-ish).
      const a = Math.sin(q[0] * 37.1) * 0.35;
      const d = norm2([N[0] * Math.cos(a) - N[1] * Math.sin(a), N[0] * Math.sin(a) + N[1] * Math.cos(a)]);
      stack.push({ p: q, d, I: r.I * 0.9, cur: r.cur, k: r.k + 1 }); continue;
    }
    const next = r.cur === e.shape ? ('out' in e ? e.out : e.shape.parent) : e.shape;
    const n1 = nOfShape(r.cur, nm, nOut), n2 = nOfShape(next, nm, nOut);
    const [t, R] = refractDir(r.d, N, n1, n2);
    if (!t) { stack.push({ p: q, d: reflectDir(r.d, N), I: r.I, cur: r.cur, k: r.k + 1, tir: true }); continue; }
    stack.push({ p: q, d: t, I: r.I * (1 - R), cur: next, k: r.k + 1 });
    if (branch && r.I * R >= minI) stack.push({ p: q, d: reflectDir(r.d, N), I: r.I * R, cur: r.cur, k: r.k + 1 });
  }
  return { segs, ends };
}

// ---------------------------------------------------------------- the sequential lens tracer
// Surfaces in order along +x: { x: vertex, R: signed radius (centre at x + R; Infinity for flat),
// n: index after the surface, h: half aperture }. Returns the path points and the final direction, or
// blocked/tir flags. Exact vector Snell at each spherical surface (no small-angle shortcuts).
export function traceSeq(surfs, p0, d0, n0 = 1) {
  let p = p0.slice(), d = norm2(d0), n = n0;
  const pts = [p.slice()];
  for (const s of surfs) {
    let q, N;
    if (!isFinite(s.R)) {
      if (Math.abs(d[0]) < 1e-9) return { pts, d, blocked: true };
      const t = (s.x - p[0]) / d[0]; if (t < 0) return { pts, d, blocked: true };
      q = [p[0] + t * d[0], p[1] + t * d[1]]; N = [-1, 0];
    } else {
      const cx = s.x + s.R, ox = p[0] - cx, oy = p[1];
      const b = ox * d[0] + oy * d[1], cc = ox * ox + oy * oy - s.R * s.R, disc = b * b - cc;
      if (disc < 0) return { pts, d, blocked: true };
      const sq = Math.sqrt(disc), ts = [-b - sq, -b + sq].filter((t) => t > 1e-9);
      if (!ts.length) return { pts, d, blocked: true };
      // the root on the vertex's side of the sphere
      let t = ts[0], best = Infinity;
      for (const tt of ts) { const x = p[0] + tt * d[0]; const dd = Math.abs(x - s.x); if (dd < best) { best = dd; t = tt; } }
      q = [p[0] + t * d[0], p[1] + t * d[1]]; N = norm2([q[0] - cx, q[1]]);
    }
    pts.push(q);
    if (s.h && Math.abs(q[1]) > s.h) return { pts, d, blocked: true };
    if (dot2(N, d) > 0) N = [-N[0], -N[1]];
    const [t] = refractDir(d, N, n, s.n);
    if (!t) return { pts, d, tir: true };
    p = q; d = t; n = s.n;
  }
  return { pts, d, n };
}
// Where a ray leaving (p, d) crosses the line x = X (y), or where it crosses the axis y = 0 (x).
export const yAtX = (p, d, X) => p[1] + ((X - p[0]) / d[0]) * d[1];
export const xAtAxis = (p, d) => p[0] - (p[1] / d[1]) * d[0];
// Back focal point: trace a ray parallel to the axis very close to it, and see where it crosses.
export function backFocus(surfs, n0 = 1, h = 1e-4) {
  const r = traceSeq(surfs, [surfs[0].x - 1, h], [1, 0], n0);
  if (r.blocked || r.tir) return NaN;
  const last = r.pts[r.pts.length - 1];
  return xAtAxis(last, r.d);
}

// ---------------------------------------------------------------- colours
export const COL = {
  ray: '#ff4d4d',       // the laser
  refl: '#ff9a8a',      // reflected light
  n1: '#ffb547',        // angle of incidence
  n2: '#5ce1a9',        // angle of refraction
  normal: '#9fb3c8',
  crit: '#ff7ad9',      // critical angle and total internal reflection
  sun: '#fff2c0',
  sky: '#8fc8ff',
  text: '#e8eef8',
  dim: 'rgba(255,255,255,.6)',
};
export const hex = (c) => new THREE.Color(c).getHex();
// Visible wavelength (nm) to an sRGB colour string (after Dan Bruton's approximation).
export function waveColor(nm) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = -(nm - 645) / 65; } else r = 1;
  const k = nm < 420 ? 0.4 + (0.6 * (nm - 380)) / 40 : nm > 700 ? 0.4 + (0.6 * (780 - nm)) / 80 : 1;
  const f = (v) => Math.round(255 * Math.pow(clamp(v * k, 0, 1), 0.8));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ---------------------------------------------------------------- number formats
export const deg = (rad) => rad / DEG;
export const fmtDeg = (rad, d = 1) => (rad == null || isNaN(rad) ? '–' : (rad / DEG).toFixed(d) + '°');
export const fmt0 = (v) => Math.round(v).toLocaleString('en-US');
export const pct = (v) => (v < 0.1 ? (v * 100).toFixed(1) : Math.round(v * 100)) + '%';
export const kms = (n) => fmt0(Math.round(C / n / 1e6) * 1000) + ' km/s';

// ---------------------------------------------------------------- boards (live charts in 3D)
export function panelBg(g, w, h) { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h); }
export function board(root, w, h, pxW, pxH, draw, pos) {
  const tex = canvasTexture(pxW, pxH, draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex.tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  m.position.set(...pos); root.add(m);
  return Object.assign(tex, { mesh: m });
}
export function axes(g, w, h, { x0 = 84, x1 = w - 28, y0 = h - 64, y1 = 70, xMax, yMax, xMin = 0, yMin = 0, xTicks, yTicks, xFmt = String, yFmt = String, xLabel = '', yLabel = '' }) {
  const X = (x) => x0 + ((x - xMin) / (xMax - xMin)) * (x1 - x0);
  const Y = (y) => y0 - ((y - yMin) / (yMax - yMin)) * (y0 - y1);
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '19px sans-serif';
  for (const t of xTicks) { g.beginPath(); g.moveTo(X(t), y1); g.lineTo(X(t), y0); g.stroke(); const s = xFmt(t); g.fillText(s, X(t) - g.measureText(s).width / 2, y0 + 26); }
  for (const t of yTicks) { g.beginPath(); g.moveTo(x0, Y(t)); g.lineTo(x1, Y(t)); g.stroke(); const s = yFmt(t); g.fillText(s, x0 - 10 - g.measureText(s).width, Y(t) + 6); }
  g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0); g.lineTo(x1, y0); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '18px sans-serif';
  if (xLabel) g.fillText(xLabel, x1 - g.measureText(xLabel).width, y0 + 52);
  if (yLabel) g.fillText(yLabel, x0 + 8, y1 - 10);
  return { X, Y, x0, x1, y0, y1 };
}
export function title(g, text, sub = '') {
  g.fillStyle = COL.text; g.font = 'bold 24px sans-serif'; g.fillText(text, 20, 34);
  if (sub) { const x = 34 + g.measureText(text).width; g.font = '17px sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(sub, x, 34); }
}
export function line(g, pts, X, Y, col, wdt = 4, dash = null) {
  if (pts.length < 2) return;
  g.strokeStyle = col; g.lineWidth = wdt; g.setLineDash(dash || []); g.lineJoin = 'round'; g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
  g.stroke(); g.setLineDash([]);
}
export function dot(g, x, y, col, r = 10) { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
export function text(g, s, x, y, col = COL.text, font = '18px sans-serif') { g.fillStyle = col; g.font = font; g.fillText(s, x, y); }

// ---------------------------------------------------------------- 3D pieces
// A pool of glowing cylinders drawn as laser rays. draw(segs, map) places one per segment:
// seg = { a: [x, y], b: [x, y], I (0–1 brightness), col? }; map turns [x, y] into [x, y, z].
export function rayPool(parent, n = 120, r = 0.03, color = COL.ray) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  const halo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  const up = new THREE.Vector3(0, 1, 0), A = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3();
  const items = Array.from({ length: n }, () => {
    const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hex(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    const glow = new THREE.Mesh(halo, new THREE.MeshBasicMaterial({ color: hex(color), transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    core.add(glow); glow.scale.set(2.6, 1, 2.6);
    core.visible = false; core.renderOrder = 5; parent.add(core);
    return core;
  });
  let used = 0;
  return {
    draw(segs, map = (p) => [p[0], p[1], 0], rr = r) {
      used = 0;
      for (const s of segs) {
        if (used >= n) break;
        if (s.I < 0.004) continue;
        A.set(...map(s.a)); B.set(...map(s.b)); D.subVectors(B, A);
        const L = D.length(); if (L < 1e-5) continue;
        const m = items[used++];
        m.visible = true; m.position.copy(A).addScaledVector(D, 0.5);
        m.quaternion.setFromUnitVectors(up, D.normalize());
        const w = (s.r ?? rr) * (0.55 + 0.45 * Math.sqrt(clamp(s.I, 0, 1)));
        m.scale.set(w, L, w);
        m.material.color.set(s.col || color); m.material.opacity = clamp(0.15 + s.I, 0, 1);
        m.children[0].material.color.set(s.col || color); m.children[0].material.opacity = 0.28 * clamp(s.I * 1.5, 0, 1);
      }
      for (let i = used; i < n; i++) items[i].visible = false;
    },
    hide() { items.forEach((m) => { m.visible = false; }); used = 0; },
  };
}
// A flat wedge marking an angle: set(centre [x,y,z], radius, start angle, sweep) in the x–y plane.
export function wedge(parent, color, opacity = 0.35) {
  const mat = M.ghost(hex(color), opacity);
  const m = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.2, 8), mat); m.renderOrder = 4; parent.add(m);
  const edge = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: hex(color), transparent: true, opacity: 0.9 })); parent.add(edge);
  let key = '';
  m.set = (c, r, a0, sw) => {
    const k = [r, a0, sw].map((v) => v.toFixed(4)).join('|');
    m.position.set(...c); edge.position.set(...c);
    m.visible = edge.visible = Math.abs(sw) > 0.004;
    if (k === key) return; key = k;
    const s0 = sw < 0 ? a0 + sw : a0, L = Math.abs(sw);
    m.geometry.dispose(); m.geometry = new THREE.RingGeometry(r * 0.12, r, 40, 1, s0, L);
    const pts = []; for (let i = 0; i <= 40; i++) { const a = s0 + (L * i) / 40; pts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), 0)); }
    edge.geometry.dispose(); edge.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  };
  m.hideAll = () => { m.visible = edge.visible = false; };
  return m;
}
// A dashed straight line between two 3D points, made of short thin boxes.
export function dashed(parent, a, b, color = COL.normal, dash = 0.14, r = 0.012) {
  const g = new THREE.Group(); parent.add(g);
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B), n = Math.max(1, Math.floor(L / (dash * 2)));
  const mat = M.glow(hex(color), { transparent: true, opacity: 0.8 });
  for (let i = 0; i < n; i++) {
    const p = A.clone().lerp(B, (i * 2 + 0.5) / (n * 2)), q = A.clone().lerp(B, (i * 2 + 1.5) / (n * 2));
    const m = beam(p.toArray(), q.toArray(), r, mat, 6); m.castShadow = false; g.add(m);
  }
  return g;
}
// A small laser pointer. aim([x,y,z], [dx,dy]) puts its tip at the point, pointing along the direction.
export function laser(parent, color = COL.ray, len = 1.1, r = 0.11) {
  const g = new THREE.Group(); parent.add(g);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), M.metal(0x3a3f4b, { roughness: 0.35 })); body.position.y = -len / 2; g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, len * 0.12, 24), M.plastic(0xffb547)); band.position.y = -len * 0.7; g.add(band);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.8, 0.12, 20), M.metal(0xc9ced8)); tip.position.y = 0.0; g.add(tip);
  const led = new THREE.Mesh(new THREE.SphereGeometry(r * 0.4, 12, 8), M.glow(hex(color))); led.position.y = 0.06; g.add(led);
  const up = new THREE.Vector3(0, 1, 0);
  g.aim = (p, d) => { g.position.set(...p); g.quaternion.setFromUnitVectors(up, new THREE.Vector3(d[0], d[1], 0).normalize()); };
  return g;
}
// A simple eye (white ball, coloured iris, black pupil) looking along `dir`.
export function eyeball(parent, r = 0.18) {
  const g = new THREE.Group(); parent.add(g);
  g.add(sphere(r, M.plastic(0xf4f1ea)));
  const iris = new THREE.Mesh(new THREE.CircleGeometry(r * 0.5, 24), M.matte(0x3d7bd9)); iris.position.z = r * 0.99; g.add(iris);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(r * 0.24, 20), M.matte(0x050505)); pupil.position.z = r * 1.0; g.add(pupil);
  const f = new THREE.Vector3(0, 0, 1);
  g.look = (p, d) => { g.position.set(...p); g.quaternion.setFromUnitVectors(f, new THREE.Vector3(d[0], d[1], d[2] || 0).normalize()); };
  return g;
}
// Moving dots: n glowing spheres placed each frame with place(i, x, y, z, s).
export function dots(n, r, color = 0xffffff, seg = 8) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)), new THREE.MeshBasicMaterial({ color, toneMapped: false }), n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const o = new THREE.Object3D();
  mesh.place = (i, x, y, z, s = 1) => { o.position.set(x, y, z); o.scale.setScalar(Math.max(0.0001, s)); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); };
  mesh.hideFrom = (i) => { for (let k = i; k < n; k++) mesh.place(k, 0, -500, 0, 0.0001); };
  mesh.done = () => { mesh.instanceMatrix.needsUpdate = true; };
  return mesh;
}
// Walk along a polyline of segments: where is the point at distance s? (for light pulses)
export function along(segs, s) {
  for (const g of segs) {
    const L = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]);
    if (s <= L) { const k = s / L; return [g.a[0] + (g.b[0] - g.a[0]) * k, g.a[1] + (g.b[1] - g.a[1]) * k, g]; }
    s -= L;
  }
  return null;
}
// A flat slab of see-through material, w × h in the x–y plane, d deep, with its top edge at y = top.
export function slab(parent, w, h, d, color, opacity = 0.2) {
  const m = box(w, h, d, M.clear(hex(color), opacity, { depthWrite: false })); m.castShadow = false; m.receiveShadow = false; parent.add(m);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: hex(color), transparent: true, opacity: 0.45 }));
  m.add(edges); m.edges = edges;
  return m;
}
// Extrude a 2D polygon ([x, y] points) into a see-through prism d deep, centred on z = 0.
export function prismMesh(pts, d, color, opacity = 0.22) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(g, M.clear(hex(color), opacity, { depthWrite: false }));
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: hex(color), transparent: true, opacity: 0.55 }));
  m.add(edges);
  return m;
}

// ---------------------------------------------------------------- layout
export const inReel = () => document.body.classList.contains('gb-reel');
// On a phone-width stage: hide minor labels and nudge the picture down, clear of the readout.
export function fitNarrow(stage, minor = []) {
  const narrow = stage.host.clientWidth < 560;
  minor.forEach((l) => { if (l) l.visible = !narrow; });
  const y = narrow && !inReel() ? -0.12 : 0;
  if (!stage.shift || stage.shift[1] !== y) stage.setShift(0, y);
  return narrow;
}
// Boards sit beside the model on a wide screen. In the tall reel video they move to `pos` instead.
export function reelPlace(boards) {
  const r = inReel();
  boards.forEach(([b, pos, scale = 1.25]) => {
    if (!b.home) b.home = { p: b.mesh.position.clone(), r: b.mesh.rotation.y };
    if (r) { b.mesh.position.set(...pos); b.mesh.scale.setScalar(scale); b.mesh.rotation.y = 0; }
    else { b.mesh.position.copy(b.home.p); b.mesh.scale.setScalar(1); b.mesh.rotation.y = b.home.r; }
  });
}
// Switch between scenes laid out side by side: show the one for `focus`, move the camera to its view.
export function focusSwitch(stage, groups, views) {
  let cur = '';
  return (focus) => {
    Object.entries(groups).forEach(([k, g]) => { g.visible = k === focus; });
    if (focus !== cur) { const first = !cur; cur = focus; if (!first && !inReel()) { const v = views[focus]; stage.setView(v.pos, v.target, 1.0); } return true; }
    return false;
  };
}
export { clamp, sphere, box, beam, rod };

// ---------------------------------------------------------------- looking into water
// An eye at E (in air) looks at a point P under a flat water surface at height WY. Find where the sight
// line crosses the surface (S) so that Snell holds there, n sin θ_water = sin θ_air, by bisection.
// The apparent position A is where the eye's straight line back through S meets the vertical through
// P (the usual convention; straight down it gives the textbook apparent depth = real depth ÷ n).
export function sightThrough(P, E, WY, n) {
  const f = (x) => {
    const sw = (x - P[0]) / Math.hypot(x - P[0], WY - P[1]), sa = (E[0] - x) / Math.hypot(E[0] - x, E[1] - WY);
    return n * sw - sa;
  };
  let lo = Math.min(P[0], E[0]), hi = Math.max(P[0], E[0]);
  if (Math.abs(hi - lo) < 1e-9) return { S: [P[0], WY], A: [P[0], WY - (WY - P[1]) / n], thW: 0, thA: 0 };
  const flo = f(lo);
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; (f(m) > 0) === (flo > 0) ? (lo = m) : (hi = m); }
  const xs = (lo + hi) / 2, S = [xs, WY];
  const thW = Math.atan2(Math.abs(xs - P[0]), WY - P[1]), thA = Math.atan2(Math.abs(E[0] - xs), E[1] - WY);
  let yA;
  if (Math.abs(xs - P[0]) < 1e-6) yA = WY - (WY - P[1]) / n;
  else yA = WY + ((WY - E[1]) * (P[0] - xs)) / (xs - E[0]);
  return { S, A: [P[0], yA], thW, thA };
}
// Place a mesh and hand it back: at(mesh, x, y, z).
export const at = (m, x, y, z = 0) => { m.position.set(x, y, z); return m; };

// Many polylines drawn as screen-space fat lines in one mesh: set([{ pts: [[x, y, z], …], col }]).
export function fatLines(stage, parent, width = 2.5) {
  const mat = stage.lineMaterial({ linewidth: width, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
  let mesh = null;
  const c = new THREE.Color();
  return {
    set(lines) {
      const pos = [], col = [];
      for (const l of lines) {
        c.set(l.col || '#ffffff');
        for (let i = 0; i < l.pts.length - 1; i++) { pos.push(...l.pts[i], ...l.pts[i + 1]); col.push(c.r, c.g, c.b, c.r, c.g, c.b); }
      }
      if (mesh) { parent.remove(mesh); mesh.geometry.dispose(); }
      if (!pos.length) { mesh = null; return; }
      const g = new LineSegmentsGeometry(); g.setPositions(pos); g.setColors(col);
      mesh = new LineSegments2(g, mat); mesh.renderOrder = 5; parent.add(mesh);
    },
  };
}
