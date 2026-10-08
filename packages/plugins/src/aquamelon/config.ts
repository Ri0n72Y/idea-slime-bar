import type { ElementVector } from './types'

export const TREE_ROOT_PREFERENCE: ElementVector = [0.8, 1, 0.85, 0.75, 1, 0.7, 0.9]
export const TREE_AFFINITY: ElementVector = [0.85, 1.15, 0.9, 0.75, 1.2, 0.7, 0.95]
export const LEAF_AFFINITY: ElementVector = [0.75, 1.1, 1, 0.85, 1.3, 0.9, 0.8]
export const REPRODUCTIVE_AFFINITY: ElementVector = [1, 1, 1, 1, 1, 1, 1]

export const SOIL_CAPACITY = 100
// Rate and time are independent: changing tick:time never rescales per-Tick absorption.
export interface AquamelonBalance {
  'tick:time': {
    gameMinutesPerTick: number
    realMillisecondsPerTick: number
  }
  soilRetentionPerTick: number
  treeRetentionPerTick: number
  maxTotalAbsorbPerTick: number
  ballHalfLifeTicks: number
  ballMinAmount: number
  ballMaxAmount: number
  budCheckMode: 'perTick' | 'daily04'
}

// Genshin's confirmed historic numeric baseline, now expressed in 1-hour Ticks.
// The new 1/3/7-day targets still require gameplay calibration (not silently locked here).
export const GENSHIN_BALANCE: AquamelonBalance = {
  'tick:time': { gameMinutesPerTick: 60, realMillisecondsPerTick: 3_600_000 },
  soilRetentionPerTick: 0.99,
  treeRetentionPerTick: 0.99,
  maxTotalAbsorbPerTick: 1,
  budCheckMode: 'daily04',
  ballHalfLifeTicks: 0.25,
  ballMinAmount: 8,
  ballMaxAmount: 10
}

// Browser-only accelerated trial profile; all stage thresholds and affinities are shared.
export const WEB_BALANCE: AquamelonBalance = {
  'tick:time': { gameMinutesPerTick: 60, realMillisecondsPerTick: 10_000 },
  soilRetentionPerTick: 0.99,
  treeRetentionPerTick: 0.9,
  maxTotalAbsorbPerTick: 6,
  budCheckMode: 'perTick',
  ballHalfLifeTicks: 8,
  ballMinAmount: 8,
  ballMaxAmount: 10
}
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

export const PROTOTYPE_GAPS = [
  'Green Fruit sink fallback: 0.85 midpoint inside the documented 0.80-0.90 range.',
  'Sapling Reserve cap and final reproductive Growth-rate calibration are still open; browser uses a separate faster per-Tick metabolism.',
  'Genshin 1/3/7-day rhythm is a new target, not yet validated against the historically confirmed per-Tick amounts.',
  'Structural Material ElementAmount is undefined until a source formula is designed.'
] as const
