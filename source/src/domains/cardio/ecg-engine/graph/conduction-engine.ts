import type {
  CardiacEvent,
  CardiacRegion,
  ConductionEdge,
  ElectricalNode,
  MechanismModifiers,
  MechanicalTrigger,
} from '../types/index.ts';
import { createBaselineGraph, createAccessoryPathway } from '../graph/baseline-graph.ts';
import { anisotropicTravelMs } from '../graph/anisotropy.ts';
import { SeededRng } from '../rng/seeded.ts';

export interface PendingImpulse {
  arrivalMs: number;
  targetNodeId: string;
  sourceNodeId: string;
  edgeId: string;
  orderKey: number;
}

export interface ConductionState {
  nodes: Map<string, ElectricalNode>;
  edges: ConductionEdge[];
  regions: Map<string, CardiacRegion>;
  pending: PendingImpulse[];
  events: CardiacEvent[];
  mechanicalTriggers: MechanicalTrigger[];
  lastBeatOrigin: string;
  wenckebachCounter: number;
  mobitzDropNext: boolean;
  afPhase: number;
  flutterPhase: number;
  accessoryActive: boolean;
}

export class ConductionEngine {
  state: ConductionState;
  private rng: SeededRng;
  private timeMs = 0;
  private saPhase = 0;
  private afPhase = 0;
  private flutterPhase = 0;
  private afNextEarliest = 0;
  private rhythmMode = 'sinus';
  private targetCycleMs = 833;
  private modifiers: MechanismModifiers = {};
  private wenckebachRatio = 4;
  private accessoryEdge: ConductionEdge | null = null;

  constructor(regions: CardiacRegion[], rng: SeededRng) {
    const { nodes, edges } = createBaselineGraph();
    this.rng = rng;
    this.state = {
      nodes: new Map(nodes.map((n) => [n.id, { ...n }])),
      edges: edges.map((e) => ({ ...e })),
      regions: new Map(regions.map((r) => [r.id, { ...r }])),
      pending: [],
      events: [],
      mechanicalTriggers: [],
      lastBeatOrigin: 'sa',
      wenckebachCounter: 0,
      mobitzDropNext: false,
      afPhase: 0,
      flutterPhase: 0,
      accessoryActive: false,
    };
  }

  setModifiers(m: MechanismModifiers): void {
    this.modifiers = m;
    if (m.sa_cycle_length_ms != null) this.targetCycleMs = m.sa_cycle_length_ms;
  }

  setRhythm(mode: string, hrOverride?: number): void {
    this.rhythmMode = mode;
    if (hrOverride) this.targetCycleMs = 60000 / hrOverride;
    else if (mode === 'sinus' || mode === 'wenckebach' || mode === 'mobitz2') {
      this.targetCycleMs = 833;
    }
  }

  getCycleMs(): number {
    return this.targetCycleMs;
  }

  getRhythmMode(): string {
    return this.rhythmMode;
  }

  enableAccessoryPathway(fraction: number, delayMs: number): void {
    if (fraction <= 0) {
      if (this.accessoryEdge) {
        this.state.edges = this.state.edges.filter((e) => e.id !== 'acc_edge');
        this.state.nodes.delete('accessory_pathway');
      }
      this.accessoryEdge = null;
      this.state.accessoryActive = false;
      return;
    }
    if (!this.accessoryEdge) {
      const { node, edge } = createAccessoryPathway('ra_focus', 'lv_anterolateral', delayMs);
      this.state.nodes.set(node.id, node);
      this.state.edges.push(edge);
      this.accessoryEdge = edge;
    }
    this.accessoryEdge.baseDelayMs = Math.min(45, Math.max(25, delayMs));
    this.accessoryEdge.blockFraction = 1 - fraction;
    this.state.accessoryActive = true;
  }

  reset(): void {
    this.timeMs = 0;
    this.saPhase = 0;
    for (const n of this.state.nodes.values()) {
      n.state = 'ready';
      n.lastActivationMs = undefined;
      n.phaseMs = 0;
    }
    for (const r of this.state.regions.values()) {
      r.activationTimeMs = undefined;
      r.repolarizationTimeMs = undefined;
    }
    this.state.pending = [];
    this.state.events = [];
    this.state.mechanicalTriggers = [];
    this.state.wenckebachCounter = 0;
  }

  /** Align electrical clock with the synthesis clock after a pathology swap. */
  jumpTo(timeMs: number): void {
    this.timeMs = timeMs;
    this.saPhase = 0.98; // next automatic beat almost immediately
    this.afPhase = 0;
    this.flutterPhase = 0;
    this.afNextEarliest = timeMs;
    for (const n of this.state.nodes.values()) {
      n.state = 'ready';
      n.lastActivationMs = undefined;
      n.phaseMs = 0;
    }
    for (const r of this.state.regions.values()) {
      r.activationTimeMs = undefined;
      r.repolarizationTimeMs = undefined;
    }
    this.state.pending = [];
    this.state.events = [];
    this.state.mechanicalTriggers = [];
  }

  advance(dtMs: number): void {
    const endTime = this.timeMs + dtMs;
    const subStep = 2;
    while (this.timeMs < endTime) {
      const step = Math.min(subStep, endTime - this.timeMs);
      this.timeMs += step;
      this.state.events = [];
      this.state.mechanicalTriggers = [];

      this.processAutomaticity(step);
      this.processPendingImpulses();
      this.updateRefractory(step);

      if (this.rhythmMode === 'af') this.processAF(step);
      if (this.rhythmMode === 'aflutter') this.processFlutter(step);
      if (this.rhythmMode === 'chb') this.processCHB(step);
      if (this.rhythmMode === 'vt') this.processVT(step);
      if (this.rhythmMode === 'vf') this.processVF(step);
    }
  }

  getTimeMs(): number {
    return this.timeMs;
  }

  private processAutomaticity(dtMs: number): void {
    if (this.rhythmMode === 'vt' || this.rhythmMode === 'vf' || this.rhythmMode === 'chb') return;
    if (this.rhythmMode === 'af' || this.rhythmMode === 'aflutter') {
      // AV node receives irregular atrial impulses — handled in AF/flutter
      return;
    }

    const sa = this.state.nodes.get('sa');
    if (!sa || sa.state === 'suppressed') return;

    const cycle = this.targetCycleMs * (1 + (this.modifiers.sa_exit_block_fraction ?? 0) * 0.5);
    this.saPhase += dtMs / cycle;
    if (this.saPhase >= 1) {
      this.saPhase -= 1;
      if (this.rhythmMode === 'wenckebach') {
        this.state.wenckebachCounter++;
      }
      this.clearCycleRegions();
      this.activateNode('sa', 'automatic');
    }
  }

  private activateNode(nodeId: string, origin: string): void {
    const node = this.state.nodes.get(nodeId);
    if (!node || node.state === 'absolute_refractory' || node.state === 'blocked') return;
    if (node.excitability <= 0) return;

    node.state = 'activated';
    node.lastActivationMs = this.timeMs;
    node.state = 'absolute_refractory';
    this.state.lastBeatOrigin = origin;

    this.state.events.push({
      timeMs: this.timeMs,
      type: 'activation',
      nodeId,
      beatOrigin: origin,
    });

    // Activate source regions for atrial nodes; ventricular tree for Purkinje.
    // Ipsilateral trees so BBB delay actually staggers LV vs RV (dense mesh).
    if (node.id === 'lv_pkje') {
      this.activateVentricularTree(
        ['lv_anterolateral', 'lv_inferolateral', 'lv_apical'],
        this.timeMs,
        this.modifiers.left_bundle_delay_ms ?? 0,
        'LV',
      );
    } else if (node.id === 'rv_pkje') {
      this.activateVentricularTree(
        ['rv_outflow', 'rv_fw_basal', 'rv_fw_apical'],
        this.timeMs,
        this.modifiers.right_bundle_delay_ms ?? 0,
        'RV',
      );
    } else if (node.id === 'accessory_pathway') {
      const origin = node.sourceRegionIds[0] ?? 'lv_anterolateral';
      this.activateVentricularTree([origin], this.timeMs, 0, 'all');
    } else if (node.id === 'sa' || node.type === 'sa') {
      this.activateAtrialTree(this.timeMs);
    } else {
      for (const rid of node.sourceRegionIds) {
        this.activateRegion(rid, this.timeMs);
      }
    }

    // Schedule downstream conduction
    for (const edge of this.state.edges) {
      if (edge.sourceNodeId !== nodeId) continue;
      if (this.shouldBlockEdge(edge)) continue;
      const delay = this.computeDelay(edge, node);
      this.state.pending.push({
        arrivalMs: this.timeMs + delay,
        targetNodeId: edge.targetNodeId,
        sourceNodeId: nodeId,
        edgeId: edge.id,
        orderKey: this.state.pending.length,
      });
    }

    // Mechanical trigger for chamber nodes
    this.emitMechanicalTrigger(node);
  }

  private activateRegion(regionId: string, timeMs: number, allowRetrigger = false): void {
    /* Dense mesh: graph nodes still name parent seeds (lv_anterior); expand to patches. */
    const targets = this.resolveRegions(regionId);
    for (const region of targets) {
      if (region.activationTimeMs != null) {
        if (!allowRetrigger) continue;
        if (timeMs - region.activationTimeMs < 60) continue;
      }
      region.activationTimeMs = timeMs;
      const apd = region.actionPotentialDurationMs + (this.modifiers.global_apd_offset_ms ?? 0);
      let apdAdj = 0;
      if (region.id.includes('_epi')) apdAdj = -45;
      else if (region.id.includes('_endo')) apdAdj = 25;
      else if (region.chamber === 'septum') apdAdj = 10;
      else if (region.chamber === 'LV' || region.chamber === 'RV') apdAdj = -8;
      region.repolarizationTimeMs = timeMs + apd + apdAdj;
    }
  }

  /** Exact id or all dense-mesh children of a parent seed. */
  private resolveRegions(regionId: string): CardiacRegion[] {
    const exact = this.state.regions.get(regionId);
    if (exact) return [exact];
    const out: CardiacRegion[] = [];
    const prefix = regionId + '_p';
    for (const [id, r] of this.state.regions) {
      if (id.startsWith(prefix)) out.push(r);
    }
    return out;
  }

  private originCenter(oid: string): [number, number, number] | null {
    const targets = this.resolveRegions(oid);
    if (targets.length === 0) return null;
    let x = 0, y = 0, z = 0;
    for (const r of targets) {
      x += r.center[0]; y += r.center[1]; z += r.center[2];
    }
    const n = targets.length;
    return [x / n, y / n, z / n];
  }

  /**
   * Sinus atrial activation: RA high → RA low → Bachmann → LA.
   * Without this only sa.sourceRegionIds (ra_high/mid) fire and P vanishes in II.
   */
  private activateAtrialTree(baseMs: number): void {
    /* Only RA/LA seeds — never septum (ias is chamber septum and would
       inject a premature QRS lobe into the P wave). */
    const waves: Array<{ ids: string[]; delay: number }> = [
      { ids: ['ra_high', 'ra_mid'], delay: 0 },
      { ids: ['ra_low', 'ra_fw', 'crista', 'cs_region'], delay: 22 },
      { ids: ['bachmann', 'la_high', 'rpvein', 'lpvein'], delay: 45 },
      { ids: ['la_ant', 'la_lat', 'la_post', 'la_inf', 'la_append'], delay: 60 },
    ];
    for (const w of waves) {
      for (const id of w.ids) this.activateRegion(id, baseMs + w.delay);
    }
  }

  private activateVentricularTree(
    originIds: string[],
    baseMs: number,
    extraDelayMs = 0,
    side: 'LV' | 'RV' | 'all' = 'all',
  ): void {
    const velScale = this.modifiers.global_conduction_scale ?? 1;
    const origins = originIds.map((oid) => this.originCenter(oid)).filter(Boolean) as [number, number, number][];
    if (origins.length === 0) return;
    const pending: Array<{ id: string; t: number }> = [];
    for (const [, r] of this.state.regions) {
      if (r.chamber === 'RA' || r.chamber === 'LA') continue;
      if (side === 'LV' && r.chamber === 'RV') continue;
      if (side === 'RV' && r.chamber === 'LV') continue;
      /* Septum: allow both sides; earlier activation wins. */
      if (r.activationTimeMs != null) continue;
      let travel = Infinity;
      for (const o of origins) {
        travel = Math.min(travel, anisotropicTravelMs(o, r, velScale));
      }
      if (!Number.isFinite(travel)) travel = 40;
      const [cx, cy, cz] = r.center;
      /* Anisotropy + hard transmural stagger (origins sit on the seed; travel≈0 alone). */
      let delay = extraDelayMs + travel;
      if (r.id.includes('_endo')) delay -= 6;
      else if (r.id.includes('_epi')) delay += 14;
      delay += Math.max(0, cx) * 2.6;
      delay += Math.max(0, -cy - 1.0) * 2.4;
      delay += Math.max(0, cz) * 1.1;
      if (r.chamber === 'septum' || r.id.includes('sept')) delay -= 12;
      if (r.chamber === 'RV') delay += 5;
      pending.push({ id: r.id, t: baseMs + delay });
    }
    pending.sort((a, b) => a.t - b.t);
    for (const p of pending) this.activateRegion(p.id, p.t);
  }

  private processPendingImpulses(): void {
    this.state.pending.sort((a, b) => a.arrivalMs - b.arrivalMs || a.orderKey - b.orderKey);
    const remaining: PendingImpulse[] = [];
    for (const imp of this.state.pending) {
      if (imp.arrivalMs > this.timeMs) {
        remaining.push(imp);
        continue;
      }
      if (imp.targetNodeId.startsWith('region:')) {
        this.activateRegion(imp.targetNodeId.slice(7), imp.arrivalMs);
      } else {
        this.activateNode(imp.targetNodeId, 'conducted');
      }
    }
    this.state.pending = remaining;
  }

  private shouldBlockEdge(edge: ConductionEdge): boolean {
    const block = (this.modifiers.av_node_block_fraction ?? 0) + edge.blockFraction;
    if (this.rhythmMode === 'wenckebach' && edge.pathwayType === 'av_nodal') {
      if (this.state.wenckebachCounter >= this.wenckebachRatio) {
        this.state.wenckebachCounter = 0;
        return true;
      }
    }
    if (this.rhythmMode === 'mobitz2' && edge.pathwayType === 'av_nodal') {
      if (this.rng.next() < 0.3) return true;
    }
    if (block >= 1) return true;
    if (block > 0 && this.rng.next() < block) return true;
    return false;
  }

  private computeDelay(edge: ConductionEdge, source: ElectricalNode): number {
    let delay = edge.baseDelayMs / edge.velocityScale;

    if (edge.sourceNodeId === 'lbb' || edge.targetNodeId === 'lbb') {
      delay += this.modifiers.left_bundle_delay_ms ?? 0;
    }
    if (edge.sourceNodeId === 'rbb' || edge.targetNodeId === 'rbb') {
      delay += this.modifiers.right_bundle_delay_ms ?? 0;
    }
    if (edge.pathwayType === 'av_nodal') {
      delay += this.modifiers.av_node_delay_ms ?? 0;
    }
    if (edge.pathwayType === 'accessory') {
      delay += this.modifiers.accessory_pathway_delay_ms ?? 0;
    }

    if (edge.decremental && source.lastActivationMs != null) {
      const r = Math.min(1, (this.timeMs - source.lastActivationMs) / source.absoluteRefractoryMs);
      if (r < edge.minimumRecoveryForConduction) return 1e9;
      delay += edge.recoveryDependentDelay * (1 / Math.max(r, 0.05) - 1);
    }
    return Math.min(delay, 500);
  }

  private emitMechanicalTrigger(node: ElectricalNode): void {
    let chamber: MechanicalTrigger['chamber'] | null = null;
    if (node.type === 'sa' || node.sourceRegionIds.some((r) => r.startsWith('ra'))) chamber = 'RA';
    if (node.id === 'av_fast' || node.id === 'av_slow') chamber = 'LA';
    if (node.id === 'lbb' || node.id === 'lv_pkje' || node.type === 'fascicle') chamber = 'LV';
    if (node.id === 'rbb' || node.id === 'rv_pkje') chamber = 'RV';
    if (node.type === 'ventricular_focus') chamber = 'LV';

    if (!chamber) return;
    const lbbDelay = this.modifiers.left_bundle_delay_ms ?? 0;
    const rbbDelay = this.modifiers.right_bundle_delay_ms ?? 0;
    const synchrony = chamber === 'LV' ? 1 / (1 + lbbDelay / 100) : chamber === 'RV' ? 1 / (1 + rbbDelay / 100) : 1;

    this.state.mechanicalTriggers.push({
      activationTimeMs: this.timeMs,
      chamber,
      activationFraction: node.excitability,
      synchrony,
      contractilityScale: 1,
      ectopic: node.type === 'ventricular_focus' || node.type === 'atrial_focus',
      paced: node.type === 'device_electrode',
    });
  }

  private updateRefractory(dtMs: number): void {
    for (const node of this.state.nodes.values()) {
      if (node.state === 'absolute_refractory' && node.lastActivationMs != null) {
        if (this.timeMs - node.lastActivationMs >= node.absoluteRefractoryMs) {
          node.state = 'relative_refractory';
        }
      }
      if (node.state === 'relative_refractory' && node.lastActivationMs != null) {
        if (this.timeMs - node.lastActivationMs >= node.absoluteRefractoryMs + node.relativeRefractoryMs) {
          node.state = 'ready';
        }
      }
    }

    // Reset regional activations after full cycle for next beat
    const cycleEnd = this.targetCycleMs * 1.5;
    for (const r of this.state.regions.values()) {
      if (r.activationTimeMs != null && this.timeMs - r.activationTimeMs > cycleEnd + (r.repolarizationTimeMs ?? 0) - (r.activationTimeMs ?? 0)) {
        r.activationTimeMs = undefined;
        r.repolarizationTimeMs = undefined;
      }
    }
  }

  private processAF(dtMs: number): void {
    this.afPhase += dtMs;
    const activity = this.modifiers.af_source_activity ?? 1;
    /* Fast atrial ticks; sparse AV conduction + absolute refractory → ~70–120 bpm. */
    const atrialTick = 72 / activity;
    if (this.afPhase > atrialTick) {
      this.afPhase = 0;
      const foci = ['ra_high', 'ra_mid', 'la_ant', 'la_post', 'la_append', 'ra_low', 'la_lat', 'crista'];
      /* Several wavelets per tick — f-waves are model-derived atrial activations. */
      const nFire = 1 + this.rng.int(0, 2);
      for (let k = 0; k < nFire; k++) {
        const focus = foci[this.rng.int(0, foci.length - 1)];
        this.activateRegion(focus, this.timeMs + k * 2, true);
      }
      let lastVent = -1e9;
      for (const r of this.state.regions.values()) {
        if (r.chamber === 'RA' || r.chamber === 'LA') continue;
        if (r.activationTimeMs != null) lastVent = Math.max(lastVent, r.activationTimeMs);
      }
      const refractory = this.timeMs < this.afNextEarliest || this.timeMs - lastVent < 260;
      const conduct = !refractory
        && this.rng.next() > 0.8 + (this.modifiers.av_node_block_fraction ?? 0) * 0.1;
      if (conduct) {
        /* Keep atrial activations alive — clearing them erased truthful f-waves. */
        this.clearVentricularRegions();
        this.activateVentricularTree(
          ['lv_anterolateral', 'lv_inferolateral', 'lv_apical', 'rv_outflow'],
          this.timeMs,
          0,
          'all',
        );
        /* Variable AV concealment → irregularly irregular RR (~60–130). */
        this.afNextEarliest = this.timeMs + 320 + this.rng.int(0, 420);
        this.state.events.push({
          timeMs: this.timeMs, type: 'activation', nodeId: 'his', beatOrigin: 'conducted',
        });
        this.state.mechanicalTriggers.push({
          activationTimeMs: this.timeMs, chamber: 'LV', activationFraction: 1,
          synchrony: 0.9, contractilityScale: 1, ectopic: false, paced: false,
        });
      }
    }
  }

  private processFlutter(dtMs: number): void {
    const cycle = this.modifiers.flutter_cycle_length_ms ?? 200;
    this.flutterPhase += dtMs;
    if (this.flutterPhase >= cycle) {
      this.flutterPhase -= cycle;
      for (const rid of ['ra_low', 'ra_mid', 'la_post', 'ias']) {
        this.activateRegion(rid, this.timeMs);
      }
      const ratio = 2 + this.rng.int(0, 2);
      if (Math.floor(this.timeMs / cycle) % ratio === 0) {
        this.clearCycleRegions();
        this.activateVentricularTree(
          ['lv_anterolateral', 'lv_inferolateral', 'lv_apical'],
          this.timeMs,
          0,
        );
      }
    }
  }

  private processCHB(dtMs: number): void {
    const sa = this.state.nodes.get('sa');
    if (sa) {
      const cycle = this.targetCycleMs;
      this.saPhase += dtMs / cycle;
      if (this.saPhase >= 1) {
        this.saPhase -= 1;
        for (const rid of ['ra_high', 'ra_mid', 'ra_low', 'la_ant']) {
          this.activateRegion(rid, this.timeMs, true);
        }
      }
    }
    const escape = this.state.nodes.get('vent_escape');
    if (escape) {
      escape.phaseMs += dtMs;
      const escCycle = escape.intrinsicCycleLengthMs ?? 1500;
      if (escape.phaseMs >= escCycle) {
        escape.phaseMs = 0;
        /* Clear only ventricular activation so atrial P can continue. */
        for (const r of this.state.regions.values()) {
          if (r.chamber !== 'RA' && r.chamber !== 'LA') {
            r.activationTimeMs = undefined;
            r.repolarizationTimeMs = undefined;
          }
        }
        this.activateVentricularTree(['lv_inferoseptal', 'lv_inferior'], this.timeMs, 0);
        this.state.mechanicalTriggers.push({
          activationTimeMs: this.timeMs, chamber: 'LV', activationFraction: 1,
          synchrony: 0.5, contractilityScale: 0.85, ectopic: true, paced: false,
        });
      }
    }
  }

  private processVT(dtMs: number): void {
    const origin = this.modifiers.vt_origin_region ?? 'lv_inferior';
    const cycle = this.targetCycleMs;
    this.saPhase += dtMs / cycle;
    if (this.saPhase >= 1) {
      this.saPhase -= 1;
      this.clearCycleRegions();
      this.activateVentricularTree([origin], this.timeMs, 0);
      this.state.mechanicalTriggers.push({
        activationTimeMs: this.timeMs, chamber: 'LV', activationFraction: 1,
        synchrony: 0.55, contractilityScale: 1, ectopic: true, paced: false,
      });
    }
  }

  private processVF(dtMs: number): void {
    const activity = this.modifiers.vf_activity ?? 1;
    if (this.rng.next() < 0.08 * activity) {
      const ids = [...this.state.regions.keys()].filter((k) => !k.startsWith('ra') && !k.startsWith('la'));
      const rid = ids[this.rng.int(0, ids.length - 1)];
      const r = this.state.regions.get(rid);
      if (r) {
        r.activationTimeMs = this.timeMs;
        r.repolarizationTimeMs = this.timeMs + 80;
      }
    }
  }

  clearCycleRegions(): void {
    for (const r of this.state.regions.values()) {
      r.activationTimeMs = undefined;
      r.repolarizationTimeMs = undefined;
    }
  }

  clearVentricularRegions(): void {
    for (const r of this.state.regions.values()) {
      if (r.chamber === 'RA' || r.chamber === 'LA') continue;
      r.activationTimeMs = undefined;
      r.repolarizationTimeMs = undefined;
    }
  }
}