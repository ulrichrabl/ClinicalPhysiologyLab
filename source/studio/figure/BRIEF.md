# Brief: a better patient figure

This brief is self-contained. **Do not read the rest of the repository**: everything needed is in this folder and in `src/vp/render/patient-figure.ts`. The rest of the code is large, and nothing in it is needed for this job.

## The job

The bedside view shows the whole patient in profile, on the trolley, seen from the right side of the bed where the examiner stands. Today that figure is built from rounded strokes:

- capsule limbs and a circle head with a triangle nose;
- every patient looks the same apart from skin colour;
- hair is a short arc, so everyone looks bald, women included;
- no age, no build, no clothing beyond a blue tube.

The owner finds it cheap and unattractive. Compare `reference/app-bedside-before.png` (the figure today, left) with the face in the same screenshot: the face canvas used for the eye and cranial-nerve examinations is soft, shaded, anatomically proportioned and believable.

**Goal:** a figure in the same visual family as that face, recognisably *this* patient. Specifically:

- **Sex:** female and male body shapes.
- **Age:** posture, hair greying or thinning, some softness in the elderly.
- **Build:** slim, average or heavy (`look.build`).
- **Hair from the case description** (`look.hairText`, for example `"long, dark blonde"`, `"dark brown, tied back"`, `"white, set in curls"`, `"grey, receding"`, `"grey, thinning"`, `"black, braids tied back"`). Long hair falls with gravity when lying. Baldness only where the text says so (receding, thinning).
- **Skin tones 1–6:** all must look natural, with shading.
- **A hospital gown that reads as cloth:** folds and a hem. It must open for the exposed chest and abdomen; a woman's bare chest is drawn tastefully. In the current exposure design, a bare-chested woman is shown in a bra or with a draped gown. Choose a respectful solution.
- **Oxygen when on:** `look.oxygen` holds a device text. Draw nasal cannula tubing for "nasal…", and a mask for "mask", "Venturi" or "reservoir".
- **The trolley:** a bed that matches the new style, without stealing attention.
- **Smooth position changes:** today the legs swing out of the frame mid-way from lying to sitting; see `out/motion.png`. A transition should look like a person moving, not limbs rotating through the bed.

The eyes and face canvas are not part of this job (`render/face-canvas.ts`). Do not change them.

## What you may change

- `src/vp/render/patient-figure.ts`: everything inside it. New files next to it (`src/vp/render/figure-*.ts`) are fine. Keep each file readable, with comments that say *why*, in the style of the existing header comment.
- `FigureLook` and `figureLookFor`: add fields as needed. They are built only from the case's patient and state; the app never assembles a look itself.
- `Pose` and `POSES`: change freely (more joints, a spine curve, head turn, and so on), as long as every position name stays.

Do not change anything else. If something outside seems to need a change, write it down for the owner instead.

## The contract (what the app relies on)

These rules are checked by `contract.test.mjs` (part of `npm test`) and by `shoot.py`.

1. **Exports:**
   - `figureSvg(pose, look): string` returns SVG markup that goes inside `<g id="fig">` of `<svg id="figure" viewBox="0 0 360 380">`. Keep that viewBox.
   - `figureLookFor(patient, state, seed): FigureLook`.
   - `POSES` with every position: `supine, reclined-45, sitting, sitting-forward, left-lateral, standing, prone, head-hanging-left, head-hanging-right`.
   - `lerpPose(a, b, t)`, which the app calls every animation frame for 700 ms with an eased `t`.
2. **Touch regions:** groups with `data-region="head" | "neck" | "chest" | "abdomen"`, and `data-region="arm" | "legs"` with `data-side="R"` (near) or `"L"` (far).
   - They must be drawn in every pose, stay inside the viewBox, and the near-side ones must be tappable somewhere.
   - Purely decorative layers (gown, hair, bed, tubing) need `pointer-events="none"`, so taps go through to the body.
   - The far limbs may be hidden in some poses; shoot.py reports that as a note, not a failure.
3. **No highlighting:** the examiner chooses where to look. Hover is already a slight darkening via the app's CSS (`#figure [data-region]:hover`).
4. **Speed:** markup only, deterministic (same input, same output), under 2 ms per figure; transitions redraw every frame.
5. **Self-contained:**
   - No external images or fonts.
   - Gradients and filters are fine, but their `id`s must be unique and stable. Prefix them with `fig-`, because the page has one figure.
   - Respect `prefers-reduced-motion`: the app already skips the transition, so never add motion that only CSS could stop.
6. **Fit:** the figure panel is about 316 px wide on desktop and full width on phones, light and dark. The bed and floor colours sit on the panel background (`--surface`), so check `out/app-phone-dark.png`.

## The loop

Run everything from `source/`.

```sh
sh studio/figure/run.sh            # build bench, contract test, poses.png + states.png, touch check  (~10 s)
python3 studio/figure/shoot.py motion [patient-id]        # transitions in frames
python3 studio/figure/shoot.py zoom <patient-id> <pose> [chest,abdomen]   # one figure at 720 px
sh studio/figure/run.sh app        # the figure inside the real app page: out/app-desktop.png, out/app-phone-dark.png
add `dark` to any shoot.py command for dark mode; `sh studio/figure/run.sh all` for everything (all 20 patients)
```

Look at the PNGs in `out/` with your image viewer (Read tool), fix the code, and run again.

- **Contact sheet:** `poses.png` shows 9 patients (rows: young and old, F and M, slim and heavy, skin tones 1–6, varied hair) × 6 poses. It is the main thing to judge.
- **Close-ups:** use `zoom` for detail, `motion` for transitions, and `app` at the end of each round to confirm the fit.
- **Patient ids** for `zoom` and `motion`: the case ids in `src/vp/cases/` (only their `patient` block matters), plus `bench-m-28-tone6`, `bench-f-55-tone5` and `bench-m-45-free`.

## Done means

- `sh studio/figure/run.sh all` passes: 0 contract failures and 0 touch problems. Motion frames stay inside the frame.
- `cd source && npm run verify` passes.
- In `poses.png` every patient is recognisably themselves: sex, age, build, skin and hair as described. In every pose they read as a person on a trolley.
- `app-desktop.png` and `app-phone-dark.png` look at home next to the face canvas.
- Commit on a branch with a message that says what changed and why.
  - End the commit message with the session's `Co-Authored-By` / `Claude-Session` lines.
  - Open a PR whose body ends with the Claude Code line and the session link.
  - Before/after images go in the PR, not in the repo; `out/` is ignored by git.

## Reference images (in `reference/`)

- `app-bedside-before.png`: today's figure next to the face canvas.
- `face-canvas-eyes.png`, `face-canvas-facial.png`: the style to match. Note the soft shading, warm skin, fine hair strokes and the muted teal-grey background.
