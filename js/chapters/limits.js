// Chapter 5: where the simple picture bends. Three scenes.
// Mirage (heights stretched 60×: 1 scene unit = 30 m along the road and 0.5 m up). Air's index depends on
//   its density: n − 1 ≈ 2.93 × 10⁻⁴ × 273 K ÷ T at sea-level pressure (Edlén-type approximation for
//   visible light). A hot road heats the air just above it; we use T(y) = T_air + (T_road − T_air) e^(−y/0.1 m).
//   Hot air has the lower index, so light skimming the road curves back upwards: a gradient-index medium,
//   Snell's law applied continuously. Rays obey n(y) cos α = constant (α measured from the horizontal),
//   integrated here as y″ = (dn/dy ÷ n)(1 + y′²) in 0.5 m steps. With a 60 °C road under 35 °C air,
//   Δn ≈ 2 × 10⁻⁵, so only rays within about 0.37° of the road turn back: the "water" starts a couple of
//   hundred metres ahead for an eye 1.5 m up.
// Negative index (schematic): a slab with n = −1 bends light to the same side of the normal
//   (sin θ₂ = sin θ₁ ÷ n), so rays from a point meet inside the slab and again beyond it: Veselago (1967)
//   and Pendry's "perfect lens" (2000). First shown for microwaves by Shelby, Smith and Schultz (Science,
//   2001) with copper split rings and wires, cells much smaller than the 3 cm wavelength.
// Why light slows (the Ewald–Oseen picture, simplified; Feynman Lectures vol. I, ch. 31): the light's
//   electric field shakes the electrons in the glass; each re-radiates a little wave slightly behind in
//   step. Added to the original, the total is a wave whose crests move at c ÷ n, with wavelength λ ÷ n
//   and the same frequency. Between atoms, light always travels at c. Reflections and the small change
//   of amplitude at the faces are left out.
import { THREE, M, box, rod, tube, torus } from '../kit.js';
import {
  COL, DEG, C, hex, board, panelBg, axes, title, line, dot, text, rayPool, dots, eyeball, fitNarrow, reelPlace, inReel, focusSwitch,
  clamp, sphere, beam, at, fmtDeg, kms, fatLines,
} from '../snell.js';

const X = { mirage: 0, meta: 40, myth: 75 };
const VIEWS = {
  mirage: { pos: [2.5, 6.0, 15.5], target: [2.5, 5.2, 0] },
  meta: { pos: [41.8, 7.2, 14], target: [41.8, 6.4, 0] },
  myth: { pos: [75.8, 7.4, 14.5], target: [75.8, 6.8, 0] },
};
// ---- mirage physics (metres, kelvin)
const K0 = 273.15, NA0 = 2.93e-4, LH = 0.1, EYE_H = 1.5, T_AIR = 35;
export const nAir = (T) => 1 + (NA0 * K0) / (T + K0);
const Tof = (y, Troad) => T_AIR + (Troad - T_AIR) * Math.exp(-Math.max(0, y) / LH);
const nOfY = (y, Troad) => nAir(Tof(y, Troad));
function dndy(y, Troad) { const T = Tof(y, Troad) + K0, dT = -((Troad - T_AIR) / LH) * Math.exp(-Math.max(0, y) / LH); return (-(NA0 * K0) / (T * T)) * dT; }
// Follow a sight line from the eye, α below the horizontal, out to xMax metres. Returns points and
// whether it ends on the road or up in the sky.
export function sightLine(alpha, Troad, xMax = 420) {
  let x = 0, y = EYE_H, s = -Math.tan(alpha); const pts = [[0, y]], dx = 0.5;
  while (x < xMax) {
    const n = nOfY(y, Troad), a = (dndy(y, Troad) / n) * (1 + s * s);
    s += a * dx; y += s * dx; x += dx;
    if (y <= 0) { pts.push([x, 0]); return { pts, road: true, x }; }
    const every = y < 0.6 ? 2.5 : 20;
    if (Math.floor(x / every) !== Math.floor((x - dx) / every)) pts.push([x, y]);
  }
  pts.push([x, y]);
  return { pts, road: false, x };
}
export function mirage(Troad) {
  const dn = nOfY(EYE_H, Troad) - nOfY(0, Troad);
  // the steepest ray that still turns back: bisection on α
  let lo = 0, hi = 1.5 * DEG;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; sightLine(m, Troad, 2000).road ? (hi = m) : (lo = m); }
  return { dn, crit: lo, start: lo > 1e-6 ? EYE_H / Math.tan(lo) : Infinity };
}
const MX = 1 / 30, MY = 2;                                  // metres → scene units
// ---- negative index slab
const SL = { x0: -1.2, d: 3.2, h: 3.6, y: 4.8 };
// ---- wave
const WV = { x0: -7.5, x1: 8.5, g0: -2.2, g1: 3.2, y: 5.0, amp: 0.75, lam: 1.9 };

export default {
  id: 'limits',
  short: 'Surprises and limits',
  title: 'Mirages, backwards bending, and why light really slows',
  subtitle: 'Snell’s law bends in hot air, breaks the rules in metamaterials, and hides a common myth.',
  view: VIEWS.mirage,
  learn: `<p><b>Mirages on hot roads.</b> On a summer afternoon in India, the road ahead seems to have a shining puddle that is never there when you arrive. The road heats the air just above it. Hot air is thinner, so its index is a tiny bit lower. There's no sharp surface, so the light doesn't bend all at once: it curves smoothly, bending away from the hotter air, until light from the sky skims up off the road and into your eye. You're seeing the <b>sky</b>, upside down, on the road. The change in n is only about 0.00002, so it works only for light grazing the road at less than half a degree.</p>
    <p><b>Bending the wrong way.</b> In every natural material n is positive, and light crosses to the other side of the normal. Around 2000, scientists built <b>metamaterials</b>, arrays of tiny copper rings and wires, with a <b>negative index</b>. Light then bends to the <b>same side</b> of the normal. A flat slab with n = −1 even focuses light like a lens. It has only worked well for microwaves and in labs; at visible light these materials still soak up too much light.</p>
    <p><b>Myth-buster: “Light slows down in glass because it keeps bumping into atoms.”</b> Not really. Between atoms, light always travels at full speed, c. It isn't stopped and delayed at random either: that would scatter light every which way and blur the view through a window. What happens is this. The light's electric field <b>shakes the electrons</b> in the glass, and each shaken electron sends out its own little wave, slightly <b>behind in step</b>. Add all those little waves to the original and you get a wave whose crests move more slowly: <b>c ÷ n</b>. People sometimes say the light is “absorbed and re-emitted”, but nothing is kept: the electrons pass the energy straight on, and the delay is that small step behind. The frequency never changes, so the colour stays the same, but the wavelength shrinks.</p>
    <p class="tip"><b>Try it:</b> heat the road and watch sky light curl back up. Flip the slab to n = −1 and see the rays cross to the same side. In the myth-buster, turn on the atoms' own waves and watch them add up to the slower wave.</p>`,
  terms: [
    { t: 'Mirage', d: 'An image of the sky or distant things, displaced by light curving through layers of air at different temperatures.' },
    { t: 'Gradient index', d: 'A material whose refractive index changes smoothly, so light curves instead of bending at one surface.' },
    { t: 'Metamaterial', d: 'A material made of tiny engineered structures, smaller than the wavelength, with optical properties no natural material has.' },
    { t: 'Negative index', d: 'An index below zero, which makes light bend to the same side of the normal.' },
    { t: 'Phase lag', d: 'Being slightly behind in step. Shaken electrons re-radiate slightly behind the light that shakes them.' },
    { t: 'Frequency', d: 'How many crests pass each second. It never changes when light enters glass, so neither does the colour.' },
  ],
  defaults: { focus: 'mirage', troad: 60, nslab: 'neg', src: 0.5, nglass: 1.5, own: true },
  controls: [
    { key: 'focus', type: 'seg', label: 'Look at', options: [{ v: 'mirage', label: 'Road mirage' }, { v: 'meta', label: 'Negative index' }, { v: 'myth', label: 'Myth-buster' }] },
    { key: 'troad', type: 'range', label: 'Mirage: road surface temperature', min: 35, max: 70, step: 1, ends: ['35 °C (same as the air)', '70 °C'], fmt: (v) => `${v} °C, air ${T_AIR} °C` },
    { key: 'nslab', type: 'seg', label: 'Slab: refractive index', options: [{ v: 'pos', label: 'n = +1.5 (glass)' }, { v: 'neg', label: 'n = −1 (metamaterial)' }] },
    { key: 'src', type: 'range', label: 'Slab: light source distance', min: 0.25, max: 0.9, step: 0.01, ends: ['close', 'far'], fmt: (v) => `${Math.round(v * 100)}% of the slab’s thickness` },
    { key: 'nglass', type: 'range', label: 'Myth: refractive index of the glass', min: 1, max: 2.4, step: 0.01, ends: ['1.0', '2.4'], fmt: (v) => `n = ${v.toFixed(2)}` },
    { key: 'own', type: 'toggle', label: 'Myth: show the electrons’ own waves' },
  ],
  onChange(s, key) {
    if (key === 'troad') s.focus = 'mirage';
    if (key === 'nslab' || key === 'src') s.focus = 'meta';
    if (key === 'nglass' || key === 'own') s.focus = 'myth';
  },
  quiz: [
    { q: 'What is the “water” you see on a hot road?', options: ['Real water that evaporates', 'Light from the sky, curved upwards by hot air near the road', 'Heat radiation you can see', 'Oil on the road'], answer: 1, why: 'Air near the hot road is thinner, with a slightly lower index. Light from the sky grazing the road curves back up to your eye, so you see the sky on the road.' },
    { q: 'What’s special about a material with a negative refractive index?', options: ['Light goes faster than c', 'Light bends to the same side of the normal', 'It reflects everything', 'It has no colour'], answer: 1, why: 'With n < 0, Snell’s law gives a negative angle: the beam bends to the same side of the normal. A flat slab of n = −1 can even focus light.' },
    { q: 'Why does light travel more slowly in glass?', options: ['It bumps into atoms and waits', 'Shaken electrons re-radiate waves slightly behind in step, and the sum moves more slowly', 'Glass is thicker than air', 'The light loses energy'], answer: 1, why: 'Between atoms light moves at c. The electrons it shakes send out waves that lag a little; added to the original, the crests advance at c ÷ n. Frequency and colour stay the same.' },
  ],
  reel: [
    { ms: 5600, caption: 'A mirage is sky light curved up by hot air over the road. No water, just Snell’s law, bit by bit.', set: { focus: 'mirage' }, anim: { troad: [36, 68] }, view: { pos: [1.4, 4.8, 12], target: [1.4, 4.4, 0] }, spin: 0.03 },
    { ms: 5400, caption: 'Myth: light doesn’t slow by bumping into atoms. Shaken electrons add waves that lag behind.', set: { focus: 'myth', own: true }, anim: { nglass: [1.0, 1.8] }, view: { pos: [75.6, 5.4, 11], target: [75.6, 5.0, 0] }, spin: 0.03 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    const G = {}; for (const k of Object.keys(X)) { G[k] = new THREE.Group(); G[k].position.x = X[k]; root.add(G[k]); }
    const sw = focusSwitch(stage, G, VIEWS);
    let S = s0, key = '', time = 0;

    // ================================================================ mirage
    const gm = G.mirage, RX0 = -4, RY = 1.2;                // road starts at x = −4 (the eye), road surface y = 1.2
    const mm = (p) => [RX0 + p[0] * MX, RY + p[1] * MY, 0];
    const road = box(15, 0.12, 3, M.matte(0x2a2c31)); road.position.set(RX0 + 7, RY - 0.06, 0); gm.add(road);
    for (let i = 0; i < 7; i++) { const m = box(0.8, 0.13, 0.08, M.matte(0xf4f1ea)); m.position.set(RX0 + 1 + i * 2, RY - 0.05, 0); gm.add(m); }
    const ground = box(15, RY - 0.12, 3.2, M.matte(0x6b5a44)); ground.position.set(RX0 + 7, (RY - 0.12) / 2, 0); gm.add(ground);
    const heat = new THREE.Mesh(new THREE.PlaneGeometry(15, 0.5), new THREE.MeshBasicMaterial({ color: 0xff7a59, transparent: true, opacity: 0.2, depthWrite: false })); heat.position.set(RX0 + 7, RY + 0.25, 0.01); gm.add(heat);
    // a person at the left, eye 1.5 m up (3 units with the stretched heights)
    const pg = new THREE.Group(); pg.position.set(RX0 - 0.1, RY, -0.3); gm.add(pg);
    pg.add(at(box(0.22, 1.6, 0.2, M.matte(0x2b3a67)), 0, 0.8, 0));
    pg.add(at(box(0.34, 1.2, 0.26, M.matte(0xff7a59)), 0, 2.2, 0));
    pg.add(at(sphere(0.2, M.matte(0xc68a5e)), 0, 3.0, 0));
    const eyeM = eyeball(gm, 0.07); eyeM.look([RX0 + 0.1, RY + EYE_H * MY, -0.1], [1, 0, 0.3]);
    // a tree far down the road, and the sky
    const tree = new THREE.Group(); tree.position.set(RX0 + 13.2, RY, 0); gm.add(tree);
    tree.add(at(beam([0, 0, 0], [0, 1.4, 0], 0.09, M.matte(0x6b4a2e)), 0, 0, 0));
    tree.add(at(sphere(0.7, M.matte(0x3f8f4a)), 0, 1.9, 0));
    const skyM = new THREE.Mesh(new THREE.PlaneGeometry(16, 5.5), new THREE.MeshBasicMaterial({ color: 0x6fb6ff, transparent: true, opacity: 0.12, depthWrite: false })); skyM.position.set(RX0 + 7, RY + 4.6, -1.6); gm.add(skyM);
    const puddle = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.6), M.ghost(0x8fc8ff, 0.5)); puddle.rotation.x = -Math.PI / 2; puddle.position.y = RY + 0.01; gm.add(puddle);
    const mRays = fatLines(stage, gm, 2.2);
    const lPuddle = stage.label('', [0, 0, 0], gm, 'hot'), lStretch = stage.label('heights stretched 60×', [RX0 + 11, RY - 0.6, 1.5], gm);
    lPuddle.element.style.setProperty('--c', '#8fc8ff');
    const mBoard = board(gm, 3.4, 2.6, 520, 400, (g, w, h) => {
      panelBg(g, w, h);
      title(g, 'Air just above the road', '');
      const { X: XX, Y } = axes(g, w, h, { x0: 88, y1: 58, y0: h - 58, xMin: 30, xMax: 72, yMax: 0.6, xTicks: [30, 40, 50, 60, 70], yTicks: [0, 0.2, 0.4, 0.6], xFmt: (v) => v + '°', yFmt: (v) => v.toFixed(1) + ' m', xLabel: 'temperature' });
      const pts = []; for (let y = 0; y <= 0.6; y += 0.01) pts.push([Tof(y, S.troad), y]);
      line(g, pts.map(([t, y]) => [t, y]), XX, Y, '#ff7a59', 4);
      text(g, `n at the road: ${nOfY(0, S.troad).toFixed(6)}`, 100, 96, '#8fc8ff', '17px sans-serif');
      text(g, `n 1.5 m up:    ${nOfY(EYE_H, S.troad).toFixed(6)}`, 100, 120, '#8fc8ff', '17px sans-serif');
    }, [RX0 + 12.2, RY + 5.6, -0.8]);
    mBoard.mesh.rotation.y = -0.15;

    // ================================================================ negative index slab
    const gn = G.meta;
    const slabM = M.clear(0xc49bff, 0.16, { depthWrite: false });
    const slab = box(SL.d, SL.h * 2, 2.4, slabM); slab.position.set(SL.x0 + SL.d / 2, SL.y, 0); slab.castShadow = false; gn.add(slab);
    const rings = new THREE.Group(); gn.add(rings);
    const cu = M.metal(0xd08a4a, { roughness: 0.35 });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 20, Math.PI * 1.8), cu);
      r.position.set(SL.x0 + 0.4 + i * 0.8, SL.y - SL.h + 0.5 + j * 1.07, 1.21); rings.add(r);
      rings.add(at(box(0.03, 0.6, 0.03, cu), SL.x0 + 0.8 + i * 0.8, SL.y - SL.h + 0.5 + j * 1.07, 1.21));
    }
    const gStand = box(SL.d + 1, 0.16, 2.8, M.matte(0x2b3039)); gStand.position.set(SL.x0 + SL.d / 2, SL.y - SL.h - 0.08, 0); gn.add(gStand);
    const srcDot = sphere(0.12, M.glow(0xffe08a)); gn.add(srcDot);
    const nRays = rayPool(gn, 60, 0.025, '#ffe08a');
    const img1 = sphere(0.1, M.glow(0x5ce1a9)), img2 = sphere(0.1, M.glow(0x5ce1a9)); gn.add(img1, img2);
    const lSlab = stage.label('', [SL.x0 + SL.d / 2, SL.y + SL.h + 0.35, 0], gn, 'hot'), lRings = stage.label('copper split rings and wires', [SL.x0 + SL.d / 2, SL.y - SL.h - 0.5, 1.3], gn);
    lSlab.element.style.setProperty('--c', '#c49bff');
    const lImg = stage.label('', [0, 0, 0], gn, 'hot'); lImg.element.style.setProperty('--c', '#5ce1a9');

    // ================================================================ myth-buster: waves in glass
    const gw = G.myth;
    const glassBlock = box(WV.g1 - WV.g0, 3.2, 2.2, M.clear(0x8fe3d0, 0.14, { depthWrite: false })); glassBlock.position.set((WV.g0 + WV.g1) / 2, WV.y, 0); glassBlock.castShadow = false; gw.add(glassBlock);
    const axis = beam([WV.x0, WV.y, 0], [WV.x1, WV.y, 0], 0.01, M.glow(0x3a4458)); gw.add(axis);
    const NP = 220, wInc = dots(NP, 0.05, 0x9fb3c8), wOwn = dots(NP, 0.04, 0xc49bff), wTot = dots(NP, 0.065, 0xff4d4d), wRef = dots(NP, 0.035, 0x6d7380);
    gw.add(wInc, wOwn, wTot, wRef);
    const NA_ = 6, NR = 3, atoms = dots(NA_ * NR * 2, 0.07, 0xffe08a); gw.add(atoms);
    const nuclei = []; for (let i = 0; i < NA_; i++) for (let j = 0; j < NR; j++) nuclei.push([WV.g0 + 0.45 + (i * (WV.g1 - WV.g0 - 0.9)) / (NA_ - 1), WV.y - 1.1 + j * 1.1]);
    const lInc = stage.label('light at full speed, for comparison', [WV.x1 - 2.3, WV.y + 1.25, 0], gw), lTot = stage.label('the real light: slower inside', [WV.g1 + 2.2, WV.y - 1.2, 0.3], gw, 'hot');
    lTot.element.style.setProperty('--c', '#ff4d4d');
    const lOwn = stage.label('electrons’ own waves', [WV.g0 + 0.6, WV.y - 1.95, 0.3], gw, 'hot'); lOwn.element.style.setProperty('--c', '#c49bff');
    const lGlass = stage.label('', [(WV.g0 + WV.g1) / 2, WV.y - 1.95, 1.2], gw);

    const res = { mir: mirage(60) };
    return {
      update(dt, s) {
        dt = Math.max(0, dt); S = s; time += dt;
        fitNarrow(stage, [lStretch, lRings, lInc, lOwn, lGlass]);
        reelPlace([[mBoard, [RX0 + 5, RY + 7.4, 0], 1.3]]);
        sw(s.focus);
        // ---- the waves animate every frame
        if (s.focus === 'myth') {
          const k = (2 * Math.PI) / WV.lam, w = 2.2, n = s.nglass, L = WV.g1 - WV.g0, A = WV.amp;
          const tot = (x) => (x < WV.g0 ? Math.sin(k * x - w * time) : x <= WV.g1 ? Math.sin(k * WV.g0 + n * k * (x - WV.g0) - w * time) : Math.sin(k * x + (n - 1) * k * L - w * time));
          for (let i = 0; i < NP; i++) {
            const x = WV.x0 + ((WV.x1 - WV.x0) * i) / (NP - 1), inc = Math.sin(k * x - w * time), T = tot(x);
            wTot.place(i, x, WV.y + A * T, 0.05);
            wRef.place(i, x, WV.y + A * inc, -0.05, x > WV.g0 ? 1 : 0.0001);
            const inside = x >= WV.g0 && x <= WV.g1;
            wOwn.place(i, x, WV.y + A * (T - inc), 0.1, s.own && inside ? 1 : 0.0001);
          }
          let a = 0;
          for (const [x, y] of nuclei) { const e = tot(x); atoms.place(a++, x, y + 0.22 * e, 0.3); atoms.place(a++, x, y, 0.3, 0.45); }
          [wTot, wRef, wOwn, atoms].forEach((m) => m.done());
          wInc.visible = false;
        }
        const kk = JSON.stringify([s.focus, s.troad, s.nslab, s.src]);
        if (kk === key) return;
        key = kk;
        if (s.focus === 'mirage') {
          const m = (res.mir = mirage(s.troad)), lines = [];
          // sight lines from the eye, fanning from nearly level to 1.2° down
          for (let i = 0; i <= 26; i++) {
            const a = (0.04 + (1.16 * i) / 26) * DEG, r = sightLine(a, s.troad, 435);
            lines.push({ pts: r.pts.map(mm), col: r.road ? '#59606c' : COL.sky });
          }
          mRays.set(lines);
          const on = isFinite(m.start) && m.start < 440;
          puddle.visible = on;
          if (on) { const x0 = RX0 + m.start * MX, x1 = RX0 + 14; puddle.scale.x = Math.max(0.01, x1 - x0); puddle.position.x = (x0 + x1) / 2; }
          lPuddle.visible = on; lPuddle.position.set(RX0 + Math.min(440, m.start) * MX + 1.2, RY + 0.55, 1.3); lPuddle.element.innerHTML = 'the “water”: <b>sky light</b>';
          mBoard.redraw();
        }
        if (s.focus === 'meta') {
          const neg = s.nslab === 'neg', n = neg ? -1 : 1.5, a = s.src * SL.d, sx = SL.x0 - a, segs = [];
          for (let i = -4; i <= 4; i++) {
            if (!i) continue;
            const th = i * 11 * DEG, t1 = Math.tan(th);
            const y1 = SL.y + a * t1;                                     // where it enters the slab
            if (Math.abs(y1 - SL.y) > SL.h) continue;
            const th2 = Math.asin(Math.sin(th) / n), y2 = y1 + SL.d * Math.tan(th2);
            segs.push({ a: [sx, SL.y], b: [SL.x0, y1], I: 0.9 });
            segs.push({ a: [SL.x0, y1], b: [SL.x0 + SL.d, y2], I: 0.9, col: '#ffd0f0' });
            segs.push({ a: [SL.x0 + SL.d, y2], b: [SL.x0 + SL.d + 4.2, y2 + 4.2 * t1], I: 0.9 });
          }
          nRays.draw(segs);
          srcDot.position.set(sx, SL.y, 0);
          img1.visible = img2.visible = neg;
          img1.position.set(SL.x0 + a, SL.y, 0); img2.position.set(SL.x0 + SL.d + (SL.d - a), SL.y, 0);
          lImg.visible = neg; lImg.position.set(SL.x0 + SL.d + (SL.d - a), SL.y + 0.5, 0); lImg.element.innerHTML = 'focus';
          lSlab.element.innerHTML = neg ? 'n = <b>−1</b>: bends to the same side' : 'n = <b>+1.5</b>: ordinary glass';
          slabM.color.set(neg ? '#c49bff' : '#8fe3d0'); rings.visible = neg;
          lRings.visible = neg;
        }
        if (s.focus === 'myth') lGlass.element.innerHTML = `glass, n = ${s.nglass.toFixed(2)}`;
      },
      readout(s) {
        if (s.focus === 'meta') {
          const neg = s.nslab === 'neg', n = neg ? -1 : 1.5, th = 33 * DEG, th2 = Math.asin(Math.sin(th) / n);
          return `<div class="big">sin θ₂ = sin θ₁ ÷ n</div>
            <div class="row"><span>Slab index, n</span><b style="color:#c49bff">${neg ? '−1' : '+1.5'}</b></div>
            <div class="row"><span>A ray at θ₁ = 33° goes on at θ₂</span><b>${fmtDeg(th2)}</b></div>
            <div class="row"><span>Which side of the normal?</span><b>${neg ? 'the same side' : 'the other side'}</b></div>
            <div class="row"><span>Rays from the point meet again?</span><b class="${neg ? 'ok' : 'no'}">${neg ? 'yes, twice' : 'no, they spread'}</b></div>
            <small>${neg ? 'Veselago predicted this in 1967. In 2001 a team in San Diego showed it with microwaves, using copper rings and wires far smaller than the 3 cm waves.' : 'Ordinary materials bend light across the normal, so a flat slab can’t focus.'} Negative-index materials for visible light are still lab experiments: they absorb too much.</small>`;
        }
        if (s.focus === 'myth') {
          const n = s.nglass;
          return `<div class="big">v = c ÷ n, λ<sub>glass</sub> = λ ÷ n</div>
            <div class="row"><span>Speed of the crests in the glass</span><b style="color:#ff4d4d">${kms(n)}</b></div>
            <div class="row"><span>600 nm orange light: wavelength inside</span><b>${(600 / n).toFixed(0)} nm</b></div>
            <div class="row"><span>Frequency (so the colour)</span><b class="ok">unchanged, 500 THz</b></div>
            <div class="row"><span>Lag after 1 cm of this glass</span><b>${(((n - 1) * 0.01) / C * 1e12).toFixed(1)} ps</b></div>
            <small>Grey dots: light at full speed. Purple: the waves the shaken electrons send out, slightly behind in step. Red: the two added together, the light that really travels. Between atoms, everything moves at c.</small>`;
        }
        const m = res.mir;
        return `<div class="big">n(y) cos α = constant</div>
          <div class="row"><span>Road · air 1.5 m up</span><b>${s.troad} °C · ${T_AIR} °C</b></div>
          <div class="row"><span>Index difference, Δn</span><b style="color:#8fc8ff">${(m.dn * 1e6).toFixed(1)} × 10⁻⁶</b></div>
          <div class="row"><span>Light turns back if it grazes the road at less than</span><b style="color:${COL.crit}">${m.crit > 1e-6 ? fmtDeg(m.crit, 2) : 'no angle'}</b></div>
          <div class="row"><span>The “water” starts about</span><b>${isFinite(m.start) && m.start < 2000 ? Math.round(m.start / 10) * 10 + ' m ahead' : 'nowhere'}</b></div>
          <small>No sharp surface: the index changes smoothly, so light curves. It is total internal reflection spread through a layer of air. Blue lines reach the sky, grey ones hit the road.</small>`;
      },
    };
  },
};
