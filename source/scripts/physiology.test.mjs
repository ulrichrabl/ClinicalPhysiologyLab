/* Regression tests for the two model engines. These encode facts about the
   nervous system and the circulation, so a refactor that quietly breaks the
   physiology fails here rather than in front of a student. */
import { findingsForNodes, sparedForNodes, SYNDROMES, cordLevelOf,
  rungOf, rungForNodes, differentialFor, TEMPOS } from '../src/domains/neuro/model/localize.js';
import { BODY_REGIONS } from '../src/domains/neuro/data/exam.js';
import { NODES, PATHWAYS } from '../src/domains/neuro/data/anatomy.js';

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
};
const syn = (id, side) => SYNDROMES.find((s) => s.id === id).nodes(side);
const regions = (f) => new Set(f.map((x) => x.bodyRegion));
const sides = (f, mod) => new Set(f.filter((x) => x.modality === mod).map((x) => x.side));

console.log('\nAnatomy graph');
ok('321 nodes (261 central + 60 peripheral)', Object.keys(NODES).length === 321, String(Object.keys(NODES).length));
ok('192 pathways', PATHWAYS.length === 192, String(PATHWAYS.length));
ok('every pathway node exists', PATHWAYS.every((p) => p.nodes.every((n) => NODES[n])));
ok('every lmnFrom is on its own pathway',
  PATHWAYS.every((p) => !p.lmnFrom || p.nodes.includes(p.lmnFrom)));

console.log('\nFacial nerve — the forehead rule');
{
  const capsule = findingsForNodes(['L_ic']);
  const faces = [...regions(capsule)].filter((r) => /face/.test(r));
  ok('capsular lesion spares the forehead', !faces.includes('R_face_upper'), faces.join(','));
  ok('capsular lesion weakens the lower face', faces.includes('R_face_lower'));
  ok('sparing is reported, not silently dropped',
    sparedForNodes(['L_ic']).some((f) => f.bodyRegion === 'R_face_upper'));
  const bell = regions(findingsForNodes(['L_cn7']));
  ok('Bell palsy involves the forehead', bell.has('L_face_upper') && bell.has('L_face_lower'));
}

console.log('\nCrossed brainstem syndromes');
{
  const w = findingsForNodes(syn('wallenberg', 'L'));
  ok('Wallenberg: face pain/temp ipsilateral', sides(w, 'face_sensation').has('L'));
  ok('Wallenberg: body pain/temp contralateral', sides(w, 'pain_temp').has('R'));
  ok('Wallenberg: body pain/temp NOT ipsilateral', !sides(w, 'pain_temp').has('L'));
  ok('Wallenberg: ipsilateral Horner', regions(w).has('L_horner'));
  ok('Wallenberg: spares power', ![...regions(w)].some((r) => /_arm_|_leg_/.test(r)));

  const d = findingsForNodes(syn('medial-medullary', 'L'));
  ok('Déjerine: contralateral limb weakness', sides(d, 'motor').has('R'));
  ok('Déjerine: ipsilateral tongue', regions(d).has('L_tongue'));

  const we = findingsForNodes(syn('weber', 'L'));
  ok('Weber: ipsilateral CN III', regions(we).has('L_pupil_constrict'));
  ok('Weber: contralateral hemiparesis', sides(we, 'motor').has('R'));
}

console.log('\nCord syndromes');
{
  const bs = findingsForNodes(syn('brown-sequard', 'L'));
  ok('Brown-Séquard: ipsilateral weakness', sides(bs, 'motor').has('L') && !sides(bs, 'motor').has('R'));
  ok('Brown-Séquard: ipsilateral proprioception', sides(bs, 'proprioception').has('L'));
  ok('Brown-Séquard: contralateral pain/temp', sides(bs, 'pain_temp').has('R'));
  ok('Brown-Séquard: pain/temp NOT ipsilateral', !sides(bs, 'pain_temp').has('L'));

  const cc = findingsForNodes(syn('central-cord', 'L'));
  ok('Central cord: bilateral pain/temp', sides(cc, 'pain_temp').size === 2);
  ok('Central cord: dorsal columns spared', sides(cc, 'proprioception').size === 0);

  ok('cord level of a C5 lesion is C5', cordLevelOf(['L_ahn_C5', 'R_cst_L2']) === 'C5');
}

console.log('\nVisual pathway');
{
  const ch = findingsForNodes(syn('chiasm', 'L'));
  const r = [...regions(ch)];
  ok('chiasm gives bitemporal loss',
    r.includes('L_temporal_field') && r.includes('R_temporal_field'), r.join(','));
  const on = findingsForNodes(['L_cn2']);
  ok('optic nerve lesion gives an RAPD',
    on.some((f) => f.modality === 'pupil_afferent'));
}

console.log('\nExamination map');
{
  const ids = BODY_REGIONS.flatMap((r) => r.tests.map((t) => t.id));
  ok('test ids unique', new Set(ids).size === ids.length);
  ok('107 tests across 13 regions', ids.length === 107 && BODY_REGIONS.length === 13,
    `${ids.length}/${BODY_REGIONS.length}`);
  const f = findingsForNodes(syn('wallenberg', 'L'));
  const fired = BODY_REGIONS.flatMap((r) => r.tests.filter((t) => f.some((x) => {
    try { return t.match(x); } catch { return false; } })));
  ok('Wallenberg trips a plausible number of tests', fired.length >= 8 && fired.length <= 14,
    String(fired.length));
  ok('every finding is reachable by some test', findingsForNodes(['L_ic']).every((x) =>
    BODY_REGIONS.some((r) => r.tests.some((t) => { try { return t.match(x); } catch { return false; } }))));
}


console.log('\nThe peripheral ladder');
{
  const regionsOf = (f) => new Set(f.map((x) => x.bodyRegion));
  const motor = (f) => [...regionsOf(f)].filter((r) => /_muscle_/.test(r)).map((r) => r.replace(/^[LR]_muscle_/, ''));
  const sens = (f) => [...regionsOf(f)].filter((r) => /_skin_/.test(r));

  ok('rung of an anterior horn cell is root', rungOf('L_ahn_C8') === 'root', rungOf('L_ahn_C8'));
  ok('rung of a named nerve is nerve', rungOf('L_n_ulnar') === 'nerve');
  ok('rung of the postsynaptic membrane is nmj', rungOf('L_nmj_post') === 'nmj');
  ok('rung of muscle is muscle', rungOf('L_muscle_prox') === 'muscle');

  const ulnar = findingsForNodes(['L_n_ulnar_elbow']);
  const um = motor(ulnar);
  ok('ulnar palsy weakens the first dorsal interosseous', um.includes('first_dorsal_interosseous'));
  ok('...and spares abductor pollicis brevis, which shares its roots',
    !um.includes('abductor_pollicis_brevis'), um.join(','));

  const c8 = motor(findingsForNodes(['L_ahn_C8']));
  ok('a C8 root lesion weakens both, because they share the root',
    c8.includes('first_dorsal_interosseous') && c8.includes('abductor_pollicis_brevis'), c8.join(','));

  const per = motor(findingsForNodes(['L_n_peroneal_head']));
  ok('peroneal palsy weakens dorsiflexion and eversion',
    per.includes('tibialis_anterior') && per.includes('peroneus_longus'));
  ok('...and spares inversion — the discriminator from L5',
    !per.includes('tibialis_posterior'), per.join(','));
  const l5 = motor(findingsForNodes(['L_ahn_L5']));
  ok('an L5 root lesion does weaken inversion', l5.includes('tibialis_posterior'), l5.join(','));

  const plex = motor(findingsForNodes(['L_bp_upper']));
  ok('upper trunk crosses several nerves in one limb', plex.length >= 3, plex.join(','));

  const nmj = findingsForNodes(['L_nmj_post', 'R_nmj_post']);
  ok('junction disease has no sensory findings at all', sens(nmj).length === 0);
  ok('...reaches ocular and bulbar muscle', motor(nmj).includes('ocular') && motor(nmj).includes('bulbar'));
  ok('...and its deficit describes fatigability',
    nmj.some((f) => /fatigab/i.test(f.deficit)));

  const myo = findingsForNodes(['L_muscle_prox', 'R_muscle_prox']);
  ok('myopathy has no sensory findings', sens(myo).length === 0);
  ok('...is proximal, sparing distal muscles',
    !motor(myo).includes('first_dorsal_interosseous') && motor(myo).includes('iliopsoas'),
    motor(myo).join(','));
  ok('...and its deficit says reflexes are preserved',
    myo.some((f) => /reflexes are preserved/i.test(f.deficit)));
}

console.log('\nTempo');
{
  ok('six time courses', TEMPOS.length === 6);
  ok('hyperacute central disease is vascular',
    differentialFor('central', 'hyperacute').some((c) => /stroke|haemorrhage/i.test(c)));
  ok('subacute central disease is not vascular',
    !differentialFor('central', 'subacute').some((c) => /^Ischaemic stroke$/.test(c)),
    differentialFor('central', 'subacute').join(', '));
  ok('fluctuating junction disease names myasthenia',
    differentialFor('nmj', 'fluctuating').some((c) => /myasthenia/i.test(c)));
  ok('the same rung gives different lists at different tempos',
    differentialFor('nerve', 'hyperacute').join() !== differentialFor('nerve', 'chronic').join());
  ok('rungForNodes picks the dominant rung', rungForNodes(['L_n_ulnar_elbow']) === 'nerve');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
