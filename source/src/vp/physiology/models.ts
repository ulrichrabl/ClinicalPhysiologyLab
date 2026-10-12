import { THY, CA } from '../evidence/endocrine.ts';
import { WAT, KID } from '../evidence/renal.ts';
const n = (x: number) => String(x);
import type { LocalizedText } from '../model/i18n.ts';
import type { EquationDef, LiveContext, MathNode, ModelDef, VariableDef } from './types.ts';
import type { PatientModel } from './state.ts';
import { CHEMISTRY_DEFAULTS } from './state.ts';
import { neuroExamState, nystagmus } from '../models/neuro-exam.ts';
import { hendersonHasselbalch } from './chemistry.ts';

/* ===========================================================================
   The models, as chapters. Each lists its variables and the equations the
   simulation actually runs (the circulation's from domains/cardio/sim/
   circulation.ts, the vestibular model's from models/neuro-exam.ts), at a
   textbook level and in full.
=========================================================================== */

const L = (en: string, de: string): LocalizedText => ({ en, de });
const v = (k: string): MathNode => ({ v: k });
const frac = (a: MathNode[], b: MathNode[]): MathNode => ({ frac: [a, b] });
const paren = (...x: MathNode[]): MathNode => ({ paren: x });
const eq = (id: string, level: EquationDef['level'], label: LocalizedText, lhs: MathNode[], rhs: MathNode[], explanation: LocalizedText): EquationDef =>
  ({ id, level, label, lhs, rhs, explanation });

type P = Partial<VariableDef> & { key: string; symbol: string; label: LocalizedText; unit: string };
const param = (model: string, group: string, p: P): VariableDef => ({ kind: 'parameter', control: 'number', group, ...p, id: `${model}.${p.key.split('.').pop()}` });
const state = (model: string, p: P): VariableDef => ({ kind: 'state', ...p, id: `${model}.${p.key}` });

/* ---- model access by path ------------------------------------------------------- */
export function getPath(m: PatientModel, path: string): any {
  const [sec, key] = path.split('.');
  if (sec === 'lesions') return key ? (m.lesions as any)[key] : m.lesions.nodes;
  if (sec === 'chemistry') return m.chemistry[key] ?? (CHEMISTRY_DEFAULTS as any)[key];
  return (m as any)[sec]?.[key];
}
export function setPath(m: PatientModel, path: string, value: any): void {
  const [sec, key] = path.split('.');
  if (sec === 'lesions') { if (key) (m.lesions as any)[key] = value; else m.lesions.nodes = value; return; }
  if (sec === 'chemistry') { m.chemistry[key] = value; if (key === 'potassium') m.circulation.K = value; return; }
  (m as any)[sec][key] = value;
}

const snapNum = (ctx: LiveContext, k: string, d = NaN) => (typeof ctx.snap?.[k] === 'number' ? ctx.snap[k] : d);
const metric = (ctx: LiveContext, k: string, d = NaN) => (typeof ctx.snap?.metrics?.[k] === 'number' ? ctx.snap.metrics[k] : d);

/* ---- patient ------------------------------------------------------------------------ */
const PATIENT: ModelDef = {
  id: 'patient', title: L('Patient', 'Patient'), summary: L('Age, sex and size set the normal ranges every finding is compared with.', 'Alter, Geschlecht und Körpermaße bestimmen die Normbereiche, mit denen jeder Befund verglichen wird.'),
  groups: [{ id: 'person', label: L('Person', 'Person') }],
  variables: [
    param('patient', 'person', { key: 'patient.age', symbol: 'age', label: L('Age', 'Alter'), unit: 'years', min: 1, max: 100, step: 1 }),
    param('patient', 'person', { key: 'patient.sex', symbol: 'sex', label: L('Sex', 'Geschlecht'), unit: '', control: 'enum', options: [{ value: 'F', label: L('female', 'weiblich') }, { value: 'M', label: L('male', 'männlich') }] }),
    param('patient', 'person', { key: 'patient.heightCm', symbol: 'h', label: L('Height', 'Größe'), unit: 'cm', min: 50, max: 210, step: 1 }),
    param('patient', 'person', { key: 'patient.weightKg', symbol: 'm', label: L('Weight', 'Gewicht'), unit: 'kg', min: 3, max: 200, step: 1 }),
  ],
  equations: [], values: () => ({}), diagram: '', sources: [],
};

/* ---- haemodynamics ---------------------------------------------------------------------- */
const C = (group: string, key: string, symbol: string, label: LocalizedText, unit: string, min: number, max: number, step: number, note?: LocalizedText) =>
  param('haemodynamics', group, { key: `circulation.${key}`, symbol, label, unit, min, max, step, note, digits: step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0 });

const HAEMODYNAMICS: ModelDef = {
  id: 'haemodynamics',
  title: L('Haemodynamics', 'Hämodynamik'),
  summary: L('Four chambers whose walls stiffen and relax each beat, four valves, and two circulations of compliant vessels: pressure is volume times elastance, flow is pressure difference over resistance, and blood is conserved.',
    'Vier Kammern, deren Wände sich mit jedem Schlag versteifen und entspannen, vier Klappen und zwei Kreisläufe dehnbarer Gefäße: Druck ist Volumen mal Elastanz, Fluss ist Druckdifferenz durch Widerstand, und Blut geht nicht verloren.'),
  groups: [
    { id: 'lv', label: L('Left ventricle', 'Linker Ventrikel') }, { id: 'rv', label: L('Right ventricle and atria', 'Rechter Ventrikel und Vorhöfe') },
    { id: 'valves', label: L('Valves', 'Klappen') }, { id: 'vessels', label: L('Vessels', 'Gefäße') }, { id: 'volume', label: L('Blood volume', 'Blutvolumen') },
    { id: 'pericardium', label: L('Pericardium and septum', 'Perikard und Septum') },
  ],
  variables: [
    C('lv', 'Emax', 'E_{max}', L('End-systolic elastance (contractility)', 'Endsystolische Elastanz (Kontraktilität)'), 'mmHg/mL', 0.3, 6, 0.05),
    C('lv', 'V0', 'V_0', L('Unstressed volume', 'Volumen bei Druck null'), 'mL', 0, 80, 1),
    C('lv', 'edpA', 'A', L('Diastolic stiffness, scale', 'Diastolische Steifigkeit, Faktor'), 'mmHg', 0.1, 3, 0.05),
    C('lv', 'edpB', 'B', L('Diastolic stiffness, exponent', 'Diastolische Steifigkeit, Exponent'), '1/mL', 0.008, 0.08, 0.001),
    C('rv', 'EmaxRv', 'E_{max,RV}', L('Right ventricular contractility', 'Kontraktilität rechter Ventrikel'), 'mmHg/mL', 0.1, 2, 0.02),
    C('rv', 'ElaMax', 'E_{LA,max}', L('Left atrial contraction', 'Kontraktion linker Vorhof'), 'mmHg/mL', 0.05, 0.6, 0.01),
    C('valves', 'Raortic', 'R_{Ao}', L('Aortic valve resistance (stenosis)', 'Widerstand Aortenklappe (Stenose)'), 'mmHg·s/mL', 0.01, 1, 0.01),
    C('valves', 'regAortic', 'r_{Ao}', L('Aortic regurgitant orifice', 'Regurgitationsöffnung Aortenklappe'), '0–1', 0, 1, 0.01),
    C('valves', 'Rmitral', 'R_{Mi}', L('Mitral valve resistance (stenosis)', 'Widerstand Mitralklappe (Stenose)'), 'mmHg·s/mL', 0.005, 0.4, 0.005),
    C('valves', 'regMitral', 'r_{Mi}', L('Mitral regurgitant orifice', 'Regurgitationsöffnung Mitralklappe'), '0–1', 0, 1, 0.01),
    C('valves', 'Rtricuspid', 'R_{Tri}', L('Tricuspid valve resistance', 'Widerstand Trikuspidalklappe'), 'mmHg·s/mL', 0.005, 0.3, 0.005),
    C('valves', 'regTricuspid', 'r_{Tri}', L('Tricuspid regurgitant orifice', 'Regurgitationsöffnung Trikuspidalklappe'), '0–1', 0, 1, 0.01),
    C('valves', 'Rpulmonic', 'R_{Pu}', L('Pulmonary valve resistance', 'Widerstand Pulmonalklappe'), 'mmHg·s/mL', 0.01, 0.6, 0.01),
    C('valves', 'regPulmonic', 'r_{Pu}', L('Pulmonary regurgitant orifice', 'Regurgitationsöffnung Pulmonalklappe'), '0–1', 0, 1, 0.01),
    C('vessels', 'Rsys', 'R_{sys}', L('Systemic vascular resistance', 'Systemischer Gefäßwiderstand'), 'mmHg·s/mL', 0.3, 3, 0.01),
    C('vessels', 'Csa', 'C_{a}', L('Arterial compliance', 'Arterielle Compliance'), 'mL/mmHg', 0.3, 3, 0.05),
    C('vessels', 'V0sv', 'V_{0,v}', L('Unstressed venous volume', 'Ungespanntes Venenvolumen'), 'mL', 2000, 4200, 10),
    C('vessels', 'Csv', 'C_{v}', L('Venous compliance', 'Venöse Compliance'), 'mL/mmHg', 20, 120, 1),
    C('vessels', 'Rpul', 'R_{pul}', L('Pulmonary vascular resistance', 'Pulmonaler Gefäßwiderstand'), 'mmHg·s/mL', 0.02, 0.8, 0.005),
    C('volume', 'bloodVolume', 'V_{blood}', L('Total blood volume', 'Gesamtblutvolumen'), 'mL', 2000, 8000, 50),
    C('pericardium', 'pericardialFluid', 'V_{peri}', L('Pericardial fluid (tamponade)', 'Perikarderguss (Tamponade)'), 'mL', 0, 1500, 10),
    C('pericardium', 'periV0', 'V_{0,peri}', L('Pericardial reserve volume (larger when chronically stretched)', 'Perikardiale Reserve (größer bei chronischer Dehnung)'), 'mL', 300, 1200, 10),
    C('pericardium', 'septalShift', 'k_{sep}', L('Septal shift per mmHg of trans-septal pressure', 'Septumverlagerung pro mmHg transseptalem Druck'), 'mL/mmHg', 0, 5, 0.1),
    state('haemodynamics', { key: 'Plv', symbol: 'P_{LV}', label: L('Left ventricular pressure', 'Druck linker Ventrikel'), unit: 'mmHg', digits: 0 }),
    state('haemodynamics', { key: 'Vlv', symbol: 'V_{LV}', label: L('Left ventricular volume', 'Volumen linker Ventrikel'), unit: 'mL', digits: 0 }),
    state('haemodynamics', { key: 'E', symbol: 'E(t)', label: L('Instantaneous elastance', 'Momentane Elastanz'), unit: 'mmHg/mL', digits: 2 }),
    state('haemodynamics', { key: 'Pao', symbol: 'P_{Ao}', label: L('Aortic pressure', 'Aortendruck'), unit: 'mmHg', digits: 0 }),
    state('haemodynamics', { key: 'Qao', symbol: 'Q_{Ao}', label: L('Aortic valve flow', 'Fluss über die Aortenklappe'), unit: 'mL/s', digits: 0 }),
    state('haemodynamics', { key: 'Pla', symbol: 'P_{LA}', label: L('Left atrial pressure', 'Druck linker Vorhof'), unit: 'mmHg', digits: 0 }),
    state('haemodynamics', { key: 'CVP', symbol: 'P_{RA}', label: L('Right atrial pressure', 'Druck rechter Vorhof'), unit: 'mmHg', digits: 0 }),
    state('haemodynamics', { key: 'Psys', symbol: 'P_{sys}', label: L('Systolic arterial pressure', 'Systolischer Blutdruck'), unit: 'mmHg', digits: 0 }),
    state('haemodynamics', { key: 'Pdia', symbol: 'P_{dia}', label: L('Diastolic arterial pressure', 'Diastolischer Blutdruck'), unit: 'mmHg', digits: 0 }),
    state('haemodynamics', { key: 'MAP', symbol: 'MAP', label: L('Mean arterial pressure', 'Mittlerer arterieller Druck'), unit: 'mmHg', digits: 0 }),
    state('haemodynamics', { key: 'EDV', symbol: 'EDV', label: L('End-diastolic volume', 'Enddiastolisches Volumen'), unit: 'mL', digits: 0 }),
    state('haemodynamics', { key: 'ESV', symbol: 'ESV', label: L('End-systolic volume', 'Endsystolisches Volumen'), unit: 'mL', digits: 0 }),
    state('haemodynamics', { key: 'SV', symbol: 'SV', label: L('Stroke volume', 'Schlagvolumen'), unit: 'mL', digits: 0 }),
    state('haemodynamics', { key: 'HR', symbol: 'HR', label: L('Heart rate', 'Herzfrequenz'), unit: '/min', digits: 0 }),
    state('haemodynamics', { key: 'CO', symbol: 'CO', label: L('Cardiac output', 'Herzzeitvolumen'), unit: 'L/min', digits: 1 }),
    state('haemodynamics', { key: 'EF', symbol: 'EF', label: L('Ejection fraction', 'Ejektionsfraktion'), unit: '%', digits: 0 }),
    state('haemodynamics', { key: 'PvPeak', symbol: 'P_{LV,peak}', label: L('Peak ventricular pressure', 'Maximaler Ventrikeldruck'), unit: 'mmHg', digits: 0 }),
    state('haemodynamics', { key: 'gradient', symbol: 'ΔP_{Ao}', label: L('Peak aortic valve gradient', 'Maximaler Gradient über der Aortenklappe'), unit: 'mmHg', digits: 0 }),
    state('haemodynamics', { key: 'regurgFraction', symbol: 'RF', label: L('Regurgitant fraction', 'Regurgitationsfraktion'), unit: '', digits: 2 }),
    state('haemodynamics', { key: 'RsysEff', symbol: 'R_{sys,eff}', label: L('Systemic resistance, after reflex tone', 'Systemischer Widerstand nach Reflextonus'), unit: 'mmHg·s/mL', digits: 2 }),
    state('haemodynamics', { key: 'EmaxEff', symbol: 'E_{max,eff}', label: L('Contractility, after reflex tone', 'Kontraktilität nach Reflextonus'), unit: 'mmHg/mL', digits: 2 }),
    state('haemodynamics', { key: 'V0svEff', symbol: 'V_{0,v,eff}', label: L('Unstressed venous volume, after reflex tone', 'Ungespanntes Venenvolumen nach Reflextonus'), unit: 'mL', digits: 0 }),
    state('haemodynamics', { key: 'Pmsf', symbol: 'P_{msf}', label: L('Mean systemic filling pressure', 'Mittlerer systemischer Füllungsdruck'), unit: 'mmHg', digits: 1 }),
    state('haemodynamics', { key: 'Qsys', symbol: 'Q_{sys}', label: L('Flow through the arterioles', 'Fluss durch die Arteriolen'), unit: 'mL/s', digits: 0 }),
    state('haemodynamics', { key: 'Pv', symbol: 'P_{v}', label: L('Systemic venous pressure', 'Systemvenöser Druck'), unit: 'mmHg', digits: 1 }),
  ],
  equations: [
    eq('elastance', 'textbook', L('Pressure from volume: the time-varying elastance', 'Druck aus Volumen: die zeitabhängige Elastanz'),
      [v('Plv')], [v('E'), '·', paren(v('Vlv'), '−', v('V0'))],
      L('During the beat the ventricular wall stiffens and relaxes; at each moment its stiffness E(t) turns the volume above V₀ into pressure. Contractility is the peak stiffness, Eₘₐₓ.',
        'Während des Schlags versteift und entspannt sich die Ventrikelwand; ihre momentane Steifigkeit E(t) macht aus dem Volumen über V₀ Druck. Kontraktilität ist die maximale Steifigkeit Eₘₐₓ.')),
    eq('valve', 'textbook', L('Flow across a valve: pressure difference over resistance', 'Fluss über eine Klappe: Druckdifferenz durch Widerstand'),
      [v('Qao')], [frac([v('Plv'), '−', v('Pao')], [v('Raortic')])],
      L('While the ventricle is above the aorta, blood flows through the valve at a rate set by the gradient and the valve’s resistance. A stenosis is a high resistance: the same flow now needs a large gradient.',
        'Solange der Ventrikeldruck über dem Aortendruck liegt, fließt Blut durch die Klappe, bestimmt vom Gradienten und vom Klappenwiderstand. Eine Stenose ist ein hoher Widerstand: derselbe Fluss braucht nun einen großen Gradienten.')),
    eq('stroke', 'textbook', L('Stroke volume and cardiac output', 'Schlagvolumen und Herzzeitvolumen'),
      [v('CO')], [paren(v('EDV'), '−', v('ESV')), '·', v('HR')],
      L('What the ventricle ejects each beat, times the beats per minute.', 'Was der Ventrikel pro Schlag auswirft, mal die Schläge pro Minute.')),
    eq('ohm', 'textbook', L('Arterial pressure from flow and resistance', 'Arterieller Druck aus Fluss und Widerstand'),
      [v('Qsys')], [frac([v('Pao'), '−', v('Pv')], [v('RsysEff')])],
      L('The arterioles are the main resistance. Blood leaves the arteries at a rate set by the arterial–venous pressure difference; at steady state that equals cardiac output, which is why MAP ≈ CO × SVR.',
        'Die Arteriolen sind der Hauptwiderstand. Blut verlässt die Arterien mit einer Rate, die die arteriovenöse Druckdifferenz bestimmt; im Gleichgewicht entspricht das dem Herzzeitvolumen, daher MAD ≈ HZV × SVR.')),
    eq('gradient', 'textbook', L('The gradient a stenosis creates', 'Der Gradient einer Stenose'),
      [v('gradient')], [v('PvPeak'), '−', v('Psys')],
      L('Peak ventricular pressure minus peak aortic pressure.', 'Maximaler Ventrikeldruck minus maximaler Aortendruck.')),
    eq('mass-lv', 'full', L('Conservation of volume, left ventricle', 'Volumenerhaltung, linker Ventrikel'),
      [{ text: 'dV_LV/dt' }], [{ text: 'Q_Mi' }, '−', v('Qao')],
      L('Each compartment changes by inflow minus outflow; the model integrates eight of these together (four chambers, systemic and pulmonary arteries and veins).',
        'Jedes Kompartiment ändert sich um Zufluss minus Abfluss; das Modell integriert acht solcher Gleichungen gemeinsam (vier Kammern, Arterien und Venen beider Kreisläufe).')),
    eq('chamber-full', 'full', L('Chamber pressure: active and passive limbs', 'Kammerdruck: aktiver und passiver Anteil'),
      [v('Plv')], [{ text: 'e(t)' }, '·', v('Emax'), '·', paren(v('Vlv'), '−', v('V0')), '+', paren('1', '−', { text: 'e(t)' }), '·', 'A', '·', paren({ sup: [['e'], ['B·(V−V₀)']] }, '−', '1')],
      L('e(t) is the normalised activation (a double-Hill curve: steep rise, rounded peak, faster relaxation). In diastole the passive exponential limb sets filling pressure; A and B are the stiffness.',
        'e(t) ist die normierte Aktivierung (Doppel-Hill-Kurve: steiler Anstieg, runde Spitze, schnellere Relaxation). In der Diastole bestimmt der passive exponentielle Anteil den Füllungsdruck; A und B sind die Steifigkeit.')),
    eq('arterial-full', 'full', L('Arterial pressure from stored volume', 'Arterieller Druck aus gespeichertem Volumen'),
      [v('Pao')], [frac([{ text: 'V_a' }, '−', { text: 'V_0,a' }], [{ text: 'C_a' }])],
      L('The arteries are an elastic reservoir: pressure is the volume stored above their unstressed volume, divided by their compliance.', 'Die Arterien sind ein elastischer Speicher: Druck ist das über das Ruhevolumen gespeicherte Volumen geteilt durch die Compliance.')),
    eq('regurgitation-full', 'full', L('Backward flow through an incompetent valve', 'Rückfluss über eine insuffiziente Klappe'),
      [{ text: 'Q_reg' }], [frac([{ text: 'ΔP' }], [frac([{ text: 'R_base' }], [{ sup: [['r'], ['2']] }])])],
      L('Resistance goes as the inverse square of orifice area, so the regurgitant orifice r enters squared. Stenosis and regurgitation are separate paths: mixed valve disease is possible.',
        'Der Widerstand geht mit dem inversen Quadrat der Öffnungsfläche, daher geht die Regurgitationsöffnung r quadratisch ein. Stenose und Insuffizienz sind getrennte Pfade: kombinierte Vitien sind möglich.')),
  ],
  values: (ctx) => {
    const m = ctx.model.circulation;
    return {
      ...Object.fromEntries(Object.entries(m)),
      Plv: snapNum(ctx, 'Pv'), Vlv: snapNum(ctx, 'V'), E: snapNum(ctx, 'E'), Pao: snapNum(ctx, 'P'), Qao: snapNum(ctx, 'Qeject'),
      Pla: snapNum(ctx, 'Pla'), CVP: snapNum(ctx, 'CVP'), Psys: metric(ctx, 'Psys'), Pdia: metric(ctx, 'Pdia'), MAP: metric(ctx, 'Pmean'),
      EDV: metric(ctx, 'EDV'), ESV: metric(ctx, 'ESV'), SV: metric(ctx, 'SVtotal'), HR: metric(ctx, 'HRbeat'), CO: metric(ctx, 'SVtotal') * metric(ctx, 'HRbeat') / 1000,
      EF: metric(ctx, 'EF'), PvPeak: metric(ctx, 'PvPeak'), gradient: metric(ctx, 'aorticGradient'), regurgFraction: metric(ctx, 'regurgFraction'),
      Pmsf: snapNum(ctx, 'Pmsf'), Qsys: snapNum(ctx, 'Qout'), Pv: snapNum(ctx, 'Psv'),
      RsysEff: snapNum(ctx, 'effRsys', m.Rsys), EmaxEff: snapNum(ctx, 'effEmax', m.Emax), V0svEff: snapNum(ctx, 'effV0sv', m.V0sv),
    };
  },
  diagram: 'circuit',
  sources: ['Suga H, Sagawa K. Instantaneous pressure–volume relationships and their ratio in the excised, supported canine left ventricle. Circ Res 1974.', 'Stergiopulos N et al. Elastance-based model of the left ventricle. Am J Physiol 1996.'],
};

/* ---- baroreflex --------------------------------------------------------------------------- */
const B = (key: string, symbol: string, label: LocalizedText, unit: string, min: number, max: number, step: number) =>
  param('baroreflex', 'reflex', { key: `circulation.${key}`, symbol, label, unit, min, max, step, digits: step < 0.1 ? 2 : 1 });
const BAROREFLEX: ModelDef = {
  id: 'baroreflex', title: L('Baroreflex', 'Barorezeptorreflex'),
  summary: L('Stretch receptors in the carotid sinus and aortic arch fire with arterial pressure; the brainstem turns their firing into sympathetic and vagal tone, which sets heart rate, contractility, arteriolar resistance and, most powerfully, venous capacity.',
    'Dehnungsrezeptoren in Karotissinus und Aortenbogen feuern mit dem arteriellen Druck; der Hirnstamm macht daraus sympathischen und vagalen Tonus, der Herzfrequenz, Kontraktilität, arteriolären Widerstand und, am stärksten, die venöse Kapazität einstellt.'),
  groups: [{ id: 'reflex', label: L('Reflex', 'Reflex') }],
  variables: [
    param('baroreflex', 'reflex', { key: 'circulation.baroEnabled', symbol: 'on', label: L('Baroreflex active', 'Barorezeptorreflex aktiv'), unit: '', control: 'toggle' }),
    B('Pn', 'P_n', L('Set point', 'Sollwert'), 'mmHg', 60, 140, 1),
    B('gS', 'g_S', L('Sympathetic gain on heart rate', 'Sympathische Verstärkung der Herzfrequenz'), '', 0, 1.5, 0.05),
    B('gP', 'g_P', L('Vagal gain on heart rate', 'Vagale Verstärkung der Herzfrequenz'), '', 0, 1.5, 0.05),
    B('gR', 'g_R', L('Gain on arteriolar resistance', 'Verstärkung des arteriolären Widerstands'), '', 0, 1.5, 0.05),
    B('gV', 'g_V', L('Gain on venous capacity', 'Verstärkung der venösen Kapazität'), '', 0, 1, 0.02),
    B('gE', 'g_E', L('Gain on contractility', 'Verstärkung der Kontraktilität'), '', 0, 1.5, 0.05),
    B('tauS', 'τ_S', L('Sympathetic time constant', 'Sympathische Zeitkonstante'), 's', 0.5, 10, 0.1),
    B('tauP', 'τ_P', L('Vagal time constant', 'Vagale Zeitkonstante'), 's', 0.1, 3, 0.05),
    state('baroreflex', { key: 'P', symbol: 'P_a', label: L('Arterial pressure at the receptor', 'Arterieller Druck am Rezeptor'), unit: 'mmHg', digits: 0 }),
    state('baroreflex', { key: 'f', symbol: 'f', label: L('Baroreceptor firing', 'Barorezeptorfrequenz'), unit: '/s', digits: 1 }),
    state('baroreflex', { key: 'sigmaS', symbol: 'σ_S', label: L('Sympathetic tone', 'Sympathikotonus'), unit: '', digits: 2 }),
    state('baroreflex', { key: 'sigmaP', symbol: 'σ_P', label: L('Vagal tone', 'Vagotonus'), unit: '', digits: 2 }),
    state('baroreflex', { key: 'HR0', symbol: 'HR_0', label: L('Intrinsic rate', 'Eigenfrequenz'), unit: '/min', digits: 0 }),
    state('baroreflex', { key: 'HR', symbol: 'HR', label: L('Heart rate', 'Herzfrequenz'), unit: '/min', digits: 0 }),
  ],
  equations: [
    eq('firing', 'textbook', L('Receptor firing follows pressure (sigmoid)', 'Die Rezeptorfrequenz folgt dem Druck (Sigmoid)'),
      [v('f')], ['2.5', '+', frac(['44.5'], ['1', '+', { sup: [['e'], ['−0.07·(P_a − P_n)']] }])],
      L('Around the set point the receptors are most sensitive; far above or below it they saturate.', 'Um den Sollwert sind die Rezeptoren am empfindlichsten; weit darüber oder darunter sättigen sie.')),
    eq('tone', 'textbook', L('Sympathetic tone rises as firing falls', 'Der Sympathikotonus steigt, wenn die Frequenz fällt'),
      [v('tauS'), '·', { text: 'dσ_S/dt' }], [paren('1', '−', { text: 'n' }), '−', v('sigmaS')],
      L('n is firing normalised to 0–1. Low pressure → little firing → sympathetic tone climbs with time constant τ_S; vagal tone does the opposite, faster.', 'n ist die auf 0–1 normierte Frequenz. Niedriger Druck → wenig Impulse → der Sympathikotonus steigt mit Zeitkonstante τ_S; der Vagotonus tut das Gegenteil, schneller.')),
    eq('rate', 'textbook', L('Heart rate', 'Herzfrequenz'),
      [v('HR')], [v('HR0'), '·', paren('1', '+', v('gS'), '·', v('sigmaS'), '−', v('gP'), '·', v('sigmaP'))],
      L('Sympathetic tone speeds the sinus node, vagal tone slows it.', 'Sympathikotonus beschleunigt den Sinusknoten, Vagotonus verlangsamt ihn.')),
    eq('effectors', 'full', L('Effectors: resistance, venous capacity, contractility', 'Effektoren: Widerstand, venöse Kapazität, Kontraktilität'),
      [v('haemodynamics.RsysEff')], [v('haemodynamics.Rsys'), '·', paren('1', '+', '2', '·', v('gR'), '·', paren(v('sigmaS'), '−', '½'))],
      L('The same drive constricts venous capacitance (V₀,v·(1 − 2g_V(σ_S − ½))), recruiting unstressed blood into circulation — the main defence against haemorrhage — and raises Eₘₐₓ by the factor (1 + 2g_E(σ_S − ½)).',
        'Derselbe Antrieb verengt die venöse Kapazität (V₀,v·(1 − 2g_V(σ_S − ½))) und mobilisiert so ungespanntes Blut — die wichtigste Abwehr gegen Blutverlust — und erhöht Eₘₐₓ um den Faktor (1 + 2g_E(σ_S − ½)).')),
  ],
  values: (ctx) => ({
    ...Object.fromEntries(Object.entries(ctx.model.circulation)),
    P: snapNum(ctx, 'P'), f: snapNum(ctx, 'firingRate'), sigmaS: snapNum(ctx, 'sympathetic'), sigmaP: snapNum(ctx, 'parasympathetic'),
    HR0: ctx.model.circulation.HR, HR: snapNum(ctx, 'HR'),
  }),
  diagram: 'baroreflex',
  sources: ['Ursino M. Interaction between carotid baroregulation and the pulsating heart: a mathematical model. Am J Physiol 1998.'],
};

/* ---- cardiac electrical activity ------------------------------------------------------------- */
const E = (group: string, key: string, symbol: string, label: LocalizedText, extra: Partial<P> = {}) =>
  param('electrical', group, { key: `electrical.${key}`, symbol, label, unit: '', ...extra } as P);
const opt = (pairs: Array<[string, string, string]>) => pairs.map(([value, en, de]) => ({ value, label: L(en, de) }));
const ELECTRICAL: ModelDef = {
  id: 'electrical', title: L('Cardiac electrical activity', 'Elektrische Herzaktion'),
  summary: L('The sinus node fires at a rate the autonomic nervous system sets; the wave crosses the atria, is delayed in the AV node, runs down the His bundle and both bundle branches, and activates the ventricles from the septum outward to the base. At every instant the activation front is an electrical dipole, the cardiac vector. Potassium sets the resting potential every cell starts from. The ECG is a measurement of this vector, made at the skin.',
    'Der Sinusknoten feuert mit einer Frequenz, die das autonome Nervensystem vorgibt; die Erregung läuft über die Vorhöfe, wird im AV-Knoten verzögert, läuft über His-Bündel und beide Tawara-Schenkel und erregt die Kammern vom Septum nach außen bis zur Basis. In jedem Moment ist die Erregungsfront ein elektrischer Dipol, der Herzvektor. Kalium bestimmt das Ruhepotential, von dem jede Zelle startet. Das EKG ist eine Messung dieses Vektors an der Haut.'),
  groups: [
    { id: 'rhythm', label: L('Rhythm', 'Rhythmus') }, { id: 'conduction', label: L('Conduction', 'Erregungsleitung') },
    { id: 'substrate', label: L('Chambers', 'Herzhöhlen') }, { id: 'ischaemia', label: L('Ischaemia', 'Ischämie') },
    { id: 'repolarisation', label: L('Repolarisation', 'Repolarisation') },
  ],
  variables: [
    param('electrical', 'rhythm', { key: 'circulation.HR', symbol: 'HR_0', label: L('Intrinsic sinus rate (before autonomic tone)', 'Eigenfrequenz des Sinusknotens (ohne autonomen Tonus)'), unit: '/min', min: 25, max: 180, step: 1 }),
    E('rhythm', 'atrial', 'atria', L('Atrial rhythm', 'Vorhofrhythmus'), { control: 'enum', options: opt([['sinus', 'sinus', 'Sinus'], ['af', 'fibrillation', 'Flimmern'], ['flutter', 'flutter', 'Flattern']]) }),
    E('rhythm', 'ventricular', 'ventricles', L('Ventricular rhythm taking over', 'Ventrikulärer Rhythmus'), { control: 'enum', options: opt([['none', 'none', 'keiner'], ['vt', 'ventricular tachycardia', 'ventrikuläre Tachykardie'], ['vf', 'ventricular fibrillation', 'Kammerflimmern']]) }),
    E('conduction', 'av', 'c_{AV}', L('AV-nodal conduction', 'AV-Überleitung'), { unit: '0–1', min: 0.2, max: 1.2, step: 0.05, digits: 2 }),
    E('conduction', 'avBlock', 'block', L('AV block pattern', 'AV-Block-Muster'), { control: 'enum', options: opt([['none', 'none', 'keiner'], ['wenckebach', 'Wenckebach (Mobitz I)', 'Wenckebach (Mobitz I)'], ['mobitz2', 'Mobitz II', 'Mobitz II'], ['complete', 'complete', 'komplett']]) }),
    E('conduction', 'lbb', 'c_{LBB}', L('Left bundle branch conduction', 'Leitung linker Tawara-Schenkel'), { unit: '0–1', min: 0, max: 1, step: 0.05, digits: 2 }),
    E('conduction', 'rbb', 'c_{RBB}', L('Right bundle branch conduction', 'Leitung rechter Tawara-Schenkel'), { unit: '0–1', min: 0, max: 1, step: 0.05, digits: 2 }),
    E('conduction', 'accessory', 'AP', L('Accessory pathway', 'Akzessorische Leitungsbahn'), { control: 'toggle' }),
    E('substrate', 'lvMass', 'm_{LV}', L('Left ventricular mass (× normal)', 'Linksventrikuläre Masse (× normal)'), { unit: '×', min: 0.6, max: 2.5, step: 0.05, digits: 2 }),
    E('substrate', 'rvMass', 'm_{RV}', L('Right ventricular mass (× normal)', 'Rechtsventrikuläre Masse (× normal)'), { unit: '×', min: 0.6, max: 3, step: 0.05, digits: 2 }),
    E('substrate', 'laSize', 's_{LA}', L('Left atrial size (× normal)', 'Größe linker Vorhof (× normal)'), { unit: '×', min: 0.8, max: 2.5, step: 0.05, digits: 2 }),
    E('substrate', 'raSize', 's_{RA}', L('Right atrial size (× normal)', 'Größe rechter Vorhof (× normal)'), { unit: '×', min: 0.8, max: 2.5, step: 0.05, digits: 2 }),
    E('ischaemia', 'ischaemia', 'territory', L('Ischaemic territory', 'Ischämisches Areal'), { control: 'enum', options: opt([['none', 'none', 'keines'], ['anterior', 'anterior (LAD), transmural', 'Vorderwand (RIVA), transmural'], ['inferior', 'inferior (RCA), transmural', 'inferior (RCA), transmural'], ['lateral', 'lateral (circumflex), transmural', 'lateral (RCX), transmural'], ['subendocardial', 'subendocardial, diffuse', 'subendokardial, diffus'], ['wellens', 'reperfused LAD (Wellens)', 'reperfundierte RIVA (Wellens)']]) }),
    E('ischaemia', 'injury', 'I_{inj}', L('Injury current', 'Verletzungsstrom'), { unit: '0–1', min: 0, max: 1.5, step: 0.05, digits: 2 }),
    E('repolarisation', 'repolarisation', 'r_{QT}', L('Repolarisation time (× normal)', 'Repolarisationsdauer (× normal)'), { unit: '×', min: 0.8, max: 1.6, step: 0.02, digits: 2 }),
    E('repolarisation', 'brugada', 'I_{Na,RVOT}', L('RV outflow sodium-current loss', 'Natriumstromverlust im RVOT'), { unit: '0–1', min: 0, max: 1, step: 0.05, digits: 2 }),
    E('repolarisation', 'pericarditis', 'peri', L('Epicardial inflammation', 'Epikardiale Entzündung'), { unit: '0–1', min: 0, max: 1, step: 0.05, digits: 2 }),
    E('repolarisation', 'earlyRepol', 'J', L('Early repolarisation', 'Frühe Repolarisation'), { unit: '0–1', min: 0, max: 1, step: 0.05, digits: 2 }),
    E('repolarisation', 'digoxin', 'dig', L('Digoxin effect', 'Digitaliswirkung'), { unit: '0–1', min: 0, max: 1, step: 0.05, digits: 2 }),
    state('electrical', { key: 'Ko', symbol: '[K^+]_o', label: L('Extracellular potassium', 'Extrazelluläres Kalium'), unit: 'mmol/L', digits: 1 }),
    state('electrical', { key: 'Ki', symbol: '[K^+]_i', label: L('Intracellular potassium', 'Intrazelluläres Kalium'), unit: 'mmol/L', digits: 0 }),
    state('electrical', { key: 'EK', symbol: 'E_K', label: L('Potassium equilibrium potential', 'Kalium-Gleichgewichtspotential'), unit: 'mV', digits: 0 }),
    state('electrical', { key: 'rate', symbol: 'HR', label: L('Ventricular rate', 'Kammerfrequenz'), unit: '/min', digits: 0 }),
    state('electrical', { key: 'RR', symbol: 'RR', label: L('Last cycle length', 'Letzte Zykluslänge'), unit: 's', digits: 2 }),
    state('electrical', { key: 'PR', symbol: 't_{AV}', label: L('Atrioventricular conduction time', 'AV-Überleitungszeit'), unit: 'ms', digits: 0 }),
    state('electrical', { key: 'QRS', symbol: 't_{V}', label: L('Ventricular activation time', 'Kammererregungsdauer'), unit: 'ms', digits: 0 }),
    state('electrical', { key: 'QT', symbol: 'QT', label: L('Ventricular repolarisation time', 'Repolarisationszeit'), unit: 'ms', digits: 0 }),
    state('electrical', { key: 'QTc', symbol: 'QT_c', label: L('Repolarisation time corrected to 60/min', 'Auf 60/min korrigierte Repolarisationszeit'), unit: 'ms', digits: 0 }),
    state('electrical', { key: 'axis', symbol: 'α_{QRS}', label: L('Mean activation vector, frontal plane', 'Mittlerer Erregungsvektor, Frontalebene'), unit: '°', digits: 0 }),
  ],
  equations: [
    eq('nernst', 'textbook', L('Resting potential: the Nernst equation for potassium', 'Ruhepotential: Nernst-Gleichung für Kalium'),
      [v('EK')], ['26.7 mV', '·', { fn: 'ln', args: [frac([v('Ko')], [v('Ki')])] }],
      L('At rest the membrane is permeable mainly to potassium, so it sits near E_K. Raise extracellular potassium and the cell depolarises: repolarisation becomes faster and the T wave tall and narrow; then sodium channels inactivate, the atria fall silent first and conduction slows until QRS and T merge.',
        'In Ruhe ist die Membran vor allem für Kalium durchlässig und liegt nahe E_K. Steigt das extrazelluläre Kalium, depolarisiert die Zelle: Die Repolarisation wird schneller, die T-Welle hoch und schmal; dann inaktivieren Natriumkanäle, die Vorhöfe verstummen zuerst, und die Leitung verlangsamt sich, bis QRS und T verschmelzen.')),
    eq('sequence', 'textbook', L('One beat, in sequence', 'Ein Schlag, der Reihe nach'),
      [{ text: 'cycle' }], [{ text: 'sinus' }, '→', { text: 'atria' }, '→', v('PR'), '→', v('QRS'), '→', v('QT')],
      L('The AV node delays the wave so the atria finish filling the ventricles; the ventricles then activate in under a tenth of a second and repolarise over several tenths.',
        'Der AV-Knoten verzögert die Erregung, damit die Vorhöfe die Kammern fertig füllen; die Kammern erregen sich dann in weniger als einer Zehntelsekunde und repolarisieren über mehrere Zehntel.')),
    eq('rate-qt', 'textbook', L('Repolarisation shortens as the heart speeds up', 'Die Repolarisation verkürzt sich mit steigender Frequenz'),
      [v('QT')], [v('QTc'), '·', { fn: 'sqrt', args: [v('RR')] }],
      L('Bazett’s description of rate adaptation, which the model uses: QTc is the repolarisation time the cell would have at 60/min. Calcium shortens it; hypokalaemia and many drugs lengthen it.',
        'Bazetts Beschreibung der Frequenzanpassung, die das Modell verwendet: QTc ist die Repolarisationszeit bei 60/min. Kalzium verkürzt sie; Hypokaliämie und viele Medikamente verlängern sie.')),
    eq('dipole', 'full', L('The cardiac vector: activation fronts as a sum of dipoles', 'Der Herzvektor: Erregungsfronten als Summe von Dipolen'),
      [{ text: 'H⃗(t)' }], [{ text: 'Σ' }, { text: 'a_i' }, '·', { sup: [['e'], ['−(t−t_i)²/2σ_i²']] }, '·', { text: 'u⃗_i' }],
      L('Each part of the activation (septum, right ventricle, left ventricular free wall, base; right and left atrium; repolarisation) contributes a lobe in time along its own direction. Block a bundle branch and the sequence, so the vector loop, changes; thicken the wall and its lobe grows.',
        'Jeder Teil der Erregung (Septum, rechter Ventrikel, linksventrikuläre freie Wand, Basis; rechter und linker Vorhof; Repolarisation) trägt einen zeitlichen Anteil in seiner eigenen Richtung bei. Ein Schenkelblock ändert die Reihenfolge und damit die Vektorschleife; eine dickere Wand vergrößert ihren Anteil.')),
  ],
  values: (ctx) => {
    const e = ctx.snap?.ecgMetrics ?? {};
    const K = ctx.model.chemistry.potassium ?? ctx.model.circulation.K ?? 4;
    return {
      HR: ctx.model.circulation.HR, ...ctx.model.electrical,
      Ko: K, Ki: 140, EK: 26.7 * Math.log(K / 140), rate: e.HR, RR: (e.RR ?? NaN) / 1000, PR: e.PR ?? NaN, QRS: e.QRS, QT: e.QT, QTc: e.QTc, axis: e.qrsAxis,
    };
  },
  diagram: 'conduction',
  sources: ['Klabunde RE. Cardiovascular Physiology Concepts, 3rd ed. 2021.', 'Malmivuo J, Plonsey R. Bioelectromagnetism. Oxford University Press 1995, ch. 15–16.', 'Edenbrandt L, Pahlm O. Vectorcardiogram synthesized from a 12-lead ECG. J Electrocardiol 1988;21:361–7.'],
};

/* ---- vestibulo-ocular reflex ------------------------------------------------------------------ */
const VOR: ModelDef = {
  id: 'vor', title: L('Vestibulo-ocular reflex and gaze holding', 'Vestibulookulärer Reflex und Blickhalten'),
  summary: L('Each labyrinth fires at rest; the eyes stay still because left and right balance. Lose one side and the eyes drift toward it, interrupted by quick phases: nystagmus. A neural integrator holds eccentric gaze; when it leaks, the eyes drift back to the centre.',
    'Jedes Labyrinth feuert in Ruhe; die Augen stehen still, weil links und rechts sich die Waage halten. Fällt eine Seite aus, driften die Augen zu ihr hin, unterbrochen von schnellen Phasen: Nystagmus. Ein neuronaler Integrator hält exzentrische Blickpositionen; wenn er „leckt“, driften die Augen zur Mitte zurück.'),
  groups: [{ id: 'periphery', label: L('Labyrinth and nerve', 'Labyrinth und Nerv') }],
  variables: [
    param('vor', 'periphery', { key: 'vestibular.side', symbol: 'side', label: L('Peripheral vestibular loss: side', 'Peripherer Vestibularisausfall: Seite'), unit: '', control: 'side' }),
    param('vor', 'periphery', { key: 'vestibular.severity', symbol: 's', label: L('Severity of the loss', 'Ausmaß des Ausfalls'), unit: '0–1', min: 0, max: 1, step: 0.05, digits: 2 }),
    param('vor', 'periphery', { key: 'vestibular.daysSinceOnset', symbol: 'd', label: L('Days since onset (compensation)', 'Tage seit Beginn (Kompensation)'), unit: 'd', min: 0, max: 60, step: 1 }),
    state('vor', { key: 'toneL', symbol: 'T_L', label: L('Resting tone, left', 'Ruhetonus links'), unit: '', digits: 2 }),
    state('vor', { key: 'toneR', symbol: 'T_R', label: L('Resting tone, right', 'Ruhetonus rechts'), unit: '', digits: 2 }),
    state('vor', { key: 'c', symbol: 'c', label: L('Central compensation', 'Zentrale Kompensation'), unit: '', digits: 2 }),
    state('vor', { key: 'spv', symbol: 'SPV', label: L('Slow-phase velocity, primary gaze, no fixation', 'Geschwindigkeit der langsamen Phase, Geradeausblick ohne Fixation'), unit: '°/s', digits: 1 }),
    state('vor', { key: 'tau', symbol: 'τ', label: L('Integrator time constant', 'Zeitkonstante des Integrators'), unit: 's', digits: 0 }),
    state('vor', { key: 'gainL', symbol: 'g_L', label: L('VOR gain, head turned left', 'VOR-Verstärkung, Kopf nach links'), unit: '', digits: 2 }),
    state('vor', { key: 'gainR', symbol: 'g_R', label: L('VOR gain, head turned right', 'VOR-Verstärkung, Kopf nach rechts'), unit: '', digits: 2 }),
    state('vor', { key: 'rfix', symbol: 'r_{fix}', label: L('Residual with fixation', 'Restanteil bei Fixation'), unit: '', digits: 2 }),
  ],
  equations: [
    eq('imbalance', 'textbook', L('Tone imbalance drives the slow phase', 'Tonusungleichgewicht treibt die langsame Phase'),
      [v('spv')], ['20 °/s', '·', paren(v('toneR'), '−', v('toneL')), '·', paren('1', '−', v('c'))],
      L('The eyes drift toward the weaker side; quick phases beat toward the stronger. Central compensation c restores balance over days.', 'Die Augen driften zur schwächeren Seite; schnelle Phasen schlagen zur stärkeren. Die zentrale Kompensation c stellt das Gleichgewicht über Tage wieder her.')),
    eq('integrator', 'textbook', L('Gaze holding: a leaky integrator', 'Blickhalten: ein leckender Integrator'),
      [{ text: 'drift' }], ['−', frac([{ text: 'θ' }], [v('tau')])],
      L('Held at angle θ, the eyes drift back toward the centre at θ/τ. Normally τ ≈ 25 s and the drift is invisible; a cerebellar lesion shortens it to a few seconds and gaze-evoked nystagmus appears in every direction.',
        'Bei Blickwinkel θ driften die Augen mit θ/τ zur Mitte. Normal ist τ ≈ 25 s und die Drift unsichtbar; eine Kleinhirnläsion verkürzt sie auf wenige Sekunden, und ein Blickrichtungsnystagmus erscheint in alle Richtungen.')),
    eq('vor-gain', 'textbook', L('Head impulse: VOR gain', 'Kopfimpuls: VOR-Verstärkung'),
      [v('gainL')], [frac([{ text: 'eye velocity' }], [{ text: 'head velocity' }])],
      L('A gain below about 0.6 leaves the eyes behind the target; a catch-up saccade brings them back.', 'Eine Verstärkung unter etwa 0,6 lässt die Augen hinter dem Ziel zurück; eine Refixationssakkade holt sie zurück.')),
    eq('fixation', 'full', L('Fixation and Alexander’s law', 'Fixation und Alexander-Gesetz'),
      [{ text: 'SPV(θ, fix)' }], [v('spv'), '·', { text: 'k_A(θ)' }, '·', v('rfix'), '−', frac([{ text: 'θ' }], [v('tau')])],
      L('k_A is 1.7 when looking toward the quick phase and 0.35 away from it; fixation leaves only r_fix of the spontaneous component if the flocculus is intact.', 'k_A ist 1,7 beim Blick in Richtung der schnellen Phase und 0,35 weg davon; Fixation lässt bei intaktem Flocculus nur r_fix des spontanen Anteils übrig.')),
  ],
  values: (ctx) => {
    const s = neuroExamState(ctx.view);
    const n = nystagmus(s, { gaze: 'primary', fixation: false });
    return {
      side: ctx.model.vestibular.side, severity: ctx.model.vestibular.severity, daysSinceOnset: ctx.model.vestibular.daysSinceOnset,
      toneL: s.periphery.L * s.nucleus.L, toneR: s.periphery.R * s.nucleus.R, c: s.compensation, spv: n.present ? (n.spvDegPerS ?? 0) : 0,
      tau: s.tauSeconds, gainL: 0.25 + 0.75 * s.vor.L, gainR: 0.25 + 0.75 * s.vor.R, rfix: s.fixationResidual,
    };
  },
  diagram: 'vor',
  sources: ['Leigh RJ, Zee DS. The Neurology of Eye Movements, 5th ed. 2015.', 'Kattah JC et al. HINTS. Stroke 2009.'],
};

/* ---- pupillary light reflex ------------------------------------------------------------------------ */
const PUPIL: ModelDef = {
  id: 'pupil', title: L('Pupillary light reflex', 'Pupillenlichtreflex'),
  summary: L('Light on either retina drives both pretectal nuclei, so both pupils constrict: direct and consensual. The sphincter is parasympathetic (Edinger–Westphal, oculomotor nerve, ciliary ganglion); the dilator is sympathetic, a three-neuron chain from hypothalamus to the eye. Pupil size is the balance of the two.',
    'Licht auf eine Netzhaut erregt beide prätektalen Kerne, daher verengen sich beide Pupillen: direkt und konsensuell. Der Sphinkter ist parasympathisch (Edinger-Westphal, N. oculomotorius, Ganglion ciliare); der Dilatator ist sympathisch, eine dreigliedrige Kette vom Hypothalamus zum Auge. Die Pupillenweite ist das Gleichgewicht beider.'),
  groups: [],
  variables: [
    state('pupil', { key: 'd0', symbol: 'd_0', label: L('Resting diameter for age (room light)', 'Ruheweite für das Alter (Raumlicht)'), unit: 'mm', digits: 1 }),
    state('pupil', { key: 'aL', symbol: 'a_L', label: L('Afferent pathway, left eye', 'Afferenz, linkes Auge'), unit: '0/1', digits: 0 }),
    state('pupil', { key: 'aR', symbol: 'a_R', label: L('Afferent pathway, right eye', 'Afferenz, rechtes Auge'), unit: '0/1', digits: 0 }),
    state('pupil', { key: 'eL', symbol: 'e_L', label: L('Parasympathetic efferent, left', 'Parasympathische Efferenz, links'), unit: '0/1', digits: 0 }),
    state('pupil', { key: 'eR', symbol: 'e_R', label: L('Parasympathetic efferent, right', 'Parasympathische Efferenz, rechts'), unit: '0/1', digits: 0 }),
    state('pupil', { key: 'sL', symbol: 's_L', label: L('Sympathetic chain, left', 'Sympathikus, links'), unit: '0/1', digits: 0 }),
    state('pupil', { key: 'sR', symbol: 's_R', label: L('Sympathetic chain, right', 'Sympathikus, rechts'), unit: '0/1', digits: 0 }),
    state('pupil', { key: 'D', symbol: 'D', label: L('Pretectal drive with light in either eye', 'Prätektaler Antrieb bei Licht in einem Auge'), unit: '0/1', digits: 0 }),
    state('pupil', { key: 'dL', symbol: 'd_L', label: L('Left pupil, light on', 'Linke Pupille, Licht an'), unit: 'mm', digits: 1 }),
    state('pupil', { key: 'dR', symbol: 'd_R', label: L('Right pupil, light on', 'Rechte Pupille, Licht an'), unit: 'mm', digits: 1 }),
  ],
  equations: [
    eq('drive', 'textbook', L('Both eyes feed both nuclei', 'Beide Augen speisen beide Kerne'),
      [v('D')], [{ fn: 'max', args: [v('aL'), ',', v('aR')] }],
      L('Shine the light into either eye: if that eye’s afferent pathway works, both pretectal nuclei are driven. That is why an afferent defect never causes anisocoria — it shows only when the light swings between the eyes.',
        'Licht in eines der Augen: Funktioniert dessen Afferenz, werden beide prätektalen Kerne angetrieben. Deshalb verursacht ein afferenter Defekt nie eine Anisokorie — er zeigt sich nur beim Wechselbelichtungstest.')),
    eq('constriction', 'textbook', L('Constriction needs drive and an intact efferent', 'Verengung braucht Antrieb und intakte Efferenz'),
      [v('dL')], [v('d0'), '·', paren('1', '−', '0.4', '·', v('D'), '·', v('eL'))],
      L('A pupil with a broken efferent (third nerve) stays large and fixed whatever eye is lit; a broken sympathetic chain (Horner) leaves it small, and more obviously so in the dark, when the healthy side dilates.',
        'Eine Pupille mit unterbrochener Efferenz (N. III) bleibt weit und lichtstarr, gleich welches Auge belichtet wird; ein unterbrochener Sympathikus (Horner) lässt sie eng, deutlicher im Dunkeln, wenn die gesunde Seite weit wird.')),
  ],
  values: (ctx) => {
    const p = neuroExamState(ctx.view).pupil;
    const age = ctx.model.patient.age;
    const d0 = age < 12 ? 5 : age >= 60 ? 3.5 : 4;
    const a = (x: boolean) => (x ? 1 : 0);
    const D = Math.max(a(p.afferent.L), a(p.afferent.R));
    const size = (S: 'L' | 'R') => {
      let d = d0;
      if (p.horner[S]) d -= 1.8;
      if (!p.efferent[S]) return 6.5;
      return Math.max(1.5, d * (1 - 0.4 * D));
    };
    return { d0, aL: a(p.afferent.L), aR: a(p.afferent.R), eL: a(p.efferent.L), eR: a(p.efferent.R), sL: a(!p.horner.L), sR: a(!p.horner.R), D, dL: size('L'), dR: size('R') };
  },
  diagram: 'pupil',
  sources: ['Kawasaki A. Physiology, assessment, and disorders of the pupil. Curr Opin Ophthalmol 1999.', 'Leigh RJ, Zee DS. The Neurology of Eye Movements, 5th ed. 2015.'],
};

/* ---- nervous system (connectivity) ------------------------------------------------------------ */
const NERVOUS: ModelDef = {
  id: 'nervous-system', title: L('Nervous system pathways', 'Bahnsysteme des Nervensystems'),
  summary: L('A graph of 321 structures and 192 pathways, from cortex to muscle. A lesion interrupts every pathway that passes through it; whether a deficit is upper or lower motor neuron, and on which side, follows from where the pathway is cut relative to its decussation and its final common path.',
    'Ein Graph aus 321 Strukturen und 192 Bahnen, vom Kortex bis zum Muskel. Eine Läsion unterbricht jede Bahn, die sie durchläuft; ob ein Defizit zentral oder peripher ist und auf welcher Seite, ergibt sich daraus, wo die Bahn relativ zu ihrer Kreuzung und ihrer gemeinsamen Endstrecke unterbrochen ist.'),
  groups: [{ id: 'lesions', label: L('Lesions', 'Läsionen') }],
  variables: [
    param('nervous-system', 'lesions', { key: 'lesions', symbol: 'lesions', label: L('Lesioned structures', 'Geschädigte Strukturen'), unit: '', control: 'lesions' }),
    param('nervous-system', 'lesions', { key: 'lesions.complete', symbol: 'complete', label: L('Complete lesion', 'Komplette Läsion'), unit: '', control: 'toggle' }),
  ],
  equations: [],
  values: (ctx) => ({ lesions: ctx.model.lesions.nodes.length, complete: ctx.model.lesions.complete, pathways: ctx.view.neuro?.findings.length ?? 0 }),
  diagram: 'pathways',
  sources: ['Brazis PW, Masdeu JC, Biller J. Localization in Clinical Neurology, 8th ed. 2021.'],
};

/* ---- the internal milieu: water and sodium, the kidney, potassium and acid–base, fuels ---------------------------- */
const bod = (ctx: LiveContext): Record<string, any> => (ctx.snap?.body ?? ctx.view.body ?? {}) as Record<string, any>;
const bn = (ctx: LiveContext, k: string) => { const x = bod(ctx)[k]; return typeof x === 'number' ? x : NaN; };
const BP = (model: string, group: string, key: string, symbol: string, label: LocalizedText, unit: string, min: number, max: number, step: number, note?: LocalizedText) =>
  param(model, group, { key: `body.${key}`, symbol, label, unit, min, max, step, note, digits: step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0 });
const S = (model: string, key: string, symbol: string, label: LocalizedText, unit: string, digits = 1) => state(model, { key, symbol, label, unit, digits });

const WATER: ModelDef = {
  id: 'water', title: L('Body water and sodium', 'Körperwasser und Natrium'),
  summary: L('Water crosses cell membranes freely, so every compartment has the same osmolality: the cells hold their solutes, the extracellular fluid holds sodium. The plasma sodium is therefore a ratio, the body’s sodium to its water, and says nothing by itself about how much of either there is. The amount of sodium sets the extracellular volume (and so the blood volume); the amount of water, through ADH and thirst, sets the sodium concentration. A case sets what goes in and out, and for how long; the model finds where the body has got to.',
    'Wasser passiert Zellmembranen frei, daher hat jedes Kompartiment dieselbe Osmolalität: Die Zellen halten ihre gelösten Teilchen, die Extrazellulärflüssigkeit hält Natrium. Das Plasmanatrium ist daher ein Verhältnis — Natrium zu Wasser des Körpers — und sagt allein nichts darüber, wie viel von beidem da ist. Die Natriummenge bestimmt das Extrazellulärvolumen (und damit das Blutvolumen); die Wassermenge bestimmt über ADH und Durst die Natriumkonzentration. Ein Fall legt fest, was hinein- und hinausgeht und wie lange; das Modell findet heraus, wo der Körper angekommen ist.'),
  groups: [
    { id: 'course', label: L('Course of the illness', 'Verlauf der Erkrankung') },
    { id: 'intake', label: L('Intake', 'Zufuhr') },
    { id: 'losses', label: L('Losses', 'Verluste') },
    { id: 'hormones', label: L('Hormones', 'Hormone') },
  ],
  variables: [
    BP('water', 'course', 'courseHours', 't', L('How long the illness has acted (the body is run from health, or from its chronic state, for this long)', 'Wie lange die Erkrankung wirkt (der Körper wird so lange ab Gesundheit bzw. ab seinem chronischen Zustand gerechnet)'), 'h', 0, 8760, 1),
    BP('water', 'intake', 'fluidIntake', 'W_{in}', L('Fluid drunk (before thirst)', 'Trinkmenge (ohne Durst)'), 'L/day', 0, 8, 0.1),
    BP('water', 'intake', 'foodIntake', 'F', L('Food eaten (fraction of a normal diet)', 'Nahrungsaufnahme (Anteil einer normalen Kost)'), '× normal', 0, 1.5, 0.05),
    BP('water', 'intake', 'saltIntake', 'Na_{in}', L('Salt in a full diet', 'Salz bei voller Kost'), 'mmol/day', 0, 400, 5),
    BP('water', 'intake', 'canDrink', 'thirst', L('Can act on thirst (0 = no access to water, or confused)', 'Kann dem Durst folgen (0 = kein Zugang zu Wasser oder verwirrt)'), '0/1', 0, 1, 1),
    BP('water', 'losses', 'vomiting', 'V_{vom}', L('Vomiting (gastric juice: HCl with some NaCl and KCl)', 'Erbrechen (Magensaft: HCl mit etwas NaCl und KCl)'), 'L/day', 0, 5, 0.1),
    BP('water', 'losses', 'diarrhoea', 'V_{stool}', L('Diarrhoea (stool water: Na⁺, K⁺, HCO₃⁻)', 'Diarrhö (Stuhlwasser: Na⁺, K⁺, HCO₃⁻)'), 'L/day', 0, 10, 0.1),
    BP('water', 'hormones', 'siadh', 'ADH_{inap}', L('Inappropriate ADH (tumour, drugs, lung or brain disease)', 'Inadäquates ADH (Tumor, Medikamente, Lungen- oder Hirnerkrankung)'), 'pg/mL', 0, 15, 0.5),
    S('water', 'TBW', 'TBW', L('Total body water', 'Gesamtkörperwasser'), 'L'),
    S('water', 'ICF', 'V_{ICF}', L('Intracellular fluid', 'Intrazellulärflüssigkeit'), 'L'),
    S('water', 'ECF', 'V_{ECF}', L('Extracellular fluid', 'Extrazellulärflüssigkeit'), 'L'),
    S('water', 'plasma', 'V_p', L('Plasma volume', 'Plasmavolumen'), 'L', 2),
    S('water', 'ISF', 'V_{ISF}', L('Interstitial fluid', 'Interstitielle Flüssigkeit'), 'L'),
    S('water', 'dISF', 'ΔV_{ISF}', L('Interstitial fluid gained (oedema) or lost', 'Interstitielle Flüssigkeit gewonnen (Ödem) oder verloren'), 'L'),
    S('water', 'bloodVolume', 'BV', L('Blood volume', 'Blutvolumen'), 'mL', 0),
    S('water', 'NaE', 'Na_e', L('Exchangeable sodium', 'Austauschbares Natrium'), 'mmol', 0),
    S('water', 'Oi', 'Osm_{ICF}', L('Cell osmoles', 'Osmole der Zellen'), 'mosmol', 0),
    S('water', 'sodium', '[Na^+]', L('Plasma sodium', 'Plasmanatrium'), 'mmol/L', 0),
    S('water', 'tonicity', 'Osm_{eff}', L('Effective osmolality (tonicity)', 'Effektive Osmolalität (Tonizität)'), 'mosmol/kg', 0),
    S('water', 'osmolality', 'Osm', L('Measured osmolality (urea included)', 'Gemessene Osmolalität (mit Harnstoff)'), 'mosmol/kg', 0),
    S('water', 'adh', 'ADH', L('Vasopressin (ADH)', 'Vasopressin (ADH)'), 'pg/mL', 1),
    S('water', 'urineOsm', 'U_{osm}', L('Urine osmolality', 'Urinosmolalität'), 'mosmol/kg', 0),
    S('water', 'osmU', 'Ṡ_U', L('Solute excreted', 'Ausgeschiedene gelöste Teilchen'), 'mosmol/day', 0),
    S('water', 'urine', 'V̇_U', L('Urine flow', 'Urinfluss'), 'mL/h', 0),
    S('water', 'waterIn', 'W_{in}', L('Water taken in (drink, thirst, metabolic water)', 'Wasseraufnahme (Trinken, Durst, Oxidationswasser)'), 'L/day', 2),
    S('water', 'waterOut', 'W_{out}', L('Water lost (urine, insensible, vomit, stool)', 'Wasserverlust (Urin, Perspiratio, Erbrochenes, Stuhl)'), 'L/day', 2),
  ],
  equations: [
    eq('osm-eq', 'textbook', L('Osmotic equilibrium: water follows solute', 'Osmotisches Gleichgewicht: Wasser folgt den Teilchen'),
      [v('ICF')], [frac([v('Oi')], [frac([v('Oi'), '+', '2', '·', v('NaE'), '+', { text: 'glucose' }], [v('TBW')])])],
      L('The cells keep their osmoles (mostly K⁺ salts and proteins); the extracellular fluid keeps sodium salts and glucose. Water distributes until both have the same osmolality. Lose sodium and the cells swell; add glucose without insulin and they shrink.',
        'Die Zellen behalten ihre Osmole (vor allem K⁺-Salze und Proteine); die Extrazellulärflüssigkeit Natriumsalze und Glukose. Wasser verteilt sich, bis beide dieselbe Osmolalität haben. Natriumverlust lässt die Zellen schwellen; Glukose ohne Insulin lässt sie schrumpfen.')),
    eq('na', 'textbook', L('The sodium is a ratio', 'Das Natrium ist ein Verhältnis'),
      [v('sodium')], [frac([v('NaE')], [v('ECF')])],
      L('Too little sodium for the water, or too much water for the sodium. Hyponatraemia with a large ECF (heart failure), a normal one (inappropriate ADH, a thiazide, too little solute) or a small one (vomiting, diarrhoea) are three different problems with one number.',
        'Zu wenig Natrium für das Wasser oder zu viel Wasser für das Natrium. Eine Hyponatriämie bei großem EZV (Herzinsuffizienz), normalem (inadäquates ADH, Thiazid, zu wenig gelöste Teilchen) oder kleinem (Erbrechen, Diarrhö) sind drei verschiedene Probleme mit einer Zahl.')),
    eq('adh', 'textbook', L('ADH: tonicity, and volume before it', 'ADH: Tonizität — und davor das Volumen'),
      [v('adh')], [n(WAT.adhOsmoticSlope), '·', paren(v('tonicity'), '−', { text: `${WAT.adhThreshold} + ${WAT.adhVolumeShift}·hypovolaemia` }), '+', { text: `${WAT.adhVolumeSteep}·hypovolaemia²` }, '+', { text: 'nausea' }, '+', v('siadh')],
      L('ADH rises about 0.4 pg/mL per mosmol/kg above a threshold. A falling blood volume lowers the threshold and, when steep, overrides tonicity altogether: a hypovolaemic body keeps water even as its sodium falls. Nausea is a strong stimulus too.',
        'ADH steigt um etwa 0,4 pg/ml pro mosmol/kg über einer Schwelle. Sinkendes Blutvolumen senkt die Schwelle und setzt sich, wenn es stark sinkt, ganz über die Tonizität hinweg: Ein hypovolämischer Körper hält Wasser zurück, auch wenn sein Natrium fällt. Auch Übelkeit ist ein starker Reiz.')),
    eq('flow', 'textbook', L('Urine flow: solute divided by concentration', 'Urinfluss: Teilchen geteilt durch Konzentration'),
      [v('urine')], [frac([v('osmU')], [v('urineOsm')])],
      L('The kidney can only excrete water dissolving something. With 600 mosmol/day and a maximally dilute urine of 50 mosmol/kg, 12 L/day; on tea and toast (200 mosmol/day), 4 L; on a thiazide, which stops the urine getting dilute, far less. That is how drinking causes hyponatraemia.',
        'Die Niere kann Wasser nur ausscheiden, wenn es etwas löst. Mit 600 mosmol/Tag und maximal verdünntem Urin von 50 mosmol/kg sind es 12 l/Tag; bei Tee und Toast (200 mosmol/Tag) 4 l; unter einem Thiazid, das die Verdünnung verhindert, weit weniger. So macht Trinken eine Hyponatriämie.')),
    eq('starling', 'full', L('Plasma and interstitium (Starling, settling over hours)', 'Plasma und Interstitium (Starling, Einstellung über Stunden)'),
      [v('plasma')], [{ text: 'V_p,0' }, '·', { text: 'f(ECF/ECF₀)' }, '·', { sup: [[paren(frac([{ text: 'albumin' }], [n(WAT.albuminNormal)]))], [n(WAT.plasmaAlbumin)]] }, '·', paren('1', '−', n(WAT.plasmaCvp), '·', { text: '(CVP − 8)' })],
      L('Most of a gain or loss of extracellular fluid is interstitial; the plasma is defended by albumin’s oncotic pressure. Low albumin moves fluid out (oedema with a small plasma volume); a high venous pressure does the same. After bleeding, fluid moves the other way over hours: the transcapillary refill that dilutes the haemoglobin.',
        'Der größte Teil eines Gewinns oder Verlusts an Extrazellulärflüssigkeit ist interstitiell; das Plasma wird vom onkotischen Druck des Albumins verteidigt. Niedriges Albumin verschiebt Flüssigkeit nach außen (Ödem bei kleinem Plasmavolumen); ein hoher Venendruck ebenso. Nach einer Blutung fließt sie über Stunden zurück: das transkapilläre Auffüllen, das das Hämoglobin verdünnt.')),
  ],
  values: (ctx) => {
    const b = bod(ctx), i = b.inputs ?? {};
    void i;
    return {
      ...Object.fromEntries(Object.entries(ctx.model.body)),
      TBW: bn(ctx, 'TBW'), ICF: bn(ctx, 'ICF'), ECF: bn(ctx, 'ECF'), plasma: bn(ctx, 'plasma'), ISF: bn(ctx, 'ISF'), dISF: bn(ctx, 'dISF'), bloodVolume: bn(ctx, 'bloodVolume'),
      NaE: bn(ctx, 'sodium') * bn(ctx, 'ECF'), Oi: bn(ctx, 'tonicity') * bn(ctx, 'ICF'), sodium: bn(ctx, 'sodium'), tonicity: bn(ctx, 'tonicity'), osmolality: bn(ctx, 'osmolality'),
      adh: bn(ctx, 'adh'), urineOsm: bn(ctx, 'urineOsm'), urine: bn(ctx, 'urineMlPerH'), osmU: bn(ctx, 'urineOsm') * bn(ctx, 'urineMlPerH') * 24 / 1000,
      waterIn: bn(ctx, 'waterIn'), waterOut: bn(ctx, 'waterOut'),
    };
  },
  diagram: 'water',
  constants: ['water'],
  sources: ['Edelman IS et al. Interrelations between serum sodium concentration, serum osmolarity and total exchangeable sodium, total exchangeable potassium and total body water. J Clin Invest 1958;37:1236–56.', 'Robertson GL. Antidiuretic hormone: normal and disordered function. Endocrinol Metab Clin North Am 2001;30:671–94.', 'Berl T. Impact of solute intake on urine flow and water excretion. J Am Soc Nephrol 2008;19:1076–8.', 'Guyton AC, Coleman TG, Granger HJ. Circulation: overall regulation. Annu Rev Physiol 1972;34:13–46.'],
};

const KIDNEY: ModelDef = {
  id: 'kidney', title: L('The kidney', 'Die Niere'),
  summary: L('The kidney filters about 180 L of plasma a day and returns all but a litre or two, choosing what to keep. Filtration holds steady over a wide range of blood pressure (autoregulation: the afferent arteriole widens, angiotensin II narrows the efferent), and fails below it, faster in a patient on an ACE inhibitor and an NSAID, who has taken away both defences. Creatinine and urea are what a failing filter leaves behind; how far they climb and how fast follow from how much is made and how much is cleared. The tubules then set sodium (volume and pressure, aldosterone), potassium (aldosterone, distal flow) and acid (ammonium).',
    'Die Niere filtriert etwa 180 l Plasma am Tag und gibt bis auf ein, zwei Liter alles zurück — und wählt dabei aus, was sie behält. Die Filtration bleibt über einen weiten Blutdruckbereich konstant (Autoregulation: das Vas afferens weitet sich, Angiotensin II verengt das Vas efferens) und versagt darunter — schneller bei einem Patienten unter ACE-Hemmer und NSAR, der beide Schutzmechanismen verloren hat. Kreatinin und Harnstoff sind, was ein versagender Filter zurücklässt; wie hoch und wie schnell sie steigen, folgt daraus, wie viel gebildet und wie viel geklärt wird. Die Tubuli regeln dann Natrium (Volumen und Druck, Aldosteron), Kalium (Aldosteron, distaler Fluss) und Säure (Ammonium).'),
  groups: [
    { id: 'nephrons', label: L('Nephrons', 'Nephrone') },
    { id: 'drugs', label: L('Drugs', 'Medikamente') },
    { id: 'diet', label: L('Diet', 'Ernährung') },
  ],
  variables: [
    BP('kidney', 'nephrons', 'nephronMass', 'N', L('Working nephrons (chronic kidney disease)', 'Funktionierende Nephrone (chronische Niereninsuffizienz)'), '× normal', 0.03, 1.2, 0.01),
    BP('kidney', 'nephrons', 'tubularInjury', 'ATN', L('Acute tubular injury', 'Akuter Tubulusschaden'), '0–1', 0, 1, 0.05),
    BP('kidney', 'nephrons', 'obstruction', 'obs', L('Outflow obstruction', 'Harnabflussstörung'), '0–1', 0, 1, 0.05),
    BP('kidney', 'drugs', 'aceInhibitor', 'ACEi', L('ACE inhibitor or angiotensin receptor blocker', 'ACE-Hemmer oder Angiotensin-Rezeptorblocker'), '0–1', 0, 1, 0.1),
    BP('kidney', 'drugs', 'nsaid', 'NSAID', L('Non-steroidal anti-inflammatory drug', 'Nichtsteroidales Antirheumatikum'), '0–1', 0, 1, 0.1),
    BP('kidney', 'drugs', 'loopDiuretic', 'loop', L('Loop diuretic', 'Schleifendiuretikum'), '0–1', 0, 1, 0.1),
    BP('kidney', 'drugs', 'thiazide', 'thz', L('Thiazide', 'Thiazid'), '0–1', 0, 1, 0.1),
    BP('kidney', 'drugs', 'spironolactone', 'spiro', L('Aldosterone antagonist', 'Aldosteronantagonist'), '0–1', 0, 1, 0.1),
    BP('kidney', 'diet', 'proteinIntake', 'prot', L('Protein in a full diet (urea, fixed acid)', 'Eiweiß bei voller Kost (Harnstoff, nichtflüchtige Säure)'), 'g/day', 0, 200, 5),
    S('kidney', 'MAP', 'MAP', L('Mean arterial pressure (from the circulation)', 'Arterieller Mitteldruck (aus dem Kreislauf)'), 'mmHg', 0),
    S('kidney', 'autoregulation', 'f_{auto}', L('Filtration kept by autoregulation', 'Durch Autoregulation erhaltene Filtration'), '0–1', 2),
    S('kidney', 'GFR', 'GFR', L('Glomerular filtration rate', 'Glomeruläre Filtrationsrate'), 'mL/min', 0),
    S('kidney', 'creatinine', '[crea]', L('Creatinine', 'Kreatinin'), 'µmol/L', 0),
    S('kidney', 'urea', '[urea]', L('Urea', 'Harnstoff'), 'mmol/L', 1),
    S('kidney', 'ureaCreat', 'urea/crea', L('Urea to creatinine ratio (×1000)', 'Harnstoff-Kreatinin-Quotient (×1000)'), '', 0),
    S('kidney', 'FENa', 'FE_{Na}', L('Fractional excretion of sodium', 'Fraktionelle Natriumausscheidung'), '%', 2),
    S('kidney', 'urineNa', 'U_{Na}', L('Urine sodium', 'Urinnatrium'), 'mmol/L', 0),
    S('kidney', 'uNaRate', 'U_{Na}V', L('Sodium excreted', 'Ausgeschiedenes Natrium'), 'mmol/day', 0),
    S('kidney', 'uKRate', 'U_KV', L('Potassium excreted', 'Ausgeschiedenes Kalium'), 'mmol/day', 0),
    S('kidney', 'NH4', 'U_{NH4}V', L('Ammonium excreted (acid)', 'Ausgeschiedenes Ammonium (Säure)'), 'mmol/day', 0),
    S('kidney', 'bicarbonaturia', 'U_{HCO3}V', L('Bicarbonate excreted', 'Ausgeschiedenes Bikarbonat'), 'mmol/day', 0),
    S('kidney', 'renin', 'PRA', L('Renin activity', 'Reninaktivität'), '× normal', 2),
    S('kidney', 'angII', 'AngII', L('Angiotensin II', 'Angiotensin II'), '× normal', 2),
    S('kidney', 'aldosterone', 'Aldo', L('Aldosterone', 'Aldosteron'), '× normal', 2),
    S('kidney', 'phosphate', '[PO_4]', L('Phosphate', 'Phosphat'), 'mmol/L', 2),
  ],
  equations: [
    eq('gfr', 'textbook', L('Filtration and its autoregulation', 'Filtration und ihre Autoregulation'),
      [v('GFR')], [{ text: 'GFR₀' }, '·', v('nephronMass'), '·', paren('1', '−', n(KID.atnFiltrationLoss), '·', v('tubularInjury')), '·', { sup: [[paren(frac([v('MAP'), '−', { text: 'CVP' }, '−', n(KID.filtrationZeroPressure)], [{ text: 'P_low' }, '−', n(KID.filtrationZeroPressure)]))], [n(KID.autoregulationExponent)]] }],
      L('Flat above the lower limit of autoregulation (about 72 mmHg), falling below it. An ACE inhibitor raises that limit because angiotensin II, which holds the efferent arteriole tight when perfusion falls, is gone; an NSAID raises it because the prostaglandins that hold the afferent open are gone. Together, with diarrhoea or a diuretic: the ‘triple whammy’. A high venous pressure (heart failure) lowers filtration too.',
        'Flach oberhalb der unteren Autoregulationsgrenze (etwa 72 mmHg), darunter abfallend. Ein ACE-Hemmer hebt diese Grenze, weil Angiotensin II fehlt, das bei sinkender Perfusion das Vas efferens eng hält; ein NSAR hebt sie, weil die Prostaglandine fehlen, die das Vas afferens offen halten. Beide zusammen mit Diarrhö oder einem Diuretikum: der „Triple Whammy“. Auch ein hoher Venendruck (Herzinsuffizienz) senkt die Filtration.')),
    eq('creat', 'textbook', L('Creatinine: production over clearance', 'Kreatinin: Bildung durch Clearance'),
      [v('creatinine')], [frac([{ text: 'production (muscle)' }], [{ text: n(KID.creatSecretion) }, '·', v('GFR')])],
      L('Halve the filtration and creatinine doubles, but only after several half-lives: creatinine is spread through the body water, so after an acute loss of filtration it climbs over days. A small, old woman makes little creatinine: her ‘normal’ value can hide a GFR of 30.',
        'Halbiert sich die Filtration, verdoppelt sich das Kreatinin — aber erst nach mehreren Halbwertszeiten: Kreatinin verteilt sich im Körperwasser, nach einem akuten Filtrationsverlust steigt es über Tage. Eine kleine, alte Frau bildet wenig Kreatinin: Ihr „normaler“ Wert kann eine GFR von 30 verbergen.')),
    eq('urea', 'textbook', L('Urea: reabsorbed when urine flow is slow', 'Harnstoff: rückresorbiert, wenn der Urin langsam fließt'),
      [{ text: 'urea excreted' }], [v('GFR'), '·', v('urea'), '·', paren(n(KID.ureaReabsorption), '−', n(KID.ureaFlowEffect), '·', { text: 'ADH effect' }, '−', { text: 'hypovolaemia' })],
      L('Unlike creatinine, urea is partly reabsorbed, more so when ADH is high and flow is slow. In a dry patient urea climbs faster than creatinine (a high urea:creatinine ratio, ‘prerenal’); it climbs further with catabolism, steroids and blood digested in the gut.',
        'Anders als Kreatinin wird Harnstoff teilweise rückresorbiert — umso mehr, je höher ADH und je langsamer der Fluss. Beim exsikkierten Patienten steigt Harnstoff schneller als Kreatinin (hoher Harnstoff-Kreatinin-Quotient, „prärenal“); weiter bei Katabolie, Steroiden und im Darm verdautem Blut.')),
    eq('natri', 'textbook', L('Sodium excretion: volume, pressure, hormones', 'Natriumausscheidung: Volumen, Druck, Hormone'),
      [v('uNaRate')], [n(KID.sodiumIntake), '·', { sup: [['e'], [`${KID.natriuresisVolume}·(V_eff − 1)`]] }, '·', { sup: [['e'], [`${KID.natriuresisPressure}·(MAP − 93)`]] }, '·', { sup: [[v('aldosterone')], [`${KID.natriuresisAldosterone}`.replace('-', '−')]] }, '·', { sup: [[v('angII')], [`${KID.natriuresisAngiotensin}`.replace('-', '−')]] }, '·', paren('1', '+', n(KID.loopDiuretic), '·', v('loopDiuretic'), '+', n(KID.thiazide), '·', v('thiazide'))],
      L('In steady state the kidney excretes what is eaten; the ECF settles wherever that is true. A diuretic shifts the curve, the ECF shrinks until the hormones it switches on cancel it (‘braking’). In tubular injury the tubule cannot hold sodium: a high FENa despite a dry patient, the opposite of prerenal failure.',
        'Im Gleichgewicht scheidet die Niere aus, was gegessen wird; das EZV stellt sich dort ein, wo das stimmt. Ein Diuretikum verschiebt die Kurve, das EZV schrumpft, bis die Hormone, die es dabei anschaltet, die Wirkung aufheben („Bremsphänomen“). Bei Tubulusschaden kann der Tubulus Natrium nicht halten: hohe FENa trotz Exsikkose, das Gegenteil des prärenalen Versagens.')),
    eq('renin', 'textbook', L('Renin, angiotensin II, aldosterone', 'Renin, Angiotensin II, Aldosteron'),
      [v('renin')], [{ sup: [['e'], [`−${KID.reninVolume}·(V_eff − 1)`]] }, '·', { sup: [[{ text: 'macula densa NaCl' }], [`−${KID.reninMaculaDensa}`]] }, '·', { sup: [['e'], [`−${KID.reninPressure}·(MAP − 93)`]] }, '·', { text: 'renal nerves' }],
      L(`Renin is released when the afferent arteriole sees a low pressure, when less salt reaches the macula densa, and when the renal nerves fire. Angiotensin II follows it only as renin^${KID.angiotensinFromRenin}: renin rises twentyfold under maximal stimulation, angiotensin II threefold (Walker 1976). Aldosterone follows angiotensin II and potassium. Fitted to the sodium-reduction meta-analysis: cutting salt from 201 to 66 mmol/day raises renin about 55 % and aldosterone about 127 % for a fall in systolic pressure of 1 mmHg.`,
        `Renin wird ausgeschüttet, wenn das Vas afferens einen niedrigen Druck sieht, wenn weniger Salz die Macula densa erreicht und wenn die Nierennerven feuern. Angiotensin II folgt ihm nur als Renin^${KID.angiotensinFromRenin}: Renin steigt unter maximaler Stimulation zwanzigfach, Angiotensin II dreifach (Walker 1976). Aldosteron folgt Angiotensin II und Kalium. Angepasst an die Metaanalyse der Salzreduktion: Senkung von 201 auf 66 mmol/Tag hebt Renin um etwa 55 % und Aldosteron um etwa 127 %, bei einem Abfall des systolischen Drucks um 1 mmHg.`)),
    eq('kU', 'textbook', L('Potassium secretion: aldosterone and distal flow', 'Kaliumsekretion: Aldosteron und distaler Fluss'),
      [v('uKRate')], [n(KID.potassiumIntake), '·', { sup: [[paren(frac([{ text: '[K⁺]' }], ['4']))], [n(KID.kSecretionPotassium)]] }, '·', { sup: [[v('aldosterone')], [n(KID.kSecretionAldosterone)]] }, '·', { sup: [[paren(frac([v('uNaRate')], [n(KID.sodiumIntake)]))], [n(KID.kSecretionFlow)]] }, '·', { text: 'tubular capacity' }],
      L('Potassium leaves in the collecting duct, driven by aldosterone and by the flow of sodium past it. Block aldosterone (spironolactone, ACE inhibitor), slow the flow (a dry patient) and lose filtration, and potassium accumulates. Loop and thiazide diuretics do the reverse.',
        'Kalium verlässt den Körper im Sammelrohr, angetrieben von Aldosteron und vom vorbeifließenden Natrium. Aldosteron blockieren (Spironolacton, ACE-Hemmer), den Fluss verlangsamen (Exsikkose) und Filtration verlieren — und Kalium sammelt sich an. Schleifen- und Thiaziddiuretika bewirken das Gegenteil.')),
  ],
  values: (ctx) => {
    const b = bod(ctx);
    return {
      ...Object.fromEntries(Object.entries(ctx.model.body)),
      MAP: metric(ctx, 'Pmean'), autoregulation: bn(ctx, 'autoregulation'), GFR: bn(ctx, 'GFR'), creatinine: bn(ctx, 'creatinine'), urea: bn(ctx, 'urea'),
      ureaCreat: 1000 * bn(ctx, 'urea') / bn(ctx, 'creatinine'), FENa: bn(ctx, 'FENa'), urineNa: bn(ctx, 'urineNa'), uNaRate: bn(ctx, 'uNaRate'), uKRate: bn(ctx, 'uKRate'),
      NH4: bn(ctx, 'NH4'), bicarbonaturia: bn(ctx, 'bicarbonaturia'), renin: bn(ctx, 'renin') / 1.5, angII: bn(ctx, 'angII'), aldosterone: bn(ctx, 'aldosterone'), phosphate: bn(ctx, 'phosphate'),
      urine: b.urineMlPerH,
    };
  },
  diagram: 'kidney',
  constants: ['kidney'],
  sources: ['Carlström M, Wilcox CS, Arendshorst WJ. Renal autoregulation in health and disease. Physiol Rev 2015;95:405–511.', 'Lapi F et al. Concurrent use of diuretics, angiotensin converting enzyme inhibitors, and angiotensin receptor blockers with NSAIDs and risk of acute kidney injury. BMJ 2013;346:e8525.', 'Palmer BF, Clegg DJ. Physiology and pathophysiology of potassium homeostasis. Adv Physiol Educ 2016;40:480–90.', 'Waikar SS, Bonventre JV. Creatinine kinetics and the definition of acute kidney injury. J Am Soc Nephrol 2009;20:672–9.'],
};

const BLOOD: ModelDef = {
  id: 'blood', title: L('Blood: red cells and iron', 'Blut: Erythrozyten und Eisen'),
  summary: L('Haemoglobin is a concentration: red cell mass over blood volume. Red cells live about 120 days; the marrow replaces them at the rate erythropoietin asks for, and erythropoietin is made by the kidney when the oxygen it receives falls (anaemia, hypoxaemia). Each millilitre of red cells needs about a milligram of iron, recycled from old cells; only a milligram or two a day is absorbed, so a slow bleed empties the stores over months and the marrow then makes small, pale cells. B₁₂ or folate lack makes large cells, many of which die in the marrow. Haemolysis shortens red cell life and the marrow answers with reticulocytes. After an acute bleed haemoglobin is unchanged at first; it falls over hours as plasma refills, and recovers over weeks.',
    'Hämoglobin ist eine Konzentration: Erythrozytenmasse durch Blutvolumen. Erythrozyten leben etwa 120 Tage; das Knochenmark ersetzt sie so schnell, wie Erythropoetin es verlangt, und Erythropoetin bildet die Niere, wenn der Sauerstoff, den sie erhält, sinkt (Anämie, Hypoxämie). Jeder Milliliter Erythrozyten braucht etwa ein Milligramm Eisen, aus alten Zellen recycelt; resorbiert werden nur ein, zwei Milligramm am Tag, daher leert eine langsame Blutung die Speicher über Monate, und das Mark bildet dann kleine, blasse Zellen. Mangel an B₁₂ oder Folsäure macht große Zellen, von denen viele schon im Mark zugrunde gehen. Hämolyse verkürzt die Lebensdauer, das Mark antwortet mit Retikulozyten. Nach akuter Blutung ist das Hämoglobin zunächst unverändert; es fällt über Stunden, während Plasma nachströmt, und erholt sich über Wochen.'),
  groups: [{ id: 'marrow', label: L('Marrow and nutrients', 'Knochenmark und Nährstoffe') }, { id: 'loss', label: L('Loss and destruction', 'Verlust und Abbau') }],
  variables: [
    BP('blood', 'marrow', 'marrow', 'M', L('Marrow capacity', 'Knochenmarkkapazität'), '× normal', 0, 2, 0.05),
    BP('blood', 'marrow', 'ironAbsorption', 'Fe_{abs}', L('Dietary iron absorbed', 'Resorbiertes Nahrungseisen'), '× normal', 0, 3, 0.1),
    BP('blood', 'marrow', 'b12Deficiency', 'B12', L('Vitamin B₁₂ (or folate) deficiency', 'Vitamin-B₁₂- (oder Folsäure-)Mangel'), '0–1', 0, 1, 0.05),
    BP('blood', 'marrow', 'redCellMass', 'RCM', L('Red cell mass the marrow aims for (polycythaemia)', 'Angestrebte Erythrozytenmasse (Polyzythämie)'), '× normal', 0.3, 1.8, 0.02),
    BP('blood', 'loss', 'haemolysis', 'H', L('Haemolysis (extra destruction)', 'Hämolyse (zusätzlicher Abbau)'), '× normal', 0, 6, 0.1),
    BP('blood', 'loss', 'upperGIBleed', 'B_{UGI}', L('Upper gastrointestinal bleeding', 'Obere gastrointestinale Blutung'), 'mL/h', 0, 600, 5),
    BP('blood', 'loss', 'lowerGIBleed', 'B_{LGI}', L('Lower gastrointestinal bleeding', 'Untere gastrointestinale Blutung'), 'mL/h', 0, 300, 0.1),
    S('blood', 'Hb', '[Hb]', L('Haemoglobin', 'Hämoglobin'), 'g/L', 0),
    S('blood', 'RCV', 'V_{RBC}', L('Red cell volume', 'Erythrozytenvolumen'), 'L', 2),
    S('blood', 'EPO', 'EPO', L('Erythropoietin', 'Erythropoetin'), 'U/L', 0),
    S('blood', 'retic', 'retic', L('Reticulocytes', 'Retikulozyten'), '%', 1),
    S('blood', 'MCV', 'MCV', L('Mean cell volume', 'Mittleres Erythrozytenvolumen'), 'fL', 0),
    S('blood', 'Fe', 'Fe_{store}', L('Storage iron', 'Speichereisen'), 'mg', 0),
    S('blood', 'ferritin', 'ferritin', L('Ferritin', 'Ferritin'), 'µg/L', 0),
    S('blood', 'bilirubin', '[bili]', L('Bilirubin (from broken-down haem)', 'Bilirubin (aus abgebautem Häm)'), 'µmol/L', 0),
  ],
  equations: [
    eq('rbc', 'textbook', L('Red cells: made, destroyed, lost', 'Erythrozyten: gebildet, abgebaut, verloren'),
      [{ text: 'd(V_RBC)/dt' }], [{ text: 'P₀' }, '·', { fn: 'min', args: [{ text: '6·marrow' }, ',', v('EPO'), '/10'] }, '·', { text: 'iron' }, '−', frac([v('RCV')], ['120 d']), '·', paren('1', '+', '4', '·', v('haemolysis')), '−', { text: 'bleeding' }],
      L('In health production equals destruction, about 20 mL of red cells a day. The marrow can raise output about six-fold if erythropoietin and iron allow; without iron it cannot raise it at all.',
        'Gesund gleicht die Bildung den Abbau aus, etwa 20 ml Erythrozyten am Tag. Das Mark kann seine Leistung etwa versechsfachen, wenn Erythropoetin und Eisen es zulassen; ohne Eisen gar nicht.')),
    eq('epo', 'textbook', L('Erythropoietin: the kidney’s oxygen sensor', 'Erythropoetin: der Sauerstoffsensor der Niere'),
      [v('EPO')], ['10', '·', { sup: [[{ text: 'N' }], ['0.8']] }, '·', { sup: [['e'], ['4·(1 − Hb/Hb₀ · SaO₂/0.97)']] }],
      L('Falls in haemoglobin or saturation raise it exponentially; chronic kidney disease (fewer nephrons, N) blunts it, hence the normocytic anaemia of CKD; chronic hypoxaemia (COPD) raises the red cell mass.',
        'Sinkt Hämoglobin oder Sättigung, steigt es exponentiell; die chronische Niereninsuffizienz (weniger Nephrone, N) dämpft es — daher die normozytäre renale Anämie; chronische Hypoxämie (COPD) erhöht die Erythrozytenmasse.')),
    eq('iron', 'textbook', L('Iron: a closed loop with a small leak', 'Eisen: ein geschlossener Kreislauf mit kleinem Leck'),
      [{ text: 'd(Fe)/dt' }], [{ text: '1.1 mg/mL' }, '·', paren({ text: 'destroyed' }, '−', { text: 'made' }), '+', { text: 'absorbed' }, '−', { text: '1 mg/day' }, '−', { text: '1.1 mg/mL · cells bled' }],
      L('Bleeding is the only way to lose much iron: 10 mL of blood a day is about 5 mg, more than can be absorbed. Inflammation raises hepcidin, which locks iron in macrophages and blocks absorption: the anaemia of chronic disease, with ferritin normal or high.',
        'Blutung ist der einzige Weg, viel Eisen zu verlieren: 10 ml Blut am Tag sind etwa 5 mg, mehr als resorbiert werden kann. Entzündung erhöht Hepcidin, das Eisen in Makrophagen festhält und die Resorption blockiert: die Anämie der chronischen Erkrankung, mit normalem oder hohem Ferritin.')),
  ],
  values: (ctx) => {
    const b = bod(ctx);
    return { ...Object.fromEntries(Object.entries(ctx.model.body)),
      Hb: bn(ctx, 'haemoglobin'), RCV: bn(ctx, 'bloodVolume') * bn(ctx, 'haematocrit') / 1000, EPO: bn(ctx, 'epo'), retic: bn(ctx, 'reticulocytes'), MCV: bn(ctx, 'mcv'),
      Fe: bn(ctx, 'ironStores'), ferritin: bn(ctx, 'ferritin'), bilirubin: b.bilirubin };
  },
  diagram: 'blood',
  sources: ['Hillman RS, Finch CA. Red Cell Manual, 7th ed. 1996.', 'Camaschella C. Iron-deficiency anemia. N Engl J Med 2015;372:1832–43.', 'Jelkmann W. Regulation of erythropoietin production. J Physiol 2011;589:1251–8.', 'Weiss G, Ganz T, Goodnough LT. Anemia of inflammation. Blood 2019;133:40–50.'],
};

const LIVER: ModelDef = {
  id: 'liver', title: L('The liver', 'Die Leber'),
  summary: L('The liver conjugates bilirubin and excretes it into bile, makes albumin and clotting factors, turns gut ammonia into urea, makes glucose and clears lactate. A failing liver shows in each: jaundice (unconjugated if it cannot conjugate, conjugated if bile cannot leave), a low albumin (half-life about 20 days, so a late sign), a long prothrombin time (factor VII has a half-life of 6 hours, so an early one), ammonia reaching the brain (encephalopathy, asterixis), hypoglycaemia. Scarring raises portal pressure: the spleen enlarges and holds platelets, splanchnic vessels dilate, the kidney senses an underfilled circulation and holds sodium and water, which collect as ascites.',
    'Die Leber konjugiert Bilirubin und scheidet es in die Galle aus, bildet Albumin und Gerinnungsfaktoren, wandelt Ammoniak aus dem Darm in Harnstoff um, bildet Glukose und klärt Laktat. Eine versagende Leber zeigt sich in jedem davon: Ikterus (unkonjugiert, wenn sie nicht konjugieren kann, konjugiert, wenn die Galle nicht abfließt), niedriges Albumin (Halbwertszeit etwa 20 Tage, ein spätes Zeichen), verlängerte Prothrombinzeit (Faktor VII hat 6 Stunden Halbwertszeit, ein frühes), Ammoniak, das ins Gehirn gelangt (Enzephalopathie, Flapping Tremor), Hypoglykämie. Vernarbung erhöht den Pfortaderdruck: Die Milz vergrößert sich und hält Thrombozyten zurück, Splanchnikusgefäße weiten sich, die Niere sieht einen unterfüllten Kreislauf und hält Natrium und Wasser zurück, die sich als Aszites sammeln.'),
  groups: [{ id: 'liver', label: L('Liver', 'Leber') }, { id: 'drugs', label: L('Alcohol and drugs', 'Alkohol und Medikamente') }],
  variables: [
    BP('liver', 'liver', 'liverFunction', 'LF', L('Working liver (cirrhosis, acute failure)', 'Funktionierende Leber (Zirrhose, akutes Versagen)'), '× normal', 0.05, 1.2, 0.05),
    BP('liver', 'liver', 'portalHypertension', 'P_{portal}', L('Portal hypertension', 'Portale Hypertension'), '0–1', 0, 1, 0.05),
    BP('liver', 'liver', 'hepatitis', 'hep', L('Hepatocyte necrosis (hepatitis)', 'Leberzellnekrose (Hepatitis)'), '0–1', 0, 1, 0.05),
    BP('liver', 'liver', 'cholestasis', 'chol', L('Bile outflow blocked', 'Gallenabfluss behindert'), '0–1', 0, 1, 0.05),
    BP('liver', 'drugs', 'alcohol', 'EtOH', L('Heavy drinking', 'Schwerer Alkoholkonsum'), '0–1', 0, 1, 0.05),
    BP('liver', 'drugs', 'anticoagulant', 'VKA', L('Vitamin K antagonist', 'Vitamin-K-Antagonist'), '0–1', 0, 1, 0.05),
    S('liver', 'bilirubin', '[bili]', L('Bilirubin, total', 'Bilirubin, gesamt'), 'µmol/L', 0),
    S('liver', 'bilirubinConjugated', '[bili_c]', L('Bilirubin, conjugated', 'Bilirubin, konjugiert'), 'µmol/L', 0),
    S('liver', 'alt', 'ALT', L('Alanine aminotransferase', 'Alanin-Aminotransferase'), 'U/L', 0),
    S('liver', 'alp', 'ALP', L('Alkaline phosphatase', 'Alkalische Phosphatase'), 'U/L', 0),
    S('liver', 'ggt', 'GGT', L('γ-glutamyl transferase', 'γ-Glutamyltransferase'), 'U/L', 0),
    S('liver', 'albumin', '[alb]', L('Albumin', 'Albumin'), 'g/L', 0),
    S('liver', 'inr', 'INR', L('Prothrombin time (INR)', 'Prothrombinzeit (INR)'), '', 2),
    S('liver', 'ammonia', '[NH_3]', L('Ammonia', 'Ammoniak'), 'µmol/L', 0),
    S('liver', 'encephalopathy', 'HE', L('Encephalopathy (West Haven grade)', 'Enzephalopathie (West-Haven-Grad)'), '0–4', 1),
    S('liver', 'ascites', 'V_{asc}', L('Ascites', 'Aszites'), 'L', 1),
    S('liver', 'platelets', 'plt', L('Platelets', 'Thrombozyten'), '10⁹/L', 0),
  ],
  equations: [
    eq('bili', 'textbook', L('Bilirubin: made from haem, conjugated, excreted in bile', 'Bilirubin: aus Häm gebildet, konjugiert, mit der Galle ausgeschieden'),
      [{ text: 'd(bili_u)/dt' }], [{ text: 'haem broken down' }, '−', '0.175', '·', { sup: [[v('liverFunction')], ['1.5']] }, '·', { text: 'bili_u' }],
      L('More haem (haemolysis) or less conjugation (a failing liver, Gilbert’s) raises unconjugated bilirubin, which is bound to albumin and never reaches the urine. A blocked duct raises conjugated bilirubin, which does: dark urine, pale stools, itching.',
        'Mehr Häm (Hämolyse) oder weniger Konjugation (versagende Leber, Gilbert) erhöht das unkonjugierte Bilirubin, das an Albumin gebunden ist und nie in den Urin gelangt. Ein verschlossener Gallengang erhöht das konjugierte Bilirubin, das es tut: dunkler Urin, heller Stuhl, Juckreiz.')),
    eq('inr', 'textbook', L('Clotting factors: the liver’s fastest clock', 'Gerinnungsfaktoren: die schnellste Uhr der Leber'),
      [v('inr')], ['1', '+', '2.4', '·', { sup: [[paren('1', '−', v('liverFunction'))], ['1.3']] }, '+', '0.5', '·', v('cholestasis'), '+', '2', '·', v('anticoagulant')],
      L('Factor VII lasts hours, so the INR rises within a day of liver failure; cholestasis lengthens it by blocking vitamin K absorption (corrected by vitamin K, unlike liver failure).',
        'Faktor VII hält Stunden, daher steigt der INR binnen eines Tages nach Leberversagen; Cholestase verlängert ihn durch gestörte Vitamin-K-Aufnahme (anders als beim Leberversagen durch Vitamin K korrigierbar).')),
    eq('nh3', 'textbook', L('Ammonia: made in the gut, cleared by the liver', 'Ammoniak: im Darm gebildet, von der Leber geklärt'),
      [v('ammonia')], ['30', '·', frac([{ text: 'protein + blood in the gut' }], [{ sup: [[paren(v('liverFunction'), '·', paren('1', '−', '0.6', '·', v('portalHypertension')), '+', '0.12')], ['1.2']] }])],
      L('Portal hypertension shunts gut blood past the liver. A GI bleed (a protein meal), constipation, infection, hypokalaemia and sedatives precipitate encephalopathy in cirrhosis.',
        'Die portale Hypertension leitet Darmblut an der Leber vorbei. Gastrointestinale Blutung (eine Eiweißmahlzeit), Obstipation, Infektion, Hypokaliämie und Sedativa lösen bei Zirrhose eine Enzephalopathie aus.')),
    eq('ascites', 'textbook', L('Ascites: fluid the circulation cannot use', 'Aszites: Flüssigkeit, die der Kreislauf nicht nutzen kann'),
      [v('ascites')], ['8', '·', { sup: [[v('portalHypertension')], ['2']] }, '·', paren('1', '−', v('liverFunction')), '·', { sup: [[paren(frac(['42'], [v('albumin')]))], ['0.5']] }],
      L('Portal pressure and low albumin push fluid into the peritoneum; the kidney, sensing an underfilled circulation (splanchnic vasodilatation), holds sodium until the volume it can sense is restored, and the ascites is the rest. Urine sodium falls below 10 mmol/L.',
        'Pfortaderdruck und niedriges Albumin drücken Flüssigkeit in die Bauchhöhle; die Niere, die einen unterfüllten Kreislauf wahrnimmt (Splanchnikusvasodilatation), hält Natrium zurück, bis das wahrnehmbare Volumen ersetzt ist — der Aszites ist der Rest. Das Urinnatrium fällt unter 10 mmol/l.')),
  ],
  values: (ctx) => ({
    ...Object.fromEntries(Object.entries(ctx.model.body)),
    bilirubin: bn(ctx, 'bilirubin'), bilirubinConjugated: bn(ctx, 'bilirubinConjugated'), alt: bn(ctx, 'alt'), alp: bn(ctx, 'alp'), ggt: bn(ctx, 'ggt'),
    albumin: bn(ctx, 'albumin'), inr: bn(ctx, 'inr'), ammonia: bn(ctx, 'ammonia'), encephalopathy: bn(ctx, 'encephalopathy'), ascites: bn(ctx, 'ascites'), platelets: bn(ctx, 'platelets'),
  }),
  diagram: 'liver',
  sources: ['Ginès P et al. Liver cirrhosis. Lancet 2021;398:1359–76.', 'Schrier RW et al. Peripheral arterial vasodilation hypothesis: a proposal for the initiation of renal sodium and water retention in cirrhosis. Hepatology 1988;8:1151–7.', 'Wijdicks EFM. Hepatic encephalopathy. N Engl J Med 2016;375:1660–70.', 'Fevery J. Bilirubin in clinical practice: a review. Liver Int 2008;28:592–605.'],
};

const INFLAMMATION: ModelDef = {
  id: 'inflammation', title: L('Infection, inflammation and fever', 'Infektion, Entzündung und Fieber'),
  summary: L('A bacterial infection releases cytokines (interleukin-1, -6, tumour necrosis factor). They reset the hypothalamic thermostat upward (fever, reached by shivering and vasoconstriction: rigors), raise the metabolic rate, release neutrophils from the marrow and make the liver produce acute-phase proteins such as CRP, which rises over a day or two and falls with a half-life of about 19 hours. When the response is large enough to injure the host’s own organs, it is sepsis: nitric oxide dilates arterioles and veins (low resistance, a bounding pulse, warm peripheries), capillaries leak albumin and water into the tissues, the heart is depressed, the kidney fails, lactate rises and platelets are consumed. Septic shock is hypotension that fluid alone does not correct.',
    'Eine bakterielle Infektion setzt Zytokine frei (Interleukin-1, -6, Tumornekrosefaktor). Sie stellen den hypothalamischen Thermostat höher (Fieber, erreicht durch Kältezittern und Vasokonstriktion: Schüttelfrost), steigern den Stoffwechsel, mobilisieren Neutrophile aus dem Knochenmark und lassen die Leber Akute-Phase-Proteine wie CRP bilden, das über ein, zwei Tage ansteigt und mit einer Halbwertszeit von etwa 19 Stunden abfällt. Schädigt die Antwort die eigenen Organe, ist es eine Sepsis: Stickstoffmonoxid weitet Arteriolen und Venen (niedriger Widerstand, hebender Puls, warme Peripherie), Kapillaren lassen Albumin und Wasser ins Gewebe, das Herz wird gedämpft, die Niere versagt, Laktat steigt, Thrombozyten werden verbraucht. Der septische Schock ist eine Hypotonie, die Flüssigkeit allein nicht behebt.'),
  groups: [{ id: 'infection', label: L('Infection', 'Infektion') }],
  variables: [
    BP('inflammation', 'infection', 'infection', 'inf', L('Bacterial infection (0.3 local, 0.6 systemic, 0.9 overwhelming)', 'Bakterielle Infektion (0,3 lokal, 0,6 systemisch, 0,9 überwältigend)'), '0–1', 0, 1, 0.05),
    BP('inflammation', 'infection', 'urinarySource', 'UTI', L('Source in the urinary tract', 'Fokus in den Harnwegen'), '0/1', 0, 1, 1),
    S('inflammation', 'IL', 'IL', L('Inflammatory signal (cytokines)', 'Entzündungssignal (Zytokine)'), '× systemic', 2),
    S('inflammation', 'Tset', 'T_{set}', L('Hypothalamic set point', 'Hypothalamischer Sollwert'), '°C', 1),
    S('inflammation', 'T', 'T', L('Core temperature', 'Kerntemperatur'), '°C', 1),
    S('inflammation', 'crp', '[CRP]', L('C-reactive protein', 'C-reaktives Protein'), 'mg/L', 0),
    S('inflammation', 'wcc', 'WCC', L('White cell count', 'Leukozyten'), '10⁹/L', 1),
    S('inflammation', 'platelets', 'plt', L('Platelets', 'Thrombozyten'), '10⁹/L', 0),
    S('inflammation', 'sepsis', 'σ_{sepsis}', L('Organ dysfunction (sepsis)', 'Organdysfunktion (Sepsis)'), '0–1', 2),
    S('inflammation', 'vaso', 'NO', L('Vasodilatation (fraction of resistance lost)', 'Vasodilatation (verlorener Widerstandsanteil)'), '', 2),
    S('inflammation', 'SVR', 'SVR', L('Systemic vascular resistance', 'Systemischer Gefäßwiderstand'), 'dyn·s/cm⁵', 0),
    S('inflammation', 'MAP', 'MAP', L('Mean arterial pressure', 'Arterieller Mitteldruck'), 'mmHg', 0),
    S('inflammation', 'lactate', '[lac]', L('Lactate', 'Laktat'), 'mmol/L', 1),
  ],
  equations: [
    eq('il', 'textbook', L('The response: cytokines follow the infection', 'Die Antwort: Zytokine folgen der Infektion'),
      [v('IL')], ['2.2', '·', { sup: [[v('infection')], ['1.5']] }, { text: '  (settling over about 4 h)' }],
      L('A local infection (a cellulitis, a cystitis) gives a little; a bacteraemia a lot. The steepness is the point: beyond a threshold the host’s response, not the organism, does the damage.',
        'Eine lokale Infektion (Erysipel, Zystitis) gibt wenig, eine Bakteriämie viel. Die Steilheit ist der Punkt: Jenseits einer Schwelle richtet die Antwort des Wirts, nicht der Erreger, den Schaden an.')),
    eq('fever', 'textbook', L('Fever: the thermostat reset', 'Fieber: der verstellte Thermostat'),
      [v('Tset')], ['36.9', '+', '2.6', '·', frac([v('IL')], [v('IL'), '+', '0.6'])],
      L('Fever is regulated, not a failure of regulation: the body heats itself to a higher set point (shivering, skin vasoconstriction: rigors) and sweats when it falls. Each degree raises the metabolic rate about 10 %, the heart rate about 10/min and the insensible water loss. In overwhelming sepsis with shock the temperature can fall instead, a bad sign.',
        'Fieber ist geregelt, kein Versagen der Regulation: Der Körper heizt sich auf einen höheren Sollwert (Kältezittern, Hautvasokonstriktion: Schüttelfrost) und schwitzt, wenn er fällt. Jedes Grad steigert den Stoffwechsel um etwa 10 %, die Herzfrequenz um etwa 10/min und die Perspiratio. Bei überwältigender Sepsis mit Schock kann die Temperatur stattdessen fallen, ein schlechtes Zeichen.')),
    eq('crp', 'textbook', L('CRP: made by the liver, cleared with a half-life of 19 h', 'CRP: von der Leber gebildet, mit 19 h Halbwertszeit geklärt'),
      [{ text: 'd(CRP)/dt' }], ['8', '·', v('IL'), '−', frac([{ text: 'ln 2' }], ['19 h']), '·', v('crp')],
      L('CRP lags: twelve hours into an infection it may still be modest, and it keeps rising for a day after the infection is controlled. A white cell count moves within hours.',
        'Das CRP hinkt hinterher: Zwölf Stunden nach Beginn einer Infektion kann es noch mäßig sein, und es steigt noch einen Tag weiter, nachdem die Infektion beherrscht ist. Die Leukozyten ändern sich innerhalb von Stunden.')),
    eq('vaso', 'textbook', L('Septic shock: lost resistance', 'Septischer Schock: verlorener Widerstand'),
      [v('SVR')], [{ text: 'SVR₀' }, '·', paren('1', '−', '0.55', '·', v('vaso')), '·', { text: 'AngII, ADH' }],
      L('Nitric oxide relaxes vascular smooth muscle: resistance falls, the veins hold more blood, and the pressure falls with a high or normal cardiac output. Leaking capillaries shrink the plasma. Fluid refills the veins; a vasoconstrictor (noradrenaline) restores the resistance.',
        'Stickstoffmonoxid entspannt die glatte Gefäßmuskulatur: Der Widerstand fällt, die Venen fassen mehr Blut, und der Druck fällt bei hohem oder normalem Herzzeitvolumen. Undichte Kapillaren verkleinern das Plasma. Flüssigkeit füllt die Venen wieder; ein Vasokonstriktor (Noradrenalin) stellt den Widerstand wieder her.')),
  ],
  values: (ctx) => {
    const b = bod(ctx);
    const IL = typeof b.inflammation === 'number' ? b.inflammation : NaN;
    return {
      ...Object.fromEntries(Object.entries(ctx.model.body)),
      IL, Tset: 36.9 + 2.6 * IL / (IL + 0.6), T: bn(ctx, 'temperature'), crp: bn(ctx, 'crp'), wcc: bn(ctx, 'whiteCellCount'), platelets: bn(ctx, 'platelets'),
      sepsis: bn(ctx, 'sepsis'), vaso: bn(ctx, 'vasoplegia'), SVR: metric(ctx, 'SVR'), MAP: metric(ctx, 'Pmean'), lactate: bn(ctx, 'lactate'),
    };
  },
  diagram: 'inflammation',
  sources: ['Singer M et al. The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA 2016;315:801–10.', 'Dinarello CA. Cytokines as endogenous pyrogens. J Infect Dis 1999;179 Suppl 2:S294–304.', 'Vigushin DM, Pepys MB, Hawkins PN. Metabolic and scintigraphic studies of radioiodinated human C-reactive protein in health and disease. J Clin Invest 1993;91:1351–7.', 'Landry DW, Oliver JA. The pathogenesis of vasodilatory shock. N Engl J Med 2001;345:588–95.'],
};

const ENDOCRINE: ModelDef = {
  id: 'endocrine', title: L('Hormones: thyroid, adrenal cortex and calcium', 'Hormone: Schilddrüse, Nebennierenrinde und Calcium'),
  summary: L('Three negative feedback loops. The pituitary’s TSH drives the thyroid; thyroxine suppresses TSH, so steeply that TSH is the sensitive test: it moves a hundred-fold for a two-fold change in free T4. Thyroid hormone sets the metabolic rate, the heart rate and the response to adrenaline, and makes the body hot and the vessels wide. ACTH drives cortisol and cortisol suppresses ACTH; illness drives ACTH up. Cortisol keeps glucose made, keeps vessels responsive to noradrenaline and restrains ADH; the adrenal cortex also makes aldosterone, under angiotensin and potassium rather than ACTH. Destroy the adrenal glands (Addison’s disease) and both go: salt and water are lost, potassium is kept, the blood pressure falls and does not answer to fluid alone until cortisol is given. Parathyroid hormone answers to the ionised calcium within minutes: it releases calcium from bone, keeps it in the kidney, has phosphate excreted and, through calcitriol, absorbed from the gut. A tumour’s PTH-related peptide does the same with no one to switch it off; a high calcium then blocks the kidney’s concentrating ability, the patient becomes dry, filters less, and the calcium climbs further.',
    'Drei negative Rückkopplungsschleifen. TSH aus der Hypophyse treibt die Schilddrüse; Thyroxin hemmt TSH, und zwar so steil, dass TSH der empfindliche Test ist: Es ändert sich hundertfach bei einer Verdopplung des freien T4. Schilddrüsenhormon stellt den Grundumsatz, die Herzfrequenz und die Antwort auf Adrenalin ein, macht warm und weitet die Gefäße. ACTH treibt Cortisol, Cortisol hemmt ACTH; Krankheit treibt ACTH hoch. Cortisol hält die Glukoseproduktion aufrecht, hält die Gefäße für Noradrenalin empfindlich und bremst ADH; die Nebennierenrinde bildet außerdem Aldosteron — unter Angiotensin und Kalium, nicht unter ACTH. Werden die Nebennieren zerstört (Morbus Addison), fällt beides aus: Salz und Wasser gehen verloren, Kalium bleibt, der Blutdruck fällt und spricht auf Volumen allein nicht an, bis Cortisol gegeben wird. Parathormon antwortet binnen Minuten auf das ionisierte Calcium: Es setzt Calcium aus dem Knochen frei, hält es in der Niere zurück, lässt Phosphat ausscheiden und über Calcitriol Calcium aus dem Darm aufnehmen. Das PTH-related Peptide eines Tumors tut dasselbe, ohne dass es jemand abschaltet; ein hohes Calcium blockiert dann die Konzentrierfähigkeit der Niere, der Patient trocknet aus, filtriert weniger, und das Calcium steigt weiter.'),
  groups: [
    { id: 'thyroid', label: L('Thyroid', 'Schilddrüse') },
    { id: 'adrenal', label: L('Adrenal cortex and pituitary', 'Nebennierenrinde und Hypophyse') },
    { id: 'calcium', label: L('Calcium and bone', 'Calcium und Knochen') },
  ],
  variables: [
    BP('endocrine', 'thyroid', 'thyroidGland', 'G_{thy}', L('Thyroid tissue able to make hormone (Hashimoto, thyroidectomy, radioiodine)', 'Hormonbildendes Schilddrüsengewebe (Hashimoto, Thyreoidektomie, Radiojod)'), '× normal', 0, 3, 0.02),
    BP('endocrine', 'thyroid', 'thyroidStimulation', 'TRAb', L('TSH-receptor antibodies driving the gland (Graves’ disease)', 'TSH-Rezeptor-Antikörper, die die Drüse antreiben (Morbus Basedow)'), '0–1', 0, 1.5, 0.05),
    BP('endocrine', 'thyroid', 'orbitopathy', 'orb', L('Thyroid eye disease (Graves’ orbitopathy)', 'Endokrine Orbitopathie'), '0–1', 0, 1, 0.05),
    BP('endocrine', 'thyroid', 'antithyroid', 'CBZ', L('Antithyroid drug (carbimazole, thiamazole)', 'Thyreostatikum (Carbimazol, Thiamazol)'), '0–1', 0, 1, 0.05),
    BP('endocrine', 'thyroid', 'thyroxineDose', 'L-T4', L('Levothyroxine', 'Levothyroxin'), 'µg/day', 0, 300, 12.5),
    BP('endocrine', 'adrenal', 'pituitary', 'P', L('Anterior pituitary reserve (TSH, ACTH)', 'Hypophysenvorderlappen-Reserve (TSH, ACTH)'), '× normal', 0, 1.5, 0.05),
    BP('endocrine', 'adrenal', 'adrenalFunction', 'A', L('Adrenal cortex (Addison’s disease destroys it)', 'Nebennierenrinde (beim Morbus Addison zerstört)'), '× normal', 0, 2, 0.01),
    BP('endocrine', 'adrenal', 'hydrocortisoneDose', 'HC', L('Hydrocortisone (20 mg/day replaces normal secretion)', 'Hydrocortison (20 mg/Tag ersetzen die normale Sekretion)'), 'mg/day', 0, 400, 5),
    BP('endocrine', 'adrenal', 'fludrocortisone', 'FC', L('Fludrocortisone (0.1 mg/day replaces aldosterone)', 'Fludrocortison (0,1 mg/Tag ersetzen Aldosteron)'), 'mg/day', 0, 0.4, 0.05),
    BP('endocrine', 'calcium', 'pthAutonomy', 'PTH_{aut}', L('Parathyroid adenoma (PTH calcium cannot suppress)', 'Nebenschilddrüsenadenom (durch Calcium nicht supprimierbares PTH)'), '0–1', 0, 3, 0.05),
    BP('endocrine', 'calcium', 'pthrp', 'PTHrP', L('PTH-related peptide from a tumour', 'PTH-related Peptide aus einem Tumor'), '0–1', 0, 2, 0.05),
    BP('endocrine', 'calcium', 'boneResorption', 'OL', L('Osteolysis (bone metastases, myeloma)', 'Osteolyse (Knochenmetastasen, Myelom)'), '0–1', 0, 2, 0.05),
    BP('endocrine', 'calcium', 'vitaminD', 'D', L('Vitamin D status', 'Vitamin-D-Status'), '× normal', 0, 3, 0.05),
    BP('endocrine', 'calcium', 'bisphosphonate', 'BP', L('Bisphosphonate (osteoclasts blocked)', 'Bisphosphonat (Osteoklasten gehemmt)'), '0–1', 0, 1, 0.05),
    S('endocrine', 'tsh', 'TSH', L('TSH', 'TSH'), 'mU/L', 2),
    S('endocrine', 'ft4', 'fT_4', L('Free thyroxine', 'Freies Thyroxin'), 'pmol/L', 1),
    S('endocrine', 'thyroidEffect', 'f_{thy}', L('Thyroid hormone action', 'Schilddrüsenhormonwirkung'), '× normal', 2),
    S('endocrine', 'metabolicMult', 'BMR', L('Basal metabolic rate', 'Grundumsatz'), '× normal', 2),
    S('endocrine', 'hrMult', 'f_{HR}', L('Sinus rate set by thyroid hormone', 'Sinusfrequenz durch Schilddrüsenhormon'), '× normal', 2),
    S('endocrine', 'acth', 'ACTH', L('ACTH', 'ACTH'), 'ng/L', 0),
    S('endocrine', 'cortisol', '[cortisol]', L('Cortisol', 'Cortisol'), 'nmol/L', 0),
    S('endocrine', 'cortisolDeficit', 'δ_{cort}', L('Cortisol missing for what the illness demands', 'Fehlendes Cortisol für den Bedarf der Erkrankung'), '0–1', 2),
    S('endocrine', 'renin', 'renin', L('Renin', 'Renin'), '× normal', 1),
    S('endocrine', 'aldosterone', 'Aldo', L('Aldosterone', 'Aldosteron'), 'pmol/L', 0),
    S('endocrine', 'calcium', '[Ca]_{adj}', L('Calcium (albumin-adjusted)', 'Calcium (albuminkorrigiert)'), 'mmol/L', 2),
    S('endocrine', 'ionisedCalcium', '[Ca^{2+}]', L('Ionised calcium', 'Ionisiertes Calcium'), 'mmol/L', 2),
    S('endocrine', 'pth', 'PTH', L('Parathyroid hormone', 'Parathormon'), 'pmol/L', 1),
    S('endocrine', 'phosphate', '[PO_4]', L('Phosphate', 'Phosphat'), 'mmol/L', 2),
    S('endocrine', 'GFR', 'GFR', L('Glomerular filtration rate', 'Glomeruläre Filtrationsrate'), 'mL/min', 0),
  ],
  equations: [
    eq('tsh', 'textbook', L('TSH: the steep feedback', 'TSH: die steile Rückkopplung'),
      [v('tsh')], [String(THY.tshNormal), '·', v('pituitary'), '·', { sup: [['10'], [`−${THY.tshLogSlope}·(fT₄/${THY.ft4Normal} − 1)`]] }],
      L('Inverse log-linear (Spencer 1990): halve the free T4 and TSH rises about 13-fold; double it and TSH falls about 180-fold, below the limit of detection. A low TSH with a high T4 is primary hyperthyroidism; a high TSH with a low T4 primary hypothyroidism; both low, the pituitary. Severe illness lowers TSH without thyroid disease.',
        'Invers log-linear (Spencer 1990): Halbiert sich das freie T4, steigt TSH etwa 13-fach; verdoppelt es sich, fällt TSH etwa 180-fach, unter die Nachweisgrenze. Niedriges TSH mit hohem T4 ist eine primäre Hyperthyreose, hohes TSH mit niedrigem T4 eine primäre Hypothyreose, beide niedrig: die Hypophyse. Schwere Krankheit senkt TSH ohne Schilddrüsenerkrankung.')),
    eq('t4', 'textbook', L('Thyroxine: TSH, antibodies, tablets', 'Thyroxin: TSH, Antikörper, Tabletten'),
      [v('ft4')], [String(THY.ft4Normal), '·', v('thyroidGland'), '·', { sup: [[paren(frac([v('tsh')], [String(THY.tshNormal)]))], [String(THY.glandTshExponent)]] }, '+', String(THY.gravesDrive), '·', v('thyroidStimulation'), '+', { text: 'levothyroxine' }],
      L('Graves’ antibodies stimulate the TSH receptor themselves, so the gland runs with TSH suppressed. A failing gland is driven harder by TSH, so T4 is held near normal at first (subclinical hypothyroidism: TSH high, T4 normal). Thyroxine’s half-life is a week: a dose change shows in six weeks.',
        'Basedow-Antikörper stimulieren den TSH-Rezeptor selbst, daher läuft die Drüse bei supprimiertem TSH. Eine versagende Drüse wird von TSH stärker angetrieben, sodass das T4 anfangs nahezu normal bleibt (latente Hypothyreose: TSH hoch, T4 normal). Thyroxin hat eine Halbwertszeit von einer Woche: Eine Dosisänderung zeigt sich nach sechs Wochen.')),
    eq('cort', 'textbook', L('Cortisol: ACTH, and the demand of illness', 'Cortisol: ACTH und der Bedarf der Krankheit'),
      [v('acth')], [v('pituitary'), '·', paren('1', '+', '4', '·', { text: 'stress' }), '·', { sup: [[{ text: 'cortisol' }], ['−1.5']] }],
      L('Illness drives ACTH and cortisol up two- to three-fold. A patient without adrenal glands cannot respond: a cortisol that would be adequate at rest is a deficit in illness, and a gastroenteritis becomes an adrenal crisis. ACTH, made from the same precursor as melanocyte-stimulating hormone, darkens the skin in primary adrenal failure, not in pituitary failure.',
        'Krankheit treibt ACTH und Cortisol auf das Zwei- bis Dreifache. Ein Patient ohne Nebennieren kann nicht antworten: Ein Cortisol, das in Ruhe genügt, ist bei Krankheit ein Mangel — eine Gastroenteritis wird zur Addison-Krise. ACTH, aus derselben Vorstufe wie das melanozytenstimulierende Hormon, dunkelt die Haut beim primären Nebennierenversagen, nicht beim hypophysären.')),
    eq('ca', 'textbook', L('Calcium: gut, bone and kidney', 'Calcium: Darm, Knochen und Niere'),
      [{ text: 'd(Ca)/dt' }], [{ text: 'gut (calcitriol)' }, '+', { text: 'bone (PTH, PTHrP, metastases)' }, '−', v('GFR'), '·', { text: '0.6·Ca' }, '·', { text: 'FE_Ca' }],
      L('Normally the kidney excretes the 5 mmol a day the gut absorbs. PTH raises all three: more absorbed, more released from bone, less excreted; calcium settles where excretion again matches input. Bone resorption from a tumour has to be excreted by the kidney, which can only do so by letting the calcium rise; a dry patient filtering less settles higher still. Saline (sodium drags calcium out) and bisphosphonates (stop the bone) treat it.',
        'Normalerweise scheidet die Niere die 5 mmol am Tag aus, die der Darm aufnimmt. PTH steigert alle drei: mehr aufgenommen, mehr aus dem Knochen freigesetzt, weniger ausgeschieden; das Calcium stellt sich dort ein, wo Ausscheidung und Zufuhr wieder gleich sind. Knochenabbau durch einen Tumor muss die Niere ausscheiden, und das kann sie nur, indem das Calcium steigt; ein exsikkierter Patient, der weniger filtriert, stellt sich noch höher ein. Kochsalz (Natrium zieht Calcium mit) und Bisphosphonate (stoppen den Knochenabbau) behandeln es.')),
    eq('pth', 'textbook', L('PTH: a calcium sensor', 'PTH: ein Calciumsensor'),
      [v('pth')], [String(+(CA.pthMinFold * CA.pthNormal).toFixed(2)), '+', frac([String(+((CA.pthMaxFold - CA.pthMinFold) * CA.pthNormal).toFixed(2))], ['1', '+', { sup: [[paren(frac([{ text: '[Ca²⁺]' }], [String(CA.pthSetPoint)]))], [String(CA.pthSlope)]] }]), '+', String(CA.adenomaPth), '·', v('pthAutonomy')],
      L('A high calcium with a PTH that is not suppressed is primary hyperparathyroidism; with a suppressed PTH it is something else: malignancy (PTHrP, bone metastases), vitamin D, granulomas, thyrotoxicosis. A low calcium with a high PTH is vitamin D deficiency or kidney failure (secondary hyperparathyroidism).',
        'Ein hohes Calcium mit nicht supprimiertem PTH ist ein primärer Hyperparathyreoidismus; mit supprimiertem PTH etwas anderes: Malignom (PTHrP, Knochenmetastasen), Vitamin D, Granulome, Hyperthyreose. Ein niedriges Calcium mit hohem PTH ist ein Vitamin-D-Mangel oder Nierenversagen (sekundärer Hyperparathyreoidismus).')),
  ],
  values: (ctx) => {
    const b = bod(ctx);
    return {
      ...Object.fromEntries(Object.entries(ctx.model.body)),
      tsh: bn(ctx, 'tsh'), ft4: bn(ctx, 'ft4'), thyroidEffect: bn(ctx, 'thyroidEffect'), metabolicMult: bn(ctx, 'metabolicMult'), hrMult: bn(ctx, 'hrMult'),
      acth: bn(ctx, 'acth'), cortisol: bn(ctx, 'cortisol'), cortisolDeficit: typeof b.cortisolDeficit === 'number' ? b.cortisolDeficit : NaN, renin: bn(ctx, 'renin'), aldosterone: bn(ctx, 'aldosteronePmol'),
      calcium: bn(ctx, 'calcium'), ionisedCalcium: bn(ctx, 'ionisedCalcium'), pth: bn(ctx, 'pth'), phosphate: bn(ctx, 'phosphate'), GFR: bn(ctx, 'GFR'),
    };
  },
  diagram: 'endocrine',
  constants: ['thyroid', 'adrenal', 'calcium'],
  sources: ['Spencer CA et al. Applications of a new chemiluminometric thyrotropin assay to subnormal measurement. J Clin Endocrinol Metab 1990;70:453–60.', 'Ross DS et al. 2016 American Thyroid Association guidelines for diagnosis and management of hyperthyroidism and other causes of thyrotoxicosis. Thyroid 2016;26:1343–421.', 'Bornstein SR et al. Diagnosis and treatment of primary adrenal insufficiency: an Endocrine Society clinical practice guideline. J Clin Endocrinol Metab 2016;101:364–89.', 'Annane D et al. Critical illness-related corticosteroid insufficiency. Crit Care Med 2017;45:2078–88.', 'Peacock M. Calcium metabolism in health and disease. Clin J Am Soc Nephrol 2010;5 Suppl 1:S23–30.', 'Stewart AF. Hypercalcemia associated with cancer. N Engl J Med 2005;352:373–9.'],
};

/* Values a case may still clamp (no model produces them yet), and potassium and calcium, which the learner may clamp as an experiment. */
const CLAMPS: Array<[string, string, LocalizedText, string, number, number, number]> = [
  ['potassium', 'K^+', L('Potassium', 'Kalium'), 'mmol/L', 1.5, 9, 0.1], ['calcium', 'Ca^{2+}', L('Calcium', 'Kalzium'), 'mmol/L', 1.2, 3.5, 0.02],
  ['magnesium', 'Mg^{2+}', L('Magnesium', 'Magnesium'), 'mmol/L', 0.3, 2, 0.05],
  ['whiteCellCount', 'WCC', L('White cell count', 'Leukozyten'), '10⁹/L', 0.5, 60, 0.1], ['platelets', 'plt', L('Platelets', 'Thrombozyten'), '10⁹/L', 5, 1000, 5],
  ['mcv', 'MCV', L('Mean cell volume', 'Mittleres Erythrozytenvolumen'), 'fL', 60, 120, 1], ['troponin', 'cTn', L('Troponin', 'Troponin'), 'ng/L', 0, 10000, 1],
  ['bnp', 'BNP', L('Natriuretic peptide', 'Natriuretisches Peptid'), 'ng/L', 0, 20000, 10], ['crp', 'CRP', L('C-reactive protein', 'C-reaktives Protein'), 'mg/L', 0, 500, 1],
];
const PLASMA: Array<[string, string, LocalizedText, string, number]> = [
  ['sodium', 'Na^+', L('Sodium', 'Natrium'), 'mmol/L', 0], ['potassium', 'K^+', L('Potassium', 'Kalium'), 'mmol/L', 1], ['chloride', 'Cl^-', L('Chloride', 'Chlorid'), 'mmol/L', 0],
  ['bicarbonate', 'SBC', L('Metabolic bicarbonate (standard bicarbonate)', 'Metabolisches Bikarbonat (Standardbikarbonat)'), 'mmol/L', 1],
  ['lactate', 'lac', L('Lactate', 'Laktat'), 'mmol/L', 1], ['ketones', 'ket', L('Ketoacids (β-hydroxybutyrate and acetoacetate)', 'Ketosäuren (β-Hydroxybutyrat und Acetoacetat)'), 'mmol/L', 1],
  ['glucose', 'glc', L('Glucose', 'Glukose'), 'mmol/L', 1], ['urea', 'urea', L('Urea', 'Harnstoff'), 'mmol/L', 1], ['creatinine', 'crea', L('Creatinine', 'Kreatinin'), 'µmol/L', 0],
  ['albumin', 'alb', L('Albumin', 'Albumin'), 'g/L', 0], ['haemoglobin', 'Hb', L('Haemoglobin', 'Hämoglobin'), 'g/L', 0], ['phosphate', 'PO_4', L('Phosphate', 'Phosphat'), 'mmol/L', 2],
  ['calcium', 'Ca^{2+}', L('Calcium', 'Kalzium'), 'mmol/L', 2], ['magnesium', 'Mg^{2+}', L('Magnesium', 'Magnesium'), 'mmol/L', 2],
  ['whiteCellCount', 'WCC', L('White cell count', 'Leukozyten'), '10⁹/L', 1], ['platelets', 'plt', L('Platelets', 'Thrombozyten'), '10⁹/L', 0], ['mcv', 'MCV', L('Mean cell volume', 'Mittleres Erythrozytenvolumen'), 'fL', 0],
  ['troponin', 'cTn', L('Troponin', 'Troponin'), 'ng/L', 0], ['bnp', 'BNP', L('Natriuretic peptide', 'Natriuretisches Peptid'), 'ng/L', 0], ['crp', 'CRP', L('C-reactive protein', 'C-reaktives Protein'), 'mg/L', 0],
];
const FLUIDS: ModelDef = {
  id: 'fluids', title: L('Potassium and acid–base', 'Kalium und Säure-Basen-Haushalt'),
  summary: L('Two balances the body keeps very tightly. Potassium: about 98 % of it is inside the cells, held there by the Na⁺/K⁺ pump, so the plasma level reflects both how much the body has and how it is shared out (insulin and adrenaline drive it into cells; acidaemia and hypertonicity let it out). Acid: about 70 mmol of fixed acid is made each day (more with ketoacids or lactate), buffered at once by bicarbonate and the cells, and excreted by the kidney as ammonium, which regenerates the bicarbonate. pH is the ratio of what the kidney holds (bicarbonate) to what the lungs hold (CO₂). Chloride is whatever electroneutrality leaves.',
    'Zwei Bilanzen, die der Körper sehr eng hält. Kalium: Etwa 98 % liegen in den Zellen, dort gehalten von der Na⁺/K⁺-Pumpe; der Plasmaspiegel spiegelt also wider, wie viel der Körper hat und wie es verteilt ist (Insulin und Adrenalin treiben es in die Zellen; Azidämie und Hypertonizität lassen es heraus). Säure: Täglich entstehen etwa 70 mmol nichtflüchtige Säure (mehr mit Ketosäuren oder Laktat), sofort von Bikarbonat und den Zellen gepuffert und von der Niere als Ammonium ausgeschieden, was das Bikarbonat erneuert. Der pH ist das Verhältnis dessen, was die Niere hält (Bikarbonat), zu dem, was die Lunge hält (CO₂). Chlorid ist, was die Elektroneutralität übrig lässt.'),
  groups: [
    { id: 'diet', label: L('Diet and toxins', 'Ernährung und Gifte') },
    { id: 'clamp', label: L('Clamp a value (an experiment: held whatever the model does)', 'Wert festhalten (ein Experiment: unabhängig vom Modell gehalten)') },
  ],
  variables: [
    BP('fluids', 'diet', 'potassiumIntake', 'K_{in}', L('Potassium in a full diet', 'Kalium bei voller Kost'), 'mmol/day', 0, 300, 5),
    BP('fluids', 'diet', 'toxicAcid', 'H_{tox}', L('Unmeasured acid (methanol, ethylene glycol, salicylate)', 'Nicht gemessene Säure (Methanol, Ethylenglykol, Salicylat)'), 'mmol/h', 0, 60, 1),
    ...CLAMPS.map(([k, sym, label, unit, min, max, step]) => ({ ...param('fluids', 'clamp', { key: `chemistry.${k}`, symbol: sym, label, unit, min, max, step, digits: step < 0.1 ? 2 : step < 1 ? 1 : 0 }), id: `fluids.clamp-${k}` })),
    ...PLASMA.map(([k, sym, label, unit, digits]) => S('fluids', k, `[${sym}]`, label, unit, digits)),
    S('fluids', 'paCO2', 'P_{aCO2}', L('Arterial CO₂ tension (from the lungs)', 'Arterieller CO₂-Partialdruck (aus der Lunge)'), 'kPa', 2),
    S('fluids', 'hco3', 'HCO_3^-', L('Actual bicarbonate', 'Aktuelles Bikarbonat'), 'mmol/L', 0),
    S('fluids', 'BE', 'BE', L('Base excess', 'Basenüberschuss'), 'mmol/L', 1),
    S('fluids', 'pH', 'pH', L('Arterial pH', 'Arterieller pH'), '', 2),
    S('fluids', 'AG', 'AG', L('Anion gap', 'Anionenlücke'), 'mmol/L', 0),
    S('fluids', 'kRatio', '[K^+]_i/[K^+]_o', L('Potassium inside to outside the cells', 'Kalium innen zu außen'), '', 0),
    S('fluids', 'Kbody', 'K_{body}', L('Body potassium', 'Körperkalium'), 'mmol', 0),
  ],
  equations: [
    eq('hh', 'textbook', L('Henderson–Hasselbalch', 'Henderson-Hasselbalch'),
      [v('pH')], ['6.1', '+', { fn: 'log', args: [frac([v('hco3')], ['0.23', '·', v('paCO2')])] }],
      L('pH depends on the ratio of bicarbonate (kidney) to dissolved CO₂ (lung), not on either alone. Compensation moves the other term to restore the ratio.',
        'Der pH hängt vom Verhältnis Bikarbonat (Niere) zu gelöstem CO₂ (Lunge) ab, nicht von einem allein. Kompensation verschiebt den anderen Term, um das Verhältnis wiederherzustellen.')),
    eq('k', 'textbook', L('Potassium: how much, and where', 'Kalium: wie viel und wo'),
      [v('potassium')], [frac([v('Kbody')], [{ text: 'V_ECF' }, '+', v('kRatio'), '·', { text: 'V_ICF' }])],
      L('The plasma potassium is the body’s potassium shared between a small extracellular and a large intracellular space at the ratio the pump holds (about 35:1). Lack of insulin, acidaemia and hypertonicity lower the ratio: in diabetic ketoacidosis the plasma potassium is high while the body has lost hundreds of millimoles, which insulin then unmasks.',
        'Das Plasmakalium ist das Körperkalium, verteilt auf einen kleinen extrazellulären und einen großen intrazellulären Raum im Verhältnis, das die Pumpe hält (etwa 35:1). Insulinmangel, Azidämie und Hypertonizität senken das Verhältnis: Bei der diabetischen Ketoazidose ist das Plasmakalium hoch, obwohl der Körper Hunderte Millimol verloren hat — was Insulin dann aufdeckt.')),
    eq('ag', 'textbook', L('Anion gap', 'Anionenlücke'),
      [v('AG')], [v('sodium'), '−', paren(v('chloride'), '+', v('hco3'))],
      L('The unmeasured anions: albumin, phosphate, sulfate, and any added lactate, ketoanions or toxin. A raised gap with low bicarbonate means an acid has been added; a normal gap means bicarbonate was lost (diarrhoea) or chloride given (saline). Low albumin lowers the gap.',
        'Die nicht gemessenen Anionen: Albumin, Phosphat, Sulfat und jedes zugeführte Laktat, Ketoanion oder Gift. Eine erhöhte Lücke bei niedrigem Bikarbonat bedeutet zugeführte Säure; eine normale Lücke bedeutet Bikarbonatverlust (Diarrhö) oder Chloridzufuhr (Kochsalz). Niedriges Albumin senkt die Lücke.')),
    eq('cl', 'full', L('Chloride: what electroneutrality leaves', 'Chlorid: was die Elektroneutralität übrig lässt'),
      [v('chloride')], [v('sodium'), '+', v('potassium'), '+', '3.5', '−', v('bicarbonate'), '−', '0.28', '·', v('albumin'), '−', '1.8', '·', v('phosphate'), '−', v('lactate'), '−', v('ketones'), '−', { text: 'sulfate and others' }],
      L('Vomiting loses chloride (as HCl): bicarbonate rises in its place. Diarrhoea loses bicarbonate: chloride rises in its place. The kidney excretes acid as NH₄Cl, removing chloride and leaving bicarbonate behind.',
        'Erbrechen verliert Chlorid (als HCl): Bikarbonat steigt an seiner Stelle. Diarrhö verliert Bikarbonat: Chlorid steigt an seiner Stelle. Die Niere scheidet Säure als NH₄Cl aus, entfernt Chlorid und lässt Bikarbonat zurück.')),
    eq('base', 'full', L('The base balance', 'Die Basenbilanz'),
      [{ text: 'd(base)/dt' }], [{ text: 'diet alkali' }, '−', { text: 'fixed acid' }, '−', { text: 'ketoacids' }, '−', { text: 'lactic acid' }, '+', { text: 'oxidised anions' }, '+', v('NH4'), '−', { text: 'HCO₃⁻ in urine' }, '+', { text: 'H⁺ vomited' }, '−', { text: 'HCO₃⁻ in stool' }],
      L('Bicarbonate is spread over about twice the extracellular volume, because cells and bone buffer half of any acid load. The kidney adds base by excreting ammonium (more when acidaemic, less when potassium is high) and spills it above a threshold that a dry, chloride-depleted or hypokalaemic patient raises: why a vomiting patient’s alkalosis persists until given saline and potassium.',
        'Bikarbonat verteilt sich auf etwa das doppelte Extrazellulärvolumen, weil Zellen und Knochen die Hälfte jeder Säurelast puffern. Die Niere fügt Base hinzu, indem sie Ammonium ausscheidet (mehr bei Azidämie, weniger bei hohem Kalium), und lässt sie über einer Schwelle in den Urin, die Exsikkose, Chloridmangel und Hypokaliämie anheben: Darum bleibt die Alkalose eines erbrechenden Patienten bestehen, bis er Kochsalz und Kalium bekommt.')),
  ],
  values: (ctx) => {
    const c = (ctx.view.chemistry ?? CHEMISTRY_DEFAULTS) as Record<string, number>;
    return {
      ...Object.fromEntries(Object.entries(ctx.model.body)),
      ...c, bicarbonate: c.standardBicarbonate ?? c.bicarbonate, hco3: c.bicarbonate, BE: c.baseExcess, pH: hendersonHasselbalch(c.bicarbonate, c.paCO2), AG: c.sodium - (c.chloride + c.bicarbonate),
      kRatio: bn(ctx, 'kRatio'), Kbody: bn(ctx, 'Kbody'), NH4: bn(ctx, 'NH4'),
    };
  },
  diagram: 'acidbase',
  sources: ['Berend K et al. Physiological approach to assessment of acid–base disturbances. N Engl J Med 2014;371:1434–45.', 'Fernandez PC, Cohen RM, Feldman GM. The concept of bicarbonate distribution space: the crucial role of body buffers. Kidney Int 1989;36:747–52.', 'Adrogué HJ, Madias NE. Changes in plasma potassium concentration during acute acid–base disturbances. Am J Med 1981;71:456–67.', 'Galla JH. Metabolic alkalosis. J Am Soc Nephrol 2000;11:369–75.'],
};

const FUELS: ModelDef = {
  id: 'fuels', title: L('Glucose, insulin and ketones', 'Glukose, Insulin und Ketone'),
  summary: L('Blood glucose is the balance of what enters (the gut, the liver’s glucose output) and what leaves (the brain, which needs no insulin; muscle and fat, which do; the urine, above a threshold of about 10 mmol/L). Insulin, secreted as glucose rises, suppresses the liver and lets muscle take glucose up; it also restrains fat breakdown, so without it the liver turns fatty acids into ketoacids faster than they can be burnt. That is ketoacidosis: hyperglycaemia, an osmotic diuresis that dehydrates, an acid that the lungs answer with Kussmaul breathing, and a potassium that is high in the blood and low in the body. Lactate is made whenever oxygen delivery falls short of demand and cleared by the liver.',
    'Der Blutzucker ist die Bilanz aus Zufuhr (Darm, hepatische Glukoseabgabe) und Verbrauch (Gehirn, das kein Insulin braucht; Muskel und Fett, die es brauchen; Urin oberhalb einer Schwelle von etwa 10 mmol/l). Insulin, das mit steigendem Zucker sezerniert wird, hemmt die Leber und lässt den Muskel Glukose aufnehmen; es bremst auch den Fettabbau — ohne Insulin macht die Leber aus Fettsäuren schneller Ketosäuren, als verbrannt werden können. Das ist die Ketoazidose: Hyperglykämie, eine osmotische Diurese, die austrocknet, eine Säure, auf die die Lunge mit Kussmaul-Atmung antwortet, und ein Kalium, das im Blut hoch und im Körper niedrig ist. Laktat entsteht, wenn das Sauerstoffangebot den Bedarf nicht deckt, und wird von der Leber geklärt.'),
  groups: [
    { id: 'pancreas', label: L('Pancreas and insulin', 'Pankreas und Insulin') },
    { id: 'diet', label: L('Diet and stress', 'Ernährung und Stress') },
  ],
  variables: [
    BP('fuels', 'pancreas', 'betaCell', 'β', L('Insulin secretory capacity (0 = type 1 diabetes)', 'Insulinsekretorische Kapazität (0 = Typ-1-Diabetes)'), '× normal', 0, 2, 0.05),
    BP('fuels', 'pancreas', 'insulinSensitivity', 'S_I', L('Insulin sensitivity (low in type 2 diabetes, obesity, steroids)', 'Insulinempfindlichkeit (niedrig bei Typ-2-Diabetes, Adipositas, Steroiden)'), '× normal', 0.1, 2, 0.05),
    BP('fuels', 'pancreas', 'insulinDose', 'I_{dose}', L('Injected insulin', 'Gespritztes Insulin'), 'U/day', 0, 150, 1),
    BP('fuels', 'diet', 'carbIntake', 'CHO', L('Carbohydrate in a full diet', 'Kohlenhydrate bei voller Kost'), 'g/day', 0, 600, 10),
    BP('fuels', 'diet', 'stress', 'σ', L('Illness (cortisol, glucagon, adrenaline)', 'Erkrankung (Cortisol, Glukagon, Adrenalin)'), '0–1', 0, 1, 0.05),
    S('fuels', 'glucose', '[glc]', L('Glucose', 'Glukose'), 'mmol/L', 1),
    S('fuels', 'insulin', 'I', L('Plasma insulin', 'Plasmainsulin'), 'mU/L', 1),
    S('fuels', 'hgo', 'HGO', L('Liver glucose output', 'Hepatische Glukoseabgabe'), 'mmol/h', 0),
    S('fuels', 'glucoseUptake', 'U_{glc}', L('Glucose taken up by tissues', 'Glukoseaufnahme der Gewebe'), 'mmol/h', 0),
    S('fuels', 'glucosuria', 'U_{glc}', L('Urine glucose', 'Uringlukose'), 'mmol/L', 0),
    S('fuels', 'ketones', '[ket]', L('Ketoacids', 'Ketosäuren'), 'mmol/L', 1),
    S('fuels', 'betaHydroxybutyrate', '[βOHB]', L('β-hydroxybutyrate (what a meter reads)', 'β-Hydroxybutyrat (was ein Messgerät anzeigt)'), 'mmol/L', 1),
    S('fuels', 'ketogenesis', 'R_{ket}', L('Ketogenesis', 'Ketogenese'), 'mmol/h', 0),
    S('fuels', 'ketoneOxidation', 'Ox_{ket}', L('Ketones burnt', 'Verbrannte Ketone'), 'mmol/h', 0),
    S('fuels', 'lactate', '[lac]', L('Lactate', 'Laktat'), 'mmol/L', 1),
    S('fuels', 'lactateProduction', 'R_{lac}', L('Lactate made', 'Gebildetes Laktat'), 'mmol/h', 0),
    S('fuels', 'lactateClearance', 'Cl_{lac}', L('Lactate cleared', 'Geklärtes Laktat'), 'mmol/h', 0),
    S('fuels', 'ER', 'O_2ER', L('Oxygen extraction (VO₂/DO₂)', 'Sauerstoffextraktion (VO₂/DO₂)'), '', 2),
  ],
  equations: [
    eq('glc', 'textbook', L('The glucose balance', 'Die Glukosebilanz'),
      [{ text: 'd(glucose)/dt' }], [{ text: 'gut' }, '+', v('hgo'), '−', { text: 'brain' }, '−', v('glucoseUptake'), '−', { text: 'GFR·(glucose − 10)' }],
      L('Without insulin the liver’s output doubles and muscle stops taking glucose up; only the brain and the urine remove it. Glucose then rises until the urine carries away what the liver makes, which happens at a higher level the lower the filtration: a dry patient’s glucose climbs further.',
        'Ohne Insulin verdoppelt die Leber ihre Abgabe und der Muskel nimmt keine Glukose mehr auf; nur Gehirn und Urin entfernen sie. Die Glukose steigt dann, bis der Urin wegträgt, was die Leber bildet — bei umso höherem Wert, je geringer die Filtration: Beim exsikkierten Patienten steigt der Zucker weiter.')),
    eq('ins', 'textbook', L('Insulin secretion', 'Insulinsekretion'),
      [v('insulin')], [v('betaCell'), '·', '55', '·', frac([{ sup: [['glucose'], ['4']] }], [{ sup: [['glucose'], ['4']] }, '+', { sup: [['8'], ['4']] }]), '+', { text: 'injected' }],
      L('A steep sigmoid with its midpoint at 8 mmol/L. Type 1 diabetes removes it entirely; type 2 lowers it and makes each unit of insulin do less. Injected basal insulin is absorbed over most of a day, so ketoacidosis develops over hours after doses stop.',
        'Eine steile Sigmoide mit Mittelpunkt bei 8 mmol/l. Typ-1-Diabetes entfernt sie ganz; Typ 2 senkt sie und lässt jede Einheit Insulin weniger bewirken. Gespritztes Basalinsulin wird über fast einen Tag resorbiert, daher entwickelt sich die Ketoazidose über Stunden, nachdem die Gaben aufhören.')),
    eq('ket', 'textbook', L('Ketoacids: made without insulin, burnt with a limit', 'Ketosäuren: ohne Insulin gebildet, begrenzt verbrannt'),
      [{ text: 'd(ketones)/dt' }], [v('ketogenesis'), '−', v('ketoneOxidation'), '−', { text: 'urine' }],
      L('Fat breakdown is the most insulin-sensitive process there is: a little insulin stops it, which is why type 2 diabetes rarely ketoses. Ketone oxidation saturates, so once production exceeds it ketones accumulate, each adding an acid that consumes bicarbonate.',
        'Der Fettabbau ist der insulinempfindlichste Vorgang überhaupt: Wenig Insulin stoppt ihn, darum ketotisiert der Typ-2-Diabetes selten. Die Ketonoxidation sättigt sich; übersteigt die Bildung sie, sammeln sich Ketone an, jedes mit einer Säure, die Bikarbonat verbraucht.')),
    eq('lac', 'textbook', L('Lactate: made when oxygen falls short, cleared by the liver', 'Laktat: gebildet bei Sauerstoffmangel, geklärt von der Leber'),
      [v('lactateProduction')], [{ text: '0.75·mass' }, '+', { text: '2.2·mass' }, '·', { fn: 'tanh', args: [frac([{ sup: [[paren(v('ER'), '−', '0.45')], ['1.5']] }], ['0.25'])] }],
      L('Tissues extract more oxygen as delivery falls; beyond about half they switch to glycolysis. The liver clears lactate in proportion to its own blood flow, so in shock production rises as clearance falls.',
        'Gewebe entziehen dem Blut mehr Sauerstoff, wenn das Angebot sinkt; ab etwa der Hälfte schalten sie auf Glykolyse um. Die Leber klärt Laktat proportional zu ihrer Durchblutung — im Schock steigt die Bildung, während die Klärung fällt.')),
  ],
  values: (ctx) => {
    const r = resp(ctx);
    return {
      ...Object.fromEntries(Object.entries(ctx.model.body)),
      glucose: bn(ctx, 'glucose'), insulin: bn(ctx, 'insulin'), hgo: bn(ctx, 'hgo'), glucoseUptake: bn(ctx, 'glucoseUptake'), glucosuria: bn(ctx, 'glucosuria'),
      ketones: bn(ctx, 'ketones'), betaHydroxybutyrate: bn(ctx, 'betaHydroxybutyrate'), ketogenesis: bn(ctx, 'ketogenesis'), ketoneOxidation: bn(ctx, 'ketoneOxidation'),
      lactate: bn(ctx, 'lactate'), lactateProduction: bn(ctx, 'lactateProduction'), lactateClearance: bn(ctx, 'lactateClearance'),
      ER: typeof r.VO2 === 'number' && typeof r.DO2 === 'number' ? r.VO2 / r.DO2 : NaN,
    };
  },
  diagram: 'fuels',
  sources: ['Kitabchi AE et al. Hyperglycemic crises in adult patients with diabetes. Diabetes Care 2009;32:1335–43.', 'Bergman RN. Minimal model: perspective from 2005. Horm Res 2005;64 Suppl 3:8–15.', 'Laffel L. Ketone bodies: a review of physiology, pathophysiology and application of monitoring to diabetes. Diabetes Metab Res Rev 1999;15:412–26.', 'Levy B. Lactate and shock state: the metabolic view. Curr Opin Crit Care 2006;12:315–21.'],
};

/* ---- respiration: mechanics and ventilation ---------------------------------------------------------- */
const resp = (ctx: LiveContext): Record<string, any> => (ctx.snap?.resp ?? ctx.view.respiratory ?? {}) as Record<string, any>;
const rn = (ctx: LiveContext, k: string) => { const x = resp(ctx)[k]; return typeof x === 'number' ? x : NaN; };
const RP = (model: string, group: string, key: string, symbol: string, label: LocalizedText, unit: string, min: number, max: number, step: number, note?: LocalizedText) =>
  param(model, group, { key: `respiratory.${key}`, symbol, label, unit, min, max, step, note, digits: step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0 });
const LOBE_NAME: Record<string, LocalizedText> = {
  RUL: L('right upper lobe', 'rechter Oberlappen'), RML: L('right middle lobe', 'Mittellappen'), RLL: L('right lower lobe', 'rechter Unterlappen'),
  LUL: L('left upper lobe and lingula', 'linker Oberlappen mit Lingula'), LLL: L('left lower lobe', 'linker Unterlappen'),
};
const lobeParams = (model: string, prefix: string, what: LocalizedText, group: string) =>
  (['RUL', 'RML', 'RLL', 'LUL', 'LLL'] as const).map((id) => RP(model, group, `${prefix}${id}`, `${prefix}_{${id}}`,
    L(`${what.en}: ${LOBE_NAME[id].en}`, `${what.de}: ${LOBE_NAME[id].de}`), '0–1', 0, 1, 0.05));

const MECHANICS: ModelDef = {
  id: 'mechanics', title: L('Breathing: mechanics and ventilation', 'Atmung: Mechanik und Ventilation'),
  summary: L('The respiratory muscles lower the pressure around the lungs; air flows in until the lungs’ elastic recoil balances the pull, against the resistance of the airways. Expiration is the recoil letting go. Stiff lungs need more pressure for the same volume, narrow airways need more pressure for the same flow, and a lung that cannot empty in the time it has stays inflated: intrinsic PEEP. Only the air that reaches perfused alveoli takes part in gas exchange.',
    'Die Atemmuskulatur senkt den Druck um die Lunge; Luft strömt ein, bis die elastische Rückstellkraft der Lunge dem Zug das Gleichgewicht hält, gegen den Widerstand der Atemwege. Exspiration ist das Loslassen dieser Rückstellkraft. Steife Lungen brauchen mehr Druck für dasselbe Volumen, enge Atemwege mehr Druck für denselben Fluss, und eine Lunge, die sich in der verfügbaren Zeit nicht entleeren kann, bleibt gebläht: intrinsischer PEEP. Nur die Luft, die durchblutete Alveolen erreicht, nimmt am Gasaustausch teil.'),
  groups: [
    { id: 'airways', label: L('Airways and parenchyma', 'Atemwege und Parenchym') },
    { id: 'pleura', label: L('Pleura', 'Pleura') },
    { id: 'muscles', label: L('Respiratory muscles', 'Atemmuskulatur') },
  ],
  variables: [
    RP('mechanics', 'airways', 'bronchoconstriction', 'b', L('Bronchoconstriction (airway smooth muscle, mucus, oedema of the wall)', 'Bronchokonstriktion (glatte Muskulatur, Schleim, Wandödem)'), '0–1', 0, 1, 0.05),
    RP('mechanics', 'airways', 'emphysema', 'e', L('Emphysema (lost elastic recoil and alveolar walls)', 'Emphysem (Verlust von elastischer Rückstellkraft und Alveolarwänden)'), '0–1', 0, 1, 0.05),
    RP('mechanics', 'airways', 'fibrosis', 'f', L('Interstitial fibrosis (stiff, small lungs)', 'Interstitielle Fibrose (steife, kleine Lungen)'), '0–1', 0, 1, 0.05),
    RP('mechanics', 'pleura', 'effusionR', 'E_R', L('Pleural effusion, right', 'Pleuraerguss rechts'), 'mL', 0, 4000, 50),
    RP('mechanics', 'pleura', 'effusionL', 'E_L', L('Pleural effusion, left', 'Pleuraerguss links'), 'mL', 0, 4000, 50),
    RP('mechanics', 'pleura', 'ptxR', 'ptx_R', L('Pneumothorax, right (fraction of lung collapsed)', 'Pneumothorax rechts (kollabierter Anteil)'), '0–1', 0, 1, 0.05),
    RP('mechanics', 'pleura', 'ptxL', 'ptx_L', L('Pneumothorax, left (fraction of lung collapsed)', 'Pneumothorax links (kollabierter Anteil)'), '0–1', 0, 1, 0.05),
    RP('mechanics', 'muscles', 'muscleStrength', 's_{mus}', L('Respiratory muscle strength', 'Kraft der Atemmuskulatur'), '× normal', 0.05, 1.2, 0.05),
    state('mechanics', { key: 'V', symbol: 'V', label: L('Lung volume above relaxed FRC', 'Lungenvolumen über der entspannten FRC'), unit: 'L', digits: 2 }),
    state('mechanics', { key: 'flow', symbol: 'V̇', label: L('Airflow (+ in)', 'Atemstrom (+ ein)'), unit: 'L/s', digits: 2 }),
    state('mechanics', { key: 'Pmus', symbol: 'P_{mus}', label: L('Pressure the muscles generate', 'Von der Muskulatur erzeugter Druck'), unit: 'cmH₂O', digits: 1 }),
    state('mechanics', { key: 'Palv', symbol: 'P_{alv}', label: L('Alveolar pressure', 'Alveolardruck'), unit: 'cmH₂O', digits: 1 }),
    state('mechanics', { key: 'Ppl', symbol: 'P_{pl}', label: L('Pleural pressure', 'Pleuradruck'), unit: 'cmH₂O', digits: 1 }),
    state('mechanics', { key: 'Crs', symbol: 'C_{rs}', label: L('Compliance of the respiratory system', 'Compliance des respiratorischen Systems'), unit: 'L/cmH₂O', digits: 3 }),
    state('mechanics', { key: 'Raw', symbol: 'R_{aw}', label: L('Airway resistance', 'Atemwegswiderstand'), unit: 'cmH₂O·s/L', digits: 1 }),
    state('mechanics', { key: 'tauE', symbol: 'τ_E', label: L('Expiratory time constant', 'Exspiratorische Zeitkonstante'), unit: 's', digits: 2 }),
    state('mechanics', { key: 'Te', symbol: 'T_E', label: L('Expiratory time', 'Exspirationszeit'), unit: 's', digits: 2 }),
    state('mechanics', { key: 'iPEEP', symbol: 'PEEP_i', label: L('Intrinsic PEEP', 'Intrinsischer PEEP'), unit: 'cmH₂O', digits: 1 }),
    state('mechanics', { key: 'RR', symbol: 'f', label: L('Respiratory rate', 'Atemfrequenz'), unit: '/min', digits: 0 }),
    state('mechanics', { key: 'VT', symbol: 'V_T', label: L('Tidal volume', 'Atemzugvolumen'), unit: 'L', digits: 2 }),
    state('mechanics', { key: 'VE', symbol: 'V̇_E', label: L('Minute ventilation', 'Atemminutenvolumen'), unit: 'L/min', digits: 1 }),
    state('mechanics', { key: 'VDanat', symbol: 'V_D', label: L('Anatomical dead space', 'Anatomischer Totraum'), unit: 'L', digits: 2 }),
    state('mechanics', { key: 'VA', symbol: 'V̇_A', label: L('Alveolar ventilation', 'Alveoläre Ventilation'), unit: 'L/min', digits: 1 }),
    state('mechanics', { key: 'TLC', symbol: 'TLC', label: L('Total lung capacity', 'Totale Lungenkapazität'), unit: 'L', digits: 2 }),
    state('mechanics', { key: 'FRC', symbol: 'FRC', label: L('Functional residual capacity', 'Funktionelle Residualkapazität'), unit: 'L', digits: 2 }),
    state('mechanics', { key: 'RV', symbol: 'RV', label: L('Residual volume', 'Residualvolumen'), unit: 'L', digits: 2 }),
    state('mechanics', { key: 'FEV1', symbol: 'FEV_1', label: L('Forced expiratory volume in 1 s', 'Einsekundenkapazität'), unit: 'L', digits: 2 }),
    state('mechanics', { key: 'FVC', symbol: 'FVC', label: L('Forced vital capacity', 'Forcierte Vitalkapazität'), unit: 'L', digits: 2 }),
    state('mechanics', { key: 'ratio', symbol: 'FEV_1/FVC', label: L('FEV₁/FVC', 'FEV₁/FVC (Tiffeneau)'), unit: '', digits: 2 }),
    state('mechanics', { key: 'PEF', symbol: 'PEF', label: L('Peak expiratory flow', 'Exspiratorischer Spitzenfluss'), unit: 'L/min', digits: 0 }),
    state('mechanics', { key: 'VCO2', symbol: 'V̇_{CO2}', label: L('CO₂ production', 'CO₂-Produktion'), unit: 'mL/min', digits: 0 }),
    state('mechanics', { key: 'PaCO2', symbol: 'P_{aCO2}', label: L('Arterial CO₂ tension', 'Arterieller CO₂-Partialdruck'), unit: 'kPa', digits: 2 }),
  ],
  equations: [
    eq('motion', 'textbook', L('The equation of motion of the respiratory system', 'Die Bewegungsgleichung des respiratorischen Systems'),
      [v('Pmus')], [frac([v('V')], [v('Crs')]), '+', v('Raw'), '·', v('flow')],
      L('Every moment of every breath: the muscles’ pressure is spent stretching the elastic lung and chest wall (V/C) and driving flow through the airways (R·V̇). Stiff lungs raise the first term, narrow airways the second.',
        'In jedem Moment jedes Atemzugs: der Muskeldruck dehnt Lunge und Thoraxwand gegen ihre Elastizität (V/C) und treibt den Fluss durch die Atemwege (R·V̇). Steife Lungen erhöhen den ersten, enge Atemwege den zweiten Term.')),
    eq('tau', 'textbook', L('How fast the lung empties: the time constant', 'Wie schnell die Lunge sich entleert: die Zeitkonstante'),
      [v('tauE')], [v('Raw'), '·', v('Crs')],
      L('Passive expiration is exponential: after one τ, 37 % of the breath is still in the lung, after three τ, 5 %. If the expiratory time is shorter than about three τ, the next breath starts on top of the last: the lung hyperinflates and keeps a positive pressure at end-expiration, intrinsic PEEP, which the muscles must overcome before any air flows in.',
        'Die passive Exspiration ist exponentiell: nach einem τ sind noch 37 % des Atemzugs in der Lunge, nach drei τ noch 5 %. Ist die Exspirationszeit kürzer als etwa drei τ, beginnt der nächste Atemzug auf dem letzten: die Lunge überbläht und behält am Ende der Exspiration einen positiven Druck, den intrinsischen PEEP, den die Muskulatur überwinden muss, bevor Luft einströmt.')),
    eq('va', 'textbook', L('Alveolar ventilation', 'Alveoläre Ventilation'),
      [v('VA')], [v('VE'), '−', v('RR'), '·', v('VDanat')],
      L('The last ~150 mL of each breath stays in the conducting airways and comes back out unchanged. Rapid shallow breathing wastes a larger share of each breath.',
        'Die letzten ~150 mL jedes Atemzugs bleiben in den leitenden Atemwegen und kommen unverändert wieder heraus. Schnelle flache Atmung verschwendet einen größeren Anteil jedes Atemzugs.')),
    eq('co2', 'textbook', L('Alveolar ventilation sets the CO₂', 'Die alveoläre Ventilation bestimmt das CO₂'),
      [v('PaCO2')], [frac(['0.115', '·', v('VCO2')], [v('VA')])],
      L('The alveolar ventilation equation (0.863 when PCO₂ is in mmHg). At constant CO₂ production, halving alveolar ventilation doubles the arterial CO₂: a hyperbola. This is why CO₂ is the measure of ventilation.',
        'Die alveoläre Ventilationsgleichung (0,863, wenn der PCO₂ in mmHg angegeben ist). Bei konstanter CO₂-Produktion verdoppelt eine Halbierung der alveolären Ventilation das arterielle CO₂: eine Hyperbel. Deshalb ist das CO₂ das Maß der Ventilation.')),
    eq('forced', 'full', L('Forced expiration: flow limited by the lung itself', 'Forcierte Exspiration: vom Lungengewebe begrenzter Fluss'),
      [{ text: 'V̇_max(x)' }], [{ text: 'k' }, '·', v('FVC'), '·', { sup: [[{ text: 'x' }], [{ text: 'n' }]] }],
      L('x is the fraction of the vital capacity still to be exhaled. Beyond the first tenth of a second, blowing harder does not blow faster: airways collapse downstream of the point where their inside pressure equals the pleural pressure, and flow is set by elastic recoil over upstream resistance. Narrow airways and lost recoil lower k and make the curve concave (n rises): the scooped flow–volume loop of obstruction, a low FEV₁/FVC.',
        'x ist der noch auszuatmende Anteil der Vitalkapazität. Nach der ersten Zehntelsekunde bringt stärkeres Pressen keinen höheren Fluss: die Atemwege kollabieren stromabwärts des Punktes, an dem ihr Innendruck dem Pleuradruck entspricht, und der Fluss ist durch elastische Rückstellkraft durch vorgeschalteten Widerstand bestimmt. Enge Atemwege und verlorene Rückstellkraft senken k und machen die Kurve konkav (n steigt): die „durchhängende“ Fluss-Volumen-Kurve der Obstruktion, ein niedriger Tiffeneau-Index.')),
  ],
  values: (ctx) => {
    const r = resp(ctx);
    return {
      ...Object.fromEntries(Object.entries(ctx.model.respiratory)),
      V: rn(ctx, 'V'), flow: rn(ctx, 'flow'), Pmus: rn(ctx, 'Pmus'), Palv: rn(ctx, 'Palv'), Ppl: rn(ctx, 'Ppl'), Crs: rn(ctx, 'Crs') / 1000, Raw: rn(ctx, 'Raw'),
      tauE: rn(ctx, 'tauE'), Te: rn(ctx, 'Te'), iPEEP: rn(ctx, 'iPEEP'), RR: rn(ctx, 'RR'), VT: rn(ctx, 'VT'), VE: rn(ctx, 'VE'), VDanat: rn(ctx, 'VDanat'), VA: rn(ctx, 'VA'),
      TLC: rn(ctx, 'TLC'), FRC: rn(ctx, 'EELV'), RV: rn(ctx, 'RV'), FEV1: rn(ctx, 'FEV1'), FVC: rn(ctx, 'FVC'), ratio: r.FVC ? r.FEV1 / r.FVC : NaN, PEF: rn(ctx, 'PEF') * 60,
      VCO2: rn(ctx, 'VCO2'), PaCO2: rn(ctx, 'PaCO2'),
    };
  },
  diagram: 'breath',
  sources: ['Lumb AB. Nunn’s Applied Respiratory Physiology, 9th ed. 2020.', 'West JB, Luks AM. West’s Respiratory Physiology: The Essentials, 11th ed. 2020.', 'Quanjer PH et al. Lung volumes and forced ventilatory flows (ECSC). Eur Respir J 1993;6 Suppl 16:5–40.'],
};

/* ---- respiration: gas exchange and oxygen transport ---------------------------------------------------- */
const GAS_EXCHANGE: ModelDef = {
  id: 'gas-exchange', title: L('Gas exchange and oxygen transport', 'Gasaustausch und Sauerstofftransport'),
  summary: L('Each alveolus exchanges O₂ and CO₂ with the blood that passes it, and what it achieves depends on the ratio of its ventilation to its perfusion. Blood that passes airless lung comes back as it went (shunt); air that reaches lung without blood is wasted (dead space). Arterial blood is the mixture of everything that left the lungs, and haemoglobin turns its O₂ tension into O₂ content along a sigmoid curve.',
    'Jede Alveole tauscht O₂ und CO₂ mit dem vorbeifließenden Blut, und was sie erreicht, hängt vom Verhältnis ihrer Ventilation zu ihrer Perfusion ab. Blut, das luftleere Lunge passiert, kommt unverändert zurück (Shunt); Luft, die Lunge ohne Blut erreicht, ist verloren (Totraum). Arterielles Blut ist die Mischung aus allem, was die Lunge verlässt, und Hämoglobin macht aus seinem O₂-Partialdruck entlang einer sigmoiden Kurve O₂-Gehalt.'),
  groups: [
    { id: 'air', label: L('Inspired gas', 'Eingeatmetes Gas') },
    { id: 'membrane', label: L('Alveoli, capillaries and vessels', 'Alveolen, Kapillaren und Gefäße') },
    { id: 'cons', label: L('Consolidation (alveoli full of exudate)', 'Konsolidierung (Alveolen voll Exsudat)') },
    { id: 'coll', label: L('Collapse (atelectasis)', 'Kollaps (Atelektase)') },
    { id: 'emb', label: L('Pulmonary emboli (lobar artery obstructed)', 'Lungenembolie (Lappenarterie verschlossen)') },
    { id: 'blood', label: L('Haemoglobin', 'Hämoglobin') },
  ],
  variables: [
    RP('gas-exchange', 'air', 'FiO2', 'F_{IO2}', L('Inspired O₂ fraction', 'Inspiratorische O₂-Fraktion'), '', 0.21, 1, 0.01),
    RP('gas-exchange', 'air', 'Pb', 'P_B', L('Barometric pressure (altitude)', 'Luftdruck (Höhe)'), 'kPa', 40, 110, 0.5, L('Sea level 101 kPa; 2500 m 75 kPa; 5000 m 54 kPa.', 'Meereshöhe 101 kPa; 2500 m 75 kPa; 5000 m 54 kPa.')),
    RP('gas-exchange', 'membrane', 'diffusion', 'D_m', L('Alveolar–capillary membrane', 'Alveolokapilläre Membran'), '× normal', 0.05, 1.5, 0.05),
    RP('gas-exchange', 'membrane', 'vqMismatch', 'σ_{V/Q}', L('Additional V/Q mismatch', 'Zusätzliche Ventilations-Perfusions-Verteilungsstörung'), '', 0, 2, 0.05),
    RP('gas-exchange', 'membrane', 'hpv', 'g_{HPV}', L('Hypoxic pulmonary vasoconstriction', 'Hypoxische pulmonale Vasokonstriktion'), '0–1', 0, 1, 0.05),
    RP('gas-exchange', 'membrane', 'capillaryLeak', 'leak', L('Capillary leak (ARDS)', 'Kapillarleck (ARDS)'), '0–1', 0, 1, 0.05),
    ...lobeParams('gas-exchange', 'cons', L('Consolidation', 'Konsolidierung'), 'cons'),
    ...lobeParams('gas-exchange', 'coll', L('Collapse', 'Kollaps'), 'coll'),
    ...lobeParams('gas-exchange', 'emb', L('Embolic obstruction', 'Embolischer Verschluss'), 'emb'),
    RP('gas-exchange', 'blood', 'COHb', 'COHb', L('Carboxyhaemoglobin', 'Carboxyhämoglobin'), 'fraction', 0, 0.7, 0.01),
    RP('gas-exchange', 'blood', 'metHb', 'MetHb', L('Methaemoglobin', 'Methämoglobin'), 'fraction', 0, 0.7, 0.01),
    state('gas-exchange', { key: 'PIO2', symbol: 'P_{IO2}', label: L('Inspired O₂ tension', 'Inspiratorischer O₂-Partialdruck'), unit: 'kPa', digits: 1 }),
    state('gas-exchange', { key: 'PAO2', symbol: 'P_{AO2}', label: L('Ideal alveolar O₂ tension', 'Idealer alveolärer O₂-Partialdruck'), unit: 'kPa', digits: 1 }),
    state('gas-exchange', { key: 'PaO2', symbol: 'P_{aO2}', label: L('Arterial O₂ tension', 'Arterieller O₂-Partialdruck'), unit: 'kPa', digits: 1 }),
    state('gas-exchange', { key: 'PaCO2', symbol: 'P_{aCO2}', label: L('Arterial CO₂ tension', 'Arterieller CO₂-Partialdruck'), unit: 'kPa', digits: 2 }),
    state('gas-exchange', { key: 'R', symbol: 'R', label: L('Respiratory quotient', 'Respiratorischer Quotient'), unit: '', digits: 2 }),
    state('gas-exchange', { key: 'AaD', symbol: 'A–aDO_2', label: L('Alveolar–arterial O₂ difference', 'Alveoloarterielle O₂-Differenz'), unit: 'kPa', digits: 1 }),
    state('gas-exchange', { key: 'SaO2', symbol: 'S_{aO2}', label: L('Arterial O₂ saturation', 'Arterielle O₂-Sättigung'), unit: '%', digits: 1 }),
    state('gas-exchange', { key: 'Hb', symbol: 'Hb', label: L('Haemoglobin', 'Hämoglobin'), unit: 'g/dL', digits: 1 }),
    state('gas-exchange', { key: 'CaO2', symbol: 'C_{aO2}', label: L('Arterial O₂ content', 'Arterieller O₂-Gehalt'), unit: 'mL/dL', digits: 1 }),
    state('gas-exchange', { key: 'CvO2', symbol: 'C_{v̄O2}', label: L('Mixed venous O₂ content', 'Gemischtvenöser O₂-Gehalt'), unit: 'mL/dL', digits: 1 }),
    state('gas-exchange', { key: 'SvO2', symbol: 'S_{v̄O2}', label: L('Mixed venous saturation', 'Gemischtvenöse Sättigung'), unit: '%', digits: 0 }),
    state('gas-exchange', { key: 'PvO2', symbol: 'P_{v̄O2}', label: L('Mixed venous O₂ tension', 'Gemischtvenöser O₂-Partialdruck'), unit: 'kPa', digits: 1 }),
    state('gas-exchange', { key: 'Q', symbol: 'Q̇', label: L('Cardiac output (pulmonary blood flow)', 'Herzzeitvolumen (Lungendurchblutung)'), unit: 'L/min', digits: 1 }),
    state('gas-exchange', { key: 'DO2', symbol: 'DO_2', label: L('O₂ delivery', 'O₂-Angebot'), unit: 'mL/min', digits: 0 }),
    state('gas-exchange', { key: 'VO2', symbol: 'V̇_{O2}', label: L('O₂ consumption', 'O₂-Verbrauch'), unit: 'mL/min', digits: 0 }),
    state('gas-exchange', { key: 'Cc', symbol: 'C_{c′O2}', label: L('End-capillary O₂ content (ideal alveolus)', 'Endkapillärer O₂-Gehalt (ideale Alveole)'), unit: 'mL/dL', digits: 1 }),
    state('gas-exchange', { key: 'QsQt', symbol: 'Q̇_s/Q̇_t', label: L('Venous admixture', 'Venöse Beimischung'), unit: '', digits: 2 }),
    state('gas-exchange', { key: 'shunt', symbol: 'shunt', label: L('True shunt (blood past airless lung)', 'Echter Shunt (Blut an luftleerer Lunge vorbei)'), unit: '', digits: 2 }),
    state('gas-exchange', { key: 'PECO2', symbol: 'P_{ĒCO2}', label: L('Mixed expired CO₂', 'Gemischt-exspiratorisches CO₂'), unit: 'kPa', digits: 2 }),
    state('gas-exchange', { key: 'VDVT', symbol: 'V_D/V_T', label: L('Physiological dead space fraction', 'Physiologischer Totraumanteil'), unit: '', digits: 2 }),
    state('gas-exchange', { key: 'EtCO2', symbol: 'P_{ETCO2}', label: L('End-tidal CO₂', 'Endtidales CO₂'), unit: 'kPa', digits: 2 }),
    state('gas-exchange', { key: 'RpulMult', symbol: 'PVR/PVR_0', label: L('Pulmonary vascular resistance, relative', 'Pulmonaler Gefäßwiderstand, relativ'), unit: '×', digits: 2 }),
    state('gas-exchange', { key: 'Pcap', symbol: 'P_c', label: L('Pulmonary capillary pressure', 'Pulmonalkapillärer Druck'), unit: 'mmHg', digits: 0 }),
    state('gas-exchange', { key: 'Pla', symbol: 'P_{LA}', label: L('Left atrial pressure', 'Linksatrialer Druck'), unit: 'mmHg', digits: 0 }),
    state('gas-exchange', { key: 'Ppa', symbol: 'P_{PA}', label: L('Mean pulmonary arterial pressure', 'Mittlerer pulmonalarterieller Druck'), unit: 'mmHg', digits: 0 }),
    state('gas-exchange', { key: 'piC', symbol: 'π_c', label: L('Plasma oncotic pressure', 'Kolloidosmotischer Druck des Plasmas'), unit: 'mmHg', digits: 0 }),
    state('gas-exchange', { key: 'Jv', symbol: 'J_v', label: L('Net filtration (relative to normal)', 'Nettofiltration (relativ zu normal)'), unit: '', digits: 1 }),
    state('gas-exchange', { key: 'interstitial', symbol: 'W_i', label: L('Interstitial lung water', 'Interstitielles Lungenwasser'), unit: '0–1', digits: 2 }),
  ],
  equations: [
    eq('alveolar-gas', 'textbook', L('The alveolar gas equation', 'Die Alveolargasgleichung'),
      [v('PAO2')], [v('FiO2'), '·', paren(v('Pb'), '−', '6.3'), '−', frac([v('PaCO2')], [v('R')])],
      L('What the inspired gas offers, minus the O₂ displaced by CO₂ (CO₂ in, O₂ out, in the ratio R). The difference between this ideal alveolar value and the arterial O₂ is the A–a difference: small in health, large when blood bypasses or under-ventilated lung.',
        'Was das eingeatmete Gas anbietet, minus den O₂, den das CO₂ verdrängt (CO₂ hinein, O₂ heraus, im Verhältnis R). Die Differenz zwischen diesem idealen Alveolarwert und dem arteriellen O₂ ist die A-a-Differenz: klein beim Gesunden, groß, wenn Blut an minderbelüfteter Lunge vorbeifließt.')),
    eq('aa', 'textbook', L('Alveolar–arterial difference', 'Alveoloarterielle Differenz'),
      [v('AaD')], [v('PAO2'), '−', v('PaO2')],
      L('Hypoventilation lowers PaO₂ with a normal A–a difference; shunt, V/Q mismatch and diffusion limitation widen it.', 'Hypoventilation senkt den PaO₂ bei normaler A-a-Differenz; Shunt, Verteilungsstörung und Diffusionsstörung vergrößern sie.')),
    eq('content', 'textbook', L('Oxygen content', 'Sauerstoffgehalt'),
      [v('CaO2')], ['1.34', '·', v('Hb'), '·', v('SaO2'), '+', '0.0225', '·', v('PaO2')],
      L('Almost all O₂ rides on haemoglobin. Anaemia halves the content at a perfectly normal PaO₂ and saturation; carbon monoxide takes haemoglobin out of service without lowering either.',
        'Fast aller O₂ ist an Hämoglobin gebunden. Eine Anämie halbiert den Gehalt bei völlig normalem PaO₂ und normaler Sättigung; Kohlenmonoxid nimmt Hämoglobin außer Dienst, ohne eines von beiden zu senken.')),
    eq('delivery', 'textbook', L('Oxygen delivery', 'Sauerstoffangebot'),
      [v('DO2')], [v('Q'), '·', v('CaO2'), '·', '10'],
      L('What the tissues are offered each minute: flow times content. Lungs, blood and heart each own one factor.', 'Was den Geweben pro Minute angeboten wird: Fluss mal Gehalt. Lunge, Blut und Herz verantworten je einen Faktor.')),
    eq('fick', 'textbook', L('Fick: the tissues take what they need', 'Fick: die Gewebe nehmen, was sie brauchen'),
      [v('CvO2')], [v('CaO2'), '−', frac([v('VO2')], ['10', '·', v('Q')])],
      L('With fixed consumption, a falling cardiac output lowers the venous O₂, and every shunt then returns poorer blood to the arteries: low output makes hypoxaemia worse.',
        'Bei festem Verbrauch senkt ein fallendes Herzzeitvolumen den venösen O₂, und jeder Shunt mischt dann ärmeres Blut bei: ein niedriges Herzzeitvolumen verschlimmert die Hypoxämie.')),
    eq('shunt', 'textbook', L('The shunt equation', 'Die Shuntgleichung'),
      [v('QsQt')], [frac([v('Cc'), '−', v('CaO2')], [v('Cc'), '−', v('CvO2')])],
      L('The fraction of the cardiac output that would have to bypass ideal lung to produce this arterial blood. Breathing more O₂ fixes low V/Q but not true shunt: blood that never meets gas cannot take up more of it.',
        'Der Anteil des Herzzeitvolumens, der an idealer Lunge vorbeifließen müsste, um dieses arterielle Blut zu ergeben. Mehr O₂ hilft bei niedrigem V/Q, aber nicht bei echtem Shunt: Blut, das nie auf Gas trifft, kann davon nicht mehr aufnehmen.')),
    eq('bohr', 'textbook', L('Dead space (Bohr–Enghoff)', 'Totraum (Bohr–Enghoff)'),
      [v('VDVT')], [frac([v('PaCO2'), '−', v('PECO2')], [v('PaCO2')])],
      L('Gas from unperfused alveoli contains no CO₂ and dilutes the expired air. An embolus makes alveolar dead space: end-tidal CO₂ falls far below arterial.',
        'Gas aus nicht durchbluteten Alveolen enthält kein CO₂ und verdünnt die Ausatemluft. Ein Embolus erzeugt alveolären Totraum: das endtidale CO₂ fällt weit unter das arterielle.')),
    eq('starling', 'textbook', L('Starling: water across the pulmonary capillary', 'Starling: Wasser über die Lungenkapillare'),
      [v('Jv')], [{ text: 'K_f' }, '·', paren(paren(v('Pcap'), '−', { text: 'P_i' }), '−', 'σ', '·', paren(v('piC'), '−', { text: 'π_i' }))],
      L('Capillary pressure follows left atrial pressure (P_c ≈ P_LA + 0.4·(P_PA − P_LA)). Lymph carries away a few times the normal filtration; beyond that water fills the interstitium (Kerley lines, stiff lungs), then the alveoli, from the bottom up. A leaky membrane (ARDS) floods at normal pressures.',
        'Der Kapillardruck folgt dem linksatrialen Druck (P_c ≈ P_LA + 0,4·(P_PA − P_LA)). Die Lymphe transportiert ein Mehrfaches der normalen Filtration ab; darüber füllt sich das Interstitium (Kerley-Linien, steife Lunge), dann die Alveolen, von basal nach apikal. Eine undichte Membran (ARDS) läuft schon bei normalen Drücken voll.')),
    eq('severinghaus', 'full', L('The O₂–haemoglobin dissociation curve', 'Die Sauerstoffbindungskurve'),
      [v('SaO2')], [frac(['1'], ['1', '+', frac(['23400'], [{ sup: [[{ text: 'P*' }], ['3']] }, '+', '150', '·', { text: 'P*' }])])],
      L('Severinghaus’s fit, with P* the O₂ tension in mmHg corrected to standard conditions: P* = P·10^(0.024(37−T) + 0.40(pH−7.4) + 0.06·log(40/PCO₂)). Acid, CO₂ and heat shift the curve right (Bohr effect: unloading in tissues); carbon monoxide shifts it left.',
        'Severinghaus’ Näherung, P* ist der O₂-Partialdruck in mmHg, korrigiert auf Standardbedingungen: P* = P·10^(0,024(37−T) + 0,40(pH−7,4) + 0,06·log(40/PCO₂)). Säure, CO₂ und Wärme verschieben die Kurve nach rechts (Bohr-Effekt: Abgabe im Gewebe); Kohlenmonoxid nach links.')),
    eq('unit', 'full', L('One lung unit: mass balance against the dissociation curves', 'Eine Lungeneinheit: Massenbilanz gegen die Bindungskurven'),
      [{ text: 'Q̇·(C_c′ − C_v̄)' }], [{ text: 'k·V̇_A·(P_I − P_A)' }],
      L('For O₂ and for CO₂ in every unit: what blood takes up equals what ventilation brings (or removes). The model solves both equations together in two units per lobe (a low and a high V/Q), plus the shunted and dead-space fractions, then mixes the blood. Hypoxic vasoconstriction moves perfusion away from hypoxic lobes before the next solution.',
        'Für O₂ und für CO₂ in jeder Einheit: was das Blut aufnimmt, entspricht dem, was die Ventilation bringt (oder abführt). Das Modell löst beide Gleichungen gemeinsam für zwei Einheiten pro Lappen (niedriges und hohes V/Q), dazu die Shunt- und Totraumanteile, und mischt dann das Blut. Die hypoxische Vasokonstriktion verschiebt die Perfusion vor der nächsten Lösung weg von hypoxischen Lappen.')),
  ],
  values: (ctx) => {
    const r = resp(ctx);
    const i = (r.inputs ?? {}) as Record<string, number>;
    const piC = 25 * ((i.albumin ?? 42) / 42);
    return {
      ...Object.fromEntries(Object.entries(ctx.model.respiratory)),
      PIO2: rn(ctx, 'PIO2'), PAO2: rn(ctx, 'PAO2ideal'), PaO2: rn(ctx, 'PaO2'), PaCO2: rn(ctx, 'PaCO2'), R: ctx.model.respiratory.RQ, AaD: rn(ctx, 'AaGradient'),
      SaO2: rn(ctx, 'SaO2') * 100, Hb: (i.Hb ?? NaN) / 10, CaO2: rn(ctx, 'CaO2'), CvO2: rn(ctx, 'CvO2'), SvO2: rn(ctx, 'SvO2') * 100, PvO2: rn(ctx, 'PvO2'),
      Q: i.CO ?? NaN, DO2: rn(ctx, 'DO2'), VO2: rn(ctx, 'VO2'),
      Cc: r.CaO2 != null && r.venousAdmixture != null ? (r.CaO2 - r.venousAdmixture * r.CvO2) / Math.max(0.01, 1 - r.venousAdmixture) : NaN,
      QsQt: rn(ctx, 'venousAdmixture'), shunt: rn(ctx, 'shunt'), PECO2: rn(ctx, 'PECO2'), VDVT: rn(ctx, 'VDVT'), EtCO2: rn(ctx, 'EtCO2'),
      RpulMult: rn(ctx, 'RpulMult'), Pcap: rn(ctx, 'Pcap'), Pla: i.Pla ?? NaN, Ppa: i.Ppa ?? NaN, piC, Jv: rn(ctx, 'filtration') / 4, interstitial: rn(ctx, 'interstitial'),
    };
  },
  diagram: 'vq',
  sources: ['West JB. Ventilation/perfusion relationships. Am Rev Respir Dis 1977;116:919–43.', 'Severinghaus JW. Simple, accurate equations for human blood O₂ dissociation computations. J Appl Physiol 1979;46:599–602.', 'Kelman GR. Digital computer procedure for the conversion of PCO₂ into blood CO₂ content. Respir Physiol 1967;3:111–5.', 'Staub NC. Pulmonary edema. Physiol Rev 1974;54:678–811.'],
};

/* ---- respiration: control of breathing ----------------------------------------------------------------- */
const CONTROL: ModelDef = {
  id: 'control', title: L('Control of breathing', 'Atemregulation'),
  summary: L('The brainstem sets ventilation from three signals: CO₂ (sensed as the pH of the cerebrospinal fluid by the central chemoreceptors), and arterial pH and O₂ (sensed by the carotid bodies). Receptors in the lung itself add drive when it is inflamed, flooded or stiff. Where the controller’s response meets the metabolic hyperbola of the lungs, breathing settles; the muscles and airways decide how much of the requested ventilation actually arrives.',
    'Der Hirnstamm stellt die Ventilation nach drei Signalen ein: CO₂ (von den zentralen Chemorezeptoren als pH des Liquors gemessen) sowie arteriellem pH und O₂ (von den Glomera carotica). Rezeptoren in der Lunge selbst steigern den Antrieb, wenn sie entzündet, geflutet oder steif ist. Wo die Antwort des Reglers auf die metabolische Hyperbel der Lunge trifft, pendelt sich die Atmung ein; Muskulatur und Atemwege entscheiden, wie viel der angeforderten Ventilation tatsächlich ankommt.'),
  groups: [
    { id: 'centre', label: L('Respiratory centre', 'Atemzentrum') },
    { id: 'metabolism', label: L('Metabolism', 'Stoffwechsel') },
  ],
  variables: [
    RP('control', 'centre', 'drive', 'd', L('Central drive (lowered by opioids, sedatives)', 'Zentraler Antrieb (durch Opioide, Sedativa vermindert)'), '× normal', 0, 2.5, 0.05),
    RP('control', 'centre', 'gCO2', 'g_{CO2}', L('Central CO₂ sensitivity', 'Zentrale CO₂-Empfindlichkeit'), '/kPa', 0, 4, 0.1),
    RP('control', 'centre', 'gH', 'g_H', L('Peripheral [H⁺] sensitivity', 'Periphere [H⁺]-Empfindlichkeit'), 'L/nmol', 0, 0.3, 0.01),
    RP('control', 'centre', 'gO2', 'g_{O2}', L('Hypoxic sensitivity (carotid bodies)', 'Hypoxische Empfindlichkeit (Glomus caroticum)'), '× normal', 0, 3, 0.1),
    RP('control', 'metabolism', 'metabolicRate', 'M', L('Metabolic rate (fever, sepsis, exercise)', 'Stoffwechselrate (Fieber, Sepsis, Belastung)'), '× resting', 0.5, 5, 0.05),
    RP('control', 'metabolism', 'RQ', 'R', L('Respiratory quotient', 'Respiratorischer Quotient'), '', 0.7, 1.0, 0.01),
    state('control', { key: 'PaCO2', symbol: 'P_{aCO2}', label: L('Arterial CO₂ tension', 'Arterieller CO₂-Partialdruck'), unit: 'kPa', digits: 2 }),
    state('control', { key: 'PaCO2set', symbol: 'P_{CO2,set}', label: L('CO₂ the central chemoreceptors defend', 'Von den zentralen Chemorezeptoren verteidigtes CO₂'), unit: 'kPa', digits: 2 }),
    state('control', { key: 'H', symbol: '[H^+]', label: L('Arterial hydrogen ion', 'Arterielle Wasserstoffionen'), unit: 'nmol/L', digits: 0 }),
    state('control', { key: 'PaO2', symbol: 'P_{aO2}', label: L('Arterial O₂ tension', 'Arterieller O₂-Partialdruck'), unit: 'kPa', digits: 1 }),
    state('control', { key: 'aff', symbol: 'A_{lung}', label: L('Drive from the lung’s own receptors', 'Antrieb aus den Lungenrezeptoren'), unit: '', digits: 2 }),
    state('control', { key: 'demand', symbol: 'V̇_{E,demand}', label: L('Ventilation the centre asks for', 'Vom Zentrum angeforderte Ventilation'), unit: 'L/min', digits: 1 }),
    state('control', { key: 'capacity', symbol: 'V̇_{E,max}', label: L('Sustainable ventilation', 'Dauerhaft leistbare Ventilation'), unit: 'L/min', digits: 0 }),
    state('control', { key: 'VE', symbol: 'V̇_E', label: L('Ventilation delivered', 'Erreichte Ventilation'), unit: 'L/min', digits: 1 }),
    state('control', { key: 'VCO2', symbol: 'V̇_{CO2}', label: L('CO₂ production', 'CO₂-Produktion'), unit: 'mL/min', digits: 0 }),
    state('control', { key: 'chemo', symbol: 'χ', label: L('Chemoreflex drive to the heart', 'Chemoreflexantrieb aufs Herz'), unit: '0–1', digits: 2 }),
  ],
  equations: [
    eq('controller', 'textbook', L('The controller: what the brainstem asks for', 'Der Regler: was der Hirnstamm anfordert'),
      [v('demand')], ['6.4', '·', frac([v('VCO2')], ['200']), '·', v('drive'), '·', paren('1', '+', v('drive'), '·', paren(v('gCO2'), '·', paren(v('PaCO2'), '−', v('PaCO2set')), '+', v('gH'), '·', paren(v('H'), '−', '40')), '+', { text: 'hyp(P_aO2)' }, '+', v('aff'))],
      L('Ventilation in proportion to CO₂ production, raised by CO₂ above the defended level and by acid, by hypoxaemia (a hyperbola that only rises steeply below ~8 kPa) and by drive from the lung itself. Below the defended CO₂ the response is much flatter. Opioids lower the drive and the slope.',
        'Ventilation proportional zur CO₂-Produktion, gesteigert durch CO₂ über dem verteidigten Wert und durch Säure, durch Hypoxämie (eine Hyperbel, die erst unter ~8 kPa steil ansteigt) und durch Antrieb aus der Lunge selbst. Unterhalb des verteidigten CO₂ ist die Antwort viel flacher. Opioide senken Antrieb und Steilheit.')),
    eq('hyperbola', 'textbook', L('The plant: the metabolic hyperbola', 'Die Regelstrecke: die metabolische Hyperbel'),
      [v('PaCO2')], [frac(['0.115', '·', v('VCO2')], [v('mechanics.VA')])],
      L('Breathing settles where the controller line crosses this hyperbola. Metabolic acidosis lifts the controller line (Kussmaul breathing); opioids flatten it; a bicarbonate chronically raised in COPD moves the CO₂ the central chemoreceptors defend upward.',
        'Die Atmung pendelt sich dort ein, wo die Reglergerade die Hyperbel schneidet. Eine metabolische Azidose hebt die Reglergerade (Kussmaul-Atmung); Opioide machen sie flacher; ein bei COPD chronisch erhöhtes Bikarbonat verschiebt das von den zentralen Chemorezeptoren verteidigte CO₂ nach oben.')),
    eq('setpoint', 'textbook', L('The CO₂ the central chemoreceptors defend', 'Das von den zentralen Chemorezeptoren verteidigte CO₂'),
      [v('PaCO2set')], ['5.33', '·', frac([{ text: '24 + 0.5·(HCO₃⁻ − 24)' }], ['24'])],
      L('The chemoreceptors read CSF pH. CSF bicarbonate follows the blood’s halfway over days, so in chronic hypercapnia they come to defend a higher CO₂. Winters’ formula for metabolic acidosis (PaCO₂ ≈ 1.5·HCO₃⁻ + 8 mmHg) comes out of this controller; it is not put in.',
        'Die Chemorezeptoren messen den pH des Liquors. Das Liquorbikarbonat folgt dem des Blutes über Tage zur Hälfte; bei chronischer Hyperkapnie verteidigen sie daher ein höheres CO₂. Die Winters-Formel für die metabolische Azidose (PaCO₂ ≈ 1,5·HCO₃⁻ + 8 mmHg) ergibt sich aus diesem Regler; sie ist nicht hineingeschrieben.')),
    eq('delivered', 'textbook', L('What arrives: limited by muscles and airways', 'Was ankommt: begrenzt durch Muskulatur und Atemwege'),
      [v('VE')], [frac([v('demand')], [{ fn: 'sqrt', args: ['1', '+', { sup: [[paren(frac([v('demand')], [v('capacity')]))], ['2']] }] }])],
      L('Sustainable ventilation is about 45 % of the maximal voluntary ventilation (≈ 37·FEV₁), less with weak muscles or a hyperinflated chest. As demand approaches it, ventilation falls behind and CO₂ rises: ventilatory failure.',
        'Dauerhaft leistbar sind etwa 45 % des Atemgrenzwerts (≈ 37·FEV₁), weniger bei schwacher Muskulatur oder überblähtem Thorax. Nähert sich der Bedarf dieser Grenze, bleibt die Ventilation zurück und das CO₂ steigt: ventilatorisches Versagen.')),
  ],
  values: (ctx) => {
    const r = resp(ctx);
    const i = (r.inputs ?? {}) as Record<string, number>;
    const sbc = i.sbc ?? 24;
    const hco3 = sbc + 0.75 * ((r.PaCO2 ?? 5.33) - 5.33);
    const pH = 6.1 + Math.log10(hco3 / (0.23 * (r.PaCO2 ?? 5.33)));
    const Pmm = (r.PaO2 ?? 12) * 7.5;
    const chemo = Math.max(0, Math.min(1, 0.6 * Math.min(3, 20 * Math.max(0, 1 / Math.max(4, Pmm - 25) - 1 / 65)) + 0.3 * Math.max(0, (r.PaCO2 ?? 5.33) - 6.5)));
    return {
      ...Object.fromEntries(Object.entries(ctx.model.respiratory)),
      PaCO2: rn(ctx, 'PaCO2'), PaCO2set: 5.33 * (24 + 0.5 * (sbc - 24)) / 24, H: 10 ** (9 - pH), PaO2: rn(ctx, 'PaO2'),
      aff: rn(ctx, 'afferent'), demand: rn(ctx, 'demand'), capacity: rn(ctx, 'capacity'), VE: rn(ctx, 'VE'), VCO2: rn(ctx, 'VCO2'),
      chemo: typeof ctx.snap?.chemoDrive === 'number' ? ctx.snap.chemoDrive : chemo,
    };
  },
  diagram: 'control',
  sources: ['Cherniack NS, Longobardo GS. Mathematical models of periodic breathing and their usefulness in understanding cardiovascular and respiratory disorders. Exp Physiol 2006;91:295–305.', 'Albert M, Dell R, Winters RW. Quantitative displacement of acid–base equilibrium in metabolic acidosis. Ann Intern Med 1967;66:312–22.', 'Duffin J. Measuring the respiratory chemoreflexes in humans. Respir Physiol Neurobiol 2011;177:71–9.'],
};

export const MODELS: ModelDef[] = [PATIENT, HAEMODYNAMICS, BAROREFLEX, ELECTRICAL, MECHANICS, GAS_EXCHANGE, CONTROL, WATER, KIDNEY, FLUIDS, FUELS, INFLAMMATION, BLOOD, LIVER, ENDOCRINE, VOR, PUPIL, NERVOUS];
export const MODEL_BY_ID: Record<string, ModelDef> = Object.fromEntries(MODELS.map((m) => [m.id, m]));
export const VARIABLE_BY_ID: Record<string, VariableDef> = Object.fromEntries(MODELS.flatMap((m) => m.variables.map((x) => [x.id, x])));
/** Parameters by where they live in the PatientModel ('respiratory.FiO2'). */
export const VARIABLE_BY_KEY: Record<string, VariableDef> = Object.fromEntries(MODELS.flatMap((m) => m.variables.filter((x) => x.kind === 'parameter').map((x) => [x.key, x])));

/** Resolve a symbol in an equation: local key first, then a full id. */
export function variableOf(model: ModelDef, ref: string): VariableDef | undefined {
  return model.variables.find((x) => x.id.endsWith(`.${ref}`) && x.kind === 'state') ?? model.variables.find((x) => x.id.endsWith(`.${ref}`)) ?? VARIABLE_BY_ID[ref];
}
