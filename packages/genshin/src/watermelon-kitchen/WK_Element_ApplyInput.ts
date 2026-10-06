import { g } from 'genshin-ts/runtime/core'

const GRAPH_ID = 1073741829
const CFG_ENTITY_GUID = 1094713345n

/**
 * 单元素衰减计算。
 *
 * 对应编辑器中的 element_decay_calc：
 * result = TREE_Elems[index] * (1 - BaseDecayPerHour / Affinity[index]) ** hours
 *
 * CFG.Affinity 暂时保留为代码内列表。genshin-ts 当前无法安全表达
 * “获取自定义结构体 -> 拆分结构体 -> 读取 Affinity 字段”，该部分在编辑器中手动绑定。
 */
function gstsServerElementDecayCalc(index: bigint, hours: number) {
  const elems = self.get('TREE_Elems').asType('float_list')

  const cfgEntity = gsts.f.queryEntityByGuid(guid(CFG_ENTITY_GUID))
  const baseDecayPerHour = cfgEntity.get('CFG_BaseDecayPerHour').asType('float')

  // 固定顺序：Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo
  const affinity = list('float', [0.85, 1.15, 0.9, 0.75, 1.2, 0.7, 0.95])

  const decayRate = baseDecayPerHour / affinity[idx(index)]
  const decayFactor = (1 - decayRate) ** hours

  return elems[idx(index)] * decayFactor
}

g.server({
  id: GRAPH_ID,
  name: 'WK_Element_ApplyInput'
}).on('whenEntityIsCreated', (evt, f) => {
  const tree = f.queryEntityByGuid(evt.eventSourceGuid)

  const lastUpdateAt = tree.get('TREE_LastElementUpdateAt').asType('float')
  const now = float(f.queryTimestampUtc0())

  if (lastUpdateAt === 0) {
    tree.set('TREE_LastElementUpdateAt', now)
  } else {
    const elapsedHours = (now - lastUpdateAt) / 3600

    if (elapsedHours > 0) {
      const locks = self.get('TREE_Locks').asType('bool_list')

      for (let index = 0n; index < 7n; index++) {
        if (!locks[idx(index)]) {
          const result = gstsServerElementDecayCalc(index, elapsedHours)
          const elems = self.get('TREE_Elems').asType('float_list')
          elems[idx(index)] = result
        }
      }
    }

    tree.set('TREE_LastElementUpdateAt', now)
  }
})
