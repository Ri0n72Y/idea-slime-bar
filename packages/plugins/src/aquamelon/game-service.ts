import { Service, type Context } from '@deepseek-ai/cordis'

import { WEB_BALANCE } from './config'
import {
  captureBall as captureInDomain,
  clearBalls,
  condenseBall,
  spawnBall
} from './balls'

import { advanceWorld, pinchBud as pinchBudInDomain } from './settlement'
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
  snapshotWorld
} from './state'
import {
  ELEMENTS,
  type ElementName,
  type WorldState
} from './types'
import { sumVector, zeroVector } from './vector'

declare module '@deepseek-ai/cordis' {
  interface Context {
    aquamelon: AquamelonGameService
  }
}

export class AquamelonGameService extends Service {
  private state: WorldState
  private listeners = new Set<() => void>()

  constructor(ctx: Context) {
    super(ctx, 'aquamelon')
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
    const changed = spawnBall(this.state, element, WEB_BALANCE)
    if (changed) this.emit()
    return changed
  }

  condenseElement() {
    const changed = condenseBall(this.state, WEB_BALANCE)
    if (changed) this.emit()
    return changed
  }

  clearField() {
    const changed = clearBalls(this.state)
    if (changed) this.emit()
    return changed
  }

  spawnAllElementBalls() {
    for (const element of ELEMENTS) this.spawnElementBall(element)
  }

  captureBall(ballId: string) {
    const changed = captureInDomain(this.state, ballId)
    if (changed) this.emit()
    return changed
  }

  advance(dtTick: number) {
    if (dtTick <= 0) return
    advanceWorld(this.state, dtTick, WEB_BALANCE)
    this.emit()
  }

  pinchBud() {
    const changed = pinchBudInDomain(this.state)
    if (changed) this.emit()
    return changed
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
