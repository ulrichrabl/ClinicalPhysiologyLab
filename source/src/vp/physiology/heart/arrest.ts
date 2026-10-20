import { ARREST } from '../../evidence/arrest.ts';

/* ===========================================================================
   The heart in an arrest (ADR-018 decision 6c).

   One variable, the myocardium's state M: 1 for a heart that has been
   perfused, falling towards 0 while it fibrillates (or stands still)
   without coronary flow, and recovering with the coronary perfusion that
   compressions make. It stands for the muscle's energy (high-energy
   phosphates, lactate, acidosis), not for any one of them.

   What depends on it:
     - how coarse the fibrillation is: the VF dipole's amplitude;
     - after a shock has ended the fibrillation, whether the heart takes up
       an organised rhythm or stands still;
     - how strongly an organised heart contracts. Whether that makes a
       pulse is the circulation's to decide: a weak heart is pulseless
       electrical activity without being told to be.

   Coronary perfusion pressure is aortic minus right atrial pressure where
   the coronary arteries fill: between compressions in CPR (Paradis 1990),
   across the cycle in a beating heart. The host hands it over, smoothed.

   Chance (whether a shock ends the fibrillation, whether an organised
   rhythm follows) is drawn by whoever runs the patient from its own seeded
   stream; this module turns the draws into outcomes, so a run replays.
=========================================================================== */

export type ShockOutcome = 'not-terminated' | 'organised' | 'asystole';

export class MyocardialState {
  /** 1 a perfused heart; towards 0 the longer it goes without coronary flow. */
  M = 1;

  /** Advance by `seconds` with coronary perfusion pressure `cpp` (mmHg) and the heart beating or not. A perfused, beating
      heart stays at 1: nothing here changes a patient who is not in an arrest. */
  step(seconds: number, cpp: number, arrested: boolean): void {
    const supply = Math.max(0, Math.min(1, (cpp - ARREST.cppNoFlow) / (ARREST.cppFullFlow - ARREST.cppNoFlow)));
    if (!arrested && supply >= 1 && this.M >= 1) { this.M = 1; return; }
    /* Fibrillating or still, the muscle uses up what it has unless the coronary flow brings more; a beating heart with
       its coronary flow restores it. */
    const fall = arrested ? (1 - supply) * this.M / ARREST.depletionTau : 0;
    const gain = supply * (1 - this.M) / ARREST.recoveryTau;
    this.M = Math.max(0, Math.min(1, this.M + (gain - fall) * seconds));
  }

  /** How coarse the fibrillation is (the VF dipole's scale), from the state. */
  vfScale(): number { return ARREST.vfFineScale + (1 - ARREST.vfFineScale) * this.M; }

  /** How strongly an organised heart contracts, as a multiple of its own contractility. */
  contractility(): number { return ARREST.contractilityFloor + (1 - ARREST.contractilityFloor) * this.M; }

  /** The chance that, once a shock has ended the fibrillation, an organised rhythm follows (rather than asystole). */
  organisedChance(): number { return Math.pow(this.M, ARREST.organisedExponent); }

  /** What a shock does, from two uniform draws: whether it ends the fibrillation, and what follows. */
  shock(uTerminate: number, uRhythm: number): ShockOutcome {
    if (uTerminate >= ARREST.shockTermination) return 'not-terminated';
    return uRhythm < this.organisedChance() ? 'organised' : 'asystole';
  }
}
