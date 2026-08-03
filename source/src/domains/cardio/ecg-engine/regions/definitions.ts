import type { CardiacRegion } from '../types/index.ts';
import {
  createDenseRegions,
  TERRITORY_PARENTS,
  WALL_PARENTS,
  regionsMatchingParents,
  parentIdOf,
  meshStats,
} from './mesh.ts';

/** Dense mid-scale mesh (~300 patches). */
export function createAllRegions(): CardiacRegion[] {
  return createDenseRegions();
}

export function createAtrialRegions(): CardiacRegion[] {
  return createDenseRegions().filter((r) => r.chamber === 'RA' || r.chamber === 'LA');
}

export function createVentricularRegions(): CardiacRegion[] {
  return createDenseRegions().filter((r) => r.chamber !== 'RA' && r.chamber !== 'LA');
}

/** @deprecated use TERRITORY_PARENTS + regionsMatchingParents */
export const TERRITORY_MAP: Record<string, string[]> = TERRITORY_PARENTS;
/** @deprecated use WALL_PARENTS + regionsMatchingParents */
export const WALL_MAP: Record<string, string[]> = WALL_PARENTS;

export {
  TERRITORY_PARENTS,
  WALL_PARENTS,
  regionsMatchingParents,
  parentIdOf,
  meshStats,
  createDenseRegions,
};
