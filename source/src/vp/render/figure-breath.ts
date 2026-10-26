/* ===========================================================================
   Breathing on the figure: how far the front of the chest and of the belly
   move with the breath the lungs are taking now.

   The volume a breath adds is shared between the rib cage and the
   abdomen (the diaphragm pushing the belly out). Most people breathe mainly
   with the rib cage when upright and mainly with the abdomen when lying
   (Sharp 1975, 81 normal subjects, by Konno and Mead's method); the shares
   here (60 % upright, 35 % supine, to the rib cage) sit inside that and are
   assumed. When the diaphragm is too weak to descend, the falling pleural
   pressure sucks it up into the chest: the belly moves in as the chest
   moves out (paradoxical breathing), and the rib cage takes all the volume
   and more.

   A quiet breath moves the chest wall a few millimetres, invisible at the
   bedside figure's scale, so the motion is magnified (`GAIN`, cm of wall per
   litre of the compartment's volume, assumed): what is seen is the rate,
   the rhythm, how deep each breath is relative to another, and which wall
   moves which way. Never its size in centimetres.
=========================================================================== */

/** cm the drawn wall moves per litre of its compartment's volume: magnified several-fold, for visibility. */
export const GAIN = 6;

export interface BreathMotion { chest: number; belly: number }

/** The walls' displacement (cm, outward positive) for `volume` litres above end-expiration, at this uprightness (0 lying,
    1 upright), with or without a paradoxical (weak) diaphragm. */
export function breathMotion(volume: number, upright: number, paradoxical: boolean): BreathMotion {
  const v = Math.max(-0.2, Math.min(2.5, volume));
  if (paradoxical) return { chest: GAIN * 1.15 * v, belly: -GAIN * 0.35 * v };
  const rc = 0.35 + 0.25 * Math.max(0, Math.min(1, upright));
  return { chest: GAIN * rc * v, belly: GAIN * (1 - rc) * v };
}
