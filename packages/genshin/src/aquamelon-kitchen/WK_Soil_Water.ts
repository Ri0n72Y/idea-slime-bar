import { defineSignal, g } from 'genshin-ts/runtime/core'

// Stable F1 manual-import ID. Lua only submits debug requests.
const GRAPH_ID = 1073741830
const debugWrite = defineSignal('WK_Debug_Write', [
  ['Field', 'int'],
  ['Index', 'int'],
  ['Value', 'float']
])
const debugRefresh = defineSignal('WK_Debug_Refresh', [])

// Sole owner of SOIL_Elems is the Soil entity, not Lua or the Level mirror.
g.server({ id: GRAPH_ID, name: 'WK_Soil_Water' })
  .on('whenEntityIsCreated', () => {
    stage.set('WK_DBG_SOIL_Elems', self.get('SOIL_Elems').asType('float_list'))
  })
  .on('whenTabIsSelected', (evt, f) => {
    if (evt.tabId === self.get('SOIL_WaterTabId').asType('int')) {
      const index = self.get('SOIL_WaterElementIndex').asType('int')
      const amount = self.get('SOIL_WaterAmount').asType('float')

      if (index >= 0n && index < 7n && amount > 0) {
        const elems = self.get('SOIL_Elems').asType('float_list')
        elems[idx(index)] = elems[idx(index)] + amount
        stage.set('WK_DBG_SOIL_Elems', elems)
        f.printString('WK_Soil_Water F1 input applied')
      }
    }
  })
  .onSignal(debugWrite, (evt, f) => {
    const field = evt.params.Field
    const index = evt.params.Index
    const value = evt.params.Value

    // F1 editor-only operation: SET one element, no capacity normalization.
    if (field === 0n && index >= 0n && index < 7n && value >= 0 && value <= 100000) {
      const elems = self.get('SOIL_Elems').asType('float_list')
      elems[idx(index)] = value
      stage.set('WK_DBG_SOIL_Elems', elems)
      f.printString('WK_Debug_Write Soil accepted')
    }
  })
  .onSignal(debugRefresh, () => {
    stage.set('WK_DBG_SOIL_Elems', self.get('SOIL_Elems').asType('float_list'))
  })
