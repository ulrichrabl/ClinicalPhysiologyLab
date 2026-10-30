import type { LocalizedText } from '../model/i18n.ts';

/* ---------------------------------------------------------------------------
   The ECT station's explanations (part 1), in English and German: the next
   step at the device, what the stimulus does in the head, and the
   background. Drafts until a clinician has read them. Numbers are filled in
   by the functions; every relation they state is the model's, with its
   sources in evidence/ect.ts.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });
type Num = (x: number, d?: number) => string;

export interface StepState {
  on: boolean; booting: boolean; baseline: 'none' | 'collecting' | 'ready';
  testedOhm: number | null; staticHigh: number; staticLow: number;
  treat: 'idle' | 'warning' | 'delivering' | 'done'; early: boolean;
  printing: boolean; stimulusEnd: number | null; reported: boolean; seconds: number;
}

/** The next step, as the manual orders it. */
export function nextStep(s: StepState, n: Num): LocalizedText {
  if (!s.on) return L('Switch the device on (the power switch, right of the treatment button). It tests itself and prints a self-test line.', 'Schalten Sie das Gerät ein (Netzschalter rechts der Behandlungstaste). Es prüft sich selbst und druckt eine Selbsttestzeile.');
  if (s.booting) return L('Self test: the left display reads SELFTEST, then NO BASE.', 'Selbsttest: Die linke Anzeige zeigt SELFTEST, dann NO BASE.');
  if (s.treat === 'warning') return L('Keep holding TREAT: one second of continuous tone (three above 3000 Ω), no current yet.', 'Halten Sie TREAT gedrückt: eine Sekunde Dauerton (drei über 3000 Ω), noch fließt kein Strom.');
  if (s.treat === 'delivering') return L('The current is flowing (the intermittent tone). Keep holding TREAT until the light and the tone stop: releasing early gives less charge.', 'Der Strom fließt (der unterbrochene Ton). Halten Sie TREAT, bis Licht und Ton erlöschen: Früheres Loslassen gibt weniger Ladung.');
  if (s.stimulusEnd != null && !s.reported) {
    if (s.seconds < 20) return L(`${n(s.seconds)} s since the stimulus. Watch the EEG, the EMG of the cuffed foot and the ictal line along the top of the strip.`, `${n(s.seconds)} s seit dem Reiz. Beobachten Sie das EEG, das EMG des gestauten Fußes und die Iktallinie am oberen Rand des Streifens.`);
    return L(`${n(s.seconds)} s since the stimulus. When the ictal line has stopped and the EEG is flat, wait a few seconds, then press START/STOP: the device prints its report.`, `${n(s.seconds)} s seit dem Reiz. Wenn die Iktallinie aufgehört hat und das EEG flach ist, warten Sie einige Sekunden und drücken dann START/STOP: Das Gerät druckt seinen Bericht.`);
  }
  if (s.reported) return L('The report is printed. Read it below the strip: the stimulus as given, the endpoints and the seizure’s measures. For another stimulus, set the dose and treat again (the baseline is kept for a few minutes).', 'Der Bericht ist gedruckt. Lesen Sie ihn unter dem Streifen: der Reiz, wie er gegeben wurde, die Endpunkte und die Maße des Anfalls. Für einen weiteren Reiz stellen Sie die Dosis ein und behandeln erneut (die Grundlinie bleibt einige Minuten erhalten).');
  if (s.baseline === 'none') return L('Test the impedance: press and hold IMPEDANCE TEST. The display shows TESTING, then the static impedance in ohms. Releasing the button starts the baseline EEG.', 'Prüfen Sie die Impedanz: Halten Sie IMPEDANCE TEST gedrückt. Die Anzeige zeigt TESTING, dann die statische Impedanz in Ohm. Das Loslassen startet die Grundlinien-Ableitung des EEG.');
  if (s.testedOhm != null && s.testedOhm >= s.staticHigh) return L('3000 flashes: the contact is poor. Clean the skin, press the pads on firmly (or replace them), check the cable, then test again. Do not treat at this reading.', '3000 blinkt: Der Kontakt ist schlecht. Reinigen Sie die Haut, drücken Sie die Elektroden fest an (oder ersetzen Sie sie), prüfen Sie das Kabel und testen Sie erneut. Behandeln Sie bei diesem Wert nicht.');
  if (s.testedOhm != null && s.testedOhm < s.staticLow) return L('Under 100 Ω suggests a short circuit, usually in the stimulus cable or gel bridging the pads. Find it before treating.', 'Unter 100 Ω deutet auf einen Kurzschluss, meist im Reizkabel oder durch Gel zwischen den Elektroden. Finden Sie ihn vor der Behandlung.');
  if (s.baseline === 'collecting') return L('BASELINE: the device is recording the patient’s EEG before the stimulus (6–10 s). Without it there is no ictal line, no EEG endpoint and no indices.', 'BASELINE: Das Gerät zeichnet das EEG vor dem Reiz auf (6–10 s). Ohne diese Grundlinie gibt es keine Iktallinie, keinen EEG-Endpunkt und keine Indizes.');
  return L('READY. Set the dose on the PERCENT ENERGY dial (turning it shows the charge for a second; pressing it shows the program). Then lift the cover and hold TREAT.', 'READY. Stellen Sie die Dosis am Drehknopf PERCENT ENERGY ein (Drehen zeigt für eine Sekunde die Ladung, Drücken das Programm). Dann heben Sie die Kappe und halten TREAT gedrückt.');
}

/** What the stimulus will do, with this placement and setting. */
export interface StimulusFacts {
  percent: number; charge: number; current: number; pulseWidth: number; frequency: number; pulses: number; duration: number;
  dynamicOhm: number; energy: number; brainShare: number; medianField: number; threshold: number; excitedRegions: number;
  placementName: LocalizedText; placementWhere: LocalizedText;
}

export function explainStimulus(f: StimulusFacts, n: Num): Array<{ title: LocalizedText; body: LocalizedText }> {
  return [
    { title: L('The dose on the dial', 'Die Dosis am Drehknopf'), body: L(
      `${n(f.percent)} % is a charge of ${n(f.charge, 1)} mC: ${n(f.current, 1)} A × ${n(f.pulseWidth, 2)} ms × ${n(f.pulses)} pulses (${n(f.frequency)} Hz, each period a pulse of either polarity, for ${n(f.duration, 2)} s). The current is fixed; the dose grows by the number of pulses, through the train’s length and its frequency. At a dynamic impedance of ${n(f.dynamicOhm)} Ω that is ${n(f.energy, 1)} J (energy = charge × current × impedance); the device’s 100 % of 504 mC is “about 100 J” only at 220 Ω.`,
      `${n(f.percent)} % sind eine Ladung von ${n(f.charge, 1)} mC: ${n(f.current, 1)} A × ${n(f.pulseWidth, 2)} ms × ${n(f.pulses)} Pulse (${n(f.frequency)} Hz, je Periode ein Puls jeder Polarität, über ${n(f.duration, 2)} s). Der Strom ist fest; die Dosis wächst mit der Zahl der Pulse, über die Länge der Pulsfolge und ihre Frequenz. Bei einer dynamischen Impedanz von ${n(f.dynamicOhm)} Ω sind das ${n(f.energy, 1)} J (Energie = Ladung × Strom × Impedanz); die 100 % des Geräts mit 504 mC sind nur bei 220 Ω „etwa 100 J“.`) },
    { title: L('Where the current goes', 'Wohin der Strom fließt'), body: L(
      `${f.placementName.en}: ${f.placementWhere.en}. The scalp conducts well and the skull poorly, so part of the current runs through the scalp from pad to pad; in this spherical head ${n(100 * f.brainShare)} % of it crosses into the brain. Realistic heads put less there (Deng 2015: the current in the brain 23–35 % of that in the scalp, by their measure), and the skull’s conductivity, the most disputed number of the head, matters most. The field in the brain is ${n(f.medianField, 2)} V/cm in the middle of its range, about ${n(f.medianField / f.threshold, 1)} times what excites cortical axons with ${n(f.pulseWidth, 2)} ms pulses (${n(f.threshold, 2)} V/cm): at the device’s current most of the brain is above threshold, and ${n(f.excitedRegions)} of the model’s ten regions are fully driven.`,
      `${f.placementName.de}: ${f.placementWhere.de}. Die Kopfhaut leitet gut und der Schädel schlecht, deshalb fließt ein Teil des Stroms durch die Kopfhaut von Elektrode zu Elektrode; in diesem kugelförmigen Kopf gelangen ${n(100 * f.brainShare)} % davon ins Gehirn. Realistische Köpfe leiten weniger dorthin (Deng 2015: der Strom im Gehirn 23–35 % dessen in der Kopfhaut, nach ihrem Maß), und die Leitfähigkeit des Schädels, die umstrittenste Zahl des Kopfes, wiegt am meisten. Das Feld im Gehirn beträgt in der Mitte seiner Verteilung ${n(f.medianField, 2)} V/cm, etwa ${n(f.medianField / f.threshold, 1)}-mal so viel, wie kortikale Axone bei Pulsen von ${n(f.pulseWidth, 2)} ms erregt (${n(f.threshold, 2)} V/cm): Beim Strom des Geräts liegt der größte Teil des Gehirns über der Schwelle, und ${n(f.excitedRegions)} der zehn Regionen des Modells werden voll angetrieben.`) },
  ];
}

export const ECT_BACKGROUND: Array<{ title: LocalizedText; body: LocalizedText }> = [
  { title: L('Constant current, brief pulses', 'Konstanter Strom, kurze Pulse'), body: L(
    'The device drives 0.9 A whatever the impedance (up to 450 V), in rectangular pulses that alternate in polarity. What is set is the charge: current × pulse width × number of pulses. Energy depends on the patient’s impedance as well, which is why dose is stated in charge (Sackeim 1987). An axon’s membrane charges through a time constant of about 0.15 ms: a pulse much longer than that spends charge after the membrane has reached what it will reach, so ultrabrief pulses (0.25–0.3 ms) need less charge for the same effect (Peterchev 2010). In the model the threshold of a right unilateral stimulus at 0.25 ms is a third of that at 1.0 ms, as Loo 2014 measured (27 against 74 mC).',
    'Das Gerät treibt 0,9 A, unabhängig von der Impedanz (bis 450 V), in Rechteckpulsen wechselnder Polarität. Eingestellt wird die Ladung: Strom × Pulsbreite × Zahl der Pulse. Die Energie hängt zusätzlich von der Impedanz des Patienten ab, deshalb wird die Dosis in Ladung angegeben (Sackeim 1987). Die Membran eines Axons lädt sich mit einer Zeitkonstante von etwa 0,15 ms auf: Ein viel längerer Puls verbraucht Ladung, nachdem die Membran erreicht hat, was sie erreichen wird; ultrakurze Pulse (0,25–0,3 ms) brauchen deshalb weniger Ladung für dieselbe Wirkung (Peterchev 2010). Im Modell liegt die Schwelle eines rechts unilateralen Reizes bei 0,25 ms bei einem Drittel derjenigen bei 1,0 ms, wie Loo 2014 maßen (27 gegen 74 mC).') },
  { title: L('Static and dynamic impedance', 'Statische und dynamische Impedanz'), body: L(
    'The impedance test passes about 2 µA at 800 Hz and reads the contact: with this device and adhesive pads about 1300 Ω (Exner 2023: 1272 ± 368). During the stimulus the same head presents about 240 Ω (242 ± 31), because the skin conducts far better at the stimulus’s current (Unal 2023). A static reading of 3000 Ω or more means a poor contact (skin not cleaned, a pad lifting); under 100 Ω a short circuit. The static value predicts the dynamic one only in part.',
    'Der Impedanztest schickt etwa 2 µA bei 800 Hz und liest den Kontakt: mit diesem Gerät und Klebeelektroden etwa 1300 Ω (Exner 2023: 1272 ± 368). Während des Reizes zeigt derselbe Kopf etwa 240 Ω (242 ± 31), weil die Haut beim Strom des Reizes weit besser leitet (Unal 2023). Ein statischer Wert ab 3000 Ω bedeutet schlechten Kontakt (Haut nicht gereinigt, eine Elektrode löst sich); unter 100 Ω einen Kurzschluss. Der statische Wert sagt den dynamischen nur teilweise voraus.') },
  { title: L('Why a train of pulses, and why slowly', 'Warum eine Pulsfolge, und warum langsam'), body: L(
    'One pulse excites most of the cortex but does not start a seizure: the stimulus has to keep driving the cortex for seconds before the corticothalamic loop tips into its seizure cycle. Each pulse releases transmitter that recovers in about 0.15 s (measured in human cortex, Testa-Silva 2014), so pulses that come faster find less to release: at the same charge, a longer train at a lower frequency drives more, and its threshold is lower (Girish 2003, Kotresh 2004). This is why the device’s LOW programs keep the frequency as low as the 8 s limit allows.',
    'Ein Puls erregt den größten Teil der Rinde, startet aber keinen Anfall: Der Reiz muss die Rinde über Sekunden antreiben, bevor die kortikothalamische Schleife in ihren Anfallszyklus kippt. Jeder Puls setzt Transmitter frei, der sich in etwa 0,15 s erholt (in menschlicher Rinde gemessen, Testa-Silva 2014), sodass schnellere Pulse weniger vorfinden: Bei gleicher Ladung treibt eine längere Pulsfolge niedrigerer Frequenz stärker, und ihre Schwelle ist niedriger (Girish 2003, Kotresh 2004). Deshalb halten die LOW-Programme des Geräts die Frequenz so niedrig, wie die Grenze von 8 s erlaubt.') },
  { title: L('Dosing at the first treatment', 'Dosierung bei der ersten Behandlung'), body: L(
    'The manual gives two ways. Age-based: bilateral placements with the 0.5 ms program at half the age in percent (25 % for 50 years), right unilateral at the age in percent; with no seizure, 100 % within 30–60 s. Titration: start low (unilateral 1–5 %, bitemporal 5–10 %) and step up, at most four stimuli, then treat unilateral at 4–6 times and bitemporal at about 2 times the threshold. The model’s reference adult (59 years, the mean age of van Waarde 2012) has a bitemporal threshold of about 95 mC (19 %): half the age, 30 %, is 1.6 times that.',
    'Das Handbuch nennt zwei Wege. Altersbasiert: bilaterale Positionen mit dem 0,5-ms-Programm bei der Hälfte des Alters in Prozent (25 % bei 50 Jahren), rechts unilateral beim Alter in Prozent; ohne Anfall 100 % innerhalb von 30–60 s. Titration: niedrig beginnen (unilateral 1–5 %, bitemporal 5–10 %) und steigern, höchstens vier Reize, dann unilateral mit dem 4- bis 6-Fachen, bitemporal mit etwa dem 2-Fachen der Schwelle behandeln. Der Referenzerwachsene des Modells (59 Jahre, das mittlere Alter bei van Waarde 2012) hat eine bitemporale Schwelle von etwa 95 mC (19 %): das halbe Alter, 30 %, ist das 1,6-Fache.') },
  { title: L('How the device reads the seizure', 'Wie das Gerät den Anfall liest'), body: L(
    'The two EEG channels run from above each eyebrow to the mastoid behind the ear. After the baseline, the device prints the ictal line while the EEG’s amplitude exceeds the baseline’s, and takes the EEG endpoint where the amplitude falls below the baseline and stays there for 2 s (Swartz 1994). The EMG comes from a foot whose cuff keeps the muscle relaxant out: the motor seizure there ends before the EEG seizure. The report adds the average seizure energy, the postictal suppression (how much the amplitude falls right at the end), the maximum sustained power and coherence between the channels. The firmware is not published; the station computes these as the manual and the makers’ papers describe them.',
    'Die beiden EEG-Kanäle führen von über jeder Augenbraue zum Mastoid hinter dem Ohr. Nach der Grundlinie druckt das Gerät die Iktallinie, solange die Amplitude des EEG die der Grundlinie übersteigt, und setzt den EEG-Endpunkt, wo die Amplitude unter die Grundlinie fällt und 2 s dort bleibt (Swartz 1994). Das EMG stammt von einem Fuß, dessen Manschette das Muskelrelaxans fernhält: Der motorische Anfall endet dort vor dem EEG-Anfall. Der Bericht ergänzt die mittlere Anfallsenergie, die postiktale Suppression (wie stark die Amplitude genau am Ende abfällt), die maximale anhaltende Leistung und die Kohärenz zwischen den Kanälen. Die Firmware ist nicht veröffentlicht; die Station berechnet die Werte so, wie das Handbuch und die Arbeiten der Hersteller sie beschreiben.') },
  { title: L('What this part leaves out, and where the model differs', 'Was dieser Teil weglässt, und wo das Modell abweicht'), body: L(
    'The heart is the lab’s own: the stimulus slows it through the vagus while the current flows (by placement, as Stewart 2010 measured), the seizure raises it through the sympathetic outflow (fitted to Nagler 2013), and atropine, glycopyrrolate, esmolol and labetalol act on it. The anaesthetic, the muscle relaxant, ventilation and oxygen come next; age, sex and the threshold’s rise over a course after that. Known gaps: with equal pulses the model’s right unilateral threshold is higher than the bitemporal one, where patients show the opposite (van Waarde 2012: 45.6 against 95.4 mC; Coffey 1995): in the model a stimulus that drives both hemispheres starts a seizure more easily. The postictal suppression is deeper than measured (the model’s background is too small, a gap of the seizure model), and the device’s power indices come out far smaller than the values printed by real devices, whose scale is not published. At the heart: under atropine the right unilateral stimulus’s pause is shorter than measured; after the seizure the rate does not dip below where it started; esmolol blunts less than in two of three studies.',
    'Das Herz ist das des Labors: Der Reiz verlangsamt es über den Vagus, solange der Strom fließt (je nach Position, wie Stewart 2010 maßen), der Anfall beschleunigt es über den Sympathikus (an Nagler 2013 angepasst), und Atropin, Glycopyrronium, Esmolol und Labetalol wirken darauf. Narkose, Muskelrelaxans, Beatmung und Sauerstoff folgen; Alter, Geschlecht und der Anstieg der Schwelle über eine Serie danach. Bekannte Lücken: Bei gleichen Pulsen liegt die rechts unilaterale Schwelle des Modells über der bitemporalen, wo Patienten das Gegenteil zeigen (van Waarde 2012: 45,6 gegen 95,4 mC; Coffey 1995): Im Modell startet ein Reiz, der beide Hemisphären antreibt, leichter einen Anfall. Die postiktale Suppression ist tiefer als gemessen (der Grundrhythmus des Modells ist zu klein, eine Lücke des Anfallsmodells), und die Leistungsindizes fallen viel kleiner aus als die von echten Geräten gedruckten, deren Skala nicht veröffentlicht ist. Am Herzen: Unter Atropin ist die Pause bei rechts unilateralem Reiz kürzer als gemessen; nach dem Anfall fällt die Frequenz nicht unter den Ausgangswert; Esmolol dämpft schwächer als in zwei von drei Studien.') },
];

/** The report's lines, as the device prints them: always in English with decimal points, whatever the learner's language, as the real device's firmware prints. */
export function reportLines(r: {
  percent: number; charge: number; current: number; duration: number; frequency: number; pulseWidth: number;
  staticOhm: number | null; dynamicOhm: number; early: boolean; baselineAvailable: boolean;
  eegEndpoint: number | null; emgEndpoint: number | null; baseHr: number; peakHr: number;
  asei: number | null; psi: number | null; msp: number | null; ttp: number | null; coh: number | null; ttc: number | null; program: string; indexes: boolean;
}): string[] {
  const n = (x: number, d = 0) => x.toFixed(d);
  const na = 'N/A';
  const v = (x: number | null, d = 0) => (x == null ? na : n(x, d));
  const lines = [
    'ECT System IV',
    `% Energy set: ${n(r.percent)} %`,
    `Charge delivered: ${n(r.charge, 1)} mC${r.early ? ' (stopped early)' : ''}`,
    `Current: ${n(r.current, 2)} A`,
    `Stimulus duration: ${n(r.duration, 2)} s`,
    `Frequency: ${n(r.frequency)} Hz`,
    `Pulse width: ${n(r.pulseWidth, 2)} ms`,
    `Static impedance: ${r.staticOhm == null ? na : n(r.staticOhm)} Ω`,
    `Dynamic impedance: ${n(r.dynamicOhm)} Ω`,
  ];
  if (!r.baselineAvailable) lines.push('Baseline not available');
  else lines.push(r.eegEndpoint == null ? 'EEG endpoint is not detected' : `EEG endpoint: ${n(r.eegEndpoint)} s`);
  lines.push(r.emgEndpoint == null ? 'EMG activity is not detected' : `EMG endpoint: ${n(r.emgEndpoint)} s`);
  lines.push(`Base / peak heart rate: ${n(r.baseHr)} / ${n(r.peakHr)} b/m`);
  if (r.indexes && r.baselineAvailable) {
    lines.push(`Average seizure energy index: ${v(r.asei)} µV²`);
    lines.push(`Postictal suppression index: ${r.psi == null ? na : `${n(r.psi, 1)} %`}`);
    lines.push(`Maximum sustained power: ${v(r.msp)} µV²`);
    lines.push(`Time to peak power: ${r.ttp == null ? na : `${n(r.ttp)} s`}`);
    lines.push(`Maximum sustained coherence: ${r.coh == null ? na : `${n(r.coh, 1)} %`}`);
    lines.push(`Time to peak coherence: ${r.ttc == null ? na : `${n(r.ttc)} s`}`);
  }
  lines.push(`Program selected: ${r.program}`);
  return lines;
}

/** The heart now, for the explanations. */
export function heartNow(s: { delivering: boolean; seizing: boolean; afterStimulus: number | null; seized: boolean; hr: number; base: number; vagalBlock: number; betaBlock: number; placement: 'BT' | 'BF' | 'RUL' | 'LART' }, n: Num): LocalizedText | null {
  const blocked = s.vagalBlock > 0.3 ? L(` The anticholinergic given blocks about ${n(100 * s.vagalBlock)} % of the heart’s muscarinic receptors, so the slowing is smaller.`, ` Das gegebene Anticholinergikum blockiert etwa ${n(100 * s.vagalBlock)} % der muskarinischen Rezeptoren des Herzens, deshalb ist die Verlangsamung geringer.`) : L('', '');
  const beta = s.betaBlock > 0.1 ? L(` The β-blocker given blocks about ${n(100 * s.betaBlock)} % of the heart’s β1 receptors and blunts the rise.`, ` Der gegebene β-Blocker blockiert etwa ${n(100 * s.betaBlock)} % der β1-Rezeptoren des Herzens und dämpft den Anstieg.`) : L('', '');
  if (s.delivering) {
    const where = s.placement === 'BF' ? L('With bifrontal pads the effect is slight (Stewart 2010: 85 to 78 /min).', 'Mit bifrontalen Elektroden ist die Wirkung gering (Stewart 2010: 85 auf 78 /min).')
      : s.placement === 'RUL' ? L('With right unilateral pads it is strongest (Stewart 2010: 86 to 26 /min with 1.0 ms pulses, to 43 with 0.3 ms); pauses of several seconds are common (Nagler 2011: 5.6 ± 2.9 s).', 'Mit rechts unilateralen Elektroden ist sie am stärksten (Stewart 2010: 86 auf 26 /min bei 1,0-ms-Pulsen, auf 43 bei 0,3 ms); Pausen von mehreren Sekunden sind häufig (Nagler 2011: 5,6 ± 2,9 s).')
      : L('With bitemporal pads the rate roughly halves (Stewart 2010: 85 to 46 /min).', 'Mit bitemporalen Elektroden halbiert sich die Frequenz etwa (Stewart 2010: 85 auf 46 /min).');
    return L(`While the current flows it also discharges the vagus onto the heart’s pacemakers: the sinus node slows or stops, and so does the junction that would otherwise escape. ${where.en}${blocked.en} Why the placements differ so much is not known: the field in deep structures does not explain it in this head, so the station uses the measured effect.`,
      `Während der Strom fließt, entlädt er auch den Vagus auf die Schrittmacher des Herzens: Der Sinusknoten verlangsamt sich oder steht still, ebenso der AV-Knoten, der sonst als Ersatz einspränge. ${where.de}${blocked.de} Warum sich die Positionen so unterscheiden, ist nicht bekannt: Das Feld in tiefen Strukturen erklärt es in diesem Kopf nicht, deshalb verwendet die Station die gemessene Wirkung.`);
  }
  if (s.afterStimulus == null) return null;
  if (s.seizing) return L(`The seizure drives the sympathetic outflow: the heart rate rises within seconds, here ${n(s.hr)} /min from ${n(s.base)} before, highest while the seizure fires hardest and lower as it slows (Nagler 2013: 90 to 135 /min, the peak about 20 s after the stimulus). Blood pressure rises with it.${beta.en}`,
    `Der Anfall treibt den Sympathikus an: Die Herzfrequenz steigt binnen Sekunden, hier ${n(s.hr)} /min nach ${n(s.base)} vorher, am höchsten, solange der Anfall am stärksten feuert, und niedriger, wenn er sich verlangsamt (Nagler 2013: 90 auf 135 /min, der Gipfel etwa 20 s nach dem Reiz). Der Blutdruck steigt mit.${beta.de}`);
  if (!s.seized && s.afterStimulus < 30) return L('No seizure followed: nothing but the baroreflex answers the vagal slowing of the stimulus. In patients the slowing can outlast a subconvulsive stimulus (a pause of 18 s has been reported, Tang 2001); the model ends it with the current, a known gap.', 'Es folgte kein Anfall: Nur der Barorezeptorreflex antwortet auf die vagale Verlangsamung durch den Reiz. Bei Patienten kann sie einen unterschwelligen Reiz überdauern (eine Pause von 18 s wurde berichtet, Tang 2001); das Modell beendet sie mit dem Strom, eine bekannte Lücke.');
  return null;
}
