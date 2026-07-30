import { LocalizeView } from './ui/localize.js';
import { ExamView } from './ui/exam.js';
import { CaseRunner } from '../../core/ui/caserunner.js';
import { LessonRunner } from '../../core/ui/lessonrunner.js';
import { CASE_SETS, LESSONS } from './data/cases.js';
import { SYNDROMES } from './model/localize.js';
import { NODES } from './data/anatomy.js';

/* ---------------------------------------------------------------------------
   Neurology domain.

   Publishes the cord level of the current lesion into the shared patient, which
   is what lets a C5 injury turn into neurogenic shock in the cardiovascular
   model without either domain knowing about the other.
--------------------------------------------------------------------------- */
export default function neuroDomain({ patient }) {
  let exam;
  const localize = new LocalizeView({
    patient,
    onLesion: ({ nodes, syndrome }) => {
      // Keep the open-book examination in step with whatever is lesioned.
      if (exam && !exam.blind) {
        exam.setLesion(nodes, syndrome ? syndrome.name
          : nodes.length === 1 ? (nodes[0] in NODES ? NODES[nodes[0]].name : nodes[0])
          : `${nodes.length} structures`, localize.complete);
      }
    },
  });

  const applyLesion = (s) => {
    if (!s) return;
    if (s.filter) { localize.graph.invalidate(); localize.graph.setFilter(s.filter); }
    if (s.tempo) {
      localize.tempo = s.tempo;
      for (const b of localize.tempoChips.children) b.classList.remove('on');
      const idx = ['hyperacute', 'acute', 'subacute', 'chronic', 'relapsing', 'fluctuating'].indexOf(s.tempo);
      if (idx >= 0 && localize.tempoChips.children[idx]) localize.tempoChips.children[idx].classList.add('on');
    }
    if (s.complete != null) {
      localize.complete = s.complete;
      for (const b of localize.severity.children) {
        b.classList.toggle('on', (b.textContent === 'Complete') === s.complete);
      }
    }
    if (s.side) {
      localize.side = s.side;
      for (const b of localize.sideChips.children) {
        b.classList.toggle('on', b.textContent.startsWith(s.side === 'L' ? 'Left' : 'Right'));
      }
    }
    if (s.syndrome) {
      const syn = SYNDROMES.find((x) => x.id === s.syndrome);
      if (syn) localize.applySyndrome(syn);
    } else if (s.nodes) {
      localize.syndrome = null;
      localize.graph.setCompound(s.nodes);
      localize.setLesion(s.nodes, null);
    }
  };

  exam = new ExamView({ applyLesion: (l) => applyLesion(l) });
  exam.setLesion(localize.nodes, 'L internal capsule', true);

  const cases = new CaseRunner({
    sets: CASE_SETS,
    stimulus: null,
    stage: (c) => { if (c.lesion) applyLesion(c.lesion); },
  });

  const lessons = new LessonRunner({ lessons: LESSONS, apply: applyLesion });

  return {
    id: 'neuro',
    name: 'Neurology',
    tagline: 'Localise the lesion from the pattern of deficits',
    produces: ['cordLevel'],
    consumes: ['MAP', 'ICP', 'CPP'],
    transport: false,
    workspaces: [
      { id: 'localize', label: 'Localise', node: localize.node, view: localize },
      { id: 'exam', label: 'Examination', node: exam.node, view: exam },
      { id: 'cases', label: 'Cases', node: cases.node, view: cases },
      { id: 'lessons', label: 'Lessons', node: lessons.node, view: lessons },
    ],
    applyLesion,
  };
}
