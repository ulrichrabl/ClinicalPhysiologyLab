import type { ScenarioEvent, ScenarioInput } from '../scenario/types.ts';
import type { TraceRow } from '../scenario/run.ts';
import type { Check, GuidelineDef, GuidelineReport, Pause, RuleResult } from './types.ts';

/* ===========================================================================
   Scoring a run against a guideline (ADR-018 decision 3, step 5).

   Everything is read from what the run recorded, so a replay scores the
   same: the inputs, the events, every compression's onset and a
   once-a-second trace of the patient. Nothing here reaches into the model.

   CPR is needed while the heart has no rhythm that makes a pulse: VF, VT
   or asystole, or an organised rhythm whose systolic pressure is below the
   guideline file's pulse definition (pulseless electrical activity). A
   pause is a gap between compression onsets longer than the file's pause
   definition, inside a time CPR was needed.
=========================================================================== */

export interface RunRecord {
  log: ScenarioInput[];
  events: ScenarioEvent[];
  compressions: Array<{ at: number; by: string }>;
  trace: TraceRow[];
  /** The run's clock at the end (s). */
  t: number;
  /** What was in the room from the start; when absent, everything is taken to have been. */
  startEquipment?: string[];
  /** The scene's reversible cause, when it has one (ScenarioDef.scene.cause). */
  cause?: string;
  /** Its side, for a one-sided cause. */
  causeSide?: string;
}

type Span = [number, number];

const merge = (xs: Span[]): Span[] => {
  const s = [...xs].sort((a, b) => a[0] - b[0]), out: Span[] = [];
  for (const x of s) { const last = out.at(-1); if (last && x[0] <= last[1] + 1e-9) last[1] = Math.max(last[1], x[1]); else out.push([x[0], x[1]]); }
  return out;
};
const intersect = (a: Span[], b: Span[]): Span[] => {
  const out: Span[] = [];
  for (const x of a) for (const y of b) { const lo = Math.max(x[0], y[0]), hi = Math.min(x[1], y[1]); if (hi > lo + 1e-9) out.push([lo, hi]); }
  return merge(out);
};
const subtract = (a: Span[], b: Span[]): Span[] => {
  let out = a.map((x) => [x[0], x[1]] as Span);
  for (const y of merge(b)) {
    const next: Span[] = [];
    for (const x of out) {
      if (y[1] <= x[0] || y[0] >= x[1]) { next.push(x); continue; }
      if (y[0] > x[0]) next.push([x[0], y[0]]);
      if (y[1] < x[1]) next.push([y[1], x[1]]);
    }
    out = next;
  }
  return out.filter((x) => x[1] > x[0] + 1e-9);
};
const total = (xs: Span[]) => xs.reduce((a, x) => a + x[1] - x[0], 0);
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = (x: number) => Math.round(x * 10) / 10;

export function scoreRun(g: GuidelineDef, run: RunRecord): GuidelineReport {
  const gap = g.definitions.pauseGap.value, pulse = g.definitions.pulseSystolic.value;
  const end = run.t;

  /* When CPR was needed, from the trace (each row stands for the second before it). */
  const needs = (r: TraceRow) => r.rhythm === 'vf' || r.rhythm === 'vt' || r.rhythm === 'asystole' || (r.rhythm === 'organised' && !(r.Psys >= pulse));
  const needCpr = merge(run.trace.filter(needs).map((r) => [Math.max(0, r.t - 1), r.t] as Span));
  const onset = needCpr.length ? needCpr[0][0] : null;

  const on = run.compressions.map((c) => c.at).sort((a, b) => a - b);
  /* Compressing: between onsets no further apart than the pause definition. */
  const covered: Span[] = [];
  let pairs = 0, pairTime = 0;
  for (let i = 1; i < on.length; i++) { const d = on[i] - on[i - 1]; if (d <= gap) { covered.push([on[i - 1], on[i]]); pairs++; pairTime += d; } }
  const coveredM = merge(covered);
  const uncovered = subtract(needCpr, coveredM);
  const shocks = run.events.filter((e): e is Extract<ScenarioEvent, { kind: 'shock' }> => e.kind === 'shock');
  const checks = run.events.filter((e) => e.kind === 'assessed').map((e) => e.t);
  const breathT = [
    ...run.events.filter((e) => e.kind === 'breath').map((e) => e.t),
    ...run.log.filter((x): x is Extract<ScenarioInput, { do: 'ventilate' }> => x.do === 'ventilate').map((x) => x.at),
  ];
  const within = (ts: number[], s: Span) => ts.some((t) => t >= s[0] - 0.5 && t <= s[1] + 0.5);
  const pauses: Pause[] = uncovered.filter((s) => s[1] - s[0] > gap).map((s) => {
    const during: Pause['during'] = [];
    if (within(breathT, s)) during.push('breaths');
    if (within(shocks.map((e) => e.t), s)) during.push('shock');
    if (within(checks, s)) during.push('rhythm-check');
    if (!during.length) during.push('none');
    return { from: r1(s[0]), to: r1(s[1]), seconds: r1(s[1] - s[0]), during };
  });

  const firstCompression = onset == null ? null : (() => { const f = on.find((t) => t >= onset); return f == null ? null : r1(f - onset); })();
  const needTime = total(needCpr);
  const fraction = needTime > 0 ? Math.round(100 * total(intersect(needCpr, coveredM)) / needTime) : null;
  const rate = pairs ? Math.round(60 * pairs / pairTime) : null;
  /* The longest pause after compressions began (the wait for the first is scored on its own). */
  const after = pauses.filter((p) => on.length && p.from >= on[0] - 1e-9);
  const longestPause = after.length ? Math.max(...after.map((p) => p.seconds)) : null;

  /* Cycles of compressions, each ended by a pause in which breaths were given. */
  const cycles: number[] = [];
  let n = on.length ? 1 : 0;
  for (let i = 1; i <= on.length; i++) {
    const d = i < on.length ? on[i] - on[i - 1] : Infinity;
    if (d <= gap) { n++; continue; }
    const p: Span = [on[i - 1], i < on.length ? on[i] : end];
    if (n && breathT.some((t) => t >= p[0] && t <= p[1])) cycles.push(n);
    n = 1;
  }

  const shockRows = shocks.filter((e) => e.joules > 0).map((e) => {
    const b = [...on].reverse().find((t) => t <= e.t + 1e-9), a = on.find((t) => t > e.t + 1e-9);
    return { t: e.t, before: b == null ? null : r1(e.t - b), after: a == null ? null : r1(a - e.t), outcome: e.outcome };
  });
  const breaths = run.events.filter((e): e is Extract<ScenarioEvent, { kind: 'breath' }> => e.kind === 'breath' && e.by === 'learner').map((e) => e.seconds);
  const firstShock = onset == null || !shockRows.length ? null : r1(shockRows[0].t - onset);

  const measures = { firstCompression, firstShock, fraction, rate, longestPause, cycles, shocks: shockRows, breaths };
  const ctx: Ctx = { run, g, onset, end, needCpr, measures, checks, shocks, longest: after.reduce<Pause | null>((a, p) => (!a || p.seconds > a.seconds ? p : a), null) };
  const rules = g.rules.map((rule) => ({ id: rule.id, ...judge(rule.check, ctx) }));
  return { guideline: `${g.id}@${g.version}`, onset, end, needCpr, measures, pauses, rules };
}

interface Ctx {
  run: RunRecord; g: GuidelineDef; onset: number | null; end: number; needCpr: Span[];
  measures: GuidelineReport['measures'];
  checks: number[];
  shocks: Array<Extract<ScenarioEvent, { kind: 'shock' }>>;
  longest: Pause | null;
}
type Judged = Omit<RuleResult, 'id'>;
const NA: Judged = { status: 'not-applicable', at: [] };
const needAt = (c: Ctx, t: number) => c.needCpr.some(([a, b]) => t >= a - 1e-9 && t <= b + 1e-9);
/** The rhythm the trace shows at t (each row stands for the second before it). */
const rhythmAt = (c: Ctx, t: number) => c.run.trace.find((r) => r.t >= t - 1e-9)?.rhythm ?? c.run.trace.at(-1)?.rhythm;
const shockableAt = (c: Ctx, t: number) => { const r = rhythmAt(c, t); return r === 'vf' || r === 'vt'; };
/** When the arrival of a piece of kit made something possible: at once if it was in the room from the start. */
const arrivedAt = (c: Ctx, kit: string) => !c.run.startEquipment || c.run.startEquipment.includes(kit) ? 0
  : c.run.events.find((e) => e.kind === 'arrive' && e.equipment.includes(kit))?.t;
const doneAt = (c: Ctx, id: string) => c.run.events.find((e) => e.kind === 'done' && e.id === id)?.t;

function judge(k: Check, c: Ctx): Judged {
  const m = c.measures;
  switch (k.kind) {
    case 'first-compression': {
      if (c.onset == null) return NA;
      if (m.firstCompression == null) return { status: 'missed', at: [r1(c.onset + k.within)] };
      return { status: m.firstCompression <= k.within ? 'met' : 'missed', value: m.firstCompression, at: m.firstCompression <= k.within ? [] : [r1(c.onset + k.within)] };
    }
    case 'measure': {
      const v = m[k.measure];
      if (v == null) return NA;
      const ok = (k.min == null || v >= k.min) && (k.max == null || v <= k.max);
      const at = ok || k.measure !== 'longestPause' || !c.longest ? [] : [c.longest.from];
      return { status: ok ? 'met' : 'missed', value: v, at };
    }
    case 'cycle': {
      const v = median(m.cycles);
      if (v == null) return NA;
      return { status: v >= k.min && v <= k.max ? 'met' : 'missed', value: v, at: [] };
    }
    case 'peri-shock': {
      const rows = m.shocks.filter((s) => s.before != null || s.after != null);
      if (!rows.length) return NA;
      const whole = (s: (typeof rows)[number]) => (s.before ?? 0) + (s.after ?? 0);
      const bad = rows.filter((s) => whole(s) > k.max);
      const worst = r1(Math.max(...rows.map(whole)));
      return { status: bad.length ? 'missed' : 'met', value: worst, at: bad.map((s) => s.t) };
    }
    case 'rhythm-checks': {
      const pads = c.run.events.find((e) => e.kind === 'done' && e.id === 'defib.pads')?.t;
      if (pads == null || !needAt(c, pads)) return NA;
      const looks = [...c.checks, ...c.shocks.map((e) => e.t)].filter((t) => t >= pads - 1e-9 && needAt(c, t)).sort((a, b) => a - b);
      const at: number[] = [];
      if (!looks.length || looks[0] - pads > k.firstWithin) at.push(r1(pads + k.firstWithin));
      for (let i = 1; i < looks.length; i++) {
        const d = looks[i] - looks[i - 1];
        if (d > k.every + k.tolerance) at.push(r1(looks[i - 1] + k.every + k.tolerance));
        else if (d < k.every - k.tolerance) at.push(r1(looks[i]));
      }
      const last = looks.at(-1) ?? pads, due = last + k.every + k.tolerance;
      if (due < c.end && needAt(c, due)) at.push(r1(due));
      return { status: at.length ? 'missed' : 'met', value: looks.length, at };
    }
    case 'dose-after-shock': {
      const shockable = c.shocks.filter((e) => e.joules > 0 && (e.rhythm === 'vf' || e.rhythm === 'vt'));
      const doses = c.run.events.filter((e): e is Extract<ScenarioEvent, { kind: 'dose' }> => e.kind === 'dose' && e.drug === k.drug && e.mg === k.mg);
      const nth = shockable[k.afterShock - 1];
      /* early: given before the nth shock while the rhythm was shockable (in a non-shockable rhythm a dose is due at once) */
      const early = doses.filter((d) => (!nth || d.t < nth.t) && needAt(c, d.t) && shockableAt(c, d.t));
      if (!nth) return early.length ? { status: 'missed', at: early.map((d) => d.t) } : NA;
      const next = shockable[k.afterShock]?.t ?? c.end;
      const inWindow = doses.some((d) => d.t > nth.t && d.t <= next);
      const at = [...early.map((d) => d.t), ...(inWindow ? [] : [r1(next)])];
      return { status: at.length ? 'missed' : 'met', at };
    }
    case 'dose-non-shockable': {
      /* the arrest's first rhythm, as the first look at it found it while CPR was needed */
      const look = c.run.events.find((e): e is Extract<ScenarioEvent, { kind: 'assessed' }> => e.kind === 'assessed' && e.what === 'rhythm' && needAt(c, e.t));
      if (!look || look.rhythm === 'vf' || look.rhythm === 'vt') return NA;
      const kit = arrivedAt(c, 'drugs'), line = doneAt(c, 'access.iv');
      const dose = c.run.events.find((e) => e.kind === 'dose' && e.drug === k.drug && e.mg === k.mg && e.t >= look.t - 1e-9);
      if (kit == null || line == null) return dose ? { status: 'met', at: [] } : NA;
      const from = Math.max(look.t, kit, line);
      if (from >= c.end) return NA;
      const ok = dose != null && dose.t - from <= k.within;
      return { status: ok ? 'met' : 'missed', value: dose ? r1(Math.max(0, dose.t - from)) : undefined, at: ok ? [] : [r1(from + k.within)] };
    }
    case 'dose-for-cause': {
      if (c.run.cause !== k.cause || c.onset == null) return NA;
      const kit = arrivedAt(c, k.kit), line = doneAt(c, 'access.iv');
      const dose = c.run.events.find((e) => e.kind === 'dose' && e.drug === k.drug);
      if (kit == null || line == null) return dose ? { status: 'met', at: [] } : NA;
      const from = Math.max(c.onset, kit, line);
      if (from >= c.end) return NA;
      const ok = dose != null && dose.t - from <= k.within;
      return { status: ok ? 'met' : 'missed', value: dose ? r1(Math.max(0, dose.t - from)) : undefined, at: ok ? [] : [r1(from + k.within)] };
    }
    case 'done-for-cause': {
      /* from the collapse, or (fromStart) from the scene's start: a cause treated before it arrests the heart */
      if (c.run.cause !== k.cause || (c.onset == null && !k.fromStart)) return NA;
      const start = k.fromStart ? 0 : c.onset!;
      const id = k.id.replace('{side}', c.run.causeSide ?? '');
      const kit = arrivedAt(c, k.kit);
      /* when it was begun: a bolus takes minutes to run, a decompression seconds */
      const done = c.run.events.find((e) => (e.kind === 'begin' || e.kind === 'done') && e.id === id)?.t;
      if (kit == null) return done != null ? { status: 'met', at: [] } : NA;
      const from = Math.max(start, kit);
      if (from >= c.end) return NA;
      const ok = done != null && done - from <= k.within;
      return { status: ok ? 'met' : 'missed', value: done != null ? r1(Math.max(0, done - from)) : undefined, at: ok ? [] : [r1(from + k.within)] };
    }
    case 'dose-interval': {
      const doses = c.run.events.filter((e) => e.kind === 'dose' && e.drug === k.drug).map((e) => e.t);
      if (!doses.length) return NA;
      const at: number[] = [];
      for (let i = 1; i < doses.length; i++) {
        const d = doses[i] - doses[i - 1];
        if (d < k.min) at.push(doses[i]); else if (d > k.max) at.push(r1(doses[i - 1] + k.max));
      }
      const due = doses.at(-1)! + k.max;
      if (due < c.end && needAt(c, due)) at.push(r1(due));
      return { status: at.length ? 'missed' : 'met', value: doses.length, at };
    }
    case 'no-hazard': {
      const hz = c.run.events.filter((e) => e.kind === 'hazard' && k.codes.includes(e.code));
      return { status: hz.length ? 'missed' : 'met', value: hz.length, at: hz.map((e) => e.t) };
    }
    case 'call': {
      if (c.onset == null) return NA;
      const call = c.run.events.find((e): e is Extract<ScenarioEvent, { kind: 'call' }> => e.kind === 'call');
      if (!call) return { status: 'missed', at: [r1(c.onset + k.within)] };
      const late = call.t - c.onset > k.within, short = k.must.filter((x) => !(call.says as string[]).includes(x));
      return { status: late || short.length ? 'missed' : 'met', value: r1(Math.max(0, call.t - c.onset)), at: late || short.length ? [call.t] : [] };
    }
    case 'roles': {
      if (c.onset == null) return NA;
      const ev = c.run.events;
      const arrived = (kit: string) => ev.find((e) => e.kind === 'arrive' && e.equipment.includes(kit))?.t;
      /* when each task became possible, and when someone first held it (given, or simply done) */
      const first = (role: string, ids: string[]) => ev.find((e) => (e.kind === 'assigned' && e.role === role && e.to) || (e.kind === 'done' && ids.includes(e.id)))?.t;
      const tasks: Array<[number | undefined, number | undefined]> = [
        [c.onset, first('compressions', ['cpr.compressions'])],
        [c.onset, first('airway', ['vent.bag'])],
        [arrived('defibrillator'), first('defibrillator', ['defib.pads'])],
        [arrived('drugs'), first('drugs', ['access.iv'])],
      ];
      const at: number[] = [];
      let n = 0;
      for (const [from, held] of tasks) {
        if (from == null || !needAt(c, from)) continue;
        n++;
        if (held == null || held - Math.max(from, c.onset) > k.within) at.push(r1(Math.max(from, c.onset) + k.within));
      }
      if (!n) return NA;
      return { status: at.length ? 'missed' : 'met', value: n - at.length, at };
    }
    case 'rotation': {
      const comps = [...c.run.compressions].sort((a, b) => a.at - b.at);
      /* from when a second person had done something: someone could have taken over */
      const actors = new Map<string, number>();
      for (const e of c.run.events) { const who = (e as any).by ?? (e.kind === 'assigned' ? e.to : null); if (who && !actors.has(who)) actors.set(who, e.t); }
      for (const x of comps) if (!actors.has(x.by)) actors.set(x.by, x.at);
      const times = [...actors.values()].sort((a, b) => a - b);
      if (times.length < 2 || !comps.length) return NA;
      const from = times[1], limit = k.every + k.tolerance, at: number[] = [];
      let i = 0;
      while (i < comps.length) {
        let j = i; while (j + 1 < comps.length && comps[j + 1].by === comps[i].by) j++;
        const start = Math.max(comps[i].at, from), stop = j + 1 < comps.length ? comps[j + 1].at : comps[j].at;
        for (let due = start + limit; due < stop; due += limit) if (needAt(c, due)) at.push(r1(due));
        i = j + 1;
      }
      return { status: at.length ? 'missed' : 'met', at };
    }
    case 'breathing-checked': {
      if (c.onset == null) return NA;
      const first = c.measures.firstCompression == null ? c.end : c.onset + c.measures.firstCompression;
      const look = c.run.events.find((e) => e.kind === 'assessed' && e.what === 'breathing' && e.t >= c.onset! - 1e-9 && e.t <= first + 1e-9);
      return look ? { status: 'met', value: r1(look.t - c.onset), at: [] } : { status: 'missed', at: [r1(first)] };
    }
    case 'obstruction-cleared': {
      const ev = c.run.events;
      const blocked = ev.find((e) => e.kind === 'obstruction' && e.what);
      if (!blocked || c.onset == null) return NA;
      const cleared = ev.find((e) => e.kind === 'obstruction' && !e.what && e.t >= blocked.t);
      /* the clock starts with the first breath that went nowhere, or when the airway kit came if that was later */
      const tried = ev.find((e) => e.kind === 'breath' && e.rise === false && e.t >= c.onset!);
      if (!tried) return NA;
      const kitAt = !c.run.startEquipment || c.run.startEquipment.includes('airway-kit') ? 0 : ev.find((e) => e.kind === 'arrive' && e.equipment.includes('airway-kit'))?.t ?? Infinity;
      const from = Math.max(tried.t, kitAt);
      /* the kit never came (or only at the end): nobody could have cleared it */
      if (from >= c.end && !cleared) return NA;
      const ok = cleared != null && cleared.t - from <= k.within;
      return { status: ok ? 'met' : 'missed', value: cleared ? r1(Math.max(0, cleared.t - from)) : undefined, at: ok ? [] : [r1(from + k.within)] };
    }
    case 'breath': {
      const v = median(c.measures.breaths);
      if (v == null) return NA;
      return { status: v >= k.min && v <= k.max ? 'met' : 'missed', value: r1(v), at: [] };
    }
  }
}
