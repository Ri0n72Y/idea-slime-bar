import type { ElementVector, Leaf } from '../src/watermelon/types'
import { cloneVector, zeroVector } from '../src/watermelon/vector'

export const AFFINITY: ElementVector = [1, 1.2, 1, 1, 1, 1, 1]

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function near(left: number, right: number, epsilon = 1e-6) {
  return Math.abs(left - right) <= epsilon
}

export function makeMatureLeaf(nowMs: number): Leaf {
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

