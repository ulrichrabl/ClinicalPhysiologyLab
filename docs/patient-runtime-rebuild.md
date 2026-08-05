# Patient Runtime rebuild

Clean production cut of the patient-first architecture (Phases 1–6), runtime
stabilization, and **platform hardening**: async/correlated model advancement,
instance-local IDs, model-state checkpoints, complete authority boundaries,
runtime-owned cardio controls, and scenario initialization semantics.

Models remain **adapter-wrapped** (Circulation + hybrid ECG). The
`PhysiologyModelPlugin` advance contract is awaitable; hot-swap plug-and-play is
still not claimed.

Label: *stabilized proof slice → hardening toward a stable platform runtime*.

## Layout

| Area | Path |
|---|---|
| Contracts (incl. authority, model-plugin) | `source/src/contracts/` |
| Ports + composition | `source/src/physiology/` |
| Channel + SCI mechanisms | `source/src/physiology/mechanisms/` |
| Conditions | `source/src/conditions/` |
| Circulation adapter + public state | `source/src/models/cardiovascular/` |
| Chemistry | `source/src/models/chemistry/` |
| Observations | `source/src/observations/` |
| Scenario compiler + triggers | `source/src/scenarios/` |
| Patient-first layers | `source/src/shell/` |
| Runtime | `source/src/runtime/patient-runtime.ts` |
| ADRs | `docs/adr/` |

## Authority

```text
UI / scenario / test / tool
        │
        ▼
 authorize(command|query|observe)
        │
        ▼
 PatientRuntime (sole clock + state + IDs)
        │
        ▼
 Mechanisms → composition → CV adapter → host
        │
        ▼
 Canonical public state → observations / layers
```

## Tests

```bash
cd source
npm run verify   # typecheck + unit suites + smoke + build
npm run test:stabilization
```
