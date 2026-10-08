import { sumVector, type Leaf } from '@idea-slime-bar/plugins'

import { LEAF_NAMES, ORGAN_NAMES, entityName, vectorText } from './format'

interface LeafRowProps {
  leaf: Leaf
  nowMs: number
  debug: boolean
  harvestFruit: (id: string) => void
  harvestLeaf: (id: string) => void
}

const HOUR_MS = 60 * 60 * 1000

function hoursSince(nowMs: number, thenMs: number) {
  return Math.max(0, Math.floor((nowMs - thenMs) / HOUR_MS))
}

function leafProgress(leaf: Leaf, nowMs: number) {
  const age = hoursSince(nowMs, leaf.bornAtMs)
  if (leaf.stage === 'SmallLeaf') return '已生长 ' + age + ' / 12 游戏小时'
  if (leaf.stage === 'LargeLeaf') return '已生长 ' + age + ' 游戏小时'
  return '成熟叶片'
}

function organProgress(leaf: Leaf, nowMs: number) {
  const organ = leaf.reproductive
  if (!organ) return ''
  const total = sumVector(organ.growth).toFixed(1)
  if (organ.stage === 'FlowerBud') {
    return '已形成 ' + hoursSince(nowMs, organ.stageStartedAtMs) + ' / 24 游戏小时'
  }
  if (organ.stage === 'Flower') return '结果累积 ' + total + ' / 30'
  if (organ.stage === 'GreenFruit') return '成熟累积 ' + total + ' / 100'
  return '水瓜已成熟，可摘下'
}

export function LeafRow({ leaf, nowMs, debug, harvestFruit, harvestLeaf }: LeafRowProps) {
  const organ = leaf.reproductive
  const fruitReady = organ?.stage === 'GreenFruit' || organ?.stage === 'MatureFruit'
  const pendingReflower = !organ && leaf.fruitHarvestedAtMs !== null

  return (
    <li className="plant-item">
      <div className="row">
        <div>
          <strong>{entityName(leaf.id)} · {LEAF_NAMES[leaf.stage]}</strong>
          <p className="muted">{leafProgress(leaf, nowMs)}</p>
        </div>
        {!organ && <button onClick={() => harvestLeaf(leaf.id)}>摘下</button>}
      </div>
      {pendingReflower && (
        <p className="muted">等待再次开花：{hoursSince(nowMs, leaf.fruitHarvestedAtMs!)} / 24 游戏小时</p>
      )}
      {debug && (
        <div className="debug-vectors">
          <p>叶片生长：{vectorText(leaf.growth)}</p>
          <p>基础亲和：{vectorText(leaf.baseAffinity, 2)}</p>
          <p>有效亲和：{vectorText(leaf.effectiveAffinity, 2)}</p>
        </div>
      )}
      {organ && (
        <div className="reproductive-row">
          <div className="row">
            <div>
              <strong>{ORGAN_NAMES[organ.stage]}</strong>
              <p className="muted">{organProgress(leaf, nowMs)}</p>
            </div>
            {fruitReady && <button onClick={() => harvestFruit(leaf.id)}>摘下</button>}
          </div>
          {debug && (
            <div className="debug-vectors">
              <p>器官生长：{vectorText(organ.growth)}</p>
              <p>基础亲和：{vectorText(organ.baseAffinity, 2)}</p>
              <p>有效亲和：{vectorText(organ.effectiveAffinity, 2)}</p>
              <p>锁定亲和：{vectorText(organ.lockedAffinity, 2)}</p>
              <p>果实元素累积：{vectorText(organ.fruitElementAmount)}</p>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
