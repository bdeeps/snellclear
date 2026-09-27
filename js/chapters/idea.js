// Chapter 1: Snell's law as a live experiment. A laser in one material shines on the flat boundary
// with another. Snell: n₁ sin θ₁ = n₂ sin θ₂, angles measured from the normal (the line at right angles
// to the surface). Indices from snell.js (air 1.000, water 1.333, glass 1.5, diamond 2.42).
// The reflected share is the Fresnel reflectance for unpolarised light, R = (Rs + Rp) ÷ 2: 2% at normal
// incidence from air into water, 4% into glass, 17% into diamond.
// Going into a lower index, past the critical angle θc = asin(n₂ ÷ n₁) nothing gets through: total
// internal reflection. Water to air 48.6°, glass to air 41.8°, diamond to air 24.4°.
// Speed in each material v = c ÷ n. The crests drawn on the beam are spaced by the wavelength in that
// material, λ ÷ n: the frequency (crests passing each second) never changes, so slower light has its
// crests closer together. Scene units are arbitrary (the block is about 8 cm wide).
import { THREE, M, box } from '../kit.js';
import {
  MEDIA, COL, DEG, hex, refractAngle, critical, fresnel, fmtDeg, kms, pct, board, panelBg, axes, title, line, dot, text,
  rayPool, wedge, dashed, laser, slab, fitNarrow, reelPlace, inReel, clamp,
} from '../snell.js';

const Y0 = 3.3, W = 8, H = 3.1, D = 2.2, LAS = 2.7;
const KEYS = Object.keys(MEDIA);
export function snell(s) {
  const n1 = MEDIA[s.top].n, n2 = MEDIA[s.bot].n, t1 = s.th1 * DEG;
  const t2 = refractAngle(n1, n2, t1), tc = critical(n1, n2);
  const R = t2 == null ? 1 : fresnel(n1, n2, Math.cos(t1));
  return { n1, n2, t1, t2, tc, R, tir: t2 == null, lhs: n1 * Math.sin(t1) };
}
// Length from the origin along direction d until the ray leaves the block (half-width W/2, height H).
const clip = (d) => Math.min(d[0] ? (W / 2 - 0.05) / Math.abs(d[0]) : 99, d[1] ? (H - 0.05) / Math.abs(d[1]) : 99);

export default {
  id: 'idea',
  short: 'The bend',
  title: 'Light bends when it changes speed',
  subtitle: 'Shine a laser from one material into another and watch it turn: n₁ sin θ₁ = n₂ sin θ₂.',
  view: { pos: [-1.9, 5.0, 17.5], target: [-1.9, 4.4, 0] },
  learn: `<p>Shine a laser from air into water and the beam doesn't carry straight on. At the surface it <b>bends</b>. That bending is called <b>refraction</b>, and <b>Snell's law</b> says exactly how much:</p>
    <p style="text-align:center"><b>n₁ sin θ₁ = n₂ sin θ₂</b></p>
    <p>The angles are measured from the <b>normal</b>, an imaginary line at right angles to the surface (the dashed line). <b>θ₁</b> is the angle of the beam coming in, <b>θ₂</b> the angle going out. Each material has a number <b>n</b>, its <b>refractive index</b>: air 1.000, water 1.333, glass about 1.5, diamond 2.42.</p>
    <p>What is n? It tells you how much <b>slower</b> light goes in that material: <b>v = c ÷ n</b>. Light races through air at almost 300,000 km/s, through water at 225,000 and through diamond at only 124,000. Going into a slower material, the beam bends <b>towards</b> the normal. Going into a faster one, it bends <b>away</b>. Think of a lawn roller rolling at a slant from a path onto grass: the wheel that hits the grass first slows first, and the roller swings round.</p>
    <p>Two more things happen at every surface. A little light <b>bounces back</b>, the faint reflected beam: about 2% at water, 4% at glass. And going from a slow material to a fast one, there is a <b>critical angle</b>. Tilt the beam past it and no light gets out at all. It all reflects: <b>total internal reflection</b>.</p>
    <p class="tip"><b>Try it:</b> sweep the angle and watch θ₂ on the chart. Then put <b>glass on top and air below</b> and tilt past 41.8°: the beam is trapped. Switch the bottom to diamond and see how hard it bends.</p>`,
  terms: [
    { t: 'Refraction', d: 'The bending of light as it passes from one material into another, because its speed changes.' },
    { t: 'Normal', d: 'An imaginary line at right angles to a surface. Angles of light are measured from it.' },
    { t: 'Refractive index (n)', d: 'How many times slower light travels in a material than in a vacuum: n = c ÷ v.' },
    { t: 'Snell’s law', d: 'n₁ sin θ₁ = n₂ sin θ₂: the rule for how much light bends at a boundary.' },
    { t: 'Critical angle', d: 'Going into a lower index, the angle of incidence beyond which no light gets out: sin θc = n₂ ÷ n₁.' },
    { t: 'Total internal reflection', d: 'When light hits a boundary beyond the critical angle and all of it reflects back.' },
  ],
  defaults: { th1: 40, top: 'air', bot: 'water', waves: true },
  controls: [
    { key: 'th1', type: 'range', label: 'Angle of incidence, θ₁', min: 0, max: 89, step: 0.5, ends: ['0° (straight in)', '89° (grazing)'], fmt: (v) => v.toFixed(1) + '°' },
    { key: 'top', type: 'seg', label: 'Top: the laser is in', options: KEYS.map((k) => ({ v: k, label: MEDIA[k].name })), fmt: (v) => `n₁ = ${MEDIA[v].n.toFixed(3)}` },
    { key: 'bot', type: 'seg', label: 'Bottom: the beam goes into', options: KEYS.map((k) => ({ v: k, label: MEDIA[k].name })), fmt: (v) => `n₂ = ${MEDIA[v].n.toFixed(3)}` },
    { key: 'go', type: 'buttons', label: 'Quick set-ups', items: [
      { label: 'Swap top and bottom', act: (s) => { [s.top, s.bot] = [s.bot, s.top]; } },
      { label: 'Glass to air at 45°', act: (s) => { s.top = 'glass'; s.bot = 'air'; s.th1 = 45; } },
    ] },
    { key: 'waves', type: 'toggle', label: 'Show the wave crests', hint: 'Crests are one wavelength apart. Slower light has them closer together.' },
  ],
  quiz: [
    { q: 'A laser goes from air into water at 40° from the normal. Which way does it bend?', options: ['Away from the normal, to more than 40°', 'Towards the normal, to about 29°', 'It carries straight on', 'It reflects straight back'], answer: 1, why: 'Water is slower (n = 1.333), so the beam bends towards the normal: sin θ₂ = sin 40° ÷ 1.333, so θ₂ ≈ 28.8°.' },
    { q: 'What does a refractive index of 2.42 (diamond) tell you?', options: ['Diamond is 2.42 times heavier than water', 'Light travels 2.42 times slower in diamond than in a vacuum', 'Diamond reflects 2.42 times more', 'Light bends 2.42 degrees'], answer: 1, why: 'n = c ÷ v. In diamond light moves at about 300,000 ÷ 2.42 ≈ 124,000 km/s.' },
    { q: 'Light inside glass (n = 1.5) hits the glass–air surface at 50°. What happens?', options: ['It bends out at about 75°', 'It passes straight through', 'All of it reflects back inside', 'It stops'], answer: 2, why: 'The critical angle for glass to air is asin(1 ÷ 1.5) = 41.8°. At 50° there is no angle that satisfies Snell’s law, so all the light reflects: total internal reflection.' },
  ],
  reel: [
    { ms: 5600, caption: 'Light bends when it enters a slower material. Snell’s law: n₁ sin θ₁ = n₂ sin θ₂.', set: { top: 'air', bot: 'water', waves: true }, anim: { th1: [5, 70] }, view: { pos: [0.2, 6.2, 9.5], target: [0.2, 5.7, 0] }, spin: 0.05 },
    { ms: 5400, caption: 'From glass into air, tilt past 41.8° and no light escapes. It all reflects back.', set: { top: 'glass', bot: 'air', waves: true }, anim: { th1: [25, 55] }, view: { pos: [0.2, 6.2, 9.5], target: [0.2, 5.7, 0] }, spin: 0.05 },
  ],

  build({ stage, s: s0 }) {
    const root = new THREE.Group(); stage.root.add(root);
    const top = slab(root, W, H, D, MEDIA.air.col, 0.06); top.position.set(0, Y0 + H / 2, 0);
    const bot = slab(root, W, H, D, MEDIA.water.col, 0.2); bot.position.set(0, Y0 - H / 2, 0);
    const stand = box(W + 0.4, 0.14, D + 0.4, M.matte(0x2b3039)); stand.position.set(0, Y0 - H - 0.07, 0); root.add(stand);
    // the boundary: a thin bright sheet
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.ghost(0xffffff, 0.12)); face.rotation.x = -Math.PI / 2; face.position.y = Y0; root.add(face);
    dashed(root, [0, Y0 - H + 0.1, 0.01], [0, Y0 + H - 0.1, 0.01], COL.normal);
    const lNormal = stage.label('normal', [0.05, Y0 + H - 0.05, 0], root);
    const las = laser(root);
    const rays = rayPool(root, 8, 0.035);
    const aux = rayPool(root, 2, 0.012, COL.crit);
    const w1 = wedge(root, COL.n1, 0.4), w2 = wedge(root, COL.n2, 0.4), wr = wedge(root, COL.refl, 0.15);
    const lT1 = stage.label('', [0, 0, 0], root, 'hot'), lT2 = stage.label('', [0, 0, 0], root, 'hot'), lCrit = stage.label('', [0, 0, 0], root, 'hot');
    lT1.element.style.setProperty('--c', COL.n1); lT2.element.style.setProperty('--c', COL.n2); lCrit.element.style.setProperty('--c', COL.crit);
    const lTop = stage.label('', [W / 2 - 1.1, Y0 + 0.35, D / 2], root), lBot = stage.label('', [W / 2 - 1.1, Y0 - H + 0.3, D / 2], root);
    const lRefl = stage.label('', [0, 0, 0], root);
    // wave crests: short bars across the beam, one wavelength apart
    const NC = 60, crest = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.035, 0.035), M.glow(0xffd0c8), NC);
    crest.instanceMatrix.setUsage(THREE.DynamicDrawUsage); crest.frustumCulled = false; root.add(crest);
    const o3 = new THREE.Object3D();

    let S = s0, key = "", phase = 0;
    const chart = board(root, 5.0, 3.6, 600, 430, (g, w, h) => {
      panelBg(g, w, h);
      const r = snell(S);
      title(g, 'Where the beam goes', 'θ₂ against θ₁');
      const { X, Y } = axes(g, w, h, { x0: 76, y1: 62, y0: h - 58, xMax: 90, yMax: 90, xTicks: [0, 15, 30, 45, 60, 75, 90], yTicks: [0, 30, 60, 90], xFmt: (v) => v + '°', yFmt: (v) => v + '°', xLabel: 'θ₁, coming in' });
      line(g, [[0, 0], [90, 90]], X, Y, 'rgba(255,255,255,.3)', 2, [6, 6]);
      text(g, 'no bending', X(58), Y(66), 'rgba(255,255,255,.45)', '16px sans-serif');
      const pts = []; let last = 90;
      for (let a = 0; a <= 90; a += 0.25) { const t = refractAngle(r.n1, r.n2, a * DEG); if (t == null) { last = a; break; } pts.push([a, t / DEG]); }
      if (r.tc != null) {
        const xc = r.tc / DEG;
        g.fillStyle = 'rgba(255,122,217,.14)'; g.fillRect(X(xc), Y(90), X(90) - X(xc), Y(0) - Y(90));
        line(g, [[xc, 0], [xc, 90]], X, Y, COL.crit, 2, [5, 5]);
        text(g, 'total internal', X(xc) + 8, Y(40), COL.crit, 'bold 17px sans-serif');
        text(g, `reflection past ${xc.toFixed(1)}°`, X(xc) + 8, Y(40) + 20, COL.crit, '16px sans-serif');
      }
      line(g, pts, X, Y, COL.n2, 4);
      if (!r.tir) dot(g, X(S.th1), Y(r.t2 / DEG), COL.n2, 9);
      else dot(g, X(S.th1), Y(90), COL.crit, 9);
      text(g, `${MEDIA[S.top].name} → ${MEDIA[S.bot].name}`, 20, 58 + 4, 'rgba(255,255,255,.7)', '16px sans-serif');
      text(g, 'θ₂, going out', 84, h - 16 - 0, COL.n2, '16px sans-serif');
    }, [-7.0, Y0 - 1.0, -0.4]);
    chart.mesh.rotation.y = 0.2;

    return {
      update(dt, s) {
        dt = Math.max(0, dt); S = s;
        fitNarrow(stage, [lNormal, lRefl, lTop, lBot]);
        reelPlace([[chart, [0.4, Y0 + 5.6, 0], 1.3]]);
        const r = snell(s);
        top.material.color.set(MEDIA[s.top].col); top.material.opacity = s.top === 'air' ? 0.05 : s.top === 'diamond' ? 0.3 : 0.2; top.edges.material.color.set(MEDIA[s.top].col);
        bot.material.color.set(MEDIA[s.bot].col); bot.material.opacity = s.bot === 'air' ? 0.05 : s.bot === 'diamond' ? 0.3 : 0.2; bot.edges.material.color.set(MEDIA[s.bot].col);
        const O = [0, 0], din = [-Math.sin(r.t1), -Math.cos(r.t1)], src = [-din[0] * LAS, -din[1] * LAS];
        const dref = [-Math.sin(r.t1), Math.cos(r.t1)], Lr = clip(dref);
        const segs = [{ a: src, b: O, I: 1 }, { a: O, b: [dref[0] * Lr, dref[1] * Lr], I: r.R, col: COL.refl }];
        let dout = null, Lo = 0;
        if (!r.tir) { dout = [-Math.sin(r.t2), -Math.cos(r.t2)]; Lo = clip(dout); segs.push({ a: O, b: [dout[0] * Lo, dout[1] * Lo], I: 1 - r.R }); }
        const map = (p) => [p[0], p[1] + Y0, 0];
        rays.draw(segs, map);
        las.aim(map(src).map((v, i) => v - [din[0], din[1], 0][i] * 0.02), din);
        // the critical-angle direction, on the incoming side
        if (r.tc != null) aux.draw([{ a: O, b: [Math.sin(r.tc) * 2.6, Math.cos(r.tc) * 2.6], I: 0.7 }], map); else aux.hide();
        const Oc = [0, Y0, 0.02], rr = 1.0;
        w1.set(Oc, rr, Math.PI / 2, -r.t1);
        if (!r.tir) w2.set(Oc, rr * 0.85, -Math.PI / 2, -r.t2); else w2.hideAll();
        wr.set(Oc, rr * 0.7, Math.PI / 2, r.t1);
        const a1 = Math.PI / 2 - r.t1 / 2;
        lT1.position.set(1.45 * Math.cos(a1) + 0.35, Y0 + 1.45 * Math.sin(a1), 0.1); lT1.element.innerHTML = `θ₁ = <b>${s.th1.toFixed(1)}°</b>`;
        lT2.visible = !r.tir;
        if (!r.tir) { const a2 = -Math.PI / 2 - r.t2 / 2; lT2.position.set(1.35 * Math.cos(a2) - 0.35, Y0 + 1.35 * Math.sin(a2), 0.1); lT2.element.innerHTML = `θ₂ = <b>${fmtDeg(r.t2)}</b>`; }
        lCrit.visible = r.tc != null;
        if (r.tc != null) { lCrit.position.set(Math.sin(r.tc) * 2.8 + 0.3, Y0 + Math.cos(r.tc) * 2.8, 0); lCrit.element.innerHTML = r.tir ? 'past the critical angle: <b>all reflected</b>' : `critical angle <b>${fmtDeg(r.tc)}</b>`; }
        lTop.element.innerHTML = `${MEDIA[s.top].name} · n₁ = ${MEDIA[s.top].n.toFixed(3)}`;
        lBot.element.innerHTML = `${MEDIA[s.bot].name} · n₂ = ${MEDIA[s.bot].n.toFixed(3)}`;
        lRefl.position.set(dref[0] * Math.min(Lr, 2.4) - 0.1, Y0 + dref[1] * Math.min(Lr, 2.4) + 0.15, 0); lRefl.element.innerHTML = `reflected ${pct(r.R)}`;
        // crests march along the beam: equal time steps, so the spacing is the local wavelength.
        // In time units where light crosses 1 scene unit of vacuum in 1: crest spacing λ₀ = 0.28 units.
        phase = (phase + dt * 0.55) % 1;
        let i = 0;
        if (s.waves) {
          const lam = 0.28, path = [[src, din, LAS, r.n1]];
          if (!r.tir) path.push([O, dout, Lo, r.n2]); else path.push([O, dref, Lr, r.n1]);
          let off = phase * lam;           // optical distance already travelled before this piece, in crests
          for (const [p, d, L, n] of path) {
            const step = lam / n;           // distance between crests in this material
            let x = off / n;
            while (x < L && i < NC) {
              o3.position.set(p[0] + d[0] * x, p[1] + d[1] * x + Y0, 0);
              o3.rotation.set(0, 0, Math.atan2(d[1], d[0]) + Math.PI / 2); o3.scale.setScalar(1); o3.updateMatrix();
              crest.setMatrixAt(i++, o3.matrix); x += step;
            }
            off = (x - L) * n;              // carry the leftover over the boundary
          }
        }
        for (; i < NC; i++) { o3.position.set(0, -500, 0); o3.scale.setScalar(0.0001); o3.updateMatrix(); crest.setMatrixAt(i, o3.matrix); }
        crest.instanceMatrix.needsUpdate = true;
        const k = `${s.th1}|${s.top}|${s.bot}`;
        if (k !== key) { key = k; chart.redraw(); }
      },
      readout(s) {
        const r = snell(s);
        const rows = `<div class="row"><span>n₁ sin θ₁ = ${r.n1.toFixed(3)} × sin ${s.th1.toFixed(1)}°</span><b style="color:${COL.n1}">${r.lhs.toFixed(3)}</b></div>
          <div class="row"><span>so sin θ₂ = ${r.lhs.toFixed(3)} ÷ ${r.n2.toFixed(3)}</span><b style="color:${r.tir ? COL.crit : COL.n2}">${(r.lhs / r.n2).toFixed(3)}${r.tir ? ', more than 1!' : ''}</b></div>
          <div class="row"><span>Angle going out, θ₂</span><b style="color:${r.tir ? COL.crit : COL.n2}">${r.tir ? 'none: trapped' : fmtDeg(r.t2)}</b></div>
          <div class="row"><span>Critical angle</span><b style="color:${COL.crit}">${r.tc == null ? 'none (into slower)' : fmtDeg(r.tc)}</b></div>
          <div class="row"><span>Reflected back</span><b>${pct(r.R)}</b></div>`;
        const note = r.tir ? 'Total internal reflection: every bit of the light bounces back inside. This is what traps light in an optical fibre.'
          : r.n2 > r.n1 ? 'Into a slower material: the beam bends towards the normal.'
          : r.n2 < r.n1 ? 'Into a faster material: the beam bends away from the normal.' : 'Same index on both sides: no bending, no reflection.';
        return `<div class="big">n₁ sin θ₁ = n₂ sin θ₂</div>${rows}<small>${note} Speed: ${kms(r.n1)} on top, ${kms(r.n2)} below.</small>`;
      },
    };
  },
};
