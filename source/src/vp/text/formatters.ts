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

const MOVE_NAMES: Record<string, [string, string]> = {
  shoulderAbduction: ['shoulder abduction', 'Schulterabduktion'], elbowFlexion: ['elbow flexion', 'Ellenbogenbeugung'], elbowExtension: ['elbow extension', 'Ellenbogenstreckung'],
  wristExtension: ['wrist extension', 'Handgelenkstreckung'], fingerFlexion: ['thumb flexion (OK sign)', 'Daumenendgliedbeugung'], thumbAbduction: ['thumb abduction', 'Daumenabduktion'],
  fingerAbduction: ['finger abduction', 'Fingerspreizung'], hipFlexion: ['hip flexion', 'Hüftbeugung'], hipAdduction: ['hip adduction', 'Hüftadduktion'], hipAbduction: ['hip abduction', 'Hüftabduktion'],
  kneeExtension: ['knee extension', 'Kniestreckung'], ankleDorsiflexion: ['ankle dorsiflexion', 'Fußhebung'], footEversion: ['foot eversion', 'Fußeversion'],
  footInversion: ['foot inversion', 'Fußinversion'], anklePlantarflexion: ['ankle plantarflexion', 'Fußsenkung'],
};
const DERMATOME_AREA: Record<string, [string, string]> = {
  C5: ['lateral upper arm', 'Oberarmaußenseite'], C6: ['lateral forearm and thumb', 'radialer Unterarm und Daumen'], C7: ['middle finger', 'Mittelfinger'],
  C8: ['little finger', 'Kleinfinger'], T1: ['medial forearm', 'ulnarer Unterarm'], L2: ['upper anterior thigh', 'proximaler Oberschenkel vorn'],
  L3: ['medial knee', 'Knieinnenseite'], L4: ['medial shin', 'Unterschenkelinnenseite'], L5: ['dorsum of the foot and big toe', 'Fußrücken und Großzehe'], S1: ['lateral foot and sole', 'Fußaußenrand und Fußsohle'],
};


const LUNG_SITE_NAME: Record<string, [string, string]> = {
  'upper-zone': ['upper zone', 'Oberfeld'], 'mid-zone': ['mid zone', 'Mittelfeld'], axilla: ['axilla', 'Axilla'], 'upper-back': ['upper back', 'oberer Rücken'], 'lung-base': ['base', 'Basis'],
};
/** 'Right base' / 'Basis rechts'. */
const chestSite = (ctx: ExamContext, l: Locale, short = false): string => {
  const m = /^chest\.([a-z-]+?)(?:\.(L|R))?$/.exec(ctx.site ?? '');
  const n = LUNG_SITE_NAME[m?.[1] ?? 'lung-base'] ?? LUNG_SITE_NAME['lung-base'];
  const side = m?.[2] as Side | undefined;
  void short;
  return de(l) ? `${n[1]}${side ? ` ${sideAdj(side, l)}` : ''}` : `${side ? `${cap(sideAdj(side, l))} ` : ''}${side ? n[0] : cap(n[0])}`;
};

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
  'vitals.spo2': (v, _c, l) => {
    const sp = typeof v === 'number' ? v : v.spo2, f = typeof v === 'number' ? 0.21 : v.fio2 ?? 0.21;
    const on = f <= 0.215 ? (de(l) ? 'unter Raumluft' : 'on room air') : (de(l) ? `unter FiO₂ ${num(f, l, 2)}` : `on FiO₂ ${num(f, l, 2)}`);
    return de(l) ? `SpO₂ ${num(sp, l)} % ${on}.` : `SpO₂ ${num(sp, l)}% ${on}.`;
  },
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
    const where = chestSite(ctx, l);
    const added = v.added?.length ? join(v.added.map((a: string) => lab(cat, 'added-lung', a, l)), l) : '';
    if (de(l)) {
      const b = v.breath === 'bronchial' ? 'Bronchialatmen' : v.breath === 'absent' ? 'Atemgeräusch aufgehoben' : `Atemgeräusch ${lab(cat, 'breath-sounds', v.breath, l)}`;
      return `${where}: ${b}, ${added ? added : 'keine Nebengeräusche'}.`;
    }
    const b = v.breath === 'absent' ? 'no breath sounds' : `${lab(cat, 'breath-sounds', v.breath, l)} breath sounds`;
    return `${where}: ${b}, ${added || 'no added sounds'}.`;
  },
  'chest.percussion': (v, ctx, l, cat) => (de(l) ? `Perkussion ${chestSite(ctx, l, true)}: ${lab(cat, 'percussion', v.note, l)}.` : `Percussion, ${chestSite(ctx, l, true).toLowerCase()}: ${lab(cat, 'percussion', v.note, l)}.`),
  'chest.resonance': (v, ctx, l, cat) => (de(l) ? `Bronchophonie ${chestSite(ctx, l, true)}: ${lab(cat, 'vocal-resonance', v.resonance, l)}.` : `Vocal resonance, ${chestSite(ctx, l, true).toLowerCase()}: ${lab(cat, 'vocal-resonance', v.resonance, l)}.`),
  'chest.expansion': (v, _c, l, cat, ref) => (de(l) ? `Thoraxexkursion ${sideAdj(ref.side, l)}: ${lab(cat, 'expansion', v.expansion, l)}.` : `Chest expansion on the ${sideAdj(ref.side, l)}: ${lab(cat, 'expansion', v.expansion, l)}.`),
  'trachea.position': (v, _c, l, cat) => (de(l) ? `Trachea ${lab(cat, 'trachea', v.position, l)}.` : `Trachea ${lab(cat, 'trachea', v.position, l)}.`),
  'breathing.pattern': (v, _c, l, cat) => {
    const parts: string[] = [];
    parts.push(lab(cat, 'speech-breath', v.speech, l));
    if (v.depth !== 'normal') parts.push(de(l) ? `Atmung ${lab(cat, 'breath-depth', v.depth, l)}` : `${lab(cat, 'breath-depth', v.depth, l)} breathing`);
    if (v.accessory) parts.push(de(l) ? 'Einsatz der Atemhilfsmuskulatur' : 'using the accessory muscles');
    if (v.pursedLips) parts.push(de(l) ? 'Lippenbremse' : 'pursed-lip breathing');
    if (v.hyperinflated) parts.push(de(l) ? 'Fassthorax' : 'hyperinflated (barrel) chest');
    if (v.paradoxical) parts.push(de(l) ? 'paradoxe abdominelle Atembewegung' : 'paradoxical abdominal movement');
    if (parts.length === 1 && v.speech === 'sentences') parts.push(de(l) ? 'keine erhöhte Atemarbeit' : 'no increased work of breathing');
    return `${cap(parts[0])}${parts.length > 1 ? `; ${parts.slice(1).join(', ')}` : ''}.`;
  },

  'hands.crt': (v, _c, l) => (de(l) ? `Rekapillarisierungszeit ${num(v, l, 1)} s.` : `Capillary refill ${num(v, l, 1)} s.`),
  'legs.oedema': (v, _c, l, cat) => `${cap(lab(cat, 'oedema', v.extent, l))}.`,
  'eyes.sclera': (v, _c, l, cat) => `${cap(lab(cat, 'icterus', v.icterus, l))}.`,
  'eyes.conjunctiva': (v, _c, l, cat) => `${cap(lab(cat, 'severity-pallor', v.pallor, l))}.`,
  'hands.asterixis': (v, _c, l) => (v.flap ? (de(l) ? 'Flapping Tremor: grobschlägiges Flattern der Hände.' : 'Asterixis: a coarse flap of the outstretched hands.') : (de(l) ? 'Kein Flapping Tremor.' : 'No asterixis.')),
  'abdomen.ascites': (v, _c, l, cat) => `${cap(lab(cat, 'ascites', v.ascites, l))}.`,
  'rectal.exam': (v, _c, l, cat) => (de(l) ? `Rektal: ${lab(cat, 'stool', v.stool, l)}.` : `Rectal: ${lab(cat, 'stool', v.stool, l)}.`),
  'skin.liver-stigmata': (v, _c, l) => {
    const parts = [v.spiderNaevi && (de(l) ? 'Spider naevi an Brust und Schultern' : 'spider naevi over the chest and shoulders'), v.palmarErythema && (de(l) ? 'Palmarerythem' : 'palmar erythema'), v.caputMedusae && (de(l) ? 'erweiterte Bauchwandvenen' : 'distended abdominal wall veins')].filter(Boolean) as string[];
    return parts.length ? `${cap(parts.join(', '))}.` : (de(l) ? 'Keine Leberhautzeichen.' : 'No signs of chronic liver disease.');
  },
  'mouth.mucosa': (v, _c, l, cat) => `${cap(lab(cat, 'mucosa', v.moisture, l))}.`,
  'arm.rest-tremor': (v, _c, l, cat, ref) => { const sd = ref?.side === 'L' ? (de(l) ? 'Linke Hand' : 'Left hand') : (de(l) ? 'Rechte Hand' : 'Right hand'); return `${sd}: ${lab(cat, 'rest-tremor', v.tremor, l)}.`; },
  'hands.tremor': (v, _c, l, cat) => `${cap(lab(cat, 'tremor', v.tremor, l))}.`,
  'skin.pigmentation': (v, _c, l, cat) => `${cap(lab(cat, 'pigmentation', v.pigmentation, l))}.`,
  'neck.thyroid': (v, _c, l, cat) => `${cap(lab(cat, 'goitre', v.goitre, l))}${v.bruit ? (de(l) ? '; darüber ein Strömungsgeräusch' : '; a bruit over it') : ''}.`,
  'eyes.thyroid': (v, _c, l) => {
    const parts = [v.lidRetraction && (de(l) ? 'Lidretraktion (Sklera über der Iris sichtbar)' : 'lid retraction (sclera visible above the iris)'), v.lidLag && (de(l) ? 'Graefe-Zeichen (Oberlid bleibt beim Blick nach unten zurück)' : 'lid lag on looking down'), v.exophthalmos && (de(l) ? 'beidseitiger Exophthalmus' : 'bilateral exophthalmos')].filter(Boolean) as string[];
    return parts.length ? `${cap(parts.join('; '))}.` : (de(l) ? 'Lider und Bulbusstellung unauffällig.' : 'Lids and eye position normal.');
  },
  'skin.turgor': (v, _c, l, cat) => `${cap(lab(cat, 'turgor', v.turgor, l))}.`,
  'breath.odour': (v, _c, l, cat) => `${cap(lab(cat, 'breath-odour', v.odour, l))}.`,
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
  'eye.lid': (v, ctx, l, cat, ref) => {
    if (ctx.sustainedSeconds) {
      const pre = de(l) ? `Nach ${ctx.sustainedSeconds} s Blick nach oben: ` : `After ${ctx.sustainedSeconds} s of upgaze: `;
      return pre + FORMATTERS['eye.lid'](v, {}, l, cat, ref).replace(/^./, (c) => c.toLowerCase());
    }
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
    /* A healthy integrator's drift: say that it is normal, so the learner does not take it for a sign. */
    if (v.physiological) return de(l)
      ? `${g}${fix}: feiner Endstellnystagmus ${dir}, ${amp} Amplitude (ca. ${num(v.amplitudeDeg, l, 1)}°) – physiologisch, bei diesem Blickwinkel häufig.`
      : `${g}${fix}: fine end-point nystagmus, fast phase ${dir}, ${amp} amplitude (about ${num(v.amplitudeDeg, l, 1)}°): physiological, common at this angle of gaze.`;
    return de(l)
      ? `${g}${fix}: ${plane} Rucknystagmus ${dir}${tors}, ${amp} Amplitude (ca. ${num(v.amplitudeDeg, l, 1)}°), ca. ${num(v.frequencyHz, l, 1)} Hz.`
      : `${g}${fix}: ${plane} jerk nystagmus, fast phase ${dir}${tors}, ${amp} amplitude (about ${num(v.amplitudeDeg, l, 1)}°), about ${num(v.frequencyHz, l, 1)} Hz.`;
  },
  'eye.head-impulse': (v, _c, l, _cat, ref) => {
    const dir = de(l) ? `nach ${sideAdj(ref.side, l)}` : `to the ${sideAdj(ref.side, l)}`;
    if (v.saccade === 'overt') return de(l)
      ? `Kopfimpuls ${dir}: die Augen werden mit dem Kopf mitgenommen, dann sichtbare Refixationssakkade zurück zum Ziel.`
      : `Head impulse ${dir}: the eyes are carried off target with the head, then an overt corrective saccade back to the target.`;
    if (v.saccade === 'covert') return de(l)
      ? `Kopfimpuls ${dir}: die Augen bleiben kaum zurück; eine kleine Korrektursakkade noch während der Drehung (verdeckt), am Bett schwer zu sehen.`
      : `Head impulse ${dir}: the eyes lag a little; a small corrective saccade during the turn (covert), hard to see at the bedside.`;
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
    const limbSide = v.pattern === 'hemiplegic' || v.pattern === 'high-stepping';
    const toward = !v.toward ? '' : limbSide
      ? (de(l) ? ` (${sideAdj(v.toward, l, 'linkes')} Bein)` : ` (${sideAdj(v.toward, l)} leg)`)
      : (de(l) ? ` nach ${sideAdj(v.toward, l)}` : ` toward the ${sideAdj(v.toward, l)}`);
    if (v.pattern === 'normal') return de(l) ? 'Gangbild unauffällig.' : 'Gait normal.';
    return de(l) ? `Gangbild ${lab(cat, 'gait-pattern', v.pattern, l)}${toward}.` : `Gait ${lab(cat, 'gait-pattern', v.pattern, l)}${toward}.`;
  },
  'arm.finger-nose': (v, ctx, l, cat, ref) => {
    const heel = ref.property === 'leg.heel-shin';
    const eyes = ctx.eyesClosed ? (de(l) ? ' (Augen geschlossen)' : ' (eyes closed)') : '';
    const who = (de(l) ? `${heel ? 'Knie-Hacke-Versuch' : 'Finger-Nase-Versuch'} ${sideAdj(ref.side, l)}` : `${cap(sideAdj(ref.side, l))} ${heel ? 'heel–shin' : 'finger–nose'}`) + eyes;
    if (v.limitedByWeakness) return de(l) ? `${who}: wegen der Parese nicht durchführbar.` : `${who}: cannot be performed because of weakness.`;
    if (v.dysmetria === 'none' && !v.intentionTremor) return de(l) ? `${who}: zielsicher.` : `${who}: accurate.`;
    const t = v.intentionTremor ? (de(l) ? ' mit Intentionstremor' : ' with intention tremor') : '';
    return de(l) ? `${who}: ${lab(cat, 'severity', v.dysmetria, l)} Dysmetrie${t}.` : `${who}: ${lab(cat, 'severity', v.dysmetria, l)} dysmetria${t}.`;
  },


  /* ---- neurology ------------------------------------------------------------------ */
  'face.movement': (v, _c, l, _cat, ref) => {
    const who = de(l) ? `${cap(sideAdj(ref.side, l, 'linke'))} Gesichtshälfte` : `${cap(sideAdj(ref.side, l))} face`;
    if (v.forehead === 'normal' && v.eyeClosure === 'normal' && v.mouth === 'normal')
      return de(l) ? `${who}: Stirnrunzeln, Lidschluss und Zähnezeigen seitengleich.` : `${who}: brow raise, eye closure and smile full and symmetrical.`;
    const parts: string[] = [];
    const w = (x: string, en: [string, string], dx: [string, string]) => x === 'normal' ? (de(l) ? dx[0] : en[0]) : (de(l) ? dx[1] : en[1]);
    parts.push(w(v.forehead, ['brow raises normally', v.forehead === 'absent' ? 'cannot raise the brow' : 'brow raise weak'], ['Stirnrunzeln erhalten', v.forehead === 'absent' ? 'kein Stirnrunzeln' : 'Stirnrunzeln schwach']));
    parts.push(w(v.eyeClosure, ['eye closes fully', v.eyeClosure === 'absent' ? 'eye does not close (Bell’s phenomenon visible)' : 'eye closure weak, lashes not buried'], ['Lidschluss vollständig', v.eyeClosure === 'absent' ? 'kein Lidschluss (Bell-Phänomen sichtbar)' : 'Lidschluss schwach, Wimpern nicht versenkt']));
    parts.push(w(v.mouth, ['smile symmetrical', v.mouth === 'absent' ? 'mouth does not move' : 'nasolabial fold flattened, corner of the mouth droops'], ['Mundwinkel seitengleich', v.mouth === 'absent' ? 'keine Bewegung des Mundwinkels' : 'Nasolabialfalte verstrichen, Mundwinkel hängt']));
    return `${who}: ${parts.join(', ')}.`;
  },
  'face.sensation': (v, _c, l, cat, ref) => {
    const who = de(l) ? `${cap(sideAdj(ref.side, l, 'linke'))} Gesichtshälfte` : `${cap(sideAdj(ref.side, l))} face`;
    const lost = (['V1', 'V2', 'V3'] as const).filter((k) => v[k] !== 'normal');
    const sens = !lost.length ? (de(l) ? 'Berührung und Spitz-stumpf in V1–V3 intakt' : 'light touch and pinprick intact in V1–V3')
      : lost.map((k) => `${k} ${lab(cat, 'sense-level', v[k], l)}`).join(', ');
    const corneal = v.corneal ? (de(l) ? 'Kornealreflex vorhanden' : 'corneal reflex present') : (de(l) ? 'Kornealreflex fehlt' : 'corneal reflex absent');
    return `${who}: ${sens}; ${corneal}.`;
  },
  'jaw.opening': (v, _c, l, cat) => (v.deviatesTo === 'none'
    ? (de(l) ? 'Mundöffnung gerade, Kaumuskulatur kräftig.' : 'Jaw opens in the midline; masseters strong.')
    : (de(l) ? `Unterkiefer weicht bei Mundöffnung ${lab(cat, 'deviation', v.deviatesTo, l)} ab.` : `Jaw deviates ${lab(cat, 'deviation', v.deviatesTo, l)} on opening.`)),
  'mouth.palate': (v, _c, l, cat) => {
    const uv = v.uvulaDeviatesTo === 'none'
      ? (de(l) ? 'Gaumensegel hebt sich symmetrisch, Uvula mittig' : 'palate elevates symmetrically, uvula central')
      : (de(l) ? `Uvula wird ${lab(cat, 'deviation', v.uvulaDeviatesTo, l)} gezogen` : `uvula pulled ${lab(cat, 'deviation', v.uvulaDeviatesTo, l)}`);
    const gag = v.gagLeft && v.gagRight ? (de(l) ? 'Würgreflex beidseits auslösbar' : 'gag present on both sides')
      : (de(l) ? `Würgreflex ${!v.gagLeft && !v.gagRight ? 'beidseits' : !v.gagLeft ? 'links' : 'rechts'} nicht auslösbar` : `gag absent when touching the ${!v.gagLeft && !v.gagRight ? 'both sides' : !v.gagLeft ? 'left side' : 'right side'}`);
    const voice = de(l) ? `Stimme ${lab(cat, 'voice', v.voice, l)}` : `voice ${lab(cat, 'voice', v.voice, l)}`;
    return `${cap(uv)}; ${gag}; ${voice}.`;
  },
  'mouth.tongue': (v, _c, l, cat) => {
    const pos = v.deviatesTo === 'none' ? (de(l) ? 'Zunge wird gerade herausgestreckt' : 'Tongue protrudes in the midline')
      : (de(l) ? `Zunge weicht beim Herausstrecken ${lab(cat, 'deviation', v.deviatesTo, l)} ab` : `Tongue deviates ${lab(cat, 'deviation', v.deviatesTo, l)} on protrusion`);
    const extra: string[] = [];
    if (v.wasting) extra.push(de(l) ? 'Atrophie' : 'wasting');
    if (v.fasciculation) extra.push(de(l) ? 'Faszikulationen' : 'fasciculation');
    return extra.length ? `${pos}, ${join(extra, l)}.` : `${pos}; ${de(l) ? 'keine Atrophie, keine Faszikulationen' : 'no wasting or fasciculation'}.`;
  },
  'shoulder.shrug': (v, _c, l, _cat, ref) => (de(l)
    ? `Schulterheben und Kopfdrehung ${sideAdj(ref.side, l)}: Kraftgrad ${v.power}/5.`
    : `${cap(sideAdj(ref.side, l))} shoulder shrug and head turn: ${v.power}/5.`),
  'speech.language': (v, _c, l, cat) => {
    const all = v.fluency === 'normal' && v.comprehension === 'normal' && v.repetition === 'normal' && v.naming === 'normal';
    if (all && v.articulation === 'normal') return de(l) ? 'Spontansprache flüssig und deutlich; Sprachverständnis, Benennen und Nachsprechen intakt.' : 'Speech fluent and clear; comprehension, naming and repetition intact.';
    const p: string[] = [];
    p.push(v.fluency === 'normal' ? (de(l) ? 'Spontansprache flüssig' : 'fluent speech') : (de(l) ? 'Spontansprache nicht flüssig, mühsam, Telegrammstil' : 'non-fluent, effortful, telegraphic speech'));
    p.push(v.comprehension === 'normal' ? (de(l) ? 'befolgt einen dreiteiligen Auftrag' : 'follows a three-step command') : (de(l) ? 'Sprachverständnis gestört' : 'comprehension impaired'));
    p.push(v.naming === 'normal' ? (de(l) ? 'Benennen intakt' : 'naming intact') : (de(l) ? 'Benennstörung' : 'naming impaired'));
    p.push(v.repetition === 'normal' ? (de(l) ? 'Nachsprechen intakt' : 'repetition intact') : (de(l) ? 'Nachsprechen gestört' : 'repetition impaired'));
    p.push(de(l) ? `Artikulation ${lab(cat, 'articulation', v.articulation, l)}` : `articulation ${lab(cat, 'articulation', v.articulation, l)}`);
    return `${cap(p.join('; '))}.`;
  },
  'speech.fatigue': (v, _c, l) => (v.voice === 'normal'
    ? (de(l) ? 'Zählen bis 50: Stimme bleibt klar und kräftig.' : 'Counting to 50: voice stays clear and strong.')
    : (de(l) ? 'Zählen bis 50: Stimme wird ab etwa 30 leiser und näselnd.' : 'Counting to 50: voice fades and becomes nasal from about 30.')),
  'limb.tone': (v, _c, l, cat, ref) => {
    const limb = ref.property.startsWith('arm') ? (de(l) ? 'Arm' : 'arm') : (de(l) ? 'Bein' : 'leg');
    const who = de(l) ? `${cap(sideAdj(ref.side, l, limb === 'Arm' ? 'linke' : 'linkes'))}${limb === 'Arm' ? 'r' : ''} ${limb}` : `${cap(sideAdj(ref.side, l))} ${limb}`;
    const bulk = [v.wasting ? (de(l) ? 'Atrophie' : 'wasting') : '', v.fasciculation ? (de(l) ? 'Faszikulationen' : 'fasciculation') : ''].filter(Boolean);
    return `${who}: ${lab(cat, 'tone', v.tone, l)}, ${bulk.length ? join(bulk, l) : (de(l) ? 'keine Atrophie, keine Faszikulationen' : 'no wasting or fasciculation')}.`;
  },
  'limb.power': (v, ctx, l, _cat, ref) => {
    const arm = ref.property.startsWith('arm');
    const who = de(l) ? `Kraft ${sideAdj(ref.side, l, 'linke')}${arm ? 'r Arm' : 's Bein'} (MRC)` : `${cap(sideAdj(ref.side, l))} ${arm ? 'arm' : 'leg'} power (MRC)`;
    const pre = ctx.repetition && ctx.repetition > 1 ? (de(l) ? `Nach ${ctx.repetition} Wiederholungen — ` : `After ${ctx.repetition} repetitions — `) : '';
    const weak = Object.entries(v as Record<string, number>).filter(([, p]) => p < 5);
    const w2 = pre ? who.charAt(0).toLowerCase() + who.slice(1) : who;
    if (!weak.length) return de(l) ? `${pre}${who}: 5/5 in allen Kennmuskeln.` : `${pre}${w2}: 5/5 throughout.`;
    const names = MOVE_NAMES;
    const listTxt = weak.map(([m, p]) => `${names[m]?.[de(l) ? 1 : 0] ?? m} ${p}/5`).join(', ');
    return de(l) ? `${pre}${who}: ${listTxt}; übrige 5/5.` : `${pre}${w2}: ${listTxt}; otherwise 5/5.`;
  },
  'limb.reflexes': (v, _c, l, cat, ref) => {
    const arm = ref.property.startsWith('arm');
    const who = de(l) ? `Reflexe ${sideAdj(ref.side, l, 'linke')}${arm ? 'r Arm' : 's Bein'}` : `${cap(sideAdj(ref.side, l))} ${arm ? 'arm' : 'leg'} reflexes`;
    const g = (n: number) => (de(l) ? ['erloschen (0)', 'abgeschwächt (1+)', 'mittellebhaft (2+)', 'gesteigert (3+)', 'gesteigert mit Klonus (4+)'] : ['absent (0)', 'reduced (1+)', 'normal (2+)', 'brisk (3+)', 'brisk with clonus (4+)'])[n];
    const names: Record<string, [string, string]> = { biceps: ['biceps', 'BSR'], supinator: ['supinator', 'RPR'], triceps: ['triceps', 'TSR'], knee: ['knee', 'PSR'], ankle: ['ankle', 'ASR'] };
    const parts = Object.keys(names).filter((k) => k in v).map((k) => `${names[k][de(l) ? 1 : 0]} ${g(v[k])}`);
    if (!arm) parts.push(de(l) ? lab(cat, 'plantar', v.plantar, l) : `plantar ${lab(cat, 'plantar', v.plantar, l)}`);
    return `${who}: ${parts.join(', ')}.`;
  },
  'limb.pinprick': (v, _c, l, cat, ref) => {
    const arm = ref.property.startsWith('arm');
    const who = de(l) ? `Schmerzempfinden ${sideAdj(ref.side, l, 'linke')}${arm ? 'r Arm' : 's Bein'}` : `${cap(sideAdj(ref.side, l))} ${arm ? 'arm' : 'leg'} pinprick`;
    const segs = Object.keys(v).filter((k) => /^[CLTS]\d/.test(k) && v[k] !== 'normal');
    const parts: string[] = segs.map((g) => `${lab(cat, 'sense-level', v[g], l)} ${de(l) ? 'im Dermatom' : 'in'} ${g} (${DERMATOME_AREA[g]?.[de(l) ? 1 : 0] ?? g})`);
    for (const t of v.territories ?? []) parts.push(de(l) ? `scharf begrenzter Ausfall im Versorgungsgebiet ${lab(cat, 'territory', t, l)}` : `loss with a sharp edge confined to the ${lab(cat, 'territory', t, l)}`);
    if (!parts.length) return de(l) ? `${who}: in allen Dermatomen intakt.` : `${who}: intact in every dermatome.`;
    return de(l) ? `${who}: ${parts.join('; ')}; sonst intakt.` : `${who}: ${parts.join('; ')}; otherwise intact.`;
  },
  'limb.vibration': (v, _c, l, cat, ref) => {
    const arm = ref.property.startsWith('arm');
    const where = de(l) ? (arm ? `Zeigefinger ${sideAdj(ref.side, l)}` : `Großzehe ${sideAdj(ref.side, l)}`) : `${cap(sideAdj(ref.side, l))} ${arm ? 'index finger' : 'big toe'}`;
    if (v.vibration === 'normal' && v.proprioception === 'normal') return de(l) ? `${where}: Vibration und Lagesinn intakt.` : `${where}: vibration and joint position sense intact.`;
    return de(l) ? `${where}: Vibration ${lab(cat, 'sense-level', v.vibration, l)}, Lagesinn ${lab(cat, 'sense-level', v.proprioception, l)}.`
      : `${where}: vibration ${lab(cat, 'sense-level', v.vibration, l)}, joint position sense ${lab(cat, 'sense-level', v.proprioception, l)}.`;
  },
  'arm.drift': (v, _c, l, _cat, ref) => (v.drift
    ? (de(l) ? `${cap(sideAdj(ref.side, l, 'linke'))}r Arm: proniert und sinkt ab.` : `${cap(sideAdj(ref.side, l))} arm pronates and drifts down.`)
    : (de(l) ? `${cap(sideAdj(ref.side, l, 'linke'))}r Arm: wird gehalten.` : `${cap(sideAdj(ref.side, l))} arm held steady.`)),
  'trunk.pinprick': (v, _c, l, cat, ref) => {
    const who = de(l) ? `Rumpf ${sideAdj(ref.side, l)}` : `${cap(sideAdj(ref.side, l))} trunk`;
    if (v.T6 === 'normal' && v.T10 === 'normal') return de(l) ? `${who}: Schmerzempfinden bei T6 und T10 intakt.` : `${who}: pinprick intact at T6 and T10.`;
    return `${who}: T6 ${lab(cat, 'sense-level', v.T6, l)}, T10 ${lab(cat, 'sense-level', v.T10, l)}.`;
  },
  'saddle.sensation': (v, _c, l, cat) => (v.pinprick === 'normal'
    ? (de(l) ? 'Perianale Sensibilität intakt.' : 'Perianal sensation intact.')
    : (de(l) ? `Perianale Sensibilität ${lab(cat, 'sense-level', v.pinprick, l)}.` : `Perianal sensation ${lab(cat, 'sense-level', v.pinprick, l)}.`)),
  'leg.slr': (v, _c, l, _cat, ref) => (v.positive
    ? (de(l) ? `Lasègue ${sideAdj(ref.side, l)} positiv${v.angleDeg ? ` bei ${v.angleDeg}°` : ''}, einschießender Schmerz bis unter das Knie.` : `${cap(sideAdj(ref.side, l))} straight leg raise positive${v.angleDeg ? ` at ${v.angleDeg}°` : ''}, reproducing pain shooting below the knee.`)
    : (de(l) ? `Lasègue ${sideAdj(ref.side, l)} negativ.` : `${cap(sideAdj(ref.side, l))} straight leg raise negative.`)),
  'arm.rapid-alternating': (v, _c, l, _cat, ref) => {
    const who = de(l) ? `Diadochokinese ${sideAdj(ref.side, l)}` : `${cap(sideAdj(ref.side, l))} hand, rapid alternating movements`;
    if (v.dysdiadochokinesia) return de(l) ? `${who}: unregelmäßig und zerfahren (Dysdiadochokinese).` : `${who}: irregular and disorganised (dysdiadochokinesia).`;
    if (v.slowed) return de(l) ? `${who}: verlangsamt und ungeschickt, aber regelmäßig.` : `${who}: slow and clumsy but regular.`;
    return de(l) ? `${who}: unauffällig.` : `${who}: normal.`;
  },

  /* ---- investigations -------------------------------------------------------- */
  'inv.echo': (v, _c, l, cat) => de(l)
    ? `Echo: LVEF ${v.ef} %, maximaler Gradient über der Aortenklappe ${v.aorticPeakGradient} mmHg, Aorteninsuffizienz ${lab(cat, 'severity', v.aorticRegurgitation, l)}, Mitralinsuffizienz ${lab(cat, 'severity', v.mitralRegurgitation, l)}.`
    : `Echo: LVEF ${v.ef}%, peak aortic valve gradient ${v.aorticPeakGradient} mmHg, aortic regurgitation ${lab(cat, 'severity', v.aorticRegurgitation, l)}, mitral regurgitation ${lab(cat, 'severity', v.mitralRegurgitation, l)}.`,
  'inv.ecg': (v, _c, l) => {
    const ax = `${v.axis > 0 ? '+' : ''}${v.axis}°`;
    return de(l)
      ? `12-Kanal-EKG (Gerätevermessung): Frequenz ${v.rate}/min, ${v.pr != null ? `PQ ${v.pr} ms` : 'PQ nicht messbar'}, QRS ${v.qrs} ms, QTc ${v.qtc} ms, Achse ${ax}. Die Kurve liegt unter Befunde.`
      : `12-lead ECG (machine measurements): rate ${v.rate}/min, ${v.pr != null ? `PR ${v.pr} ms` : 'PR not measurable'}, QRS ${v.qrs} ms, QTc ${v.qtc} ms, axis ${ax}. The tracing is under Results.`;
  },
  'ecg.reading': (v, _c, l, cat) => {
    const ax = `${v.axis > 0 ? '+' : ''}${v.axis}°`;
    const n = (x: number) => (de(l) ? String(x).replace('.', ',') : String(x));
    const big = (rec: Record<string, number>) => Object.entries(rec ?? {}).filter(([k]) => k !== 'aVR').sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0] ?? ['—', 0];
    const [stL, stV] = big(v.st), p = lab(cat, 'ecg-p-waves', v.pWaves, l), cond = lab(cat, 'ecg-conduction', v.conduction, l);
    return de(l)
      ? `EKG befundet: ${p}, ${cond}; ${v.regular ? 'regelmäßig' : 'unregelmäßig'} ${v.rate}/min; ${v.pr != null ? `PQ ${v.pr} ms` : 'PQ nicht messbar'}, QRS ${v.qrs} ms (V1 ${v.v1}, V6 ${v.v6}${v.delta ? ', Deltawelle' : ''}), QTc ${v.qtc} ms, Achse ${ax}; größte ST-Abweichung ${n(stV)} mV in ${stL}; U ${n(v.u)} mV; Sokolow-Lyon ${n(v.sokolow)} mV.`
      : `ECG read: ${p}, ${cond}; ${v.regular ? 'regular' : 'irregular'} at ${v.rate}/min; ${v.pr != null ? `PR ${v.pr} ms` : 'PR not measurable'}, QRS ${v.qrs} ms (V1 ${v.v1}, V6 ${v.v6}${v.delta ? ', delta wave' : ''}), QTc ${v.qtc} ms, axis ${ax}; largest ST shift ${n(stV)} mV in ${stL}; U ${n(v.u)} mV; Sokolow–Lyon ${n(v.sokolow)} mV.`;
  },
  'inv.panel': (v, _c, l, cat, ref) => {
    const names: Record<string, [string, string, string]> = {
      sodium: ['Na⁺', 'Na⁺', 'mmol/L'], potassium: ['K⁺', 'K⁺', 'mmol/L'], chloride: ['Cl⁻', 'Cl⁻', 'mmol/L'], bicarbonate: ['HCO₃⁻', 'HCO₃⁻', 'mmol/L'],
      urea: ['urea', 'Harnstoff', 'mmol/L'], creatinine: ['creatinine', 'Kreatinin', 'µmol/L'], arterialPH: ['pH', 'pH', ''], paCO2: ['PaCO₂', 'PaCO₂', 'kPa'],
      paO2: ['PaO₂', 'PaO₂', 'kPa'], lactate: ['lactate', 'Laktat', 'mmol/L'], haemoglobin: ['Hb', 'Hb', 'g/L'], whiteCellCount: ['WCC', 'Leukozyten', '×10⁹/L'],
      platelets: ['platelets', 'Thrombozyten', '×10⁹/L'], mcv: ['MCV', 'MCV', 'fL'], troponin: ['troponin', 'Troponin', 'ng/L'], bnp: ['BNP', 'BNP', 'ng/L'], crp: ['CRP', 'CRP', 'mg/L'],
      baseExcess: ['BE', 'BE', 'mmol/L'], saO2: ['SaO₂', 'SaO₂', '%'], coHb: ['COHb', 'COHb', '%'], metHb: ['MetHb', 'MetHb', '%'], fio2: ['FiO₂', 'FiO₂', ''],
      glucose: ['glucose', 'Glukose', 'mmol/L'], betaHydroxybutyrate: ['β-hydroxybutyrate', 'β-Hydroxybutyrat', 'mmol/L'], osmolality: ['osmolality', 'Osmolalität', 'mosmol/kg'],
      mlPerHour: ['urine', 'Urin', 'mL/h'], bilirubin: ['bilirubin', 'Bilirubin', 'µmol/L'], alt: ['ALT', 'ALT', 'U/L'], alp: ['ALP', 'AP', 'U/L'], ggt: ['GGT', 'γGT', 'U/L'],
      inr: ['INR', 'INR', ''], aptt: ['APTT', 'aPTT', 's'], ammonia: ['ammonia', 'Ammoniak', 'µmol/L'], ferritin: ['ferritin', 'Ferritin', 'µg/L'], b12: ['B₁₂', 'B₁₂', 'pmol/L'], folate: ['folate', 'Folsäure', 'µg/L'],
      reticulocytes: ['reticulocytes', 'Retikulozyten', '%'], ldh: ['LDH', 'LDH', 'U/L'], haptoglobin: ['haptoglobin', 'Haptoglobin', 'g/L'], bilirubinUnconjugated: ['unconjugated bilirubin', 'unkonjugiertes Bilirubin', 'µmol/L'], mlPerKgPerHour: ['', '', 'mL/kg/h'], tsh: ['TSH', 'TSH', 'mU/L'], ft4: ['free T4', 'fT4', 'pmol/L'], ft3: ['free T3', 'fT3', 'pmol/L'],
      cortisol: ['cortisol', 'Cortisol', 'nmol/L'], acth: ['ACTH', 'ACTH', 'ng/L'], cortisol0: ['cortisol at 0 min', 'Cortisol bei 0 min', 'nmol/L'], cortisol30: ['cortisol at 30 min', 'Cortisol nach 30 min', 'nmol/L'],
      renin: ['renin', 'Renin', 'mU/L'], aldosterone: ['aldosterone', 'Aldosteron', 'pmol/L'], calciumTotal: ['calcium (total)', 'Calcium (gesamt)', 'mmol/L'], calcium: ['calcium (adjusted)', 'Calcium (korrigiert)', 'mmol/L'],
      pth: ['PTH', 'PTH', 'pmol/L'], vitaminD: ['25-OH vitamin D', '25-OH-Vitamin-D', 'nmol/L'], phosphate: ['phosphate', 'Phosphat', 'mmol/L'], albumin: ['albumin', 'Albumin', 'g/L'],
    };
    const inv = cat.investigations[ref.property];
    const range = (inv?.normal.range ?? {}) as Record<string, [number, number]>;
    const parts = Object.entries(v as Record<string, number>).map(([k, x]) => {
      const [en, dn, unit] = names[k] ?? [k, k, ''];
      const r = range[k];
      const flag = r ? (x < r[0] ? ' ↓' : x > r[1] ? ' ↑' : '') : '';
      return `${de(l) ? dn : en} ${num(x, l, k === 'arterialPH' || k === 'fio2' || k === 'tsh' || k === 'calcium' || k === 'calciumTotal' || k === 'phosphate' ? 2 : (Number.isInteger(x) ? 0 : 1))}${unit ? ' ' + unit : ''}${flag}`;
    });
    return `${tr(inv?.label ?? { en: ref.property }, l)}: ${parts.join(', ')}.`;
  },
  'inv.imaging': (v, _c, l, cat, ref) => `${tr(cat.investigations[ref.property]?.label ?? { en: ref.property }, l)}: ${(v.findings ?? []).map((x: string) => lab(cat, 'imaging', x, l)).join('; ')}.`,
  'inv.urinalysis': (v, _c, l, cat) => {
    if (!v.voided) return de(l) ? 'Urinstix: kein Urin zu gewinnen (der Patient hat seit Stunden kein Wasser gelassen).' : 'Urine dipstick: no urine to test (none passed for hours).';
    const d = (k: string, en: string, dn: string) => `${de(l) ? dn : en} ${lab(cat, 'dipstick', v[k], l)}`;
    const parts = [d('glucose', 'glucose', 'Glukose'), d('ketones', 'ketones', 'Ketone'), d('protein', 'protein', 'Eiweiß'), d('blood', 'blood', 'Blut'),
      d('leukocytes', 'leukocytes', 'Leukozyten'), d('nitrites', 'nitrites', 'Nitrit'), ...(v.bilirubin ? [d('bilirubin', 'bilirubin', 'Bilirubin')] : []), `${de(l) ? 'spez. Gewicht' : 'SG'} ${num(v.sg, l, 3)}`, `pH ${num(v.ph, l, 1)}`];
    return `${de(l) ? 'Urinstix' : 'Urine dipstick'}: ${parts.join(', ')}.`;
  },
  'inv.glucose': (v, _c, l) => (de(l) ? `Blutzucker ${num(v, l, 1)} mmol/l.` : `Glucose ${num(v, l, 1)} mmol/L.`),
  'inv.ddimer': (v, _c, l) => (de(l) ? `D-Dimere ${num(v, l, 2)} mg/l FEU${v > 0.5 ? ' ↑' : ''}.` : `D-dimer ${num(v, l, 2)} mg/L FEU${v > 0.5 ? ' ↑' : ''}.`),
  'inv.peakflow': (v, _c, l) => (de(l) ? `Peak-Flow ${v.pef} l/min (${v.pefPct} % des Sollwerts), bester von drei Versuchen.` : `Peak flow ${v.pef} L/min (${v.pefPct}% predicted), best of three.`),
  'inv.spirometry': (v, _c, l) => de(l)
    ? `Spirometrie: FEV₁ ${num(v.fev1, l, 2)} l (${v.fev1Pct} % Soll), FVC ${num(v.fvc, l, 2)} l (${v.fvcPct} % Soll), FEV₁/FVC ${num(v.ratio, l, 2)}, PEF ${v.pef} l/min.`
    : `Spirometry: FEV₁ ${num(v.fev1, l, 2)} L (${v.fev1Pct}% predicted), FVC ${num(v.fvc, l, 2)} L (${v.fvcPct}% predicted), FEV₁/FVC ${num(v.ratio, l, 2)}, PEF ${v.pef} L/min.`,
  'inv.chest-imaging': (v, _c, l, cat, ref) => `${tr(cat.investigations[ref.property]?.label ?? { en: ref.property }, l)}: ${(v.findings ?? []).map((x: string) => lab(cat, 'chest-imaging', x, l)).join('; ')}.`,
};
