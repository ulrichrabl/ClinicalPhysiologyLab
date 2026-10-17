# ADR-016 appendix: inventory

Generated from the catalog, the 17 cases and the draft tables in `adr-016/`. Draft for review; nothing here is wired into the app yet.

> **Superseded for the case columns by `docs/knowledge-coverage.md`** (step 1, #37), which is generated from the real tables and models. Building step 1 corrected this draft in six places:
>
> 1. **Resting vital signs:** this draft read the standing half of the lying-and-standing test, so it overstated hypotension and tachycardia in the septic, bleeding and Addisonian cases. The signs are now defined "not standing". Lying, the septic-shock case is 92/67 and the bleed is 115/80 with a pulse of 79; both are recorded as exceptions with their numbers.
> 2. **Thready pulse** also counts a low-volume pulse above 100/min, so the septic case shows it.
> 3. **A third heart sound** is no longer linked to aortic stenosis. The card says "third or fourth"; this patient rightly has an S4.
> 4. **End-point nystagmus** is read from the model's `physiological` flag (#36). Gaze-evoked nystagmus excludes it, so it needs no amplitude threshold: nine assumed thresholds, not ten.
> 5. **The localiser patterns** are named predicates (myotomal, dermatomal, hemisensory, crossed).
> 6. **`variant-of`** lives only in the relation table, not also on the sign row.

## Summary

- **202 signs**, deduplicated from 265 card findings (205 distinct texts). 25 syndromes. 447 relations.
- Representation: 156 model; 40 not represented; 5 case layer only; 1 needs an intervention context.
- **79 signs are produced by at least one case** when their definition is evaluated on the model.
- Signs with a definition that no case produces: 82.

Columns: **Shown by** lists every place the app presents the observables the sign is defined on. **Cases** are the cases whose model output meets the definition. **Gap** records where the model or a view falls short, for a later run.

## Signs

### Vital signs

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Tachycardia**<br>Tachykardie<br>`tachycardia` | `vitals.hr` gt 100<br>Threshold: > 100 /min (standard) | `measure.hr`, `measure.bp.lying-standing` | text | acute-stroke-left-mca, pneumonia-right-lower-lobe, pulmonary-embolism-after-flight, copd-exacerbation, diabetic-ketoacidosis, urosepsis-septic-shock, upper-gi-bleed-peptic-ulcer, graves-thyrotoxicosis, addisonian-crisis |  |
| **Bradycardia**<br>Bradykardie<br>`bradycardia` | `vitals.hr` lt 60<br>Threshold: < 60 /min (standard) | `measure.hr`, `measure.bp.lying-standing` | text | — |  |
| **Hypotension**<br>Hypotonie<br>`hypotension` | `vitals.bp.systolic` lt 90 or `meanPressureBelow(value=65)`<br>Threshold: systolic < 90 or mean < 65 mmHg (standard) | `measure.bp`, `measure.bp.lying-standing` | text | urosepsis-septic-shock, upper-gi-bleed-peptic-ulcer, addisonian-crisis |  |
| **Wide pulse pressure**<br>Große Blutdruckamplitude<br>`wide-pulse-pressure` | `pulsePressureAtLeast(value=60)`<br>Threshold: pulse pressure ≥ 60 mmHg (assumed) | `measure.bp`, `measure.bp.lying-standing` | text | acute-stroke-left-mca |  |
| **Narrow pulse pressure**<br>Kleine Blutdruckamplitude<br>`narrow-pulse-pressure` | `pulsePressureBelowFraction(value=0.25)`<br>Threshold: pulse pressure < 25 % of systolic (standard) | `measure.bp`, `measure.bp.lying-standing` | text | pneumonia-right-lower-lobe, pulmonary-embolism-after-flight, copd-exacerbation, diabetic-ketoacidosis |  |
| **Orthostatic hypotension**<br>Orthostatische Hypotonie<br>`orthostatic-hypotension` | `ctxDelta(obs=vitals.bp, path=systolic, frm={'position': 'supine'}, to={'position': 'standing'}, op=le, value=-20)` or `ctxDelta(obs=vitals.bp, path=diastolic, frm={'position': 'supine'}, to={'position': 'standing'}, op=le, value=-10)`<br>Threshold: fall ≥ 20 systolic or ≥ 10 diastolic within 3 min (standard) | `measure.bp`, `measure.bp.lying-standing` | text | aki-hyperkalaemia-triple-whammy, diabetic-ketoacidosis, urosepsis-septic-shock, upper-gi-bleed-peptic-ulcer, addisonian-crisis |  |
| **Postural rise in heart rate**<br>Orthostatischer Pulsanstieg<br>`postural-tachycardia` | `ctxDelta(obs=vitals.hr, path=, frm={'position': 'supine'}, to={'position': 'standing'}, op=ge, value=30)`<br>Threshold: rise ≥ 30 /min (McGee) (standard) | `measure.hr`, `measure.bp.lying-standing` | text | diabetic-ketoacidosis, addisonian-crisis |  |
| **Tachypnoea**<br>Tachypnoe<br>`tachypnoea` | `vitals.rr` gt 20<br>Threshold: > 20 /min (standard) | `measure.rr`, `inspect.breathing` | text | pneumonia-right-lower-lobe, pulmonary-embolism-after-flight, copd-exacerbation, urosepsis-septic-shock, decompensated-cirrhosis |  |
| **Bradypnoea**<br>Bradypnoe<br>`bradypnoea` | `vitals.rr` lt 10<br>Threshold: < 10 /min (standard) | `measure.rr`, `inspect.breathing` | text | — |  |
| **Low oxygen saturation**<br>Erniedrigte Sauerstoffsättigung<br>`hypoxaemia` | `vitals.spo2.spo2` lt 94 and `vitals.spo2.fio2` le 0.21<br>Threshold: SpO₂ < 94 % on air (standard) | `measure.spo2` | text | pulmonary-embolism-after-flight, copd-exacerbation |  |
| **Saturation that does not rise with oxygen**<br>Sättigung steigt unter O₂ kaum an<br>`refractory-hypoxaemia` | `spo2OnOxygenBelow(value=94, fio2=0.4)`<br>Threshold: SpO₂ < 94 % at FiO₂ ≥ 0.4 (assumed) | `measure.spo2` | text | — | Elicited by an intervention (oxygen), not by a test: the sign of shunt. Not evaluated: needs the oxygen context. |
| **Fever**<br>Fieber<br>`fever` | `vitals.temp` ge 38.0<br>Threshold: ≥ 38.0 °C (standard) | `measure.temp` | text | pneumonia-right-lower-lobe, urosepsis-septic-shock, decompensated-cirrhosis |  |
| **Hypothermia**<br>Hypothermie<br>`hypothermia` | `vitals.temp` lt 35.0<br>Threshold: < 35.0 °C (standard) | `measure.temp` | text | — | The card also counts < 36 °C in an unwell patient; that is a sepsis criterion, not hypothermia. Decide. |

### General inspection

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Sweating (diaphoresis)**<br>Schweißausbruch (Diaphorese)<br>`diaphoresis` | `general.appearance.sweating` eq true | `inspect.general` | text, bedside figure | vestibular-neuritis-left, pneumonia-right-lower-lobe, copd-exacerbation, urosepsis-septic-shock, upper-gi-bleed-peptic-ulcer, graves-thyrotoxicosis |  |
| **Grey, ashen complexion**<br>Fahlgraues Hautkolorit<br>`ashen-complexion` | `general.appearance.colour` eq "grey" | `inspect.general` | text, bedside figure | — |  |
| **Pallor**<br>Blässe<br>`pallor` | `general.appearance.colour` eq "pale" | `inspect.general` | text, bedside figure | vestibular-neuritis-left, aki-hyperkalaemia-triple-whammy, diabetic-ketoacidosis, upper-gi-bleed-peptic-ulcer |  |
| **Central cyanosis**<br>Zentrale Zyanose<br>`central-cyanosis` | `general.appearance.colour` eq "cyanosed" | `inspect.general` | text, bedside figure | — |  |
| **Mottled skin**<br>Marmorierte Haut<br>`skin-mottling` | — | — | — | not represented |  |
| **Drowsiness, reduced consciousness**<br>Bewusstseinsminderung (Somnolenz)<br>`reduced-consciousness` | — | — | — | not represented | AVPU exists as patient state, not as an observable; it cannot be examined or named yet. |
| **Agitation**<br>Agitiertheit<br>`agitation` | — | — | — | not represented |  |
| **Visible distress**<br>Sichtbare Not<br>`visible-distress` | `general.appearance.distress` in ["moderate", "severe"] | `inspect.general` | text, bedside figure | vestibular-neuritis-left, pneumonia-right-lower-lobe, copd-exacerbation, diabetic-ketoacidosis, urosepsis-septic-shock, addisonian-crisis |  |
| **Tripod position**<br>Kutschersitz<br>`tripod-position` | — | — | — | not represented |  |

### Skin

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Hyperpigmentation of creases and mucosa**<br>Hyperpigmentierung von Handlinien und Schleimhaut<br>`hyperpigmentation` | `skin.pigmentation.pigmentation` eq "increased" | `inspect.pigmentation` | text | addisonian-crisis | Text only; the figure does not darken creases or mucosa. |
| **Spider naevi**<br>Spider-Nävi<br>`spider-naevi` | `skin.liver-stigmata.spiderNaevi` eq true | `inspect.skin` | text | decompensated-cirrhosis | Text only. |
| **Reduced skin turgor (tenting)**<br>Verminderter Hautturgor (stehende Hautfalte)<br>`reduced-skin-turgor` | `skin.turgor.turgor` eq "reduced" | `test.turgor` | text | exertional-syncope-as, copd-exacerbation, aki-hyperkalaemia-triple-whammy, diabetic-ketoacidosis, hyponatraemia-thiazide, addisonian-crisis, hypercalcaemia-malignancy |  |

### Hands

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Prolonged capillary refill**<br>Verlängerte Rekapillarisierungszeit<br>`capillary-refill-prolonged` | `hands.crt` abnormal<br>Threshold: above the normal for age and sex (Schriger & Baraff) (measured) | `measure.crt` | text | — |  |
| **Asterixis (flapping tremor)**<br>Asterixis (Flapping Tremor)<br>`asterixis` | `hands.asterixis.flap` eq true | `test.asterixis` | text | decompensated-cirrhosis | Text only; a movement, so a candidate for the animation topic. |
| **Fine postural tremor**<br>Feinschlägiger Haltetremor<br>`fine-postural-tremor` | `hands.tremor.tremor` eq "fine" | `test.tremor` | text | graves-thyrotoxicosis | Text only; animation candidate. |
| **Palmar erythema**<br>Palmarerythem<br>`palmar-erythema` | `skin.liver-stigmata.palmarErythema` eq true | `inspect.skin` | text | decompensated-cirrhosis | Text only. |
| **Leukonychia**<br>Leukonychie<br>`leukonychia` | — | — | — | not represented |  |

### Eyes

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Jaundice (scleral icterus)**<br>Ikterus (Sklerenikterus)<br>`jaundice` | `eyes.sclera.icterus` in ["mild", "marked"] or `general.appearance.colour` eq "jaundiced" | `inspect.general`, `inspect.sclera` | text, bedside figure | decompensated-cirrhosis | The eye close-up and the face view are drawn from the fixed appearance: a jaundiced patient has white sclerae there, while the bedside figure is yellow. |
| **Conjunctival pallor**<br>Konjunktivale Blässe<br>`conjunctival-pallor` | `eyes.conjunctiva.pallor` in ["mild", "marked"] | `inspect.conjunctiva` | text, bedside figure | iron-deficiency-anaemia-caecal | Not drawn in the eye close-up or face view (fixed appearance); the bedside figure pales. |
| **Lid retraction**<br>Oberlidretraktion (Dalrymple-Zeichen)<br>`lid-retraction` | `eyes.thyroid.lidRetraction` eq true | `inspect.thyroid-eyes` | text | graves-thyrotoxicosis | Text only: the eye close-up draws the lids from ptosis alone, so retraction is not visible. |
| **Lid lag**<br>Lidretardation (Graefe-Zeichen)<br>`lid-lag` | `eyes.thyroid.lidLag` eq true | `inspect.thyroid-eyes` | text | graves-thyrotoxicosis | Text only; would need the eye close-up to follow a downward gaze. |
| **Exophthalmos (proptosis)**<br>Exophthalmus<br>`exophthalmos` | `eyes.thyroid.exophthalmos` eq true | `inspect.thyroid-eyes` | text | graves-thyrotoxicosis | Text only; not drawn in the eye close-up or face view. |
| **Chemosis**<br>Chemosis<br>`chemosis` | — | — | — | not represented |  |
| **Ptosis**<br>Ptosis<br>`ptosis` | `eye.lid.ptosisMm` ge 2 in {"gaze": "primary"}<br>Threshold: lid ≥ 2 mm lower than normal (assumed) | `inspect.eyes` | text, eye close-up | — | Qualifiers: side; partial / complete; fatigable |
| **Fatigable ptosis**<br>Belastungsabhängige Ptosis<br>`fatigable-ptosis` · variant of `ptosis` | `ctxDelta(obs=eye.lid, path=ptosisMm, frm={'gaze': 'primary'}, to={'sustainedSeconds': 60}, op=ge, value=2, side=True)`<br>Threshold: lid sinks ≥ 2 mm during 60 s of upgaze (assumed) | `inspect.eyes`, `test.sustained-upgaze` | text, eye close-up | — |  |
| **Anisocoria**<br>Anisokorie<br>`anisocoria` | `sideDiff(obs=eye.pupil, path=sizeMm, ctx={'lightOn': 'none', 'ambient': 'room'}, value=1.0)`<br>Threshold: difference ≥ 1 mm (up to 0.5 mm is common) (assumed) | `inspect.eyes`, `inspect.eyes.dim`, `test.pupils.light` | text, eye close-up | — |  |
| **Anisocoria greater in the dark**<br>Anisokorie im Dunkeln zunehmend<br>`dilation-lag` · variant of `anisocoria` | `anisocoriaGrowsInDim()` | `inspect.eyes`, `inspect.eyes.dim`, `test.pupils.light` | text, eye close-up | — |  |
| **Dilated pupil not reacting to light**<br>Weite, lichtstarre Pupille<br>`fixed-dilated-pupil` | `eye.pupil.reaction` eq "absent" | `inspect.eyes`, `inspect.eyes.dim`, `test.pupils.light` | text, eye close-up | — |  |
| **Relative afferent pupillary defect**<br>Relative afferente Pupillenstörung (Marcus-Gunn-Pupille)<br>`afferent-pupillary-defect` | `eyes.swinging-light.rapd` in ["L", "R"] | `test.swinging-light` | text, eye close-up | — |  |
| **Eye down and out**<br>Bulbus nach unten außen abgewichen<br>`eye-down-and-out` | `eyeDownAndOut()` | `test.eye-movements` | text, eye close-up | — |  |
| **Failure of abduction**<br>Abduktionsdefizit<br>`abduction-deficit` | `eye.motility.abduction` lt 90<br>Threshold: abduction < 90 % of normal (assumed) | `test.eye-movements` | text, eye close-up | — |  |
| **Double vision that varies and worsens with effort**<br>Wechselnde, belastungsabhängige Doppelbilder<br>`variable-diplopia` | — | — | — | not represented | Eye motility has no fatigue context. |
| **Spontaneous nystagmus**<br>Spontannystagmus<br>`spontaneous-nystagmus` | `eyes.nystagmus.present` eq true in {"gaze": "primary"} | `inspect.eyes`, `test.eye-movements`, `test.frenzel` | text, eye close-up | vestibular-neuritis-left |  |
| **Unidirectional horizontal-torsional nystagmus, stronger without fixation**<br>Richtungsbestimmter horizontal-torsioneller Nystagmus, ohne Fixation stärker<br>`unidirectional-nystagmus` | `nystagmusPeripheral()` | `inspect.eyes`, `test.eye-movements`, `test.frenzel` | text, eye close-up | vestibular-neuritis-left |  |
| **Direction-changing gaze-evoked nystagmus**<br>Blickrichtungsnystagmus mit Richtungswechsel<br>`gaze-evoked-nystagmus` | `nystagmusDirectionChanging(minAmplitude=1.0)`<br>Threshold: amplitude ≥ 1° in lateral gaze (assumed) | `inspect.eyes`, `test.eye-movements`, `test.frenzel` | text, eye close-up | — |  |
| **End-point nystagmus (normal)**<br>Endstellnystagmus (physiologisch)<br>`endpoint-nystagmus` · normal variant | `nystagmusEndPoint(maxAmplitude=1.0)` | `inspect.eyes`, `test.eye-movements`, `test.frenzel` | text, eye close-up | exertional-syncope-as, acute-stroke-left-mca, foot-drop-right-l5, pneumonia-right-lower-lobe, pulmonary-embolism-after-flight, copd-exacerbation, aki-hyperkalaemia-triple-whammy, diabetic-ketoacidosis, hyponatraemia-thiazide, urosepsis-septic-shock, upper-gi-bleed-peptic-ulcer, decompensated-cirrhosis, iron-deficiency-anaemia-caecal, graves-thyrotoxicosis, addisonian-crisis, hypercalcaemia-malignancy | Today every patient is told "on looking left: horizontal jerk nystagmus…" in all four directions. Naming it as a normal variant fixes a teaching error. |
| **Vertical or torsional nystagmus, or not suppressed by fixation**<br>Vertikaler oder rein torsioneller Nystagmus, oder ohne Fixationssuppression<br>`central-nystagmus` | `nystagmusCentral()` | `inspect.eyes`, `test.eye-movements`, `test.frenzel` | text, eye close-up | — |  |
| **Saccadic (jerky) pursuit**<br>Sakkadierte Blickfolge<br>`saccadic-pursuit` | `eyes.pursuit.quality` eq "saccadic" | `test.eye-movements` | text | — | Not drawn: the eye close-up does not read eyes.pursuit. |
| **Catch-up saccade on head impulse**<br>Pathologischer Kopfimpulstest (Refixationssakkade)<br>`head-impulse-positive` | `eye.head-impulse.saccade` in ["covert", "overt"] | `test.head-impulse` | text, eye close-up | vestibular-neuritis-left |  |
| **Skew deviation (vertical refixation on cover)**<br>Vertikale Divergenz (Skew deviation)<br>`skew-deviation` | `eyes.alignment.verticalPD` gt 0 | `test.cover` | text, eye close-up | — |  |
| **Horizontal misalignment on cover test**<br>Horizontales Schielen im Abdecktest<br>`horizontal-tropia` | `eyes.alignment.horizontal` in ["eso", "exo"] | `test.cover` | text, eye close-up | — |  |
| **Homonymous hemianopia**<br>Homonyme Hemianopsie<br>`homonymous-hemianopia` | `fieldHomonymous()` | `test.visual-fields` | text | — | Text only: svg.field is declared but not wired to a visual. |
| **Bitemporal hemianopia**<br>Bitemporale Hemianopsie<br>`bitemporal-hemianopia` | `fieldBitemporal()` | `test.visual-fields` | text | — |  |
| **Central scotoma**<br>Zentralskotom<br>`central-scotoma` | — | — | — | not represented | The field model has temporal and nasal halves only. |
| **Papilloedema**<br>Stauungspapille<br>`papilloedema` | `eye.fundus.disc` eq "swollen" | `test.fundoscopy` | text | — | Case layer only; svg.fundus is declared but not wired. |
| **Pale optic disc**<br>Optikusatrophie (blasse Papille)<br>`optic-atrophy` | `eye.fundus.disc` eq "pale" | `test.fundoscopy` | text | — |  |

### Mouth

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Dry mucous membranes**<br>Trockene Schleimhäute<br>`dry-mucosa` | `mouth.mucosa.moisture` in ["dry", "parched"] | `inspect.mouth` | text | copd-exacerbation, aki-hyperkalaemia-triple-whammy, diabetic-ketoacidosis, addisonian-crisis, hypercalcaemia-malignancy |  |
| **Glossitis**<br>Glossitis<br>`glossitis` | — | — | — | not represented |  |
| **Angular cheilitis**<br>Mundwinkelrhagaden (Cheilitis angularis)<br>`angular-cheilitis` | — | — | — | not represented |  |
| **Pursed-lip breathing**<br>Lippenbremse<br>`pursed-lip-breathing` | `breathing.pattern.pursedLips` eq true | `inspect.breathing` | text, bedside figure | copd-exacerbation |  |
| **Uvula deviates to one side**<br>Uvulaabweichung<br>`uvula-deviation` | `mouth.palate.uvulaDeviatesTo` in ["L", "R"] | `test.palate` | text | — |  |
| **Absent gag reflex**<br>Fehlender Würgreflex<br>`absent-gag` | `mouth.palate.gagLeft` eq false or `mouth.palate.gagRight` eq false | `test.palate` | text | — |  |
| **Nasal, fading voice**<br>Näselnde, leiser werdende Stimme<br>`nasal-speech` | `mouth.palate.voice` eq "fading-nasal" | `test.palate` | text | — |  |
| **Tongue deviates on protrusion**<br>Zungenabweichung beim Herausstrecken<br>`tongue-deviation` | `mouth.tongue.deviatesTo` in ["L", "R"] | `test.tongue` | text | acute-stroke-left-mca |  |
| **Tongue wasting**<br>Zungenatrophie<br>`tongue-wasting` | `mouth.tongue.wasting` eq true | `test.tongue` | text | — |  |
| **Tongue fasciculation**<br>Zungenfaszikulationen<br>`tongue-fasciculation` | `mouth.tongue.fasciculation` eq true | `test.tongue` | text | — |  |

### Breath

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Ketotic breath (pear drops)**<br>Azetongeruch<br>`ketotic-breath` | `breath.odour.odour` eq "ketones" | `smell.breath` | text | diabetic-ketoacidosis |  |
| **Fetor hepaticus**<br>Foetor hepaticus<br>`fetor-hepaticus` | — | — | — | not represented | No code in the odour value set. |
| **Uraemic fetor**<br>Foetor uraemicus<br>`uraemic-fetor` | `breath.odour.odour` eq "uraemic" | `smell.breath` | text | — | The value exists; no model produces it yet. |

### Neck

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Diffuse goitre**<br>Diffuse Struma<br>`diffuse-goitre` | `neck.thyroid.goitre` eq "diffuse" | `palpate.thyroid` | text | graves-thyrotoxicosis | Text only; the neck in the figure does not swell. |
| **Nodular goitre**<br>Knotige Struma<br>`nodular-goitre` | `neck.thyroid.goitre` eq "nodular" | `palpate.thyroid` | text | — |  |
| **Thyroid bruit**<br>Schwirren über der Schilddrüse<br>`thyroid-bruit` | `neck.thyroid.bruit` eq true | `palpate.thyroid` | text | graves-thyrotoxicosis |  |
| **Tender thyroid**<br>Druckschmerzhafte Schilddrüse<br>`thyroid-tenderness` | — | — | — | not represented |  |
| **Raised JVP**<br>Erhöhter Jugularvenendruck<br>`raised-jvp` | `jvp.heightCm` gt 4<br>Threshold: > 4 cm above the sternal angle at 45° (assumed) | `inspect.jvp` | text | decompensated-cirrhosis | Text only: the svg.neck renderer is declared but no visual is wired to it. |
| **JVP not visible, even lying flat**<br>Halsvenen auch im Liegen nicht gefüllt<br>`jvp-not-visible` | `jvp.heightCm` le -2 in {"position": "supine"}<br>Threshold: column top ≥ 2 cm below the sternal angle, so below the clavicle when flat (assumed) | `inspect.jvp` | text | diabetic-ketoacidosis, addisonian-crisis | The model keeps the height constant across positions, as the sternal-angle convention says it should. Today the text calls these heights normal (card exception for ketoacidosis); the sign resolves it. |
| **Cannon a waves**<br>Kanonenwellen<br>`cannon-a-waves` | `jvp.waveform` eq "cannon-a" | `inspect.jvp` | text | — |  |
| **Carotid bruit**<br>Strömungsgeräusch über der Karotis<br>`carotid-bruit` | — | — | — | not represented | The carotid site returns heart sounds, so an aortic murmur is heard there (transmitted), but a bruit from carotid stenosis is not modelled. |
| **Tracheal deviation**<br>Trachealverlagerung<br>`tracheal-deviation` | `trachea.position.position` in ["L", "R"] | `palpate.trachea` | text | — | Toward or away from the abnormal side is a qualifier derived with the lung signs. |
| **Weak shoulder shrug**<br>Schwäche beim Schulterheben<br>`weak-shrug` | `shoulder.shrug.power` lt 5 | `test.shrug` | text | — |  |

### Pulse

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Irregularly irregular pulse**<br>Absolute Arrhythmie<br>`irregularly-irregular-pulse` | `pulse.radial.rhythm` eq "irregularly-irregular" | `palpate.pulse.radial` | text, pulse trace + sound | acute-stroke-left-mca |  |
| **Collapsing (water-hammer) pulse**<br>Pulsus celer et altus (Wasserhammerpuls)<br>`collapsing-pulse` | `pulse.radial.character` eq "collapsing" or `pulse.carotid.character` eq "collapsing" | `palpate.pulse.radial`, `palpate.pulse.carotid` | text, pulse trace + sound | — |  |
| **Bounding pulse**<br>Pulsus magnus (kräftiger Puls)<br>`bounding-pulse` | `pulse.radial.character` eq "bounding" or `pulse.carotid.character` eq "bounding" | `palpate.pulse.radial`, `palpate.pulse.carotid` | text, pulse trace + sound | — |  |
| **Weak, fast (thready) pulse**<br>Fadenförmiger Puls<br>`thready-pulse` | `pulse.radial.character` eq "thready" or `pulse.carotid.character` eq "thready" | `palpate.pulse.radial`, `palpate.pulse.carotid` | text, pulse trace + sound | — |  |
| **Slow-rising, small-volume pulse**<br>Pulsus parvus et tardus<br>`slow-rising-pulse` | `pulse.radial.character` eq "slow-rising" or `pulse.carotid.character` eq "slow-rising" | `palpate.pulse.radial`, `palpate.pulse.carotid` | text, pulse trace + sound | exertional-syncope-as |  |
| **Double-peaked (bisferiens) pulse**<br>Pulsus bisferiens<br>`bisferiens-pulse` | — | — | — | not represented |  |

### Heart

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Ejection systolic murmur**<br>Spindelförmiges Systolikum (Austreibungsgeräusch)<br>`ejection-systolic-murmur` | `heart.sounds.murmurs` hasWhere {"timing": "ejection-systolic"} | `auscultate.heart.aortic`, `auscultate.heart.pulmonary`, `auscultate.heart.erb`, `auscultate.heart.tricuspid`, `auscultate.heart.mitral`, `auscultate.heart.apex-bell-left-lateral`, `auscultate.heart.lse-sitting-forward`, `auscultate.carotid` | text, sound + phonocardiogram | exertional-syncope-as |  |
| **Pansystolic murmur**<br>Holosystolikum<br>`pansystolic-murmur` | `heart.sounds.murmurs` hasWhere {"timing": "pansystolic"} | `auscultate.heart.aortic`, `auscultate.heart.pulmonary`, `auscultate.heart.erb`, `auscultate.heart.tricuspid`, `auscultate.heart.mitral`, `auscultate.heart.apex-bell-left-lateral`, `auscultate.heart.lse-sitting-forward`, `auscultate.carotid` | text, sound + phonocardiogram | — | Radiation (to the axilla, to the carotids) is not modelled. |
| **Pansystolic murmur louder on inspiration**<br>Inspiratorisch lauteres Holosystolikum (Carvallo-Zeichen)<br>`carvallo-sign` · variant of `pansystolic-murmur` | — | — | — | not represented | No inspiration context is observed at the tricuspid area. |
| **Systolic murmur louder on standing or straining**<br>Systolikum lauter im Stehen oder beim Pressen<br>`dynamic-outflow-murmur` · variant of `ejection-systolic-murmur` | — | — | — | not represented |  |
| **Early diastolic murmur**<br>Frühdiastolisches Decrescendo<br>`early-diastolic-murmur` | `heart.sounds.murmurs` hasWhere {"timing": "early-diastolic"} | `auscultate.heart.aortic`, `auscultate.heart.pulmonary`, `auscultate.heart.erb`, `auscultate.heart.tricuspid`, `auscultate.heart.mitral`, `auscultate.heart.apex-bell-left-lateral`, `auscultate.heart.lse-sitting-forward`, `auscultate.carotid` | text, sound + phonocardiogram | — |  |
| **Mid-diastolic rumble**<br>Mesodiastolisches Rumpeln<br>`mid-diastolic-murmur` | `heart.sounds.murmurs` hasWhere {"timing": "mid-diastolic"} | `auscultate.heart.aortic`, `auscultate.heart.pulmonary`, `auscultate.heart.erb`, `auscultate.heart.tricuspid`, `auscultate.heart.mitral`, `auscultate.heart.apex-bell-left-lateral`, `auscultate.heart.lse-sitting-forward`, `auscultate.carotid` | text, sound + phonocardiogram | — |  |
| **Opening snap**<br>Mitralöffnungston<br>`opening-snap` | `heart.sounds.added` has "opening-snap" | `auscultate.heart.aortic`, `auscultate.heart.pulmonary`, `auscultate.heart.erb`, `auscultate.heart.tricuspid`, `auscultate.heart.mitral`, `auscultate.heart.apex-bell-left-lateral`, `auscultate.heart.lse-sitting-forward`, `auscultate.carotid` | text, sound + phonocardiogram | — |  |
| **Third heart sound**<br>Dritter Herzton<br>`third-heart-sound` | `heart.sounds.added` has "s3" | `auscultate.heart.aortic`, `auscultate.heart.pulmonary`, `auscultate.heart.erb`, `auscultate.heart.tricuspid`, `auscultate.heart.mitral`, `auscultate.heart.apex-bell-left-lateral`, `auscultate.heart.lse-sitting-forward`, `auscultate.carotid` | text, sound + phonocardiogram | — |  |
| **Fourth heart sound**<br>Vierter Herzton<br>`fourth-heart-sound` | `heart.sounds.added` has "s4" | `auscultate.heart.aortic`, `auscultate.heart.pulmonary`, `auscultate.heart.erb`, `auscultate.heart.tricuspid`, `auscultate.heart.mitral`, `auscultate.heart.apex-bell-left-lateral`, `auscultate.heart.lse-sitting-forward`, `auscultate.carotid` | text, sound + phonocardiogram | exertional-syncope-as, acute-stroke-left-mca |  |
| **Soft or absent aortic second sound**<br>Leiser oder fehlender Aortenklappenschlusston<br>`soft-a2` | `heart.sounds.a2` in ["soft", "absent"] | `auscultate.heart.aortic`, `auscultate.heart.pulmonary`, `auscultate.heart.erb`, `auscultate.heart.tricuspid`, `auscultate.heart.mitral`, `auscultate.heart.apex-bell-left-lateral`, `auscultate.heart.lse-sitting-forward`, `auscultate.carotid` | text, sound + phonocardiogram | exertional-syncope-as |  |
| **Loud P2**<br>Betonter Pulmonalklappenschlusston<br>`loud-p2` | `heart.sounds.p2` eq "loud" | `auscultate.heart.aortic`, `auscultate.heart.pulmonary`, `auscultate.heart.erb`, `auscultate.heart.tricuspid`, `auscultate.heart.mitral`, `auscultate.heart.apex-bell-left-lateral`, `auscultate.heart.lse-sitting-forward`, `auscultate.carotid` | text, sound + phonocardiogram | — |  |
| **Fixed splitting of S2**<br>Fixe Spaltung des 2. Herztons<br>`fixed-split-s2` | `heart.sounds.s2Split` eq "fixed" | `auscultate.heart.aortic`, `auscultate.heart.pulmonary`, `auscultate.heart.erb`, `auscultate.heart.tricuspid`, `auscultate.heart.mitral`, `auscultate.heart.apex-bell-left-lateral`, `auscultate.heart.lse-sitting-forward`, `auscultate.carotid` | text, sound + phonocardiogram | — |  |
| **Pericardial friction rub**<br>Perikardreiben<br>`pericardial-rub` | — | — | — | not represented | No rub in the heart-sounds value set. |

### Chest and lungs

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Gynaecomastia**<br>Gynäkomastie<br>`gynaecomastia` | — | — | — | not represented |  |
| **Displaced apex beat**<br>Verlagerter Herzspitzenstoß<br>`displaced-apex` | `apex.position` in ["lateral", "inferolateral"] | `palpate.apex` | text | — |  |
| **Heaving, sustained apex beat**<br>Hebender Herzspitzenstoß<br>`heaving-apex` | `apex.character` eq "heaving" | `palpate.apex` | text | exertional-syncope-as, acute-stroke-left-mca |  |
| **Use of accessory muscles**<br>Einsatz der Atemhilfsmuskulatur<br>`accessory-muscle-use` | `breathing.pattern.accessory` eq true | `inspect.breathing` | text, bedside figure | copd-exacerbation |  |
| **Unable to speak in full sentences**<br>Sprechdyspnoe<br>`speech-limited` | `breathing.pattern.speech` in ["phrases", "words", "unable"] | `inspect.breathing` | text | pneumonia-right-lower-lobe, copd-exacerbation, urosepsis-septic-shock |  |
| **Deep breathing (hyperpnoea)**<br>Vertiefte Atmung (Hyperpnoe)<br>`deep-breathing` | `breathing.pattern.depth` eq "deep" | `inspect.breathing` | text | pneumonia-right-lower-lobe, pulmonary-embolism-after-flight, diabetic-ketoacidosis, graves-thyrotoxicosis | Text only: the figure does not show the depth of breathing. Called Kussmaul breathing when the cause is a metabolic acidosis: that is interpretation, not observation, so it lives on the link to ketoacidosis rather than in the definition. |
| **Cheyne–Stokes breathing**<br>Cheyne-Stokes-Atmung<br>`cheyne-stokes` | — | — | — | not represented |  |
| **Paradoxical breathing**<br>Paradoxe Atmung<br>`paradoxical-breathing` | `breathing.pattern.paradoxical` eq true | `inspect.breathing` | text | — |  |
| **Barrel-shaped chest**<br>Fassthorax<br>`barrel-chest` | `breathing.pattern.hyperinflated` eq true | `inspect.breathing` | text, bedside figure | copd-exacerbation |  |
| **Breathless lying flat (orthopnoea)**<br>Orthopnoe<br>`orthopnoea` | — | — | — | not represented | Breathing pattern does not depend on position in the model; the card hangs it on a positioning intervention. |
| **Scars or a device on the chest**<br>Narben oder Aggregat am Thorax<br>`chest-scars` | — | — | — | not represented |  |
| **Reduced chest expansion**<br>Verminderte Thoraxexkursion<br>`reduced-chest-expansion` | `chest.expansion.expansion` eq "reduced" | `palpate.chest-expansion` | text | pneumonia-right-lower-lobe, copd-exacerbation | Qualifiers: one side / both sides |
| **Bronchial breathing**<br>Bronchialatmen<br>`bronchial-breathing` | `lung.sounds.breath` eq "bronchial" | `auscultate.lung-upper-zone`, `auscultate.lung-mid-zone`, `auscultate.lung-axilla`, `auscultate.lung-upper-back`, `auscultate.lung-base` | text, chest view + sound | pneumonia-right-lower-lobe |  |
| **Reduced or absent breath sounds**<br>Abgeschwächtes oder aufgehobenes Atemgeräusch<br>`reduced-breath-sounds` | `lung.sounds.breath` in ["reduced", "absent"] | `auscultate.lung-upper-zone`, `auscultate.lung-mid-zone`, `auscultate.lung-axilla`, `auscultate.lung-upper-back`, `auscultate.lung-base` | text, chest view + sound | copd-exacerbation |  |
| **Wheeze**<br>Giemen<br>`wheeze` | `lung.sounds.added` has "wheeze" | `auscultate.lung-upper-zone`, `auscultate.lung-mid-zone`, `auscultate.lung-axilla`, `auscultate.lung-upper-back`, `auscultate.lung-base` | text, chest view + sound | copd-exacerbation |  |
| **Fine crackles**<br>Feinblasige Rasselgeräusche<br>`fine-crackles` | `lung.sounds.added` has "fine-crackles" | `auscultate.lung-upper-zone`, `auscultate.lung-mid-zone`, `auscultate.lung-axilla`, `auscultate.lung-upper-back`, `auscultate.lung-base` | text, chest view + sound | decompensated-cirrhosis |  |
| **Coarse crackles**<br>Grobblasige Rasselgeräusche<br>`coarse-crackles` | `lung.sounds.added` has "coarse-crackles" | `auscultate.lung-upper-zone`, `auscultate.lung-mid-zone`, `auscultate.lung-axilla`, `auscultate.lung-upper-back`, `auscultate.lung-base` | text, chest view + sound | pneumonia-right-lower-lobe |  |
| **Pleural rub**<br>Pleurareiben<br>`pleural-rub` | `lung.sounds.added` has "rub" | `auscultate.lung-upper-zone`, `auscultate.lung-mid-zone`, `auscultate.lung-axilla`, `auscultate.lung-upper-back`, `auscultate.lung-base` | text, chest view + sound | — | The value exists; no model produces it yet. |
| **Stony dull percussion**<br>Absolute Dämpfung (Schenkelschall)<br>`stony-dull-percussion` | `chest.percussion.note` eq "stony-dull" | `percuss.lung-upper-zone`, `percuss.lung-mid-zone`, `percuss.lung-axilla`, `percuss.lung-upper-back`, `percuss.lung-base` | text, chest view + sound | — |  |
| **Dull percussion note**<br>Gedämpfter Klopfschall<br>`dull-percussion` | `chest.percussion.note` eq "dull" | `percuss.lung-upper-zone`, `percuss.lung-mid-zone`, `percuss.lung-axilla`, `percuss.lung-upper-back`, `percuss.lung-base` | text, chest view + sound | pneumonia-right-lower-lobe |  |
| **Hyper-resonant percussion note**<br>Hypersonorer Klopfschall<br>`hyper-resonant-percussion` | `chest.percussion.note` eq "hyper-resonant" | `percuss.lung-upper-zone`, `percuss.lung-mid-zone`, `percuss.lung-axilla`, `percuss.lung-upper-back`, `percuss.lung-base` | text, chest view + sound | copd-exacerbation |  |
| **Increased vocal resonance**<br>Verstärkte Bronchophonie<br>`increased-vocal-resonance` | `chest.resonance.resonance` eq "increased" | `resonance.lung-upper-zone`, `resonance.lung-mid-zone`, `resonance.lung-axilla`, `resonance.lung-upper-back`, `resonance.lung-base` | text, chest view + sound | pneumonia-right-lower-lobe |  |
| **Reduced vocal resonance**<br>Abgeschwächte Bronchophonie<br>`reduced-vocal-resonance` | `chest.resonance.resonance` in ["reduced", "absent"] | `resonance.lung-upper-zone`, `resonance.lung-mid-zone`, `resonance.lung-axilla`, `resonance.lung-upper-back`, `resonance.lung-base` | text, chest view + sound | copd-exacerbation |  |

### Abdomen

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Lies still, afraid to move**<br>Liegt still, vermeidet jede Bewegung<br>`lies-still-peritonism` | — | — | — | not represented |  |
| **Restless, writhing, cannot settle**<br>Unruhig, windet sich<br>`restless-writhing` | — | — | — | not represented |  |
| **Caput medusae**<br>Caput medusae<br>`caput-medusae` | `skin.liver-stigmata.caputMedusae` eq true | `inspect.skin` | text | decompensated-cirrhosis | Text only. |
| **Guarding and rigidity (peritonism)**<br>Abwehrspannung (Peritonismus)<br>`peritonism` | `abdomen.palpation.guarding` eq true | `palpate.abdomen` | text | — |  |
| **Abdominal tenderness**<br>Druckschmerz im Abdomen<br>`abdominal-tenderness` | `abdomen.palpation.tenderness` in ["mild", "marked"] | `palpate.abdomen` | text | diabetic-ketoacidosis, urosepsis-septic-shock, upper-gi-bleed-peptic-ulcer, decompensated-cirrhosis, addisonian-crisis, hypercalcaemia-malignancy (case layer) | Site is not modelled: right iliac fossa, epigastric and loin tenderness collapse into this one sign. |
| **Right iliac fossa tenderness**<br>Druckschmerz im rechten Unterbauch<br>`rif-tenderness` · variant of `abdominal-tenderness` | — | — | — | not represented | Needs a site in abdomen.palpation. |
| **Epigastric tenderness**<br>Epigastrischer Druckschmerz<br>`epigastric-tenderness` · variant of `abdominal-tenderness` | — | — | — | not represented |  |
| **Renal angle (loin) tenderness**<br>Nierenlagerklopfschmerz<br>`renal-angle-tenderness` · variant of `abdominal-tenderness` | — | — | — | not represented |  |
| **Abdomen does not move with breathing**<br>Fehlende Bauchatmung<br>`abdomen-still-on-breathing` | — | — | — | not represented |  |
| **Splenomegaly**<br>Splenomegalie<br>`splenomegaly` | — | — | — | not represented |  |
| **Hepatomegaly**<br>Hepatomegalie<br>`hepatomegaly` | — | — | — | not represented |  |
| **Palpable bladder**<br>Tastbare Harnblase<br>`palpable-bladder` | — | — | — | not represented |  |
| **Distended abdomen with full flanks**<br>Ausladendes Abdomen mit vorgewölbten Flanken<br>`abdominal-distension` | `abdomen.ascites.ascites` in ["flank", "shifting", "tense"] | `test.shifting-dullness` | text, bedside figure | decompensated-cirrhosis |  |
| **Shifting dullness**<br>Lageabhängige Flankendämpfung<br>`shifting-dullness` | `abdomen.ascites.ascites` in ["shifting", "tense"] | `test.shifting-dullness` | text, bedside figure | decompensated-cirrhosis |  |

### Rectal examination

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Melaena**<br>Meläna (Teerstuhl)<br>`melaena` | `rectal.exam.stool` eq "melaena" | `examine.rectal` | text | upper-gi-bleed-peptic-ulcer |  |
| **Fresh blood per rectum**<br>Frisches Blut rektal (Hämatochezie)<br>`fresh-blood-pr` | `rectal.exam.stool` eq "fresh-blood" | `examine.rectal` | text | — |  |
| **Rectal mass**<br>Rektaler Tumor<br>`rectal-mass` | — | — | — | not represented |  |
| **Lax anal tone**<br>Verminderter Sphinktertonus<br>`lax-anal-tone` | — | — | — | not represented |  |
| **Smoothly enlarged prostate**<br>Glatt vergrößerte Prostata<br>`enlarged-prostate` | — | — | — | not represented |  |

### Legs

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Pitting oedema**<br>Eindrückbare Ödeme<br>`pitting-oedema` | `legs.oedema.extent` in ["ankle", "shin", "knee"] | `inspect.legs` | text, bedside figure | decompensated-cirrhosis | legs.oedema is not paired: bilateral by construction. |
| **One swollen, warm, tender calf**<br>Einseitige, warme, druckschmerzhafte Wadenschwellung<br>`unilateral-calf-swelling` | — | — | — | not represented | Deep vein thrombosis: card exception today. |
| **Non-pitting swelling**<br>Nicht eindrückbare Schwellung<br>`non-pitting-oedema` | — | — | — | not represented |  |
| **Sustained clonus**<br>Unerschöpflicher Klonus<br>`sustained-clonus` | — | — | — | not represented |  |
| **Foot drop (weak dorsiflexion)**<br>Fußheberschwäche<br>`foot-drop` | `leg.power.ankleDorsiflexion` le 3<br>Threshold: MRC ≤ 3 (assumed) | `test.leg.power` | text | foot-drop-right-l5 | Qualifiers: inversion weak (L5) / spared (peroneal) |
| **Absent ankle reflex**<br>Fehlender Achillessehnenreflex<br>`absent-ankle-reflex` | `leg.reflexes.ankle` eq 0 | `test.leg.reflexes` | text | — |  |
| **Extensor plantar response (Babinski sign)**<br>Positives Babinski-Zeichen<br>`extensor-plantar` | `leg.reflexes.plantar` eq "extensor" | `test.leg.reflexes` | text | acute-stroke-left-mca |  |
| **Positive straight leg raise (Lasègue sign)**<br>Positives Lasègue-Zeichen<br>`positive-slr` | `leg.slr.positive` eq true | `test.slr` | text | foot-drop-right-l5 (case layer) | Case layer only. |
| **Stocking sensory loss**<br>Strumpfförmige Sensibilitätsstörung<br>`stocking-sensory-loss` | — | — | — | not represented | No length-dependent gradient in the sensory model. |

### Hearing

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Cannot repeat a whisper on one side**<br>Flüstersprache einseitig nicht verstanden<br>`whisper-not-heard` | `ear.whisper` eq "not-heard" (one side) | `test.whisper` | text | — |  |
| **Rinne negative**<br>Rinne negativ<br>`rinne-negative` | `ear.rinne` eq "negative" | `test.rinne` | text | — |  |
| **Weber lateralised**<br>Weber lateralisiert<br>`weber-lateralised` | `head.weber` in ["L", "R"] | `test.weber` | text | — | Qualifiers: to the deaf ear (conductive) / to the better ear (sensorineural): derived with the whisper and Rinne |

### Stance

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Romberg sign**<br>Romberg-Zeichen<br>`romberg-sign` | `rombergSign()` | `test.romberg` | text | — | Text only: svg.patient is declared for Romberg but no visual exists (animation topic). |
| **Falls to one side with the eyes closed**<br>Fallneigung zu einer Seite bei geschlossenen Augen<br>`lateral-fall-eyes-closed` | `posture.romberg.toward` in ["L", "R"] in {"eyesClosed": true} | `test.romberg` | text | vestibular-neuritis-left |  |
| **Unsteady even with the eyes open**<br>Rumpfataxie (Unsicherheit schon bei offenen Augen)<br>`truncal-ataxia` | `posture.romberg.stance` in ["sways", "falls"] in {"eyesClosed": false} | `test.romberg` | text | vestibular-neuritis-left |  |

### Gait

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Broad-based ataxic gait**<br>Breitbasig-ataktisches Gangbild<br>`ataxic-gait` | `gait.pattern.pattern` eq "ataxic" | `test.gait` | text | — | Text only (animation topic). |
| **Veers to one side when walking**<br>Gangabweichung zu einer Seite<br>`veering-gait` | `gait.pattern.pattern` eq "veers" | `test.gait` | text | vestibular-neuritis-left |  |
| **Hemiplegic gait (circumduction)**<br>Wernicke-Mann-Gangbild (Zirkumduktion)<br>`hemiplegic-gait` | `gait.pattern.pattern` eq "hemiplegic" | `test.gait` | text | acute-stroke-left-mca |  |
| **High-stepping (steppage) gait**<br>Steppergang<br>`steppage-gait` | `gait.pattern.pattern` eq "high-stepping" | `test.gait` | text | foot-drop-right-l5 |  |
| **Stamping, sensory ataxic gait**<br>Sensibel-ataktisches Gangbild<br>`sensory-ataxic-gait` | `gait.pattern.pattern` eq "sensory-ataxic" | `test.gait` | text | — |  |
| **Waddling gait**<br>Watschelgang<br>`waddling-gait` | `gait.pattern.pattern` eq "waddling" | `test.gait` | text | — |  |

### Face and cranial nerves

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Facial weakness including the forehead**<br>Periphere Fazialisparese (Stirn mitbetroffen)<br>`lmn-facial-weakness` | `facialWeakness(forehead=True)` | `test.face-movement` | text, face view | — |  |
| **Facial weakness sparing the forehead**<br>Zentrale Fazialisparese (Stirn ausgespart)<br>`umn-facial-weakness` | `facialWeakness(forehead=False)` | `test.face-movement` | text, face view | acute-stroke-left-mca |  |
| **Facial weakness on both sides**<br>Beidseitige Gesichtsschwäche<br>`bilateral-facial-weakness` | `facialWeakness(both=True)` | `test.face-movement` | text, face view | — |  |
| **Incomplete eye closure**<br>Unvollständiger Lidschluss (Lagophthalmus)<br>`incomplete-eye-closure` | `face.movement.eyeClosure` in ["weak", "absent"] | `test.face-movement` | text, face view | — |  |
| **Reduced facial sensation**<br>Hypästhesie im Gesicht<br>`facial-sensory-loss` | `face.sensation.V1` in ["reduced", "absent"] or `face.sensation.V2` in ["reduced", "absent"] or `face.sensation.V3` in ["reduced", "absent"] | `test.face-sensation` | text | — |  |
| **Absent corneal reflex**<br>Fehlender Kornealreflex<br>`absent-corneal-reflex` | `face.sensation.corneal` eq false | `test.face-sensation` | text | — |  |
| **Jaw deviates on opening**<br>Unterkieferabweichung beim Öffnen<br>`jaw-deviation` | `jaw.opening.deviatesTo` in ["L", "R"] | `test.jaw` | text | — |  |
| **Brisk jaw jerk**<br>Gesteigerter Masseterreflex<br>`brisk-jaw-jerk` | — | — | — | not represented |  |
| **Face on one side, body on the other**<br>Gekreuzte Sensibilitätsstörung<br>`crossed-sensory-loss` | `localiser(pattern=crossed-sensory)` | `test.face-sensation`, `test.arm.pinprick`, `test.leg.pinprick` | — | — |  |

### Speech

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Expressive (non-fluent) aphasia**<br>Expressive (nicht flüssige) Aphasie<br>`expressive-aphasia` | `speech.language.fluency` eq "impaired" and `speech.language.comprehension` eq "normal" | `test.speech` | text | acute-stroke-left-mca |  |
| **Receptive (fluent) aphasia**<br>Rezeptive (flüssige) Aphasie<br>`receptive-aphasia` | `speech.language.fluency` eq "normal" and `speech.language.comprehension` eq "impaired" | `test.speech` | text | — |  |
| **Dysarthria**<br>Dysarthrie<br>`dysarthria` | `speech.language.articulation` eq "dysarthric" | `test.speech` | text | acute-stroke-left-mca | Qualifiers: slurred / scanning / explosive (not modelled) |
| **Voice fades on counting**<br>Ermüdende Sprechweise beim Zählen<br>`fatigable-dysarthria` | `speech.fatigue.voice` in ["fading-nasal", "hoarse"] in {"repetition": 50} | `test.count-to-50` | text | — |  |
| **Runs out of breath counting**<br>Atemnot beim Zählen (verminderte Atemkapazität)<br>`reduced-single-breath-count` | — | — | — | not represented |  |

### Limbs: motor, coordination, sensory

| Sign (EN / DE) | Definition | Elicited by | Shown by | Cases | Gap / note |
|---|---|---|---|---|---|
| **Dysmetria**<br>Dysmetrie<br>`limb-dysmetria` | `arm.finger-nose.dysmetria` in ["mild", "marked"] or `leg.heel-shin.dysmetria` in ["mild", "marked"] | `test.finger-nose`, `test.heel-shin` | text | — | Qualifiers: arm / leg; side |
| **Intention tremor**<br>Intentionstremor<br>`intention-tremor` | `arm.finger-nose.intentionTremor` eq true or `leg.heel-shin.intentionTremor` eq true | `test.finger-nose`, `test.heel-shin` | text | — |  |
| **Accurate with eyes open, lost with eyes closed**<br>Zielunsicherheit nur bei geschlossenen Augen<br>`limb-ataxia-eyes-closed` | `ataxiaOnlyEyesClosed()` | `test.finger-nose`, `test.heel-shin` | text | — | Not elicitable: finger–nose and heel–shin are only observed with the eyes open, although the property supports eyesClosed. |
| **Dysdiadochokinesis**<br>Dysdiadochokinese<br>`dysdiadochokinesis` | `arm.rapid-alternating.dysdiadochokinesia` eq true | `test.rapid-alternating` | text | — |  |
| **Slow but regular alternating movements**<br>Verlangsamte, aber rhythmische Wechselbewegungen<br>`slowed-alternating-movements` | `arm.rapid-alternating.slowed` eq true and `arm.rapid-alternating.dysdiadochokinesia` eq false | `test.rapid-alternating` | text | acute-stroke-left-mca |  |
| **Spasticity**<br>Spastik<br>`spasticity` | `arm.tone.tone` eq "spastic" or `leg.tone.tone` eq "spastic" | `test.arm.tone`, `test.leg.tone` | text | acute-stroke-left-mca |  |
| **Rigidity (lead-pipe, cogwheel)**<br>Rigor (Zahnradphänomen)<br>`rigidity` | `arm.tone.tone` eq "rigid" or `leg.tone.tone` eq "rigid" | `test.arm.tone`, `test.leg.tone` | text | — | The value exists; there are no basal ganglia, so nothing produces it. |
| **Reduced tone**<br>Hypotonie (Muskeltonus)<br>`hypotonia` | `arm.tone.tone` eq "reduced" or `leg.tone.tone` eq "reduced" | `test.arm.tone`, `test.leg.tone` | text | — |  |
| **Muscle wasting**<br>Muskelatrophie<br>`muscle-wasting` | `arm.tone.wasting` eq true or `leg.tone.wasting` eq true | `test.arm.tone`, `test.leg.tone` | text | — |  |
| **Fasciculation**<br>Faszikulationen<br>`fasciculation` | `arm.tone.fasciculation` eq true or `leg.tone.fasciculation` eq true | `test.arm.tone`, `test.leg.tone` | text | — |  |
| **Weakness in a pyramidal pattern**<br>Paresen mit pyramidalem Verteilungsmuster<br>`pyramidal-weakness` | `pyramidalPattern()` | `test.arm.power`, `test.leg.power`, `test.power-repeated` | text | acute-stroke-left-mca |  |
| **Weakness in one myotome**<br>Paresen in einem Myotom<br>`myotomal-weakness` | `localiser(pattern=root-motor)` | `test.arm.power`, `test.leg.power`, `test.power-repeated` | — | foot-drop-right-l5 | A pattern over several muscles: computed by the neuro localiser, not a simple threshold. |
| **Symmetrical proximal weakness**<br>Symmetrische proximale Paresen<br>`proximal-symmetrical-weakness` | `symmetricalWeakness(distribution=proximal)` | `test.arm.power`, `test.leg.power`, `test.power-repeated` | text | — |  |
| **Symmetrical weakness rising from the feet**<br>Aufsteigende symmetrische Paresen<br>`ascending-weakness` | `symmetricalWeakness(distribution=distal)` | `test.arm.power`, `test.leg.power`, `test.power-repeated` | text | — |  |
| **Weakness that fades with repetition**<br>Belastungsabhängige Muskelschwäche<br>`fatigable-weakness` | `ctxDelta(obs=arm.power, path=shoulderAbduction, frm={}, to={'repetition': 20}, op=le, value=-1, side=True)` | `test.arm.power`, `test.power-repeated` | text | — |  |
| **Brisk reflexes**<br>Gesteigerte Muskeleigenreflexe<br>`hyperreflexia` | `arm.reflexes.biceps` ge 3 or `arm.reflexes.triceps` ge 3 or `arm.reflexes.supinator` ge 3 or `leg.reflexes.knee` ge 3 or `leg.reflexes.ankle` ge 3 | `test.arm.reflexes`, `test.leg.reflexes` | text | acute-stroke-left-mca |  |
| **Absent reflexes**<br>Areflexie<br>`areflexia` | `allReflexesAbsent()` | `test.arm.reflexes`, `test.leg.reflexes` | text | — |  |
| **Pronator drift**<br>Absinken mit Pronation im Armvorhalteversuch<br>`pronator-drift` | `arm.drift.drift` eq true | `test.pronator-drift` | text | acute-stroke-left-mca |  |
| **Arm rises or wanders, fingers restless**<br>Pseudoathetose (Arm steigt oder wandert)<br>`pseudoathetosis` | — | — | — | not represented |  |
| **Sensory loss in one dermatome**<br>Sensibilitätsstörung in einem Dermatom<br>`dermatomal-sensory-loss` | `localiser(pattern=root-sensory)` | `test.arm.pinprick`, `test.leg.pinprick` | — | foot-drop-right-l5 | Text only: svg.dermatomes is declared but not wired. |
| **Sensory loss over one half of the body**<br>Halbseitige Sensibilitätsstörung<br>`hemisensory-loss` | `localiser(pattern=hemisensory)` | `test.face-sensation`, `test.arm.pinprick`, `test.leg.pinprick` | — | — |  |
| **Loss of vibration and position sense distally**<br>Verminderte Pallästhesie und Lagesinn distal<br>`distal-vibration-loss` | `arm.vibration.vibration` in ["reduced", "absent"] or `leg.vibration.vibration` in ["reduced", "absent"] or `leg.vibration.proprioception` in ["reduced", "absent"] | `test.arm.vibration`, `test.leg.vibration` | text | — |  |
| **Sensory level on the trunk**<br>Sensibles Querschnittsniveau<br>`sensory-level` | `trunk.pinprick.T6` in ["reduced", "absent"] or `trunk.pinprick.T10` in ["reduced", "absent"] | `test.trunk.pinprick` | text | — |  |
| **Saddle anaesthesia**<br>Reithosenanästhesie<br>`saddle-anaesthesia` | `saddle.sensation.pinprick` in ["reduced", "absent"] | `test.saddle` | text | — |  |

## Syndromes

| Syndrome (EN / DE) | Signs (role) | Note |
|---|---|---|
| **Horner's syndrome**<br>Horner-Syndrom<br>`horner-syndrome` | `ptosis` (required), `anisocoria` (required), `dilation-lag` | Mild ptosis (Müller’s muscle) with the small pupil on the same side; anhidrosis is not modelled. |
| **Third nerve palsy**<br>Okulomotoriusparese<br>`third-nerve-palsy` | `ptosis` (required), `eye-down-and-out` (required), `fixed-dilated-pupil` | Complete ptosis; pupil involvement points to compression (aneurysm). |
| **Sixth nerve palsy**<br>Abduzensparese<br>`sixth-nerve-palsy` | `abduction-deficit` (required), `horizontal-tropia` |  |
| **Cerebellar syndrome**<br>Zerebelläres Syndrom<br>`cerebellar-syndrome` | `limb-dysmetria`, `intention-tremor`, `dysdiadochokinesis`, `ataxic-gait`, `truncal-ataxia`, `gaze-evoked-nystagmus`, `saccadic-pursuit`, `dysarthria`, `hypotonia` | Signs on the side of the lesion. |
| **Acute vestibular syndrome, peripheral pattern (HINTS)**<br>Akutes vestibuläres Syndrom, peripheres Muster (HINTS)<br>`peripheral-vestibular-pattern` | `unidirectional-nystagmus` (required), `head-impulse-positive` (required), `skew-deviation` (absent), `lateral-fall-eyes-closed`, `veering-gait` |  |
| **Acute vestibular syndrome, central pattern (HINTS)**<br>Akutes vestibuläres Syndrom, zentrales Muster (HINTS)<br>`central-vestibular-pattern` | `head-impulse-positive` (absent), `gaze-evoked-nystagmus`, `central-nystagmus`, `skew-deviation`, `truncal-ataxia` | Any one of a normal head impulse, direction-changing nystagmus or skew in acute continuous vertigo. |
| **Upper motor neuron syndrome**<br>Syndrom des 1. Motoneurons<br>`umn-syndrome` | `pyramidal-weakness`, `spasticity`, `hyperreflexia`, `extensor-plantar`, `pronator-drift`, `umn-facial-weakness`, `sustained-clonus` | Acute lesions may be flaccid for days. |
| **Lower motor neuron syndrome**<br>Syndrom des 2. Motoneurons<br>`lmn-syndrome` | `muscle-wasting`, `fasciculation`, `hypotonia`, `areflexia`, `absent-ankle-reflex` |  |
| **Lateral medullary (Wallenberg) syndrome**<br>Wallenberg-Syndrom<br>`lateral-medullary-syndrome` | `crossed-sensory-loss` (required), `ptosis`, `anisocoria`, `limb-dysmetria`, `uvula-deviation`, `skew-deviation`, `central-nystagmus` | Today a diagnosis id; here a syndrome whose cause is vertebral or PICA occlusion. |
| **Sensory ataxia (dorsal columns)**<br>Sensible Ataxie (Hinterstränge)<br>`dorsal-column-syndrome` | `romberg-sign` (required), `distal-vibration-loss` (required), `sensory-ataxic-gait`, `limb-ataxia-eyes-closed`, `pseudoathetosis` |  |
| **Cauda equina syndrome**<br>Kauda-equina-Syndrom<br>`cauda-equina-syndrome` | `saddle-anaesthesia` (required), `lax-anal-tone`, `palpable-bladder`, `absent-ankle-reflex` | Today a diagnosis id. |
| **Conductive hearing loss**<br>Schallleitungsschwerhörigkeit<br>`conductive-hearing-loss` | `whisper-not-heard` (required), `rinne-negative` (required), `weber-lateralised` (required) | Weber to the deaf ear. |
| **Sensorineural hearing loss**<br>Schallempfindungsschwerhörigkeit<br>`sensorineural-hearing-loss` | `whisper-not-heard` (required), `rinne-negative` (absent), `weber-lateralised` (required) | Weber to the better ear. |
| **Signs of consolidation**<br>Infiltrationszeichen (Konsolidierung)<br>`consolidation` | `bronchial-breathing`, `dull-percussion`, `increased-vocal-resonance`, `coarse-crackles`, `reduced-chest-expansion` |  |
| **Signs of pleural effusion**<br>Zeichen eines Pleuraergusses<br>`pleural-effusion-pattern` | `stony-dull-percussion` (required), `reduced-breath-sounds`, `reduced-vocal-resonance`, `reduced-chest-expansion`, `tracheal-deviation` | Trachea away from a large effusion. |
| **Signs of pneumothorax**<br>Zeichen eines Pneumothorax<br>`pneumothorax-pattern` | `hyper-resonant-percussion` (required), `reduced-breath-sounds` (required), `reduced-vocal-resonance`, `tracheal-deviation` | Trachea away only under tension. |
| **Hyperinflation and airflow obstruction**<br>Überblähung und Atemwegsobstruktion<br>`hyperinflation-pattern` | `barrel-chest`, `hyper-resonant-percussion`, `wheeze`, `pursed-lip-breathing`, `accessory-muscle-use` |  |
| **Circulatory shock**<br>Kreislaufschock<br>`shock` | `hypotension`, `tachycardia`, `capillary-refill-prolonged`, `diaphoresis`, `ashen-complexion`, `thready-pulse`, `skin-mottling`, `reduced-consciousness` | Warm shock may have normal refill. |
| **Volume depletion**<br>Volumenmangel (Exsikkose)<br>`hypovolaemia` | `dry-mucosa`, `reduced-skin-turgor`, `postural-tachycardia`, `orthostatic-hypotension`, `jvp-not-visible`, `tachycardia` |  |
| **Congestion and fluid overload**<br>Stauung und Volumenüberladung<br>`fluid-overload` | `raised-jvp`, `pitting-oedema`, `fine-crackles`, `third-heart-sound`, `displaced-apex` |  |
| **Stigmata of chronic liver disease**<br>Leberhautzeichen<br>`chronic-liver-disease` | `spider-naevi`, `palmar-erythema`, `gynaecomastia`, `leukonychia`, `jaundice`, `asterixis` |  |
| **Portal hypertension**<br>Portale Hypertension<br>`portal-hypertension` | `abdominal-distension`, `shifting-dullness`, `caput-medusae`, `splenomegaly` |  |
| **Signs of thyrotoxicosis**<br>Zeichen der Hyperthyreose<br>`thyrotoxicosis-signs` | `tachycardia`, `fine-postural-tremor`, `lid-retraction`, `lid-lag`, `diaphoresis`, `wide-pulse-pressure` | Thyrotoxicosis is a state; Graves’ disease adds exophthalmos and a diffuse goitre with a bruit. |
| **Peritonism**<br>Peritonismus<br>`peritonitis-signs` | `peritonism` (required), `lies-still-peritonism`, `abdomen-still-on-breathing`, `abdominal-tenderness` |  |
| **Fatigable weakness**<br>Belastungsabhängige Schwäche<br>`neuromuscular-fatigability` | `fatigable-ptosis`, `fatigable-dysarthria`, `fatigable-weakness`, `variable-diplopia`, `nasal-speech` | The hallmark of junction disease. |

## Diagnoses that are syndromes, states or laboratory findings

| Id today | Proposed kind | Note |
|---|---|---|
| `horner-syndrome` | syndrome | Causes (carotid dissection, Pancoast tumour, lateral medullary syndrome) become the conditions. |
| `third-nerve-palsy` | syndrome | Causes: posterior communicating aneurysm, diabetic (pupil-sparing), raised intracranial pressure. |
| `sixth-nerve-palsy` | syndrome | Causes: raised intracranial pressure, microvascular, MS. |
| `lateral-medullary-syndrome` | syndrome | Cause: vertebral or PICA occlusion (a stroke). |
| `cauda-equina-syndrome` | syndrome | Causes: central disc prolapse, tumour. |
| `thyrotoxicosis` | state | Graves’ disease, toxic multinodular goitre and thyroiditis are its causes; thyroid storm is its extreme. |
| `sepsis` | syndrome | Defined by criteria; urosepsis and pneumonia are causes. |
| `hyperkalaemia` | laboratory finding | Belongs with the Labs domain, not with examination signs. |
| `hyponatraemia` | laboratory finding |  |
| `hypercalcaemia` | laboratory finding |  |

## Tests named after a sign today

| Test | Label today | Proposed EN | Proposed DE |
|---|---|---|---|
| `inspect.legs` | Peripheral oedema | Legs: pressure test for oedema | Unterschenkel: Ödemprüfung durch Fingerdruck |
| `inspect.sclera` | Scleral icterus | Inspection of the sclerae | Inspektion der Skleren |
| `inspect.conjunctiva` | Conjunctival pallor | Inspection of the conjunctivae | Inspektion der Konjunktiven |
| `test.asterixis` | Asterixis (flapping tremor) | Arms outstretched, wrists bent back | Arme vorhalten, Handgelenke dorsalflektiert |
| `test.tremor` | Postural tremor | Arms outstretched, fingers spread | Arme vorhalten, Finger gespreizt |
| `test.shifting-dullness` | Shifting dullness | Percussion of the flanks, then on the side | Perkussion der Flanken mit Lagewechsel |
| `inspect.skin` | Stigmata of chronic liver disease | Inspection of skin, hands and chest wall | Inspektion von Haut, Händen und Thoraxwand |
| `inspect.pigmentation` | Hyperpigmentation (palmar creases, buccal mucosa) | Inspection of palmar creases, buccal mucosa and scars | Inspektion von Handlinien, Wangenschleimhaut und Narben |
| `inspect.thyroid-eyes` | Thyroid eye signs (lid retraction, lid lag) | Eyes from the front and side, following a finger down | Augen von vorn und seitlich, Blickfolge nach unten |
| `auscultate.carotid` | Carotid bruit | Auscultation of the carotids | Auskultation der Karotiden |
| `test.rapid-alternating` | Dysdiadochokinesis (rapid alternating movements) | Rapid alternating movements | Rasche Wechselbewegungen (Diadochokinese) |
| `test.trunk.pinprick` | Sensory level | Pinprick on the trunk | Spitz-stumpf-Prüfung am Rumpf |
| `test.power-repeated` | Fatigable weakness (repeated shoulder abduction) | Repeated shoulder abduction | Wiederholte Schulterabduktion |
| `inspect.eyes` | Pupils and lids at rest | Inspection of the eyes at rest | Inspektion der Augen in Ruhe |

## Card findings → signs

Shared card bodies (five lung sites, six oxygen devices) appear once per test. A finding mapped to no sign is a symptom or a pertinent negative; the note says which.

| Card finding | Signs | Syndrome | Note |
|---|---|---|---|
| Grey, sweaty, mottled, agitated or drowsy.<br><sub>inspect.general</sub> | `ashen-complexion`, `diaphoresis`, `skin-mottling`, `agitation`, `reduced-consciousness` | `shock` |  |
| Central cyanosis: a blue tongue and lips.<br><sub>inspect.general</sub> | `central-cyanosis` |  |  |
| Lying very still, afraid to move; or writhing and unable to settle.<br><sub>inspect.general</sub> | `lies-still-peritonism`, `restless-writhing` |  |  |
| Tachycardia: above 100 /min.<br><sub>measure.hr</sub> | `tachycardia` |  |  |
| Bradycardia: below 60 /min.<br><sub>measure.hr</sub> | `bradycardia` |  |  |
| Irregularly irregular.<br><sub>measure.hr, palpate.pulse.radial</sub> | `irregularly-irregular-pulse` |  |  |
| Hypotension: systolic below 90 mmHg or mean pressure below 65 mmHg.<br><sub>measure.bp</sub> | `hypotension` |  |  |
| Wide pulse pressure with a low diastolic.<br><sub>measure.bp</sub> | `wide-pulse-pressure` |  |  |
| Narrow pulse pressure.<br><sub>measure.bp</sub> | `narrow-pulse-pressure` |  |  |
| Tachypnoea: above 20 /min.<br><sub>measure.rr</sub> | `tachypnoea` |  |  |
| Bradypnoea: below 10 /min.<br><sub>measure.rr</sub> | `bradypnoea` |  |  |
| Below 94 % on room air.<br><sub>measure.spo2</sub> | `hypoxaemia` |  |  |
| Fever: 38.0 °C or more.<br><sub>measure.temp</sub> | `fever` |  |  |
| Hypothermia: below 36 °C in an unwell patient, or below 35 °C.<br><sub>measure.temp</sub> | `hypothermia` |  | Threshold differs from the sign definition; decide. |
| Collapsing (water-hammer) pulse: a sharp rise and a quick fall, felt best with the arm raised.<br><sub>palpate.pulse.radial</sub> | `collapsing-pulse` |  |  |
| Weak and fast (thready).<br><sub>palpate.pulse.radial</sub> | `thready-pulse` |  |  |
| Slow-rising, small-volume pulse (pulsus parvus et tardus).<br><sub>palpate.pulse.carotid</sub> | `slow-rising-pulse` |  |  |
| Bounding, collapsing pulse; or a double peak (bisferiens).<br><sub>palpate.pulse.carotid</sub> | `bounding-pulse`, `collapsing-pulse`, `bisferiens-pulse` |  |  |
| Raised JVP.<br><sub>inspect.jvp</sub> | `raised-jvp` | `fluid-overload` |  |
| JVP not visible even with the patient flat.<br><sub>inspect.jvp</sub> | `jvp-not-visible` | `hypovolaemia` |  |
| Cannon waves: large irregular a waves.<br><sub>inspect.jvp</sub> | `cannon-a-waves` |  |  |
| Displaced down and out, diffuse.<br><sub>palpate.apex</sub> | `displaced-apex` |  |  |
| Not displaced but sustained and heaving.<br><sub>palpate.apex</sub> | `heaving-apex` |  |  |
| A harsh ejection systolic (crescendo–decrescendo) murmur radiating to the carotids; a soft or absent S2.<br><sub>auscultate.heart.aortic</sub> | `ejection-systolic-murmur`, `soft-a2` |  |  |
| A loud pulmonary component of S2.<br><sub>auscultate.heart.pulmonary</sub> | `loud-p2` |  |  |
| A wide split of S2 that does not change with breathing (fixed splitting).<br><sub>auscultate.heart.pulmonary</sub> | `fixed-split-s2` |  | No condition linked (atrial septal defect has no diagnosis id). |
| A soft, high-pitched early diastolic murmur, decrescendo.<br><sub>auscultate.heart.erb</sub> | `early-diastolic-murmur` |  |  |
| An ejection systolic murmur that gets louder on standing or straining.<br><sub>auscultate.heart.erb</sub> | `dynamic-outflow-murmur` |  |  |
| A pansystolic murmur that gets louder on inspiration.<br><sub>auscultate.heart.tricuspid</sub> | `carvallo-sign` |  |  |
| A scratchy, superficial sound with up to three components, varying with position.<br><sub>auscultate.heart.tricuspid</sub> | `pericardial-rub` |  |  |
| A pansystolic murmur radiating to the axilla.<br><sub>auscultate.heart.mitral</sub> | `pansystolic-murmur` |  |  |
| A third heart sound (gallop) early in diastole.<br><sub>auscultate.heart.mitral</sub> | `third-heart-sound` | `fluid-overload` |  |
| A fourth heart sound just before S1.<br><sub>auscultate.heart.mitral</sub> | `fourth-heart-sound` |  |  |
| A low-pitched, rumbling mid-diastolic murmur, often after an opening snap.<br><sub>auscultate.heart.apex-bell-left-lateral</sub> | `mid-diastolic-murmur`, `opening-snap` |  | The card links aortic regurgitation (Austin Flint); an opening snap belongs to mitral stenosis, which has no diagnosis id. Review. |
| A third or fourth heart sound.<br><sub>auscultate.heart.apex-bell-left-lateral</sub> | `third-heart-sound`, `fourth-heart-sound` |  |  |
| A soft, blowing, high-pitched early diastolic murmur.<br><sub>auscultate.heart.lse-sitting-forward</sub> | `early-diastolic-murmur` |  |  |
| A scratchy rub.<br><sub>auscultate.heart.lse-sitting-forward</sub> | `pericardial-rub` |  |  |
| A bruit loudest high in the neck.<br><sub>auscultate.carotid</sub> | `carotid-bruit` |  |  |
| A murmur loudest at the base of the neck and louder still over the aortic area.<br><sub>auscultate.carotid</sub> | `ejection-systolic-murmur` |  | A transmitted murmur, not a bruit. |
| Bronchial breathing: harsh, expiration as long and loud as inspiration, with a gap between.<br><sub>auscultate.lung-upper-zone, auscultate.lung-mid-zone, auscultate.lung-axilla …</sub> | `bronchial-breathing` | `consolidation` |  |
| Reduced or absent breath sounds.<br><sub>auscultate.lung-upper-zone, auscultate.lung-mid-zone, auscultate.lung-axilla …</sub> | `reduced-breath-sounds` |  |  |
| Wheeze: musical, mainly expiratory, often from many airways at once.<br><sub>auscultate.lung-upper-zone, auscultate.lung-mid-zone, auscultate.lung-axilla …</sub> | `wheeze` |  |  |
| Fine end-inspiratory crackles at the bases.<br><sub>auscultate.lung-upper-zone, auscultate.lung-mid-zone, auscultate.lung-axilla …</sub> | `fine-crackles` |  |  |
| Coarse crackles that may change with coughing.<br><sub>auscultate.lung-upper-zone, auscultate.lung-mid-zone, auscultate.lung-axilla …</sub> | `coarse-crackles` |  |  |
| A creaking pleural rub.<br><sub>auscultate.lung-upper-zone, auscultate.lung-mid-zone, auscultate.lung-axilla …</sub> | `pleural-rub` |  |  |
| Stony dull.<br><sub>percuss.lung-upper-zone, percuss.lung-mid-zone, percuss.lung-axilla …</sub> | `stony-dull-percussion` | `pleural-effusion-pattern` |  |
| Dull.<br><sub>percuss.lung-upper-zone, percuss.lung-mid-zone, percuss.lung-axilla …</sub> | `dull-percussion` | `consolidation` |  |
| Hyper-resonant.<br><sub>percuss.lung-upper-zone, percuss.lung-mid-zone, percuss.lung-axilla …</sub> | `hyper-resonant-percussion` |  |  |
| Increased: the words come through clearly, even when whispered.<br><sub>resonance.lung-upper-zone, resonance.lung-mid-zone, resonance.lung-axilla …</sub> | `increased-vocal-resonance` | `consolidation` |  |
| Reduced or absent.<br><sub>resonance.lung-upper-zone, resonance.lung-mid-zone, resonance.lung-axilla …</sub> | `reduced-vocal-resonance` |  |  |
| Accessory muscles, recession, unable to speak in sentences.<br><sub>inspect.breathing</sub> | `accessory-muscle-use`, `speech-limited` |  | Recession is not modelled. |
| Prolonged expiration through pursed lips.<br><sub>inspect.breathing</sub> | `pursed-lip-breathing` | `hyperinflation-pattern` |  |
| Deep, sighing breaths at a normal or raised rate (Kussmaul).<br><sub>inspect.breathing</sub> | `deep-breathing` |  | Kussmaul breathing: deep breathing caused by a metabolic acidosis. |
| Waxing and waning breathing with pauses (Cheyne–Stokes).<br><sub>inspect.breathing</sub> | `cheyne-stokes` |  |  |
| Deviated away from the abnormal side.<br><sub>palpate.trachea</sub> | `tracheal-deviation` |  | Qualifier: away. |
| Deviated towards the abnormal side.<br><sub>palpate.trachea</sub> | `tracheal-deviation` |  | Qualifier: towards. |
| Reduced on one side.<br><sub>palpate.chest-expansion</sub> | `reduced-chest-expansion` |  | Qualifier: one side. |
| Reduced on both sides.<br><sub>palpate.chest-expansion</sub> | `reduced-chest-expansion` |  | Qualifier: both sides. |
| The saturation hardly rises despite a high inspired fraction.<br><sub>give.oxygen.nasal-2, give.oxygen.venturi-28, give.oxygen.venturi-35 …</sub> | `refractory-hypoxaemia` |  |  |
| The saturation rises easily.<br><sub>give.oxygen.nasal-2, give.oxygen.venturi-28, give.oxygen.venturi-35 …</sub> | `hypoxaemia` |  | A response, not a sign: hypoxaemia that corrects (qualifier oxygen-responsive). |
| Drowsy and flushed after high-flow oxygen, in a patient with COPD.<br><sub>give.oxygen.nasal-2, give.oxygen.venturi-28, give.oxygen.venturi-35 …</sub> | `reduced-consciousness` |  | CO₂ narcosis: consciousness is not an observable yet. |
| Refill slower than the normal limit for age and sex, in a warm room.<br><sub>measure.crt</sub> | `capillary-refill-prolonged` | `shock` |  |
| Bilateral pitting oedema.<br><sub>inspect.legs</sub> | `pitting-oedema` | `fluid-overload` |  |
| One swollen, warm, tender calf.<br><sub>inspect.legs</sub> | `unilateral-calf-swelling` |  |  |
| Non-pitting swelling.<br><sub>inspect.legs</sub> | `non-pitting-oedema` |  |  |
| Yellow sclerae.<br><sub>inspect.sclera</sub> | `jaundice` |  |  |
| The front rim is as pale as the rest (no rim contrast).<br><sub>inspect.conjunctiva</sub> | `conjunctival-pallor` |  |  |
| The hands drop forward briefly and jerk back, irregularly, on both sides.<br><sub>test.asterixis</sub> | `asterixis` |  |  |
| Dullness that shifts when the patient turns.<br><sub>test.shifting-dullness</sub> | `shifting-dullness` | `portal-hypertension` |  |
| Black, sticky, tarry stool with a characteristic smell (melaena).<br><sub>examine.rectal</sub> | `melaena` |  |  |
| A hard, irregular mass in the rectum; fresh blood.<br><sub>examine.rectal</sub> | `rectal-mass`, `fresh-blood-pr` |  |  |
| Lax anal tone and reduced perianal sensation.<br><sub>examine.rectal</sub> | `lax-anal-tone`, `saddle-anaesthesia` | `cauda-equina-syndrome` |  |
| A smoothly enlarged prostate.<br><sub>examine.rectal</sub> | `enlarged-prostate` |  |  |
| Several spider naevi, palmar erythema, gynaecomastia, leukonychia.<br><sub>inspect.skin</sub> | `spider-naevi`, `palmar-erythema`, `gynaecomastia`, `leukonychia` | `chronic-liver-disease` |  |
| Caput medusae.<br><sub>inspect.skin</sub> | `caput-medusae` | `portal-hypertension` |  |
| A fine, fast tremor of the outstretched fingers.<br><sub>test.tremor</sub> | `fine-postural-tremor` |  |  |
| Dark palmar creases, brown patches inside the cheeks, pigmented scars.<br><sub>inspect.pigmentation</sub> | `hyperpigmentation` |  |  |
| A diffuse, smooth, soft goitre with a bruit.<br><sub>palpate.thyroid</sub> | `diffuse-goitre`, `thyroid-bruit` |  |  |
| An irregular, nodular goitre.<br><sub>palpate.thyroid</sub> | `nodular-goitre` |  |  |
| A tender gland, often after a viral illness.<br><sub>palpate.thyroid</sub> | `thyroid-tenderness` |  |  |
| Lid retraction and lid lag.<br><sub>inspect.thyroid-eyes</sub> | `lid-retraction`, `lid-lag` | `thyrotoxicosis-signs` |  |
| Proptosis, chemosis, restricted eye movements, double vision.<br><sub>inspect.thyroid-eyes</sub> | `exophthalmos`, `chemosis` |  | Restrictive ophthalmopathy is not modelled; double vision is a symptom. |
| A dry tongue and dry mucosa.<br><sub>inspect.mouth</sub> | `dry-mucosa` | `hypovolaemia` |  |
| A smooth, red, sore tongue (glossitis); cracks at the corners of the mouth (angular cheilitis).<br><sub>inspect.mouth</sub> | `glossitis`, `angular-cheilitis` |  |  |
| The fold stays up and flattens slowly (tenting).<br><sub>test.turgor</sub> | `reduced-skin-turgor` | `hypovolaemia` |  |
| Sweet, fruity, like pear drops or nail-varnish remover.<br><sub>smell.breath</sub> | `ketotic-breath` |  |  |
| Musty, sweetish (fetor hepaticus).<br><sub>smell.breath</sub> | `fetor-hepaticus` |  |  |
| Ammonia-like, fishy (uraemic fetor).<br><sub>smell.breath</sub> | `uraemic-fetor` |  |  |
| Heart rate rises by 30 /min or more, or standing is impossible because of dizziness.<br><sub>measure.bp.lying-standing</sub> | `postural-tachycardia` | `hypovolaemia` |  |
| Systolic falls by 20 mmHg or more, or diastolic by 10 or more, within 3 minutes.<br><sub>measure.bp.lying-standing</sub> | `orthostatic-hypotension` |  |  |
| Guarding, rigidity, rebound or percussion tenderness.<br><sub>palpate.abdomen</sub> | `peritonism` | `peritonitis-signs` |  |
| Tenderness in the right iliac fossa.<br><sub>palpate.abdomen</sub> | `rif-tenderness` |  |  |
| Epigastric tenderness.<br><sub>palpate.abdomen</sub> | `epigastric-tenderness` |  |  |
| Enlarged spleen, with or without the liver.<br><sub>palpate.abdomen</sub> | `splenomegaly`, `hepatomegaly` |  |  |
| A smooth, dull mass rising from the pelvis that cannot be got below.<br><sub>palpate.abdomen</sub> | `palpable-bladder` |  |  |
| Loin tenderness, worse on gentle punching.<br><sub>palpate.abdomen</sub> | `renal-angle-tenderness` |  |  |
| A small pupil with a slight drooping of the same lid.<br><sub>inspect.eyes</sub> | `anisocoria`, `ptosis` | `horner-syndrome` |  |
| A large pupil with a complete ptosis, the eye turned down and out.<br><sub>inspect.eyes</sub> | `fixed-dilated-pupil`, `ptosis`, `eye-down-and-out` | `third-nerve-palsy` |  |
| Nystagmus while looking straight ahead.<br><sub>inspect.eyes</sub> | `spontaneous-nystagmus` |  |  |
| The difference grows in the dark, the small pupil widening slowly.<br><sub>inspect.eyes.dim</sub> | `dilation-lag` | `horner-syndrome` |  |
| The difference is greater in bright light.<br><sub>inspect.eyes.dim</sub> | `anisocoria` |  | Qualifier: greater in light (the large pupil is abnormal). |
| One pupil does not constrict, whichever eye is lit.<br><sub>test.pupils.light</sub> | `fixed-dilated-pupil` |  |  |
| Light in one eye constricts neither pupil; light in the other constricts both.<br><sub>test.pupils.light</sub> | `afferent-pupillary-defect` |  | Qualifier: absolute (amaurotic). |
| Both pupils widen when the light swings to one eye.<br><sub>test.swinging-light</sub> | `afferent-pupillary-defect` |  |  |
| One eye fails to abduct, with horizontal double vision.<br><sub>test.eye-movements</sub> | `abduction-deficit` | `sixth-nerve-palsy` |  |
| The eye is down and out, with ptosis.<br><sub>test.eye-movements</sub> | `eye-down-and-out`, `ptosis` | `third-nerve-palsy` |  |
| Horizontal nystagmus beating in one direction, stronger when looking that way.<br><sub>test.eye-movements</sub> | `unidirectional-nystagmus` | `peripheral-vestibular-pattern` |  |
| Nystagmus that changes direction with the direction of gaze; jerky pursuit.<br><sub>test.eye-movements</sub> | `gaze-evoked-nystagmus`, `saccadic-pursuit` | `cerebellar-syndrome` |  |
| Double vision that varies and worsens with effort.<br><sub>test.eye-movements</sub> | `variable-diplopia` | `neuromuscular-fatigability` |  |
| Horizontal-torsional nystagmus beating in one direction, much stronger without fixation.<br><sub>test.frenzel</sub> | `unidirectional-nystagmus` | `peripheral-vestibular-pattern` |  |
| Purely vertical or purely torsional nystagmus, or nystagmus no stronger without fixation.<br><sub>test.frenzel</sub> | `central-nystagmus` | `central-vestibular-pattern` |  |
| A catch-up saccade after turning towards one side.<br><sub>test.head-impulse</sub> | `head-impulse-positive` | `peripheral-vestibular-pattern` |  |
| A normal head impulse in a patient with acute continuous vertigo and nystagmus.<br><sub>test.head-impulse</sub> | — | `central-vestibular-pattern` | A pertinent negative: the absence of head-impulse-positive within the pattern. |
| A vertical refixation: one eye moves down, the other up.<br><sub>test.cover</sub> | `skew-deviation` | `central-vestibular-pattern` |  |
| A horizontal refixation.<br><sub>test.cover</sub> | `horizontal-tropia` |  |  |
| The same half of the field lost in both eyes (homonymous hemianopia).<br><sub>test.visual-fields</sub> | `homonymous-hemianopia` |  |  |
| The outer halves lost in both eyes (bitemporal hemianopia).<br><sub>test.visual-fields</sub> | `bitemporal-hemianopia` |  |  |
| A central blind spot in one eye (central scotoma).<br><sub>test.visual-fields</sub> | `central-scotoma` |  |  |
| A swollen disc with blurred margins, lost venous pulsation, haemorrhages around it.<br><sub>test.fundoscopy</sub> | `papilloedema` |  |  |
| A pale disc.<br><sub>test.fundoscopy</sub> | `optic-atrophy` |  |  |
| Cannot repeat the whisper on one side.<br><sub>test.whisper</sub> | `whisper-not-heard` |  |  |
| Bone conduction louder than air (Rinne negative).<br><sub>test.rinne</sub> | `rinne-negative` | `conductive-hearing-loss` |  |
| Louder in the deaf ear.<br><sub>test.weber</sub> | `weber-lateralised` | `conductive-hearing-loss` |  |
| Louder in the better ear.<br><sub>test.weber</sub> | `weber-lateralised` | `sensorineural-hearing-loss` |  |
| Steady with the eyes open, but sways and falls when they close (Romberg positive).<br><sub>test.romberg</sub> | `romberg-sign` | `dorsal-column-syndrome` |  |
| Falls consistently towards one side when the eyes close.<br><sub>test.romberg</sub> | `lateral-fall-eyes-closed` | `peripheral-vestibular-pattern` |  |
| Unsteady even with the eyes open, feet together impossible.<br><sub>test.romberg</sub> | `truncal-ataxia` | `cerebellar-syndrome` |  |
| Broad-based, staggering; cannot walk heel to toe.<br><sub>test.gait</sub> | `ataxic-gait` | `cerebellar-syndrome` |  |
| Veers to one side but walks unaided.<br><sub>test.gait</sub> | `veering-gait` | `peripheral-vestibular-pattern` |  |
| One leg stiff and swung outwards in a semicircle, the arm flexed.<br><sub>test.gait</sub> | `hemiplegic-gait` | `umn-syndrome` |  |
| High stepping, the foot slapping down.<br><sub>test.gait</sub> | `steppage-gait`, `foot-drop` |  |  |
| Stamping, watching the feet, worse in the dark.<br><sub>test.gait</sub> | `sensory-ataxic-gait` | `dorsal-column-syndrome` |  |
| A tremor that grows near the target, and overshooting (past-pointing), with eyes open as much as closed.<br><sub>test.finger-nose</sub> | `intention-tremor`, `limb-dysmetria` | `cerebellar-syndrome` |  |
| Accurate with eyes open, lost with eyes closed.<br><sub>test.finger-nose</sub> | `limb-ataxia-eyes-closed` | `dorsal-column-syndrome` |  |
| Weakness of the whole of one side, forehead included; the eye does not close.<br><sub>test.face-movement</sub> | `lmn-facial-weakness`, `incomplete-eye-closure` |  |  |
| Weakness of the lower face with the forehead spared.<br><sub>test.face-movement</sub> | `umn-facial-weakness` | `umn-syndrome` |  |
| Weakness on both sides.<br><sub>test.face-movement</sub> | `bilateral-facial-weakness` |  |  |
| Loss on one side of the face together with the body on the same side.<br><sub>test.face-sensation</sub> | `facial-sensory-loss`, `hemisensory-loss` |  |  |
| Loss of pain on one side of the face and on the opposite side of the body.<br><sub>test.face-sensation</sub> | `crossed-sensory-loss` | `lateral-medullary-syndrome` |  |
| An absent corneal reflex on one side.<br><sub>test.face-sensation</sub> | `absent-corneal-reflex` |  |  |
| The jaw deviates to one side on opening.<br><sub>test.jaw</sub> | `jaw-deviation` |  |  |
| A brisk jaw jerk.<br><sub>test.jaw</sub> | `brisk-jaw-jerk` | `umn-syndrome` |  |
| The uvula is pulled to one side.<br><sub>test.palate</sub> | `uvula-deviation` |  |  |
| The palate hardly moves on either side; nasal speech.<br><sub>test.palate</sub> | `nasal-speech`, `absent-gag` |  | Palatal movement itself is not modelled. |
| Deviates to one side when stuck out, with wasting on that side.<br><sub>test.tongue</sub> | `tongue-deviation`, `tongue-wasting` | `lmn-syndrome` |  |
| Wasted, fasciculating tongue.<br><sub>test.tongue</sub> | `tongue-wasting`, `tongue-fasciculation` | `lmn-syndrome` |  |
| Deviates slightly towards the weak side of the body, without wasting.<br><sub>test.tongue</sub> | `tongue-deviation` | `umn-syndrome` |  |
| Weak shrug or head turning on one side, with wasting.<br><sub>test.shrug</sub> | `weak-shrug` |  | Wasting of trapezius is not modelled. |
| Weak neck and shoulders on both sides.<br><sub>test.shrug</sub> | `weak-shrug` |  | Qualifier: both sides. |
| Halting, effortful speech with good comprehension (expressive aphasia).<br><sub>test.speech</sub> | `expressive-aphasia` |  |  |
| Fluent speech full of wrong words, with poor comprehension (receptive aphasia).<br><sub>test.speech</sub> | `receptive-aphasia` |  |  |
| Slurred, scanning or explosive speech with normal language.<br><sub>test.speech</sub> | `dysarthria` |  |  |
| The voice becomes quieter, nasal and slurred as the count goes on.<br><sub>test.count-to-50</sub> | `fatigable-dysarthria` | `neuromuscular-fatigability` |  |
| Running out of breath early.<br><sub>test.count-to-50</sub> | `reduced-single-breath-count` |  |  |
| One or both lids sink progressively.<br><sub>test.sustained-upgaze</sub> | `fatigable-ptosis` | `neuromuscular-fatigability` |  |
| A catch that gives way, worse with faster movement (spasticity).<br><sub>test.arm.tone</sub> | `spasticity` | `umn-syndrome` |  |
| Even resistance throughout (lead-pipe), or ratchet-like (cogwheel).<br><sub>test.arm.tone</sub> | `rigidity` |  |  |
| Floppy with wasting and fasciculation.<br><sub>test.arm.tone</sub> | `hypotonia`, `muscle-wasting`, `fasciculation` | `lmn-syndrome` |  |
| Extensors weaker than flexors (pyramidal pattern), on one side.<br><sub>test.arm.power</sub> | `pyramidal-weakness` | `umn-syndrome` |  |
| Weakness confined to the muscles of one root (myotome).<br><sub>test.arm.power</sub> | `myotomal-weakness` |  |  |
| Symmetrical weakness, proximal or ascending.<br><sub>test.arm.power</sub> | `proximal-symmetrical-weakness`, `ascending-weakness` |  |  |
| Weakness with wasting and fasciculation, mixed with brisk reflexes.<br><sub>test.arm.power</sub> | `muscle-wasting`, `fasciculation`, `hyperreflexia` |  | Mixed UMN and LMN signs: motor neurone disease. |
| Brisk, spreading reflexes on one side.<br><sub>test.arm.reflexes</sub> | `hyperreflexia` | `umn-syndrome` |  |
| Reflexes absent even with reinforcement.<br><sub>test.arm.reflexes</sub> | `areflexia` | `lmn-syndrome` |  |
| Loss in one dermatome.<br><sub>test.arm.pinprick</sub> | `dermatomal-sensory-loss` |  |  |
| Loss over a whole half of the body, face included.<br><sub>test.arm.pinprick</sub> | `hemisensory-loss` |  |  |
| Loss in the body on one side and the face on the other.<br><sub>test.arm.pinprick</sub> | `crossed-sensory-loss` | `lateral-medullary-syndrome` |  |
| Vibration and position sense lost at the fingertips.<br><sub>test.arm.vibration</sub> | `distal-vibration-loss` | `dorsal-column-syndrome` |  |
| Spastic tone; sustained clonus.<br><sub>test.leg.tone</sub> | `spasticity`, `sustained-clonus` | `umn-syndrome` |  |
| Floppy, wasted leg.<br><sub>test.leg.tone</sub> | `hypotonia`, `muscle-wasting` | `lmn-syndrome` |  |
| Weak dorsiflexion and big toe extension, with weak inversion.<br><sub>test.leg.power</sub> | `foot-drop`, `myotomal-weakness` |  | Qualifier: inversion weak (L5). |
| Weak dorsiflexion and eversion with normal inversion.<br><sub>test.leg.power</sub> | `foot-drop` |  | Qualifier: inversion spared (peroneal). |
| Weak plantarflexion and eversion.<br><sub>test.leg.power</sub> | `myotomal-weakness` |  | S1 myotome. |
| Flexors weaker than extensors, on one side, with the arm.<br><sub>test.leg.power</sub> | `pyramidal-weakness` | `umn-syndrome` |  |
| Symmetrical weakness rising from the feet.<br><sub>test.leg.power</sub> | `ascending-weakness` |  |  |
| The big toe extends upwards and the other toes fan (Babinski sign).<br><sub>test.leg.reflexes</sub> | `extensor-plantar` | `umn-syndrome` |  |
| Absent ankle reflex on one side.<br><sub>test.leg.reflexes</sub> | `absent-ankle-reflex` |  |  |
| All reflexes absent.<br><sub>test.leg.reflexes</sub> | `areflexia` | `lmn-syndrome` |  |
| Absent ankle reflexes with upgoing plantars.<br><sub>test.leg.reflexes</sub> | `absent-ankle-reflex`, `extensor-plantar` |  | Mixed pattern: B12 deficiency, motor neurone disease. |
| Loss on the top of the foot and big toe.<br><sub>test.leg.pinprick</sub> | `dermatomal-sensory-loss` |  | L5 or the superficial peroneal nerve. |
| Loss on the outer foot and sole.<br><sub>test.leg.pinprick</sub> | `dermatomal-sensory-loss` |  | S1. |
| Loss in both feet, fading upwards (stocking).<br><sub>test.leg.pinprick</sub> | `stocking-sensory-loss` |  |  |
| Vibration and position sense lost at the toes.<br><sub>test.leg.vibration</sub> | `distal-vibration-loss` | `dorsal-column-syndrome` |  |
| Strength fades with repetition and recovers with rest.<br><sub>test.power-repeated</sub> | `fatigable-weakness` | `neuromuscular-fatigability` |  |
| One arm turns palm-down and sinks.<br><sub>test.pronator-drift</sub> | `pronator-drift` | `umn-syndrome` |  |
| One arm rises or wanders, the fingers moving restlessly.<br><sub>test.pronator-drift</sub> | `pseudoathetosis` |  |  |
| Pain shooting down the leg below the knee between 30° and 70°.<br><sub>test.slr</sub> | `positive-slr` |  |  |
| The heel overshoots or misses the knee (dysmetria) and wobbles off the shin; the tremor grows as it nears the target (intention tremor), with the eyes open as much as closed.<br><sub>test.heel-shin</sub> | `limb-dysmetria`, `intention-tremor` | `cerebellar-syndrome` |  |
| Accurate while the patient watches, but the heel wanders once the eyes are closed.<br><sub>test.heel-shin</sub> | `limb-ataxia-eyes-closed` | `dorsal-column-syndrome` |  |
| The leg cannot be lifted onto the knee, or only slowly and with effort.<br><sub>test.heel-shin</sub> | `pyramidal-weakness` |  | Weakness limits the test; not ataxia. |
| Slow, irregular and clumsy, the rhythm breaking down (dysdiadochokinesis).<br><sub>test.rapid-alternating</sub> | `dysdiadochokinesis` | `cerebellar-syndrome` |  |
| Slow but regular.<br><sub>test.rapid-alternating</sub> | `slowed-alternating-movements` | `umn-syndrome` |  |
| A level below which pinprick is reduced.<br><sub>test.trunk.pinprick</sub> | `sensory-level` |  |  |
| Reduced perianal sensation, often with urinary retention and lax anal tone.<br><sub>test.saddle</sub> | `saddle-anaesthesia` | `cauda-equina-syndrome` |  |
| Breathless lying flat, better sitting up (orthopnoea).<br><sub>position.supine</sub> | `orthopnoea` |  |  |
| The JVP is visible at the angle of the jaw at 45°.<br><sub>position.reclined-45</sub> | `raised-jvp` | `fluid-overload` |  |
| Insists on sitting bolt upright, leaning on the arms (tripod).<br><sub>position.sitting</sub> | `tripod-position` |  |  |
| Chest pain eased by sitting forward.<br><sub>position.sitting-forward</sub> | — |  | A symptom, not a sign: belongs in the history (pericarditis). |
| A diastolic rumble or third heart sound heard only in this position.<br><sub>position.left-lateral</sub> | `mid-diastolic-murmur`, `third-heart-sound` |  |  |
| Dizzy or faint on standing.<br><sub>position.standing</sub> | — |  | A symptom; the sign is orthostatic-hypotension or postural-tachycardia. |
| A systolic murmur that gets louder on standing.<br><sub>position.standing</sub> | `dynamic-outflow-murmur` |  |  |
| A midline sternotomy scar, a thoracotomy scar, a pacemaker under the clavicle.<br><sub>expose.chest</sub> | `chest-scars` |  |  |
| A barrel-shaped chest.<br><sub>expose.chest</sub> | `barrel-chest` | `hyperinflation-pattern` |  |
| A distended abdomen with full flanks and an everted umbilicus.<br><sub>expose.abdomen</sub> | `abdominal-distension` | `portal-hypertension` |  |
| An abdomen that does not move with breathing.<br><sub>expose.abdomen</sub> | `abdomen-still-on-breathing` | `peritonitis-signs` |  |
