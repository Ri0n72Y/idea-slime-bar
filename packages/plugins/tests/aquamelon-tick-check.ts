import { WEB_BALANCE, GENSHIN_BALANCE } from '../src/aquamelon/config'
import { captureBall, clearBalls, condenseBall } from '../src/aquamelon/balls'
import { harvestFruit, harvestLeaf } from '../src/aquamelon/materials'
import { advanceWorld } from '../src/aquamelon/settlement'
import { createInitialWorld, createTree } from '../src/aquamelon/state'
import { sumVector, zeroVector } from '../src/aquamelon/vector'
import { assert, near, makeMatureLeaf } from './aquamelon-fixtures'

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
  world.tree.leaves[0].growth = [0, 5, 5, 0, 0, 0, 0]
  world.tree.leaves[0].effectiveAffinity = [1, 1.7, 1.5, 1, 1, 1, 1]
  const original = structuredClone(world.tree.leaves[0])
  assert(harvestFruit(world, 'leaf-test'), 'fruit harvest must succeed')
  advanceWorld(world, 23)
  assert(world.tree.leaves[0].reproductive === null, 'no early FlowerBud')
  advanceWorld(world, 1)
  const leaf = world.tree.leaves[0]
  assert(leaf.reproductive?.stage === 'FlowerBud', 'FlowerBud must form after one game day')
  assert(near(leaf.reproductive.baseAffinity[1], 1.25),
    'FlowerBud must inherit half the current Leaf Hydro affinity offset')
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

