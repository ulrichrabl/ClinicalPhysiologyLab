# Patient Runtime rebuild

Clean production cut of the patient-first architecture (Phases 1–3).

There is **no compatibility facade** and **no dual path** for neurogenic shock
or channel-driven mechanisms. The Patient Runtime is the sole authority that
resolves mechanisms, composes effects, and drives the circulation adapter.

## Layout

| Area | Path |
|---|---|
| Contracts | `source/src/contracts/` |
| Ports + composition | `source/src/physiology/` |
| Channel + SCI mechanisms | `source/src/physiology/mechanisms/` |
| Conditions | `source/src/conditions/` |
| Circulation adapter | `source/src/models/cardiovascular/` |
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
```

`Patient` holds shared channels for the UI (chemistry, drugs, projected vitals).
Edits to input channels call `runtime.syncChannels`. Cord level is a projection
from active conditions, not a write path into physiology.

## Proof slice

```bash
cd source && node scripts/runtime-slice.test.mjs
```
