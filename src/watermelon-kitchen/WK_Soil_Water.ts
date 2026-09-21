import { g } from 'genshin-ts/runtime/core'

const GRAPH_ID = 1073741830

/**
 * 测试浇水入口。
 *
 * 编辑器要求：
 * - 本节点图挂载到 Soil / Plot 实体。
 * - Soil 实体需要配置 Issue #2 中的 SOIL_* 自定义变量。
 * - 选项卡组件的 tabId 写入 SOIL_WaterTabId。
 *
 * 容量竞争：
 * 先按旧土壤组成同比例挤出 overflow，再加入完整的新输入。
 */
g.server({
  id: GRAPH_ID,
  name: 'WK_Soil_Water'
}).on('whenTabIsSelected', (evt, _f) => {
  const waterTabId = self.get('SOIL_WaterTabId').asType('int')

  if (evt.tabId === waterTabId) {
    const elems = self.get('SOIL_Elems').asType('float_list')
    const maxLoad = Math.max(0, self.get('SOIL_MaxLoad').asType('float'))
    const waterAmount = Math.max(0, self.get('SOIL_WaterAmount').asType('float'))
    const targetIndex = self.get('SOIL_WaterElementIndex').asType('int')

    if (targetIndex >= 0n && targetIndex < 7n && maxLoad > 0 && waterAmount > 0) {
      let totalBefore = 0

      for (let index = 0n; index < 7n; index++) {
        totalBefore = totalBefore + Math.max(0, elems[idx(index)])
      }

      const appliedInput = Math.min(waterAmount, maxLoad)
      const overflow = Math.max(0, totalBefore + appliedInput - maxLoad)

      if (overflow > 0 && totalBefore > 0) {
        const remainingOldTotal = Math.max(0, totalBefore - overflow)
        const oldScale = remainingOldTotal / totalBefore

        for (let index = 0n; index < 7n; index++) {
          elems[idx(index)] = Math.max(0, elems[idx(index)]) * oldScale
        }
      }

      elems[idx(targetIndex)] = elems[idx(targetIndex)] + appliedInput
    }
  }
})
