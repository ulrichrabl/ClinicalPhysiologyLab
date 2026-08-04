# Patient Runtime rebuild

Clean production cut of the patient-first architecture (Phases 1–6).

The Patient Runtime is the sole authority that resolves mechanisms, composes
effects, owns canonical cardiovascular and chemistry public state, and exposes
clinical findings as observation plugins. Scenarios compile to commands and
triggers; the shell follows Patient / Examine / Investigate / Treat / Explore.

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
| Scenario compiler + triggers | `source/src/scenarios/` |
| Patient-first layers | `source/src/shell/` |
| Runtime | `source/src/runtime/patient-runtime.ts` |
| Scenario seed | `source/src/scenarios/definitions/` |
| ADRs | `docs/adr/` |

## Authority

```text
UI / scenario / test / tool
        │
        ▼
 Scenario compiler → seed commands + triggers
        │
        ▼
 PatientRuntime.dispatch / syncChannels / observe / loadScenario
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
        ├── observe.laboratory-panel
        └── Patient / Examine / Investigate / Treat / Explore
```

Specialty domains (Circulation, Neurology, Labs) remain Explore lenses.

## Tests

```bash
cd source
node scripts/runtime-slice.test.mjs          # C5 proof slice VS-1…VS-10
node scripts/phase4-observations.test.mjs    # canonical CV state + observations
node scripts/phase5-chemistry.test.mjs       # chemistry vs lab observation
node scripts/phase6-scenarios.test.mjs       # scenario compiler + triggers
```
