/* Guided lessons.

   Every lesson is built the same way: state a question, make the learner commit
   to a prediction, then change the simulation and let them see whether they were
   right. Committing before seeing is the part that does the work — reading an
   explanation of the Frank-Starling mechanism is not the same as having guessed
   wrong about it thirty seconds earlier.

   Step kinds
     say      prose only
     do       apply settings, settle the model, then narrate what to watch
     predict  a question the learner must answer before the change is applied
     recap    closing summary, marks the lesson complete
*/

export const BASELINE = {
  Emax: 2.7, edpB: 0.022, HR: 72, K: 4.0,
  bloodVolume: 5000, V0sv: 2470, Rsys: 1.05, Csa: 1.2,
  EmaxRv: 0.62, Rpul: 0.075,
  Raortic: 0.02, Rmitral: 0.01,
  regAortic: 0, regMitral: 0, regTricuspid: 0, regPulmonic: 0,
  avConduction: 1, lbbConduction: 1, rbbConduction: 1, qrsAxis: 60,
};

export const LESSONS = [
  {
    id: 'venous-return',
    track: 'The closed loop',
    title: 'Where preload comes from',
    blurb: 'There is no filling-pressure dial. Filling pressure is what is left over once the heart has moved the blood around the ring.',
    minutes: 7,
    focus: 'wiggers',
    steps: [
      { kind: 'do', title: 'The reservoir',
        settings: { params: BASELINE, pathology: 'normal', baro: true },
        body: `Look at the circulation panel. Two thirds of the blood is sitting in the <em>systemic veins</em>, and most of it is at almost no pressure at all — it is filling the vessels rather than stretching them.
<p>Only the part that stretches them generates pressure. That is the stressed volume, and the pressure it produces is the <em>mean systemic filling pressure</em>: what the whole circulation would settle at if the heart stopped. It is the upstream end of venous return, and everything the heart can pump has to come through it.</p>` },
      { kind: 'predict', title: 'Taking blood away',
        question: 'We are about to remove 1000 mL — a 20% haemorrhage — with the baroreflex intact. What happens to the blood pressure?',
        options: [
          { id: 'a', label: 'It falls roughly in proportion, by about a fifth', correct: false,
            why: 'The circulation is not a passive tank. The reflex defends the pressure hard, and the fall is much less than proportional — which is exactly what makes early haemorrhage so easy to miss.' },
          { id: 'b', label: 'It falls only slightly, because the reflex compensates', correct: true,
            why: 'Mean pressure holds up far better than cardiac output does. The reflex constricts arterioles to defend pressure, and constricts the veins to recruit unstressed volume into the stressed compartment — the body giving itself a transfusion. Output falls much further than pressure.' },
          { id: 'c', label: 'It does not change at all', correct: false,
            why: 'Compensation is good, not perfect. Filling pressure has genuinely fallen and stroke volume falls with it.' },
        ],
        then: { params: { bloodVolume: 4000 }, settle: 8 },
        after: 'Note how much further the cardiac output has fallen than the pressure. The reflex trades flow for pressure, which is why a normal blood pressure never excludes shock.' },
      { kind: 'predict', title: 'What the reflex was worth',
        question: 'Now switch the baroreflex off, leaving the same 4000 mL of blood. What happens?',
        options: [
          { id: 'a', label: 'Little change — the volume is what matters', correct: false,
            why: 'The volume sets the ceiling, but without venoconstriction most of that volume stays unstressed and cannot generate filling pressure at all.' },
          { id: 'b', label: 'The pressure collapses', correct: true,
            why: 'Every defence goes at once: arteriolar tone, heart rate, contractility and — most importantly in a closed loop — venoconstriction. Losing the last one means the reservoir dilates and the stressed volume that was maintaining filling pressure drains back into unstressed capacity.' },
        ],
        then: { params: { bloodVolume: 4000 }, baro: false, settle: 8 },
        after: 'This is the difference between a compensated patient and a decompensated one, and it is the reason the same blood loss kills one person and barely troubles another.' },
      { kind: 'recap', points: [
        'Preload is an outcome of the loop, not an input to it.',
        'Mean systemic filling pressure is set by stressed volume over total compliance.',
        'Venoconstriction converts unstressed volume into stressed volume — a transfusion from the body\'s own reservoir.',
        'Compensation trades flow for pressure, so blood pressure is a late and unreliable sign of blood loss.',
      ] },
    ],
  },
  {
    id: 'right-heart',
    track: 'The closed loop',
    title: 'Two pumps in series',
    blurb: 'Whatever the right ventricle fails to deliver, the left ventricle never receives.',
    minutes: 7,
    focus: 'wiggers',
    steps: [
      { kind: 'do', title: 'The forgotten ventricle',
        settings: { params: BASELINE, pathology: 'normal', baro: true },
        body: `The right ventricle moves exactly the same stroke volume as the left, against about a fifth of the pressure. So it is built thin, and it has very little reserve when the load rises suddenly.
<p>Because the two pumps are in series in a closed ring, they constrain each other completely. Whatever fails to cross the lungs cannot appear in the aorta, no matter how healthy the left ventricle is.</p>` },
      { kind: 'predict', title: 'A sudden load',
        question: 'A large pulmonary embolism raises pulmonary vascular resistance sixfold. What happens to <em>left</em> atrial pressure?',
        options: [
          { id: 'a', label: 'It rises, because blood backs up', correct: false,
            why: 'Blood backs up behind the *right* ventricle, not the left. The obstruction is upstream of the left atrium, so less blood reaches it, not more.' },
          { id: 'b', label: 'It falls, because less blood is getting through the lung', correct: true,
            why: 'This is the counterintuitive part and the thing worth taking away. The left side is underfilled, not congested. The patient is in shock with clear lung fields — and giving them a large fluid bolus will distend the failing right ventricle further and can make things worse.' },
          { id: 'c', label: 'It is unchanged', correct: false,
            why: 'Output through the lung has fallen substantially, and left atrial filling falls with it.' },
        ],
        then: { params: { Rpul: 0.45 }, settle: 8 },
        after: 'Pulmonary artery pressure is up, central venous pressure is up, and left atrial pressure is down. Three numbers, one lesion.' },
      { kind: 'predict', title: 'The other right-sided failure',
        question: 'Now instead of raising the load, we destroy the right ventricle itself — an RV infarct. Central venous pressure rises again. What separates this from the embolism?',
        options: [
          { id: 'a', label: 'Nothing — both are right heart failure', correct: false,
            why: 'They are both right heart failure, but from opposite directions, and one number tells them apart.' },
          { id: 'b', label: 'Pulmonary artery pressure: high in embolism, low in infarct', correct: true,
            why: 'In embolism the ventricle is straining against a high load, so pulmonary pressure is high. In infarct the ventricle cannot generate pressure at all, so pulmonary pressure is low. Same raised venous pressure, same shock, opposite mechanism.' },
          { id: 'c', label: 'Central venous pressure is normal in infarct', correct: false,
            why: 'A failing right ventricle backs blood up into the veins — venous pressure is raised in both.' },
        ],
        then: { params: { Rpul: 0.075, EmaxRv: 0.18 }, settle: 8 },
        after: 'Both give a shocked patient with high venous pressure and clear lungs. The pulmonary artery pressure is the discriminator, and it is why the diagnosis is not made by examination alone.' },
      { kind: 'recap', points: [
        'The right ventricle is a volume pump, not a pressure pump — it tolerates load badly.',
        'PE: pulmonary pressure high, venous pressure high, left atrial pressure low.',
        'RV infarct: pulmonary pressure low, venous pressure high, left atrial pressure low.',
        'Raised venous pressure with clear lungs and shock is a right-sided problem until proven otherwise.',
      ] },
    ],
  },
  {
    id: 'valve-lesions',
    track: 'Mechanics',
    title: 'When ejection fraction lies',
    blurb: 'A leaking mitral valve makes the number on the echo report improve while the patient deteriorates.',
    minutes: 6,
    focus: 'pvloop',
    steps: [
      { kind: 'do', title: 'A competent valve',
        settings: { params: BASELINE, pathology: 'normal', baro: true },
        body: `Ejection fraction is the fraction of end-diastolic volume the ventricle expels. It is popular because it is easy to measure and it usually tracks contractility.
<p>It assumes something that is not always true: that everything leaving the ventricle goes forward.</p>` },
      { kind: 'predict', title: 'A leaking mitral valve',
        question: 'We make the mitral valve severely incompetent, so the ventricle can unload backwards into the atrium. What happens to the ejection fraction?',
        options: [
          { id: 'a', label: 'It falls — the heart is failing', correct: false,
            why: 'The patient is deteriorating, but the number does the opposite of what you expect.' },
          { id: 'b', label: 'It rises, even though forward output falls', correct: true,
            why: 'The atrium is a low-pressure escape route, so emptying becomes easy and end-systolic volume falls further than normal. The fraction expelled goes up while the fraction that reaches the body goes down. A "normal" ejection fraction in severe mitral regurgitation already indicates significant ventricular impairment.' },
          { id: 'c', label: 'It stays the same', correct: false,
            why: 'Unloading conditions have changed substantially, so the fraction expelled changes too.' },
        ],
        then: { params: { regMitral: 0.8 }, settle: 8 },
        after: 'Compare cardiac output with total stroke volume. The ventricle is shifting more blood than ever; less of it is going anywhere useful.' },
      { kind: 'do', title: 'Stenosis is a different problem',
        settings: { params: { ...BASELINE, Raortic: 1.2 }, settle: 8 },
        body: `Now a stenotic aortic valve instead. The ventricle must generate a far higher pressure than the aorta ever sees — that difference is the gradient, and the pressure–volume loop grows tall.
<p>Note where the disease is not. In mitral stenosis the ventricle is entirely normal and merely underfilled; the pressure is all in the atrium behind it, and from there it is transmitted straight to the lungs. Treating that patient's "heart failure" with drugs aimed at the ventricle treats the wrong chamber.</p>` },
      { kind: 'recap', points: [
        'Ejection fraction assumes all outflow is forward; regurgitation breaks that assumption.',
        'In mitral regurgitation, EF overestimates function — a normal EF is already abnormal.',
        'In stenosis, the ventricle generates pressure the arteries never see: the gradient.',
        'In mitral stenosis the ventricle is innocent; the lesion is at the inlet and the pressure is behind it.',
      ] },
    ],
  },
  {
    id: 'valves',
    track: 'Mechanics',
    title: 'Why blood only goes one way',
    blurb: 'Valves have no motor and no timing signal. They open and shut purely because pressure on one side beats pressure on the other.',
    minutes: 5,
    focus: 'wiggers',
    steps: [
      {
        kind: 'do',
        title: 'A single beat, laid out flat',
        settings: { params: BASELINE, pathology: 'normal', baro: true },
        body: `The stacked traces show one complete cardiac cycle. Three pressures are drawn on the same axis so you can see them cross:
<ul>
<li><em>Aortic</em> pressure, in carmine</li>
<li><em>Ventricular</em> pressure, in amber</li>
<li><em>Atrial</em> pressure, in teal</li>
</ul>
Below them are ventricular volume and the ECG. Drag anywhere on the strip to move the cursor — every other panel on the page follows it.`,
      },
      {
        kind: 'predict',
        title: 'What opens the aortic valve?',
        question: 'The aortic valve opens at one specific moment in the cycle. What actually causes it?',
        options: [
          { label: 'A nerve signal timed to the QRS', why: 'There is no nerve supply to the valve leaflets at all. Nothing tells them when to move.' },
          { label: 'Ventricular pressure rising above aortic pressure', correct: true, why: 'Exactly. The leaflets are passive flaps. The moment the amber trace crosses above the carmine one, they are pushed open.' },
          { label: 'The papillary muscles pulling them open', why: 'Papillary muscles attach to the mitral and tricuspid valves, and they prevent prolapse rather than opening anything.' },
          { label: 'Ventricular volume reaching a threshold', why: 'Volume is not sensed. A dilated failing ventricle can hold 250 mL and still not open the valve if its pressure stays low.' },
        ],
      },
      {
        kind: 'say',
        title: 'Find the crossing points',
        body: `Scrub the cursor slowly through systole and watch the amber and carmine traces. There are exactly two crossings per beat, and they are the two loudest events in the cycle.
<ul>
<li>Amber crosses <strong>above</strong> carmine → aortic valve opens, ejection starts</li>
<li>Amber falls <strong>below</strong> carmine → aortic valve shuts, and that closure is the <em>second heart sound</em></li>
</ul>
The same logic runs the mitral valve one axis down, between the amber and teal traces. <em>S1</em> is mitral closure at the start of systole.`,
      },
      {
        kind: 'say',
        title: 'The two silent phases',
        body: `Between mitral closure and aortic opening, both valves are shut and the ventricle cannot change volume — it can only build pressure. That is <strong>isovolumic contraction</strong>, and on the volume trace it is perfectly flat.
<p>The mirror image happens after the aortic valve shuts: pressure collapses at constant volume until the mitral valve opens. That is <strong>isovolumic relaxation</strong>.</p>
<p>Look at the volume trace: it is flat, then falls steeply, then flat again, then refills. Those four segments are the whole cardiac cycle.</p>`,
      },
      {
        kind: 'recap',
        title: 'What to carry away',
        body: `<ul>
<li>Valves are passive. Pressure gradients open and close them, nothing else.</li>
<li>Two crossings per beat produce the two heart sounds.</li>
<li>When both valves are shut, volume is fixed and only pressure can change.</li>
</ul>`,
      },
    ],
  },

  {
    id: 'preload',
    track: 'Mechanics',
    title: 'Preload and the Frank–Starling mechanism',
    blurb: 'A ventricle that is filled more, empties more — without any change in contractility, and without being told to.',
    minutes: 6,
    focus: 'pv',
    steps: [
      {
        kind: 'do',
        title: 'Start from normal',
        settings: { params: BASELINE, pathology: 'normal', baro: false },
        body: `The baroreflex is switched off for this lesson so that heart rate stays fixed and you can see the mechanical effect on its own.
<p>Watch the <strong>pressure–volume loop</strong>. It runs anticlockwise: filling along the bottom, isovolumic contraction up the right side, ejection across the top, isovolumic relaxation down the left. Its width is stroke volume.</p>`,
      },
      {
        kind: 'predict',
        title: 'Commit before you look',
        question: 'You raise the filling pressure from 7.5 to 14 mmHg and change nothing else. What happens to stroke volume?',
        options: [
          { label: 'Rises', correct: true, why: 'Right. More filling stretches the myocytes, which increases the force each one generates. The loop gets wider.' },
          { label: 'Falls', why: 'Falling stroke volume with rising filling pressure is the signature of a failing ventricle, not a normal one. We will produce exactly that later.' },
          { label: 'Unchanged — contractility did not change', why: 'The common trap. Contractility is unchanged, but force still rises because the starting sarcomere length changed. That is the whole point of the mechanism.' },
        ],
        then: { params: { preload: 14 }, settle: 8 },
        after: `Stroke volume climbed and the loop widened, with its right-hand edge pushed out to a larger end-diastolic volume. Contractility never moved — the <em>ESPVR line has the same slope</em>. The extra output came entirely from the extra stretch.`,
      },
      {
        kind: 'say',
        title: 'Why it matters that this is automatic',
        body: `The left and right ventricles pump in series, and nothing coordinates them beat to beat. If the right ventricle ejected even 1% more than the left, the lungs would flood within minutes.
<p>They stay matched because whichever ventricle receives more, ejects more. The Frank–Starling mechanism is the feedback loop that keeps the two circulations balanced without any control system at all.</p>`,
      },
      {
        kind: 'predict',
        title: 'The other direction',
        question: 'Now drop filling pressure to 4 mmHg — the equivalent of significant blood loss. With the baroreflex still switched off, what happens to arterial pressure?',
        options: [
          { label: 'Holds steady — the arteries buffer it', why: 'Compliance smooths pressure within a beat, but it cannot manufacture volume. Over several beats the mean pressure must fall.' },
          { label: 'Falls substantially', correct: true, why: 'Correct, and this is why haemorrhage kills. Less filling → less stroke volume → less cardiac output → lower pressure.' },
          { label: 'Rises to compensate', why: 'That would need the reflex, which is off. Compensation is a nervous response, not a mechanical one.' },
        ],
        then: { params: { preload: 4 }, settle: 8 },
        after: `Pressure fell and the loop shrank from both directions. Now switch the baroreflex back on in the Loop workspace and watch the same bleed play out very differently — that is the next lesson.`,
      },
      {
        kind: 'recap',
        title: 'What to carry away',
        body: `<ul>
<li>More filling means more stretch, more force, and more stroke volume — with contractility unchanged.</li>
<li>On the PV loop, preload moves the right-hand edge without changing the ESPVR slope.</li>
<li>The mechanism is what keeps the two ventricles matched beat to beat.</li>
</ul>`,
      },
    ],
  },

  {
    id: 'afterload',
    track: 'Mechanics',
    title: 'Afterload: the price of pushing',
    blurb: 'Raise the pressure the ventricle has to eject against and it ejects less, immediately, with no change in its own strength.',
    minutes: 6,
    focus: 'pv',
    steps: [
      {
        kind: 'do',
        title: 'Reset, reflex off',
        settings: { params: BASELINE, pathology: 'normal', baro: false },
        body: 'Back to baseline with the baroreflex off. Note the loop width and the end-systolic volume — the left-hand edge of the loop.',
      },
      {
        kind: 'predict',
        title: 'Commit before you look',
        question: 'Systemic vascular resistance doubles — a hypertensive crisis, or a hand squeezing the aorta. What happens to end-systolic volume?',
        options: [
          { label: 'Falls — the ventricle works harder', why: 'Effort does not equal emptying. The ventricle does generate more pressure, but it stops ejecting sooner.' },
          { label: 'Rises — more blood is left behind', correct: true, why: 'Right. Ejection stops earlier because pressure crosses back below aortic pressure sooner, so more blood stays in the chamber.' },
          { label: 'Unchanged — it is set by contractility', why: 'End-systolic volume is set by where the ESPVR meets the load. Change the load and the meeting point moves along the line.' },
        ],
        then: { params: { R: 2.2 }, settle: 10 },
        after: `The loop became taller and narrower. Its top-left corner slid <em>up and right along the ESPVR line</em> — the line itself did not move, because contractility did not change. More blood was left behind, so stroke volume fell.`,
      },
      {
        kind: 'say',
        title: 'The line the corner sits on',
        body: `The upper-left corner of every loop lands on the same straight line: the <strong>end-systolic pressure–volume relation</strong>. It describes how hard the ventricle can squeeze at any given volume, and it is the cleanest available definition of contractility.
<p>Loading conditions move the corner <em>along</em> the line. Only a change in contractility rotates the line itself. That distinction is what makes the ESPVR worth knowing.</p>`,
      },
      {
        kind: 'predict',
        title: 'A failing ventricle meets the same load',
        question: 'We will now weaken the ventricle to half strength and then double resistance again. Compared with the healthy ventricle, how sensitive will its stroke volume be to that same rise in afterload?',
        options: [
          { label: 'Much more sensitive', correct: true, why: 'Correct — and this is why afterload reduction is a cornerstone of heart failure treatment. A weak ventricle loses far more stroke volume for the same rise in load.' },
          { label: 'About the same', why: 'The geometry says otherwise: a shallower ESPVR means the same vertical shift costs far more volume.' },
          { label: 'Less sensitive', why: 'The opposite. A shallow ESPVR crosses the load line at a much more oblique angle.' },
        ],
        then: { params: { Emax: 1.1, R: 2.2 }, settle: 10 },
        after: `Stroke volume collapsed. The ESPVR is now a shallow line, so the same rise in pressure pushes the end-systolic point much further to the right. This is the argument for vasodilators, ACE inhibitors and afterload reduction in heart failure: you cannot easily make a failing ventricle stronger, but you can make its job smaller.`,
      },
      {
        kind: 'recap',
        title: 'What to carry away',
        body: `<ul>
<li>Higher afterload means ejection stops sooner, so end-systolic volume rises and stroke volume falls.</li>
<li>Load moves the corner along the ESPVR; contractility rotates the ESPVR itself.</li>
<li>The weaker the ventricle, the more afterload costs it.</li>
</ul>`,
      },
    ],
  },

  {
    id: 'compliance',
    track: 'Mechanics',
    title: 'The aorta as a buffer',
    blurb: 'Why a stiff aorta produces a wide pulse pressure, and why that is a cardiovascular risk factor rather than a curiosity.',
    minutes: 5,
    focus: 'wiggers',
    steps: [
      {
        kind: 'do',
        title: 'A young, elastic aorta',
        settings: { params: { ...BASELINE, C: 2.4 }, pathology: 'normal', baro: false },
        body: `Arterial compliance is set high, like a healthy twenty-year-old. The ventricle ejects in short bursts, but the aorta stretches to absorb each one and recoils during diastole to keep flow going.
<p>Read the systolic and diastolic numbers on the monitor strip, and note the pulse pressure — the gap between them.</p>`,
      },
      {
        kind: 'predict',
        title: 'Commit before you look',
        question: 'Now stiffen the aorta, as happens with age. Mean arterial pressure will barely move. What happens to systolic and diastolic pressure?',
        options: [
          { label: 'Both rise together', why: 'That would be a rise in mean pressure, which is set by cardiac output and resistance — neither of which we are changing.' },
          { label: 'Systolic rises, diastolic falls', correct: true, why: 'Right. The same stroke volume enters a less stretchy tube, so the peak overshoots; and with less stored recoil, pressure decays further before the next beat.' },
          { label: 'Both fall', why: 'Nothing here reduces the volume being pumped or the resistance it meets.' },
          { label: 'Neither changes — compliance only affects the waveform shape', why: 'Compliance is precisely what converts a pulsatile inflow into a steady outflow. Remove it and the pulse gets larger.' },
        ],
        then: { params: { C: 0.55 }, settle: 8 },
        after: `Pulse pressure widened dramatically while the mean barely moved. This is <strong>isolated systolic hypertension</strong>, the commonest pattern of raised blood pressure after about sixty, and it is a stiffness problem rather than a resistance problem.`,
      },
      {
        kind: 'say',
        title: 'Why the wide pulse hurts',
        body: `A high systolic peak increases the wall stress the ventricle must generate, driving hypertrophy. A low diastolic trough matters even more: the coronary arteries fill during <em>diastole</em>, so the perfusion pressure of the heart's own supply is the diastolic pressure.
<p>A stiff aorta therefore raises the heart's demand and lowers its supply at the same time. That is why pulse pressure predicts cardiovascular events independently of the mean.</p>`,
      },
      {
        kind: 'recap',
        title: 'What to carry away',
        body: `<ul>
<li>Mean pressure is set by cardiac output and resistance. <em>Pulse</em> pressure is set by stroke volume and compliance.</li>
<li>Stiffening widens the pulse without moving the mean.</li>
<li>High systolic raises demand; low diastolic lowers coronary supply.</li>
</ul>`,
      },
    ],
  },

  {
    id: 'baroreflex',
    track: 'Control',
    title: 'The baroreflex closes the loop',
    blurb: 'The same haemorrhage, run twice: once with the reflex disabled and once with it intact.',
    minutes: 6,
    focus: 'baro',
    steps: [
      {
        kind: 'do',
        title: 'Open loop',
        settings: { params: BASELINE, pathology: 'normal', baro: false },
        body: `The baroreflex is off. Stretch receptors in the carotid sinus and aortic arch still fire in proportion to pressure, but nothing acts on that signal.
<p>The panel shows firing rate and the two autonomic outflows it drives.</p>`,
      },
      {
        kind: 'do',
        title: 'Bleed the patient — reflex disabled',
        settings: { params: { preload: 3.5 }, settle: 10 },
        body: 'Filling pressure has been dropped sharply. Note how far mean arterial pressure falls, and note that heart rate does not move at all.',
      },
      {
        kind: 'predict',
        title: 'Commit before you look',
        question: 'We are about to switch the reflex on with the patient still hypovolaemic. Baroreceptor firing is low. What does the reflex do?',
        options: [
          { label: 'Sympathetic up, parasympathetic down, heart rate rises', correct: true, why: 'Correct. Low firing means low pressure, and the response is more sympathetic drive and less vagal tone — so the rate climbs and cardiac output is partly defended.' },
          { label: 'Sympathetic down, heart rate falls', why: 'That is the response to <em>high</em> pressure. The receptors fire faster when stretched, and more firing means more inhibition of sympathetic outflow.' },
          { label: 'Nothing — the reflex only responds to hypertension', why: 'It is bidirectional, and the low-pressure arm is the one that keeps people conscious during haemorrhage.' },
        ],
        then: { baro: true, settle: 14 },
        after: `Heart rate climbed and mean pressure was partly restored — not fully, because the reflex can only redistribute what remains. This is why a bleeding patient can look deceptively stable: tachycardia is doing the work, and the pressure only falls once that compensation is exhausted.`,
      },
      {
        kind: 'say',
        title: 'The sign of the loop',
        body: `The reflex is <strong>negative feedback</strong>, and every step inverts as you expect:
<p><code>pressure ↑ → stretch ↑ → firing ↑ → sympathetic ↓, vagal ↑ → heart rate ↓ → pressure ↓</code></p>
<p>If you can reconstruct that chain, you can predict the effect of a carotid sinus massage, of a beta-blocker, and of the Valsalva manoeuvre without memorising any of them separately.</p>`,
      },
      {
        kind: 'recap',
        title: 'What to carry away',
        body: `<ul>
<li>Baroreceptors report pressure by firing faster when stretched.</li>
<li>More firing inhibits sympathetic outflow and raises vagal tone.</li>
<li>Compensation buys time; it does not replace lost volume.</li>
</ul>`,
      },
    ],
  },

  {
    id: 'failure',
    track: 'Mechanics',
    title: 'Two kinds of heart failure',
    blurb: 'A ventricle that cannot squeeze and a ventricle that cannot relax both cause breathlessness, and the ejection fraction tells them apart.',
    minutes: 7,
    focus: 'pv',
    steps: [
      {
        kind: 'do',
        title: 'Normal reference',
        settings: { params: BASELINE, pathology: 'normal', baro: true },
        body: 'Note the ejection fraction and the left atrial pressure. Both will move, but in different ways depending on which kind of failure we produce.',
      },
      {
        kind: 'do',
        title: 'Failure of contraction',
        settings: { params: { Emax: 0.9 }, settle: 14 },
        body: `Contractility has been cut to roughly a third — a dilated cardiomyopathy, or the aftermath of a large infarct.
<p>The ESPVR has <em>rotated downward</em>. End-systolic volume is large, the chamber dilates, and ejection fraction collapses. This is <strong>heart failure with reduced ejection fraction</strong>.</p>`,
      },
      {
        kind: 'predict',
        title: 'Commit before you look',
        question: 'Now a different patient: contractility is completely normal, but the ventricle is stiff and resists filling. What will the ejection fraction be?',
        options: [
          { label: 'Low, as in the previous case', why: 'A stiff ventricle fills less, but it also empties proportionally — the fraction is preserved even though the absolute volumes are small.' },
          { label: 'Normal or even high', correct: true, why: 'Correct, and this is exactly why ejection fraction misleads here. Both end-diastolic and end-systolic volumes shrink, so their ratio survives.' },
          { label: 'Impossible to say without knowing the heart rate', why: 'Rate changes filling time, but the ratio is dominated by the stiffness itself.' },
        ],
        then: { params: { Emax: 2.7, edpB: 0.055, preload: 15 }, settle: 14 },
        after: `Ejection fraction stayed near normal — but look at left atrial pressure. It is high, because the only way to fill a stiff ventricle is to push harder. That raised pressure backs up into the lungs, which is what makes the patient breathless. This is <strong>heart failure with preserved ejection fraction</strong>, and it accounts for roughly half of all heart failure.`,
      },
      {
        kind: 'say',
        title: 'Read the filling curve',
        body: `Compare the lower boundary of the PV loop with the dashed passive filling curve. In the stiff ventricle the curve is steep, so a small increase in volume costs a large increase in pressure.
<p>That single curve explains the whole syndrome: normal squeeze, normal fraction, high filling pressures, wet lungs.</p>`,
      },
      {
        kind: 'recap',
        title: 'What to carry away',
        body: `<ul>
<li>Reduced ejection fraction is a failure of the ESPVR — the systolic line rotates down.</li>
<li>Preserved ejection fraction is a failure of the filling curve — the diastolic curve steepens.</li>
<li>Both raise atrial pressure and cause breathlessness. Ejection fraction separates them.</li>
</ul>`,
      },
    ],
  },

  {
    id: 'potassium',
    track: 'Conduction',
    title: 'From potassium to the QRS',
    blurb: 'The resting membrane potential is a potassium electrode, and the ECG reports it.',
    minutes: 6,
    focus: 'ecg',
    steps: [
      {
        kind: 'do',
        title: 'Normal potassium',
        settings: { params: { ...BASELINE, K: 4.0 }, pathology: 'normal', baro: true },
        body: 'Serum potassium is 4.0 mmol/L. Watch lead II and the precordial leads on the ECG workspace — particularly the shape of the T wave.',
      },
      {
        kind: 'predict',
        title: 'Commit before you look',
        question: 'Serum potassium rises to 6.5. Which change appears first?',
        options: [
          { label: 'The QRS widens', why: 'That comes later. Widening reflects slowed conduction once the resting potential has drifted far enough to inactivate sodium channels.' },
          { label: 'Tall, peaked, narrow T waves', correct: true, why: 'Correct. Raised extracellular potassium speeds repolarisation, so the T wave becomes tall, narrow and symmetric — earlier than anything else.' },
          { label: 'The P wave disappears', why: 'Atrial tissue is the most sensitive to potassium, but it flattens after the T waves peak, not before.' },
          { label: 'ST elevation appears', why: 'ST elevation is an injury current pattern. Potassium acts through repolarisation instead.' },
        ],
        then: { params: { K: 6.5 }, settle: 8 },
        after: 'Peaked T waves, most obvious in V2 to V4. Nothing else has changed yet.',
      },
      {
        kind: 'do',
        title: 'Push it further',
        settings: { params: { K: 7.5 }, settle: 8 },
        body: `Now the P wave flattens and the PR interval stretches, because atrial tissue and the AV node are the most potassium-sensitive parts of the conducting system. The QRS is starting to widen.`,
      },
      {
        kind: 'do',
        title: 'Pre-arrest',
        settings: { params: { K: 8.5 }, settle: 8 },
        body: `The P wave has gone and the QRS is so wide that it merges into the T wave — the <em>sine wave</em> pattern. This is minutes from arrest and is treated before the laboratory result is confirmed.
<p>Notice that the pump is failing too: with conduction this slow, coordinated contraction breaks down.</p>`,
      },
      {
        kind: 'say',
        title: 'One ion, one sequence',
        body: `The whole progression follows from a single fact: raising extracellular potassium makes the resting membrane potential less negative.
<p>Less negative resting potential leaves fewer sodium channels available, so depolarisation slows and the QRS widens. Meanwhile potassium conductance rises, so repolarisation accelerates and the T wave peaks.</p>
<p>Peaked T → flat P → wide QRS → sine wave → arrest. One mechanism, one order, every time.</p>`,
      },
      {
        kind: 'recap',
        title: 'What to carry away',
        body: `<ul>
<li>Peaked T waves come first and are the cheapest early warning available.</li>
<li>P wave flattening and PR prolongation follow.</li>
<li>QRS widening into a sine wave means treat now, ask questions later.</li>
</ul>`,
      },
    ],
  },

  {
    id: 'blocks',
    track: 'Conduction',
    title: 'Breaking the wiring',
    blurb: 'Slow the AV node, then cut a bundle branch, and watch which part of the trace deforms.',
    minutes: 6,
    focus: 'ecg',
    steps: [
      {
        kind: 'do',
        title: 'Intact conduction',
        settings: { params: BASELINE, pathology: 'normal', baro: true },
        body: `The conduction model runs a real excitable medium over a network from the sinus node to the Purkinje fibres. When you slow a segment, the delay it produces is computed rather than drawn.
<p>Note the narrow QRS: both bundle branches are firing together.</p>`,
      },
      {
        kind: 'do',
        title: 'Slow the AV node',
        settings: { params: { avConduction: 0.35 }, settle: 8 },
        body: `AV conduction is down to 35%. The PR interval has lengthened — the atria still reach the ventricles, just late. The QRS is unchanged, because everything below the node is intact.`,
      },
      {
        kind: 'predict',
        title: 'Commit before you look',
        question: 'Next we will block the left bundle branch completely. What happens to the QRS?',
        options: [
          { label: 'It disappears', why: 'The right bundle still works, so the ventricles are still activated — just not simultaneously.' },
          { label: 'It widens', correct: true, why: 'Correct. The left ventricle can now only be reached by slow muscle-to-muscle spread from the right side, which takes far longer than the Purkinje network.' },
          { label: 'It stays the same width but changes axis only', why: 'Axis does shift, but the dominant change is duration — the two ventricles no longer depolarise together.' },
          { label: 'The PR interval lengthens instead', why: 'PR is atrium-to-ventricle time, which is set above the bundles.' },
        ],
        then: { params: { avConduction: 1, lbbConduction: 0.02 }, settle: 8 },
        after: `A wide QRS. This matters clinically for a specific reason: new left bundle branch block deforms the ST segment so badly that the usual criteria for reading an infarct no longer apply.`,
      },
      {
        kind: 'say',
        title: 'A rule worth keeping',
        body: `<ul>
<li>A long <strong>PR</strong> is a problem <em>above</em> the ventricles — at the AV node.</li>
<li>A wide <strong>QRS</strong> is a problem <em>within</em> the ventricles — bundle branches, myocardium, or potassium.</li>
</ul>
<p>Try the arrhythmia entries in the pathology list as well. A dropped beat with a lengthening PR is Wenckebach; P waves marching independently is complete block. Watch what each one does to blood pressure, not just to the trace.</p>`,
      },
      {
        kind: 'recap',
        title: 'What to carry away',
        body: `<ul>
<li>PR interval reports the AV node; QRS duration reports the ventricles.</li>
<li>Bundle branch block widens the QRS because the two ventricles stop firing together.</li>
<li>New LBBB invalidates the usual ST criteria for infarction.</li>
</ul>`,
      },
    ],
  },
];
