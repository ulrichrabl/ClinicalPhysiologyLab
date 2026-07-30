/* Cases for the neuro domain. The question is always the same one the wards
   ask — *where* — because a lesion's location is what the examination actually
   measures. Aetiology comes afterwards and from the history. */

export const CASE_SETS = [
  {
    id: 'peripheral',
    name: 'Root, nerve, junction or muscle',
    cases: [
      {
        id: 'ulnar',
        vignette: 'A 44-year-old carpenter has clumsy fingers and wasting between the thumb and '
          + 'index metacarpals on the left. Finger abduction is 2/5. Thumb abduction is 5/5 with '
          + 'normal thenar bulk. Sensation is reduced over the little finger and the medial palm.',
        prompt: 'Where is the lesion?',
        lesion: { syndrome: 'ulnar-elbow', side: 'L' },
        options: [
          { id: 'a', key: 'A', label: 'Left ulnar nerve' },
          { id: 'b', key: 'B', label: 'Left C8 root' },
          { id: 'c', key: 'C', label: 'Left lower brachial plexus' },
          { id: 'd', key: 'D', label: 'Left anterior horn at C8' },
        ],
        answer: 'a',
        diagnosis: 'Left ulnar neuropathy, most likely at the elbow',
        findings: [
          'First dorsal interosseous weak and wasted — ulnar',
          'Abductor pollicis brevis normal — median, but the same C8/T1 roots',
          'Sensory loss confined to the ulnar cutaneous territory',
        ],
        teaching: 'The two thumb and finger movements share their roots and differ only in their '
          + 'nerve. Weak in one and strong in the other puts the lesion below the point where the '
          + 'nerves separate — so a nerve, not a root or a plexus. Testing a single muscle proves '
          + 'nothing; testing the right *pair* proves the level.',
        pitfall: 'A C8 root lesion would weaken both, and would also give sensory loss extending up '
          + 'the medial forearm, beyond any single nerve.',
      },
      {
        id: 'footdrop',
        vignette: 'A 61-year-old developed a right foot drop after a long illness in bed. '
          + 'Dorsiflexion 1/5, eversion 1/5, inversion 5/5, plantarflexion 5/5. Ankle jerk present. '
          + 'Sensation reduced over the dorsum of the foot only.',
        prompt: 'Where is the lesion?',
        lesion: { syndrome: 'peroneal-palsy', side: 'R' },
        options: [
          { id: 'a', key: 'A', label: 'Right common peroneal nerve at the fibular head' },
          { id: 'b', key: 'B', label: 'Right L5 root' },
          { id: 'c', key: 'C', label: 'Right sciatic nerve' },
          { id: 'd', key: 'D', label: 'Right anterior horn cells' },
        ],
        answer: 'a',
        diagnosis: 'Right common peroneal palsy at the fibular head — a compression neuropathy',
        findings: [
          'Dorsiflexion and eversion weak: both peroneal',
          'Inversion strong: tibialis posterior shares L5 but runs in the tibial nerve',
          'Ankle jerk preserved and sensation limited to the peroneal territory',
        ],
        teaching: 'Foot drop is the commonest question in peripheral neurology and inversion is the '
          + 'answer to it. Tibialis posterior is the L5 muscle that is not peroneal, so it is weak '
          + 'in a radiculopathy and strong in a peroneal palsy. One muscle, two diagnoses.',
        pitfall: 'The nerve is superficial at the fibular neck and is compressed by bed rest, plaster '
          + 'casts and crossed legs. Weight loss makes it far more likely.',
      },
      {
        id: 'mg',
        vignette: 'A 32-year-old has drooping eyelids that are fine in the morning and unbearable by '
          + 'evening, and double vision when reading. After 60 seconds of upgaze the lids fall '
          + 'further. Voice becomes nasal while counting to 50. Reflexes are normal and sensation '
          + 'is entirely normal. There is no wasting.',
        prompt: 'Where is the lesion?',
        lesion: { syndrome: 'myasthenia', side: 'L' },
        options: [
          { id: 'a', key: 'A', label: 'Neuromuscular junction' },
          { id: 'b', key: 'B', label: 'Muscle' },
          { id: 'c', key: 'C', label: 'Brainstem' },
          { id: 'd', key: 'D', label: 'Multiple cranial nerves' },
        ],
        answer: 'a',
        diagnosis: 'Myasthenia gravis — postsynaptic acetylcholine receptor antibodies',
        findings: [
          'Fatigable ptosis and diplopia with ocular and bulbar predilection',
          'Completely normal sensation — no junction disorder can cause sensory loss',
          'Reflexes preserved and no wasting',
          'Fluctuation within a single day is the diagnostic feature',
        ],
        teaching: 'Two facts localise this without any test. There is no sensory loss, which excludes '
          + 'nerve and root; and the weakness varies within the day, which nothing structural does. '
          + 'Set the time course to "varies within the day" and the differential collapses to one '
          + 'answer.',
        pitfall: 'A third nerve palsy is the trap — but it does not fatigue, and it does not spare '
          + 'the pupil while also weakening the voice.',
      },
      {
        id: 'myopathy',
        vignette: 'A 58-year-old has struggled for two months to rise from a chair or wash her hair. '
          + 'She has no numbness and no tingling. Hip flexion and shoulder abduction are 3/5; grip '
          + 'and foot movements are 5/5. Reflexes are normal. Creatine kinase is markedly raised.',
        prompt: 'Where is the lesion?',
        lesion: { syndrome: 'myopathy', side: 'L' },
        options: [
          { id: 'a', key: 'A', label: 'Muscle' },
          { id: 'b', key: 'B', label: 'Neuromuscular junction' },
          { id: 'c', key: 'C', label: 'Peripheral nerve' },
          { id: 'd', key: 'D', label: 'Anterior horn cell' },
        ],
        answer: 'a',
        diagnosis: 'Inflammatory myopathy',
        findings: [
          'Symmetric and proximal — the opposite of a length-dependent neuropathy',
          'No sensory symptoms or signs at all',
          'Reflexes preserved, which excludes significant denervation',
          'Subacute over weeks: inflammatory rather than dystrophic',
        ],
        teaching: 'Distribution alone separates the last three rungs. Muscle disease is proximal and '
          + 'symmetric; neuropathy is distal and length-dependent; junction disease fatigues and '
          + 'takes the eyes and the voice. None of them causes sensory loss except neuropathy — so '
          + 'the sensory examination does most of the work.',
        pitfall: 'Ask about statins, alcohol, steroids and thyroid before reaching for a biopsy. The '
          + 'commonest myopathies are the ones somebody prescribed.',
      },
    ],
  },
  {
    id: 'crossed',
    name: 'Crossed findings',
    cases: [
      {
        id: 'wallenberg',
        vignette: 'A 58-year-old smoker develops sudden vertigo, hoarseness and hiccups. '
          + 'Pinprick is dulled over the right side of the face and over the left arm and leg. '
          + 'The right pupil is small with a slightly droopy lid. Power is normal everywhere.',
        prompt: 'Where is the lesion?',
        lesion: { syndrome: 'wallenberg', side: 'R' },
        options: [
          { id: 'a', key: 'A', label: 'Right lateral medulla' },
          { id: 'b', key: 'B', label: 'Left lateral medulla' },
          { id: 'c', key: 'C', label: 'Right internal capsule' },
          { id: 'd', key: 'D', label: 'Right pontine base' },
        ],
        answer: 'a',
        diagnosis: 'Right lateral medullary (Wallenberg) syndrome — PICA territory',
        findings: [
          'Face pain/temp lost on the right — the descending trigeminal tract has not crossed yet',
          'Body pain/temp lost on the left — the spinothalamic tract crossed in the cord',
          'Right Horner — the descending sympathetic fibres run in the lateral tegmentum',
          'Hoarseness and reduced gag — nucleus ambiguus (IX, X) on the right',
        ],
        teaching: 'Normal power is the clue that stops you calling this a hemispheric stroke. '
          + 'The pyramid sits medially; a lateral medullary lesion misses it entirely. What it does '
          + 'catch is everything lateral — trigeminal, spinothalamic, sympathetic, ambiguus, and the '
          + 'inferior cerebellar peduncle.',
        pitfall: 'Sensory loss on opposite sides of face and body is almost pathognomonic for a '
          + 'lateral brainstem lesion. Nothing above the pons can do it.',
      },
      {
        id: 'dejerine',
        vignette: 'Sudden right-sided weakness of the arm and leg. The face is spared. '
          + 'The tongue deviates to the left on protrusion and looks wasted on that side. '
          + 'Vibration sense is reduced in the right foot.',
        prompt: 'Where is the lesion?',
        lesion: { syndrome: 'medial-medullary', side: 'L' },
        options: [
          { id: 'a', key: 'A', label: 'Left medial medulla' },
          { id: 'b', key: 'B', label: 'Right medial medulla' },
          { id: 'c', key: 'C', label: 'Left internal capsule' },
          { id: 'd', key: 'D', label: 'Left lateral medulla' },
        ],
        answer: 'a',
        diagnosis: 'Left medial medullary (Déjerine) syndrome',
        findings: [
          'Right hemiparesis sparing the face — pyramid, above the decussation',
          'Tongue deviates left with wasting — left CN XII, a lower motor neuron',
          'Right dorsal column loss — left nucleus gracilis/cuneatus, before the medial lemniscus crosses',
        ],
        teaching: 'Three medial structures, three findings: pyramid, medial lemniscus, hypoglossal '
          + 'nucleus. The tongue tells you the side of the lesion because it is the only LMN in the '
          + 'picture — a lower motor neuron always points at itself.',
        pitfall: 'A capsular stroke would take the face too. Facial sparing pushes the lesion below '
          + 'the pons, where the corticobulbar fibres to VII have already left.',
      },
      {
        id: 'weber',
        vignette: 'A 71-year-old wakes with a left-sided droopy eyelid, a dilated unreactive left '
          + 'pupil and the left eye resting down and out. The right arm and leg are weak with brisk '
          + 'reflexes and an upgoing toe.',
        prompt: 'Where is the lesion?',
        lesion: { syndrome: 'weber', side: 'L' },
        options: [
          { id: 'a', key: 'A', label: 'Left medial midbrain' },
          { id: 'b', key: 'B', label: 'Right medial midbrain' },
          { id: 'c', key: 'C', label: 'Left cavernous sinus' },
          { id: 'd', key: 'D', label: 'Left internal capsule' },
        ],
        answer: 'a',
        diagnosis: 'Left medial midbrain (Weber) syndrome',
        findings: [
          'Left CN III palsy with a blown pupil — the nerve as it crosses the peduncle',
          'Right UMN hemiparesis — the peduncle carries fibres that have not yet decussated',
        ],
        teaching: 'The rule that saves you in the brainstem: the cranial nerve localises the level '
          + 'and the side, the long tracts tell you it is a brainstem lesion at all. A third nerve '
          + 'palsy puts you in the midbrain; contralateral weakness puts you in the peduncle.',
        pitfall: 'An isolated painful third nerve palsy with a dilated pupil and no long-tract signs '
          + 'is a compressive lesion — think posterior communicating aneurysm, not stroke.',
      },
    ],
  },
  {
    id: 'face',
    name: 'The facial nerve problem',
    cases: [
      {
        id: 'bells',
        vignette: 'A 34-year-old cannot close the right eye and cannot raise the right eyebrow. '
          + 'The right side of the mouth droops. Taste is altered on the front of the tongue. '
          + 'Limb power is normal.',
        prompt: 'Where is the lesion?',
        lesion: { nodes: ['R_cn7'] },
        options: [
          { id: 'a', key: 'A', label: 'Right facial nerve (peripheral)' },
          { id: 'b', key: 'B', label: 'Left motor cortex, face area' },
          { id: 'c', key: 'C', label: 'Right internal capsule' },
          { id: 'd', key: 'D', label: 'Left pontine corticobulbar fibres' },
        ],
        answer: 'a',
        diagnosis: 'Right lower motor neuron facial palsy — Bell’s palsy',
        findings: [
          'Forehead involved — the giveaway for an LMN lesion',
          'Incomplete eye closure with risk of exposure keratopathy',
          'Altered taste — chorda tympani, so the lesion is at or above that branch point',
        ],
        teaching: 'The upper face receives corticobulbar input from *both* hemispheres; the lower '
          + 'face only from the opposite one. So a lesion anywhere above the nucleus spares the '
          + 'forehead, and a lesion at or below the nucleus does not. That single asymmetry is the '
          + 'most useful fact in cranial nerve examination.',
        pitfall: 'Never reassure a facial palsy without checking eye closure. A cornea that cannot '
          + 'be covered is the actual emergency.',
      },
      {
        id: 'umn-face',
        vignette: 'A 66-year-old hypertensive has a drooping right corner of the mouth and cannot '
          + 'show teeth on the right, but raises both eyebrows symmetrically and closes both eyes '
          + 'fully. The right arm is weak with a brisk biceps jerk.',
        prompt: 'Where is the lesion?',
        lesion: { nodes: ['L_ic'] },
        options: [
          { id: 'a', key: 'A', label: 'Left internal capsule' },
          { id: 'b', key: 'B', label: 'Right facial nerve' },
          { id: 'c', key: 'C', label: 'Right internal capsule' },
          { id: 'd', key: 'D', label: 'Left facial nucleus in the pons' },
        ],
        answer: 'a',
        diagnosis: 'Left capsular lesion — UMN (central) facial weakness',
        findings: [
          'Forehead spared, lower face weak — bilateral input above, crossed input below',
          'Ipsilateral-to-face limb weakness on the same right side',
          'Brisk reflexes confirm the lesion is above the anterior horn',
        ],
        teaching: 'Compare this with the previous case. Same drooping mouth, entirely different '
          + 'lesion — and the only reliable discriminator at the bedside is the forehead.',
        pitfall: 'A pontine lesion at the facial nucleus produces an *LMN* facial palsy with '
          + 'contralateral limb weakness. Forehead involvement does not exclude a brainstem stroke; '
          + 'it just tells you where in the brainstem.',
      },
    ],
  },
  {
    id: 'cord',
    name: 'Spinal cord patterns',
    cases: [
      {
        id: 'bs',
        vignette: 'After a stab wound to the back, a young man has weakness of the left leg with '
          + 'brisk reflexes, loss of vibration and joint position sense in the left leg, and loss of '
          + 'pinprick and temperature in the right leg.',
        prompt: 'Where is the lesion?',
        lesion: { syndrome: 'brown-sequard', side: 'L' },
        options: [
          { id: 'a', key: 'A', label: 'Left hemicord' },
          { id: 'b', key: 'B', label: 'Right hemicord' },
          { id: 'c', key: 'C', label: 'Central cord' },
          { id: 'd', key: 'D', label: 'Anterior cord' },
        ],
        answer: 'a',
        diagnosis: 'Left cord hemisection — Brown-Séquard',
        findings: [
          'Left leg: UMN weakness (lateral corticospinal, already crossed in the medulla)',
          'Left leg: vibration and position loss (dorsal column, crosses later in the medulla)',
          'Right leg: pain and temperature loss (spinothalamic, crossed on entering the cord)',
        ],
        teaching: 'Two sensory systems, two crossing points, and the whole picture follows. Anything '
          + 'that crosses in the cord shows up contralaterally; anything that crosses in the medulla '
          + 'shows up ipsilaterally when the cord is damaged.',
        pitfall: 'The dissociation is what matters, not the completeness. Partial hemicord lesions '
          + 'from compression give the same pattern in miniature.',
      },
      {
        id: 'central',
        vignette: 'A 40-year-old describes a burning band across both shoulders and upper arms, with '
          + 'burns on the fingertips she did not feel happen. Vibration and joint position sense are '
          + 'normal. Legs are normal.',
        prompt: 'Where is the lesion?',
        lesion: { syndrome: 'central-cord', side: 'L' },
        options: [
          { id: 'a', key: 'A', label: 'Central cervical cord' },
          { id: 'b', key: 'B', label: 'Bilateral dorsal columns' },
          { id: 'c', key: 'C', label: 'Bilateral peripheral neuropathy' },
          { id: 'd', key: 'D', label: 'Anterior spinal artery territory' },
        ],
        answer: 'a',
        diagnosis: 'Central cervical cord lesion — syringomyelia',
        findings: [
          'Cape-like bilateral loss of pain and temperature at C7–C8',
          'Dorsal columns spared — vibration and position intact',
          'Painless burns: the classic presentation of dissociated sensory loss',
        ],
        teaching: 'The spinothalamic fibres cross right through the centre of the cord, so a cavity '
          + 'expanding from the middle picks them off segment by segment while the dorsal columns, '
          + 'sitting posteriorly, are untouched until much later.',
        pitfall: 'Dissociated sensory loss in a suspended, non-dermatomal distribution is a cord '
          + 'sign, not a nerve sign. A peripheral neuropathy would be distal and symmetric.',
      },
      {
        id: 'neurogenic',
        vignette: 'A 24-year-old is brought in after a diving accident with no movement below the '
          + 'shoulders. Blood pressure is 76/44 and the heart rate is 48. The skin is warm and dry. '
          + 'There is no external blood loss.',
        prompt: 'Why is he hypotensive?',
        lesion: { nodes: ['L_cst_C5', 'R_cst_C5', 'L_ahn_C5', 'R_ahn_C5'] },
        options: [
          { id: 'a', key: 'A', label: 'Neurogenic shock from loss of sympathetic outflow' },
          { id: 'b', key: 'B', label: 'Occult haemorrhage' },
          { id: 'c', key: 'C', label: 'Cardiogenic shock from myocardial contusion' },
          { id: 'd', key: 'D', label: 'Tension pneumothorax' },
        ],
        answer: 'a',
        diagnosis: 'Neurogenic shock — high cervical cord injury',
        findings: [
          'Hypotension with bradycardia — sympathetic outflow to vessels and heart is disconnected',
          'Warm, dry, well-perfused skin — no compensatory vasoconstriction is possible',
          'Cardiac accelerator fibres leave the cord at T1–T4, below the lesion',
        ],
        teaching: 'This is the case that will not resolve inside one specialty. Haemorrhagic shock '
          + 'gives you a fast, thready pulse and cold clamped peripheries because the sympathetic '
          + 'system is intact and working hard. Cut that system out of the loop and the same low '
          + 'pressure comes with a slow pulse and warm skin. Open the cardiovascular workspace with '
          + 'this lesion in place and you can watch the pressure-volume loop change.',
        pitfall: 'Assuming bradycardia excludes shock. Here it is the diagnostic feature. But you '
          + 'still have to exclude bleeding — a trauma patient is allowed two problems.',
      },
    ],
  },
  {
    id: 'visual',
    name: 'Visual fields and pupils',
    cases: [
      {
        id: 'chiasm',
        vignette: 'A 46-year-old keeps bumping into door frames on both sides. Confrontation testing '
          + 'shows loss of both temporal fields. Acuity and pupils are normal. She has noticed her '
          + 'wedding ring no longer fits.',
        prompt: 'Where is the lesion?',
        lesion: { syndrome: 'chiasm', side: 'L' },
        options: [
          { id: 'a', key: 'A', label: 'Optic chiasm' },
          { id: 'b', key: 'B', label: 'Left optic nerve' },
          { id: 'c', key: 'C', label: 'Right occipital cortex' },
          { id: 'd', key: 'D', label: 'Both optic radiations' },
        ],
        answer: 'a',
        diagnosis: 'Chiasmal compression — pituitary macroadenoma',
        findings: [
          'Bitemporal hemianopia respecting the vertical meridian',
          'Only nasal retinal fibres cross, and they carry the temporal fields',
          'Ring no longer fitting suggests acromegaly — a secreting adenoma',
        ],
        teaching: 'The chiasm is the one place in the nervous system where a single midline lesion '
          + 'produces a bilateral deficit that is nonetheless not symmetric in origin — it takes the '
          + 'crossing fibres from both eyes.',
        pitfall: 'A field defect that respects the vertical meridian is retrochiasmal or chiasmal. '
          + 'One that respects the horizontal meridian is retinal or vascular.',
      },
      {
        id: 'rapd',
        vignette: 'A 28-year-old had painful loss of vision in the left eye a week ago, now partly '
          + 'recovered. On the swinging flashlight test, both pupils constrict when the light is on '
          + 'the right eye, but the left pupil dilates when the light swings to it.',
        prompt: 'Where is the lesion?',
        lesion: { nodes: ['L_cn2'] },
        options: [
          { id: 'a', key: 'A', label: 'Left optic nerve — afferent defect' },
          { id: 'b', key: 'B', label: 'Left oculomotor nerve — efferent defect' },
          { id: 'c', key: 'C', label: 'Left Edinger-Westphal nucleus' },
          { id: 'd', key: 'D', label: 'Left sympathetic chain' },
        ],
        answer: 'a',
        diagnosis: 'Left relative afferent pupillary defect — optic neuritis',
        findings: [
          'Both pupils respond normally to light in the good eye — the efferent limb is intact',
          'Less light signal gets in through the affected nerve, so the pupils redilate',
          'Painful monocular loss in a young adult: think demyelination',
        ],
        teaching: 'An afferent defect never gives you anisocoria at rest — both pupils always match, '
          + 'because the efferent signal is shared. If the pupils are unequal in ambient light, the '
          + 'problem is efferent or sympathetic instead.',
        pitfall: 'Do not call this a third nerve palsy. There is no ptosis, no ophthalmoplegia, and '
          + 'the pupil constricts perfectly well when the *other* eye is lit.',
      },
    ],
  },
];

export const LESSONS = [
  {
    id: 'ladder',
    title: 'The last four rungs',
    blurb: 'Root, plexus, nerve, junction, muscle — and the single test that separates each pair.',
    setup: { syndrome: 'ulnar-elbow', side: 'L', filter: 'motor' },
    steps: [
      { kind: 'say', eyebrow: 'Nerve', text:
        'A left ulnar neuropathy at the elbow. Look at the findings: the first dorsal interosseous '
        + 'is weak and wasted, and the abductor pollicis brevis is normal. Both are C8 and T1 '
        + 'muscles. They differ only in which nerve carries them.' },
      { kind: 'predict', text:
        'Now move the lesion up to the C8 anterior horn — the root rather than the nerve. '
        + 'What happens to thumb abduction?',
        options: [
          { id: 'a', label: 'Still normal — it is a median muscle', correct: false,
            why: 'The median nerve is spared, but the root that feeds it is not. Above the point '
               + 'where the nerves separate, everything sharing the root goes together.' },
          { id: 'b', label: 'Now weak as well, because it shares the root', correct: true,
            why: 'That is the whole test. Two muscles with the same roots and different nerves are '
               + 'weak together in a root lesion and dissociate in a nerve lesion. Pick the pair '
               + 'deliberately and one examination answers the question.' },
        ],
        then: { nodes: ['L_ahn_C8'], complete: true },
        after: 'Sensory loss follows the same logic: dermatomal for a root, and sharply confined to '
             + 'one nerve\'s territory for a nerve.' },
      { kind: 'do', eyebrow: 'Plexus', text:
        'The upper trunk of the brachial plexus. Weakness now crosses the axillary, '
        + 'musculocutaneous and radial nerves, but stays in one arm — a pattern no single nerve and '
        + 'no single root can produce.',
        settings: { syndrome: 'upper-trunk', side: 'L' }, cta: 'Now the junction →' },
      { kind: 'predict', text:
        'Next, the neuromuscular junction. Before you look — what happens to the *sensory* '
        + 'examination?',
        options: [
          { id: 'a', label: 'Sensory loss in the weak muscles', correct: false,
            why: 'The junction is purely motor. There is no sensory apparatus there to damage.' },
          { id: 'b', label: 'Completely normal sensation', correct: true,
            why: 'This is the most useful single fact about junction and muscle disease. Weakness '
               + 'with entirely normal sensation puts the lesion at the junction, in the muscle, or '
               + 'in the anterior horn — and nowhere else.' },
        ],
        then: { syndrome: 'myasthenia', side: 'L', filter: 'all' },
        after: 'Note the ocular and bulbar predilection, the preserved reflexes, and that the '
             + 'weakness is fatigable rather than fixed.' },
      { kind: 'do', eyebrow: 'Muscle', text:
        'Finally the muscle itself: symmetric, proximal, no sensory loss, reflexes preserved. '
        + 'Junction disease fatigues and takes the eyes; muscle disease does neither.',
        settings: { syndrome: 'myopathy', side: 'L' }, cta: 'What to take away' },
      { kind: 'recap', points: [
        'Root: myotome and dermatome, reflex lost, muscles of different nerves weak together.',
        'Plexus: several nerves, one limb, sensory loss fitting neither nerve nor dermatome.',
        'Nerve: that nerve only — the dissociation from its neighbours is the diagnosis.',
        'Junction: fatigable, ocular and bulbar, reflexes and sensation normal.',
        'Muscle: proximal, symmetric, sensation normal, reflexes preserved until late.',
      ] },
    ],
  },
  {
    id: 'tempo',
    title: 'Where is only half the question',
    blurb: 'Identical findings, four different diseases. Only the history separates them.',
    setup: { nodes: ['L_ic'], complete: true, tempo: 'hyperacute' },
    steps: [
      { kind: 'say', eyebrow: 'One lesion', text:
        'A left internal capsule lesion: right hemiparesis with facial involvement, brisk reflexes, '
        + 'an upgoing toe. Look at the time course panel — set to seconds-to-minutes, the '
        + 'differential is stroke or haemorrhage.' },
      { kind: 'predict', text:
        'The examination findings do not change at all. The history changes: the weakness came on '
        + 'over eight weeks and is still progressing. What should you do with the differential?',
        options: [
          { id: 'a', label: 'Nothing — the localisation is what matters', correct: false,
            why: 'Localisation tells you where to image. It tells you almost nothing about what you '
               + 'will find there, and nothing at all about how urgently.' },
          { id: 'b', label: 'Replace it — this is now a mass lesion until proven otherwise', correct: true,
            why: 'Identical signs, an entirely different list. Nothing vascular progresses over eight '
               + 'weeks. Set the tempo to days-to-weeks and read the panel: tumour, abscess, '
               + 'demyelination, subdural.' },
        ],
        then: { nodes: ['L_ic'], complete: true, tempo: 'subacute' },
        after: 'This is why the history is taken before the examination and not after it. The exam '
             + 'localises; only the history dates.' },
      { kind: 'do', eyebrow: 'The tempo that is itself a diagnosis', text:
        'Now a junction lesion with a fluctuating course. Some tempos are diagnostic on their own: '
        + 'weakness that is fine in the morning and gone by evening is myasthenia, and no imaging '
        + 'will show it.',
        settings: { syndrome: 'myasthenia', side: 'L', tempo: 'fluctuating' },
        cta: 'What to take away' },
      { kind: 'recap', points: [
        'Localisation and tempo are independent axes; the differential needs both.',
        'Hyperacute is vascular. Subacute is inflammatory, infiltrative or compressive. Chronic is degenerative or hereditary.',
        'Relapsing means separated in time — the second half of the multiple sclerosis definition.',
        'Fluctuating within a day points at the neuromuscular junction and nowhere else.',
      ] },
    ],
  },
  {
    id: 'forehead',
    title: 'Why the forehead is spared',
    blurb: 'The single asymmetry that separates a stroke from a Bell’s palsy.',
    setup: { nodes: ['R_cn7'], complete: true, filter: 'cranial' },
    steps: [
      { kind: 'say', eyebrow: 'Setup', text:
        'The lesion is on the right facial nerve, distal to the nucleus — a peripheral palsy. '
        + 'Look at the findings panel: both the upper and the lower face on the right are weak.' },
      { kind: 'predict', text:
        'Now move the lesion up into the corticobulbar fibres, in the left internal capsule. '
        + 'What happens to the upper face?',
        options: [
          { id: 'a', label: 'Upper face becomes weak on the left instead', correct: false,
            why: 'The pathway does cross, but that is not what happens to the forehead. '
               + 'The upper face has a second, uncrossed source of input.' },
          { id: 'b', label: 'Upper face is spared; only the lower face is weak', correct: true,
            why: 'The upper facial nucleus receives corticobulbar fibres from both hemispheres. '
               + 'Losing one leaves the other, so the forehead still works. The lower face is '
               + 'supplied only by the crossed pathway and has no backup.' },
          { id: 'c', label: 'Both upper and lower face stay normal', correct: false,
            why: 'The lower face depends entirely on crossed input from one hemisphere, so it '
               + 'does become weak.' },
        ],
        then: { nodes: ['L_ic'], complete: true },
        after: 'Three pathways in the model reach the right facial nucleus: one from the left cortex '
             + 'to the lower face, and one from *each* cortex to the upper face. Lesioning the left '
             + 'capsule hits two of the three, and the surviving right-cortex pathway keeps the '
             + 'forehead going.' },
      { kind: 'recap', points: [
        'LMN facial palsy involves the forehead; UMN facial weakness spares it.',
        'The reason is redundancy, not crossing — the upper face has bilateral cortical input.',
        'A pontine lesion at the nucleus itself gives an LMN pattern with crossed limb signs.',
      ] },
    ],
  },
  {
    id: 'two-systems',
    title: 'Two sensory systems, two crossings',
    blurb: 'Build Brown-Séquard from first principles instead of memorising it.',
    setup: { nodes: ['L_dc_asc'], complete: true, filter: 'sensory' },
    steps: [
      { kind: 'say', eyebrow: 'Dorsal column', text:
        'This lesion sits in the left dorsal column in the thoracic cord. The findings show loss of '
        + 'vibration and joint position sense on the left — the same side. These fibres ascend '
        + 'without crossing and only decussate in the medulla, above the lesion.' },
      { kind: 'predict', text:
        'Move to the left anterolateral (spinothalamic) tract at the same level. '
        + 'Which side loses pinprick?',
        options: [
          { id: 'a', label: 'The left — same side as the lesion', correct: false,
            why: 'These fibres crossed within a segment or two of entering the cord, so the ones '
               + 'ascending on the left originally came from the right.' },
          { id: 'b', label: 'The right — the opposite side', correct: true,
            why: 'Pain and temperature fibres synapse and cross almost immediately on entering the '
               + 'cord. By the time they are ascending in the left anterolateral tract they carry '
               + 'information from the right side of the body.' },
          { id: 'c', label: 'Both sides equally', correct: false,
            why: 'The crossing is complete, not partial — one tract carries one side.' },
        ],
        then: { nodes: ['L_stt_asc'], complete: true },
        after: 'Now put the two together: one hemicord lesion, ipsilateral position sense loss, '
             + 'contralateral pain loss. That is Brown-Séquard, and you have just derived it.' },
      { kind: 'do', eyebrow: 'The whole syndrome', text:
        'Here is the full left hemisection — motor, dorsal column and spinothalamic together.',
        settings: { syndrome: 'brown-sequard', side: 'L', filter: 'all' },
        cta: 'Look at the findings →' },
      { kind: 'recap', points: [
        'Spinothalamic crosses in the cord; dorsal column crosses in the medulla.',
        'A cord lesion therefore splits the two modalities to opposite sides.',
        'Motor follows the dorsal column side, because the corticospinal tract crossed in the medulla too.',
      ] },
    ],
  },
  {
    id: 'brainstem-rule',
    title: 'The brainstem rule',
    blurb: 'Cranial nerves give the level; long tracts give the side.',
    setup: { syndrome: 'weber', side: 'L', filter: 'all' },
    steps: [
      { kind: 'say', eyebrow: 'Midbrain', text:
        'A left medial midbrain lesion. The findings show a left third nerve palsy and right-sided '
        + 'weakness. The cranial nerve is ipsilateral because it has already left the brainstem; the '
        + 'limb weakness is contralateral because the pyramid has not yet decussated.' },
      { kind: 'predict', text:
        'Move the lesion down to the left medial medulla. The pyramid is still there, so the limbs '
        + 'stay weak on the right. Which cranial nerve replaces the third?',
        options: [
          { id: 'a', label: 'CN VII — facial', correct: false,
            why: 'The facial nucleus is pontine. Below the pons its fibres have already left.' },
          { id: 'b', label: 'CN XII — hypoglossal', correct: true,
            why: 'The hypoglossal nucleus is the medial medullary cranial nerve. The tongue deviates '
               + 'toward the weak side, pointing at the lesion, because it is a lower motor neuron.' },
          { id: 'c', label: 'CN VI — abducens', correct: false,
            why: 'Abducens is pontine, sitting at the pontomedullary junction — one level up.' },
        ],
        then: { syndrome: 'medial-medullary', side: 'L' },
        after: 'Three medial structures at every brainstem level: the motor pathway, the medial '
             + 'lemniscus, and the motor cranial nerve of that level. Learn the nerve and you have '
             + 'the level.' },
      { kind: 'recap', points: [
        'Midbrain → III. Pons → VI, VII. Medulla → XII (medial) and IX, X (lateral).',
        'Ipsilateral cranial nerve plus contralateral limbs means brainstem, every time.',
        'Medial lesions take the pyramid and medial lemniscus; lateral lesions take spinothalamic, trigeminal and sympathetic.',
      ] },
    ],
  },
  {
    id: 'cross-domain',
    title: 'A cord lesion is a cardiac problem',
    blurb: 'Where neurology stops being neurology.',
    setup: { nodes: ['L_ahn_L3'], complete: true, filter: 'motor' },
    steps: [
      { kind: 'say', eyebrow: 'Start low', text:
        'A lesion at the left L3 anterior horn — an isolated lower motor neuron problem. Weak knee '
        + 'extension, absent patellar reflex, no reflexes elsewhere. The patient is haemodynamically '
        + 'completely normal; check the vitals strip.' },
      { kind: 'predict', text:
        'Now move the lesion to the cervical cord at C5, bilaterally. Besides quadriparesis, '
        + 'what happens to the blood pressure and heart rate?',
        options: [
          { id: 'a', label: 'Nothing — the cord does not control the circulation', correct: false,
            why: 'It does. Every sympathetic preganglionic neuron in the body leaves the cord '
               + 'between T1 and L2, and they are driven from the brainstem through the cord.' },
          { id: 'b', label: 'Hypotension with tachycardia, as in any shock', correct: false,
            why: 'That is the pattern when the sympathetic system is intact and compensating. '
               + 'Here it has been disconnected, so it cannot.' },
          { id: 'c', label: 'Hypotension with bradycardia', correct: true,
            why: 'The lesion is above T1, so both the vasoconstrictor outflow and the cardiac '
               + 'accelerator fibres are cut off from the brainstem. Resistance falls and the heart '
               + 'is left under unopposed vagal control.' },
        ],
        then: { nodes: ['L_cst_C5', 'R_cst_C5', 'L_ahn_C5', 'R_ahn_C5'], complete: true },
        after: 'The vitals strip at the top of the screen belongs to the whole patient, not to one '
             + 'workspace. Switch to Circulation and the pressure-volume loop has changed shape: '
             + 'lower afterload, slower rate. Nothing in the cardiac model was touched directly — '
             + 'the coupling did it.' },
      { kind: 'recap', points: [
        'Sympathetic outflow leaves the cord T1–L2; cardiac accelerators at T1–T4.',
        'A lesion above T6 gives hypotension with a slow pulse and warm skin.',
        'Haemorrhagic shock looks the opposite: fast, thready, cold. The pulse is the discriminator.',
        'This is why the framework shares one patient across domains rather than one per specialty.',
      ] },
    ],
  },
];
