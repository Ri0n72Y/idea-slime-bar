import { Context } from '@deepseek-ai/cordis'
import {
  WatermelonGameService,
  WEB_BALANCE,
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

        timer = setInterval(() => {
          game.advance(1)
        }, WEB_BALANCE['tick:time'].realMillisecondsPerTick)
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
