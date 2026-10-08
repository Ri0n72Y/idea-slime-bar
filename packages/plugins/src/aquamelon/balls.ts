import { WEB_BALANCE, type AquamelonBalance } from './config'
import { appendLog, nextId, nextRandom } from './state'
import { ELEMENTS, type ElementName, type WorldState } from './types'
import { addVector, zeroVector } from './vector'

export function spawnBall(
  state: WorldState,
  element: ElementName,
  balance: AquamelonBalance = WEB_BALANCE
) {
  if (!state.soil) return false
  const index = ELEMENTS.indexOf(element)
  if (index < 0) return false
  const amount = balance.ballMinAmount +
    nextRandom(state) * (balance.ballMaxAmount - balance.ballMinAmount)
  const elems = zeroVector()
  elems[index] = amount
  state.balls.push({ id: nextId(state, 'ball'), elems, spawnedAtMs: state.nowMs })
  appendLog(state, element + ' ball spawned (' + amount.toFixed(2) + ').')
  return true
}

export function condenseBall(state: WorldState, balance: AquamelonBalance = WEB_BALANCE) {
  if (!state.soil) return false
  const index = Math.floor(nextRandom(state) * ELEMENTS.length)
  return spawnBall(state, ELEMENTS[index], balance)
}

export function captureBall(state: WorldState, ballId: string) {
  if (!state.soil) return false
  const index = state.balls.findIndex((ball) => ball.id === ballId)
  if (index < 0) return false
  const ball = state.balls[index]
  addVector(state.soil.elems, ball.elems)
  state.balls.splice(index, 1)
  appendLog(state, ball.id + ' captured by Soil; capacity normalizes on settlement.')
  return true
}

export function clearBalls(state: WorldState) {
  if (!state.balls.length) return false
  state.balls = []
  appendLog(state, 'Uncollected field Element Balls cleared.')
  return true
}
