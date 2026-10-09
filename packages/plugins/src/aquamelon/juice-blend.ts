import type { ElementVector, WorldMaterial } from './types'
import { dominantElement, normalizeVector, sumVector, zeroVector } from './vector'

export interface JuiceBlendPreview {
  elementAmount: ElementVector
  flavorRatio: ElementVector | null
  dominantElement: number | null
}

export function isBlendableJuice(material: WorldMaterial): boolean {
  const amount = material.elementAmount
  return material.type === 'AquamelonJuice'
    && Array.isArray(amount)
    && amount.length === 7
    && amount.every(value => Number.isFinite(value) && value >= 0)
}

// A read-only query over existing world materials, never a crafted material.
export function previewJuiceBlend(
  materials: readonly WorldMaterial[],
  selectedIds: readonly string[]
): JuiceBlendPreview | null {
  if (selectedIds.length < 1 || selectedIds.length > 3) return null
  if (new Set(selectedIds).size !== selectedIds.length) return null

  const selected: WorldMaterial[] = []
  for (const id of selectedIds) {
    const material = materials.find(item => item.id === id)
    if (!material || !isBlendableJuice(material)) return null
    selected.push(material)
  }

  const mixed = zeroVector()
  for (const material of selected) {
    const amount = material.elementAmount as ElementVector
    for (let index = 0; index < 7; index += 1) {
      mixed[index] += amount[index] / selected.length
    }
  }
  if (!Number.isFinite(sumVector(mixed))) return null

  return {
    elementAmount: mixed,
    flavorRatio: normalizeVector(mixed),
    dominantElement: dominantElement(mixed)
  }
}
