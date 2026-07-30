import { el, clear, card, toast } from '../../../core/ui/kit.js';
import { fit, palette, label, sans, withAlpha, roundRect } from '../../../core/ui/draw.js';
import { BODY_REGIONS, BLIND_CASES } from '../data/exam.js';
import { findingsForNodes, sparedForNodes, SYNDROMES } from '../model/localize.js';
import { NODES } from '../data/anatomy.js';
import { guard } from '../../../core/diagnostics.js';

/* ---------------------------------------------------------------------------
   Examination.

   The Localise workspace hands you the findings. This one makes you go and get
   them, which is the actual skill. You click a part of the body, choose a
   bedside test, and are told what you find — including, importantly, when what
   you find is nothing.

   Blind mode hides the lesion. You examine, commit to a location, and only then
   see whether the pattern you built matches the one the model was holding. The
   examination log is kept so you can look back at what you did and did not
   bother to test — the misses are usually more instructive than the hits.
--------------------------------------------------------------------------- */
export class ExamView {
  constructor({ applyLesion }) {
    this.applyLesion = applyLesion;
    this.findings = [];
    this.lesionLabel = '';
    this.blind = false;
    this.blindCase = null;
    this.answered = false;
    this.done = new Map();      // testId -> { abnormal, text, region }
    this.selected = null;
    this.hover = null;
    this.score = { right: 0, total: 0 };

    this.canvas = el('canvas', { style: { width: '100%', height: '560px', display: 'block' } });
    this.canvas.addEventListener('pointermove', (e) => {
      const h = this.hit(e);
      if (h !== this.hover) { this.hover = h; this.canvas.style.cursor = h ? 'pointer' : 'default'; this.draw(); }
    });
    this.canvas.addEventListener('click', (e) => {
      const h = this.hit(e);
      if (h) { this.selected = h; this.renderTests(); this.draw(); }
    });

    this.testsNode = el('div', { class: 'tests' });
    this.logNode = el('div', { class: 'exam-log' });
    this.headNode = el('div', { class: 'exam-head' });
    this.answerNode = el('div', { class: 'exam-answer' });

    this.modeChips = el('div', { class: 'chips' },
      ...[['Open book', false], ['Blind case', true]].map(([lbl, v]) => el('button', {
        class: 'chip' + (v === this.blind ? ' on' : ''),
        onclick: (e) => {
          for (const b of this.modeChips.children) b.classList.remove('on');
          e.currentTarget.classList.add('on');
          this.blind = v;
          if (v) this.newBlindCase(); else this.clearBlind();
        },
      }, lbl)));

    this.node = el('div', { class: 'split exam-split' },
      el('div', { class: 'stack' },
        card('The patient',
          'Drawn from the front, so the patient\'s left is on your right — the same way round as at the bedside.',
          el('div', { class: 'toolbar' },
            this.modeChips,
            el('div', { class: 'rail-spacer' }),
            el('button', { class: 'btn ghost sm', onclick: () => this.resetExam() }, 'Clear findings')),
          this.headNode,
          this.canvas)),
      el('div', { class: 'stack' },
        card('Examine', 'Pick a region on the figure, then a test.', this.testsNode),
        card('Examination log', 'Everything you have tested, in order.', this.logNode),
        this.answerCard()),
    );

    this.renderTests();
    this.renderLog();
  }

  answerCard() {
    this.answerCardNode = card('Localise', 'Available once you are examining a blind case.', this.answerNode);
    return this.answerCardNode;
  }

  /* ---- lesion plumbing --------------------------------------------------- */
  setLesion(nodes, labelText, complete = true) {
    this.findings = findingsForNodes(nodes, complete);
    this.spared = sparedForNodes(nodes, complete);
    this.lesionLabel = labelText;
    this.done.clear();
    this.renderHead();
    this.renderLog();
    this.renderTests();
    guard('neuro.exam', () => this.draw());
  }

  clearBlind() {
    this.blindCase = null; this.answered = false;
    this.setLesion([], 'No lesion placed');
    clear(this.answerNode);
    this.answerNode.append(el('p', { class: 'hint' },
      'Switch to a blind case to be given a hidden lesion to work out. In open-book mode, '
      + 'place a lesion in the Localise workspace and examine it here.'));
  }

  newBlindCase() {
    const pool = BLIND_CASES.filter((c) => c.id !== this.blindCase?.id);
    const c = pool[Math.floor(Math.random() * pool.length)];
    this.blindCase = c;
    this.answered = false;

    let nodes;
    if (c.lesion.syndrome) {
      const syn = SYNDROMES.find((s) => s.id === c.lesion.syndrome);
      nodes = syn.nodes(c.lesion.side || 'L');
    } else nodes = c.lesion.nodes;

    this.setLesion(nodes, null);
    this.renderAnswer();
    toast('New case — examine, then localise');
  }

  /* Mirror the lesion into the rest of the domain once the case is answered. */
  revealToDomain() {
    if (this.blindCase) this.applyLesion?.(this.blindCase.lesion);
  }

  resetExam() { this.done.clear(); this.renderLog(); this.renderTests(); this.draw(); }

  /* ---- running a test ---------------------------------------------------- */
  runTest(region, t) {
    if (this.done.has(t.id)) return;
    const hits = this.findings.filter((f) => { try { return t.match(f); } catch { return false; } });
    const abnormal = hits.length > 0;
    /* A structure inside the lesion that still works is worth saying out loud —
       it is usually the discriminating finding, not an absence of one. */
    const sparedHit = !abnormal && (this.spared || []).find((f) => {
      try { return t.match(f); } catch { return false; }
    });
    const text = abnormal
      ? [...new Set(hits.map((f) => f.deficit))].join(' ')
      : sparedHit
        ? `${t.normal}  This is spared even though the lesion involves its pathway — ${sparedHit.reason}.`
        : t.normal;
    const umn = hits.find((f) => f.umnOrLmn === 'UMN') ? 'UMN'
      : hits.find((f) => f.umnOrLmn === 'LMN') ? 'LMN' : null;
    this.done.set(t.id, { abnormal, text, region: region.id, label: t.label,
      regionLabel: region.label, umn, hint: t.hint, spared: !!sparedHit });
    this.renderTests();
    this.renderLog();
    this.draw();
  }

  /* ---- rendering --------------------------------------------------------- */
  renderHead() {
    clear(this.headNode);
    if (this.blind && this.blindCase) {
      const n = this.done.size;
      this.headNode.append(
        el('div', { class: 'exam-badge blind' }, 'Blind case'),
        el('span', { class: 'exam-meta' },
          `${n} test${n === 1 ? '' : 's'} performed`,
          this.score.total ? `  ·  ${this.score.right}/${this.score.total} correct` : ''));
    } else {
      this.headNode.append(
        el('div', { class: 'exam-badge' }, 'Open book'),
        el('span', { class: 'exam-meta' }, this.lesionLabel || 'No lesion placed'));
    }
  }

  renderTests() {
    clear(this.testsNode);
    if (!this.selected) {
      this.testsNode.append(el('p', { class: 'empty' },
        'Click a region of the body to see the tests available there.'));
      return;
    }
    const r = this.selected;
    this.testsNode.append(el('div', { class: 'sec-head' }, r.label));
    for (const t of r.tests) {
      const res = this.done.get(t.id);
      const btn = el('button', {
        class: 'exam-test' + (res ? (res.abnormal ? ' abnormal' : ' normal') : ''),
        onclick: () => this.runTest(r, t),
      },
        el('span', { class: 'et-l' }, t.label),
        res
          ? el('span', { class: `et-flag ${res.abnormal ? 'bad' : res.spared ? 'spared' : 'ok'}` },
              res.abnormal ? (res.umn || 'abnormal') : res.spared ? 'spared' : 'normal')
          : el('span', { class: 'et-go' }, 'test'));
      this.testsNode.append(btn);
      if (res) {
        this.testsNode.append(el('div', { class: 'et-res' }, res.text));
        if (res.hint) this.testsNode.append(el('div', { class: 'et-hint' }, res.hint));
      }
    }
  }

  renderLog() {
    clear(this.logNode);
    if (!this.done.size) {
      this.logNode.append(el('p', { class: 'empty' }, 'Nothing examined yet.'));
      return;
    }
    const abnormal = [...this.done.values()].filter((r) => r.abnormal);
    this.logNode.append(el('div', { class: 'log-sum' },
      el('span', {}, `${this.done.size} tested`),
      el('span', { class: abnormal.length ? 'bad' : 'ok' }, `${abnormal.length} abnormal`)));
    for (const r of this.done.values()) {
      this.logNode.append(el('div', { class: `log-row ${r.abnormal ? 'bad' : ''}` },
        el('span', { class: 'lg-r' }, r.regionLabel),
        el('span', { class: 'lg-t' }, r.label),
        el('span', { class: `lg-f ${r.abnormal ? 'bad' : 'ok'}` },
          r.abnormal ? (r.umn ? `abnormal · ${r.umn}` : 'abnormal') : 'normal')));
    }
  }

  renderAnswer() {
    clear(this.answerNode);
    if (!this.blind || !this.blindCase) {
      this.answerNode.append(el('p', { class: 'hint' },
        'Switch to a blind case to be given a hidden lesion to work out.'));
      return;
    }
    if (this.answered) return;

    const opts = [...this.blindCase.options];
    this.answerNode.append(
      el('p', { class: 'hint' },
        'Examine as much or as little as you like, then commit. There is no penalty for '
        + 'testing more — but notice afterwards which tests would have settled it fastest.'),
      el('div', { class: 'opts' },
        ...opts.map((o) => el('button', { class: 'opt', onclick: (e) => this.commit(o, e.currentTarget) },
          el('span', { class: 'opt-l' }, o)))));
  }

  commit(choice, btn) {
    if (this.answered) return;
    this.answered = true;
    const right = choice === this.blindCase.answer;
    this.score.total++;
    if (right) this.score.right++;

    for (const b of this.answerNode.querySelectorAll('opt')) b.classList.add('locked');
    for (const b of this.answerNode.querySelectorAll('.opt')) {
      b.classList.add('locked');
      if (b.textContent === this.blindCase.answer) b.classList.add('right');
      else if (b === btn) b.classList.add('wrong');
    }

    const tested = this.done.size;
    const abnormal = [...this.done.values()].filter((r) => r.abnormal).length;
    const missed = this.missedKeyFindings();

    this.answerNode.append(
      el('div', { class: `rationale ${right ? 'ok' : 'no'}` },
        el('div', { class: 'rat-h' },
          el('span', { class: 'rat-badge' }, right ? 'Correct' : 'Not quite'),
          el('span', { class: 'rat-dx' }, this.blindCase.answer)),
        el('p', { class: 'rat-teach' },
          `You performed ${tested} test${tested === 1 ? '' : 's'} and found ${abnormal} abnormal.`),
        missed.length
          ? el('div', {},
              el('div', { class: 'eyebrow' }, 'Findings you did not look for'),
              el('ul', { class: 'rat-find' },
                ...missed.slice(0, 6).map((m) => el('li', {}, m))))
          : el('p', { class: 'rat-teach' }, 'You found every abnormality the model contains.'),
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn', onclick: () => this.newBlindCase() }, 'Next case →'),
          el('button', { class: 'btn ghost', onclick: () => { this.revealToDomain(); toast('Lesion sent to Localise'); } },
            'Show me where it was'))),
    );
    this.renderHead();
  }

  /* Which abnormalities existed but were never tested for. */
  missedKeyFindings() {
    const foundRegions = new Set();
    for (const [id, r] of this.done) if (r.abnormal) foundRegions.add(id);
    const out = [];
    for (const region of BODY_REGIONS) {
      for (const t of region.tests) {
        if (this.done.has(t.id)) continue;
        const hits = this.findings.filter((f) => { try { return t.match(f); } catch { return false; } });
        if (hits.length) out.push(`${region.label} — ${t.label}`);
      }
    }
    return out;
  }

  /* ---- the figure -------------------------------------------------------- */

  /* Regions are authored against a portrait figure. Map them through a
     fixed-aspect box centred in whatever canvas we are given, so a wide window
     leaves margins instead of stretching the patient sideways. */
  box(w, h) {
    const ASPECT = 0.62;                    // width / height of the figure box
    let bh = h * 0.94;
    let bw = bh * ASPECT;
    if (bw > w * 0.82) { bw = w * 0.82; bh = bw / ASPECT; }
    return { bx: (w - bw) / 2, by: (h - bh) / 2 + 4, bw, bh };
  }

  hit(e) {
    const r = this.canvas.getBoundingClientRect();
    const B = this.box(r.width, r.height);
    const x = (e.clientX - r.left - B.bx) / B.bw;
    const y = (e.clientY - r.top - B.by) / B.bh;
    // smaller regions first so the trunk never swallows an arm
    const sorted = [...BODY_REGIONS].sort((a, b) => a.w * a.h - b.w * b.h);
    for (const reg of sorted) {
      if (x >= reg.x && x <= reg.x + reg.w && y >= reg.y && y <= reg.y + reg.h) return reg;
    }
    return null;
  }

  regionStatus(reg) {
    let tested = 0, abnormal = 0;
    for (const t of reg.tests) {
      const r = this.done.get(t.id);
      if (!r) continue;
      tested++;
      if (r.abnormal) abnormal++;
    }
    return { tested, abnormal, total: reg.tests.length };
  }

  draw() {
    const g = fit(this.canvas);
    if (!g) return;
    const { ctx, w, h } = g;
    const p = palette();

    const B = this.box(w, h);
    const midX = B.bx + B.bw / 2;

    // side labels
    label(ctx, "PATIENT'S RIGHT", B.bx + B.bw * 0.22, 12, p.muted, 8.5, 'center', '700');
    label(ctx, "PATIENT'S LEFT", B.bx + B.bw * 0.78, 12, p.muted, 8.5, 'center', '700');
    ctx.strokeStyle = p.hairline2; ctx.setLineDash([2, 5]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(midX, 22); ctx.lineTo(midX, h - 16); ctx.stroke();
    ctx.setLineDash([]);

    this.figure(ctx, B, p);

    for (const reg of BODY_REGIONS) {
      const x = B.bx + reg.x * B.bw, y = B.by + reg.y * B.bh;
      const rw = reg.w * B.bw, rh = reg.h * B.bh;
      const st = this.regionStatus(reg);
      const isSel = this.selected?.id === reg.id;
      const isHover = this.hover?.id === reg.id;

      let stroke = p.hairline, fill = 'transparent', lw = 1;
      if (st.abnormal) { stroke = p.bad; fill = withAlpha(p.bad, 0.13); lw = 1.6; }
      else if (st.tested) { stroke = p.good; fill = withAlpha(p.good, 0.08); }
      if (isHover) { fill = withAlpha(p.rose, 0.10); stroke = p.rose; }
      if (isSel) { stroke = p.rose; lw = 2; fill = withAlpha(p.rose, 0.14); }

      roundRect(ctx, x, y, rw, rh, 5);
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();

      // progress pips along the bottom edge
      if (st.tested) {
        const pipW = Math.min(4, (rw - 8) / Math.max(1, st.total));
        let px = x + 4;
        for (const t of reg.tests) {
          const r = this.done.get(t.id);
          if (r) {
            ctx.fillStyle = r.abnormal ? p.bad : withAlpha(p.good, 0.85);
            ctx.fillRect(px, y + rh - 3.5, pipW - 1, 2);
          }
          px += pipW;
        }
      }

      if (isHover || isSel) {
        const txt = reg.label;
        ctx.font = '600 10px sans-serif';
        const tw = ctx.measureText(txt).width + 12;
        const bx = Math.max(4, Math.min(w - tw - 4, x + rw / 2 - tw / 2));
        const by = y - 19 < 22 ? y + rh + 4 : y - 19;
        roundRect(ctx, bx, by, tw, 16, 4);
        ctx.fillStyle = withAlpha(p.panel3, 0.97); ctx.fill();
        ctx.strokeStyle = p.hairline; ctx.lineWidth = 1; ctx.stroke();
        label(ctx, txt, bx + 6, by + 8, p.text, 10, 'left', '600');
      }
    }

    // legend
    const items = [[p.good, 'tested, normal'], [p.bad, 'abnormal'], [p.hairline, 'not examined']];
    let lx = 12;
    for (const [col, name] of items) {
      ctx.fillStyle = withAlpha(col, 0.85);
      ctx.fillRect(lx, h - 12, 8, 3);
      label(ctx, name, lx + 12, h - 11, p.muted, 8.5, 'left', '500');
      ctx.font = '500 8.5px sans-serif';
      lx += 20 + ctx.measureText(name).width;
    }
  }

  /* A plain anterior body outline. Deliberately schematic — it is a target for
     clicking, not an anatomy illustration. */
  figure(ctx, B, p) {
    const { bx, by, bw, bh } = B;
    const cx = bx + bw / 2;
    const X = (f) => bx + f * bw;
    const Y = (f) => by + f * bh;
    const col = withAlpha(p.text2, 0.20);
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // head + neck
    ctx.beginPath();
    ctx.ellipse(cx, Y(0.093), bw * 0.088, bh * 0.058, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.030, Y(0.148)); ctx.lineTo(cx - bw * 0.030, Y(0.186));
    ctx.moveTo(cx + bw * 0.030, Y(0.148)); ctx.lineTo(cx + bw * 0.030, Y(0.186));
    ctx.stroke();

    // shoulders + torso
    ctx.beginPath();
    ctx.moveTo(X(0.335), Y(0.196));
    ctx.quadraticCurveTo(cx, Y(0.182), X(0.665), Y(0.196));
    ctx.lineTo(X(0.640), Y(0.462));
    ctx.quadraticCurveTo(cx, Y(0.478), X(0.360), Y(0.462));
    ctx.closePath();
    ctx.stroke();

    // arms — shoulder, elbow, wrist
    for (const sgn of [-1, 1]) {
      const o = sgn < 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + o * bw * 0.163, Y(0.203));
      ctx.quadraticCurveTo(cx + o * bw * 0.300, Y(0.290), cx + o * bw * 0.312, Y(0.345));
      ctx.lineTo(cx + o * bw * 0.328, Y(0.452));
      ctx.stroke();
    }
    // legs — hip, knee, ankle
    for (const sgn of [-1, 1]) {
      const o = sgn < 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + o * bw * 0.118, Y(0.470));
      ctx.lineTo(cx + o * bw * 0.104, Y(0.620));
      ctx.lineTo(cx + o * bw * 0.092, Y(0.775));
      ctx.stroke();
    }
  }

  resize() { guard('neuro.exam', () => this.draw()); }
}
