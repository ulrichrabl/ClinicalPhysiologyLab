/* Virtual patient data model: catalog, cases, validation, models, text, encounter. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `vp-model-${Date.now()}.mjs`);
await esbuild.build({
  entryPoints: ['scripts/_vp_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node',
  loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error',
});
const vp = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);
const { CATALOG, REGISTRY, CASES, buildView, observe, startEncounter, perform, order, ask, opening, parseAction, autoNote, describe,
  validateCatalog, validateCase, evaluate, interpret, commit, eyeAngles, measuredSlowPhaseVelocity, settleWithCirculation, exportCatalog } = vp;

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
const J = (x) => JSON.stringify(x);
const errors = (issues) => issues.filter((i) => i.level === 'error');
const caseById = (id) => CASES.find((c) => c.id === id);
const clone = (x) => JSON.parse(JSON.stringify(x));
const obs = (c, view, ref, ctx = {}) => observe(CATALOG, REGISTRY.resolvers, c, view, ref, ctx);
const text = (f, locale) => {
  const [prop, side] = /^(.*)\.(L|R)$/.exec(f.property)?.slice(1) ?? [f.property];
  return REGISTRY.formatters[CATALOG.properties[prop].formatter](f.value, f.context, locale, CATALOG, { property: prop, side });
};

/* ---- catalog and cases ----------------------------------------------------- */
console.log('\nCatalog and case validation');
{
  const issues = validateCatalog(CATALOG, REGISTRY);
  ok('catalog has no errors', errors(issues).length === 0, J(errors(issues).slice(0, 5)));
  ok('catalog is complete in English and German (no warnings)', issues.length === 0, J(issues.slice(0, 5)));
  ok('catalog has properties, manoeuvres, topics and diagnoses',
    Object.keys(CATALOG.properties).length >= 25 && Object.keys(CATALOG.manoeuvres).length >= 35
    && Object.keys(CATALOG.topics).length >= 40 && Object.keys(CATALOG.diagnoses).length >= 15);
  const exported = JSON.parse(exportCatalog());
  ok('catalog exports to JSON and back', exported.schema === 'vp.catalog/1' && exported.properties.length === Object.keys(CATALOG.properties).length);

  for (const c of CASES) {
    const ci = validateCase(c, CATALOG, REGISTRY);
    ok(`case ${c.id} validates`, errors(ci).length === 0, J(errors(ci).slice(0, 5)));
    ok(`case ${c.id} is complete in ${c.locales.join(' and ')}`, c.locales.includes('de') && c.locales.includes('en'));
    ok(`case ${c.id} survives a JSON round trip unchanged`, J(JSON.parse(J(c))) === J(c));
  }

  const bad = clone(caseById('vestibular-neuritis-left'));
  bad.observables['eyes.nystagmus'] = { value: { present: false } };
  bad.observables['vitals.rr'] = { value: 'fast' };
  bad.observables['general.appearance'] = { value: { distress: 'none', colour: 'purple', sweating: false } };
  bad.history[0].say = { en: 'Only English' };
  bad.pathology.lesions = [{ nodes: ['L_flux_capacitor'] }];
  bad.pathology.conditions[0].params.severity = 1.5;
  bad.reference.evidence[0].ref = 'eye.head-impulse';
  bad.diagnosis.differential.push('not-a-diagnosis');
  const bi = errors(validateCase(bad, CATALOG, REGISTRY)).map((i) => `${i.path}: ${i.message}`).join('\n');
  ok('validator: a case may not author a model-only property', /eyes\.nystagmus.*only a model/.test(bi));
  ok('validator: values must fit their type', /vitals\.rr.*expected a number/.test(bi));
  ok('validator: coded values must be in their value set', /colour.*purple/.test(bi));
  ok('validator: declared languages must be complete', /history\.f-pc\.say: missing de/.test(bi));
  ok('validator: lesion nodes must exist in the nervous-system graph', /L_flux_capacitor/.test(bi));
  ok('validator: condition parameters are range-checked', /severity: expected 0–1/.test(bi));
  ok('validator: paired evidence needs a side', /e-hit.*needs a side/.test(bi));
  ok('validator: diagnoses must exist', /not-a-diagnosis/.test(bi));
  const pub = clone(caseById('exertional-syncope-as')); pub.status = 'published';
  ok('validator: a published case needs a clinical reviewer', errors(validateCase(pub, CATALOG, REGISTRY)).some((i) => i.path === 'authoring.reviewers'));
}

/* ---- context rules --------------------------------------------------------- */
console.log('\nContext-dependent values');
{
  const v = {
    value: { present: true, fastPhase: 'right', amplitudeDeg: 2 },
    when: [
      { if: { gaze: 'right' }, mode: 'scale', factor: 1.7, fields: ['amplitudeDeg'] },
      { if: { gaze: 'left' }, mode: 'merge', value: { amplitudeDeg: 0.5 } },
      { if: { fixation: false }, mode: 'scale', factor: 3, fields: ['amplitudeDeg'] },
      { if: { gaze: ['up', 'down'], not: { fixation: false } }, mode: 'replace', value: { present: false } },
    ],
  };
  ok('no context: base value', evaluate(v, {}).amplitudeDeg === 2);
  ok('scale: right gaze amplifies', Math.abs(evaluate(v, { gaze: 'right' }).amplitudeDeg - 3.4) < 1e-9);
  ok('merge: left gaze patches one field', evaluate(v, { gaze: 'left' }).amplitudeDeg === 0.5 && evaluate(v, { gaze: 'left' }).fastPhase === 'right');
  ok('rules compose in order (right gaze without fixation)', Math.abs(evaluate(v, { gaze: 'right', fixation: false }).amplitudeDeg - 10.2) < 1e-9);
  ok('any-of and not predicates', evaluate(v, { gaze: 'up' }).present === false && evaluate(v, { gaze: 'up', fixation: false }).present === true);
}

/* ---- vestibular neuritis: peripheral HINTS --------------------------------------- */
console.log('\nLeft vestibular neuritis (peripheral pattern, from the vestibular model)');
const VN = caseById('vestibular-neuritis-left');
{
  const view = buildView(VN);
  const hitL = obs(VN, view, 'eye.head-impulse.L'), hitR = obs(VN, view, 'eye.head-impulse.R');
  ok('head impulse to the left: low gain, overt catch-up saccade', hitL.value.gain <= 0.5 && hitL.value.saccade === 'overt' && !hitL.normal, J(hitL.value));
  ok('head impulse to the right: normal', hitR.value.gain >= 0.9 && hitR.value.saccade === 'none' && hitR.normal);
  ok('head impulse finding comes from the model', hitL.provenance === 'model');
  const nys = (gaze, fixation = true) => obs(VN, view, 'eyes.nystagmus', { gaze, fixation }).value;
  const p = nys('primary'), r = nys('right'), l = nys('left'), pf = nys('primary', false);
  ok('primary gaze: right-beating horizontal-torsional nystagmus', p.present && p.fastPhase === 'right' && p.torsion === 'toward-right-ear', J(p));
  ok("Alexander's law: larger on looking right", r.present && r.amplitudeDeg > p.amplitudeDeg, `${r.amplitudeDeg} vs ${p.amplitudeDeg}`);
  ok('never reverses on looking left', !l.present || l.fastPhase === 'right', J(l));
  ok('fixation suppresses it: about three times larger behind Frenzel lenses', pf.amplitudeDeg > 2.5 * p.amplitudeDeg, `${pf.amplitudeDeg} vs ${p.amplitudeDeg}`);
  ok('constant-velocity slow phase', p.slowPhase === 'constant');
  const align = obs(VN, view, 'eyes.alignment').value;
  ok('no skew deviation', align.verticalPD === 0 && align.horizontal === 'ortho', J(align));
  ok('smooth pursuit', obs(VN, view, 'eyes.pursuit').value.quality === 'smooth');
  const weber = obs(VN, view, 'head.weber');
  ok('hearing preserved: Weber central, by default normal', weber.value === 'central' && weber.provenance === 'default-normal');
  ok('pupils equal and reactive', J(obs(VN, view, 'eye.pupil.L', { lightOn: 'L' }).value) === J(obs(VN, view, 'eye.pupil.R', { lightOn: 'R' }).value));
  const rombergClosed = obs(VN, view, 'posture.romberg', { eyesClosed: true }).value;
  const rombergOpen = obs(VN, view, 'posture.romberg', { eyesClosed: false }).value;
  ok('Romberg: worse with eyes closed, toward the left', rombergClosed.toward === 'L' && rombergClosed.stance === 'falls' && rombergOpen.stance !== 'falls', J([rombergOpen, rombergClosed]));
  ok('gait veers to the left', J(obs(VN, view, 'gait.pattern').value) === J({ pattern: 'veers', toward: 'L' }));
  ok('finger-nose normal (no cerebellar lesion)', obs(VN, view, 'arm.finger-nose.L').normal);
  const vitals = obs(VN, view, 'vitals.hr');
  ok('without a circulation model, the case layer supplies vitals', vitals.value === 88 && vitals.provenance === 'case');
  ok('unexamined-normal properties answer with age-appropriate normals', obs(VN, view, 'eye.fundus.L').value.disc === 'normal');

  // Compensation over days.
  const later = clone(VN); later.pathology.conditions[0].params.daysSinceOnset = 10;
  const pLater = obs(later, buildView(later), 'eyes.nystagmus', { gaze: 'primary', fixation: true }).value;
  ok('central compensation: nystagmus smaller on day 10, HIT still abnormal',
    (!pLater.present || pLater.amplitudeDeg < p.amplitudeDeg) && obs(later, buildView(later), 'eye.head-impulse.L').value.saccade === 'overt');
}

/* ---- central contrast ------------------------------------------------------------ */
console.log('\nSame complaint, central lesions');
const withLesion = (nodes, complete = true) => {
  const c = clone(VN); delete c.pathology.conditions; c.pathology.lesions = [{ nodes, complete }];
  return [c, buildView(c)];
};
{
  const [c, view] = withLesion(['L_cn5_sens', 'L_lat_bs', 'L_icp', 'L_cn9_nuc', 'L_cn10_nuc', 'L_stt_asc']);   // Wallenberg
  const nys = (gaze) => obs(c, view, 'eyes.nystagmus', { gaze, fixation: true }).value;
  ok('lateral medulla: head impulse normal both ways', obs(c, view, 'eye.head-impulse.L').normal && obs(c, view, 'eye.head-impulse.R').normal);
  ok('lateral medulla: direction-changing nystagmus', nys('right').fastPhase === 'right' && nys('left').fastPhase === 'left', J([nys('left'), nys('right')]));
  const skew = obs(c, view, 'eyes.alignment').value;
  ok('lateral medulla: skew deviation, ipsilesional eye lower', skew.verticalPD > 0 && skew.higherEye === 'R', J(skew));
  ok('lateral medulla: saccadic pursuit', obs(c, view, 'eyes.pursuit').value.quality === 'saccadic');
  const pl = obs(c, view, 'eye.pupil.L').value, pr = obs(c, view, 'eye.pupil.R').value;
  const pdl = obs(c, view, 'eye.pupil.L', { ambient: 'dim' }).value, pdr = obs(c, view, 'eye.pupil.R', { ambient: 'dim' }).value;
  ok("lateral medulla: Horner's miosis on the left, larger anisocoria in dim light", pl.sizeMm < pr.sizeMm && (pdr.sizeMm - pdl.sizeMm) > (pr.sizeMm - pl.sizeMm), J([pl, pr, pdl, pdr]));
  ok("lateral medulla: partial ptosis on the left", obs(c, view, 'eye.lid.L').value.ptosisMm === 2 && obs(c, view, 'eye.lid.R').normal);
  ok('lateral medulla: falls to the side of the lesion', obs(c, view, 'posture.romberg', { eyesClosed: false }).value.toward === 'L');
}
{
  const [c, view] = withLesion(['L_cerebellum']);
  const nys = (gaze) => obs(c, view, 'eyes.nystagmus', { gaze, fixation: true }).value;
  ok('cerebellar hemisphere: no nystagmus in primary gaze', !nys('primary').present);
  ok('cerebellar hemisphere: gaze-evoked nystagmus beating toward each gaze direction',
    nys('left').fastPhase === 'left' && nys('right').fastPhase === 'right' && nys('up').fastPhase === 'up');
  ok('cerebellar: gaze-evoked nystagmus has a decreasing-velocity slow phase', nys('left').slowPhase === 'decreasing');
  ok('cerebellar: head impulse normal', obs(c, view, 'eye.head-impulse.L').normal);
  const fn = obs(c, view, 'arm.finger-nose.L');
  ok('cerebellar: ipsilateral dysmetria with intention tremor (from the graph)', fn.value.dysmetria === 'marked' && fn.value.intentionTremor && fn.provenance === 'model', J(fn));
  ok('cerebellar: ataxic gait', obs(c, view, 'gait.pattern').value.pattern === 'ataxic');
}

/* ---- cranial nerves, pupils, hearing ---------------------------------------------- */
console.log('\nCranial nerves, pupils and hearing');
{
  const [c, view] = withLesion(['L_cn3']);
  const pL = obs(c, view, 'eye.pupil.L', { lightOn: 'L' }), pR = obs(c, view, 'eye.pupil.R', { lightOn: 'L' });
  ok('third nerve: left pupil dilated and fixed to direct light', pL.value.sizeMm >= 6 && pL.value.reaction === 'absent' && !pL.normal);
  ok('third nerve: consensual response of the right pupil preserved', pR.value.reaction === 'brisk' && pR.normal);
  const mot = obs(c, view, 'eye.motility.L').value;
  ok('third nerve: eye down and out, no adduction', mot.adduction === 0 && mot.restingDeg.horizontal > 0 && mot.restingDeg.vertical < 0);
  ok('third nerve: complete ptosis', obs(c, view, 'eye.lid.L').value.ptosisMm >= 7);
  ok('third nerve: divergent squint on cover test', obs(c, view, 'eyes.alignment').value.horizontal === 'exo');
}
{
  const [c, view] = withLesion(['L_cn6']);
  ok('sixth nerve: no abduction, convergent squint', obs(c, view, 'eye.motility.L').value.abduction === 0 && obs(c, view, 'eyes.alignment').value.horizontal === 'eso');
}
{
  const [c, view] = withLesion(['L_cn2']);
  ok('optic nerve: relative afferent pupillary defect on the left', obs(c, view, 'eyes.swinging-light').value.rapd === 'L');
  ok('optic nerve: light in the blind eye moves neither pupil', obs(c, view, 'eye.pupil.R', { lightOn: 'L' }).value.reaction === 'absent');
  ok('optic nerve: light in the seeing eye moves both pupils', obs(c, view, 'eye.pupil.L', { lightOn: 'R' }).value.reaction === 'brisk');
  ok('optic nerve: left eye blind in both hemifields', J(obs(c, view, 'eye.field.L').value) === J({ temporal: 'lost', nasal: 'lost' }));
}
{
  const [c, view] = withLesion(['chiasm']);
  ok('chiasm: bitemporal hemianopia', obs(c, view, 'eye.field.L').value.temporal === 'lost' && obs(c, view, 'eye.field.R').value.temporal === 'lost'
    && obs(c, view, 'eye.field.L').value.nasal === 'intact');
}
{
  const [c, view] = withLesion(['L_optic_tract']);
  ok('left optic tract: right homonymous hemianopia', obs(c, view, 'eye.field.R').value.temporal === 'lost' && obs(c, view, 'eye.field.L').value.nasal === 'lost');
}
{
  const [c, view] = withLesion(['L_cn8']);
  ok('vestibulocochlear nerve: Weber lateralises to the right', obs(c, view, 'head.weber').value === 'R');
  ok('vestibulocochlear nerve: whisper not heard on the left', obs(c, view, 'ear.whisper.L').value === 'not-heard');
  const rinne = obs(c, view, 'ear.rinne.L');
  ok('dead ear: false-negative Rinne, with the reason as basis', rinne.value === 'negative' && /false-negative/.test(rinne.basis ?? ''));
  ok('vestibulocochlear nerve: head impulse also abnormal', obs(c, view, 'eye.head-impulse.L').value.saccade === 'overt');
}

/* ---- aortic stenosis, from the closed-loop circulation ---------------------------- */
console.log('\nAortic stenosis (signs from the circulation model)');
const AS = caseById('exertional-syncope-as');
const BASE = { Rsys: 1.05, HR: 72, V0sv: 3200, baroEnabled: true };
const asSnap = settleWithCirculation({ ...BASE, ...AS.pathology.physiology }, 20);
const normalSnap = settleWithCirculation({ ...BASE }, 20);
{
  const view = buildView(AS, { circulation: asSnap });
  const nview = buildView(AS, { circulation: normalSnap });
  const g = asSnap.metrics.aorticGradient;
  ok('model produces a severe gradient', g > 60, `${g.toFixed(0)} mmHg`);
  const aortic = obs(AS, view, 'heart.sounds', { site: 'chest.aortic-area', instrument: 'stethoscope-diaphragm' });
  const m0 = aortic.value.murmurs[0];
  ok('aortic area: ejection systolic crescendo-decrescendo murmur, grade ≥ 3/6', m0 && m0.timing === 'ejection-systolic' && m0.shape === 'crescendo-decrescendo' && m0.grade >= 3, J(aortic.value));
  ok('A2 soft and S2 single', aortic.value.a2 === 'soft' && aortic.value.s2Split === 'single');
  ok('finding cites the model quantity it rests on', /aortic gradient \d+ mmHg/.test(aortic.basis ?? ''));
  const carotidMurmur = obs(AS, view, 'heart.sounds', { site: 'neck.carotid.R' }).value.murmurs[0];
  ok('radiates to the carotids, one grade softer', carotidMurmur && carotidMurmur.grade === m0.grade - 1);
  const apexMurmur = obs(AS, view, 'heart.sounds', { site: 'chest.mitral-area', instrument: 'stethoscope-diaphragm' }).value.murmurs[0];
  ok('Gallavardin: higher-pitched at the apex', apexMurmur && apexMurmur.pitch === 'high');
  ok('carotid upstroke slow-rising; radial character unremarkable',
    obs(AS, view, 'pulse.carotid.R').value.character === 'slow-rising' && obs(AS, view, 'pulse.radial.R').value.character === 'normal');
  ok('heaving apex (pressure-loaded ventricle)', obs(AS, view, 'apex').value.character === 'heaving');
  const bell = obs(AS, view, 'heart.sounds', { site: 'chest.mitral-area', instrument: 'stethoscope-bell' }).value.added;
  const diaphragm = obs(AS, view, 'heart.sounds', { site: 'chest.mitral-area', instrument: 'stethoscope-diaphragm' }).value.added;
  ok('S4 heard at the apex with the bell, not the diaphragm', bell.includes('s4') && !diaphragm.includes('s4'));
  const bp = obs(AS, view, 'vitals.bp.R');
  ok('blood pressure comes from the model', bp.provenance === 'model' && bp.value.systolic > 80 && bp.value.systolic < 160, J(bp.value));

  const normalHeart = ['chest.aortic-area', 'chest.pulmonary-area', 'chest.erb', 'chest.tricuspid-area', 'chest.mitral-area']
    .map((site) => obs(AS, nview, 'heart.sounds', { site, instrument: 'stethoscope-diaphragm' }));
  ok('a normal valve: no murmur at any site, normal heart sounds', normalHeart.every((f) => f.normal && f.value.murmurs.length === 0 && f.provenance === 'model'));
  ok('a normal valve: normal carotid upstroke', obs(AS, nview, 'pulse.carotid.R').value.character === 'normal');
}

/* ---- text in two languages --------------------------------------------------------- */
console.log('\nClinical text, English and German');
{
  const view = buildView(VN);
  const hit = obs(VN, view, 'eye.head-impulse.L');
  const p = obs(VN, view, 'eyes.nystagmus', { gaze: 'right', fixation: true });
  console.log(`      ${text(p, 'en')}\n      ${text(p, 'de')}\n      ${text(hit, 'de')}`);
  ok('English nystagmus text', /On looking right: horizontal-torsional jerk nystagmus, fast phase to the right, upper poles beating toward the right ear/.test(text(p, 'en')));
  ok('German nystagmus text', /Bei Blick nach rechts: horizontal-torsioneller Rucknystagmus nach rechts, oberer Pol schlägt zum rechten Ohr/.test(text(p, 'de')));
  ok('German uses a decimal comma', /ca\. \d+,\d°/.test(text(p, 'de')));
  ok('German head impulse text', /Kopfimpuls nach links: .*Refixationssakkade/.test(text(hit, 'de')));
  const asView = buildView(AS, { circulation: asSnap });
  const murmur = obs(AS, asView, 'heart.sounds', { site: 'chest.aortic-area', instrument: 'stethoscope-diaphragm' });
  console.log(`      ${text(murmur, 'en')}\n      ${text(murmur, 'de')}`);
  ok('German murmur text', /^Aortenareal: A2 leise, 2\. Herzton nicht gespalten.*Systolisches Austreibungsgeräusch, spindelförmig, Lautstärke \d\/6/.test(text(murmur, 'de')));
  const [c3, v3] = withLesion(['L_cn3']);
  ok('German pupil and lid text', /Linke Pupille 6,5 mm, direkte Lichtreaktion fehlend/.test(text(obs(c3, v3, 'eye.pupil.L', { lightOn: 'L' }), 'de'))
    && /Komplette Ptosis links/.test(text(obs(c3, v3, 'eye.lid.L'), 'de')));
}

/* ---- encounter -------------------------------------------------------------------- */
console.log('\nEncounter: preconditions, hazards, history, notes');
{
  const s = startEncounter(CATALOG, REGISTRY, VN, buildView(VN), { locale: 'de' });
  ok('the patient volunteers the presenting complaint', /Alles dreht sich/.test(opening(s)));
  const blocked = perform(s, 'test.romberg');
  ok('Romberg is blocked until the patient stands', blocked.outcome === 'blocked' && blocked.reason === 'position:standing' && blocked.findings.length === 0);
  perform(s, 'position.standing');
  const romberg = perform(s, 'test.romberg');
  ok('after standing up, Romberg reveals both conditions', romberg.outcome === 'performed' && romberg.findings.length === 2);
  const light = perform(s, 'test.pupils.light', 'L');
  ok('light in the left eye reveals both pupils (direct and consensual)',
    light.findings.map((f) => f.property).join() === 'eye.pupil.L,eye.pupil.R' && light.findings.every((f) => f.context.lightOn === 'L'));
  const gaze = perform(s, 'test.eye-movements');
  ok('the eye-movement examination reveals ductions, nystagmus in five gazes and pursuit', gaze.findings.length === 2 + 5 + 1);
  perform(s, 'test.head-impulse', 'L'); perform(s, 'test.head-impulse', 'R'); perform(s, 'test.cover');
  const jvpBlocked = perform(s, 'inspect.jvp');
  ok('JVP needs the patient at 45° (and the neck exposed)', jvpBlocked.outcome === 'blocked' && /^position/.test(jvpBlocked.reason));
  perform(s, 'expose.chest');
  ok('exposing without asking consent is recorded as a hazard, not blocked',
    s.encounter.events.some((e) => e.kind === 'hazard' && e.code === 'no-consent') && s.state.exposure.includes('chest'));

  const r1 = ask(s, 'Hören Sie auf einem Ohr schlechter?');
  ok('German question finds the hearing fact and answers in German', r1.facts[0]?.id === 'f-hearing' && /beiden Ohren/.test(r1.text), J(r1));
  const r2 = ask(s, 'Haben Sie Brustschmerzen?');
  ok('an irrelevant question gets an ordinary answer, not a hint', r2.facts.length === 0 && /keine Brustschmerzen/.test(r2.text));
  const r3 = ask(s, 'Did you have a cold recently?', 'en');
  ok('English question in the same encounter', r3.facts[0]?.id === 'f-infection' && /bad cold/.test(r3.text));
  const r4 = ask(s, 'Xylophon Quantenschaum?');
  ok('unintelligible question: the patient asks back', r4.topics.length === 0 && /Wie meinen Sie das/.test(r4.text));

  ok('typed action → manoeuvre and side (English)', J(parseAction(CATALOG, 'shine a light in the left eye', 'en')?.manoeuvre) === '"test.pupils.light"'
    && parseAction(CATALOG, 'shine a light in the left eye', 'en')?.side === 'L');
  const de = parseAction(CATALOG, 'Kopfimpulstest nach rechts', 'de');
  ok('typed action → manoeuvre and side (German)', de?.manoeuvre === 'test.head-impulse' && de?.side === 'R', J(de));

  order(s, 'glucose');
  s.t += 25 * 60000; perform(s, 'inspect.general');
  const gen = s.encounter.events.filter((e) => e.kind === 'finding' && e.finding.property === 'general.appearance').pop();
  ok('the course moves on: after 20 minutes she is more distressed', gen.finding.value.distress === 'severe');

  const note = autoNote(s, 'de');
  console.log(note.split('\n').map((l) => `      ${l}`).join('\n'));
  ok('automatic notes in German, by system', /## Augen und Okulomotorik/.test(note) && /## Gleichgewicht und Koordination/.test(note) && /## Anamnese/.test(note));
  ok('notes include the head impulse finding', /Kopfimpuls nach links: die Augen werden mit dem Kopf mitgenommen/.test(note));
  ok('notes include results once available', /Blutzucker 5,8 mmol\/l/.test(note));
  ok('the encounter log is plain JSON', J(JSON.parse(J(s.encounter))) === J(s.encounter));
  ok('describe() renders any logged finding', describe(s, gen.finding, 'en').startsWith('Severely distressed'));
}
{
  const c = clone(VN); c.initialState.immobilised = ['spine.cervical'];
  const s = startEncounter(CATALOG, REGISTRY, c, buildView(c));
  perform(s, 'test.head-impulse', 'L');
  ok('head impulse on an uncleared neck: recorded hazard', s.encounter.events.some((e) => e.kind === 'hazard' && e.code === 'hit-cervical-spine'));
}
{
  const s = startEncounter(CATALOG, REGISTRY, AS, buildView(AS, { circulation: asSnap }));
  ask(s, 'May I examine you?');
  perform(s, 'expose.chest');
  ok('consent asked first: no hazard', !s.encounter.events.some((e) => e.kind === 'hazard'));
  perform(s, 'auscultate.carotid', 'R');
  const f = s.encounter.events.filter((e) => e.kind === 'finding').pop().finding;
  ok('a paired auscultation site gets the side', f.context.site === 'neck.carotid.R' && f.value.murmurs.length > 0);
  order(s, 'echo');
  const echo = s.encounter.events.find((e) => e.kind === 'result' && e.test === 'echo');
  ok('echo result comes from the model, available after its turnaround', echo.value.aorticPeakGradient > 60 && echo.t === s.t + 30 * 60000, J(echo));
}


/* ---- routing and debrief ---------------------------------------------------------- */
console.log('\nTyped input routing and debrief');
{
  const I = (t, l = 'en') => interpret(CATALOG, t, l);
  ok('a question goes to the patient', I('Do you have any chest pain?').kind === 'ask');
  ok('a German question goes to the patient', I('Seit wann ist Ihnen schwindelig?', 'de').kind === 'ask');
  ok('an examination step is an action', J(I('listen at the aortic area')) === J({ kind: 'act', manoeuvre: 'auscultate.heart.aortic', side: undefined }));
  ok('a German examination step with a side', J(I('Radialispuls rechts tasten', 'de')) === J({ kind: 'act', manoeuvre: 'palpate.pulse.radial', side: 'R' }));
  ok('an order', I('order an echo').kind === 'order' && I('EKG schreiben', 'de').kind === 'order');
  ok('nonsense is not guessed', I('banana trampoline').kind === 'unknown');

  const s = startEncounter(CATALOG, REGISTRY, VN, buildView(VN));
  ask(s, 'Has your hearing changed?'); ask(s, 'Any headache?'); ask(s, 'Is it there all the time, how long does it last?');
  perform(s, 'test.head-impulse', 'L'); perform(s, 'test.eye-movements'); perform(s, 'test.cover');
  const d = commit(s, [{ diagnosis: 'vestibular-neuritis', confidence: 'likely' }, { diagnosis: 'cerebellar-stroke', confidence: 'possible' }]);
  const got = Object.fromEntries(d.evidence.map((e) => [e.item.id, e.elicited]));
  ok('debrief: diagnosis correct at rank 1', d.diagnosis.correct && d.diagnosis.rank === 1);
  ok('debrief: head impulse, nystagmus on gaze and skew counted as elicited', got['e-hit'] && got['e-nys-unidirectional'] && got['e-nys-left-gaze'] && got['e-skew']);
  ok('debrief: Frenzel, Weber and Romberg not done, so not elicited', !got['e-frenzel'] && !got['e-weber'] && !got['e-romberg']);
  ok('debrief: facts count when the patient said them', got['e-hearing'] && got['e-course'] && !got['e-infection']);
  ok('debrief: red flags asked about are covered', d.redFlags.find((r) => r.ref === 'f-headache').covered && !d.redFlags.find((r) => r.ref === 'f-diplopia').covered);
  ok('debrief: differential considered vs missed', d.diagnosis.differentialConsidered.includes('cerebellar-stroke') && d.diagnosis.differentialMissed.includes('bppv'));
  ok('the commit is logged', s.encounter.events.at(-1).kind === 'commit');
}

/* ---- kinematics for renderers ------------------------------------------------------ */
console.log('\nEye kinematics');
{
  const view = buildView(VN);
  for (const [gaze, fixation] of [['primary', false], ['right', true]]) {
    const n = obs(VN, view, 'eyes.nystagmus', { gaze, fixation }).value;
    const spv = measuredSlowPhaseVelocity(n, { h: gaze === 'right' ? 30 : 0, v: 0 });
    ok(`rendered slow phase matches the model (${gaze}${fixation ? '' : ', no fixation'})`, Math.abs(spv - n.spvDegPerS) / n.spvDegPerS < 0.05, `${spv.toFixed(2)} vs ${n.spvDegPerS}`);
  }
  const n = obs(VN, view, 'eyes.nystagmus', { gaze: 'primary', fixation: false }).value;
  const xs = Array.from({ length: 400 }, (_, i) => eyeAngles(n, { h: 0, v: 0 }, i / 400).h);
  ok('eye position oscillates within the amplitude', Math.max(...xs) - Math.min(...xs) <= n.amplitudeDeg + 1e-9 && Math.max(...xs) - Math.min(...xs) > 0.8 * n.amplitudeDeg);
  ok('torsion beats with the horizontal component', eyeAngles(n, { h: 0, v: 0 }, 0).torsion !== 0);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
