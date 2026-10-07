import type { ElementVector } from './types'

export const TREE_ROOT_PREFERENCE: ElementVector = [0.8, 1, 0.85, 0.75, 1, 0.7, 0.9]
export const TREE_AFFINITY: ElementVector = [0.85, 1.15, 0.9, 0.75, 1.2, 0.7, 0.95]
export const LEAF_AFFINITY: ElementVector = [0.75, 1.1, 1, 0.85, 1.3, 0.9, 0.8]
export const REPRODUCTIVE_AFFINITY: ElementVector = [1, 1, 1, 1, 1, 1, 1]

export const SOIL_CAPACITY = 100
export const SOIL_RETENTION_PER_HOUR = 0.99
export const TREE_RETENTION_PER_HOUR = 0.99
export const MAX_TOTAL_ABSORB_PER_HOUR = 1
export const SINGLE_ELEMENT_CAP_SHARE = 0.3
export const EXTRA_AFFINITY = 1
export const AFFINITY_INHERITANCE_RATE = 0.5

export const SEED_GROWTH_THRESHOLD = 45
export const SEEDLING_GROWTH_THRESHOLD = 90
export const SAPLING_GROWTH_CYCLE = 100
export const BUD_GROWTH_THRESHOLD = 20

export const LEAF_BUDGET_SHARE = 0.3
export const LARGE_LEAF_RETENTION = 0.6
export const FLOWER_SINK_SHARE = 0.5
export const MATURE_FRUIT_SINK_SHARE = 0.2

// The source of truth intentionally leaves Green Fruit at 80-90%.
export const PROTOTYPE_GREEN_FRUIT_SINK_SHARE = 0.85

export const SMALL_LEAF_HOURS = 12
export const FLOWER_BUD_AT_HOURS = 24
export const FLOWER_AT_HOURS = 48

export const BUD_CHANCE_BY_LEAF_COUNT = [0.8, 0.4, 0.01, 0] as const
// Match the documented v0 online settlement cadence; debug time controls replay this real path.
export const SETTLEMENT_SLICE_HOURS = 1 / 60

export const PROTOTYPE_GAPS = [
  'Absorption fallback: BaseAffinity caps + RootPreference weighted simultaneous normalization; Base vs Effective and final redistribution are not locked.',
  'Green Fruit sink fallback: 0.85 midpoint inside the documented 0.80-0.90 range.',
  'Sapling Reserve cap and final reproductive Growth-rate calibration are still open; v0 keeps Reserve uncapped and uses the documented 0.99/h metabolism directly.',
  'Post-harvest re-flowering is not designed; harvested fruit leaves do not automatically start another flower cycle.',
  'Structural Material ElementAmount is undefined until a source formula is designed.'
] as const
