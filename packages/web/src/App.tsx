import {
  ELEMENTS,
  PROTOTYPE_GAPS,
  dominantElement,
  sumVector,
  type ElementBall,
  type Leaf,
  type WorldMaterial
} from '@idea-slime-bar/plugins'

import { flavorText, timeText, vectorText } from './format'
import { useWatermelonGame } from './useWatermelonGame'
import './styles.css'

function ballName(ball: ElementBall) {
  const index = dominantElement(ball.elems)
  return index === null ? 'Unknown' : ELEMENTS[index]
}

function LeafRow({
  leaf,
  harvestFruit,
  harvestLeaf
}: {
  leaf: Leaf
  harvestFruit: (id: string) => void
  harvestLeaf: (id: string) => void
}) {
  const organ = leaf.reproductive
  const harvestable = organ?.stage === 'GreenFruit' || organ?.stage === 'MatureFruit'

  return (
    <article className="row">
      <div>
        <b>{leaf.id} · {leaf.stage}</b>
        <p>Growth: {vectorText(leaf.growth)}</p>
        <p>Affinity: {vectorText(leaf.effectiveAffinity, 2)}</p>
        {organ && (
          <>
            <p>Reproductive organ: {organ.stage} · Growth {sumVector(organ.growth).toFixed(1)}</p>
            <p>FruitElementAmount: {vectorText(organ.fruitElementAmount)}</p>
            <p>FlavorRatio: {flavorText(organ.fruitElementAmount)}</p>
          </>
        )}
      </div>
      <div className="actions">
        {harvestable && (
          <button onClick={() => harvestFruit(leaf.id)}>Harvest {organ.stage}</button>
        )}
        {!organ && <button onClick={() => harvestLeaf(leaf.id)}>Harvest leaf</button>}
      </div>
    </article>
  )
}

function MaterialRow({
  material,
  canProcess,
  process
}: {
  material: WorldMaterial
  canProcess: boolean
  process: (id: string) => void
}) {
  return (
    <article className="row">
      <div>
        <b>{material.id} · {material.type}</b>
        <p>Source: {material.source}</p>
        <p>Affinity: {vectorText(material.affinity, 2)}</p>
        <p>ElementAmount: {vectorText(material.elementAmount)}</p>
        <p>FlavorRatio: {flavorText(material.elementAmount)}</p>
      </div>
      {canProcess && <button onClick={() => process(material.id)}>Process</button>}
    </article>
  )
}

export function App() {
  const runtime = useWatermelonGame()

  if (runtime.status === 'starting') {
    return <main className="app-shell"><p>Starting Watermelon Kitchen…</p></main>
  }

  if (runtime.status === 'error' || !runtime.game || !runtime.world) {
    return <main className="app-shell"><p>Runtime error: {runtime.error}</p></main>
  }

  const { game, world } = runtime
  const tree = world.tree

  return (
    <main className="app-shell">
      <header>
        <h1>Watermelon Kitchen</h1>
        <p>Current time: {timeText(world.nowMs)}</p>
      </header>

      <section>
        <h2>Soil</h2>
        {world.soil ? (
          <>
            <p>{vectorText(world.soil.elems)}</p>
            {!tree && <button onClick={() => game.plantSeed()}>Plant Aquamelon Seed</button>}
            <div className="actions">
              {ELEMENTS.map((element) => (
                <button key={element} onClick={() => game.spawnElementBall(element)}>
                  Spawn {element} Element Ball
                </button>
              ))}
              <button onClick={() => game.spawnAllElementBalls()}>Spawn one of each</button>
            </div>
          </>
        ) : (
          <button onClick={() => game.placeSoil()}>Place Soil</button>
        )}
      </section>

      <section>
        <h2>Tree</h2>
        {tree ? (
          <>
            <p>Stage: {tree.stage} · Activity: {tree.activity}</p>
            <p>Growth: {vectorText(tree.growth)} · total {sumVector(tree.growth).toFixed(1)}</p>
            <p>Reserve: {vectorText(tree.reserve)} · total {sumVector(tree.reserve).toFixed(1)}</p>
            <p>Affinity: {vectorText(tree.effectiveAffinity, 2)}</p>
            <p>Bud: {tree.budGrowth ? vectorText(tree.budGrowth) : 'none'}</p>
            {tree.budGrowth && <button onClick={() => game.pinchBud()}>Pinch active Bud</button>}
            <h3>Leaves / reproductive organs</h3>
            {tree.leaves.length ? tree.leaves.map((leaf) => (
              <LeafRow
                key={leaf.id}
                leaf={leaf}
                harvestFruit={(id) => { game.harvestFruit(id) }}
                harvestLeaf={(id) => { game.harvestLeaf(id) }}
              />
            )) : <p>No leaves yet.</p>}
          </>
        ) : <p>No tree planted.</p>}
      </section>

      <section>
        <h2>Element Balls</h2>
        {world.balls.length ? world.balls.map((ball) => (
          <article className="row compact" key={ball.id}>
            <span>{ball.id} · {ballName(ball)} Ball · {sumVector(ball.elems).toFixed(1)}</span>
            <button onClick={() => game.captureBall(ball.id)}>Guide to Soil</button>
          </article>
        )) : <p>No world Element Balls.</p>}
      </section>

      <section>
        <h2>World Materials</h2>
        {world.materials.length ? world.materials.map((material) => (
          <MaterialRow
            key={material.id}
            material={material}
            canProcess={game.canProcess(material.id)}
            process={(id) => { game.process(id) }}
          />
        )) : <p>No harvested Materials yet.</p>}
      </section>

      <section>
        <h2>Time Controls</h2>
        <div className="actions">
          <button onClick={() => game.advance(1)}>+1h</button>
          <button onClick={() => game.advance(12)}>+12h</button>
          <button onClick={() => game.advance(24)}>+1d</button>
        </div>
      </section>

      <section>
        <h2>Recent Events / Settlement Log</h2>
        <div className="log">
          {[...world.logs].reverse().slice(0, 18).map((entry, index) => (
            <p key={entry.atMs + '-' + index}>
              <time>{timeText(entry.atMs)}</time> · {entry.message}
            </p>
          ))}
        </div>
      </section>

      <section>
        <h2>Prototype Notes</h2>
        {PROTOTYPE_GAPS.map((gap) => <p key={gap}>{gap}</p>)}
      </section>

      <button className="reset" onClick={() => game.reset()}>Reset World</button>
    </main>
  )
}
