import {
  type AquamelonGameService,
  type WorldState
} from '@idea-slime-bar/plugins'

import {
  MATERIAL_NAMES,
  entityName,
  flavorText,
  sourceText,
  vectorText
} from './format'

interface GroundPanelProps {
  world: WorldState
  game: AquamelonGameService
  debug: boolean
}

export function GroundPanel({ world, game, debug }: GroundPanelProps) {
  return (
    <section className="panel ground-panel" aria-labelledby="ground-title">
      <h2 id="ground-title">地面道具</h2>
      <p className="muted">摘下和加工得到的物品都会留在这里，可直接操作。</p>
      {world.materials.length ? (
        <ul className="item-list">
          {world.materials.map(item => (
            <li key={item.id} className="row ground-item">
              <div>
                <strong>{MATERIAL_NAMES[item.type]}</strong>
                <p className="muted">{sourceText(item.source)}</p>
                {debug && (
                  <div className="debug-vectors">
                    <p>道具编号：{entityName(item.id)}</p>
                    <p>亲和：{vectorText(item.affinity, 2)}</p>
                    <p>元素累积：{vectorText(item.elementAmount)}</p>
                    <p>风味比例：{flavorText(item.elementAmount)}</p>
                  </div>
                )}
              </div>
              {game.canProcess(item.id) && (
                <button onClick={() => game.process(item.id)}>加工</button>
              )}
            </li>
          ))}
        </ul>
      ) : <p className="empty-text">地面上还没有道具。成熟或未成熟的果实摘下后会出现在此处。</p>}
    </section>
  )
}
