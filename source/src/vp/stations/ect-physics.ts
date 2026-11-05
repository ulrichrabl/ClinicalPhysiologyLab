import { ECT } from '../evidence/ect.ts';
import { stimulusFor, type ProgramChoice, type Stimulus } from './ect-device.ts';
import { PERCENT_STEPS, CHARGE_MC } from './ect-programs.ts';

/* ===========================================================================
   The physics of the stimulus, worked out for the station's explainer (ECT
   part 4, owner 2026-10-30: "the physics made interactive"). Pure numbers,
   no drawing: the page draws them, the tests check them.

   The device drives a constant current (0.9 A) in brief rectangular pulses
   of alternating polarity, up to 450 V (the manual, specifications). What
   the dial sets is the charge: current × pulse width × number of pulses,
   the pulses being two per period (2 × frequency × duration). The voltage
   the head needs is the current times its dynamic impedance (Ohm's law);
   above 500 Ω that would exceed 450 V, so the current, and with it the
   charge, falls. The energy is the charge times the voltage; the manual
   gives it at 220 Ω. The impedance test reads the static impedance with a
   current too small to be felt: the skin conducts far worse at that current
   than at the stimulus's, so the static reading is several times the
   dynamic one.
=========================================================================== */

export interface StimulusPhysics {
  stimulus: Stimulus;
  /** the dial's charge (mC), at 0.9 A */
  setCharge: number;
  /** the head's dynamic impedance (Ω) */
  dynamicOhm: number;
  /** the voltage the current needs (V), and whether the 450 V limit cuts the current */
  voltage: number; limited: boolean;
  /** the current delivered (A), the charge delivered (mC) and the energy (J) */
  current: number; charge: number; energy: number;
  /** the energy as the manual quotes it, at 220 Ω (J) */
  energyAt220: number;
  /** the peak power of one pulse (W) */
  peakPower: number;
}

/** The stimulus a program gives at a percent into a head of `dynamicOhm`, with its charge, voltage and energy. */
export function stimulusPhysics(program: ProgramChoice, percent: number, dynamicOhm: number, user = { frequency: 30, pulseWidth: 0.5 }, ultrabrief: 0.25 | 0.3 = 0.25): StimulusPhysics | null {
  const stimulus = stimulusFor(program, percent, user, ultrabrief);
  if (!stimulus) return null;
  const want = ECT.current * dynamicOhm, limited = want > ECT.maxVoltage;
  const current = limited ? ECT.maxVoltage / dynamicOhm : ECT.current, voltage = current * dynamicOhm;
  const charge = current * stimulus.pulseWidth * stimulus.pulses;                    // mC: A × ms
  const energy = (charge / 1000) * voltage;                                           // J: C × V
  const energyAt220 = (ECT.current * stimulus.pulseWidth * stimulus.pulses / 1000) * ECT.current * 220;
  return { stimulus, setCharge: CHARGE_MC[PERCENT_STEPS.indexOf(percent)], dynamicOhm, voltage, limited, current, charge, energy, energyAt220, peakPower: current * voltage };
}

/** The program a comparison sets beside this one: the ultrabrief against the 0.5 ms program and back; others against LOW 0.5. */
export function counterpart(p: ProgramChoice): ProgramChoice { return p === 'LOW_05' ? 'LOW_UB' : 'LOW_05'; }

/** The current (A) of a stimulus at time t (s) from its start: +I or −I during a pulse, 0 between. Each period holds a pulse
    of either polarity, the second half a period after the first. */
export function currentAt(s: Stimulus, t: number, I = ECT.current): number {
  if (t < 0 || t >= s.duration) return 0;
  const period = 1 / s.frequency, half = period / 2, x = t % period, w = s.pulseWidth / 1000;
  if (x < w) return I;
  if (x >= half && x < half + w) return -I;
  return 0;
}
