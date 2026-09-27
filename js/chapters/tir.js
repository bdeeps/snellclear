// Chapter 4: total internal reflection. Four scenes, all traced with the 2D tracer in snell.js.
// Fibre (1 scene unit = 50 µm; a 50/125 µm multimode fibre, drawn to scale across and 1.2 mm long):
//   core n = 1.470, cladding n = 1.456 (numerical aperture √(1.470² − 1.456²) = 0.20, a typical value for
//   50 µm graded/step multimode fibre). Critical angle at the core wall asin(1.456 ÷ 1.470) = 82.1°, so
//   rays within ±11.7° of the axis outside the fibre (the acceptance angle, asin NA) are trapped. The
//   plastic coating outside the cladding absorbs any light that leaks into the cladding. Light in the core
//   travels at c ÷ 1.47 ≈ 204,000 km/s: about 4.9 µs per km. Modern fibre loses about 0.2 dB/km at
//   1,550 nm (Corning SMF-28 spec sheet: ≤ 0.18–0.20 dB/km).
// Diamond (a slice through a round brilliant, 4 units across): Tolkowsky's 1919 proportions: table
//   53% of the width, crown angle 34.5°, pavilion angle 40.75°. Light falling on the table meets the
//   pavilion facets at about 41° from their normal. Diamond's critical angle is 24.4°, so it reflects
//   totally, twice, and comes back out of the top. Glass (critical 41.8°) lets most of it out through the
//   bottom. Cubic zirconia (n ≈ 2.16, critical 27.6°) behaves nearly like diamond. The 2D slice is a
//   simplification of a 3D gem.
// Porro prism (binoculars): a right-angled glass prism. Light enters the long face, meets each short
//   face at 45° and reflects totally, coming back out turned round. BK7 glass (n = 1.517, critical 41.2°)
//   starts to leak when light inside is tilted more than 3.8°; BaK4 (n = 1.569, critical 39.6°) holds
//   on to 5.4°, which is why good binoculars advertise BaK4 prisms.
// Light guide (TVClear's edge-lit LCD; thickness stretched about 20×): an acrylic plate (PMMA, n = 1.49,
//   critical 42.2°) lit by LEDs along one edge. Light from the LEDs enters the edge and meets the flat faces
//   at 64° or more from the normal, so it is trapped. White dots printed on the back scatter it upwards,
//   steeply enough to escape through the front towards the LCD. The dots are printed denser far from the
//   LEDs so the screen glows evenly.
import { THREE, M, box, latheX, rod } from '../kit.js';
import {
  COL, DEG, C, hex, trace, shapePoly, screenEdge, critical, nAt, waveColor, fmtDeg, kms, pct, rayPool, laser, dots, along, prismMesh,
  fitNarrow, reelPlace, inReel, focusSwitch, clamp, sphere, beam, at,
} from '../snell.js';

const X = { fibre: 0, diamond: 40, porro: 70, guide: 100 };
const VIEWS = {
  fibre: { pos: [2.2, 6.0, 18.5], target: [2.2, 5.0, 0] },
  diamond: { pos: [41.6, 6.9, 12.5], target: [41.6, 6.1, 0] },
  porro: { pos: [71.4, 7.8, 15], target: [71.4, 7.0, 0] },
  guide: { pos: [101.6, 5.6, 13], target: [101.6, 4.8, 0] },
};
// ---- fibre
const FB = { nc: 1.47, ncl: 1.456, rc: 0.5, rcl: 1.25, L: 18, x0: -6, y: 3.0 };
function fibreShapes(s) {
  const { rc, rcl, L, x0, y } = FB, x1 = x0 + L;
  const core = { n: FB.nc, edges: [], parent: null };
  if (s.clad) {
    const clad = { n: FB.ncl, edges: [], parent: null };
    const E = (a, b, o = {}) => ({ a, b, shape: clad, ...o });
    clad.edges.push(E([x0, y + rcl], [x1, y + rcl], { stop: true }), E([x0, y - rcl], [x1, y - rcl], { stop: true }),
      E([x0, y + rc], [x0, y + rcl]), E([x0, y - rcl], [x0, y - rc]), E([x1, y + rc], [x1, y + rcl]), E([x1, y - rcl], [x1, y - rc]));
    core.parent = clad;
    core.edges.push({ a: [x0, y - rc], b: [x0, y + rc], shape: core, out: null }, { a: [x1, y - rc], b: [x1, y + rc], shape: core, out: null },
      { a: [x0, y + rc], b: [x1, y + rc], shape: core }, { a: [x0, y - rc], b: [x1, y - rc], shape: core });
    return [core, clad];
  }
  core.edges.push({ a: [x0, y - rc], b: [x0, y + rc], shape: core }, { a: [x1, y - rc], b: [x1, y + rc], shape: core },
    { a: [x0, y + rc], b: [x1, y + rc], shape: core }, { a: [x0, y - rc], b: [x1, y - rc], shape: core });
  return [core];
}
export function fibreOptics(s) {
  const nOuter = s.clad ? FB.ncl : 1, na = Math.sqrt(Math.max(0, FB.nc ** 2 - nOuter ** 2));
  return { nOuter, na, acc: na >= 1 ? Math.PI / 2 : Math.asin(na), crit: Math.asin(nOuter / FB.nc), inside: Math.asin(Math.sin(s.launch * DEG) / FB.nc) };
}
// ---- diamond (a slice through a round brilliant, girdle width D)
const GEM = { D: 4, y: 3.6 };
const GEMS = { diamond: 'Diamond', cz: 'Cubic zirconia', crown: 'Glass' };
function gemPts() {
  const D = GEM.D, h = D / 2, tbl = 0.265 * D, crown = (h - tbl) * Math.tan(34.5 * DEG), pav = h * Math.tan(40.75 * DEG), y = GEM.y;
  return { pts: [[0, y - pav], [h, y], [tbl, y + crown], [-tbl, y + crown], [-h, y]], crown, pav, tbl };
}
// ---- porro
const PR = { a: 3.2, y: 4.8 };
const PRISM_GLASS = { crown: 'BK7 glass', bak4: 'BaK4 glass' };
const porroPts = () => [[-PR.a, PR.y], [PR.a, PR.y], [0, PR.y - PR.a]];        // long face on top, point down
// ---- light guide
const LG = { L: 10, t: 0.5, y: 2.2, x0: -4 };

export default {
  id: 'tir',
  short: 'Trapped light',
  title: 'Total internal reflection: light that can’t get out',
  subtitle: 'Past the critical angle a surface becomes a perfect mirror. The internet, diamonds and binoculars all use it.',
  view: VIEWS.fibre,
  learn: `<p>When light tries to leave a slow material for a faster one, Snell's law runs out of answers past the <b>critical angle</b>. Then <b>every bit</b> of the light reflects back. No mirror is that good: even silver keeps only about 95%. <b>Total internal reflection</b> keeps 100%.</p>
    <p><b>Optical fibre.</b> A glass thread thinner than a hair has a <b>core</b> of slightly slower glass inside a <b>cladding</b>. Light zig-zags down the core, reflecting totally off the cladding again and again, for kilometres. Pulses of infrared light in fibres carry almost all the world's internet, including the undersea cables that land in Mumbai and Chennai. In 1966 Charles Kao worked out that glass pure enough could carry light for kilometres, and won the 2009 Nobel Prize for it.</p>
    <p><b>Diamond sparkle.</b> Diamond's index is so high (2.42) that its critical angle is only <b>24.4°</b>. A well-cut diamond's back facets are angled so light from the top hits them past that angle, bounces twice and comes back out of the top towards you. Cut the same shape in glass (critical angle 41.8°) and the light leaks out of the back.</p>
    <p><b>Binoculars</b> use glass prisms instead of mirrors. Light meets each face at 45°, past glass's critical angle, and reflects totally. <b>TVs</b> use it too: in an edge-lit LCD (see TVClear), LEDs shine into the edge of a clear acrylic plate, total internal reflection carries the light across, and printed white dots let it out evenly towards the screen.</p>
    <p class="tip"><b>Try it:</b> tilt the laser into the fibre past 11.7° and watch light leak, then remove the cladding. Swap the diamond for glass. Tilt the light in the binocular prism and compare BK7 with BaK4 glass. Turn the light guide's dots off.</p>`,
  terms: [
    { t: 'Total internal reflection', d: 'All the light reflecting back at a boundary with a faster material, past the critical angle.' },
    { t: 'Optical fibre', d: 'A glass thread that carries light by total internal reflection. It carries most of the internet.' },
    { t: 'Core and cladding', d: 'A fibre’s centre and the slightly faster glass around it that keeps light in.' },
    { t: 'Acceptance angle', d: 'The widest angle at which light can enter a fibre and still be trapped. Its sine is the numerical aperture.' },
    { t: 'Brilliance', d: 'The white light a gem sends back out of its top. A good cut uses total internal reflection to get it.' },
    { t: 'Light guide plate', d: 'The clear plate in an edge-lit LCD that spreads light from edge LEDs across the whole screen.' },
  ],
  defaults: { focus: 'fibre', launch: 8, clad: true, gem: 'diamond', tilt: 0, fire: false, glass: 'crown', ptilt: 2, dots: true },
  controls: [
    { key: 'focus', type: 'seg', label: 'Look at', options: [{ v: 'fibre', label: 'Fibre' }, { v: 'diamond', label: 'Diamond' }, { v: 'porro', label: 'Binoculars' }, { v: 'guide', label: 'TV light guide' }] },
    { key: 'launch', type: 'range', label: 'Fibre: laser angle into the end', min: 0, max: 40, step: 0.5, ends: ['0°', '40°'], fmt: (v) => v.toFixed(1) + '°' },
    { key: 'clad', type: 'toggle', label: 'Fibre: glass cladding round the core', hint: 'Off: a bare glass rod in air.' },
    { key: 'gem', type: 'seg', label: 'Gem: cut in', options: Object.entries(GEMS).map(([v, label]) => ({ v, label })), fmt: (v) => `n = ${nAt(v).toFixed(2)}, critical ${fmtDeg(critical(nAt(v), 1))}` },
    { key: 'tilt', type: 'range', label: 'Gem: tilt of the light', min: -25, max: 25, step: 0.5, ends: ['−25°', '25°'], fmt: (v) => v.toFixed(1) + '°' },
    { key: 'fire', type: 'toggle', label: 'Gem: split into colours (fire)' },
    { key: 'glass', type: 'seg', label: 'Binoculars: prism glass', options: Object.entries(PRISM_GLASS).map(([v, label]) => ({ v, label })), fmt: (v) => `n = ${nAt(v).toFixed(3)}, critical ${fmtDeg(critical(nAt(v), 1))}` },
    { key: 'ptilt', type: 'range', label: 'Binoculars: light tilted by', min: 0, max: 12, step: 0.1, ends: ['0°', '12°'], fmt: (v) => v.toFixed(1) + '°' },
    { key: 'dots', type: 'toggle', label: 'TV: white dots printed on the back' },
  ],
  onChange(s, key) {
    if (['launch', 'clad'].includes(key)) s.focus = 'fibre';
    if (['gem', 'tilt', 'fire'].includes(key)) s.focus = 'diamond';
    if (['glass', 'ptilt'].includes(key)) s.focus = 'porro';
    if (key === 'dots') s.focus = 'guide';
  },
  quiz: [
    { q: 'Why does an optical fibre have a cladding of slightly faster glass around its core?', options: ['To make it stronger', 'So light hitting the core wall at a shallow angle is totally reflected and stays in', 'To colour the light', 'To slow the light down'], answer: 1, why: 'Total internal reflection needs light going from slower (core, 1.47) to faster (cladding, 1.456) glass. The cladding also keeps the reflecting surface clean, so light isn’t lost where the fibre touches something.' },
    { q: 'Why does a diamond sparkle more than a glass copy cut the same way?', options: ['Diamond is harder', 'Its critical angle is only 24°, so light inside reflects totally off the back facets and comes out of the top', 'Diamond glows', 'Glass absorbs light'], answer: 1, why: 'n = 2.42 gives a critical angle of 24.4°. The back facets are hit at about 41°, past it, so light bounces back up. Glass’s critical angle is 41.8°, so light leaks out of the back.' },
    { q: 'A binocular prism reflects light off faces hit at 45°. What’s the smallest index the glass needs for total internal reflection?', options: ['1.00', '1.33', '1.41', '2.42'], answer: 2, why: 'Critical angle 45° means sin 45° = 1 ÷ n, so n = 1.414. Real prism glass (1.52 to 1.57) is safely above it, BaK4 with more to spare.' },
  ],
  reel: [
    { ms: 5600, caption: 'Past the critical angle, glass is a perfect mirror. Fibres trap light for kilometres this way.', set: { focus: 'fibre', clad: true }, anim: { launch: [4, 16] }, view: { pos: [3.0, 4.2, 15.5], target: [3.0, 3.4, 0] }, spin: 0.04 },
    { ms: 5400, caption: 'Diamond’s critical angle is just 24°, so light bounces inside and flashes back out of the top.', set: { focus: 'diamond', gem: 'diamond', fire: true }, anim: { tilt: [-12, 12] }, view: { pos: [40, 5.8, 8.5], target: [40, 5.2, 0] }, spin: 0.06 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    const G = {}; for (const k of Object.keys(X)) { G[k] = new THREE.Group(); G[k].position.x = X[k]; root.add(G[k]); }
    const sw = focusSwitch(stage, G, VIEWS);
    let S = s0, key = '', path = [], pathLen = 0, pulse = 0;

    // ================================================================ fibre
    const gf = G.fibre;
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false });
    const cladMat = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false });
    const core = rod(FB.x0, FB.x0 + FB.L, FB.rc, FB.rc, coreMat, 40); core.position.y = FB.y; core.castShadow = false; gf.add(core);
    const clad = rod(FB.x0, FB.x0 + FB.L, FB.rcl, FB.rcl, cladMat, 40); clad.position.y = FB.y; clad.castShadow = false; gf.add(clad);
    const coat = rod(FB.x0 + 3, FB.x0 + FB.L, FB.rcl + 0.12, FB.rcl + 0.12, M.clear(0xffb547, 0.12, { depthWrite: false }), 40, true); coat.position.y = FB.y; coat.castShadow = false; gf.add(coat);
    const endGlow = new THREE.Mesh(new THREE.CircleGeometry(FB.rc, 32), M.glow(0xff4d4d, { transparent: true, opacity: 0.6 })); endGlow.rotation.y = Math.PI / 2; endGlow.position.set(FB.x0 + FB.L + 0.01, FB.y, 0); gf.add(endGlow);
    const stand1 = box(0.4, FB.y - FB.rcl, 1, M.matte(0x3a3f4b)); stand1.position.set(FB.x0 + 4, (FB.y - FB.rcl) / 2, 0); gf.add(stand1);
    const stand2 = stand1.clone(); stand2.position.x = FB.x0 + FB.L - 4; gf.add(stand2);
    const fLaser = laser(gf, COL.ray, 1.3, 0.16);
    const fRays = rayPool(gf, 60, 0.035), fPulse = dots(6, 0.09, 0xffe0d8); gf.add(fPulse);
    const lCore = stage.label('core, n = 1.470', [FB.x0 + FB.L - 3.2, FB.y - 0.2, 0.6], gf), lClad = stage.label('cladding, n = 1.456', [FB.x0 + FB.L - 3.6, FB.y + FB.rcl + 0.35, 0], gf);
    const lCoat = stage.label('coating soaks up stray light', [FB.x0 + 6.5, FB.y - FB.rcl - 0.45, 0], gf);
    const lScale = stage.label('50 µm core, drawn to scale across', [FB.x0 + 11, FB.y - FB.rcl - 1.05, 0], gf);
    const lFState = stage.label('', [0, 0, 0], gf, 'hot');

    // ================================================================ diamond
    const gd = G.diamond, gp0 = gemPts();
    const prof = [[-gp0.pav, 0], [0, GEM.D / 2], [gp0.crown, gp0.tbl], [gp0.crown, 0]];
    const gemMat = new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.28, roughness: 0, metalness: 0.1, clearcoat: 1, flatShading: true, depthWrite: false, side: THREE.DoubleSide });
    const gem = latheX(prof, gemMat, { seg: 16 }); gem.rotation.z = Math.PI / 2; gem.position.set(0, GEM.y, 0); gem.castShadow = false; gd.add(gem);
    const gemEdges = new THREE.LineSegments(new THREE.EdgesGeometry(gem.geometry, 20), new THREE.LineBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35 })); gem.add(gemEdges);
    const prongs = [0, 1, 2, 3].map((i) => { const a = (i / 4) * Math.PI * 2 + 0.4; const b = beam([Math.cos(a) * 0.5, GEM.y - gp0.pav - 0.2, Math.sin(a) * 0.5], [Math.cos(a) * 2.05, GEM.y + 0.1, Math.sin(a) * 2.05], 0.05, M.metal(0xe6c36a)); gd.add(b); return b; });
    gd.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 0.2, 24), M.metal(0xe6c36a)), 0, GEM.y - gp0.pav - 0.25, 0));
    const gRays = rayPool(gd, 120, 0.02, '#ffffff');
    const lGem = stage.label('', [3.3, GEM.y + gp0.crown + 1.2, 0], gd, 'hot'); lGem.element.style.setProperty('--c', '#bfe8ff');
    const lPav = stage.label('back facets, 40.75°', [2.3, GEM.y - 1.4, 0], gd);

    // ================================================================ porro prism
    const gpr = G.porro;
    let porroMesh = prismMesh(porroPts(), 2.2, 0xcfe8ff, 0.2); gpr.add(porroMesh);
    const pStand = box(2.2, 0.16, 2.4, M.matte(0x2b3039)); pStand.position.set(0, PR.y - PR.a - 0.2, 0); gpr.add(pStand);
    gpr.add(beam([0, 0, 0], [0, PR.y - PR.a - 0.28, 0], 0.08, M.metal(0x6d7380)));
    const pRays = rayPool(gpr, 60, 0.03, COL.sun);
    const lP1 = stage.label('', [-2.6, PR.y - 1.9, 0.3], gpr, 'hot'), lP2 = stage.label('', [2.6, PR.y - 1.9, 0.3], gpr, 'hot');
    lP1.element.style.setProperty('--c', COL.crit); lP2.element.style.setProperty('--c', COL.crit);
    const lPin = stage.label('light in', [-2.2, PR.y + 3.1, 0], gpr), lPout = stage.label('light out, turned round', [2.4, PR.y + 3.1, 0], gpr);

    // ================================================================ light guide
    const gg = G.guide;
    const lgMat = new THREE.MeshPhysicalMaterial({ color: 0xdff6ff, transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false });
    const plate = box(LG.L, LG.t, 3, lgMat); plate.position.set(LG.x0 + LG.L / 2, LG.y + LG.t / 2, 0); plate.castShadow = false; gg.add(plate);
    const back = box(LG.L + 0.8, 0.08, 3.2, M.matte(0xf4f1ea)); back.position.set(LG.x0 + LG.L / 2, LG.y - 0.12, 0); gg.add(back);
    const ledBar = box(0.25, 0.4, 3, M.matte(0x3a3f4b)); ledBar.position.set(LG.x0 - 0.3, LG.y + LG.t / 2, 0); gg.add(ledBar);
    for (let i = 0; i < 6; i++) gg.add(at(sphere(0.09, M.glow(0xfff6e0)), LG.x0 - 0.16, LG.y + LG.t / 2, -1.25 + i * 0.5));
    const lcd = box(LG.L + 0.4, 0.08, 3.1, M.clear(0x8fb0ff, 0.25, { depthWrite: false })); lcd.position.set(LG.x0 + LG.L / 2, LG.y + LG.t + 1.3, 0); gg.add(lcd);
    const DOTS = []; for (let i = 0; i < 9; i++) { const x = LG.x0 + 1.0 + (LG.L - 1.6) * Math.pow(i / 8, 0.8); DOTS.push([x, 0.1 + 0.08 * i]); }
    const dotMeshes = DOTS.map(([x, w]) => { const m = box(w, 0.03, 2.6, M.matte(0xffffff)); m.position.set(x, LG.y + 0.015, 0); gg.add(m); return m; });
    const lgRays = rayPool(gg, 160, 0.018, '#fff6e0');
    const lLed = stage.label('LEDs', [LG.x0 - 0.4, LG.y + 1.0, 0], gg), lLcd = stage.label('diffuser and LCD above', [LG.x0 + LG.L - 1.4, LG.y + LG.t + 1.75, 0], gg);
    const lDots = stage.label('printed white dots', [LG.x0 + 2.4, LG.y - 0.6, 0], gg);
    const lPlate = stage.label('clear acrylic plate, n = 1.49 (thickness stretched)', [LG.x0 + LG.L / 2, LG.y - 1.1, 0], gg);

    const res = { fibre: {}, gem: {}, porro: {}, guide: {} };
    return {
      update(dt, s) {
        dt = Math.max(0, dt); S = s;
        fitNarrow(stage, [lCoat, lScale, lPav, lPin, lPout, lLcd, lDots, lPlate, lClad]);
        sw(s.focus);
        // a pulse of light runs along the fibre path at the speed of light in each part (scaled way down)
        if (s.focus === 'fibre' && pathLen > 0) {
          pulse = (pulse + dt * 6) % (pathLen + 6);
          for (let i = 0; i < 6; i++) { const q = along(path, pulse - i * 0.12); if (q) fPulse.place(i, q[0], q[1], 0, 1 - i * 0.14); else fPulse.place(i, 0, -500, 0, 0.001); }
          fPulse.done();
        }
        const k = JSON.stringify([s.focus, s.launch, s.clad, s.gem, s.tilt, s.fire, s.glass, s.ptilt, s.dots]);
        if (k === key) return;
        key = k;
        if (s.focus === 'fibre') {
          const shapes = fibreShapes(s), a = s.launch * DEG;
          const hit = [FB.x0, FB.y + 0.05], d = [Math.cos(a), -Math.sin(a)];
          const src = [hit[0] - d[0] * 2.4, hit[1] - d[1] * 2.4];
          const t = trace(shapes, src, d, { branch: true, minI: 0.04, maxHits: 80, far: 3 });
          fRays.draw(t.segs);
          fLaser.aim([src[0], src[1], 0], d);
          clad.visible = s.clad; coat.visible = s.clad;
          // the main path: follow the brightest chain for the pulse
          const tr = trace(shapes, src, d, { branch: false, maxHits: 80, far: 3 });
          path = tr.segs; pathLen = path.reduce((q, g) => q + Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]), 0); pulse = 0;
          const out = t.ends.filter((e) => e.p[0] >= FB.x0 + FB.L - 1e-3 || (e.d[0] > 0 && e.p[0] > FB.x0 + FB.L - 0.01)).reduce((q, e) => q + e.I, 0);
          const f = fibreOptics(s), trapped = s.launch <= f.acc / DEG + 1e-9;
          res.fibre = { f, trapped, out: t.ends.filter((e) => !e.stopped && e.p[0] > FB.x0 + FB.L - 0.01).reduce((q, e) => q + e.I, 0) };
          endGlow.material.opacity = clamp(res.fibre.out, 0.05, 0.9);
          lFState.position.set(FB.x0 + 8, FB.y + FB.rcl + 1.0, 0);
          lFState.element.style.setProperty('--c', trapped ? '#5ce1a9' : '#ff7a59');
          lFState.element.innerHTML = trapped ? 'trapped: <b>total internal reflection</b> at every bounce' : 'too steep: light <b>leaks out</b> at each bounce';
          void out;
        }
        if (s.focus === 'diamond') {
          const g = gemPts(), n = (nm) => nAt(s.gem, nm), shape = shapePoly(g.pts, n);
          const segs = [], wl = s.fire ? [650, 560, 460] : [589.3];
          let up = 0, down = 0, tot = 0;
          const a = s.tilt * DEG, d = [Math.sin(a), -Math.cos(a)];
          for (let i = 0; i < 5; i++) {
            const x = -g.tbl * 0.85 + (1.7 * g.tbl * i) / 4;
            const p = [x - d[0] * 3.2 / Math.abs(d[1]), GEM.y + g.crown + 3.2];
            for (const nm of wl) {
              const t = trace([shape], p, d, { nm, branch: true, minI: 0.12, maxHits: 14, far: 2.4 });
              t.segs.forEach((q) => segs.push({ ...q, I: q.I * (s.fire ? 0.8 : 0.9), col: s.fire ? waveColor(nm) : '#ffffff' }));
              for (const e of t.ends) { tot += e.I / wl.length; if (e.cur) continue; if (e.d[1] > 0) up += e.I / wl.length; else down += e.I / wl.length; }
            }
          }
          gRays.draw(segs);
          gemMat.opacity = s.gem === 'crown' ? 0.2 : 0.3;
          res.gem = { up: up / 5, down: down / 5 };
          lGem.element.innerHTML = `back out of the top: <b>${Math.round(res.gem.up * 100)}%</b>`;
        }
        if (s.focus === 'porro') {
          const n = nAt(s.glass), shape = shapePoly(porroPts(), n);
          const segs = [], a = s.ptilt * DEG, d = [Math.sin(a), -Math.cos(a)];
          let leak = 0;
          for (let i = 0; i < 3; i++) {
            const x = -PR.a * 0.8 + i * 0.55;
            const t = trace([shape], [x - d[0] * 3 / Math.abs(d[1]), PR.y + 3], d, { branch: true, minI: 0.03, maxHits: 10, far: 3.2 });
            t.segs.forEach((q) => segs.push(q));
            for (const e of t.ends) if (!e.cur && e.p[1] < PR.y - 1e-4) leak += e.I / 3;   // left through a short face
          }
          pRays.draw(segs);
          const tin = Math.asin(Math.sin(a) / n), i1 = 45 * DEG + tin, inc = 45 * DEG - tin, crit = critical(n, 1);
          res.porro = { tin, i1, inc, crit, leak };
          lP1.element.innerHTML = `1st face <b>${fmtDeg(i1)}</b>`; lP2.element.innerHTML = `2nd face <b>${fmtDeg(inc)}</b>`;
          lP2.element.style.setProperty('--c', inc > crit ? '#5ce1a9' : '#ff7a59'); lP1.element.style.setProperty('--c', '#5ce1a9');
        }
        if (s.focus === 'guide') {
          const n = nAt('acrylic'), x0 = LG.x0, x1 = LG.x0 + LG.L, y0 = LG.y, y1 = LG.y + LG.t;
          const plateS = { n, edges: [], parent: null };
          const E = (a, b, o = {}) => plateS.edges.push({ a, b, shape: plateS, ...o });
          E([x0, y1], [x1, y1]); E([x0, y0], [x0, y1]); E([x1, y0], [x1, y1], { mirror: true });
          // the back face, cut into plain stretches and printed dots
          const cuts = []; if (s.dots) DOTS.forEach(([x, w]) => cuts.push([x - w / 2, x + w / 2]));
          let xa = x0;
          for (const [c0, c1] of cuts) { E([xa, y0], [c0, y0], { mirror: true }); E([c0, y0], [c1, y0], { scatter: true }); xa = c1; }
          E([xa, y0], [x1, y0], { mirror: true });
          // the back is a white reflector sheet, so plain stretches reflect (after total internal reflection
          // anyway: the LED light meets the back at 64° or more, past the 42° critical angle)
          const scr = screenEdge([x0 - 1, y1 + 1.3], [x1 + 1, y1 + 1.3]);
          const segs = []; let exits = 0;
          for (let i = 0; i < 9; i++) {
            const ang = (-38 + (76 * i) / 8) * DEG, d = [Math.cos(ang), Math.sin(ang)];
            const t = trace([plateS, scr], [x0 - 0.12, y0 + LG.t / 2], d, { branch: false, maxHits: 30, far: 1 });
            t.segs.forEach((q) => segs.push({ ...q, I: 0.7 }));
            exits += t.ends.filter((e) => e.stopped).length;
          }
          lgRays.draw(segs);
          dotMeshes.forEach((m) => { m.visible = s.dots; });
          res.guide = { exits, n, crit: critical(n, 1), inside: Math.asin(Math.sin(38 * DEG) / n) };
        }
      },
      readout(s) {
        if (s.focus === 'diamond') {
          const n = nAt(s.gem), r = res.gem;
          return `<div class="big">sin θc = 1 ÷ n</div>
            <div class="row"><span>${GEMS[s.gem]}, n</span><b>${n.toFixed(2)}</b></div>
            <div class="row"><span>Critical angle</span><b style="color:${COL.crit}">${fmtDeg(critical(n, 1))}</b></div>
            <div class="row"><span>Light from straight above meets the back facets at</span><b>40.75°</b></div>
            <div class="row"><span>Sent back out of the top</span><b class="${r.up > 0.6 ? 'ok' : 'no'}">${pct(r.up || 0)}</b></div>
            <div class="row"><span>Leaks out of the back</span><b>${pct(r.down || 0)}</b></div>
            <small>${s.gem === 'crown' ? 'Glass’s critical angle (41.8°) is more than the 41° at which the light meets the back facets, so most of it escapes through the back.' : 'The back facets are past the critical angle, so they act as perfect mirrors and send the light back up to your eye.'} A slice through the gem; real sparkle is 3D.</small>`;
        }
        if (s.focus === 'porro') {
          const r = res.porro, n = nAt(s.glass), ok = r.inc > r.crit;
          return `<div class="big">45° faces, past the critical angle</div>
            <div class="row"><span>${PRISM_GLASS[s.glass]}, n</span><b>${n.toFixed(3)}</b></div>
            <div class="row"><span>Critical angle, asin(1 ÷ n)</span><b style="color:${COL.crit}">${fmtDeg(r.crit)}</b></div>
            <div class="row"><span>Tilt inside the glass</span><b>${fmtDeg(r.tin)}</b></div>
            <div class="row"><span>Angles on the faces, 45° ± tilt</span><b class="${ok ? 'ok' : 'no'}">${fmtDeg(r.i1)} · ${fmtDeg(r.inc)}</b></div>
            <div class="row"><span>Light leaking out of the faces</span><b>${pct(r.leak)}</b></div>
            <small>${ok ? 'Both faces reflect 100%, better than any silvered mirror (about 95%).' : 'Past the limit: some light escapes through the face, and that part of the view goes grey.'} BaK4’s higher index keeps light trapped at wider angles.</small>`;
        }
        if (s.focus === 'guide') {
          const r = res.guide;
          return `<div class="big">trapped, then let out</div>
            <div class="row"><span>Acrylic plate, n · critical angle</span><b>${r.n.toFixed(2)} · ${fmtDeg(r.crit)}</b></div>
            <div class="row"><span>Steepest LED ray inside the plate</span><b>${fmtDeg(r.inside)} from flat</b></div>
            <div class="row"><span>So it meets the faces at least</span><b style="color:${COL.crit}">${fmtDeg(90 * DEG - r.inside)}</b></div>
            <div class="row"><span>Rays reaching the screen</span><b class="${r.exits ? 'ok' : 'no'}">${r.exits} of 9</b></div>
            <small>${s.dots ? 'Each white dot scatters light upwards, steeply enough to escape. Dots are printed denser far from the LEDs so the glow is even.' : 'Without dots every ray stays trapped by total internal reflection and the screen stays dark.'}</small>`;
        }
        const r = res.fibre, f = r.f || fibreOptics(s);
        return `<div class="big">NA = √(n<sub>core</sub>² − n<sub>clad</sub>²)</div>
          <div class="row"><span>Core · ${s.clad ? 'cladding' : 'air'}</span><b>1.470 · ${f.nOuter.toFixed(3)}</b></div>
          <div class="row"><span>Critical angle at the core wall</span><b style="color:${COL.crit}">${fmtDeg(f.crit)}</b></div>
          <div class="row"><span>Accepts light within</span><b>±${fmtDeg(f.acc)}${f.na >= 1 ? ' (all)' : ''}</b></div>
          <div class="row"><span>Your laser: ${s.launch.toFixed(1)}° outside, inside</span><b class="${r.trapped ? 'ok' : 'no'}">${fmtDeg(f.inside)}</b></div>
          <div class="row"><span>Light in the core travels at</span><b>${kms(FB.nc)}</b></div>
          <small>${r.trapped ? 'Trapped. Real fibre is so clear that after 100 km about 1% of the light is left (0.2 dB/km), and 1,000 km takes about 4.9 ms.' : 'Too steep: at every bounce some light gets into the cladding and is lost in the coating.'}${s.clad ? '' : ' A bare rod traps light too, but any touch or dirt on its surface lets light out.'}</small>`;
      },
    };
  },
};
