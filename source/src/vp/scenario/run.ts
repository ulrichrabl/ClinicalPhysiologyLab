import type { CaseDef, PatientState, Side } from '../model/types.ts';
import { CATALOG, type Catalog } from '../data/catalog.ts';
import { REGISTRY, type Registry } from '../registry.ts';
import { LivePatient } from '../live/live-patient.ts';
import { modelFromCase } from '../physiology/state.ts';
import { getPath, setPath } from '../physiology/models.ts';
import { startEncounter, perform, order, advanceCourse, abilities, type Session, type PerformResult } from '../engine/encounter.ts';
import { buildView } from '../engine/view.ts';
import { INTERVENTION_BY_ID } from '../data/interventions.ts';
import { Chance } from './chance.ts';
import { TEAM_ROLES, type CallContent, type TeamRole } from './types.ts';
import { Compressor } from '../physiology/cpr/compressions.ts';
import { CPR } from '../evidence/cpr.ts';
import { LUNG } from '../evidence/lung.ts';
import { ARREST } from '../evidence/arrest.ts';
import { Ventilator, type AirwayRoute } from '../physiology/lung/ventilation.ts';
import type { InterventionDef, NudgeId, ScenarioDef, ScenarioEvent, ScenarioInput, SceneWhen } from './types.ts';

/* ===========================================================================
   A scenario, running (ADR-018 step 1).

   One clock drives everything: the patient's models, the case's course, the
   scene and the encounter. The clock moves in whole ticks of 0.1 s, the
   interval at which the models are coupled, and every input lands on a
   tick. With one seed for all chance, the seed and the inputs replay a run
   exactly: the scene, the course, the encounter's events and the patient's
   every value.

   In each tick, in this order: the models advance; interventions whose time
   is up take effect; people and equipment due arrive; the case's course
   applies what is due; the scene moves on if a condition holds. Inputs come
   between ticks.

   Interventions act on the running model through the inputs it already has;
   they never write a finding.
=========================================================================== */

/** Seconds per tick: the models' coupling interval. */
export const TICK_S = 0.1;

export interface RunOptions {
  seed: number;
  caseDef: CaseDef;
  /** Seconds of settling before the clock starts, as the app does on opening a patient. */
  settleSeconds?: number;
  interventions?: Record<string, InterventionDef>;
  catalog?: Catalog;
  registry?: Registry;
  /** A teaching nudge the scenario offers (ADR-018 decision 6c): it fixes one chance draw. Part of the run, like the seed. */
  nudge?: NudgeId | null;
}

interface Actor { present: boolean; busyUntil: number; hands?: string }
interface Held { id: string; by: string; inputs: Record<string, number | string>; state: Partial<PatientState> }

export class ScenarioRun {
  readonly def: ScenarioDef;
  readonly seed: number;
  readonly chance: Chance;
  readonly live: LivePatient;
  readonly session: Session;
  /** Everything the learner did: with the seed, this is the run. */
  readonly log: ScenarioInput[] = [];
  /** Everything that followed. */
  readonly events: ScenarioEvent[] = [];
  tick = 0;
  /** The scene's current state. */
  scene = '';
  readonly actors: Record<string, Actor> = { learner: { present: true, busyUntil: 0 } };
  readonly equipment = new Set<string>();
  /** What was in the room from the start (for the debrief: what could be used from the beginning). */
  readonly startEquipment: string[] = [];
  /** The scene's reversible cause, for the rules that apply to one cause (guidelines/score.ts). */
  get cause(): string | undefined { return this.def.scene.cause; }
  get causeSide(): string | undefined { return this.def.scene.causeSide; }
  readonly access = new Set<string>();
  /** Continuous interventions held now, by slot, with what they replaced. */
  readonly held = new Map<string, Held>();
  /** Interventions completed and manoeuvres and orders performed. */
  readonly did = new Set<string>();
  /** Every chest compression's onset (s), tapped or at a team member's steady rate (ADR-018 step 5: the debrief). */
  readonly compressions: Array<{ at: number; by: string }> = [];
  /** What the patient did, once a second: rhythm, pressures, end-tidal CO₂ (for the debrief). */
  readonly trace: TraceRow[] = [];
  /** The next onset of a team member's steady compressions (scenario s), while they compress. */
  private steadyNext: number | null = null;

  private sceneSince = 0;
  private pending: Array<{ at: number; id: string; by: string }> = [];
  private arrivals: Array<{ at: number; people: string[]; equipment: string[] }> = [];
  private interventions: Record<string, InterventionDef>;

  constructor(def: ScenarioDef, opts: RunOptions) {
    if (opts.caseDef.id !== def.caseId) throw new Error(`scenario ${def.id} wraps case ${def.caseId}, not ${opts.caseDef.id}`);
    this.def = def;
    this.seed = opts.seed;
    this.interventions = opts.interventions ?? INTERVENTION_BY_ID;
    this.chance = new Chance(opts.seed);
    if (opts.nudge && !def.nudges?.some((n) => n.id === opts.nudge)) throw new Error(`scenario ${def.id} offers no nudge ${opts.nudge}`);
    this.nudge = opts.nudge ?? null;
    /* refractory VF: how many shocks fail, drawn from the nudge's own stream so it is not always the first (1 to 3) */
    if (this.nudge === 'refractory-vf') this.failShocks = 1 + Math.floor(this.chance.uniform('nudge') * 3);
    this.live = new LivePatient(modelFromCase(opts.caseDef));
    this.live.run.heart.seedChance(this.chance.seedFor('heart'));
    /* Whether this patient gasps if the brain loses its blood supply, and for how long (Clark 1992, Bobrow 2008). Drawn now,
       so it does not depend on when, or whether, the arrest comes. */
    const g = this.chance.uniform('gasp');
    const gasps = g < LUNG.gaspChanceVf || this.nudge === 'gasping';
    const gaspFor = gasps ? -Math.log(1 - this.chance.uniform('gasp-duration')) * LUNG.gaspMeanSeconds : 0;
    this.live.run.resp.gaspFor = gaspFor;
    /* Something in his airway (a teaching variant, not a physiological rate): drawn now, from its own stream. */
    const ob = def.scene.airway;
    if (ob) {
      const u = this.chance.uniform('obstruction');
      this.obstruction = u < ob.chance || this.nudge === 'bolus' ? ob.obstruction : null;
      this.pendingChance.push({ t: 0, kind: 'chance', stream: 'obstruction', value: u, use: (this.obstruction ? `a ${ob.obstruction} in his airway` : 'nothing in his airway') + (this.nudge === 'bolus' ? ' (set up)' : '') });
      if (this.obstruction) this.pendingChance.push({ t: 0, kind: 'obstruction', what: this.obstruction });
    }
    this.live.settleNow(opts.settleSeconds ?? 20);
    const caseDef = opts.caseDef;
    this.session = startEncounter(opts.catalog ?? CATALOG, opts.registry ?? REGISTRY, caseDef, buildView(caseDef, { circulation: this.live.snap, chemistry: this.live.chemistry }));
    for (const p of def.scene.people) this.actors[p.id] = { present: p.present, busyUntil: 0 };
    for (const e of def.scene.equipment) if (e.present) { this.equipment.add(e.id); this.startEquipment.push(e.id); }
    this.sync();
    if (this.nudge) this.events.push({ t: 0, kind: 'nudge', id: this.nudge });
    this.events.push({ t: 0, kind: 'chance', stream: 'gasp', value: g, use: (gaspFor > 0 ? `gasps for ${gaspFor.toFixed(0)} s if the brain loses its blood supply` : 'does not gasp') + (this.nudge === 'gasping' ? ' (set up)' : '') });
    this.events.push(...this.pendingChance);
    this.enter(def.machine.start);
  }

  /** Seconds on the scenario clock. */
  get t(): number { return this.tick / 10; }
  get ms(): number { return this.tick * 100; }
  get over(): boolean { return !!this.def.machine.states[this.scene]?.final; }

  /* ---- the clock -------------------------------------------------------------------------------------- */

  /** Run the clock to `seconds` (whole ticks). */
  advanceTo(seconds: number): void {
    const target = Math.round(seconds / TICK_S);
    if (target < this.tick) throw new Error(`the clock is at ${this.t} s and cannot go back to ${seconds} s`);
    while (this.tick < target) this.step();
  }

  private step(): void {
    this.tick++;
    this.live.advance(TICK_S);
    this.sync();
    while (this.steadyNext != null && this.steadyNext <= this.t + 1e-9) {
      const h = this.held.get('compressions');
      if (h) this.compressions.push({ at: Math.round(this.steadyNext * 1000) / 1000, by: h.by });
      this.steadyNext += 60 / CPR.rescuerRate;
    }
    if (this.tick % 10 === 0) this.record();
    if (this.refibAt != null && this.tick >= this.refibAt) {
      this.refibAt = null;
      const from = this.rhythm();
      if (from !== 'vf') { this.writeModel([['electrical.ventricular', 'vf']]); this.events.push({ t: this.t, kind: 'refibrillation', from }); }
    }
    for (const p of this.pending.filter((x) => x.at <= this.tick)) this.complete(p);
    this.pending = this.pending.filter((x) => x.at > this.tick);
    this.arrive();
    this.course();
    this.moveScene();
  }

  private sync(): void {
    const v = this.session.view;
    v.circulation = this.live.snap;
    v.chemistry = this.live.chemistry;
    v.respiratory = this.live.snap.resp;
    v.body = this.live.snap.body;
    v.minutes = this.t / 60;
    this.session.t = this.ms;
  }

  /* ---- inputs ------------------------------------------------------------------------------------------- */

  /** Apply one input at the current tick (a replay feeds the log through here). */
  input(e: ScenarioInput): void {
    if (Math.round(e.t / TICK_S) !== this.tick) throw new Error(`input at ${e.t} s given at ${this.t} s`);
    if (e.do === 'intervene') this.intervene(e.id, e.by);
    else if (e.do === 'release') this.release(e.slot, e.by);
    else if (e.do === 'examine') this.examine(e.manoeuvre, e.side, e.by);
    else if (e.do === 'compress') this.compress(e.at, e.by);
    else if (e.do === 'ventilate') this.ventilate(e.at, e.seconds, e.by);
    else if (e.do === 'bag') this.bag(e.phase, e.at, e.by);
    else if (e.do === 'call') this.call(e.says, e.by);
    else if (e.do === 'assign') this.assign(e.role, e.to);
    else this.order(e.test, e.by);
  }

  /** Inputs made inside another input (a task given starts the intervention it implies) are part of it, not inputs of their own. */
  private nested = 0;
  private note(e: ScenarioInput): void { if (!this.nested) this.log.push(e); }
  private within<T>(fn: () => T): T { this.nested++; try { return fn(); } finally { this.nested--; } }

  /** Why an actor cannot act now, if they cannot. */
  private unable(by: string): string | undefined {
    const a = this.actors[by];
    if (!a) throw new Error(`no one called ${by} in scenario ${this.def.id}`);
    if (!a.present) return 'absent';
    if (a.busyUntil > this.tick || a.hands) return 'busy';
    return undefined;
  }

  private blocked(id: string, by: string, reason: string): false {
    this.events.push({ t: this.t, kind: 'blocked', id, by, reason });
    return false;
  }

  /** Begin an intervention. It takes effect when its time is up; meanwhile whoever does it is busy. */
  intervene(id: string, by = 'learner'): boolean {
    const x = this.interventions[id];
    if (!x) throw new Error(`unknown intervention ${id}`);
    if (!this.actors[by]) throw new Error(`no one called ${by} in scenario ${this.def.id}`);
    this.note({ t: this.t, do: 'intervene', id, by });
    const why = this.unable(by);
    if (why) return this.blocked(id, by, why);
    const missingKit = (x.needs?.equipment ?? []).filter((e) => !this.equipment.has(e));
    if (missingKit.length) return this.blocked(id, by, `equipment:${missingKit.join('|')}`);
    const pos = x.needs?.position;
    if (pos && !pos.includes(this.session.state.position as never)) return this.blocked(id, by, `position:${pos.join('|')}`);
    const missingAccess = (x.needs?.access ?? []).filter((a) => !this.access.has(a));
    if (missingAccess.length) return this.blocked(id, by, `access:${missingAccess.join('|')}`);
    const can = abilities(this.session.state);
    const missingAbility = (x.needs?.ability ?? []).filter((a) => !can.includes(a));
    if (missingAbility.length) return this.blocked(id, by, `ability:${missingAbility.join('|')}`);

    let seconds: number;
    if ('seconds' in x.duration) seconds = x.duration.seconds;
    else {
      const u = this.chance.uniform(`duration:${id}`);
      seconds = x.duration.min + u * (x.duration.max - x.duration.min);
      this.events.push({ t: this.t, kind: 'chance', stream: `duration:${id}`, value: u, use: `${id} takes ${seconds.toFixed(1)} s` });
    }
    const ticks = Math.max(0, Math.round(seconds / TICK_S));
    this.actors[by].busyUntil = this.tick + ticks;
    this.events.push({ t: this.t, kind: 'begin', id, by, until: (this.tick + ticks) / 10 });
    if (ticks === 0) this.complete({ id, by });
    else this.pending.push({ at: this.tick + ticks, id, by });
    return true;
  }

  /** End a continuous intervention: what it held returns to what it was. */
  release(slot: string, by = 'learner'): boolean {
    if (!this.actors[by]) throw new Error(`no one called ${by} in scenario ${this.def.id}`);
    this.note({ t: this.t, do: 'release', slot, by });
    const h = this.held.get(slot);
    if (!h) return this.blocked(slot, by, 'not-held');
    const holder = this.actors[h.by];
    /* Letting go of what one's own hands hold is always possible; anyone else must be free to take it off. */
    if (!(by === h.by && holder?.hands === slot)) {
      const why = this.unable(by);
      if (why) return this.blocked(slot, by, why);
    }
    if (holder?.hands === slot) holder.hands = undefined;
    this.undo(h);
    this.held.delete(slot);
    this.events.push({ t: this.t, kind: 'release', slot, by, id: h.id });
    this.dropRole(slot, h.by);
    return true;
  }

  /** Perform an examination manoeuvre on the scenario's clock. Findings are read at the start; the hands are busy for its duration. */
  examine(manoeuvre: string, side?: Side, by = 'learner'): PerformResult {
    if (!this.session.catalog.manoeuvres[manoeuvre]) throw new Error(`unknown manoeuvre ${manoeuvre}`);
    this.note({ t: this.t, do: 'examine', manoeuvre, ...(side ? { side } : {}), by });
    const why = this.unable(by);
    if (why) { this.blocked(manoeuvre, by, why); return { outcome: 'blocked', reason: why, findings: [] }; }
    this.course();            // the course due now applies before the examination sees the patient
    this.session.t = this.ms;
    const r = perform(this.session, manoeuvre, side);
    this.session.t = this.ms;
    if (r.outcome === 'blocked') { this.blocked(manoeuvre, by, r.reason ?? 'blocked'); return r; }
    const ticks = Math.round(this.session.catalog.manoeuvres[manoeuvre].durationSeconds / TICK_S);
    this.actors[by].busyUntil = this.tick + ticks;
    this.did.add(manoeuvre);
    this.events.push({ t: this.t, kind: 'examined', manoeuvre, by, until: (this.tick + ticks) / 10 });
    return r;
  }

  /** Order an investigation. Ordering is a word, not a task: it takes no one's hands. */
  order(test: string, by = 'learner'): boolean {
    if (!this.session.catalog.investigations[test]) throw new Error(`unknown investigation ${test}`);
    if (!this.actors[by]) throw new Error(`no one called ${by} in scenario ${this.def.id}`);
    this.note({ t: this.t, do: 'order', test, by });
    if (!this.actors[by].present) return this.blocked(test, by, 'absent');
    this.session.t = this.ms;
    order(this.session, test);
    this.did.add(test);
    this.events.push({ t: this.t, kind: 'ordered', test, by });
    return true;
  }

  /** One tapped compression by whoever holds the compressions, beginning at `at` seconds (now or within this tick). */
  compress(at: number, by = 'learner'): boolean {
    if (!this.actors[by]) throw new Error(`no one called ${by} in scenario ${this.def.id}`);
    if (!(at >= this.t - 1e-9 && at < this.t + TICK_S + 1e-9)) throw new Error(`a compression at ${at} s given at ${this.t} s`);
    this.note({ t: this.t, do: 'compress', at, by });
    const h = this.held.get('compressions');
    if (!h || h.by !== by || !this.compressor) return this.blocked('compress', by, 'not-compressing');
    this.compressor.push(this.simTime(at));
    this.compressions.push({ at, by });
    return true;
  }

  /** The compressor driving the chest while compressions are held. */
  compressor: Compressor | null = null;
  /** The bag (or later the ventilator) while ventilation is held. */
  ventilator: Ventilator | null = null;
  /** The patient's airway: a mask until a device is in. */
  airway: AirwayRoute = 'mask';
  /** The defibrillator is charged (a shock can be given). */
  charged = false;
  /** Shocks delivered. */
  shocks = 0;
  /** When (tick) VF comes back after the last terminating shock, if it will. */
  private refibAt: number | null = null;
  /** The teaching nudge this run carries, if any (ADR-018 decision 6c). */
  readonly nudge: NudgeId | null;
  private failShocks = 0;
  private nudgeSpent = false;
  /** Good CPR for the nudge that rewards it: compressions over at least 80 % of the last two minutes (or of the time since
      the collapse, if shorter, and at least 30 s), counting gaps of up to 2 s as compressing. The thresholds are the
      guideline file's (fraction 80 %, a pause longer than 2 s). */
  private goodCpr(): boolean {
    const onset = (this.events.find((e) => e.kind === 'scene' && e.state === 'arrest') as { t: number } | undefined)?.t ?? 0;
    const from = Math.max(onset, this.t - 120), span = this.t - from;
    if (span < 30) return false;
    const on = this.compressions.map((c) => c.at).filter((a) => a >= from - 2 && a <= this.t);
    let covered = 0;
    for (let i = 1; i < on.length; i++) if (on[i] - on[i - 1] <= 2) covered += Math.max(0, on[i] - Math.max(from, on[i - 1]));
    return covered / span >= 0.8;
  }

  /** Deliver the charged shock (ADR-018 step 3). Whether it ends the fibrillation, and what follows, is drawn from the run's
      seed; the heart's own state sets the odds. A shock given uncharged does nothing; one given with hands on the patient,
      or into a rhythm that is not shockable, is recorded as a hazard (and is given). */
  private shock(by: string): void {
    const joules = 150;
    if (!this.charged) { this.events.push({ t: this.t, kind: 'shock', by, rhythm: this.rhythm(), outcome: 'no-effect', joules: 0 }); return; }
    this.charged = false;
    this.shocks++;
    for (const [slot, h] of this.held) if (slot === 'compressions' || slot === 'ventilation') this.events.push({ t: this.t, kind: 'hazard', code: `shock-while-${slot === 'compressions' ? 'compressing' : 'ventilating'}`, by: h.by });
    const rhythm = this.rhythm();
    if (rhythm !== 'vf' && rhythm !== 'vt') {
      this.events.push({ t: this.t, kind: 'hazard', code: 'shock-non-shockable', by });
      this.events.push({ t: this.t, kind: 'shock', by, rhythm, outcome: 'no-effect', joules });
      return;
    }
    const uT = this.chance.uniform('shock'), uR = this.chance.uniform('shock-rhythm');
    let outcome = this.live.run.arrest.shock(uT, uR);
    /* The teaching nudges that act on a shock (the draws are taken all the same, so the streams stay in step). */
    let setUp = '', forceRecurrence = false, noRecurrence = false;
    if (this.nudge === 'refractory-vf' && this.shocks <= this.failShocks) { outcome = 'not-terminated'; setUp = ' (set up)'; }
    if (this.nudge === 'vf-returns' && !this.nudgeSpent) { outcome = 'organised'; forceRecurrence = true; this.nudgeSpent = true; setUp = ' (set up)'; }
    if (this.nudge === 'rosc-for-good-cpr' && !this.nudgeSpent && this.goodCpr()) { outcome = 'organised'; noRecurrence = true; this.nudgeSpent = true; setUp = ' (set up: good CPR before it)'; }
    this.events.push({ t: this.t, kind: 'chance', stream: 'shock', value: uT, use: `shock ${this.shocks}: ${outcome === 'not-terminated' ? 'the fibrillation goes on' : 'the fibrillation ends'}${setUp}` });
    if (outcome !== 'not-terminated') this.events.push({ t: this.t, kind: 'chance', stream: 'shock-rhythm', value: uR, use: `then ${outcome === 'organised' ? 'an organised rhythm' : 'asystole'} (chance of organised ${(this.live.run.arrest.organisedChance() * 100).toFixed(0)} %)` });
    if (outcome === 'organised') this.writeModel([['electrical.ventricular', 'none']]);
    if (outcome === 'asystole') this.writeModel([['electrical.ventricular', 'asystole']]);
    /* After a terminating shock VF comes back in most patients, within a minute or two (van Alem 2003). Drawn now. */
    this.refibAt = null;
    const uF = this.chance.uniform('refibrillation'), uFt = this.chance.uniform('refibrillation-time');
    /* Amiodarone on board makes it less likely (ADR-018 step 4). */
    const recurrence = ARREST.refibrillationChance * this.live.run.drugs.recurrenceMult();
    if (outcome !== 'not-terminated' && !noRecurrence && (uF < recurrence || forceRecurrence)) {
      const after = -Math.log(1 - uFt) * ARREST.refibrillationMedian / Math.LN2;
      this.refibAt = this.tick + Math.max(1, Math.round(after / TICK_S));
      this.events.push({ t: this.t, kind: 'chance', stream: 'refibrillation', value: uF, use: `VF will come back after ${after.toFixed(0)} s` });
    }
    this.events.push({ t: this.t, kind: 'shock', by, rhythm, outcome, joules });
  }

  /** One row of the trace: what a monitor (with an arterial line) and the capnograph would show. */
  private record(): void {
    const m = this.live.snap.metrics as any, r = this.live.snap.resp as any;
    const breathing = (r?.givenRate ?? 0) > 0 || (r?.RR ?? 0) > 0;
    this.trace.push({ t: this.t, rhythm: this.rhythm(), Psys: m?.Psys ?? NaN, Pdia: m?.Pdia ?? NaN, CPP: m?.CPP ?? null,
      EtCO2: breathing ? (r?.EtCO2 ?? 0) * 7.50062 : null,
      breathing: breathingOf(r) });
  }

  /** The heart's rhythm as the model runs it: 'vf', 'vt', 'asystole' or 'organised'. */
  rhythm(): string { const v = this.live.model.electrical.ventricular; return v === 'none' ? 'organised' : v; }

  /** One breath given by whoever holds the ventilation, beginning at `at` seconds (now or within this tick). */
  ventilate(at: number, seconds = LUNG.bagInspiration, by = 'learner'): boolean {
    if (!this.actors[by]) throw new Error(`no one called ${by} in scenario ${this.def.id}`);
    if (!(at >= this.t - 1e-9 && at < this.t + TICK_S + 1e-9)) throw new Error(`a breath at ${at} s given at ${this.t} s`);
    this.note({ t: this.t, do: 'ventilate', at, seconds, by });
    const h = this.held.get('ventilation');
    if (!h || h.by !== by || !this.ventilator) return this.blocked('ventilate', by, 'not-ventilating');
    const ti = Math.max(0.2, seconds);
    this.ventilator.give(this.respTime(at), LUNG.bagVolume, ti);
    this.events.push({ t: this.t, kind: 'breath', by, seconds: Math.round(ti * 100) / 100, volume: LUNG.bagVolume, rise: this.ventilator.reach() > 0 });
    return true;
  }

  /** The bag squeezed and let go by whoever holds the ventilation: the breath lasts as long as it is held (decision 7). */
  bag(phase: 'squeeze' | 'release', at: number, by = 'learner'): boolean {
    if (!this.actors[by]) throw new Error(`no one called ${by} in scenario ${this.def.id}`);
    if (!(at >= this.t - 1e-9 && at < this.t + TICK_S + 1e-9)) throw new Error(`a squeeze at ${at} s given at ${this.t} s`);
    this.note({ t: this.t, do: 'bag', phase, at, by });
    const h = this.held.get('ventilation');
    if (!h || h.by !== by || !this.ventilator) return phase === 'release' ? false : this.blocked('ventilate', by, 'not-ventilating');
    if (phase === 'squeeze') { this.ventilator.squeeze(this.respTime(at)); return true; }
    const b = this.ventilator.release(this.respTime(at));
    if (b) this.events.push({ t: this.t, kind: 'breath', by, seconds: Math.round(b.ti * 100) / 100, volume: Math.round(b.volume * 1000) / 1000, rise: this.ventilator.reach() > 0 });
    return !!b;
  }

  /** What blocks his airway now, if anything (cleared by `airway.clear`). */
  obstruction: string | null = null;
  private pendingChance: ScenarioEvent[] = [];

  /** Who holds each task (ADR-018 decision 8). Compressions and the airway are also held as interventions. */
  readonly roles: Record<TeamRole, string | null> = { compressions: null, airway: null, defibrillator: null, drugs: null };
  /** The arrest team has been called. */
  called = false;

  /** Call the arrest team (ADR-018 step 5): the caller's hands are busy for the call; the team comes after the scene's
      time, later if the call did not say where. */
  call(says: CallContent[], by = 'learner'): boolean {
    if (!this.actors[by]) throw new Error(`no one called ${by} in scenario ${this.def.id}`);
    this.note({ t: this.t, do: 'call', says: [...says], by });
    const team = this.def.scene.team;
    if (!team) return this.blocked('call', by, 'no-team');
    if (this.called) return this.blocked('call', by, 'already-called');
    const why = this.unable(by);
    if (why) return this.blocked('call', by, why);
    this.called = true;
    this.actors[by].busyUntil = this.tick + Math.round(team.callSeconds / TICK_S);
    const after = team.afterSeconds + (says.includes('where') ? 0 : team.lateWithoutWhere);
    const at = this.tick + Math.round(after / TICK_S);
    this.arrivals.push({ at, people: team.people, equipment: team.equipment });
    this.events.push({ t: this.t, kind: 'call', by, says: [...says], arriveAt: at / 10 });
    return true;
  }

  /** Give a task to someone present (the leader assigns it; ADR-018 decision 8). Compressions and the airway begin at once:
      whoever had them lets go. Returns false if they cannot take it now. */
  assign(role: TeamRole, to: string): boolean {
    if (!this.actors[to]) throw new Error(`no one called ${to} in scenario ${this.def.id}`);
    this.note({ t: this.t, do: 'assign', role, to });
    if (!this.actors[to].present) return this.blocked(`role:${role}`, to, 'absent');
    /* compressions on a raised bed are refused before anyone lets go of what they hold */
    const pos = role === 'compressions' ? this.interventions['cpr.compressions']?.needs?.position : undefined;
    if (pos && !pos.includes(this.session.state.position as never) && this.held.get('compressions')?.by !== to) return this.blocked(`role:${role}`, to, `position:${pos.join('|')}`);
    /* one task per pair of hands: whatever else they held is given up */
    for (const r of TEAM_ROLES) if (r !== role && this.roles[r] === to) { this.roles[r] = null; this.events.push({ t: this.t, kind: 'assigned', role: r, to: null }); }
    const slot = role === 'compressions' ? 'compressions' : role === 'airway' ? 'ventilation' : null;
    const ok = this.within(() => {
      if (!slot) { const mine = this.actors[to].hands; if (mine) this.release(mine, to); return true; }
      const h = this.held.get(slot);
      if (h && h.by === to) return true;   // already doing it
      const mine = this.actors[to].hands;
      if (mine) this.release(mine, to);
      return this.intervene(role === 'compressions' ? 'cpr.compressions' : 'vent.bag', to);
    });
    if (!ok) return false;
    this.roles[role] = to;
    this.events.push({ t: this.t, kind: 'assigned', role, to });
    return true;
  }

  /** Whoever let go of the compressions or the bag no longer has that task. */
  private dropRole(slot: string, who: string): void {
    const role: TeamRole | null = slot === 'compressions' ? 'compressions' : slot === 'ventilation' ? 'airway' : null;
    if (role && this.roles[role] === who) { this.roles[role] = null; this.events.push({ t: this.t, kind: 'assigned', role, to: null }); }
  }

  /** The lungs' clock at scenario time `at`. */
  private respTime(at: number): number { return this.live.run.resp.t + (at - this.t); }

  /** The circulation's clock at scenario time `at` (the two advance together, tick by tick). */
  private simTime(at: number): number { return this.live.run.sim.t + (at - this.t); }

  private drive(driver: 'compressions' | 'ventilation', by: string, on: boolean): void {
    if (driver === 'ventilation') {
      if (!on) { this.ventilator = null; this.live.run.setVentilator(null); return; }
      const v = new Ventilator(this.airway);
      /* a bolus in the pharynx stops whatever is given, by mask or device, until it is cleared */
      v.obstructed = !!this.obstruction;
      /* Through an airway device a team member gives breaths at a steady 10/min (ERC: continuous compressions, 10 breaths a
         minute); with a mask, breaths only when told (the `ventilate` input), in the pauses of 30:2. The learner gives their own. */
      if (by !== 'learner' && this.airway !== 'mask') v.steady(10, this.respTime(this.t));
      this.ventilator = v;
      this.live.run.setVentilator(v);
      return;
    }
    if (!on) { this.compressor = null; this.steadyNext = null; this.live.run.setCompressor(null); return; }
    const c = new Compressor(CPR.itpManual);
    /* A team member keeps a steady rate from now; the learner's compressions are their own taps. */
    if (by !== 'learner') { c.steady(CPR.rescuerRate, this.simTime(this.t)); this.steadyNext = this.t; }
    this.compressor = c;
    this.live.run.setCompressor(c);
  }

  /* ---- effects ------------------------------------------------------------------------------------------ */

  private complete(p: { id: string; by: string }): void {
    const x = this.interventions[p.id], e = x.effect;
    if (e.kind === 'continuous') {
      const old = this.held.get(e.slot);
      if (old) {
        /* taking over: whoever held it lets go, and their hands are free */
        if (this.actors[old.by]?.hands === e.slot) this.actors[old.by].hands = undefined;
        this.undo(old); this.held.delete(e.slot); this.events.push({ t: this.t, kind: 'release', slot: e.slot, by: old.by, id: old.id });
        this.dropRole(e.slot, old.by);
      }
      const before: Record<string, number | string> = {};
      for (const path of Object.keys(e.inputs)) before[path] = getPath(this.live.model, path);
      const stateBefore = Object.fromEntries(Object.keys(e.state ?? {}).map((k) => [k, (this.session.state as any)[k]])) as Partial<PatientState>;
      this.writeModel(Object.entries(e.inputs));
      if (e.state) this.setState(e.state);
      this.held.set(e.slot, { id: p.id, by: p.by, inputs: before, state: stateBefore });
      if (e.handsWhileHeld) this.actors[p.by].hands = e.slot;
      if (e.driver) this.drive(e.driver, p.by, true);
    } else {
      if (e.change?.length) this.writeModel(e.change.map((w) => [w.path, w.add != null ? Number(getPath(this.live.model, w.path)) + w.add : w.set!]));
      for (const g of e.grants ?? []) this.access.add(g);
      if (e.airway) {
        this.airway = e.airway;
        if (this.ventilator) {
          this.ventilator.route = e.airway;
          /* a team member already ventilating goes over to 10/min once the airway device is in */
          const h = this.held.get('ventilation');
          if (h && h.by !== 'learner' && e.airway !== 'mask') this.ventilator.steady(10, this.respTime(this.t));
        }
      }
      if (e.defib === 'charge') this.charged = true;
      if (e.defib === 'shock') this.shock(p.by);
      if (e.fetch) {
        /* away for the errand, back with what was fetched */
        this.actors[p.by].present = false;
        this.arrivals.push({ at: this.tick + Math.round(e.fetch.seconds / TICK_S), people: [p.by], equipment: e.fetch.equipment });
        this.events.push({ t: this.t, kind: 'leave', people: [p.by] });
      }
      if (e.assess === 'rhythm') {
        /* with an organised rhythm, the pulse too (ERC: rhythm and pulse check) */
        const rhythm = this.rhythm(), m = this.live.snap.metrics as any;
        this.events.push({ t: this.t, kind: 'assessed', what: 'rhythm', rhythm, by: p.by, ...(rhythm === 'organised' ? { pulse: (m?.Psys ?? 0) >= 50 } : {}) });
      }
      if (e.assess === 'breathing') {
        const r = this.live.snap.resp as any;
        this.events.push({ t: this.t, kind: 'assessed', what: 'breathing', by: p.by, breathing: breathingOf(r) });
      }
      if (e.assess === 'chest') {
        /* half a lung or more collapsed is silent on that side; trapped air under pressure pushes the trachea away */
        const q = this.live.model.respiratory;
        const side = (ptx: number) => (ptx >= 0.5 ? 'silent' : 'normal') as 'silent' | 'normal';
        const tension = q.tensionL > 0 || q.tensionR > 0 ? (q.tensionL >= q.tensionR ? 'left' : 'right') : null;
        this.events.push({ t: this.t, kind: 'assessed', what: 'chest', by: p.by, chest: { left: side(q.ptxL), right: side(q.ptxR), tension } });
      }
      if (e.assess === 'mouth') this.events.push({ t: this.t, kind: 'assessed', what: 'mouth', by: p.by, mouth: this.obstruction ? 'bolus' : 'clear' });
      if (e.clearAirway && this.obstruction) {
        this.obstruction = null;
        if (this.ventilator) this.ventilator.obstructed = false;
        this.events.push({ t: this.t, kind: 'obstruction', what: null, by: p.by });
      }
      if (e.dose) { this.live.run.drugs.give(e.dose.drug, e.dose.mg); this.events.push({ t: this.t, kind: 'dose', drug: e.dose.drug, mg: e.dose.mg, by: p.by }); }
      if (e.state) this.setState(e.state);
    }
    this.did.add(p.id);
    this.session.done.add(p.id);
    this.events.push({ t: this.t, kind: 'done', id: p.id, by: p.by });
  }

  private undo(h: Held): void {
    const e = this.interventions[h.id].effect;
    if (e.kind === 'continuous' && e.driver) this.drive(e.driver, h.by, false);
    if (Object.keys(h.inputs).length) this.writeModel(Object.entries(h.inputs));
    if (Object.keys(h.state).length) this.setState(h.state);
  }

  /** Write values into the running model: it responds from now on. */
  private writeModel(writes: Array<[string, number | string]>): void {
    const m = structuredClone(this.live.model);
    for (const [path, v] of writes) setPath(m, path, v);
    this.live.setModel(m);
    this.sync();
  }

  private setState(change: Partial<PatientState>): void {
    Object.assign(this.session.state, change);
    this.session.encounter.events.push({ t: this.ms, kind: 'state', change });
  }

  /* ---- the case's own course ----------------------------------------------------------------------------- */

  private course(): void {
    const course = this.session.caseDef.course ?? [];
    if (!course.length) return;
    const before = new Set(this.session.appliedCourse);
    this.session.t = this.ms;
    advanceCourse(this.session);
    course.forEach((ev, i) => {
      if (before.has(i) || !this.session.appliedCourse.has(i)) return;
      const prevented = !!ev.unless?.some((id) => this.session.done.has(id));
      /* The course's physiology is circulation parameters (the case's vocabulary); the running model takes them now. */
      if (!prevented && ev.change.physiology) this.writeModel(Object.entries(ev.change.physiology).map(([k, v]) => [`circulation.${k}`, v]));
      this.events.push({ t: this.t, kind: 'course', index: i, prevented, ...(ev.note && !prevented ? { note: ev.note } : {}) });
    });
  }

  /* ---- the scene ---------------------------------------------------------------------------------------- */

  private enter(name: string): void {
    const st = this.def.machine.states[name];
    if (!st) throw new Error(`scenario ${this.def.id} has no scene state ${name}`);
    this.scene = name;
    this.sceneSince = this.tick;
    this.events.push({ t: this.t, kind: 'scene', state: name });
    for (const d of st.enter ?? []) {
      if ('say' in d) this.events.push({ t: this.t, kind: 'say', who: d.say.who, text: d.say.text });
      else if ('leave' in d) {
        for (const who of d.leave.people) {
          /* whatever they held is let go */
          for (const [slot, h] of [...this.held]) if (h.by === who) this.release(slot, who);
          this.actors[who].present = false; this.actors[who].busyUntil = 0;
        }
        this.events.push({ t: this.t, kind: 'leave', people: d.leave.people });
      }
      else if ('change' in d) this.writeModel(d.change.map((w) => [w.path, w.add != null ? Number(getPath(this.live.model, w.path)) + w.add : w.set!]));
      else this.arrivals.push({ at: this.tick + Math.round(d.arrive.afterSeconds / TICK_S), people: d.arrive.people ?? [], equipment: d.arrive.equipment ?? [] });
    }
    this.arrive();
  }

  private arrive(): void {
    const due = this.arrivals.filter((a) => a.at <= this.tick);
    if (!due.length) return;
    this.arrivals = this.arrivals.filter((a) => a.at > this.tick);
    for (const a of due) {
      for (const p of a.people) this.actors[p].present = true;
      for (const e of a.equipment) this.equipment.add(e);
      this.events.push({ t: this.t, kind: 'arrive', people: a.people, equipment: a.equipment });
    }
  }

  /** A value of the running model, as the scene reads it: 'circulation.<metric>' (over a breath), 'resp.<key>', 'body.<key>'. */
  valueOf(path: string): number | undefined {
    const i = path.indexOf('.');
    const sec = path.slice(0, i), key = path.slice(i + 1);
    const snap = this.live.snap;
    const src = sec === 'circulation' ? (snap.metricsBreath ?? snap.metrics) : sec === 'resp' ? snap.resp : sec === 'body' ? snap.body : undefined;
    const v = src?.[key];
    return typeof v === 'number' ? v : undefined;
  }

  holds(w: SceneWhen): boolean {
    if ('did' in w) return this.did.has(w.did);
    if ('holding' in w) return this.held.has(w.holding);
    if ('inStateFor' in w) return (this.tick - this.sceneSince) * TICK_S >= w.inStateFor - 1e-9;
    if ('at' in w) return this.t >= w.at - 1e-9;
    if ('value' in w) {
      const v = this.valueOf(w.value.of);
      if (v === undefined) return false;
      return (w.value.below == null || v < w.value.below) && (w.value.above == null || v > w.value.above);
    }
    if ('all' in w) return w.all.every((x) => this.holds(x));
    return w.any.some((x) => this.holds(x));
  }

  private moveScene(): void {
    for (let n = 0; n < 16 && !this.over; n++) {
      const next = this.def.machine.states[this.scene].next?.find((x) => this.holds(x.when));
      if (!next) return;
      this.enter(next.to);
    }
  }
}

/** Run a scenario again from its seed and inputs, to `until` seconds (default: the last input). */
/** A second of the patient, for the debrief: rhythm, arterial pressure, coronary perfusion pressure (mmHg), end-tidal CO₂
    (mmHg, null while nothing is breathed out). */
export interface TraceRow { t: number; rhythm: string; Psys: number; Pdia: number; CPP: number | null; EtCO2: number | null; breathing?: Breathing }

export type Breathing = 'normal' | 'failing' | 'gasping' | 'none';
/** What someone looking would see of his own breathing (given breaths aside): normal only while the respiratory centre
    works (at least 0.9 of its function: our cut); breaths still coming from a failing centre are slow and shallow, not
    normal; gasping; or nothing. */
export function breathingOf(r: { gasping?: boolean; RR?: number; givenRate?: number; centre?: number } | undefined): Breathing {
  if (r?.gasping) return 'gasping';
  if ((r?.RR ?? 0) - (r?.givenRate ?? 0) <= 0.5) return 'none';
  return (r?.centre ?? 1) >= 0.9 ? 'normal' : 'failing';
}

export function replay(def: ScenarioDef, opts: RunOptions & { log: ScenarioInput[]; until?: number }): ScenarioRun {
  const run = new ScenarioRun(def, opts);
  for (const e of opts.log) { run.advanceTo(e.t); run.input(e); }
  run.advanceTo(opts.until ?? opts.log.at(-1)?.t ?? 0);
  return run;
}
