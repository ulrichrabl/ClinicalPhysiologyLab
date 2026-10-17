import type { ExamContext, Finding } from '../model/types.ts';
import { tr, type Locale } from '../model/i18n.ts';
import { parseRef } from './observe.ts';
import type { Session } from './encounter.ts';

/* ---------------------------------------------------------------------------
   Automatic notes.

   Written from the encounter's events, in the learner's language, the way a
   clinician documents: by system and section, in the order of the examination
   (data/exam-structure.ts, the same headings as the menu), one line per
   finding, the latest observation of each property in each context. A
   finding is filed under the test that produced it, so nothing is lost to a
   property that no heading names. Learners can read these
   first and later write their own and compare; the comparison works on
   the structured findings, not on the wording.
--------------------------------------------------------------------------- */

const ctxKey = (c: ExamContext) => JSON.stringify(Object.entries(c).filter(([k]) => k !== 'position' && k !== 'instrument').sort());

export function autoNote(s: Session, locale: Locale = s.encounter.locale): string {
  const latest = new Map<string, { finding: Finding; by: string }>();
  for (const e of s.encounter.events) if (e.kind === 'finding') latest.set(`${e.finding.property}|${ctxKey(e.finding.context)}`, { finding: e.finding, by: e.byManoeuvre });
  const propOrder = Object.keys(s.catalog.properties);
  /* Where each test sits: its system and section, in examination order. */
  const place = new Map<string, { heading: string; rank: number }>();
  let rank = 0;
  for (const sys of s.catalog.examSystems) for (const sec of sys.sections) {
    const several = sys.sections.length > 1 && tr(sec.label, locale) !== tr(sys.label, locale);
    const heading = several ? `${tr(sys.label, locale)} · ${tr(sec.label, locale)}` : tr(sys.label, locale);
    for (const id of sec.manoeuvres) place.set(id, { heading, rank: rank++ });
  }
  const other = { heading: locale === 'de' ? 'Weitere Befunde' : 'Other findings', rank: Number.MAX_SAFE_INTEGER };
  const items = [...latest.values()].map((x) => ({ ...x, at: place.get(x.by) ?? other }))
    .sort((a, b) => a.at.rank - b.at.rank || propOrder.indexOf(parseRef(a.finding.property).property) - propOrder.indexOf(parseRef(b.finding.property).property));

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
  let heading = '';
  for (const { finding: f, at } of items) {
    if (at.heading !== heading) { heading = at.heading; lines.push(`## ${heading}`); }
    const def = s.catalog.properties[parseRef(f.property).property];
    lines.push(`- ${s.registry.formatters[def.formatter](f.value, f.context, locale, s.catalog, parseRef(f.property))}`);
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
