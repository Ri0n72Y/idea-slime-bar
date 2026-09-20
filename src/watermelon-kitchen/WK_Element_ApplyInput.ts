import { g } from 'genshin-ts/runtime/core'

const BASE_ELEMENT_INPUT = 20
const MAX_ELEMENT_LOAD = 100

g.server({
  name: 'WK_Element_ApplyInput'
}).onSignal('WK_Element_ApplyInput', (_evt, _f) => {
  const elems = self.get('Elems').asType('float_list')
  const locks = self.get('Locks').asType('bool_list')
  const inputElem = self.get('InputElem').asType('int')

  // EXPERIMENT ONLY:
  // Final version should read this from the stage CFG.Affinity binding.
  const affinity = list('float', [0.85, 1.15, 0.9, 0.75, 1.2, 0.7, 0.95])
  const indices = list('int', [0n, 1n, 2n, 3n, 4n, 5n, 6n])

  const gain = BASE_ELEMENT_INPUT * affinity[idx(inputElem)]

  // The newly input element is protected from the current eviction.
  // Locked elements are protected as well.
  let protectedTotal = elems[idx(inputElem)]
  let evictableTotal = 0

  indices.forEach((i) => {
    if (i !== inputElem) {
      const current = elems[idx(i)]
      if (locks[idx(i)]) {
        protectedTotal = protectedTotal + current
      } else {
        evictableTotal = evictableTotal + current
      }
    }
  })

  // If the protected portion already consumes most of the capacity,
  // the new input is reduced before eviction.
  const maxGain = Math.max(0, MAX_ELEMENT_LOAD - protectedTotal)
  const appliedGain = Math.min(gain, maxGain)

  // Evict only other unlocked elements, proportionally.
  const totalBefore = protectedTotal + evictableTotal
  const overflow = Math.min(
    evictableTotal,
    Math.max(0, totalBefore + appliedGain - MAX_ELEMENT_LOAD)
  )

  let remainingRatio = 1
  if (evictableTotal > 0) {
    remainingRatio = (evictableTotal - overflow) / evictableTotal
  }

  indices.forEach((i) => {
    if (i !== inputElem && !locks[idx(i)]) {
      elems[idx(i)] = elems[idx(i)] * remainingRatio
    }
  })

  elems[idx(inputElem)] = elems[idx(inputElem)] + appliedGain
})
