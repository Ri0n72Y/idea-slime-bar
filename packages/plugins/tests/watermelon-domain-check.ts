import {
  processMaterial,
  harvestFruit
} from '../src/watermelon/materials'
import { advanceWorld } from '../src/watermelon/settlement'
import {
  createInitialWorld,
  createTree
} from '../src/watermelon/state'
import type {
  ElementVector,
  Leaf,
  WorldMaterial
} from '../src/watermelon/types'
import { cloneVector, zeroVector } from '../src/watermelon/vector'

const HYDRO: ElementVector = [0, 1, 0, 0, 0, 0, 0]
const AFFINITY: ElementVector = [1, 1.2, 1, 1, 1, 1, 1]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function near(left: number, right: number, epsilon = 1e-6) {
  return Math.abs(left - right) <= epsilon
}

function makeMatureLeaf(nowMs: number): Leaf {
  return {
    id: 'leaf-test',
    stage: 'AquamelonLeaf',
    bornAtMs: nowMs - 72 * 60 * 60 * 1000,
    growth: zeroVector(),
    baseAffinity: cloneVector(AFFINITY),
    effectiveAffinity: cloneVector(AFFINITY),
    reproductionStarted: true,
    reproductive: {
      stage: 'MatureFruit',
      stageStartedAtMs: nowMs,
      growth: [0, 100, 0, 0, 0, 0, 0],
      baseAffinity: cloneVector(AFFINITY),
      effectiveAffinity: cloneVector(AFFINITY),
      lockedAffinity: cloneVector(AFFINITY),
      fruitElementAmount: [0, 42, 0, 0, 0, 0, 0]
    }
  }
}

function checkStageThreshold() {
  const world = createInitialWorld(Date.UTC(2026, 9, 6, 0, 0))
  world.plot = 'planted'
  world.soil = { elems: [0, 100, 0, 0, 0, 0, 0] }
  world.tree = createTree()
  world.tree.growth = [0, 44.99, 0, 0, 0, 0, 0]
  world.tree.effectiveAffinity = cloneVector(world.tree.baseAffinity)

  advanceWorld(world, 0.25)

  assert(world.tree.stage === 'Seedling', 'Seed must cross 45 Growth into Seedling')
  assert(world.tree.growth[1] < 1, 'Stage transition must reset Seed Growth before continuing')
}

function checkBudBoundary() {
  const world = createInitialWorld(Date.UTC(2026, 9, 6, 3, 59))
  world.plot = 'planted'
  world.soil = { elems: zeroVector() }
  world.tree = createTree()
  world.tree.stage = 'Sapling'
  world.tree.activity = 'Dormant'

  advanceWorld(world, 2 / 60)

  assert(world.tree.lastBudCheckDay === '2026-10-06', '04:00 boundary must be processed once')
  assert(world.tree.budGrowth !== null, 'Deterministic 0-leaf bud roll should succeed')
}

function checkHarvestSnapshotAndNoReflower() {
  const world = createInitialWorld(Date.UTC(2026, 9, 6, 12, 0))
  world.plot = 'planted'
  world.soil = { elems: zeroVector() }
  world.tree = createTree()
  world.tree.stage = 'Sapling'
  world.tree.activity = 'Dormant'
  world.tree.leaves = [makeMatureLeaf(world.nowMs)]

  assert(harvestFruit(world, 'leaf-test'), 'Mature Fruit must be harvestable')
  assert(world.materials.length === 1, 'Harvest must create one world Material')
  assert(world.materials[0].type === 'Aquamelon', 'Mature Fruit must become Aquamelon')
  assert(world.materials[0].elementAmount?.[1] === 42, 'Harvest must snapshot FruitElementAmount')
  assert(world.materials[0].affinity[1] === 1.2, 'Harvest must snapshot locked Affinity')

  advanceWorld(world, 1)

  assert(world.tree.leaves[0].reproductive === null, 'Harvested leaf must not silently re-flower')
}

function checkProcessingIdentity() {
  const world = createInitialWorld(Date.UTC(2026, 9, 6, 12, 0))
  const aquamelon: WorldMaterial = {
    id: 'material-source',
    type: 'Aquamelon',
    affinity: cloneVector(AFFINITY),
    elementAmount: [0, 42, 0, 0, 0, 0, 0],
    source: 'test'
  }
  world.materials = [aquamelon]

  assert(processMaterial(world, aquamelon.id), 'Aquamelon Processing route must exist')
  const shells = world.materials.filter((item) => item.type === 'AquamelonShell')
  const juice = world.materials.find((item) => item.type === 'AquamelonJuice')

  assert(shells.length === 2, 'Aquamelon must produce two independent Shells')
  assert(juice?.elementAmount?.[1] === 42, 'Juice must carry Fruit growth accumulation')
  assert(shells.every((item) => item.elementAmount === null), 'Structural Shell amount stays undefined')
  assert(world.materials.every((item) => item.affinity[1] === 1.2), 'Derived Materials inherit Affinity')

  assert(processMaterial(world, shells[0].id), 'AquamelonShell Processing route must exist')
  assert(world.materials.some((item) => item.type === 'AquamelonFlesh'), 'Shell must produce Flesh')
  assert(world.materials.some((item) => item.type === 'RemainingShell'), 'Shell must leave remaining shell')
}

function checkGreenFruitCarrier() {
  const world = createInitialWorld()
  world.materials = [{
    id: 'green-source',
    type: 'GreenFruit',
    affinity: cloneVector(AFFINITY),
    elementAmount: [0, 12, 0, 0, 0, 0, 0],
    source: 'test'
  }]

  assert(processMaterial(world, 'green-source'), 'GreenFruit Processing route must exist')
  const peel = world.materials.find((item) => item.type === 'GreenFruitPeel')
  const flesh = world.materials.find((item) => item.type === 'GreenFruitFlesh')
  assert(peel?.elementAmount === null, 'GreenFruitPeel is structural')
  assert(flesh?.elementAmount?.[1] === 12, 'GreenFruitFlesh carries growth accumulation')
  assert(near(flesh?.affinity[1] ?? 0, 1.2), 'GreenFruitFlesh inherits source Affinity')
}

checkStageThreshold()
checkBudBoundary()
checkHarvestSnapshotAndNoReflower()
checkProcessingIdentity()
checkGreenFruitCarrier()

console.log('Watermelon domain checks passed')
