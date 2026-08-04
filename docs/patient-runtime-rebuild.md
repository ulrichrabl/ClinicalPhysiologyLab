# Patient Runtime rebuild

Clean production cut of the patient-first architecture (Phases 1–5).

The Patient Runtime is the sole authority that resolves mechanisms, composes
effects, owns canonical cardiovascular and chemistry public state, and exposes
clinical findings as observation plugins.

## Layout

| Area | Path |
|---|---|
| Contracts | `source/src/contracts/` |
| Ports + composition | `source/src/physiology/` |
| Channel + SCI mechanisms | `source/src/physiology/mechanisms/` |
| Conditions | `source/src/conditions/` |
| Circulation adapter + public state | `source/src/models/cardiovascular/` |
| Chemistry public state + haemodynamic derivation | `source/src/models/chemistry/` |
| Observation plugins | `source/src/observations/` |
| Acid–base interpretation | `source/src/observations/interpretation/` |
| Runtime | `source/src/runtime/patient-runtime.ts` |
| Scenario seed | `source/src/scenarios/definitions/` |
| ADRs | `docs/adr/` |

## Authority

```text
UI / scenario / test / tool
        │
        ▼
 PatientRuntime.dispatch / syncChannels / observe
        │
        ▼
 Conditions + channel mechanisms → typed effects
        │
        ▼
 Deterministic port composition
        │
        ▼
 Cardiovascular adapter → Circulation host
        │
        ▼
 Canonical public state (CV + electrophysiology + chemistry)
        │
        ├── observe.vital-signs
        ├── observe.twelve-lead-ecg
        ├── observe.laboratory-panel  (+ acid–base interpretation)
        └── channel projections (Patient workspace)
```

Haemodynamic ground truth is runtime public state. Chemistry ground truth is
also runtime-owned: haemodynamics may derive lactate / Hb / urea / BNP unless
the learner has pinned those analytes. The Labs domain is an observation client
— it does not maintain a parallel mutable store and does not call into
Circulation (`cardio.setParam`).

## Tests

```bash
cd source
node scripts/runtime-slice.test.mjs          # C5 proof slice VS-1…VS-10
node scripts/phase4-observations.test.mjs    # canonical CV state + observations
node scripts/phase5-chemistry.test.mjs       # chemistry vs lab observation
```
