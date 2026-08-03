import type { ConductionEdge, ElectricalNode } from '../types/index.ts';

/** Baseline adult conduction graph (spec §10). */
export function createBaselineGraph(): { nodes: ElectricalNode[]; edges: ConductionEdge[] } {
  const nodes: ElectricalNode[] = [
    node('sa', 'sa', 833, ['ra_high', 'ra_mid']),
    node('ra_focus', 'atrial_focus', undefined, ['ra_low']),
    node('av_fast', 'av_fast', undefined, ['la_post']),
    node('av_slow', 'av_slow', undefined, ['la_post']),
    node('his', 'his', undefined, ['septum_basal']),
    node('lbb', 'bundle', undefined, ['lbb_root']),
    node('rbb', 'bundle', undefined, ['rbb_root']),
    node('laf', 'fascicle', undefined, ['septum_mid']),
    node('lpf', 'fascicle', undefined, ['lv_inferior']),
    node('lv_pkje', 'purkinje_root', undefined, ['lv_anterolateral', 'lv_inferolateral', 'lv_apical']),
    node('rv_pkje', 'purkinje_root', undefined, ['rv_outflow', 'rv_free_basal', 'rv_free_apical']),
    node('junctional', 'atrial_focus', 1200, ['septum_basal']),
    node('vent_escape', 'ventricular_focus', 1500, ['lv_inferoseptal']),
  ];

  const edges: ConductionEdge[] = [
    edge('sa_ra', 'sa', 'ra_focus', 15, 'normal'),
    edge('ra_avf', 'ra_focus', 'av_fast', 60, 'av_nodal', 0.85),
    edge('ra_avs', 'ra_focus', 'av_slow', 75, 'av_nodal', 0.85),
    edge('avf_his', 'av_fast', 'his', 55, 'av_nodal', 0.35, false),
    edge('avs_his', 'av_slow', 'his', 80, 'av_nodal', 0.35, true),
    edge('his_lbb', 'his', 'lbb', 8, 'his_purkinje'),
    edge('his_rbb', 'his', 'rbb', 8, 'his_purkinje'),
    edge('lbb_laf', 'lbb', 'laf', 12, 'his_purkinje'),
    edge('lbb_lpf', 'lbb', 'lpf', 12, 'his_purkinje'),
    edge('lbb_lv', 'lbb', 'lv_pkje', 18, 'his_purkinje'),
    edge('rbb_rv', 'rbb', 'rv_pkje', 18, 'his_purkinje'),
    edge('laf_lv', 'laf', 'lv_pkje', 25, 'his_purkinje'),
    edge('lpf_lv', 'lpf', 'lv_pkje', 28, 'his_purkinje'),
  ];

  return { nodes, edges };
}

function node(
  id: string,
  type: ElectricalNode['type'],
  cycleMs: number | undefined,
  regions: string[],
): ElectricalNode {
  return {
    id,
    type,
    state: 'ready',
    intrinsicCycleLengthMs: cycleMs,
    phaseMs: 0,
    absoluteRefractoryMs: type === 'sa' ? 250 : type.includes('av') ? 200 : 180,
    relativeRefractoryMs: 80,
    overdriveSuppression: 0,
    excitability: 1,
    sourceRegionIds: regions,
  };
}

function edge(
  id: string,
  src: string,
  tgt: string,
  delay: number,
  pathway: ConductionEdge['pathwayType'],
  minRecovery = 0.3,
  decremental = false,
): ConductionEdge {
  return {
    id,
    sourceNodeId: src,
    targetNodeId: tgt,
    direction: 'forward',
    baseDelayMs: delay,
    velocityScale: 1,
    decremental,
    recoveryDependentDelay: decremental ? 40 : 0,
    minimumRecoveryForConduction: minRecovery,
    refractoryUntilMs: 0,
    blockFraction: 0,
    pathwayType: pathway,
  };
}

/** Accessory pathway for WPW. */
export function createAccessoryPathway(
  atrialNode: string,
  ventricularRegion: string,
  delayMs: number,
): { node: ElectricalNode; edge: ConductionEdge } {
  const id = 'accessory_pathway';
  return {
    node: {
      id,
      type: 'ventricular_focus',
      state: 'ready',
      phaseMs: 0,
      absoluteRefractoryMs: 220,
      relativeRefractoryMs: 60,
      overdriveSuppression: 0,
      excitability: 1,
      sourceRegionIds: [ventricularRegion],
    },
    edge: {
      id: 'acc_edge',
      sourceNodeId: atrialNode,
      targetNodeId: id,
      direction: 'forward',
      /* Short atrial→ventricular jump so pre-excitation beats the AV node. */
      baseDelayMs: Math.min(45, Math.max(25, delayMs)),
      velocityScale: 1,
      decremental: false,
      recoveryDependentDelay: 0,
      minimumRecoveryForConduction: 0.15,
      refractoryUntilMs: 0,
      blockFraction: 0,
      pathwayType: 'accessory',
    },
  };
}
