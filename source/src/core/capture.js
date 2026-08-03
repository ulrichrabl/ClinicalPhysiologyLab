import { toast } from './ui/kit.js';

/* ---------------------------------------------------------------------------
   ECG capture — visual + numeric snapshots for agent/human calibration.

   Why this exists: a raw screen grab of a dark monitor theme is hard to read
   and tells you nothing about *why* the trace looks that way. Captures here
   pair an AI-optimised PNG (paper colours, thick stroke, burned-in labels)
   with a sidecar of model state and per-lead buffer statistics, so a later
   change can be attributed: note + pathology + params → this image.

   Usage:
     Shift+C                          → capture + download files
     window.__captureEcg({ note })    → same, returns payload (for CDP)
     window.__captureEcg({ download:false }) → return only (agent writes disk)

   Save into the repo with:
     node scripts/save-capture.mjs path/to/payload.json
--------------------------------------------------------------------------- */

const LEADS = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
const GRID_ORDER = [['I', 'aVR', 'V1', 'V4'], ['II', 'aVL', 'V2', 'V5'], ['III', 'aVF', 'V3', 'V6']];
const SAMPLE_RATE_HZ = 500;
const GRID_SAMPLES = 1500;
const STRIP_SAMPLES = 2500;

/** @type {{ id: string, createdAt: string } | null} */
let lastCapture = null;

export function installCapture() {
  window.__captureEcg = (opts) => captureEcg(opts || {});
  window.__lastCapture = () => lastCapture;
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'c' || !e.shiftKey) return;
    if (e.target.matches?.('input, select, textarea')) return;
    e.preventDefault();
    captureEcg({ note: prompt('Capture note (what just changed / what looks wrong)?') || '' });
  });
}

/**
 * @param {{ note?: string, label?: string, download?: boolean, goEcg?: boolean }} opts
 */
export function captureEcg(opts = {}) {
  const shell = window.__shell;
  if (!shell) throw new Error('shell not ready');

  const cardio = shell.byId.get('cardio');
  const ecg = cardio?.workspaces?.find((w) => w.id === 'ecg')?.view;
  if (!ecg?.buffers) throw new Error('ECG view not found');

  if (opts.goEcg !== false && shell.activeWorkspace() !== 'cardio.ecg') {
    shell.go('cardio.ecg');
  }
  /* Ensure canvases are painted at current size before we read buffers. */
  ecg.draw?.();

  const note = String(opts.note || '').trim();
  const snap = cardio.snapshot?.() || shell.lastSnap || null;
  const at = new Date();
  const stamp = at.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const pathology = ecg.pathology || snap?.pathology || 'unknown';
  const label = slug(opts.label || pathology);
  const id = `${stamp}_${label}`;

  const leadStats = {};
  for (const l of LEADS) leadStats[l] = summariseLead(ecg.buffers[l] || []);

  const meta = {
    schema: 'cpl.ecg-capture.v1',
    id,
    createdAt: at.toISOString(),
    note,
    label,
    buildId: window.__BUILD_ID || null,
    url: location.href,
    simHost: window.__simHost || null,
    workspace: shell.activeWorkspace(),
    theme: document.documentElement.dataset.theme || 'monitor',
    display: {
      gain: ecg.gain,
      gridSamples: GRID_SAMPLES,
      stripSamples: STRIP_SAMPLES,
      sampleRateHz: SAMPLE_RATE_HZ,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      dpr: window.devicePixelRatio,
    },
    model: {
      pathology,
      pathologyName: ecg.catalog?.find((p) => p.id === pathology)?.name || pathology,
      HR: snap?.HR ?? null,
      HRset: snap?.HRset ?? null,
      qrsAxis: snap?.qrsAxis ?? null,
      PR: snap?.metrics?.PR ?? null,
      QRS: snap?.metrics?.QRS ?? null,
      QT: snap?.metrics?.QT ?? null,
      QTc: snap?.metrics?.QTc ?? null,
      K: snap?.K ?? null,
      avConduction: snap?.avConduction ?? null,
      lbbConduction: snap?.lbbConduction ?? null,
      rbbConduction: snap?.rbbConduction ?? null,
      baroEnabled: snap?.baroEnabled ?? null,
      Emax: snap?.Emax ?? null,
      Rsys: snap?.Rsys ?? snap?.R ?? null,
      bloodVolume: snap?.bloodVolume ?? null,
    },
    haemodynamics: snap ? {
      Psys: snap.Psys, Pdia: snap.Pdia, Pmean: snap.Pmean,
      SV: snap.SV, EF: snap.EF, CO: snap.CO,
      CVP: snap.CVP, Pla: snap.Pla,
    } : null,
    leads: leadStats,
    waveform: {
      II_downsample: downsample(ecg.buffers.II || [], 200),
      II_tail_ms: Math.min((ecg.buffers.II || []).length, GRID_SAMPLES) / SAMPLE_RATE_HZ * 1000,
    },
    verdictHints: autoHints(leadStats, pathology),
  };

  const gridPng = renderCaptureGrid(ecg.buffers, ecg.gain, meta);
  const stripPng = renderCaptureStrip(ecg.buffers, ecg.gain, meta);
  const summaryMd = buildSummary(meta);

  const payload = {
    meta,
    summaryMd,
    images: {
      grid: gridPng,
      strip: stripPng,
    },
    /* Convenience for save-capture.mjs */
    files: {
      'meta.json': JSON.stringify(meta, null, 2),
      'SUMMARY.md': summaryMd,
      'grid.png': gridPng,
      'strip.png': stripPng,
      'ii.spark.txt': sparkline(meta.waveform.II_downsample),
    },
  };

  lastCapture = { id, createdAt: meta.createdAt, note, pathology, payload };
  window.__lastCapturePayload = payload;

  /* Prefer writing into the repo via serve.mjs POST /__capture. Fall back to
     browser downloads when opened as file:// or plain static hosting.
     opts.download: true  → always also download
                   false → never download (memory / server only)
                   undefined → download only if server save fails */
  if (opts.save !== false) {
    postToCaptureServer(payload).then((saved) => {
      if (saved?.ok) {
        toast(`Captured → ${saved.relative || saved.dir}`);
        console.info('[capture]', id, 'saved', saved.relative || saved.dir, note);
        if (opts.download === true) downloadCapture(payload);
        return;
      }
      if (opts.download !== false) {
        downloadCapture(payload);
        toast(`Captured ${id} (downloaded — use serve.command to save into repo)`);
      } else {
        toast(`Captured ${id} (memory only — window.__lastCapturePayload)`);
      }
      console.info('[capture]', id, note);
    });
  } else if (opts.download !== false) {
    downloadCapture(payload);
    toast(`Captured ${id}`);
  }

  return payload;
}

async function postToCaptureServer(payload) {
  if (location.protocol === 'file:') return null;
  try {
    const res = await fetch(new URL('/__capture', location.href).href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ---- lead stats --------------------------------------------------------- */

function summariseLead(buf) {
  const n = buf.length;
  if (!n) return { length: 0, min: 0, max: 0, span: 0, peaks: 0, rms: 0, flat: true };
  const tail = buf.slice(-GRID_SAMPLES);
  let min = Infinity, max = -Infinity, sum2 = 0, peaks = 0;
  for (let i = 0; i < tail.length; i++) {
    const v = tail[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum2 += v * v;
    if (i > 0 && i < tail.length - 1 && v > 0.05 && v > tail[i - 1] && v > tail[i + 1]) peaks++;
  }
  const span = max - min;
  return {
    length: n,
    min: round4(min),
    max: round4(max),
    span: round4(span),
    peaks,
    rms: round4(Math.sqrt(sum2 / tail.length)),
    flat: span < 0.06,
  };
}

function downsample(buf, points) {
  if (!buf.length) return [];
  const slice = buf.slice(-GRID_SAMPLES);
  if (slice.length <= points) return slice.map(round4);
  const out = new Array(points);
  for (let i = 0; i < points; i++) {
    const idx = Math.floor((i / (points - 1)) * (slice.length - 1));
    out[i] = round4(slice[idx]);
  }
  return out;
}

function autoHints(leads, pathology) {
  const hints = [];
  const flats = LEADS.filter((l) => leads[l]?.flat);
  if (flats.length >= 8) hints.push('most leads look flat (span < 0.06 mV) — check synthesis / buffer fill');
  if (leads.V4?.max > 1.5) hints.push('V4 amplitude very high — check precordial gain');
  if ((leads.II?.peaks || 0) < 1) hints.push('no clear peaks in lead II window');
  if ((leads.II?.peaks || 0) > 6) hints.push('many peaks in ~3 s window — possible fragmentation / HR inflation');
  if (leads.aVR && leads.aVR.max > Math.abs(leads.aVR.min) && pathology === 'normal') {
    hints.push('aVR not predominantly negative (unexpected for normal sinus)');
  }
  return hints;
}

/* ---- AI-optimised renders (paper, high contrast, annotated) ------------- */

function renderCaptureGrid(buffers, gain, meta) {
  const W = 1600, H = 980;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const bg = '#F7F1E8', ink = '#1A2330', signal = '#0B5F4B', gridF = '#E2B8B8', gridB = '#D09090';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  /* Header band with the causal context burned into the pixels. */
  ctx.fillStyle = ink;
  ctx.font = '700 22px "IBM Plex Sans", ui-sans-serif, sans-serif';
  ctx.fillText(`ECG capture · ${meta.model.pathologyName}`, 20, 28);
  ctx.font = '500 14px "IBM Plex Sans", ui-sans-serif, sans-serif';
  ctx.fillStyle = '#445566';
  const hdr = [
    meta.id,
    `gain ${gain}`,
    `HR ${meta.model.HR ?? '—'}`,
    `axis ${meta.model.qrsAxis ?? '—'}°`,
    meta.note ? `note: ${meta.note}` : null,
  ].filter(Boolean).join('  ·  ');
  ctx.fillText(hdr.slice(0, 140), 20, 50);

  const top = 64, bottom = 36;
  const areaH = H - top - bottom;
  const cols = 4, rows = 3;
  const cw = W / cols, ch = areaH / rows;

  drawPaperGrid(ctx, 0, top, W, areaH, gridF, gridB, 8);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lead = GRID_ORDER[r][c];
      const x0 = c * cw, y0 = top + r * ch, mid = y0 + ch / 2;
      if (c > 0) {
        ctx.strokeStyle = '#AABBCC'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y0 + 8); ctx.lineTo(x0, y0 + ch - 8); ctx.stroke();
      }
      ctx.fillStyle = ink;
      ctx.font = '700 16px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillText(lead, x0 + 10, y0 + 20);
      const st = meta.leads[lead];
      if (st) {
        ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
        ctx.fillStyle = '#667788';
        ctx.fillText(`span ${st.span}  pk ${st.peaks}`, x0 + 44, y0 + 20);
      }
      const slice = leadSlice(buffers[lead], GRID_SAMPLES);
      if (!slice) continue;
      const amp = (ch / 2 - 18) * Math.min(gain, 2.4);
      strokeTrace(ctx, slice, x0 + 8, mid, cw - 16, amp, signal, 2.2);
    }
  }

  ctx.fillStyle = '#667788';
  ctx.font = '500 12px "IBM Plex Sans", ui-sans-serif, sans-serif';
  ctx.fillText(
    `${SAMPLE_RATE_HZ} Hz · last ${(GRID_SAMPLES / SAMPLE_RATE_HZ).toFixed(1)} s · soft-clipped display gain · build ${meta.buildId || '?'}`,
    20, H - 14,
  );
  if (meta.verdictHints.length) {
    ctx.fillStyle = '#A04030';
    ctx.fillText(meta.verdictHints[0], 20, H - 28);
  }
  return canvas.toDataURL('image/png');
}

function renderCaptureStrip(buffers, gain, meta) {
  const W = 1600, H = 280;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const bg = '#F7F1E8', ink = '#1A2330', signal = '#0B5F4B', gridF = '#E2B8B8', gridB = '#D09090';
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = ink;
  ctx.font = '700 16px "IBM Plex Sans", ui-sans-serif, sans-serif';
  ctx.fillText(`Rhythm strip · II · ${meta.model.pathologyName}`, 16, 24);
  drawPaperGrid(ctx, 0, 36, W, H - 36, gridF, gridB, 8);
  const slice = leadSlice(buffers.II, STRIP_SAMPLES);
  if (slice) {
    const mid = 36 + (H - 36) / 2;
    const amp = ((H - 36) / 2 - 16) * Math.min(gain, 2.4);
    strokeTrace(ctx, slice, 12, mid, W - 24, amp, signal, 2.4);
  }
  return canvas.toDataURL('image/png');
}

function drawPaperGrid(ctx, x, y, w, h, fine, bold, mm) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = fine; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = x; gx <= x + w; gx += mm) { ctx.moveTo(Math.round(gx) + 0.5, y); ctx.lineTo(Math.round(gx) + 0.5, y + h); }
  for (let gy = y; gy <= y + h; gy += mm) { ctx.moveTo(x, Math.round(gy) + 0.5); ctx.lineTo(x + w, Math.round(gy) + 0.5); }
  ctx.stroke();
  ctx.strokeStyle = bold;
  ctx.beginPath();
  for (let gx = x; gx <= x + w; gx += mm * 5) { ctx.moveTo(Math.round(gx) + 0.5, y); ctx.lineTo(Math.round(gx) + 0.5, y + h); }
  for (let gy = y; gy <= y + h; gy += mm * 5) { ctx.moveTo(x, Math.round(gy) + 0.5); ctx.lineTo(x + w, Math.round(gy) + 0.5); }
  ctx.stroke();
  ctx.restore();
}

function leadSlice(buf, maxSamples) {
  if (!buf || buf.length < 4) return null;
  const n = Math.min(buf.length, maxSamples);
  const raw = buf.slice(buf.length - n);
  const edge = Math.max(4, Math.floor(raw.length * 0.06));
  const edges = raw.slice(0, edge).concat(raw.slice(-edge));
  const base = edges.reduce((a, c) => a + c, 0) / edges.length;
  return raw.map((v) => v - base);
}

function strokeTrace(ctx, slice, x0, mid, width, amp, color, lineWidth) {
  const n = slice.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = x0 + (i / (n - 1)) * width;
    const y = mid - slice[i] * amp;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.stroke();
}

/* ---- packaging ---------------------------------------------------------- */

function buildSummary(meta) {
  const L = meta.leads;
  const lines = [
    `# ECG capture \`${meta.id}\``,
    '',
    `- **When:** ${meta.createdAt}`,
    `- **Pathology:** ${meta.model.pathologyName} (\`${meta.model.pathology}\`)`,
    `- **Note:** ${meta.note || '_(none)_'}`,
    `- **HR / axis / gain:** ${meta.model.HR ?? '—'} bpm · ${meta.model.qrsAxis ?? '—'}° · gain ${meta.display.gain}`,
    `- **Build / host:** ${meta.buildId || '?'} · ${meta.simHost || '?'}`,
    '',
    '## Lead spans (mV, last ~3 s)',
    '',
    '| Lead | min | max | span | peaks | flat? |',
    '|------|-----|-----|------|-------|-------|',
    ...LEADS.map((l) => {
      const s = L[l];
      return `| ${l} | ${s.min} | ${s.max} | ${s.span} | ${s.peaks} | ${s.flat ? 'yes' : ''} |`;
    }),
    '',
    '## Auto hints',
    '',
    ...(meta.verdictHints.length ? meta.verdictHints.map((h) => `- ${h}`) : ['- _(none)_']),
    '',
    '## Files',
    '',
    '- `grid.png` — AI-optimised 12-lead (paper, annotated)',
    '- `strip.png` — AI-optimised lead II strip',
    '- `meta.json` — full structured state',
    '- `ii.spark.txt` — ASCII sparkline of downsampled II',
    '',
  ];
  return lines.join('\n');
}

function downloadCapture(payload) {
  const { id, files } = { id: payload.meta.id, files: payload.files };
  /* One JSON blob is the agent-friendly primary artifact; PNGs download too
     so a human can glance without unpacking. */
  downloadText(`${id}.capture.json`, JSON.stringify(payload));
  downloadDataUrl(`${id}_grid.png`, files['grid.png']);
  downloadDataUrl(`${id}_strip.png`, files['strip.png']);
  downloadText(`${id}_SUMMARY.md`, files['SUMMARY.md']);
}

function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  clickDownload(name, url);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function downloadDataUrl(name, dataUrl) {
  clickDownload(name, dataUrl);
}

function clickDownload(name, href) {
  const a = document.createElement('a');
  a.href = href; a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function sparkline(vals) {
  if (!vals.length) return '(empty)';
  const chars = '▁▂▃▄▅▆▇█';
  let min = Infinity, max = -Infinity;
  for (const v of vals) { if (v < min) min = v; if (v > max) max = v; }
  const span = max - min || 1;
  return vals.map((v) => chars[Math.max(0, Math.min(7, Math.floor(((v - min) / span) * 7)))]).join('');
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'capture';
}

function round4(n) { return Math.round(n * 10000) / 10000; }
