// Chapter 2: everyday bending. Four scenes side by side.
// Straw (1 scene unit = 2 cm): a tumbler of water with a straw leaning in it, seen by an eye looking down
//   at a slant. Each point of the straw under water is found where the eye sees it: sightThrough() in
//   snell.js solves Snell's law at the surface for the sight line (n = 1.333), and the image sits where
//   the eye's line meets the vertical through the real point. The under-water part looks lifted, so the
//   straw looks broken at the surface. Looking straight down, apparent depth = real depth ÷ n = 0.75 ×.
// Pool (1 unit = 1 m): the same sum for the tiles on a pool's floor, seen by a person 1.6 m tall at the
//   edge (eye 1.6 m above the water) or from 3 m straight above the middle. Straight down the floor
//   looks 1 ÷ 1.333 = 75% as deep; at a slant it looks shallower still, so the far end seems to rise.
// Prism (1 unit ≈ 1 cm): a 60° prism of crown glass (N-BK7), flint glass (F2) or diamond, with n(λ) from
//   Cauchy fits in snell.js. Seven wavelengths from 680 to 420 nm are traced exactly through both faces.
//   Violet has the higher index, so it bends more: Newton's spectrum. Minimum deviation obeys
//   n = sin((A + D) ÷ 2) ÷ sin(A ÷ 2).
// Raindrop (1 unit = 1 mm, a 4.4 mm drop): sunlight enters, reflects once off the back and leaves.
//   For a ray hitting at height b (as a fraction of the radius), θi = asin b, θr = asin(b ÷ n), and it
//   comes back at φ = 4θr − 2θi from the direction straight away from the Sun. φ peaks at the rainbow
//   angle, where rays bunch up: 42.4° for red (n = 1.331) and 40.8° for violet (n = 1.342) with these
//   indices (Descartes, 1637; Newton explained the colours). The peak is where cos²θi = (n² − 1) ÷ 3.
import { THREE, M, box, tube, latheX } from '../kit.js';
import {
  COL, DEG, TAU, hex, nAt, SPECTRUM, waveColor, trace, shapePoly, screenEdge, sightThrough, fmtDeg, board, panelBg, axes, title,
  line, dot, text, rayPool, eyeball, dashed, prismMesh, fitNarrow, reelPlace, inReel, focusSwitch, clamp, sphere, beam, at,
} from '../snell.js';

const NW = 1.333;
const X = { straw: 0, pool: 30, prism: 60, drop: 90 };
const VIEWS = {
  straw: { pos: [1.4, 6.6, 18.5], target: [1.4, 5.5, 0] },
  pool: { pos: [34.6, 6.0, 15], target: [34.6, 4.7, 0] },
  prism: { pos: [62.4, 5.8, 17], target: [62.4, 4.7, 0] },
  drop: { pos: [88.4, 6.4, 18], target: [88.4, 5.6, 0] },
};
// ---- straw
const GL = { r: 2.4, base: 0.3, h: 4.6, water: 3.0 }, WY = GL.base + GL.water;
const STRAW = { b: [-1.6, 0.45], tilt: 30 * DEG, len: 8 };
const strawPt = (t) => [STRAW.b[0] + Math.sin(STRAW.tilt) * t, STRAW.b[1] + Math.cos(STRAW.tilt) * t];
const tWater = (WY - STRAW.b[1]) / Math.cos(STRAW.tilt);
const strawEye = (s) => { const e = s.view * DEG; return [9.5 * Math.cos(e), WY + 9.5 * Math.sin(e)]; };
// ---- pool (local x from the pool's left edge; the surface is at y = PS)
const PS = 3.2, PL = 10;
const poolEye = (s) => (s.from === 'above' ? [5, PS + 3] : [-0.5, PS + 1.6]);
// ---- prism
const PRISMS = { crown: 'Crown glass', flint: 'Flint glass', diamond: 'Diamond' };
const PC = [0, 3.4], PSIDE = 3.2;
const prismPts = () => { const h = (PSIDE * Math.sqrt(3)) / 2; return [[PC[0] - PSIDE / 2, PC[1] - h / 3], [PC[0] + PSIDE / 2, PC[1] - h / 3], [PC[0], PC[1] + (2 * h) / 3]]; };
// Beam into the left face at incidence i (from that face's normal). The left face's outward normal
// points up-left at 150°; the beam comes from the left, tilted to hit at angle i.
function prismIn(i) {
  const [A, , T] = prismPts(), M0 = [(A[0] + T[0]) / 2, (A[1] + T[1]) / 2];
  const nOut = [Math.cos(150 * DEG), Math.sin(150 * DEG)];
  // direction making angle i with −nOut, turned down towards the base
  const a = Math.atan2(-nOut[1], -nOut[0]) + i;
  const d = [Math.cos(a), Math.sin(a)];
  return { p: [M0[0] - d[0] * 5, M0[1] - d[1] * 5], d, hit: M0 };
}
// ---- raindrop
const DR = 2.2, DC = [0, 6.2];
export function dropRay(b, n) {
  const ti = Math.asin(b), tr = Math.asin(b / n);
  return { ti, tr, phi: 4 * tr - 2 * ti };
}
export const rainbowAngle = (n) => { const ci = Math.sqrt((n * n - 1) / 3), ti = Math.acos(ci); return 4 * Math.asin(Math.sin(ti) / n) - 2 * ti; };
// The path of a sunbeam (travelling +x) at height b·R above the drop's centre: in, one reflection, out.
function dropPath(b, n) {
  const y = b * DR, x = -Math.sqrt(DR * DR - y * y);
  const P1 = [x, y], d0 = [1, 0];
  const refr = (d, N, n1, n2) => { const c = -(d[0] * N[0] + d[1] * N[1]), e = n1 / n2, k = 1 - e * e * (1 - c * c); const t = [e * d[0] + (e * c - Math.sqrt(Math.max(0, k))) * N[0], e * d[1] + (e * c - Math.sqrt(Math.max(0, k))) * N[1]]; const l = Math.hypot(...t); return [t[0] / l, t[1] / l]; };
  const chord = (P, d) => { const t = -2 * (P[0] * d[0] + P[1] * d[1]); return [P[0] + d[0] * t, P[1] + d[1] * t]; };
  const N1 = [P1[0] / DR, P1[1] / DR];
  const d1 = refr(d0, N1, 1, n), P2 = chord(P1, d1);
  const N2 = [-P2[0] / DR, -P2[1] / DR], c2 = d1[0] * N2[0] + d1[1] * N2[1];
  const d2 = [d1[0] - 2 * c2 * N2[0], d1[1] - 2 * c2 * N2[1]], P3 = chord(P2, d2);
  const d3 = refr(d2, [-P3[0] / DR, -P3[1] / DR], n, 1);
  return { pts: [[x - 6, y], P1, P2, P3, [P3[0] + d3[0] * 6.5, P3[1] + d3[1] * 6.5]], d3 };
}

export default {
  id: 'everyday',
  short: 'Everyday bending',
  title: 'Bent straws, shallow pools and rainbows',
  subtitle: 'Refraction fools your eyes at every glass of water, and splits sunlight into colours.',
  view: VIEWS.straw,
  learn: `<p>Your brain assumes light travels in straight lines. Refraction breaks that rule, so things under water are <b>not where they look</b>.</p>
    <p><b>The bent straw.</b> Light from the part of a straw under water bends as it leaves the surface, away from the normal. Your eye traces it back in a straight line and sees the straw <b>higher</b> than it really is. The dry part isn't moved, so the straw looks <b>broken</b> right at the surface.</p>
    <p><b>The shallow pool.</b> The same trick makes water look shallower than it is. Looking straight down, the <b>apparent depth ≈ real depth ÷ n</b>, so a 2 m pool looks 1.5 m deep. Looking at a slant it looks even shallower, and the far end seems to rise up. That's why people misjudge pools and rivers. Always check the real depth before you jump.</p>
    <p><b>The prism.</b> n is not quite the same for every colour. In glass, violet light is slowed a little more than red, so it bends a little more. A prism fans white light out into a <b>spectrum</b>. This spreading is called <b>dispersion</b>, and Newton used it in 1666 to show that white light is a mix of all colours.</p>
    <p><b>The rainbow.</b> Every raindrop is a tiny round prism with a mirror at the back. Sunlight bends in, reflects once off the back and bends out. Rays that hit different parts of the drop come back at different angles, but they <b>pile up at about 42°</b> from the point opposite the Sun. Red piles up at 42.4°, violet at about 40.8°. That's why a rainbow is a circle around the shadow of your head, red on the outside.</p>
    <p class="tip"><b>Try it:</b> tilt your eye lower over the straw and watch the break grow. Make the pool deeper. Swap the prism to flint glass to widen the rainbow, then move the sunbeam across the raindrop and watch its angle stop at 42°.</p>`,
  terms: [
    { t: 'Apparent depth', d: 'How deep water looks. Straight down it is the real depth ÷ n, about three quarters for water.' },
    { t: 'Image', d: 'Where an object seems to be, found by tracing the light that reaches your eye back in straight lines.' },
    { t: 'Dispersion', d: 'The refractive index changing with colour, so each colour bends by a different amount.' },
    { t: 'Spectrum', d: 'The band of colours, red to violet, that white light spreads into.' },
    { t: 'Rainbow angle', d: 'About 42°: the angle from the point opposite the Sun where light leaving raindrops bunches up.' },
    { t: 'Minimum deviation', d: 'The turn of the prism at which light is bent least. Rays bunch up there, as in the raindrop.' },
  ],
  defaults: { focus: 'straw', view: 32, depth: 2, from: 'edge', prism: 'flint', inc: 50, b: 0.86, many: true },
  controls: [
    { key: 'focus', type: 'seg', label: 'Look at', options: [{ v: 'straw', label: 'Straw' }, { v: 'pool', label: 'Pool' }, { v: 'prism', label: 'Prism' }, { v: 'drop', label: 'Raindrop' }] },
    { key: 'view', type: 'range', label: 'Straw: your eye above the water', min: 12, max: 88, step: 1, ends: ['low slant', 'straight down'], fmt: (v) => v + '° up' },
    { key: 'depth', type: 'range', label: 'Pool: real depth', min: 0.8, max: 3, step: 0.05, ends: ['0.8 m', '3 m'], fmt: (v) => v.toFixed(2) + ' m' },
    { key: 'from', type: 'seg', label: 'Pool: you look from', options: [{ v: 'edge', label: 'The edge' }, { v: 'above', label: 'Straight above' }] },
    { key: 'prism', type: 'seg', label: 'Prism: made of', options: Object.entries(PRISMS).map(([v, label]) => ({ v, label })), fmt: (v) => `n = ${nAt(v, 680).toFixed(3)} red, ${nAt(v, 420).toFixed(3)} violet` },
    { key: 'inc', type: 'range', label: 'Prism: angle the white beam hits', min: 20, max: 85, step: 0.5, ends: ['20°', '85°'], fmt: (v) => v.toFixed(1) + '°' },
    { key: 'b', type: 'range', label: 'Raindrop: where the sunbeam hits', min: 0, max: 0.99, step: 0.01, ends: ['centre', 'edge'], fmt: (v) => `${Math.round(v * 100)}% of the way out` },
    { key: 'many', type: 'toggle', label: 'Raindrop: show many sunbeams' },
  ],
  onChange(s, key) {
    if (key === 'view') s.focus = 'straw';
    if (key === 'depth' || key === 'from') s.focus = 'pool';
    if (key === 'prism' || key === 'inc') s.focus = 'prism';
    if (key === 'b' || key === 'many') s.focus = 'drop';
  },
  quiz: [
    { q: 'A river looks about 1.2 m deep when you look straight down. Roughly how deep is it really?', options: ['0.9 m', '1.2 m', '1.6 m', '2.4 m'], answer: 2, why: 'Apparent depth ≈ real depth ÷ 1.333, so real depth ≈ 1.2 × 1.333 ≈ 1.6 m. Water is always deeper than it looks.' },
    { q: 'Why does a prism split white light into colours?', options: ['The glass is coloured', 'Each colour has a slightly different refractive index, so each bends by a different amount', 'The prism adds colours', 'Red light is reflected'], answer: 1, why: 'That’s dispersion. In glass, violet light has a slightly higher n than red, so it bends more and the colours fan out.' },
    { q: 'You see a rainbow. Where is the Sun?', options: ['In front of you, behind the rainbow', 'Behind you', 'Directly overhead', 'Anywhere'], answer: 1, why: 'Raindrops send the light back towards the Sun’s side at about 42°. So the Sun is behind you and the rainbow is a circle around the shadow of your head.' },
  ],
  reel: [
    { ms: 5000, caption: 'A straw looks broken because light bends leaving the water. Your eye sees it higher.', set: { focus: 'straw' }, anim: { view: [70, 18] }, view: { pos: [2.6, 5.2, 11], target: [2.6, 4.6, 0] }, spin: 0.05 },
    { ms: 5400, caption: 'In every raindrop, sunlight bends, reflects and bunches up at 42°. That’s the rainbow.', set: { focus: 'drop', many: true }, anim: { b: [0.2, 0.9] }, view: { pos: [91, 6.6, 11], target: [91, 6.2, 0] }, spin: 0.04 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    const G = {}; for (const k of Object.keys(X)) { G[k] = new THREE.Group(); G[k].position.x = X[k]; root.add(G[k]); }
    const sw = focusSwitch(stage, G, VIEWS);
    let S = s0;

    // ================================================================ straw
    const gs = G.straw;
    const table = box(9, 0.2, 5, M.matte(0x3a2f28)); table.position.set(1.5, 0.1, 0); gs.add(table);
    const glassM = M.clear(0xdff2ff, 0.16);
    gs.add(at(new THREE.Mesh(new THREE.CylinderGeometry(GL.r, GL.r * 0.9, GL.h, 48, 1, true), glassM), 0, GL.base + GL.h / 2));
    const gBase = new THREE.Mesh(new THREE.CylinderGeometry(GL.r * 0.9, GL.r * 0.9, 0.12, 48), M.clear(0xdff2ff, 0.3)); gBase.position.y = GL.base + 0.06; gs.add(gBase);
    const wMat = new THREE.MeshStandardMaterial({ color: 0x4fa3ff, transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false });
    const kWater = GL.water / GL.h, rTop = GL.r * (0.9 + 0.1 * kWater);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(rTop - 0.04, GL.r * 0.9 - 0.04, GL.water - 0.12, 48), wMat); water.position.y = GL.base + 0.12 + (GL.water - 0.12) / 2; gs.add(water);
    const surf = new THREE.Mesh(new THREE.CircleGeometry(rTop - 0.04, 48), M.ghost(0x9fd0ff, 0.35)); surf.rotation.x = -Math.PI / 2; surf.position.y = WY; gs.add(surf);
    const strawMat = M.plastic(0xff5a7a), ghostStraw = M.ghost(0xff5a7a, 0.28);
    const sTop = strawPt(STRAW.len), sW = strawPt(tWater);
    gs.add(beam([sW[0], sW[1], 0], [sTop[0], sTop[1], 0], 0.13, strawMat));
    gs.add(beam([STRAW.b[0], STRAW.b[1], 0], [sW[0], sW[1], 0], 0.13, ghostStraw));
    let imgStraw = null;
    const eye1 = eyeball(gs, 0.32);
    const sRays = rayPool(gs, 6, 0.03, COL.sun), sAux = rayPool(gs, 2, 0.015, COL.n1);
    const lReal = stage.label('really here', [0, 0, 0], gs), lSeen = stage.label('', [0, 0, 0], gs, 'hot'), lEye = stage.label('', [0, 0, 0], gs);
    lSeen.element.style.setProperty('--c', '#ff5a7a');

    // ================================================================ pool
    const gp = G.pool;
    const ground = M.matte(0x5d6470), tileM = M.matte(0x1b3550);
    const poolWalls = [box(3, PS, 3, ground), box(3, PS, 3, ground)];
    poolWalls[0].position.set(-1.5, PS / 2, 0); poolWalls[1].position.set(PL + 1.5, PS / 2, 0); poolWalls.forEach((b) => gp.add(b));
    const poolFloor = box(PL, 1, 3, ground); gp.add(poolFloor);
    const poolWater = new THREE.Mesh(new THREE.BoxGeometry(PL, 1, 2.6), new THREE.MeshStandardMaterial({ color: 0x3aa0ff, transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false })); gp.add(poolWater);
    const poolSurf = new THREE.Mesh(new THREE.PlaneGeometry(PL, 2.6), M.ghost(0x9fd0ff, 0.3)); poolSurf.rotation.x = -Math.PI / 2; poolSurf.position.set(PL / 2, PS, 0); gp.add(poolSurf);
    const NT = 10, tiles = Array.from({ length: NT }, (_, i) => { const t = box(0.5, 0.04, 1.2, tileM); t.position.x = i + 0.5; gp.add(t); return t; });
    const ghostTiles = Array.from({ length: NT }, (_, i) => { const t = box(0.5, 0.04, 1.2, M.ghost(0x9fe6ff, 0.55)); gp.add(t); return t; });
    // a simple person: legs, body and head, standing at the edge
    const person = new THREE.Group(); gp.add(person);
    const skin = M.matte(0xc68a5e), shirt = M.matte(0xff7a59);
    person.add(at(box(0.3, 0.8, 0.25, M.matte(0x2b3a67)), 0, 0.4, 0));
    person.add(at(box(0.42, 0.62, 0.3, shirt), 0, 1.1, 0));
    person.add(at(sphere(0.14, skin), 0.02, 1.58, 0));
    const eye2 = eyeball(gp, 0.08);
    const pRays = rayPool(gp, 12, 0.03, COL.sun), pAux = rayPool(gp, 6, 0.012, '#9fe6ff');
    let floorLine = null;
    const lDepth = stage.label('', [0, 0, 0], gp, 'hot'), lLook = stage.label('', [0, 0, 0], gp, 'hot');
    lDepth.element.style.setProperty('--c', '#9fb3c8'); lLook.element.style.setProperty('--c', '#9fe6ff');
    const depthArrowA = dashed(gp, [0, 0, 0], [0, 1, 0], '#9fb3c8'); // replaced on change
    let depthDash = depthArrowA;

    // ================================================================ prism
    const gq = G.prism;
    const prism = prismMesh(prismPts(), 1.8, 0xe8f4ff, 0.18); gq.add(prism);
    const stand = box(3.8, 0.16, 2.2, M.matte(0x2b3039)); stand.position.set(PC[0], PC[1] - (PSIDE * Math.sqrt(3)) / 6 - 0.08, 0); gq.add(stand);
    gq.add(beam([PC[0], 0, 0], [PC[0], PC[1] - (PSIDE * Math.sqrt(3)) / 6 - 0.16, 0], 0.08, M.metal(0x6d7380)));
    const qRays = rayPool(gq, 40, 0.03, '#ffffff');
    const screen = box(0.08, 4.2, 2.2, M.matte(0xf4f1ea)); gq.add(screen);
    const torch = new THREE.Group(); gq.add(torch);
    torch.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 1.2, 24), M.metal(0x3a3f4b)), 0, -0.6, 0));
    const lens0 = at(new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), M.glow(0xffffff)), 0, 0.01, 0); lens0.rotation.x = -Math.PI / 2; torch.add(lens0);
    const lSpec = stage.label('', [0, 0, 0], gq, 'hot'), lPrism = stage.label('', [PC[0], PC[1] - 1.6, 1.1], gq);
    lSpec.element.style.setProperty('--c', '#c49bff');

    // ================================================================ raindrop
    const gd = G.drop;
    const dropMesh = new THREE.Mesh(new THREE.SphereGeometry(DR, 48, 32), new THREE.MeshStandardMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false }));
    dropMesh.position.set(DC[0], DC[1], 0); gd.add(dropMesh);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(DR, 0.02, 8, 96), M.glow(0x9fd0ff, { transparent: true, opacity: 0.6 })); ring.position.set(DC[0], DC[1], 0); gd.add(ring);
    const dRays = rayPool(gd, 60, 0.025, COL.sun);
    const sun = sphere(0.6, M.glow(0xfff2c0)); sun.position.set(DC[0] + 8.2, DC[1] + 1.6, 0); gd.add(sun);
    const lSun = stage.label('sunlight', [DC[0] + 7.6, DC[1] + 2.6, 0], gd);
    const lBow = stage.label('', [0, 0, 0], gd, 'hot'); lBow.element.style.setProperty('--c', '#ff7a59');
    const lBack = stage.label('back to your eye', [DC[0] + 6.2, DC[1] - 4.0, 0], gd);

    // ================================================================ boards
    let key = '';
    const qBoard = board(gq, 4.4, 3.1, 600, 420, (g, w, h) => {
      panelBg(g, w, h);
      title(g, 'Refractive index by colour', 'dispersion');
      const { X: XX, Y } = axes(g, w, h, { x0: 84, y1: 64, y0: h - 58, xMin: 400, xMax: 700, yMin: 1.5, yMax: 2.5, xTicks: [400, 500, 600, 700], yTicks: [1.5, 1.75, 2, 2.25, 2.5], xFmt: (v) => v + ' nm', yFmt: (v) => v.toFixed(2), xLabel: 'wavelength' });
      for (let nm = 400; nm < 700; nm += 4) { g.fillStyle = waveColor(nm); g.fillRect(XX(nm), h - 56, XX(nm + 4) - XX(nm) + 1, 8); }
      for (const [k, name] of Object.entries(PRISMS)) {
        const pts = []; for (let nm = 400; nm <= 700; nm += 10) pts.push([nm, nAt(k, nm)]);
        line(g, pts, XX, Y, k === S.prism ? '#ffffff' : 'rgba(255,255,255,.3)', k === S.prism ? 4 : 2);
        text(g, name, XX(560), Y(nAt(k, 560)) - 10, k === S.prism ? '#fff' : 'rgba(255,255,255,.45)', '16px sans-serif');
      }
      dot(g, XX(420), Y(nAt(S.prism, 420)), waveColor(420), 7); dot(g, XX(680), Y(nAt(S.prism, 680)), waveColor(680), 7);
    }, [PC[0] + 6.8, PC[1] + 3.6, -0.6]);
    const dBoard = board(gd, 4.6, 3.2, 600, 420, (g, w, h) => {
      panelBg(g, w, h);
      title(g, 'Angle the light comes back', 'one reflection');
      const { X: XX, Y } = axes(g, w, h, { x0: 76, y1: 64, y0: h - 58, xMax: 1, yMax: 50, xTicks: [0, 0.25, 0.5, 0.75, 1], yTicks: [0, 10, 20, 30, 40, 50], xFmt: (v) => Math.round(v * 100) + '%', yFmt: (v) => v + '°', xLabel: 'where it hits the drop' });
      for (const nm of [680, 420]) {
        const n = nAt('water', nm), pts = [];
        for (let b = 0; b <= 1.0001; b += 0.01) pts.push([b, dropRay(Math.min(b, 1), n).phi / DEG]);
        line(g, pts, XX, Y, waveColor(nm), 3);
        const ra = rainbowAngle(n) / DEG;
        line(g, [[0, ra], [1, ra]], XX, Y, waveColor(nm), 1, [4, 6]);
      }
      text(g, 'rays pile up here: the rainbow', XX(0.08), Y(44.5), '#fff', 'bold 16px sans-serif');
      const n = nAt('water', 680);
      dot(g, XX(S.b), Y(dropRay(S.b, n).phi / DEG), waveColor(680), 8);
    }, [DC[0] - 6.0, DC[1] - 3.2, -0.6]);
    dBoard.mesh.rotation.y = 0.2;

    return {
      update(dt, s) {
        dt = Math.max(0, dt); S = s;
        fitNarrow(stage, [lReal, lEye, lPrism, lSun, lBack]);
        reelPlace([[qBoard, [PC[0], PC[1] + 5.4, 0], 1.2], [dBoard, [DC[0], DC[1] + 4.6, 0], 1.2]]);
        sw(s.focus);
        const k = JSON.stringify([s.focus, s.view, s.depth, s.from, s.prism, s.inc, s.b, s.many]);
        if (k === key) return;
        key = k;
        if (s.focus === 'straw') {
          const E = strawEye(s), segs = [], pts = [];
          for (let i = 0; i <= 14; i++) { const P = strawPt((tWater * i) / 14); pts.push(sightThrough(P, E, WY, NW).A); }
          if (imgStraw) { gs.remove(imgStraw); imgStraw.geometry.dispose(); }
          imgStraw = tube(pts.map((p) => [p[0], p[1], 0]), 0.13, strawMat, false, 40); gs.add(imgStraw);
          const tip = sightThrough(STRAW.b, E, WY, NW);
          segs.push({ a: STRAW.b, b: tip.S, I: 0.8 }, { a: tip.S, b: E, I: 0.8 });
          sRays.draw(segs); sAux.draw([{ a: tip.S, b: tip.A, I: 0.7 }]);
          eye1.look([E[0], E[1], 0], [tip.S[0] - E[0], tip.S[1] - E[1], 0]);
          lReal.position.set(STRAW.b[0] - 0.3, STRAW.b[1] - 0.25, 0);
          lSeen.position.set(tip.A[0] - 1.3, tip.A[1] + 0.2, 0); lSeen.element.innerHTML = 'seen <b>here</b>';
          lEye.position.set(E[0], E[1] + 0.6, 0); lEye.element.innerHTML = 'your eye';
        }
        if (s.focus === 'pool') {
          const floorY = PS - s.depth, E = poolEye(s);
          poolFloor.position.set(PL / 2, floorY / 2, 0); poolFloor.scale.y = Math.max(0.01, floorY);
          poolWater.scale.y = s.depth; poolWater.position.set(PL / 2, floorY + s.depth / 2, 0);
          person.visible = s.from === 'edge'; person.position.set(-0.55, PS, 0);
          eye2.look([E[0], E[1], 0.1], [1, -0.6, 0]);
          const app = [];
          tiles.forEach((t, i) => {
            t.position.y = floorY + 0.02;
            const P = [i + 0.5, floorY], r = sightThrough(P, E, PS, NW);
            app.push(r); ghostTiles[i].position.set(P[0], r.A[1], 0);
          });
          const curve = []; for (let x = 0.2; x <= PL - 0.2; x += 0.2) curve.push(sightThrough([x, floorY], E, PS, NW).A);
          if (floorLine) { gp.remove(floorLine); floorLine.geometry.dispose(); }
          floorLine = tube(curve.map((p) => [p[0], p[1], 0.62]), 0.04, M.glow(0x9fe6ff), false, 60); gp.add(floorLine);
          const pick = s.from === 'edge' ? [1, 4, 8] : [3, 5, 8];
          const segs = []; pick.forEach((i) => { const r = app[i]; segs.push({ a: [i + 0.5, floorY], b: r.S, I: 0.75 }, { a: r.S, b: E, I: 0.75 }); });
          pRays.draw(segs); pAux.draw(pick.map((i) => ({ a: app[i].S, b: app[i].A, I: 0.6 })));
          gp.remove(depthDash); depthDash = dashed(gp, [PL - 0.4, PS, 0.7], [PL - 0.4, floorY, 0.7], '#9fb3c8');
          lDepth.position.set(PL - 0.2, floorY + s.depth * 0.35, 0.7); lDepth.element.innerHTML = `real depth <b>${s.depth.toFixed(2)} m</b>`;
          const mid = sightThrough([5, floorY], [5, PS + 3], PS, NW);
          lLook.position.set(PL * 0.42, Math.min(PS - 0.25, app[4].A[1] + 0.5), 0.7); lLook.element.innerHTML = `the floor seems to be <b>here</b>`;
          void mid;
        }
        if (s.focus === 'prism') {
          const { p, d } = prismIn(s.inc * DEG), P = prismPts();
          const shape = shapePoly(P, (nm) => nAt(s.prism, nm));
          // the screen stands across the path of the middle (green) colour, 5 units past the prism
          const mid = trace([shape], p, d, { nm: 560, branch: false });
          const last = mid.segs[mid.segs.length - 1];
          const dir = [last.b[0] - last.a[0], last.b[1] - last.a[1]], L = Math.hypot(...dir), u = [dir[0] / L, dir[1] / L];
          const C0 = [last.a[0] + u[0] * 5, last.a[1] + u[1] * 5], perp = [-u[1], u[0]];
          screen.position.set(C0[0], C0[1], 0); screen.rotation.z = Math.atan2(u[1], u[0]);
          const scr = screenEdge([C0[0] - perp[0] * 2.1, C0[1] - perp[1] * 2.1], [C0[0] + perp[0] * 2.1, C0[1] + perp[1] * 2.1]);
          const segs = [{ a: p, b: mid.segs[0].b, I: 1, col: '#ffffff', r: 0.06 }];
          const hits = [];
          for (const nm of SPECTRUM) {
            const tr = trace([shape, scr], p, d, { nm, branch: false });
            tr.segs.slice(1).forEach((g) => segs.push({ ...g, I: 0.9, col: waveColor(nm) }));
            hits.push(tr.ends[0]);
          }
          qRays.draw(segs);
          torch.position.set(p[0], p[1], 0); torch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(d[0], d[1], 0));
          const hp = hits[3]?.p || C0;
          lSpec.position.set(hp[0] + 0.6, hp[1] + 0.2, 0); lSpec.element.innerHTML = 'spectrum';
          lPrism.element.innerHTML = `${PRISMS[s.prism].toLowerCase()} prism, 60°`;
        }
        if (s.focus === 'drop') {
          const segs = [], map = (q) => [DC[0] - q[0], q[1] + DC[1]];   // mirrored: the Sun is on the right
          const add = (b, nm, I, r) => { const { pts } = dropPath(b, nAt('water', nm)); for (let i = 0; i < pts.length - 1; i++) segs.push({ a: map(pts[i]), b: map(pts[i + 1]), I, col: nm ? waveColor(nm) : COL.sun, r }); };
          if (s.many) for (let b = 0.1; b < 0.99; b += 0.1) { const { pts } = dropPath(b, 1.333); for (let i = 0; i < pts.length - 1; i++) segs.push({ a: map(pts[i]), b: map(pts[i + 1]), I: 0.28, col: '#fff2c0', r: 0.015 }); }
          const { pts } = dropPath(s.b, nAt('water', 560));
          segs.push({ a: map(pts[0]), b: map(pts[1]), I: 1, col: '#ffffff', r: 0.04 });
          for (const nm of [680, 590, 510, 420]) { const q = dropPath(s.b, nAt('water', nm)).pts; for (let i = 1; i < q.length - 1; i++) segs.push({ a: map(q[i]), b: map(q[i + 1]), I: 0.9, col: waveColor(nm), r: 0.03 }); }
          dRays.draw(segs);
          const phi = dropRay(s.b, nAt('water', 680)).phi / DEG;
          lBow.position.set(DC[0] + 3.9, DC[1] - 1.6, 0); lBow.element.innerHTML = `back at <b>${phi.toFixed(1)}°</b>`;
          dBoard.redraw();
        }
        if (s.focus === 'prism') qBoard.redraw();
      },
      readout(s) {
        if (s.focus === 'pool') {
          const E = poolEye(s), floorY = PS - s.depth, far = sightThrough([8.5, floorY], E, PS, NW), near = sightThrough([E[0] < 1 ? 1.5 : 5, floorY], E, PS, NW);
          return `<div class="big">apparent depth ≈ d ÷ n</div>
            <div class="row"><span>Real depth, d</span><b>${s.depth.toFixed(2)} m</b></div>
            <div class="row"><span>Looking straight down, d ÷ 1.333</span><b style="color:#9fe6ff">${(s.depth / NW).toFixed(2)} m</b></div>
            <div class="row"><span>${s.from === 'edge' ? 'Floor 1 m out' : 'Floor below you'} looks</span><b style="color:#9fe6ff">${(PS - near.A[1]).toFixed(2)} m deep</b></div>
            <div class="row"><span>Floor 8 m away looks</span><b style="color:#9fe6ff">${(PS - far.A[1]).toFixed(2)} m deep</b></div>
            <small>Your eye traces light back in straight lines, so the whole floor seems lifted, the far end most. Water is always deeper than it looks.</small>`;
        }
        if (s.focus === 'prism') {
          const { p, d } = prismIn(s.inc * DEG), shape = shapePoly(prismPts(), (nm) => nAt(s.prism, nm));
          const dev = (nm) => { const t = trace([shape], p, d, { nm, branch: false }), g = t.segs[t.segs.length - 1]; if (t.segs.length < 3) return null; const a = Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0]); return Math.abs(Math.atan2(d[1], d[0]) - a); };
          const dr = dev(680), dv = dev(420), nd = nAt(s.prism, 589.3);
          const dmin = 2 * Math.asin(nd * Math.sin(30 * DEG)) - 60 * DEG;
          return `<div class="big">violet bends more than red</div>
            <div class="row"><span>n for red (680 nm) · violet (420 nm)</span><b>${nAt(s.prism, 680).toFixed(3)} · ${nAt(s.prism, 420).toFixed(3)}</b></div>
            <div class="row"><span>Red is turned by</span><b style="color:${waveColor(680)}">${dr == null ? 'trapped' : fmtDeg(dr)}</b></div>
            <div class="row"><span>Violet is turned by</span><b style="color:#b98cff">${dv == null ? 'trapped' : fmtDeg(dv)}</b></div>
            <div class="row"><span>Rainbow spread</span><b>${dr == null || dv == null ? '–' : fmtDeg(dv - dr, 2)}</b></div>
            <div class="row"><span>Smallest possible turn (yellow)</span><b>${fmtDeg(dmin)}</b></div>
            <small>${dv == null || dr == null ? 'At this angle some light is trapped inside by total internal reflection.' : 'Each colour obeys Snell’s law with its own n. Flint glass spreads colours about twice as much as crown glass.'}</small>`;
        }
        if (s.focus === 'drop') {
          const nr = nAt('water', 680), nv = nAt('water', 420), r = dropRay(s.b, nr);
          return `<div class="big">the rainbow is at 42°</div>
            <div class="row"><span>Sunbeam enters at θ₁ · bends to θ₂</span><b>${fmtDeg(r.ti)} · ${fmtDeg(r.tr)}</b></div>
            <div class="row"><span>Comes back at φ = 4θ₂ − 2θ₁</span><b style="color:${waveColor(680)}">${fmtDeg(r.phi)}</b></div>
            <div class="row"><span>Most red light comes back at</span><b style="color:${waveColor(680)}">${fmtDeg(rainbowAngle(nr))}</b></div>
            <div class="row"><span>Most violet light comes back at</span><b style="color:#b98cff">${fmtDeg(rainbowAngle(nv))}</b></div>
            <small>No ray comes back steeper than about 42°, and many come back close to it. That pile-up makes the bright bow. Red is on the outside.</small>`;
        }
        const E = strawEye(s), tip = sightThrough(STRAW.b, E, WY, NW), d = WY - STRAW.b[1];
        return `<div class="big">under water looks higher</div>
          <div class="row"><span>Straw tip really, below the surface</span><b>${(d * 2).toFixed(1)} cm</b></div>
          <div class="row"><span>Where your eye sees it</span><b style="color:#ff5a7a">${((WY - tip.A[1]) * 2).toFixed(1)} cm</b></div>
          <div class="row"><span>Straight down it would be d ÷ 1.333</span><b>${((d * 2) / NW).toFixed(1)} cm</b></div>
          <div class="row"><span>Sight line: in water · in air</span><b>${fmtDeg(tip.thW)} · ${fmtDeg(tip.thA)}</b></div>
          <small>1.333 × sin ${fmtDeg(tip.thW, 0)} = sin ${fmtDeg(tip.thA, 0)}: the light bends away from the normal as it leaves the water, and your eye traces it back in a straight line.</small>`;
      },
    };
  },
};
