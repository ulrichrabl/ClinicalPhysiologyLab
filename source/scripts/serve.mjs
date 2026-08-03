#!/usr/bin/env node
/* Local lab server: static dist/ + POST /__capture → ../captures/ecg/<id>/.

   The capture endpoint is what closes the agent loop: the page posts a
   payload, files land in the repo, and the agent can Read grid.png + meta.json
   without fishing through Downloads.
*/
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../dist');
const captureRoot = resolve(here, '../../captures/ecg');
const portStart = Number(process.env.PORT || 8000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
};

function savePayload(payload) {
  if (!payload?.meta?.id || !payload?.files) {
    throw new Error('need meta.id and files');
  }
  const dir = join(captureRoot, payload.meta.id);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(payload.files)) {
    const path = join(dir, name);
    if (typeof content === 'string' && content.startsWith('data:image/')) {
      writeFileSync(path, Buffer.from(content.split(',')[1] || '', 'base64'));
    } else {
      writeFileSync(path, content);
    }
  }
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(payload.meta, null, 2));
  const indexLine = [
    payload.meta.createdAt,
    payload.meta.id,
    payload.meta.model?.pathology || '?',
    (payload.meta.note || '').replace(/\s+/g, ' ').slice(0, 120),
  ].join('\t');
  writeFileSync(join(captureRoot, 'INDEX.tsv'), indexLine + '\n', { flag: 'a' });
  return dir;
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolveBody(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const file = join(dist, urlPath.replace(/^\//, ''));
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(readFileSync(file));
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'POST' && new URL(req.url, 'http://local').pathname === '/__capture') {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body.toString('utf8'));
      const dir = savePayload(payload);
      const rel = dir.replace(resolve(here, '../..') + '/', '');
      console.log(`[capture] ${payload.meta.id} → ${rel}`);
      if (payload.meta.note) console.log(`[capture] note: ${payload.meta.note}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, dir, id: payload.meta.id, relative: rel }));
    } catch (e) {
      console.error('[capture] failed', e);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
    return;
  }

  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(405); res.end('method not allowed');
}

function listen(port) {
  const server = createServer(handler);
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') listen(port + 1);
    else throw e;
  });
  server.listen(port, () => {
    const url = `http://localhost:${port}/?build=${Date.now()}`;
    console.log(`Clinical Physiology Lab  →  ${url}`);
    console.log(`Capture POST             →  http://localhost:${port}/__capture`);
    console.log(`Capture folder           →  ${captureRoot}`);
    console.log('Close this window to stop the server.');
    if (process.env.OPEN_BROWSER !== '0') {
      setTimeout(() => exec(`open "${url}"`), 400);
    }
  });
}

mkdirSync(captureRoot, { recursive: true });
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html missing — run: node scripts/build.mjs');
  process.exit(1);
}
listen(portStart);
