import { Context } from '@deepseek-ai/cordis'
import {
  WatermelonGameService,
  type WorldState
} from '@idea-slime-bar/plugins'
import { useEffect, useState } from 'react'

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

    async function start() {
      try {
        await ctx.plugin(WatermelonGameService)
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
      unsubscribe?.()
      void ctx.fiber.dispose()
    }
  }, [])

  return runtime
}
