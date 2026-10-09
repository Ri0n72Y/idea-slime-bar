import {
  ELEMENTS,
  normalizeVector,
  sumVector,
  type AquamelonTree,
  type ElementName,
  type ElementVector,
  type Leaf,
  type MaterialType,
  type ReproductiveOrgan
} from '@idea-slime-bar/plugins'

export const ELEMENT_NAMES: Record<ElementName, string> = {
  Fire: '火', Hydro: '水', Anemo: '风', Electro: '雷',
  Dendro: '草', Cryo: '冰', Geo: '岩'
}

export const TREE_NAMES: Record<AquamelonTree['stage'], string> = {
  Seed: '种子', Seedling: '幼苗', Sapling: '树苗'
}

export const LEAF_NAMES: Record<Leaf['stage'], string> = {
  SmallLeaf: '嫩叶', LargeLeaf: '肥厚叶', AquamelonLeaf: '水瓜叶'
}

export const ORGAN_NAMES: Record<ReproductiveOrgan['stage'], string> = {
  FlowerBud: '花苞', Flower: '花', GreenFruit: '青果', MatureFruit: '成熟水瓜'
}

export const MATERIAL_NAMES: Record<MaterialType, string> = {
  TenderLeaf: '嫩叶', ThickLeaf: '肥厚叶', AquamelonLeaf: '水瓜叶',
  GreenFruit: '青果', Aquamelon: '水瓜',
  GreenFruitPeel: '青果皮', GreenFruitFlesh: '青果肉',
  AquamelonShell: '水瓜壳', AquamelonJuice: '水瓜汁',
  AquamelonFlesh: '水瓜肉', RemainingShell: '剩余瓜壳'
}

export function elementName(name: ElementName) {
  return ELEMENT_NAMES[name]
}

export function vectorText(vector: ElementVector | null, digits = 1) {
  if (!vector) return '尚未定义'
  return ELEMENTS.map((name, index) =>
    ELEMENT_NAMES[name] + ' ' + vector[index].toFixed(digits)
  ).join(' · ')
}

export function flavorText(vector: ElementVector | null) {
  if (!vector || sumVector(vector) <= 0) return '尚未形成'
  const ratio = normalizeVector(vector)
  if (!ratio) return '尚未形成'
  return ELEMENTS.map((name, index) =>
    ELEMENT_NAMES[name] + ' ' + Math.round(ratio[index] * 100) + '%'
  ).join(' · ')
}

export function timeText(ms: number) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16)
}

export function entityName(id: string) {
  const match = /^(leaf|ball|material)-(\d+)$/.exec(id)
  if (!match) return '世界对象'
  const prefix = match[1] === 'leaf' ? '叶片' : match[1] === 'ball' ? '元素球' : '道具'
  return prefix + ' ' + match[2]
}

export function sourceText(source: string) {
  const id = /^(leaf|ball|material)-\d+/.exec(source)
  if (!id) return '来自世界'
  return source.includes('living-organ') ? entityName(id[0]) + '采摘'
    : source.includes('fruit snapshot') ? entityName(id[0]) + '结果'
      : entityName(id[0]) + '加工'
}

export function ratioText(ratio: ElementVector | null) {
  if (!ratio) return '尚未形成'
  return ELEMENTS.map((name, index) =>
    ELEMENT_NAMES[name] + ' ' + (ratio[index] * 100) + '%'
  ).join(' · ')
}
