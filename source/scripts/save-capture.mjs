#!/usr/bin/env node
/* Unpack a browser ECG capture payload into captures/ecg/<id>/.

   From the browser (or CDP):
     const p = __captureEcg({ note: 'after kernel tweak', download: false });
     copy(JSON.stringify(p))  // or write via agent

   Then:
     node scripts/save-capture.mjs /path/to/payload.capture.json
     # or pipe:
     pbpaste | node scripts/save-capture.mjs -

   Output:
     ../captures/ecg/<id>/
       meta.json  SUMMARY.md  grid.png  strip.png  ii.spark.txt  payload.json
*/
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outRoot = join(root, 'captures', 'ecg');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/save-capture.mjs <payload.json|->');
  process.exit(1);
}

const raw = arg === '-' ? readFileSync(0, 'utf8') : readFileSync(arg, 'utf8');
const payload = JSON.parse(raw);
if (!payload?.meta?.id || !payload?.files) {
  console.error('Not a cpl.ecg-capture payload (need meta.id and files)');
  process.exit(1);
}

const dir = join(outRoot, payload.meta.id);
mkdirSync(dir, { recursive: true });

for (const [name, content] of Object.entries(payload.files)) {
  const path = join(dir, name);
  if (typeof content === 'string' && content.startsWith('data:image/')) {
    const b64 = content.split(',')[1] || '';
    writeFileSync(path, Buffer.from(b64, 'base64'));
  } else {
    writeFileSync(path, content);
  }
}
writeFileSync(join(dir, 'payload.json'), JSON.stringify(payload.meta, null, 2));
/* Keep a slim index of recent captures for grepping. */
const indexLine = [
  payload.meta.createdAt,
  payload.meta.id,
  payload.meta.model?.pathology || '?',
  (payload.meta.note || '').replace(/\s+/g, ' ').slice(0, 80),
].join('\t');
writeFileSync(join(outRoot, 'INDEX.tsv'), indexLine + '\n', { flag: 'a' });

console.log(dir);
console.log(`note: ${payload.meta.note || '(none)'}`);
console.log(`pathology: ${payload.meta.model?.pathologyName}`);
if (payload.meta.verdictHints?.length) {
  for (const h of payload.meta.verdictHints) console.log(`hint: ${h}`);
}
