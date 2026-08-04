# Patient Runtime rebuild (Phases 1–3)

This tree introduces the patient-first runtime specified in the rebuild document
(4 August 2026), without a big-bang rewrite of the existing UI.

## What landed

| Area | Location |
|---|---|
| Contracts (commands, queries, effects, …) | `src/contracts/` |
| Physiological ports + composition | `src/physiology/` |
| C5 / SCI condition | `src/conditions/cervical-spinal-cord-injury.ts` |
| Circulation adapter (public → private) | `src/models/cardiovascular/current-model-adapter.ts` |
| Patient Runtime | `src/runtime/patient-runtime.ts` |
| Legacy bridge | `src/runtime/compatibility-facade.ts` |
| Proof-slice scenario | `src/scenarios/definitions/neurogenic-shock-demo.ts` |
| Causal explanation | `src/explanations/causal-trace.ts` |
| ADRs 001–010 | `docs/adr/` |

## Proof slice

```bash
cd source && node scripts/runtime-slice.test.mjs
```

Activating `cervical-spinal-cord-injury` at C5 (complete, bilateral) goes through
`runtime.dispatch` → mechanisms → composed effects → cardiovascular adapter →
existing `Circulation` model. The same command schema is used by the scenario
definition, the UI bridge (`patient.set('cordLevel', …)`), tests, and a
generic tool-client source.

## Compatibility

- Existing specialty navigation and domains remain operational.
- `Patient.overridesFor('cardio')` skips the hard-coded neurogenic coupling when
  a runtime is attached and uses adapter-translated private params instead.
- Cushing, electrolytes, and drug couplings still use the legacy path until
  later migration phases.
