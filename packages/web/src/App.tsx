import { useState } from 'react'
import { WEB_BALANCE } from '@idea-slime-bar/plugins'

import { BallPanel } from './BallPanel'
import { DebugPanel } from './DebugPanel'
import { GroundPanel } from './GroundPanel'
import { PlantPanel } from './PlantPanel'
import { timeText } from './format'
import { logText } from './log-zh'
import { useAquamelonGame } from './useAquamelonGame'
import './styles.css'

export function App() {
  const [debug, setDebug] = useState(false)
  const runtime = useAquamelonGame()

  if (runtime.status === 'starting') {
    return <main className="app-shell"><p>正在启动水瓜厨房……</p></main>
  }

  if (runtime.status === 'error' || !runtime.game || !runtime.world) {
    return <main className="app-shell"><p>启动失败，请刷新页面后重试。</p></main>
  }

  const { game, world } = runtime
  const intervalSeconds = WEB_BALANCE['tick:time'].realMillisecondsPerTick / 1000

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <h1>水瓜厨房</h1>
          <p className="muted">
            游戏时间：{timeText(world.nowMs)} · 第 {world.tickCount} 次结算
            · 每 {intervalSeconds} 秒自动结算
          </p>
        </div>
        <button
          aria-pressed={debug}
          onClick={() => setDebug(value => !value)}
          className="mode-toggle"
        >
          {debug ? '退出调试模式' : '进入调试模式'}
        </button>
      </header>
      <div className="game-layout">
        <div className="left-stack">
          <PlantPanel world={world} game={game} debug={debug} />
          <BallPanel world={world} game={game} />
        </div>
        <GroundPanel world={world} game={game} debug={debug} />
      </div>
      <details className="panel event-panel">
        <summary>最近事件</summary>
        <div className="events">
          {[...world.logs].reverse().slice(0, 18).map((entry, index) => (
            <p key={entry.atMs + '-' + index}>
              <time>{timeText(entry.atMs)}</time> · {logText(entry.message)}
            </p>
          ))}
        </div>
      </details>
      {debug && <DebugPanel game={game} />}
      <footer className="page-footer">
        <button onClick={() => game.reset()}>重置世界</button>
      </footer>
    </main>
  )
}
