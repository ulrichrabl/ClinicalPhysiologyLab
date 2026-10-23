/* A playtest's saved runs, replayed and summarised (owner, 2026-10-23).

   Usage: node scripts/playtest-report.mjs run1.json run2.json … > report.md

   Each file is what the practice arrest's debrief saves ("Save this run"): the scenario and its version, the seed, the
   teaching nudge, the run's input log and the learner's screen trail. The run is replayed exactly from them (ADR-018,
   replay), scored against the guideline file, and summarised with what the screen trail shows: what was refused and why,
   the messages the learner saw, where they hesitated. Nothing here interprets the learner; it lists what happened. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node scripts/playtest-report.mjs run.json [run.json …]'); process.exit(2); }
const bundle = join(tmpdir(), `playtest-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_scenario_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node', loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const S = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const out = [];
const all = { runs: 0, refusals: new Map(), missed: new Map(), messages: new Map() };
const count = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);

for (const f of files) {
  const r = JSON.parse(readFileSync(f, 'utf8'));
  if (r.schema !== 'vp.playtest-run/1') { out.push(`## ${f}\n\nNot a saved run (schema ${r.schema}).\n`); continue; }
  const [sid, sver] = r.scenario.split('@');
  const def = S.SCENARIOS.find((x) => x.id === sid);
  const G = S.GUIDELINES.find((g) => `${g.id}@${g.version}` === r.guideline) ?? S.GUIDELINES.find((g) => g.id === r.guideline.split('@')[0]);
  out.push(`## ${f}\n`);
  if (!def) { out.push(`Unknown scenario ${sid}.\n`); continue; }
  if (def.version !== sver) out.push(`> Saved with scenario ${sver}; replayed with ${def.version}. A replay is exact only on the same version.\n`);
  const run = S.replay(def, { seed: r.seed, caseDef: S.FREE_CASE, settleSeconds: 20, nudge: r.nudge ?? null, log: r.log, until: r.t });
  const rep = S.scoreRun(G, run);
  all.runs++;
  const ev = run.events;
  out.push(`- **Set-up:** ${r.choice}${r.nudge ? `, nudge ${r.nudge}` : ', no nudge'} · ${r.lang} · ${r.layout} ${r.screen?.w}×${r.screen?.h}${r.screen?.touch ? ' touch' : ''} · ${r.saved}`);
  out.push(`- **Length:** ${clock(r.t)} · collapse at ${rep.onset != null ? clock(rep.onset) : '—'} · first compression ${rep.measures.firstCompression != null ? `${rep.measures.firstCompression.toFixed(1)} s after it` : 'never'} · compressing ${rep.measures.fraction ?? '—'} % · rate ${rep.measures.rate ?? '—'}/min · shocks ${rep.measures.shocks.length}`);
  const met = rep.rules.filter((x) => x.status === 'met').length, applied = rep.rules.filter((x) => x.status !== 'not-applicable').length;
  out.push(`- **Guideline:** ${met}/${applied} rules met. Missed: ${rep.rules.filter((x) => x.status === 'missed').map((x) => { count(all.missed, x.id); return `${x.id}${x.value != null ? ` (${x.value})` : ''}`; }).join(', ') || 'none'}`);
  /* the course of the run, as the events give it */
  const lines = [];
  for (const e of ev) {
    if (e.kind === 'done' || e.kind === 'begin') { if (e.kind === 'done') lines.push(`${clock(e.t)} ${e.by}: ${e.id}`); }
    else if (e.kind === 'assigned' && e.to) lines.push(`${clock(e.t)} task ${e.role} → ${e.to}`);
    else if (e.kind === 'call') lines.push(`${clock(e.t)} ${e.by} calls the team, saying ${e.says.join(', ') || 'nothing specific'}`);
    else if (e.kind === 'shock') lines.push(`${clock(e.t)} shock: ${e.outcome}`);
    else if (e.kind === 'assessed') lines.push(`${clock(e.t)} ${e.by} checks ${e.what}: ${e.rhythm ?? e.breathing ?? e.mouth}${e.pulse != null ? `, pulse ${e.pulse}` : ''}`);
    else if (e.kind === 'hazard') lines.push(`${clock(e.t)} HAZARD ${e.code}`);
    else if (e.kind === 'refibrillation') lines.push(`${clock(e.t)} VF back`);
    else if (e.kind === 'arrive') lines.push(`${clock(e.t)} arrive: ${[...e.people, ...e.equipment].join(', ')}`);
  }
  out.push(`\n<details><summary>What happened (${lines.length})</summary>\n\n${lines.map((l) => `    ${l}`).join('\n')}\n</details>\n`);
  /* the screen: refusals, messages, and long stretches with no tap */
  const trail = r.trail ?? [];
  const refused = trail.filter((x) => x.ui.startsWith('refused:'));
  const msgs = trail.filter((x) => x.ui.startsWith('message:'));
  refused.forEach((x) => count(all.refusals, x.ui.slice(9).trim()));
  msgs.forEach((x) => count(all.messages, x.ui.slice(9).trim()));
  const taps = trail.filter((x) => x.ui.startsWith('tap ')).map((x) => x.t).concat(r.log.map((x) => x.t)).sort((a, b) => a - b);
  const quiet = [];
  for (let i = 1; i < taps.length; i++) if (taps[i] - taps[i - 1] > 10) quiet.push(`${clock(taps[i - 1])}–${clock(taps[i])} (${Math.round(taps[i] - taps[i - 1])} s)`);
  out.push(`- **Refused on screen:** ${refused.length ? refused.map((x) => `${clock(x.t)} ${x.ui.slice(9).trim()}`).join('; ') : 'none'}`);
  out.push(`- **Longest stretches without a tap:** ${quiet.slice(0, 6).join(', ') || 'none over 10 s'}`);
  out.push(`- **Where they went on the screen:** ${[...trail.filter((x) => x.ui.startsWith('tap ')).reduce((m, x) => m.set(x.ui.slice(4).split('=')[0], (m.get(x.ui.slice(4).split('=')[0]) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k} ${n}×`).join(', ')}\n`);
}

const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} (${n})`).join('; ') || 'none';
console.log(`# Playtest: ${all.runs} run${all.runs === 1 ? '' : 's'}\n`);
console.log(`- **Rules missed most:** ${top(all.missed)}`);
console.log(`- **Refused most:** ${top(all.refusals)}`);
console.log(`- **Messages seen most:** ${top(all.messages)}\n`);
console.log(out.join('\n'));
