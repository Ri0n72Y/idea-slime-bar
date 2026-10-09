import { ELEMENT_NAMES, MATERIAL_NAMES, entityName } from './format'
import type { ElementName, MaterialType } from '@idea-slime-bar/plugins'

const staticLogs: Record<string, string> = {
  'Prototype world ready.': '世界已准备就绪。',
  'Soil placed on the field.': '已放置土壤。',
  'Aquamelon Seed planted.': '已种下水瓜种子。',
  'Uncollected field Element Balls cleared.': '已清空未收集的元素球。',
  'Soil normalized to capacity 100.': '土壤元素总量已调整至容量上限。',
  'Seed reached 45 Growth -> Seedling.': '种子成长为幼苗。',
  'Seedling reached 90 Growth -> Sapling. Reserve is now active.': '幼苗成长为树苗，养分储备开始生效。',
  'Sapling completed a 100 Growth affinity cycle.': '树苗完成一次生长塑形。',
  'Sapling Reserve reached 80 -> Growing.': '树苗储备充足，开始生长。',
  'Sapling Reserve dropped below 30 -> Dormant.': '树苗储备不足，进入休眠。',
  'Active Bud pinched; Bud Growth returned to TREE_Growth.': '已掐掉嫩芽，积累的生长量返回树干。',
  'Bud reached 20 Growth -> SmallLeaf.': '嫩芽长成嫩叶。'
}

export function logText(message: string, debug = false) {
  if (message in staticLogs) return staticLogs[message]
  const ball = /^(Fire|Hydro|Anemo|Electro|Dendro|Cryo|Geo) ball spawned \(([\d.]+)\)\.$/.exec(message)
  if (ball) return '富集得到' + ELEMENT_NAMES[ball[1] as ElementName] + '元素球（' + ball[2] + '）。'
  const captured = /^(ball-\d+) captured by Soil;/.exec(message)
  if (captured) return entityName(captured[1]) + '已收集，元素量已进入土壤。'
  const check = /^(Tick|04:00) bud check (succeeded|failed) \((\d+)%\)\.$/.exec(message)
  if (check) {
    const result = check[2] === 'succeeded' ? '成功出芽。' : '本次没有出芽。'
    return debug ? result + '（概率 ' + check[3] + '%）' : result
  }
  const leaf = /^(leaf-\d+) (.+)$/.exec(message)
  if (leaf) {
    const name = entityName(leaf[1]), event = leaf[2]
    if (event.startsWith('-> LargeLeaf')) return name + '长成肥厚叶。'
    if (event.startsWith('formed a new FlowerBud')) return name + '在采果一天后再次长出花苞。'
    if (event.startsWith('formed FlowerBud')) return name + '长出花苞。'
    if (event.startsWith('FlowerBud reached bloom')) return name + '的花苞开放了。'
    if (event.startsWith('Flower reached 30')) return name + '的花结成青果。'
    if (event.startsWith('Fruit reached 100')) return name + '的水瓜已成熟。'
    const harvest = /^harvested -> (\w+)\.$/.exec(event)
    if (harvest) return name + '已摘下，获得' + materialName(harvest[1]) + '。'
    const fruit = /^fruit harvested -> (\w+)\.$/.exec(event)
    if (fruit) return name + '的果实已摘下，获得' + materialName(fruit[1]) + '。'
  }
  const processed = /^(\w+) processed -> (.+)\.$/.exec(message)
  if (processed) {
    const outputs = processed[2].split(' + ').map(materialName).join('、')
    return materialName(processed[1]) + '加工得到' + outputs + '。'
  }
  return '有一项世界事件尚未分类。'
}

function materialName(value: string) {
  return MATERIAL_NAMES[value as MaterialType] ?? '材料'
}
