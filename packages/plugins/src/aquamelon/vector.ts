import type { ElementVector } from './types'

export const zeroVector = (): ElementVector => [0, 0, 0, 0, 0, 0, 0]

export const cloneVector = (value: ElementVector): ElementVector => [...value] as ElementVector

export function sumVector(value: ElementVector) {
  return value.reduce((sum, item) => sum + item, 0)
}

export function scaleVector(value: ElementVector, factor: number): ElementVector {
  return value.map((item) => item * factor) as ElementVector
}

export function addVector(target: ElementVector, value: ElementVector) {
  for (let index = 0; index < 7; index += 1) target[index] += value[index]
}

export function subtractVector(target: ElementVector, value: ElementVector) {
  for (let index = 0; index < 7; index += 1) target[index] = Math.max(0, target[index] - value[index])
}

export function multiplyVectors(left: ElementVector, right: ElementVector): ElementVector {
  return left.map((item, index) => item * right[index]) as ElementVector
}

export function normalizeVector(value: ElementVector): ElementVector | null {
  const total = sumVector(value)
  return total > 0 ? scaleVector(value, 1 / total) : null
}

export function dominantElement(value: ElementVector) {
  let best = 0
  for (let index = 1; index < 7; index += 1) {
    if (value[index] > value[best]) best = index
  }
  return sumVector(value) > 0 ? best : null
}
