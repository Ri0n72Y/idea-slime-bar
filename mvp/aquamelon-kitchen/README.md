# 水瓜厨房 Aquamelon Kitchen — MVP

本目录维护 Aquamelon Kitchen 的**现行游戏设计**。千星奇域是服务端权威的正式玩法实现；Web 是同一套数值的快速时间实验，用 TypeScript + Cordis 和文字点击 UI 独立实现。两端不共享运行时代码、**不使用不同的玩法平衡**。

## 统一数值时间

**[uh（等效小时）](../../docs/plants/uh-time-unit.md) 是唯一的模型时间单位**，元素流量统一写 `V/uh`，Growth 按当前七元素实际输入及亲和转换累计。其他单位体系已经由 uh 替代，不得在当前设计中并行使用。

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
| 嫩叶达26G → 肥厚叶与附属花苞同步生成 | 无额外18G |
| 花苞 → 花（连续生殖 Growth） | 累计12 |
| 花 → 青果（连续生殖 Growth） | 40 |
| 青果 → 成熟水瓜（连续生殖 Growth） | 90 |

小叶达到26G时，仅重置母叶自身的阶段Growth，肥厚叶与花苞同步出现。花苞的生殖Growth从0开始，累计12G开花、40G成为青果、90G成熟。花苞、花、青果和成熟水瓜共用同一条生殖 Growth[7]，开花与结果不清零；结果时锁 Affinity，果实 `FruitElementAmount[7]` 从结果后实际获取的元素中独立累计，按七元素比例派生 Flavor。成熟后仍可少量继续富集。

叶片自身 Growth 与其附属生殖 Growth 相互独立；每片 Leaf 有来自 Tree 的独立预算，花果只在所属叶片内部二级分流。早期曾使用嫩叶12 uh、肥厚叶12 uh、花苞24 uh、花12 uh等效时间推导阈值；这属于**历史体验参照**，已由最新Growth校准替代，不是要求其出生后必须等待这些时间的闹钟。

## 产果体验目标

- 日常维护者：目标24 uh见 Seedling、48 uh有 SmallLeaf、72 uh见 Flower、96 uh可采首果；当前独立期望模拟的每日首果约98 uh，尚未达成96 uh目标；稳定期约4–6果/168 uh。
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
10. [水／火／冰感官基准与四种增幅水瓜](elemental-sensory-baseline.md) — 风味描述与七维表征候选；不改变结算或运行时合同。

## 七元素感官设计（策划共识；不等于运行时合同）

七元素基础感官方向均已确认，均不自动生成固定的甜、酸、苦、咸、鲜味；具体香味和味道仍来自食材，元素影响其感官呈现。

| 元素 | 基础感官方向 | 具体设计 |
| --- | --- | --- |
| 水 | 清润 | [水、火、冰感官基准](elemental-sensory-baseline.md) |
| 火 | 热灼 | [水、火、冰感官基准](elemental-sensory-baseline.md) |
| 冰 | 平抑 | [水、火、冰感官基准](elemental-sensory-baseline.md) |
| 岩 | 凝聚 | [岩结晶风味](geo-cohesion-crystallize-flavor.md) |
| 雷 | 活跃度 | [雷与反应口感](electro-activity-reaction-flavor.md) |
| 草 | 丰盈感 | [草、激化与草原核](dendro-fullness-reaction-flavor.md) |
| 风 | 嗅觉扩散；纯风为萦绕感 | [风、扩散与风水瓜](anemo-aroma-lingering-flavor.md) |

**职责边界**：以上文件记录风味意向及食物形态；反应触发、消耗、产物质量与容量见下文的[果实元素反应结算设计](fruit-reaction-settlement-design.md)，当前以其**§6.18**为优先规则。该设计采用单一花果账户 `E_free[7] + Products[]`；其他旧稿中的 `FruitElementAmount[7]`、`FlavorRatio[7]` 等字段或100G口径仍须核对迁移范围，不得从感官文件推断权威账本。感官属性也不是已批准的七维数值字段。感官映射公式、Growth合同迁移、Web与千星奇域运行时修改均不在本次文档合并范围。

## 新元素反应策划（尚未并入 MVP 实现合同）

[果实元素反应结算：设计基线与待解冲突](fruit-reaction-settlement-design.md) 记录90G初次成熟、1U=30G、同一花果Growth/物质量账户、反应产物占容与风扩散例外。数值结算采用该文**§6.18最新规则**；此前历史试算不覆盖§6.18。此文仍属设计方案，不直接替换未迁移的运行时旧FruitElementAmount账本与其数据接口，相关一致性修订另行处理。

## 当前不自行补齐

生长预算生成系数、最终根系 V/uh 上限、叶片未吸收额度的七元素返还细节、出芽概率按 uh 的事件频率、采果后复花阈值尚需设计确认；不因优化结算粒度或换平台而自行创造规则。

第一版不引入多人经济、完整餐厅经营、通用材料/背包框架、第二种元素反应或成熟树下一阶段。