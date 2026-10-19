import type { LocalizedText } from '../model/i18n.ts';
import { EXAM } from '../evidence/exam.ts';
import type { CyclePhase, ValveStates } from './cardiac-cycle.ts';

/* ---------------------------------------------------------------------------
   The auscultation station's explanations (ADR-017 step 4): what the heart
   is doing at the cursor, and what the stethoscope hears because of it.

   Written per phase of the cardiac cycle and per situation, in English and
   German, and selected by what the model and the finding say now: the
   valves' states, the gradients, which sounds and murmurs the finding has at
   this site. Numbers come from the running circulation. Nothing here
   decides what is heard; it says why.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export const CYCLE_LABEL: Record<CyclePhase, LocalizedText> = {
  'iso-contraction': L('Isovolumic contraction', 'Isovolumetrische Kontraktion'),
  ejection: L('Ejection', 'Austreibung'),
  'iso-relaxation': L('Isovolumic relaxation', 'Isovolumetrische Relaxation'),
  'rapid-filling': L('Rapid filling', 'Rasche Füllung'),
  diastasis: L('Diastasis', 'Diastase'),
  'atrial-systole': L('Atrial systole', 'Vorhofsystole'),
};

export interface AuscContext {
  phase: CyclePhase;
  valves: ValveStates;
  /** what the stethoscope hears at the chosen site now (the heart-sounds finding) */
  finding: { s1?: string; a2?: string; p2?: string; s2Split?: string; added?: string[]; murmurs?: Array<{ valve: string; timing: string; grade: number }> };
  /** the running circulation */
  m: {
    hr: number; gradient: number; msGradient: number;
    /** the mitral valve is narrowed (a gradient through a normal valve is flow, not stenosis) */
    msNarrowed?: boolean; regurgFraction: number; ef: number; edv: number; la: number;
    /** A2–P2 of the beat at the cursor (ms; negative when P2 comes first), and how long this phase lasts in it */
    split: number | null; phaseMs: number;
    mitralLeaks: boolean; aorticLeaks: boolean; prematureMitralClosure: boolean;
    af: boolean;
    /** where in the breath this beat's P2 fell */
    breath: 'insp' | 'exp' | null;
  };
  /** the listening context, to say where a sound could be heard instead */
  site: string; bell: boolean;
}

export interface AuscText { title: LocalizedText; body: LocalizedText[] }

const r = Math.round;
const has = (c: AuscContext, s: string) => (c.finding.added ?? []).includes(s);
const murmur = (c: AuscContext, valve: string, timing: string) => (c.finding.murmurs ?? []).find((x) => x.valve === valve && x.timing === timing);

export function explainCycle(c: AuscContext): AuscText {
  const m = c.m, body: LocalizedText[] = [];
  const ms = `${r(m.phaseMs)} ms`;
  switch (c.phase) {
    case 'iso-contraction': {
      body.push(L(`The ventricles have begun to contract. Their pressure has risen above the atria’s, so the mitral and tricuspid valves have shut: that closure is the first heart sound, S1. The aortic and pulmonary valves are still closed, because the ventricles are not yet above the arteries. With every valve closed the volume cannot change, and the pressure climbs steeply (${ms} here).`,
        `Die Kammern haben begonnen, sich zusammenzuziehen. Ihr Druck ist über den der Vorhöfe gestiegen, deshalb haben sich Mitral- und Trikuspidalklappe geschlossen: Dieser Schluss ist der erste Herzton, S1. Aorten- und Pulmonalklappe sind noch zu, weil die Kammern den Druck der Arterien noch nicht erreicht haben. Bei geschlossenen Klappen kann sich das Volumen nicht ändern, und der Druck steigt steil an (hier ${ms}).`));
      if (m.mitralLeaks) body.push(L('Here the mitral valve leaks: blood escapes back into the left atrium as soon as the pressure rises, so this phase is not truly isovolumic, and the murmur starts with S1. That is why mitral regurgitation is pansystolic.',
        'Hier ist die Mitralklappe undicht: Sobald der Druck steigt, entweicht Blut zurück in den linken Vorhof. Diese Phase ist deshalb nicht wirklich isovolumetrisch, und das Geräusch beginnt mit S1. Darum ist die Mitralinsuffizienz holosystolisch.'));
      if (c.finding.s1 === 'loud') body.push(L('S1 is loud: the stenotic mitral valve is still wide open when the ventricle starts to contract, held open by the high atrial pressure, and it slams shut from there.',
        'S1 ist laut: Die stenotische Mitralklappe steht noch weit offen, wenn die Kammer sich zu kontrahieren beginnt, offen gehalten vom hohen Vorhofdruck, und schlägt von dort zu.'));
      if (m.prematureMitralClosure) body.push(L('The mitral valve had already closed in diastole: the leaking aortic valve filled the ventricle until its pressure passed the atrium’s. S1 is soft for that reason.',
        'Die Mitralklappe war schon in der Diastole geschlossen: Die undichte Aortenklappe hat die Kammer gefüllt, bis ihr Druck den des Vorhofs übertraf. Deshalb ist S1 leise.'));
      return { title: L('Isovolumic contraction: the first heart sound', 'Isovolumetrische Kontraktion: der erste Herzton'), body };
    }
    case 'ejection': {
      body.push(L(`The left ventricle’s pressure has passed the aorta’s: the aortic valve is open and blood leaves (${ms} of ejection in this beat). Through a healthy valve a few mmHg drive the whole stroke, and the blood moves silently.`,
        `Der Druck im linken Ventrikel hat den der Aorta überholt: Die Aortenklappe ist offen, und Blut strömt aus (in diesem Schlag ${ms} Austreibung). Durch eine gesunde Klappe treiben wenige mmHg das ganze Schlagvolumen, und das Blut fließt lautlos.`));
      const es = murmur(c, 'aortic', 'ejection-systolic');
      if (m.gradient >= 12) body.push(L(`Here the narrowed valve needs ${r(m.gradient)} mmHg to pass the flow. The jet through it is turbulent: that turbulence is the ejection systolic murmur, crescendo–decrescendo because it follows the flow, which rises and falls through ejection.${es ? ` At this site it is grade ${es.grade}/6.` : ' At this site it is too faint to hear: listen at the aortic area, in the second right intercostal space.'}`,
        `Hier braucht die verengte Klappe ${r(m.gradient)} mmHg, um den Fluss durchzulassen. Der Strahl ist turbulent: Diese Turbulenz ist das Austreibungsgeräusch, crescendo–decrescendo, weil es dem Fluss folgt, der in der Austreibung an- und abschwillt.${es ? ` An dieser Stelle hat es Grad ${es.grade}/6.` : ' An dieser Stelle ist es zu leise: Hören Sie über dem Aortenareal, im zweiten Interkostalraum rechts.'}`));
      if (m.mitralLeaks) body.push(L(`Part of each stroke goes back into the left atrium instead (regurgitant fraction ${r(m.regurgFraction * 100)} %). The ventricle empties through two openings, so ejection into the aorta ends early, and A2 with it.`,
        `Ein Teil jedes Schlags fließt stattdessen zurück in den linken Vorhof (Regurgitationsfraktion ${r(m.regurgFraction * 100)} %). Die Kammer leert sich durch zwei Öffnungen, deshalb endet die Austreibung in die Aorta früh, und A2 mit ihr.`));
      if (m.aorticLeaks) body.push(L('The ventricle ejects a large stroke, because what leaked back in the last diastole leaves again: the pulse pressure is wide.',
        'Die Kammer wirft ein großes Schlagvolumen aus, weil das, was in der letzten Diastole zurückgeflossen ist, wieder hinaus muss: Die Blutdruckamplitude ist groß.'));
      return { title: L('Ejection', 'Austreibung'), body };
    }
    case 'iso-relaxation': {
      body.push(L(`The ventricles relax. Their pressure has fallen below the arteries’, and the aortic and pulmonary valves have shut: A2 and P2, the second heart sound. With every valve closed again the pressure falls without the volume changing (${ms} here), until it drops below the atria’s.`,
        `Die Kammern erschlaffen. Ihr Druck ist unter den der Arterien gefallen, und Aorten- und Pulmonalklappe haben sich geschlossen: A2 und P2, der zweite Herzton. Bei wieder geschlossenen Klappen fällt der Druck, ohne dass sich das Volumen ändert (hier ${ms}), bis er unter den der Vorhöfe sinkt.`));
      if (m.split != null) {
        const s = r(m.split), when = m.breath === 'insp' ? L(' This beat’s S2 fell in inspiration.', ' Der zweite Ton dieses Schlags fiel in die Einatmung.') : m.breath === 'exp' ? L(' This beat’s S2 fell in expiration.', ' Der zweite Ton dieses Schlags fiel in die Ausatmung.') : L('', '');
        if (s >= 0) body.push(L(`P2 follows A2 by ${s} ms.${when.en} Breathing in fills the right ventricle more and the left less: the right ejects for longer and P2 comes later, so the split widens in inspiration and narrows in expiration.`,
          `P2 folgt A2 nach ${s} ms.${when.de} Die Einatmung füllt die rechte Kammer stärker und die linke weniger: Die rechte wirft länger aus, P2 kommt später, und die Spaltung wird in der Einatmung weiter, in der Ausatmung enger.`));
        else body.push(L(`A2 comes ${-s} ms after P2: reversed splitting.${when.en} The left ventricle ejects so long (against a narrowed aortic valve, or activated late) that its valve closes after the pulmonary one. Inspiration, which delays P2, then brings the two together.`,
          `A2 kommt ${-s} ms nach P2: paradoxe Spaltung.${when.de} Die linke Kammer wirft so lange aus (gegen eine verengte Aortenklappe, oder verspätet erregt), dass ihre Klappe nach der Pulmonalklappe schließt. Die Einatmung, die P2 verzögert, bringt die beiden dann zusammen.`));
      }
      if (c.finding.a2 === 'soft' || c.finding.a2 === 'absent') body.push(L('A2 is soft: a stiff, calcified aortic valve barely moves as it closes.', 'A2 ist leise: Eine steife, verkalkte Aortenklappe bewegt sich beim Schließen kaum.'));
      if (m.mitralLeaks) body.push(L('The mitral valve still leaks: the pressure falls, but blood keeps escaping into the atrium until the valve opens.', 'Die Mitralklappe ist weiter undicht: Der Druck fällt, aber bis die Klappe öffnet, entweicht weiter Blut in den Vorhof.'));
      return { title: L('Isovolumic relaxation: the second heart sound', 'Isovolumetrische Relaxation: der zweite Herzton'), body };
    }
    case 'rapid-filling': {
      body.push(L(`The ventricle’s pressure has fallen below the atrium’s: the mitral valve has opened, and blood falls into the relaxing ventricle (${ms} of rapid filling). Most of the ventricle’s filling happens now.`,
        `Der Kammerdruck ist unter den Vorhofdruck gefallen: Die Mitralklappe hat sich geöffnet, und Blut stürzt in die erschlaffende Kammer (${ms} rasche Füllung). Jetzt geschieht der größte Teil der Füllung.`));
      if (m.ef < 40 && m.edv >= 180) body.push(has(c, 's3')
        ? L(`S3: the inflow into this dilated, overfilled ventricle (end-diastolic volume ${r(m.edv)} mL, left atrial pressure ${r(m.la)} mmHg) is brought to a sudden stop as the ventricle reaches the limit of its stretch. The vibration is the third heart sound, low-pitched: here you hear it.`,
          `S3: Der Einstrom in diese dilatierte, überfüllte Kammer (enddiastolisches Volumen ${r(m.edv)} mL, linker Vorhofdruck ${r(m.la)} mmHg) wird plötzlich gebremst, wenn die Kammer an die Grenze ihrer Dehnung kommt. Die Schwingung ist der dritte Herzton, tieffrequent: Hier hören Sie ihn.`)
        : L(`In this dilated, overfilled ventricle the inflow stops abruptly: a third heart sound. It is low-pitched: listen with the bell at the apex.`,
          `In dieser dilatierten, überfüllten Kammer bricht der Einstrom abrupt ab: ein dritter Herzton. Er ist tieffrequent: Hören Sie mit der Glocke über der Herzspitze.`));
      if (m.msNarrowed && m.msGradient >= EXAM.msAudibleGradient) body.push(L(`The stenotic mitral valve opens with a snap, then forces blood through its narrow orifice: a mean gradient of ${m.msGradient.toFixed(1)} mmHg drives a low rumble that lasts as long as filling does. Filling never pauses here: the narrowing keeps the atrium above the ventricle all through diastole.`,
          `Die stenotische Mitralklappe öffnet mit einem Klick (Öffnungston) und presst dann Blut durch ihre enge Öffnung: Ein mittlerer Gradient von ${m.msGradient.toFixed(1).replace('.', ',')} mmHg treibt ein tiefes Rumpeln, das so lange dauert wie die Füllung. Die Füllung pausiert hier nie: Die Enge hält den Vorhof die ganze Diastole über dem Ventrikel.`));
      if (m.aorticLeaks) body.push(L(`Blood also leaks back from the aorta through the incompetent valve (regurgitant fraction ${r(m.regurgFraction * 100)} %): the early diastolic murmur, decrescendo because the aortic pressure that drives it falls. It is high-pitched and faint: listen at the left sternal edge, the patient sitting forward, breath held out.`,
          `Zusätzlich fließt Blut durch die undichte Klappe aus der Aorta zurück (Regurgitationsfraktion ${r(m.regurgFraction * 100)} %): das frühdiastolische Geräusch, decrescendo, weil der Aortendruck, der es treibt, abfällt. Es ist hochfrequent und leise: Hören Sie am linken Sternalrand, die Patientin oder der Patient vorgebeugt, in Exspiration angehalten.`));
      return { title: L('Rapid filling', 'Rasche Füllung'), body };
    }
    case 'diastasis': {
      body.push(L(`Atrium and ventricle are at almost the same pressure, and filling slows to a trickle (${ms} of diastasis). The heart is silent. When the rate rises, this is the phase that disappears first.`,
        `Vorhof und Kammer haben fast denselben Druck, und die Füllung wird zum Rinnsal (${ms} Diastase). Das Herz ist still. Steigt die Frequenz, verschwindet zuerst diese Phase.`));
      if (c.valves.mitral === 'closed') body.push(L('The mitral valve has already floated shut before the next beat.', 'Die Mitralklappe ist vor dem nächsten Schlag schon zugeschwommen.'));
      if (m.aorticLeaks) body.push(L('The aortic leak goes on: the ventricle keeps filling from the aorta as well as from the atrium.', 'Das Aortenleck geht weiter: Die Kammer füllt sich weiter aus der Aorta wie aus dem Vorhof.'));
      return { title: L('Diastasis', 'Diastase'), body };
    }
    case 'atrial-systole': {
      if (m.af) body.push(L('In atrial fibrillation the atria do not contract: nothing tops the ventricle up at the end of diastole, and there is no fourth heart sound.',
        'Bei Vorhofflimmern kontrahieren die Vorhöfe nicht: Nichts füllt die Kammer am Ende der Diastole nach, und es gibt keinen vierten Herzton.'));
      else body.push(L(`The atria contract and top up the ventricles just before they beat (the last ${ms} of diastole). At rest this adds about a fifth of the filling; at a fast rate, or into a stiff ventricle, much more of it.`,
        `Die Vorhöfe kontrahieren und füllen die Kammern kurz vor deren Schlag nach (die letzten ${ms} der Diastole). In Ruhe trägt das etwa ein Fünftel zur Füllung bei; bei hoher Frequenz oder in eine steife Kammer viel mehr.`));
      if (has(c, 's4')) body.push(L('S4: here the atrial kick meets a stiff, pressure-loaded ventricle whose pressure rises steeply as it fills. The sudden check to the inflow is the fourth heart sound, just before S1.',
        'S4: Hier trifft der Vorhofstoß auf eine steife, druckbelastete Kammer, deren Druck beim Füllen steil ansteigt. Das plötzliche Abbremsen des Einstroms ist der vierte Herzton, kurz vor S1.'));
      if (m.msNarrowed && m.msGradient >= EXAM.msAudibleGradient && !m.af) body.push(L('The atrial contraction drives the last of the blood through the narrow mitral valve: the rumble swells just before S1 (presystolic accentuation).',
        'Die Vorhofkontraktion treibt das letzte Blut durch die enge Mitralklappe: Das Rumpeln schwillt kurz vor S1 an (präsystolische Verstärkung).'));
      if (c.valves.mitral === 'closed' && !m.af) body.push(L('The mitral valve is already closed: what the atrium does now no longer reaches the ventricle.', 'Die Mitralklappe ist schon geschlossen: Was der Vorhof jetzt tut, erreicht die Kammer nicht mehr.'));
      return { title: L('Atrial systole', 'Vorhofsystole'), body };
    }
  }
}

/** Every text this module can produce, for the completeness test (EN and DE for each). */
export function allAuscTexts(): LocalizedText[] {
  const out: LocalizedText[] = Object.values(CYCLE_LABEL);
  const finding = { s1: 'loud', a2: 'soft', added: ['s3', 's4'], murmurs: [{ valve: 'aortic', timing: 'ejection-systolic', grade: 3 }] };
  for (const phase of Object.keys(CYCLE_LABEL) as CyclePhase[])
    for (const flags of [{}, { mitralLeaks: true, aorticLeaks: true, prematureMitralClosure: true, af: true, gradient: 50, msGradient: 8, msNarrowed: true, ef: 25, edv: 220, split: -20 }, { split: 30, breath: 'insp' as const }]) {
      const x = explainCycle({ phase, valves: { mitral: 'closed', aortic: 'closed', tricuspid: 'closed', pulmonic: 'closed' }, finding, site: 'chest.mitral-area', bell: true,
        m: { hr: 70, gradient: 2, msGradient: 1, regurgFraction: 0.4, ef: 60, edv: 120, la: 8, split: null, phaseMs: 80, mitralLeaks: false, aorticLeaks: false, prematureMitralClosure: false, af: false, breath: null, ...flags } });
      out.push(x.title, ...x.body);
    }
  return out;
}
