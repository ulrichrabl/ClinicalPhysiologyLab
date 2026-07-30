# Clinical Physiology Lab

A multi-domain medical simulation for learning. Three domains are live —
**Circulation**, **Neurology** and **Labs** — sharing one patient, so what you do
in one shows up in the others.

---

## Running it

**Simplest:** open `dist/index.html` in a browser. Everything is in that one
file: no server, no install, no network.

**If anything looks off:** use a local server instead — some browsers restrict
what a `file://` page may do.

| Platform | Do this |
|---|---|
| macOS | double-click `dist/serve.command` |
| Linux | `./dist/serve-linux.sh` |
| Windows | double-click `dist/serve-windows.bat` |

All three start a Python static server and open the page. Close the terminal
window to stop it.

Chrome, Firefox, Safari and Edge are all fine. The layout works down to phone
width, though a wider window is much better for the twelve-lead.

### If something looks wrong

Press **D**. The report now includes the measured size of every canvas in the
current workspace — a zero width there is the reason a panel is blank, and it
tells us far more than a screenshot would.

Press **D**. Every panel draws inside an error guard, so a panel that throws is
isolated rather than taking the app down with it — but it will look blank, and
that is exactly when a report is useful. `D` opens a copyable diagnostic
containing the browser, the viewport and pixel ratio, whether the simulation is
running in a Worker or in-page, which couplings are active, and the stack of
anything that has thrown. Paste that rather than describing the symptom.

A red pill in the bottom-left corner appears if anything has been caught.

**On fonts:** the interface asks for IBM Plex and falls back to the system UI
font. Nothing is downloaded — the app makes no network requests at all — so
unless you have Plex installed locally you are seeing the fallback. That is
intended, not a bug.

### Keyboard

| Key | Does |
|---|---|
| `Space` | play / pause |
| `Tab` / `Shift-Tab` | next / previous domain |
| `1` … `9` | jump to a workspace within the current domain |
| `T` | switch theme — **Monitor** (dark) or **Paper** (light, rose-ruled) |
| `Esc` | dismiss the explanation popover |
| `D` | diagnostic report — copy this if anything misbehaves |

---

## Five minutes, to see whether it's any good

1. **Circulation → Loop.** Drag the cursor along the Wiggers strip. The PV loop
   dot, the heart schematic and every number follow it. Find the two moments
   where the amber ventricular trace crosses the carmine aortic one — those are
   the aortic valve opening and closing, and the second one is S2.
2. **Drop contractility** to about 1.0. Watch the ESPVR rotate down and the
   ejection fraction fall toward 30%. Then **stiffen the aorta** (compliance to
   0.6) and see the pulse pressure widen to the 80s without the mean moving much
   — isolated systolic hypertension, from one parameter.
3. **Neurology → Localise.** Click *Lateral medullary (Wallenberg)*. Read the
   findings: pain and temperature lost on the **face on one side** and the
   **body on the other**. Nothing in the code stores that fact — it falls out of
   where the two pathways cross.
4. **Neurology → Examination → Blind case.** You get a hidden lesion. Click
   parts of the body, run bedside tests, and build the picture yourself; then
   commit to a location. Afterwards it tells you which abnormalities you never
   went looking for, which is usually the more useful half.
5. **Neurology → Cases → Spinal cord patterns → the diving accident.** Answer
   it, then switch to **Circulation**. The blood pressure is low and the heart
   rate is *slow*, and the PV loop has changed shape. No cardiac parameter was
   touched; a C5 cord lesion disconnected the sympathetic outflow.
6. **Circulation → Bench → Blood volume.** Take away 1000 mL. The reflex
   defends the pressure and the heart rate climbs. Now switch the baroreflex off
   and watch what that compensation was worth — the pressure collapses.
7. **Labs.** Lactate, urea and haemoglobin have all moved, each marked as
   written by the simulation rather than set by you. The acid–base panel walks
   the interpretation one step at a time.
8. **Patient.** Every cross-domain link that is currently firing, with the
   mechanism written out. Click one open.

---

## What's actually being simulated

Not a lookup table of ECG pictures. The engines are:

**Circulation.** A Fenton–Karma excitable-medium model on a 33-node conduction
network (SA → atria → AV → His → bundle branches → Purkinje), producing a
a twelve-lead ECG computed from the muscle rather than drawn.

The morphology is derived. Roughly twenty myocardial segments are built from the
left ventricular long axis, each with three transmural layers, and two
mechanisms are superposed: a **wavefront dipole** proportional to how much the
inner layer of each wall disagrees with the outer one, which writes the QRS and —
because epicardium has the shorter action potential and repolarises first — a
concordant T wave with no extra machinery; and a **regional injury current**,
a lead field over each region's departure from what healthy muscle would be
doing, which writes ST shifts and is identically zero in a normal heart.

All twenty-nine pathologies are described as substrate — which territory is
ischaemic, to what depth, what is scarred, which walls are hypertrophied, how
fast the bundles conduct — and never as per-lead offsets. Things that used to be
table entries are now consequences:

- reciprocal ST depression is the same vector seen from the opposite side;
- transmural injury elevates and subendocardial injury depresses, because they
  are the same lesion at different depth rather than two separate rules;
- inferior infarction elevates III more than II, the right-coronary sign;
- scar loses its R wave and has a flat ST, because dead muscle carries no
  injury current — which is exactly what separates an old infarct from an acute
  one.

Mechanically it is a **closed loop**: eight compartments in a ring — LV → aorta →
systemic veins → RA → RV → pulmonary arteries → pulmonary veins → LA — with all
four chambers on time-varying elastance, four valves governed by pressure
differences alone, and a baroreflex acting on rate, contractility, arteriolar
tone *and* venous capacitance. RK4 at 0.5 ms, ten state variables, blood
conserved to within a millilitre.

That matters more than it sounds. There is no filling-pressure dial: preload is
whatever is left over once the heart has moved the blood around the ring. So the
model can show what an open-loop one cannot —

- **haemorrhage and fluid loading**, graded and monotonic, with the baroreflex's
  contribution measurable by switching it off (a 20% bleed gives MAP 79 with the
  reflex, MAP 7 without);
- **venoconstriction** raising filling pressure without adding a drop of blood;
- **the whole right heart**, and therefore pulmonary embolism and RV infarction —
  which both raise venous pressure and drop output, but separate on pulmonary
  artery pressure, high in one and low in the other;
- **all four valves**, stenosis and regurgitation, including the two deceptive
  ejection fractions: mitral regurgitation reads EF 70% while forward output
  falls, aortic regurgitation reads 63% with a wide pulse pressure.

Baseline settles at 113/75, MAP 96, CO 5.1, EDV 123, EF 55%, CVP 4, PA 17/9,
LAP 6, with textbook cycle intervals. Twenty-nine rhythm pathologies, each with
haemodynamic consequences rather than a drawing.

**Labs.** Arterial gas, chemistry, full blood count and cardiac markers, with the
acid–base interpretation worked one step at a time — Winter's formula, the
albumin-corrected anion gap, the delta ratio — rather than delivered as a
verdict. Values the circulation is responsible for are computed and marked as
such: lactate from perfusion, urea from renal blood flow, haemoglobin from
circulating volume, natriuretic peptide from wall stress. Potassium and calcium
run the other way and are read back by the cardiac model.

**Neurology.** The nervous system as a graph: **321 anatomical nodes** and
**192 pathways**, each carrying its modality, its node chain, its
decussation points and the place where an upper motor neuron hands over to a
lower one. The localiser derives findings from that geometry. Move a lesion one
node caudal and the picture changes for a reason.

Redundancy is modelled explicitly, which matters more than it sounds: the upper
face receives corticobulbar fibres from *both* hemispheres, so a deficit is only
declared when every pathway serving a target is interrupted. That is what makes
a capsular stroke spare the forehead while a Bell's palsy does not — the single
most useful discriminator in cranial nerve examination, and one the app now gets
right by derivation rather than by special case.

The graph runs the whole ladder a clinician descends — cortex, subcortical,
brainstem, cord, **root, plexus, peripheral nerve, neuromuscular junction,
muscle** — because the bottom four rungs have their own patterns and most of
peripheral neurology is telling them apart. Those distinctions are derived, not
described:

- an ulnar palsy weakens the first dorsal interosseous and spares abductor
  pollicis brevis, which shares its roots but not its nerve — while a C8 root
  lesion weakens both;
- a peroneal palsy weakens dorsiflexion and eversion but spares inversion,
  because tibialis posterior shares L5 and travels in the tibial nerve — the one
  muscle that separates it from an L5 radiculopathy;
- junction disease produces no sensory findings at all and reaches ocular and
  bulbar muscle; muscle disease is proximal, symmetric and leaves the reflexes
  alone.

**Time course is a second axis.** The examination localises; only the history
dates the lesion, and the differential is a function of both. The same capsular
hemiparesis is a stroke over ninety seconds and a tumour over eight weeks — the
findings are identical and no refinement of the examination will separate them.
Six tempos, and the differential panel recomputes from the pair.

The examination workspace has **107 bedside tests across 13 body regions**, each
knowing both how to recognise a finding and what normal sounds like, including
sustained upgaze and counting aloud for fatigability.

---

## Architecture

```
src/
  core/
    patient.js          shared state + the coupling engine
    ui/                 kit, inspector, case runner, lesson runner, patient view
  domains/
    cardio/  index.js   manifest: workspaces, produces/consumes, transport
             sim/       the model (runs in a Worker, or in-page from file://)
             ui/  data/
    neuro/   index.js
             model/     localiser
             data/      anatomy graph, cases, lessons
             ui/
  main.js               shell: routing, vitals strip, transport, theme
```

The point of the split: **potassium is not a cardiology slider.** It is a
property of the patient, and it belongs to whichever domain owns chemistry —
cardiology only *reads* it. Domains declare what they publish and what they
consume; the links between them are declared explicitly, one named mechanism at
a time, so the app can show a learner *why* something changed instead of just
changing it.

Couplings are live across all three domains, including the ones that genuinely
need more than one specialty:

- **Neurogenic shock** — a cord lesion above T6 cuts sympathetic outflow, so the
  circulation shows hypotension *with bradycardia*. That slow pulse is what
  separates it from haemorrhage.
- **Cushing reflex** — rising intracranial pressure drives hypertension and
  reflex bradycardia.
- **CPP = MAP − ICP**, with autoregulation failure flagged below 50 mmHg.
- Potassium → repolarisation, calcium → ST duration, β-blockade, vagolysis,
  vasopressors.
- **Hypoperfusion → lactate**, and hypotension → urea and creatinine, so a
  circulatory problem shows up in the blood results without anyone typing a
  number in.

**Adding a domain** is one file exporting a manifest and one line in
`DOMAIN_FACTORIES` in `src/main.js`. Labs, renal, pulmonary and pharmacology
should not require the shell to change. Cases and guided lessons are
framework-level, so a new domain gets both for free by supplying data.

---

## Developing

```bash
npm install
node scripts/build.mjs    # → dist/index.html, self-contained
node scripts/smoke.mjs    # headless: boots the real bundle, visits every
                          # workspace, fires the couplings, checks both themes
node scripts/physiology.test.mjs    # 53 assertions about the nervous system
node scripts/circulation.test.mjs   # 43 assertions about the circulation
node scripts/ecg.test.mjs          # 20 assertions about the 12-lead
node scripts/browser.test.mjs      # boots the shipped dist/index.html in a real DOM,
                                   # and checks the canvases actually draw pixels
node scripts/render.mjs            # renders every canvas panel to PNG in /tmp/shots
THEME=paper node scripts/render.mjs   # ...in the light theme
```

`scripts/smoke.mjs` runs the actual built bundle against a small DOM stub and
tests both hosting paths (Web Worker and the in-page fallback used on `file://`).
It is not a substitute for looking at it, but it catches the class of bug that
only appears at runtime.

The two physiology suites assert facts about the body rather than about the
code — that Wallenberg produces crossed sensory loss, that Brown-Séquard splits
the modalities to opposite sides, that a capsular lesion spares the forehead;
that blood volume is conserved, that filling pressure and output fall
monotonically with haemorrhage, that PE and RV infarct diverge on pulmonary
artery pressure, that mitral regurgitation raises ejection fraction while
lowering forward output. A refactor that quietly breaks the physiology fails
there instead of in front of a student.

---

## Known gaps

- **No basal ganglia**, so no movement disorders.
- Peripheral coverage is the common patterns, not the whole of it: no
  length-dependent polyneuropathy gradient, no autonomic neuropathy, and the
  motor unit table covers about sixteen muscles rather than the full myotomal set.
- **No retention model.** Predict-then-observe is well served, but nothing tracks
  what a learner is weak at, nothing is spaced, and scores reset on reload. This
  is the largest gap against the stated priority of learning efficacy.
- Cardiology's electrode-placement trainer and comparison view from the original
  are not yet rebuilt.
- Couplings that write the same parameter resolve last-one-wins rather than by
  severity. Visible only if you stack Cushing and neurogenic shock at once.
- No persistence beyond the first-run flag: reloading resets the patient and any
  case score.
- Nothing has been checked against a real browser — see below.

## What has and has not been verified

**Verified structurally:** the bundle boots, all nine workspaces mount and
render, both hosting paths work (Worker and in-page), both themes render, the
couplings fire and propagate, case options resolve to names, a deliberately
broken panel is isolated without stalling its siblings, and 30 physiology
assertions hold.

**Verified visually:** every canvas panel has been rendered offscreen at a
1440px viewport in both themes and inspected — `node scripts/render.mjs` boots
the real bundle against node-canvas, runs the simulation until the traces fill,
and writes a PNG per panel. That is how the four defects below were found and
fixed:

- the heart schematic drew the atrium and ventricle overlapping, with the aortic
  path running off the bottom of the frame;
- the body map stretched the figure sideways, because regions were mapped to raw
  canvas fractions rather than a fixed-aspect box;
- the anatomy graph dropped most of its level labels, because a minimum-gap
  cascade was fighting the overflow rescale;
- ECG traces were drawn at roughly a third of a sensible amplitude.

`scripts/browser.test.mjs` is the one that matters most for shipping: it loads
the actual `dist/index.html` in jsdom with a real canvas backend and checks that
the page boots, the chrome renders and every workspace mounts. Every other suite
bundles from `src/`, so none of them touches the step that inlines the bundle
into the HTML — which is precisely where a build can break while all the source
tests stay green.

**Still not verified:** CSS layout and typography, since jsdom does not lay out
and node-canvas renders the drawings but not the page around them. Grid behaviour at narrow widths, sticky
header stacking, scroll behaviour and touch interaction are unexercised.
