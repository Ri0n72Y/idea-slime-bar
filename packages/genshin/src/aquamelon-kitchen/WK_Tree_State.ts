import { g } from 'genshin-ts/runtime/core'

// Compiler ID only; manual import does not require an existing editor graph ID.
const GRAPH_ID = 1073741831

/**
 * F1 read-only proof that the server can access editor-owned Tree state.
 * Defaults are created by the Tree custom-variable component.
 * No Growth Tick, decay, stage transitions or persistence replay here.
 */
g.server({
  id: GRAPH_ID,
  name: 'WK_Tree_State'
}).on('whenEntityIsCreated', (_evt, f) => {
  const stage = self.get('TREE_Stage').asType('int')
  const reserve = self.get('TREE_Elems').asType('float_list')
  const growth = self.get('TREE_Growth').asType('float_list')

  let reserveTotal = 0
  let growthTotal = 0

  for (let index = 0n; index < 7n; index++) {
    reserveTotal = reserveTotal + reserve[idx(index)]
    growthTotal = growthTotal + growth[idx(index)]
  }

  f.printString('WK_Tree_State F1 stage / reserve total / growth total:')
  f.printString(str(stage))
  f.printString(str(reserveTotal))
  f.printString(str(growthTotal))
})
