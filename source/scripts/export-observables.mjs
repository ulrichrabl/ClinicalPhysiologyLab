/* Write source/knowledge/observables.json: the observables the models produce, read-only for editors (ADR-016).
   Run after changing a property in src/vp/data/properties.ts; the virtual-patient tests fail while it is stale. */
import * as esbuild from '../node_modules/esbuild/lib/main.js';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const bundle = join(tmpdir(), `observables-${Date.now()}.mjs`);
await esbuild.build({ entryPoints: ['scripts/_vp_entry.ts'], bundle: true, outfile: bundle, format: 'esm', target: 'es2022', platform: 'node',
  loader: { '.ts': 'ts', '.js': 'js', '.json': 'json' }, logLevel: 'error' });
const { CATALOG, exportObservables } = await import(pathToFileURL(bundle).href);
unlinkSync(bundle);
writeFileSync('knowledge/observables.json', exportObservables(CATALOG));
console.log(`knowledge/observables.json: ${Object.keys(CATALOG.properties).length} observables`);
