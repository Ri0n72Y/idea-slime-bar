# 水瓜厨房 Aquamelon Kitchen — MVP

> **2D Lua参赛版**：所有计算与UI由本地Lua完成，1uh=10秒、一熟果→一份汁；本文及下列专题直接记录已经确认的玩法规则。[参赛目录](../../docs/aquamelon-2d/README.md)仅作入口，不再重复维护第二套数值合同。

本目录维护 Aquamelon Kitchen 的**现行游戏设计**。千星奇域是服务端权威的正式玩法实现；Web 是同一套数值的快速时间实验，用 TypeScript + Cordis 和文字点击 UI 独立实现。两端不共享运行时代码、**不使用不同的玩法平衡**。

## 统一数值时间

**[uh（等效小时）](../../docs/plants/uh-time-unit.md) 是唯一的模型时间单位**，元素流量统一写 `V/uh`，Growth 按当前七元素实际输入及亲和转换累计。其他单位体系已经由 uh 替代，不得在当前设计中并行使用。

- 正式千星多人方案：1 uh = 现实3600秒；2D Lua单机Demo：1 uh = 现实10秒。结算可以每1 uh、1/12 uh（5分钟）或1/60 uh（1分钟）进行。
- Web：当前1 uh = 现实10秒，比例可在 Debug 调整；页面每秒刷新时只是推进约0.1 uh，不能把一 uh 的预算完整执行十次。
- Tick 是**一次结算调用**，不是一个固定的模型时间单位；因此增减 Tick 频率不会改变每 uh 的 V、Affinity、Growth 或器官阈值。

## 当前核心玩法

```text
玩家富集元素球并收集
→ Soil[7]：容量1000V、自然保留率0.99/uh
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

小叶达到26G时，仅重置母叶自身的阶段Growth，肥厚叶与花苞同步出现。花苞的生殖Growth从0开始，累计12G开花、40G成为青果、90G成熟。花苞、花、青果和成熟水瓜共用同一条生殖 Growth[7]，开花与结果不清零；结果时锁定 Affinity；花苞出生后的全部七元素 Growth 均计入同一物质账户，成熟前为 `E_free[7]`，成熟反应后由 `E_free[7] + Products[]` 共同表示，物质量 `M` 为两者之和。成熟阶段锁定且不会因反应回退；采摘青果／熟果完整转移该账户。Flavor 仅在最终品尝时派生，成熟后仍可低效率富集。

叶片自身 Growth 与其附属生殖 Growth 相互独立；每片 Leaf 有来自 Tree 的独立预算，花果只在所属叶片内部二级分流。早期曾使用嫩叶12 uh、肥厚叶12 uh、花苞24 uh、花12 uh等效时间推导阈值；这属于**历史体验参照**，已由最新Growth校准替代，不是要求其出生后必须等待这些时间的闹钟。

## 产果体验目标

- 日常维护者：目标24 uh见 Seedling、48 uh有 SmallLeaf、72 uh见 Flower、96 uh可采首果；当前独立期望模拟的每日首果约98 uh，尚未达成96 uh目标；稳定期约4–6果/168 uh。
- 间隔几天维护者：成长继续但土壤供给不足会变慢；稳定期目标约2–4果/168 uh。
- 每周一次维护者：一周后看到可见成长、土地明显需要维护；稳定期约2果/168 uh。

三类玩家**只有 Soil 真实元素输入历史不同**，并无不同的 Growth 公式、离线隐藏产能或福利倍率。这些是设计目标，是否能达成仍需在统一 V/uh 模型下校准。

## 材料和加工

当前所有采摘材料留在世界地面列表，不引入通用背包系统。**参赛版一颗成熟水瓜直接加工为唯一一份果汁，完整E_free/Products转移，旧多步瓜壳路线不作为参赛流程。**

- `SmallLeaf → TenderLeaf`、`LargeLeaf → ThickLeaf`，成熟果 Growth90 时母叶同步纤维化为 `AquamelonLeaf`。
- `GreenFruit → GreenFruitPeel + GreenFruitFlesh`。
- `Aquamelon → AquamelonShell ×2 + AquamelonJuice`。
- `AquamelonShell → AquamelonFlesh + remaining shell material`。

采摘的青果／熟果完整携带 `E_free[7] + Products[]`；后续加工产生的各材料如何分配这份物质量尚未确定，不沿用「青果肉／水瓜汁独占全部累计量」的旧设定。Processing 产物的 Affinity 继承不等于复制元素物质量。水瓜汁1～3份等体积试调当前是非破坏性预览，未消费材料也未产生合成道具。

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

**职责边界**：以上文件记录已经确认的七元素风味意向及食物形态；反应触发、消耗、产物质量与容量见下文的[果实元素反应结算设计](fruit-reaction-settlement-design.md)，当前以其**§6.18**为优先规则。**现行果实设计合同**采用单一花果物质账户 `E_free[7] + Products[]`，无需独立 `FruitElementAmount[7]`，Flavor 仅在最终品尝时生成。它不等同于额外的七维感官字段；**参赛版按全部当前自由元素及反应产物输出AI品尝数据，不使用旧27项Taste量化合同；一果一汁材料转移已经确认。**其他多产物加工的分账仍待设计。Web/千星奇域运行时尚未迁移，不能视其旧字段为当前策划权威。

## 新元素反应策划（尚未并入 MVP 实现合同）

[果实元素反应结算：设计基线与待解冲突](fruit-reaction-settlement-design.md) 记录90G初次成熟、1U=30G、同一花果Growth/物质量账户、反应产物占容与风扩散例外。数值结算采用该文**§6.18最新规则**；此前历史试算不覆盖§6.18。其物质账户与采摘语义是最新策划合同；现有平台运行时和加工数据接口尚待单独迁移。

## 当前数值与仍需验证事项

元素球初始量**固定50V**（只随机七元素身份），Soil容量1000V；根系阶段上限采用2/1.85/16V/uh、Growth预算B0=5.4V/uh，Sapling根系在Reserve100～180V按归一ln因子限流；后续出芽每24uh投一次已有1叶40%、2叶1%的机会。90G成熟后自然富集从成熟前50%开始，随物质量线性降至150G为0（非硬容量上限）。详细计算见[成长](growth-system.md)与[数值基线](growth-balance-baseline.md)。

果实颜色由亲和混色底色与Growth七维混色30%叠加，首次生成反应产物锁定名称/完整图标，之后用剩余自由元素混色30%叠加，风味读取全部当前产物；见[培养外观](elemental-cultivation.md)和[现行口味](taste-model.md)。

待验证而非未批准：固定50V之后的实际首果产率、Lua图片与文本控件。采果后复花阈值仍待设计；既定R1/R2、冻结和燃烧的风味不再属于待定项目。

2D Lua参赛版不引入多人经济、完整餐厅经营、通用材料/背包框架或成熟树下一阶段；**已确认的多种元素反应必须按§6.18结算，不能被旧“只做一种反应”口径排除**。