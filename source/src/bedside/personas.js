/* ---------------------------------------------------------------------------
   Bedside patients.

   A patient is a person with a story plus a *physiological setup*. The story
   is authored; everything you examine is derived from the setup by the live
   model. So Mrs Hart's slow-rising pulse and soft S2 are not written anywhere:
   they fall out of a narrowed aortic valve.

   setup.params   circulation parameters, same vocabulary as lessons
   setup.neuro    lesioned nodes in the nervous-system graph
   history        answers keyed by question id; missing ones fall back to a
                  neutral negative for that question
   keyFindings    what a good examination should uncover, matched against the
                  keys the findings engine attaches to each finding
--------------------------------------------------------------------------- */

export const QUESTIONS = [
  { cat: 'Introduction', items: [
    { id: 'intro', q: 'Hello, I’m one of the doctors. Can I check your name?' },
    { id: 'consent', q: 'Is it all right if I examine you?' },
  ] },
  { cat: 'Presenting complaint', items: [
    { id: 'pc', q: 'What’s brought you in today?' },
    { id: 'onset', q: 'When did this start, and how did it come on?' },
    { id: 'pain', q: 'Do you have any pain at the moment?' },
    { id: 'better', q: 'Does anything make it better or worse?' },
  ] },
  { cat: 'Heart and lungs', items: [
    { id: 'chest', q: 'Any chest pain or tightness?' },
    { id: 'sob', q: 'Are you short of breath?' },
    { id: 'orthop', q: 'Can you lie flat? How many pillows do you use?' },
    { id: 'pnd', q: 'Do you ever wake at night gasping for breath?' },
    { id: 'palp', q: 'Any palpitations: your heart racing or thumping?' },
    { id: 'syncope', q: 'Have you fainted, or nearly fainted?' },
    { id: 'ankles', q: 'Any swelling of your ankles?' },
  ] },
  { cat: 'Nerves', items: [
    { id: 'weak', q: 'Any weakness in your arms or legs?' },
    { id: 'numb', q: 'Any numbness or pins and needles?' },
    { id: 'bladder', q: 'Any problems passing water?' },
  ] },
  { cat: 'Gut', items: [
    { id: 'vomit', q: 'Have you been sick? Was there any blood?' },
    { id: 'stool', q: 'Any change in your bowels, or black stools?' },
    { id: 'abdo', q: 'Any tummy pain?' },
  ] },
  { cat: 'Background', items: [
    { id: 'pmh', q: 'Do you have any medical problems?' },
    { id: 'meds', q: 'What medicines do you take?' },
    { id: 'allergy', q: 'Any allergies?' },
    { id: 'fhx', q: 'Does anything run in the family?' },
  ] },
  { cat: 'Social', items: [
    { id: 'smoke', q: 'Do you smoke?' },
    { id: 'alcohol', q: 'How much alcohol do you drink in a week?' },
    { id: 'work', q: 'What do you do for work, and who’s at home?' },
  ] },
  { cat: 'Their perspective', items: [
    { id: 'ideas', q: 'What do you think is going on?' },
    { id: 'concerns', q: 'Is there anything in particular worrying you?' },
  ] },
];

export const DEFAULT_ANSWERS = {
  consent: 'Yes, of course.',
  pain: 'No, no pain.', better: 'Not really.', chest: 'No, no chest pain.', sob: 'No, my breathing’s fine.',
  orthop: 'Yes, one pillow.', pnd: 'No.', palp: 'No.', syncope: 'No, never.', ankles: 'No.',
  weak: 'No.', numb: 'No.', bladder: 'No, that’s all fine.',
  vomit: 'No.', stool: 'No, all normal.', abdo: 'No.',
  pmh: 'Nothing, I’m pretty healthy.', meds: 'Nothing regularly.', allergy: 'None that I know of.',
  fhx: 'Not that I know of.', smoke: 'No.', alcohol: 'A couple of drinks at the weekend.',
  ideas: 'I really don’t know.', concerns: 'Just want to know what’s going on.',
};

const h = (a, key = null) => ({ a, key });

export const PERSONAS = [
  {
    id: 'volunteer',
    name: 'Alex Morgan', age: 29, sex: 'F', skin: 'tone-2', hair: 'short-dark',
    setting: 'Clinical skills room',
    triage: 'Healthy volunteer. Practise a complete, systematic examination and learn what normal sounds like.',
    practice: true,
    setup: { params: {} },
    history: {
      intro: h('Alex Morgan. I’m the volunteer for your practice session.'),
      pc: h('Nothing at all! I’m here so you can practise. Take your time.'),
      onset: h('There’s nothing wrong, honestly.'),
      work: h('I’m a physiotherapy student. I live with two friends.'),
      ideas: h('I think I’m completely normal. Let’s find out!'),
    },
    keyFindings: [
      { label: 'A full set of observations', keys: ['obs.hr', 'obs.bp', 'obs.rr'], all: true },
      { label: 'JVP assessed', keys: ['look.jvp'] },
      { label: 'Apex beat located', keys: ['feel.apex'] },
      { label: 'All four heart areas auscultated', keys: ['@listen.aortic', '@listen.pulmonary', '@listen.tricuspid', '@listen.mitral'], all: true },
      { label: 'Lung bases auscultated', keys: ['@listen.lungL', '@listen.lungR'] },
    ],
    diagnosis: null,
  },
  {
    id: 'as-syncope',
    name: 'Evelyn Hart', age: 78, sex: 'F', skin: 'tone-1', hair: 'grey-bun',
    setting: 'Acute medical unit',
    triage: 'Collapsed while walking uphill to church this morning. Now feels “back to normal”.',
    setup: { params: { Raortic: 0.35 } },
    history: {
      intro: h('Evelyn Hart. Mrs Hart, if you please.'),
      pc: h('I passed out, doctor. Walking up the hill to church. One minute I was fine, the next I was on the pavement with people standing over me.', 'hx.exertional-syncope'),
      onset: h('It happened this morning. But I’ve been getting tight in the chest on that hill for a few months now, and puffed out.', 'hx.exertional-angina'),
      pain: h('Not now. Only when I walk uphill, a tightness here.', 'hx.exertional-angina'),
      better: h('It goes off if I stop and rest for a minute or two.'),
      chest: h('Yes, a tightness across the front when I walk up hills. It goes when I stop.', 'hx.exertional-angina'),
      sob: h('On the hill, yes. I’ve slowed down a lot this year.', 'hx.exertional-dyspnoea'),
      syncope: h('This morning I did, properly, on the hill. I think I felt dizzy once before, climbing the stairs at my daughter’s.', 'hx.exertional-syncope'),
      palp: h('No, I didn’t feel any racing beforehand.'),
      pmh: h('Blood pressure, for years. And my cholesterol.'),
      meds: h('Amlodipine and a statin. Atorvastatin.'),
      smoke: h('Never.'),
      alcohol: h('A small sherry at Christmas.'),
      work: h('I was a primary school teacher. I live on my own since my husband died; my daughter is nearby.'),
      fhx: h('Not that I know of.'),
      ideas: h('I thought it was just old age. I should drink more water, probably.'),
      concerns: h('That I’ll have to stop going to church. And driving.'),
    },
    keyFindings: [
      { label: 'Exertional syncope and angina elicited', keys: ['hx.exertional-syncope', 'hx.exertional-angina'] },
      { label: 'Slow-rising, low-volume pulse', keys: ['feel.pulse.slowrising'] },
      { label: 'Heaving, sustained apex', keys: ['feel.apex.abnormal'] },
      { label: 'Ejection systolic murmur at the aortic area', keys: ['listen.heart.aortic'] },
      { label: 'Radiation to the carotids', keys: ['listen.carotid'] },
    ],
    diagnosis: {
      options: ['Severe aortic stenosis', 'Vasovagal syncope', 'Complete heart block', 'Hypertrophic cardiomyopathy'],
      answer: 0,
      teaching: 'The triad of exertional syncope, angina and breathlessness in an older adult, with a slow-rising pulse, a sustained apex, a soft single S2 and a late-peaking ejection systolic murmur radiating to the carotids, is severe aortic stenosis. Symptoms mark the turning point: untreated, prognosis falls sharply once they appear. A pulse of normal rate argues against complete heart block, and hypertrophic cardiomyopathy gives a jerky rather than slow-rising pulse. Echocardiography confirms the diagnosis, and the valve team decides between surgical and transcatheter replacement.',
    },
  },
  {
    id: 'hf',
    name: 'George Wills', age: 69, sex: 'M', skin: 'tone-3', hair: 'bald',
    setting: 'Emergency department',
    triage: 'Three weeks of worsening breathlessness. Sitting upright on the trolley.',
    setup: { params: { Emax: 1.2, EmaxRv: 0.45, bloodVolume: 5900, regMitral: 0.3, HR: 84 } },
    chronicCongestion: true,
    rrExtra: 2,
    history: {
      intro: h('George. George Wills.'),
      pc: h('Can’t get my breath, doc. Getting worse for three weeks. Can’t get up the stairs now without stopping twice.', 'hx.dyspnoea'),
      onset: h('Gradual. Three weeks, maybe a month. Worse the last few nights.'),
      sob: h('Even talking to you, a bit. Walking to the toilet is enough.', 'hx.dyspnoea'),
      orthop: h('I’ve been sleeping in the chair. Three pillows in bed wasn’t enough.', 'hx.orthopnoea'),
      pnd: h('Twice this week I woke up choking for air and had to open the window.', 'hx.pnd'),
      ankles: h('They’re like balloons. My socks leave a mark.', 'hx.oedema'),
      chest: h('No pain like my heart attack, no. Just the breathing.'),
      palp: h('Not really.'),
      pmh: h('Heart attack four years ago; they put a stent in. Diabetes, tablets only.', 'hx.prior-mi'),
      meds: h('Aspirin, ramipril, bisoprolol, metformin, atorvastatin. And furosemide, but I stopped it last month; I was up all night weeing.', 'hx.stopped-diuretic'),
      smoke: h('Gave up after the heart attack. Forty a day before that.'),
      alcohol: h('A few pints on a Friday.'),
      work: h('Retired builder. Me and the wife.'),
      ideas: h('The wife says it’s my heart again.'),
      concerns: h('That I’m going to drown in my sleep, honestly.'),
    },
    keyFindings: [
      { label: 'Orthopnoea and PND elicited', keys: ['hx.orthopnoea', 'hx.pnd'] },
      { label: 'Stopped diuretic identified', keys: ['hx.stopped-diuretic'] },
      { label: 'Raised JVP', keys: ['look.jvp.high'] },
      { label: 'Displaced, diffuse apex', keys: ['feel.apex.abnormal'] },
      { label: 'Pansystolic murmur or S3 at the apex', keys: ['listen.heart.mitral'] },
      { label: 'Bibasal crackles', keys: ['listen.crackles'] },
      { label: 'Peripheral oedema', keys: ['feel.oedema'] },
    ],
    diagnosis: {
      options: ['Decompensated heart failure with reduced ejection fraction', 'Exacerbation of COPD', 'Community-acquired pneumonia', 'Pulmonary embolism'],
      answer: 0,
      teaching: 'Orthopnoea, PND, a raised JVP, bibasal crackles, oedema and a displaced apex with a gallop and functional mitral regurgitation tell one story: a failing left ventricle, now fluid-overloaded after the diuretic was stopped. In the model, a weak ventricle (reduced Emax) and extra circulating volume raise left atrial pressure above 20 mmHg, which is where the crackles come from. Precipitants to look for include ischaemia, arrhythmia, infection, non-adherence and drugs.',
    },
  },
  {
    id: 'gi-bleed',
    name: 'Tom Reyes', age: 45, sex: 'M', skin: 'tone-4', hair: 'short-dark',
    setting: 'Emergency department, resuscitation bay',
    triage: 'Vomited blood three times this morning. Looks pale.',
    setup: { params: { bloodVolume: 3900 } },
    abdomen: { tender: 'mild epigastric tenderness, no guarding' },
    temp: 36.4,
    history: {
      intro: h('Tom Reyes.'),
      pc: h('I’ve been throwing up blood. Three times since six this morning. Proper red, and some like coffee grounds.', 'hx.haematemesis'),
      onset: h('This morning. My stomach’s been burning for a couple of weeks.'),
      vomit: h('Yeah. Blood, a lot of it the first time. Like a cupful.', 'hx.haematemesis'),
      stool: h('Went yesterday and it was black, like tar. Stank.', 'hx.melaena'),
      abdo: h('Burning, up here. Not terrible.'),
      syncope: h('I nearly went over when I stood up in the bathroom. Everything went grey.', 'hx.postural'),
      pain: h('Just the burning in the top of my stomach.'),
      pmh: h('Bad back. Nothing else.'),
      meds: h('Ibuprofen for the back. Quite a lot of it, to be honest. Maybe six a day.', 'hx.nsaid'),
      alcohol: h('Most nights. Probably a bottle of wine, some beers at the weekend.', 'hx.alcohol'),
      smoke: h('Ten a day.'),
      work: h('I’m a head chef. Long hours, on my feet. Live with my partner.'),
      ideas: h('Stomach ulcer? My dad had one.'),
      concerns: h('That I’m going to need an operation. And who’s running the kitchen tonight.'),
    },
    keyFindings: [
      { label: 'Haematemesis and melaena elicited', keys: ['hx.haematemesis', 'hx.melaena'] },
      { label: 'NSAID and alcohol use identified', keys: ['hx.nsaid', 'hx.alcohol'] },
      { label: 'Tachycardia and hypotension measured', keys: ['obs.hr', 'obs.bp'], all: true },
      { label: 'Cool peripheries with slow capillary refill', keys: ['feel.cool'] },
      { label: 'Thready pulse', keys: ['feel.pulse.thready'] },
      { label: 'Flat neck veins', keys: ['look.jvp.low', 'look.jvp'] },
    ],
    diagnosis: {
      options: ['Hypovolaemic shock from upper gastrointestinal bleeding', 'Septic shock', 'Cardiogenic shock', 'Neurogenic shock'],
      answer: 0,
      teaching: 'About a litre of blood lost. The baroreflex is working hard: heart rate up, skin vasoconstricted and cool, capillary refill slow, pulse pressure narrow. Pressure is still falling, and lactate is rising as perfusion fails. Flat neck veins say the tank is empty, which separates this from cardiogenic shock. NSAIDs and alcohol point to peptic ulcer disease. Management is resuscitation with blood, a risk score, and endoscopy once stable.',
    },
  },
  {
    id: 'c5',
    name: 'Daniel Okafor', age: 23, sex: 'M', skin: 'tone-5', hair: 'short-curly',
    setting: 'Emergency department, trauma bay',
    triage: 'Dived into the shallow end of a pool 90 minutes ago. On a spinal board with the neck immobilised.',
    immobile: true,
    spinalShock: true,
    temp: 36.2,
    setup: {
      params: {},
      neuro: { nodes: ['L_cst_C5', 'R_cst_C5', 'L_ahn_C5', 'R_ahn_C5', 'L_nerve_C5', 'R_nerve_C5', 'L_drg_C5', 'R_drg_C5',
        'L_stt_cross_C5', 'R_stt_cross_C5', 'L_stt_asc', 'R_stt_asc', 'L_dc_asc', 'R_dc_asc'] },
    },
    history: {
      intro: h('Daniel. Daniel Okafor.'),
      pc: h('I dived in, hit my head on the bottom. Now I can’t move my legs. I can’t really move my arms either.', 'hx.mechanism'),
      onset: h('Straight away, as soon as I hit the bottom. My mates pulled me out.'),
      weak: h('I can shrug my shoulders a bit. That’s it. I can’t lift my arms or grip anything.', 'hx.weakness'),
      numb: h('I can’t feel anything below here, sort of across my chest. It’s like my body isn’t there.', 'hx.sensory-level'),
      bladder: h('I don’t know. I can’t feel it.', 'hx.bladder'),
      pain: h('My neck. It really hurts at the back.', 'hx.neck-pain'),
      sob: h('A bit. It feels hard to take a big breath.'),
      syncope: h('No. I didn’t black out.'),
      pmh: h('Nothing. Asthma as a kid.'),
      meds: h('Nothing.'),
      alcohol: h('I’d had a few beers at the pool party.'),
      work: h('I’m doing engineering at uni. Live in halls.'),
      ideas: h('I’ve broken my neck, haven’t I?'),
      concerns: h('Am I going to walk again? Please just tell me.'),
    },
    keyFindings: [
      { label: 'Mechanism and sensory level elicited', keys: ['hx.mechanism', 'hx.sensory-level'] },
      { label: 'Bradycardia with hypotension', keys: ['obs.hr', 'obs.bp'], all: true },
      { label: 'Warm peripheries despite low pressure', keys: ['feel.warm', 'look.warm'] },
      { label: 'Diaphragmatic, paradoxical breathing', keys: ['look.paradox', 'listen.lungs.weak'] },
      { label: 'Limb weakness examined', keys: ['neuro.'] },
      { label: 'Palpable bladder', keys: ['feel.bladder'] },
    ],
    diagnosis: {
      options: ['Neurogenic shock from a C5 cord injury', 'Haemorrhagic shock', 'Cardiogenic shock from myocardial contusion', 'Vasovagal syncope'],
      answer: 0,
      teaching: 'Hypotension with a slow pulse and warm, dry skin is the signature of lost sympathetic outflow. A lesion above T6 removes vasomotor tone and cardiac acceleration, and nothing in this circulation was changed directly: the cord lesion did it. Flaccid, areflexic limbs are spinal shock, and the spasticity comes later. Always look for haemorrhage too, because trauma patients can have both, and bleeding with a cord injury will not produce the tachycardia you expect.',
    },
  },
];

export const personaById = (id) => PERSONAS.find((p) => p.id === id) || PERSONAS[0];

/** Manoeuvres the learner can ask for; they change what the next auscultation hears. */
export const MANOEUVRES = [
  { id: 'sit-forward', ask: 'Could you sit forward and breathe all the way out, then hold it?', reply: 'Like this? …', hint: 'Accentuates aortic regurgitation at the left sternal edge.' },
  { id: 'left-lateral', ask: 'Please roll onto your left side for me.', reply: 'Okay…', hint: 'Brings out the mitral stenosis rumble at the apex.' },
  { id: 'inspire', ask: 'Take a deep breath in and hold it.', reply: '(holds breath)', hint: 'Right-sided murmurs get louder on inspiration.' },
];
