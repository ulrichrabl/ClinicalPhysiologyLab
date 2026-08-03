# Deterministic Hybrid ECG Engine — Specification v0.1

Status: Implemented in `source/src/domains/cardio/ecg-engine/`

See the full specification in project planning documents. This file records the adopted defaults and implementation status.

## Adopted defaults

- Adult education, deterministic execution, browser + Worker target
- 12-lead ECG + monitor-compatible output at 500 Hz (1000 Hz internal)
- 16 atrial + 48 ventricular regions, 50 projection profiles
- Event-driven conduction graph with recovery-dependent AV delay
- Mechanism-before-diagnosis: no `drawDiagnosis()` waveform functions
- TypeScript public API; WASM deferred

## Implementation status

| Milestone | Status |
|-----------|--------|
| M1 Core normal engine | Complete |
| M2 Conduction and ectopy | Complete (AV blocks, BBB, PAC/PVC via graph) |
| M3 Supraventricular arrhythmias | Complete (AF, flutter, WPW accessory pathway) |
| M4 Ischemia and structural | Complete (territorial ischemia, PE coupling) |
| M5 Channelopathies and metabolism | Complete (Brugada, LQT, electrolytes, Ca/K coupling) |
| M6 Devices and advanced rhythms | Framework (VT/VF deterministic; pacemaker hooks) |
| M7 Calibration | Golden registry, 50 profiles, validation tests |

## Safety

Educational use only. Not for clinical diagnosis or device certification.
