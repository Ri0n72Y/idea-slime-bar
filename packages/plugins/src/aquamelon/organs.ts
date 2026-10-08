import {
  AFFINITY_INHERITANCE_RATE,
  BUD_CHANCE_BY_LEAF_COUNT,
  FLOWER_AT_HOURS,
  FLOWER_BUD_AT_HOURS,
  FLOWER_SINK_SHARE,
  LARGE_LEAF_RETENTION,
  LEAF_AFFINITY,
  MATURE_FRUIT_SINK_SHARE,
  PROTOTYPE_GREEN_FRUIT_SINK_SHARE,
  REPRODUCTIVE_AFFINITY,
  SMALL_LEAF_HOURS,
  type AquamelonBalance
} from './config'
import { appendLog, effectiveAffinity, inheritAffinity, nextId, nextRandom } from './state'
import type { AquamelonTree, ElementVector, Leaf, ReproductiveOrgan, WorldState } from './types'
import {
  addVector, cloneVector, multiplyVectors, scaleVector, sumVector, zeroVector
} from './vector'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export function makeLeaf(state: WorldState, tree: AquamelonTree): Leaf {
  const baseAffinity = inheritAffinity(
    LEAF_AFFINITY,
    tree.baseAffinity,
    tree.effectiveAffinity,
    AFFINITY_INHERITANCE_RATE
  )
  return {
    id: nextId(state, 'leaf'),
    stage: 'SmallLeaf',
    bornAtMs: state.nowMs,
    growth: zeroVector(),
    baseAffinity,
    effectiveAffinity: cloneVector(baseAffinity),
    reproductionStarted: false,
    fruitHarvestedAtMs: null,
    reproductive: null
  }
}

function makeFlowerBud(leaf: Leaf, nowMs: number): ReproductiveOrgan {
  const baseAffinity = inheritAffinity(
    REPRODUCTIVE_AFFINITY,
    leaf.baseAffinity,
    leaf.effectiveAffinity,
    AFFINITY_INHERITANCE_RATE
  )
  return {
    stage: 'FlowerBud',
    stageStartedAtMs: nowMs,
    growth: zeroVector(),
    baseAffinity,
    effectiveAffinity: cloneVector(baseAffinity),
    lockedAffinity: null,
    fruitElementAmount: zeroVector()
  }
}

export function updateElapsedLifecycle(state: WorldState, tree: AquamelonTree) {
  for (const leaf of tree.leaves) {
    const ageHours = (state.nowMs - leaf.bornAtMs) / HOUR_MS
    if (leaf.stage === 'SmallLeaf' && ageHours >= SMALL_LEAF_HOURS) {
      leaf.baseAffinity = cloneVector(leaf.effectiveAffinity)
      leaf.effectiveAffinity = cloneVector(leaf.baseAffinity)
      leaf.growth = zeroVector()
      leaf.stage = 'LargeLeaf'
      appendLog(state, leaf.id + ' -> LargeLeaf at 12h.')
    }
    if (!leaf.reproductionStarted && ageHours >= FLOWER_BUD_AT_HOURS) {
      leaf.reproductionStarted = true
      leaf.reproductive = makeFlowerBud(leaf, leaf.bornAtMs + FLOWER_BUD_AT_HOURS * HOUR_MS)
      appendLog(state, leaf.id + ' formed FlowerBud at 24h.')
    }
    if (!leaf.reproductive && leaf.fruitHarvestedAtMs !== null &&
      state.nowMs - leaf.fruitHarvestedAtMs >= DAY_MS) {
      leaf.reproductive = makeFlowerBud(leaf, leaf.fruitHarvestedAtMs + DAY_MS)
      leaf.fruitHarvestedAtMs = null
      appendLog(state, leaf.id + ' formed a new FlowerBud one game day after harvest.')
    }
    if (leaf.reproductive?.stage === 'FlowerBud' &&
      state.nowMs - leaf.reproductive.stageStartedAtMs >= (FLOWER_AT_HOURS - FLOWER_BUD_AT_HOURS) * HOUR_MS) {
      leaf.reproductive.stage = 'Flower'
      leaf.reproductive.stageStartedAtMs += (FLOWER_AT_HOURS - FLOWER_BUD_AT_HOURS) * HOUR_MS
      appendLog(state, leaf.id + ' FlowerBud reached bloom boundary -> Flower.')
    }
  }
}

function reproductiveSink(stage: ReproductiveOrgan['stage']) {
  if (stage === 'Flower') return FLOWER_SINK_SHARE
  if (stage === 'GreenFruit') return PROTOTYPE_GREEN_FRUIT_SINK_SHARE
  if (stage === 'MatureFruit') return MATURE_FRUIT_SINK_SHARE
  return 0
}

function growReproductive(state: WorldState, leaf: Leaf, nutrient: ElementVector) {
  const organ = leaf.reproductive
  if (!organ || organ.stage === 'FlowerBud') return
  const affinity = organ.lockedAffinity ?? organ.effectiveAffinity
  addVector(organ.growth, multiplyVectors(nutrient, affinity))

  if (organ.stage === 'Flower') {
    organ.effectiveAffinity = effectiveAffinity(organ.baseAffinity, organ.growth)
    if (sumVector(organ.growth) >= 30) {
      organ.stage = 'GreenFruit'
      organ.lockedAffinity = cloneVector(organ.effectiveAffinity)
      organ.stageStartedAtMs = state.nowMs
      appendLog(state, leaf.id + ' Flower reached 30 Growth -> Green Fruit; Affinity locked.')
    }
    return
  }

  addVector(organ.fruitElementAmount, nutrient)
  if (organ.stage === 'GreenFruit' && sumVector(organ.growth) >= 100) {
    organ.stage = 'MatureFruit'
    organ.stageStartedAtMs = state.nowMs
    leaf.stage = 'AquamelonLeaf'
    appendLog(state, leaf.id + ' Fruit reached 100 Growth -> Mature Aquamelon + fibrous parent leaf.')
  }
}

export function growLeafAndReproduction(state: WorldState, leaf: Leaf, leafBudget: ElementVector) {
  const sink = leaf.reproductive ? reproductiveSink(leaf.reproductive.stage) : 0
  const reproductiveBudget = scaleVector(leafBudget, sink)
  const ownBudget = scaleVector(leafBudget, 1 - sink)
  growReproductive(state, leaf, reproductiveBudget)

  const retention = leaf.stage === 'SmallLeaf' ? 1 : LARGE_LEAF_RETENTION
  const retained = scaleVector(ownBudget, retention)
  addVector(leaf.growth, multiplyVectors(retained, leaf.effectiveAffinity))
  leaf.effectiveAffinity = effectiveAffinity(leaf.baseAffinity, leaf.growth)
}

export function nextBudBoundaryMs(nowMs: number) {
  const date = new Date(nowMs)
  const boundary = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    4,
    0,
    0,
    0
  )
  return boundary > nowMs + 1 ? boundary : boundary + 24 * HOUR_MS
}

export function runBudCheck(state: WorldState, mode: AquamelonBalance['budCheckMode']) {
  const tree = state.tree
  if (!tree || tree.stage !== 'Sapling' || tree.budGrowth || tree.leaves.length >= 3) return
  if (mode === 'daily04') {
    const day = new Date(state.nowMs).toISOString().slice(0, 10)
    if (tree.lastBudCheckDay === day) return
    tree.lastBudCheckDay = day
  }
  const chance = BUD_CHANCE_BY_LEAF_COUNT[tree.leaves.length] ?? 0
  const roll = nextRandom(state)
  const label = mode === 'daily04' ? '04:00' : 'Tick'
  if (roll < chance) {
    tree.budGrowth = zeroVector()
    appendLog(state, label + ' bud check succeeded (' + Math.round(chance * 100) + '%).')
  } else {
    appendLog(state, label + ' bud check failed (' + Math.round(chance * 100) + '%).')
  }
}

