import { appendLog, nextId } from './state'
import type {
  Leaf,
  MaterialType,
  WorldMaterial,
  WorldState
} from './types'
import { cloneVector } from './vector'

function addMaterial(
  state: WorldState,
  type: MaterialType,
  affinity: WorldMaterial['affinity'],
  elementAmount: WorldMaterial['elementAmount'],
  source: string
) {
  const material: WorldMaterial = {
    id: nextId(state, 'material'),
    type,
    affinity: cloneVector(affinity),
    elementAmount: elementAmount ? cloneVector(elementAmount) : null,
    source
  }
  state.materials.push(material)
  return material
}

function leafMaterialType(leaf: Leaf): MaterialType {
  if (leaf.stage === 'SmallLeaf') return 'TenderLeaf'
  if (leaf.stage === 'AquamelonLeaf') return 'AquamelonLeaf'
  return 'ThickLeaf'
}

export function harvestLeaf(state: WorldState, leafId: string) {
  const tree = state.tree
  if (!tree) return false
  const index = tree.leaves.findIndex((leaf) => leaf.id === leafId)
  if (index < 0) return false
  const leaf = tree.leaves[index]
  if (leaf.reproductive) return false

  addMaterial(
    state,
    leafMaterialType(leaf),
    leaf.effectiveAffinity,
    leaf.growth,
    leaf.id + ' living-organ snapshot'
  )
  tree.leaves.splice(index, 1)
  appendLog(state, leaf.id + ' harvested -> ' + leafMaterialType(leaf) + '.')
  return true
}

export function harvestFruit(state: WorldState, leafId: string) {
  const tree = state.tree
  const leaf = tree?.leaves.find((candidate) => candidate.id === leafId)
  const organ = leaf?.reproductive
  if (!leaf || !organ || !organ.lockedAffinity) return false
  if (organ.stage !== 'GreenFruit' && organ.stage !== 'MatureFruit') return false

  const type: MaterialType = organ.stage === 'GreenFruit' ? 'GreenFruit' : 'Aquamelon'
  addMaterial(
    state,
    type,
    organ.lockedAffinity,
    organ.fruitElementAmount,
    leaf.id + ' fruit snapshot'
  )
  leaf.reproductive = null
  leaf.fruitHarvestedAtMs = state.nowMs
  appendLog(state, leaf.id + ' fruit harvested -> ' + type + '.')
  return true
}

function replaceWith(
  state: WorldState,
  source: WorldMaterial,
  outputs: Array<{ type: MaterialType; carriesAccumulation: boolean }>
) {
  state.materials = state.materials.filter((item) => item.id !== source.id)
  for (const output of outputs) {
    addMaterial(
      state,
      output.type,
      source.affinity,
      output.carriesAccumulation ? source.elementAmount : null,
      source.id
    )
  }
  appendLog(state, source.type + ' processed -> ' + outputs.map((item) => item.type).join(' + ') + '.')
}

export function processMaterial(state: WorldState, materialId: string) {
  const source = state.materials.find((item) => item.id === materialId)
  if (!source) return false

  if (source.type === 'GreenFruit') {
    replaceWith(state, source, [
      { type: 'GreenFruitPeel', carriesAccumulation: false },
      { type: 'GreenFruitFlesh', carriesAccumulation: true }
    ])
    return true
  }
  if (source.type === 'Aquamelon') {
    replaceWith(state, source, [
      { type: 'AquamelonShell', carriesAccumulation: false },
      { type: 'AquamelonShell', carriesAccumulation: false },
      { type: 'AquamelonJuice', carriesAccumulation: true }
    ])
    return true
  }
  if (source.type === 'AquamelonShell') {
    replaceWith(state, source, [
      { type: 'AquamelonFlesh', carriesAccumulation: false },
      { type: 'RemainingShell', carriesAccumulation: false }
    ])
    return true
  }
  return false
}

export function canProcessMaterial(type: MaterialType) {
  return type === 'GreenFruit' || type === 'Aquamelon' || type === 'AquamelonShell'
}
