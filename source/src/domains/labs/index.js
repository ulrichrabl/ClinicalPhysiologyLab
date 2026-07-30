import { LabsView, renderResults } from './ui/labs.js';
import { el } from '../../core/ui/kit.js';
import { CaseRunner } from '../../core/ui/caserunner.js';
import { LessonRunner } from '../../core/ui/lessonrunner.js';
import { CASE_SETS, LESSONS, LAB_DEFAULTS, LAB_LINKS } from './data/labs.js';

/* ---------------------------------------------------------------------------
   Laboratory medicine.

   Some values here are the learner's to set. Others are written by the rest of
   the patient — lactate by perfusion, urea by renal blood flow, haemoglobin by
   circulating volume — and those are marked so it is obvious which numbers are
   assumptions and which are consequences.

   Two analytes run the other way: potassium and calcium are published back into
   the shared patient, because the cardiac model reads them to shape the ECG.
   Set a potassium of 7 here and the T waves peak in the ECG workspace.
--------------------------------------------------------------------------- */
export default function labsDomain({ patient, shell }) {
  let labs = { ...LAB_DEFAULTS };
  let manual = new Set();          // analytes the learner has pinned by hand

  const recompute = () => {
    const pt = patient.all();
    const next = { ...LAB_DEFAULTS };
    for (const l of LAB_LINKS) {
      let live = false;
      try { live = l.when(labs, pt); } catch { live = false; }
      if (!live) continue;
      let eff = {};
      try { eff = l.apply(labs, pt) || {}; } catch { eff = {}; }
      Object.assign(next, eff);
    }
    // anything the learner set by hand wins over the simulated value
    for (const k of manual) next[k] = labs[k];
    labs = next;
    view?.refresh();
  };

  const setLab = (k, v) => {
    manual.add(k);
    labs[k] = v;
    // potassium and calcium belong to the patient, not to this panel
    if (k === 'K' || k === 'Ca') patient.set(k, v, 'labs');
    view?.refresh();
  };

  const view = new LabsView({
    patient,
    getLabs: () => labs,
    setLab,
    onNavigate: (id) => {
      const d = shell.byId.get(id);
      if (d) shell.go(`${d.id}.${d.workspaces[0].id}`);
    },
  });

  /* The case shows its own results panel. It deliberately does not write into
     the patient's labs — a worked example is somebody else's blood. */
  const caseStim = el('div', { class: 'lab-panels case-labs' });
  const cases = new CaseRunner({
    sets: CASE_SETS,
    stimulus: caseStim,
    stage: (c) => { if (c.labs) renderResults(caseStim, { ...LAB_DEFAULTS, ...c.labs }); },
  });

  const lessons = new LessonRunner({
    lessons: LESSONS,
    apply: (s) => {
      if (!s) return;
      if (s.labs) {
        manual = new Set(Object.keys(s.labs));
        labs = { ...LAB_DEFAULTS, ...s.labs };
        view.refresh();
      }
      if (s.patient) {
        // a lesson may reach into the circulation; the links do the rest
        const cardio = shell.byId.get('cardio');
        for (const [k, v] of Object.entries(s.patient)) cardio?.setParam?.(k, v);
        setTimeout(recompute, 60);
      }
    },
  });

  patient.on((ev) => { if (ev.source !== 'labs') recompute(); });

  return {
    id: 'labs',
    name: 'Labs',
    tagline: 'Results in the context of the patient they came from',
    produces: ['K', 'Ca'],
    consumes: ['MAP', 'CO', 'bloodVolume', 'LAP', 'EF'],
    transport: false,
    workspaces: [
      { id: 'panel', label: 'Results', node: view.node, view },
      { id: 'cases', label: 'Cases', node: cases.node, view: cases },
      { id: 'lessons', label: 'Lessons', node: lessons.node, view: lessons },
    ],
    refresh: recompute,
    values: () => ({ ...labs }),
  };
}
