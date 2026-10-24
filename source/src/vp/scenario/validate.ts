import { missingLocales, SUPPORTED_LOCALES, type LocalizedList, type LocalizedText } from '../model/i18n.ts';
import type { CaseDef } from '../model/types.ts';
import type { Catalog } from '../data/catalog.ts';
import type { Issue } from '../engine/validate.ts';
import { healthyModel } from '../physiology/state.ts';
import { DRUG_IDS } from '../physiology/drugs/drugs.ts';
import { ARREST_CAUSES, NUDGE_IDS, type InterventionDef, type ScenarioDef, type SceneWhen } from './types.ts';

/* Checks for the intervention registry and for scenarios (ADR-018). Every learner-facing text in English and German. */

const text = (x: LocalizedText | LocalizedList | undefined, path: string, out: Issue[]) => {
  const miss = missingLocales(x, SUPPORTED_LOCALES);
  if (miss.length) out.push({ level: 'error', path, message: `missing ${miss.join(', ')}` });
};

/** Interventions write only what the running models take as inputs: circulation, lungs and the heart's electrical
    model. The body's parameters act over hours and would re-run the illness's course. */
const WRITABLE = ['circulation', 'respiratory', 'electrical'];

function checkPath(path: string, v: unknown, where: string, out: Issue[]) {
  const [sec, key, ...rest] = path.split('.');
  const base = (healthyModel() as any)[sec];
  if (!WRITABLE.includes(sec) || rest.length || !key) { out.push({ level: 'error', path: where, message: `${path} is not a model input an intervention may write (${WRITABLE.join(', ')})` }); return; }
  if (!(key in base)) { out.push({ level: 'error', path: where, message: `${path}: no such parameter` }); return; }
  if (v !== undefined && typeof v !== typeof base[key]) out.push({ level: 'error', path: where, message: `${path}: ${typeof v} given, the model holds a ${typeof base[key]}` });
}

export function validateInterventions(list: InterventionDef[], cat: Catalog): Issue[] {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const x of list) {
    const p = `intervention:${x.id}`;
    if (seen.has(x.id)) out.push({ level: 'error', path: p, message: 'duplicate id' });
    seen.add(x.id);
    text(x.label, `${p}.label`, out);
    if (x.phrases) text(x.phrases, `${p}.phrases`, out);
    const d = x.duration;
    if ('seconds' in d ? !(d.seconds >= 0) : !(d.min >= 0 && d.max >= d.min)) out.push({ level: 'error', path: `${p}.duration`, message: 'not a valid time' });
    if (!x.timing.note.trim()) out.push({ level: 'error', path: `${p}.timing`, message: 'says nothing about where its time comes from' });
    const e = x.effect;
    if (e.kind === 'continuous') {
      for (const [path, v] of Object.entries(e.inputs)) checkPath(path, v, `${p}.effect.inputs`, out);
      if (!Object.keys(e.inputs).length && !e.driver && !e.state) out.push({ level: 'warning', path: `${p}.effect`, message: 'holds nothing' });
    }
    else {
      for (const w of e.change ?? []) {
        if ((w.set === undefined) === (w.add === undefined)) out.push({ level: 'error', path: `${p}.effect.change`, message: `${w.path}: give set or add, not both or neither` });
        checkPath(w.path, w.set ?? w.add, `${p}.effect.change`, out);
      }
      if (e.dose && !(DRUG_IDS.includes(e.dose.drug) && e.dose.mg > 0)) out.push({ level: 'error', path: `${p}.effect.dose`, message: `${e.dose.drug} ${e.dose.mg} mg: not a drug the model has, or not a dose` });
      if (!e.change?.length && !e.grants?.length && !e.state && !e.airway && !e.defib && !e.dose && !e.assess && !e.fetch && !e.clearAirway) out.push({ level: 'warning', path: `${p}.effect`, message: 'does nothing' });
    }
    /* Sharing an id with a manoeuvre means the same act: it must leave the patient in the same state. */
    const m = cat.manoeuvres[x.id];
    if (m && JSON.stringify(m.sets ?? {}) !== JSON.stringify(e.state ?? {})) out.push({ level: 'error', path: p, message: `shares its id with a manoeuvre that sets ${JSON.stringify(m.sets ?? {})}, not ${JSON.stringify(e.state ?? {})}` });
  }
  return out;
}

export function validateScenario(s: ScenarioDef, ctx: { cases: CaseDef[]; interventions: Record<string, InterventionDef>; catalog: Catalog }): Issue[] {
  const out: Issue[] = [];
  const p = `scenario:${s.id}`;
  if (s.schema !== 'vp.scenario/1') out.push({ level: 'error', path: p, message: `unknown schema ${s.schema}` });
  if (!ctx.cases.some((c) => c.id === s.caseId)) out.push({ level: 'error', path: `${p}.caseId`, message: `unknown case ${s.caseId}` });
  if (!s.purpose?.trim()) out.push({ level: 'warning', path: `${p}.purpose`, message: 'says nothing about what it is for' });
  text(s.title, `${p}.title`, out);
  text(s.scene.place, `${p}.scene.place`, out);
  const people = new Set(s.scene.people.map((x) => x.id)), kit = new Set(s.scene.equipment.map((x) => x.id));
  if (people.has('learner')) out.push({ level: 'error', path: `${p}.scene.people`, message: 'the learner is always there and is not listed' });
  for (const x of s.scene.people) text(x.role, `${p}.scene.people.${x.id}`, out);
  for (const x of s.scene.equipment) text(x.label, `${p}.scene.equipment.${x.id}`, out);
  const team = s.scene.team;
  if (team) {
    for (const x of team.people) if (!people.has(x)) out.push({ level: 'error', path: `${p}.scene.team`, message: `no one called ${x}` });
    for (const x of team.equipment) if (!kit.has(x)) out.push({ level: 'error', path: `${p}.scene.team`, message: `no equipment ${x}` });
    if (!(team.afterSeconds >= 0 && team.lateWithoutWhere >= 0 && team.callSeconds >= 0)) out.push({ level: 'error', path: `${p}.scene.team`, message: 'times must be 0 or more' });
  }
  for (const n of s.nudges ?? []) {
    if (!(NUDGE_IDS as readonly string[]).includes(n.id)) out.push({ level: 'error', path: `${p}.nudges.${n.id}`, message: 'not a nudge the run knows' });
    if (n.id === 'bolus' && !s.scene.airway) out.push({ level: 'error', path: `${p}.nudges.bolus`, message: 'a bolus nudge needs scene.airway' });
    text(n.label, `${p}.nudges.${n.id}.label`, out); text(n.explain, `${p}.nudges.${n.id}.explain`, out);
  }
  if (s.scene.cause !== undefined && !(ARREST_CAUSES as readonly string[]).includes(s.scene.cause)) out.push({ level: 'error', path: `${p}.scene.cause`, message: `${s.scene.cause} is not a cause the rules know` });
  if (s.scene.causeSide !== undefined && s.scene.causeSide !== 'left' && s.scene.causeSide !== 'right') out.push({ level: 'error', path: `${p}.scene.causeSide`, message: 'left or right' });
  if (s.reveal) { text(s.reveal.label, `${p}.reveal.label`, out); text(s.reveal.explain, `${p}.reveal.explain`, out); }
  const ob = s.scene.airway;
  if (ob && (ob.obstruction !== 'bolus' || !(ob.chance >= 0 && ob.chance <= 1))) out.push({ level: 'error', path: `${p}.scene.airway`, message: 'an obstruction is a bolus with a chance from 0 to 1' });
  const slots = new Set(Object.values(ctx.interventions).flatMap((x) => (x.effect.kind === 'continuous' ? [x.effect.slot] : [])));

  const when = (w: SceneWhen, path: string) => {
    if ('did' in w) { if (!ctx.interventions[w.did] && !ctx.catalog.manoeuvres[w.did] && !ctx.catalog.investigations[w.did]) out.push({ level: 'error', path, message: `unknown action ${w.did}` }); }
    else if ('holding' in w) { if (!slots.has(w.holding)) out.push({ level: 'error', path, message: `no intervention holds ${w.holding}` }); }
    else if ('value' in w) { if (!/^(circulation|resp|body)\.\w+$/.test(w.value.of)) out.push({ level: 'error', path, message: `${w.value.of}: read circulation.<metric>, resp.<key> or body.<key>` }); }
    else if ('all' in w) w.all.forEach((x, i) => when(x, `${path}.all[${i}]`));
    else if ('any' in w) w.any.forEach((x, i) => when(x, `${path}.any[${i}]`));
  };

  const states = s.machine.states;
  if (!states[s.machine.start]) out.push({ level: 'error', path: `${p}.machine.start`, message: `no state ${s.machine.start}` });
  if (!Object.values(states).some((x) => x.final)) out.push({ level: 'error', path: `${p}.machine`, message: 'no final state' });
  const reached = new Set<string>();
  const walk = (n: string) => { if (reached.has(n) || !states[n]) return; reached.add(n); for (const x of states[n].next ?? []) walk(x.to); };
  walk(s.machine.start);
  for (const [name, st] of Object.entries(states)) {
    const sp = `${p}.machine.${name}`;
    if (!reached.has(name)) out.push({ level: 'warning', path: sp, message: 'never reached' });
    text(st.label, `${sp}.label`, out);
    for (const d of st.enter ?? []) {
      if ('leave' in d) {
        for (const x of d.leave.people) if (!people.has(x)) out.push({ level: 'error', path: `${sp}.leave`, message: `no one called ${x}` });
      } else if ('change' in d) {
        for (const w of d.change) {
          if ((w.set === undefined) === (w.add === undefined)) out.push({ level: 'error', path: `${sp}.change`, message: `${w.path}: give set or add, not both or neither` });
          checkPath(w.path, w.set ?? w.add, `${sp}.change`, out);
        }
      } else if ('say' in d) {
        text(d.say.text, `${sp}.say`, out);
        if (d.say.who !== 'patient' && !people.has(d.say.who)) out.push({ level: 'error', path: `${sp}.say`, message: `no one called ${d.say.who}` });
      } else {
        for (const x of d.arrive.people ?? []) if (!people.has(x)) out.push({ level: 'error', path: `${sp}.arrive`, message: `no one called ${x}` });
        for (const x of d.arrive.equipment ?? []) if (!kit.has(x)) out.push({ level: 'error', path: `${sp}.arrive`, message: `no equipment ${x}` });
        if (!(d.arrive.afterSeconds >= 0)) out.push({ level: 'error', path: `${sp}.arrive`, message: 'arrives at no valid time' });
      }
    }
    for (const [i, x] of (st.next ?? []).entries()) {
      if (!states[x.to]) out.push({ level: 'error', path: `${sp}.next[${i}]`, message: `no state ${x.to}` });
      when(x.when, `${sp}.next[${i}]`);
    }
    if (st.final && st.next?.length) out.push({ level: 'warning', path: sp, message: 'final, but has transitions' });
  }
  return out;
}
