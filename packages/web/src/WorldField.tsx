import {
  ELEMENT_COLORS,
  ELEMENTS,
  dominantElement,
  type ElementVector,
  type WorldState,
  type WorldTarget
} from '@idea-slime-bar/plugins'
import type { CSSProperties } from 'react'

type Props = {
  world: WorldState
  selected: WorldTarget
  onSelect: (target: WorldTarget) => void
  onPlaceSoil: () => void
  onCaptureBall: (id: string) => void
}

function tintFor(vector: ElementVector) {
  const index = dominantElement(vector)
  return index === null ? undefined : ELEMENT_COLORS[index]
}

export function WorldField({ world, selected, onSelect, onPlaceSoil, onCaptureBall }: Props) {
  const tree = world.tree

  return (
    <section className="field-card">
      <div className="field-sky">
        <span>Prototype Field</span>
        <small>click objects to inspect / act</small>
      </div>

      <div className="field">
        <button
          className={'soil-patch ' + (selected.kind === 'soil' || selected.kind === 'plot' ? 'selected' : '')}
          onClick={() => world.soil ? onSelect({ kind: 'soil' }) : onPlaceSoil()}
        >
          <span className="soil-icon">{world.soil ? '🟫' : '▫️'}</span>
          <span>{world.soil ? 'Soil' : 'Empty field'}</span>
        </button>

        {tree && (
          <button
            className={'tree-object ' + (selected.kind === 'tree' ? 'selected' : '')}
            style={{ '--object-tint': tintFor(tree.stage === 'Sapling' ? tree.reserve : tree.growth) } as CSSProperties}
            onClick={() => onSelect({ kind: 'tree' })}
          >
            <span className="tree-crown">{tree.stage === 'Seed' ? '🌰' : tree.stage === 'Seedling' ? '🌱' : '🌳'}</span>
            <span>{tree.stage}</span>
            {tree.stage === 'Sapling' && <small>{tree.activity}</small>}
          </button>
        )}

        <div className="leaf-cluster">
          {tree?.leaves.map((leaf) => (
            <button
              key={leaf.id}
              className={'leaf-object ' + (selected.kind === 'leaf' && selected.id === leaf.id ? 'selected' : '')}
              style={{ '--object-tint': tintFor(leaf.growth) } as CSSProperties}
              onClick={() => onSelect({ kind: 'leaf', id: leaf.id })}
            >
              <span>{leaf.stage === 'AquamelonLeaf' ? '🍂' : '🍃'}</span>
              <b>{leaf.stage}</b>
              {leaf.reproductive && (
                <small>
                  {leaf.reproductive.stage === 'FlowerBud' && '🌿 bud'}
                  {leaf.reproductive.stage === 'Flower' && '🌼 flower'}
                  {leaf.reproductive.stage === 'GreenFruit' && '🟢 green fruit'}
                  {leaf.reproductive.stage === 'MatureFruit' && '🥥 mature fruit'}
                </small>
              )}
            </button>
          ))}
        </div>

        <div className="ball-cluster">
          {world.balls.map((ball) => {
            const index = dominantElement(ball.elems)
            return (
              <button
                key={ball.id}
                className="element-ball"
                style={{ '--ball-color': index === null ? '#fff' : ELEMENT_COLORS[index] } as CSSProperties}
                title="Only available action: guide into Soil"
                onClick={() => onCaptureBall(ball.id)}
              >
                {index === null ? '?' : ELEMENTS[index][0]}
                <small>{ball.elems[index ?? 0].toFixed(1)}</small>
              </button>
            )
          })}
        </div>

        <div className="material-cluster">
          {world.materials.map((material) => (
            <button
              key={material.id}
              className={'material-object ' + (selected.kind === 'material' && selected.id === material.id ? 'selected' : '')}
              onClick={() => onSelect({ kind: 'material', id: material.id })}
            >
              <span>📦</span>
              <small>{material.type}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
