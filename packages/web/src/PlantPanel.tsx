import {
  ELEMENTS,
  sumVector,
  type AquamelonGameService,
  type AquamelonTree,
  type WorldState
} from '@idea-slime-bar/plugins'

import { ELEMENT_NAMES, TREE_NAMES, vectorText } from './format'
import { LeafRow } from './LeafRow'

interface PlantPanelProps {
  world: WorldState
  game: AquamelonGameService
  debug: boolean
}

function growthTarget(stage: AquamelonTree['stage']) {
  return stage === 'Seed' ? 45 : stage === 'Seedling' ? 90 : 100
}

export function PlantPanel({ world, game, debug }: PlantPanelProps) {
  const tree = world.tree

  return (
    <section className="panel" aria-labelledby="plant-title">
      <h2 id="plant-title">植物状态</h2>
      <ul className="item-list">
        <li className="plant-item">
          <div className="row">
            <strong>土壤</strong>
            {!world.soil && <button onClick={() => game.placeSoil()}>放置土壤</button>}
          </div>
          {world.soil ? (
            <div className="soil-elements" aria-label="土壤七元素储备">
              {ELEMENTS.map((name, index) => (
                <span key={name} className="soil-element">
                  <b>{ELEMENT_NAMES[name]}</b>
                  <span>{world.soil!.elems[index].toFixed(1)}</span>
                </span>
              ))}
            </div>
          ) : <p className="muted">尚未放置土壤。</p>}
        </li>
        <li className="plant-item">
          <div className="row">
            <div>
              <strong>{tree ? '水瓜 · ' + TREE_NAMES[tree.stage] : '水瓜种子'}</strong>
              {tree ? (
                <>
                  <p>生长 {sumVector(tree.growth).toFixed(1)} / {growthTarget(tree.stage)}
                    {tree.stage === 'Sapling' ? '（循环）' : ''}
                  </p>
                  {tree.stage === 'Sapling' && (
                    <p className="muted">{tree.activity === 'Growing' ? '生长中' : '休眠中'}</p>
                  )}
                </>
              ) : <p className="muted">尚未种植。</p>}
            </div>
            {world.soil && !tree && <button onClick={() => game.plantSeed()}>种下水瓜种子</button>}
          </div>
          {debug && tree && (
            <div className="debug-vectors">
              <p>树干生长：{vectorText(tree.growth)}</p>
              <p>储备：{vectorText(tree.reserve)}</p>
              <p>基础亲和：{vectorText(tree.baseAffinity, 2)}</p>
              <p>有效亲和：{vectorText(tree.effectiveAffinity, 2)}</p>
            </div>
          )}
        </li>
        {tree?.budGrowth && (
          <li className="plant-item">
            <div className="row">
              <div>
                <strong>活动嫩芽</strong>
                <p className="muted">生长 {sumVector(tree.budGrowth).toFixed(1)} / 20</p>
              </div>
              <button onClick={() => game.pinchBud()}>掐掉</button>
            </div>
            {debug && <p className="debug-vectors">嫩芽生长：{vectorText(tree.budGrowth)}</p>}
          </li>
        )}
        {tree?.leaves.map(leaf => (
          <LeafRow
            key={leaf.id}
            leaf={leaf}
            nowMs={world.nowMs}
            debug={debug}
            harvestLeaf={id => { game.harvestLeaf(id) }}
            harvestFruit={id => { game.harvestFruit(id) }}
          />
        ))}
      </ul>
    </section>
  )
}
