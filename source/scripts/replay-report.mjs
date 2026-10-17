/* Replay a problem report (src/vp/app/report.ts) in the test harness.

     node scripts/replay-report.mjs path/to/report-….json

   Prints what was reported and where, then rebuilds the patient from the report's model, replays the learner's steps
   (questions, tests, orders, at the times they were done) and compares every finding with the one the learner saw.
   The app runs the circulation live, beat to beat, and the replay settles it, so vital signs may differ by a beat or
   a breath. Anything else that differs is worth a look. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/replay-report.mjs report.json'); process.exit(2); }
const r = JSON.parse(readFileSync(file, 'utf8'));
if (r.schema !== 'vp.report/1') { console.error(`not a report (schema ${r.schema})`); process.exit(2); }

const bundle = join(tmpdir(), `replay-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_vp_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node',
  loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const vp = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);
const { CATALOG, REGISTRY, CASES, FREE_CASE, buildView, startEncounter, perform, order, ask, settleModel, chemistryState, modelFromCase, caseWithModel } = vp;

const app = r.app;
const line = (k, v) => console.log(`${k.padEnd(12)}${v}`);
console.log(`Report ${r.id}\n`);
line('comment', r.comment.replace(/\n/g, '\n            '));
line('kind', r.category + (r.reporter ? ` · by ${r.reporter}` : ''));
line('pointed at', r.target ? `${r.target.path}${r.target.context ? ` in "${r.target.context}"` : ''}\n            "${r.target.text.slice(0, 160)}"` : 'the whole page');
line('screen', `${app.screen} · layer ${app.layer} · tab ${app.tab} · ${app.lang} · ${app.simMinutes} min`);
line('build', r.env?.build?.commit ? `${r.env.build.commit.slice(0, 7)} (${r.env.build.builtAt})` : 'unknown');
if (r.errors?.length) line('errors', r.errors.map((e) => e.message).join('\n            '));
if (r.images?.length) line('pictures', r.images.map((i) => i.what).join(', ') + '  (data URLs in the file)');

if (!app.caseId || app.caseId === 'none') { console.log('\nNo case was open: nothing to replay.'); process.exit(0); }
const known = CASES.find((c) => c.id === app.caseId);
const caseDef = app.free ? caseWithModel(FREE_CASE, app.model) : known;
if (!caseDef) { console.log(`\nCase ${app.caseId} is not in this build: cannot replay.`); process.exit(1); }
if (!app.free && app.caseVersion && known.version !== app.caseVersion) console.log(`\nNote: the report was made on case version ${app.caseVersion}; this build has ${known.version}.`);

/* The patient rebuilt from the report's model and settled. The report also carries the circulation's values at the
   moment of reporting (app.snapshot), for reading; mixing them into a settled run would give a state that never existed. */
const model = app.model ?? modelFromCase(caseDef);
const snap = settleModel(model, 16).snapshot;
const view = buildView(caseDef, { circulation: snap, chemistry: chemistryState(snap, model.chemistry) });
const s = startEncounter(CATALOG, REGISTRY, caseDef, view, { locale: app.lang });

const events = app.events ?? [];
const at = (t) => { if (typeof t === 'number' && t > s.t) s.t = t; };
let steps = 0;
for (const e of events) {
  try {
    if (e.kind === 'utterance' && e.from === 'learner') { at(e.t); ask(s, e.text, e.locale); steps++; }
    else if (e.kind === 'action') { at(e.t); perform(s, e.manoeuvre, e.side); steps++; }
    else if (e.kind === 'order') { at(e.t); order(s, e.test); steps++; }
  } catch (err) { console.log(`  could not replay ${e.kind} ${e.manoeuvre ?? e.test ?? e.text}: ${err.message}`); }
}

/* Findings in order, matched by the test that produced them and the property. */
const findings = (evs) => evs.filter((e) => e.kind === 'finding').map((e) => ({ key: `${e.byManoeuvre} → ${e.finding.property}`, value: JSON.stringify(e.finding.value) }));
const seen = findings(events), again = findings(s.encounter.events);
console.log(`\nReplayed ${steps} steps: ${seen.length} findings in the report, ${again.length} now.\n`);
const pool = [...again];
let same = 0;
for (const f of seen) {
  const i = pool.findIndex((x) => x.key === f.key);
  if (i < 0) { console.log(`  missing now  ${f.key}\n               was ${f.value}`); continue; }
  const [g] = pool.splice(i, 1);
  if (g.value === f.value) same++;
  else console.log(`  differs      ${f.key}\n               was ${f.value}\n               now ${g.value}`);
}
for (const g of pool) console.log(`  new now      ${g.key}\n               ${g.value}`);
console.log(`\n${same} of ${seen.length} findings are the same.`);
