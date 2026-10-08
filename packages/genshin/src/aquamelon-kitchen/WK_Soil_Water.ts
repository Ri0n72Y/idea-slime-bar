import { g } from 'genshin-ts/runtime/core'

// Keep the experimental graph ID stable for manual .gia import.
const GRAPH_ID = 1073741830

/**
 * F1 debug input only: Soil owns SOIL_Elems.
 * Adding elements never normalizes capacity here; that belongs to F3/F2.
 * Requires a Soil option-tab component and matching SOIL_WaterTabId.
 */
g.server({
  id: GRAPH_ID,
  name: 'WK_Soil_Water'
}).on('whenTabIsSelected', (evt, f) => {
  const tabId = self.get('SOIL_WaterTabId').asType('int')

  if (evt.tabId === tabId) {
    const elementIndex = self.get('SOIL_WaterElementIndex').asType('int')
    const amount = self.get('SOIL_WaterAmount').asType('float')

    if (elementIndex >= 0n && elementIndex < 7n && amount > 0) {
      const elems = self.get('SOIL_Elems').asType('float_list')
      elems[idx(elementIndex)] = elems[idx(elementIndex)] + amount

      // Re-read the entity variable, not a transient calculated value.
      const readback = self.get('SOIL_Elems').asType('float_list')
      f.printString('WK_Soil_Water F1 element index / current amount:')
      f.printString(str(elementIndex))
      f.printString(str(readback[idx(elementIndex)]))
    }
  }
})
