import { fit, palette, label, sans, withAlpha } from '../../../core/ui/draw.js';
import { NODES, PATHWAYS, LEVEL_DEPTH, LEVEL_ORDER, LEVEL_LABEL, MODALITY_GROUP } from '../data/anatomy.js';

/* ---------------------------------------------------------------------------
   The anatomy graph.

   Rostro-caudal on the vertical axis, left-right on the horizontal, the way
   every neuroanatomy atlas is drawn — cortex at the top, peripheral nerve at
   the bottom, midline down the middle. Decussations are drawn as diamonds
   straddling the midline, because that is the one piece of geometry the whole
   subject hinges on.

   Click a node to lesion it. Every pathway through it lights up, and the
   segment distal to the lesion is drawn broken, so you can see the interruption
   rather than being told about it.
--------------------------------------------------------------------------- */

const GROUP_COLOR = {
  motor: 'aortic', cranial: 'lv', sensory: 'volume', visual: 'la',
  cerebellar: 'ecg', autonomic: 'flow', language: 'rose', other: 'muted',
};

export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'motor', label: 'Motor' },
  { id: 'sensory', label: 'Sensory' },
  { id: 'cranial', label: 'Cranial' },
  { id: 'visual', label: 'Visual' },
  { id: 'cerebellar', label: 'Cerebellar' },
  { id: 'autonomic', label: 'Autonomic' },
];

/* Which modality groups pass through each node. */
const NODE_GROUPS = {};
for (const pw of PATHWAYS) {
  const g = MODALITY_GROUP[pw.modality] || 'other';
  for (const id of pw.nodes) (NODE_GROUPS[id] ??= new Set()).add(g);
}

/* Pathways indexed by node, so hit-testing does not rescan 138 chains. */
const NODE_PATHWAYS = {};
for (const pw of PATHWAYS) for (const id of pw.nodes) (NODE_PATHWAYS[id] ??= []).push(pw);

export class AnatomyGraph {
  constructor(canvas, { onSelect } = {}) {
    this.canvas = canvas;
    this.onSelect = onSelect || (() => {});
    this.filter = 'all';
    this.lesion = null;         // node id
    this.lesionSet = new Set(); // for compound (syndrome) lesions
    this.hover = null;
    this.layout = null;
    this.layoutKey = '';

    canvas.addEventListener('pointermove', (e) => {
      const hit = this.hitTest(e);
      if (hit !== this.hover) { this.hover = hit; this.canvas.style.cursor = hit ? 'pointer' : 'default'; this.draw(); }
    });
    canvas.addEventListener('pointerleave', () => { this.hover = null; this.draw(); });
    canvas.addEventListener('click', (e) => {
      const hit = this.hitTest(e);
      if (hit) this.select(hit);
    });
  }

  select(id) {
    this.lesion = id;
    this.lesionSet = new Set([id]);
    this.onSelect(id, [id]);
    this.draw();
  }

  setCompound(ids, primaryLabel) {
    this.lesion = ids[0] || null;
    this.lesionSet = new Set(ids);
    this.compoundLabel = primaryLabel || null;
    this.onSelect(this.lesion, ids);
    this.draw();
  }

  setFilter(f) { this.filter = f; this.draw(); }

  visible(id) {
    if (this.filter === 'all') return true;
    const gs = NODE_GROUPS[id];
    return gs ? gs.has(this.filter) : false;
  }

  /* --- layout ------------------------------------------------------------ */
  computeLayout(w, h) {
    const key = `${w}x${h}:${this.filter}`;
    if (this.layoutKey === key && this.layout) return this.layout;

    const padT = 18, padB = 14, gutter = 96;
    const usableH = h - padT - padB;
    const levels = LEVEL_ORDER.filter((lv) => Object.values(NODES).some((n) => n.level === lv));
    levels.sort((a, b) => LEVEL_DEPTH[a] - LEVEL_DEPTH[b]);

    /* Band placement blends two things. Pure anatomical depth is faithful but
       piles eight levels into the top fifth of the canvas, where nothing can be
       labelled. Pure even spacing is legible but loses the sense that the
       midbrain and pons are neighbours. A mix keeps the ordering and the rough
       proportions while guaranteeing every band is readable. */
    const DEPTH_WEIGHT = 0.42;
    const span = h - padB - padT;
    const centres = {};
    levels.forEach((lv, i) => {
      const even = levels.length > 1 ? i / (levels.length - 1) : 0.5;
      const f = DEPTH_WEIGHT * LEVEL_DEPTH[lv] + (1 - DEPTH_WEIGHT) * even;
      centres[lv] = padT + f * span;
    });

    const pos = {};
    const bands = [];
    const midX = gutter + (w - gutter) * 0.5;

    for (const lv of levels) {
      const cy = centres[lv];
      const inLevel = Object.values(NODES).filter((n) => n.level === lv && this.visible(n.id));
      bands.push({ level: lv, y: cy, count: inLevel.length });
      if (!inLevel.length) continue;

      for (const side of ['L', 'B', 'R']) {
        const group = inLevel.filter((n) => n.side === side);
        if (!group.length) continue;
        group.sort((a, b) => a.name.localeCompare(b.name));

        let x0, x1;
        if (side === 'L') { x0 = gutter + 10; x1 = midX - 26; }
        else if (side === 'R') { x0 = midX + 26; x1 = w - 12; }
        else { x0 = midX - 20; x1 = midX + 20; }

        const span = Math.max(24, x1 - x0);
        const perRow = Math.max(1, Math.min(group.length, Math.floor(span / 15)));
        const rows = Math.ceil(group.length / perRow);
        group.forEach((n, i) => {
          const r = Math.floor(i / perRow);
          const c = i % perRow;
          const inRow = Math.min(perRow, group.length - r * perRow);
          const step = inRow > 1 ? span / (inRow - 1 + 0.0001) : 0;
          const x = inRow > 1 ? x0 + c * step : (x0 + x1) / 2;
          const y = cy + (r - (rows - 1) / 2) * 11;
          pos[n.id] = { x, y, node: n };
        });
      }
    }

    this.layout = { pos, bands, midX, gutter, w, h };
    this.layoutKey = key;
    return this.layout;
  }

  hitTest(e) {
    if (!this.layout) return null;
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bestD = 100;
    for (const [id, p] of Object.entries(this.layout.pos)) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  }

  invalidate() { this.layoutKey = ''; }

  /* --- render ------------------------------------------------------------ */
  draw() {
    const g = fit(this.canvas);
    if (!g) return;
    const { ctx, w, h } = g;
    const p = palette();
    const L = this.computeLayout(w, h);

    // midline
    ctx.strokeStyle = p.hairline2; ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    ctx.beginPath(); ctx.moveTo(L.midX, 8); ctx.lineTo(L.midX, h - 8); ctx.stroke();
    ctx.setLineDash([]);
    label(ctx, 'LEFT', L.gutter + 12, 12, p.muted, 8, 'left', '700');
    label(ctx, 'RIGHT', w - 12, 12, p.muted, 8, 'right', '700');

    // level gutter — skip a label rather than overprint the one above it
    let lastLabelY = -100;
    for (const b of L.bands) {
      if (!b.count) continue;
      ctx.strokeStyle = p.hairline2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L.gutter - 4, b.y); ctx.lineTo(w - 8, b.y); ctx.stroke();
      if (b.y - lastLabelY >= 13) {
        label(ctx, LEVEL_LABEL[b.level] || b.level, L.gutter - 12, b.y, p.muted, 9, 'right', '600');
        lastLabelY = b.y;
      }
    }

    // active pathways through the lesion
    const active = [];
    if (this.lesionSet.size) {
      const seen = new Set();
      for (const id of this.lesionSet) {
        for (const pw of NODE_PATHWAYS[id] || []) {
          if (seen.has(pw.id)) continue;
          seen.add(pw.id);
          active.push({ pw, cut: pw.nodes.findIndex((n) => this.lesionSet.has(n)) });
        }
      }
    }

    // draw pathway polylines: intact proximal segment solid, distal broken
    for (const { pw, cut } of active) {
      const grp = MODALITY_GROUP[pw.modality] || 'other';
      const col = p[GROUP_COLOR[grp]] || p.muted;
      const pts = pw.nodes.map((id) => L.pos[id]).filter(Boolean);
      if (pts.length < 2) continue;

      ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
      // proximal
      ctx.strokeStyle = withAlpha(col, 0.5);
      ctx.setLineDash([]);
      ctx.beginPath();
      let started = false;
      pw.nodes.forEach((id, i) => {
        const q = L.pos[id]; if (!q) return;
        if (i > cut) return;
        if (!started) { ctx.moveTo(q.x, q.y); started = true; } else ctx.lineTo(q.x, q.y);
      });
      ctx.stroke();
      // distal — interrupted
      ctx.strokeStyle = withAlpha(col, 0.2);
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      started = false;
      pw.nodes.forEach((id, i) => {
        const q = L.pos[id]; if (!q) return;
        if (i < cut) return;
        if (!started) { ctx.moveTo(q.x, q.y); started = true; } else ctx.lineTo(q.x, q.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // nodes
    const affected = new Set();
    for (const { pw, cut } of active) for (let i = cut + 1; i < pw.nodes.length; i++) affected.add(pw.nodes[i]);

    for (const [id, q] of Object.entries(L.pos)) {
      const n = q.node;
      const isLesion = this.lesionSet.has(id);
      const isHover = this.hover === id;
      const groups = NODE_GROUPS[id];
      const grp = groups ? [...groups][0] : 'other';
      const col = p[GROUP_COLOR[grp]] || p.muted;
      const r = isLesion ? 5.2 : isHover ? 4.4 : n.isDecussation ? 3.6 : 3;

      ctx.beginPath();
      if (n.isDecussation) {
        ctx.moveTo(q.x, q.y - r); ctx.lineTo(q.x + r, q.y);
        ctx.lineTo(q.x, q.y + r); ctx.lineTo(q.x - r, q.y); ctx.closePath();
      } else {
        ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
      }

      if (isLesion) {
        ctx.fillStyle = p.bad; ctx.fill();
        ctx.strokeStyle = withAlpha(p.bad, 0.35); ctx.lineWidth = 6; ctx.stroke();
      } else if (affected.has(id)) {
        ctx.fillStyle = withAlpha(col, 0.75); ctx.fill();
      } else {
        ctx.fillStyle = withAlpha(col, isHover ? 0.9 : 0.32); ctx.fill();
        if (isHover) { ctx.strokeStyle = withAlpha(col, 0.5); ctx.lineWidth = 3; ctx.stroke(); }
      }
    }

    // hover / lesion caption
    const capId = this.hover || this.lesion;
    if (capId && L.pos[capId]) {
      const n = NODES[capId];
      const q = L.pos[capId];
      const txt = n.name + (n.isDecussation ? '  ·  decussation' : '');
      ctx.font = `600 10px var(--sans, sans-serif)`;
      const tw = ctx.measureText(txt).width + 14;
      let bx = Math.min(w - tw - 6, Math.max(6, q.x - tw / 2));
      let by = q.y - 22;
      if (by < 6) by = q.y + 10;
      ctx.fillStyle = withAlpha(p.panel3, 0.96);
      ctx.strokeStyle = p.hairline; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, tw, 17, 5) : ctx.rect(bx, by, tw, 17);
      ctx.fill(); ctx.stroke();
      label(ctx, txt, bx + 7, by + 8.5, p.text, 10, 'left', '600');
    }

    // legend
    const legend = [['motor', 'Motor'], ['sensory', 'Sensory'], ['cranial', 'Cranial'],
      ['visual', 'Visual'], ['cerebellar', 'Cerebellar'], ['autonomic', 'Autonomic']];
    let lx = L.gutter + 10;
    const ly = h - 5;
    for (const [g2, name] of legend) {
      const col = p[GROUP_COLOR[g2]];
      ctx.beginPath(); ctx.arc(lx, ly - 3, 3, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(col, 0.8); ctx.fill();
      label(ctx, name, lx + 6, ly - 3, p.muted, 8.5, 'left', '500');
      ctx.font = '500 8.5px sans-serif';
      lx += 12 + ctx.measureText(name).width;
    }
  }
}

export { NODE_PATHWAYS };
