import { Service, type Context } from '@deepseek-ai/cordis'

import { advanceWorld } from './settlement'
import {
  canProcessMaterial,
  harvestFruit,
  harvestLeaf,
  processMaterial
} from './materials'
import {
  appendLog,
  createInitialWorld,
  createTree,
  nextId,
  nextRandom,
  snapshotWorld
} from './state'
import {
  ELEMENTS,
  type ElementName,
  type ElementVector,
  type WorldState
} from './types'
import { addVector, sumVector, zeroVector } from './vector'

declare module '@deepseek-ai/cordis' {
  interface Context {
    watermelon: WatermelonGameService
  }
}

export class WatermelonGameService extends Service {
  private state: WorldState
  private listeners = new Set<() => void>()

  constructor(ctx: Context) {
    super(ctx, 'watermelon')
    this.state = createInitialWorld()
  }

  getSnapshot() {
    return snapshotWorld(this.state)
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }

  reset() {
    this.state = createInitialWorld()
    this.emit()
  }

  placeSoil() {
    if (this.state.plot !== 'empty') return false
    this.state.soil = { elems: zeroVector() }
    this.state.plot = 'soil'
    appendLog(this.state, 'Soil placed on the field.')
    this.emit()
    return true
  }

  plantSeed() {
    if (!this.state.soil || this.state.tree) return false
    this.state.tree = createTree()
    this.state.plot = 'planted'
    appendLog(this.state, 'Aquamelon Seed planted.')
    this.emit()
    return true
  }

  spawnElementBall(element: ElementName) {
    if (!this.state.soil) return false
    const index = ELEMENTS.indexOf(element)
    if (index < 0) return false
    const amount = 8 + nextRandom(this.state) * 2
    const elems = zeroVector()
    elems[index] = amount
    this.state.balls.push({
      id: nextId(this.state, 'ball'),
      elems,
      spawnedAtMs: this.state.nowMs
    })
    appendLog(this.state, element + ' test ball spawned (' + amount.toFixed(2) + ').')
    this.emit()
    return true
  }

  spawnAllElementBalls() {
    for (const element of ELEMENTS) this.spawnElementBall(element)
  }

  captureBall(ballId: string) {
    if (!this.state.soil) return false
    const index = this.state.balls.findIndex((ball) => ball.id === ballId)
    if (index < 0) return false
    const ball = this.state.balls[index]
    addVector(this.state.soil.elems, ball.elems)
    this.state.balls.splice(index, 1)
    appendLog(this.state, ball.id + ' captured by Soil; capacity normalizes on settlement.')
    this.emit()
    return true
  }

  advance(hours: number) {
    if (hours <= 0) return
    advanceWorld(this.state, hours)
    this.emit()
  }

  pinchBud() {
    const tree = this.state.tree
    if (!tree?.budGrowth) return false
    addVector(tree.growth, tree.budGrowth)
    tree.budGrowth = null
    appendLog(this.state, 'Active Bud pinched; Bud Growth returned to TREE_Growth.')
    this.emit()
    return true
  }

  harvestLeaf(leafId: string) {
    const changed = harvestLeaf(this.state, leafId)
    if (changed) this.emit()
    return changed
  }

  harvestFruit(leafId: string) {
    const changed = harvestFruit(this.state, leafId)
    if (changed) this.emit()
    return changed
  }

  process(materialId: string) {
    const changed = processMaterial(this.state, materialId)
    if (changed) this.emit()
    return changed
  }

  canProcess(materialId: string) {
    const material = this.state.materials.find((item) => item.id === materialId)
    return material ? canProcessMaterial(material.type) : false
  }

  soilTotal() {
    return this.state.soil ? sumVector(this.state.soil.elems) : 0
  }
}
