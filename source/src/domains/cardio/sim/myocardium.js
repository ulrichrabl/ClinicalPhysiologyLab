/* ===========================================================================
   Myocardium — the ECG as a consequence rather than a drawing.

   The old synthesiser added Gaussian bumps together and then applied a table of
   per-lead offsets to make each pathology look right. It produced convincing
   pictures, but nothing about them was derived: "anterior STEMI" meant "add
   3 mm to V1–V4", so a student could never ask *why* the reciprocal change
   appears in the inferior leads, and the model had no answer.

   This computes the leads from the muscle instead.

   Every source is a patch of myocardium with a position, a mass, an activation
   time and a membrane potential. Two mechanisms are superposed, because they are
   two genuinely different pieces of physics and a single coarse sum resolves
   neither well:

   1. THE WAVEFRONT DIPOLE, which writes the QRS and the T wave.

        H = Σ  m · (Vm_endo − Vm_epi) · n

      Each segment carries a transmural pair of layers, and the dipole points
      along the outward wall normal n in proportion to how much the inner layer
      disagrees with the outer one. A wavefront travelling endocardium to
      epicardium therefore points outward — toward an overlying electrode, which
      is why an approaching wavefront writes an upward deflection.

      The T wave needs no extra machinery. Epicardium has the shorter action
      potential, so it repolarises *first*; the sign of (Vm_endo − Vm_epi) is
      unchanged, and the T wave comes out concordant with the QRS. Reverse that
      one fact and the T wave inverts, which is exactly what ischaemia does.

   2. THE REGIONAL INJURY CURRENT, which writes ST shifts.

        φ = −Σ  m · (u·p) · (Vm − Vm_healthy)

      A monopole lead field over the *departure* of each region from what
      healthy muscle would be doing at that same instant. Taking the difference
      matters: an absolute monopole sum over a coarse two-layer mesh cannot
      resolve a moving wavefront and produces a large spurious deflection right
      through the QRS. Against a healthy reference the term is identically zero
      in a normal heart — the baseline is flat by construction — and becomes
      visible exactly when some region stops behaving like the others.

      This is also what an injury current physically is: current flowing between
      damaged and undamaged myocardium.

   The electrode potential is the sum, and the twelve leads are then ordinary
   arithmetic on electrode potentials. Nothing is written per-lead. Consequences
   that used to be table entries are now results:

     · reciprocal change — the same vector seen from the other side
     · Q waves — dead muscle contributes no wavefront, so the vector points away
     · ST elevation vs depression — transmural injury versus subendocardial,
       which is the same lesion at different depth rather than two rules
     · widened QRS — activation times spread apart
     · concordant or inverted T — which layer has the longer action potential
=========================================================================== */

/* --- torso geometry --------------------------------------------------------
   Right-handed anatomical axes, origin at the centre of the ventricular mass:
     x  toward the patient's left
     y  inferior (toward the feet)
     z  anterior (out of the chest)
   Electrode directions are unit vectors from the heart toward each electrode. */
const ELECTRODES = {
  RA: [-0.82, -0.52, 0.24],
  LA: [0.82, -0.52, 0.24],
  LL: [0.28, 0.94, 0.18],
  V1: [-0.28, 0.02, 0.96],
  V2: [-0.05, 0.04, 0.998],
  V3: [0.28, 0.16, 0.945],
  V4: [0.52, 0.24, 0.82],
  V5: [0.76, 0.22, 0.61],
  V6: [0.94, 0.18, 0.29],
};
for (const k of Object.keys(ELECTRODES)) {
  const v = ELECTRODES[k];
  const n = Math.hypot(v[0], v[1], v[2]);
  ELECTRODES[k] = [v[0] / n, v[1] / n, v[2] / n];
}

/* --- segments --------------------------------------------------------------
   Built from the left ventricular long axis rather than typed in by hand, so
   the walls end up where the walls actually are. The axis runs from the base
   (up, right, posterior) to the apex (down, left, slightly anterior); the six
   walls sit around it at sixty-degree intervals, and each is sampled at basal,
   mid and apical levels.

   Doing it this way matters because the inferior wall has to be genuinely
   inferior. Place it posteriorly instead — which is easy to do by eye — and an
   inferior infarct produces reciprocal change in the precordial leads and no
   elevation in II, III or aVF at all. */
const AXIS = norm([0.55, 0.72, 0.42]);          // base → apex
const RAD_A = norm(reject([0, 0, 1], AXIS));     // anterior radial direction
const RAD_B = cross(AXIS, RAD_A);                // completes the basis

function norm(v) { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function reject(v, a) { const k = dot(v, a); return [v[0] - k * a[0], v[1] - k * a[1], v[2] - k * a[2]]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function radial(deg) {
  const r = deg * Math.PI / 180;
  const c = Math.cos(r), s2 = Math.sin(r);
  return [c * RAD_A[0] + s2 * RAD_B[0], c * RAD_A[1] + s2 * RAD_B[1], c * RAD_A[2] + s2 * RAD_B[2]];
}

/* Wall name, angle around the axis, coronary territory, mass factor.

   The septum is lighter than the free wall — it is shared with the right
   ventricle, and the right ventricle depolarises across it in the opposite
   direction, so its net contribution to the surface vector is smaller. That
   asymmetry is not cosmetic: it is why the mean QRS vector points left and
   inferior instead of straight down. Give the six walls equal mass and their
   outward normals cancel, leaving only the apical component and an axis of
   nearly +90°. */
const WALLS = [
  ['anterior', 0, 'LAD', 0.85],
  ['lateral', 60, 'LCx', 0.95],
  ['lateral', 120, 'LCx', 0.95],
  ['inferior', 180, 'RCA', 1.50],
  ['septal', 240, 'RCA', 0.85],
  ['septal', 300, 'LAD', 0.85],
];
/* Level name, position along the axis, radius, mass, activation delay in ms.
   Activation runs apex-to-base because that is the direction the Purkinje
   network delivers it. */
const LEVELS = [
  ['bas', -0.62, 0.62, 1.00, 46],
  ['mid', -0.02, 0.66, 1.05, 30],
  ['ap', 0.52, 0.42, 0.75, 16],
];

const SEGMENTS = [];
for (const [lvl, along, r, mass, tBase] of LEVELS) {
  for (const [wall, angle, terr, wm] of WALLS) {
    const rv = radial(angle);
    /* The septum is reached first by the left bundle and the free wall last,
       which is what tilts the QRS vector leftward and inferiorly. */
    const wallDelay = wall === 'septal' ? -8 : wall === 'anterior' ? 4 : 10;
    SEGMENTS.push({ id: `${lvl}_${wall}_${angle}`, along, rad: rv, r,
      mass: mass * wm, t: tBase + wallDelay, terr, wall });
  }
}
SEGMENTS.push({ id: 'apex', along: 0.95, rad: AXIS, r: 0.18, mass: 0.55, t: 12, terr: 'LAD', wall: 'apical' });

/* Right ventricle: a thin sheet wrapped around the right and anterior aspect of
   the septum, with about a fifth of the mass of the left. It is the reason V1
   has any positive deflection at all. */
for (const [id, along, angle, mass, t] of [
  ['rv_bas', -0.55, 285, 0.26, 34], ['rv_mid', 0.00, 275, 0.28, 30], ['rv_ap', 0.45, 265, 0.20, 26],
]) {
  const rv = radial(angle);
  SEGMENTS.push({ id, along, rad: rv, r: 1.05, mass, t, terr: 'RCA', wall: 'rv' });
}

/* Transmural layers. The epicardium activates later but repolarises earlier —
   that opposition is the entire reason a normal T wave points the same way as
   the QRS instead of the opposite way. */
/* Three layers rather than two. With only an inner and an outer shell the
   wavefront advances in one discrete jump per segment and the QRS comes out
   lumpy; a mid-wall layer smooths it without meaningfully more computation.
   Action potential duration shortens from endocardium outward, which is what
   makes the T wave concordant with the QRS. */
const LAYERS = [
  { id: 'endo', dr: -0.18, actDelay: 0, apdScale: 1.08, mass: 0.34 },
  { id: 'mid', dr: 0.00, actDelay: 15, apdScale: 1.00, mass: 0.34 },
  { id: 'epi', dr: 0.18, actDelay: 30, apdScale: 0.84, mass: 0.32 },
];

const ATRIA = [
  ['ra', -0.42, -0.86, 0.10, 0.16],
  ['la', 0.38, -0.90, -0.18, 0.14],
];

export const TERRITORY_SEGMENTS = {
  LAD: SEGMENTS.filter((s) => s[6] === 'LAD').map((s) => s[0]),
  RCA: SEGMENTS.filter((s) => s[6] === 'RCA').map((s) => s[0]),
  LCx: SEGMENTS.filter((s) => s[6] === 'LCx').map((s) => s[0]),
};
export const WALL_SEGMENTS = SEGMENTS.reduce((m, s) => {
  (m[s[7]] ??= []).push(s[0]);
  return m;
}, {});

/* Relative weight of the two mechanisms. The wavefront dominates the QRS; the
   injury current is a smaller, slower signal that only shows when muscle is
   damaged — which is why a normal ECG has a flat ST segment. */
const W_WAVE = 1.0;
const W_INJURY = 2.6;

export const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

/* --- action potential ------------------------------------------------------
   A smooth phase-0 upstroke, a plateau, and a phase-3 decay. Written as an
   explicit function of time so a source can be sampled at any instant without
   integrating a channel model — the conduction network already provides the
   timing, and this only has to provide the shape. */
function actionPotential(t, apd, upstroke, steep = 11) {
  if (t < 0) return 0;
  const rise = 1 - Math.exp(-t / upstroke);
  if (t < apd * 0.12) return rise;
  const x = (t - apd * 0.12) / (apd * 0.88);
  if (x >= 1) return 0;
  // plateau that sags slightly, then a sigmoid phase 3
  const plateau = 1 - 0.16 * x;
  const repol = 1 / (1 + Math.exp((x - 0.72) * steep));
  return Math.max(0, plateau * repol);
}

class Source {
  constructor(id, pos, mass, baseAct, territory, wall, layer) {
    /* Conduction delay is deliberately outside reset(): it is set by the
       conduction system on each activation, not by the substrate, and clearing
       it when the substrate is re-applied silently erases bundle branch block. */
    this.condDelay = 0;
    this.id = id;
    this.pos = pos;
    this.mass = mass;
    this.baseAct = baseAct;
    this.territory = territory;
    this.wall = wall;
    this.layer = layer;
    this.reset();
  }
  reset() {
    this.actTime = -1e9;
    this.ischaemia = 0;     // 0..1 — raises resting potential, shortens APD
    this.necrosis = 0;      // 0..1 — electrically silent
    this.scale = 1;         // mass multiplier for hypertrophy
    this.apdOffset = 0;     // ms, for drugs and channelopathies
  }
}

export class Myocardium {
  constructor() {
    this.sources = [];
    for (const seg of SEGMENTS) {
      for (const L of LAYERS) {
        /* Only the radius changes between layers. Scaling the whole position
           vector instead tilts the transmural direction along the long axis,
           which puts a spurious basal-to-apical component into every wall and
           turns the QRS into a symmetric RS complex. */
        const rr = seg.r + L.dr;
        const pos = [
          AXIS[0] * seg.along + seg.rad[0] * rr,
          AXIS[1] * seg.along + seg.rad[1] * rr,
          AXIS[2] * seg.along + seg.rad[2] * rr,
        ];
        const src = new Source(`${seg.id}_${L.id}`, pos, seg.mass * L.mass,
          seg.t + L.actDelay, seg.terr, seg.wall, L.id);
        src.normal = seg.rad;     // the true outward wall normal
        src.apdScale = L.apdScale;
        this.sources.push(src);
      }
    }
    this.atria = ATRIA.map(([id, x, y, z, m]) => new Source(id, [x, y, z], m, 0, 'atrial', 'atrium', 'endo'));

    this.centre();
    this.buildLeadField();

    this.apdBase = 300;
    this.upstroke = 9;
    this.atrialApd = 110;
    this.vAct = -1e9;        // time of the current ventricular activation
    this.aAct = -1e9;
    this.t = 0;
    this.buffers = {};
    for (const l of LEADS) this.buffers[l] = [];
  }

  /* Mass-centre the sources so that a uniformly polarised myocardium is
     electrically silent. Without this the baseline drifts with heart rate and
     every ST measurement is meaningless. */
  centre() {
    const all = [...this.sources, ...this.atria];
    let M = 0; const c = [0, 0, 0];
    for (const s of all) {
      M += s.mass;
      for (let i = 0; i < 3; i++) c[i] += s.mass * s.pos[i];
    }
    for (let i = 0; i < 3; i++) c[i] /= M;
    for (const s of all) for (let i = 0; i < 3; i++) s.pos[i] -= c[i];
  }

  buildLeadField() {
    const all = [...this.sources, ...this.atria];
    this.field = {};
    for (const [name, u] of Object.entries(ELECTRODES)) {
      this.field[name] = all.map((s) => u[0] * s.pos[0] + u[1] * s.pos[1] + u[2] * s.pos[2]);
    }
    /* Transmural pairs, each with its outward wall normal — the geometry the
       wavefront dipole needs. */
    this.pairs = [];
    const byKey = new Map();
    for (const src of this.sources) {
      const key = src.id.replace(/_(endo|epi)$/, '');
      if (!byKey.has(key)) byKey.set(key, {});
      byKey.get(key)[src.layer] = src;
    }
    /* Adjacent layer pairs, so a three-layer wall contributes two wavefronts
       in succession rather than one jump. */
    for (const [key, pair] of byKey) {
      const order = ['endo', 'mid', 'epi'].filter((l) => pair[l]);
      for (let i = 0; i < order.length - 1; i++) {
        const inner = pair[order[i]], outer = pair[order[i + 1]];
        this.pairs.push({ key: `${key}:${order[i]}`, endo: inner, epi: outer,
          n: inner.normal, mass: inner.mass + outer.mass, wall: inner.wall });
      }
    }
    this.pairProj = {};
    for (const [name, u] of Object.entries(ELECTRODES)) {
      this.pairProj[name] = this.pairs.map((q) => u[0] * q.n[0] + u[1] * q.n[1] + u[2] * q.n[2]);
    }
  }

  /* ---- substrate ---------------------------------------------------------
     Everything a pathology can do to the muscle. Nothing here mentions a lead. */
  clearSubstrate() {
    for (const s of this.sources) { s.ischaemia = 0; s.necrosis = 0; s.scale = 1; s.apdOffset = 0; }
    for (const a of this.atria) { a.scale = 1; a.apdOffset = 0; }
    this.globalApdOffset = 0;
    this.globalRest = 0;
    this.upstroke = 9;
    this.condScale = 1;
    this.repolSteep = 11;
    this.jPoint = 0;
    this.atrialScale = 1;
    this.deltaWave = 0;
  }

  applySubstrate(sub = {}) {
    this.clearSubstrate();
    if (sub.ischaemia) {
      for (const spec of [].concat(sub.ischaemia)) this.injure(spec, 'ischaemia');
    }
    if (sub.necrosis) {
      for (const spec of [].concat(sub.necrosis)) this.injure(spec, 'necrosis');
    }
    if (sub.hypertrophy) {
      for (const [wall, k] of Object.entries(sub.hypertrophy)) {
        for (const s of this.sources) if (s.wall === wall) s.scale = k;
      }
    }
    if (sub.apd != null) this.globalApdOffset = sub.apd;
    if (sub.rest != null) this.globalRest = sub.rest;
    if (sub.upstroke != null) this.upstroke = sub.upstroke;
    if (sub.jPoint != null) this.jPoint = sub.jPoint;
    if (sub.condScale != null) this.condScale = sub.condScale;
    if (sub.repolSteep != null) this.repolSteep = sub.repolSteep;
    if (sub.atrialScale != null) this.atrialScale = sub.atrialScale;
    this.atrialDelay = sub.atrialDelay ?? 0;
    if (sub.deltaWave != null) this.deltaWave = sub.deltaWave;
    if (sub.wallApd) {
      for (const [wall, v] of Object.entries(sub.wallApd)) {
        for (const s of this.sources) if (s.wall === wall) s.apdOffset += v;
      }
    }
  }

  /* Injure a region. `layer` decides transmural versus subendocardial, which is
     the difference between ST elevation and ST depression — and it is the same
     lesion viewed at different depth, not two separate rules. */
  injure(spec, kind) {
    const { territory, wall, degree = 1, layer = 'all' } = spec;
    for (const s of this.sources) {
      const inRegion = (territory && s.territory === territory)
        || (wall && s.wall === wall)
        || (spec.segments && spec.segments.some((id) => s.id.startsWith(id)));
      if (!inRegion) continue;
      if (layer !== 'all' && s.layer !== layer) continue;
      s[kind] = Math.max(s[kind], degree);
    }
  }

  /* ---- timing ------------------------------------------------------------ */
  triggerVentricle(tms, { lbb = 1, rbb = 1 } = {}) {
    this.vAct = tms;
    /* Bundle branch block does not just widen the QRS: it changes the order in
       which the walls are reached, and that reordering is what produces the
       characteristic shapes. */
    for (const s of this.sources) {
      let d = 0;
      if (s.wall === 'rv') d = (1 - rbb) * 95;
      else if (s.wall === 'septal') d = (1 - lbb) * 55;
      else d = (1 - lbb) * 88;
      s.condDelay = d;
    }
  }

  triggerAtria(tms) { this.aAct = tms; }

  /* ---- sampling ---------------------------------------------------------- */
  sample(tms, hr) {
    const rr = 60000 / Math.max(30, hr || 72);
    // Rate adaptation of repolarisation — the reason QT shortens when you run.
    const apd = (this.apdBase * Math.sqrt(rr / 1000)) + this.globalApdOffset;

    const potentials = [];
    const healthy = [];
    for (const s of this.sources) {
      const dt = tms - (this.vAct + s.baseAct * this.condScale + s.condDelay);
      /* What this patch would be doing if it were healthy — the reference the
         injury current is measured against. */
      const refApd = Math.max(90, apd * s.apdScale + s.apdOffset);
      const ref = actionPotential(dt, refApd, this.upstroke, this.repolSteep);
      if (s.necrosis >= 0.99) {
        /* Dead muscle is electrically absent: it contributes no wavefront, and
           it must contribute no injury current either. Scar does not sustain a
           current — that is precisely what distinguishes an old infarct with Q
           waves from an acute one with ST elevation. Set the reference equal to
           the actual and the injury term for this patch is exactly zero. */
        potentials.push(0); healthy.push(0); continue;
      }
      healthy.push(ref);
      const segApd = Math.max(90, apd * s.apdScale * (1 - s.ischaemia * 0.28) + s.apdOffset);
      let v = actionPotential(dt, segApd, this.upstroke, this.repolSteep) * (1 - s.necrosis * 0.9);
      /* Ischaemic muscle rests at a less negative potential and its plateau is
         lower. During electrical diastole the healthy muscle disagrees with it,
         and that disagreement is the injury current the ST segment measures. */
      const rest = this.globalRest + s.ischaemia * 0.30;
      v = rest + v * (1 - s.ischaemia * 0.22);
      if (this.jPoint && s.layer === 'epi') v += this.jPoint * (dt > 0 && dt < segApd ? 1 : 0) * 0.12;
      potentials.push(v);
    }

    for (let ai = 0; ai < this.atria.length; ai++) {
      const a = this.atria[ai];
      const dt = tms - (this.aAct + (ai === 1 ? (this.atrialDelay || 0) : 0));
      const v = actionPotential(dt, this.atrialApd, 8) * this.atrialScale;
      potentials.push(v);
      healthy.push(v);
    }

    // Pre-excitation: a slurred early upstroke from an accessory pathway
    // inserting on the left free wall.
    if (this.deltaWave > 0) {
      const dt = tms - (this.vAct - 45);
      if (dt > 0 && dt < 60) {
        const k = this.deltaWave * (dt / 60);
        for (let i = 0; i < this.sources.length; i++) {
          if (this.sources[i].wall === 'lateral') potentials[i] += k * 0.55;
        }
      }
    }

    const all = this._all ??= [...this.sources, ...this.atria];
    const idx = this._idx ??= new Map(all.map((sx, i) => [sx, i]));

    /* 1 — wavefront dipole strength for each transmural pair. */
    const grad = this.pairs.map((q) => {
      const ve = potentials[idx.get(q.endo)];
      const vp = potentials[idx.get(q.epi)];
      return q.mass * q.endo.scale * (ve - vp);
    });

    const phi = {};
    for (const name of Object.keys(this.field)) {
      const coef = this.field[name];
      const proj = this.pairProj[name];
      let injury = 0;
      for (let i = 0; i < all.length; i++) {
        injury += all[i].mass * all[i].scale * coef[i] * (potentials[i] - healthy[i]);
      }
      let wave = 0;
      for (let i = 0; i < grad.length; i++) wave += grad[i] * proj[i];
      phi[name] = wave * W_WAVE - injury * W_INJURY;
    }
    return this.leadsFrom(phi);
  }

  /* Standard lead definitions. Nothing bespoke — once the electrode potentials
     exist, the twelve leads are arithmetic, and the reciprocal changes that
     used to be written into a table now simply happen. */
  leadsFrom(p) {
    const wct = (p.RA + p.LA + p.LL) / 3;
    const g = 1.45;      // scaling into millivolts
    return {
      I: (p.LA - p.RA) * g,
      II: (p.LL - p.RA) * g,
      III: (p.LL - p.LA) * g,
      aVR: (p.RA - (p.LA + p.LL) / 2) * g,
      aVL: (p.LA - (p.RA + p.LL) / 2) * g,
      aVF: (p.LL - (p.RA + p.LA) / 2) * g,
      V1: (p.V1 - wct) * g, V2: (p.V2 - wct) * g, V3: (p.V3 - wct) * g,
      V4: (p.V4 - wct) * g, V5: (p.V5 - wct) * g, V6: (p.V6 - wct) * g,
    };
  }

  /* Frontal-plane QRS axis, measured rather than declared: integrate the heart
     vector over the QRS and take its direction in the limb-lead plane. */
  measureAxis(hr) {
    let sx = 0, sy = 0;
    const t0 = this.vAct, step = 2;
    for (let t = t0; t < t0 + 120; t += step) {
      const L = this.sample(t, hr);
      sx += L.I; sy += L.aVF;
    }
    if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) return 60;
    return Math.atan2(sy, sx) * 180 / Math.PI;
  }
}
