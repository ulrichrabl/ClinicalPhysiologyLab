import type { LocalizedText } from '../model/i18n.ts';
import type { ElectricalParams } from '../physiology/heart/electrical.ts';
import type { Moment } from './ecg-timeline.ts';

/* ---------------------------------------------------------------------------
   The ECG station's explanations (ADR-017): what the heart is doing at the
   cursor, and why the tracing looks the way it does there.

   The only authored part of a station. A text is chosen by what the model
   is doing at that instant (the phase, the route the wave took, why a P
   wave was not conducted) and by the model's settings (potassium,
   ischaemia, chamber size); numbers are the model's own. Every text is in
   English and German. Like the card texts, these are drafts until a
   clinician has read them.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
type Parts = { title: LocalizedText; body: LocalizedText[] };

export interface ExplainInput {
  moment: Moment;
  e: ElectricalParams;
  K: number;
  /** the model's intervals for the beat at the cursor (ms) and the rate */
  metrics: { HR: number; PR: number | null; QRS: number; QT: number; QTc: number };
}

const n = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '—' : String(Math.round(x)));

function transmural(e: ElectricalParams) { return (e.ischaemia === 'anterior' || e.ischaemia === 'inferior' || e.ischaemia === 'lateral') && e.injury > 0; }

function rest(x: ExplainInput): Parts {
  const { moment: m, e } = x;
  if (e.ventricular === 'vf') return { title: L('Ventricular fibrillation', 'Kammerflimmern'), body: [L(
    'There is no organised activation: countless wavelets wander through the ventricles. The tracing is a chaotic oscillation with no QRS complexes, and the heart pumps nothing.',
    'Es gibt keine geordnete Erregung: unzählige Erregungswellen kreisen ungeordnet in den Kammern. Das EKG zeigt eine chaotische Schwankung ohne QRS-Komplexe, und das Herz pumpt nicht.')] };
  if (m.dropped && m.a) {
    const why = m.a.notConducted;
    return { title: L('A P wave that is not conducted', 'Eine nicht übergeleitete P-Welle'), body: [
      why === 'complete-block' ? L('The AV node conducts nothing. The atria keep the sinus rhythm; below the block the ventricles have their own, slow escape rhythm. P waves and QRS complexes march through each other, unrelated.',
        'Der AV-Knoten leitet nichts über. Die Vorhöfe folgen dem Sinusrhythmus; unterhalb des Blocks haben die Kammern ihren eigenen, langsamen Ersatzrhythmus. P-Wellen und QRS-Komplexe laufen unabhängig voneinander durch.')
        : why === 'refractory' ? L('This impulse reaches the AV node while the ventricles are still refractory from the last beat, so it goes no further.',
          'Dieser Impuls erreicht den AV-Knoten, während die Kammern vom letzten Schlag noch refraktär sind, und wird nicht weitergeleitet.')
          : e.avBlock === 'wenckebach' ? L('The AV node has recovered less after each beat, so the PR interval has lengthened until this impulse fails altogether: a dropped beat. After the pause the node has recovered, and the cycle starts again (Wenckebach, Mobitz I).',
            'Der AV-Knoten hat sich nach jedem Schlag weniger erholt; das PR-Intervall wurde länger, bis dieser Impuls ganz ausfällt: ein ausgefallener Schlag. Nach der Pause ist der Knoten erholt, und der Zyklus beginnt von vorn (Wenckebach, Mobitz I).')
            : L('This impulse is blocked below the AV node without warning: the PR intervals before it were constant (Mobitz II). No QRS follows this P wave.',
              'Dieser Impuls wird ohne Vorwarnung unterhalb des AV-Knotens blockiert: Die PR-Intervalle davor waren konstant (Mobitz II). Auf diese P-Welle folgt kein QRS.'),
    ] };
  }
  if (m.atria === 'fibrillating') return { title: L('Fibrillating atria', 'Flimmernde Vorhöfe'), body: [L(
    'The atria are never activated as a whole: many small wavelets circle in them, 300 to 600 times a minute. They make no P wave, only a fine, irregular baseline (f waves). The AV node lets a random selection through, so the ventricles beat irregularly.',
    'Die Vorhöfe werden nie als Ganzes erregt: viele kleine Erregungswellen kreisen in ihnen, 300- bis 600-mal pro Minute. Sie erzeugen keine P-Welle, nur eine feine, unregelmäßige Grundlinie (f-Wellen). Der AV-Knoten lässt eine zufällige Auswahl durch, deshalb schlagen die Kammern unregelmäßig.')] };
  if (m.atria === 'flutter') return { title: L('Atrial flutter', 'Vorhofflattern'), body: [L(
    'One large wave circles the right atrium around the tricuspid valve, about 300 times a minute. Each lap is a flutter wave: a sawtooth, best seen in II, III and aVF. The AV node conducts only every second to fourth wave.',
    'Eine große Erregungswelle kreist im rechten Vorhof um die Trikuspidalklappe, etwa 300-mal pro Minute. Jede Runde ist eine Flatterwelle: ein Sägezahnmuster, am besten in II, III und aVF zu sehen. Der AV-Knoten leitet nur jede zweite bis vierte Welle über.')] };
  return { title: L('Diastole: the electrical baseline', 'Diastole: die elektrische Grundlinie'), body: [L(
    'Every cell is repolarised and waits for the next impulse. With no voltage difference across the heart there is no dipole, so the line is flat. This stretch between T and the next P is the baseline every deflection is measured from.',
    'Jede Zelle ist repolarisiert und wartet auf den nächsten Impuls. Ohne Spannungsunterschied im Herzen gibt es keinen Dipol, die Linie ist flach. Diese Strecke zwischen T und der nächsten P-Welle ist die Grundlinie, an der jeder Ausschlag gemessen wird.')] };
}

function pWave(x: ExplainInput): Parts {
  const { moment: m, e, K } = x;
  const body = [L(
    'The sinus node fires, and the wave crosses the right atrium, then the left. The atrial vector points down and to the left, toward the positive pole of lead II: P is upright in II. In V1 it is small and often biphasic, because the right atrium lies toward V1 and the left atrium away from it.',
    'Der Sinusknoten feuert, und die Erregung läuft über den rechten, dann den linken Vorhof. Der Vorhofvektor zeigt nach unten links, zum Pluspol von Ableitung II: P ist in II positiv. In V1 ist sie klein und oft biphasisch, weil der rechte Vorhof zu V1 hin liegt und der linke von V1 weg.')];
  if (K >= 6.5) body.push(L('High potassium has partly depolarised atrial muscle at rest. Fewer cells can fire, so the P wave is small and flat: atrial muscle fails first.',
    'Hohes Kalium hat die Vorhofmuskulatur in Ruhe teilweise depolarisiert. Weniger Zellen können feuern, die P-Welle wird klein und flach: Die Vorhofmuskulatur versagt zuerst.'));
  if (e.laSize > 1.3) body.push(L('The enlarged left atrium takes longer to activate: the P wave is broad and notched in II (P mitrale), with a deep negative end in V1.',
    'Der vergrößerte linke Vorhof braucht länger für die Erregung: Die P-Welle ist in II breit und doppelgipflig (P mitrale), mit tiefem negativem Ende in V1.'));
  if (e.raSize > 1.3) body.push(L('The enlarged right atrium makes a larger right-atrial vector: P is tall and peaked in II (P pulmonale).',
    'Der vergrößerte rechte Vorhof erzeugt einen größeren rechtsatrialen Vektor: P ist in II hoch und spitz (P pulmonale).'));
  const why = m.a?.notConducted;
  if (m.a && m.a.conductedAt == null) body.push(why === 'dissociated'
    ? L('The ventricles are driven by their own focus, so no QRS follows from this P wave: atria and ventricles are dissociated.', 'Die Kammern werden von ihrem eigenen Fokus getrieben, auf diese P-Welle folgt kein QRS: Vorhöfe und Kammern sind dissoziiert.')
    : L('This impulse will not reach the ventricles: no QRS follows this P wave.', 'Dieser Impuls wird die Kammern nicht erreichen: Auf diese P-Welle folgt kein QRS.'));
  return { title: L('The atria depolarise', 'Die Vorhöfe depolarisieren'), body };
}

function prSegment(x: ExplainInput): Parts {
  const { e, metrics } = x;
  const pr = x.moment.a?.conductedAt != null ? x.moment.a.conductedAt - x.moment.a.t : metrics.PR;
  const body: LocalizedText[] = [];
  if ((pr ?? 0) > 200) {
    body.push(L(`Conduction through the AV node is slowed. Every impulse gets through, but late: PR ${n(pr)} ms, more than 200 ms. This is first-degree AV block.`,
      `Die Überleitung im AV-Knoten ist verlangsamt. Jeder Impuls kommt durch, aber spät: PR ${n(pr)} ms, mehr als 200 ms. Das ist ein AV-Block I. Grades.`));
  } else {
    body.push(L(`The atria are fully depolarised, and the AV node conducts slowly, by design. It is too small to make a surface signal, so the line is flat. The delay lets the atria finish filling the ventricles. Then the His bundle and the bundle branches carry the impulse down the septum. PR ${n(pr)} ms.`,
      `Die Vorhöfe sind vollständig depolarisiert, und der AV-Knoten leitet absichtlich langsam. Er ist zu klein, um an der Haut ein Signal zu erzeugen, deshalb ist die Linie flach. Die Verzögerung lässt die Vorhöfe die Kammern fertig füllen. Dann tragen His-Bündel und Tawara-Schenkel den Impuls das Septum hinab. PR ${n(pr)} ms.`));
  }
  if (e.avBlock === 'wenckebach') body.push(L('Here the node recovers less after each beat, so PR lengthens from beat to beat until one P wave is not conducted (Wenckebach).',
    'Hier erholt sich der Knoten nach jedem Schlag weniger, PR wird von Schlag zu Schlag länger, bis eine P-Welle nicht übergeleitet wird (Wenckebach).'));
  if (x.K >= 6.5) body.push(L('High potassium slows conduction here too.', 'Hohes Kalium verlangsamt auch hier die Leitung.'));
  return { title: L('The impulse waits in the AV node', 'Der Impuls wartet im AV-Knoten'), body };
}

function qrs(x: ExplainInput): Parts {
  const { moment: m, e, K } = x;
  const v = m.v!;
  /* The model's own QRS duration, as its machine reports it (from the activation through the AV node to the J point). */
  const width = v.qrsEnd - v.t;
  const w = n(width);
  let title: LocalizedText, body: LocalizedText[];
  if (v.route === 'rbbb') {
    title = L('Right bundle branch block', 'Rechtsschenkelblock');
    body = [L(`The right bundle does not conduct. The septum and the left ventricle activate on time, so QRS begins normally. The right ventricle is reached late and slowly, through muscle from the left. That late wave runs to the right and forward, unopposed: an R′ in V1 and a broad, slurred S in I and V6. QRS ${w} ms.`,
      `Der rechte Tawara-Schenkel leitet nicht. Septum und linker Ventrikel werden rechtzeitig erregt, QRS beginnt normal. Der rechte Ventrikel wird spät und langsam erreicht, über die Muskulatur von links. Diese späte Erregung läuft nach rechts und vorn, ohne Gegenspieler: ein R′ in V1 und ein breites, verschliffenes S in I und V6. QRS ${w} ms.`)];
    if (m.late) body.push(m.late.reached ? L('Now: the late right ventricle.', 'Jetzt: der späte rechte Ventrikel.') : L('Now: the left ventricle; the right is still waiting.', 'Jetzt: der linke Ventrikel; der rechte wartet noch.'));
  } else if (v.route === 'lbbb') {
    title = L('Left bundle branch block', 'Linksschenkelblock');
    body = [L(`The left bundle does not conduct. The septum is activated from the right, from right to left, so the small septal r in V1 and q in V6 disappear. The left ventricle is then reached slowly, cell to cell, through muscle: a broad, notched R in I and V6, a broad QS in V1. QRS ${w} ms.`,
      `Der linke Tawara-Schenkel leitet nicht. Das Septum wird von rechts erregt, von rechts nach links, deshalb fehlen das kleine septale r in V1 und das q in V6. Der linke Ventrikel wird dann langsam erreicht, von Zelle zu Zelle über die Muskulatur: ein breites, gekerbtes R in I und V6, ein breites QS in V1. QRS ${w} ms.`)];
  } else if (v.route === 'pre-excited') {
    title = L('Pre-excitation', 'Präexzitation');
    body = [L(`An accessory pathway bypasses the AV node and starts activating the ventricle early and slowly, through muscle: the slurred upstroke, the delta wave, which shortens PR. When the impulse through the AV node arrives, the rest of the ventricles activate normally. QRS ${w} ms.`,
      `Eine akzessorische Leitungsbahn umgeht den AV-Knoten und beginnt die Kammer früh und langsam über die Muskulatur zu erregen: der träge Anstieg, die Deltawelle, die PR verkürzt. Wenn der Impuls über den AV-Knoten ankommt, wird der Rest der Kammern normal erregt. QRS ${w} ms.`)];
  } else if (v.origin === 'vt') {
    title = L('A ventricular focus: tachycardia', 'Ein ventrikulärer Fokus: Tachykardie');
    body = [L(`A focus in the ventricle fires on its own, about ${n(x.metrics.HR)} times a minute. The wave starts there and spreads cell to cell through muscle, not through the bundles: QRS is broad (${w} ms) and bizarre. The atria carry on at their own rate, dissociated.`,
      `Ein Fokus in der Kammer feuert selbstständig, etwa ${n(x.metrics.HR)}-mal pro Minute. Die Erregung beginnt dort und breitet sich von Zelle zu Zelle über die Muskulatur aus, nicht über die Schenkel: QRS ist breit (${w} ms) und bizarr. Die Vorhöfe schlagen in ihrer eigenen Frequenz weiter, dissoziiert.`)];
  } else if (v.route === 'ectopic') {
    title = L('A ventricular escape beat', 'Ein ventrikulärer Ersatzschlag');
    body = [L(`Nothing has reached the ventricles from above, so a focus below the block fires on its own, slowly, about 30 to 40 times a minute. Its wave spreads through muscle: QRS is broad (${w} ms).`,
      `Von oben hat nichts die Kammern erreicht, deshalb feuert ein Fokus unterhalb des Blocks selbstständig, langsam, etwa 30- bis 40-mal pro Minute. Seine Erregung breitet sich über die Muskulatur aus: QRS ist breit (${w} ms).`)];
  } else {
    title = L('The ventricles depolarise', 'Die Kammern depolarisieren');
    body = [L(`The His bundle, the bundle branches and the Purkinje fibres spread the impulse through both ventricles within about ${w} ms. The septum goes first, from left to right: the small r in V1 and the small q in the lateral leads. Then the thick left ventricle dominates, down and to the left: a tall R in II, a deep S in V1. The base of the heart is last.`,
      `His-Bündel, Tawara-Schenkel und Purkinje-Fasern verteilen den Impuls in etwa ${w} ms über beide Kammern. Zuerst das Septum, von links nach rechts: das kleine r in V1 und das kleine q in den lateralen Ableitungen. Dann überwiegt der dicke linke Ventrikel, nach unten links: ein hohes R in II, ein tiefes S in V1. Zuletzt die Herzbasis.`)];
    if (v.origin === 'escape') body.unshift(L('Nothing came from the sinus node in time, so the AV junction fired by itself. The wave then runs down the normal path, and QRS is narrow.',
      'Vom Sinusknoten kam rechtzeitig nichts, deshalb hat der AV-Übergang selbst gefeuert. Die Erregung läuft dann den normalen Weg, und QRS ist schmal.'));
  }
  if (K >= 6.5) body.push(L('High potassium also slows conduction in ventricular muscle, so QRS widens.', 'Hohes Kalium verlangsamt auch die Leitung in der Kammermuskulatur, deshalb wird QRS breiter.'));
  if (e.lvMass > 1.3 && v.route !== 'ectopic') body.push(L('The thick left ventricle makes a larger left vector: tall R waves on the left, deep S waves in V1 and V2.',
    'Der dicke linke Ventrikel erzeugt einen größeren linken Vektor: hohe R-Zacken links, tiefe S-Zacken in V1 und V2.'));
  if (e.rvMass > 1.3 && v.route !== 'ectopic') body.push(L('The thick right ventricle pulls the vector to the right and forward: right axis deviation and a dominant R in V1.',
    'Der dicke rechte Ventrikel zieht den Vektor nach rechts und vorn: Rechtsabweichung der Achse und ein dominantes R in V1.'));
  return { title, body };
}

function st(x: ExplainInput): Parts {
  const { e, K } = x;
  const body = [L('All ventricular muscle is depolarised at once, on the plateau of its action potential. With no voltage difference between regions there is no dipole: the ST segment sits on the baseline.',
    'Die gesamte Kammermuskulatur ist gleichzeitig depolarisiert, auf dem Plateau ihres Aktionspotentials. Ohne Spannungsunterschied zwischen den Regionen gibt es keinen Dipol: Die ST-Strecke liegt auf der Grundlinie.')];
  if (transmural(e)) body.push(L('Here part of the wall is injured. Injured cells cannot hold the plateau, so current flows between injured and healthy muscle (the injury current). Leads facing the injured wall show ST elevation; leads facing away show ST depression.',
    'Hier ist ein Teil der Wand geschädigt. Geschädigte Zellen halten das Plateau nicht, deshalb fließt Strom zwischen geschädigter und gesunder Muskulatur (Verletzungsstrom). Ableitungen über der geschädigten Wand zeigen ST-Hebungen, gegenüberliegende ST-Senkungen.'));
  if (e.ischaemia === 'subendocardial' && e.injury > 0) body.push(L('The inner layer is ischaemic. Its injury current points away from the surface, so many leads show ST depression.',
    'Die innere Schicht ist ischämisch. Ihr Verletzungsstrom zeigt von der Oberfläche weg, deshalb zeigen viele Ableitungen ST-Senkungen.'));
  if (e.pericarditis > 0) body.push(L('The inflamed epicardium all round the heart gives a diffuse injury current: concave ST elevation in most leads, with PR depression.',
    'Das entzündete Epikard rund um das Herz erzeugt einen diffusen Verletzungsstrom: konkave ST-Hebungen in den meisten Ableitungen, mit PR-Senkung.'));
  if (e.digoxin > 0) body.push(L('Digoxin shortens the plateau and slopes the ST segment down (the "reverse tick").', 'Digoxin verkürzt das Plateau und lässt die ST-Strecke muldenförmig abfallen.'));
  if (e.brugada > 0) body.push(L('Loss of sodium current in the right ventricular outflow tract makes repolarisation there early and uneven: coved ST elevation in V1 and V2.',
    'Der Verlust des Natriumstroms im rechtsventrikulären Ausflusstrakt macht die Repolarisation dort früh und ungleichmäßig: schulterförmige ST-Hebung in V1 und V2.'));
  if (e.earlyRepol > 0) body.push(L('Early repolarisation: a notched J point and slight, concave ST elevation, a normal variant.', 'Frühe Repolarisation: ein gekerbter J-Punkt und leichte, konkave ST-Hebung, eine Normvariante.'));
  if (K < 3.5) body.push(L('Low potassium sags the ST segment slightly.', 'Niedriges Kalium senkt die ST-Strecke leicht ab.'));
  return { title: L('Every ventricular cell is on its plateau', 'Jede Kammerzelle ist auf ihrem Plateau'), body };
}

function tWave(x: ExplainInput): Parts {
  const { moment: m, e, K, metrics } = x;
  const v = m.v!;
  const qt = n(v.tEnd - v.t);
  const body: LocalizedText[] = [];
  if (K >= 6) body.push(L('High potassium opens more potassium channels and speeds repolarisation: T is tall, narrow and peaked, the first sign of hyperkalaemia.',
    'Hohes Kalium öffnet mehr Kaliumkanäle und beschleunigt die Repolarisation: T wird hoch, schmal und spitz, das erste Zeichen der Hyperkaliämie.'));
  else if (K < 3.5) body.push(L('Low potassium slows repolarisation: T flattens, and a U wave follows it.', 'Niedriges Kalium verlangsamt die Repolarisation: T wird flach, und eine U-Welle folgt.'));
  else body.push(L(`Repolarisation spreads the opposite way to depolarisation: epicardium before endocardium, because epicardial action potentials are shorter. A wave of recovery moving outward makes a dipole pointing the same way as depolarisation did, so T is upright where QRS is mainly upright. The end of T is the end of QT (${qt} ms).`,
    `Die Repolarisation läuft umgekehrt wie die Depolarisation: Epikard vor Endokard, weil die epikardialen Aktionspotentiale kürzer sind. Eine nach außen laufende Erholungswelle erzeugt einen Dipol in derselben Richtung wie die Depolarisation, deshalb ist T dort positiv, wo QRS überwiegend positiv ist. Das Ende von T ist das Ende von QT (${qt} ms).`));
  if (v.route !== 'normal') body.push(L('After an abnormal depolarisation, repolarisation also takes an abnormal path: T points away from the end of QRS (discordant). This is expected, not a sign of ischaemia.',
    'Nach einer abnormen Depolarisation nimmt auch die Repolarisation einen abnormen Weg: T zeigt vom Ende des QRS weg (diskordant). Das ist zu erwarten und kein Zeichen einer Ischämie.'));
  if (e.repolarisation > 1.15) body.push(L(`Repolarisation is prolonged: QT ${qt} ms, QTc ${n(metrics.QTc)} ms.`, `Die Repolarisation ist verlängert: QT ${qt} ms, QTc ${n(metrics.QTc)} ms.`));
  if (transmural(e)) body.push(L('Early in a transmural infarct, T is tall and broad in the leads facing it (hyperacute T).', 'Früh im transmuralen Infarkt ist T in den zugewandten Ableitungen hoch und breit (hyperakutes T).'));
  if (e.ischaemia === 'wellens' && e.injury > 0) body.push(L('After reperfusion of the LAD, T in V2 and V3 is deeply inverted or biphasic (Wellens pattern), with little ST change.',
    'Nach Reperfusion der RIVA ist T in V2 und V3 tief negativ oder biphasisch (Wellens-Muster), mit wenig ST-Veränderung.'));
  if (e.lvMass > 1.35 && v.route === 'normal') body.push(L('In a thick left ventricle repolarisation runs out of order: ST depression and inverted T on the left (strain).',
    'Im dicken linken Ventrikel läuft die Repolarisation ungeordnet: ST-Senkung und negatives T links (Strain).'));
  if (e.digoxin > 0) body.push(L('Digoxin also flattens T and shortens QT.', 'Digoxin flacht T außerdem ab und verkürzt QT.'));
  return { title: L('The ventricles repolarise', 'Die Kammern repolarisieren'), body };
}

/** What the heart is doing at the cursor, and why the tracing looks as it does. */
export function explain(x: ExplainInput): { title: LocalizedText; body: LocalizedText[] } {
  switch (x.moment.phase) {
    case 'P': return pWave(x);
    case 'PR': return prSegment(x);
    case 'QRS': return qrs(x);
    case 'ST': return st(x);
    case 'T': return tWave(x);
    default: return rest(x);
  }
}

/** The names of the phases, as buttons. */
export const PHASE_LABEL: Record<string, LocalizedText> = {
  rest: L('Baseline', 'Grundlinie'), P: L('P', 'P'), PR: L('PR', 'PR'), QRS: L('QRS', 'QRS'), ST: L('ST', 'ST'), T: L('T', 'T'),
};

/** Every text the station can show, for the language check. */
export function allTexts(): LocalizedText[] {
  const out: LocalizedText[] = Object.values(PHASE_LABEL);
  const e0: ElectricalParams = {
    atrial: 'sinus', av: 1, avBlock: 'none', lbb: 1, rbb: 1, accessory: 0, ventricular: 'none', lvMass: 1, rvMass: 1, laSize: 1, raSize: 1,
    ischaemia: 'none', injury: 1, repolarisation: 1, brugada: 0, pericarditis: 0, earlyRepol: 0, digoxin: 0,
  };
  const variants: Array<Partial<ElectricalParams>> = [{}, { laSize: 1.8, raSize: 1.9, lvMass: 1.7, rvMass: 2.2, repolarisation: 1.3, brugada: 1, pericarditis: 1, earlyRepol: 1, digoxin: 1 },
    { ischaemia: 'anterior' }, { ischaemia: 'subendocardial' }, { ischaemia: 'wellens' }, { avBlock: 'wenckebach' }, { ventricular: 'vf' }, { avBlock: 'mobitz2' }];
  const routes = ['normal', 'rbbb', 'lbbb', 'pre-excited', 'ectopic'] as const;
  const v = (route: typeof routes[number], origin: 'conducted' | 'escape' | 'vt') => ({ kind: 'ventricles' as const, t: 0, origin, route, qrsEnd: 100, tStart: 150, tEnd: 380, pr: 160, late: route === 'rbbb' ? { chamber: 'RV' as const, from: 70 } : null });
  const a = (notConducted?: 'dropped' | 'complete-block' | 'dissociated' | 'refractory') => ({ kind: 'atria' as const, t: 0, end: 100, conductedAt: notConducted ? null : 160, notConducted });
  for (const p of variants) for (const K of [4, 7, 3]) for (const [phase, atria] of [['rest', 'resting'], ['rest', 'fibrillating'], ['rest', 'flutter'], ['P', 'depolarising'], ['PR', 'depolarised'], ['QRS', 'resting'], ['ST', 'resting'], ['T', 'resting']] as const) {
    for (const route of routes) for (const origin of ['conducted', 'escape', 'vt'] as const) for (const nc of [undefined, 'dropped', 'complete-block', 'dissociated', 'refractory'] as const) for (const reached of [false, true]) {
      const moment = { t: 0, phase, atria, avNode: 'idle', bundles: 'idle', ventricles: 'resting', late: route === 'rbbb' ? { chamber: 'RV', reached } : null, a: a(nc), v: v(route, origin), dropped: !!nc } as Moment;
      const r = explain({ moment, e: { ...e0, ...p }, K, metrics: { HR: 72, PR: 250, QRS: 92, QT: 380, QTc: 410 } });
      out.push(r.title, ...r.body);
    }
  }
  return out;
}
