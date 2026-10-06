import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    webProbe: WebProbeService
  }
}

export class WebProbeService extends Service {
  readonly status = 'browser-service-ready'

  constructor(ctx: Context) {
    super(ctx, 'webProbe')
  }
}
