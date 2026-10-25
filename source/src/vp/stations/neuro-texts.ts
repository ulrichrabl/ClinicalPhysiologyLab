import type { LocalizedText } from '../model/i18n.ts';
import type { NeuroTest } from './neuro-signs.ts';

/* ---------------------------------------------------------------------------
   The neurological station's explanations: what each test reads, and what
   this patient's finding says about where the lesion is. The numbers and
   the findings come from the examination model; nothing here decides them.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export const NEURO_TEST_LABEL: Record<NeuroTest, LocalizedText> = {
  drift: L('Pronator drift', 'Armvorhalteversuch'),
  'finger-nose': L('Finger–nose', 'Finger-Nase-Versuch'),
  'knee-jerk': L('Knee jerk', 'Patellarsehnenreflex'),
};

/** What the explanations read: the model's findings for both sides, and the lesion's rungs. */
export interface NeuroContext {
  drift: { R: boolean; L: boolean };
  fingerNose: { R: FN; L: FN };
  /** finger–nose with the eyes closed */
  fingerNoseClosed: { R: FN; L: FN };
  reflexes: { R: { knee: number; ankle: number; plantar: string }; L: { knee: number; ankle: number; plantar: string } };
  basis: string[];
  rungs: Set<Rung>;
}
interface FN { dysmetria: "none" | "mild" | "marked"; intentionTremor: boolean; limitedByWeakness?: boolean }

export type Rung = 'cortex' | 'capsule' | 'brainstem' | 'cord' | 'root' | 'plexus' | 'nerve' | 'junction' | 'muscle' | 'cerebellum';
/** The rung of the ladder a structure of the nervous-system graph sits on. */
export function rungOf(node: string): Rung | null {
  if (/cerebell|vermis|_icp$|_mcp$|_scp$|dentate|red_nuc/.test(node)) return 'cerebellum';
  if (/_mcx_|_scx$|broca|wernicke|arcuate|vis_cx/.test(node)) return 'cortex';
  if (/_ic$|_thal$/.test(node)) return 'capsule';
  if (/peduncle|pons|med_pyr|_lat_bs|_med_med|_lat_med|_midbrain|pyr_decuss|_ml$/.test(node)) return 'brainstem';
  if (/_cst_|_ahn_|_dc_|_stt_/.test(node)) return 'cord';
  if (/_nerve_(C|T|L|S)\d|_drg_/.test(node)) return 'root';
  if (/_bp_|_lp_/.test(node)) return 'plexus';
  if (/_n_/.test(node)) return 'nerve';
  if (/_nmj_/.test(node)) return 'junction';
  if (/_muscle_/.test(node)) return 'muscle';
  return null;
}

const side = (S: 'R' | 'L') => (S === 'R' ? L('right', 'rechts') : L('left', 'links'));
const both = (en: (S: 'R' | 'L') => string, de: (S: 'R' | 'L') => string) => L((['R', 'L'] as const).map(en).join(' '), (['R', 'L'] as const).map(de).join(' '));
const GRADE = ['0 (absent)', '1 (reduced)', '2 (normal)', '3 (brisk)', '4 (with clonus)'];
const GRADE_DE = ['0 (fehlend)', '1 (abgeschwächt)', '2 (normal)', '3 (lebhaft)', '4 (mit Klonus)'];

export function explainNeuro(test: NeuroTest, c: NeuroContext): { title: LocalizedText; body: LocalizedText[] } {
  switch (test) {
    case 'drift': {
      const any = c.drift.R || c.drift.L;
      return {
        title: L('Pronator drift: the corticospinal tract holding the arms against gravity', 'Armvorhalteversuch: die Pyramidenbahn hält die Arme gegen die Schwerkraft'),
        body: [
          L('Arms held out, palms up, eyes closed, for 20 to 30 seconds. Holding the forearm turned palm up and the arm level takes the supinators and the extensors, which the corticospinal tract serves most. When it is slightly weak, the stronger pronators and flexors win: the hand turns palm down, the elbow bends and the arm sinks. The eyes are closed so that sight cannot correct the drift.',
            'Arme vorgestreckt, Handflächen nach oben, Augen geschlossen, 20 bis 30 Sekunden lang. Den Unterarm nach oben gedreht und den Arm waagerecht zu halten, verlangt die Supinatoren und Strecker, die die Pyramidenbahn am stärksten versorgt. Ist sie leicht geschwächt, gewinnen die stärkeren Pronatoren und Beuger: Die Hand dreht sich nach unten, der Ellenbogen beugt sich, der Arm sinkt. Die Augen sind geschlossen, damit das Sehen die Drift nicht korrigiert.'),
          any
            ? both((S) => (c.drift[S] ? `The ${side(S).en} arm drifts.` : ''), (S) => (c.drift[S] ? `Der ${side(S).de === 'rechts' ? 'rechte' : 'linke'} Arm driftet.` : ''))
            : L('Neither arm drifts.', 'Keiner der Arme driftet.'),
          any ? L('An upper motor neuron sign: the lesion is in the corticospinal tract, from the motor cortex through the internal capsule and the brainstem to the cord, on the opposite side above the pyramidal decussation and on the same side below it. A root or a nerve lesion weakens its own muscles but does not make the arm drift.',
            'Ein Zeichen des ersten Motoneurons: Die Läsion liegt in der Pyramidenbahn, vom Motorkortex über die Capsula interna und den Hirnstamm bis ins Rückenmark, oberhalb der Pyramidenkreuzung auf der Gegenseite, darunter auf derselben Seite. Eine Wurzel- oder Nervenläsion schwächt ihre eigenen Muskeln, lässt den Arm aber nicht driften.') : L('', ''),
        ].filter((x) => x.en),
      };
    }
    case 'finger-nose': {
      const fn = (S: 'R' | 'L') => c.fingerNose[S], fc = (S: 'R' | 'L') => c.fingerNoseClosed[S];
      const lines: LocalizedText[] = [
        L('From the nose to the examiner’s finger at arm’s length and back. The cerebellar hemisphere on the same side times the agonist and the antagonist: without it the finger overshoots the target and corrects (dysmetria), and it shakes more the nearer it comes (an intention tremor, below 5 per second). Done again with the eyes closed, it tests the sense of where the arm is: the dorsal columns.',
          'Von der Nase zum Finger des Untersuchers auf Armlänge und zurück. Die Kleinhirnhemisphäre derselben Seite stimmt Agonist und Antagonist aufeinander ab: Ohne sie schießt der Finger über das Ziel hinaus und korrigiert (Dysmetrie) und zittert umso mehr, je näher er kommt (Intentionstremor, unter 5 pro Sekunde). Mit geschlossenen Augen wiederholt, prüft er den Lagesinn des Arms: die Hinterstränge.'),
      ];
      for (const S of ['R', 'L'] as const) {
        const a = fn(S), b = fc(S);
        if (a.limitedByWeakness) lines.push(L(`The ${side(S).en} arm is too weak to do the test: it cannot be judged.`, `Der Arm ${side(S).de} ist zu schwach für den Test: Er ist nicht zu beurteilen.`));
        else if (a.dysmetria !== 'none') lines.push(L(`The ${side(S).en} finger is ${a.dysmetria === 'marked' ? 'markedly' : 'slightly'} dysmetric${a.intentionTremor ? ', with an intention tremor' : ''}, with the eyes open as well as closed: the cerebellum or its connections on the ${side(S).en}.`,
          `Der Finger ${side(S).de} ist ${a.dysmetria === 'marked' ? 'deutlich' : 'leicht'} dysmetrisch${a.intentionTremor ? ', mit Intentionstremor' : ''}, mit offenen wie mit geschlossenen Augen: Kleinhirn oder seine Verbindungen ${side(S).de}.`));
        else if (b.dysmetria !== 'none') lines.push(L(`The ${side(S).en} finger is accurate while the patient watches and misses with the eyes closed: sensory ataxia, the sense of position lost (dorsal columns, or the nerves and roots that feed them).`,
          `Der Finger ${side(S).de} trifft, solange der Patient hinsieht, und verfehlt mit geschlossenen Augen: sensible Ataxie, der Lagesinn fehlt (Hinterstränge oder die Nerven und Wurzeln, die sie speisen).`));
      }
      if (lines.length === 1) lines.push(L('Both fingers reach the target and the nose accurately, with the eyes open and closed.', 'Beide Finger treffen Ziel und Nase genau, mit offenen und geschlossenen Augen.'));
      return { title: L('Finger–nose: the cerebellum and the sense of position', 'Finger-Nase-Versuch: Kleinhirn und Lagesinn'), body: lines };
    }
    case 'knee-jerk': {
      const r = c.reflexes;
      const lines: LocalizedText[] = [
        L('A tap on the patellar tendon stretches the quadriceps; its spindles fire through the femoral nerve and the L3 and L4 roots to the cord, where they excite the motor neurons of the same muscle, and the leg kicks. From above, the corticospinal tract damps the reflex: cut it and the reflex grows brisk, with clonus at its most; cut the arc itself (root, nerve, muscle) and it is lost.',
          'Ein Schlag auf die Patellarsehne dehnt den Quadrizeps; seine Muskelspindeln feuern über den N. femoralis und die Wurzeln L3 und L4 ins Rückenmark, wo sie die Motoneurone desselben Muskels erregen, und das Bein schlägt aus. Von oben dämpft die Pyramidenbahn den Reflex: Ist sie unterbrochen, wird er lebhaft, im Extremfall mit Klonus; ist der Bogen selbst unterbrochen (Wurzel, Nerv, Muskel), fehlt er.'),
        L(`Knee jerk: right ${GRADE[r.R.knee]}, left ${GRADE[r.L.knee]}. Ankle jerk (S1): right ${GRADE[r.R.ankle]}, left ${GRADE[r.L.ankle]}. Plantar response: right ${r.R.plantar}, left ${r.L.plantar}.`,
          `PSR: rechts ${GRADE_DE[r.R.knee]}, links ${GRADE_DE[r.L.knee]}. ASR (S1): rechts ${GRADE_DE[r.R.ankle]}, links ${GRADE_DE[r.L.ankle]}. Fußsohlenreflex: rechts ${r.R.plantar === 'extensor' ? 'Babinski positiv' : 'plantar'}, links ${r.L.plantar === 'extensor' ? 'Babinski positiv' : 'plantar'}.`),
      ];
      const brisk = (['R', 'L'] as const).filter((S) => r[S].knee >= 3 || r[S].ankle >= 3), lost = (['R', 'L'] as const).filter((S) => r[S].knee === 0 || r[S].ankle === 0);
      for (const S of brisk) lines.push(L(`Brisk on the ${side(S).en}${r[S].plantar === 'extensor' ? ', with an extensor plantar' : ''}: an upper motor neuron lesion.`, `Lebhaft ${side(S).de}${r[S].plantar === 'extensor' ? ', mit positivem Babinski' : ''}: eine Läsion des ersten Motoneurons.`));
      const reduced = (['R', 'L'] as const).filter((S) => !lost.includes(S) && (r[S].knee === 1 || r[S].ankle === 1));
      for (const S of reduced) lines.push(L(`Reduced on the ${side(S).en}: part of the arc is cut. The knee jerk runs through two roots, L3 and L4: one lost weakens it, both (or the femoral nerve) abolish it.`,
        `Abgeschwächt ${side(S).de}: Ein Teil des Bogens ist unterbrochen. Der PSR läuft über zwei Wurzeln, L3 und L4: Fällt eine aus, wird er schwächer; fallen beide (oder der N. femoralis) aus, fehlt er.`));
      for (const S of lost) lines.push(L(`Lost on the ${side(S).en}: the arc is cut, in the root or the nerve of that reflex (knee: L3–4, femoral nerve; ankle: S1, sciatic and tibial nerves).`, `Fehlend ${side(S).de}: Der Bogen ist unterbrochen, in der Wurzel oder im Nerv dieses Reflexes (PSR: L3–4, N. femoralis; ASR: S1, N. ischiadicus und tibialis).`));
      if (!brisk.length && !lost.length && (['R', 'L'] as const).some((S) => r[S].plantar === 'extensor'))
        lines.push(L('An extensor plantar with reflexes that are not brisk: the corticospinal tract is cut, but the leg’s part of the motor strip is partly spared, so the leg’s reflexes are not released.', 'Ein positiver Babinski bei nicht gesteigerten Reflexen: Die Pyramidenbahn ist unterbrochen, das Beinareal des Motorkortex aber teilweise ausgespart, sodass die Beinreflexe nicht enthemmt sind.'));
      return { title: L('The knee jerk: a reflex arc, damped from above', 'Der Patellarsehnenreflex: ein Reflexbogen, von oben gedämpft'), body: lines };
    }
  }
}
