import {
  ELEMENTS,
  PROTOTYPE_GAPS,
  type AquamelonGameService
} from '@idea-slime-bar/plugins'

import { ELEMENT_NAMES } from './format'

const gapNotes = [
  '青果营养分配暂取 0.85，位于设计范围 0.80–0.90 内。',
  '树苗储备上限及结果生长速率尚待校准；Web 使用独立的较快代谢参数。',
  '千星奇域 1/3/7 日目标尚未按历史逐次结算值验证。',
  '结构材料的元素累积量公式尚未设计。'
]

export function DebugPanel({ game }: { game: AquamelonGameService }) {
  return (
    <section className="panel debug-panel">
      <h2>调试工具</h2>
      <h3>推进游戏时间</h3>
      <div className="actions">
        <button onClick={() => game.advance(1)}>立即执行 1 次结算</button>
        <button onClick={() => game.advance(12)}>快进 12 次结算</button>
        <button onClick={() => game.advance(24)}>快进 24 次结算</button>
      </div>
      <h3>指定元素球（仅调试）</h3>
      <div className="actions">
        {ELEMENTS.map(name => (
          <button key={name} onClick={() => game.spawnElementBall(name)}>
            生成{ELEMENT_NAMES[name]}元素球
          </button>
        ))}
        <button onClick={() => game.spawnAllElementBalls()}>每种元素各生成一个</button>
      </div>
      <details>
        <summary>原型待确认事项</summary>
        {PROTOTYPE_GAPS.map((gap, index) => (
          <p key={gap}>{gapNotes[index] ?? '尚未确认的设计问题。'}</p>
        ))}
      </details>
    </section>
  )
}
