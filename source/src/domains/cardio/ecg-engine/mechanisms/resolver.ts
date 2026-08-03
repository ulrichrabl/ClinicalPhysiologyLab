import type {
  ConditionConfig,
  MechanismDefinition,
  MechanismModifiers,
  SharedPhysiology,
} from '../types/index.ts';
import type { CardiacRegion } from '../types/index.ts';
import {
  createAllRegions,
  TERRITORY_PARENTS,
  WALL_PARENTS,
  regionsMatchingParents,
} from '../regions/definitions.ts';
import { getMechanism } from './registry.ts';

/** Resolve mechanism modifiers and apply to regions (spec §16). */
export class MechanismResolver {
  private active: Array<{ def: MechanismDefinition; severity: number; expression: number }> = [];
  private regions: CardiacRegion[];

  constructor() {
    this.regions = createAllRegions();
  }

  getRegions(): CardiacRegion[] {
    return this.regions;
  }

  setConditions(conditions: ConditionConfig[]): void {
    this.active = [];
    for (const c of conditions) {
      const def = getMechanism(c.id);
      if (def) this.active.push({ def, severity: c.severity, expression: c.expression });
    }
    if (this.active.length === 0) {
      const normal = getMechanism('normal');
      if (normal) this.active.push({ def: normal, severity: 0, expression: 1 });
    }
    this.applyToRegions();
  }

  setPathology(id: string): void {
    const def = getMechanism(id);
    if (!def) return;
    this.active = [{ def, severity: def.defaultSeverity, expression: def.defaultExpression }];
    this.applyToRegions();
  }

  resolveModifiers(physiology: SharedPhysiology): MechanismModifiers {
    const out: MechanismModifiers = {};
    for (const { def, severity, expression } of this.active) {
      const scale = severity * expression;
      for (const [k, v] of Object.entries(def.modifiers)) {
        if (typeof v === 'number') {
          const cur = (out[k as keyof MechanismModifiers] as number | undefined) ?? 0;
          if (k.includes('scale') || k.includes('fraction') || k.includes('availability')) {
            (out as Record<string, number>)[k] = cur + v * scale;
          } else if (k.includes('delay') || k.includes('offset')) {
            (out as Record<string, number>)[k] = cur + v * scale;
          } else {
            (out as Record<string, number>)[k] = Math.max(cur, v * scale);
          }
        }
      }
    }

    // Mechanical feedback (spec §14.2)
    if (physiology.mechanics.rightAtrialPressure > 8) {
      out.right_atrial_dilation = Math.max(out.right_atrial_dilation ?? 0,
        (physiology.mechanics.rightAtrialPressure - 8) / 15);
    }
    if (physiology.mechanics.pulmonaryVascularResistance > 0.12) {
      out.rv_pressure_load = Math.max(out.rv_pressure_load ?? 0,
        (physiology.mechanics.pulmonaryVascularResistance - 0.075) / 0.2);
    }

    // Electrolyte effects
    out.potassium_effect = Math.max(out.potassium_effect ?? 0, physiology.metabolism.potassiumEffect);
    out.sodium_channel_availability = physiology.metabolism.sodiumChannelAvailability;

    return out;
  }

  getPrimaryRhythm(): { mode: string; hrOverride?: number; params?: Record<string, number> } {
    for (const { def } of this.active) {
      if (def.rhythmMode) {
        return { mode: def.rhythmMode, hrOverride: def.hrOverride, params: def.params };
      }
    }
    return { mode: 'sinus' };
  }

  getActiveIds(): string[] {
    return this.active.map((a) => a.def.id);
  }

  getParams(): Record<string, number> {
    const p: Record<string, number> = {};
    for (const { def } of this.active) {
      if (def.params) Object.assign(p, def.params);
    }
    return p;
  }

  private applyToRegions(): void {
    this.regions = createAllRegions();
    for (const { def, severity, expression } of this.active) {
      const scale = severity * expression;
      const m = def.modifiers;

      if (m.lv_hypertrophy_scale) this.scaleRegions(['lv_'], m.lv_hypertrophy_scale * scale);
      if (m.rv_hypertrophy_scale) this.scaleRegions(['rv_'], m.rv_hypertrophy_scale * scale);
      if (m.atrial_mass_scale) this.scaleRegions(['ra_', 'la_'], m.atrial_mass_scale * scale);

      if (def.ischemiaTerritories) {
        for (const iso of def.ischemiaTerritories) {
          const parents = iso.territory in TERRITORY_PARENTS
            ? TERRITORY_PARENTS[iso.territory]
            : WALL_PARENTS[(iso as { wall?: string }).wall ?? iso.territory] ?? [];
          const matched = regionsMatchingParents(this.regions, parents);
          for (const r of matched) {
            if (iso.layer === 'endo' && !r.id.includes('_endo')) continue;
            if (iso.layer === 'epi' && !r.id.includes('_epi')) continue;
            const deg = iso.degree * scale;
            const trans = iso.transmurality ?? m.ischemia_transmurality ?? 1;
            if (iso.layer === 'endo') {
              r.injuryCurrent = -0.55 * deg;
              r.actionPotentialDurationMs += 20 * deg;
            } else if (trans >= 0.8) {
              r.injuryCurrent = 0.8 * deg;
              r.actionPotentialDurationMs -= 25 * deg;
            } else {
              r.injuryCurrent = 0.45 * deg * trans;
            }
            r.localConductionScale *= 1 - 0.3 * deg;
          }
        }
      }

      if (def.necrosisTerritories) {
        for (const nec of def.necrosisTerritories) {
          const parents = TERRITORY_PARENTS[nec.territory] ?? [];
          for (const r of regionsMatchingParents(this.regions, parents)) {
            r.scarFraction = nec.degree * scale;
            r.viableFraction = 1 - r.scarFraction;
            r.electricalMass *= 1 - 0.7 * r.scarFraction;
          }
        }
      }

      if (m.rvot_electrical_abnormality) {
        for (const r of regionsMatchingParents(this.regions, ['rv_outflow', 'rv_ot_anterior', 'rv_fw_basal'])) {
          r.injuryCurrent = 0.85 * m.rvot_electrical_abnormality * scale;
          r.notchScale = 1.5;
          r.actionPotentialDurationMs -= 55 * scale;
        }
      }

      if (m.global_apd_offset_ms) {
        for (const r of this.regions) {
          r.actionPotentialDurationMs += m.global_apd_offset_ms * scale;
        }
      }
    }
  }

  private scaleRegions(prefixes: string[], factor: number): void {
    for (const r of this.regions) {
      if (prefixes.some((p) => r.id.startsWith(p))) {
        r.electricalMass *= factor;
      }
    }
  }
}
