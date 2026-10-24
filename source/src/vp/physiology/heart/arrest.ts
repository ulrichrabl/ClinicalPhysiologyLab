import { ARREST } from '../../evidence/arrest.ts';
import { INF } from '../../evidence/inflammation.ts';

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
  /** Post-ischaemic stunning, 0–1: the share of contractility a heart that has come back from an arrest has lost for now,
      whatever its energy state (set when a shock leaves an organised rhythm; recovers over a day). */
  stun = 0;
  /** Core temperature, °C: the myocardium's oxygen demand falls as it cools. */
  temperature = INF.tempBase;
  /** Oxygen demand as a fraction of normothermic (ARREST.demandPerDegree, from ERC 2025's 6–7 % per °C, below the normal
      body temperature). */
  demand(): number { return Math.max(0.2, Math.min(1, 1 - ARREST.demandPerDegree * (INF.tempBase - this.temperature))); }

  /** Advance by `seconds` with coronary perfusion pressure `cpp` (mmHg), the heart beating or not, and the arterial oxygen
      content as a fraction of normal (`o2`). A perfused, oxygenated beating heart stays at 1: nothing here changes a
      patient whose heart is supplied. */
  step(seconds: number, cpp: number, arrested: boolean, o2 = 1): void {
    if (this.stun > 0) this.stun *= Math.exp(-seconds / ARREST.stunRecoveryTau);
    const delivered = Math.max(0, Math.min(1, (cpp - ARREST.cppNoFlow) / (ARREST.cppFullFlow - ARREST.cppNoFlow))) * Math.max(0, Math.min(1, o2));
    /* what is delivered against what the muscle needs: a cold heart needs less */
    const supply = Math.min(1, delivered / this.demand());
    if (!arrested && supply >= 1 && this.M >= 1) { this.M = 1; return; }
    /* The muscle uses up what it has unless the coronary flow brings enough oxygen: fibrillating, still, or beating on
       a supply too small (gap 26: before, a beating heart never ran down, so PEA never deteriorated). The same rate in
       each, an assumption. */
    const fall = (1 - supply) * this.M * this.demand() / ARREST.depletionTau;
    const gain = supply * (1 - this.M) / ARREST.recoveryTau;
    this.M = Math.max(0, Math.min(1, this.M + (gain - fall) * seconds));
  }

  /** How coarse the fibrillation is (the VF dipole's scale), from the state. */
  vfScale(): number { return ARREST.vfFineScale + (1 - ARREST.vfFineScale) * this.M; }

  /** How strongly an organised heart contracts, as a multiple of its own contractility. */
  contractility(): number { return (ARREST.contractilityFloor + (1 - ARREST.contractilityFloor) * this.M) * (1 - this.stun); }

  /** The chance that, once a shock has ended the fibrillation, an organised rhythm follows (rather than asystole). */
  organisedChance(): number { return Math.pow(this.M, ARREST.organisedExponent); }

  /** What a shock does, from two uniform draws: whether it ends the fibrillation, and what follows. */
  shock(uTerminate: number, uRhythm: number): ShockOutcome {
    /* a cold heart is often refractory to shocks (ERC 2025); below 30 °C termination is a fraction of normal */
    const cold = this.temperature < ARREST.coldShockTemperature ? ARREST.coldShockFactor : 1;
    if (uTerminate >= ARREST.shockTermination * cold) return 'not-terminated';
    return uRhythm < this.organisedChance() ? 'organised' : 'asystole';
  }
}
