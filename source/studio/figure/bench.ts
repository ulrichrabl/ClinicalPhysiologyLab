/* The figure bench: draws the patient figure in every pose for a set of patients, in the app's own figure frame and
   styles, so a screenshot shows exactly what the app will show. Built by studio/figure/build.mjs; driven by the URL:

     ?sheet=poses     patients × poses (the main contact sheet)
     ?sheet=states    gown, exposure and oxygen variants
     ?sheet=motion    one transition in frames (lying → sitting → standing)
     ?sheet=zoom&patient=<id>&pose=<pose>   one figure, large
     &theme=dark      dark mode
*/
import { figureSvg, figureLookFor, lerpPose, POSES, type Pose } from '../../src/vp/render/patient-figure.ts';

interface BenchPatient { id: string; label: string; patient: Parameters<typeof figureLookFor>[0]; synthetic?: boolean }
declare const __PATIENTS__: BenchPatient[];
declare const __SHEET_PATIENTS__: string[];

const q = new URLSearchParams(location.search);
const sheet = q.get('sheet') ?? 'poses';
if (q.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark';
const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const byId = Object.fromEntries(__PATIENTS__.map((p) => [p.id, p]));
const POSE_ORDER = ['supine', 'reclined-45', 'sitting', 'sitting-forward', 'left-lateral', 'standing'];

/* One figure in the same markup the app uses: a .figure-panel with svg#figure, viewBox 0 0 360 380, the drawing in g#fig. */
function cell(p: BenchPatient, pose: Pose, state: Parameters<typeof figureLookFor>[1], caption: string, width: number): string {
  const look = figureLookFor(p.patient, state, seedOf(p.id));
  return `<figure class="cell" style="width:${width}px"><div class="panel figure-panel"><svg id="figure" viewBox="0 0 360 380" role="img"><g id="fig">${figureSvg(pose, look)}</g></svg></div>
    <figcaption>${caption}</figcaption></figure>`;
}

const root = document.getElementById('bench')!;
const W = Number(q.get('w') ?? 190);
const rows: string[] = [];
const desc = (p: BenchPatient) => `${p.label} · ${p.patient.age}${p.patient.sex} · tone ${p.patient.appearance.skinTone} · ${p.patient.appearance.hair} · ${p.patient.appearance.build ?? ''}${p.synthetic ? ' · (bench only)' : ''}`;

if (sheet === 'poses') {
  const ids = q.get('all') ? __PATIENTS__.map((p) => p.id) : __SHEET_PATIENTS__;
  rows.push(`<div class="row head">${POSE_ORDER.map((k) => `<div style="width:${W}px">${k}</div>`).join('')}</div>`);
  for (const id of ids) {
    const p = byId[id];
    rows.push(`<div class="label">${desc(p)}</div><div class="row">${POSE_ORDER.map((k) => cell(p, POSES[k], { exposure: [] }, '', W)).join('')}</div>`);
  }
} else if (sheet === 'states') {
  const states: Array<[string, Parameters<typeof figureLookFor>[1]]> = [
    ['gown', { exposure: [] }], ['chest bare', { exposure: ['chest', 'neck', 'arm'] }], ['abdomen bare', { exposure: ['abdomen'] }],
    ['both bare', { exposure: ['chest', 'neck', 'arm', 'abdomen'] }], ['nasal O₂', { exposure: [], oxygen: { device: 'nasal cannula 2 L/min', fio2: 0.28 } }],
    ['mask O₂', { exposure: [], oxygen: { device: 'non-rebreather mask 15 L/min', fio2: 0.8 } }],
  ];
  rows.push(`<div class="row head">${states.map(([n]) => `<div style="width:${W}px">${n}</div>`).join('')}</div>`);
  for (const id of __SHEET_PATIENTS__.slice(0, 4)) {
    const p = byId[id];
    rows.push(`<div class="label">${desc(p)} · reclined-45</div><div class="row">${states.map(([, st]) => cell(p, POSES['reclined-45'], st, '', W)).join('')}</div>`);
  }
} else if (sheet === 'motion') {
  const p = byId[q.get('patient') ?? __SHEET_PATIENTS__[0]];
  const legs: Array<[string, string]> = [['supine', 'sitting'], ['sitting', 'standing']];
  for (const [a, b] of legs) {
    const frames = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];
    rows.push(`<div class="label">${desc(p)} · ${a} → ${b} (eased, as in the app)</div><div class="row">${frames.map((x) => {
      const e = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
      return cell(p, lerpPose(POSES[a], POSES[b], e), { exposure: [] }, `t=${x}`, W);
    }).join('')}</div>`);
  }
} else if (sheet === 'zoom') {
  const p = byId[q.get('patient') ?? __SHEET_PATIENTS__[0]];
  const pose = q.get('pose') ?? 'reclined-45';
  const exposure = (q.get('exposure') ?? '').split(',').filter(Boolean);
  rows.push(`<div class="label">${desc(p)} · ${pose}${exposure.length ? ' · bare: ' + exposure.join(', ') : ''}</div>
    <div class="row">${cell(p, POSES[pose], { exposure }, '', Number(q.get('w') ?? 720))}</div>`);
}
root.innerHTML = rows.join('');
document.body.dataset.ready = '1';
