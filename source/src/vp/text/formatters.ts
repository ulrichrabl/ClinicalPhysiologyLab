import type { ExamContext, Side } from '../model/types.ts';
import type { Catalog } from '../data/catalog.ts';
import type { PropertyRef } from '../engine/observe.ts';
import { num, tr, type Locale } from '../model/i18n.ts';

/* ---------------------------------------------------------------------------
   Formatters: structured value -> clinical text, per language.

   Findings are stored as values; these turn them into the sentence a
   clinician would write in the notes, in English or German. A new language
   adds a branch here and labels in the data; nothing else changes.

   Formatters describe what is perceived, not what the model knows: a covert
   corrective saccade is reported as "the eyes stay on target", because at
   the bedside that is what one sees.
--------------------------------------------------------------------------- */

export type Formatter = (value: any, ctx: ExamContext, locale: Locale, cat: Catalog, ref: PropertyRef) => string;

const de = (l: Locale) => l === 'de';
const lab = (cat: Catalog, vs: string, code: string, l: Locale) =>
  tr(cat.valueSets[vs]?.values.find((v) => v.code === code)?.label ?? { en: code }, l);
const sideAdj = (s: Side | undefined, l: Locale, form: 'left' | 'linke' | 'linkes' | 'links' = 'left') => {
  if (!s) return '';
  if (!de(l)) return s === 'L' ? 'left' : 'right';
  const m = { left: ['links', 'rechts'], linke: ['linke', 'rechte'], linkes: ['linkes', 'rechtes'], links: ['links', 'rechts'] }[form];
  return s === 'L' ? m[0] : m[1];
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const join = (parts: string[], l: Locale) =>
  parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} ${de(l) ? 'und' : 'and'} ${parts[parts.length - 1]}`;

const GAZE: Record<string, [string, string]> = {
  primary: ['In primary gaze', 'Bei Geradeausblick'], left: ['On looking left', 'Bei Blick nach links'],
  right: ['On looking right', 'Bei Blick nach rechts'], up: ['On looking up', 'Bei Blick nach oben'], down: ['On looking down', 'Bei Blick nach unten'],
};
const DIR: Record<string, [string, string]> = { left: ['to the left', 'nach links'], right: ['to the right', 'nach rechts'], up: ['upward', 'nach oben'], down: ['downward', 'nach unten'] };

export const FORMATTERS: Record<string, Formatter> = {
  /* ---- general and vitals --------------------------------------------------- */
  'general.appearance': (v, _c, l, cat) => de(l)
    ? `Allgemeinzustand: ${lab(cat, 'distress', v.distress, l)}, Hautkolorit ${lab(cat, 'colour', v.colour, l)}, ${v.sweating ? 'kaltschweißig' : 'nicht kaltschweißig'}.`
    : `${cap(lab(cat, 'distress', v.distress, l))}, ${lab(cat, 'colour', v.colour, l)}, ${v.sweating ? 'sweaty' : 'not sweaty'}.`,
  'vitals.hr': (v, _c, l) => (de(l) ? `Herzfrequenz ${num(v, l)}/min.` : `Heart rate ${num(v, l)}/min.`),
  'vitals.bp': (v, _c, l, _cat, ref) => de(l)
    ? `Blutdruck ${v.systolic}/${v.diastolic} mmHg${ref.side ? ` (${sideAdj(ref.side, l, 'linke')}r Arm)` : ''}.`
    : `Blood pressure ${v.systolic}/${v.diastolic} mmHg${ref.side ? ` (${sideAdj(ref.side, l)} arm)` : ''}.`,
  'vitals.rr': (v, _c, l) => (de(l) ? `Atemfrequenz ${num(v, l)}/min.` : `Respiratory rate ${num(v, l)}/min.`),
  'vitals.spo2': (v, _c, l) => (de(l) ? `SpO₂ ${num(v, l)} % unter Raumluft.` : `SpO₂ ${num(v, l)}% on room air.`),
  'vitals.temp': (v, _c, l) => (de(l) ? `Temperatur ${num(v, l, 1)} °C.` : `Temperature ${num(v, l, 1)} °C.`),

  /* ---- cardiovascular ------------------------------------------------------- */
  pulse: (v, _c, l, cat, ref) => {
    const where = ref.property === 'pulse.carotid'
      ? (de(l) ? `Karotispuls ${sideAdj(ref.side, l)}` : `${cap(sideAdj(ref.side, l))} carotid pulse`)
      : (de(l) ? `Radialispuls ${sideAdj(ref.side, l)}` : `${cap(sideAdj(ref.side, l))} radial pulse`);
    return `${where}: ${v.rate}/min, ${lab(cat, 'rhythm', v.rhythm, l)}, ${lab(cat, 'pulse-volume', v.volume, l)}, ${lab(cat, 'pulse-character', v.character, l)}.`;
  },
  jvp: (v, _c, l, cat) => {
    if (v.heightCm <= 0) return de(l) ? 'Halsvenen bei 45° nicht gestaut.' : 'JVP not seen above the sternal angle at 45°.';
    const wave = v.waveform === 'normal' ? '' : `, ${lab(cat, 'jvp-wave', v.waveform, l)}`;
    return de(l)
      ? `Jugularvenenpuls ${num(v.heightCm, l, 1)} cm über dem Angulus sterni bei 45°${wave}.`
      : `JVP ${num(v.heightCm, l, 1)} cm above the sternal angle at 45°${wave}.`;
  },
  apex: (v, _c, l, cat) => de(l)
    ? `Herzspitzenstoß ${lab(cat, 'apex-position', v.position, l)}, ${lab(cat, 'apex-character', v.character, l)}.`
    : `Apex beat ${lab(cat, 'apex-position', v.position, l)}, ${lab(cat, 'apex-character', v.character, l)}.`,
  'heart.sounds': (v, ctx, l, cat) => {
    const site = (ctx.site ?? '').replace(/\.(L|R)$/, '');
    const side = /\.(L|R)$/.exec(ctx.site ?? '')?.[1] as Side | undefined;
    const where = site === 'neck.carotid'
      ? (de(l) ? `Karotis ${sideAdj(side, l)}` : `${cap(sideAdj(side, l))} carotid`)
      : tr(cat.structures[site]?.label ?? { en: site }, l).replace(/\s*\(.*\)$/, '');
    const murmurs = (v.murmurs ?? []).map((m: any) => de(l)
      ? `${lab(cat, 'murmur-timing', m.timing, l)}, ${lab(cat, 'murmur-shape', m.shape, l)}, Lautstärke ${m.grade}/6, ${lab(cat, 'pitch', m.pitch, l)}`
      : `${lab(cat, 'murmur-timing', m.timing, l)} murmur, ${lab(cat, 'murmur-shape', m.shape, l)}, grade ${m.grade}/6, ${lab(cat, 'pitch', m.pitch, l)}`);
    if (site === 'neck.carotid') {
      if (!murmurs.length) return de(l) ? `${where}: kein Strömungsgeräusch.` : `${where}: no bruit.`;
      return de(l) ? `${where}: fortgeleitetes ${murmurs.join('; ')}.` : `${where}: transmitted ${murmurs.join('; ')}.`;
    }
    const sounds: string[] = [];
    const normalS = v.s1 === 'normal' && v.a2 === 'normal' && v.p2 === 'normal' && v.s2Split === 'physiological';
    if (normalS) sounds.push(de(l) ? '1. und 2. Herzton normal' : 'heart sounds 1 and 2 normal');
    else {
      if (v.s1 !== 'normal') sounds.push(de(l) ? `1. Herzton ${lab(cat, 's1', v.s1, l)}` : `S1 ${lab(cat, 's1', v.s1, l)}`);
      if (v.a2 !== 'normal') sounds.push(`A2 ${lab(cat, 'a2', v.a2, l)}`);
      if (v.p2 !== 'normal') sounds.push(`P2 ${lab(cat, 'p2', v.p2, l)}`);
      if (v.s2Split !== 'physiological') sounds.push(de(l) ? `2. Herzton ${lab(cat, 's2-split', v.s2Split, l)}` : `S2 ${lab(cat, 's2-split', v.s2Split, l)}`);
    }
    if (v.added?.length) sounds.push(join(v.added.map((a: string) => lab(cat, 'added-sound', a, l)), l));
    else sounds.push(de(l) ? 'keine Extratöne' : 'no added sounds');
    const tail = murmurs.length ? ` ${murmurs.map((m: string) => cap(m)).join('. ')}.` : (de(l) ? ' Kein Herzgeräusch.' : ' No murmur.');
    return `${where}: ${sounds.join(', ')}.${tail}`;
  },
  'lung.sounds': (v, ctx, l, cat) => {
    const side = /\.(L|R)$/.exec(ctx.site ?? '')?.[1] as Side | undefined;
    const where = de(l) ? `Lungenbasis ${sideAdj(side, l)}` : `${cap(sideAdj(side, l))} lung base`;
    const added = v.added?.length ? join(v.added.map((a: string) => lab(cat, 'added-lung', a, l)), l) : '';
    return de(l)
      ? `${where}: Atemgeräusch ${lab(cat, 'breath-sounds', v.breath, l)}, ${added ? `Nebengeräusche: ${added}` : 'keine Nebengeräusche'}.`
      : `${where}: ${lab(cat, 'breath-sounds', v.breath, l)} breath sounds, ${added || 'no added sounds'}.`;
  },

  'hands.crt': (v, _c, l) => (de(l) ? `Rekapillarisierungszeit ${num(v, l, 1)} s.` : `Capillary refill ${num(v, l, 1)} s.`),
  'legs.oedema': (v, _c, l, cat) => `${cap(lab(cat, 'oedema', v.extent, l))}.`,
  'abdomen.palpation': (v, _c, l, cat) => {
    const parts: string[] = [];
    parts.push(v.tenderness === 'none' ? (de(l) ? 'weich, kein Druckschmerz' : 'soft, non-tender') : (de(l) ? `${lab(cat, 'severity', v.tenderness, l)} Druckschmerz` : `${lab(cat, 'severity', v.tenderness, l)} tenderness`));
    if (v.guarding) parts.push(de(l) ? 'Abwehrspannung' : 'guarding');
    parts.push(v.mass ? (de(l) ? 'Resistenz tastbar' : 'a mass is palpable') : (de(l) ? 'keine Resistenzen' : 'no masses'));
    return de(l) ? `Abdomen: ${parts.join(', ')}.` : `Abdomen: ${parts.join(', ')}.`;
  },

  /* ---- eyes ----------------------------------------------------------------- */
  'eye.pupil': (v, ctx, l, cat, ref) => {
    const who = de(l) ? `${cap(sideAdj(ref.side, l, 'linke'))} Pupille` : `${cap(sideAdj(ref.side, l))} pupil`;
    let s = `${who} ${num(v.sizeMm, l, 1)} mm`;
    if (v.reaction) {
      const direct = ctx.lightOn === ref.side;
      const kind = de(l) ? (direct ? 'direkte' : 'konsensuelle') : (direct ? 'direct' : 'consensual');
      s += de(l) ? `, ${kind} Lichtreaktion ${lab(cat, 'pupil-reaction', v.reaction, l)}` : `, ${kind} light response ${lab(cat, 'pupil-reaction', v.reaction, l)}`;
    }
    if (ctx.ambient === 'dim') s += de(l) ? ' (abgedunkelter Raum)' : ' (dim light)';
    return `${s}.`;
  },
  'eyes.swinging-light': (v, _c, l) => {
    if (v.rapd === 'none') return de(l) ? 'Kein relatives afferentes Pupillendefizit.' : 'No relative afferent pupillary defect.';
    const s = v.rapd as Side;
    return de(l)
      ? `Relatives afferentes Pupillendefizit ${sideAdj(s, l)}: beim Wechsel auf das ${sideAdj(s, l, 'linkes')} Auge erweitern sich beide Pupillen.`
      : `Relative afferent pupillary defect on the ${sideAdj(s, l)}: both pupils dilate when the light swings to the ${sideAdj(s, l)} eye.`;
  },
  'eye.lid': (v, _c, l, _cat, ref) => {
    if (v.ptosisMm <= 1) return de(l) ? `Keine Ptosis ${sideAdj(ref.side, l)}.` : `No ${sideAdj(ref.side, l)} ptosis.`;
    if (v.ptosisMm >= 7) return de(l)
      ? `Komplette Ptosis ${sideAdj(ref.side, l)}, das Oberlid bedeckt die Pupille.`
      : `Complete ${sideAdj(ref.side, l)} ptosis; the lid covers the pupil.`;
    return de(l) ? `Ptosis ${sideAdj(ref.side, l)} (etwa ${num(v.ptosisMm, l)} mm).` : `${cap(sideAdj(ref.side, l))} ptosis (about ${num(v.ptosisMm, l)} mm).`;
  },
  'eye.motility': (v, _c, l, _cat, ref) => {
    const who = de(l) ? `${cap(sideAdj(ref.side, l, 'linkes'))} Auge` : `${cap(sideAdj(ref.side, l))} eye`;
    const names: Record<string, [string, string]> = { abduction: ['abduction', 'Abduktion'], adduction: ['adduction', 'Adduktion'], elevation: ['elevation', 'Hebung'], depression: ['depression', 'Senkung'] };
    const limits: string[] = [];
    for (const k of Object.keys(names)) {
      const pct = v[k];
      if (pct >= 90) continue;
      const n = names[k][de(l) ? 1 : 0];
      limits.push(pct <= 5 ? (de(l) ? `${n} aufgehoben` : `no ${n}`) : (de(l) ? `${n} eingeschränkt (${pct} %)` : `${n} reduced (${pct}%)`));
    }
    const rest = v.restingDeg ?? { horizontal: 0, vertical: 0 };
    const restParts: string[] = [];
    if (rest.vertical <= -5) restParts.push(de(l) ? 'unten' : 'down');
    if (rest.vertical >= 5) restParts.push(de(l) ? 'oben' : 'up');
    if (rest.horizontal >= 5) restParts.push(de(l) ? 'außen' : 'out');
    if (rest.horizontal <= -5) restParts.push(de(l) ? 'innen' : 'in');
    const restTxt = restParts.length ? (de(l) ? `; in Ruhe nach ${restParts.join(' ')} abgewichen` : `; rests ${restParts.join(' and ')}`) : '';
    if (!limits.length && !restTxt) return de(l) ? `${who}: Motilität frei.` : `${who}: full range of movement.`;
    return `${who}: ${limits.join(', ')}${restTxt}.`;
  },
  'eyes.alignment': (v, _c, l, cat) => {
    const parts: string[] = [];
    if (v.horizontal !== 'ortho') parts.push(de(l)
      ? `horizontale Abweichung ${lab(cat, 'horizontal-deviation', v.horizontal, l)}, etwa ${v.horizontalPD} pdpt`
      : `horizontal deviation, ${lab(cat, 'horizontal-deviation', v.horizontal, l)}, about ${v.horizontalPD} prism dioptres`);
    if (v.verticalPD > 0 && v.higherEye) parts.push(de(l)
      ? `vertikale Einstellbewegung, ${sideAdj(v.higherEye, l, 'linkes')} Auge höher, etwa ${v.verticalPD} pdpt`
      : `vertical refixation, ${sideAdj(v.higherEye, l)} eye higher, about ${v.verticalPD} prism dioptres`);
    if (!parts.length) return de(l) ? 'Alternierender Abdecktest: keine Einstellbewegung.' : 'Alternate cover test: no refixation movement.';
    return de(l) ? `Alternierender Abdecktest: ${parts.join('; ')}.` : `Alternate cover test: ${parts.join('; ')}.`;
  },
  'eyes.nystagmus': (v, ctx, l, cat) => {
    const g = GAZE[ctx.gaze ?? 'primary'][de(l) ? 1 : 0];
    const fix = ctx.fixation === false ? (de(l) ? ' unter der Frenzel-Brille' : ' behind Frenzel lenses') : '';
    if (!v.present) return de(l) ? `${g}${fix}: kein Nystagmus.` : `${g}${fix}: no nystagmus.`;
    const torsional = v.torsion && v.torsion !== 'none';
    const plane = v.fastPhase === 'up' || v.fastPhase === 'down'
      ? (de(l) ? 'vertikaler' : 'vertical')
      : torsional ? (de(l) ? 'horizontal-torsioneller' : 'horizontal-torsional') : (de(l) ? 'horizontaler' : 'horizontal');
    const dir = DIR[v.fastPhase][de(l) ? 1 : 0];
    const amp = v.amplitudeDeg < 2 ? (de(l) ? 'kleine' : 'small') : v.amplitudeDeg < 5 ? (de(l) ? 'mittelgroße' : 'moderate') : (de(l) ? 'große' : 'large');
    const tors = torsional ? (de(l) ? `, oberer Pol schlägt ${lab(cat, 'torsion', v.torsion, l)}` : `, upper poles beating ${lab(cat, 'torsion', v.torsion, l)}`) : '';
    return de(l)
      ? `${g}${fix}: ${plane} Rucknystagmus ${dir}${tors}, ${amp} Amplitude (ca. ${num(v.amplitudeDeg, l, 1)}°), ca. ${num(v.frequencyHz, l, 1)} Hz.`
      : `${g}${fix}: ${plane} jerk nystagmus, fast phase ${dir}${tors}, ${amp} amplitude (about ${num(v.amplitudeDeg, l, 1)}°), about ${num(v.frequencyHz, l, 1)} Hz.`;
  },
  'eye.head-impulse': (v, _c, l, _cat, ref) => {
    const dir = de(l) ? `nach ${sideAdj(ref.side, l)}` : `to the ${sideAdj(ref.side, l)}`;
    if (v.saccade === 'overt') return de(l)
      ? `Kopfimpuls ${dir}: die Augen werden mit dem Kopf mitgenommen, dann sichtbare Refixationssakkade zurück zum Ziel.`
      : `Head impulse ${dir}: the eyes are carried off target with the head, then an overt corrective saccade back to the target.`;
    return de(l) ? `Kopfimpuls ${dir}: die Augen bleiben auf dem Ziel.` : `Head impulse ${dir}: the eyes stay on target.`;
  },
  'eyes.pursuit': (v, _c, l) => (v.quality === 'smooth'
    ? (de(l) ? 'Blickfolge glatt.' : 'Smooth pursuit intact.')
    : (de(l) ? 'Blickfolge sakkadiert.' : 'Pursuit broken up by saccades.')),
  'eye.field': (v, _c, l, _cat, ref) => {
    const who = de(l) ? `${cap(sideAdj(ref.side, l, 'linkes'))} Auge` : `${cap(sideAdj(ref.side, l))} eye`;
    const lost = (['temporal', 'nasal'] as const).filter((k) => v[k] !== 'intact');
    if (!lost.length) return de(l) ? `${who}: Gesichtsfeld fingerperimetrisch frei.` : `${who}: visual field full to confrontation.`;
    if (lost.length === 2) return de(l) ? `${who}: keine Wahrnehmung im gesamten Gesichtsfeld.` : `${who}: no perception in any part of the field.`;
    const half = lost[0] === 'temporal' ? (de(l) ? 'temporales' : 'temporal') : (de(l) ? 'nasales' : 'nasal');
    return de(l) ? `${who}: ${half} Halbfeld ausgefallen.` : `${who}: ${half} hemifield lost.`;
  },
  'eye.fundus': (v, _c, l, cat, ref) => (de(l)
    ? `Fundus ${sideAdj(ref.side, l)}: Papille ${lab(cat, 'disc', v.disc, l)}.`
    : `${cap(sideAdj(ref.side, l))} fundus: optic disc ${lab(cat, 'disc', v.disc, l)}.`),

  /* ---- ears ----------------------------------------------------------------- */
  'ear.whisper': (v, _c, l, _cat, ref) => {
    const who = de(l) ? `${cap(sideAdj(ref.side, l, 'linkes'))} Ohr` : `${cap(sideAdj(ref.side, l))} ear`;
    return v === 'heard'
      ? (de(l) ? `${who}: Flüsterzahlen korrekt nachgesprochen.` : `${who}: whispered numbers repeated correctly.`)
      : (de(l) ? `${who}: Flüsterzahlen nicht verstanden.` : `${who}: whispered numbers not heard.`);
  },
  'ear.rinne': (v, _c, l, _cat, ref) => (v === 'positive'
    ? (de(l) ? `Rinne ${sideAdj(ref.side, l)} positiv (Luftleitung lauter als Knochenleitung).` : `Rinne ${sideAdj(ref.side, l)}: positive (air conduction louder than bone).`)
    : (de(l) ? `Rinne ${sideAdj(ref.side, l)} negativ (Knochenleitung lauter als Luftleitung).` : `Rinne ${sideAdj(ref.side, l)}: negative (bone conduction louder than air).`)),
  'head.weber': (v, _c, l, cat) => (de(l) ? `Weber: ${lab(cat, 'weber', v, l)}.` : `Weber: ${lab(cat, 'weber', v, l)}.`),

  /* ---- balance and coordination -------------------------------------------- */
  'posture.romberg': (v, ctx, l, cat) => {
    const eyes = ctx.eyesClosed ? (de(l) ? 'mit geschlossenen Augen' : 'eyes closed') : (de(l) ? 'mit offenen Augen' : 'eyes open');
    const toward = v.toward ? (de(l) ? ` nach ${sideAdj(v.toward, l)}` : ` toward the ${sideAdj(v.toward, l)}`) : '';
    if (de(l)) return `Romberg-Stehversuch ${eyes}: ${lab(cat, 'stance', v.stance, l)}${toward}.`;
    return `Feet together, ${eyes}: ${lab(cat, 'stance', v.stance, l)}${toward}.`;
  },
  'gait.pattern': (v, _c, l, cat) => {
    const toward = v.toward ? (de(l) ? ` nach ${sideAdj(v.toward, l)}` : ` toward the ${sideAdj(v.toward, l)}`) : '';
    if (v.pattern === 'normal') return de(l) ? 'Gangbild unauffällig.' : 'Gait normal.';
    return de(l) ? `Gangbild ${lab(cat, 'gait-pattern', v.pattern, l)}${toward}.` : `Gait ${lab(cat, 'gait-pattern', v.pattern, l)}${toward}.`;
  },
  'arm.finger-nose': (v, _c, l, cat, ref) => {
    const who = de(l) ? `Finger-Nase-Versuch ${sideAdj(ref.side, l)}` : `${cap(sideAdj(ref.side, l))} finger–nose`;
    if (v.dysmetria === 'none' && !v.intentionTremor) return de(l) ? `${who}: zielsicher.` : `${who}: accurate.`;
    const t = v.intentionTremor ? (de(l) ? ' mit Intentionstremor' : ' with intention tremor') : '';
    return de(l) ? `${who}: ${lab(cat, 'severity', v.dysmetria, l)} Dysmetrie${t}.` : `${who}: ${lab(cat, 'severity', v.dysmetria, l)} dysmetria${t}.`;
  },

  /* ---- investigations -------------------------------------------------------- */
  'inv.echo': (v, _c, l, cat) => de(l)
    ? `Echo: LVEF ${v.ef} %, maximaler Gradient über der Aortenklappe ${v.aorticPeakGradient} mmHg, Aorteninsuffizienz ${lab(cat, 'severity', v.aorticRegurgitation, l)}, Mitralinsuffizienz ${lab(cat, 'severity', v.mitralRegurgitation, l)}.`
    : `Echo: LVEF ${v.ef}%, peak aortic valve gradient ${v.aorticPeakGradient} mmHg, aortic regurgitation ${lab(cat, 'severity', v.aorticRegurgitation, l)}, mitral regurgitation ${lab(cat, 'severity', v.mitralRegurgitation, l)}.`,
  'inv.ecg': (v, _c, l, cat) => {
    const f = (v.findings ?? []).map((x: string) => lab(cat, 'ecg-finding', x, l));
    return de(l)
      ? `EKG: ${lab(cat, 'rhythm', v.rhythm, l)}, ${v.rate}/min, ${join(f, l)}.`
      : `ECG: ${lab(cat, 'rhythm', v.rhythm, l)}, ${v.rate}/min, ${join(f, l)}.`;
  },
  'inv.glucose': (v, _c, l) => (de(l) ? `Blutzucker ${num(v, l, 1)} mmol/l.` : `Glucose ${num(v, l, 1)} mmol/L.`),
};
