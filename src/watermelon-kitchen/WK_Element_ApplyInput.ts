import { g } from 'genshin-ts/runtime/core'

const CFG_ENTITY_GUID = 1094713345n

/**
 * Mirrors the editor subgraph: element_decay_calc(index, hours) -> result.
 *
 * Editor/manual patch required after compilation:
 * genshin-ts currently cannot split a custom Structure value into typed fields.
 * Replace the fallback affinity list below with:
 * CFG entity -> get custom variable CFG -> split structure -> Affinity -> list[index].
 */
function gstsServerElementDecayCalc(index: bigint, hours: number) {
  const elems = self.get('TREE_Elems').asType('float_list')

  const cfgEntity = gsts.f.queryEntityByGuid(guid(CFG_ENTITY_GUID))
  const baseDecayPerHour = cfgEntity.get('CFG_BaseDecayPerHour').asType('float')

  // Temporary compiler bridge for the editor-authored CFG.Affinity field.
  // Fixed order: Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo.
  const affinity = list('float', [0.85, 1.15, 0.9, 0.75, 1.2, 0.7, 0.95])
  const affinityAtIndex = affinity[idx(index)]

  const decayRate = baseDecayPerHour / affinityAtIndex
  const decayBase = 1 - decayRate
  const decayFactor = decayBase ** hours
  const result = elems[idx(index)] * decayFactor

  return result
}

g.server({
  name: 'WK_Element_ApplyInput'
}).on('whenEntityIsCreated', (evt, f) => {
  // Match the handwritten graph: resolve the event source by GUID for the
  // persisted timestamp, while TREE_Elems / TREE_Locks are read from self.
  const tree = f.queryEntityByGuid(evt.eventSourceGuid)

  const lastUpdateAt = tree.get('TREE_LastElementUpdateAt').asType('float')

  // queryTimestampUtc0() is an integer timestamp in genshin-ts.
  // TREE_LastElementUpdateAt is currently authored as float in the editor,
  // so make the conversion explicit before arithmetic/write-back.
  const now = float(f.queryTimestampUtc0())

  if (lastUpdateAt === 0) {
    tree.set('TREE_LastElementUpdateAt', now)
  } else {
    const elapsedHoursRaw = (now - lastUpdateAt) / 3600

    if (elapsedHoursRaw > 0) {
      // Keep this as a direct value connection. genshin-ts 0.2.2 lowers a
      // forced `let` LocalVariable incorrectly when it is passed into a
      // gstsServer* function, causing generic matching to receive the
      // LocalVariable handle instead of its float value.
      const elapsedHours = elapsedHoursRaw

      // finiteLoop end is inclusive: seven elements are indices 0..6.
      f.finiteLoop(0n, 6n, (index) => {
        const locks = self.get('TREE_Locks').asType('bool_list')

        if (!locks[idx(index)]) {
          const result = gstsServerElementDecayCalc(index, elapsedHours)
          const elems = self.get('TREE_Elems').asType('float_list')
          elems[idx(index)] = result
        }
      })
    }

    tree.set('TREE_LastElementUpdateAt', now)
  }
})
