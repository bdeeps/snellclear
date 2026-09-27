// Chapter 3: lenses are Snell's law twice. Two scenes.
// Camera lens (1 scene unit = 1 ÷ 0.3 cm, so 3.3 cm): a symmetric biconvex glass lens (n = 1.5), both
//   faces with radius R. Rays from the tip of an object u cm away are traced exactly through both
//   spherical faces with vector Snell (traceSeq in snell.js), then run on to the sensor. The thin-lens
//   (lensmaker's) focal length is 1/f = (n − 1)(1/R₁ − 1/R₂) = 2(n − 1)/R, so f = R for n = 1.5; the real,
//   thick lens comes out slightly longer (10.2 cm for R = 10 cm), and we report the traced value. The image lands at v from
//   1/f = 1/u + 1/v. The blur on the sensor is the spread of the traced rays there. Fat lenses with
//   wide apertures don't bring every ray to one point (spherical aberration), which the trace shows.
// Eye (1 unit = 1 ÷ 0.28 mm): Le Grand's full theoretical eye (Le Grand & El Hage 1980; as tabulated in
//   Atchison & Smith, Optics of the Human Eye, 2000): cornea front R 7.8 mm, back 6.5 mm, thickness
//   0.55 mm, n 1.3771; aqueous 1.3374, anterior chamber 3.05 mm; lens front R 10.2, back −6.0, 4.0 mm
//   thick, n 1.42; vitreous 1.336; retina 24.197 mm behind the cornea. Surface power P = (n₂ − n₁) ÷ R:
//   cornea front 48.3 D, back −6.1 D (together about 42 D); lens about 22 D; whole eye about 60 D.
//   Under water the cornea's front face only gets (1.3771 − 1.333) ÷ 0.0078 = 5.7 D, so the image falls
//   far behind the retina. Goggles put a layer of air back in front of the cornea. Without its lens
//   (aphakia, as after old-style cataract surgery) the eye is strongly long-sighted.
import { THREE, M, box, latheX, tube } from '../kit.js';
import {
  COL, DEG, hex, traceSeq, backFocus, yAtX, board, panelBg, title, text, rayPool, dashed, fitNarrow, reelPlace, inReel,
  focusSwitch, clamp, sphere, beam, at, fmt0,
} from '../snell.js';

const K = 0.3, AY = 3.5, NL = 1.5;
const X = { lens: 0, eye: 40 };
const VIEWS = {
  lens: { pos: [0.3, 5.6, 17.5], target: [0.3, 4.9, 0] },
  eye: { pos: [41.6, 6.2, 17], target: [41.6, 5.5, 0] },
};
// ---- the camera lens, in cm
export function lensOf(s) {
  const R = s.R, h = Math.min(3.2, 0.32 * R), sag = R - Math.sqrt(R * R - h * h), t = 2 * sag + 0.3;
  const surfs = [{ x: -t / 2, R, n: NL, h }, { x: t / 2, R: -R, n: 1, h }];
  const fThin = R / (2 * (NL - 1));
  const bf = backFocus(surfs);                       // back focal point (cm from the lens centre)
  // effective focal length from the paraxial ray's final slope: f = h ÷ tan(angle)
  const pr = traceSeq(surfs, [-t / 2 - 1, 0.01], [1, 0]), f = 0.01 / Math.abs(pr.d[1] / pr.d[0]);
  const v = s.u > f ? 1 / (1 / f - 1 / s.u) : -1 / (1 / s.u - 1 / f);
  return { R, h, sag, t, surfs, fThin, f, bf, v, real: s.u > f + 0.01, m: -v / s.u };
}
const OBJ_H = 3;                                      // object height, cm
function lensRays(L, s, n = 11) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const yh = -L.h * 0.92 + (1.84 * L.h * i) / (n - 1), p0 = [-s.u, OBJ_H];
    const r = traceSeq(L.surfs, p0, [L.surfs[0].x + 0.2 - p0[0], yh - p0[1]]);
    if (r.blocked || r.tir) continue;
    out.push(r);
  }
  return out;
}
const spreadAt = (rays, x) => { const ys = rays.map((r) => yAtX(r.pts[r.pts.length - 1], r.d, x)); return { lo: Math.min(...ys), hi: Math.max(...ys), mid: ys.reduce((a, b) => a + b, 0) / ys.length }; };
export function bestFocus(L, s) {
  const rays = lensRays(L, s, 15); let best = s.sensor, bw = Infinity;
  for (let x = 2; x <= 60; x += 0.05) { const sp = spreadAt(rays, x); if (sp.hi - sp.lo < bw) { bw = sp.hi - sp.lo; best = x; } }
  return best;
}
// ---- the eye, in mm
const EYE = { cf: 7.8, cb: 6.5, ct: 0.55, nc: 1.3771, na: 1.3374, acd: 3.05, lf: 10.2, lb: -6.0, lt: 4.0, nl: 1.42, nv: 1.336, len: 24.197 };
export function eyeSurfs(outside, lens = true) {
  const s = [];
  if (outside === 'goggles') s.push({ x: -14, R: Infinity, n: 1.5 }, { x: -12, R: Infinity, n: 1.0 });
  const c2 = EYE.ct, l1 = EYE.ct + EYE.acd, l2 = l1 + EYE.lt;
  s.push({ x: 0, R: EYE.cf, n: EYE.nc }, { x: c2, R: EYE.cb, n: EYE.na });
  if (lens) s.push({ x: l1, R: EYE.lf, n: EYE.nl }, { x: l2, R: EYE.lb, n: EYE.nv });
  else s.push({ x: l1, R: EYE.lf, n: EYE.na }, { x: l2, R: EYE.lb, n: EYE.nv });
  return s;
}
const nOutside = (o) => (o === 'air' ? 1 : 1.333);
export function eyeOptics(s) {
  const n0 = nOutside(s.outside), surfs = eyeSurfs(s.outside, s.lens);
  const bf = backFocus(surfs, n0);
  const pCorF = (EYE.nc - (s.outside === 'water' ? 1.333 : 1)) / (EYE.cf / 1000), pCorB = (EYE.na - EYE.nc) / (EYE.cb / 1000);
  const pLens = s.lens ? (EYE.nl - EYE.na) / (EYE.lf / 1000) + (EYE.nv - EYE.nl) / (EYE.lb / 1000) : 0;
  return { n0, surfs, bf, pCorF, pCorB, pCor: pCorF + pCorB, pLens, miss: bf - EYE.len };
}

export default {
  id: 'lenses',
  short: 'Lenses',
  title: 'A lens is Snell’s law, twice',
  subtitle: 'Curve the glass and every ray bends by just the right amount to meet at one point.',
  view: VIEWS.lens,
  learn: `<p>A <b>convex lens</b> is thicker in the middle than at the edges. Nothing magic happens inside it. Each ray obeys Snell's law once as it enters the curved front face, and again as it leaves the curved back face.</p>
    <p>The curve is the trick. Near the edge the surface is tilted, so rays there meet it at a steep angle and bend a lot. Through the middle the surface is almost square-on, so rays bend very little. Get the curve right and rays from one point of an object all meet again at one point behind the lens: a <b>focus</b>. That point is an upside-down <b>image</b>.</p>
    <p>A curvier lens bends harder and focuses closer: its <b>focal length f</b> is shorter. For a thin lens, <b>1/f = (n − 1)(1/R₁ − 1/R₂)</b>, and where the image lands follows <b>1/f = 1/u + 1/v</b>. A <b>camera</b> focuses by moving the lens until the image lands exactly on the sensor (see CameraClear). A phone's tiny lens has f of only about 4 to 6 mm.</p>
    <p>Your <b>eye</b> does the same with living parts (see EyeClear). Surprise: the <b>cornea</b>, the clear dome at the front, does about <b>two thirds</b> of the bending, around 42 of the eye's 60 dioptres. The lens behind it only fine-tunes. The cornea is so strong because light jumps from air (n = 1.00) into it (n = 1.38), the biggest change of speed on the way in.</p>
    <p>That's why everything is blurry when you open your eyes under water. Water (1.33) is nearly as slow as the cornea, so the cornea hardly bends at all. <b>Goggles</b> fix it by putting air back in front of your eyes.</p>
    <p class="tip"><b>Try it:</b> move the object and watch the image slide, then press <b>Autofocus</b>. Make the lens curvier. In the eye, switch to <b>water</b> and watch the focus run far behind the retina, then put on goggles.</p>`,
  terms: [
    { t: 'Convex lens', d: 'A lens thicker in the middle. It bends parallel rays inwards to meet at a focus.' },
    { t: 'Focal length (f)', d: 'How far behind a lens parallel rays meet. Shorter f means a stronger lens.' },
    { t: 'Dioptre (D)', d: 'Lens power, 1 ÷ f in metres. A 50 mm lens is 20 D; the whole eye is about 60 D.' },
    { t: 'Real image', d: 'A picture made where rays really meet, which can be caught on a sensor or screen.' },
    { t: 'Cornea', d: 'The clear dome at the front of the eye. It does about two thirds of the eye’s focusing.' },
    { t: 'Spherical aberration', d: 'Rays through the edge of a round-surfaced lens focus a little closer than rays through the middle.' },
  ],
  defaults: { focus: 'lens', R: 10, u: 25, sensor: 14, outside: 'air', lens: true },
  controls: [
    { key: 'focus', type: 'seg', label: 'Look at', options: [{ v: 'lens', label: 'Camera lens' }, { v: 'eye', label: 'Your eye' }] },
    { key: 'R', type: 'range', label: 'Lens: curve of each face, R', min: 6, max: 14, step: 0.5, ends: ['6 cm (curvy)', '14 cm (flatter)'], fmt: (v) => v.toFixed(1) + ' cm' },
    { key: 'u', type: 'range', label: 'Lens: object distance, u', min: 5, max: 30, step: 0.5, ends: ['5 cm', '30 cm'], fmt: (v) => v.toFixed(1) + ' cm' },
    { key: 'sensor', type: 'range', label: 'Lens: sensor distance (focus)', min: 5, max: 30, step: 0.1, ends: ['5 cm', '30 cm'], fmt: (v) => v.toFixed(1) + ' cm' },
    { key: 'af', type: 'buttons', label: 'Lens: focus for me', items: [{ label: 'Autofocus', act: (s) => { s.focus = 'lens'; s.sensor = clamp(Math.round(bestFocus(lensOf(s), s) * 10) / 10, 5, 30); } }] },
    { key: 'outside', type: 'seg', label: 'Eye: in front of the eye', options: [{ v: 'air', label: 'Air' }, { v: 'water', label: 'Water' }, { v: 'goggles', label: 'Water + goggles' }] },
    { key: 'lens', type: 'toggle', label: 'Eye: keep the eye’s own lens', hint: 'Turn off to see the eye without its lens, as after old-style cataract surgery.' },
  ],
  onChange(s, key) {
    if (['R', 'u', 'sensor'].includes(key)) s.focus = 'lens';
    if (['outside', 'lens'].includes(key)) s.focus = 'eye';
  },
  quiz: [
    { q: 'Why do rays through the edge of a convex lens bend more than rays through the middle?', options: ['The glass is denser at the edge', 'The surface is more tilted there, so they meet it at a steeper angle', 'The edge is thinner', 'They travel further'], answer: 1, why: 'Snell’s law depends on the angle to the normal. At the edge the curved surface is tilted, so the angle is big and the bend is big. In the middle it is square-on and the bend is small.' },
    { q: 'Which part of your eye does most of the focusing?', options: ['The lens', 'The cornea', 'The pupil', 'The retina'], answer: 1, why: 'The cornea gives about 42 of the eye’s 60 dioptres, because light goes from air (1.00) into the cornea (1.38), the biggest jump in speed.' },
    { q: 'Why is your vision blurry under water, and why do goggles help?', options: ['Water is dirty; goggles clean it', 'Water has nearly the cornea’s index, so the cornea stops bending; goggles put air back in front of it', 'Water presses on the eye; goggles push back', 'Light can’t travel in water'], answer: 1, why: 'Refraction needs a change of speed. Water (1.33) and cornea (1.38) are close, so the cornea loses most of its power. Goggles give it air to work against again.' },
  ],
  reel: [
    { ms: 5400, caption: 'In your eye the cornea does two thirds of the bending. Under water it almost stops.', set: { focus: 'eye', lens: true }, act: (s) => { s.outside = 'air'; }, anim: { outside: ['air', 'water'] }, view: { pos: [43.5, 4.6, 11], target: [43.5, 4.2, 0] }, spin: 0.04 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    const G = { lens: new THREE.Group(), eye: new THREE.Group() };
    G.lens.position.x = X.lens; G.eye.position.x = X.eye; root.add(G.lens, G.eye);
    const sw = focusSwitch(stage, G, VIEWS);
    let S = s0, key = '';

    // ================================================================ camera lens
    const gl = G.lens;
    const bench = box(20, 0.14, 2.4, M.matte(0x2b3039)); bench.position.set(0, 0.07, 0); gl.add(bench);
    dashed(gl, [-9.8, AY, 0], [9.8, AY, 0], COL.normal, 0.2, 0.01);
    const glassM = new THREE.MeshPhysicalMaterial({ color: 0xcff3ff, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
    let lensMesh = null;
    const ring = new THREE.Group(); gl.add(ring);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 12), M.metal(0x6d7380)); gl.add(post);
    // the object: an upright arrow on a stand
    const objG = new THREE.Group(); gl.add(objG);
    const objMat = M.plastic(0xffb547);
    objG.add(beam([0, 0, 0], [0, OBJ_H * K - 0.22, 0], 0.05, objMat));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 16), objMat); cone.position.y = OBJ_H * K - 0.13; objG.add(cone);
    const objPost = beam([0, -AY + 0.14, 0], [0, 0, 0], 0.04, M.metal(0x6d7380)); objG.add(objPost);
    // the image: a ghost arrow where the rays meet
    const imgG = new THREE.Group(); gl.add(imgG);
    const imgMat = M.ghost(0xffb547, 0.45);
    const imgShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 12), imgMat); imgG.add(imgShaft);
    const imgCone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 16), imgMat); imgG.add(imgCone);
    // the camera: a dark see-through body from the lens back to the sensor, and the sensor
    const bodyM = M.clear(0x1b1d22, 0.35);
    const body = box(1, 1, 1.6, bodyM); body.castShadow = false; gl.add(body);
    const sensor = box(0.08, 1.8, 1.4, M.matte(0x2a4d7a, { emissive: 0x0b1a2e })); gl.add(sensor);
    const lRays = rayPool(gl, 16, 0.025, COL.sun);
    const lObj = stage.label('object', [0, 0, 0], gl), lImg = stage.label('', [0, 0, 0], gl, 'hot'), lSen = stage.label('sensor', [0, 0, 0], gl), lF = stage.label('', [0, 0, 0], gl);
    lImg.element.style.setProperty('--c', '#ffb547');
    const fDot = sphere(0.07, M.glow(0x5ce1a9)); gl.add(fDot);
    let blurMm = 0;
    const photo = board(gl, 4.0, 3.0, 360, 270, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = '#0c1320'; g.fillRect(0, 0, w, h);
      const L = lensOf(S);
      const sm = S.sensor / S.u, H = Math.max(10, Math.min(200, OBJ_H * sm * 60));
      g.save(); g.filter = `blur(${Math.min(40, blurMm * 6).toFixed(1)}px)`;
      g.translate(w / 2, h / 2 - H / 2); g.fillStyle = '#ffb547'; g.strokeStyle = '#ffb547'; g.lineWidth = Math.max(4, H * 0.08);
      // the image on a sensor is upside down: the arrow points down
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, H * 0.78); g.stroke();
      g.beginPath(); g.moveTo(-H * 0.16, H * 0.72); g.lineTo(H * 0.16, H * 0.72); g.lineTo(0, H); g.closePath(); g.fill();
      g.restore();
      g.fillStyle = 'rgba(7,8,12,.7)'; g.fillRect(0, 0, w, 34);
      text(g, 'On the sensor', 12, 24, '#e8eef8', 'bold 19px sans-serif');
      const ok = blurMm < 0.6;
      text(g, !L.real ? 'no real image' : ok ? 'sharp' : 'blurry', w - (ok ? 70 : 84), 24, ok ? '#5ce1a9' : '#ff7a59', 'bold 18px sans-serif');
    }, [7.2, 8.0, -0.4]);
    photo.mesh.rotation.y = -0.15;

    // ================================================================ eye (mm → units)
    const ge = G.eye, KE = 0.28, EY = 4.0;
    const e2 = (x, y) => [x * KE, y * KE + EY, 0];
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(12 * KE, 48, 32), new THREE.MeshStandardMaterial({ color: 0xf1ece4, transparent: true, opacity: 0.1, depthWrite: false }));
    sclera.position.set(12.4 * KE, EY, 0); ge.add(sclera);
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(12 * KE, 0.03, 8, 96), M.glow(0xd9cfc2, { transparent: true, opacity: 0.5 })); rimRing.position.set(12.4 * KE, EY, 0); ge.add(rimRing);
    // retina: an arc at the back of the eye
    const retPts = []; for (let a = -1.0; a <= 1.0; a += 0.05) retPts.push([12.4 * KE + 11.8 * KE * Math.cos(a), EY + 11.8 * KE * Math.sin(a), 0]);
    ge.add(tube(retPts, 0.07, M.matte(0xd8465a, { emissive: 0x3a0a12 }), false, 60));
    // cornea: a thin shell cap, and the lens: lathed
    const capProfile = []; for (let y = 0; y <= 5.6; y += 0.2) { const xs = EYE.cf - Math.sqrt(EYE.cf * EYE.cf - y * y); capProfile.push([xs * KE, y * KE]); }
    const corneaM = new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
    const cornea = latheX(capProfile, corneaM, { seg: 48 }); cornea.position.set(0, EY, 0); ge.add(cornea);
    const lensProfile = [], l1 = EYE.ct + EYE.acd, l2 = l1 + EYE.lt;
    for (let y = 0; y <= 4.4; y += 0.2) lensProfile.push([(l1 + EYE.lf - Math.sqrt(EYE.lf ** 2 - y * y)) * KE, y * KE]);
    for (let y = 4.4; y >= 0; y -= 0.2) lensProfile.push([(l2 + EYE.lb + Math.sqrt(EYE.lb ** 2 - y * y)) * KE, y * KE]);
    const eyeLens = latheX(lensProfile, new THREE.MeshPhysicalMaterial({ color: 0xfff1c9, transparent: true, opacity: 0.45, roughness: 0.1, depthWrite: false }), { seg: 48 }); eyeLens.position.y = EY; ge.add(eyeLens);
    const iris = new THREE.Mesh(new THREE.RingGeometry(3.0 * KE, 5.8 * KE, 48), M.matte(0x3d7bd9, { side: THREE.DoubleSide })); iris.rotation.y = Math.PI / 2; iris.position.set((EYE.ct + EYE.acd - 0.2) * KE, EY, 0); ge.add(iris);
    const water = box(20 * KE, 16 * KE, 3, M.clear(0x3aa0ff, 0.14, { depthWrite: false })); water.position.set(-10.5 * KE, EY, 0); ge.add(water);
    const goggle = box(2 * KE, 12 * KE, 2.2, M.clear(0xe8f4ff, 0.3, { depthWrite: false })); goggle.position.set(-13 * KE, EY, 0); ge.add(goggle);
    const airGap = box(12 * KE, 12 * KE, 2.2, M.clear(0xffffff, 0.04, { depthWrite: false })); airGap.position.set(-6 * KE, EY, 0); ge.add(airGap);
    const eRays = rayPool(ge, 20, 0.022, COL.sun);
    const focusMark = sphere(0.09, M.glow(0x5ce1a9)); ge.add(focusMark);
    const lCor = stage.label('cornea', e2(0.5, 6.4), ge), lLens = stage.label('lens', e2(6.5, 5.4), ge), lRet = stage.label('retina', e2(23.5, -9.5), ge);
    const lFocus = stage.label('', [0, 0, 0], ge, 'hot'); lFocus.element.style.setProperty('--c', '#5ce1a9');

    return {
      update(dt, s) {
        dt = Math.max(0, dt); S = s;
        fitNarrow(stage, [lObj, lSen, lF, lCor, lLens, lRet]);
        reelPlace([[photo, [-1, 8.2, 0], 1.3]]);
        sw(s.focus);
        const k = JSON.stringify([s.focus, s.R, s.u, s.sensor, s.outside, s.lens]);
        if (k === key) return;
        key = k;
        if (s.focus === 'lens') {
          const L = lensOf(s), map = (p) => [p[0] * K, p[1] * K + AY, 0];
          const prof = []; const N = 24;
          for (let i = 0; i <= N; i++) { const y = (L.h * i) / N; prof.push([(-L.t / 2 + L.R - Math.sqrt(L.R * L.R - y * y)) * K, y * K]); }
          for (let i = N; i >= 0; i--) { const y = (L.h * i) / N; prof.push([(L.t / 2 - L.R + Math.sqrt(L.R * L.R - y * y)) * K, y * K]); }
          if (lensMesh) { gl.remove(lensMesh); lensMesh.geometry.dispose(); }
          lensMesh = latheX(prof, glassM, { seg: 64 }); lensMesh.position.y = AY; gl.add(lensMesh);
          const ph = Math.max(0.01, AY - L.h * K - 0.14); post.scale.y = ph; post.position.y = 0.14 + ph / 2;
          objG.position.set(-s.u * K, AY, 0); objPost.visible = true;
          // traced rays, run on to the sensor (or a little past the image if there is no sensor there)
          const rays = lensRays(L, s), xEnd = s.sensor, segs = [];
          for (const r of rays) {
            for (let i = 0; i < r.pts.length - 1; i++) segs.push({ a: r.pts[i], b: r.pts[i + 1], I: 0.85 });
            const last = r.pts[r.pts.length - 1];
            segs.push({ a: last, b: [xEnd, yAtX(last, r.d, xEnd)], I: 0.85 });
          }
          lRays.draw(segs, map);
          const sp = spreadAt(rays, s.sensor); blurMm = (sp.hi - sp.lo) * 10;
          sensor.position.set(s.sensor * K, AY, 0);
          const bx0 = L.t / 2 * K, bx1 = s.sensor * K;
          body.scale.set(Math.max(0.01, bx1 - bx0), (L.h * 2 + 1.2) * K, 1); body.position.set((bx0 + bx1) / 2, AY, 0);
          imgG.visible = L.real && L.v < 60;
          if (imgG.visible) {
            const hi = OBJ_H * L.m * K;               // negative: upside down
            imgG.position.set(L.v * K, AY, 0);
            imgShaft.scale.y = Math.max(0.01, Math.abs(hi) - 0.22); imgShaft.position.y = Math.sign(hi) * (Math.abs(hi) - 0.22) / 2;
            imgCone.position.y = hi - Math.sign(hi) * 0.13; imgCone.rotation.z = hi < 0 ? Math.PI : 0;
            lImg.position.set(L.v * K + 0.3, AY + hi - 0.35, 0); lImg.element.innerHTML = `image, <b>${L.v.toFixed(1)} cm</b>`;
          }
          lImg.visible = imgG.visible;
          fDot.position.set(L.bf * K, AY, 0); lF.position.set(L.bf * K, AY - 0.35, 0); lF.element.innerHTML = 'F';
          lObj.position.set(-s.u * K, AY + OBJ_H * K + 0.35, 0);
          lSen.position.set(s.sensor * K + 0.2, AY + 1.25, 0);
          photo.redraw();
        } else {
          const o = eyeOptics(s), segs = [], map = (p) => [p[0] * KE, p[1] * KE + EY, 0];
          const xEnd = Math.max(EYE.len + 1, Math.min(o.bf + 4, 42));
          for (let i = 0; i < 7; i++) {
            const y = -2.8 + (5.6 * i) / 6;
            const r = traceSeq(o.surfs, [-22, y], [1, 0], o.n0);
            for (let j = 0; j < r.pts.length - 1; j++) segs.push({ a: r.pts[j], b: r.pts[j + 1], I: 0.85 });
            const last = r.pts[r.pts.length - 1];
            if (!r.blocked && !r.tir) segs.push({ a: last, b: [xEnd, yAtX(last, r.d, xEnd)], I: 0.85 });
          }
          eRays.draw(segs, map);
          water.visible = s.outside !== 'air'; goggle.visible = airGap.visible = s.outside === 'goggles';
          eyeLens.visible = s.lens;
          focusMark.position.set(...map([Math.min(o.bf, 60), 0])); focusMark.visible = o.bf < 42;
          lFocus.position.set(...map([Math.min(o.bf, 40), 2.8])); lFocus.element.innerHTML = Math.abs(o.miss) < 0.3 ? 'focus <b>on the retina</b>' : `focus <b>${o.miss.toFixed(1)} mm</b> ${o.miss > 0 ? 'behind' : 'in front of'} the retina`;
        }
      },
      readout(s) {
        if (s.focus === 'eye') {
          const o = eyeOptics(s), tot = o.pCor + o.pLens;
          return `<div class="big">P = (n₂ − n₁) ÷ R</div>
            <div class="row"><span>Cornea front: ${s.outside === 'water' ? 'water' : 'air'} → cornea</span><b style="color:${COL.n2}">${o.pCorF.toFixed(1)} D</b></div>
            <div class="row"><span>Cornea back: cornea → aqueous</span><b>${o.pCorB.toFixed(1)} D</b></div>
            <div class="row"><span>The lens${s.lens ? '' : ' (removed)'}</span><b style="color:#fff1c9">${o.pLens.toFixed(1)} D</b></div>
            <div class="row"><span>Whole cornea${o.pCor > 0 ? ', share of the eye' : ''}</span><b>${o.pCor.toFixed(1)} D${o.pCor > 0 ? ` · ${Math.round((o.pCor / tot) * 100)}%` : ''}</b></div>
            <div class="row"><span>Focus vs the retina</span><b class="${Math.abs(o.miss) < 0.3 ? 'ok' : 'no'}">${Math.abs(o.miss) < 0.3 ? 'sharp' : (o.miss > 0 ? '+' : '') + o.miss.toFixed(1) + ' mm'}</b></div>
            <small>${s.outside === 'water' ? 'Water (1.333) is almost as slow as the cornea (1.377), so its front face loses nearly all its power.' : s.outside === 'goggles' ? 'The goggles’ flat window doesn’t bend parallel light, and the air behind it gives the cornea back its power.' : 'Light jumps from air (1.000) into the cornea (1.377), the biggest change of speed in the eye, so the cornea bends most.'} Surface powers are for rays near the middle.</small>`;
        }
        const L = lensOf(s), sharp = blurMm < 0.6;
        return `<div class="big">1/f = 1/u + 1/v</div>
          <div class="row"><span>Focal length, thin lens R ÷ 2(n − 1)</span><b>${L.fThin.toFixed(1)} cm</b></div>
          <div class="row"><span>Focal length, traced through the real lens</span><b style="color:${COL.n2}">${L.f.toFixed(1)} cm</b></div>
          <div class="row"><span>Object distance, u</span><b style="color:#ffb547">${s.u.toFixed(1)} cm</b></div>
          <div class="row"><span>Image distance, v</span><b style="color:#ffb547">${L.real ? L.v.toFixed(1) + ' cm' : 'none: rays spread out'}</b></div>
          <div class="row"><span>Sensor at · blur spot</span><b class="${sharp ? 'ok' : 'no'}">${s.sensor.toFixed(1)} cm · ${blurMm.toFixed(1)} mm</b></div>
          <small>${!L.real ? 'The object is inside the focal length: no real image forms. Look through the lens from the other side and you get a magnifying glass.' : sharp ? 'Sharp: the rays from the arrow’s tip meet on the sensor.' : `Move the sensor to about ${L.v.toFixed(1)} cm, or press Autofocus.`} A fat lens can’t bring every ray to one point: that leftover blur is spherical aberration.</small>`;
      },
    };
  },
};
