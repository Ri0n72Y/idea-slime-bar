import type { GstsConfig } from 'genshin-ts'

const config: GstsConfig = {
  compileRoot: '.',
  // F1 only. Keep earlier experimental graphs in source, but do not emit
  // their superseded continuous-decay or capacity-eviction logic for import.
  entries: [
    './src/aquamelon-kitchen/WK_Soil_Water.ts',
    './src/aquamelon-kitchen/WK_Tree_State.ts'
  ],
  outDir: './dist'
}

export default config
