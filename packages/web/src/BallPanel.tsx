import {
  ELEMENTS,
  dominantElement,
  sumVector,
  type AquamelonGameService,
  type WorldState
} from '@idea-slime-bar/plugins'

import { ELEMENT_NAMES, entityName } from './format'

interface BallPanelProps {
  world: WorldState
  game: AquamelonGameService
}

export function BallPanel({ world, game }: BallPanelProps) {
  return (
    <section className="panel" aria-labelledby="balls-title">
      <h2 id="balls-title">元素球</h2>
      <div className="actions">
        <button onClick={() => game.condenseElement()} disabled={!world.soil}>富集</button>
        <button onClick={() => game.clearField()} disabled={!world.balls.length}>清空场地</button>
      </div>
      <p className="muted">富集获得随机元素球，收集后立即进入土壤。</p>
      {world.balls.length ? (
        <ul className="item-list">
          {world.balls.map(ball => {
            const index = dominantElement(ball.elems)
            const name = index === null ? '未知' : ELEMENT_NAMES[ELEMENTS[index]]
            return (
              <li key={ball.id} className="row ball-row">
                <div>
                  <strong>{name}元素球</strong>
                  <p className="muted">{entityName(ball.id)} · {sumVector(ball.elems).toFixed(1)}</p>
                </div>
                <button onClick={() => game.captureBall(ball.id)}>收集</button>
              </li>
            )
          })}
        </ul>
      ) : <p className="empty-text">地面上暂时没有元素球。</p>}
    </section>
  )
}
