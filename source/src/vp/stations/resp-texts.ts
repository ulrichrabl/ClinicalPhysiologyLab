import type { LocalizedText } from '../model/i18n.ts';
import type { RespTestId, SiteKey } from './resp-tests.ts';

/* ---------------------------------------------------------------------------
   The respiratory station's explanations: why the chest sounds and feels as
   it does here. Written per test and per situation, in English and German,
   filled with the model's own numbers and selected by what the model is
   doing (the findings, the lung under the site, the gases, the mechanics).
   Nothing here decides what is found; it says why. Drafts until a
   clinician has read them.
--------------------------------------------------------------------------- */

const L = (en: string, de: string): LocalizedText => ({ en, de });

export interface RespContext {
  test: RespTestId;
  /** the site being examined, what was found there, and what lies beneath (fractions of the lung under it) */
  site?: {
    key: SiteKey; side: 'L' | 'R'; label: LocalizedText;
    note: string; breath: string; added: string[]; resonance: string;
    under: { aerated: number; solid: number; flooded: number; obstructed: number; compressed: number; ptx: number };
    /** pleural fluid on that side (mL), and whether it lies between this site and the lung */
    fluid: number; fluidHere: boolean;
  };
  r: { RR: number; VT: number; VE: number; SaO2: number; PaO2: number; PaCO2: number; AaGradient: number; shunt: number; VDVT: number;
    iPEEP: number; tauE: number; Te: number; Ti: number; effort: number; demand: number; capacity: number; deoxyHb: number; interstitial: number; FiO2: number;
    FEV1pct: number; PEFpct: number };
  p: { bronchoconstriction: number; emphysema: number; fibrosis: number; muscleStrength: number; effusionL: number; effusionR: number; ptxL: number; ptxR: number; tensionL: number; tensionR: number; capillaryLeak: number; emb: number };
  trachea: { position: string; shift: number };
  /** the share of each breath that goes to each side, and the finding */
  expansion: { L: { share: number; finding: string }; R: { share: number; finding: string } };
  pattern: { depth: string; accessory: boolean; pursedLips: boolean; speech: string; hyperinflated: boolean; paradoxical: boolean };
  /** the threshold of capillary deoxyhaemoglobin for visible cyanosis (g/L) */
  cyanosisAt: number;
}

export interface RespText { title: LocalizedText; body: LocalizedText[] }

const r0 = Math.round;
const n1 = (x: number) => (Math.round(x * 10) / 10).toString();
const d1 = (x: number) => n1(x).replace('.', ',');
const pc = (x: number) => r0(x * 100);
const sideEn = (s: 'L' | 'R') => (s === 'L' ? 'left' : 'right');
const sideDe = (s: 'L' | 'R') => (s === 'L' ? 'links' : 'rechts');
const MMHG = 7.50062;

export function explainResp(c: RespContext): RespText[] {
  switch (c.test) {
    case 'look': return look(c);
    case 'trachea': return trachea(c);
    case 'expansion': return expansion(c);
    case 'percussion': return [{ title: L('Percussion', 'Perkussion'), body: percussion(c) }];
    case 'auscultation': return [{ title: L('Breath sounds', 'Atemgeräusch'), body: auscultation(c) }];
    case 'resonance': return [{ title: L('Vocal resonance', 'Bronchophonie'), body: resonance(c) }];
  }
}

/* ---- looking: rate, pattern, colour, oxygen ------------------------------------------------------------- */
function look(c: RespContext): RespText[] {
  const r = c.r, p = c.pattern, out: LocalizedText[] = [];
  out.push(L(`The respiratory centre asks for ${n1(r.demand)} L/min; the muscles and the lungs deliver ${n1(r.VE)}: ${r0(r.RR)} breaths of ${r0(r.VT * 1000)} mL a minute. Of each breath, a fixed dead space never reaches the alveoli: ${pc(r.VDVT)} % of this one is wasted.`,
    `Das Atemzentrum fordert ${d1(r.demand)} l/min; Muskeln und Lunge liefern ${d1(r.VE)}: ${r0(r.RR)} Atemzüge zu ${r0(r.VT * 1000)} ml pro Minute. Von jedem Atemzug erreicht ein fester Totraum die Alveolen nie: Hier sind ${pc(r.VDVT)} % verschwendet.`));
  if (r.RR > 20) out.push(p.depth === 'shallow' || r.VT < 0.35
    ? L('The breaths are fast and small. Stiff or flooded lungs cost more effort per litre of depth than per breath, so the centre buys its ventilation with rate; each small breath carries more dead space, so more breaths are needed still.',
      'Die Atemzüge sind schnell und klein. Steife oder geflutete Lungen kosten pro Liter Tiefe mehr Kraft als pro Atemzug, also erkauft das Zentrum seine Ventilation mit Frequenz; jeder kleine Atemzug trägt mehr Totraum, also braucht es noch mehr Atemzüge.')
    : L(`Fast breathing (${r0(r.RR)}/min): the centre is driven by the blood gases and by the lung's own receptors (stretch, irritant and J receptors in inflamed, flooded or embolised lung), which make people breathe faster than their gases alone would.`,
      `Schnelle Atmung (${r0(r.RR)}/min): Das Zentrum wird von den Blutgasen angetrieben und von den Rezeptoren der Lunge selbst (Dehnungs-, Irritans- und J-Rezeptoren in entzündeter, gefluteter oder embolisierter Lunge), die schneller atmen lassen, als die Gase allein es verlangten.`));
  if (p.accessory) out.push(L(`The load is near what the muscles can sustain (${n1(r.VE)} of about ${r0(r.capacity)} L/min): the neck and shoulder muscles are recruited to lift the chest, and the patient sits up and braces the arms.`,
    `Die Last liegt nahe dem, was die Muskulatur dauerhaft leisten kann (${d1(r.VE)} von etwa ${r0(r.capacity)} l/min): Hals- und Schultermuskeln werden rekrutiert, um den Thorax zu heben, der Patient sitzt auf und stützt die Arme ab.`));
  if (p.speech !== 'sentences') out.push(L(`Speaking needs a held, slow expiration; a patient who must breathe again soon speaks in ${p.speech === 'phrases' ? 'phrases' : p.speech === 'words' ? 'single words' : 'nothing at all'}. It is one of the quickest measures of how near the limit the breathing is.`,
    `Sprechen braucht eine gehaltene, langsame Ausatmung; wer bald wieder atmen muss, spricht in ${p.speech === 'phrases' ? 'Halbsätzen' : p.speech === 'words' ? 'einzelnen Wörtern' : 'gar nicht mehr'}. Es ist eines der schnellsten Maße dafür, wie nah die Atmung an ihrer Grenze ist.`));
  if (p.pursedLips) out.push(L(`Pursed lips: a resistance the patient adds at the mouth keeps the pressure inside the airways up during expiration, so the floppy airways of emphysema stay open longer and the lung empties more. Here ${n1(r.iPEEP)} cmH₂O of pressure is still trapped in the alveoli at the end of each breath (intrinsic PEEP).`,
    `Lippenbremse: Ein Widerstand, den der Patient am Mund setzt, hält den Druck in den Atemwegen während der Ausatmung hoch, sodass die schlaffen Atemwege beim Emphysem länger offen bleiben und die Lunge sich besser leert. Hier bleiben am Ende jedes Atemzugs ${d1(r.iPEEP)} cmH₂O in den Alveolen gefangen (intrinsischer PEEP).`));
  if (p.hyperinflated) out.push(L('A barrel chest: lost elastic recoil lets the lungs rest at a larger volume, the ribs horizontal and the diaphragm low and flat, where it works at a disadvantage.',
    'Fassthorax: Die verlorene elastische Rückstellkraft lässt die Lunge bei größerem Volumen ruhen, die Rippen horizontal, das Zwerchfell tief und flach, wo es mechanisch im Nachteil ist.'));
  if (p.paradoxical) out.push(L(`The abdomen moves in as the chest moves out: a diaphragm too weak (${pc(c.p.muscleStrength)} % of normal strength) to descend is sucked up into the chest by the falling pleural pressure. A sign of respiratory muscle failure that comes before the CO₂ rises much.`,
    `Der Bauch geht nach innen, wenn der Thorax sich hebt: Ein Zwerchfell, zu schwach (${pc(c.p.muscleStrength)} % der normalen Kraft), um tiefer zu treten, wird vom fallenden Pleuradruck in den Thorax gesogen. Ein Zeichen des Versagens der Atemmuskulatur, das kommt, bevor das CO₂ stark steigt.`));
  if (c.p.bronchoconstriction >= 0.2) out.push(L(`Peak flow ${r0(r.PEFpct)} % and FEV₁ ${r0(r.FEV1pct)} % of predicted: the narrowed airways limit how fast air can leave. As in people with acute asthma, peak flow and FEV₁ fall together; oxygen falls first (uneven ventilation), and CO₂ rises only once FEV₁ is very low, a late sign of exhaustion.`,
    `Spitzenfluss ${r0(r.PEFpct)} % und FEV₁ ${r0(r.FEV1pct)} % des Sollwerts: Die engen Atemwege begrenzen, wie schnell Luft entweichen kann. Wie bei Menschen im Asthmaanfall fallen Spitzenfluss und FEV₁ gemeinsam; zuerst fällt der Sauerstoff (ungleiche Belüftung), CO₂ steigt erst bei sehr niedrigem FEV₁, ein spätes Zeichen der Erschöpfung.`));

  const ox: LocalizedText[] = [];
  const aa = r.AaGradient, sat = pc(r.SaO2);
  ox.push(L(`The oximeter reads ${sat} % on ${pc(r.FiO2)} % oxygen; the arterial PO₂ is ${n1(r.PaO2)} kPa (${r0(r.PaO2 * MMHG)} mmHg), the PCO₂ ${n1(r.PaCO2)} kPa. The gap between alveolar and arterial oxygen is ${n1(aa)} kPa (normal below about 2).`,
    `Das Pulsoxymeter zeigt ${sat} % bei ${pc(r.FiO2)} % Sauerstoff; der arterielle PO₂ ist ${d1(r.PaO2)} kPa (${r0(r.PaO2 * MMHG)} mmHg), der PCO₂ ${d1(r.PaCO2)} kPa. Die Differenz zwischen alveolärem und arteriellem Sauerstoff beträgt ${d1(aa)} kPa (normal unter etwa 2).`));
  if (aa > 2.5 && r.shunt > 0.1) ox.push(L(`Most of the gap is shunt: ${pc(r.shunt)} % of the blood passes lung that holds no air (consolidated, flooded or collapsed) and returns to the left heart as venous blood. No amount of extra oxygen reaches it, so oxygen helps a shunt less than anything else.`,
    `Der größte Teil der Differenz ist Shunt: ${pc(r.shunt)} % des Blutes fließen durch Lunge ohne Luft (konsolidiert, geflutet oder kollabiert) und kehren als venöses Blut zum linken Herzen zurück. Zusätzlicher Sauerstoff erreicht es nicht; daher hilft Sauerstoff beim Shunt weniger als bei allem anderen.`));
  else if (aa > 2.5) ox.push(L('The gap comes from mismatch: some lung is perfused more than it is ventilated (or, after emboli, ventilated without blood). Its blood leaves under-oxygenated; extra oxygen raises its alveolar PO₂ and closes most of the gap.',
    'Die Differenz kommt aus der Fehlverteilung: Manche Lunge wird stärker durchblutet als belüftet (oder, nach Embolien, belüftet ohne Blut). Ihr Blut verlässt sie untersättigt; zusätzlicher Sauerstoff hebt ihren alveolären PO₂ und schließt den größten Teil der Differenz.'));
  if (r.PaCO2 > 6.3) ox.push(L(`The CO₂ is high: the alveolar ventilation has fallen behind the CO₂ the body makes. In a breathless patient that means the muscles are tiring or the airways no longer let enough air out: a danger sign.`,
    `Das CO₂ ist hoch: Die alveoläre Ventilation bleibt hinter dem CO₂ zurück, das der Körper bildet. Bei einem Luftnötigen heißt das, die Muskulatur ermüdet oder die Atemwege lassen nicht mehr genug Luft hinaus: ein Alarmzeichen.`));
  else if (r.PaCO2 < 4.5) ox.push(L('The CO₂ is low: the patient breathes more than the CO₂ requires, driven by hypoxaemia and by the lung\'s own receptors.', 'Das CO₂ ist niedrig: Der Patient atmet mehr, als das CO₂ verlangt, angetrieben von der Hypoxämie und den Rezeptoren der Lunge selbst.'));
  ox.push(r.deoxyHb >= c.cyanosisAt
    ? L(`Cyanosis: ${r0(r.deoxyHb)} g/L of haemoglobin in the capillaries carries no oxygen, more than the ${c.cyanosisAt} g/L it takes to show blue in the lips and tongue.`, `Zyanose: ${r0(r.deoxyHb)} g/l Hämoglobin in den Kapillaren tragen keinen Sauerstoff, mehr als die ${c.cyanosisAt} g/l, ab denen Lippen und Zunge blau erscheinen.`)
    : L(`No cyanosis: ${r0(r.deoxyHb)} g/L of deoxygenated haemoglobin in the capillaries, below the ${c.cyanosisAt} g/L it takes to show. Cyanosis is a late sign; the oximeter sees desaturation long before the eye.`, `Keine Zyanose: ${r0(r.deoxyHb)} g/l desoxygeniertes Hämoglobin in den Kapillaren, unter den ${c.cyanosisAt} g/l, ab denen es sichtbar wird. Zyanose ist ein spätes Zeichen; das Pulsoxymeter sieht die Entsättigung lange vor dem Auge.`));
  return [{ title: L('Rate, pattern and work of breathing', 'Frequenz, Atemmuster und Atemarbeit'), body: out }, { title: L('Oxygen and carbon dioxide', 'Sauerstoff und Kohlendioxid'), body: ox }];
}

/* ---- the trachea ----------------------------------------------------------------------------------------- */
function trachea(c: RespContext): RespText[] {
  const p = c.p, out: LocalizedText[] = [];
  out.push(L('The trachea runs down the middle of the mediastinum, which is not fixed: it moves toward the side of lower pressure. So the trachea is pushed away from a large effusion or air under tension, and pulled toward a lobe that has collapsed and lost its volume (most of all an upper lobe, whose bronchus is nearest).',
    'Die Trachea verläuft in der Mitte des Mediastinums, das nicht fixiert ist: Es bewegt sich zur Seite des niedrigeren Drucks. Die Trachea wird daher von einem großen Erguss oder Luft unter Spannung weggedrückt und zu einem kollabierten Lappen hingezogen, der sein Volumen verloren hat (vor allem einem Oberlappen, dessen Bronchus am nächsten liegt).'));
  const E = Math.max(p.effusionL, p.effusionR);
  if (E > 300) out.push(L(`${r0(E / 50) * 50} mL of fluid on the ${sideEn(p.effusionL > p.effusionR ? 'L' : 'R')} take up space in that hemithorax and push the mediastinum away.`, `${r0(E / 50) * 50} ml Flüssigkeit ${sideDe(p.effusionL > p.effusionR ? 'L' : 'R')} nehmen Raum in dieser Thoraxhälfte ein und drücken das Mediastinum weg.`));
  if (p.tensionL > 0 || p.tensionR > 0) {
    const s: 'L' | 'R' = p.tensionL > p.tensionR ? 'L' : 'R';
    out.push(L(`Air trapped under ${r0(Math.max(p.tensionL, p.tensionR))} mmHg on the ${sideEn(s)}: a valve lets air into the pleural space with each breath and none out. It pushes the mediastinum over, and squeezes the heart and the great veins (the pressure taken to act in full: an assumed placement, known gap 39).`,
      `Luft unter ${r0(Math.max(p.tensionL, p.tensionR))} mmHg ${sideDe(s)} gefangen: Ein Ventil lässt mit jedem Atemzug Luft in den Pleuraraum und keine heraus. Sie drückt das Mediastinum hinüber und presst Herz und große Venen (der Druck wird als voll wirksam angenommen: eine Setzung, bekannte Lücke 39).`));
  } else if (p.ptxL > 0.05 || p.ptxR > 0.05) out.push(L('A simple pneumothorax is open to the airway or sealed at atmospheric pressure: the lung falls away from the chest wall, but nothing pushes the mediastinum, and the trachea stays central. Only tension moves it.',
    'Ein einfacher Pneumothorax steht unter Atmosphärendruck: Die Lunge fällt von der Brustwand weg, aber nichts drückt das Mediastinum, und die Trachea bleibt mittig. Erst Spannung verschiebt sie.'));
  out.push(c.trachea.position === 'central'
    ? L(`Here the forces balance (shift index ${n1(c.trachea.shift)}, felt beyond ±0.5): the trachea is central.`, `Hier halten sich die Kräfte die Waage (Verschiebungsindex ${d1(c.trachea.shift)}, tastbar ab ±0,5): Die Trachea liegt mittig.`)
    : L(`Here the net shift is ${n1(Math.abs(c.trachea.shift))} toward the ${sideEn(c.trachea.position as 'L' | 'R')}: the trachea is felt nearer the ${sideEn(c.trachea.position as 'L' | 'R')} clavicle.`, `Hier beträgt die Verschiebung ${d1(Math.abs(c.trachea.shift))} nach ${sideDe(c.trachea.position as 'L' | 'R')}: Die Trachea ist näher an der ${c.trachea.position === 'L' ? 'linken' : 'rechten'} Klavikula zu tasten.`));
  out.push(L('How big a shift the finger can feel is a placement (known gap 57); tracheal deviation is a late and unreliable sign of tension in patients.', 'Wie groß eine tastbare Verschiebung sein muss, ist eine Setzung (bekannte Lücke 57); bei Patienten ist die Trachealverschiebung ein spätes und unzuverlässiges Zeichen der Spannung.'));
  return [{ title: L('The trachea and the mediastinum', 'Trachea und Mediastinum'), body: out }];
}

/* ---- expansion ------------------------------------------------------------------------------------------- */
function expansion(c: RespContext): RespText[] {
  const e = c.expansion, out: LocalizedText[] = [];
  out.push(L(`Of each breath, ${pc(e.R.share)} % goes to the right lung and ${pc(e.L.share)} % to the left (in health about 52 and 48: the right lung is the larger). The hands on the lower ribs feel the chest wall follow the lung beneath: a side that takes in less air moves less.`,
    `Von jedem Atemzug gehen ${pc(e.R.share)} % in die rechte und ${pc(e.L.share)} % in die linke Lunge (gesund etwa 52 zu 48: Die rechte Lunge ist die größere). Die Hände auf den unteren Rippen spüren, wie die Thoraxwand der Lunge darunter folgt: Eine Seite, die weniger Luft aufnimmt, bewegt sich weniger.`));
  for (const s of ['R', 'L'] as const) {
    if (e[s].finding !== 'reduced') continue;
    const E = s === 'L' ? c.p.effusionL : c.p.effusionR, ptx = s === 'L' ? c.p.ptxL : c.p.ptxR;
    out.push(E > 300 ? L(`The ${sideEn(s)} side moves less: ${r0(E / 50) * 50} mL of fluid hold the lung down.`, `Die ${s === 'L' ? 'linke' : 'rechte'} Seite bewegt sich weniger: ${r0(E / 50) * 50} ml Flüssigkeit halten die Lunge nieder.`)
      : ptx > 0.05 ? L(`The ${sideEn(s)} side moves less: the lung has fallen away from the wall, and the air between does not follow the ribs.`, `Die ${s === 'L' ? 'linke' : 'rechte'} Seite bewegt sich weniger: Die Lunge ist von der Wand weggefallen, und die Luft dazwischen folgt den Rippen nicht.`)
        : L(`The ${sideEn(s)} side moves less: part of its lung holds no air (consolidated or collapsed) and does not inflate.`, `Die ${s === 'L' ? 'linke' : 'rechte'} Seite bewegt sich weniger: Ein Teil ihrer Lunge enthält keine Luft (konsolidiert oder kollabiert) und bläht sich nicht.`));
  }
  if (e.L.finding === 'reduced' && e.R.finding === 'reduced') out.push(c.p.emphysema >= 0.4
    ? L('Both sides move little: the chest already rests near full inspiration (hyperinflation) and has little room left.', 'Beide Seiten bewegen sich wenig: Der Thorax ruht schon nahe der vollen Einatmung (Überblähung) und hat wenig Raum übrig.')
    : L('Both sides move little: stiff lungs (fibrosis, oedema) need more pressure for the same volume.', 'Beide Seiten bewegen sich wenig: Steife Lungen (Fibrose, Ödem) brauchen mehr Druck für dasselbe Volumen.'));
  return [{ title: L('Chest expansion', 'Thoraxexkursion'), body: out }];
}

/* ---- at a site ------------------------------------------------------------------------------------------- */
const underWords = (s: NonNullable<RespContext['site']>): LocalizedText => {
  const u = s.under, en: string[] = [], de: string[] = [];
  en.push(`${pc(u.aerated)} % air-filled`); de.push(`${pc(u.aerated)} % lufthaltig`);
  if (u.solid > 0.02) { en.push(`${pc(u.solid)} % consolidated`); de.push(`${pc(u.solid)} % konsolidiert`); }
  if (u.flooded > 0.02) { en.push(`${pc(u.flooded)} % full of oedema fluid`); de.push(`${pc(u.flooded)} % mit Ödemflüssigkeit gefüllt`); }
  if (u.obstructed > 0.02) { en.push(`${pc(u.obstructed)} % collapsed behind its bronchus`); de.push(`${pc(u.obstructed)} % hinter dem Bronchus kollabiert`); }
  if (u.compressed > 0.02) { en.push(`${pc(u.compressed)} % compressed by fluid`); de.push(`${pc(u.compressed)} % von Flüssigkeit komprimiert`); }
  if (u.ptx > 0.02) { en.push(`fallen ${pc(u.ptx)} % away from the wall`); de.push(`zu ${pc(u.ptx)} % von der Wand weggefallen`); }
  return L(`Under the ${s.label.en} on the ${sideEn(s.side)} the lung is ${en.join(', ')}${s.fluidHere ? `, with ${r0(s.fluid / 50) * 50} mL of fluid lying between it and the chest wall` : ''}.`,
    `An dieser Stelle (${s.label.de}, ${sideDe(s.side)}) ist die Lunge ${de.join(', ')}${s.fluidHere ? `; ${r0(s.fluid / 50) * 50} ml Flüssigkeit liegen zwischen ihr und der Brustwand` : ''}.`);
};

function percussion(c: RespContext): LocalizedText[] {
  const s = c.site; if (!s) return [];
  const out: LocalizedText[] = [underWords(s)];
  out.push(L('The tap sets the chest wall ringing; what lies beneath decides how long it rings. Air under the wall lets it ring long and low; solid lung damps it; fluid damps it almost at once.',
    'Der Schlag versetzt die Brustwand in Schwingung; was darunter liegt, entscheidet, wie lange sie nachklingt. Luft unter der Wand lässt sie lang und tief klingen; solide Lunge dämpft sie; Flüssigkeit dämpft sie fast sofort.'));
  const note: Record<string, LocalizedText> = {
    resonant: L('Resonant: aerated lung under the finger.', 'Sonor: belüftete Lunge unter dem Finger.'),
    dull: L(s.under.solid + s.under.flooded >= 0.4 ? 'Dull: the lung here holds exudate or water instead of air.' : s.under.obstructed >= 0.5 ? 'Dull: the lobe here has collapsed and holds no air.' : 'Dull: lung compressed just above fluid.', s.under.solid + s.under.flooded >= 0.4 ? 'Gedämpft: Die Lunge enthält hier Exsudat oder Wasser statt Luft.' : s.under.obstructed >= 0.5 ? 'Gedämpft: Der Lappen hier ist kollabiert und enthält keine Luft.' : 'Gedämpft: komprimierte Lunge knapp über der Flüssigkeit.'),
    'stony-dull': L('Stony dull: fluid between the lung and the wall; the note stops dead, as on the thigh. Its upper border rises toward the axilla (the meniscus).', 'Schenkelschall: Flüssigkeit zwischen Lunge und Wand; der Klang bricht ab wie über dem Oberschenkel. Seine Obergrenze steigt zur Axilla hin an (der Meniskus).'),
    'hyper-resonant': L(s.under.ptx >= 0.15 ? 'Hyper-resonant: free air in the pleural space rings longer and lower than lung.' : 'Hyper-resonant: over-inflated lung with lost alveolar walls (emphysema) holds more air than normal.', s.under.ptx >= 0.15 ? 'Hypersonor: Freie Luft im Pleuraraum klingt länger und tiefer als Lunge.' : 'Hypersonor: überblähte Lunge mit verlorenen Alveolarwänden (Emphysem) enthält mehr Luft als normal.'),
  };
  if (note[s.note]) out.push(note[s.note]);
  return out;
}

function auscultation(c: RespContext): LocalizedText[] {
  const s = c.site; if (!s) return [];
  const out: LocalizedText[] = [underWords(s)];
  out.push(L(`Breath sounds are turbulence in the large airways, heard through the lung. Aerated lung is a filter that passes only the low frequencies, mostly of inspiration: vesicular breathing. Here inspiration lasts ${n1(c.r.Ti)} s and expiration ${n1(c.r.Te)} s.`,
    `Atemgeräusche sind Turbulenzen in den großen Atemwegen, gehört durch die Lunge. Belüftete Lunge ist ein Filter, der nur die tiefen Frequenzen durchlässt, vor allem der Einatmung: vesikuläres Atemgeräusch. Hier dauert die Einatmung ${d1(c.r.Ti)} s und die Ausatmung ${d1(c.r.Te)} s.`));
  const b: Record<string, LocalizedText> = {
    vesicular: L('Vesicular: aerated lung under the stethoscope.', 'Vesikulär: belüftete Lunge unter dem Stethoskop.'),
    bronchial: L(s.under.solid >= 0.4 ? 'Bronchial breathing: solid lung around an open bronchus conducts the high frequencies the air would have filtered out. Expiration is heard as loud and as long as inspiration, with a gap between: the sound of the trachea, brought to the chest wall.' : 'Bronchial breathing above the fluid: lung compressed to solid by the effusion, its bronchi still open, conducts the sound of the airways (often with aegophony).',
      s.under.solid >= 0.4 ? 'Bronchialatmen: Solide Lunge um einen offenen Bronchus leitet die hohen Frequenzen, die Luft herausgefiltert hätte. Die Ausatmung ist so laut und so lang wie die Einatmung, mit einer Pause dazwischen: der Klang der Trachea, an die Brustwand gebracht.' : 'Bronchialatmen über dem Erguss: Vom Erguss zu solider Lunge komprimiert, mit noch offenen Bronchien, leitet sie den Klang der Atemwege (oft mit Ägophonie).'),
    reduced: L(s.fluidHere ? 'Reduced: fluid between the lung and the stethoscope keeps the sound away.' : s.under.ptx >= 0.15 ? 'Reduced: air in the pleural space keeps the sound away from the wall.' : s.under.obstructed >= 0.5 ? 'Reduced: the lobe has collapsed behind a blocked bronchus; no air moves in it.' : c.p.emphysema >= 0.4 ? 'Reduced: emphysematous lung moves little air and filters what there is.' : c.p.bronchoconstriction >= 0.75 ? 'Reduced everywhere: so little air moves through the narrowed airways that there is too little flow even to wheeze: the silent chest of life-threatening asthma.' : 'Reduced: less air moves under this site.',
      s.fluidHere ? 'Abgeschwächt: Flüssigkeit zwischen Lunge und Stethoskop hält den Klang fern.' : s.under.ptx >= 0.15 ? 'Abgeschwächt: Luft im Pleuraraum hält den Klang von der Wand fern.' : s.under.obstructed >= 0.5 ? 'Abgeschwächt: Der Lappen ist hinter einem verlegten Bronchus kollabiert; in ihm bewegt sich keine Luft.' : c.p.emphysema >= 0.4 ? 'Abgeschwächt: Emphysematöse Lunge bewegt wenig Luft und filtert, was da ist.' : c.p.bronchoconstriction >= 0.75 ? 'Überall abgeschwächt: Durch die engen Atemwege bewegt sich so wenig Luft, dass der Fluss nicht einmal zum Giemen reicht: die stille Lunge des lebensbedrohlichen Asthmas.' : 'Abgeschwächt: Unter dieser Stelle bewegt sich weniger Luft.'),
    absent: L(s.fluidHere ? 'Absent: a deep layer of fluid stops the sound.' : s.under.ptx >= 0.6 ? 'Absent: the lung has fallen far from the wall.' : 'Absent: no air moves under this site.', s.fluidHere ? 'Aufgehoben: Eine tiefe Flüssigkeitsschicht stoppt den Klang.' : s.under.ptx >= 0.6 ? 'Aufgehoben: Die Lunge ist weit von der Wand weggefallen.' : 'Aufgehoben: Unter dieser Stelle bewegt sich keine Luft.'),
  };
  if (b[s.breath]) out.push(b[s.breath]);
  if (s.added.includes('fine-crackles')) out.push(c.p.fibrosis >= 0.25
    ? L('Fine crackles, late in inspiration, at the bases: small airways closed by stiff, fibrotic lung snapping open one after another as the lung inflates (like Velcro).', 'Feine Rasselgeräusche, spät in der Einatmung, basal: kleine Atemwege, von steifer, fibrotischer Lunge verschlossen, springen beim Blähen nacheinander auf (wie Klettverschluss).')
    : L(`Fine crackles, late in inspiration: small airways closed by water in the lung's interstitium (${pc(c.r.interstitial)} % of its capacity) or alveoli, snapping open as the lung inflates. Gravity puts the water at the bases first.`, `Feine Rasselgeräusche, spät in der Einatmung: kleine Atemwege, von Wasser im Interstitium (${pc(c.r.interstitial)} % seiner Kapazität) oder in den Alveolen verschlossen, springen beim Blähen auf. Die Schwerkraft bringt das Wasser zuerst in die Basen.`));
  if (s.added.includes('coarse-crackles')) out.push(L('Coarse crackles, early in inspiration and in expiration: air bubbling through secretions in larger airways, at the edge of consolidated lung.', 'Grobe Rasselgeräusche, früh in der Einatmung und in der Ausatmung: Luft, die durch Sekret in größeren Atemwegen perlt, am Rand konsolidierter Lunge.'));
  if (s.added.includes('wheeze')) out.push(L(`Wheeze: air forced through narrowed airways makes their walls flutter, a musical note, mostly while breathing out, when the airways narrow further. The lung empties slowly: its time constant is ${n1(c.r.tauE)} s against ${n1(c.r.Te)} s to empty${c.r.iPEEP > 1 ? `, so ${n1(c.r.iPEEP)} cmH₂O of pressure stays trapped at the end of each breath` : ''}.`,
    `Giemen: Durch enge Atemwege gepresste Luft lässt ihre Wände flattern, ein musikalischer Ton, vor allem beim Ausatmen, wenn die Atemwege noch enger werden. Die Lunge leert sich langsam: Ihre Zeitkonstante beträgt ${d1(c.r.tauE)} s bei ${d1(c.r.Te)} s zum Leeren${c.r.iPEEP > 1 ? `, sodass ${d1(c.r.iPEEP)} cmH₂O Druck am Ende jedes Atemzugs gefangen bleiben` : ''}.`));
  out.push(L('Not modelled: a pleural rub (the model has no inflamed pleura), stridor (no upper airway), and the timing of crackles by the stage of illness.', 'Nicht modelliert: Pleurareiben (das Modell kennt keine entzündete Pleura), Stridor (keine oberen Atemwege) und die Lage der Rasselgeräusche nach dem Stadium der Erkrankung.'));
  return out;
}

function resonance(c: RespContext): LocalizedText[] {
  const s = c.site; if (!s) return [];
  const out: LocalizedText[] = [underWords(s)];
  out.push(L('The voice obeys the physics of the breath sounds: aerated lung muffles it, solid lung around an open bronchus carries it clearly (even a whisper: whispering pectoriloquy), fluid and air keep it away. Felt with the hand, the same is tactile fremitus.',
    'Die Stimme folgt der Physik der Atemgeräusche: Belüftete Lunge dämpft sie, solide Lunge um einen offenen Bronchus leitet sie klar (selbst ein Flüstern: Pektoriloquie), Flüssigkeit und Luft halten sie fern. Mit der Hand gefühlt ist es derselbe Stimmfremitus.'));
  const t: Record<string, LocalizedText> = {
    normal: L('Normal: muffled syllables through aerated lung.', 'Normal: gedämpfte Silben durch belüftete Lunge.'),
    increased: L('Increased: the words come through clearly, as if spoken into the stethoscope: solid lung with an open bronchus.', 'Verstärkt: Die Worte kommen klar durch, als würde ins Stethoskop gesprochen: solide Lunge mit offenem Bronchus.'),
    reduced: L('Reduced: fluid, air or a blocked bronchus stands between the voice and the wall. With consolidation it would be increased: this is how the two dull chests are told apart.', 'Abgeschwächt: Flüssigkeit, Luft oder ein verlegter Bronchus steht zwischen Stimme und Wand. Bei Konsolidierung wäre sie verstärkt: So unterscheidet man die beiden gedämpften Thoraxbefunde.'),
    absent: L('Absent: a deep layer of fluid.', 'Aufgehoben: eine tiefe Flüssigkeitsschicht.'),
  };
  if (t[s.resonance]) out.push(t[s.resonance]);
  return out;
}

/** Every text the station can show, for the completeness test: the contexts that select each branch. */
export const RESP_TEXT_IDS: RespTestId[] = ['look', 'trachea', 'expansion', 'percussion', 'auscultation', 'resonance'];
