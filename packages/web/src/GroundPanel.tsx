import { useEffect, useState } from 'react'
import {
  isBlendableJuice,
  previewJuiceBlend,
  type AquamelonGameService,
  type WorldState
} from '@idea-slime-bar/plugins'

import {
  ELEMENT_NAMES,
  MATERIAL_NAMES,
  entityName,
  flavorText,
  ratioText,
  sourceText,
  vectorText
} from './format'
import { ELEMENTS } from '@idea-slime-bar/plugins'

interface GroundPanelProps {
  world: WorldState
  game: AquamelonGameService
  debug: boolean
}

export function GroundPanel({ world, game, debug }: GroundPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const eligibleIds = new Set(world.materials.filter(isBlendableJuice).map(item => item.id))
  const liveIds = selectedIds.filter(id => eligibleIds.has(id))
  const preview = previewJuiceBlend(world.materials, liveIds)

  // Processing/removal invalidates a selection; world reset remounts this panel.
  useEffect(() => {
    setSelectedIds(previous => {
      const remaining = previous.filter(id => eligibleIds.has(id))
      return remaining.length === previous.length ? previous : remaining
    })
  }, [world.materials])

  function toggleJuice(id: string) {
    if (!eligibleIds.has(id)) return
    setSelectedIds(previous => {
      const live = previous.filter(itemId => eligibleIds.has(itemId))
      if (live.includes(id)) return live.filter(itemId => itemId !== id)
      return live.length < 3 ? [...live, id] : live
    })
  }

  return (
    <section className="panel ground-panel" aria-labelledby="ground-title">
      <h2 id="ground-title">地面道具</h2>
      <p className="muted">摘下和加工得到的物品都会留在这里，可直接操作。</p>
      {world.materials.length ? (
        <ul className="item-list">
          {world.materials.map(item => (
            <li key={item.id} className="row ground-item">
              <div>
                <strong>{MATERIAL_NAMES[item.type]}</strong>
                <p className="muted">{sourceText(item.source)}</p>
                {debug && (
                  <div className="debug-vectors">
                    <p>道具编号：{entityName(item.id)}</p>
                    <p>亲和：{vectorText(item.affinity, 2)}</p>
                    <p>元素累积：{vectorText(item.elementAmount)}</p>
                    <p>风味比例：{flavorText(item.elementAmount)}</p>
                  </div>
                )}
              </div>
              <div className="actions">
                {game.canProcess(item.id) && (
                  <button onClick={() => game.process(item.id)}>加工</button>
                )}
                {eligibleIds.has(item.id) && (
                  <button
                    aria-pressed={liveIds.includes(item.id)}
                    disabled={!liveIds.includes(item.id) && liveIds.length >= 3}
                    onClick={() => toggleJuice(item.id)}
                  >
                    {liveIds.includes(item.id) ? '移出试调' : '加入试调'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="empty-text">地面上还没有道具。成熟或未成熟的果实摘下后会出现在此处。</p>}
      <div className="blend-preview">
        <h3>试调水瓜汁 · 仅预览</h3>
        {preview ? (
          <>
            <p>已选择 {liveIds.length} 份水瓜汁 · 主元素：{
              preview.dominantElement === null
                ? '暂无元素倾向'
                : ELEMENT_NAMES[ELEMENTS[preview.dominantElement]]
            }</p>
            <p className="muted">按等体积混合，仅查看结果；不会消耗道具或生成饮品。</p>
            {debug && (
              <div className="debug-vectors">
                <p>混合元素量：{vectorText(preview.elementAmount, 4)}</p>
                <p>混合风味比例：{ratioText(preview.flavorRatio)}</p>
              </div>
            )}
          </>
        ) : (
          <p className="muted">选择 1～3 份水瓜汁，查看等体积混合预览；目前未选择。</p>
        )}
      </div>
    </section>
  )
}
