import {
  EXTRA_AFFINITY,
  TREE_AFFINITY
} from './config'
import type {
  AquamelonTree,
  ElementVector,
  WorldLog,
  WorldState
} from './types'
import { cloneVector, sumVector, zeroVector } from './vector'

export function effectiveAffinity(base: ElementVector, growth: ElementVector): ElementVector {
  const total = sumVector(growth)
  if (total <= 0) return cloneVector(base)
  return base.map((item, index) => item + EXTRA_AFFINITY * (growth[index] / total)) as ElementVector
}

export function inheritAffinity(
  template: ElementVector,
  parentBase: ElementVector,
  parentEffective: ElementVector,
  rate: number
): ElementVector {
  return template.map(
    (item, index) => item + (parentEffective[index] - parentBase[index]) * rate
  ) as ElementVector
}

export function createTree(): AquamelonTree {
  return {
    stage: 'Seed',
    activity: 'Growing',
    reserve: zeroVector(),
    growth: zeroVector(),
    baseAffinity: cloneVector(TREE_AFFINITY),
    effectiveAffinity: cloneVector(TREE_AFFINITY),
    budGrowth: null,
    leaves: [],
    lastBudCheckDay: null
  }
}

export function createInitialWorld(nowMs = Date.now()): WorldState {
  return {
    nowMs,
    plot: 'empty',
    soil: null,
    tree: null,
    balls: [],
    materials: [],
    rngSeed: 0x51a7e123,
    nextId: 1,
    logs: [{ atMs: nowMs, message: 'Prototype world ready.' }]
  }
}

export function nextId(state: WorldState, prefix: string) {
  const id = prefix + '-' + state.nextId
  state.nextId += 1
  return id
}

export function nextRandom(state: WorldState) {
  state.rngSeed = (Math.imul(state.rngSeed, 1664525) + 1013904223) >>> 0
  return state.rngSeed / 0x100000000
}

export function appendLog(state: WorldState, message: string) {
  const entry: WorldLog = { atMs: state.nowMs, message }
  state.logs = [...state.logs.slice(-79), entry]
}

export function snapshotWorld(state: WorldState): WorldState {
  return structuredClone(state)
}
