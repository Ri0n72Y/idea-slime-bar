import {
  processMaterial,
  harvestLeaf,
  harvestFruit
} from '../src/watermelon/materials'
import { advanceWorld, pinchBud } from '../src/watermelon/settlement'
import { WEB_BALANCE, GENSHIN_BALANCE } from '../src/watermelon/config'
import { captureBall, clearBalls, condenseBall } from '../src/watermelon/balls'
import {
  createInitialWorld,
  createTree
} from '../src/watermelon/state'
import type {
  ElementVector,
  Leaf,
  WorldMaterial
} from '../src/watermelon/types'
import { cloneVector, sumVector, zeroVector } from '../src/watermelon/vector'

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
    fruitHarvestedAtMs: null,
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

  advanceWorld(world, 1)

  assert(world.tree.stage === 'Seedling', 'Seed must cross 45 Growth into Seedling')
  assert(world.tree.growth[1] < 1, 'Stage transition must reset Seed Growth before continuing')
}

function checkBudBoundary() {
  const world = createInitialWorld(Date.UTC(2026, 9, 6, 3, 0))
  world.plot = 'planted'
  world.soil = { elems: zeroVector() }
  world.tree = createTree()
  world.tree.stage = 'Sapling'
  world.tree.activity = 'Dormant'

  advanceWorld(world, 1)

  assert(world.tree.lastBudCheckDay === '2026-10-06', '04:00 boundary must be processed once')
  assert(world.tree.budGrowth !== null, 'Deterministic 0-leaf bud roll should succeed')
}

function checkHarvestMaterialSnapshot() {
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
  assert(peel?.type === 'GreenFruitPeel', 'GreenFruit Processing must create Peel')
  assert(flesh?.elementAmount?.[1] === 12, 'GreenFruitFlesh carries growth accumulation')
  assert(near(flesh?.affinity[1] ?? 0, 1.2), 'GreenFruitFlesh inherits source Affinity')
  assert(near(peel?.affinity[1] ?? 0, 1.2), 'GreenFruitPeel inherits source Affinity')
}

function checkPinchBudAffinity() {
  const world = createInitialWorld()
  world.tree = createTree()
  world.tree.stage = 'Sapling'
  world.tree.growth = [5, 10, 0, 0, 0, 0, 0]
  world.tree.budGrowth = [5, 10, 0, 0, 0, 0, 0]

  assert(pinchBud(world), 'Active Bud should be pinchable')
  assert(world.tree.budGrowth === null, 'Pinching must clear active Bud')
  assert(near(world.tree.growth[0], 10), 'Bud Fire Growth must return to Tree')
  assert(near(world.tree.growth[1], 20), 'Bud Hydro Growth must return to Tree')
  assert(near(world.tree.effectiveAffinity[0], world.tree.baseAffinity[0] + 10 / 30),
    'Pinching must immediately update Fire EffectiveAffinity')
  assert(near(world.tree.effectiveAffinity[1], world.tree.baseAffinity[1] + 20 / 30),
    'Pinching must immediately update Hydro EffectiveAffinity')
}

function checkPinchBudGrowthCycle() {
  const world = createInitialWorld()
  world.tree = createTree()
  world.tree.stage = 'Sapling'
  world.tree.growth = [0, 90, 0, 0, 0, 0, 0]
  world.tree.budGrowth = [0, 10, 0, 0, 0, 0, 0]

  assert(pinchBud(world), 'Active Bud should be pinchable at cycle threshold')
  assert(world.tree.budGrowth === null, 'Bud must clear after cycle completion')
  assert(near(world.tree.baseAffinity[1], 2.15),
    '100 Growth must freeze newly computed Hydro affinity as Base')
  assert(world.tree.growth.every((amount) => near(amount, 0)),
    '100 Growth cycle must reset Tree Growth')
  assert(near(world.tree.effectiveAffinity[1], world.tree.baseAffinity[1]),
    'EffectiveAffinity must match frozen Base after cycle')
}

// These checks test the authoritative domain path rather than UI behavior.
function checkTickTimeIndependentBudget() {
  const world = createInitialWorld()
  world.plot = 'planted'
  world.soil = { elems: [12, 12, 12, 12, 12, 12, 12] }
  world.tree = createTree()
  const other = structuredClone(world)
  advanceWorld(world, 1, WEB_BALANCE)
  advanceWorld(other, 1, {
    ...WEB_BALANCE,
    'tick:time': { ...WEB_BALANCE['tick:time'], gameMinutesPerTick: 30 }
  })
  assert(near(world.tree!.growth.reduce((sum, x) => sum + x, 0),
    other.tree!.growth.reduce((sum, x) => sum + x, 0)),
    'tick:time must not change one-Tick growth budget')
  assert(world.nowMs - other.nowMs === 30 * 60_000, 'game time mapping must still advance differently')
}

function checkAutoManualTickEquivalence() {
  const world = createInitialWorld()
  world.plot = 'planted'
  world.soil = { elems: [12, 12, 12, 12, 12, 12, 12] }
  world.tree = createTree()
  const other = structuredClone(world)
  advanceWorld(world, 3)
  for (let i = 0; i < 3; i += 1) advanceWorld(other, 1)
  world.logs = []
  other.logs = []
  assert(JSON.stringify(world) === JSON.stringify(other),
    'auto/manual Ticks must produce the same canonical state')
}

function checkRefowering() {
  const world = createInitialWorld(Date.UTC(2026, 9, 6, 12))
  world.plot = 'planted'
  world.soil = { elems: zeroVector() }
  world.tree = createTree()
  world.tree.stage = 'Sapling'
  world.tree.activity = 'Dormant'
  world.tree.leaves = [makeMatureLeaf(world.nowMs)]
  const original = structuredClone(world.tree.leaves[0])
  assert(harvestFruit(world, 'leaf-test'), 'fruit harvest must succeed')
  advanceWorld(world, 23)
  assert(world.tree.leaves[0].reproductive === null, 'no early FlowerBud')
  advanceWorld(world, 1)
  const leaf = world.tree.leaves[0]
  assert(leaf.reproductive?.stage === 'FlowerBud', 'FlowerBud must form after one game day')
  assert(near(leaf.reproductive.baseAffinity[1], 1), 'FlowerBud must inherit current leaf offset')
  assert(JSON.stringify(leaf.growth) === JSON.stringify(original.growth),
    're-flowering must not reset mother Leaf Growth')
  assert(JSON.stringify(leaf.effectiveAffinity) === JSON.stringify(original.effectiveAffinity),
    're-flowering must not rewrite mother Leaf Affinity')
  advanceWorld(world, 24)
  assert(world.tree.leaves[0].reproductive?.stage === 'Flower',
    're-flowering bloom starts 24 game-hours after new bud, not immediately')
}

function checkLeafAccumulationMaterial() {
  const world = createInitialWorld()
  world.tree = createTree()
  world.tree.stage = 'Sapling'
  const leaf = makeMatureLeaf(world.nowMs)
  leaf.reproductive = null
  leaf.growth = [3, 8, 1, 0, 0, 0, 0]
  world.tree.leaves = [leaf]
  assert(harvestLeaf(world, leaf.id), 'leaf must be harvestable')
  assert(JSON.stringify(world.materials[0].elementAmount) === JSON.stringify([3,8,1,0,0,0,0]),
    'leaf Material ElementAmount must snapshot Growth[7]')
}

function checkRandomBallsAndClear() {
  const world = createInitialWorld()
  world.plot = 'planted'
  world.soil = { elems: zeroVector() }
  world.tree = createTree()
  world.tree.growth = [2, 3, 0, 0, 0, 0, 0]
  const counts = zeroVector()
  for (let index = 0; index < 7000; index += 1) {
    assert(condenseBall(world), 'condense must spawn one ball')
    const ball = world.balls[world.balls.length - 1]
    const elementIndex = ball.elems.findIndex((x) => x > 0)
    assert(elementIndex >= 0, 'new ball must have a positive element')
    assert(ball.elems.filter((x) => x > 0).length === 1, 'ball must be single-element')
    counts[elementIndex] += 1
  }
  for (const count of counts) {
    assert(count > 850 && count < 1150, 'seven-way ball sample deviates from uniform distribution')
  }
  assert(captureBall(world, world.balls[0].id), 'ball must guide to Soil')
  const soilSnapshot = [...world.soil!.elems]
  const growthSnapshot = [...world.tree!.growth]
  assert(clearBalls(world), 'clear field must remove remaining balls')
  assert(world.balls.length === 0, 'field must be empty')
  assert(JSON.stringify(world.soil!.elems) === JSON.stringify(soilSnapshot), 'clear must preserve Soil')
  assert(JSON.stringify(world.tree!.growth) === JSON.stringify(growthSnapshot), 'clear must preserve Tree')
}

// Player supplies seven random balls in a batch whenever Soil drops below 55.
// No special growth injection: all progress goes through the same Tick settlement.
function projectActiveGrowth(balance: typeof WEB_BALANCE, maxTicks: number) {
  const world = createInitialWorld()
  world.plot = 'planted'
  world.soil = { elems: zeroVector() }
  world.tree = createTree()
  const milestones: Record<string, number> = {}
  let balls = 0
  for (let tick = 1; tick <= maxTicks; tick += 1) {
    while (sumVector(world.soil.elems) < 55) {
      for (let i = 0; i < 7; i += 1) {
        assert(condenseBall(world, balance), 'sample ball creation must succeed')
        assert(captureBall(world, world.balls[0].id), 'sample ball capture must succeed')
        balls += 1
      }
    }
    advanceWorld(world, 1, balance)
    if (world.tree.stage === 'Seedling' && !milestones.Seedling) milestones.Seedling = tick
    if (world.tree.stage === 'Sapling' && !milestones.Sapling) milestones.Sapling = tick
    const leaf = world.tree.leaves[0]
    if (world.tree.budGrowth && !milestones.Bud) milestones.Bud = tick
    if (leaf) {
      milestones.SmallLeaf ??= tick
      if (leaf.stage !== 'SmallLeaf') milestones.LargeLeaf ??= tick
      if (leaf.reproductive) {
        const stage = leaf.reproductive.stage
        if (stage === 'FlowerBud') milestones.FlowerBud ??= tick
        if (stage === 'Flower') milestones.Flower ??= tick
        if (stage === 'GreenFruit') milestones.GreenFruit ??= tick
        if (stage === 'MatureFruit') milestones.MatureFruit ??= tick
      }
    }
    if (milestones.MatureFruit) break
  }
  return { milestones, balls }
}

function checkActiveGrowthCalibration() {
  const web = projectActiveGrowth(WEB_BALANCE, 180)
  assert(!!web.milestones.Sapling && !!web.milestones.Flower && !!web.milestones.GreenFruit,
    'active Web trial must really progress through Sapling, Flower and Fruit within one real hour')
  console.log('Web active-growth calibration:', JSON.stringify(web))
  const genshin = projectActiveGrowth(GENSHIN_BALANCE, 168)
  console.log('Genshin historic-balance seven-day projection (not target acceptance):',
    JSON.stringify(genshin))
}

checkRandomBallsAndClear()
checkActiveGrowthCalibration()
checkTickTimeIndependentBudget()
checkAutoManualTickEquivalence()
checkRefowering()
checkLeafAccumulationMaterial()
checkStageThreshold()
checkBudBoundary()
checkPinchBudAffinity()
checkPinchBudGrowthCycle()
checkHarvestMaterialSnapshot()
checkProcessingIdentity()
checkGreenFruitCarrier()

console.log('Watermelon domain checks passed')
