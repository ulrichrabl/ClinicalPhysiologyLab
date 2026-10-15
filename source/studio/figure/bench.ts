/* The figure bench: draws the patient figure in every pose for a set of patients, in the app's own figure frame and
   styles, so a screenshot shows exactly what the app will show. Built by studio/figure/build.mjs; driven by the URL:

     ?sheet=poses     patients × poses (the main contact sheet)
     ?sheet=states    gown, exposure and oxygen variants
     ?sheet=body      bodies: obesity (central, peripheral), cachexia, ascites, oedema, jaundice, cyanosis, COPD
     ?sheet=motion    one transition in frames (lying → sitting → standing)
     ?sheet=views     the patient from the right, the foot of the bed (front) and the left, and a walk round the bed
     ?sheet=chest     the chest views (auscultation, ECG) from the front and the back, drawn from the same body
     ?sheet=zoom&patient=<id>&pose=<pose>   one figure, large
     &theme=dark      dark mode
*/
import { figureSvg, figureLookFor, lerpPose, POSES, viewAt, VIEW_ANGLE, type FigureFindings, type FigureView, type Pose } from '../../src/vp/render/patient-figure.ts';
import { thoraxSvg, thoraxLimbSites, landmarks, stethoscope } from '../../src/vp/render/thorax.ts';

interface BenchPatient { id: string; label: string; patient: Parameters<typeof figureLookFor>[0]; findings?: FigureFindings; synthetic?: boolean }
declare const __PATIENTS__: BenchPatient[];
declare const __SHEET_PATIENTS__: string[];
declare const __BODY_PATIENTS__: string[];

const q = new URLSearchParams(location.search);
const sheet = q.get('sheet') ?? 'poses';
if (q.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark';
const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const byId = Object.fromEntries(__PATIENTS__.map((p) => [p.id, p]));
const POSE_ORDER = ['supine', 'reclined-45', 'sitting', 'sitting-forward', 'left-lateral', 'standing'];

/* One figure in the same markup the app uses: a .figure-panel with svg#figure, viewBox 0 0 360 380, the drawing in g#fig. */
function cell(p: BenchPatient, pose: Pose, state: Parameters<typeof figureLookFor>[1], caption: string, width: number, view?: FigureView, viewName = 'right'): string {
  const look = figureLookFor(p.patient, state, seedOf(p.id), p.findings ?? {});
  return `<figure class="cell" style="width:${width}px"><div class="panel figure-panel"><svg id="figure" data-view="${viewName}" viewBox="0 0 360 380" role="img"><g id="fig">${figureSvg(pose, look, view)}</g></svg></div>
    <figcaption>${caption}</figcaption></figure>`;
}

const root = document.getElementById('bench')!;
const W = Number(q.get('w') ?? 190);
const rows: string[] = [];
const desc = (p: BenchPatient) => {
  const a = p.patient, bmi = a.heightCm && a.weightKg ? ` · BMI ${(a.weightKg / (a.heightCm / 100) ** 2).toFixed(0)}` : '';
  const f = Object.entries(p.findings ?? {}).filter(([, v]) => v && v !== 'none' && v !== 'normal' && typeof v !== 'object').map(([k, v]) => (v === true ? k : `${k} ${v}`));
  if (p.findings?.breathing?.hyperinflated) f.push('hyperinflated');
  return `${p.label} · ${a.age}${a.sex} · tone ${a.appearance.skinTone} · ${a.appearance.hair} · ${a.appearance.build ?? ''}${bmi}${f.length ? ' · ' + f.join(', ') : ''}${p.synthetic ? ' · (bench only)' : ''}`;
};

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
} else if (sheet === 'body') {
  const cols: Array<[string, string, string[]]> = [['reclined-45, gown', 'reclined-45', []], ['reclined-45, bare', 'reclined-45', ['chest', 'neck', 'arm', 'abdomen']],
    ['supine, bare', 'supine', ['chest', 'neck', 'arm', 'abdomen']], ['sitting', 'sitting', []], ['standing', 'standing', []]];
  rows.push(`<div class="row head">${cols.map(([n]) => `<div style="width:${W}px">${n}</div>`).join('')}</div>`);
  for (const id of __BODY_PATIENTS__) {
    const p = byId[id];
    rows.push(`<div class="label">${desc(p)}</div><div class="row">${cols.map(([, k, exposure]) => cell(p, POSES[k], { exposure }, '', W)).join('')}</div>`);
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
} else if (sheet === 'views') {
  const cols: Array<[string, string, keyof typeof VIEW_ANGLE]> = [['reclined-45, right', 'reclined-45', 'right'], ['reclined-45, front', 'reclined-45', 'front'], ['reclined-45, left', 'reclined-45', 'left'],
    ['supine, front', 'supine', 'front'], ['sitting, front', 'sitting', 'front'], ['standing, front', 'standing', 'front']];
  rows.push(`<div class="row head">${cols.map(([n]) => `<div style="width:${W}px">${n}</div>`).join('')}</div>`);
  const ids = q.get('all') ? __PATIENTS__.map((p) => p.id) : __SHEET_PATIENTS__;
  for (const id of ids) {
    const p = byId[id];
    rows.push(`<div class="label">${desc(p)}</div><div class="row">${cols.map(([, k, v]) => cell(p, POSES[k], { exposure: [] }, '', W, viewAt(VIEW_ANGLE[v]), v)).join('')}</div>`);
  }
  /* a walk round the bed, eased as in the app */
  const p = byId[__SHEET_PATIENTS__[0]], frames = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];
  rows.push(`<div class="label">${desc(p)} · right → front → left (eased, as in the app)</div><div class="row">${frames.map((x) => {
    const e = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    return cell(p, POSES['reclined-45'], { exposure: [] }, `t=${x}`, Math.round(W * 0.78), viewAt(180 * e), 'turning');
  }).join('')}</div>`);
} else if (sheet === 'chest') {
  rows.push(`<div class="row head">${['front, bare', 'back', 'front, landmarks + electrodes'].map((n) => `<div style="width:${W}px">${n}</div>`).join('')}</div>`);
  for (const id of __BODY_PATIENTS__.concat(__SHEET_PATIENTS__.slice(0, 5))) {
    const p = byId[id];
    const fig = figureLookFor(p.patient, { exposure: [] }, seedOf(p.id), p.findings ?? {});
    const look = { skin: fig.skin, shade: fig.shade, sex: fig.sex, figure: fig };
    const el = Object.values(thoraxLimbSites(look) ?? {}).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#d33c32"/>`).join('');
    const c = (svg: string) => `<figure class="cell" style="width:${W}px"><div class="panel">${svg.replace('<svg ', '<svg class="thorax" ')}</div></figure>`;
    rows.push(`<div class="label">${desc(p)}</div><div class="row">${c(thoraxSvg(look, 'front'))}${c(thoraxSvg(look, 'back'))}${c(thoraxSvg(look, 'front', landmarks() + stethoscope(8.6, 3.6, false) + el))}</div>`);
  }
} else if (sheet === 'zoom') {
  const p = byId[q.get('patient') ?? __SHEET_PATIENTS__[0]];
  const pose = q.get('pose') ?? 'reclined-45';
  const exposure = (q.get('exposure') ?? '').split(',').filter(Boolean);
  const v = (q.get('view') ?? 'right') as keyof typeof VIEW_ANGLE;
  rows.push(`<div class="label">${desc(p)} · ${pose}${v !== 'right' ? ' · from the ' + (v === 'front' ? 'foot of the bed' : 'left') : ''}${exposure.length ? ' · bare: ' + exposure.join(', ') : ''}</div>
    <div class="row">${cell(p, POSES[pose], { exposure }, '', Number(q.get('w') ?? 720), viewAt(VIEW_ANGLE[v] ?? 0), v)}</div>`);
}
root.innerHTML = rows.join('');
document.body.dataset.ready = '1';
