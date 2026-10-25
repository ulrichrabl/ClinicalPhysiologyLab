import { tr, type LocalizedText } from '../model/i18n.ts';
import { NEURO_TEST_BY_ID, type NeuroTest } from '../stations/neuro-tests.ts';
import { rungOf, type Rung } from '../stations/neuro-texts.ts';
import { neuroNodeLabel } from '../stations/neuro-presets.ts';

/* ---------------------------------------------------------------------------
   The ladder a clinician descends to place a lesion, for the neurological
   station's mechanism pane: cortex, internal capsule, brainstem, cord, root,
   plexus, nerve, junction, muscle, with the cerebellum beside it. The rungs
   the test reads are drawn strong; a rung with a lesion on it is marked, with
   its structures named. Nothing here decides a finding: it shows where the
   lesion sits, and the findings come from the examination model.
--------------------------------------------------------------------------- */

type T = { en: string; de: string };
const RUNGS: Array<{ id: Rung; label: T }> = [
  { id: 'cortex', label: { en: 'Cortex', de: 'Rinde' } },
  { id: 'capsule', label: { en: 'Internal capsule', de: 'Capsula interna' } },
  { id: 'brainstem', label: { en: 'Brainstem', de: 'Hirnstamm' } },
  { id: 'cord', label: { en: 'Spinal cord', de: 'Rückenmark' } },
  { id: 'root', label: { en: 'Root', de: 'Wurzel' } },
  { id: 'plexus', label: { en: 'Plexus', de: 'Plexus' } },
  { id: 'nerve', label: { en: 'Nerve', de: 'Nerv' } },
  { id: 'junction', label: { en: 'Neuromuscular junction', de: 'Motorische Endplatte' } },
  { id: 'muscle', label: { en: 'Muscle', de: 'Muskel' } },
];
const READS = (test: NeuroTest): Rung[] => NEURO_TEST_BY_ID[test].reads;
const PATH = (test: NeuroTest): Partial<Record<Rung, LocalizedText>> => NEURO_TEST_BY_ID[test].path;

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const pretty = (id: string, lang: 'en' | 'de') => neuroNodeLabel(id)[lang];

/** The ladder as SVG, 360 units wide. */
export function neuroLadderSvg(test: NeuroTest, lesions: string[], lang: 'en' | 'de', colors: { fg: string; muted: string; accent: string; abn: string; line: string }, extent: Record<string, number> = {}): string {
  const hit = new Map<Rung, string[]>();
  for (const n of lesions) { const r = rungOf(n); if (r) hit.set(r, [...(hit.get(r) ?? []), n]); }
  const reads = new Set(READS(test));
  const rowH = 30, top = 8, x0 = 14, w = 250;
  const out: string[] = [];
  /* each rung's row grows by a line for every structure cut on it, one name a line */
  const subs = RUNGS.map((r) => { const cut = hit.get(r.id); return cut ? cut.map((n) => pretty(n, lang) + (extent[n] !== undefined && extent[n] < 1 ? (lang === 'de' ? ` (zu ${Math.round(extent[n] * 100)} %)` : ` (${Math.round(extent[n] * 100)} % of it)`) : '')) : reads.has(r.id) && PATH(test)[r.id] ? [tr(PATH(test)[r.id]!, lang)] : []; });
  const ys: number[] = [];
  let yy = top;
  RUNGS.forEach((_, i) => { ys.push(yy); yy += rowH + 11 * Math.max(0, subs[i].length - 1); });
  const mid = (i: number) => ys[i] + rowH / 2 - 4;
  /* the spine of the ladder */
  out.push(`<line x1="${x0 + 6}" y1="${mid(0)}" x2="${x0 + 6}" y2="${mid(RUNGS.length - 1)}" stroke="${colors.line}" stroke-width="2"/>`);
  RUNGS.forEach((r, i) => {
    const y = mid(i), on = reads.has(r.id), cut = hit.get(r.id);
    const col = cut ? colors.abn : on ? colors.accent : colors.muted;
    out.push(`<circle cx="${x0 + 6}" cy="${y}" r="${on || cut ? 6 : 4}" fill="${on || cut ? col : 'none'}" stroke="${col}" stroke-width="1.5"/>`);
    if (cut) out.push(`<path d="M${x0} ${y - 6} l12 12 M${x0 + 12} ${y - 6} l-12 12" stroke="${colors.abn}" stroke-width="2.4"/>`);
    out.push(`<text x="${x0 + 20}" y="${y + 4}" font-size="12" font-weight="${on || cut ? 600 : 400}" fill="${on || cut ? colors.fg : colors.muted}">${esc(r.label[lang])}</text>`);
    subs[i].forEach((line, k) => out.push(`<text x="${x0 + 20}" y="${y + 17 + 11 * k}" font-size="10" fill="${cut ? colors.abn : colors.muted}">${esc(line)}</text>`));
  });
  /* the cerebellum, beside the ladder at the level of the brainstem, joined to the cord and the cortex */
  const cy = mid(2), cx = x0 + w + 20, cOn = reads.has('cerebellum'), cCut = hit.get('cerebellum');
  const cc = cCut ? colors.abn : cOn ? colors.accent : colors.muted;
  /* joined to the brainstem by its peduncles: a short link clear of the rung's labels */
  out.push(`<path d="M${x0 + 175} ${cy} L${cx - 14} ${cy}" fill="none" stroke="${cc}" stroke-width="1.5" stroke-dasharray="${cOn || cCut ? '' : '3 3'}"/>`);
  out.push(`<circle cx="${cx}" cy="${cy}" r="${cOn || cCut ? 12 : 9}" fill="${cOn || cCut ? cc : 'none'}" fill-opacity="${cOn || cCut ? 0.85 : 1}" stroke="${cc}" stroke-width="1.5"/>`);
  if (cCut) out.push(`<path d="M${cx - 7} ${cy - 7} l14 14 M${cx + 7} ${cy - 7} l-14 14" stroke="#fff" stroke-width="2.4"/>`);
  out.push(`<text x="${cx}" y="${cy + 26}" font-size="12" text-anchor="middle" font-weight="${cOn || cCut ? 600 : 400}" fill="${cOn || cCut ? colors.fg : colors.muted}">${lang === 'de' ? 'Kleinhirn' : 'Cerebellum'}</text>`);
  const cSub = cCut ? cCut.map((n) => pretty(n, lang)).join(', ') : cOn ? (PATH(test).cerebellum ? tr(PATH(test).cerebellum!, lang) : '') : '';
  if (cSub) out.push(`<text x="${cx}" y="${cy + 39}" font-size="10" text-anchor="middle" fill="${cCut ? colors.abn : colors.muted}">${esc(cSub)}</text>`);
  const h = yy + top;
  return `<svg viewBox="0 0 360 ${h}" width="100%" role="img" style="max-width:520px">${out.join('')}</svg>`;
}
