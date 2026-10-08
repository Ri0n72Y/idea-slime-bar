import {
  SINGLE_ELEMENT_CAP_SHARE,
  SOIL_CAPACITY,
  TREE_ROOT_PREFERENCE,
  type WatermelonBalance
} from './config'
import { appendLog } from './state'
import type { AquamelonTree, ElementVector, WorldState } from './types'
import { scaleVector, subtractVector, sumVector, zeroVector } from './vector'

export function normalizeSoil(state: WorldState) {
  if (!state.soil) return
  const total = sumVector(state.soil.elems)
  if (total <= SOIL_CAPACITY) return
  state.soil.elems = scaleVector(state.soil.elems, SOIL_CAPACITY / total)
  appendLog(state, 'Soil normalized to capacity 100.')
}

export function decaySoil(state: WorldState, dtTick: number, balance: WatermelonBalance) {
  if (!state.soil) return
  state.soil.elems = scaleVector(state.soil.elems, balance.soilRetentionPerTick ** dtTick)
}

export function decayBalls(state: WorldState, dtTick: number, balance: WatermelonBalance) {
  const factor = 0.5 ** (dtTick / balance.ballHalfLifeTicks)
  for (const ball of state.balls) ball.elems = scaleVector(ball.elems, factor)
  state.balls = state.balls.filter((ball) => sumVector(ball.elems) >= 1)
}

// Lead-confirmed Web v0: BaseAffinity cap, RootPreference weighting, proportional total normalization.
function calculateAbsorption(
  soil: ElementVector,
  baseAffinity: ElementVector,
  dtTick: number,
  balance: WatermelonBalance
): ElementVector {
  const maxTotal = balance.maxTotalAbsorbPerTick * dtTick
  const candidate = soil.map((supply, index) => {
    const cap = balance.maxTotalAbsorbPerTick * SINGLE_ELEMENT_CAP_SHARE * baseAffinity[index] * dtTick
    return Math.min(supply * TREE_ROOT_PREFERENCE[index], cap)
  }) as ElementVector
  const total = sumVector(candidate)
  return total > maxTotal ? scaleVector(candidate, maxTotal / total) : candidate
}

export function absorbFromSoil(state: WorldState, tree: AquamelonTree, dtTick: number, balance: WatermelonBalance) {
  if (!state.soil) return zeroVector()
  const absorbed = calculateAbsorption(state.soil.elems, tree.baseAffinity, dtTick, balance)
  subtractVector(state.soil.elems, absorbed)
  return absorbed
}

