import { NODES, PATHWAYS, MODALITY_GROUP, MOTOR_UNITS } from '../data/anatomy.js';

/* ---------------------------------------------------------------------------
   The localiser.

   Given a lesion — a node, and how complete it is — walk every pathway that
   passes through it and work out what the examiner would find.

   Two facts decide everything:

     1. Position relative to the UMN/LMN handover. Above it, the anterior horn
        cell survives and its reflex arc runs unopposed: spasticity, brisk
        reflexes, an upgoing toe. Below it, the final common path is gone:
        flaccid, areflexic, wasted, fasciculating.

     2. Position relative to the decussation. The pathway already knows where it
        crosses, so the side of the deficit falls out of the node chain without
        anyone having to write down "lateral medullary syndrome causes
        contralateral pain loss". It emerges.

   This is deliberately derivation rather than lookup. A student who moves the
   lesion one node caudal should see the picture change for a reason.
--------------------------------------------------------------------------- */

const MOTOR_MODALITIES = new Set(['motor', 'cranial_motor', 'reflex', 'peripheral_motor']);

/* ---------------------------------------------------------------------------
   Where on the ladder does this lesion sit?

   The four peripheral rungs each have a signature, and telling them apart is
   most of peripheral neurology. The level of the lesioned node decides which
   description applies — the same weak muscle means something different
   depending on where along its final common path the fault lies.
--------------------------------------------------------------------------- */
export const LADDER = {
  cortex: 'central', ic: 'central', thalamus: 'central', midbrain: 'central',
  pons: 'central', medulla: 'central', brainstem: 'central', cerebellum: 'central',
  parietal: 'central', chiasm: 'central', eye: 'central', orbit: 'central',
  hypothalamus: 'central',
  cord_C: 'cord', cord_T: 'cord', cord_L: 'cord', cord_S: 'cord',
  peripheral: 'root', plexus: 'plexus', nerve: 'nerve', nmj: 'nmj', muscle: 'muscle',
};

export const RUNG_LABEL = {
  central: 'Central', cord: 'Spinal cord', root: 'Root', plexus: 'Plexus',
  nerve: 'Peripheral nerve', nmj: 'Neuromuscular junction', muscle: 'Muscle',
};

export function rungOf(nodeId) {
  const n = NODES[nodeId];
  if (!n) return null;
  if (n.level === 'peripheral' && /_ahn_|_drg_|_nerve_/.test(nodeId)) return 'root';
  if (/_ahn_/.test(nodeId)) return 'root';
  return LADDER[n.level] || 'central';
}

function deficitText(modality, umnOrLmn, complete, bodyRegion, rung) {
  const c = complete;
  if (modality === 'peripheral_motor') {
    switch (rung) {
      case 'nmj':
        return c
          ? 'Weak and — the point — fatigable. Power is near normal on the first effort and fades '
            + 'with repetition, recovering after rest. Bulk is preserved, reflexes are present, and '
            + 'there is no sensory loss at all.'
          : 'Mildly weak with definite fatigability on sustained effort. Reflexes present, no wasting, no sensory signs.';
      case 'muscle':
        return c
          ? 'Weak, symmetric and proximal. No wasting early, no fasciculation, no sensory loss, and '
            + 'reflexes are preserved until the weakness is severe. Difficulty rising from a chair '
            + 'and combing hair rather than tripping or dropping things.'
          : 'Mild proximal weakness. Reflexes preserved, sensation normal.';
      case 'nerve':
        return c
          ? 'Power 0-1/5 in this nerve\'s muscles only, with wasting and no reflex. Neighbouring '
            + 'muscles from the same root but a different nerve are normal — that dissociation is '
            + 'the whole diagnosis.'
          : 'Weak in this nerve\'s distribution, other muscles of the same myotome spared.';
      case 'plexus':
        return c
          ? 'Weakness crossing several peripheral nerves but confined to one limb, with sensory loss '
            + 'that does not fit any single nerve or any single dermatome.'
          : 'Patchy weakness across more than one nerve territory in this limb.';
      case 'root':
        return c
          ? 'Weak in this myotome, with the corresponding reflex lost. Muscles sharing the myotome '
            + 'but supplied by different nerves are weak together — which is what separates this '
            + 'from a nerve lesion.'
          : 'Mild myotomal weakness with a depressed reflex.';
      default:
        return c ? 'Power 0/5, flaccid, areflexic.' : 'Weak, tone reduced.';
    }
  }
  if (modality === 'cutaneous') {
    if (rung === 'root') {
      return c
        ? 'Sensory loss in a dermatomal band, extending well beyond the territory of any one nerve.'
        : 'Reduced sensation in a dermatomal band; often paraesthesiae rather than loss.';
    }
    return c
      ? 'Sensory loss with a sharp edge exactly matching this nerve\'s cutaneous territory, and '
        + 'normal sensation immediately beyond it.'
      : 'Reduced pinprick and light touch in this nerve\'s territory.';
  }
  switch (modality) {
    case 'motor':
      return umnOrLmn === 'UMN'
        ? (c ? 'Power 0/5 (plegic). Tone spastic, clasp-knife. Reflexes 3+ with clonus. Babinski upgoing.'
             : 'Power 3/5 (paretic). Tone mildly increased. Reflexes 3+. Babinski upgoing.')
        : (c ? 'Power 0/5 (plegic). Tone flaccid. Reflexes absent. Fasciculations, muscle wasting.'
             : 'Power 2/5 (weak). Tone reduced. Reflexes 1+. Fasciculations may be present.');
    case 'cranial_motor':
      if (bodyRegion && bodyRegion.includes('face')) {
        return umnOrLmn === 'LMN'
          ? (c ? 'Complete LMN palsy — forehead involved, cannot raise eyebrow. Mouth droops, eye will not close.'
               : 'Partial LMN palsy — weak eye closure, asymmetric smile.')
          : (c ? 'UMN pattern — forehead SPARED (bilateral cortical input). Lower face droops.'
               : 'Mild UMN facial weakness — subtle flattening of the nasolabial fold.');
      }
      return umnOrLmn === 'LMN'
        ? (c ? 'Complete LMN palsy of this nerve — flaccid, wasted, no voluntary activation.'
             : 'Partial LMN palsy — weak, fatigable.')
        : (c ? 'UMN weakness with preserved bulk and brisk reflexes where testable.'
             : 'Mild UMN weakness.');
    case 'pain_temp':
      return c ? 'Pinprick absent. Temperature absent. Light touch may be preserved (dual pathway).'
               : 'Pinprick diminished. Temperature diminished.';
    case 'proprioception':
      return c ? 'Joint position sense absent. Vibration (128 Hz) absent. Romberg positive. Sensory ataxia.'
               : 'Joint position sense impaired at the toes. Vibration reduced distally.';
    case 'face_sensation':
      return c ? 'Pinprick absent. Light touch absent. Corneal reflex absent if V1 involved.'
               : 'Pinprick diminished. Light touch diminished.';
    case 'vision':
      return c ? 'Visual field absent in this quadrant — no perception of light or movement.'
               : 'Visual field partially reduced — detects movement but not detail.';
    case 'hearing':
      return c ? 'Hearing absent. Weber lateralises to the opposite ear. Rinne normal — sensorineural pattern.'
               : 'Hearing reduced. Struggles with whispered voice at 60 cm.';
    case 'vestibular':
      return c ? 'Nystagmus with fast phase away from the lesion. Head impulse: corrective saccade. Falls toward the lesion.'
               : 'Mild positional nystagmus. Slight unsteadiness.';
    case 'pupil_afferent':
      return 'RAPD (Marcus Gunn) — on the swinging flashlight test the affected pupil dilates when the light reaches it.';
    case 'pupil_efferent':
      return c ? 'Pupil 6 mm, fixed and dilated. No direct or consensual response. Ptosis. Eye down and out if CN III is complete.'
               : 'Pupil 5 mm, sluggishly reactive. Partial ptosis.';
    case 'sympathetic':
      return "Miosis (2 mm vs 4 mm), partial ptosis from Müller's muscle, anhidrosis if first or second order. Apparent enophthalmos.";
    case 'cerebellar':
      return bodyRegion === 'gait_balance'
        ? (c ? 'Wide-based gait, truncal ataxia, cannot tandem walk. Falls with eyes open and closed.'
             : 'Mildly unsteady gait, difficulty with tandem walking.')
        : (c ? 'Severe dysmetria with intention tremor. Dysdiadochokinesia. Past-pointing. Hypotonia.'
             : 'Mild dysmetria on finger-to-nose. Slight dysdiadochokinesia.');
    case 'language':
      return c ? 'Marked aphasia in this component.' : 'Mild anomia and hesitancy.';
    case 'autonomic':
      return c ? 'Urinary retention with overflow, then reflex bladder. Loss of voluntary control.'
               : 'Urinary urgency and incomplete emptying.';
    case 'reflex':
      return umnOrLmn === 'LMN'
        ? (c ? 'Reflex absent — the arc is interrupted.' : 'Reflex diminished.')
        : 'Reflex brisk (3+), spread to adjacent segments, clonus may be present.';
    default:
      return 'Function impaired along this pathway.';
  }
}

const SIDE_RE = /^([LR])_/;

/* ---------------------------------------------------------------------------
   Redundancy.

   Some targets are served by more than one pathway. The upper face is the
   important one: it receives corticobulbar fibres from *both* hemispheres, so
   losing one leaves it working. A model that treats every pathway
   independently reports a weak forehead after a capsular stroke, which is
   precisely backwards — forehead sparing is how you recognise that stroke.

   So a deficit is only declared when *every* pathway serving a target is
   interrupted. A partial hit is sparing, not weakness — with one exception,
   below.
--------------------------------------------------------------------------- */
const SERVED_BY = new Map();
const PARALLEL_TARGET = new Set();
for (const pw of PATHWAYS) {
  const key = `${pw.bodyRegion}|${pw.modality}`;
  SERVED_BY.set(key, (SERVED_BY.get(key) || 0) + 1);
  if (pw.parallel) PARALLEL_TARGET.add(key);
}

/* The exception: a partly-interrupted afferent pupillary limb does not abolish
   the light response, because the efferent side is shared. It produces a
   relative defect — which is the finding, and the reason it is called one. */
const PARTIAL_IS_A_FINDING = new Set(['pupil_afferent']);

function collapse(raw) {
  const byTarget = new Map();
  for (const f of raw) {
    const key = `${f.bodyRegion}|${f.modality}`;
    if (!byTarget.has(key)) byTarget.set(key, []);
    byTarget.get(key).push(f);
  }
  const findings = [], spared = [];
  for (const [key, group] of byTarget) {
    const total = SERVED_BY.get(key) || group.length;
    const hit = new Set(group.map((f) => f.pathwayId)).size;
    /* Only declared-parallel targets are protected by redundancy. Pathways that
       merely share a body region — the cortex-pons-cerebellum-thalamus loop, for
       instance — are serial, and interrupting any segment is a deficit. */
    const complete = !PARALLEL_TARGET.has(key) || hit >= total;
    const f = { ...group[0], pathwaysHit: hit, pathwaysTotal: total, redundant: total > 1 };
    if (complete || PARTIAL_IS_A_FINDING.has(f.modality)) {
      findings.push(f);
    } else {
      spared.push({ ...f, reason: `${hit} of ${total} pathways interrupted — the remainder still supplies it` });
    }
  }
  return { findings, spared };
}

export function findingsFor(lesion) {
  if (!lesion || !lesion.nodeId || !NODES[lesion.nodeId]) return [];
  const complete = lesion.complete !== false;
  const out = [];

  for (const pw of PATHWAYS) {
    const idx = pw.nodes.indexOf(lesion.nodeId);
    if (idx < 0) continue;

    const lmnIdx = pw.lmnFrom ? pw.nodes.indexOf(pw.lmnFrom) : -1;
    let umnOrLmn = 'N/A';
    if (MOTOR_MODALITIES.has(pw.modality) && lmnIdx >= 0) {
      umnOrLmn = idx < lmnIdx ? 'UMN' : 'LMN';
    }

    const m = SIDE_RE.exec(pw.bodyRegion || '');
    out.push({
      pathwayId: pw.id,
      pathway: pw.name,
      modality: pw.modality,
      group: MODALITY_GROUP[pw.modality] || 'other',
      bodyRegion: pw.bodyRegion,
      side: m ? m[1] : 'B',
      umnOrLmn,
      testMethod: pw.testMethod,
      deficit: deficitText(pw.modality, umnOrLmn, complete, pw.bodyRegion, rungOf(lesion.nodeId)),
      rung: rungOf(lesion.nodeId),
      meta: pw.meta,
      position: idx,
      length: pw.nodes.length,
    });
  }
  return collapse(out).findings;
}

/* Raw, uncollapsed hits — the collapse step needs these from several nodes at
   once, so compound lesions must not collapse each node separately. */
function rawFindings(lesion) {
  if (!lesion || !lesion.nodeId || !NODES[lesion.nodeId]) return [];
  const complete = lesion.complete !== false;
  const out = [];
  for (const pw of PATHWAYS) {
    const idx = pw.nodes.indexOf(lesion.nodeId);
    if (idx < 0) continue;
    const lmnIdx = pw.lmnFrom ? pw.nodes.indexOf(pw.lmnFrom) : -1;
    let umnOrLmn = 'N/A';
    if (MOTOR_MODALITIES.has(pw.modality) && lmnIdx >= 0) umnOrLmn = idx < lmnIdx ? 'UMN' : 'LMN';
    const m = SIDE_RE.exec(pw.bodyRegion || '');
    out.push({
      pathwayId: pw.id, pathway: pw.name, modality: pw.modality,
      group: MODALITY_GROUP[pw.modality] || 'other',
      bodyRegion: pw.bodyRegion, side: m ? m[1] : 'B', umnOrLmn,
      testMethod: pw.testMethod,
      deficit: deficitText(pw.modality, umnOrLmn, complete, pw.bodyRegion, rungOf(lesion.nodeId)),
      rung: rungOf(lesion.nodeId),
      meta: pw.meta,
      position: idx, length: pw.nodes.length,
    });
  }
  return out;
}

/* Group findings the way an exam is written up, not the way the data is stored. */
export const EXAM_SECTIONS = [
  { id: 'motor', label: 'Motor', match: (f) => ['motor', 'cranial_motor', 'peripheral_motor'].includes(f.modality) },
  { id: 'reflex', label: 'Reflexes', match: (f) => f.modality === 'reflex' },
  { id: 'sensory', label: 'Sensory', match: (f) => ['pain_temp', 'proprioception', 'face_sensation', 'cutaneous'].includes(f.modality) },
  { id: 'eyes', label: 'Eyes & vision', match: (f) => ['vision', 'pupil_afferent', 'pupil_efferent', 'sympathetic'].includes(f.modality) },
  { id: 'coord', label: 'Coordination', match: (f) => f.modality === 'cerebellar' },
  { id: 'other', label: 'Other', match: () => true },
];

export function groupFindings(findings) {
  const groups = EXAM_SECTIONS.map((s) => ({ ...s, items: [] }));
  for (const f of findings) {
    const g = groups.find((x) => x.match(f));
    g.items.push(f);
  }
  return groups.filter((g) => g.items.length);
}

/* ---------------------------------------------------------------------------
   Syndrome recognition.

   A named syndrome is a lesion of a *territory*, not of a single tract, so
   these are defined as node sets. Selecting one places a compound lesion; the
   findings are still derived, not written down.
--------------------------------------------------------------------------- */
export const SYNDROMES = [
  {
    id: 'wallenberg',
    name: 'Lateral medullary (Wallenberg)',
    vessel: 'PICA / vertebral artery',
    nodes: (s) => [`${s}_cn5_sens`, `${s}_lat_bs`, `${s}_icp`, `${s}_cn9_nuc`, `${s}_cn10_nuc`, `${s}_stt_asc`],
    sided: true,
    pearl: 'Crossed sensory loss is the signature: pain and temperature lost on the *face* on the '
         + 'side of the lesion, and on the *body* on the other side. The face fibres have not yet '
         + 'descended and crossed; the body fibres crossed long ago in the cord.',
  },
  {
    id: 'medial-medullary',
    name: 'Medial medullary (Déjerine)',
    vessel: 'Anterior spinal artery',
    nodes: (s) => [`${s}_med_pyr`, `${s}_dc_nuc`, `${s}_cn12_nuc`],
    sided: true,
    pearl: 'The classic alternating picture — tongue deviates toward the lesion (ipsilateral LMN '
         + 'CN XII), while the arm and leg are weak on the other side because the pyramid has not '
         + 'yet decussated.',
  },
  {
    id: 'weber',
    name: 'Medial midbrain (Weber)',
    vessel: 'Posterior cerebral artery perforators',
    nodes: (s) => [`${s}_peduncle`, `${s}_cn3_nuc`, `${s}_cn3`],
    sided: true,
    pearl: 'Ipsilateral third nerve palsy with contralateral hemiparesis. The nerve is caught as it '
         + 'passes through the peduncle it will later be paralysing the opposite side from.',
  },
  {
    id: 'brown-sequard',
    name: 'Cord hemisection (Brown-Séquard)',
    vessel: 'Trauma / compression',
    /* Ipsilateral descending motor and dorsal column, plus the *already
       crossed* spinothalamic fibres ascending on this side — which is why the
       pain loss appears on the other half of the body. */
    nodes: (s) => [`${s}_cst_L2`, `${s}_cst_L3`, `${s}_cst_L4`, `${s}_cst_L5`, `${s}_cst_S1`,
      `${s}_dc_asc`, `${s}_stt_asc`],
    sided: true,
    pearl: 'The dissociation students are asked about forever: motor and proprioception lost on the '
         + 'same side as the lesion, pain and temperature on the opposite side, because the '
         + 'spinothalamic tract crossed within a segment or two of entering.',
  },
  {
    id: 'central-cord',
    name: 'Central cord',
    vessel: 'Hyperextension / syrinx',
    nodes: () => ['L_stt_cross_C7', 'R_stt_cross_C7', 'L_stt_cross_C8', 'R_stt_cross_C8'],
    sided: false,
    pearl: 'The crossing fibres run right through the middle of the cord, so a central lesion takes '
         + 'out pain and temperature in a cape distribution over the shoulders while leaving the '
         + 'dorsal columns and the legs untouched.',
  },
  {
    id: 'anterior-cord',
    name: 'Anterior cord',
    vessel: 'Anterior spinal artery',
    nodes: () => ['L_cst_L2', 'L_cst_L3', 'L_cst_L4', 'L_cst_L5', 'L_cst_S1',
      'R_cst_L2', 'R_cst_L3', 'R_cst_L4', 'R_cst_L5', 'R_cst_S1', 'L_stt_asc', 'R_stt_asc'],
    sided: false,
    pearl: 'Everything in front of the dorsal columns fails: paralysis and loss of pain and '
         + 'temperature below the level, with vibration and joint position sense eerily intact.',
  },
  {
    id: 'chiasm',
    name: 'Chiasmal compression',
    vessel: 'Pituitary adenoma',
    nodes: () => ['chiasm'],
    sided: false,
    pearl: 'Only the nasal retinal fibres cross, and they carry the temporal fields — so pressure '
         + 'from below the chiasm produces bitemporal hemianopia, the field defect that respects '
         + 'the vertical meridian.',
  },
  {
    id: 'ulnar-elbow',
    name: 'Ulnar neuropathy at the elbow',
    vessel: 'Compression in the cubital tunnel',
    nodes: (s) => [`${s}_n_ulnar_elbow`],
    sided: true,
    pearl: 'Weak finger abduction with wasting of the first dorsal interosseous, and sensory loss '
         + 'over the little finger — but the thenar muscles, which share C8 and T1, are normal. '
         + 'Same roots, different nerve: that dissociation is the diagnosis.',
  },
  {
    id: 'peroneal-palsy',
    name: 'Peroneal palsy at the fibular head',
    vessel: 'Compression against the fibular neck',
    nodes: (s) => [`${s}_n_peroneal_head`],
    sided: true,
    pearl: 'Foot drop with weak eversion and numb dorsum of foot. Ask for *inversion*: tibialis '
         + 'posterior shares L5 but travels in the tibial nerve, so it is weak in an L5 '
         + 'radiculopathy and strong here. One muscle separates the two.',
  },
  {
    id: 'upper-trunk',
    name: 'Upper brachial plexus (Erb)',
    vessel: 'Traction on the shoulder',
    nodes: (s) => [`${s}_bp_upper`],
    sided: true,
    pearl: 'Weakness crossing the axillary, musculocutaneous and radial nerves but confined to one '
         + 'arm. No single nerve and no single root explains all of it — which is what puts the '
         + 'lesion in the plexus.',
  },
  {
    id: 'myasthenia',
    name: 'Myasthenia gravis (postsynaptic)',
    vessel: 'Antibodies against the acetylcholine receptor',
    nodes: () => ['L_nmj_post', 'R_nmj_post'],
    sided: false,
    pearl: 'Fatigable weakness with ocular and bulbar predilection, entirely normal sensation, and '
         + 'preserved reflexes. Nothing is wasted and nothing is numb; the abnormality is that the '
         + 'power runs out.',
  },
  {
    id: 'myopathy',
    name: 'Inflammatory myopathy',
    vessel: 'Muscle inflammation',
    nodes: () => ['L_muscle_prox', 'R_muscle_prox'],
    sided: false,
    pearl: 'Symmetric proximal weakness — rising from a chair, washing hair — with normal sensation '
         + 'and preserved reflexes. Distribution alone separates it from a neuropathy, which is '
         + 'distal, and from the junction, which fatigues.',
  },
  {
    id: 'mca-left',
    name: 'Left MCA territory',
    vessel: 'Middle cerebral artery',
    nodes: () => ['L_mcx_face', 'L_mcx_arm', 'L_ic', 'L_broca', 'L_wernicke'],
    sided: false,
    pearl: 'Face and arm worse than leg — the leg area sits over the midline on the ACA side. In '
         + 'the dominant hemisphere the aphasia is usually what the family noticed first.',
  },
];

export function syndromeNodes(syn, side = 'L') {
  return syn.nodes(side);
}

export function findingsForNodes(nodeIds, complete = true) {
  const seen = new Set();
  const all = [];
  for (const id of nodeIds) {
    for (const f of rawFindings({ nodeId: id, complete })) {
      if (seen.has(f.pathwayId)) continue;
      seen.add(f.pathwayId);
      all.push(f);
    }
  }
  return collapse(all).findings;
}

/* What the lesion touched but did not disable — the teaching half of the
   forehead-sparing story. */
export function sparedForNodes(nodeIds, complete = true) {
  const seen = new Set();
  const all = [];
  for (const id of nodeIds) {
    for (const f of rawFindings({ nodeId: id, complete })) {
      if (seen.has(f.pathwayId)) continue;
      seen.add(f.pathwayId);
      all.push(f);
    }
  }
  return collapse(all).spared;
}

/* The highest cord segment involved — cardio needs this for neurogenic shock. */
export function cordLevelOf(nodeIds) {
  const ORDER = ['C1','C2','C3','C4','C5','C6','C7','C8','T1','T2','T3','T4','T5','T6',
    'T7','T8','T9','T10','T11','T12','L1','L2','L3','L4','L5','S1','S2','S3','S4'];
  let best = null, bestRank = Infinity;
  for (const id of nodeIds) {
    const n = NODES[id];
    if (!n || !n.level.startsWith('cord_')) continue;
    const m = /_(C\d|T\d{1,2}|L\d|S\d)(?:$|_)/.exec(id) || /(C\d|T\d{1,2}|L\d|S\d)/.exec(id);
    if (!m) continue;
    const r = ORDER.indexOf(m[1]);
    if (r >= 0 && r < bestRank) { bestRank = r; best = m[1]; }
  }
  return best;
}

/* ===========================================================================
   TEMPO

   Where the lesion is and how fast it got there are two different questions,
   and the examination only answers the first. A left hemiparesis that arrived
   in ninety seconds is a stroke; the same hemiparesis over six weeks is a
   tumour; over six months with remissions, demyelination. The findings are
   identical. Nothing in an examination distinguishes them and no amount of
   localisation will, which is why a model that stops at localisation teaches
   half the skill.

   So tempo is a separate axis here, and the differential is a function of both.
=========================================================================== */

export const TEMPOS = [
  { id: 'hyperacute', label: 'Seconds to minutes', short: 'hyperacute',
    note: 'Maximal at onset. Vascular until proven otherwise — either something '
        + 'occluded or something bled. Seizure and migraine aura also start fast, but they spread '
        + 'and evolve over minutes rather than being complete immediately.' },
  { id: 'acute', label: 'Hours to a day', short: 'acute',
    note: 'Fast enough to be vascular, inflammatory or infective. Fever, headache and a '
        + 'depressed conscious level move infection up the list sharply.' },
  { id: 'subacute', label: 'Days to weeks', short: 'subacute',
    note: 'Too slow for a stroke and too fast for a degeneration. Inflammatory, infiltrative, '
        + 'infective or compressive.' },
  { id: 'chronic', label: 'Months to years', short: 'chronic',
    note: 'Compressive, degenerative, metabolic or hereditary. A long history changes what is '
        + 'worth investigating far more than any refinement of the examination will.' },
  { id: 'relapsing', label: 'Episodes with recovery', short: 'relapsing',
    note: 'Separated in time as well as in place. Demyelination is the classic, but so are '
        + 'periodic paralyses, and so is anything vascular that keeps happening.' },
  { id: 'fluctuating', label: 'Varies within the day', short: 'fluctuating',
    note: 'Worse with use and better with rest points at the neuromuscular junction. Worse in '
        + 'the morning and better with use points the other way, at the presynaptic terminal.' },
];

/* Causes worth naming, keyed by where and how fast. Deliberately short — the
   point is that the pair narrows the list, not that the list is exhaustive. */
const DIFFERENTIAL = {
  central: {
    hyperacute: ['Ischaemic stroke', 'Intracerebral haemorrhage'],
    acute: ['Stroke with evolving oedema', 'Encephalitis', 'Hypoglycaemia'],
    subacute: ['Abscess', 'Demyelinating plaque', 'Subdural haematoma'],
    chronic: ['Tumour', 'Neurodegeneration', 'Chronic subdural'],
    relapsing: ['Multiple sclerosis', 'Recurrent emboli', 'Migraine with aura'],
    fluctuating: ['Seizure activity', 'Metabolic encephalopathy'],
  },
  cord: {
    hyperacute: ['Spinal cord infarction', 'Trauma'],
    acute: ['Cord compression from haemorrhage or abscess', 'Transverse myelitis'],
    subacute: ['Metastatic cord compression', 'Transverse myelitis', 'B12 deficiency'],
    chronic: ['Cervical spondylotic myelopathy', 'Syringomyelia', 'Meningioma'],
    relapsing: ['Multiple sclerosis', 'Neuromyelitis optica'],
    fluctuating: ['Positional cord compression'],
  },
  root: {
    hyperacute: ['Traumatic root avulsion'],
    acute: ['Acute disc prolapse', 'Herpes zoster radiculitis'],
    subacute: ['Disc prolapse', 'Malignant infiltration', 'Lyme radiculitis'],
    chronic: ['Foraminal stenosis', 'Spondylosis'],
    relapsing: ['Recurrent disc prolapse'],
    fluctuating: ['Positional radiculopathy'],
  },
  plexus: {
    hyperacute: ['Traction injury', 'Haematoma'],
    acute: ['Neuralgic amyotrophy (severe pain then weakness)'],
    subacute: ['Neuralgic amyotrophy', 'Radiation plexopathy', 'Malignant infiltration'],
    chronic: ['Tumour infiltration', 'Thoracic outlet syndrome', 'Radiation fibrosis'],
    relapsing: ['Hereditary neuralgic amyotrophy'],
    fluctuating: ['Positional thoracic outlet compression'],
  },
  nerve: {
    hyperacute: ['Laceration', 'Acute compartment syndrome'],
    acute: ['Compression palsy', 'Vasculitic mononeuritis'],
    subacute: ['Entrapment', 'Mononeuritis multiplex', 'Leprosy'],
    chronic: ['Entrapment neuropathy', 'Hereditary neuropathy'],
    relapsing: ['CIDP', 'Hereditary liability to pressure palsy'],
    fluctuating: ['Positional entrapment — carpal tunnel at night'],
  },
  nmj: {
    hyperacute: ['Botulism', 'Organophosphate poisoning'],
    acute: ['Myasthenic crisis', 'Botulism', 'Drug-induced blockade'],
    subacute: ['Myasthenia gravis', 'Lambert-Eaton syndrome'],
    chronic: ['Congenital myasthenic syndrome'],
    relapsing: ['Myasthenia gravis'],
    fluctuating: ['Myasthenia gravis — the fluctuation is the diagnosis'],
  },
  muscle: {
    hyperacute: ['Rhabdomyolysis'],
    acute: ['Rhabdomyolysis', 'Acute necrotising myopathy'],
    subacute: ['Inflammatory myositis', 'Statin myopathy', 'Thyroid myopathy'],
    chronic: ['Muscular dystrophy', 'Metabolic myopathy'],
    relapsing: ['Periodic paralysis', 'Metabolic myopathy on exertion'],
    fluctuating: ['Periodic paralysis'],
  },
};

export function differentialFor(rung, tempoId) {
  const byRung = DIFFERENTIAL[rung] || DIFFERENTIAL.central;
  return byRung[tempoId] || [];
}

export function tempoById(id) { return TEMPOS.find((t) => t.id === id) || TEMPOS[0]; }

/* The dominant rung of a compound lesion, for choosing a differential. */
export function rungForNodes(nodeIds) {
  const counts = {};
  for (const id of nodeIds) {
    const r = rungOf(id);
    if (r) counts[r] = (counts[r] || 0) + 1;
  }
  let best = null, n = 0;
  for (const [k, v] of Object.entries(counts)) if (v > n) { n = v; best = k; }
  return best || 'central';
}
