import {
  ELEMENTS,
  PROTOTYPE_GAPS,
  sumVector,
  type WorldState
} from '@idea-slime-bar/plugins'

import { flavorText, timeText, vectorText } from './format'

export function DebugPanel({ world }: { world: WorldState }) {
  const tree = world.tree
  return (
    <aside className="debug-panel">
      <div className="debug-heading">
        <h2>Canonical state</h2>
        <span>{timeText(world.nowMs)}</span>
      </div>

      <details open>
        <summary>Soil / Tree</summary>
        <p><b>Soil</b> {world.soil ? vectorText(world.soil.elems) : 'not placed'}</p>
        {tree && (
          <>
            <p><b>Stage</b> {tree.stage} {tree.stage === 'Sapling' ? '· ' + tree.activity : ''}</p>
            <p><b>Reserve</b> {vectorText(tree.reserve)} · total {sumVector(tree.reserve).toFixed(1)}</p>
            <p><b>Growth</b> {vectorText(tree.growth)} · total {sumVector(tree.growth).toFixed(1)}</p>
            <p><b>Affinity</b> {vectorText(tree.effectiveAffinity, 2)}</p>
            <p><b>Bud Growth</b> {tree.budGrowth ? vectorText(tree.budGrowth) : 'none'}</p>
          </>
        )}
      </details>

      <details>
        <summary>Organs</summary>
        {tree?.leaves.length ? tree.leaves.map((leaf) => (
          <div className="debug-organ" key={leaf.id}>
            <b>{leaf.id} · {leaf.stage}</b>
            <span>Growth: {vectorText(leaf.growth)}</span>
            <span>Affinity: {vectorText(leaf.effectiveAffinity, 2)}</span>
            {leaf.reproductive && (
              <>
                <span>Repro: {leaf.reproductive.stage} · Growth {sumVector(leaf.reproductive.growth).toFixed(1)}</span>
                <span>FruitAmount: {vectorText(leaf.reproductive.fruitElementAmount)}</span>
                <span>Flavor: {flavorText(leaf.reproductive.fruitElementAmount)}</span>
              </>
            )}
          </div>
        )) : <p>No leaves yet.</p>}
      </details>

      <details>
        <summary>World Materials</summary>
        {world.materials.length ? world.materials.map((material) => (
          <div className="debug-organ" key={material.id}>
            <b>{material.id} · {material.type}</b>
            <span>Affinity: {vectorText(material.affinity, 2)}</span>
            <span>ElementAmount: {vectorText(material.elementAmount)}</span>
            <span>Flavor: {flavorText(material.elementAmount)}</span>
          </div>
        )) : <p>No harvested Materials yet.</p>}
      </details>

      <details>
        <summary>Known design gaps</summary>
        {PROTOTYPE_GAPS.map((gap) => <p key={gap}>• {gap}</p>)}
      </details>

      <details open>
        <summary>Settlement log</summary>
        <div className="log">
          {[...world.logs].reverse().slice(0, 18).map((entry, index) => (
            <div key={entry.atMs + '-' + index}>
              <time>{timeText(entry.atMs).slice(5)}</time>
              <span>{entry.message}</span>
            </div>
          ))}
        </div>
      </details>

      <details>
        <summary>Vector order</summary>
        <p>{ELEMENTS.join(' / ')}</p>
      </details>
    </aside>
  )
}
