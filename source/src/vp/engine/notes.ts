import type { ExamContext, Finding } from '../model/types.ts';
import { tr, type Locale } from '../model/i18n.ts';
import { parseRef } from './observe.ts';
import type { Session } from './encounter.ts';

/* ---------------------------------------------------------------------------
   Automatic notes.

   Written from the encounter's events, in the learner's language, the way a
   clinician documents: by system, one line per examination, the latest
   observation of each property in each context. Learners can read these
   first and later write their own and compare; the comparison works on
   the structured findings, not on the wording.
--------------------------------------------------------------------------- */

const SECTIONS: Array<{ id: string; label: { en: string; de: string }; match: (p: string) => boolean }> = [
  { id: 'general', label: { en: 'General', de: 'Allgemein' }, match: (p) => p.startsWith('general.') },
  { id: 'vitals', label: { en: 'Observations', de: 'Vitalparameter' }, match: (p) => p.startsWith('vitals.') },
  { id: 'cvs', label: { en: 'Cardiovascular', de: 'Herz-Kreislauf' }, match: (p) => /^(pulse|jvp|apex|heart|hands|legs)/.test(p) },
  { id: 'resp', label: { en: 'Respiratory', de: 'Atmung' }, match: (p) => p.startsWith('lung.') },
  { id: 'abdomen', label: { en: 'Abdomen', de: 'Abdomen' }, match: (p) => p.startsWith('abdomen.') },
  { id: 'eyes', label: { en: 'Eyes and eye movements', de: 'Augen und Okulomotorik' }, match: (p) => p.startsWith('eye') },
  { id: 'ears', label: { en: 'Hearing', de: 'Gehör' }, match: (p) => p.startsWith('ear.') || p === 'head.weber' },
  { id: 'cranial', label: { en: 'Cranial nerves and speech', de: 'Hirnnerven und Sprache' }, match: (p) => /^(face|jaw|mouth|shoulder|speech)\./.test(p) },
  { id: 'motor', label: { en: 'Motor', de: 'Motorik' }, match: (p) => /^(arm|leg)\.(tone|power|reflexes|drift)$/.test(p) },
  { id: 'sensory', label: { en: 'Sensory', de: 'Sensibilität' }, match: (p) => /\.(pinprick|vibration)$/.test(p) || p === 'saddle.sensation' },
  { id: 'balance', label: { en: 'Coordination, stance and gait', de: 'Koordination, Stand und Gang' }, match: (p) => /^(posture|gait)\./.test(p) || /^(arm|leg)\.(finger-nose|heel-shin|rapid-alternating)$/.test(p) },
];

const ctxKey = (c: ExamContext) => JSON.stringify(Object.entries(c).filter(([k]) => k !== 'position' && k !== 'instrument').sort());

export function autoNote(s: Session, locale: Locale = s.encounter.locale): string {
  const latest = new Map<string, Finding>();
  for (const e of s.encounter.events) if (e.kind === 'finding') latest.set(`${e.finding.property}|${ctxKey(e.finding.context)}`, e.finding);
  const order = Object.keys(s.catalog.properties);
  const findings = [...latest.values()].sort((a, b) => order.indexOf(parseRef(a.property).property) - order.indexOf(parseRef(b.property).property));

  const lines: string[] = [];
  // History: each fact once, in the note's language, in the order it came up.
  const facts: string[] = [];
  for (const e of s.encounter.events) if (e.kind === 'utterance' && e.from === 'patient') for (const id of e.facts ?? []) if (!facts.includes(id)) facts.push(id);
  if (facts.length) {
    lines.push(locale === 'de' ? '## Anamnese (Patientenangaben)' : '## History (in the patient\'s words)');
    const [open, close] = locale === 'de' ? ['„', '“'] : ['“', '”'];
    for (const id of facts) {
      const f = s.caseDef.history.find((x) => x.id === id);
      if (f) lines.push(`- ${open}${tr(f.say, locale)}${close}`);
    }
  }
  for (const sec of SECTIONS) {
    const fs = findings.filter((f) => sec.match(parseRef(f.property).property));
    if (!fs.length) continue;
    lines.push(`## ${tr(sec.label, locale)}`);
    for (const f of fs) {
      const def = s.catalog.properties[parseRef(f.property).property];
      const text = s.registry.formatters[def.formatter](f.value, f.context, locale, s.catalog, parseRef(f.property));
      lines.push(`- ${text}`);
    }
  }
  const results = s.encounter.events.filter((e) => e.kind === 'result' && e.t <= s.t);
  if (results.length) {
    lines.push(locale === 'de' ? '## Befunde' : '## Results');
    for (const e of results) if (e.kind === 'result') {
      const inv = s.catalog.investigations[e.test];
      lines.push(`- ${s.registry.formatters[inv.formatter](e.value, {}, locale, s.catalog, { property: inv.id })}`);
    }
  }
  return lines.join('\n');
}

/** One finding as text, in a language. */
export function describe(s: Session, f: Finding, locale: Locale = s.encounter.locale): string {
  const def = s.catalog.properties[parseRef(f.property).property];
  return s.registry.formatters[def.formatter](f.value, f.context, locale, s.catalog, parseRef(f.property));
}
