import { LUNG } from '../../evidence/lung.ts';

/* ===========================================================================
   Breaths given at the airway (ADR-018 decision 6b): a bag with a mask, a
   supraglottic airway or a tube, and later the ventilator.

   The source sets the pressure at the airway opening; the lungs' equation of
   motion does the rest, so a breath given into stiff or narrowed lungs
   behaves as it would. A bag breath is squeezed to a volume (until the chest
   rises), over its inspiratory time; the pressure that takes is worked out
   from the lungs' own compliance and resistance. A static pressure (PEEP, or
   a held inflation) can be set as well.

   What reaches the lungs depends on the route:
     mask          leaks round the face; nothing if the airway is not open
     supraglottic  leaks a little
     tube          seals
     oesophageal   a tube in the oesophagus: nothing reaches the lungs, so no
                   chest rise and no CO2 comes back, by itself

   Times are on the lungs' own clock (Respiratory.t). The source is a pure
   function of the breaths it was given, so a run replays exactly.
=========================================================================== */

export type AirwayRoute = 'mask' | 'supraglottic' | 'tube' | 'oesophageal';

export interface GivenBreath { at: number; volume: number; ti: number }

export class Ventilator {
  route: AirwayRoute;
  /** For a mask: whether the airway is held open (head tilt and chin lift, or the jaw thrust of the mask grip). */
  airwayOpen = true;
  /** A static pressure at the airway (cmH2O): PEEP, or a held inflation. */
  staticPressure = 0;
  private breaths: GivenBreath[] = [];
  private rate: { T: number; from: number; until: number; volume: number; ti: number } | null = null;

  constructor(route: AirwayRoute = 'mask') { this.route = route; }

  /** The share of the airway pressure that reaches the lungs. */
  reach(): number {
    if (this.route === 'oesophageal') return 0;
    if (this.route === 'mask') return this.airwayOpen ? 1 - LUNG.maskLeak : 0;
    if (this.route === 'supraglottic') return 1 - LUNG.supraglotticLeak;
    return 1;
  }

  /** One breath, starting at `at` (lungs' seconds): the volume squeezed into the bag's outlet (L) over `ti` seconds. */
  give(at: number, volume = LUNG.bagVolume, ti = LUNG.bagInspiration): void {
    const last = this.breaths.at(-1);
    if (last && at < last.at) throw new Error(`breath at ${at} s before the previous one at ${last.at} s`);
    this.breaths.push({ at, volume, ti });
    if (this.breaths.length > 32) this.breaths.splice(0, this.breaths.length - 32);
  }

  /** Breaths at a steady rate from `from` (a team member with a tube or supraglottic airway, ADR-018: 10/min). */
  steady(rate: number, from: number, until = Infinity, volume = LUNG.bagVolume, ti = LUNG.bagInspiration): void {
    this.rate = { T: 60 / rate, from, until, volume, ti };
  }
  stopSteady(t: number): void { if (this.rate) this.rate.until = Math.min(this.rate.until, t); }

  /** The breath in progress at t, or null. */
  current(t: number): GivenBreath | null {
    let best: GivenBreath | null = null;
    for (let i = this.breaths.length - 1; i >= 0; i--) if (this.breaths[i].at <= t) { best = this.breaths[i]; break; }
    const r = this.rate;
    if (r && t >= r.from) {
      const k = Math.floor((t - r.from) / r.T + 1e-9), at = r.from + k * r.T;
      if (at < r.until && (!best || at > best.at)) best = { at, volume: r.volume, ti: r.ti };
    }
    return best && t - best.at < best.ti ? best : null;
  }

  /** The pressure at the lungs' side of the airway at t (cmH2O), for lungs of compliance Crs (L/cmH2O) and inspiratory
      time constant tauI (s): constant through the breath, set so the volume squeezed in reaches the lungs. */
  pressureAt(t: number, Crs: number, tauI: number): number {
    const reach = this.reach();
    let P = this.staticPressure;
    const b = this.current(t);
    if (b) P += b.volume / (Math.max(0.005, Crs) * (1 - Math.exp(-b.ti / Math.max(0.02, tauI))));
    return P * reach;
  }

  /** Breaths given in [a, b), with the volume each sent towards the lungs (what reaches them is `reach()` of it). */
  given(a: number, b: number): GivenBreath[] {
    const out = this.breaths.filter((x) => x.at >= a && x.at < b);
    const r = this.rate;
    if (r) {
      const k0 = Math.max(0, Math.ceil((Math.max(a, r.from) - r.from) / r.T - 1e-9));
      for (let k = k0; ; k++) {
        const at = r.from + k * r.T;
        if (at >= b || at >= r.until) break;
        out.push({ at, volume: r.volume, ti: r.ti });
      }
    }
    return out.sort((x, y) => x.at - y.at);
  }
}
