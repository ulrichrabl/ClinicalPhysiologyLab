import { thoraxSvg, type ThoraxLook } from './thorax.ts';

/* ===========================================================================
   What the hands feel on the chest, drawn: the trachea in the suprasternal
   notch, and two hands on the lower ribs moving apart with each breath.

   Both are driven by the model: the trachea sits where the mediastinal shift
   puts it (the same index the finding reads), and each hand moves with the
   lung beneath it, the breath's volume shared out by where it goes.
=========================================================================== */

const f = (x: number) => x.toFixed(2);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** The base of the neck from the front: the clavicles' heads, the sternal notch, the sternomastoids, and the trachea
    displaced by `shift` (positive toward the patient's left: the viewer's right), under the examiner's fingertip. */
export function tracheaSvg(shift: number, look: { skin: string; shade: string }, labels: { notch: string; left: string; right: string }): string {
  /* about 0.9 cm per unit of the shift index: felt beyond ±0.5 (half a centimetre, the width of a fingertip's edge) */
  const dx = clamp(shift, -2.5, 2.5) * 0.9;
  const out: string[] = [];
  out.push(`<rect x="-10" y="-8" width="20" height="16" fill="${look.skin}"/>`);
  /* the sternomastoids, running up from the clavicles' heads */
  for (const s of [-1, 1]) out.push(`<path d="M ${f(s * 1.6)} 2.4 C ${f(s * 2.4)} -2 ${f(s * 3.6)} -5 ${f(s * 5.2)} -8" fill="none" stroke="${look.shade}" stroke-width="1.4" stroke-linecap="round" opacity="0.55"/>`);
  /* the clavicles and the manubrium's notch between them */
  out.push(`<path d="M -10 3.2 C -6 2.4 -3 2.6 -1.7 3.0 M 10 3.2 C 6 2.4 3 2.6 1.7 3.0" fill="none" stroke="${look.shade}" stroke-width="0.9" stroke-linecap="round"/>`);
  out.push(`<path d="M -1.8 3.4 Q 0 1.8 1.8 3.4 L 1.8 8 L -1.8 8 Z" fill="${look.shade}" opacity="0.35"/>`);
  /* the trachea, its rings under the skin */
  out.push(`<g transform="translate(${f(dx)} 0)"><rect x="-1.15" y="-8" width="2.3" height="11.6" rx="1.1" fill="${look.shade}" opacity="0.35"/>`);
  for (let y = -7.2; y < 3; y += 1.1) out.push(`<path d="M -1.05 ${f(y)} Q 0 ${f(y - 0.35)} 1.05 ${f(y)}" fill="none" stroke="${look.shade}" stroke-width="0.22" opacity="0.8"/>`);
  out.push(`</g>`);
  /* the examiner's index finger in the notch, coming from below */
  out.push(`<path d="M ${f(dx * 0.7 - 0.9)} 8 L ${f(dx * 0.7 - 0.8)} 3.2 Q ${f(dx * 0.7)} 2.2 ${f(dx * 0.7 + 0.8)} 3.2 L ${f(dx * 0.7 + 0.9)} 8 Z" fill="#e2b89a" stroke="#b98d70" stroke-width="0.12"/>`);
  out.push(`<path d="M 0 -8 L 0 8" stroke="rgba(0,0,0,0.25)" stroke-width="0.08" stroke-dasharray="0.4 0.4"/>`);
  out.push(`<text x="-9.6" y="7.4" font-size="0.9" fill="rgba(0,0,0,0.55)">${labels.right}</text><text x="9.6" y="7.4" font-size="0.9" text-anchor="end" fill="rgba(0,0,0,0.55)">${labels.left}</text>`);
  out.push(`<text x="0" y="7.4" font-size="0.75" text-anchor="middle" fill="rgba(0,0,0,0.5)">${labels.notch}</text>`);
  return `<svg viewBox="-10 -8 20 16" xmlns="http://www.w3.org/2000/svg" role="img">${out.join('')}</svg>`;
}

/** One hand on the lower ribs, `s` −1 on the patient's right (viewer's left): the fingers spread along the ribs toward
    the side of the chest, the thumb raised off the skin with its tip `thumbX` cm from the midline. A hand about 18 cm long. */
function hand(s: 1 | -1, thumbX: number, y: number): string {
  const ink = '#7d5b47', skin = '#ecc4a6';
  const x0 = s * (thumbX + 3.2);                     /* the heel of the hand, beside the thumb's base */
  const X = (dx: number) => f(x0 + s * dx);
  const LEN = [9.4, 10.6, 10.2, 8.8], DY = [-2.7, -0.9, 0.9, 2.6];
  const finger = (i: number) => `M ${X(4)} ${f(y + DY[i] * 0.9)} C ${X(7)} ${f(y + DY[i])} ${X(LEN[i] - 1.5)} ${f(y + DY[i] * 1.15)} ${X(LEN[i])} ${f(y + DY[i] * 1.2 + 0.2)}`;
  /* each finger an outlined rounded stroke: the ink a little wider underneath */
  const fingers = DY.map((_, i) => `<path d="${finger(i)}" fill="none" stroke="${ink}" stroke-width="1.75" stroke-linecap="round"/>`).join('')
    + DY.map((_, i) => `<path d="${finger(i)}" fill="none" stroke="${skin}" stroke-width="1.47" stroke-linecap="round"/>`).join('');
  const outline = '';
  return `<g>
    <path d="M ${X(-0.4)} ${f(y - 2.2)} C ${X(1.5)} ${f(y - 3.8)} ${X(4.5)} ${f(y - 3.6)} ${X(6)} ${f(y - 3.2)} L ${X(6)} ${f(y + 3.4)} C ${X(4)} ${f(y + 4)} ${X(1)} ${f(y + 3.6)} ${X(-0.2)} ${f(y + 2.2)} Z" fill="${skin}" stroke="${ink}" stroke-width="0.16"/>
    ${fingers}${outline}
    <path d="M ${X(0.6)} ${f(y - 1.6)} C ${f(s * (thumbX + 2.2))} ${f(y - 2.6)} ${f(s * (thumbX + 0.9))} ${f(y - 2.4)} ${f(s * thumbX)} ${f(y - 2.0)}" fill="none" stroke="${ink}" stroke-width="1.75" stroke-linecap="round"/>
    <path d="M ${X(0.6)} ${f(y - 1.6)} C ${f(s * (thumbX + 2.2))} ${f(y - 2.6)} ${f(s * (thumbX + 0.9))} ${f(y - 2.4)} ${f(s * thumbX)} ${f(y - 2.0)}" fill="none" stroke="${skin}" stroke-width="1.45" stroke-linecap="round"/></g>`;
}

/** The chest from the front with the examiner's hands on the lower ribs, thumbs at the midline, each moved out by its
    side's expansion now (cm). The gap between the thumbs is the measure. */
export function expansionSvg(look: ThoraxLook, cmL: number, cmR: number, labels: { left: string; right: string }): string {
  const y = 11.5;
  const inner = hand(-1, 0.35 + cmR, y) + hand(1, 0.35 + cmL, y)
    + `<path d="M 0 ${f(y - 5)} L 0 ${f(y + 4)}" stroke="rgba(0,0,0,0.45)" stroke-width="0.12" stroke-dasharray="0.5 0.4"/>`
    + `<text x="-13" y="${f(y + 7)}" font-size="1.1" fill="rgba(0,0,0,0.6)">${labels.right}</text><text x="13" y="${f(y + 7)}" font-size="1.1" text-anchor="end" fill="rgba(0,0,0,0.6)">${labels.left}</text>`;
  return thoraxSvg(look, 'front', inner).replace('<svg ', '<svg class="thorax" ');
}
