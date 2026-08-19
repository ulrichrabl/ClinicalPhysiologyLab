import { LabsView, renderResults } from './ui/labs.js';
import { el } from '../../core/ui/kit.js';
import { CaseRunner } from '../../core/ui/caserunner.js';
import { LessonRunner } from '../../core/ui/lessonrunner.js';
import { CASE_SETS, LESSONS, LAB_DEFAULTS } from './data/labs.js';
import { createCommandId } from '../../runtime/patient-runtime.ts';

/* ---------------------------------------------------------------------------
   Laboratory medicine — runtime observation client.

   Latent chemistry lives on the Patient Runtime. This domain measures it via
   observe.laboratory-panel, lets the learner pin values via chemistry.set, and
   never reaches into the Circulation domain for haemodynamic knobs.
--------------------------------------------------------------------------- */
export default function labsDomain({ patient, shell, runtime }) {
  const rt = runtime ?? shell?.runtime ?? patient?.runtime ?? null;

  const panelObservation = () => {
    if (!rt?.observe) return null;
    const outcome = rt.observe({ type: 'observe.laboratory-panel', panel: 'all', includeInterpretation: true });
    if (outcome?.accepted === false) return null;
    return outcome?.accepted === true ? outcome.observation : outcome;
  };

  const labsBag = () => {
    const obs = panelObservation();
    if (obs?.value?.results) return { ...LAB_DEFAULTS, ...obs.value.results };
    if (rt?.chemistryBag) return { ...LAB_DEFAULTS, ...rt.chemistryBag() };
    return { ...LAB_DEFAULTS };
  };

  const setLab = (k, v) => {
    if (!rt) return;
    rt.dispatch({
      id: createCommandId(),
      type: 'chemistry.set',
      payload: { values: { [k]: v }, pin: true },
      source: { type: 'ui', surface: 'labs' },
    });
    view?.refresh();
  };

  const resetLabs = () => {
    if (!rt) return;
    rt.dispatch({
      id: createCommandId(),
      type: 'chemistry.reset',
      payload: {},
      source: { type: 'ui', surface: 'labs' },
    });
    view?.refresh();
  };

  const view = new LabsView({
    patient,
    runtime: rt,
    getLabs: labsBag,
    setLab,
    resetLabs,
    getObservation: panelObservation,
    onNavigate: (id) => {
      const d = shell.byId.get(id);
      if (d) shell.go(`${d.id}.${d.workspaces[0].id}`);
    },
  });

  /* The case shows its own results panel. It deliberately does not write into
     the patient's chemistry — a worked example is somebody else's blood. */
  const caseStim = el('div', { class: 'lab-panels case-labs' });
  const cases = new CaseRunner({
    sets: CASE_SETS,
    stimulus: caseStim,
    stage: (c) => { if (c.labs) renderResults(caseStim, { ...LAB_DEFAULTS, ...c.labs }); },
  });

  const lessons = new LessonRunner({
    lessons: LESSONS,
    apply: (s) => {
      if (!s || !rt) return;
      if (s.labs) {
        rt.dispatch({
          id: createCommandId(),
          type: 'chemistry.set',
          payload: { values: s.labs, pin: true },
          source: { type: 'lesson', id: 'labs' },
        });
        view.refresh();
      }
      if (s.patient) {
        // Circulation knobs go through the runtime experimental command —
        // never a direct Circulation domain reach-through.
        for (const [k, v] of Object.entries(s.patient)) {
          rt.dispatch({
            id: createCommandId(),
            type: 'experimental.circulation-param',
            payload: { key: k, value: v },
            source: { type: 'lesson', id: 'labs' },
          });
        }
        rt.dispatch({
          id: createCommandId(),
          type: 'runtime.advance',
          payload: { durationMs: 4000 },
          source: { type: 'lesson', id: 'labs' },
        });
        setTimeout(() => view.refresh(), 80);
      }
    },
  });

  const refresh = () => view?.refresh();

  if (rt?.subscribe) {
    rt.subscribe((ev) => {
      if (
        ev.type === 'physiology.updated'
        || ev.type === 'chemistry.updated'
        || ev.type === 'command.accepted'
        || ev.type === 'channels.synced'
      ) {
        refresh();
      }
    });
  } else {
    patient.on((ev) => { if (ev.source !== 'labs') refresh(); });
  }

  return {
    id: 'labs',
    name: 'Labs',
    tagline: 'Results in the context of the patient they came from',
    produces: [], // K/Ca flow chemistry → runtime channels; labs does not publish channels
    consumes: [],
    transport: false,
    workspaces: [
      { id: 'panel', label: 'Results', node: view.node, view },
      { id: 'cases', label: 'Cases', node: cases.node, view: cases },
      { id: 'lessons', label: 'Lessons', node: lessons.node, view: lessons },
    ],
    refresh,
    values: labsBag,
  };
}
