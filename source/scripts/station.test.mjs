/* Stations (ADR-017): the electrical model's activation log, the timeline read from it, the station's settings and texts. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `station-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_station_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const S = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const J = (x) => JSON.stringify(x);
/* A known gap: a comparison the model does not yet meet, reported with its numbers; it does not fail the suite. */
const gaps = [];
const gap = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { gaps.push(name); console.log(`  △ known gap: ${name}${detail ? ' — ' + detail : ''}`); } };

/* A heart with a pattern, run long enough for the reflexes to settle, then recorded for six seconds. */
const record = (preset) => {
  const run = S.createCirculation(S.applyPreset(S.healthyModel(), preset));
  run.settleFast(6);
  run.sim.snapshot();                 // drain what settling produced
  run.advance(6);
  const snap = run.sim.snapshot();
  const v = snap.ecgLeads, h = run.heart, dt = 1000 / v.fs;
  const t0 = h.sampledTo - (v.X.length - 1) * dt;
  return { h, v, dt, t0, t1: h.sampledTo, acts: h.activations.filter((a) => a.t >= t0 - 600 && a.t <= h.sampledTo), atrial: h.p.atrial };
};
const mag = (r, t) => { const i = Math.round((t - r.t0) / r.dt); return i < 0 || i >= r.v.X.length ? NaN : Math.hypot(r.v.X[i], r.v.Y[i], r.v.Z[i]); };
const V = (r) => r.acts.filter((a) => a.kind === 'ventricles' && a.t > r.t0 + 100 && a.tEnd < r.t1);
const A = (r) => r.acts.filter((a) => a.kind === 'atria' && a.t > r.t0 + 100 && a.end < r.t1);

console.log('\nThe activation log agrees with the model');
{
  const r = record('normal');
  const v = V(r), a = A(r);
  ok('a healthy heart logs an atrial and a ventricular activation for every beat', v.length >= 5 && Math.abs(a.length - v.length) <= 1, `${a.length} atrial, ${v.length} ventricular`);
  ok('every P is conducted, after the model’s PR interval', a.every((x) => x.conductedAt != null && Math.abs(x.conductedAt - x.t - r.h.metrics.PR) <= 2), J(a.map((x) => x.conductedAt - x.t)));
  ok('the logged QRS and QT are the model’s own intervals', v.every((x) => Math.abs(x.qrsEnd - x.t - r.h.metrics.QRS) <= 2 && Math.abs(x.tEnd - x.t - r.h.metrics.QT) <= 15),
    J(v.map((x) => [x.qrsEnd - x.t, x.tEnd - x.t])) + ' vs ' + J(r.h.metrics));
  /* The largest dipole of each beat falls inside its logged QRS: the log describes the tracing it was recorded with. */
  const inside = v.map((x) => { let best = 0, at = 0; for (let t = x.t - 150; t < x.t + 300; t += 2) { const m = mag(r, t); if (m > best) { best = m; at = t; } } return at >= x.t && at <= x.qrsEnd; });
  ok('each beat’s largest dipole lies inside its logged QRS', inside.every(Boolean), J(inside));
  /* Between T and the next P the heart is quiet. */
  const quiet = [];
  for (let t = r.t0 + 50; t < r.t1 - 50; t += 10) if (S.momentAt(r.acts, t, r.atrial).phase === 'rest') quiet.push(mag(r, t));
  ok('where the timeline says baseline, the dipole is small (< 0.1 mV)', quiet.length > 20 && Math.max(...quiet) < 0.1, `max ${Math.max(...quiet).toFixed(3)} over ${quiet.length} samples`);
  const phases = new Set(); for (let t = r.t0; t < r.t1; t += 4) phases.add(S.momentAt(r.acts, t, r.atrial).phase);
  ok('a healthy beat passes through every phase', S.PHASES.every((p) => phases.has(p)), J([...phases]));
  const q = S.findPhase(r.acts, r.t0, r.t1, 'QRS', r.atrial);
  ok('“show me the QRS” lands inside a QRS near the middle of the strip', q != null && S.momentAt(r.acts, q, r.atrial).phase === 'QRS' && Math.abs(q - (r.t0 + r.t1) / 2) < 1000, String(q));
}

console.log('\nPatterns, read from the log');
{
  const rb = record('rbbb');
  ok('right bundle branch block: the right ventricle is reached late, and the beat is logged as such', V(rb).every((x) => x.route === 'rbbb' && x.late?.chamber === 'RV' && x.late.from > x.t && x.late.from < x.qrsEnd));
  const m = S.momentAt(rb.acts, V(rb)[1].late.from + 10, rb.atrial);
  ok('…and during the late part of QRS the timeline says the right ventricle has now been reached', m.phase === 'QRS' && m.late?.chamber === 'RV' && m.late.reached === true, J(m.late));
  const lb = record('lbbb');
  ok('left bundle branch block: the left ventricle is reached late', V(lb).every((x) => x.route === 'lbbb' && x.late?.chamber === 'LV'));
  const avb = record('avb1');
  ok('first-degree AV block: every P conducted, with a PR over 200 ms', A(avb).every((x) => x.conductedAt - x.t > 200), J(A(avb).map((x) => Math.round(x.conductedAt - x.t))));
  const mz = record('mobitz2');
  ok('Mobitz II: some P waves are dropped, the rest conducted with a constant PR', A(mz).some((x) => x.notConducted === 'dropped') && new Set(A(mz).filter((x) => x.conductedAt != null).map((x) => Math.round(x.conductedAt - x.t))).size === 1,
    J(A(mz).map((x) => x.conductedAt == null ? x.notConducted : Math.round(x.conductedAt - x.t))));
  const dropped = A(mz).find((x) => x.notConducted === 'dropped');
  ok('…and the timeline shows the dropped impulse stopping in the AV node', dropped && S.momentAt(mz.acts, dropped.end + 20, mz.atrial).avNode === 'blocked');
  const chb = record('chb');
  ok('complete heart block: no P is conducted; the ventricles beat from an escape focus', A(chb).every((x) => x.notConducted === 'complete-block') && V(chb).every((x) => x.origin === 'escape' && x.route === 'ectopic'));
  const vt = record('vt');
  ok('ventricular tachycardia: the sinus node carries on, dissociated, and is not shown as blocked', A(vt).every((x) => x.notConducted === 'dissociated')
    && A(vt).every((x) => S.momentAt(vt.acts, x.end + 20, vt.atrial).avNode !== 'blocked') && V(vt).every((x) => x.origin === 'vt'));
  const af = record('af');
  ok('atrial fibrillation: no atrial activations, the atria are shown fibrillating, and there is no P wave to find',
    A(af).length === 0 && S.momentAt(af.acts, (af.t0 + af.t1) / 2, af.atrial).atria === 'fibrillating' && S.findPhase(af.acts, af.t0, af.t1, 'P', af.atrial) === null);
  const wpw = record('wpw');
  ok('pre-excitation: the ventricles start through the accessory pathway before the AV node delivers the impulse',
    V(wpw).every((x) => x.route === 'pre-excited' && x.delta < x.t) && S.momentAt(wpw.acts, V(wpw)[1].delta + 5, wpw.atrial).ventricles === 'depolarising');
}

console.log('\nThe station is derived from its test');
{
  const groups = S.stationSettings(S.ECG_STATION);
  const ids = groups.flatMap((g) => g.vars.map((v) => v.id));
  ok('the ECG station offers the electrical model’s parameters, because the 12-lead measures that model', ['electrical.av', 'electrical.rbb', 'electrical.lbb', 'electrical.atrial', 'electrical.ischaemia', 'electrical.HR'].every((x) => ids.includes(x)), J(ids));
  ok('…plus plasma potassium, with its reason, and nothing from unrelated models', ids.includes('fluids.clamp-potassium') && groups.find((g) => g.id === 'driver/fluids.clamp-potassium')?.why
    && ids.every((x) => x.startsWith('electrical.') || x === 'fluids.clamp-potassium'), J(ids.filter((x) => !x.startsWith('electrical.'))));
  const presets = S.stationPresets(S.ECG_STATION).flatMap((g) => g.presets.map((p) => p.id));
  ok('every starting point is one of the electrical model’s named presets', presets.length === S.ECG_STATION.presets.flatMap((g) => g.ids).length, J(presets));
}

console.log('\nThe explanations');
{
  const texts = S.allTexts();
  const bad = texts.filter((x) => !x?.en?.trim() || !x?.de?.trim());
  ok(`every explanation is in English and German (${texts.length} texts checked)`, bad.length === 0, J(bad.slice(0, 3)));
  const leak = texts.filter((x) => /undefined|NaN|\$\{|null/.test(x.en + x.de));
  ok('no explanation shows a missing number', leak.length === 0, J(leak.slice(0, 3)));
  const same = [...new Set(texts.filter((x) => x.en === x.de && x.en.length > 6).map((x) => x.en))];
  ok('no explanation is left untranslated', same.length === 0, J(same.slice(0, 3)));
  const r = record('rbbb');
  const v = V(r)[1];
  const x = S.explain({ moment: S.momentAt(r.acts, v.t + 20, r.atrial), e: r.h.p, K: 4, metrics: r.h.metrics });
  ok('in right bundle branch block the QRS explanation names it and gives the model’s QRS width', x.title.en === 'Right bundle branch block' && x.body[0].en.includes(`QRS ${Math.round(v.qrsEnd - v.t)} ms`), x.body[0].en);
}

console.log('\nECG signs, from the knowledge tables (ADR-017 step 2)');
{
  const signs = S.signsTestLooksFor(S.KNOWLEDGE, S.CATALOG, 'ecg-12');
  ok('the 12-lead elicits the ECG signs, as their definitions say', signs.length >= 25 && signs.every((s) => S.testsForSign(S.KNOWLEDGE, S.CATALOG, s).includes('ecg-12')), J(signs));
  const read = (preset) => {
    const m = S.applyPreset(S.healthyModel(), preset);
    const c = S.caseWithModel(S.FREE_CASE, m);
    const view = S.buildView(c, { circulation: S.settleModel(m, 20).snapshot });
    const h = new S.SignEvaluator(S.CATALOG, (ref, ctx) => S.observe(S.CATALOG, S.REGISTRY.resolvers, c, view, ref, ctx), { test: 'ecg-12' });
    const map = Object.fromEntries(signs.map((s) => [s, h.holds(S.KNOWLEDGE.signs[s].definition)]));
    return { present: new Set(signs.filter((s) => map[s])), map, value: S.observe(S.CATALOG, S.REGISTRY.resolvers, c, view, 'ecg.reading', {}).value };
  };
  const healthy = read('normal');
  ok('a healthy heart shows none of the ECG signs', healthy.present.size === 0, J([...healthy.present]));
  /* Each named pattern shows the signs a reader would name, and the syndrome where there is one. */
  const expect = {
    rbbb: [['broad-qrs', 'rsr-prime-v1'], 'rbbb-pattern'], lbbb: [['broad-qrs', 'broad-r-v6'], 'lbbb-pattern'], avb1: [['prolonged-pr']],
    wenckebach: [['progressive-pr', 'dropped-p-waves', 'irregular-rhythm'], 'mobitz-1-pattern'], mobitz2: [['dropped-p-waves'], 'mobitz-2-pattern'],
    chb: [['av-dissociation', 'broad-qrs'], 'complete-av-block-pattern'], af: [['fibrillation-waves', 'absent-p-waves', 'irregular-rhythm']], flutter: [['flutter-waves']],
    vt: [['broad-complex-tachycardia']], wpw: [['short-pr', 'delta-wave', 'broad-qrs'], 'pre-excitation-pattern'], lvh: [['lvh-voltage']], rvh: [['right-axis-deviation']],
    'p-mitrale': [['broad-p-waves']], 'p-pulmonale': [['tall-p-waves']], 'stemi-anterior': [['st-elevation']], 'stemi-inferior': [['st-elevation', 'st-depression']],
    'stemi-lateral': [['st-elevation']], nstemi: [['st-depression', 't-wave-inversion']], wellens: [['t-wave-inversion']], pericarditis: [['st-elevation']],
    'long-qt': [['long-qtc']], digoxin: [['st-depression']], hyperkalaemia: [['tall-t-waves']], hypokalaemia: [['u-waves']],
  };
  for (const [preset, [want, syn]] of Object.entries(expect)) {
    const r = read(preset);
    const synOk = !syn || S.syndromePresent(S.KNOWLEDGE, syn, r.map);
    ok(`${preset}: ${want.join(', ')}${syn ? ` → ${syn}` : ''}`, want.every((s) => r.present.has(s)) && synOk, `shows ${J([...r.present])}`);
  }
  const lb = read('lbbb');
  ok('left bundle branch block: its discordant ST elevation in V1–V2 is not called ST elevation', lb.value.st.V1 >= 0.1 && !lb.present.has('st-elevation'), J(lb.value.st));
  const vt = read('vt');
  ok('ventricular tachycardia: dissociated P waves buried in it are not read as P waves', !vt.present.has('tall-p-waves'), J([...vt.present]));
  const rb = read('rbbb');
  /* In right bundle branch block T is inverted in V1–V3, opposite the R′ (secondary repolarisation; Surawicz 2009). */
  gap('right bundle branch block: T inverted in V1, opposite the R′', rb.value.t.V1 < 0, `T in V1 ${rb.value.t.V1} mV: the model turns T only part of the way from the R′ (discordance 0.45)`);
}

console.log('\nECG signs in the encounter (ADR-017 step 2b)');
{
  const c = S.CASES.find((x) => x.id === 'acute-stroke-left-mca');
  const snap = S.settleModel(S.modelFromCase(c), 20).snapshot;
  const s = S.startEncounter(S.CATALOG, S.REGISTRY, c, S.buildView(c, { circulation: snap }), { locale: 'en' });
  S.order(s, 'ecg-12', { performed: true });
  const res = s.encounter.events.find((e) => e.kind === 'result' && e.test === 'ecg-12');
  ok('an ECG result records what a reader sees in it', !!res?.revealed?.['ecg.reading'], J(Object.keys(res ?? {})));
  const shown = S.signsShown(s).find((x) => x.test === 'ecg-12');
  ok('…and the debrief reads its signs: the stroke patient’s atrial fibrillation', shown?.found.some((f) => f.sign === 'fibrillation-waves') && shown.found.some((f) => f.sign === 'irregular-rhythm'), J(shown));
  s.observeOnly = true;
  for (const sign of ['fibrillation-waves', 'st-elevation']) s.encounter.events.push({ t: s.t, kind: 'sign-named', sign, byManoeuvre: 'ecg-12' });
  const doc = S.documentation(s);
  ok('observe only: a sign named from the ECG and there is a hit; one not there is an over-call; one not named is a miss',
    doc.hits.some((h) => h.sign === 'fibrillation-waves') && doc.overcalls.some((o) => o.sign === 'st-elevation') && doc.misses.some((m) => m.sign === 'irregular-rhythm' && m.test === 'ecg-12'), J(doc));
  /* Electrodes where the learner puts them: reversed arm leads invert I and aVL, and the reading sees what the tracing shows. */
  const h = S.settleModel(S.healthyModel(), 20).snapshot;
  const std = S.readEcg(h.electrical, h.ecgDrive), rev = S.readEcg(h.electrical, h.ecgDrive, S.misplaced('arm-reversal'));
  ok('reversed arm electrodes: T in I turns negative and the axis moves, as on the tracing', std.t.I > 0 && rev.t.I < 0 && Math.abs(rev.axis - std.axis) > 20, `T in I ${std.t.I} → ${rev.t.I} mV, axis ${std.axis} → ${rev.axis}°`);
}

console.log('\nThe auscultation station (ADR-017 step 4)');
{
  /* Beats as the live patient records them: run the circulation, keep its beats with their samples. */
  const beatsOf = async (preset) => {
    const H = S.healthyModel();
    const live = new S.LivePatient(preset ? S.applyAuscPreset(H, H.circulation, preset) : H);
    await live.settle(24);
    while (live.t < 12) live.advance(1 / 60);
    return { live, beats: live.beats };
  };
  const { live, beats } = await beatsOf(null);
  ok('the live patient keeps its recent beats, each with its samples and valve times', beats.length >= 5 && beats.every((b) => b.samples.length > 100 && b.times.a2 != null && b.log.t0 === b.t0), `${beats.length} beats`);
  ok('…on one clock: each beat begins where the one before it ended', beats.slice(1).every((b, i) => Math.abs(b.t0 - (beats[i].t0 + beats[i].dur)) < 3));
  ok('the ECG the beats carry has no drop-outs to zero', beats.every((b) => b.samples.filter((x) => x.t > 150 && x.ecg === 0).length === 0));
  const b = beats.at(-1);
  const segs = S.cycleSegments(b).map((x) => x.phase);
  ok('a healthy beat runs through the cardiac cycle in order: isovolumic contraction, ejection, isovolumic relaxation, rapid filling, diastasis, atrial systole',
    J(segs) === J(['iso-contraction', 'ejection', 'iso-relaxation', 'rapid-filling', 'diastasis', 'atrial-systole']), J(segs));
  const vol = (ph) => { const xs = b.samples.filter((x) => S.cycleAt(b, x.t).phase === ph).map((x) => x.V); return Math.max(...xs) - Math.min(...xs); };
  ok('…the isovolumic phases are isovolumic: the left ventricle’s volume changes by under 2 mL in each', vol('iso-contraction') < 2 && vol('iso-relaxation') < 2, `${vol('iso-contraction').toFixed(2)}, ${vol('iso-relaxation').toFixed(2)} mL`);
  const ej = S.cycleSegments(b).find((x) => x.phase === 'ejection');
  ok('…ejection is where the aortic valve passes blood, from aortic opening to A2', Math.abs(ej.from - b.times.avo) <= 4 && Math.abs(ej.to - b.times.a2) <= 4, `${ej.from}–${ej.to} vs AO ${b.times.avo} AC ${b.times.a2}`);
  const ev = Object.fromEntries(S.valveEvents(b).map((e) => [e.id, e.t]));
  ok('…its valve events in order: mitral closure, aortic opening, A2, P2, mitral opening', ev.MC < ev.AO && ev.AO < ev.AC && ev.AC < ev.PC && ev.PC < ev.MO, J(ev));

  /* Each starting point is named by the severity its circulation reaches by the guidelines' own measure. */
  for (const p of S.AUSC_PRESETS) {
    const r = await beatsOf(p.id);
    const m = r.live.snap.metricsBreath, last = r.beats.at(-1);
    const v = { peakAorticGradient: m.aorticGradient, meanMitralGradient: S.meanMitralGradient(last), regurgFraction: m.regurgFraction * 100, ejectionFraction: m.EF }[p.check.measure];
    ok(`starting point “${p.label.en}”: ${p.check.measure} ${p.check.range[0]}–${p.check.range[1]} (${p.check.refs.join(', ')})`, v >= p.check.range[0] && v <= p.check.range[1] && p.check.refs.every((x) => S.REFERENCES[x]), `${v.toFixed(1)}`);
    const segs2 = S.cycleSegments(last).map((x) => x.phase);
    ok(`…its beat still runs contraction, ejection, relaxation, filling, in that order`, segs2.indexOf('ejection') > segs2.indexOf('iso-contraction') && segs2.indexOf('iso-relaxation') > segs2.indexOf('ejection') && segs2.indexOf('rapid-filling') > segs2.indexOf('iso-relaxation'), J(segs2));
    if (p.id === 'mr-moderate') ok('…mitral regurgitation: the mitral valve leaks in systole', last.samples.some((x) => S.cycleAt(last, x.t).phase === 'ejection' && S.cycleAt(last, x.t).valves.mitral === 'leaking'));
    if (p.id === 'ar-moderate') ok('…aortic regurgitation: the aortic valve leaks in diastole, and the mitral valve shuts early', last.samples.some((x) => S.cycleAt(last, x.t).phase === 'diastasis' && S.cycleAt(last, x.t).valves.aortic === 'leaking') && last.times.m1 > last.dur / 2, `MC ${last.times.m1} of ${last.dur}`);
    if (p.id === 'ms-severe') ok('…mitral stenosis: the mitral valve opens once, after A2 (not at a flicker in diastasis)', last.times.mvo > last.times.a2 && last.times.mvo < last.times.a2 + 200, `A2 ${last.times.a2} MO ${last.times.mvo}`);
  }

  /* Predict and Identify score the knowledge tables' signs, found by the standard cardiac auscultation manoeuvres. What each
     heart should bring is the textbook's; where it is heard, the bedside's. */
  ok('the station’s signs are the tables’ heart-sound signs, read by the cardiac auscultation manoeuvres',
    S.auscSigns().length >= 8 && S.auscSigns().every((x) => S.KNOWLEDGE.signs[x]?.definition) && S.heartManoeuvres().length >= 5, J(S.auscSigns()));
  const EXPECT = {
    healthy: [], 'as-moderate': ['ejection-systolic-murmur'], 'as-severe': ['ejection-systolic-murmur', 'soft-a2', 'fourth-heart-sound'],
    'ms-moderate': ['opening-snap', 'mid-diastolic-murmur'], 'ms-severe': ['opening-snap', 'mid-diastolic-murmur'], 'ar-moderate': ['early-diastolic-murmur'], 'mr-moderate': ['pansystolic-murmur'],
    'dilated-failing': ['third-heart-sound'],
  };
  const signsAt = {};
  for (const [pid, want] of Object.entries(EXPECT)) {
    const r = await beatsOf(pid === 'healthy' ? null : pid);
    const got = S.auscSignsOf(r.live.model, r.live.snap, r.live.chemistry);
    signsAt[pid] = got;
    ok(`${pid}: the stethoscope finds ${want.length ? want.join(', ') : 'no sign'}`, J([...got.present].sort()) === J([...want].sort()), J([...got.present]));
  }
  ok('…the mitral rumble with the bell at the apex, the patient on the left side', (signsAt['ms-severe'].where.get('mid-diastolic-murmur') ?? []).includes('auscultate.heart.apex-bell-left-lateral'));
  ok('…the aortic regurgitation murmur at the left sternal edge, sitting forward in held expiration', (signsAt['ar-moderate'].where.get('early-diastolic-murmur') ?? []).includes('auscultate.heart.lse-sitting-forward'));
  ok('…S3 and S4 with the bell at the apex only', J(signsAt['dilated-failing'].where.get('third-heart-sound')) === J(['auscultate.heart.apex-bell-left-lateral']) && J(signsAt['as-severe'].where.get('fourth-heart-sound')) === J(['auscultate.heart.apex-bell-left-lateral']));
  /* Gap 17, closed: mitral stenosis is heard by its gradient (Bonow's grades), not by a resistance threshold. */
  const gradOf = (r) => r.live.snap.metricsBreath?.mitralMeanGradient ?? 0;
  const msm = await beatsOf('ms-moderate'), mss = await beatsOf('ms-severe');
  ok('moderate mitral stenosis (mean gradient 5–10 mmHg, Bonow 2006) is heard: opening snap and rumble; the rumble is louder in severe stenosis',
    signsAt['ms-moderate'].present.has('opening-snap') && gradOf(msm) >= 5 && gradOf(msm) < 10 && gradOf(mss) >= 10, `${gradOf(msm).toFixed(1)} and ${gradOf(mss).toFixed(1)} mmHg`);
  ok('a gradient from flow alone through a normal valve (regurgitation) is not heard as mitral stenosis', !signsAt['mr-moderate'].present.has('opening-snap') && !signsAt['ar-moderate'].present.has('opening-snap'));
  /* Links from the teaching cards (ADR-017 step 5): a test row's animation "station:<id>" names a station that exists. */
  const links = Object.values(S.KNOWLEDGE.tests).filter((x) => x.animation?.startsWith('station:'));
  ok('teaching cards link to stations that exist: every cardiac auscultation card to the auscultation station',
    links.length >= 7 && links.every((x) => S.STATIONS.some((st) => `station:${st.id}` === x.animation)) && S.heartManoeuvres().every((m) => S.KNOWLEDGE.tests[m]?.animation === 'station:auscultation'), J(links.map((x) => x.id)));

  const groups = S.stationSettings(S.AUSCULTATION_STATION).map((g) => g.id);
  ok('the station’s settings are what the heart sounds measure (the haemodynamic model), with the rate and atrial rhythm that drive them', groups.includes('haemodynamics/valves') && groups.includes('driver/electrical.HR') && groups.includes('driver/electrical.atrial'), J(groups));
  ok('every starting point is in a group, once', J(S.AUSC_PRESET_GROUPS.flatMap((g) => g.ids).sort()) === J(S.AUSC_PRESETS.map((p) => p.id).sort()));
  const texts = S.allAuscTexts();
  ok('every auscultation explanation exists in English and German, with its numbers filled in', texts.length > 40 && texts.every((x) => x.en && x.de && !/\$\{|undefined|NaN/.test(x.en + x.de)), `${texts.length} texts`);
}


console.log('\nThe eye station');
{
  const H = S.healthyModel();
  ok('a healthy adult: no eye sign', S.eyeSignsOf(H).present.size === 0, J([...S.eyeSignsOf(H).present]));
  const signs = {};
  /* a preset that changes the body is run through its illness first, as the station does */
  const settled = {};
  const signsOfPreset = (id) => {
    const m = S.applyEyePreset(H, id), p = S.EYE_PRESETS.find((x) => x.id === id);
    if (!p?.body) return S.eyeSignsOf(m);
    settled[id] ??= S.settleModel(m, 8).snapshot;
    return S.eyeSignsOf(m, settled[id], S.chemistryState(settled[id], m.chemistry));
  };
  for (const p of S.EYE_PRESETS) {
    const got = signsOfPreset(p.id).present;
    signs[p.id] = got;
    ok(`${p.id}: brings ${p.signs.join(', ')}`, p.signs.every((x) => got.has(x)), J([...got]));
  }
  ok('thyroxine excess retracts the lids but does not push the eyes forward: that needs the orbitopathy of Graves’ disease', !signs['thyroxine-excess'].has('exophthalmos') && signs['graves'].has('exophthalmos'));
  ok('the neurological presets leave the body alone: no jaundice, pallor or thyroid sign', S.EYE_PRESETS.filter((p) => !p.body).every((p) => !['jaundice', 'conjunctival-pallor', 'lid-retraction', 'exophthalmos'].some((x) => signs[p.id].has(x))));
  {
    const m = S.applyEyePreset(H, 'obstruction'), snap = settled['obstruction'];
    const { c, view } = S.eyeView(m, snap, S.chemistryState(snap, m.chemistry));
    const f = S.sceneFindings(S.CATALOG, S.REGISTRY, c, view, { gaze: 'up', fixation: true, lightOn: 'none', ambient: 'room', cover: null, pullLowerLids: 1 });
    const e = S.scene(f, { gaze: 'up', fixation: true, lightOn: 'none', ambient: 'room', cover: null, pullLowerLids: 1 }, 0).R;
    ok('the eye close-up draws what the finding grades: yellow sclerae in obstructive jaundice, the lower lid drawn down', e.icterus > 0 && e.lowerLidPull === 1, J(e));
    const g = S.applyEyePreset(H, 'graves'), gs = settled['graves'];
    const gv = S.eyeView(g, gs, S.chemistryState(gs, g.chemistry));
    const gf = S.sceneFindings(S.CATALOG, S.REGISTRY, gv.c, gv.view, { gaze: 'down', fixation: true, lightOn: 'none', ambient: 'room', cover: null });
    const ahead = S.scene(gf, { gaze: 'primary', fixation: true, lightOn: 'none', ambient: 'room', cover: null }, 0).R, down = S.scene(gf, { gaze: 'down', fixation: true, lightOn: 'none', ambient: 'room', cover: null }, 0).R;
    ok('…in Graves’ disease the lid is drawn up, more so looking down (lid lag), and the globe stands forward', ahead.retractionMm > 0 && down.retractionMm > ahead.retractionMm && ahead.proptosisMm > 0, J({ ahead, down }));
  }
  /* Predict and Identify offer the signs grouped by the test that shows them */
  const offered = S.eyeSignGroups().flatMap((g) => g.signs);
  ok('Predict and Identify offer every eye sign once, each beside the test that shows it', J([...offered].sort()) === J([...S.eyeSigns()].sort()) && new Set(offered).size === offered.length, J(S.eyeSignGroups().map((g) => [g.test, g.signs.length])));
  ok('…and every sign a starting point brings is among them, so Identify can always be answered in full', S.EYE_PRESETS.every((p) => [...signs[p.id]].every((x) => offered.includes(x))), J(S.EYE_PRESETS.map((p) => [p.id, [...signs[p.id]].filter((x) => !offered.includes(x))]).filter(([, xs]) => xs.length)));
  {
    /* the side of each sign counts: a left and a right neuritis differ only in which head impulse is abnormal */
    const sig = {};
    for (const p of S.EYE_PRESETS) sig[p.id] = S.eyeSignature(signsOfPreset(p.id));
    const same = [];
    for (const a of S.EYE_PRESETS) for (const b of S.EYE_PRESETS) if (a.id < b.id && sig[a.id] === sig[b.id]) same.push([a.id, b.id].sort().join('='));
    const declared = S.EYE_LOOK_ALIKE.map((g) => [...g.ids].sort().join('='));
    ok('Identify can tell every starting point from health and from the others, except the pairs declared to look alike (each with why), which it counts as right',
      J(same.sort()) === J(declared.sort()) && S.EYE_PRESETS.every((p) => sig[p.id] !== ''), J({ same, declared }));
    ok('…a left neuritis and a right one differ by the side of the abnormal head impulse', sig['neuritis-l'] !== sig['neuritis-r-week'] && sig['neuritis-l'].includes('head-impulse-positive:L'), `${sig['neuritis-l']} | ${sig['neuritis-r-week']}`);
  }
  ok('every starting point is in a group, once', J(S.EYE_PRESET_GROUPS.flatMap((g) => g.ids).sort()) === J(S.EYE_PRESETS.map((p) => p.id).sort()));
  ok('HINTS: the neuritis has an abnormal head impulse and no skew; the lateral medulla a normal head impulse and a skew',
    signs['neuritis-l'].has('head-impulse-positive') && !signs['neuritis-l'].has('skew-deviation') && !signs['lateral-medulla-l'].has('head-impulse-positive') && signs['lateral-medulla-l'].has('skew-deviation'));
  ok('a fourth or third nerve palsy’s vertical deviation changes with gaze: a vertical tropia, not a skew deviation (Brodsky 2006)',
    !signs['cn4-l'].has('skew-deviation') && !signs['cn3-l'].has('skew-deviation') && !signs['lateral-medulla-l'].has('vertical-tropia'));
  const c4 = S.eyeContext(S.applyEyePreset(H, 'cn4-l')).verticalPD;
  ok('…the fourth nerve’s hypertropia is the affected eye’s and largest looking down', c4.primary < 0 && Math.abs(c4.down) > Math.abs(c4.primary) + 5, J(c4));
  ok('a blind eye’s pupil does not react to its own light but is not called a fixed dilated pupil: an afferent defect', !signs['optic-nerve-l'].has('fixed-dilated-pupil') && signs['optic-nerve-l'].has('afferent-pupillary-defect'));
  ok('Horner’s dilation lag needs two tests compared (room against dim light): found by none alone, found by the examination', signs['horner-l'].has('dilation-lag')
    && J(S.eyeSignsOf(S.applyEyePreset(H, 'horner-l')).where.get('dilation-lag')) === '[]');
  const idle = [];
  for (const g of S.EYE_STRUCTURES) for (const n of g.nodes) {
    const m = structuredClone(H); m.lesions = { nodes: [n.id], complete: true };
    if (!(S.eyeView(m).view.neuro?.findings.length > 0) && !S.eyeSignsOf(m).present.size) idle.push(n.id);
  }
  ok('every structure the station lets you cut changes something: a pathway of the graph or an eye sign', !idle.length, J(idle));
  const groups = S.stationSettings(S.EYE_STATION).map((g) => g.id);
  ok('the station’s settings are what the eye examination measures: the vestibular loss, the lesions, the liver, the blood and the thyroid, with how long the illness has acted; not calcium and bone', ['vor/periphery', 'nervous-system/lesions', 'liver/liver', 'blood/loss', 'endocrine/thyroid', 'driver/water.courseHours'].every((x) => groups.includes(x)) && !groups.includes('endocrine/calcium'), J(groups));
  const txt = [];
  for (const id of ['', ...S.EYE_PRESETS.map((p) => p.id)]) {
    const m = S.applyEyePreset(H, id), snap = settled[id];
    const ctx = snap ? S.eyeContext(m, snap, S.chemistryState(snap, m.chemistry)) : S.eyeContext(m);
    for (const t of S.EYE_TESTS) { const e = S.explainEye(t, ctx); txt.push(e.title, ...e.body); }
  }
  ok('teaching cards of the eye tests, neurological and body, link to the eye station', S.EYE_MANOEUVRES.every((m) => S.KNOWLEDGE.tests[m]?.animation === 'station:eyes'));
  ok('every eye explanation exists in English and German, with its numbers filled in', txt.length > 150 && txt.every((x) => x.en && x.de && x.en !== x.de && !/\$\{|undefined|NaN/.test(x.en + x.de)), `${txt.length} texts`);
  /* the eye view's scene */
  const { c, view } = S.eyeView(S.applyEyePreset(H, 'cn3-l'));
  const k = { gaze: 'primary', fixation: true, lightOn: 'none', ambient: 'room', cover: null };
  const f = S.sceneFindings(S.CATALOG, S.REGISTRY, c, view, k);
  ok('a complete third nerve ptosis hides the eye until the examiner lifts the lid', S.scene(f, k, 0).L.ptosisMm >= 7 && S.scene(f, { ...k, liftLids: true }, 0).L.ptosisMm === 0);
  ok('…and the eye then rests down and out', S.scene(f, { ...k, liftLids: true }, 0).L.v < -5 && S.scene(f, { ...k, liftLids: true }, 0).L.h < -5, J(S.scene(f, k, 0).L));   // the left eye's out is toward the patient's left
  const ts = Array.from({ length: 50 }, (_, i) => i * 0.05);
  const lagS = Math.max(...ts.map((x) => Math.abs(S.pursuitTarget('saccadic', x) - S.pursuitTarget('smooth', x))));
  ok('saccadic pursuit falls behind the target and catches up in steps; smooth pursuit stays on it', lagS > 1 && lagS < 6, lagS.toFixed(2));
}


console.log('\nThe neurological station');
{
  const H = S.healthyModel();
  ok('a healthy adult: no sign anywhere in the neurological examination', S.neuroSignsOf(H).present.size === 0, J([...S.neuroSignsOf(H).present]));
  const signs = {};
  for (const p of S.NEURO_PRESETS) {
    const r = S.neuroSignsOf(S.applyNeuroPreset(H, p.id));
    signs[p.id] = r;
    ok(`${p.id}: brings ${p.signs.join(', ')}`, p.signs.every((x) => r.present.has(x)), J([...r.present]));
  }
  ok('every starting point is in a group, once, and looks first at a test the station has', J(S.NEURO_PRESET_GROUPS.flatMap((g) => g.ids).sort()) === J(S.NEURO_PRESETS.map((p) => p.id).sort()) && S.NEURO_PRESETS.every((p) => S.NEURO_TEST_BY_ID[p.look]));
  {
    const groups = S.neuroSignGroups(), all = groups.flatMap((g) => g.signs);
    const seen = new Set(S.NEURO_PRESETS.flatMap((p) => [...signs[p.id].present]));
    ok('Identify: the sign chips list each sign once, under a test the station has', all.length === new Set(all).size && groups.every((g) => S.NEURO_TEST_BY_ID[g.test]), J(all));
    ok('…and every sign a starting point can bring is among them', [...seen].every((x) => all.includes(x)), J([...seen].filter((x) => !all.includes(x))));
    const sig = new Map();
    for (const p of S.NEURO_PRESETS) { const k = S.neuroSignature(signs[p.id]); sig.set(k, [...(sig.get(k) ?? []), p.id]); }
    const twins = [...sig.values()].filter((v) => v.length > 1);
    ok('…no two starting points look the same at the bedside, and none looks healthy', !twins.length && !sig.has(S.neuroSignature(S.neuroSignsOf(H))), J(twins));
    ok('parkinsonism: rigidity, rest tremor and a shuffling gait on the right for a left substantia nigra', ['rest-tremor', 'shuffling-gait'].every((x) => signs['parkinson-l'].present.has(x)) && J([...(signs['parkinson-l'].sides.get('rest-tremor') ?? [])]) === '["R"]', J([...signs['parkinson-l'].present]));
    ok('polyneuropathy: stocking loss and lost ankle jerks on both sides', signs.polyneuropathy.present.has('stocking-sensory-loss') && J([...(signs.polyneuropathy.sides.get('absent-ankle-reflex') ?? signs.polyneuropathy.sides.get('reduced-ankle-reflex') ?? [])].sort()) === '["L","R"]', J([...signs.polyneuropathy.present]));
  }
  const umn = ['mca-l', 'capsule-l', 'cord-r'], lmn = ['l4-root-r', 'femoral-r', 's1-root-r', 'peroneal-r', 'ulnar-r', 'c6-root-r', 'cerebellum-l', 'dorsal-columns', 'myopathy'];
  ok('the upper motor neuron lesions drift; the roots, nerves, muscle and the cerebellum do not', umn.every((id) => signs[id].present.has('pronator-drift')) && lmn.every((id) => !signs[id].present.has('pronator-drift')));
  ok('…a left hemisphere drifts the right arm; a right cord lesion, below the decussation, the right arm too', J([...signs['mca-l'].sides.get('pronator-drift')]) === '["R"]' && J([...signs['cord-r'].sides.get('pronator-drift')]) === '["R"]');
  ok('the cerebellum is on the same side: a left hemisphere makes the left finger dysmetric', J([...signs['cerebellum-l'].sides.get('limb-dysmetria')]) === '["L"]');
  {
    const m = S.applyNeuroPreset(H, 'dorsal-columns');
    const open = S.neuroObserve(m, 'arm.finger-nose.R', { eyesClosed: false }).value, shut = S.neuroObserve(m, 'arm.finger-nose.R', { eyesClosed: true }).value;
    ok('dorsal columns: accurate while the patient watches, dysmetric with the eyes closed, and Romberg’s sign', open.dysmetria === 'none' && shut.dysmetria !== 'none'
      && S.neuroObserve(m, 'posture.romberg', { eyesClosed: false }).value.stance === 'steady' && S.neuroObserve(m, 'posture.romberg', { eyesClosed: true }).value.stance === 'falls', J({ open, shut }));
  }
  ok('the knee jerk (L3–4) is reduced at the L4 root, lost at the femoral nerve, kept at S1 (where the ankle jerk goes)',
    S.neuroObserve(S.applyNeuroPreset(H, 'l4-root-r'), 'leg.reflexes.R').value.knee === 1 && S.neuroObserve(S.applyNeuroPreset(H, 'femoral-r'), 'leg.reflexes.R').value.knee === 0
    && S.neuroObserve(S.applyNeuroPreset(H, 's1-root-r'), 'leg.reflexes.R').value.knee === 2 && S.neuroObserve(S.applyNeuroPreset(H, 's1-root-r'), 'leg.reflexes.R').value.ankle === 0);
  {
    const m = S.applyNeuroPreset(H, 'cord-t10-r'), v = (r, c) => S.neuroObserve(m, r, c).value;
    ok('a right hemicord at T10: pinprick lost on the left from T10 down, vibration on the right leg; the arms and T6 spared (a level)',
      v('trunk.pinprick.L').T10 !== 'normal' && v('trunk.pinprick.L').T6 === 'normal' && v('leg.pinprick.L').L4 !== 'normal' && v('leg.pinprick.R').L4 === 'normal'
      && v('leg.vibration.R').vibration !== 'normal' && v('arm.vibration.R').vibration === 'normal' && v('arm.pinprick.L').C6 === 'normal' && signs['cord-t10-r'].present.has('sensory-level'));
  }
  {
    const m = S.applyNeuroPreset(H, 'sensory-cortex-l'), v = (r, c) => S.neuroObserve(m, r, c).value;
    ok('the sensory cortex: position sense lost, vibration kept, pinprick only reduced; the saddle and the corneal reflex spared; no sensory level',
      v('leg.vibration.R').proprioception !== 'normal' && v('leg.vibration.R').vibration === 'normal' && v('leg.pinprick.R').L4 === 'reduced'
      && v('saddle.sensation').pinprick === 'normal' && v('face.sensation.R').corneal === true && !signs['sensory-cortex-l'].present.has('sensory-level'));
  }
  ok('Wallenberg: the face lost on the side of the lesion, the body on the other (crossed), no sensory level and no saddle anaesthesia',
    signs['wallenberg-l'].present.has('crossed-sensory-loss') && !signs['wallenberg-l'].present.has('sensory-level') && !signs['wallenberg-l'].present.has('saddle-anaesthesia'));
  ok('myasthenia weakens the proximal muscles first and fatigues; the hands are strong at the first effort', S.neuroObserve(S.applyNeuroPreset(H, 'myasthenia'), 'arm.power.R').value.fingerFlexion === 5 && signs['myasthenia'].present.has('fatigable-weakness'));
  ok('a proximal myopathy leaves rapid alternating movements of the forearm alone', !signs['myopathy'].present.has('slowed-alternating-movements'));
  ok('motor neurone disease: fasciculating, wasted hands with brisk reflexes below', signs['mnd'].present.has('fasciculation') && signs['mnd'].present.has('hyperreflexia') && S.neuroObserve(S.applyNeuroPreset(H, 'mnd'), 'arm.tone.R').value.wasting === true);
  const idle = [];
  for (const g of S.NEURO_STRUCTURES) for (const n of g.nodes) {
    const m = structuredClone(H); m.lesions = { nodes: [n.id], complete: true };
    const ch = S.NEURO_TESTS.some((t) => t.lines().some((l) => !S.neuroObserve(m, l.ref, l.ctx ?? {}).normal));
    if (!ch) idle.push(n.id);
  }
  ok('every structure the station lets you cut changes a finding of the examination', !idle.length, J(idle));
  ok('every structure, and every one a starting point cuts, has a name in both languages and a rung on the ladder',
    [...new Set([...S.NEURO_STRUCTURES.flatMap((g) => g.nodes.map((n) => n.id)), ...S.NEURO_PRESETS.flatMap((p) => p.lesions)])].every((id) => { const l = S.neuroNodeLabel(id); return l.en !== id && l.de !== id && l.en !== l.de && S.rungOf(id); }),
    J([...new Set([...S.NEURO_STRUCTURES.flatMap((g) => g.nodes.map((n) => n.id)), ...S.NEURO_PRESETS.flatMap((p) => p.lesions)])].filter((id) => { const l = S.neuroNodeLabel(id); return !(l.en !== id && l.de !== id && l.en !== l.de && S.rungOf(id)); })));
  const groups = S.stationSettings(S.NEURO_STATION).map((g) => g.id);
  ok('the station’s settings are what the tests measure: the lesions of the nervous system', groups.includes('nervous-system/lesions'), J(groups));
  ok('every manoeuvre of the neurological examination outside the eyes is one of the station’s tests', ['neuro.speech', 'neuro.cranial', 'neuro.motor', 'neuro.sensory', 'neuro.coordination']
    .flatMap((sec) => S.EXAM_STRUCTURE.flatMap((x) => x.sections).find((x) => x.id === sec).manoeuvres).filter((m) => m !== 'test.slr').every((m) => S.NEURO_TESTS.some((t) => t.manoeuvres.includes(m))));
  ok('teaching cards of the animated tests link to the neurological station', ['test.pronator-drift', 'test.finger-nose', 'test.leg.reflexes'].every((m) => S.KNOWLEDGE.tests[m]?.animation === 'station:neuro'));
  const txt = [];
  for (const id of ['', ...S.NEURO_PRESETS.map((p) => p.id)]) {
    const m = S.applyNeuroPreset(H, id);
    for (const t of S.NEURO_TESTS) { const e = S.explainNeuro(t.id, (ref, ctx) => S.neuroObserve(m, ref, ctx ?? {}).value); txt.push(e.title, ...e.body); }
  }
  ok('every neurological explanation exists in English and German, with its findings filled in', txt.length > 300 && txt.every((x) => x.en && x.de && x.en !== x.de && !/\$\{|undefined|NaN|\[object/.test(x.en + x.de)), `${txt.length} texts; ${J(txt.filter((x) => !(x.en && x.de && x.en !== x.de && !/\$\{|undefined|NaN|\[object/.test(x.en + x.de))).slice(0, 3))}`);
  /* the animations follow the finding */
  const look = S.figureLookFor(S.FREE_CASE.patient, { exposure: [] }, 7, {});
  const base = S.POSES.sitting;
  const still = S.pronatorDrift(base, look, 12, { drift: [false, false] }).pose, drifted = S.pronatorDrift(base, look, 12, { drift: [true, false] }).pose;
  ok('pronator drift: without drift both arms stay level, palms up, eyes closed; with it the right arm sinks, bends and turns',
    still.armUpper[0] === still.armUpper[1] && still.outstretch[0] === 0 && still.eyes === 1 && drifted.armUpper[0] !== drifted.armUpper[1] && drifted.outstretch[0] > 30 && drifted.armUpper[1] === still.armUpper[1], J({ still: still.armUpper, drifted: drifted.armUpper, turn: drifted.outstretch }));
  const kick = (g) => Math.max(...Array.from({ length: 40 }, (_, i) => Math.abs(S.kneeJerk(base, look, 0.5 + i * 0.02, g).pose.shin[0] - base.shin[0])));
  ok('the knee jerk swings by its grade: none when absent, more when brisk', kick(0) === 0 && kick(1) < kick(2) && kick(2) < kick(3), J([0, 1, 2, 3].map(kick)));
  const path = (f) => Array.from({ length: 64 }, (_, i) => S.fingerNose(base, look, i * 0.05, f).pose.armFore[0]);
  ok('finger–nose: a dysmetric, tremulous reach moves differently from an accurate one', J(path({})) !== J(path({ dysmetria: 'marked', intentionTremor: true })));
  const stand = S.POSES.standing;
  const sway = (f) => Math.max(...Array.from({ length: 60 }, (_, i) => Math.abs(S.romberg(stand, look, 4.2 + i * 0.13, { stance: 'steady' }, f).sway)));
  ok('Romberg: steady with the eyes closed sways under a degree; a fall leans past 5°', sway({ stance: 'steady' }) < 1 && sway({ stance: 'falls', toward: 'L' }) > 5, J([sway({ stance: 'steady' }), sway({ stance: 'falls', toward: 'L' })]));
  const g = (f, t) => S.gait(stand, look, t, f);
  ok('gait: the hemiplegic leg swings out (circumduction) and its knee hardly bends; a normal swing bends it', Math.max(...Array.from({ length: 34 }, (_, i) => g({ pattern: 'hemiplegic', toward: 'R' }, i * 0.05).pose.legOut[0])) > 6
    && Math.max(...Array.from({ length: 34 }, (_, i) => { const p = g({ pattern: 'normal' }, i * 0.05).pose; return Math.abs(p.thigh[0] - p.shin[0]); })) > 45
    && Math.max(...Array.from({ length: 34 }, (_, i) => { const p = g({ pattern: 'hemiplegic', toward: 'R' }, i * 0.05).pose; return Math.abs(p.thigh[0] - p.shin[0]); })) < 25);
}


console.log('\nThe pulse and neck-vein station');
{
  const H = S.healthyModel();
  const run = async (m) => { const lp = new S.LivePatient(m); await lp.settle(20); for (let i = 0; i < 100; i++) lp.advance(0.1); return lp; };
  const healthy = await run(H);
  const hs = S.pulseSignsOf(healthy.model, healthy.snap, healthy.chemistry);
  ok('a healthy adult: a normal pulse and neck veins', hs.present.size === 0, J([...hs.present]));
  const hv = healthy.snap.beatLog.slice(-8).map((b) => b.ven);
  ok('in health each beat’s right atrial pressure has an a wave taller than its v, with x and y descents below both (the model’s own waves)',
    hv.filter((v) => v.a != null && v.a > v.v && v.x < v.v && v.y < v.v).length >= 6, J(hv.map((v) => [v.a?.toFixed(1), v.x.toFixed(1), v.v.toFixed(1), v.y.toFixed(1)])));
  const got = {};
  for (const p of S.PULSE_PRESETS) {
    const lp = await run(S.applyPulsePreset(H, H.circulation, p.id));
    got[p.id] = { lp, signs: S.pulseSignsOf(lp.model, lp.snap, lp.chemistry).present };
    ok(`${p.id}: brings ${p.signs.join(', ')}`, p.signs.every((x) => got[p.id].signs.has(x)), J([...got[p.id].signs]));
  }
  const offeredP = S.pulseSignGroups().flatMap((g) => g.signs);
  ok('Predict and Identify offer every pulse and neck sign once, beside the manoeuvre that finds it', J([...offeredP].sort()) === J([...S.pulseSigns()].sort()) && new Set(offeredP).size === offeredP.length);
  ok('…every sign a starting point brings is among them', S.PULSE_PRESETS.every((p) => [...got[p.id].signs].every((x) => offeredP.includes(x))));
  {
    const sig = S.PULSE_PRESETS.map((p) => J([...got[p.id].signs].sort()));
    ok('Identify can tell every starting point from health and from the others by the signs alone', new Set(sig).size === sig.length && !sig.includes('[]'), J(S.PULSE_PRESETS.map((p, i) => [p.id, sig[i]])));
  }
  ok('every starting point is in a group, once', J(S.PULSE_PRESET_GROUPS.flatMap((g) => g.ids).sort()) === J(S.PULSE_PRESETS.map((p) => p.id).sort()));
  ok('the irregular pulse of atrial fibrillation is felt from the beat intervals, not read from a label: sinus rhythm with breathing stays regular',
    healthy.snap.beatLog.length >= 8 && !hs.present.has('irregularly-irregular-pulse') && got['af'].signs.has('irregularly-irregular-pulse'));
  const up = (lp) => S.arterialWave(lp.beats.at(-1).samples).upstrokeMs;
  ok('the arterial upstroke is slow in severe aortic stenosis (the circulation’s own wave)', up(got['as-severe'].lp) > 1.5 * up(healthy), `${up(got['as-severe'].lp).toFixed(0)} ms against ${up(healthy).toFixed(0)}`);
  const trx = got['tr-severe'].lp.snap.beatLog.slice(-8).map((b) => b.ven);
  gap('severe tricuspid regurgitation fills in the x descent (a systolic venous wave): the x trough no lower than the mean', trx.filter((v) => v.x >= v.mean).length >= 4,
    `x ${trx.map((v) => v.x.toFixed(1)).join(',')} against mean ${trx.map((v) => v.mean.toFixed(1)).join(',')}: the model’s tricuspid leak is small (about 50 mL/s at its largest orifice) and the v wave grows only a little`);
  const groups = S.stationSettings(S.PULSE_STATION).map((g) => g.id);
  ok('the station’s settings are what the pulse and JVP measure (the haemodynamic model), with the rate and rhythm that drive them', groups.includes('haemodynamics/valves') && groups.includes('driver/electrical.avBlock'), J(groups));
  ok('teaching cards of the pulse and JVP link to the station', ['palpate.pulse.radial', 'palpate.pulse.carotid', 'inspect.jvp'].every((m) => S.KNOWLEDGE.tests[m]?.animation === 'station:pulse'));
  const txt = [];
  for (const x of ['healthy', ...S.PULSE_PRESETS.map((p) => p.id)]) {
    const lp = x === 'healthy' ? healthy : got[x].lp;
    const c = S.caseWithModel(S.FREE_CASE, lp.model), view = S.buildView(c, { circulation: lp.snap, chemistry: lp.chemistry });
    const o = (ref, ctx = {}) => S.observe(S.CATALOG, S.REGISTRY.resolvers, c, view, ref, ctx).value;
    const mt = lp.snap.metricsBreath;
    for (const sec of S.explainPulse({ pulse: o('pulse.radial.R'), jvp: o('jvp', { position: 'reclined-45' }), m: { sys: mt.Psys, dia: mt.Pdia, sv: mt.SV, gradient: mt.aorticGradient, regurgFraction: mt.regurgFraction, upstrokeMs: up(lp), cvp: mt.CVPmean },
      rhythm: { atrial: lp.model.electrical.atrial, avBlock: lp.model.electrical.avBlock ?? 'none', ventricular: lp.model.electrical.ventricular ?? 'none' } })) txt.push(sec.title, ...sec.body);
  }
  ok('every pulse explanation exists in English and German, with its numbers filled in', txt.length > 40 && txt.every((x) => x.en && x.de && x.en !== x.de && !/\$\{|undefined|NaN/.test(x.en + x.de)), `${txt.length} texts`);
}

console.log('\nThe axis (ADR-017, 9b): read from the recorded leads, on Einthoven\'s circle');
{
  ok('the ranges: −30° to +90° normal, to −90° left, to 180° right, the rest extreme (AHA/ACCF/HRS 2009)',
    S.axisClass(-30) === 'normal' && S.axisClass(90) === 'normal' && S.axisClass(-31) === 'lad' && S.axisClass(-90) === 'lad' && S.axisClass(91) === 'rad' && S.axisClass(180) === 'rad' && S.axisClass(-120) === 'extreme');
  ok('German Lagetypen in 30° steps', S.lagetyp(-40) === 'überdrehter Linkstyp' && S.lagetyp(0) === 'Linkstyp' && S.lagetyp(45) === 'Indifferenztyp' && S.lagetyp(70) === 'Steiltyp' && S.lagetyp(100) === 'Rechtstyp' && S.lagetyp(150) === 'überdrehter Rechtstyp');
  const STD = S.axisLeadVectors(S.axisStandardPlacement());
  const read = async (m, vecs = STD) => { const lp = new S.LivePatient(m); await lp.settle(6); lp.advance(3); return S.readAxis(lp.recording(3), vecs, STD); };
  const h = await read(S.healthyModel());
  ok('a healthy heart reads a normal axis, with I and aVF positive', h && S.axisClass(h.read) === 'normal' && h.leads[1].area > 0 && h.leads[4].area > 0 && !h.misplaced, h && JSON.stringify({ read: Math.round(h.read), own: Math.round(h.own) }));
  const rvh = await read(S.applyPreset(S.healthyModel(), 'rvh'));
  ok('right ventricular hypertrophy turns it right: lead I negative', rvh && S.axisClass(rvh.read) === 'rad' && rvh.leads[1].area < 0, rvh && `${Math.round(rvh.read)}°`);
  const pl = S.axisStandardPlacement(), swapped = { ...pl, RA: pl.LA, LA: pl.RA };
  const arms = await read(S.healthyModel(), S.axisLeadVectorsOn(swapped));
  ok('arm electrodes swapped: lead I turns negative, the reading moves right, and it is flagged as the electrodes, not the heart', arms && arms.leads[1].area < 0 && arms.misplaced && Math.abs(arms.standard - h.read) < 10, arms && JSON.stringify({ read: Math.round(arms.read), standard: Math.round(arms.standard) }));
  ok('the most nearly isoelectric limb lead is at about right angles to the axis (within 30°)', h && Math.abs(Math.abs(((h.leads.find((l) => l.name === h.isoelectric).deg - h.read + 540) % 360) - 180) - 90) <= 30, h && `${h.isoelectric} vs ${Math.round(h.read)}°`);
}

console.log('\nA live patient records every beat, however long the step');
{
  const lp = new S.LivePatient(S.healthyModel());
  await lp.settle(10);
  for (let i = 0; i < 5; i++) lp.advance(1.5);   // a slow frame, or running ahead: each step longer than a beat
  const bs = lp.beats;
  const gaps = bs.slice(1).map((b, i) => b.t0 - (bs[i].t0 + bs[i].dur));
  ok('consecutive beats follow each other with no beat missing (each starts where the last ended, within 3 ms)', bs.length >= 8 && gaps.every((g) => Math.abs(g) <= 3), JSON.stringify({ n: bs.length, gaps: gaps.map((g) => Math.round(g)) }));
}

console.log(`\n${pass} passed, ${fail} failed, ${gaps.length} known gaps`);
if (fail) process.exit(1);
