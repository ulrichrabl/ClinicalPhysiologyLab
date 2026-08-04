import type { MechanismContribution, PhysiologicalEffect } from '../../contracts/effects.ts';
import type { CausalReference, EffectSource } from '../../contracts/provenance.ts';
import { createEffectId, asSimTime, type SimTime } from '../../contracts/brands.ts';

export interface ChannelState {
  K: number;
  Ca: number;
  ICP: number;
  MAP: number;
  CPP: number;
  betaBlocker: number;
  atropine: number;
  vasopressor: number;
}

export interface ActiveMechanismDisplay {
  id: string;
  name: string;
  short: string;
  why: string;
  to: string;
  from: string;
  level: 'info' | 'warn' | 'danger';
  status: string;
}

type ChannelMechanism = {
  id: string;
  name: string;
  short: string;
  why: string;
  from: string;
  to: string;
  when: (p: ChannelState) => boolean;
  severity: (p: ChannelState) => 'info' | 'warn' | 'danger';
  state: (p: ChannelState) => string;
  effects: (p: ChannelState, onset: SimTime, source: EffectSource) => PhysiologicalEffect[];
};

function effect(
  target: string,
  operation: PhysiologicalEffect['operation'],
  value: number,
  onset: SimTime,
  source: EffectSource,
  provenance: CausalReference[],
  prefix: string,
  mechanismId = 'channel',
): PhysiologicalEffect {
  return {
    id: createEffectId({
      mechanismId,
      port: target,
      slot: prefix,
    }),
    source,
    target: target as PhysiologicalEffect['target'],
    operation,
    value,
    onset,
    provenance,
  };
}

/**
 * Channel-driven mechanisms (chemistry, ICP, drugs).
 * They emit typed physiological effects — never private solver parameters.
 */
export const CHANNEL_MECHANISMS: ChannelMechanism[] = [
  {
    id: 'k-ecg',
    from: 'K', to: 'cardio',
    name: 'Potassium → repolarisation',
    short: 'K⁺ shapes the T wave and QRS width',
    why: 'Extracellular K⁺ sets the resting membrane potential. Raising it makes '
      + 'repolarisation faster and steeper (tall, peaked T waves), then slows phase-0 '
      + 'upstroke as sodium channels inactivate — the QRS widens and P waves flatten. '
      + 'Low K⁺ does the opposite: prolonged repolarisation, flat T, prominent U wave.',
    when: (p) => p.K < 3.3 || p.K > 5.3,
    severity: (p) => (p.K > 6.5 || p.K < 2.6 ? 'danger' : 'warn'),
    state: (p) => (p.K > 5.3 ? `K⁺ ${p.K.toFixed(1)} — hyperkalaemic` : `K⁺ ${p.K.toFixed(1)} — hypokalaemic`),
    effects: (p, onset, source) => {
      const provenance: CausalReference[] = [
        { kind: 'mechanism', id: 'k-ecg' },
        { kind: 'state', path: `chemistry.K=${p.K}` },
      ];
      return [effect('chemistry.extracellularPotassium', 'exclusive', p.K, onset, source, provenance, 'k')];
    },
  },
  {
    id: 'ca-qt',
    from: 'Ca', to: 'cardio',
    name: 'Calcium → plateau duration',
    short: 'Ca²⁺ sets the ST segment length',
    why: 'The plateau of the ventricular action potential is carried by L-type Ca²⁺ '
      + 'current. Hypocalcaemia lengthens it — a long, flat ST segment and prolonged QT '
      + 'without changing the T wave itself. Hypercalcaemia shortens the ST until the T '
      + 'wave sits almost on the QRS.',
    when: (p) => p.Ca < 2.15 || p.Ca > 2.65,
    severity: (p) => (p.Ca < 1.8 || p.Ca > 3.0 ? 'danger' : 'warn'),
    state: (p) => `Ca²⁺ ${p.Ca.toFixed(2)} — QT ${p.Ca < 2.2 ? 'prolonged' : 'shortened'}`,
    effects: (p, onset, source) => {
      const provenance: CausalReference[] = [
        { kind: 'mechanism', id: 'ca-qt' },
        { kind: 'state', path: `chemistry.Ca=${p.Ca}` },
      ];
      const stFactor = 1 + (2.4 - p.Ca) * 0.55;
      return [effect('electrophysiology.stDurationFactor', 'exclusive', stFactor, onset, source, provenance, 'ca')];
    },
  },
  {
    id: 'cushing',
    from: 'ICP', to: 'cardio',
    name: 'Cushing reflex',
    short: 'Rising ICP drives hypertension and reflex bradycardia',
    why: 'When intracranial pressure approaches arterial pressure the brainstem is '
      + 'hypoperfused. The sympathetic response raises systemic pressure to restore '
      + 'cerebral perfusion; baroreceptors then answer that hypertension with vagal '
      + 'bradycardia. Hypertension + bradycardia + irregular breathing is the triad — '
      + 'it is a late and ominous sign.',
    when: (p) => p.ICP > 20,
    severity: (p) => (p.ICP > 35 ? 'danger' : 'warn'),
    state: (p) => `ICP ${Math.round(p.ICP)} mmHg — CPP ${Math.round(p.CPP)}`,
    effects: (p, onset, source) => {
      const drive = Math.min(1, (p.ICP - 20) / 25);
      const provenance: CausalReference[] = [
        { kind: 'mechanism', id: 'cushing' },
        { kind: 'state', path: `neurological.ICP=${p.ICP}` },
      ];
      return [
        effect('vascular.systemicArteriolarTone', 'multiply', 1 + drive * 0.55, onset, source, provenance, 'cush-art'),
        effect('autonomic.cardiacAcceleratorDrive', 'multiply', 1 - drive * 0.42, onset, source, provenance, 'cush-hr'),
      ];
    },
  },
  {
    id: 'cpp',
    from: 'MAP', to: 'neuro',
    name: 'Cerebral perfusion',
    short: 'CPP = MAP − ICP',
    why: 'The brain is perfused by the difference between what pushes blood in and what '
      + 'presses on it from outside. Below about 50 mmHg autoregulation fails and flow '
      + 'follows pressure passively — which is why a hypotensive episode is so much more '
      + 'dangerous in a swollen brain than in a healthy one.',
    when: (p) => p.CPP < 60,
    severity: (p) => (p.CPP < 45 ? 'danger' : 'warn'),
    state: (p) => `CPP ${Math.round(p.CPP)} mmHg — autoregulation ${p.CPP < 50 ? 'failed' : 'strained'}`,
    effects: () => [], // display-only for now; ischaemia flag is a neuro concern
  },
  {
    id: 'beta-block',
    from: 'betaBlocker', to: 'cardio',
    name: 'Beta blockade',
    short: 'β₁ blockade slows the node and weakens the beat',
    why: 'Blocking β₁ receptors removes the sympathetic contribution to sinus rate, AV '
      + 'conduction and contractility at once. Rate falls, the PR interval lengthens, and '
      + 'the ventricle contracts less forcefully — which lowers cardiac output but also '
      + 'lowers myocardial oxygen demand. That trade is the whole therapeutic point.',
    when: (p) => p.betaBlocker > 0.02,
    severity: (p) => (p.betaBlocker > 0.7 ? 'warn' : 'info'),
    state: (p) => `β-blockade ${Math.round(p.betaBlocker * 100)}%`,
    effects: (p, onset, source) => {
      const provenance: CausalReference[] = [
        { kind: 'mechanism', id: 'beta-block' },
        { kind: 'state', path: `pharmacology.betaBlocker=${p.betaBlocker}` },
      ];
      return [
        effect('autonomic.cardiacAcceleratorDrive', 'multiply', 1 - p.betaBlocker * 0.38, onset, source, provenance, 'bb-hr'),
        effect('cardiovascular.contractility', 'multiply', 1 - p.betaBlocker * 0.34, onset, source, provenance, 'bb-emax'),
        effect('cardiovascular.avConduction', 'multiply', 1 - p.betaBlocker * 0.45, onset, source, provenance, 'bb-av'),
      ];
    },
  },
  {
    id: 'atropine',
    from: 'atropine', to: 'cardio',
    name: 'Vagolysis',
    short: 'Atropine removes vagal brake on the SA and AV nodes',
    why: 'Atropine is a muscarinic antagonist. It cannot make the heart contract harder — '
      + 'ventricular myocardium has almost no vagal supply — but it releases the nodes '
      + 'from parasympathetic restraint, so rate rises and AV conduction improves. This '
      + 'is why it works for sinus bradycardia and nodal block, and fails in infranodal '
      + 'block where the lesion is below the vagally innervated tissue.',
    when: (p) => p.atropine > 0.02,
    severity: () => 'info',
    state: (p) => `Atropine ${Math.round(p.atropine * 100)}%`,
    effects: (p, onset, source) => {
      const provenance: CausalReference[] = [
        { kind: 'mechanism', id: 'atropine' },
        { kind: 'state', path: `pharmacology.atropine=${p.atropine}` },
      ];
      return [
        effect('autonomic.cardiacAcceleratorDrive', 'multiply', 1 + p.atropine * 0.62, onset, source, provenance, 'atr-hr'),
        effect('cardiovascular.avConduction', 'multiply', 1 + p.atropine * 0.35, onset, source, provenance, 'atr-av'),
      ];
    },
  },
  {
    id: 'pressor',
    from: 'vasopressor', to: 'cardio',
    name: 'Vasopressor support',
    short: 'α₁ agonism raises systemic vascular resistance',
    why: 'Constricting arterioles raises resistance and therefore mean pressure at any '
      + 'given cardiac output. It buys perfusion pressure, but it also raises the load '
      + 'the ventricle ejects against — in a failing heart that can lower stroke volume '
      + 'even as the blood pressure number looks better.',
    when: (p) => p.vasopressor > 0.02,
    severity: () => 'info',
    state: (p) => `Vasopressor ${Math.round(p.vasopressor * 100)}%`,
    effects: (p, onset, source) => {
      const provenance: CausalReference[] = [
        { kind: 'mechanism', id: 'pressor' },
        { kind: 'state', path: `pharmacology.vasopressor=${p.vasopressor}` },
      ];
      return [
        effect('vascular.systemicArteriolarTone', 'multiply', 1 + p.vasopressor * 0.9, onset, source, provenance, 'vp'),
      ];
    },
  },
];

export function resolveChannelMechanisms(
  channels: ChannelState,
  simTime: SimTime = asSimTime(0),
): MechanismContribution[] {
  const source: EffectSource = { type: 'regulatory', systemId: 'channel-mechanisms' };
  const out: MechanismContribution[] = [];
  for (const m of CHANNEL_MECHANISMS) {
    let live = false;
    try { live = m.when(channels); } catch { live = false; }
    if (!live) continue;
    const effects = m.effects(channels, simTime, source);
    out.push({
      mechanismId: m.id,
      displayName: m.name,
      provenance: [{ kind: 'mechanism', id: m.id }],
      effects,
    });
  }
  return out;
}

export function activeChannelDisplays(channels: ChannelState): ActiveMechanismDisplay[] {
  return CHANNEL_MECHANISMS.filter((m) => {
    try { return m.when(channels); } catch { return false; }
  }).map((m) => ({
    id: m.id,
    name: m.name,
    short: m.short,
    why: m.why,
    to: m.to,
    from: m.from,
    level: m.severity(channels),
    status: m.state(channels),
  }));
}
