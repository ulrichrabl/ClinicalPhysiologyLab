# Brief: the patient figure

Last updated: 17 October 2026, after PR #33.

This brief is all you need to work on the bedside patient figure. The figure's code is in `src/vp/render/` (`patient-figure.ts` and `figure-*.ts`); this folder holds its bench, contract test and screenshot tools. The rest of the repository is large and nothing in it is needed, except where noted under "What you may change".

## What the figure is

The bedside view shows the whole patient on the trolley. The examiner can stand at three places, chosen with the Right / Front / Left buttons under the figure:

- the patient's right side (the profile; the default);
- the foot of the bed (from above when lying, face to face when sitting or standing);
- the patient's left side.

The figure is an anatomically correct, cartoon-style depiction:

- in the same visual family as the face canvas (`reference/face-canvas-*.png`);
- recognisably *this* patient;
- showing *what the illness does to the body*.

It was redrawn from capsules to an anatomical body in PRs #26–#30. Views were added in #31, and front anatomy (shoulders, clavicles, pectorals, breasts, arm placement) in #31 and #33. Every part of the original job is done: body shape from the patient, the model's findings, gown, hair, oxygen, trolley, human-looking transitions, all acceptance checks.

The owner is a clinician who reviews the pictures closely. Their feedback has always been about anatomy ("the shoulders look like…", "the pillow flies away"). Judge your own work at zoom, against how a real body looks from that side, before showing it. Show close-ups along with the contact sheets.

## How the figure is built

| File | What it does |
|---|---|
| `patient-figure.ts` | `FigureLook` and `figureLookFor`; `POSES` and `lerpPose`; `figureSvg`, which assembles everything. Also: placement on the bed or floor, the trolley, backrest and pillow, the views and walking round the bed, where the arms hang (`armZ`), the front shoulder shape (`shoulderShape`), lighting, layers and touch regions. |
| `figure-body.ts` | `bodyShape`: every part as *stations* along its bone (`s`, front depth `a`, back depth `p`, half-width `w`, in reference cm = 1/176 of height), changed by sex, age, BMI, fat distribution, muscle, oedema, ascites and hyperinflation. `skeleton`: joints from the pose angles, with a lumbar curve. `trunk3` and `limb3`: silhouettes as seen. |
| `figure-view.ts` | `Projector`: a light 3D model. The profile is turned about the trunk's axis (turn 0 = right profile, 90 = front, −90 = back; side −1 mirrors for the left). `tube` gives silhouettes and end sections; `onTube` gives points on a part's surface. |
| `figure-front.ts` | What only shows from the front or back: head outline and face, hair, ears, `chestFront` (clavicles, pectorals, breasts, deltoid shading, ribs), `braFront`, gown lines, kneecaps. |
| `figure-head.ts` | The head in profile: outline, face, hair, ear, oxygen tubing and mask. |
| `figure-dress.ts` | The gown (cut from the body, hollows bridged, sleeves), the trolley, the bra in profile. |
| `figure-geom.ts` | Small geometry helpers. |
| `thorax.ts` | The chest examination views (auscultation, percussion, ECG electrodes). They draw this same body, standing, front and back (`figureSvg(..., { chestFrame: true })`). Electrode and landmark positions are in chest-frame cm. |

### Rules of the drawing

- **Layers:** parts in one layer are drawn as all outlines first, then all fills, so overlapping parts merge into one silhouette. The arms are separate layers drawn over the trunk.
- **Profile drawings:** drawings made in profile, such as the face, hair, folds and bra, are wrapped in the projector's matrix and fade out as the body turns. Their front counterparts fade in (`prof()` and `front()` in `figureSvg`).
- **Lighting:** light comes from the upper left of the picture. Each part normally gets its own gradient (`shadeAcross`). From the front and back, one wide gradient (`gWide`) covers chest, neck, shoulders and arms, so no colour seam shows where shoulder meets arm.
- **Soft shading:** shading in `chestFront` and `braFront` is blurred (an SVG filter with an `id` prefixed `fig-§-`) and clipped to the torso.

## Anatomical decisions (agreed with the owner)

### Shoulders from the front

The clavicle carries the shoulder line out to the acromion. Across the acromions it is about 40 cm in a man and 37 in a woman (`shoulderZ`, `acro` in `figure-body.ts`). The trapezius slopes briefly beside the neck, then the line runs nearly level.

The deltoid is the top of the arm (the upper-arm stations start with it). From the front and back it is drawn as one convex arc from the acromion down and out into the arm (`shoulderShape`). It stands out beyond the arm and narrows to its insertion. It joins the trunk without a line, and the arm proper starts under it.

There is no dome on the inner side. The deltopectoral groove runs down from the outer clavicle, and the arm parts from the trunk at the armpit. The gown's sleeve is cut from the same shape.

Two earlier attempts were rejected:
- a cap over a hanging arm, which reads as "a profile shoulder";
- a steep bottle-neck slope, which reads as "no clavicles".

### Clavicles

They sit a few cm *below* the shoulder line, with a band of trapezius between. The jugular notch is about 50.9 on the trunk scale, the neck root 54. They are drawn as an S with sternal heads, a lit upper edge, shade below and the hollows above. They are clearer in women and lean patients, and fainter with fat.

### Arms

The arms hang *beside* the chest wall and the breast, never through them. At the armpit or bust level the arm's inner edge lies at the side of the chest or breast, overlapping it a little. The humerus is straight, so the elbow swings out as far as that needs, but by at most 4 cm, so a relaxed arm rests against a full chest instead of standing off like a wing (`armZ`).

### Hands (seen from the side)

From the side the hand is drawn whole from a template in its own centimetres (`render/figure-hand.ts`): the back of the hand toward the viewer, its wrist rows taking the forearm's own width so the two join without a step, and one shading light along the whole arm so the elbow shows no seam. Pointing (finger–nose): the index straight, the other fingers folded into a loose fist, the thumb laid along them. At rest: the fingers together and a little bent (more in distress), foreshortened as they bend; seen edge-on when the hand lies palm down, with its creases and nail hidden. Held out (`Pose.outstretch`, pronator drift): the forearm's rotation decides how much of the back shows, edge-on palm up. From the front, a hand hanging at the side of an upright body is seen from its thumb edge (`radialHand`): the hand's depth laid across the body toward the palm (the thenar eminence 2.4 cm, the back 1.7), the fingers bending toward the palm joint by joint (a fist 90°, 100°, 70° at knuckle, middle and end joints, the folded pads hidden), the thumb laid along the index with its edge drawn; it takes the forearm's depth at the wrist. From the back a hanging hand shows its little-finger edge, the thumb hidden. A hand lying palm down (on the thighs from the front, on the bed from above) shows its back from `restingTemplate`, with knuckles, clefts and the nail, the thumb toward the midline. Held out or pointing, the front and back views keep the tube.

### Eyes closed

`Pose.eyes` (0 open, 1 closed) draws the lowered lid with its lashes and the lid's fold above, in profile and from the front, for the tests done with the eyes closed.

### Chest

- **Men:** pectoral mass lit from above, a lower border sweeping into the front of the armpit, and a sternal groove.
- **Women:** wear a plain bra when the chest is exposed. It is sized to the breast (`breastFront`), with shaded cups, a centre piece, the cleavage, the upper slope and the outer curve toward the armpit.

### Body shape

Shape is driven by the patient (`look.body`) and the model's findings. Below a BMI of about 18.5, bones show; above about 30, soft tissue. Central fat gives an apple shape and peripheral fat a pear. Wasted muscle gives thin limbs even with a big belly (cirrhosis). The model's findings drawn on the body are oedema, ascites, colour, sweating, hyperinflation and accessory muscles.

### Breathing

The figure breathes with the running lungs (`figureSvg(…, { breath })`, the litres above end-expiration; `figure-breath.ts`). The front of the rib cage comes forward as a whole, from the costal margin to the upper sternum, and the belly rises with the diaphragm; upright the rib cage takes more of the breath, lying the abdomen (Sharp 1975; the shares are assumed). With a paradoxical (weak) diaphragm the belly moves in as the chest moves out. A quiet breath moves the wall a few millimetres, so the motion is magnified (`GAIN`, assumed): it shows the rate, the rhythm, the relative depth and which wall moves which way, not centimetres. The ward redraws the figure with the breath every other frame between changes of position; the station's Look panel does the same. Still under `prefers-reduced-motion`.

### Bed and pillow

The backrest pivots on a fixed hinge. The pillow belongs to the head section, so it moves with the backrest and never flies off when the patient sits up (#29, #30).

## What you may change

- **The figure's code:** everything in `src/vp/render/patient-figure.ts` and `src/vp/render/figure-*.ts`, plus `thorax.ts` for the chest views. New `figure-*.ts` files are welcome. Keep files readable, with comments that say *why*.
- **`FigureLook`, `FigureBody`, `figureLookFor`:** add fields as needed. They are built only from the case's patient, the encounter state and the model's findings; the app never assembles a look itself.
- **`Pose` and `POSES`:** change freely, as long as every position name stays.
- **Bench data:** `studio/figure/build.mjs` (bench-only patients) and `patients.json` (`node studio/figure/snapshot.mjs`, about 30 s, only if cases change).
- **The app** (`src/vp/app/`): the view buttons and the transitions live in `app.ts` (`figView`, `renderFigure`). Change it only when a figure feature needs it, and say so in the PR.

## The contract (what the app relies on)

These rules are checked by `contract.test.mjs` (part of `npm test`) and by `shoot.py`.

1. **Exports:**
   - `figureSvg(pose, look, view?, opts?)`: SVG markup that goes inside `<g id="fig">` of `<svg id="figure" viewBox="0 0 360 380">`. Keep that viewBox. `view` comes from `viewAt(angle)`. `opts`: `scene`, `head`, `chestFrame`, `collect` (used by `thorax.ts`, the arrest scene and the ECT scene; besides the touch regions it reports `wrist`, `thigh`, `ankle`, `elbow`, `upperArm` and `forearm` (two points) per side and `headFrame`, the head's origin and unit axes as drawn, which `render/ect-scene.ts` uses to place pads and leads on the side of the head, and the cuff and EMG on the arm).
   - `figureLookFor(patient, state, seed, findings?)`.
   - `POSES` with every position: `supine, reclined-45, sitting, sitting-forward, left-lateral, standing, prone, head-hanging-left, head-hanging-right`.
   - `lerpPose(a, b, t)`; `VIEW_ANGLE` (`right` 0, `front` 90, `left` 180) and `viewAt`.
2. **Touch regions:** groups with `data-region="head" | "neck" | "chest" | "abdomen"`, and `data-region="arm" | "legs"` with `data-side="R" | "L"` (the patient's right or left).
   - They must be drawn in every pose and every view, stay inside the viewBox, and be tappable.
   - Decorative layers (gown, hair, bed, tubing, shading) need `pointer-events="none"`.
   - The far limbs may be hidden in some profile poses; `shoot.py` reports that only as a note.
3. **No highlighting:** the examiner chooses where to look. The app darkens a hovered region slightly.
4. **Speed:** markup only, deterministic, a few ms per figure. The app redraws every frame of a transition.
5. **Self-contained:**
   - No external images or fonts.
   - Gradient, filter and clip `id`s are `fig-§-…`; `§` is replaced by a hash of the figure, so several figures can share a page.
   - Respect `prefers-reduced-motion`.
6. **Fit:** the panel is about 316 px wide on desktop and full width on phones, light and dark. Check `out/app-desktop*.png` and `out/app-phone-dark.png`.
7. **Body response:** the drawing responds to sex, age, BMI, fat distribution, muscle, long hair, baldness only where described, oedema, ascites, jaundice, pallor, cyanosis, sweating, hyperinflation and oxygen. This is checked in pairs. The breath moves the chest and belly (outward on inspiration, the belly inward when paradoxical), and no breath draws the figure exactly as before.

## The loop

Run everything from `source/`.

```sh
sh studio/figure/run.sh            # build, contract, poses/states/body/views/chest sheets, touch check (~15 s)
python3 studio/figure/shoot.py zoom <patient-id> <pose> [chest,abdomen] [right|front|left]   # one figure at 720 px
python3 studio/figure/shoot.py motion [patient-id]   # transitions in frames
sh studio/figure/run.sh views      # also the walk round the bed for every patient (views-all.png)
sh studio/figure/run.sh app        # the figure inside the real app page: desktop right/front/left, dark phone
add `dark` to any shoot.py command; `sh studio/figure/run.sh all` for everything
```

Look at the PNGs in `out/` (Read tool), fix the code, and run again.

- **Order:** judge anatomy at zoom first, cropping and enlarging with PIL, then check the contact sheets. A figure has to work at 190 px as well as at 720 px.
- **Stale files:** `zoom-*` file names do not include the exposure, so a later zoom without `chest` overwrites one with it. Re-shoot before you judge.

The sheets in `out/`:

- **`poses.png`:** 9 patients (young and old, F and M, slim and heavy, skin tones 1–6, varied hair, cirrhosis and COPD) × 6 poses, from the right.
- **`body.png`:** obesity (central, peripheral), cachexia, cirrhosis, heart failure, COPD, jaundice and cyanosis. Columns: gown and bare at 45°, bare lying flat, sitting, standing.
- **`views.png`:** reclined from the right, front and left; supine, sitting and standing from the front; and a walk round the bed.
- **`chest.png`:** the chest examination views, front, back, and with landmarks and electrodes.
- **`states.png`:** gown, exposures, oxygen.

Useful zoom ids:

| Patient | Id |
|---|---|
| Man | `exertional-syncope-as` |
| Thin man with ascites | `decompensated-cirrhosis` |
| COPD | `copd-exacerbation` |
| Women | `pneumonia-right-lower-lobe`, `graves-thyrotoxicosis`, `diabetic-ketoacidosis` |

## Checking a change

- `sh studio/figure/run.sh all` reports 0 contract failures and 0 touch problems.
- `npm run verify` passes. Then run `git checkout -- node_modules dist` before committing (see `docs/HANDOVER.md`).
- Visual: every patient is recognisably themselves and anatomically plausible in every pose *and every view*. A clinician looking at the cirrhosis row should say "decompensated cirrhosis" before reading the label.
- Delivery:
  - Commit on a branch from a fresh `main`.
  - Open a PR with before/after images. They go on the `figure-anatomy-images` branch, because `out/` is ignored.

## Open

- **Side view shoulder:** the arm, deltoid included, is drawn whole with its own outline over the trunk. It reads acceptably, but the shoulder does not merge into the trunk the way the front view now does.
- **Gown from the front:** no bust shaping (no drape or fold under the breasts) and no pectoral form.
- **Hands held out, seen from the front or back:** still the tube. Hand examinations seen from the front with the hands held out (asterixis, tremor) would need the hand seen end-on.
- **Lying women from above:** long hair spread on the pillow reads as a dark blob.
- **Animations of examinations:** pose the skeleton (`Pose` angles), not the outlines. Done (`render/neuro-motion.ts`): pronator drift, finger–nose, tone, the arm and leg reflexes with the plantar response, heel–shin, rapid alternating movements, Romberg (front view), gait, the pull test (from the side: the examiner behind, the body tilted about the heels, steps back; tape on the floor marks the start). The fields they added to `Pose`, all interpolated: `point`, `outstretch` (forearm rotation), `eyes` (closed at ≥ 0.5), `legOut` (the leg's lateral offset, for a broad base), `fist` (the resting hand curled, toward 88°), `toe` (the big toe about the forefoot, +up: 55° extensor plantar, −20° flexor).

## Reference images (in `reference/`)

- `app-bedside-before.png`: the figure before the redraw, next to the face canvas.
- `face-canvas-eyes.png`, `face-canvas-facial.png`: the style to match. Note the soft shading, warm skin, fine hair strokes and the muted teal-grey background.
