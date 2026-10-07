export const ELEMENTS = [
  'Fire',
  'Hydro',
  'Anemo',
  'Electro',
  'Dendro',
  'Cryo',
  'Geo'
] as const

export type ElementName = (typeof ELEMENTS)[number]
export type ElementVector = [number, number, number, number, number, number, number]

export type TreeStage = 'Seed' | 'Seedling' | 'Sapling'
export type TreeActivity = 'Dormant' | 'Growing'
export type LeafStage = 'SmallLeaf' | 'LargeLeaf' | 'AquamelonLeaf'
export type ReproductiveStage = 'FlowerBud' | 'Flower' | 'GreenFruit' | 'MatureFruit'

export type MaterialType =
  | 'TenderLeaf'
  | 'ThickLeaf'
  | 'AquamelonLeaf'
  | 'GreenFruit'
  | 'Aquamelon'
  | 'GreenFruitPeel'
  | 'GreenFruitFlesh'
  | 'AquamelonShell'
  | 'AquamelonJuice'
  | 'AquamelonFlesh'
  | 'RemainingShell'

export interface ElementBall {
  id: string
  elems: ElementVector
  spawnedAtMs: number
}

export interface ReproductiveOrgan {
  stage: ReproductiveStage
  stageStartedAtMs: number
  growth: ElementVector
  baseAffinity: ElementVector
  effectiveAffinity: ElementVector
  lockedAffinity: ElementVector | null
  fruitElementAmount: ElementVector
}

export interface Leaf {
  id: string
  stage: LeafStage
  bornAtMs: number
  growth: ElementVector
  baseAffinity: ElementVector
  effectiveAffinity: ElementVector
  reproductionStarted: boolean
  reproductive: ReproductiveOrgan | null
}

export interface AquamelonTree {
  stage: TreeStage
  activity: TreeActivity
  reserve: ElementVector
  growth: ElementVector
  baseAffinity: ElementVector
  effectiveAffinity: ElementVector
  budGrowth: ElementVector | null
  leaves: Leaf[]
  lastBudCheckDay: string | null
}

export interface Soil {
  elems: ElementVector
}

export interface WorldMaterial {
  id: string
  type: MaterialType
  affinity: ElementVector
  elementAmount: ElementVector | null
  source: string
}

export interface WorldLog {
  atMs: number
  message: string
}

export interface WorldState {
  nowMs: number
  plot: 'empty' | 'soil' | 'planted'
  soil: Soil | null
  tree: AquamelonTree | null
  balls: ElementBall[]
  materials: WorldMaterial[]
  rngSeed: number
  nextId: number
  logs: WorldLog[]
}
