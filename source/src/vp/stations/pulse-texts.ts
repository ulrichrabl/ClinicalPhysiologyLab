import type { LocalizedText } from '../model/i18n.ts';

/* ---------------------------------------------------------------------------
   The pulse and neck-vein station's explanations: why the pulse feels as it
   does, and what each wave in the neck is. Written per situation, in
   English and German, and selected by the model's readings (the pulse and
   JVP findings, the beat's pressures and its waves). Nothing here decides
   what is felt or seen; it says why.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export interface PulseContext {
  pulse: { rate: number; rhythm: string; volume: string; character: string };
  jvp: { heightCm: number; waveform: string };
  m: { sys: number; dia: number; sv: number; gradient: number; regurgFraction: number; upstrokeMs: number; cvp: number };
  rhythm: { atrial: string; avBlock: string; ventricular: string };
}

export interface PulseText { title: LocalizedText; body: LocalizedText[] }

const r = Math.round;
const n1 = (x: number) => (Math.round(x * 10) / 10).toString();
const de1 = (x: number) => n1(x).replace('.', ',');

export function explainPulse(c: PulseContext): PulseText[] {
  const p = c.pulse, m = c.m, pp = m.sys - m.dia;
  const art: LocalizedText[] = [L(`Each beat sends ${r(m.sv)} mL into an aorta that is already full: the wave of pressure that runs out along the arteries is what the finger feels, long before the blood itself arrives. Here it rises from ${r(m.dia)} to ${r(m.sys)} mmHg (pulse pressure ${r(pp)}), reaching 90 % of its rise in ${r(m.upstrokeMs)} ms.`,
    `Jeder Schlag schickt ${r(m.sv)} ml in eine Aorta, die schon gefüllt ist: Die Druckwelle, die die Arterien entlangläuft, fühlt der Finger, lange bevor das Blut selbst ankommt. Hier steigt sie von ${r(m.dia)} auf ${r(m.sys)} mmHg (Pulsdruck ${r(pp)}) und erreicht 90 % ihres Anstiegs in ${r(m.upstrokeMs)} ms.`)];
  if (p.character === 'slow-rising') art.push(L(`The narrow aortic valve holds the ventricle back: ${r(m.gradient)} mmHg are lost across it, and the pressure in the aorta climbs slowly to a late, low peak (pulsus parvus et tardus). Feel it at the carotid, close to the valve; by the radial artery the wave has been reshaped.`,
    `Die enge Aortenklappe bremst den Ventrikel: ${r(m.gradient)} mmHg gehen über ihr verloren, und der Druck in der Aorta steigt langsam zu einem späten, niedrigen Gipfel (Pulsus parvus et tardus). Fühlen Sie ihn an der Karotis, nah an der Klappe; an der A. radialis ist die Welle schon umgeformt.`));
  if (p.character === 'collapsing') art.push(L(`The aortic valve leaks: ${r(m.regurgFraction * 100)} % of each stroke runs back into the ventricle in diastole, so the pressure falls fast and low. The ventricle, filled from both sides, ejects a large stroke: a high peak, then the collapse. Lift the arm and the fall is felt across the palm (water-hammer pulse).`,
    `Die Aortenklappe ist undicht: ${r(m.regurgFraction * 100)} % jedes Schlagvolumens fließen in der Diastole in den Ventrikel zurück, der Druck fällt schnell und tief. Der von beiden Seiten gefüllte Ventrikel wirft ein großes Schlagvolumen aus: ein hoher Gipfel, dann der Kollaps. Hebt man den Arm, spürt man den Abfall in der ganzen Handfläche (Wasserhammerpuls).`));
  if (p.character === 'thready') art.push(L('A small stroke volume makes a small, quick wave: the pulse is thin and easily lost under the finger.', 'Ein kleines Schlagvolumen macht eine kleine, kurze Welle: Der Puls ist dünn und unter dem Finger leicht zu verlieren.'));
  if (p.rhythm === 'irregularly-irregular') art.push(L('The intervals have no pattern: no beat can be predicted from the last. In atrial fibrillation the AV node passes impulses at random; a beat that follows a short pause comes from a ventricle barely filled, and some are too weak to reach the wrist at all (the pulse deficit: count at the apex and the wrist together).',
    'Die Abstände haben kein Muster: Kein Schlag lässt sich aus dem letzten vorhersagen. Beim Vorhofflimmern leitet der AV-Knoten Impulse zufällig weiter; ein Schlag nach kurzer Pause kommt aus einem kaum gefüllten Ventrikel, und manche sind zu schwach, um das Handgelenk zu erreichen (Pulsdefizit: an Herzspitze und Handgelenk zugleich zählen).'));
  if (p.rhythm === 'regularly-irregular') art.push(L('The beats come in groups that repeat: a pattern, then a pause. In Wenckebach block each impulse takes longer through the AV node until one does not get through.',
    'Die Schläge kommen in sich wiederholenden Gruppen: ein Muster, dann eine Pause. Beim Wenckebach-Block braucht jeder Impuls länger durch den AV-Knoten, bis einer nicht durchkommt.'));
  if (p.rate < 50) art.push(L(`Slow: ${r(p.rate)} beats a minute. ${c.rhythm.avBlock === 'complete' ? 'No atrial impulse reaches the ventricles; a pacemaker below the block drives them at its own slow rate, with a large stroke from the long filling.' : 'Each beat follows a long filling time.'}`,
    `Langsam: ${r(p.rate)} Schläge pro Minute. ${c.rhythm.avBlock === 'complete' ? 'Kein Vorhofimpuls erreicht die Kammern; ein Schrittmacher unterhalb des Blocks treibt sie in seinem eigenen langsamen Takt, mit großem Schlagvolumen nach der langen Füllung.' : 'Jedem Schlag geht eine lange Füllungszeit voraus.'}`));
  if (p.rate > 100) art.push(L(`Fast: ${r(p.rate)} beats a minute. Diastole shortens most, so the ventricle fills less and each wave is smaller.`,
    `Schnell: ${r(p.rate)} Schläge pro Minute. Vor allem die Diastole wird kürzer, der Ventrikel füllt sich weniger, und jede Welle ist kleiner.`));
  if (p.rhythm === 'regular' && p.character === 'normal' && p.volume === 'normal' && p.rate >= 50 && p.rate <= 100) art.push(L('A normal pulse: regular, of normal volume, with a brisk upstroke. The small variation from beat to beat is breathing (sinus arrhythmia).',
    'Ein normaler Puls: regelmäßig, normal gefüllt, mit raschem Anstieg. Die kleine Schwankung von Schlag zu Schlag ist die Atmung (Sinusarrhythmie).'));

  const h = c.jvp.heightCm;
  const ven: LocalizedText[] = [L(`The internal jugular vein has no valve between it and the right atrium: the column of blood in it stands as high as the atrium's pressure holds it, 1.36 cm for each mmHg. The atrium lies about 5 cm below the sternal angle in any position, so with the patient at 45° the top of the column, measured vertically above the angle, reads the pressure: here ${n1(c.m.cvp)} mmHg, ${n1(h)} cm above the angle.`,
    `Die V. jugularis interna hat keine Klappe zwischen sich und dem rechten Vorhof: Die Blutsäule in ihr steht so hoch, wie der Druck des Vorhofs sie hält, 1,36 cm je mmHg. Der Vorhof liegt in jeder Lage etwa 5 cm unter dem Angulus sterni; beim Patienten in 45° liest man daher den Druck an der Spitze der Säule, senkrecht über dem Angulus gemessen: hier ${de1(c.m.cvp)} mmHg, ${de1(h)} cm über dem Angulus.`)];
  ven.push(L('The column moves twice in each beat: up with the a wave as the atrium contracts, down in the x descent as it relaxes and the ventricle pulls the valve ring down, up with the v wave as the atrium fills against the shut tricuspid valve, down in the y descent as the valve opens. Unlike the carotid it is soft, cannot be felt, moves twice per beat and falls when the patient breathes in.',
    'Die Säule bewegt sich zweimal pro Schlag: hoch mit der a-Welle, wenn der Vorhof kontrahiert, hinunter im x-Tal, wenn er erschlafft und der Ventrikel die Klappenebene herabzieht, hoch mit der v-Welle, wenn sich der Vorhof gegen die geschlossene Trikuspidalklappe füllt, hinunter im y-Tal, wenn die Klappe öffnet. Anders als die Karotis ist sie weich, nicht tastbar, bewegt sich zweimal pro Schlag und sinkt beim Einatmen.'));
  if (c.jvp.waveform === 'cannon-a') ven.push(L(c.rhythm.avBlock === 'complete' ? 'Atria and ventricles beat independently: now and then the atrium contracts while the ventricle is already contracting and the tricuspid valve is shut. Its blood can only go back up the neck, in a cannon wave, irregularly, whenever the two coincide.'
    : c.rhythm.ventricular === 'vt' ? 'The ventricles run on their own, fast; the atria still beat at the sinus rate. When an atrial contraction falls in ventricular systole the tricuspid valve is shut, and the blood goes back up the neck as a cannon wave: a bedside sign of atria and ventricles out of step.'
      : 'Here the atrium sometimes contracts while the ventricle does, against a shut tricuspid valve: its blood goes back up the neck as a cannon wave.',
  c.rhythm.avBlock === 'complete' ? 'Vorhöfe und Kammern schlagen unabhängig: Ab und zu kontrahiert der Vorhof, während der Ventrikel schon kontrahiert und die Trikuspidalklappe geschlossen ist. Sein Blut kann nur zurück in den Hals, als Kanonenwelle, unregelmäßig, wann immer beide zusammenfallen.'
    : c.rhythm.ventricular === 'vt' ? 'Die Kammern schlagen eigenständig und schnell; die Vorhöfe weiter im Sinusrhythmus. Fällt eine Vorhofkontraktion in die Kammersystole, ist die Trikuspidalklappe geschlossen, und das Blut steigt als Kanonenwelle in den Hals: ein Zeichen am Bett, dass Vorhöfe und Kammern nicht im Takt sind.'
      : 'Hier kontrahiert der Vorhof manchmal zugleich mit dem Ventrikel, gegen die geschlossene Trikuspidalklappe: Sein Blut steigt als Kanonenwelle in den Hals.'));
  if (c.jvp.waveform === 'absent-a') ven.push(L('No a wave: the fibrillating atria do not contract, so there is nothing to push the column up before systole. Only the v wave and the y descent are left.',
    'Keine a-Welle: Die flimmernden Vorhöfe kontrahieren nicht, nichts hebt die Säule vor der Systole. Nur v-Welle und y-Tal bleiben.'));
  if (c.jvp.waveform === 'large-v') ven.push(L('The v wave is now the taller: the leaking tricuspid valve lets the ventricle fill the atrium in systole, so the column rises with each ventricular beat (a systolic wave, sometimes with the earlobe moving).',
    'Die v-Welle ist jetzt die höhere: Die undichte Trikuspidalklappe lässt den Ventrikel den Vorhof in der Systole füllen; die Säule steigt mit jedem Kammerschlag (eine systolische Welle, manchmal bewegt sich das Ohrläppchen mit).'));
  if (h > 3) ven.push(L('The column stands more than 3 cm above the angle: the right atrial pressure is raised. The right ventricle is failing to empty or to accept its filling (failure, pulmonary hypertension, tamponade), or there is too much blood.',
    'Die Säule steht mehr als 3 cm über dem Angulus: Der rechte Vorhofdruck ist erhöht. Der rechte Ventrikel entleert sich nicht oder nimmt die Füllung nicht an (Insuffizienz, pulmonale Hypertonie, Tamponade), oder es ist zu viel Blut im Kreislauf.'));
  ven.push(L('Not modelled: the c wave (the tricuspid valve bulging back into the atrium at the start of systole), and the rise of the column on breathing in when the right heart cannot take more (Kussmaul’s sign).',
    'Nicht modelliert: die c-Welle (die Trikuspidalklappe wölbt sich zu Beginn der Systole in den Vorhof zurück) und das Ansteigen der Säule beim Einatmen, wenn das rechte Herz nicht mehr aufnehmen kann (Kussmaul-Zeichen).'));
  return [
    { title: L('The arterial pulse', 'Der arterielle Puls'), body: art },
    { title: L('The neck veins', 'Die Halsvenen'), body: ven },
  ];
}
