# 水瓜厨房 Aquamelon Kitchen — MVP

本目录维护 Aquamelon Kitchen 的**现行游戏设计**。千星奇域是服务端权威的正式玩法实现；Web 是同一套数值的快速时间实验，用 TypeScript + Cordis 和文字点击 UI 独立实现。两端不共享运行时代码、**不使用不同的玩法平衡**。

## 统一数值时间

**[uh（等效小时）](../../docs/plants/uh-time-unit.md) 是唯一的模型时间单位**，元素流量统一写 `V/uh`，Growth 按当前七元素实际输入及亲和转换累计。旧的 `dtTick`、`per Tick`、`RatePerHour`、游戏小时换算式已被 uh 取代；它们不再是可引用的设计合同。

- 千星：1 uh = 现实3600秒。结算可以每1 uh、1/12 uh（5分钟）或1/60 uh（1分钟）进行。
- Web：当前1 uh = 现实10秒，比例可在 Debug 调整；页面每秒刷新时只是推进约0.1 uh，不能把一 uh 的预算完整执行十次。
- Tick 是**一次结算调用**，不是一个固定的模型时间单位；因此增减 Tick 频率不会改变每 uh 的 V、Affinity、Growth 或器官阈值。

## 当前核心玩法

```text
玩家富集元素球并收集
→ Soil[7]：容量100V、自然保留率0.99/uh
→ 根系按 RootPreference、Affinity及V/uh吸收上限取用真实元素
→ Seed / Seedling：直接形成 Growth
→ Sapling：元素进入 Tree Reserve[7]
→ Reserve × Tree Affinity 动态生成当次 Growth Budget[7]
→ 叶片优先实际取用，未用额度返回 Tree
→ 每片 Leaf 仅在自己的预算内向所属 Flower/Fruit 分流
→ 剩余预算用于 Tree Growth 或 Active Bud Growth
→ 器官按 Growth 达标成长、结果、成熟
→ 采摘独立地面材料并加工/试调
→ 玩家根据元素构成调整下一轮培养
```

Reserve→Growth Budget 的确切计算系数和根系最终 V/uh 上限仍在共同校准中，不能引用某个平台原型的固定代谢比例当作正式规则。生长、元素供给和根系吸收应保持相同语义与数值，仅靠现实时间压缩做 Web 加速。

## 已确定成长阈值

| 转换 | Growth |
| --- | ---: |
| Seed → Seedling | 45 |
| Seedling → Sapling | 90 |
| Sapling 主干亲和塑形循环 | 100（不再升 Mature Tree） |
| Bud → 嫩叶 | 20 |
| 嫩叶 → 肥厚叶 | 26 |
| 肥厚叶 → 生成花苞 | 18 |
| 花苞 → 花（连续生殖 Growth） | 26 |
| 花 → 青果（连续生殖 Growth） | 40 |
| 青果 → 成熟水瓜（连续生殖 Growth） | 90 |

花苞、花、青果和成熟水瓜共用同一条生殖 Growth[7]，开花与结果不清零；结果时锁 Affinity，果实 `FruitElementAmount[7]` 从结果后实际获取的元素中独立累计，按七元素比例派生 Flavor。成熟后仍可少量继续富集。

叶片自身 Growth 与其附属生殖 Growth 相互独立；每片 Leaf 有来自 Tree 的独立预算，花果只在所属叶片内部二级分流。正常养分下嫩叶约12 uh、肥厚叶约12 uh、花苞约24 uh、花约12 uh是用于推算阈值的**体验参照**，不是要求其出生后必须等待这些时间的闹钟。

## 产果体验目标

- 日常维护者：约24 uh见 Seedling、72 uh进入 Sapling、168 uh内收获首颗果实；稳定期约4–6果/168 uh。
- 间隔几天维护者：成长继续但土壤供给不足会变慢；稳定期目标约2–4果/168 uh。
- 每周一次维护者：一周后看到可见成长、土地明显需要维护；稳定期约2果/168 uh。

三类玩家**只有 Soil 真实元素输入历史不同**，并无不同的 Growth 公式、离线隐藏产能或福利倍率。这些是设计目标，是否能达成仍需在统一 V/uh 模型下校准。

## 材料和加工

当前所有采摘材料留在世界地面列表，不引入通用背包系统。

- `SmallLeaf → TenderLeaf`、`LargeLeaf → ThickLeaf`，成熟果 Growth90 时母叶同步纤维化为 `AquamelonLeaf`。
- `GreenFruit → GreenFruitPeel + GreenFruitFlesh`。
- `Aquamelon → AquamelonShell ×2 + AquamelonJuice`。
- `AquamelonShell → AquamelonFlesh + remaining shell material`。

Processing 产物完整继承来源 Affinity；生长累积由青果肉/水瓜汁承载，已经成形的结构组织不重复复制累积元素。水瓜汁1～3份等体积试调当前是非破坏性预览，未消费材料也未产生合成道具。

## 设计与实现入口

1. [uh 时间和数值合同](../../docs/plants/uh-time-unit.md) — 所有时间/速率约定。
2. [成长结算](../../docs/plants/growth-tick.md) — 一次 `Δuh` 的结算顺序与状态权威边界。
3. [种植与生长系统](growth-system.md) — 土壤/储备、Affinity 与器官生长规则。
4. [基础数值与体验](growth-balance-baseline.md) — 现行阈值、用户供给行为和待校准变量。
5. [生长需求](growth-foundation-requirements.md) — 实现时的行为约束。
6. [开发约定](development-conventions.md) — 七元素顺序、变量和节点图边界。
7. [材料设计方法](../../docs/plants/material-design-principles.md) — 结构组织与生长累积组织。
8. [实施路线图](implementation-roadmap.md) — 功能范围与开发任务拆分。
9. [输入交互](interaction.md)、[世界设定](setting.md)、[培养与后续拓展](elemental-cultivation.md)。

## 当前不自行补齐

生长预算生成系数、最终根系 V/uh 上限、叶片未吸收额度的七元素返还细节、出芽概率按 uh 的事件频率、采果后复花阈值尚需设计确认；不因优化结算粒度或换平台而自行创造规则。

第一版不引入多人经济、完整餐厅经营、通用材料/背包框架、第二种元素反应或成熟树下一阶段。