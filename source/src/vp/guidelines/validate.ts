import { missingLocales, SUPPORTED_LOCALES, type LocalizedText } from '../model/i18n.ts';
import type { Issue } from '../engine/validate.ts';
import { DRUG_IDS } from '../physiology/drugs/drugs.ts';
import type { GuidelineDef } from './types.ts';

/* Checks for a guideline file (ADR-018 decision 3): every rule says where it comes from, every text is in English and German,
   and every number that is ours (a placement) says what it rests on. */

const KINDS = ['first-compression', 'measure', 'cycle', 'peri-shock', 'rhythm-checks', 'dose-after-shock', 'dose-interval', 'no-hazard', 'breath'];

export function validateGuideline(g: GuidelineDef): Issue[] {
  const out: Issue[] = [];
  const p = `guideline:${g.id}`;
  const text = (x: LocalizedText | undefined, path: string) => { const miss = missingLocales(x, SUPPORTED_LOCALES); if (miss.length) out.push({ level: 'error', path, message: `missing ${miss.join(', ')}` }); };
  if (g.schema !== 'vp.guideline/1') out.push({ level: 'error', path: p, message: `unknown schema ${g.schema}` });
  text(g.title, `${p}.title`);
  if (!g.source?.citation?.trim() || !g.source.note?.trim()) out.push({ level: 'error', path: `${p}.source`, message: 'says nothing about where it comes from' });
  for (const [k, d] of Object.entries(g.definitions ?? {})) {
    if (!(typeof d.value === 'number' && Number.isFinite(d.value))) out.push({ level: 'error', path: `${p}.definitions.${k}`, message: 'not a number' });
    if (d.basis === 'placement' && !d.note?.trim()) out.push({ level: 'error', path: `${p}.definitions.${k}`, message: 'a placement without a note' });
  }
  const seen = new Set<string>();
  for (const r of g.rules) {
    const rp = `${p}.rules.${r.id}`;
    if (seen.has(r.id)) out.push({ level: 'error', path: rp, message: 'duplicate id' });
    seen.add(r.id);
    text(r.title, `${rp}.title`); text(r.why, `${rp}.why`);
    if (!r.section?.trim()) out.push({ level: 'error', path: rp, message: 'cites no section' });
    if (r.basis !== 'guideline' && r.basis !== 'placement') out.push({ level: 'error', path: rp, message: `unknown basis ${r.basis}` });
    if (r.basis === 'placement' && !r.note?.trim()) out.push({ level: 'error', path: rp, message: 'a placement without a note' });
    if (!KINDS.includes(r.check?.kind)) { out.push({ level: 'error', path: rp, message: `unknown check ${r.check?.kind}` }); continue; }
    const c = r.check as any;
    if ((c.kind === 'dose-after-shock' || c.kind === 'dose-interval') && !DRUG_IDS.includes(c.drug)) out.push({ level: 'error', path: rp, message: `no drug ${c.drug}` });
    for (const [k, v] of Object.entries(c)) if (k !== 'kind' && k !== 'drug' && k !== 'measure' && k !== 'codes' && !(typeof v === 'number' && Number.isFinite(v))) out.push({ level: 'error', path: rp, message: `${k} is not a number` });
    if ((c.min != null && c.max != null && c.min > c.max) || (c.kind === 'dose-interval' && c.min > c.max)) out.push({ level: 'error', path: rp, message: 'min above max' });
  }
  return out;
}
