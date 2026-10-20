/* Guidelines as data and the debrief (ADR-018 step 5): the guideline file is valid, a run is scored against it from what
   it recorded, an ideal performance meets it, and the poor ones the ADR names (a late first compression, long pauses,
   slow compressions) miss it where they went wrong. Scoring reads only the record, so a replay scores the same. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `debrief-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_scenario_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const S = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); } };
const J = (x) => JSON.stringify(x);
const errors = (issues) => issues.filter((i) => i.level === 'error');
const G = S.GUIDELINES.find((g) => g.id === 'erc-2025-als');
const rule = (rep, id) => rep.rules.find((r) => r.id === id);
const statuses = (rep) => Object.fromEntries(rep.rules.map((r) => [r.id, r.status]));

console.log('\nThe guideline file');
{
  ok('the ERC 2025 ALS file is valid: every rule cites a section, says whose its numbers are, and is in English and German', G && !errors(S.validateGuideline(G)).length, J(errors(S.validateGuideline(G ?? {}))));
  const broken = (f) => { const g = structuredClone(G); f(g); return errors(S.validateGuideline(g)).map((i) => i.message).join(' | '); };
  ok('the validator refuses a placement without a note', /a placement without a note/.test(broken((g) => { g.rules[0].note = ''; })));
  ok('…a rule with no German', /missing de/.test(broken((g) => { delete g.rules[1].title.de; })));
  ok('…a check it does not know, and a drug the model does not have', /unknown check/.test(broken((g) => { g.rules[1].check.kind = 'vibes'; })) && /no drug/.test(broken((g) => { g.rules.find((r) => r.id === 'adrenaline-first').check.drug = 'vasopressin'; })));
}

/* ---- synthetic records: exact, fast ------------------------------------------------------------------------------- */
/* A man in VF from `onset` to the end; compressions at `rate` from `from`, in cycles of 30 with a pause of `pause` s for
   two breaths (the nurse's), stopping around each shock for `around` s before and after; shocks every 2 min from 75 s. */
const END = 600, ONSET = 4;
const record = ({ from = 6, rate = 110, pause = 3, around = 1, shocks = [75, 195, 315, 435, 555], doses = [], extraGaps = [], padsAt = 70, hazards = [], call = ['where', 'arrest', 'defibrillator'], callAt = 10, rotate = true } = {}) => {
  const comps = [], breaths = [];
  let t = from, n = 0;
  while (t < END) {
    if (shocks.some((s) => t > s - around && t < s + around) || extraGaps.some(([a, b]) => t > a && t < b)) { t += 0.05; if (shocks.some((s) => t >= s && t < s + 0.05)) n = 0; continue; }
    comps.push(Math.round(t * 1000) / 1000); n++; t += 60 / rate;
    if (n === 30) { breaths.push(t + 0.2, t + 0.2 + pause / 2); t += pause; n = 0; }
  }
  /* the compressor changes at each shock (every 2 min), the learner and the doctor taking turns */
  const byAt = (at) => !rotate ? 'learner' : shocks.filter((s) => s < at).length % 2 ? 'doctor' : 'learner';
  const events = [
    ...(call ? [{ t: callAt, kind: 'call', by: 'nurse', says: call, arriveAt: callAt + 120 }] : []),
    { t: 5, kind: 'assigned', role: 'compressions', to: 'learner' },
    { t: 20, kind: 'assigned', role: 'airway', to: 'nurse' },
    { t: 64, kind: 'arrive', people: ['doctor', 'nurse2'], equipment: ['defibrillator', 'cannula-kit', 'drugs'] },
    { t: 66, kind: 'assigned', role: 'defibrillator', to: 'nurse2' },
    { t: 67, kind: 'assigned', role: 'drugs', to: 'doctor' },
    { t: padsAt, kind: 'done', id: 'defib.pads', by: 'nurse' },
    ...shocks.map((s) => ({ t: s, kind: 'shock', by: 'nurse', rhythm: 'vf', outcome: 'not-terminated', joules: 150 })),
    ...breaths.map((b) => ({ t: b, kind: 'breath', by: 'nurse', seconds: 1, volume: 0.5 })),
    ...doses.map(([at, drug, mg]) => ({ t: at, kind: 'dose', drug, mg, by: 'nurse' })),
    ...hazards.map(([at, code]) => ({ t: at, kind: 'hazard', code, by: 'nurse' })),
  ].sort((a, b) => a.t - b.t);
  const trace = Array.from({ length: END }, (_, i) => ({ t: i + 1, rhythm: i + 1 <= ONSET ? 'organised' : 'vf', Psys: i + 1 <= ONSET ? 120 : 32, Pdia: 20, CPP: 15, EtCO2: 20 }));
  return { t: END, log: [], events, compressions: comps.map((at) => ({ at, by: byAt(at) })), trace };
};
const DOSES = [[330, 'adrenaline', 1], [340, 'amiodarone', 300], [540, 'adrenaline', 1], [570, 'amiodarone', 150]];

console.log('\nScoring an ideal performance (synthetic record)');
const ideal = S.scoreRun(G, record({ doses: DOSES }));
{
  const missed = ideal.rules.filter((r) => r.status === 'missed').map((r) => `${r.id} (${r.value ?? ''} at ${r.at.join(',')})`);
  ok('the collapse is found from the trace, and CPR is needed from it to the end', ideal.onset === ONSET && ideal.needCpr.length === 1 && ideal.needCpr[0][1] === END);
  ok('an ideal performance meets every rule that applies', missed.length === 0, missed.join('; '));
  const m = ideal.measures;
  ok('…and its measures are what was scripted: first compression 2 s, 110/min, cycles of 30, pauses of about 3 s, peri-shock pauses about 1 s',
    m.firstCompression === 2 && Math.abs(m.rate - 110) <= 1 && m.cycles.every((c) => c === 30) && m.longestPause <= 3.5 && m.shocks.every((s) => s.before + s.after <= 2.6),
    J({ fc: m.firstCompression, rate: m.rate, cycles: [...new Set(m.cycles)], lp: m.longestPause, shocks: m.shocks.slice(0, 2) }));
  ok('…compressing over 80 % of the time', m.fraction >= 80, `${m.fraction} %`);
  ok('the learner gave no breaths of their own, so the breath rule does not apply', rule(ideal, 'breath').status === 'not-applicable');
  ok('each pause says what it was for: breaths, or a shock', ideal.pauses.length > 10 && ideal.pauses.every((p) => !p.during.includes('none')) && ideal.pauses.some((p) => p.during.includes('shock')), J(ideal.pauses.filter((p) => p.during.includes('none')).slice(0, 3)));
}

console.log('\nThe poor performances the ADR names');
{
  const late = S.scoreRun(G, record({ from: 40, doses: DOSES }));
  ok('a late first compression (36 s after the collapse) misses "at once", marked where it should have started', rule(late, 'start-compressions').status === 'missed' && rule(late, 'start-compressions').value === 36 && rule(late, 'start-compressions').at[0] === ONSET + 15,
    J(rule(late, 'start-compressions')));
  ok('…and lowers the compression fraction, which was otherwise ideal', late.measures.fraction < ideal.measures.fraction);
  const long = S.scoreRun(G, record({ pause: 14, doses: DOSES }));
  ok('long pauses for breaths (14 s) miss the 10 s limit and the 80 % fraction', rule(long, 'longest-pause').status === 'missed' && rule(long, 'fraction').status === 'missed' && rule(long, 'longest-pause').value >= 13.5,
    J({ lp: rule(long, 'longest-pause'), f: long.measures.fraction }));
  ok('…while the rate within the cycles is still right', rule(long, 'rate').status === 'met');
  const slow = S.scoreRun(G, record({ rate: 80, doses: DOSES }));
  ok('slow compressions (80/min) miss the rate, and nothing else about the cycles', rule(slow, 'rate').status === 'missed' && Math.abs(rule(slow, 'rate').value - 80) <= 1 && rule(slow, 'thirty-two').status === 'met',
    J(statuses(slow)));
}

console.log('\nThe team');
{
  const none = S.scoreRun(G, record({ call: null, doses: DOSES }));
  ok('no call for the arrest team is missed, marked 30 s after the collapse', rule(none, 'call-team').status === 'missed' && rule(none, 'call-team').at[0] === ONSET + 30, J(rule(none, 'call-team')));
  const vague = S.scoreRun(G, record({ call: ['arrest'], doses: DOSES }));
  ok('a call in time that does not say where is missed, at the call', rule(vague, 'call-team').status === 'missed' && rule(vague, 'call-team').at[0] === 10);
  const late = S.scoreRun(G, record({ callAt: 60, doses: DOSES }));
  ok('a call 56 s after the collapse is late', rule(late, 'call-team').status === 'missed' && rule(late, 'call-team').value === 56);
  const tired = S.scoreRun(G, record({ rotate: false, doses: DOSES }));
  ok('one person compressing throughout misses the change every 2 min, marked each time it fell due', rule(tired, 'rotation').status === 'missed' && rule(tired, 'rotation').at.length >= 3 && rule(tired, 'rotation').at[0] === 10 + 150, J(rule(tired, 'rotation')));
  const r = record({ doses: DOSES });
  r.events = r.events.filter((e) => !(e.kind === 'assigned' && e.role === 'drugs'));
  const noDrugs = S.scoreRun(G, r);
  ok('the drugs given to nobody, though they came at 64 s: the task is missed a minute after they came', rule(noDrugs, 'tasks').status === 'missed' && rule(noDrugs, 'tasks').at[0] === 64 + 60, J(rule(noDrugs, 'tasks')));
}

console.log('\nShocks, rhythm checks and drugs against the algorithm');
{
  const pre = S.scoreRun(G, record({ around: 8, doses: DOSES }));
  const tight = S.scoreRun(G, record({ around: 2.2, doses: DOSES }));
  ok('2 s before and 2 s after a shock is each under 5 s, but together over it: the guideline counts the whole interruption', rule(tight, 'peri-shock').status === 'missed' && rule(tight, 'peri-shock').value > 4.4, J(rule(tight, 'peri-shock')));
  ok('a long pause before each shock (8 s) misses the 5 s limit, marked at each shock', rule(pre, 'peri-shock').status === 'missed' && rule(pre, 'peri-shock').at.length === 5, J(rule(pre, 'peri-shock')));
  const noChecks = S.scoreRun(G, record({ shocks: [75], doses: [] }));
  ok('after one shock and no further rhythm check, a check is overdue 2 min (+20 s) later', rule(noChecks, 'rhythm-checks').status === 'missed' && rule(noChecks, 'rhythm-checks').at.includes(75 + 140), J(rule(noChecks, 'rhythm-checks')));
  const early = S.scoreRun(G, record({ doses: [[150, 'adrenaline', 1], [400, 'adrenaline', 1], [340, 'amiodarone', 300], [570, 'amiodarone', 150]] }));
  ok('adrenaline before the third shock in VF is early', rule(early, 'adrenaline-first').status === 'missed' && rule(early, 'adrenaline-first').at.includes(150), J(rule(early, 'adrenaline-first')));
  const gapped = S.scoreRun(G, record({ doses: [[200, 'adrenaline', 1], [340, 'amiodarone', 300], [570, 'amiodarone', 150]] }));
  ok('one adrenaline and none 5 min later, while CPR goes on, misses the 3–5 min repeat, marked when it fell due', rule(gapped, 'adrenaline-repeat').status === 'missed' && rule(gapped, 'adrenaline-repeat').at[0] === 200 + 300, J(rule(gapped, 'adrenaline-repeat')));
  const noAmio = S.scoreRun(G, record({ doses: [[330, 'adrenaline', 1], [540, 'adrenaline', 1]] }));
  ok('no amiodarone after the third shock misses, marked at the fourth', rule(noAmio, 'amiodarone-300').status === 'missed' && rule(noAmio, 'amiodarone-300').at.includes(435), J(rule(noAmio, 'amiodarone-300')));
  const fewShocks = S.scoreRun(G, record({ shocks: [75, 195], doses: [] }));
  ok('with fewer than three shocks the drug rules do not apply', ['adrenaline-first', 'amiodarone-300', 'amiodarone-150'].every((id) => rule(fewShocks, id).status === 'not-applicable'));
  const unsafe = S.scoreRun(G, record({ doses: DOSES, hazards: [[195, 'shock-while-compressing']] }));
  ok('a shock with hands on the chest misses shock safety, at its time', rule(unsafe, 'shock-safety').status === 'missed' && rule(unsafe, 'shock-safety').at[0] === 195);
}

console.log('\nA run on the clock (the practice arrest, scripted)');
{
  /* The nurse stays and the trolley is in the room. The learner compresses at 110/min from the collapse; the nurse takes
     the bag and gives two breaths after every 30, puts on the pads, and checks the rhythm. */
  const P = structuredClone(S.SCENARIOS.find((s) => s.id === 'arrest-practice'));
  for (const e of P.scene.equipment) e.present = true;
  P.machine.states.arrest.enter = P.machine.states.arrest.enter.filter((d) => !('leave' in d) && !('arrive' in d));
  const caseDef = S.FREE_CASE;
  const r = new S.ScenarioRun(P, { seed: 51, caseDef });
  const tap = 60 / 110;
  let next = null, count = 0, resumeAt = null;
  const breathsAt = [];
  r.advanceTo(4.5); r.intervene('cpr.compressions'); r.intervene('defib.pads', 'nurse');
  while (r.t < 150) {
    const t = r.t;
    if (t >= 6.5 && next == null && r.held.get('compressions')?.by === 'learner') next = t;
    if (t >= 30 && !r.held.get('ventilation') && r.actors.nurse.busyUntil <= r.tick && !r.did.has('vent.bag')) r.intervene('vent.bag', 'nurse');
    if (next != null && resumeAt == null && next < t + 0.1 - 1e-9) {
      r.compress(Math.max(t, Math.round(next * 1000) / 1000)); count++; next += tap;
      if (count >= 30 && r.held.get('ventilation')?.by === 'nurse') {
        count = 0; resumeAt = t + 3.2;
        r.ventilate(t, 1, 'nurse'); breathsAt.push(t + 1.6);
      }
    }
    if (breathsAt.length && Math.abs(t - breathsAt[0]) < 0.05) { breathsAt.shift(); r.ventilate(t, 1, 'nurse'); }
    if (resumeAt != null && t >= resumeAt - 1e-9) { resumeAt = null; next = t; }
    r.advanceTo(Math.round((t + 0.1) * 10) / 10);
  }
  const rep = S.scoreRun(G, r);
  ok('the run records every compression and a trace of the patient each second', r.compressions.length > 150 && r.trace.length === 150 && r.trace.at(-1).t === 150, `${r.compressions.length} compressions, ${r.trace.length} rows`);
  ok('the collapse is found at the scene’s 4 s, and the first compression about 3 s later', rep.onset != null && Math.abs(rep.onset - 4) <= 1 && rep.measures.firstCompression <= 4, J({ onset: rep.onset, fc: rep.measures.firstCompression }));
  ok('the scripted rate and 30:2 are read back (the first cycle runs on until the nurse has the bag)', Math.abs(rep.measures.rate - 110) <= 2 && rep.measures.cycles.length >= 3 && rep.measures.cycles.slice(1).every((c) => c === 30) && rep.measures.cycles[0] > 30, J({ rate: rep.measures.rate, cycles: rep.measures.cycles }));
  ok('the trace shows the patient: VF, and a coronary perfusion pressure once compressions run', r.trace.filter((x) => x.t > 20).every((x) => x.rhythm === 'vf') && r.trace.filter((x) => x.t > 30).some((x) => x.CPP > 10), J(r.trace.slice(25, 28)));
  ok('pads on and no rhythm check: the check is missed, marked 30 s after the pads', rule(rep, 'rhythm-checks').status === 'missed', J(rule(rep, 'rhythm-checks')));
  const R = S.replay(P, { seed: 51, caseDef, log: r.log, until: r.t });
  ok('a replay scores exactly the same', J(S.scoreRun(G, R)) === J(rep));
}

console.log(`\n${pass} passed, ${fail} failed, 0 known gaps`);
if (fail) process.exit(1);
