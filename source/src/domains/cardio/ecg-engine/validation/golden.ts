/** Golden scenario IDs per spec §25.3 — validation registry. */
export const GOLDEN_SCENARIOS = [
  'normal_sinus',
  'complete_av_block',
  'wenckebach',
  'rbbb',
  'lbbb',
  'wpw',
  'orthodromic_avrt',
  'pre_excited_af',
  'brugada_fever',
  'hyperkalemia_progression',
  'hypokalemia_u_waves',
  'long_qt_torsades',
  'anterior_infarction',
  'inferior_rv_infarction',
  'pe_no_diagnostic_ecg',
  'pe_rv_strain',
  'pe_p_pulmonale',
  'af_pulse_deficit',
  'pvc_compensatory_pause',
  'non_perfusing_pvc',
  'ddd_pacing_fusion',
  'pacemaker_failure_capture',
  'lead_reversal',
  'tremor_mimic_flutter',
] as const;

export type GoldenScenarioId = typeof GOLDEN_SCENARIOS[number];

export const GOLDEN_CONFIG: Record<string, { conditions: string[]; seed: string; durationMs: number }> = {
  normal_sinus: { conditions: ['normal'], seed: '10392042', durationMs: 3000 },
  wenckebach: { conditions: ['wenckebach'], seed: '42', durationMs: 6000 },
  rbbb: { conditions: ['rbbb'], seed: '42', durationMs: 3000 },
  lbbb: { conditions: ['lbbb'], seed: '42', durationMs: 3000 },
  wpw: { conditions: ['wpw_a'], seed: '42', durationMs: 3000 },
  stemi_ant: { conditions: ['stemi_ant'], seed: '42', durationMs: 3000 },
  hyperkalemia_progression: { conditions: ['hyperk_mild', 'hyperk_mod', 'hyperk_sev'], seed: '42', durationMs: 8000 },
  af_pulse_deficit: { conditions: ['af'], seed: '42', durationMs: 8000 },
  pe_rv_strain: { conditions: ['pe'], seed: '42', durationMs: 5000 },
};
