import {
  ELEMENTS,
  type ElementVector,
  normalizeVector,
  sumVector
} from '@idea-slime-bar/plugins'

export function vectorText(vector: ElementVector | null, digits = 1) {
  if (!vector) return 'undefined / not yet designed'
  return ELEMENTS.map((name, index) => name + ' ' + vector[index].toFixed(digits)).join(' · ')
}

export function flavorText(vector: ElementVector | null) {
  if (!vector || sumVector(vector) <= 0) return 'not formed'
  const ratio = normalizeVector(vector)
  if (!ratio) return 'not formed'
  return ELEMENTS.map((name, index) => name + ' ' + Math.round(ratio[index] * 100) + '%').join(' · ')
}

export function timeText(ms: number) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
}
