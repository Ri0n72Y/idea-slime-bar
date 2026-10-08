import { Context } from '@deepseek-ai/cordis'
import { WebProbeService } from '@idea-slime-bar/plugins'
import { useEffect, useState } from 'react'

type ProbeState = {
  cordis: 'starting' | 'ready' | 'error'
  probe: string
}

export function App() {
  const [state, setState] = useState<ProbeState>({
    cordis: 'starting',
    probe: 'pending'
  })

  useEffect(() => {
    const ctx = new Context()
    let active = true

    async function start() {
      try {
        await ctx.plugin(WebProbeService)

        if (active) {
          setState({
            cordis: 'ready',
            probe: ctx.webProbe.status
          })
        }
      } catch (error) {
        if (active) {
          setState({
            cordis: 'error',
            probe: error instanceof Error ? error.message : 'unknown error'
          })
        }
      }
    }

    void start()

    return () => {
      active = false
      void ctx.fiber.dispose()
    }
  }, [])

  return (
    <main>
      <h1>Aquamelon Kitchen Web Prototype</h1>
      <p>Cordis: {state.cordis}</p>
      <p>Probe: {state.probe}</p>
    </main>
  )
}
