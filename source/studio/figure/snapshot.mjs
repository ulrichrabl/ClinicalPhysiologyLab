/* Writes patients.json: every case's patient with the body findings the running model gives at the start of the case
   (oedema, ascites, colour, jaundice, pallor, sweating, distress, breathing). The bench reads this file, so the figure
   loop never runs the physiology. Rerun when cases or the model change (about half a minute):
     node studio/figure/snapshot.mjs */
import * as esbuild from '../../node_modules/esbuild/lib/main.js';
import { writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(tmpdir(), `figure-snapshot-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: [join(here, '../../scripts/_vp_entry.ts')], bundle: true, outfile: out, format: 'esm', platform: 'node', loader: { '.ts': 'ts', '.json': 'json' }, logLevel: 'error' });
const { CATALOG, REGISTRY, CASES, buildView, observe, settleModel, modelFromCase, chemistryState } = await import(pathToFileURL(out).href);
unlinkSync(out);

const patients = CASES.map((c) => {
  const m = modelFromCase(c); const snap = settleModel(m, 16).snapshot;
  const view = buildView(c, { circulation: snap, chemistry: chemistryState(snap, m.chemistry) });
  const o = (ref) => { try { return observe(CATALOG, REGISTRY.resolvers, c, view, ref, {}).value; } catch { return undefined; } };
  const g = o('general.appearance'), b = o('breathing.pattern');
  const findings = {
    oedema: o('legs.oedema')?.extent, ascites: o('abdomen.ascites')?.ascites, colour: g?.colour, sweating: g?.sweating, distress: g?.distress,
    icterus: o('eyes.sclera')?.icterus, pallor: o('eyes.conjunctiva')?.pallor,
    breathing: b ? { hyperinflated: !!b.hyperinflated, accessory: !!b.accessory, pursedLips: !!b.pursedLips } : undefined,
  };
  const { name, age, sex, heightCm, weightKg, appearance } = c.patient;
  return { id: c.id, label: name, patient: { age, sex, heightCm, weightKg, appearance }, findings };
});
writeFileSync(join(here, 'patients.json'), JSON.stringify(patients, null, 1) + '\n');
console.log(`patients.json: ${patients.length} case patients with their body findings`);
