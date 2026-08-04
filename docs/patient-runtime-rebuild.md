# Patient Runtime rebuild

Clean production cut of the patient-first architecture (Phases 1–4).

The Patient Runtime is the sole authority that resolves mechanisms, composes
effects, owns canonical cardiovascular public state, and exposes clinical
findings as observation plugins.

## Layout

| Area | Path |
|---|---|
| Contracts | `source/src/contracts/` |
| Ports + composition | `source/src/physiology/` |
| Channel + SCI mechanisms | `source/src/physiology/mechanisms/` |
| Conditions | `source/src/conditions/` |
| Circulation adapter + public state | `source/src/models/cardiovascular/` |
| Observation plugins | `source/src/observations/` |
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
 Canonical public state (CV + electrophysiology)
        │
        ├── observe.vital-signs
        ├── observe.twelve-lead-ecg
        └── channel projections (labs / Patient workspace)
```

Haemodynamic ground truth is runtime public state. The monitor reads
`runtime.monitorSnapshot()` / vitals observations. Labs still consume
projected channels derived from that public state — not domain `setMany`
writes.

## Tests

```bash
cd source
node scripts/runtime-slice.test.mjs          # C5 proof slice VS-1…VS-10
node scripts/phase4-observations.test.mjs    # canonical state + observations
```
