import {
  AFFINITY_INHERITANCE_RATE,
  BUD_CHANCE_BY_LEAF_COUNT,
  BUD_GROWTH_THRESHOLD,
  FLOWER_AT_HOURS,
  FLOWER_BUD_AT_HOURS,
  FLOWER_SINK_SHARE,
  LARGE_LEAF_RETENTION,
  LEAF_AFFINITY,
  LEAF_BUDGET_SHARE,
  MATURE_FRUIT_SINK_SHARE,
  MAX_TOTAL_ABSORB_PER_HOUR,
  PROTOTYPE_GREEN_FRUIT_SINK_SHARE,
  REPRODUCTIVE_AFFINITY,
  SAPLING_GROWTH_CYCLE,
  SEED_GROWTH_THRESHOLD,
  SEEDLING_GROWTH_THRESHOLD,
  SETTLEMENT_SLICE_HOURS,
  SINGLE_ELEMENT_CAP_SHARE,
  SMALL_LEAF_HOURS,
  SOIL_CAPACITY,
  SOIL_RETENTION_PER_HOUR,
  TREE_RETENTION_PER_HOUR,
  TREE_ROOT_PREFERENCE
} from './config'
import {
  appendLog,
  effectiveAffinity,
  inheritAffinity,
  nextId,
  nextRandom
} from './state'
import type {
  AquamelonTree,
  ElementVector,
  Leaf,
  ReproductiveOrgan,
  WorldState
} from './types'
import {
  addVector,
  cloneVector,
  multiplyVectors,
  scaleVector,
  subtractVector,
  sumVector,
  zeroVector
} from './vector'

const HOUR_MS = 60 * 60 * 1000
const EPSILON = 1e-8

function normalizeSoil(state: WorldState) {
  if (!state.soil) return
  const total = sumVector(state.soil.elems)
  if (total <= SOIL_CAPACITY) return
  state.soil.elems = scaleVector(state.soil.elems, SOIL_CAPACITY / total)
  appendLog(state, 'Soil normalized to capacity 100.')
}

function decaySoil(state: WorldState, dtHours: number) {
  if (!state.soil) return
  state.soil.elems = scaleVector(state.soil.elems, SOIL_RETENTION_PER_HOUR ** dtHours)
}

function decayBalls(state: WorldState, dtHours: number) {
  const factor = 0.5 ** ((dtHours * 60) / 15)
  for (const ball of state.balls) ball.elems = scaleVector(ball.elems, factor)
  state.balls = state.balls.filter((ball) => sumVector(ball.elems) >= 1)
}

// Explicit v0 fallback for the two absorption choices that current docs leave open.
function calculateAbsorption(
  soil: ElementVector,
  baseAffinity: ElementVector,
  dtHours: number
): ElementVector {
  const maxTotal = MAX_TOTAL_ABSORB_PER_HOUR * dtHours
  const candidate = soil.map((supply, index) => {
    const cap = MAX_TOTAL_ABSORB_PER_HOUR * SINGLE_ELEMENT_CAP_SHARE * baseAffinity[index] * dtHours
    return Math.min(supply * TREE_ROOT_PREFERENCE[index], cap)
  }) as ElementVector
  const total = sumVector(candidate)
  return total > maxTotal ? scaleVector(candidate, maxTotal / total) : candidate
}

function absorbFromSoil(state: WorldState, tree: AquamelonTree, dtHours: number) {
  if (!state.soil) return zeroVector()
  const absorbed = calculateAbsorption(state.soil.elems, tree.baseAffinity, dtHours)
  subtractVector(state.soil.elems, absorbed)
  return absorbed
}

function updateTreeStage(state: WorldState, tree: AquamelonTree) {
  const total = sumVector(tree.growth)
  if (tree.stage === 'Seed' && total >= SEED_GROWTH_THRESHOLD) {
    tree.baseAffinity = cloneVector(tree.effectiveAffinity)
    tree.effectiveAffinity = cloneVector(tree.baseAffinity)
    tree.growth = zeroVector()
    tree.stage = 'Seedling'
    appendLog(state, 'Seed reached 45 Growth -> Seedling.')
  } else if (tree.stage === 'Seedling' && total >= SEEDLING_GROWTH_THRESHOLD) {
    tree.baseAffinity = cloneVector(tree.effectiveAffinity)
    tree.effectiveAffinity = cloneVector(tree.baseAffinity)
    tree.growth = zeroVector()
    tree.reserve = zeroVector()
    tree.stage = 'Sapling'
    tree.activity = 'Dormant'
    appendLog(state, 'Seedling reached 90 Growth -> Sapling. Reserve is now active.')
  }
}

export function updateTreeGrowthCycle(state: WorldState, tree: AquamelonTree) {
  tree.effectiveAffinity = effectiveAffinity(tree.baseAffinity, tree.growth)
  if (sumVector(tree.growth) < SAPLING_GROWTH_CYCLE) return
  tree.baseAffinity = cloneVector(tree.effectiveAffinity)
  tree.effectiveAffinity = cloneVector(tree.baseAffinity)
  tree.growth = zeroVector()
  appendLog(state, 'Sapling completed a 100 Growth affinity cycle.')
}

export function pinchBud(state: WorldState) {
  const tree = state.tree
  if (!tree?.budGrowth) return false
  addVector(tree.growth, tree.budGrowth)
  tree.budGrowth = null
  updateTreeGrowthCycle(state, tree)
  appendLog(state, 'Active Bud pinched; Bud Growth returned to TREE_Growth.')
  return true
}

function makeLeaf(state: WorldState, tree: AquamelonTree): Leaf {
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

function updateElapsedLifecycle(state: WorldState, tree: AquamelonTree) {
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
    if (leaf.reproductive?.stage === 'FlowerBud' && ageHours >= FLOWER_AT_HOURS) {
      leaf.reproductive.stage = 'Flower'
      leaf.reproductive.stageStartedAtMs = leaf.bornAtMs + FLOWER_AT_HOURS * HOUR_MS
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

function growLeafAndReproduction(state: WorldState, leaf: Leaf, leafBudget: ElementVector) {
  const sink = leaf.reproductive ? reproductiveSink(leaf.reproductive.stage) : 0
  const reproductiveBudget = scaleVector(leafBudget, sink)
  const ownBudget = scaleVector(leafBudget, 1 - sink)
  growReproductive(state, leaf, reproductiveBudget)

  const retention = leaf.stage === 'SmallLeaf' ? 1 : LARGE_LEAF_RETENTION
  const retained = scaleVector(ownBudget, retention)
  addVector(leaf.growth, multiplyVectors(retained, leaf.effectiveAffinity))
  leaf.effectiveAffinity = effectiveAffinity(leaf.baseAffinity, leaf.growth)
}

function settleSapling(state: WorldState, tree: AquamelonTree, absorbed: ElementVector, dtHours: number) {
  addVector(tree.reserve, absorbed)
  let reserveTotal = sumVector(tree.reserve)

  if (tree.activity === 'Dormant' && reserveTotal >= 80) {
    tree.activity = 'Growing'
    appendLog(state, 'Sapling Reserve reached 80 -> Growing.')
  }
  if (tree.activity === 'Growing' && reserveTotal < 30) {
    tree.activity = 'Dormant'
    appendLog(state, 'Sapling Reserve dropped below 30 -> Dormant.')
  }
  if (tree.activity === 'Dormant') return

  const consumed = tree.reserve.map(
    (value) => value * (1 - TREE_RETENTION_PER_HOUR ** dtHours)
  ) as ElementVector
  subtractVector(tree.reserve, consumed)

  const leafCount = tree.leaves.length
  const treeShare = Math.max(0.1, 1 - leafCount * LEAF_BUDGET_SHARE)
  for (const leaf of tree.leaves) {
    growLeafAndReproduction(state, leaf, scaleVector(consumed, LEAF_BUDGET_SHARE))
  }

  const treeBudget = scaleVector(consumed, treeShare)
  const ownGrowthGain = multiplyVectors(treeBudget, tree.effectiveAffinity)
  if (tree.budGrowth) {
    addVector(tree.budGrowth, ownGrowthGain)
    if (sumVector(tree.budGrowth) >= BUD_GROWTH_THRESHOLD) {
      tree.leaves.push(makeLeaf(state, tree))
      tree.budGrowth = null
      appendLog(state, 'Bud reached 20 Growth -> SmallLeaf.')
    }
  } else {
    addVector(tree.growth, ownGrowthGain)
    updateTreeGrowthCycle(state, tree)
  }

  reserveTotal = sumVector(tree.reserve)
  if (tree.activity === 'Growing' && reserveTotal < 30) {
    tree.activity = 'Dormant'
    appendLog(state, 'Sapling Reserve dropped below 30 -> Dormant.')
  }
}

function settleContinuous(state: WorldState, dtHours: number) {
  normalizeSoil(state)
  decayBalls(state, dtHours)
  decaySoil(state, dtHours)

  const tree = state.tree
  if (!tree || !state.soil) return
  const absorbed = absorbFromSoil(state, tree, dtHours)

  if (tree.stage === 'Seed' || tree.stage === 'Seedling') {
    addVector(tree.growth, multiplyVectors(absorbed, tree.effectiveAffinity))
    tree.effectiveAffinity = effectiveAffinity(tree.baseAffinity, tree.growth)
    updateTreeStage(state, tree)
    return
  }

  settleSapling(state, tree, absorbed, dtHours)
}

function nextBudBoundaryMs(nowMs: number) {
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

function runBudCheck(state: WorldState) {
  const tree = state.tree
  if (!tree || tree.stage !== 'Sapling' || tree.budGrowth || tree.leaves.length >= 3) return
  const day = new Date(state.nowMs).toISOString().slice(0, 10)
  if (tree.lastBudCheckDay === day) return
  tree.lastBudCheckDay = day
  const chance = BUD_CHANCE_BY_LEAF_COUNT[tree.leaves.length] ?? 0
  const roll = nextRandom(state)
  if (roll < chance) {
    tree.budGrowth = zeroVector()
    appendLog(state, '04:00 bud check succeeded (' + Math.round(chance * 100) + '%).')
  } else {
    appendLog(state, '04:00 bud check failed (' + Math.round(chance * 100) + '%).')
  }
}

export function advanceWorld(state: WorldState, hours: number) {
  let remaining = Math.max(0, hours)
  while (remaining > EPSILON) {
    const nextBud = nextBudBoundaryMs(state.nowMs)
    const toBud = (nextBud - state.nowMs) / HOUR_MS
    const step = Math.min(SETTLEMENT_SLICE_HOURS, remaining, toBud)

    if (step > EPSILON) {
      settleContinuous(state, step)
      state.nowMs += step * HOUR_MS
      remaining -= step
      if (state.tree) updateElapsedLifecycle(state, state.tree)
    }

    if (Math.abs(state.nowMs - nextBud) < 2) runBudCheck(state)
  }
  appendLog(state, 'Advanced time by ' + hours + 'h using real settlement.')
}
