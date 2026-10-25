/* ---------------------------------------------------------------------------
   Power, movement by movement: the MRC grade of each movement tested, right
   and left side by side, as the examiner writes it in a grid. Each bar is
   the grade (0–5); a weak one is coloured, and a fatigable movement shows
   its grade after repetition beside it. Read from the examination model's
   findings; nothing here decides a grade.
--------------------------------------------------------------------------- */

type Lang = 'en' | 'de';
type T = { en: string; de: string };
const L = (en: string, de: string): T => ({ en, de });

const ROWS: Array<{ limb: 'arm' | 'leg'; move: string; label: T; root: string }> = [
  { limb: 'arm', move: 'shoulderAbduction', label: L('Shoulder abduction', 'Schulterabduktion'), root: 'C5' },
  { limb: 'arm', move: 'elbowFlexion', label: L('Elbow flexion', 'Ellenbogenbeugung'), root: 'C5–6' },
  { limb: 'arm', move: 'elbowExtension', label: L('Elbow extension', 'Ellenbogenstreckung'), root: 'C7' },
  { limb: 'arm', move: 'wristExtension', label: L('Wrist extension', 'Handgelenkstreckung'), root: 'C6–7' },
  { limb: 'arm', move: 'fingerFlexion', label: L('Finger flexion', 'Fingerbeugung'), root: 'C8' },
  { limb: 'arm', move: 'thumbAbduction', label: L('Thumb abduction', 'Daumenabduktion'), root: 'T1 (median)' },
  { limb: 'arm', move: 'fingerAbduction', label: L('Finger abduction', 'Fingerabduktion'), root: 'T1 (ulnar)' },
  { limb: 'leg', move: 'hipFlexion', label: L('Hip flexion', 'Hüftbeugung'), root: 'L2–3' },
  { limb: 'leg', move: 'hipAdduction', label: L('Hip adduction', 'Hüftadduktion'), root: 'L2–4' },
  { limb: 'leg', move: 'hipAbduction', label: L('Hip abduction', 'Hüftabduktion'), root: 'L5–S1' },
  { limb: 'leg', move: 'kneeExtension', label: L('Knee extension', 'Kniestreckung'), root: 'L3–4' },
  { limb: 'leg', move: 'ankleDorsiflexion', label: L('Ankle dorsiflexion', 'Fußhebung'), root: 'L4–5' },
  { limb: 'leg', move: 'footEversion', label: L('Foot eversion', 'Fußeversion'), root: 'L5–S1' },
  { limb: 'leg', move: 'footInversion', label: L('Foot inversion', 'Fußinversion'), root: 'L4–5 (tibial)' },
  { limb: 'leg', move: 'anklePlantarflexion', label: L('Plantarflexion', 'Fußsenkung'), root: 'S1–2' },
];

export interface PowerChartInput {
  power: { R: { arm?: Record<string, number>; leg?: Record<string, number> }; L: { arm?: Record<string, number>; leg?: Record<string, number> } };
  /** after repetition, where it was tested */
  tired?: { R?: Record<string, number>; L?: Record<string, number> };
}

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function powerChartSvg(input: PowerChartInput, lang: Lang, colors: { fg: string; muted: string; line: string; abn: string; accent: string }): string {
  const W = 520, rowH = 22, top = 34, labelW = 190, barW = 120, gap = 20;
  const xR = labelW, xL = labelW + barW + gap;
  const out: string[] = [];
  out.push(`<text x="${xR + barW / 2}" y="16" text-anchor="middle" font-size="12" font-weight="600" fill="${colors.fg}">${lang === 'de' ? 'Rechts' : 'Right'}</text>`);
  out.push(`<text x="${xL + barW / 2}" y="16" text-anchor="middle" font-size="12" font-weight="600" fill="${colors.fg}">${lang === 'de' ? 'Links' : 'Left'}</text>`);
  for (const [k, x] of [[0, xR], [0, xL]] as Array<[number, number]>) for (let g = 0; g <= 5; g++) {
    out.push(`<line x1="${x + (barW * g) / 5}" y1="${top - 6}" x2="${x + (barW * g) / 5}" y2="${top + rowH * ROWS.length + 4}" stroke="${colors.line}" stroke-width="${g === 5 ? 1 : 0.5}" opacity=".6"/>`);
    out.push(`<text x="${x + (barW * g) / 5}" y="${top - 9}" text-anchor="middle" font-size="9" fill="${colors.muted}">${g}</text>`);
    void k;
  }
  ROWS.forEach((r, i) => {
    const y = top + i * rowH;
    if (i === 7) out.push(`<line x1="8" y1="${y - 2}" x2="${W - 8}" y2="${y - 2}" stroke="${colors.line}" stroke-width="1"/>`);
    out.push(`<text x="8" y="${y + 14}" font-size="11.5" fill="${colors.fg}">${esc(r.label[lang])}<tspan fill="${colors.muted}" font-size="9.5"> ${esc(r.root)}</tspan></text>`);
    for (const [S, x] of [['R', xR], ['L', xL]] as Array<['R' | 'L', number]>) {
      const g = input.power[S][r.limb]?.[r.move];
      if (typeof g !== 'number') { out.push(`<text x="${x + 4}" y="${y + 14}" font-size="10" fill="${colors.muted}">–</text>`); continue; }
      const weak = g < 5;
      out.push(`<rect x="${x}" y="${y + 4}" width="${(barW * g) / 5}" height="12" rx="2" fill="${weak ? colors.abn : colors.accent}" opacity="${weak ? 0.85 : 0.35}"><title>${esc(r.label[lang])} ${S}: ${g}/5</title></rect>`);
      out.push(`<text x="${x + (barW * g) / 5 + 4}" y="${y + 14}" font-size="10.5" font-weight="${weak ? 700 : 400}" fill="${weak ? colors.abn : colors.muted}">${g}</text>`);
      const t = input.tired?.[S]?.[r.move];
      if (typeof t === 'number' && t < g) out.push(`<rect x="${x}" y="${y + 13}" width="${(barW * t) / 5}" height="3" fill="${colors.fg}" opacity=".7"><title>${lang === 'de' ? 'nach Wiederholung' : 'after repetition'}: ${t}/5</title></rect><text x="${x + barW + 2}" y="${y + 14}" font-size="9.5" fill="${colors.fg}">→${t}</text>`);
    }
  });
  const H = top + rowH * ROWS.length + 26;
  out.push(`<text x="8" y="${H - 8}" font-size="10" fill="${colors.muted}">${lang === 'de' ? 'MRC: 5 normal, 4 gegen Widerstand, 3 gegen Schwerkraft, 2 ohne Schwerkraft, 1 Flackern, 0 nichts' : 'MRC: 5 normal, 4 against resistance, 3 against gravity, 2 gravity removed, 1 a flicker, 0 nothing'}</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" style="max-width:${W}px">${out.join('')}</svg>`;
}
