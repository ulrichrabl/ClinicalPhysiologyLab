import { el, clear } from './kit.js';

/* ---------------------------------------------------------------------------
   Lesson runner.

   The pattern throughout is predict-then-observe. Before the simulation is
   allowed to change, the learner has to commit to what will happen. Committing
   to a wrong answer and then watching the curve disagree is what makes the
   correction stick; being shown the right answer first teaches almost nothing.

   Step kinds:
     say      prose
     do       apply settings to the simulation, then continue
     predict  a gated question — the `do` in `then` only fires after an answer
     recap    closing summary
--------------------------------------------------------------------------- */
/* Steps are normalised so a domain can write `body`/`question`/`title` (which
   reads naturally) or `text`/`eyebrow` (which is terser) and both work. */
function normStep(st) {
  const options = (st.options || []).map((o, i) => ({
    id: o.id ?? `o${i}`, label: o.label, correct: !!o.correct, why: o.why,
  }));
  return {
    ...st,
    options,
    eyebrow: st.eyebrow || st.title || null,
    text: st.text ?? st.question ?? null,
    html: st.body ?? null,
  };
}

export class LessonRunner {
  constructor({ lessons, apply, onExit }) {
    this.lessons = lessons;
    this.apply = apply;             // (settings) => void
    this.onExit = onExit || (() => {});
    this.lesson = null;
    this.step = 0;
    this.answered = null;
    this.node = el('div', { class: 'lesson-wrap' });
    this.renderList();
  }

  renderList() {
    this.lesson = null;
    clear(this.node);
    this.node.append(
      el('div', { class: 'lesson-intro' },
        el('h2', {}, 'Guided experiments'),
        el('p', {}, 'Each one asks you to predict before it changes anything. '
          + 'The prediction is the point — commit to an answer, then watch whether the '
          + 'simulation agrees with you.')),
      el('div', { class: 'lesson-list' },
        ...this.lessons.map((l, i) => el('button', {
          class: 'lesson-card', onclick: () => this.open(i),
        },
          el('span', { class: 'lesson-idx' }, String(i + 1).padStart(2, '0')),
          el('span', { class: 'lesson-body' },
            el('span', { class: 'lesson-t' }, l.title),
            el('span', { class: 'lesson-d' }, l.blurb || ''),
            el('span', { class: 'lesson-meta' },
              `${l.steps.length} steps`,
              l.steps.some((s) => s.kind === 'predict') ? ' · predict & check' : '')),
        ))),
    );
  }

  open(i) {
    this.lesson = this.lessons[i];
    this.step = 0;
    this.answered = null;
    if (this.lesson.setup) this.apply(this.lesson.setup);
    this.renderStep();
  }

  advance() {
    if (this.step < this.lesson.steps.length - 1) { this.step++; this.answered = null; this.renderStep(); }
  }

  back() {
    if (this.step > 0) { this.step--; this.answered = null; this.renderStep(); }
  }

  goto(i) { this.step = i; this.answered = null; this.renderStep(); }

  renderStep() {
    const l = this.lesson;
    const s = normStep(l.steps[this.step]);
    clear(this.node);

    const pips = el('div', { class: 'steps' },
      ...l.steps.map((_, i) => el('button', {
        class: 'step-pip' + (i === this.step ? ' on' : i < this.step ? ' done' : ''),
        onclick: () => this.goto(i), title: `Step ${i + 1}`,
      })));

    const body = el('div', { class: 'lesson-step' });

    if (s.kind === 'predict') {
      body.append(
        el('div', { class: 'eyebrow' }, s.eyebrow ? `Predict — ${s.eyebrow}` : 'Predict'),
        s.html ? el('div', { class: 'prose', html: s.html }) : el('p', { class: 'prose' }, s.text || ''));
      const opts = el('div', { class: 'opts' });
      const outcome = el('div', { class: 'rationale', hidden: true });
      const btns = s.options.map((o) => {
        const b = el('button', { class: 'opt', onclick: () => {
          if (this.answered) return;
          this.answered = o.id;
          for (const x of btns) {
            x.classList.add('locked');
            if (x.dataset.opt === s.options.find((y) => y.correct)?.id) x.classList.add('right');
            else if (x.dataset.opt === o.id) x.classList.add('wrong');
          }
          outcome.hidden = false;
          outcome.className = `rationale ${o.correct ? 'ok' : 'no'}`;
          clear(outcome);
          outcome.append(
            el('div', { class: 'rat-h' },
              el('span', { class: 'rat-badge' }, o.correct ? 'Right' : 'Not what happens')),
            el('p', { class: 'rat-teach' }, o.why || s.why || ''),
            s.after && el('p', { class: 'rat-teach' }, s.after),
            el('div', { class: 'btn-row' },
              el('button', { class: 'btn', onclick: () => { if (s.then) this.apply(s.then); this.advance(); } },
                s.then ? 'Run it →' : 'Continue →')),
          );
        }, data: { opt: o.id } }, el('span', { class: 'opt-l' }, o.label));
        return b;
      });
      opts.append(...btns);
      body.append(opts, outcome);
    } else if (s.kind === 'recap') {
      body.append(
        el('div', { class: 'eyebrow' }, 'What to take away'),
        el('ul', { class: 'recap' }, ...(s.points || []).map((p) => el('li', {}, p))),
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn', onclick: () => this.renderList() }, '← All experiments')));
    } else {
      body.append(
        s.eyebrow && el('div', { class: 'eyebrow' }, s.eyebrow),
        s.html ? el('div', { class: 'prose', html: s.html }) : el('p', { class: 'prose' }, s.text || ''),
        s.note && el('p', { class: 'callout' }, s.note),
        el('div', { class: 'btn-row' },
          this.step > 0 && el('button', { class: 'btn ghost', onclick: () => this.back() }, '← Back'),
          el('button', { class: 'btn', onclick: () => { if (s.settings) this.apply(s.settings); this.advance(); } },
            s.cta || (this.step === l.steps.length - 1 ? 'Finish' : 'Continue →'))));
      if (s.kind === 'do' && s.settings && s.auto !== false) this.apply(s.settings);
    }

    this.node.append(
      el('div', { class: 'lesson-head' },
        el('button', { class: 'btn ghost sm', onclick: () => this.renderList() }, '← Experiments'),
        el('div', { class: 'lesson-title' }, l.title),
        pips),
      body);
  }
}
