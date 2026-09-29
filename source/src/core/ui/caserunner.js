import { el, clear } from './kit.js';
import { learning, slug } from '../learning/index.js';
import { CONFIDENCE } from '../learning/srs.js';

/* ---------------------------------------------------------------------------
   Case runner.

   Domain-agnostic. A domain hands over sets of cases and an adapter that knows
   how to stage the case in that domain's simulation (set a pathology, place a
   lesion, whatever), plus optionally a node to render the stimulus into.

   The pedagogy that matters here: the answer is never just right or wrong. A
   wrong answer gets told *what the distinguishing feature was*, because that is
   the part that transfers to the next patient.

   Learning layer:
   - every case has a stable id (`<domain>/case/<id>`) and is registered, so
     the review scheduler and CME modules can point at it;
   - options are shuffled on every presentation, so position carries no
     information (several sets were authored with the answer always first);
   - before the answer is revealed the learner states how sure they are.
     Confidence feeds both the spacing and the calibration report — being
     certain and wrong is the state worth catching.
--------------------------------------------------------------------------- */

/* Domains write cases in whatever shape reads naturally for their subject.
   Normalise here so the runner only ever sees one shape. */
function normalise(c, optionLabel) {
  const answer = c.answer ?? c.pathId ?? c.correct;
  const options = (c.options || []).map((o) => {
    if (typeof o === 'string') return { id: o, label: optionLabel ? optionLabel(o) : o };
    return { id: o.id ?? o.label, label: o.label };
  });
  return {
    ...c,
    options,
    answer,
    prompt: c.prompt || 'Which of these is it?',
    diagnosis: c.diagnosis || (answer && optionLabel ? optionLabel(answer) : c.title) || '',
  };
}

/** Stable per-case id: authored id if present, else the pathology, else the title. */
export function caseLocalId(c) {
  return String(c.id ?? c.pathId ?? slug(c.title));
}

function shuffled(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class CaseRunner {
  constructor({ sets, stage, stimulus, onState, optionLabel, domain = 'misc', shuffle = true }) {
    this.sets = sets;
    this.domain = domain;
    this.optionLabel = optionLabel;
    this.stage = stage;                 // (caseObj) => void — put the sim in this state
    this.stimulusNode = stimulus;       // optional element the domain draws into
    this.onState = onState || (() => {});
    this.shuffle = shuffle;
    this.setIndex = 0;
    this.caseIndex = 0;
    this.answered = false;
    this.score = 0;
    this.streak = 0;
    this.best = 0;
    this.seen = 0;
    this.node = el('div', { class: 'case-wrap' });
    this.registerItems();
    learning.session.on(() => this.refreshContext());
    this.render();
  }

  get set() { return this.sets[this.setIndex]; }
  get current() { return normalise(this.set.cases[this.caseIndex], this.optionLabel); }
  get currentId() { return this.itemId(this.set.cases[this.caseIndex]); }

  itemId(c) { return `${this.domain}/case/${caseLocalId(c)}`; }

  registerItems() {
    learning.registry.registerRunner(this.domain, 'case', this);
    this.sets.forEach((s, si) => s.cases.forEach((c, ci) => {
      learning.registry.add({
        id: this.itemId(c), kind: 'case', domain: this.domain,
        topic: s.name || s.id, topicId: s.id || slug(s.name),
        title: c.title || `${s.name || s.id} · case ${ci + 1}`,
        answerLabel: () => normalise(c, this.optionLabel).diagnosis,
        where: { set: si, case: ci },
      });
    }));
  }

  /** Show a specific case, by local id or full item id. Returns false if unknown. */
  jumpTo(id) {
    const local = String(id).split('/').pop();
    for (let si = 0; si < this.sets.length; si++) {
      const ci = this.sets[si].cases.findIndex((c) => caseLocalId(c) === local);
      if (ci >= 0) {
        this.setIndex = si; this.caseIndex = ci; this.answered = false;
        this.render();
        return true;
      }
    }
    return false;
  }

  pickSet(i) {
    this.setIndex = i; this.caseIndex = 0; this.answered = false;
    this.render();
  }

  next() {
    this.caseIndex = (this.caseIndex + 1) % this.set.cases.length;
    this.answered = false;
    this.render();
  }

  /* Selecting an option only marks it. The answer is committed when the
     learner states a confidence (or immediately, if they switched that off). */
  pick(optId) {
    if (this.answered) return;
    this.picked = optId;
    for (const b of this.optionEls) b.classList.toggle('picked', b.dataset.opt === optId);
    if (!learning.store.settings.askConfidence) { this.commit(null); return; }
    this.confNode.hidden = false;
  }

  commit(conf) {
    if (this.answered || this.picked == null) return;
    this.answered = true;
    const optId = this.picked;
    const c = this.current;
    const correct = optId === c.answer;
    this.seen++;
    if (correct) {
      this.score++; this.streak++; this.best = Math.max(this.best, this.streak);
    } else {
      this.streak = 0;
    }
    for (const b of this.optionEls) {
      const id = b.dataset.opt;
      b.classList.add('locked');
      if (id === c.answer) b.classList.add('right');
      else if (id === optId) b.classList.add('wrong');
    }
    this.confNode.hidden = true;
    const itemId = this.currentId;
    const ctx = learning.session.ctx;
    learning.store.recordAttempt(itemId, {
      correct, choice: optId, conf,
      ms: this.shownAt ? Date.now() - this.shownAt : null,
      context: ctx ? ctx.kind : null,
    });
    learning.session.note(itemId, correct);
    this.showRationale(correct, conf);
    this.onState({ score: this.score, seen: this.seen, streak: this.streak, best: this.best });
    this.updateScore();
  }

  /* Kept for callers (and tests) that answer in one step. */
  answer(optId, conf = null) {
    if (this.answered) return;
    this.picked = optId;
    this.commit(conf);
  }

  nextButtons() {
    const itemId = this.currentId;
    const s = learning.session;
    if (s.isCurrent(itemId)) {
      const left = s.remaining();
      return [
        el('button', { class: 'btn primary', onclick: () => {
          const nxt = s.advance();
          if (nxt) learning.open(nxt); else learning.home('review');
        } }, left > 0 ? `Next in review · ${left} left →` : 'Finish review →'),
      ];
    }
    const out = [el('button', { class: 'btn', onclick: () => this.next() }, 'Next case →')];
    if (s.ctx?.kind === 'module') {
      out.unshift(el('button', { class: 'btn primary', onclick: () => learning.home('module', s.ctx.moduleId) },
        '← Back to module'));
    }
    return out;
  }

  showRationale(correct, conf) {
    const c = this.current;
    clear(this.rationaleNode);
    this.rationaleNode.hidden = false;
    this.rationaleNode.className = `rationale ${correct ? 'ok' : 'no'}`;
    const calib = conf === 'sure' && !correct
      ? el('p', { class: 'rat-calib danger' }, el('strong', {}, 'Certain, and wrong. '),
        'This is the pattern that hurts patients, so it comes back tomorrow. Read the discriminating feature twice.')
      : conf === 'guess' && correct
        ? el('p', { class: 'rat-calib' }, el('strong', {}, 'Right, but a guess. '),
          'It will come back sooner than a confident answer would.')
        : null;
    const card = learning.store.item(this.currentId)?.card;
    this.rationaleNode.append(
      el('div', { class: 'rat-h' },
        el('span', { class: 'rat-badge' }, correct ? 'Correct' : 'Not quite'),
        el('span', { class: 'rat-dx' }, c.diagnosis || c.answerLabel || '')),
      calib,
      c.findings && c.findings.length && el('ul', { class: 'rat-find' },
        ...c.findings.map((f) => el('li', {}, f))),
      c.teaching && el('p', { class: 'rat-teach' }, c.teaching),
      c.pitfall && el('p', { class: 'rat-pit' },
        el('strong', {}, 'Watch out: '), c.pitfall),
      card && el('p', { class: 'rat-sched' },
        `Next review in ${card.interval} day${card.interval === 1 ? '' : 's'}.`),
      this.nextRow = el('div', { class: 'btn-row' }, ...this.nextButtons()),
    );
    this.rationaleNode.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  refreshContext() {
    if (this.answered && this.nextRow) { clear(this.nextRow); this.nextRow.append(...this.nextButtons()); }
    if (this.reviewTag) this.reviewTag.hidden = !learning.session.isCurrent(this.currentId);
  }

  updateScore() {
    if (!this.scoreEl) return;
    clear(this.scoreEl);
    this.scoreEl.append(
      el('span', {}, `${this.score}/${this.seen}`),
      el('span', { class: 'streak' }, this.streak > 1 ? `${this.streak} in a row` : ''));
  }

  render() {
    clear(this.node);
    const c = this.current;
    if (!c) return;
    this.answered = false;
    this.picked = null;
    this.shownAt = Date.now();

    // set picker
    const picker = el('div', { class: 'chips' },
      ...this.sets.map((s, i) => el('button', {
        class: 'chip' + (i === this.setIndex ? ' on' : ''),
        onclick: () => this.pickSet(i),
      }, s.name || s.id)));

    this.scoreEl = el('div', { class: 'score' });
    this.updateScore();

    const order = this.shuffle ? shuffled(c.options) : c.options;
    this.optionEls = order.map((o, i) => el('button', {
      class: 'opt', data: { opt: o.id }, onclick: () => this.pick(o.id) },
      el('span', { class: 'opt-k' }, String.fromCharCode(65 + i)),
      el('span', { class: 'opt-l' }, o.label)));

    this.confNode = el('div', { class: 'conf', hidden: true },
      el('span', { class: 'conf-q' }, 'How sure are you?'),
      el('div', { class: 'conf-row' },
        ...CONFIDENCE.map((k) => el('button', { class: `conf-b conf-${k.id}`, onclick: () => this.commit(k.id) }, k.label))));

    this.rationaleNode = el('div', { class: 'rationale', hidden: true });
    this.reviewTag = el('span', { class: 'review-tag', hidden: !learning.session.isCurrent(this.currentId) }, 'Due for review');

    const rec = learning.store.item(this.currentId);
    const history = rec && rec.attempts.length
      ? el('span', { class: 'case-hist', title: 'Your previous attempts at this case' },
        ...rec.attempts.slice(-5).map((a) => el('i', { class: a.ok ? 'ok' : 'no' })))
      : null;

    this.node.append(
      el('div', { class: 'case-top' }, picker, this.scoreEl),
      el('div', { class: 'case-grid' },
        el('div', { class: 'case-stim' },
          this.stimulusNode || null),
        el('div', { class: 'case-ask' },
          el('div', { class: 'case-eyebrow' },
            el('span', { class: 'eyebrow' }, `Case ${this.caseIndex + 1} of ${this.set.cases.length}`),
            this.reviewTag, history),
          el('p', { class: 'vignette' }, c.vignette),
          c.prompt && el('p', { class: 'prompt' }, c.prompt),
          el('div', { class: 'opts' }, ...this.optionEls),
          this.confNode,
          this.rationaleNode)),
    );

    try { this.stage?.(c); } catch (e) { console.warn('stage failed', e); }
  }
}
