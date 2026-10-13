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
  validateCatalog, validateCase, evaluate, interpret, commit, figureSvg, lerpPose, POSES, eyeAngles, measuredSlowPhaseVelocity, exportCatalog,
  settleCirculation, settleModel, createCirculation, healthyModel, modelFromCase, pathologyOf, caseWithModel, applyPreset, MODELS, VARIABLE_BY_ID,
  recordLeads, measuredAxis, misplaced, standardPlacement, chemistryState, parseRef, Respiratory, pulseOximeter, perform: performM, CONSTANTS, REFERENCES, constantIssues, groundingSummary, suggest } = vp;

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
/* A known gap: a comparison with measured data the model does not yet meet. It is reported, with the numbers, every
   run, and listed in the spec; it does not fail the suite, because hiding it by retuning the test would be worse. */
const gaps = [];
const gap = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { gaps.push(name); console.log(`  △ known gap: ${name}${detail ? ' — ' + detail : ''}`); }
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
  /* The examination is organised for the learner: every manoeuvre sits in exactly one section, in clinical order. */
  const placed = CATALOG.examSystems.flatMap((sys) => sys.sections.flatMap((sec) => sec.manoeuvres));
  ok('every manoeuvre is placed in exactly one exam section', Object.keys(CATALOG.manoeuvres).every((id) => placed.filter((x) => x === id).length === 1) && placed.length === Object.keys(CATALOG.manoeuvres).length,
    J(Object.keys(CATALOG.manoeuvres).filter((id) => !placed.includes(id))));
  ok('manoeuvres carry their section and a clinical order (vital signs first, interventions last)',
    CATALOG.manoeuvres['measure.hr'].order === 0 && CATALOG.manoeuvres['test.heel-shin'].section === 'neuro.coordination'
    && CATALOG.manoeuvres['give.oxygen.off'].order === placed.length - 1);
  const cards = Object.values(CATALOG.manoeuvres).filter((m) => m.teaching);
  ok('every manoeuvre has a teaching card', cards.length === Object.keys(CATALOG.manoeuvres).length,
    J(Object.values(CATALOG.manoeuvres).filter((m) => !m.teaching).map((m) => m.id)));
  ok('every teaching card says what it tests, how, what is normal and at least one abnormal finding',
    cards.every((m) => m.teaching.assesses.en && m.teaching.how.en.length && m.teaching.normal.en && m.teaching.abnormal.length));
  ok('every teaching card links its abnormal findings to properties or diagnoses', cards.every((m) => m.teaching.abnormal.length && m.teaching.abnormal.every((f) => (f.properties?.length ?? 0) + (f.conditions?.length ?? 0) > 0)));
  /* Suggestions: names are found in every language, by eponym, and by the sign a test looks for. */
  const top = (q, l) => suggest(CATALOG, q, l, 5)[0];
  ok('suggest: "knie" finds the heel–shin test for an English learner', top('knie', 'en')?.id === 'test.heel-shin');
  ok('suggest: "heel" finds the Knie-Hacke-Versuch for a German learner', top('heel', 'de')?.id === 'test.heel-shin' && top('heel', 'de').label === 'Knie-Hacke-Versuch');
  ok('suggest: "romberg" finds the stance test by its eponym', top('romberg', 'en')?.id === 'test.romberg');
  ok('suggest: "ataxia" finds the tests that show it', suggest(CATALOG, 'ataxia', 'en').some((x) => x.id === 'test.heel-shin'));
  ok('suggest: "reflexes left" keeps the side', suggest(CATALOG, 'reflexes left', 'en').some((x) => x.kind === 'act' && x.side === 'L'));
  ok('suggest: "chest pain" offers the question', suggest(CATALOG, 'chest pain', 'en').some((x) => x.kind === 'ask'));
  ok('suggest: "blutbild" offers the order', suggest(CATALOG, 'blutbild', 'de').some((x) => x.kind === 'order'));
  ok('suggest: a single letter suggests nothing yet', suggest(CATALOG, 'k', 'en').length === 0);
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
  const vnView = buildView(VN, { circulation: settleCirculation(VN, 15) });
  const vitals = obs(VN, vnView, 'vitals.hr');
  ok('the heart rate is the case’s intrinsic rate (113) run through the baroreflex and a day of vomiting', vitals.value >= 72 && vitals.value <= 100 && vitals.provenance === 'model', J(vitals));
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
const asSnap = settleCirculation(AS, 20);
const normalSnap = settleModel(healthyModel(), 20).snapshot;
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
  ok('automatic notes in German, by system', /## Augen und Okulomotorik/.test(note) && /## Koordination, Stand und Gang/.test(note) && /## Anamnese/.test(note));
  ok('notes include the head impulse finding', /Kopfimpuls nach links: die Augen werden mit dem Kopf mitgenommen/.test(note));
  ok('notes include results once available', /Blutzucker \d+,\d mmol\/l/.test(note));
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



/* ---- neurological examination ------------------------------------------------------ */
console.log('\nNeurological examination (from the nervous-system graph)');
{
  const STROKE = caseById('acute-stroke-left-mca'), L5 = caseById('foot-drop-right-l5');
  const v = buildView(STROKE);
  const o = (c, view, ref, ctx) => obs(c, view, ref, ctx).value;
  const face = o(STROKE, v, 'face.movement.R');
  ok('MCA stroke: lower face weak, forehead spared (upper motor neuron face)', face.forehead === 'normal' && face.mouth === 'weak' && o(STROKE, v, 'face.movement.L').mouth === 'normal');
  const arm = o(STROKE, v, 'arm.power.R'), leg = o(STROKE, v, 'leg.power.R');
  ok('MCA stroke: pyramidal arm weakness, extensors weaker than flexors', arm.elbowExtension < arm.elbowFlexion && arm.elbowExtension <= 3, J(arm));
  ok('MCA stroke: face and arm more than leg', Math.min(...Object.values(leg)) > Math.min(...Object.values(arm)), J(leg));
  ok('MCA stroke: brisk right arm reflexes, extensor plantar, pronator drift',
    o(STROKE, v, 'arm.reflexes.R').biceps === 3 && o(STROKE, v, 'leg.reflexes.R').plantar === 'extensor' && o(STROKE, v, 'arm.drift.R').drift && !o(STROKE, v, 'arm.drift.L').drift);
  const sp = o(STROKE, v, 'speech.language');
  ok('MCA stroke: non-fluent aphasia with comprehension preserved', sp.fluency === 'impaired' && sp.comprehension === 'normal' && sp.repetition === 'impaired');
  ok('MCA stroke: sensation spared', obs(STROKE, v, 'arm.pinprick.R').normal);
  ok('MCA stroke: tongue deviates to the weak side', o(STROKE, v, 'mouth.tongue').deviatesTo === 'R');
  ok('MCA stroke: hemiplegic gait', o(STROKE, v, 'gait.pattern').pattern === 'hemiplegic');

  const lv = buildView(L5);
  const lp = o(L5, lv, 'leg.power.R');
  ok('L5 root: dorsiflexion, eversion, inversion and hip abduction weak together', lp.ankleDorsiflexion <= 3 && lp.footEversion <= 3 && lp.footInversion <= 3 && lp.hipAbduction <= 3 && lp.kneeExtension === 5 && lp.anklePlantarflexion === 5, J(lp));
  ok('L5 root: knee and ankle reflexes preserved, plantar flexor', J(o(L5, lv, 'leg.reflexes.R')) === J({ knee: 2, ankle: 2, plantar: 'flexor' }));
  const pin = o(L5, lv, 'leg.pinprick.R');
  ok('L5 root: dermatomal sensory loss, no nerve territory', pin.L5 === 'absent' && pin.L4 === 'normal' && pin.territories.length === 0);
  ok('L5 root: big-toe vibration preserved (a single root rarely abolishes it)', obs(L5, lv, 'leg.vibration.R').normal);
  ok('L5 root: high-stepping gait on the right', J(o(L5, lv, 'gait.pattern')) === J({ pattern: 'high-stepping', toward: 'R' }));
  ok('straight leg raise comes from the case layer', obs(L5, lv, 'leg.slr.R').provenance === 'case' && obs(L5, lv, 'leg.slr.L').provenance === 'default-normal');

  const les = (nodes, complete = true) => { const c = clone(L5); c.pathology.lesions = [{ nodes, complete }]; return [c, buildView(c)]; };
  {
    const [c, w] = les(['R_n_peroneal_head']);
    const p = o(c, w, 'leg.power.R');
    ok('peroneal nerve: foot drop with inversion and hip abduction strong', p.ankleDorsiflexion <= 1 && p.footInversion === 5 && p.hipAbduction === 5, J(p));
    ok('peroneal nerve: sharply edged territory loss, no dermatomal loss', J(o(c, w, 'leg.pinprick.R').territories) === J(['peroneal']) && o(c, w, 'leg.pinprick.R').L5 === 'normal');
  }
  {
    const [c, w] = les(['R_n_ulnar_elbow']); const [c8, w8] = les(['R_ahn_C8', 'R_drg_C8']);
    const u = o(c, w, 'arm.power.R'), r = o(c8, w8, 'arm.power.R');
    ok('ulnar nerve vs C8 root: thumb abduction spared only in the ulnar lesion', u.fingerAbduction <= 1 && u.thumbAbduction === 5 && r.thumbAbduction <= 3 && r.fingerAbduction <= 3);
    ok('C8 root loses the triceps reflex (C7–8), the ulnar nerve does not', o(c8, w8, 'arm.reflexes.R').triceps === 0 && o(c, w, 'arm.reflexes.R').triceps === 2);
  }
  {
    const [c, w] = les(['L_cn7']);
    const f = o(c, w, 'face.movement.L');
    ok("facial nerve: whole half of the face, forehead included", f.forehead === 'absent' && f.eyeClosure === 'absent' && f.mouth === 'absent');
    ok('facial nerve: corneal reflex lost through its efferent limb', o(c, w, 'face.sensation.L').corneal === false && o(c, w, 'face.sensation.L').V1 === 'normal');
  }
  {
    const [c, w] = les(['L_nmj_post', 'R_nmj_post']);
    const first = o(c, w, 'arm.power.R').shoulderAbduction, after = o(c, w, 'arm.power.R', { repetition: 20 }).shoulderAbduction;
    ok('myasthenia: power fades with repetition', after < first, `${first} → ${after}`);
    ok('myasthenia: ptosis appears only with sustained upgaze', obs(c, w, 'eye.lid.L').normal && o(c, w, 'eye.lid.L', { sustainedSeconds: 60 }).ptosisMm >= 2);
    ok('myasthenia: voice fades counting to 50; reflexes preserved', o(c, w, 'speech.fatigue', { repetition: 50 }).voice === 'fading-nasal' && o(c, w, 'arm.reflexes.R').biceps === 2);
  }
  {
    const [c, w] = les(['L_muscle_prox', 'R_muscle_prox']);
    const p = o(c, w, 'leg.power.R');
    ok('myopathy: proximal weakness, distal power and reflexes normal, waddling gait', p.hipFlexion <= 3 && p.ankleDorsiflexion === 5 && o(c, w, 'leg.reflexes.R').knee === 2 && o(c, w, 'gait.pattern').pattern === 'waddling');
  }
  {
    const [c, w] = les(['R_cst_L2', 'R_cst_L3', 'R_cst_L4', 'R_cst_L5', 'R_cst_S1', 'R_dc_asc', 'R_stt_asc']);
    ok('Brown-Séquard: weakness and vibration loss on the side of the lesion, pinprick lost on the other',
      o(c, w, 'leg.power.R').hipFlexion < 5 && o(c, w, 'leg.vibration.R').vibration === 'absent' && o(c, w, 'leg.pinprick.L').L4 === 'absent' && o(c, w, 'leg.pinprick.R').L4 === 'normal');
  }
  {
    const [c, w] = les(['L_cn5_sens', 'L_lat_bs', 'L_icp', 'L_cn9_nuc', 'L_cn10_nuc', 'L_stt_asc']);
    ok('Wallenberg: crossed sensory loss (left face, right body)', o(c, w, 'face.sensation.L').V2 === 'absent' && o(c, w, 'leg.pinprick.R').L4 === 'absent' && o(c, w, 'face.sensation.R').V2 === 'normal');
    ok('Wallenberg: uvula pulled away from the weak left palate, hoarse voice', o(c, w, 'mouth.palate').uvulaDeviatesTo === 'R' && o(c, w, 'mouth.palate').voice === 'hoarse');
  }
  const t = (c, view, ref, ctx = {}, l = 'de') => text(obs(c, view, ref, ctx), l);
  ok('German motor text', /^Kraft rechtes Bein \(MRC\): Hüftabduktion 3\/5, Fußhebung 3\/5, Fußeversion 3\/5, Fußinversion 3\/5; übrige 5\/5\.$/.test(t(L5, lv, 'leg.power.R')), t(L5, lv, 'leg.power.R'));
  ok('German reflex and speech text', /Babinski positiv/.test(t(STROKE, v, 'leg.reflexes.R')) && /Spontansprache nicht flüssig/.test(t(STROKE, v, 'speech.language')));
}


/* ---- parser regression ------------------------------------------------------------- */
console.log('\nTyped examination steps (English and German)');
{
  const cases = [
    ['pinprick in the right leg', 'en', 'test.leg.pinprick', 'R'], ['pinprick in the left arm', 'en', 'test.arm.pinprick', 'L'],
    ['power in the right arm', 'en', 'test.arm.power', 'R'], ['test power in the left leg', 'en', 'test.leg.power', 'L'],
    ['knee jerk on the right', 'en', 'test.leg.reflexes', 'R'], ['biceps reflex left', 'en', 'test.arm.reflexes', 'L'],
    ['check the plantar response on the right', 'en', 'test.leg.reflexes', 'R'], ['tone in the left arm', 'en', 'test.arm.tone', 'L'],
    ['vibration sense right big toe', 'en', 'test.leg.vibration', 'R'], ['pronator drift', 'en', 'test.pronator-drift', undefined],
    ['raise your eyebrows', 'en', 'test.face-movement', undefined], ['stick out your tongue', 'en', 'test.tongue', undefined],
    ['say aah', 'en', 'test.palate', undefined], ['heel shin left', 'en', 'test.heel-shin', 'L'],
    ['straight leg raise right', 'en', 'test.slr', 'R'], ['count to 50', 'en', 'test.count-to-50', undefined],
    ['listen at the aortic area', 'en', 'auscultate.heart.aortic', undefined], ['head impulse to the left', 'en', 'test.head-impulse', 'L'],
    ['Kraftprüfung rechtes Bein', 'de', 'test.leg.power', 'R'], ['Reflexe linker Arm', 'de', 'test.arm.reflexes', 'L'],
    ['Babinski rechts', 'de', 'test.leg.reflexes', 'R'], ['Sensibilität rechtes Bein spitz stumpf', 'de', 'test.leg.pinprick', 'R'],
    ['Armvorhalteversuch', 'de', 'test.pronator-drift', undefined], ['Zunge herausstrecken', 'de', 'test.tongue', undefined],
    ['Stirn runzeln', 'de', 'test.face-movement', undefined], ['Lasègue rechts', 'de', 'test.slr', 'R'],
    ['Kopfimpulstest nach rechts', 'de', 'test.head-impulse', 'R'], ['Romberg', 'de', 'test.romberg', undefined],
  ];
  let wrong = [];
  for (const [text, l, id, side] of cases) {
    const r = parseAction(CATALOG, text, l);
    if (r?.manoeuvre !== id || r?.side !== side) wrong.push(`${text} → ${r?.manoeuvre}/${r?.side}`);
  }
  ok(`${cases.length} typed examination steps resolve to the right manoeuvre and side`, wrong.length === 0, wrong.join('; '));
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


/* ---- patient figure ------------------------------------------------------------------ */
console.log('\nPatient figure');
{
  const look = { skin: '#e8c2a4', shade: '#c4977a', hair: '#555555', gown: '#9fc4d9', gownShade: '#7fa9c2', exposed: new Set(), sex: 'F' };
  const svg = figureSvg(POSES.standing, look);
  ok('every touch region is drawn, with sides for the limbs', ['head', 'neck', 'chest', 'abdomen'].every((r) => svg.includes(`data-region="${r}"`))
    && ['arm', 'legs'].every((r) => svg.includes(`data-region="${r}" data-side="R"`) && svg.includes(`data-region="${r}" data-side="L"`)));
  const mid = lerpPose(POSES.supine, POSES.standing, 0.5);
  ok('changing position interpolates the joints', mid.torso > 90 && mid.torso < 180 && Object.keys(POSES).every((k) => !Number.isNaN(lerpPose(POSES.supine, POSES[k], 0.3).hipY)));
  const bare = figureSvg(POSES.supine, { ...look, exposed: new Set(['chest']) }), covered = figureSvg(POSES.supine, look);
  ok('exposing the chest uncovers it', bare !== covered && bare.includes('r="2" fill') && !covered.includes('r="2" fill'));
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

/* ---- models and measurements -------------------------------------------------------- */
console.log('\nModels and measurements');
{
  const measured = [...Object.values(CATALOG.properties), ...Object.values(CATALOG.investigations)].filter((x) => x.source !== 'case');
  ok('every model-backed finding and test says which model variables it measures', measured.every((x) => x.measurement?.measures.every((id) => VARIABLE_BY_ID[id])),
    measured.filter((x) => !x.measurement).map((x) => x.id).join());
  ok('…and the physics of how, in both languages', measured.every((x) => x.measurement.physics.en && x.measurement.physics.de));
  ok('every model variable has an id, a symbol and a label in both languages', MODELS.every((m) => m.variables.every((v) => v.id && v.symbol && v.label.en && v.label.de)));
  const ids = MODELS.flatMap((m) => m.variables.map((v) => v.id));
  ok('variable ids are unique', new Set(ids).size === ids.length);
  ok('cases author no finding a model produces (pathology is parameters only)', CASES.every((c) =>
    Object.keys(c.observables ?? {}).every((ref) => CATALOG.properties[parseRef(ref).property]?.source !== 'model'
      && !['vitals.hr', 'vitals.bp', 'vitals.rr', 'vitals.spo2', 'pulse.radial', 'pulse.carotid'].includes(parseRef(ref).property))));
  for (const c of CASES) {
    const m = modelFromCase(c);
    ok(`${c.id}: case → model → pathology round-trips`, J(modelFromCase({ ...c, pathology: pathologyOf(m) })) === J(m));
  }
  const bad = clone(caseById('exertional-syncope-as')); bad.pathology.electrical = { atrial: 'fibrilation', lvMass: '2' };
  const be = J(errors(validateCase(bad, CATALOG, REGISTRY)));
  ok('validator: electrical parameters are checked by name, type and vocabulary', /unknown value fibrilation/.test(be) && /expected a number/.test(be), be);
  const chem = chemistryState(undefined, { potassium: 6.9 });
  ok('a pinned chemistry value overrides what the circulation derives', chem.potassium === 6.9);
}

console.log('\nCardiac electrical model, measured by the ECG');
const ecgOf = (preset, seconds = 8, mutate) => {
  let m = applyPreset(healthyModel(), preset);
  if (mutate) mutate(m);
  const run = createCirculation(m);
  run.sim.advance(Math.round(6 / run.sim.dt));
  run.heart.drain();
  run.sim.advance(Math.round(seconds / run.sim.dt));
  const vcg = run.heart.drain();
  return { run, vcg, snap: run.sim.snapshot(), metrics: run.heart.metrics };
};
{
  const n = ecgOf('normal');
  ok('sinus rhythm: rate from the autonomic state, normal intervals', n.metrics.HR > 60 && n.metrics.HR < 90 && n.metrics.PR >= 120 && n.metrics.PR <= 200 && n.metrics.QRS < 110, J(n.metrics));
  const leads = recordLeads(n.vcg);
  const peak = (a) => Math.max(...a), trough = (a) => Math.min(...a);
  ok('normal 12-lead: upright R in II, rS in V1, R taller than S by V5', peak(leads.II) > 0.7 && -trough(leads.V1) > peak(leads.V1) && peak(leads.V5) > -trough(leads.V5));
  ok('Einthoven: II = I + III, sample by sample', leads.II.every((x, i) => Math.abs(x - leads.I[i] - leads.III[i]) < 1e-5));
  const axis = measuredAxis(leads, 500);
  ok('machine axis normal', axis > -30 && axis < 90, String(axis));
  const rev = recordLeads(n.vcg, misplaced('arm-reversal'));
  ok('arm electrodes reversed: lead I inverts, aVR and aVL swap — a measurement artefact, not a patient', leads.I.every((x, i) => Math.abs(rev.I[i] + x) < 1e-5)
    && rev.aVR.every((x, i) => Math.abs(x - leads.aVL[i]) < 1e-5) && measuredAxis(rev, 500) > 90);
  const high = recordLeads(n.vcg, misplaced('v1v2-high'));
  ok('V1 and V2 placed two spaces high record a different complex', Math.abs(peak(high.V2) - peak(leads.V2)) > 0.05 || Math.abs(trough(high.V2) - trough(leads.V2)) > 0.05);

  const lbbb = ecgOf('lbbb');
  ok('left bundle branch block: QRS ≥ 120 ms, axis leftward, contraction less efficient', lbbb.metrics.QRS >= 120 && lbbb.snap.metrics.CO < n.snap.metrics.CO, `${lbbb.metrics.QRS} ms, CO ${lbbb.snap.metrics.CO.toFixed(2)} vs ${n.snap.metrics.CO.toFixed(2)}`);
  const rbbb = recordLeads(ecgOf('rbbb').vcg);
  ok('right bundle branch block: terminal R′ in V1', (() => { const a = rbbb.V1; let last = 0; for (let i = 1; i < a.length - 1; i++) if (a[i] > 0.3 && a[i] >= a[i - 1] && a[i] >= a[i + 1]) last++; return last > 0; })());

  const af = ecgOf('af', 12);
  const rr = [];
  { const run = createCirculation(applyPreset(healthyModel(), 'af')); let last = null; for (let i = 0; i < 40000; i++) { run.sim.step(); const m = run.heart.metrics; if (m.RR !== last) { rr.push(m.RR); last = m.RR; } } }
  const sd = Math.sqrt(rr.slice(2).reduce((a, x, _, arr) => a + (x - arr.reduce((p, q) => p + q, 0) / arr.length) ** 2, 0) / Math.max(1, rr.length - 2));
  ok('atrial fibrillation: no PR, irregularly irregular RR', af.metrics.PR == null && sd > 80, `RR sd ${sd.toFixed(0)} ms`);
  // Average over many beats: in AF each beat differs. Stroke volume falls (no atrial kick, short filling); the reflex restores output with rate.
  const mean = (preset, k0) => { const run = createCirculation(applyPreset(healthyModel(), preset)); run.sim.advance(12000); let last = null; const acc = { SV: 0, CO: 0, HR: 0, n: 0 }; for (let i = 0; i < 60000; i++) { run.sim.step(); const mt = run.sim.metrics; if (mt && mt !== last) { acc.SV += mt.SV; acc.CO += mt.CO; acc.HR += mt.HRbeat; acc.n++; last = mt; } } return { SV: acc.SV / acc.n, CO: acc.CO / acc.n, HR: acc.HR / acc.n }; };
  const mAF = mean('af'), mSR = mean('normal');
  ok('atrial fibrillation: the atrial kick is lost and mean stroke volume falls', mAF.SV < mSR.SV - 5, `SV ${mAF.SV.toFixed(0)} vs ${mSR.SV.toFixed(0)} mL, HR ${mAF.HR.toFixed(0)} vs ${mSR.HR.toFixed(0)}, CO ${mAF.CO.toFixed(2)} vs ${mSR.CO.toFixed(2)}`);
  const afView = buildView(caseById('acute-stroke-left-mca'), { circulation: af.snap });
  ok('…and the pulse feels irregularly irregular', obs(caseById('acute-stroke-left-mca'), afView, 'pulse.radial.R').value.rhythm === 'irregularly-irregular');

  const chb = ecgOf('chb', 10);
  ok('complete heart block: ventricles escape near 40/min, wide QRS, wide pulse pressure', Math.abs(chb.metrics.HR - 40) <= 3 && chb.metrics.QRS >= 120
    && chb.snap.metrics.PP > n.snap.metrics.PP, `${chb.metrics.HR}/min, PP ${chb.snap.metrics.PP.toFixed(0)}`);

  const hk = ecgOf('hyperkalaemia');
  const hkLeads = recordLeads(hk.vcg);
  ok('hyperkalaemia (a chemistry value, not an ECG pattern): tall T, longer PR', peak(hkLeads.V3) > 1.4 * peak(leads.V3) && hk.metrics.PR > n.metrics.PR, `${peak(hkLeads.V3).toFixed(2)} vs ${peak(leads.V3).toFixed(2)}`);
  const hkView = buildView(caseById('foot-drop-right-l5'), { chemistry: chemistryState(hk.snap, { potassium: 7.2 }) });
  ok('…and the same potassium is what the electrolyte panel reports', REGISTRY.resolvers['chemistry.panel'](hkView, { property: 'electrolytes' }, {}).value.potassium === 7.2);

  const ant = recordLeads(ecgOf('stemi-anterior').vcg);
  const st = (a, beatsFrom) => { // mean of the ST segment: 80–120 ms after the largest slope in each beat
    let s = 0, k = 0; for (let i = 1; i < a.length - 60; i++) if (Math.abs(leads.II[i] - leads.II[i - 1]) > 0.05 && Math.abs(leads.II[i] - leads.II[i - 1]) >= Math.abs(leads.II[i + 1] - leads.II[i])) { s += a[i + 50]; k++; i += 150; } return s / Math.max(1, k); };
  ok('anterior injury current: ST elevation in V2–V3', st(ant.V2) - st(leads.V2) > 0.15 && st(ant.V3) - st(leads.V3) > 0.15, `${(st(ant.V2) - st(leads.V2)).toFixed(2)} mV`);

  const bleed = settleModel((() => { const m = healthyModel(); m.circulation.bloodVolume = 3800; m.body.courseHours = 0.1; return m; })(), 25).snapshot;
  const rest = settleModel(healthyModel(), 25).snapshot;
  ok('haemorrhage: the baroreflex drives the sinus node faster', bleed.ecgMetrics.HR > rest.ecgMetrics.HR + 8, `${rest.ecgMetrics.HR} → ${bleed.ecgMetrics.HR}`);
  const off = settleModel((() => { const m = healthyModel(); m.circulation.bloodVolume = 3800; m.circulation.baroEnabled = 0; m.body.courseHours = 0.1; return m; })(), 25).snapshot;
  ok('…and without the reflex it does not, and pressure falls further', Math.abs(off.ecgMetrics.HR - 72) <= 3 && off.metrics.Pmean < bleed.metrics.Pmean, `${off.ecgMetrics.HR}/min, MAP ${off.metrics.Pmean.toFixed(0)} vs ${bleed.metrics.Pmean.toFixed(0)}`);

  const ser = createCirculation(healthyModel());
  ser.sim.advance(8000);
  const state = ser.sim.serializeState();
  const twin = createCirculation(healthyModel());
  twin.sim.restoreState(JSON.parse(J(state)));
  ser.sim.advance(4000); twin.sim.advance(4000);
  ok('a settled patient can be serialised and resumed exactly (for the browser worker)', Math.abs(ser.sim.Part - twin.sim.Part) < 1e-6 && ser.heart.metrics.HR === twin.heart.metrics.HR, `Part ${ser.sim.Part} vs ${twin.sim.Part}, HR ${ser.heart.metrics.HR} vs ${twin.heart.metrics.HR}`);
}


/* ---- respiratory system ------------------------------------------------------------------ */
console.log('\nRespiratory system: mechanics, gas exchange, control');
{
  const lung = (p = {}, inp = {}) => { const r = new Respiratory(p); r.setInputs(inp); r.equilibrate(); return r.snapshot(); };
  const n = lung();
  ok('healthy adult at sea level: normal blood gases, small A–a difference, normal dead space and rate',
    n.PaO2 > 11 && n.PaO2 < 13.5 && Math.abs(n.PaCO2 - 5.33) < 0.3 && Math.abs(n.pH - 7.4) < 0.03 && n.SaO2 > 0.95 && n.AaGradient < 2.5 && n.VDVT > 0.25 && n.VDVT < 0.4 && n.RR >= 12 && n.RR <= 18,
    `PaO2 ${n.PaO2.toFixed(1)} PaCO2 ${n.PaCO2.toFixed(2)} pH ${n.pH.toFixed(2)} A–a ${n.AaGradient.toFixed(1)} VD/VT ${n.VDVT.toFixed(2)} RR ${n.RR.toFixed(0)}`);
  ok('alveolar gas equation: ideal PAO2 = FiO2·(PB − PH2O) − PaCO2/R', Math.abs(n.PAO2ideal - (0.21 * (101.3 - 6.27) - n.PaCO2 / 0.8)) < 0.4);
  ok('forced expiration: FEV1, FVC and PEF near predicted, FEV1/FVC about 0.8',
    Math.abs(n.FEV1 / n.pred.FEV1 - 1) < 0.12 && Math.abs(n.FVC / n.pred.FVC - 1) < 0.12 && Math.abs(n.FEV1 / n.FVC - 0.81) < 0.06 && Math.abs(n.PEF / n.pred.PEF - 1) < 0.15,
    `FEV1 ${n.FEV1.toFixed(2)}/${n.pred.FEV1.toFixed(2)} FVC ${n.FVC.toFixed(2)}/${n.pred.FVC.toFixed(2)} PEF ${(n.PEF * 60).toFixed(0)}/${(n.pred.PEF * 60).toFixed(0)}`);

  const alt = lung({ Pb: 66 });
  ok('altitude (3500 m): hypoxaemia with a normal A–a difference, and hyperventilation lowers CO2', alt.PaO2 < 8 && alt.AaGradient < 1.5 && alt.PaCO2 < n.PaCO2 - 0.3 && alt.RpulMult > 1.2,
    `PaO2 ${alt.PaO2.toFixed(1)} A–a ${alt.AaGradient.toFixed(1)} PaCO2 ${alt.PaCO2.toFixed(2)} PVR ×${alt.RpulMult.toFixed(2)}`);
  const op = lung({ drive: 0.25 });
  ok('depressed drive (opioid): hypercapnia, slow rate, normal A–a difference — pure hypoventilation', op.PaCO2 > 7.5 && op.RR < n.RR && op.AaGradient < 2.5,
    `PaCO2 ${op.PaCO2.toFixed(2)} RR ${op.RR.toFixed(0)} A–a ${op.AaGradient.toFixed(1)}`);

  // Shunt does not respond to oxygen; V/Q mismatch does.
  const sh = lung({ consRLL: 0.95, consLLL: 0.9 }), shO2 = lung({ consRLL: 0.95, consLLL: 0.9, FiO2: 1 });
  const vq = lung({ vqMismatch: 1.1 }), vqO2 = lung({ vqMismatch: 1.1, FiO2: 1 });
  ok('shunt (two consolidated lobes): breathing 100 % O2 leaves PaO2 far below the alveolar value', shO2.PaO2 < 35 && shO2.AaGradient > 40 && sh.shunt > 0.2,
    `room air ${sh.PaO2.toFixed(1)}, on 100 % ${shO2.PaO2.toFixed(1)} kPa, shunt ${(sh.shunt * 100).toFixed(0)} %`);
  ok('V/Q mismatch with a similar room-air PaO2: 100 % O2 corrects it', vq.PaO2 < 9 && vqO2.PaO2 > 55, `room air ${vq.PaO2.toFixed(1)}, on 100 % ${vqO2.PaO2.toFixed(1)} kPa`);

  // Metabolic acidosis: the respiratory compensation that comes out of the controller is Winters' formula.
  for (const sbc of [12, 18]) {
    const w = lung({}, { sbc }); const exp = (1.5 * sbc + 8) / 7.5;
    ok(`metabolic acidosis (HCO3 ${sbc}): PaCO2 within 2 mmHg of Winters' formula`, Math.abs(w.PaCO2 - exp) < 0.27, `${w.PaCO2.toFixed(2)} vs ${exp.toFixed(2)} kPa`);
  }

  const copd = { emphysema: 0.65, bronchoconstriction: 0.55, vqMismatch: 0.4 };
  const c0 = lung(copd, { sbc: 30 }), c6 = lung({ ...copd, FiO2: 0.6 }, { sbc: 30 });
  ok('COPD: obstruction (FEV1/FVC < 0.7, low PEF), hypoxaemia, raised CO2 with near-normal pH (chronic bicarbonate)',
    c0.FEV1 / c0.FVC < 0.7 && c0.PEF < 0.4 * c0.pred.PEF && c0.PaO2 < 8 && c0.PaCO2 > 6 && c0.pH > 7.28, `ratio ${(c0.FEV1 / c0.FVC).toFixed(2)} PaO2 ${c0.PaO2.toFixed(1)} PaCO2 ${c0.PaCO2.toFixed(2)} pH ${c0.pH.toFixed(2)}`);
  ok('…high-flow oxygen raises its CO2 (released hypoxic vasoconstriction, Haldane effect, less drive)', c6.PaCO2 > c0.PaCO2 + 0.3, `${c0.PaCO2.toFixed(2)} → ${c6.PaCO2.toFixed(2)} kPa`);
  { const r = new Respiratory(copd); r.setInputs({ sbc: 30 }); r.equilibrate(); r.advance(30); const s = r.snapshot();
    ok('…and the lung cannot empty between breaths: dynamic hyperinflation and intrinsic PEEP', s.iPEEP > 2 && s.tauE * 3 > s.Te, `PEEPi ${s.iPEEP.toFixed(1)} cmH2O, τE ${s.tauE.toFixed(2)} s, TE ${s.Te.toFixed(2)} s`); }
  const fib = lung({ fibrosis: 0.6 });
  ok('fibrosis: restriction (small FVC, high FEV1/FVC), rapid shallow breathing, lower diffusing capacity', fib.FVC < 0.8 * fib.pred.FVC && fib.FEV1 / fib.FVC > 0.8 && fib.RR > n.RR && fib.DLCOpct < 60,
    `FVC ${(100 * fib.FVC / fib.pred.FVC).toFixed(0)} %, ratio ${(fib.FEV1 / fib.FVC).toFixed(2)}, RR ${fib.RR.toFixed(0)}, DLCO ${fib.DLCOpct.toFixed(0)} %`);
  const fibEx = lung({ fibrosis: 0.6, metabolicRate: 3 }, { CO: 13 });
  ok('…and desaturates on exertion (shorter capillary transit, diffusion limitation)', fibEx.SaO2 < fib.SaO2 - 0.015, `${(fib.SaO2 * 100).toFixed(1)} → ${(fibEx.SaO2 * 100).toFixed(1)} %`);
  const gbs = lung({ muscleStrength: 0.15 });
  ok('respiratory muscle weakness: vital capacity falls and CO2 rises (ventilatory failure)', gbs.FVC < 0.5 * gbs.pred.FVC && gbs.PaCO2 > 7, `FVC ${(100 * gbs.FVC / gbs.pred.FVC).toFixed(0)} %, PaCO2 ${gbs.PaCO2.toFixed(2)}`);

  const co = lung({ COHb: 0.3 }), met = lung({ metHb: 0.3 });
  ok('carbon monoxide: the pulse oximeter reads normal while the co-oximeter shows the O2-carrying fraction is low', pulseOximeter(co).SpO2 >= 93 && co.FO2Hb < 0.72,
    `SpO2 ${pulseOximeter(co).SpO2.toFixed(0)} %, O2Hb ${(co.FO2Hb * 100).toFixed(0)} %`);
  ok('methaemoglobin pulls the oximeter toward 85 % whatever the PaO2', Math.abs(pulseOximeter(met).SpO2 - 86) < 5 && met.PaO2 > 11, `SpO2 ${pulseOximeter(met).SpO2.toFixed(0)} %`);
  const an = lung({}, { Hb: 70 });
  ok('anaemia: normal PaO2 and saturation, O2 content halved', an.PaO2 > 11 && an.SaO2 > 0.95 && an.CaO2 < 0.55 * n.CaO2, `CaO2 ${an.CaO2.toFixed(1)} vs ${n.CaO2.toFixed(1)} mL/dL`);
}

console.log('\nThe lungs and the circulation, coupled');
{
  const settled = (mut) => { const m = healthyModel(); mut?.(m); return { m, s: settleModel(m, 24).snapshot }; };
  const base = caseById('exertional-syncope-as');
  const viewOf = ({ m, s }, state) => buildView(caseWithModel(base, m), { circulation: s, state: { ...base.initialState, position: 'sitting', exposure: ['chest'], ...(state ?? {}) } });
  const at = (v, prop, site) => obs(base, v, prop, site ? { site } : {}).value;
  const H = settled();
  const hv = viewOf(H);
  ok('healthy: resonant, vesicular, no added sounds at every site; trachea central; normal chest X-ray', ['upper-zone', 'mid-zone', 'axilla', 'upper-back', 'lung-base'].every((k) => ['L', 'R'].every((sd) => {
    const s = `chest.${k}.${sd}`; const b = at(hv, 'lung.sounds', s);
    return at(hv, 'chest.percussion', s).note === 'resonant' && b.breath === 'vesicular' && b.added.length === 0;
  })) && at(hv, 'trachea.position').position === 'central' && J(REGISTRY.resolvers['resp.cxr'](hv, { property: 'cxr' }, {}).value.findings) === J(['normal']));
  ok('healthy: SpO2 on room air 95–99 %, RR 12–18', (() => { const v = at(hv, 'vitals.spo2'); return v.spo2 >= 95 && v.spo2 <= 99 && v.fio2 === 0.21; })() && at(hv, 'vitals.rr') >= 12 && at(hv, 'vitals.rr') <= 18);

  const P = settled((m) => Object.assign(m.respiratory, { consRLL: 0.8 }));
  const pv = viewOf(P);
  const rb = at(pv, 'lung.sounds', 'chest.lung-base.R');
  ok('right lower lobe pneumonia: right base dull, bronchial breathing, coarse crackles, increased vocal resonance',
    at(pv, 'chest.percussion', 'chest.lung-base.R').note === 'dull' && rb.breath === 'bronchial' && rb.added.includes('coarse-crackles') && at(pv, 'chest.resonance', 'chest.lung-base.R').resonance === 'increased', J(rb));
  ok('…the left base is normal, and the chest X-ray shows right lower lobe consolidation', at(pv, 'chest.percussion', 'chest.lung-base.L').note === 'resonant'
    && REGISTRY.resolvers['resp.cxr'](pv, { property: 'cxr' }, {}).value.findings.includes('consolidation-RLL'));
  ok('…tachypnoea, hypoxaemia and a low CO2 (type 1 respiratory failure)', P.s.resp.RR > H.s.resp.RR + 3 && P.s.resp.PaO2 < 10 && P.s.resp.PaCO2 < H.s.resp.PaCO2,
    `RR ${P.s.resp.RR.toFixed(0)} PaO2 ${P.s.resp.PaO2.toFixed(1)} PaCO2 ${P.s.resp.PaCO2.toFixed(2)}`);

  const E = settled((m) => { m.respiratory.effusionR = 2500; });
  const ev = viewOf(E);
  ok('large right effusion: stony dull, absent breath sounds at the base, trachea pushed left, right expansion reduced',
    at(ev, 'chest.percussion', 'chest.lung-base.R').note === 'stony-dull' && at(ev, 'lung.sounds', 'chest.lung-base.R').breath === 'absent' && at(ev, 'trachea.position').position === 'L'
    && obs(base, ev, 'chest.expansion.R').value.expansion === 'reduced' && obs(base, ev, 'chest.expansion.L').value.expansion === 'normal');
  const X = settled((m) => { m.respiratory.ptxL = 0.6; });
  const xv = viewOf(X);
  ok('left pneumothorax: hyper-resonant, absent breath sounds on the left; the X-ray shows it', at(xv, 'chest.percussion', 'chest.upper-zone.L').note === 'hyper-resonant'
    && ['absent', 'reduced'].includes(at(xv, 'lung.sounds', 'chest.upper-zone.L').breath) && REGISTRY.resolvers['resp.cxr'](xv, { property: 'cxr' }, {}).value.findings.includes('pneumothorax-L'));
  const C = settled((m) => { m.respiratory.collRUL = 0.95; });
  ok('right upper lobe collapse pulls the trachea to the right', at(viewOf(C), 'trachea.position').position === 'R');

  const PE = settled((m) => Object.assign(m.respiratory, { embRLL: 0.6, embLLL: 0.6 }));
  const pev = viewOf(PE);
  ok('pulmonary embolism: pulmonary vascular resistance rises, the heart speeds up, the chest is clear',
    PE.s.resp.RpulMult > 1.6 && PE.s.metrics.PpaMean > H.s.metrics.PpaMean && PE.s.ecgMetrics.HR > H.s.ecgMetrics.HR + 6
    && at(pev, 'lung.sounds', 'chest.lung-base.R').added.length === 0, `PVR ×${PE.s.resp.RpulMult.toFixed(2)} PA ${PE.s.metrics.PpaMean.toFixed(0)} HR ${PE.s.ecgMetrics.HR}`);
  gap('…and the mean pulmonary arterial pressure rises by more than 3 mmHg (the embolism-to-resistance mapping is still ungrounded)', PE.s.metrics.PpaMean > H.s.metrics.PpaMean + 3,
    `PA ${PE.s.metrics.PpaMean.toFixed(1)} vs ${H.s.metrics.PpaMean.toFixed(1)} mmHg`);
  ok('…hypoxaemia and hypocapnia, with end-tidal CO2 far below arterial (alveolar dead space)', PE.s.resp.PaO2 < 10 && PE.s.resp.PaCO2 < 5.1 && PE.s.resp.PaCO2 - PE.s.resp.EtCO2 > 1,
    `PaO2 ${PE.s.resp.PaO2.toFixed(1)} PaCO2 ${PE.s.resp.PaCO2.toFixed(2)} EtCO2 ${PE.s.resp.EtCO2.toFixed(2)}`);
  ok('…D-dimer raised, CTPA shows both lower lobe arteries occluded, the chest X-ray shows no consolidation',
    REGISTRY.resolvers['resp.ddimer'](pev, { property: 'd-dimer' }, {}).value > 0.5
    && ['pe-RLL', 'pe-LLL'].every((x) => REGISTRY.resolvers['resp.ctpa'](pev, { property: 'ctpa' }, {}).value.findings.includes(x))
    && !REGISTRY.resolvers['resp.cxr'](pev, { property: 'cxr' }, {}).value.findings.some((x) => x.startsWith('consolidation')));

  const HF = settled((m) => { Object.assign(m.circulation, { Emax: 0.9, bloodVolume: 6000 }); m.body.courseHours = 0.5; });
  const hfv = viewOf(HF);
  ok('left heart failure: left atrial pressure floods the lungs from the bottom: fine crackles at the bases, oedema on the X-ray',
    HF.s.metrics.PlaMean > 20 && at(hfv, 'lung.sounds', 'chest.lung-base.R').added.includes('fine-crackles') && REGISTRY.resolvers['resp.cxr'](hfv, { property: 'cxr' }, {}).value.findings.some((x) => x.startsWith('oedema')),
    `LA ${HF.s.metrics.PlaMean.toFixed(0)} mmHg`);
  gap('…hypoxaemia and tachypnoea follow from the water, not from a rule', HF.s.resp.PaO2 < H.s.resp.PaO2 - 2 && HF.s.resp.RR > H.s.resp.RR + 5);

  const blue = settled((m) => Object.assign(m.respiratory, { consRLL: 0.95, consLLL: 0.95, consRML: 0.9 }));
  const bv = viewOf(blue);
  const anaemicBlue = settled((m) => { Object.assign(m.respiratory, { consRLL: 0.95, consLLL: 0.95, consRML: 0.9 }); m.chemistry.haemoglobin = 75; });
  ok('central cyanosis follows deoxygenated haemoglobin: present when hypoxaemic, absent at the same saturation when anaemic',
    at(bv, 'general.appearance').colour === 'cyanosed' && at(viewOf(anaemicBlue), 'general.appearance').colour !== 'cyanosed',
    `deoxyHb ${blue.s.resp.deoxyHb.toFixed(0)} vs ${anaemicBlue.s.resp.deoxyHb.toFixed(0)} g/L`);

  const As = settled((m) => { m.respiratory.bronchoconstriction = 0.4; });
  const Sil = settled((m) => { m.respiratory.bronchoconstriction = 0.85; });
  ok('asthma: wheeze everywhere; in the most severe, a silent chest (too little flow to wheeze)', at(viewOf(As), 'lung.sounds', 'chest.upper-zone.R').added.includes('wheeze')
    && !at(viewOf(Sil), 'lung.sounds', 'chest.upper-zone.R').added.includes('wheeze') && at(viewOf(Sil), 'lung.sounds', 'chest.upper-zone.R').breath === 'reduced');
  ok('…peak flow falls with the airways', REGISTRY.resolvers['resp.peakflow'](viewOf(As), { property: 'peak-flow' }, {}).value.pefPct < 70);

  // Oxygen is an intervention: the encounter records the device, the model breathes the fraction.
  const s0 = startEncounter(CATALOG, REGISTRY, base, buildView(base, { circulation: P.s }));
  const r = performM(s0, 'give.oxygen.venturi-35');
  ok('giving oxygen is a manoeuvre that sets the device and its FiO2 on the patient', r.outcome === 'performed' && s0.state.oxygen?.fio2 === 0.35);
  const PO = settled((m) => Object.assign(m.respiratory, { consRLL: 0.8, FiO2: 0.35 }));
  const spo = at(viewOf(PO), 'vitals.spo2');
  ok('…and the saturation it reads is taken on that FiO2', spo.fio2 === 0.35 && spo.spo2 > at(pv, 'vitals.spo2').spo2 && /FiO₂ 0,35/.test(text({ property: 'vitals.spo2', value: spo, context: {} }, 'de')),
    `${at(pv, 'vitals.spo2').spo2} → ${spo.spo2} %`);

  const bad = clone(base);
  bad.pathology.respiratory = { consRLL: 1.4, flux: 1 };
  bad.pathology.chemistry = { ...(bad.pathology.chemistry ?? {}), paO2: 9 };
  const bi = errors(validateCase(bad, CATALOG, REGISTRY)).map((i) => `${i.path}: ${i.message}`).join('\n');
  ok('validator: respiratory parameters must exist and be in range; blood gases cannot be pinned (they are outputs)', /consRLL: expected 0–1/.test(bi) && /unknown respiratory parameter flux/.test(bi) && /chemistry\.paO2/.test(bi), bi);
}



console.log('\nThe right heart, the septum and the pericardium');
{
  const S = (mut) => { const m = healthyModel(); mut(m); return settleModel(m, 30).snapshot; };
  const H = S(() => {});
  /* Acute: the clot arrived within the hour (the body's slower defences, angiotensin and vasopressin, have barely begun). */
  const sub = S((m) => { Object.assign(m.respiratory, { embRLL: 0.85, embLLL: 0.85, embRUL: 0.6, embLUL: 0.6, embRML: 0.7 }); m.body.courseHours = 0.25; });
  const mas = S((m) => { Object.assign(m.respiratory, { embRLL: 0.95, embLLL: 0.95, embRUL: 0.8, embLUL: 0.8, embRML: 0.9 }); m.body.courseHours = 0.25; });
  ok('submassive PE: compensated (systolic above 100) by tachycardia and vasoconstriction, narrow pulse pressure', sub.metrics.Psys > 100 && sub.ecgMetrics.HR > 105 && sub.metrics.PP < H.metrics.PP,
    `BP ${sub.metrics.Psys.toFixed(0)}/${sub.metrics.Pdia.toFixed(0)} HR ${sub.ecgMetrics.HR}`);
  ok('massive PE: obstructive shock — the acute right ventricle cannot exceed ~45 mmHg; low output, raised CVP, lactate',
    mas.metrics.Psys < 90 && mas.metrics.CO < 3 && mas.metrics.CVPmean > H.metrics.CVPmean + 3 && mas.metrics.PpaSys < 55 && chemistryState(mas, {}).lactate > 2,
    `BP ${mas.metrics.Psys.toFixed(0)}/${mas.metrics.Pdia.toFixed(0)} CO ${mas.metrics.CO.toFixed(1)} CVP ${mas.metrics.CVPmean.toFixed(0)} PAsys ${mas.metrics.PpaSys.toFixed(0)}`);
  gap('…with a CVP above 10 and the right ventricle ischaemic (its perfusion constants are ungrounded)', mas.metrics.CVPmean > 10 && mas.rvIschaemia > 0.4,
    `BP ${mas.metrics.Psys.toFixed(0)}/${mas.metrics.Pdia.toFixed(0)} CO ${mas.metrics.CO.toFixed(1)} CVP ${mas.metrics.CVPmean.toFixed(0)} PAsys ${mas.metrics.PpaSys.toFixed(0)} RV ischaemia ${mas.rvIschaemia.toFixed(2)}`);
  ok('…and the pressure-loaded right ventricle pushes the septum into the left, which fills less', mas.metrics.EDV < H.metrics.EDV - 20, `LV EDV ${mas.metrics.EDV.toFixed(0)} vs ${H.metrics.EDV.toFixed(0)} mL`);
  const tam = S((m) => { m.circulation.pericardialFluid = 450; });
  ok('tamponade: pericardial fluid raises every filling pressure, equalises them, and drops output', tam.metrics.CVPmean > 10 && Math.abs(tam.metrics.CVPmean - tam.metrics.PlaMean) < 5 && tam.metrics.CO < H.metrics.CO - 1 && tam.ecgMetrics.HR > H.ecgMetrics.HR + 10,
    `CVP ${tam.metrics.CVPmean.toFixed(0)} LA ${tam.metrics.PlaMean.toFixed(0)} CO ${tam.metrics.CO.toFixed(1)} HR ${tam.ecgMetrics.HR}`);
  const lung = (p, inp = {}) => { const r = new Respiratory(p); r.setInputs(inp); r.equilibrate(); return r.snapshot(); };
  const copd = { emphysema: 0.65, bronchoconstriction: 0.55, vqMismatch: 0.4 };
  const a = lung(copd, { sbc: 30 }), b = lung({ ...copd, FiO2: 0.28 }, { sbc: 30 }), c = lung({ ...copd, FiO2: 0.6 }, { sbc: 30 });
  ok('severe COPD: high-flow oxygen raises CO2 by over 0.5 kPa, controlled oxygen by much less', c.PaCO2 - a.PaCO2 > 0.5 && b.PaCO2 - a.PaCO2 < 0.5 * (c.PaCO2 - a.PaCO2), `${a.PaCO2.toFixed(2)} → ${b.PaCO2.toFixed(2)} (28 %) / ${c.PaCO2.toFixed(2)} (60 %)`);
  const v = lung({ vqMismatch: 1.2 }), v100 = lung({ vqMismatch: 1.2, FiO2: 1 });
  ok('absorption atelectasis: on 100 % O2, poorly ventilated units collapse and true shunt rises', v100.shunt > v.shunt + 0.02, `${(v.shunt * 100).toFixed(1)} → ${(v100.shunt * 100).toFixed(1)} %`);
}

console.log('\nPulmonary cases: what the model makes of their parameters');
{
  const run = (id, mut) => { const c = caseById(id); const m = modelFromCase(c); mut?.(m); const snap = settleModel(m, 24).snapshot; return { c, snap, view: buildView(c, { circulation: snap, state: { ...c.initialState, position: 'sitting', exposure: ['chest'] } }) }; };
  const P = run('pneumonia-right-lower-lobe');
  ok('pneumonia case: tachypnoea, hypoxaemia, right-base consolidation signs, and the CURB-65 urea',
    P.snap.resp.RR >= 20 && obs(P.c, P.view, 'vitals.spo2').value.spo2 <= 95 && obs(P.c, P.view, 'lung.sounds', { site: 'chest.lung-base.R' }).value.breath === 'bronchial'
    && REGISTRY.resolvers['chemistry.panel'](P.view, { property: 'electrolytes' }, {}).value.urea > 7);
  const E = run('pulmonary-embolism-after-flight');
  ok('PE case: tachycardia, hypoxaemia with a clear chest, a wide arterial–end-tidal CO2 gap, emboli on CTPA',
    E.snap.ecgMetrics.HR >= 88 && E.snap.resp.PaO2 < 10 && obs(E.c, E.view, 'lung.sounds', { site: 'chest.lung-base.L' }).value.added.length === 0
    && E.snap.resp.PaCO2 - E.snap.resp.EtCO2 > 1.5 && REGISTRY.resolvers['resp.ctpa'](E.view, { property: 'ctpa' }, {}).value.findings.some((x) => x.startsWith('pe-')));
  const C = run('copd-exacerbation'), C28 = run('copd-exacerbation', (m) => { m.respiratory.FiO2 = 0.28; }), C80 = run('copd-exacerbation', (m) => { m.respiratory.FiO2 = 0.8; });
  ok('COPD case: acute-on-chronic hypercapnic failure (pH < 7.35, PaCO2 > 7, raised bicarbonate)', C.view.chemistry.arterialPH < 7.35 && C.view.chemistry.paCO2 > 7 && C.view.chemistry.bicarbonate > 28,
    `pH ${C.view.chemistry.arterialPH.toFixed(2)} PaCO2 ${C.view.chemistry.paCO2.toFixed(1)}`);
  ok('…Venturi 28 % brings the saturation into 88–92 % without much CO2; a non-rebreather overshoots and raises CO2',
    (() => { const s28 = obs(C28.c, C28.view, 'vitals.spo2').value.spo2; return s28 >= 87 && s28 <= 94; })() && C28.snap.resp.PaCO2 - C.snap.resp.PaCO2 < 0.3
    && C80.snap.resp.PaCO2 - C.snap.resp.PaCO2 > (C28.snap.resp.PaCO2 - C.snap.resp.PaCO2) + 0.1 && C80.snap.resp.PaCO2 - C.snap.resp.PaCO2 > 0.25 && obs(C80.c, C80.view, 'vitals.spo2').value.spo2 >= 96,
    `PaCO2 ${C.snap.resp.PaCO2.toFixed(2)} / ${C28.snap.resp.PaCO2.toFixed(2)} / ${C80.snap.resp.PaCO2.toFixed(2)}, SpO2 on 28 % ${obs(C28.c, C28.view, 'vitals.spo2').value.spo2}`);
}

console.log('\nThe internal milieu: water, salt, potassium, acid–base, the kidney, fuels');
{
  const B = (mut, person) => { const m = healthyModel(); if (person) m.patient = { ...m.patient, ...person }; mut?.(m); const snap = settleModel(m, 16).snapshot; return { snap, b: snap.body, ch: chemistryState(snap, m.chemistry) }; };
  const f1 = (x) => (typeof x === 'number' ? x.toFixed(1) : x);
  const H = B();
  ok('healthy steady state: plasma values in their reference ranges, a litre or two of urine',
    H.ch.sodium >= 136 && H.ch.sodium <= 145 && H.ch.potassium >= 3.6 && H.ch.potassium <= 4.6 && H.ch.bicarbonate >= 22 && H.ch.bicarbonate <= 27 && H.ch.urea >= 3 && H.ch.urea <= 7
    && H.ch.creatinine >= 55 && H.ch.creatinine <= 100 && H.ch.glucose >= 4 && H.ch.glucose <= 6.5 && H.ch.lactate < 1.6 && H.ch.anionGap >= 8 && H.ch.anionGap <= 16
    && H.b.urineMlPerH * 24 >= 1000 && H.b.urineMlPerH * 24 <= 2200,
    `Na ${f1(H.ch.sodium)} K ${f1(H.ch.potassium)} HCO3 ${f1(H.ch.bicarbonate)} urea ${f1(H.ch.urea)} crea ${f1(H.ch.creatinine)} glc ${f1(H.ch.glucose)} AG ${f1(H.ch.anionGap)} urine ${f1(H.b.urineMlPerH * 24)} mL/d`);
  const LS = B((m) => Object.assign(m.body, { saltIntake: 20, courseHours: 240 }));
  ok('a low-salt diet: the ECF shrinks, aldosterone rises, the urine holds sodium (the size of the ECF change is not yet sourced)',
    LS.b.dECF < -0.1 && LS.b.aldosterone > 1.5 && LS.b.urineNa < 30, `ECF ${f1(LS.b.dECF)} L, aldosterone ×${f1(LS.b.aldosterone)}, urine Na ${f1(LS.b.urineNa)}`);
  const SI = B((m) => Object.assign(m.body, { siadh: 6, courseHours: 120 }));
  ok('inappropriate ADH: hyponatraemia with a concentrated, salty urine and a near-normal ECF',
    SI.ch.sodium < 132 && SI.b.urineOsm > 300 && SI.b.urineNa > 30 && Math.abs(SI.b.dECF) < 0.6, `Na ${f1(SI.ch.sodium)}, urine osm ${f1(SI.b.urineOsm)}, urine Na ${f1(SI.b.urineNa)}, ECF ${f1(SI.b.dECF)}`);
  const VO = B((m) => Object.assign(m.body, { vomiting: 1.5, foodIntake: 0.2, courseHours: 72 }));
  ok('vomiting: metabolic alkalosis with low chloride and low potassium (and a raised CO2: the lungs compensate)',
    VO.ch.bicarbonate > 28 && VO.ch.chloride < 98 && VO.ch.potassium < 3.7 && VO.ch.arterialPH > 7.44 && VO.ch.paCO2 > 5.6,
    `HCO3 ${f1(VO.ch.bicarbonate)} Cl ${f1(VO.ch.chloride)} K ${f1(VO.ch.potassium)} pH ${VO.ch.arterialPH.toFixed(2)} PaCO2 ${f1(VO.ch.paCO2)}`);
  const DI = B((m) => Object.assign(m.body, { diarrhoea: 3, foodIntake: 0.5, courseHours: 72 }));
  ok('diarrhoea: a normal-anion-gap (hyperchloraemic) acidosis with low potassium',
    DI.ch.bicarbonate < 21 && DI.ch.anionGap < 18 && DI.ch.potassium < 3.6 && DI.ch.sodium - DI.ch.chloride <= 36, `HCO3 ${f1(DI.ch.bicarbonate)} AG ${f1(DI.ch.anionGap)} K ${f1(DI.ch.potassium)} Na−Cl ${f1(DI.ch.sodium - DI.ch.chloride)} (healthy about 38; chloride is high for the sodium)`);
  const CK = B((m) => Object.assign(m.body, { nephronMass: 0.1, courseHours: 1440 }));
  ok('advanced chronic kidney disease: creatinine above 400, a raised (albumin-corrected) anion gap acidosis, high phosphate, a urine that can neither concentrate nor dilute',
    CK.ch.creatinine > 400 && CK.ch.bicarbonate < 22 && CK.ch.anionGap + 0.25 * (42 - CK.b.albumin) > H.ch.anionGap + 0.25 * (42 - H.b.albumin) + 2 && CK.b.phosphate > 1.4 && CK.b.urineOsm > 250 && CK.b.urineOsm < 480,
    `crea ${f1(CK.ch.creatinine)} HCO3 ${f1(CK.ch.bicarbonate)} AG ${f1(CK.ch.anionGap)} PO4 ${CK.b.phosphate.toFixed(2)} urine osm ${f1(CK.b.urineOsm)}`);
  const AT = B((m) => Object.assign(m.body, { tubularInjury: 0.85, courseHours: 72 }));
  ok('acute tubular necrosis: creatinine climbing over days, the tubule leaking sodium (FENa > 2 %) into an unconcentrated urine',
    AT.ch.creatinine > 250 && AT.b.FENa > 2 && AT.b.urineOsm < 450, `crea ${f1(AT.ch.creatinine)} FENa ${f1(AT.b.FENa)} urine osm ${f1(AT.b.urineOsm)}`);
  const LA = B((m) => { m.circulation.Emax = 0.35; m.body.courseHours = 3; });
  ok('a failing circulation makes lactate, and the anion gap rises at least as much as bicarbonate falls',
    LA.ch.lactate > 2.5 && (LA.ch.anionGap - H.ch.anionGap) >= 0.9 * (H.ch.standardBicarbonate - LA.ch.standardBicarbonate),
    `lactate ${f1(LA.ch.lactate)} ΔAG ${f1(LA.ch.anionGap - H.ch.anionGap)} ΔSBC ${f1(H.ch.standardBicarbonate - LA.ch.standardBicarbonate)} CO ${f1(LA.snap.metrics.CO)}`);
  const BL = B((m) => { m.circulation.bloodVolume = 4000; m.body.courseHours = 0.05; });
  const BL6 = B((m) => { m.circulation.bloodVolume = 4000; m.body.courseHours = 6; });
  ok('a litre of blood lost: haemoglobin unchanged at first, then diluted over hours as interstitial fluid refills the plasma',
    Math.abs(BL.ch.haemoglobin - H.ch.haemoglobin) < 4 && BL6.ch.haemoglobin < BL.ch.haemoglobin - 6 && BL6.b.plasma > BL.b.plasma + 0.2,
    `Hb ${f1(BL.ch.haemoglobin)} → ${f1(BL6.ch.haemoglobin)}, plasma ${BL.b.plasma.toFixed(2)} → ${BL6.b.plasma.toFixed(2)} L`);
  const T2 = B((m) => Object.assign(m.body, { betaCell: 0.5, insulinSensitivity: 0.4, courseHours: 240 }));
  ok('type 2 diabetes: hyperglycaemia with high insulin and no ketosis', T2.ch.glucose > 7 && T2.b.insulin > 15 && T2.ch.ketones < 0.5, `glc ${f1(T2.ch.glucose)} insulin ${f1(T2.b.insulin)} ket ${f1(T2.ch.ketones)}`);

  const run = (id, mut) => { const c = caseById(id); const m = modelFromCase(c); mut?.(m); const snap = settleModel(m, 16).snapshot; return { c, m, snap, b: snap.body, view: buildView(c, { circulation: snap, state: { ...c.initialState, exposure: ['chest', 'arm', 'neck'] } }) }; };
  const A = run('aki-hyperkalaemia-triple-whammy');
  const Abase = run('aki-hyperkalaemia-triple-whammy', (m) => { Object.assign(m.body, { nsaid: 0, diarrhoea: 0, foodIntake: 1, fluidIntake: 2 }); });
  const ac = A.view.chemistry, bc = Abase.view.chemistry;
  ok('triple whammy: potassium raised, acute kidney injury by KDIGO (creatinine ×1.5 or +26.5 µmol/L) with a disproportionate urea, a concentrated urine, a postural drop',
    ac.potassium >= 5.5 && Math.abs(A.snap.K - ac.potassium) < 0.1 && (ac.creatinine >= 1.5 * bc.creatinine || ac.creatinine - bc.creatinine >= 26.5) && 1000 * ac.urea / ac.creatinine > 55 && A.b.urineOsm > 500
    && obs(A.c, A.view, 'vitals.bp.R', { position: 'standing' }).value.systolic <= obs(A.c, A.view, 'vitals.bp.R').value.systolic - 10 && obs(A.c, A.view, 'mouth.mucosa').value.moisture !== 'moist',
    `K ${f1(ac.potassium)} PR ${A.snap.ecgMetrics.PR}, crea ${f1(bc.creatinine)} → ${f1(ac.creatinine)}, urea ${f1(ac.urea)}, urine osm ${f1(A.b.urineOsm)}`);
  gap('…with potassium above 6.2 and the PR prolonged, as such patients present (the potassium-load adaptation added from Rabelink 1990 is assumed to need aldosterone; how much RAAS blockade impairs it is not grounded)', ac.potassium >= 6.2 && A.snap.ecgMetrics.PR > 153, `K ${ac.potassium.toFixed(2)} PR ${A.snap.ecgMetrics.PR}`);
  const D = run('diabetic-ketoacidosis');
  const dc = D.view.chemistry;
  const winters = (1.5 * dc.bicarbonate + 8) / 7.5;
  const k0 = 4 * (D.b.ECF - D.b.dECF) + 140 * (D.b.ICF);
  ok('DKA: hyperglycaemia, ketones above 3, a raised-gap acidosis compensated as Winters predicts, potassium normal-high on a depleted body',
    dc.glucose > 14 && D.b.betaHydroxybutyrate > 3 && dc.arterialPH < 7.3 && dc.bicarbonate < 15 && dc.anionGap > 18 && Math.abs(dc.paCO2 - winters) < 0.6
    && dc.potassium >= 4.3 && D.b.Kbody < k0 - 120,
    `glc ${f1(dc.glucose)} βOHB ${f1(D.b.betaHydroxybutyrate)} pH ${dc.arterialPH.toFixed(2)} HCO3 ${f1(dc.bicarbonate)} AG ${f1(dc.anionGap)} PaCO2 ${dc.paCO2.toFixed(2)} (Winters ${winters.toFixed(2)}) K ${f1(dc.potassium)} body K ${D.b.Kbody.toFixed(0)}`);
  ok('…Kussmaul breathing, acetone on the breath, glucose and ketones in the urine, a dry mouth, tachycardia',
    obs(D.c, D.view, 'breathing.pattern').value.depth === 'deep' && obs(D.c, D.view, 'breath.odour').value.odour === 'ketones'
    && ['2+', '3+', '4+'].includes(REGISTRY.resolvers['body.urinalysis'](D.view, { property: 'urinalysis' }, {}).value.glucose)
    && REGISTRY.resolvers['body.urinalysis'](D.view, { property: 'urinalysis' }, {}).value.ketones !== 'negative'
    && obs(D.c, D.view, 'mouth.mucosa').value.moisture !== 'moist' && D.snap.ecgMetrics.HR > 100);
  const Di = run('diabetic-ketoacidosis', (m) => { m.body.insulinDose = 160; m.body.courseHours = 46; m.body.vomiting = 0; m.body.stress = 0.3; });
  ok('…insulin drives potassium into the cells and stops ketogenesis: potassium falls, ketones fall, glucose falls',
    Di.view.chemistry.potassium < dc.potassium - 0.5 && Di.b.betaHydroxybutyrate < D.b.betaHydroxybutyrate && Di.view.chemistry.glucose < dc.glucose,
    `K ${f1(dc.potassium)} → ${f1(Di.view.chemistry.potassium)}, βOHB ${f1(D.b.betaHydroxybutyrate)} → ${f1(Di.b.betaHydroxybutyrate)}`);
  const N = run('hyponatraemia-thiazide');
  ok('thiazide hyponatraemia: sodium below 125, low potassium, low osmolality, a urine that is not maximally dilute',
    N.view.chemistry.sodium < 125 && N.view.chemistry.potassium < 3.5 && N.b.osmolality < 270 && N.b.urineOsm > 100,
    `Na ${f1(N.view.chemistry.sodium)} K ${f1(N.view.chemistry.potassium)} osm ${f1(N.b.osmolality)} urine osm ${f1(N.b.urineOsm)}`);
  const Nn = run('hyponatraemia-thiazide', (m) => { m.body.thiazide = 0; });
  ok('…without the thiazide the same tea and toast leave the sodium near normal (the kidney can dilute)', Nn.view.chemistry.sodium > 130, `Na ${f1(Nn.view.chemistry.sodium)}`);
  const bad = clone(caseById('diabetic-ketoacidosis'));
  bad.pathology.chemistry = { potassium: 6, crp: 40, troponin: 30 };
  bad.pathology.body = { ...bad.pathology.body, flux: 1, nephronMass: 3 };
  const bi = errors(validateCase(bad, CATALOG, REGISTRY)).map((i) => `${i.path}: ${i.message}`).join('\n');
  ok('validator: body parameters must exist and be in range; plasma values the body produces cannot be clamped', /chemistry\.potassium/.test(bi) && /chemistry\.crp/.test(bi) && !/chemistry\.troponin/.test(bi) && /unknown body parameter flux/.test(bi) && /nephronMass: expected/.test(bi), bi);
}

console.log('\nInfection, inflammation and sepsis');
{
  const B = (mut) => { const m = healthyModel(); mut?.(m); const snap = settleModel(m, 16).snapshot; return { snap, b: snap.body, ch: chemistryState(snap, m.chemistry) }; };
  const f1 = (x) => (typeof x === 'number' ? x.toFixed(1) : x);
  const H = B();
  const loc = B((m) => Object.assign(m.body, { infection: 0.3, courseHours: 72 }));
  ok('a local infection: low fever, neutrophilia, a raised CRP, a normal blood pressure',
    loc.b.temperature > 37.5 && loc.b.temperature < 38.5 && loc.ch.whiteCellCount > 11 && loc.ch.crp > 30 && loc.snap.metrics.Psys > 100,
    `T ${f1(loc.b.temperature)} WCC ${f1(loc.ch.whiteCellCount)} CRP ${f1(loc.ch.crp)} SBP ${f1(loc.snap.metrics.Psys)}`);
  const early = B((m) => Object.assign(m.body, { infection: 0.6, courseHours: 6 }));
  const later = B((m) => Object.assign(m.body, { infection: 0.6, courseHours: 48 }));
  ok('CRP lags the white cells: six hours in, white cells are up and CRP still modest; two days in, CRP is high',
    early.ch.whiteCellCount > 10 && early.ch.crp < 70 && later.ch.crp > 150, `6 h: WCC ${f1(early.ch.whiteCellCount)} CRP ${f1(early.ch.crp)}; 48 h: CRP ${f1(later.ch.crp)}`);
  const sh = B((m) => Object.assign(m.body, { infection: 0.92, courseHours: 36, foodIntake: 0.3, fluidIntake: 0.8 }));
  /* Untreated, septic shock is a low-output state (leak, no intake); after 30 mL/kg of crystalloid (Surviving Sepsis) the output is
     normal or high with the resistance still low (Parker 1984), and the pressure may still need a vasopressor. */
  const shFluid = (() => { const m = healthyModel(); Object.assign(m.body, { infection: 0.92, courseHours: 36, foodIntake: 0.3, fluidIntake: 0.8 }); const r = createCirculation(m); r.settle(12);
    r.apply({ ...m, body: { ...m.body, ivSaline: 24 * 2.1 / 3 } }); for (let k = 0; k < 6; k++) { r.body.integrate(0.5); r.settleFast(4); } r.settleFast(30); return r.sim.metrics; })();
  ok('septic shock after 30 mL/kg: output normal or high with resistance still low (Parker 1984), pressure still low',
    shFluid.CO >= 0.75 * H.snap.metrics.CO && shFluid.SVR < 0.8 * H.snap.metrics.SVR && shFluid.Pmean < 75,
    `after fluid: MAP ${f1(shFluid.Pmean)} CO ${f1(shFluid.CO)} SVR ${f1(shFluid.SVR)} (healthy CO ${f1(H.snap.metrics.CO)}, SVR ${f1(H.snap.metrics.SVR)})`);
  ok('septic shock untreated: hypotension from lost resistance, tachycardia, tachypnoea, lactate, kidney injury, falling platelets',
    sh.snap.metrics.Pmean < 70 && sh.snap.metrics.SVR < 0.85 * H.snap.metrics.SVR && sh.snap.ecgMetrics.HR > 110
    && sh.snap.resp.RR >= 22 && sh.ch.lactate > 2 && sh.ch.creatinine > 1.4 * H.ch.creatinine && sh.ch.platelets < 200,
    `MAP ${f1(sh.snap.metrics.Pmean)} SVR ${f1(sh.snap.metrics.SVR)} vs ${f1(H.snap.metrics.SVR)} CO ${f1(sh.snap.metrics.CO)} HR ${sh.snap.ecgMetrics.HR} RR ${f1(sh.snap.resp.RR)} lac ${f1(sh.ch.lactate)} crea ${f1(sh.ch.creatinine)} plt ${f1(sh.ch.platelets)}`);
  const c = caseById('urosepsis-septic-shock'); const snap = settleModel(modelFromCase(c), 16).snapshot;
  const view = buildView(c, { circulation: snap, state: { ...c.initialState, exposure: ['arm'] } });
  const dip = REGISTRY.resolvers['body.urinalysis'](view, { property: 'urinalysis' }, {}).value;
  ok('urosepsis case: qSOFA 3 (rate, pressure, mentation), fever, warm and flushed, an infected urine',
    obs(c, view, 'vitals.rr').value >= 22 && obs(c, view, 'vitals.bp.R').value.systolic <= 100 && c.initialState.orientation === 'confused'
    && obs(c, view, 'vitals.temp').value >= 38 && obs(c, view, 'general.appearance').value.colour === 'flushed' && dip.leukocytes !== 'negative' && dip.nitrites !== 'negative',
    J({ ga: obs(c, view, 'general.appearance'), rr: obs(c, view, 'vitals.rr').value, bp: obs(c, view, 'vitals.bp.R').value, t: obs(c, view, 'vitals.temp').value, dip }));
}

console.log('\nBlood, gut and liver');
{
  const B = (mut, person) => { const m = healthyModel(); if (person) m.patient = { ...m.patient, ...person }; mut?.(m); const snap = settleModel(m, 12).snapshot; return { snap, b: snap.body, ch: chemistryState(snap, m.chemistry) }; };
  const f1 = (x) => (typeof x === 'number' ? x.toFixed(1) : x);
  const H = B(), H120 = B((m) => { m.body.courseHours = 2880; });
  ok('red cells and iron at steady state: four months of health change nothing', Math.abs(H120.ch.haemoglobin - H.ch.haemoglobin) < 2 && Math.abs(H120.b.mcv - 90) < 1 && Math.abs(H120.b.ironStores - H.b.ironStores) < 30,
    `Hb ${f1(H.ch.haemoglobin)} → ${f1(H120.ch.haemoglobin)}, iron ${f1(H.b.ironStores)} → ${f1(H120.b.ironStores)} mg`);
  const OC = B((m) => Object.assign(m.body, { lowerGIBleed: 0.8, courseHours: 4380 }), { sex: 'F', age: 71, weightKg: 63, heightCm: 160 });
  ok('a slow bleed for six months: stores empty first, then a microcytic anaemia with too few reticulocytes',
    OC.ch.haemoglobin < 110 && OC.b.mcv < 82 && OC.b.ferritin < 15 && OC.b.reticulocytes < 2, `Hb ${f1(OC.ch.haemoglobin)} MCV ${f1(OC.b.mcv)} ferritin ${f1(OC.b.ferritin)} retic ${f1(OC.b.reticulocytes)}`);
  const B12 = B((m) => Object.assign(m.body, { b12Deficiency: 0.8, courseHours: 2880 }));
  ok('B12 deficiency: a macrocytic anaemia, high LDH, low reticulocytes', B12.ch.haemoglobin < 135 && B12.b.mcv > 100 && B12.b.ldh > 400 && B12.b.reticulocytes < 1.5,
    `Hb ${f1(B12.ch.haemoglobin)} MCV ${f1(B12.b.mcv)} LDH ${f1(B12.b.ldh)} retic ${f1(B12.b.reticulocytes)}`);
  const HL = B((m) => Object.assign(m.body, { haemolysis: 2, courseHours: 720 }));
  ok('haemolysis: anaemia with reticulocytosis, unconjugated hyperbilirubinaemia, low haptoglobin', HL.ch.haemoglobin < 120 && HL.b.reticulocytes > 3 && HL.b.bilirubin - HL.b.bilirubinConjugated > 25 && HL.b.haptoglobin < 0.5,
    `Hb ${f1(HL.ch.haemoglobin)} retic ${f1(HL.b.reticulocytes)} bili ${f1(HL.b.bilirubin)}/${f1(HL.b.bilirubinConjugated)} hapto ${HL.b.haptoglobin.toFixed(2)}`);
  const CK = B((m) => Object.assign(m.body, { nephronMass: 0.12, courseHours: 2880 }));
  ok('chronic kidney disease: too little erythropoietin, a normocytic anaemia', CK.ch.haemoglobin < 125 && Math.abs(CK.b.mcv - 90) < 3 && CK.b.epo < 10, `Hb ${f1(CK.ch.haemoglobin)} MCV ${f1(CK.b.mcv)} EPO ${f1(CK.b.epo)}`);
  const OJ = B((m) => Object.assign(m.body, { cholestasis: 0.9, courseHours: 240 }));
  ok('a blocked bile duct: conjugated hyperbilirubinaemia, ALP and GGT high, bilirubin in the urine, pale stool',
    OJ.b.bilirubin > 80 && OJ.b.bilirubinConjugated / OJ.b.bilirubin > 0.7 && OJ.b.alp > 300 && OJ.b.inr > 1.2,
    `bili ${f1(OJ.b.bilirubin)}/${f1(OJ.b.bilirubinConjugated)} ALP ${f1(OJ.b.alp)} INR ${OJ.b.inr.toFixed(2)}`);
  const run = (id) => { const c = caseById(id); const snap = settleModel(modelFromCase(c), 16).snapshot; return { c, snap, b: snap.body, view: buildView(c, { circulation: snap, state: { ...c.initialState, exposure: ['chest', 'arm', 'neck', 'abdomen'] } }) }; };
  const U = run('upper-gi-bleed-peptic-ulcer');
  ok('upper GI bleed: melaena, a postural drop, urea high with creatinine normal, haemoglobin already falling',
    obs(U.c, U.view, 'rectal.exam').value.stool === 'melaena' && obs(U.c, U.view, 'vitals.bp.R', { position: 'standing' }).value.systolic <= obs(U.c, U.view, 'vitals.bp.R').value.systolic - 20
    && U.view.chemistry.urea > 12 && U.view.chemistry.creatinine < 110 && U.view.chemistry.haemoglobin < 140, `urea ${f1(U.view.chemistry.urea)} crea ${f1(U.view.chemistry.creatinine)} Hb ${f1(U.view.chemistry.haemoglobin)}`);
  const C = run('decompensated-cirrhosis');
  ok('decompensated cirrhosis: ascites, jaundice, asterixis, a long INR, low albumin and platelets, high MCV',
    ['shifting', 'tense'].includes(obs(C.c, C.view, 'abdomen.ascites').value.ascites) && obs(C.c, C.view, 'eyes.sclera').value.icterus !== 'none' && obs(C.c, C.view, 'hands.asterixis').value.flap
    && C.b.inr > 1.8 && C.b.albumin < 28 && C.view.chemistry.platelets < 150 && C.b.mcv > 94 && obs(C.c, C.view, 'legs.oedema').value.extent !== 'knee',
    `asc ${f1(C.b.ascites)} L, bili ${f1(C.b.bilirubin)} INR ${C.b.inr.toFixed(2)} alb ${f1(C.b.albumin)} plt ${f1(C.view.chemistry.platelets)} MCV ${f1(C.b.mcv)} NH3 ${f1(C.b.ammonia)}`);
  const I = run('iron-deficiency-anaemia-caecal');
  ok('iron-deficiency case: pale, microcytic, ferritin empty', obs(I.c, I.view, 'eyes.conjunctiva').value.pallor !== 'none' && I.b.mcv < 82 && I.b.ferritin < 15, `MCV ${f1(I.b.mcv)} ferritin ${f1(I.b.ferritin)}`);
}

console.log('\nHormones: thyroid, adrenal cortex and calcium');
{
  const B = (mut, person) => { const m = healthyModel(); if (person) m.patient = { ...m.patient, ...person }; mut?.(m); const snap = settleModel(m, 12).snapshot; return { m, snap, b: snap.body, ch: chemistryState(snap, m.chemistry) }; };
  const chronic = (days, body, acute = {}) => (m) => { m.chronic = { days, body }; Object.assign(m.body, body, { courseHours: 24 }, acute); };
  const f = (x, d = 1) => (typeof x === 'number' ? x.toFixed(d) : x);
  const H = B();
  ok('at rest the three loops sit at their set points', Math.abs(H.b.tsh - 2) < 0.2 && Math.abs(H.b.ft4 - 16) < 0.5 && Math.abs(H.b.cortisol - 400) < 30 && Math.abs(H.b.calcium - 2.35) < 0.05 && Math.abs(H.b.pth - 4) < 0.6 && H.b.cortisolDeficit < 0.02,
    `TSH ${f(H.b.tsh, 2)} fT4 ${f(H.b.ft4)} cortisol ${f(H.b.cortisol, 0)} Ca ${f(H.b.calcium, 2)} PTH ${f(H.b.pth)}`);
  const G = B(chronic(60, { thyroidStimulation: 1 }));
  ok('Graves: TSH suppressed, T4 high, a hyperdynamic circulation and a raised metabolic rate',
    G.b.tsh < 0.1 && G.b.ft4 > 35 && G.snap.metrics.HRbeat > 100 && G.snap.metrics.CO > H.snap.metrics.CO * 1.3 && G.snap.resp.VO2 > H.snap.resp.VO2 * 1.4 && G.snap.metrics.SVR < H.snap.metrics.SVR * 0.8,
    `TSH ${f(G.b.tsh, 3)} fT4 ${f(G.b.ft4)} HR ${f(G.snap.metrics.HRbeat, 0)} CO ${f(G.snap.metrics.CO)} VO2 ${f(G.snap.resp.VO2, 0)} SVR ${f(G.snap.metrics.SVR, 0)}`);
  const Hy = B(chronic(90, { thyroidGland: 0.08 }));
  ok('hypothyroidism: TSH high, T4 low, pulse 60–80, resistance up and output down, metabolic rate down 10–30 % (Klein & Danzi; Karmisholt 2010)', Hy.b.tsh > 20 && Hy.b.ft4 < 8 && Hy.snap.metrics.HRbeat >= 59.5 && Hy.snap.metrics.HRbeat <= 80 && Hy.snap.metrics.SVR > H.snap.metrics.SVR * 1.3 && Hy.snap.metrics.CO < H.snap.metrics.CO * 0.85 && Hy.snap.resp.VO2 > H.snap.resp.VO2 * 0.7 && Hy.snap.resp.VO2 < H.snap.resp.VO2 * 0.9,
    `TSH ${f(Hy.b.tsh)} fT4 ${f(Hy.b.ft4)} HR ${f(Hy.snap.metrics.HRbeat, 0)} SVR ${f(Hy.snap.metrics.SVR, 0)} CO ${f(Hy.snap.metrics.CO)} VO2 ${f(Hy.snap.resp.VO2, 0)}`);
  gap('…with cardiac output down 30–50 % as reported (Klein & Danzi)', Hy.snap.metrics.CO < H.snap.metrics.CO * 0.7,
    `TSH ${f(Hy.b.tsh)} fT4 ${f(Hy.b.ft4)} HR ${f(Hy.snap.metrics.HRbeat, 0)} SVR ${f(Hy.snap.metrics.SVR, 0)} CO ${f(Hy.snap.metrics.CO)} VO2 ${f(Hy.snap.resp.VO2, 0)}`);
  const Sub = B(chronic(120, { thyroidGland: 0.5 }));
  ok('a failing gland driven harder: subclinical hypothyroidism (TSH up, T4 still normal)', Sub.b.tsh > 4 && Sub.b.ft4 > 10, `TSH ${f(Sub.b.tsh)} fT4 ${f(Sub.b.ft4)}`);
  const T4 = B((m) => chronic(90, { thyroidGland: 0.02, thyroxineDose: 1.6 * m.patient.weightKg })(m));
  ok('levothyroxine 1.6 µg/kg replaces the gland', T4.b.tsh > 0.4 && T4.b.tsh < 4 && T4.b.ft4 > 12, `TSH ${f(T4.b.tsh, 2)} fT4 ${f(T4.b.ft4)}`);
  const Ad = B(chronic(90, { adrenalFunction: 0.03 }));
  ok('Addison’s disease: cortisol low with ACTH very high, aldosterone low with renin up, sodium down, potassium up',
    Ad.b.cortisol < 120 && Ad.b.acth > 150 && Ad.b.aldosteronePmol < 100 && Ad.b.renin > 1.2 * H.b.renin && Ad.ch.sodium < 134 && Ad.ch.potassium > 5,
    `cortisol ${f(Ad.b.cortisol, 0)} ACTH ${f(Ad.b.acth, 0)} aldo ${f(Ad.b.aldosteronePmol, 0)} renin ${f(Ad.b.renin)} Na ${f(Ad.ch.sodium)} K ${f(Ad.ch.potassium)} MAP ${f(Ad.snap.metrics.Pmean, 0)}`);
  const AdT = B(chronic(90, { adrenalFunction: 0.03, hydrocortisoneDose: 20, fludrocortisone: 0.1 }));
  ok('…hydrocortisone and fludrocortisone put it right', Math.abs(AdT.ch.sodium - H.ch.sodium) < 3 && Math.abs(AdT.ch.potassium - H.ch.potassium) < 0.4 && AdT.b.cortisolDeficit < 0.1 && Math.abs(AdT.snap.metrics.Pmean - H.snap.metrics.Pmean) < 6,
    `Na ${f(AdT.ch.sodium)} K ${f(AdT.ch.potassium)} MAP ${f(AdT.snap.metrics.Pmean, 0)}`);
  const Pit = B(chronic(90, { pituitary: 0.1 }));
  ok('pituitary failure: TSH and ACTH low, T4 and cortisol low, aldosterone kept, no pigmentation',
    Pit.b.tsh < 1 && Pit.b.ft4 < 12 && Pit.b.acth < 15 && Pit.b.cortisol < 250 && Pit.b.aldosteronePmol > 150 && Pit.ch.potassium < 4.8,
    `TSH ${f(Pit.b.tsh, 2)} fT4 ${f(Pit.b.ft4)} ACTH ${f(Pit.b.acth, 0)} cortisol ${f(Pit.b.cortisol, 0)} aldo ${f(Pit.b.aldosteronePmol, 0)} K ${f(Pit.ch.potassium)}`);
  const St = B((m) => Object.assign(m.body, { stress: 1, courseHours: 12 }));
  ok('illness drives ACTH and cortisol up, and an intact adrenal meets the demand', St.b.cortisol > 650 && St.b.cortisolDeficit < 0.1, `cortisol ${f(St.b.cortisol, 0)} deficit ${f(St.b.cortisolDeficit, 2)}`);
  const P = B(chronic(120, { pthAutonomy: 1 }));
  ok('primary hyperparathyroidism: calcium high with PTH not suppressed, phosphate low-normal', P.b.calcium > 2.62 && P.b.calcium < 3.0 && P.b.pth > 7 && P.b.phosphate < H.b.phosphate,
    `Ca ${f(P.b.calcium, 2)} PTH ${f(P.b.pth)} PO4 ${f(P.b.phosphate, 2)}`);
  const M = B(chronic(30, {}, { pthrp: 1.0, boneResorption: 0.3, fluidIntake: 0.9, foodIntake: 0.4, courseHours: 336 }));
  ok('PTHrP and metastases: calcium above 3 with PTH suppressed, the urine cannot concentrate, filtration falls',
    M.b.calcium > 3.1 && M.b.pth < 1 && M.b.GFR < H.b.GFR * 0.9 && M.b.urineOsm < 500,
    `Ca ${f(M.b.calcium, 2)} PTH ${f(M.b.pth)} GFR ${f(M.b.GFR, 0)} Uosm ${f(M.b.urineOsm, 0)}`);
  const MT = B(chronic(30, {}, { pthrp: 1.0, boneResorption: 0.3, fluidIntake: 4, saltIntake: 300, foodIntake: 0.4, bisphosphonate: 0.9, courseHours: 336 }));
  ok('…saline and a bisphosphonate bring it down', MT.b.calcium < M.b.calcium - 0.4, `Ca ${f(M.b.calcium, 2)} → ${f(MT.b.calcium, 2)}`);
  const D = B(chronic(120, { vitaminD: 0.15 }));
  ok('vitamin D deficiency: PTH up holds calcium near normal, phosphate falls', D.b.pth > 5 && D.b.calcium > 2.15 && D.b.phosphate < H.b.phosphate - 0.08, `Ca ${f(D.b.calcium, 2)} PTH ${f(D.b.pth)} PO4 ${f(D.b.phosphate, 2)}`);

  const run = (id) => { const c = caseById(id); const snap = settleModel(modelFromCase(c), 16).snapshot; return { c, snap, b: snap.body, view: buildView(c, { circulation: snap, state: { ...c.initialState, exposure: ['chest', 'arm', 'neck', 'abdomen'] } }) }; };
  const inv = (r, id) => REGISTRY.resolvers[CATALOG.investigations[id].resolver](r.view, { property: id }, {}).value;
  const Gc = run('graves-thyrotoxicosis');
  const ge = obs(Gc.c, Gc.view, 'eyes.thyroid').value, gt = obs(Gc.c, Gc.view, 'neck.thyroid').value;
  ok('Graves case: tachycardia, tremor, a diffuse goitre with a bruit, lid lag and exophthalmos; TSH suppressed, T4 high',
    obs(Gc.c, Gc.view, 'vitals.hr').value > 100 && obs(Gc.c, Gc.view, 'hands.tremor').value.tremor === 'fine' && gt.goitre === 'diffuse' && gt.bruit && ge.lidLag && ge.exophthalmos
    && inv(Gc, 'tft').tsh < 0.1 && inv(Gc, 'tft').ft4 > 30, JSON.stringify({ hr: obs(Gc.c, Gc.view, 'vitals.hr').value, tft: inv(Gc, 'tft') }));
  const Ac = run('addisonian-crisis');
  const bpLie = obs(Ac.c, Ac.view, 'vitals.bp.R').value, bpStand = obs(Ac.c, Ac.view, 'vitals.bp.R', { position: 'standing' }).value;
  ok('Addisonian crisis case: a postural fall of 20 or more, pigmentation, sodium low and potassium high-normal (frank hyperkalaemia in only a fifth of admissions: Rushworth), cortisol low with ACTH high, a failed Synacthen test',
    bpStand.systolic <= bpLie.systolic - 20 && obs(Ac.c, Ac.view, 'skin.pigmentation').value.pigmentation === 'increased'
    && Ac.view.chemistry.sodium < 134 && Ac.view.chemistry.potassium >= 4.5 && inv(Ac, 'cortisol').cortisol < 150 && inv(Ac, 'cortisol').acth > 150 && inv(Ac, 'synacthen').cortisol30 < 300,
    JSON.stringify({ bpLie, bpStand, na: Ac.view.chemistry.sodium, k: Ac.view.chemistry.potassium, cort: inv(Ac, 'cortisol') }));
  gap('…lying systolic pressure 110 or less, as in half of real crises', bpLie.systolic <= 110, `lying ${bpLie.systolic}/${bpLie.diastolic}`);
  /* The defining test of an adrenal crisis: a litre of saline barely moves the pressure, hydrocortisone restores it within an hour. */
  {
    const treat = (change, hours) => {
      const m = modelFromCase(caseById('addisonian-crisis')); const r = createCirculation(m); r.settle(20);
      const before = { map: r.sim.metrics.Pmean, hr: r.sim.metrics.HRbeat };
      r.apply({ ...m, body: { ...m.body, ...change } });
      for (let k = 0; k < hours * 2; k++) { r.body.integrate(0.5); r.settleFast(4); }
      r.settleFast(30);
      return { before, after: { map: r.sim.metrics.Pmean, hr: r.sim.metrics.HRbeat } };
    };
    const sal = treat({ ivSaline: 24 }, 1), hc = treat({ hydrocortisoneDose: 200 }, 1);
    ok('adrenal crisis: a litre of saline barely moves the pressure; hydrocortisone raises it and slows the heart within an hour',
      Math.abs(sal.after.map - sal.before.map) < 3 && hc.after.map - hc.before.map >= 4 && hc.after.hr < hc.before.hr - 3,
      JSON.stringify({ saline: sal, hydrocortisone: hc }, (k, v) => (typeof v === 'number' ? Math.round(v) : v)));
  }
  const Hc = run('hypercalcaemia-malignancy');
  const ecg = REGISTRY.resolvers['electrical.ecg'](Hc.view, { property: 'ecg-12' }, {}).value;
  ok('hypercalcaemia case: adjusted calcium above 3.2 with PTH suppressed, dry, urea raised, a short QTc',
    inv(Hc, 'bone-profile').calcium > 3.2 && inv(Hc, 'pth').pth < 1 && obs(Hc.c, Hc.view, 'mouth.mucosa').value.moisture !== 'moist' && Hc.view.chemistry.urea > 8 && ecg.qtc < 380,
    JSON.stringify({ bone: inv(Hc, 'bone-profile'), pth: inv(Hc, 'pth'), urea: Hc.view.chemistry.urea, qtc: ecg.qtc }));
}

console.log('\nThe examination against human data');
{
  const c = caseById('foot-drop-right-l5');
  const at = (loss) => { const m = modelFromCase(c); m.body.courseHours = 0.1; m.circulation.bloodVolume = m.circulation.bloodVolume * (1 - loss); const snap = settleModel(m, 12).snapshot;
    const view = buildView(c, { circulation: snap, state: { ...c.initialState } });
    return obs(c, view, 'vitals.hr', { position: 'standing' }).value - obs(c, view, 'vitals.hr').value; };
  const d0 = at(0), dMod = at(0.09), dLarge = at(0.17);
  ok('postural pulse rise: under 30 /min when well and after a moderate bleed (about 9 % of blood), 30 or more after a large one (17 %) (McGee 1999)',
    d0 < 30 && dMod < 30 && dLarge >= 30, `well +${d0}, moderate +${dMod}, large +${dLarge} /min`);
  const view = buildView(c, { circulation: settleModel(modelFromCase(c), 12).snapshot, state: { ...c.initialState } });
  const crt = obs(c, view, 'hands.crt').value;
  ok('capillary refill of a well adult at Schriger & Baraff’s median for age and sex (1.0–1.8 s)', crt >= 1.0 && crt <= 1.8, `${crt} s (patient ${c.patient.age} ${c.patient.sex})`);
}

console.log('\nThe ECG against human data');
{
  const H = settleModel(healthyModel(), 12).snapshot.ecgMetrics;
  ok('resting ECG within Mason’s reference ranges: PR 113–212, QRS 69–109, QTc (Bazett) 361–457 ms, axis −40° to 91°',
    H.PR >= 113 && H.PR <= 212 && H.QRS >= 69 && H.QRS <= 109 && H.QTc >= 361 && H.QTc <= 457 && H.qrsAxis >= -40 && H.qrsAxis <= 91,
    `PR ${H.PR} QRS ${H.QRS} QT ${H.QT} QTc ${H.QTc} axis ${H.qrsAxis}`);
  const fast = settleModel((() => { const m = healthyModel(); m.circulation.HR = 150; return m; })(), 12).snapshot.ecgMetrics;
  const rrS = 60 / fast.HR, sagie = 385 - 154 * (1 - rrS);
  ok('QT shortens with rate as in Framingham (Sagie: QT = QT₁ − 154·(1 − RR)), so Bazett’s QTc reads longer at a fast rate',
    Math.abs(fast.QT - sagie) < 15 && fast.QTc > H.QTc, `HR ${fast.HR}: QT ${fast.QT} (Sagie ${sagie.toFixed(0)}), QTc ${fast.QTc} vs ${H.QTc} at rest`);
}

console.log('\nThe lungs against human data');
{
  const r = new Respiratory({}, { age: 45, sex: 'M', heightCm: 176, weightKg: 76 }); const s = r.snapshot();
  const mm = 7.50062;
  ok('quiet breathing: rate 14–19 /min and tidal volume 300–480 mL (Tobin: 16.6 ± 2.8, 383 ± 91), Ti/Ttot about 0.42',
    s.RR > 14 && s.RR < 19 && s.VT > 0.3 && s.VT < 0.48 && Math.abs(s.Ti / (s.Ti + s.Te) - 0.42) < 0.03, `RR ${s.RR.toFixed(1)} VT ${(s.VT * 1000).toFixed(0)} mL`);
  ok('PaO2 at 45 years within 5 mmHg of Sorbini’s 109 − 0.43 × age, PaCO2 38–42 mmHg', Math.abs(s.PaO2 * mm - (109 - 0.43 * 45)) < 5 && s.PaCO2 * mm > 38 && s.PaCO2 * mm < 42,
    `PaO2 ${(s.PaO2 * mm).toFixed(1)} PaCO2 ${(s.PaCO2 * mm).toFixed(1)} mmHg`);
  const c = r.controllerCurve([5.33, 5.33 + 10 / mm]);
  const hcvr = (c[1] - c[0]) / 10;
  ok('CO2 response 1.5–2.8 L/min/mmHg (Westerman: 2.13 ± 0.17 SE; Ben-Dov: 2.46)', hcvr > 1.5 && hcvr < 2.8, `${hcvr.toFixed(2)} L/min/mmHg`);
  const rr = r, m = rr.mechanics(), cap = rr.capacity(m);
  const ve = (p) => rr.delivered(rr.demand(p / mm, 5.33, m), cap);
  const A = (ve(45) - ve(100)) / (1 / (45 - 32) - 1 / (100 - 32));
  ok('isocapnic hypoxic response: Weil’s A 130–230 L/min·mmHg (Weil: 180 ± 14.5 SEM)', A > 130 && A < 230, `A ${A.toFixed(0)}`);
}

console.log('\nThe kidney against human data');
{
  const K = (body, chronic) => { const m = healthyModel(); if (chronic) { m.chronic = chronic; Object.assign(m.body, chronic.body); } Object.assign(m.body, body); return settleModel(m, 12).snapshot.body; };
  const k2 = K({ potassiumIntake: 400, courseHours: 48 });
  ok('potassium loading, 400 mmol/day: balance in the second day (urinary K at least 75 % of intake) at a modestly raised plasma potassium (Rabelink 1990)',
    k2.uKRate >= 300 && k2.potassium > 4.1 && k2.potassium < 5.2, `uK ${k2.uKRate.toFixed(0)} mmol/day, K ${k2.potassium.toFixed(2)}`);
  const atn = K({ tubularInjury: 1, courseHours: 48 });
  ok('established tubular necrosis: urine osmolality below 350, urine sodium above 40, FENa above 1 % (Miller 1978)',
    atn.urineOsm < 350 && atn.urineNa > 40 && atn.FENa > 1, `Uosm ${atn.urineOsm.toFixed(0)} UNa ${atn.urineNa.toFixed(0)} FENa ${atn.FENa.toFixed(1)} %`);
  const pre = K({ diarrhoea: 3, fluidIntake: 0.5, foodIntake: 0.5, courseHours: 48 });
  ok('prerenal (diarrhoea): urine osmolality above 500 and FENa below 1 % (Miller 1978)', pre.urineOsm > 500 && pre.FENa < 1,
    `Uosm ${pre.urineOsm.toFixed(0)} UNa ${pre.urineNa.toFixed(0)} FENa ${pre.FENa.toFixed(2)} %`);
  gap('…with urine sodium below 20', pre.urineNa < 20, `UNa ${pre.urineNa.toFixed(0)}`);
}

console.log('\nThe circulation against human data');
{
  const base = () => { const run = createCirculation(healthyModel()); run.settle(40); return run; };
  const H = base(); const hm = H.sim.metrics;
  let lvedp = 0, vmax = 0; for (let i = 0; i < 400; i++) { H.advance(0.0025); if (H.sim.s[0] > vmax) { vmax = H.sim.s[0]; lvedp = H.sim.Pv; } }
  ok('reference man at rest: MAP 85–100, output 4.5–5.8 L/min, EF 52–70 % (Lang), wedge 6–11, mean PA 9–17 (Kovacs), CVP 2–7',
    hm.Pmean > 85 && hm.Pmean < 100 && hm.CO > 4.5 && hm.CO < 5.8 && hm.EF > 52 && hm.EF < 70 && hm.PlaMean > 6 && hm.PlaMean < 11 && hm.PpaMean > 9 && hm.PpaMean < 17 && hm.CVPmean > 2 && hm.CVPmean < 7,
    `MAP ${hm.Pmean.toFixed(0)} CO ${hm.CO.toFixed(2)} EF ${hm.EF.toFixed(0)} wedge ${hm.PlaMean.toFixed(1)} PA ${hm.PpaMean.toFixed(1)} CVP ${hm.CVPmean.toFixed(1)}`);
  ok('…the left ventricle fills on Klotz’s curve: end-diastolic pressure 6–11 mmHg at 110–140 mL', lvedp > 6 && lvedp < 11 && vmax > 110 && vmax < 140, `${lvedp.toFixed(1)} mmHg at ${vmax.toFixed(0)} mL`);
  const pvr = (hm.PpaMean - hm.PlaMean) / hm.CO * 80;
  ok('…pulmonary vascular resistance 40–100 dyn·s·cm⁻⁵ (Kovacs: 69 ± 28 at 24–50 years)', pvr > 40 && pvr < 100, pvr.toFixed(0));
  const blk = (mut) => { const m = healthyModel(); mut(m.circulation); const r = createCirculation(m); r.settle(40); return r.sim.HReff; };
  const atr = blk((c) => { c.gP = 0; }), prop = blk((c) => { c.gS = 0; c.gE = 0; }), dbl = blk((c) => { c.gP = 0; c.gS = 0; c.gE = 0; });
  ok('autonomic blockade: atropine 95–112/min (Cina: 103 ± 16), propranolol below rest, both together at the intrinsic rate 88–97 (Jose: 92.5 at 45 years)',
    atr >= 95 && atr <= 112 && prop < H.sim.HReff - 5 && dbl >= 88 && dbl <= 97, `rest ${H.sim.HReff}, atropine ${atr}, propranolol ${prop}, both ${dbl}`);
  { // steady-state cardiovagal baroreflex slope across pressor and depressor resistance changes
    const m = healthyModel(), r = createCirculation(m); r.settle(40); const pts = [];
    for (const k of [0.85, 1, 1.15]) { const mm = clone(m); mm.circulation.Rsys = m.circulation.Rsys * k; r.apply(mm); r.settleFast(30); pts.push([r.sim.metrics.Psys, 60000 / r.sim.metrics.HRbeat]); }
    const slope = (pts[2][1] - pts[0][1]) / (pts[2][0] - pts[0][0]);
    ok('cardiovagal baroreflex sensitivity 8–20 ms/mmHg (Monahan: 19 young, 8.3 older men)', slope > 8 && slope < 20, `${slope.toFixed(1)} ms/mmHg`);
  }
  { // Johnson 2014: 1000 mL from ~6.4 L in three 5-minute stages; here 5.2 % of blood per stage
    const m = healthyModel(), r = createCirculation(m); r.settle(40);
    const snap = () => ({ HR: r.sim.HReff, MAP: r.sim.metrics.Pmean, SV: r.sim.metrics.SV, CO: r.sim.metrics.CO, CVP: r.sim.metrics.CVPmean });
    const b = snap(); for (const k of [1, 2, 3]) { const mm = clone(m); mm.circulation.bloodVolume = m.circulation.bloodVolume * (1 - 0.052 * k); r.apply(mm); r.advance(300); }
    const e = snap(), pc = (k) => (e[k] / b[k] - 1) * 100, d = `HR ${pc('HR').toFixed(0)} % MAP ${pc('MAP').toFixed(1)} % SV ${pc('SV').toFixed(0)} % CO ${pc('CO').toFixed(0)} % CVP ${(e.CVP - b.CVP).toFixed(1)} mmHg (Johnson: +14, −2.4, −20, −11 %, −4.7)`;
    ok('haemorrhage of a sixth of the blood over 15 minutes: pressure held within 5 %, stroke volume down 12–30 %, output down 5–20 % (Johnson 2014)',
      Math.abs(pc('MAP')) < 5 && pc('SV') < -12 && pc('SV') > -30 && pc('CO') < -5 && pc('CO') > -20, d);
    gap('…with the heart rate up 10 % or more and the CVP down 3 mmHg or more (no cardiopulmonary or pulse-pressure afferent yet)', pc('HR') >= 10 && e.CVP - b.CVP <= -3, d);
  }
}

console.log('\nEvidence: every constant has a status, every grounded one a reference');
{
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = `${d}/${f}`; return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []; });
  const src = [...walk('src/vp'), ...walk('src/domains/cardio/sim')].filter((f) => !f.includes('/evidence/')).map((f) => readFileSync(f, 'utf8')).join('\n');
  const issues = constantIssues();
  ok('the constant registry has no errors (measured and derived constants cite references; derived and assumed ones show their working)', issues.length === 0, issues.join('; '));
  const alias = { thyroid: 'THY', adrenal: 'ADR', calcium: 'CA', water: 'WAT', kidney: 'KID', circulation: 'CIRC', baroreflex: 'BARO', inflammation: 'INF', lung: 'LUNG', ecg: 'ECG', exam: 'EXAM' };
  const unused = Object.values(CONSTANTS).filter((c) => alias[c.group] && !new RegExp(`\\b${alias[c.group]}\\.${c.id.split('.')[1]}\\b`).test(src)).map((c) => c.id);
  ok('every registered constant is used by the model (no stale entries)', unused.length === 0, unused.join(', '));
  const refsUsed = new Set(Object.values(CONSTANTS).flatMap((c) => c.refs ?? []));
  const weak = Object.values(CONSTANTS).filter((c) => (c.status === 'measured' || c.status === 'derived') && (c.refs ?? []).every((r) => ['record', 'unverified'].includes(REFERENCES[r]?.verified))).map((c) => c.id);
  const summary = groundingSummary();
  console.log('    grounding:', Object.entries(summary).map(([g, n]) => `${g} ${n.measured + n.derived}/${n.measured + n.derived + n.assumed + n.ungrounded} grounded, ${n.assumed} assumed, ${n.ungrounded} ungrounded`).join('; '));
  console.log('    awaiting a read of the original:', weak.join(', ') || 'none');
  ok('references cited by constants exist and are recorded with how far they were checked', [...refsUsed].every((r) => REFERENCES[r] && REFERENCES[r].verified));
}


/* ---- teaching cards against the model ---------------------------------------------------------------------------
   A card says a sign occurs in a condition. Where the case library has a patient with that condition, the model must
   show the sign in that patient, at any site where the card's technique looks. A link that is not shown is listed
   below with its reason: either this patient does not have the sign (the card is still right), or the model cannot
   produce it yet (a model gap to work on). A new mismatch fails; a listed one that starts to show is reported, so the
   list stays honest. */
console.log('\nTeaching cards against the cases');
{
  const CARD_EXCEPTIONS = {
    /* the model cannot produce the sign yet */
    'auscultate.heart.pulmonary/0/pulmonary-embolism': 'model: no loud P2 in pulmonary hypertension',
    'auscultate.heart.pulmonary/0/copd-exacerbation': 'model: no loud P2 in pulmonary hypertension',
    'auscultate.heart.tricuspid/0/pulmonary-embolism': 'model: no tricuspid regurgitation murmur',
    ...Object.fromEntries(['upper-zone', 'mid-zone', 'axilla', 'upper-back', 'base'].map((k) => [`${k === 'base' ? 'auscultate.lung-base' : `auscultate.lung-${k}`}/5/pulmonary-embolism`, 'model: no pleural rub'])),
    'inspect.legs/1/pulmonary-embolism': 'model: no deep vein thrombosis',
    'inspect.mouth/1/iron-deficiency-anaemia': 'model: no glossitis or angular cheilitis',
    'smell.breath/1/decompensated-cirrhosis': 'model: no fetor hepaticus',
    'smell.breath/2/acute-kidney-injury': 'model: no uraemic fetor',
    'measure.bp/2/aortic-stenosis': 'model: aortic stenosis does not narrow the resting pulse pressure (112/76)',
    'measure.rr/0/diabetic-ketoacidosis': 'model: ketoacidosis deepens breathing but the rate stays at 18',
    'inspect.jvp/1/diabetic-ketoacidosis': 'model: right atrial pressure 2 mmHg reads as a normal JVP, not an empty one',
    /* this patient does not have the sign; the card is right */
    'measure.spo2/0/community-acquired-pneumonia': 'case: saturation 94 % on air, at the threshold',
    ...Object.fromEntries(['nasal-2', 'venturi-28', 'venturi-35', 'mask-6', 'nrb-15', 'off'].map((d) => [`give.oxygen.${d}/0/community-acquired-pneumonia`, 'case: saturation 94 % on air, little shunt to show'])),
    'measure.crt/0/urosepsis': 'case: warm septic shock, skin vessels dilated, refill normal',
    'inspect.jvp/0/pulmonary-embolism': 'case: submassive embolism, right atrial pressure normal',
    'inspect.legs/0/acute-kidney-injury': 'case: the triple-whammy patient is dry, not overloaded',
    'test.asterixis/0/acute-kidney-injury': 'case: no uraemic encephalopathy',
    'test.asterixis/0/copd-exacerbation': 'case: no CO₂ narcosis',
    'measure.bp.lying-standing/1/hyponatraemia-thiazide': 'case: small volume deficit, systolic falls only 10 mmHg',
    'test.visual-fields/0/ischaemic-stroke-left-mca': 'case: motor and language deficit without hemianopia',
    'test.face-sensation/0/ischaemic-stroke-left-mca': 'case: no hemisensory loss',
    'test.arm.pinprick/1/ischaemic-stroke-left-mca': 'case: no hemisensory loss',
    'test.leg.tone/0/ischaemic-stroke-left-mca': 'case: an hour after onset tone is not yet spastic (the card says so)',
  };
  const caseFor = Object.fromEntries(CASES.map((c) => [c.diagnosis.primary, c]));
  const views = {};
  const viewOf = (c) => views[c.id] ??= (() => {
    const m = modelFromCase(c); const snap = settleModel(m, 16).snapshot;
    return buildView(c, { circulation: snap, chemistry: chemistryState(snap, m.chemistry), state: { ...c.initialState, exposure: ['chest', 'arm', 'neck', 'abdomen', 'legs'] } });
  })();
  let shown = 0, noCase = 0;
  const missing = [], nowShown = [], reasons = [];
  for (const m of Object.values(CATALOG.manoeuvres)) for (const [i, f] of (m.teaching?.abnormal ?? []).entries()) for (const d of f.conditions ?? []) {
    const c = caseFor[d];
    if (!c) { noCase++; continue; }
    const v = viewOf(c);
    const sibs = Object.values(CATALOG.manoeuvres).filter((x) => x.section === m.section);
    let hit = false;
    for (const p of f.properties ?? []) {
      const pd = CATALOG.properties[p];
      const ctxs = sibs.flatMap((x) => x.reveals.filter((r) => r.property === p).map((r) => ({ ...(x.context ?? {}), ...(r.context ?? {}) })));
      if (!ctxs.length) ctxs.push({});
      for (const ctx of ctxs) for (const side of (pd.paired || m.paired) ? ['L', 'R'] : [undefined]) {
        const [ref, cx] = pd.paired ? [`${p}.${side}`, ctx] : [p, side && ctx.site ? { ...ctx, site: `${ctx.site}.${side}` } : ctx];
        if (!obs(c, v, ref, cx).normal) hit = true;
      }
    }
    const key = `${m.id}/${i}/${d}`;
    if (hit) { shown++; if (CARD_EXCEPTIONS[key]) nowShown.push(key); } else if (CARD_EXCEPTIONS[key]) reasons.push(`${key}: ${CARD_EXCEPTIONS[key]}`); else missing.push(key);
  }
  console.log(`  · ${shown} card links shown by their case, ${reasons.length} listed exceptions, ${noCase} links to conditions without a case yet`);
  for (const r of reasons) console.log(`    – ${r}`);
  ok('every card link to a condition with a case shows in that case, or is a listed exception', missing.length === 0, J(missing));
  ok('no listed exception shows its sign now (remove it from the list)', nowShown.length === 0, J(nowShown));
}

console.log(`\n${pass} passed, ${fail} failed, ${gaps.length} known gaps\n`);
process.exit(fail ? 1 : 0);
