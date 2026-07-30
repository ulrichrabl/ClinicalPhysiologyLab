import { el, clear, card, toast } from './kit.js';

/* ---------------------------------------------------------------------------
   Case runner.

   Domain-agnostic. A domain hands over sets of cases and an adapter that knows
   how to stage the case in that domain's simulation (set a pathology, place a
   lesion, whatever), plus optionally a node to render the stimulus into.

   The pedagogy that matters here: the answer is never just right or wrong. A
   wrong answer gets told *what the distinguishing feature was*, because that is
   the part that transfers to the next patient.
--------------------------------------------------------------------------- */
/* Domains write cases in whatever shape reads naturally for their subject.
   Normalise here so the runner only ever sees one shape. */
function normalise(c, optionLabel) {
  const answer = c.answer ?? c.pathId ?? c.correct;
  const options = (c.options || []).map((o, i) => {
    const key = String.fromCharCode(65 + i);
    if (typeof o === 'string') return { id: o, key, label: optionLabel ? optionLabel(o) : o };
    return { id: o.id ?? o.label, key: o.key ?? key, label: o.label };
  });
  return {
    ...c,
    options,
    answer,
    prompt: c.prompt || 'Which of these is it?',
    diagnosis: c.diagnosis || (answer && optionLabel ? optionLabel(answer) : c.title) || '',
  };
}

export class CaseRunner {
  constructor({ sets, stage, stimulus, onState, optionLabel }) {
    this.sets = sets;
    this.optionLabel = optionLabel;
    this.stage = stage;                 // (caseObj) => void — put the sim in this state
    this.stimulusNode = stimulus;       // optional element the domain draws into
    this.onState = onState || (() => {});
    this.setIndex = 0;
    this.caseIndex = 0;
    this.answered = false;
    this.score = 0;
    this.streak = 0;
    this.best = 0;
    this.seen = 0;
    this.node = el('div', { class: 'case-wrap' });
    this.render();
  }

  get set() { return this.sets[this.setIndex]; }
  get current() { return normalise(this.set.cases[this.caseIndex], this.optionLabel); }

  pickSet(i) {
    this.setIndex = i; this.caseIndex = 0; this.answered = false;
    this.render();
  }

  next() {
    this.caseIndex = (this.caseIndex + 1) % this.set.cases.length;
    this.answered = false;
    this.render();
  }

  answer(optId, btn) {
    if (this.answered) return;
    this.answered = true;
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
    btn?.classList.add('picked');
    this.showRationale(correct);
    this.onState({ score: this.score, seen: this.seen, streak: this.streak, best: this.best });
  }

  showRationale(correct) {
    const c = this.current;
    const chosenRight = correct;
    clear(this.rationaleNode);
    this.rationaleNode.hidden = false;
    this.rationaleNode.className = `rationale ${chosenRight ? 'ok' : 'no'}`;
    this.rationaleNode.append(
      el('div', { class: 'rat-h' },
        el('span', { class: 'rat-badge' }, chosenRight ? 'Correct' : 'Not quite'),
        el('span', { class: 'rat-dx' }, c.diagnosis || c.answerLabel || '')),
      c.findings && c.findings.length && el('ul', { class: 'rat-find' },
        ...c.findings.map((f) => el('li', {}, f))),
      c.teaching && el('p', { class: 'rat-teach' }, c.teaching),
      c.pitfall && el('p', { class: 'rat-pit' },
        el('strong', {}, 'Watch out: '), c.pitfall),
      el('div', { class: 'btn-row' },
        el('button', { class: 'btn', onclick: () => this.next() }, 'Next case →')),
    );
    this.rationaleNode.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  render() {
    clear(this.node);
    const c = this.current;
    if (!c) return;

    // set picker
    const picker = el('div', { class: 'chips' },
      ...this.sets.map((s, i) => el('button', {
        class: 'chip' + (i === this.setIndex ? ' on' : ''),
        onclick: () => this.pickSet(i),
      }, s.name || s.id)));

    const scoreEl = el('div', { class: 'score' },
      el('span', {}, `${this.score}/${this.seen}`),
      el('span', { class: 'streak' }, this.streak > 1 ? `${this.streak} in a row` : ''));

    this.optionEls = (c.options || []).map((o) => {
      const b = el('button', { class: 'opt', data: { opt: o.id }, onclick: () => this.answer(o.id, b) },
        el('span', { class: 'opt-k' }, o.key || ''),
        el('span', { class: 'opt-l' }, o.label));
      return b;
    });

    this.rationaleNode = el('div', { class: 'rationale', hidden: true });

    this.node.append(
      el('div', { class: 'case-top' }, picker, scoreEl),
      el('div', { class: 'case-grid' },
        el('div', { class: 'case-stim' },
          this.stimulusNode || null),
        el('div', { class: 'case-ask' },
          el('div', { class: 'eyebrow' }, `Case ${this.caseIndex + 1} of ${this.set.cases.length}`),
          el('p', { class: 'vignette' }, c.vignette),
          c.prompt && el('p', { class: 'prompt' }, c.prompt),
          el('div', { class: 'opts' }, ...this.optionEls),
          this.rationaleNode)),
    );

    try { this.stage?.(c); } catch (e) { console.warn('stage failed', e); }
  }
}
