import {
  BUD_GROWTH_THRESHOLD,
  LEAF_BUDGET_SHARE,
  SAPLING_GROWTH_CYCLE,
  SEED_GROWTH_THRESHOLD,
  SEEDLING_GROWTH_THRESHOLD,
  WEB_BALANCE,
  type AquamelonBalance
} from './config'
import { appendLog, effectiveAffinity } from './state'
import { absorbFromSoil, decayBalls, decaySoil, normalizeSoil } from './soil'
import {
  growLeafAndReproduction,
  makeLeaf,
  nextBudBoundaryMs,
  runBudCheck,
  updateElapsedLifecycle
} from './organs'
import type { AquamelonTree, ElementVector, WorldState } from './types'
import {
  addVector,
  cloneVector,
  multiplyVectors,
  scaleVector,
  subtractVector,
  sumVector,
  zeroVector
} from './vector'

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

function settleSapling(state: WorldState, tree: AquamelonTree, absorbed: ElementVector, dtTick: number, balance: AquamelonBalance) {
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
    (value) => value * (1 - balance.treeRetentionPerTick ** dtTick)
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

function settleContinuous(state: WorldState, dtTick: number, balance: AquamelonBalance) {
  normalizeSoil(state)
  decayBalls(state, dtTick, balance)
  decaySoil(state, dtTick, balance)

  const tree = state.tree
  if (!tree || !state.soil) return
  const absorbed = absorbFromSoil(state, tree, dtTick, balance)

  if (tree.stage === 'Seed' || tree.stage === 'Seedling') {
    addVector(tree.growth, multiplyVectors(absorbed, tree.effectiveAffinity))
    tree.effectiveAffinity = effectiveAffinity(tree.baseAffinity, tree.growth)
    updateTreeStage(state, tree)
    return
  }

  settleSapling(state, tree, absorbed, dtTick, balance)
}

export function advanceWorld(state: WorldState, dtTick: number, balance: AquamelonBalance = WEB_BALANCE) {
  if (!Number.isSafeInteger(dtTick) || dtTick < 0) throw new Error('dtTick must be a nonnegative integer')
  const minutes = balance['tick:time'].gameMinutesPerTick
  if (!Number.isSafeInteger(minutes) || minutes <= 0 || 60 % minutes !== 0) {
    throw new Error('tick:time gameMinutesPerTick must divide 60')
  }
  const gameMsPerTick = minutes * 60_000
  for (let tick = 0; tick < dtTick; tick += 1) {
    const nextBud = nextBudBoundaryMs(state.nowMs)
    settleContinuous(state, 1, balance)
    state.nowMs += gameMsPerTick
    state.tickCount += 1
    if (state.tree) updateElapsedLifecycle(state, state.tree)
    if (state.nowMs >= nextBud) runBudCheck(state)
  }
}
