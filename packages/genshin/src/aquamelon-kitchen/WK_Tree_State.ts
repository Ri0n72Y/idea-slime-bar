import { defineSignal, g } from 'genshin-ts/runtime/core'

// Compiler-only ID; actual entity graph is manually imported and attached.
const GRAPH_ID = 1073741831
const debugWrite = defineSignal('WK_Debug_Write', [
  ['Field', 'int'],
  ['Index', 'int'],
  ['Value', 'float']
])
const debugRefresh = defineSignal('WK_Debug_Refresh', [])

g.server({ id: GRAPH_ID, name: 'WK_Tree_State' })
  .on('whenEntityIsCreated', (_evt, f) => {
    stage.set('WK_DBG_TREE_Stage', self.get('TREE_Stage').asType('int'))
    stage.set('WK_DBG_TREE_Elems', self.get('TREE_Elems').asType('float_list'))
    stage.set('WK_DBG_TREE_Growth', self.get('TREE_Growth').asType('float_list'))
    stage.set('WK_DBG_TREE_BaseAffinity', self.get('TREE_BaseAffinity').asType('float_list'))
    stage.set('WK_DBG_TREE_EffectiveAffinity', self.get('TREE_EffectiveAffinity').asType('float_list'))
    stage.set('WK_DBG_TREE_RootPreference', self.get('TREE_RootPreference').asType('float_list'))
    stage.set('WK_DBG_LastGrowthTickAt', self.get('LastGrowthTickAt').asType('float'))
    f.printString('WK_Tree_State F1 ready')
  })
  .onSignal(debugWrite, (evt, f) => {
    const field = evt.params.Field
    const index = evt.params.Index
    const value = evt.params.Value

    if (field === 1n && value >= 0 && value <= 2) {
      self.set('TREE_Stage', int(value))
    }
    if (index >= 0n && index < 7n && value >= 0 && value <= 100000) {
      if (field === 2n) {
        const elems = self.get('TREE_Elems').asType('float_list')
        elems[idx(index)] = value
      }
      if (field === 3n) {
        const growth = self.get('TREE_Growth').asType('float_list')
        growth[idx(index)] = value
      }
      if (field === 4n && value <= 10) {
        const base = self.get('TREE_BaseAffinity').asType('float_list')
        base[idx(index)] = value
      }
      if (field === 5n && value <= 10) {
        const effective = self.get('TREE_EffectiveAffinity').asType('float_list')
        effective[idx(index)] = value
      }
      if (field === 6n && value <= 1) {
        const preference = self.get('TREE_RootPreference').asType('float_list')
        preference[idx(index)] = value
      }
    }

    stage.set('WK_DBG_TREE_Stage', self.get('TREE_Stage').asType('int'))
    stage.set('WK_DBG_TREE_Elems', self.get('TREE_Elems').asType('float_list'))
    stage.set('WK_DBG_TREE_Growth', self.get('TREE_Growth').asType('float_list'))
    stage.set('WK_DBG_TREE_BaseAffinity', self.get('TREE_BaseAffinity').asType('float_list'))
    stage.set('WK_DBG_TREE_EffectiveAffinity', self.get('TREE_EffectiveAffinity').asType('float_list'))
    stage.set('WK_DBG_TREE_RootPreference', self.get('TREE_RootPreference').asType('float_list'))
    f.printString('WK_Debug_Write Tree state readback')
  })
  .onSignal(debugRefresh, () => {
    stage.set('WK_DBG_TREE_Stage', self.get('TREE_Stage').asType('int'))
    stage.set('WK_DBG_TREE_Elems', self.get('TREE_Elems').asType('float_list'))
    stage.set('WK_DBG_TREE_Growth', self.get('TREE_Growth').asType('float_list'))
    stage.set('WK_DBG_TREE_BaseAffinity', self.get('TREE_BaseAffinity').asType('float_list'))
    stage.set('WK_DBG_TREE_EffectiveAffinity', self.get('TREE_EffectiveAffinity').asType('float_list'))
    stage.set('WK_DBG_TREE_RootPreference', self.get('TREE_RootPreference').asType('float_list'))
    stage.set('WK_DBG_LastGrowthTickAt', self.get('LastGrowthTickAt').asType('float'))
  })
