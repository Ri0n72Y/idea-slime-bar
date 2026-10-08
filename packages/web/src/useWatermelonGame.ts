import { Context } from '@deepseek-ai/cordis'
import {
  WatermelonGameService,
  type WorldState
} from '@idea-slime-bar/plugins'
import { useEffect, useState } from 'react'

const ONLINE_TICK_MS = 60_000
const HOUR_MS = 60 * 60 * 1000

type RuntimeState = {
  status: 'starting' | 'ready' | 'error'
  game: WatermelonGameService | null
  world: WorldState | null
  error: string
}

export function useWatermelonGame() {
  const [runtime, setRuntime] = useState<RuntimeState>({
    status: 'starting',
    game: null,
    world: null,
    error: ''
  })

  useEffect(() => {
    const ctx = new Context()
    let active = true
    let unsubscribe: (() => void) | null = null
    let timer: ReturnType<typeof setInterval> | null = null

    async function start() {
      try {
        await ctx.plugin(WatermelonGameService)
        if (!active) return
        const game = ctx.watermelon
        const update = () => {
          if (active) {
            setRuntime({
              status: 'ready',
              game,
              world: game.getSnapshot(),
              error: ''
            })
          }
        }
        unsubscribe = game.subscribe(update)
        update()

        let lastWallMs = Date.now()
        timer = setInterval(() => {
          const nowMs = Date.now()
          const elapsedMs = nowMs - lastWallMs
          if (elapsedMs <= 0) return
          lastWallMs = nowMs
          game.advance(elapsedMs / HOUR_MS)
        }, ONLINE_TICK_MS)
      } catch (error) {
        if (active) {
          setRuntime({
            status: 'error',
            game: null,
            world: null,
            error: error instanceof Error ? error.message : 'Unknown runtime error'
          })
        }
      }
    }

    void start()
    return () => {
      active = false
      if (timer !== null) clearInterval(timer)
      unsubscribe?.()
      void ctx.fiber.dispose()
    }
  }, [])

  return runtime
}
