/* Playtest sessions, read and summarised (owner, 2026-10-23).

   Usage: node scripts/playtest-report.mjs session1.json session2.json … > report.md

   Each file is what the playtest copy of the app saves ("Save session", session-record.ts): every tap and setting
   changed, on which screen and when, the app's state at each change of screen, the messages and refusals screens
   reported, and each finished practice arrest with what replays it. Each arrest is replayed exactly (ADR-018, replay) and
   scored against the guideline file. Nothing here interprets the person; it lists what happened. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node scripts/playtest-report.mjs session.json [session.json …]'); process.exit(2); }
const bundle = join(tmpdir(), `playtest-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_scenario_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const S = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const out = [];
const all = { sessions: 0, runs: 0, refusals: new Map(), missed: new Map(), messages: new Map(), screens: new Map() };
const count = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

/* one practice arrest, replayed */
const arrest = (r, n) => {
  const [sid, sver] = r.scenario.split('@');
  const def = S.SCENARIOS.find((x) => x.id === sid);
  const G = S.GUIDELINES.find((g) => `${g.id}@${g.version}` === r.guideline) ?? S.GUIDELINES.find((g) => g.id === r.guideline.split('@')[0]);
  const lines = [`### Arrest ${n}: ${r.choice}${r.nudge ? `, nudge ${r.nudge}` : ', no nudge'} · ${r.lang} · ${r.layout}`];
  if (!def) return [...lines, `Unknown scenario ${sid}.`];
  if (def.version !== sver) lines.push(`> Saved with scenario ${sver}; replayed with ${def.version}. A replay is exact only on the same version.`);
  const run = S.replay(def, { seed: r.seed, caseDef: S.FREE_CASE, settleSeconds: 20, nudge: r.nudge ?? null, log: r.log, until: r.t });
  const rep = S.scoreRun(G, run);
  all.runs++;
  lines.push(`- **Length:** ${clock(r.t)} · collapse ${rep.onset != null ? clock(rep.onset) : '—'} · first compression ${rep.measures.firstCompression != null ? `${rep.measures.firstCompression.toFixed(1)} s after it` : 'never'} · compressing ${rep.measures.fraction ?? '—'} % · rate ${rep.measures.rate ?? '—'}/min · shocks ${rep.measures.shocks.length}`);
  const met = rep.rules.filter((x) => x.status === 'met').length, applied = rep.rules.filter((x) => x.status !== 'not-applicable').length;
  lines.push(`- **Guideline:** ${met}/${applied} met. Missed: ${rep.rules.filter((x) => x.status === 'missed').map((x) => { count(all.missed, x.id); return `${x.id}${x.value != null ? ` (${x.value})` : ''}`; }).join(', ') || 'none'}`);
  const ev = [];
  for (const e of run.events) {
    if (e.kind === 'done') ev.push(`${clock(e.t)} ${e.by}: ${e.id}`);
    else if (e.kind === 'assigned' && e.to) ev.push(`${clock(e.t)} task ${e.role} → ${e.to}`);
    else if (e.kind === 'call') ev.push(`${clock(e.t)} ${e.by} calls the team, saying ${e.says.join(', ') || 'nothing specific'}`);
    else if (e.kind === 'shock') ev.push(`${clock(e.t)} shock: ${e.outcome}`);
    else if (e.kind === 'assessed') ev.push(`${clock(e.t)} ${e.by} checks ${e.what}: ${e.rhythm ?? e.breathing ?? e.mouth}${e.pulse != null ? `, pulse ${e.pulse}` : ''}`);
    else if (e.kind === 'hazard') ev.push(`${clock(e.t)} HAZARD ${e.code}`);
    else if (e.kind === 'refibrillation') ev.push(`${clock(e.t)} VF back`);
    else if (e.kind === 'arrive') ev.push(`${clock(e.t)} arrive: ${[...e.people, ...e.equipment].join(', ')}`);
  }
  lines.push(`\n<details><summary>What happened (${ev.length})</summary>\n\n${ev.map((l) => `    ${l}`).join('\n')}\n</details>\n`);
  return lines;
};

for (const f of files) {
  const r = JSON.parse(readFileSync(f, 'utf8'));
  out.push(`## ${f}\n`);
  if (r.schema !== 'vp.playtest-session/1') { out.push(`Not a saved session (schema ${r.schema}).\n`); continue; }
  all.sessions++;
  out.push(`- **Session:** ${clock(r.seconds)} long · ${r.screen?.w}×${r.screen?.h}${r.screen?.touch ? ' touch' : ''} · saved ${r.saved}`);
  /* time on each screen, from the snapshots */
  const snaps = r.snapshots ?? [];
  const spent = new Map();
  snaps.forEach((s, i) => { const d = (snaps[i + 1]?.t ?? r.seconds) - s.t; spent.set(s.screen, (spent.get(s.screen) ?? 0) + d); count(all.screens, s.screen, d); });
  out.push(`- **Screens:** ${[...spent].sort((a, b) => b[1] - a[1]).map(([k, d]) => `${k} ${clock(d)}`).join(', ')}`);
  out.push(`- **Path:** ${snaps.map((s) => `${clock(s.t)} ${s.screen}${s.app?.caseId && s.app.caseId !== 'none' ? ` (${s.app.caseId})` : ''}`).join(' → ')}`);
  const steps = r.steps ?? [];
  const refused = steps.filter((x) => x.what.startsWith('refused:')), msgs = steps.filter((x) => x.what.startsWith('message:'));
  refused.forEach((x) => count(all.refusals, `${x.screen}: ${x.what.slice(9).trim()}`));
  msgs.forEach((x) => count(all.messages, `${x.screen}: ${x.what.slice(9).trim()}`));
  out.push(`- **Refused:** ${refused.length ? refused.map((x) => `${clock(x.t)} ${x.screen} ${x.what.slice(9).trim()}`).join('; ') : 'none'}`);
  /* stretches without a tap, per screen */
  const quiet = [];
  for (let i = 1; i < steps.length; i++) if (steps[i].t - steps[i - 1].t > 20) quiet.push(`${clock(steps[i - 1].t)}–${clock(steps[i].t)} on ${steps[i - 1].screen} (${Math.round(steps[i].t - steps[i - 1].t)} s; last: ${steps[i - 1].what})`);
  out.push(`- **Long stretches without a tap (over 20 s):** ${quiet.slice(0, 8).join('; ') || 'none'}`);
  const taps = new Map();
  for (const x of steps) if (x.what.startsWith('tap ') || x.what.startsWith('set ')) count(taps, `${x.screen} · ${x.what.split(' = ')[0]}`);
  out.push(`- **Most touched:** ${[...taps].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k} ${n}×`).join(', ')}\n`);
  (r.runs ?? []).filter((x) => x.kind === 'arrest').forEach((x, i) => out.push(...arrest(x.data, i + 1), ''));
}

const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} (${n})`).join('; ') || 'none';
console.log(`# Playtest: ${all.sessions} session${all.sessions === 1 ? '' : 's'}, ${all.runs} practice arrest${all.runs === 1 ? '' : 's'}\n`);
console.log(`- **Time by screen:** ${[...all.screens].sort((a, b) => b[1] - a[1]).map(([k, d]) => `${k} ${clock(d)}`).join(', ') || '—'}`);
console.log(`- **Refused most:** ${top(all.refusals)}`);
console.log(`- **Messages seen most:** ${top(all.messages)}`);
console.log(`- **Arrest rules missed most:** ${top(all.missed)}\n`);
console.log(out.join('\n'));
