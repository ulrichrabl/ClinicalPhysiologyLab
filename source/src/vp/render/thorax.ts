/* ===========================================================================
   The chest, seen from the front (or the back), in centimetres.

   One drawing serves the stethoscope and the ECG electrodes, and it uses
   the same coordinates as the ECG lead field (measurements/ecg.ts): x to
   the patient's left from the midline, y downward from the fourth
   intercostal space, one intercostal space ≈ 2.5 cm. So an electrode
   dropped on the drawing is an electrode at that point of the model's
   chest, and the landmarks a clinician counts (sternal angle, intercostal
   spaces, midclavicular and axillary lines) are where the model says they
   are.

   Drawn facing the patient: the patient's left is on the viewer's right.
=========================================================================== */

export const TORSO_A = 15;      // half-width, cm (matches the lead field's ellipse)

/** Rib n (2–8) at lateral distance |x|: y in cm. Rib n lies just above intercostal space n. */
export const ribY = (n: number, x: number) => (n - 4) * 2.5 - 1.25 + 0.006 * x * x;
/** Middle of intercostal space n at |x|. */
export const icsY = (n: number, x: number) => (ribY(n, x) + ribY(n + 1, x)) / 2;

/** Chest-surface coordinates (as the lead field uses) ↔ the front view. */
export const frontX = (phi: number) => TORSO_A * Math.sin((phi * Math.PI) / 180);
export const phiOf = (x: number) => (Math.asin(Math.max(-1, Math.min(1, x / TORSO_A))) * 180) / Math.PI;

/** Auscultation sites, where a clinician puts the stethoscope. */
export const AUSCULTATION_SITES: Record<string, { x: number; y: number; view: 'front' | 'back' | 'neck' }> = {
  'chest.aortic-area': { x: -3.3, y: icsY(2, 3.3), view: 'front' },
  'chest.pulmonary-area': { x: 3.3, y: icsY(2, 3.3), view: 'front' },
  'chest.erb': { x: 3.3, y: icsY(3, 3.3), view: 'front' },
  'chest.tricuspid-area': { x: 3.0, y: icsY(4, 3), view: 'front' },
  'chest.mitral-area': { x: 8.6, y: icsY(5, 8.6), view: 'front' },
  'chest.axilla.L': { x: 14.2, y: icsY(5, 14.2), view: 'front' },
  'neck.carotid.R': { x: -3.6, y: -16.5, view: 'front' },
  'neck.carotid.L': { x: 3.6, y: -16.5, view: 'front' },
  'chest.lung-base.R': { x: -8, y: 14, view: 'back' },
  'chest.lung-base.L': { x: 8, y: 14, view: 'back' },
  /* lung sites */
  'chest.upper-zone.R': { x: -7.5, y: icsY(1, 7.5), view: 'front' },
  'chest.upper-zone.L': { x: 7.5, y: icsY(1, 7.5), view: 'front' },
  'chest.mid-zone.R': { x: -8, y: icsY(4, 8), view: 'front' },
  'chest.mid-zone.L': { x: 11, y: icsY(4, 11), view: 'front' },
  'chest.axilla.R': { x: -14.2, y: icsY(5, 14.2), view: 'front' },
  'chest.upper-back.R': { x: -6.5, y: -6, view: 'back' },
  'chest.upper-back.L': { x: 6.5, y: -6, view: 'back' },
};
/** The ten places one examines the lungs. */
export const LUNG_SITE_IDS = ['chest.upper-zone', 'chest.mid-zone', 'chest.axilla', 'chest.upper-back', 'chest.lung-base'].flatMap((s) => [`${s}.R`, `${s}.L`]);

/** The lobes' surface projection, fissures included, for teaching where each lobe can be heard. Front or back. */
export function lobesUnderChest(view: 'front' | 'back', color = 'rgba(79,111,179,0.55)'): string {
  const out: string[] = [];
  const lung = (s: 1 | -1) => `M ${f(s * 2.2)} -13.6 C ${f(s * 6)} -14.6 ${f(s * 11)} -12 ${f(s * 13.6)} -6 C ${f(s * 15)} 0 ${f(s * 14.6)} 8 ${f(s * 13.4)} ${view === 'back' ? 16 : 12}
    C ${f(s * 9)} ${view === 'back' ? 17 : 11} ${f(s * 5)} ${view === 'back' ? 15 : 9} ${f(s * 1.6)} ${view === 'back' ? 14 : 4} Z`;
  out.push(`<path d="${lung(1)} ${lung(-1)}" fill="rgba(79,111,179,0.08)" stroke="${color}" stroke-width="0.3"/>`);
  if (view === 'front') {
    // oblique fissures run from T3 behind to the 6th costochondral junction in front; the horizontal fissure along the 4th rib (right)
    out.push(`<path d="M -14.4 2 C -10 4 -6 6.2 -2.4 7.4 M 14.4 1.4 C 10 3.8 6 6.4 3 8.2" fill="none" stroke="${color}" stroke-width="0.25" stroke-dasharray="0.8 0.5"/>`);
    out.push(`<path d="M -2.4 ${f(ribY(4, 2.4))} C -6 ${f(ribY(4, 6) + 0.2)} -10 ${f(ribY(4, 10) + 0.2)} -14.2 1.6" fill="none" stroke="${color}" stroke-width="0.25" stroke-dasharray="0.8 0.5"/>`);
    out.push(`<text x="-8" y="-6" font-size="1.3" text-anchor="middle" fill="${color}">RUL</text><text x="-8" y="3.4" font-size="1.3" text-anchor="middle" fill="${color}">RML</text>`);
    out.push(`<text x="8" y="-3" font-size="1.3" text-anchor="middle" fill="${color}">LUL</text><text x="12.4" y="8.6" font-size="1.1" text-anchor="middle" fill="${color}">LLL</text><text x="-12.4" y="9" font-size="1.1" text-anchor="middle" fill="${color}">RLL</text>`);
  } else {
    // from behind, the oblique fissures start at T3 near the spine: below them, all lower lobe
    out.push(`<path d="M -1.6 -5 C -6 -3 -10 2 -13.6 6 M 1.6 -5 C 6 -3 10 2 13.6 6" fill="none" stroke="${color}" stroke-width="0.25" stroke-dasharray="0.8 0.5"/>`);
    out.push(`<text x="-7" y="-9" font-size="1.3" text-anchor="middle" fill="${color}">LUL</text><text x="7" y="-9" font-size="1.3" text-anchor="middle" fill="${color}">RUL</text>`);
    out.push(`<text x="-7" y="9" font-size="1.3" text-anchor="middle" fill="${color}">LLL</text><text x="7" y="9" font-size="1.3" text-anchor="middle" fill="${color}">RLL</text>`);
  }
  return out.join('');
}

/** Two fingers percussing: the pleximeter finger flat on the wall, the plexor finger striking it. `tap` 0..1 is the stroke. */
export function percussionHand(x: number, y: number, tap: number, skin: string, shade: string): string {
  const lift = 3.2 * (1 - tap);
  return `<g class="hand" transform="translate(${f(x)} ${f(y)})">
    <rect x="-3.8" y="-0.7" width="7.6" height="1.4" rx="0.7" fill="${skin}" stroke="${shade}" stroke-width="0.2"/>
    <path d="M 1.2 ${f(-1 - lift)} L 1.2 ${f(-6 - lift)}" stroke="${skin}" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M 1.2 ${f(-1 - lift)} L 1.2 ${f(-6 - lift)}" stroke="${shade}" stroke-width="0.2" fill="none"/>
    ${tap > 0.9 ? `<circle cx="1.2" cy="-0.9" r="${f(1.6 * tap)}" fill="none" stroke="rgba(200,71,61,0.6)" stroke-width="0.2"/>` : ''}</g>`;
}

export interface ThoraxLook { skin: string; shade: string; sex: 'F' | 'M'; line?: string; muted?: string }

const f = (x: number) => x.toFixed(2);

/** The body outline: neck, shoulders, arms hanging slightly away, trunk, upper thighs. */
function outline(look: ThoraxLook): string {
  const sk = `fill="${look.skin}" stroke="${look.shade}" stroke-width="0.25" stroke-linejoin="round"`;
  const arm = (s: 1 | -1) => `<path ${sk} d="M ${f(s * 15.5)} -14.5 C ${f(s * 19.5)} -14 ${f(s * 20.6)} -11 ${f(s * 20.6)} -6
      L ${f(s * 22)} 10 L ${f(s * 23)} 21 C ${f(s * 23.6)} 25 ${f(s * 21)} 26.4 ${f(s * 20)} 24.4 L ${f(s * 18.8)} 11 L ${f(s * 16.6)} -2 Z"/>`;
  const leg = (s: 1 | -1) => `<path ${sk} d="M ${f(s * 0.8)} 26 L ${f(s * 13.6)} 24 C ${f(s * 13.2)} 30 ${f(s * 12)} 36 ${f(s * 11.4)} 42 L ${f(s * 2.2)} 42 C ${f(s * 1.8)} 36 ${f(s * 1.2)} 30 ${f(s * 0.8)} 26 Z"/>`;
  return `${arm(1)}${arm(-1)}${leg(1)}${leg(-1)}
    <path ${sk} d="M -3.8 -24 L 3.8 -24 L 4.4 -15.6 C 9 -14.6 13 -15.2 15.8 -14.2 C 17.4 -13 17 -8 16.4 -2 C 15.8 6 15 11 14.2 15
      C 14.2 19 14.6 22 14.4 26 L -14.4 26 C -14.6 22 -14.2 19 -14.2 15 C -15 11 -15.8 6 -16.4 -2 C -17 -8 -17.4 -13 -15.8 -14.2
      C -13 -15.2 -9 -14.6 -4.4 -15.6 Z"/>`;
}

/** Bones and landmarks under the skin, faint. */
function skeleton(look: ThoraxLook, view: 'front' | 'back'): string {
  const line = look.line ?? 'rgba(60,50,40,0.28)';
  const out: string[] = [];
  if (view === 'front') {
    // clavicles
    out.push(`<path d="M -1.6 -11.6 C -6 -12.6 -10 -11.4 -14.4 -12.6 M 1.6 -11.6 C 6 -12.6 10 -11.4 14.4 -12.6" fill="none" stroke="${line}" stroke-width="0.55" stroke-linecap="round"/>`);
    // sternum with the sternal angle
    out.push(`<path d="M -2 -11.4 L 2 -11.4 L 2.3 -7.6 L 1.9 5.4 L 0 7.4 L -1.9 5.4 L -2.3 -7.6 Z" fill="none" stroke="${line}" stroke-width="0.35"/>`);
    out.push(`<path d="M -2.3 -7.6 L 2.3 -7.6" stroke="${line}" stroke-width="0.35"/>`);
    // ribs 2–8, from the sternal edge outward
    for (let n = 2; n <= 8; n++) {
      for (const s of [-1, 1]) {
        const x0 = n <= 7 ? 2.3 : 6, x1 = n <= 6 ? 15.2 : 14.4;
        const pts: string[] = [];
        for (let x = x0; x <= x1; x += 0.8) pts.push(`${f(s * x)},${f(ribY(n, x))}`);
        out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${line}" stroke-width="${n === 2 ? 0.32 : 0.26}" stroke-linecap="round"/>`);
      }
    }
    // costal margins
    out.push(`<path d="M 0 7.4 C 4 9 9 12 13.6 15.4 M 0 7.4 C -4 9 -9 12 -13.6 15.4" fill="none" stroke="${line}" stroke-width="0.4"/>`);
    // nipples / breasts
    if (look.sex === 'M') out.push(`<circle cx="-9" cy="0.4" r="0.45" fill="${look.shade}"/><circle cx="9" cy="0.4" r="0.45" fill="${look.shade}"/>`);
    else out.push(`<path d="M -14 0 C -13 7 -5 7 -3.5 2.2 M 14 0 C 13 7 5 7 3.5 2.2" fill="none" stroke="${look.shade}" stroke-width="0.35"/><circle cx="-8.6" cy="3.2" r="0.5" fill="${look.shade}"/><circle cx="8.6" cy="3.2" r="0.5" fill="${look.shade}"/>`);
    out.push(`<path d="M -0.2 19 a 0.6 0.6 0 1 0 0.4 0" fill="none" stroke="${look.shade}" stroke-width="0.25"/>`);   // umbilicus
  } else {
    // spine, scapulae, lower ribs
    out.push(`<path d="M 0 -15 L 0 28" stroke="${line}" stroke-width="0.4" stroke-dasharray="0.6 0.8"/>`);
    for (const s of [-1, 1]) {
      out.push(`<path d="M ${f(s * 4)} -11 L ${f(s * 12)} -12 L ${f(s * 9)} 2 Z" fill="none" stroke="${line}" stroke-width="0.35"/>`);
      for (let k = 0; k < 6; k++) out.push(`<path d="M ${f(s * 1.2)} ${f(-4 + k * 3.2)} C ${f(s * 7)} ${f(-5 + k * 3.2)} ${f(s * 12)} ${f(-2 + k * 3.2)} ${f(s * 14.4)} ${f(1 + k * 3.2)}" fill="none" stroke="${line}" stroke-width="0.24"/>`);
    }
  }
  return out.join('');
}

/** The heart under the chest wall, at its anatomical projection; `beat` 0..1 shrinks it in systole. */
export function heartUnderChest(beat: number, color = 'rgba(200,71,61,0.22)', stroke = 'rgba(200,71,61,0.6)'): string {
  const k = 0.86 * (1 - 0.07 * beat);
  const cx = 2.6, cy = 0.4;
  const T = (x: number, y: number) => `${f(cx + (x - cx) * k)} ${f(cy + (y - cy) * k)}`;
  return `<path d="M ${T(-3.4, -5.6)} C ${T(-4.6, -2)} ${T(-4.4, 1.6)} ${T(-3.2, 4.2)} C ${T(0, 6.4)} ${T(5, 5.6)} ${T(8.6, 3.4)}
    C ${T(8.8, 0)} ${T(6.4, -4.4)} ${T(3.8, -6.8)} C ${T(1.4, -8)} ${T(-1.6, -7.4)} ${T(-3.4, -5.6)} Z" fill="${color}" stroke="${stroke}" stroke-width="0.3"/>
    <path d="M ${T(-1.2, -6.8)} C ${T(-1, -9.6)} ${T(2.6, -10.4)} ${T(3.4, -7.4)}" fill="none" stroke="${stroke}" stroke-width="0.9" stroke-linecap="round"/>`;
}

/** Landmark lines and intercostal numbers, for teaching placement. */
export function landmarks(color = 'rgba(31,111,102,0.55)'): string {
  const out: string[] = [];
  const v = (x: number, label: string) => {
    out.push(`<path d="M ${f(x)} -12 L ${f(x)} 16" stroke="${color}" stroke-width="0.18" stroke-dasharray="0.6 0.6"/>`);
    out.push(`<text x="${f(x)}" y="17.4" font-size="1.05" text-anchor="middle" fill="${color}">${label}</text>`);
  };
  v(9, 'MCL'); v(-9, 'MCL'); v(13.2, 'AAL'); v(15, 'MAL');
  for (let n = 1; n <= 6; n++) out.push(`<text x="-2.9" y="${f(icsY(n, 2.9) + 0.35)}" font-size="0.95" text-anchor="end" fill="${color}">${n}</text>`);
  out.push(`<text x="2.8" y="-7.3" font-size="1" fill="${color}">∠ Louis</text>`);
  return out.join('');
}

export function thoraxSvg(look: ThoraxLook, view: 'front' | 'back', inner = ''): string {
  return `<svg viewBox="-26 -25 52 62" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${view === 'front' ? 'Chest, front' : 'Chest, back'}">
    <g>${outline(look)}${skeleton(look, view)}</g>${inner}</svg>`;
}

/** A stethoscope chest-piece at a point, with its tubing leaving the picture. */
export function stethoscope(x: number, y: number, bell: boolean): string {
  return `<g class="steth" transform="translate(${f(x)} ${f(y)})">
    <path d="M 0 0 C 3 -4 8 -6 13 -12" fill="none" stroke="#2b2b2b" stroke-width="0.7" stroke-linecap="round"/>
    <circle r="${bell ? 1.3 : 1.8}" fill="#c9ced1" stroke="#555" stroke-width="0.3"/>
    <circle r="${bell ? 0.8 : 1.3}" fill="${bell ? '#8a8f93' : '#e8ecee'}" stroke="#777" stroke-width="0.15"/></g>`;
}
