import {
  type WorldTarget
} from '@idea-slime-bar/plugins'
import { useEffect, useState } from 'react'

import { ActionPanel } from './ActionPanel'
import { DebugPanel } from './DebugPanel'
import { useWatermelonGame } from './useWatermelonGame'
import { WorldField } from './WorldField'
import './styles.css'

export function App() {
  const runtime = useWatermelonGame()
  const [selected, setSelected] = useState<WorldTarget>({ kind: 'plot' })

  useEffect(() => {
    const world = runtime.world
    if (!world) return
    if (world.soil && selected.kind === 'plot') setSelected({ kind: 'soil' })
    if (!world.materials.some((item) => selected.kind === 'material' && item.id === selected.id)) {
      if (selected.kind === 'material') setSelected({ kind: 'tree' })
    }
  }, [runtime.world, selected])

  if (runtime.status === 'starting') {
    return <main className="loading">Starting Cordis gameplay service…</main>
  }

  if (runtime.status === 'error' || !runtime.game || !runtime.world) {
    return <main className="loading error">Runtime error: {runtime.error}</main>
  }

  const { game, world } = runtime

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <span className="eyebrow">Cordis browser playable v0</span>
          <h1>Watermelon Kitchen</h1>
          <p>Grow one strange tree, watch its elements learn, then harvest and process what it becomes.</p>
        </div>
        <div className="time-controls">
          <button onClick={() => game.advance(1)}>+1h</button>
          <button onClick={() => game.advance(12)}>+12h</button>
          <button onClick={() => game.advance(24)}>+1d</button>
          <button className="danger" onClick={() => {
            game.reset()
            setSelected({ kind: 'plot' })
          }}>Reset World</button>
        </div>
      </header>

      <div className="game-layout">
        <div className="play-column">
          <WorldField
            world={world}
            selected={selected}
            onSelect={setSelected}
            onCaptureBall={(id) => game.captureBall(id)}
          />
          <ActionPanel game={game} world={world} selected={selected} onSelect={setSelected} />
        </div>
        <DebugPanel world={world} />
      </div>
    </main>
  )
}
