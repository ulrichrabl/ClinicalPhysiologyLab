# Brief: an anatomically correct patient

This brief is self-contained. **Do not read the rest of the repository**: everything needed is in this folder and in `src/vp/render/patient-figure.ts`. The rest of the code is large, and nothing in it is needed for this job.

## The job

The bedside view shows the whole patient in profile, on the trolley, seen from the right side of the bed where the examiner stands.

**Goal:** an anatomically correct, cartoon-style depiction of the patient:

- in the same visual family as the face canvas (`reference/face-canvas-*.png`);
- recognisably *this* patient;
- showing *what the illness does to the body*.

### Why the figure looks like boxes today

Every body segment is one thick stroked line with round caps between two joints:

- a capsule each for thigh, shin, upper arm, forearm and trunk;
- a circle with a triangle nose for the head.

There is no outline of a body, so there is no shoulder, no waist, no hip, no calf, no buttock, no breast, no neck taper, no hand and no foot. No amount of tuning capsules fixes that. Throw the capsules away.

### How to draw it instead

1. **Keep a skeleton for posing.** Joints are placed by angles, as now; extend it as needed (spine curve with lumbar and thoracic segments, shoulder girdle, head tilt, hands and feet). `lerpPose` interpolates it.
2. **Hang a body outline on the skeleton.** Each part is a closed outline of smooth curves (cubic Béziers), defined in the part's own frame and placed by its joint.
   - Use anatomical widths, measured as a fraction of height.
   - Use contour points where real bodies have them: deltoid, biceps and triceps, forearm taper; buttock, thigh, knee, calf bulge, Achilles, heel; the S-curve of the back; chest and abdomen profiles.
   - Joints blend: a knee looks like a knee whether bent or straight. Draw joint caps or overlapping outlines, not hinges.
3. **Proportions.**
   - An adult is about 7.5 heads tall. The crotch is at about half of height, the elbow at the waist, the fingertips at mid-thigh.
   - Shoulders are wider than hips in men; hips are relatively wider in women.
   - The head is an egg in profile, with jaw, chin, nose, lips, brow ridge and ear in their places. It is never a circle.
4. **Cartoon style.**
   - Clean outlines (a slightly darker skin shade, not black) and flat base colours.
   - Soft shading with one or two gradients per part, light from the upper left, as in the face canvas.
   - No photorealism and no muscle-man anatomy: a believable person, simplified.
5. **Body shape from the patient, varying continuously.**
   - **Height** sets the overall scale (the trolley stays the same).
   - **BMI** (`look.body.bmi`) sets widths. Below about 18.5, show bony prominences (clavicles, ribs, iliac crest, temporal hollowing, thin limbs). Above about 30, show soft tissue: belly, double chin, upper arms, thighs.
   - **Fat distribution** (`look.body.fat`): `central` puts the extra on the belly (an apple shape, with visceral fat bulging forward, firm); `peripheral` puts it on the hips, buttocks and thighs (a pear shape).
   - **Muscle** (`look.body.muscle`): `wasted` means thin limbs, hollow temples and a prominent shoulder bone even when the belly is big. Cirrhosis shows exactly that.
   - **Sex and age:**
     - Breasts are under the gown in women. With the chest exposed, a woman wears the gown draped over the breasts or a plain bra. Choose a respectful solution.
     - In the elderly: some kyphosis, thinner limbs, a softer belly, grey or white hair.
   - **Hair from `look.hairText`:** long hair falls with gravity when lying; there are buns, plaits, curls and bobs. Baldness appears only where the text says receding or thinning.
6. **What the model says, drawn** (`look.body`, from the running physiology; the figure updates when it changes):
   - **Oedema** `ankle | shin | knee`: puffy legs up to that level, ankle contours lost, no visible tendons.
   - **Ascites** `flank | shifting | tense`: from full flanks to a tense, round, protruding belly with an everted navel. When lying, it bulges at the flanks.
   - **Colour** `pale | grey | flushed | cyanosed | jaundiced`: tint the skin, more subtly than a recolour; lips and nail beds show cyanosis first. Use `icterus` and `pallor` for degree.
   - **Sweating:** a sheen, as a few highlights.
   - **Distress:** posture (gripping, tense) and expression, if the head allows.
   - **Breathing:** `hyperinflated` means a barrel chest; `accessory` means visible neck muscles; `pursedLips` purses the lips.
7. **Clothing and equipment.**
   - A hospital gown that reads as cloth: folds, a hem, sleeves, and drape that follows the pose. It opens for exposed chest and abdomen.
   - Oxygen as `look.oxygen` names it: nasal cannula tubing over the ears, or a face mask with tubing.
   - A trolley that matches the style without stealing attention.
8. **Movement that looks human.** The app animates between poses for 700 ms with an eased `t`. A transition must look like a person sitting up or lying down: legs swing over the edge, the trunk rises; limbs never rotate through the mattress. Today the legs leave the frame mid-way; see `out/motion.png`.

The face canvas (`render/face-canvas.ts`) is the style reference only. Do not change it.

## What you may change

- **`src/vp/render/patient-figure.ts`:** everything inside it.
  - New files next to it (`src/vp/render/figure-*.ts`, for example body outlines, hair, gown) are welcome.
  - Keep files readable, with comments that say *why*, in the style of the existing header comment.
- **`FigureLook`, `FigureBody` and `figureLookFor`:** add fields as needed. They are built only from the case's patient, the encounter state and the model's findings; the app never assembles a look itself.
- **`Pose` and `POSES`:** change freely (more joints, spine curve, head turn), as long as every position name stays.
- **Bench data:**
  - `studio/figure/build.mjs`, for more bench-only patients.
  - `patients.json`, by rerunning `node studio/figure/snapshot.mjs`: the case patients with the model's findings at the start of each case. It takes about 30 s and is only needed if cases change.

Do not change anything else. If something outside seems to need a change, write it down for the owner instead.

## The contract (what the app relies on)

These rules are checked by `contract.test.mjs` (part of `npm test`) and by `shoot.py`.

1. **Exports:**
   - `figureSvg(pose, look): string`: SVG markup that goes inside `<g id="fig">` of `<svg id="figure" viewBox="0 0 360 380">`. Keep that viewBox.
   - `figureLookFor(patient, state, seed, findings?): FigureLook`.
   - `POSES` with every position: `supine, reclined-45, sitting, sitting-forward, left-lateral, standing, prone, head-hanging-left, head-hanging-right`.
   - `lerpPose(a, b, t)`.
2. **Touch regions:** groups with `data-region="head" | "neck" | "chest" | "abdomen"`, and `data-region="arm" | "legs"` with `data-side="R"` (near) or `"L"` (far).
   - They must be drawn in every pose, stay inside the viewBox, and the near-side ones must be tappable.
   - Decorative layers (gown, hair, bed, tubing, highlights) need `pointer-events="none"`.
   - The far limbs may be hidden in some poses; shoot.py reports that only as a note.
3. **No highlighting:** the examiner chooses where to look. The app darkens a hovered region slightly.
4. **Speed:** markup only, deterministic, under 2 ms per figure; the app redraws every frame of a transition.
5. **Self-contained:**
   - No external images or fonts.
   - Gradient and filter `id`s are prefixed `fig-`.
   - Respect `prefers-reduced-motion`: the app already skips the transition, so never add motion that only CSS could stop.
6. **Fit:** the panel is about 316 px wide on desktop and full width on phones, light and dark. Check `out/app-desktop.png` and `out/app-phone-dark.png`.

## The loop

Run everything from `source/`.

```sh
sh studio/figure/run.sh            # build, contract + acceptance, poses/states/body sheets, touch check  (~10 s)
python3 studio/figure/shoot.py motion [patient-id]        # transitions in frames
python3 studio/figure/shoot.py zoom <patient-id> <pose> [chest,abdomen]   # one figure at 720 px: judge anatomy here
sh studio/figure/run.sh app        # the figure inside the real app page (light desktop, dark phone)
add `dark` to any shoot.py command; `sh studio/figure/run.sh all` for everything
```

Look at the PNGs in `out/` (Read tool), fix the code, and run again. Judge anatomy at zoom first, then check the contact sheets: a figure has to work at 190 px as well as at 720 px.

- **`poses.png`:** 9 patients (young and old, F and M, slim and heavy, skin tones 1–6, varied hair, cirrhosis and COPD from the case library) × 6 poses.
- **`body.png`:** central and peripheral obesity, cachexia, cirrhosis (wasted limbs, tense ascites, oedema, jaundice), heart failure with oedema to the knees, COPD, deep jaundice, cyanosis.
  - Columns: gown and bare at 45°, bare lying flat, sitting, standing.
- **`states.png`:** gown, exposures, oxygen.
- **Patient ids:** the case ids in `patients.json` plus the bench-only ids in `build.mjs`.

## Done means

- **Checks:**
  - `sh studio/figure/run.sh all` reports 0 contract failures and 0 touch problems.
  - **All acceptance checks pass:** the drawing responds to sex, age, BMI, fat distribution, muscle, long hair, baldness only where described, oedema, ascites, jaundice, pallor, cyanosis, sweating, hyperinflation and oxygen. Today all 15 fail.
  - Motion frames stay inside the frame.
  - `cd source && npm run verify` passes.
- **Visual:** in `poses.png` and `body.png` every patient is recognisably themselves and anatomically plausible in every pose. A clinician looking at the cirrhosis row should say "decompensated cirrhosis" before reading the label.
- **Fit:** `app-desktop.png` and `app-phone-dark.png` look at home next to the face canvas.
- **Delivery:**
  - Commit on a branch with a message that says what changed and why.
  - End the commit message with the session's `Co-Authored-By` / `Claude-Session` lines.
  - Open a PR whose body ends with the Claude Code line and the session link. Before/after images go in the PR; `out/` is ignored by git.
  - When it lands, move the acceptance checks from `FIGURE_ACCEPTANCE` into the normal contract test.

## Reference images (in `reference/`)

- `app-bedside-before.png`: today's figure next to the face canvas.
- `face-canvas-eyes.png`, `face-canvas-facial.png`: the style to match. Note the soft shading, warm skin, fine hair strokes and the muted teal-grey background.
