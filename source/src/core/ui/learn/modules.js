import { el, clear, toast } from '../kit.js';
import { learning } from '../../learning/index.js';
import { MODULES, moduleById, buildTest, scoreTest } from '../../learning/modules.js';
import { moduleStatus, followUpsDue } from '../../learning/analytics.js';
import { ROLES } from '../../learning/store.js';
import { certificateNode, printCertificate, downloadCertificate } from './certificate.js';
import { pct, fmtMinutes, fmtDate, DOMAIN_LABEL } from './format.js';

/* ---------------------------------------------------------------------------
   CME modules workspace: the catalogue, and one module at a time.

   The flow follows what accredited e-learning requires, in an order that also
   happens to be good pedagogy: a pre-test (retrieval before instruction), the
   simulation activities, a parallel post-test with explanations, a written
   commitment to change, an evaluation, and a certificate. Thirty days later
   the learner is asked whether the change happened.
--------------------------------------------------------------------------- */

const PHASES = [
  { id: 'new', label: 'Overview' },
  { id: 'pre', label: 'Pre-test' },
  { id: 'activities', label: 'Activities' },
  { id: 'post', label: 'Post-test' },
  { id: 'reflect', label: 'Reflect' },
  { id: 'complete', label: 'Certificate' },
];
const phaseIndex = (p) => (p === 'certificate' ? 4 : PHASES.findIndex((x) => x.id === p));

const levelLabel = (id) => ({ student: 'Students', resident: 'Residents', physician: 'Physicians' }[id] || id);

export class ModulesView {
  constructor() {
    this.node = el('div', { class: 'learn-wrap' });
    this.openId = null;
    this.test = null;          // { form, questions, answers }
    this.showPost = null;      // last post-test result to display
    learning.store.on((ev) => {
      if (ev.type === 'attempt' || ev.type === 'lesson-complete') this.maybeRender();
    });
    this.render();
  }

  resize() {}
  refresh() { this.render(); }
  maybeRender() { if (this.node.isConnected) this.render(); }

  open(id) {
    this.openId = id;
    this.test = null;
    this.showPost = null;
    this.render();
    this.node.scrollIntoView?.({ block: 'start' });
  }

  close() { this.openId = null; this.test = null; this.render(); }

  render() {
    clear(this.node);
    const mod = this.openId && moduleById(this.openId);
    if (mod) this.node.append(this.renderModule(mod));
    else this.node.append(this.renderCatalogue());
  }

  /* ---- catalogue -------------------------------------------------------- */
  renderCatalogue() {
    const rec = learning.store.state;
    const role = learning.store.profile.role;
    const sorted = [...MODULES].sort((a, b) =>
      (b.levels.includes(role) - a.levels.includes(role)));
    return el('div', {},
      el('div', { class: 'learn-head' },
        el('div', {},
          el('div', { class: 'eyebrow' }, 'Continuing medical education'),
          el('h1', { class: 'learn-h1' }, 'Modules'),
          el('p', { class: 'learn-lede' },
            'Each module is built from the simulator\'s own cases and experiments: a short pre-test, the hands-on '
            + 'activities, a post-test with explanations, a commitment to change, and a certificate of the time you '
            + 'actually spent.'))),
      el('div', { class: 'mod-grid' }, ...sorted.map((m) => this.moduleCard(m, moduleStatus(rec, m)))));
  }

  moduleCard(m, st) {
    const phase = st.phase;
    const label = phase === 'new' ? 'Not started'
      : phase === 'complete' ? 'Completed'
        : `In progress · ${PHASES[phaseIndex(phase)]?.label || ''}`;
    return el('button', { class: `mod-card accent-${m.accent || 'rose'}` + (phase === 'complete' ? ' done' : ''),
      onclick: () => this.open(m.id) },
      el('div', { class: 'mod-card-top' },
        el('span', { class: 'mod-spec' }, m.specialty),
        m.review?.status === 'draft' && el('span', { class: 'pill draft', title: m.review.note }, 'Draft')),
      el('div', { class: 'mod-title' }, m.title),
      el('div', { class: 'mod-blurb' }, m.blurb),
      el('div', { class: 'mod-meta' },
        el('span', {}, `${m.minutes} min`),
        el('span', {}, `${m.objectives.length} objectives`),
        el('span', {}, `${m.activities.length} activities`),
        el('span', {}, m.levels.map(levelLabel).join(' · '))),
      el('div', { class: 'mod-foot' },
        el('div', { class: 'bar' }, el('i', { style: { width: `${Math.round(st.progress * 100)}%` } })),
        el('span', { class: 'mod-state' }, phase === 'complete' ? '✓ Certificate' : label)));
  }

  /* ---- one module ------------------------------------------------------- */
  renderModule(mod) {
    const rec = learning.store.state;
    const st = moduleStatus(rec, mod);
    const pi = phaseIndex(st.phase);

    const stepper = el('div', { class: 'stepper' },
      ...PHASES.map((p, i) => el('div', {
        class: 'stp' + (i < pi || st.phase === 'complete' ? ' done' : i === pi ? ' on' : ''),
      }, el('span', { class: 'stp-dot' }, i < pi || st.phase === 'complete' ? '✓' : String(i + 1)), el('span', { class: 'stp-l' }, p.label))));

    let body;
    switch (st.phase) {
      case 'new': body = this.overview(mod, st); break;
      case 'pre': body = this.testPhase(mod, 'a'); break;
      case 'activities': body = this.activitiesPhase(mod, st); break;
      case 'post': body = this.showPost ? this.postResult(mod, st) : this.testPhase(mod, 'b'); break;
      case 'reflect':
      case 'certificate': body = this.showPost ? this.postResult(mod, st) : this.reflectPhase(mod, st); break;
      case 'complete': body = this.completePhase(mod, st); break;
      default: body = el('div');
    }

    return el('div', { class: 'mod-page' },
      el('div', { class: 'mod-page-head' },
        el('button', { class: 'btn ghost sm', onclick: () => this.close() }, '← All modules'),
        el('div', { class: 'eyebrow' }, mod.specialty)),
      el('h1', { class: 'learn-h1' }, mod.title),
      el('p', { class: 'learn-lede' }, mod.blurb),
      el('div', { class: 'mod-facts' },
        el('span', {}, `${mod.minutes} min`),
        el('span', {}, `up to ${mod.maxHours} h`),
        el('span', {}, `Pass mark ${pct(mod.passMark)}`),
        el('span', {}, mod.levels.map(levelLabel).join(' · ')),
        st.record && el('span', {}, `Time so far ${fmtMinutes(Math.round((st.record.seconds || 0) / 60))}`)),
      stepper,
      body);
  }

  overview(mod, st) {
    return el('div', { class: 'mod-cols' },
      el('section', { class: 'card' },
        el('div', { class: 'card-b' },
          el('div', { class: 'eyebrow' }, 'By the end you will be able to'),
          el('ol', { class: 'obj-list' }, ...mod.objectives.map((o) => el('li', {}, o))),
          el('div', { class: 'eyebrow', style: { marginTop: '18px' } }, 'What you will do'),
          el('ul', { class: 'act-list' }, ...st.activities.map((a) => this.activityRow(a, mod, false))),
          el('div', { class: 'btn-row' },
            el('button', { class: 'btn primary', onclick: () => {
              learning.store.startModule(mod.id);
              learning.session.startModuleContext(mod.id, mod.title);
              this.render();
            } }, 'Start with the pre-test →')),
          el('p', { class: 'fine' },
            'The pre-test is not marked against you. It tells you what to look for, and it makes the '
            + 'post-test a measure of what changed.'))),
      this.sidePanel(mod));
  }

  sidePanel(mod) {
    const rv = mod.review || {};
    return el('aside', { class: 'mod-side' },
      el('section', { class: 'card' },
        el('div', { class: 'card-b' },
          el('div', { class: 'eyebrow' }, 'Content status'),
          rv.status === 'draft'
            ? el('p', { class: 'callout warn' }, el('strong', {}, 'Draft. '), rv.note)
            : el('p', { class: 'fine' }, `Peer reviewed${rv.reviewers?.length ? ` by ${rv.reviewers.join(', ')}` : ''}.`),
          el('p', { class: 'fine' }, `Last reviewed ${rv.reviewed || '—'} · next review due ${rv.nextReview || '—'}.`),
          el('div', { class: 'eyebrow', style: { marginTop: '12px' } }, 'Accreditation'),
          el('p', { class: 'fine' }, mod.accreditation
            ? `${mod.accreditation.provider} · ${mod.accreditation.credits} ${mod.accreditation.creditType || 'credits'}`
            : 'Not accredited. Your certificate records participation and engaged time.'),
          el('div', { class: 'eyebrow', style: { marginTop: '12px' } }, 'Commercial support'),
          el('p', { class: 'fine' }, 'None. There is no advertising or sponsorship in the app.'))),
      el('section', { class: 'card' },
        el('div', { class: 'card-b' },
          el('div', { class: 'eyebrow' }, 'Key references'),
          el('ol', { class: 'ref-list' }, ...mod.references.map((r) => el('li', {}, r))))));
  }

  activityRow(a, mod, live = true) {
    const item = learning.registry.get(a.ref);
    const kind = a.ref.includes('/lesson/') ? 'Experiment' : 'Case';
    const domain = DOMAIN_LABEL[a.ref.split('/')[0]] || '';
    const title = item?.title || a.ref;
    return el('li', { class: 'act' + (a.done ? ' done' : '') },
      el('span', { class: 'act-check' }, a.done ? '✓' : ''),
      el('span', { class: 'act-body' },
        el('span', { class: 'act-t' }, title),
        el('span', { class: 'act-k' }, `${kind} · ${domain}`)),
      live && el('button', { class: 'btn sm' + (a.done ? ' ghost' : ''), onclick: () => {
        learning.session.startModuleContext(mod.id, mod.title);
        learning.store.setActiveModule(mod.id);
        learning.open(a.ref);
      } }, a.done ? 'Again' : 'Open →'));
  }

  /* ---- tests ------------------------------------------------------------ */
  testPhase(mod, form) {
    if (!this.test || this.test.form !== form || this.test.moduleId !== mod.id) {
      this.test = { moduleId: mod.id, form, questions: buildTest(mod, form), answers: {} };
    }
    const t = this.test;
    const isPre = form === 'a';
    const answered = () => Object.keys(t.answers).length;
    const submit = el('button', { class: 'btn primary', disabled: answered() < t.questions.length, onclick: () => {
      const result = scoreTest(t.questions, t.answers);
      if (isPre) {
        learning.store.savePreTest(mod.id, { ...result, answers: t.answers });
        toast(`Pre-test recorded: ${result.correct}/${result.total}. You will see the answers after the post-test.`);
        this.test = null;
        this.render();
      } else {
        const passed = result.score >= mod.passMark - 1e-9;
        learning.store.savePostTest(mod.id, { ...result, passed, answers: t.answers,
          order: t.questions.map((qq) => ({ id: qq.id, options: qq.options.map((o) => o.id) })) });
        this.showPost = { questions: t.questions, answers: t.answers, result, passed };
        this.test = null;
        this.render();
      }
    } }, isPre ? 'Submit pre-test' : 'Submit post-test');

    const progress = el('span', { class: 'fine' }, `${answered()} of ${t.questions.length} answered`);

    const questionNodes = t.questions.map((qq, i) => {
      const optButtons = qq.options.map((o, k) => el('button', {
        class: 'opt' + (t.answers[qq.id] === o.id ? ' picked' : ''),
        onclick: (e) => {
          t.answers[qq.id] = o.id;
          for (const b of optButtons) b.classList.toggle('picked', b === e.currentTarget);
          progress.textContent = `${answered()} of ${t.questions.length} answered`;
          submit.disabled = answered() < t.questions.length;
        },
      }, el('span', { class: 'opt-k' }, String.fromCharCode(65 + k)), el('span', { class: 'opt-l' }, o.text)));
      return el('div', { class: 'tq' },
        el('div', { class: 'tq-n' }, `${i + 1}`),
        el('div', { class: 'tq-b' },
          el('p', { class: 'tq-stem' }, qq.stem),
          el('div', { class: 'opts' }, ...optButtons)));
    });

    return el('section', { class: 'card test' },
      el('div', { class: 'card-b' },
        el('div', { class: 'eyebrow' }, isPre ? 'Pre-test · no feedback yet' : 'Post-test · explanations after you submit'),
        el('p', { class: 'fine' }, isPre
          ? 'Answer from what you know now. Guessing is fine; the answers are revealed at the end of the module.'
          : `You need ${pct(mod.passMark)} to pass. These questions are parallel to the pre-test, not repeats of it.`),
        ...questionNodes,
        el('div', { class: 'btn-row sticky-actions' }, submit, progress)));
  }

  postResult(mod, st) {
    const p = this.showPost || {};
    const { result, passed } = p;
    const pre = st.record?.pre;
    const questions = p.questions || [];
    return el('div', {},
      el('section', { class: `card result ${passed ? 'ok' : 'no'}` },
        el('div', { class: 'card-b result-b' },
          el('div', { class: 'result-score' },
            el('span', { class: 'big' }, pct(result?.score)),
            el('span', { class: 'fine' }, `${result?.correct}/${result?.total} correct`)),
          el('div', {},
            el('div', { class: 'rat-h' }, el('span', { class: 'rat-badge' }, passed ? 'Passed' : 'Not yet')),
            el('p', {}, passed
              ? `Pre-test ${pct(pre?.score)} → post-test ${pct(result?.score)}. Read the explanations, then finish with a short reflection.`
              : `You need ${pct(mod.passMark)}. Revisit the objectives you missed below, then take the post-test again. The questions come back in a new order.`),
            el('div', { class: 'btn-row' },
              passed
                ? el('button', { class: 'btn primary', onclick: () => { this.showPost = null; this.render(); } }, 'Continue to reflection →')
                : el('button', { class: 'btn primary', onclick: () => { this.showPost = null; this.test = null; this.render(); } }, 'Retake post-test'))))),
      ...questions.map((qq, i) => {
        const ok = p.answers[qq.id] === qq.answer;
        const right = qq.options.find((o) => o.id === qq.answer);
        const chose = qq.options.find((o) => o.id === p.answers[qq.id]);
        return el('section', { class: `card tq-review ${ok ? 'ok' : 'no'}` },
          el('div', { class: 'card-b' },
            el('div', { class: 'eyebrow' }, `Question ${i + 1} · objective ${qq.objective + 1}`),
            el('p', { class: 'tq-stem' }, qq.stem),
            !ok && el('p', { class: 'tq-yours' }, el('span', {}, 'Your answer: '), chose?.text || '—'),
            el('p', { class: 'tq-right' }, el('span', {}, ok ? '✓ ' : 'Correct answer: '), right?.text),
            el('p', { class: 'rat-teach' }, qq.explanation)));
      }));
  }

  activitiesPhase(mod, st) {
    const pre = st.record?.pre;
    const all = st.done >= st.total;
    return el('div', { class: 'mod-cols' },
      el('section', { class: 'card' },
        el('div', { class: 'card-b' },
          el('div', { class: 'eyebrow' }, `Activities · ${st.done} of ${st.total} done`),
          el('div', { class: 'bar lg' }, el('i', { style: { width: `${Math.round((st.done / Math.max(1, st.total)) * 100)}%` } })),
          el('p', { class: 'fine' }, 'Each one opens in its own workspace with the live simulation. When you have answered '
            + 'the case or reached the end of the experiment, the "Back to module" button brings you here.'),
          el('ul', { class: 'act-list' }, ...st.activities.map((a) => this.activityRow(a, mod))),
          el('div', { class: 'btn-row' },
            el('button', { class: 'btn primary', disabled: !all, onclick: () => { this.test = null; this.showPost = null; this.render(); } },
              all ? 'Take the post-test →' : `Post-test unlocks after ${st.total - st.done} more`)))),
      el('aside', { class: 'mod-side' },
        el('section', { class: 'card' },
          el('div', { class: 'card-b' },
            el('div', { class: 'eyebrow' }, 'Your pre-test'),
            el('div', { class: 'kpi' }, pct(pre?.score)),
            el('p', { class: 'fine' }, 'Answers are revealed after the post-test. Use the objectives to focus the activities.'),
            el('ol', { class: 'obj-list sm' }, ...mod.objectives.map((o, i) => {
              const b = pre?.byObjective?.[i];
              return el('li', { class: b && b.ok < b.n ? 'miss' : '' }, o);
            })))),
        this.sidePanel(mod)));
  }

  /* ---- reflection & evaluation ----------------------------------------- */
  reflectPhase(mod) {
    const p = learning.store.profile;
    const answers = {};
    const name = el('input', { type: 'text', class: 'inp', placeholder: 'Name as it should appear on the certificate', value: p.name || '' });
    const role = el('select', { class: 'inp' }, ...ROLES.map((r) => el('option', { value: r.id, selected: r.id === p.role }, r.label)));
    const licence = el('input', { type: 'text', class: 'inp', placeholder: 'Optional', value: p.licence || '' });
    const commitment = el('textarea', { class: 'inp', rows: 3, placeholder: 'e.g. "Record posterior leads whenever V1–V3 show ST depression in chest pain."' });
    const barriers = el('textarea', { class: 'inp', rows: 2, placeholder: 'Optional' });
    const comments = el('textarea', { class: 'inp', rows: 2, placeholder: 'Optional: what should change in this module?' });
    let submit = null;
    const check = () => {
      if (!submit) return;
      submit.disabled = !(name.value.trim() && commitment.value.trim().length >= 10
        && answers.objectives && answers.relevance && answers.bias && answers.change);
    };
    const likert = (key, question) => {
      const group = el('div', { class: 'likert' });
      ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'].forEach((lab, i) => group.append(
        el('button', { class: 'chip', title: lab, onclick: (e) => {
          answers[key] = i + 1;
          for (const b of group.children) b.classList.toggle('on', b === e.currentTarget);
          check();
        } }, String(i + 1))));
      return el('div', { class: 'eval-q' }, el('span', {}, question), group, el('span', { class: 'likert-l' }, '1 = strongly disagree · 5 = strongly agree'));
    };
    const choice = (key, question, opts) => {
      const group = el('div', { class: 'chips' });
      opts.forEach(([id, lab]) => group.append(el('button', { class: 'chip', onclick: (e) => {
        answers[key] = id;
        for (const b of group.children) b.classList.toggle('on', b === e.currentTarget);
        check();
      } }, lab)));
      return el('div', { class: 'eval-q' }, el('span', {}, question), group);
    };
    submit = el('button', { class: 'btn primary', disabled: true, onclick: () => {
      learning.store.setProfile({ name: name.value.trim(), role: role.value, licence: licence.value.trim() });
      learning.store.saveReflection(mod.id, { commitment: commitment.value.trim(), barriers: barriers.value.trim() });
      learning.store.saveEvaluation(mod.id, { ...answers, comments: comments.value.trim() });
      learning.store.completeModule(mod.id, { title: mod.title, maxHours: mod.maxHours });
      learning.session.end();
      toast('Module complete. Your certificate is ready.');
      this.render();
    } }, 'Finish and issue certificate');
    for (const n of [name, commitment]) n.addEventListener('input', check);

    return el('div', { class: 'mod-cols' },
      el('section', { class: 'card' },
        el('div', { class: 'card-b form' },
          el('div', { class: 'eyebrow' }, 'Commitment to change'),
          el('label', { class: 'fld' }, el('span', {}, 'What will you do differently as a result of this module?'), commitment),
          el('label', { class: 'fld' }, el('span', {}, 'What might get in the way?'), barriers),
          el('p', { class: 'fine' }, 'In 30 days the app will ask whether this happened. Commitments written down '
            + 'at the end of an activity are more likely to be carried out, and the follow-up closes the loop.'),
          el('div', { class: 'eyebrow', style: { marginTop: '16px' } }, 'Evaluation'),
          likert('objectives', 'The stated learning objectives were met.'),
          likert('relevance', 'The content is relevant to my practice or training.'),
          choice('bias', 'The content was balanced and free of commercial bias.', [['yes', 'Yes'], ['no', 'No']]),
          choice('change', 'Will you change your practice?', [['yes', 'Yes'], ['already', 'I already do this'], ['maybe', 'Not sure'], ['no', 'No']]),
          el('label', { class: 'fld' }, el('span', {}, 'Comments for the authors'), comments),
          el('div', { class: 'eyebrow', style: { marginTop: '16px' } }, 'For your certificate'),
          el('div', { class: 'fld-row' },
            el('label', { class: 'fld' }, el('span', {}, 'Full name'), name),
            el('label', { class: 'fld' }, el('span', {}, 'Role'), role),
            el('label', { class: 'fld' }, el('span', {}, 'Registration / licence no.'), licence)),
          el('div', { class: 'btn-row' }, submit))),
      this.sidePanel(mod));
  }

  /* ---- complete ---------------------------------------------------------- */
  completePhase(mod, st) {
    const m = st.record;
    const cert = m.certificate;
    const due = followUpsDue(learning.store.state, Date.now()).find((f) => f.moduleId === mod.id);
    return el('div', {},
      due && this.followUpCard(mod, m),
      el('section', { class: 'card' },
        el('div', { class: 'card-b' },
          el('div', { class: 'cert-actions' },
            el('div', {},
              el('div', { class: 'eyebrow' }, 'Completed ' + fmtDate(m.completedAt)),
              el('p', { class: 'fine' }, `Pre-test ${pct(cert.preScore)} → post-test ${pct(cert.postScore)} · ${fmtMinutes(cert.minutes)} engaged · ${cert.hours} h claimed`)),
            el('div', { class: 'btn-row' },
              el('button', { class: 'btn primary', onclick: () => printCertificate(cert, mod) }, 'Print / save as PDF'),
              el('button', { class: 'btn', onclick: () => { if (!downloadCertificate(cert, mod)) toast('Download is blocked in this browser; use Print instead.'); } }, 'Download certificate'),
              el('button', { class: 'btn ghost', onclick: () => {
                learning.store.startModule(mod.id);
                learning.session.startModuleContext(mod.id, mod.title);
                this.render();
              } }, 'Take it again'))),
          el('div', { class: 'cert-preview' }, certificateNode(cert, mod)),
          m.reflection?.commitment && el('div', { class: 'commit' },
            el('div', { class: 'eyebrow' }, 'Your commitment'),
            el('blockquote', {}, m.reflection.commitment),
            m.followUp && el('p', { class: 'fine' }, `Follow-up ${fmtDate(m.followUp.at)}: ${m.followUp.outcome}`
              + (m.followUp.note ? ` — ${m.followUp.note}` : ''))))),
      this.sidePanel(mod));
  }

  followUpCard(mod, m) {
    const note = el('input', { type: 'text', class: 'inp', placeholder: 'Optional: what helped or got in the way?' });
    const pick = (outcome) => {
      learning.store.saveFollowUp(mod.id, { outcome, note: note.value.trim() });
      toast('Thanks — follow-up recorded.');
      this.render();
    };
    return el('section', { class: 'card follow' },
      el('div', { class: 'card-b' },
        el('div', { class: 'eyebrow' }, '30-day follow-up'),
        el('p', {}, 'You committed to:'),
        el('blockquote', {}, m.reflection.commitment),
        el('p', {}, 'Did it happen?'),
        note,
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn', onclick: () => pick('Implemented') }, 'Yes'),
          el('button', { class: 'btn', onclick: () => pick('Partly implemented') }, 'Partly'),
          el('button', { class: 'btn', onclick: () => pick('Not implemented') }, 'Not yet'))));
  }
}
