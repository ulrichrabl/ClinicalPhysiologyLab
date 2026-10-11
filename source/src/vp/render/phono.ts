/* ---------------------------------------------------------------------------
   Phonocardiogram events from a heart-sounds finding.

   Turns the structured value the cardiovascular model produced at one
   auscultation site ({ s1, a2, p2, s2Split, added, murmurs }) and the heart
   rate into timed acoustic events for one cardiac cycle. A renderer draws
   them as a phonocardiogram; an audio synthesiser plays them. Both therefore
   show and sound exactly what the finding says: a soft A2 is quieter, a
   single S2 has no split, a grade 4/6 murmur is louder than a 2/6 one.
--------------------------------------------------------------------------- */

export interface Sound { name: 's1' | 'a2' | 'p2' | 's3' | 's4' | 'opening-snap' | 'ejection-click'; t: number; amp: number; freqHz: number; durS: number }
export interface Murmur { start: number; end: number; shape: string; amp: number; centreHz: number }
export interface Cycle { periodS: number; systoleS: number; sounds: Sound[]; murmurs: Murmur[] }

const PITCH_HZ: Record<string, number> = { low: 120, medium: 260, high: 420 };
const LEVEL: Record<string, number> = { normal: 1, loud: 1.5, soft: 0.45, absent: 0 };

export function cycle(v: any, heartRate: number): Cycle {
  const periodS = 60 / Math.max(30, heartRate || 72);
  // Electromechanical systole shortens less than diastole as the rate rises.
  const systoleS = Math.min(0.45 * periodS, 0.52 - 0.0017 * (heartRate || 72));
  const s2 = systoleS;
  const sounds: Sound[] = [];
  if (v.s1 !== undefined) sounds.push({ name: 's1', t: 0, amp: LEVEL[v.s1] ?? 1, freqHz: 55, durS: 0.1 });
  if (v.a2 !== undefined) {
    const split = v.s2Split === 'wide' || v.s2Split === 'fixed' ? 0.05 : v.s2Split === 'physiological' ? 0.02 : 0;
    const reversed = v.s2Split === 'reversed';
    if ((LEVEL[v.a2] ?? 1) > 0) sounds.push({ name: 'a2', t: reversed ? s2 + 0.04 : s2, amp: (LEVEL[v.a2] ?? 1) * 0.85, freqHz: 70, durS: 0.06 });
    if (split > 0 || reversed) sounds.push({ name: 'p2', t: reversed ? s2 : s2 + split, amp: (LEVEL[v.p2] ?? 1) * 0.55, freqHz: 70, durS: 0.05 });
    else if (v.p2 === 'loud') sounds.push({ name: 'p2', t: s2, amp: 0.6, freqHz: 70, durS: 0.05 });
  }
  for (const a of v.added ?? []) {
    if (a === 's4') sounds.push({ name: 's4', t: periodS - 0.09, amp: 0.45, freqHz: 30, durS: 0.06 });
    if (a === 's3') sounds.push({ name: 's3', t: s2 + 0.14, amp: 0.45, freqHz: 30, durS: 0.06 });
    if (a === 'opening-snap') sounds.push({ name: 'opening-snap', t: s2 + 0.08, amp: 0.6, freqHz: 90, durS: 0.03 });
    if (a === 'ejection-click') sounds.push({ name: 'ejection-click', t: 0.07, amp: 0.6, freqHz: 110, durS: 0.025 });
  }
  const murmurs: Murmur[] = (v.murmurs ?? []).map((m: any): Murmur => {
    const amp = Math.min(1, m.grade / 6 * 1.2);
    const centreHz = PITCH_HZ[m.pitch] ?? 260;
    switch (m.timing) {
      case 'ejection-systolic': return { start: 0.06, end: s2 - 0.03, shape: 'crescendo-decrescendo', amp, centreHz };
      case 'pansystolic': return { start: 0.01, end: s2 + 0.01, shape: 'plateau', amp, centreHz };
      case 'early-diastolic': return { start: s2 + 0.01, end: s2 + 0.45 * (periodS - s2), shape: 'decrescendo', amp, centreHz };
      default: return { start: s2 + 0.12, end: s2 + 0.6 * (periodS - s2), shape: 'decrescendo', amp, centreHz };   // mid-diastolic rumble
    }
  });
  return { periodS, systoleS, sounds, murmurs };
}

/** Envelope of a murmur at time t within the cycle, 0..1 of its amplitude. */
export function murmurEnvelope(m: Murmur, t: number): number {
  if (t < m.start || t > m.end) return 0;
  const x = (t - m.start) / (m.end - m.start);
  if (m.shape === 'crescendo-decrescendo') return Math.sin(Math.PI * x);
  if (m.shape === 'decrescendo') return 1 - x;
  return 1;
}

/** A displayable phonocardiogram sample at time t (seconds, any value). Deterministic pseudo-noise. */
export function phonoSample(c: Cycle, t: number): number {
  const tc = ((t % c.periodS) + c.periodS) % c.periodS;
  let y = 0;
  for (const s of c.sounds) {
    const d = tc - s.t;
    if (d >= 0 && d < s.durS) y += s.amp * Math.sin(2 * Math.PI * s.freqHz * d) * Math.exp(-d / (s.durS / 3));
  }
  for (const m of c.murmurs) {
    const e = murmurEnvelope(m, tc);
    if (e > 0) y += m.amp * 0.45 * e * Math.sin(tc * 2 * Math.PI * m.centreHz * 0.37 + Math.sin(tc * 913.7) * 4) * Math.sin(tc * 2717.3);
  }
  return y;
}
