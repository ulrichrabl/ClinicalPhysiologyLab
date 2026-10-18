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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
