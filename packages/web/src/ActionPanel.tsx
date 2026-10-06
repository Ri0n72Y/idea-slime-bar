import {
  ELEMENTS,
  type WatermelonGameService,
  type WorldState,
  type WorldTarget
} from '@idea-slime-bar/plugins'

type Props = {
  game: WatermelonGameService
  world: WorldState
  selected: WorldTarget
  onSelect: (target: WorldTarget) => void
}

export function ActionPanel({ game, world, selected, onSelect }: Props) {
  const tree = world.tree

  if (selected.kind === 'plot') {
    return (
      <section className="panel">
        <h2>Empty field</h2>
        <p>The only available action is to place Soil.</p>
        <button className="primary" onClick={() => game.placeSoil()}>Place Soil</button>
      </section>
    )
  }

  if (selected.kind === 'soil') {
    return (
      <section className="panel">
        <h2>Soil actions</h2>
        {!tree && <button className="primary" onClick={() => game.plantSeed()}>Plant Aquamelon Seed</button>}
        <div className="element-actions">
          {ELEMENTS.map((element) => (
            <button key={element} onClick={() => game.spawnElementBall(element)}>+ {element} ball</button>
          ))}
        </div>
        <button onClick={() => game.spawnAllElementBalls()}>Debug: spawn one of each</button>
        <p className="hint">Balls are real world objects. Click a ball in the field to guide it into Soil.</p>
      </section>
    )
  }

  if (selected.kind === 'tree') {
    return (
      <section className="panel">
        <h2>Aquamelon Tree</h2>
        <p>{tree?.stage ?? 'No tree'} {tree?.stage === 'Sapling' ? '· ' + tree.activity : ''}</p>
        {tree?.budGrowth && <button onClick={() => game.pinchBud()}>Pinch active Bud</button>}
        <button onClick={() => onSelect({ kind: 'soil' })}>Cultivate Soil</button>
      </section>
    )
  }

  if (selected.kind === 'leaf') {
    const leaf = tree?.leaves.find((item) => item.id === selected.id)
    if (!leaf) return <section className="panel"><p>Leaf no longer exists.</p></section>
    const fruit = leaf.reproductive
    const harvestableFruit = fruit?.stage === 'GreenFruit' || fruit?.stage === 'MatureFruit'

    return (
      <section className="panel">
        <h2>{leaf.stage}</h2>
        <p>{leaf.reproductive ? 'Attached: ' + leaf.reproductive.stage : 'No attached reproductive organ'}</p>
        {harvestableFruit && (
          <button className="primary" onClick={() => game.harvestFruit(leaf.id)}>
            Harvest {fruit.stage}
          </button>
        )}
        {!leaf.reproductive && (
          <button onClick={() => game.harvestLeaf(leaf.id)}>Harvest {leaf.stage}</button>
        )}
        {leaf.reproductive && !harvestableFruit && (
          <p className="hint">Current organ is still developing; advance real settlement time.</p>
        )}
      </section>
    )
  }

  if (selected.kind === 'material') {
    const material = world.materials.find((item) => item.id === selected.id)
    if (!material) return <section className="panel"><p>Material no longer exists.</p></section>
    return (
      <section className="panel">
        <h2>{material.type}</h2>
        <p>World Material · source {material.source}</p>
        {game.canProcess(material.id) ? (
          <button className="primary" onClick={() => game.process(material.id)}>Process material</button>
        ) : (
          <p className="hint">No confirmed Processing route for this Material.</p>
        )}
      </section>
    )
  }

  return <section className="panel"><p>Select a world object.</p></section>
}
