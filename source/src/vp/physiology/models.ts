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

/* ---- body fluids and acid–base ----------------------------------------------------------------- */
const CHEM_VARS: Array<[string, string, LocalizedText, string, number, number, number]> = [
  ['sodium', 'Na^+', L('Sodium', 'Natrium'), 'mmol/L', 110, 170, 1], ['potassium', 'K^+', L('Potassium', 'Kalium'), 'mmol/L', 1.5, 9, 0.1],
  ['chloride', 'Cl^-', L('Chloride', 'Chlorid'), 'mmol/L', 80, 130, 1], ['bicarbonate', 'HCO_3^-', L('Bicarbonate', 'Bikarbonat'), 'mmol/L', 4, 45, 1],
  ['paCO2', 'P_{aCO2}', L('Arterial CO₂ tension', 'Arterieller CO₂-Partialdruck'), 'kPa', 2, 12, 0.1], ['paO2', 'P_{aO2}', L('Arterial O₂ tension', 'Arterieller O₂-Partialdruck'), 'kPa', 4, 60, 0.1],
  ['lactate', 'lac', L('Lactate', 'Laktat'), 'mmol/L', 0.3, 20, 0.1], ['glucose', 'glc', L('Glucose', 'Glukose'), 'mmol/L', 1, 40, 0.1],
  ['calcium', 'Ca^{2+}', L('Calcium', 'Kalzium'), 'mmol/L', 1.2, 3.5, 0.02], ['magnesium', 'Mg^{2+}', L('Magnesium', 'Magnesium'), 'mmol/L', 0.3, 2, 0.05],
  ['urea', 'urea', L('Urea', 'Harnstoff'), 'mmol/L', 1, 60, 0.5], ['creatinine', 'crea', L('Creatinine', 'Kreatinin'), 'µmol/L', 30, 1200, 5],
  ['albumin', 'alb', L('Albumin', 'Albumin'), 'g/L', 15, 55, 1], ['haemoglobin', 'Hb', L('Haemoglobin', 'Hämoglobin'), 'g/L', 40, 200, 1],
  ['whiteCellCount', 'WCC', L('White cell count', 'Leukozyten'), '10⁹/L', 0.5, 60, 0.1], ['platelets', 'plt', L('Platelets', 'Thrombozyten'), '10⁹/L', 5, 1000, 5],
  ['mcv', 'MCV', L('Mean cell volume', 'Mittleres Erythrozytenvolumen'), 'fL', 60, 120, 1], ['troponin', 'cTn', L('Troponin', 'Troponin'), 'ng/L', 0, 10000, 1],
  ['bnp', 'BNP', L('Natriuretic peptide', 'Natriuretisches Peptid'), 'ng/L', 0, 20000, 10],
];
const FLUIDS: ModelDef = {
  id: 'fluids', title: L('Body fluids, electrolytes and acid–base', 'Körperflüssigkeiten, Elektrolyte und Säure-Basen-Haushalt'),
  summary: L('Concentrations in plasma, set by what the body holds and what the circulation does to it. Bicarbonate and CO₂ set pH together; a failing circulation makes lactate; bleeding dilutes haemoglobin; a poorly perfused kidney retains urea.',
    'Konzentrationen im Plasma, bestimmt von dem, was der Körper enthält, und dem, was der Kreislauf damit macht. Bikarbonat und CO₂ bestimmen gemeinsam den pH; ein versagender Kreislauf bildet Laktat; Blutung verdünnt das Hämoglobin; eine minderdurchblutete Niere hält Harnstoff zurück.'),
  groups: [{ id: 'plasma', label: L('Plasma (pin a value to override what the circulation derives)', 'Plasma (Wert fixieren, um die Ableitung aus dem Kreislauf zu überschreiben)') }],
  variables: [
    ...CHEM_VARS.map(([k, sym, label, unit, min, max, step]) => param('fluids', 'plasma', { key: `chemistry.${k}`, symbol: sym, label, unit, min, max, step, digits: step < 0.1 ? 2 : step < 1 ? 1 : 0 })),
    state('fluids', { key: 'pH', symbol: 'pH', label: L('Arterial pH', 'Arterieller pH'), unit: '', digits: 2 }),
    state('fluids', { key: 'AG', symbol: 'AG', label: L('Anion gap', 'Anionenlücke'), unit: 'mmol/L', digits: 0 }),
  ],
  equations: [
    eq('hh', 'textbook', L('Henderson–Hasselbalch', 'Henderson-Hasselbalch'),
      [v('pH')], ['6.1', '+', { fn: 'log', args: [frac([v('bicarbonate')], ['0.23', '·', v('paCO2')])] }],
      L('pH depends on the ratio of bicarbonate (kidney) to dissolved CO₂ (lung), not on either alone. Compensation moves the other term to restore the ratio.',
        'Der pH hängt vom Verhältnis Bikarbonat (Niere) zu gelöstem CO₂ (Lunge) ab, nicht von einem allein. Kompensation verschiebt den anderen Term, um das Verhältnis wiederherzustellen.')),
    eq('ag', 'textbook', L('Anion gap', 'Anionenlücke'),
      [v('AG')], [v('sodium'), '−', paren(v('chloride'), '+', v('bicarbonate'))],
      L('The unmeasured anions. A raised gap with low bicarbonate means an added acid: lactate, ketones, toxins.', 'Die nicht gemessenen Anionen. Eine erhöhte Lücke bei niedrigem Bikarbonat bedeutet eine zugeführte Säure: Laktat, Ketone, Toxine.')),
  ],
  values: (ctx) => {
    const c = (ctx.view.chemistry ?? CHEMISTRY_DEFAULTS) as Record<string, number>;
    return { ...c, pH: hendersonHasselbalch(c.bicarbonate, c.paCO2), AG: c.sodium - (c.chloride + c.bicarbonate) };
  },
  diagram: 'acidbase',
  sources: ['Berend K et al. Physiological approach to assessment of acid–base disturbances. N Engl J Med 2014.'],
};

export const MODELS: ModelDef[] = [PATIENT, HAEMODYNAMICS, BAROREFLEX, ELECTRICAL, FLUIDS, VOR, PUPIL, NERVOUS];
export const MODEL_BY_ID: Record<string, ModelDef> = Object.fromEntries(MODELS.map((m) => [m.id, m]));
export const VARIABLE_BY_ID: Record<string, VariableDef> = Object.fromEntries(MODELS.flatMap((m) => m.variables.map((x) => [x.id, x])));

/** Resolve a symbol in an equation: local key first, then a full id. */
export function variableOf(model: ModelDef, ref: string): VariableDef | undefined {
  return model.variables.find((x) => x.id.endsWith(`.${ref}`) && x.kind === 'state') ?? model.variables.find((x) => x.id.endsWith(`.${ref}`)) ?? VARIABLE_BY_ID[ref];
}
