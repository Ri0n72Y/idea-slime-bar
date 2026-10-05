# 水瓜厨房 MVP：七元素养分与生长系统

本文件把根目录通用的 [植物养分—生长系统](../../docs/plants/nutrient-growth-system.md) 映射到千星奇域水瓜树。

本版本中：

```text
Nutrient        = 七元素力
Soil Reservoir  = 土壤七元素储备
Plant Reserve   = 树体内部七元素储备
RootPreference  = 根系对七元素的吸收偏好（0~1）
Affinity        = 七元素成长亲和 / 转换效率
Growth Vector   = 七元素生长度向量
```

具体每个生长结算周期内发生什么，以根目录 [Growth Tick](../../docs/plants/growth-tick.md) 为统一规则；本文件只定义水瓜树的器官关系、阶段、当前调试参数和体验目标。

---

## 1. 总体养分流

```mermaid
flowchart TD
    A[元素球 / 浇灌资源]
    --> B[土壤 SOIL_Elems]

    B -->|自然蒸发| X[环境损耗]
    B -->|Seed / Seedling：直接吸收| D[树自身 Growth Vector]
    B -->|Sapling 起：吸收到内部储备| C[树体 Reserve<br/>TREE_Elems]

    C -->|Growth Tick| D

    C -->|子器官分流| E[叶片]
    E -->|继续分流| F[花]
    F --> G[果]

    E -->|成叶蒸发| X
    F -->|花期蒸发| X
    G -->|果期不再蒸发| H[汁液 / 果实内容物]
```

玩家浇灌的是**土壤**，不是直接给树体写入元素。

土壤承担植物与外部世界之间的“养料接口”。从更广义的生长模型看，树本身可以被视为土壤的一个下游器官。

---

## 2. Growth Tick 与时间尺度

Growth Tick 现在只表示“一次生长结算事件”，不再把 Tick 自身当作固定自然时间单位。

自然规律统一使用：

```text
RatePerHour + dt
```

在线更新周期只决定反馈频率：

```text
CFG_GrowthUpdateIntervalSeconds
```

当前第一版倾向：

```text
CFG_GrowthUpdateIntervalSeconds = 60
```

即在线约每分钟结算一次。以后可以改成 30 秒或其他值，而不需要重新调整植物每小时的成长速度。

当前时间速率基线：

```text
SoilRetentionPerHour = 0.99
TreeGrowthRetentionPerHour = 0.99
```

含义分别是：

- 土壤在 1 小时后保留约 99% 当前元素；
- 树体在 1 小时内约拿出当前 Reserve 的 1% 用于生长代谢。

任意 dt 使用连续时间等价公式，例如：

```text
SOIL_Elems[i]
*= SoilRetentionPerHour ^ dtHours

Consumed[i]
=
TREE_Elems[i]
× (1 - TreeGrowthRetentionPerHour ^ dtHours)
```

当前基础生长链使用统一总吸收上限：

```text
CFG_MaxTotalAbsorbPerHour = 1.0
```

当前版本的 Seed / Seedling / Sapling 都使用同一个总吸收上限。Seed / Seedling 通过 GrowthThreshold 推进；Sapling 作为长期玩法阶段继续沿用同一吸收上限，不再通过 Stage 升级改变总吞吐。

当前结算量：

```text
MaxAbsorbThisUpdate
=
CFG_MaxTotalAbsorbPerHour × dtHours
```

在线与离线应尽量共享同一套公式。离线时直接按真实经过时间计算；只有遇到 Stage 升级、器官生成等离散事件时才分段处理。

Debug UI 需要提供“立即推进下一次 Growth Tick”的能力。Debug 强制 Tick 使用一个标准在线更新步长：

```text
dt = CFG_GrowthUpdateIntervalSeconds
```

这样可以在游戏内连续测试生长，而不必真实等待一分钟。

具体结算顺序见根目录 [Growth Tick](../../docs/plants/growth-tick.md)。

---

## 3. 土壤七元素储备

土壤保存：

```text
SOIL_Elems : float[7]
```

七元素顺序继续遵循：

```text
Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo
```

当前总容量：

```text
MaxSoilElementLoad = 100
```

### 3.0 元素球输入

元素球自身保存：

```text
BALL_Elems : float[7]
```

当前 MVP 只生成纯净元素球，即每个球只有一个元素维度大于 0，但接口仍保持完整七元素向量。

当前元素球数值基线：

```text
BallInitialAmount = random(8, 10)
BallHalfLife = 15 min
BallDestroyThreshold = 1
BallSpawnCheckInterval = 5 min
```

每 5 分钟最多尝试生成 1 个新球。生成概率读取当前场上所有未捕获元素球的元素总量：

```text
FieldBallTotal
=
Σ all active BALL_Elems

SpawnChance
=
1 / (1 + (FieldBallTotal / 28)^3)
```

这里不存在硬性的“最多 8 个球”上限；总元素量越高，继续生成的概率越低，目标是形成大概率约 8 个以内的软稳态。

`generate_elem_ball(InputElems)` 在以当前 Tree / 种植区为中心的圆环范围内随机生成元素球。圆环内径应避开 Soil 捕获区，避免出生即被土壤接收。

未被捕获的元素球：

- 玩家进入吸引范围后缓慢向玩家飘动；
- 根据所含元素显示颜色；
- 按真实经过时间使用 15 分钟半衰期连续衰减：

```text
BALL_Elems[i]
*= 0.5 ^ (dtMinutes / 15)
```

当：

```text
Σ BALL_Elems < 1
```

时销毁元素球。

登录时不额外生成“补偿球”，而是最多回放最近 30 分钟的正常刷新历史：

```text
SimulateWindow
=
min(actualOfflineElapsed, 30 min)
```

回放仍按每 5 分钟一次的正常生成检查处理，并根据每个球真实的 SpawnTime 计算登录时剩余元素量。

Soil 的感应区捕获带有 `ElementBall` 标签的实体时，直接执行：

```text
SOIL_Elems[i]
+= BALL_Elems[i]

Destroy ElementBall
```

不设置 Pending，不在捕获阶段做容量计算；`SOIL_Elems` 可以暂时超过容量。

### 3.1 Growth Tick 开头的容量归一化

每次 Soil Growth Tick 开始时：

```text
SoilTotal
=
Σ SOIL_Elems[i]
```

如果：

```text
SoilTotal <= MaxSoilElementLoad
```

则不处理。

如果：

```text
SoilTotal > MaxSoilElementLoad
```

计算：

```text
KeepRatio
=
MaxSoilElementLoad / SoilTotal

SOIL_Elems[i]
*= KeepRatio
```

例如：

```text
初始：
雷 50
水 30
草 20

捕获 +50 雷后：
雷 100
水 30
草 20
总量 150

下一 Tick：
KeepRatio = 100 / 150

结果：
雷 ≈ 66.67
水 = 20
草 ≈ 13.33
```

下一次再捕获 50 雷并经过下一 Tick，结果约为：

```text
雷 ≈ 77.78
水 ≈ 13.33
草 ≈ 8.89
```

因此单一元素连续浇入会逐步替换原有组成，并保留递推残留。

超出容量的：

```text
Overflow
=
SoilTotal - MaxSoilElementLoad
```

当前直接丢弃；未来可接入气候系统。

容量归一化完成后再继续：

```text
Soil evaporation
→ Tree absorption
```


### 3.2 土壤蒸发

土壤蒸发使用单位时间保留率，不再写成“每 Tick 固定减少 1%”。

当前基线：

```text
SoilRetentionPerHour = 0.99
```

任意结算周期：

```text
SOIL_Elems[i]
*= 0.99 ^ dtHours
```

第一版先把蒸发视为直接损耗。

未来这些逸散可以进入气候系统，但当前不实现，见 [气候系统占位](../../docs/plants/climate-system.md)。

---

## 3.3 Growth 驱动的亲和学习

水瓜树当前 Stage 的 Effective Affinity 只由本阶段已经形成的 `TREE_Growth[7]` 决定，不读取 `TREE_Elems[7]` 的当前储备比例。

当前配置：

```text
ExtraAffinity = 1
CFG_AffinityInherifanceRate = 0.5
```

计算：

```text
GrowthTotal = Σ TREE_Growth[i]

GrowthShare[i]
= TREE_Growth[i] / GrowthTotal

AffinityOffset[i]
= ExtraAffinity × GrowthShare[i]

TREE_EffectiveAffinity[i]
= TREE_BaseAffinity[i] + AffinityOffset[i]
```

当 `GrowthTotal = 0`：

```text
AffinityOffset[i] = 0
TREE_EffectiveAffinity[i] = TREE_BaseAffinity[i]
```

因此：

> Reserve 表示“当前体内还储存着什么”，Growth 表示“这些元素已经把植物长成了什么”。

只有 Growth 会塑造当前亲和。

### Seed / Seedling Stage 升级

Seed / Seedling 自身进入下一 Stage：

```text
TREE_EffectiveAffinity
→ 下一 Stage TREE_BaseAffinity

TREE_Growth
→ 清零
```

### Sapling 主干亲和循环

Sapling 不再继续升级到 Mature。当前主干 Growth 只用于自身亲和塑形和出芽竞争。

当前主干一轮 Growth 上限：

```text
SaplingTreeGrowthCycle = 100
```

当：

```text
Σ TREE_Growth >= 100
```

时：

```text
根据本轮 TREE_Growth[7] 的组成更新 / 固定 Tree Affinity
→ TREE_Growth 开启下一轮累计
→ Tree Stage 不变化
```

因此“主干长满”表示完成一次树体亲和塑形周期，不表示进入新的 Tree Stage。

### 叶芽与 SmallLeaf 的亲和继承

Bud 继续使用独立的：

```text
BUD_Growth[7]
```

Bud 的职责是承接当前 Tree Own GrowthGain、形成芽期元素倾向并累计到阈值 20。MVP 不再为 Bud 额外建立一套需要长期保留的独立 Affinity 状态。

当 Bud 达到阈值时：

```text
Σ BUD_Growth >= 20
→ Bud 完成
→ 生成 SmallLeaf
```

SmallLeaf 出生这一刻，使用现有的标准父子器官亲和继承规则，从**此刻主干的当前亲和**计算自己的 Affinity 初值：

```text
ParentOffset[i]
= TREE_EffectiveAffinity[i] - TREE_BaseAffinity[i]

SMALL_LEAF_BaseAffinity[i]
= CFG_LeafAffinity[i]
  + ParentOffset[i] × CFG_AffinityInherifanceRate
```

当前继承率仍为：

```text
CFG_AffinityInherifanceRate = 0.5
```

这是一次性遗传。SmallLeaf 出生后拥有自己的 Base / Effective Affinity，并只根据自己的后续 Growth 独立塑形；Tree 之后如何变化，不会实时回写 Leaf Affinity。

如果玩家在 Bud 完成前掐掉芽：

```text
TREE_Growth[i] += BUD_Growth[i]
Destroy Bud
```

即芽期已经形成的 Growth 完整退回主干，不产生额外损耗。

---

## 4. 树从土壤吸收

根系吸收由三层约束共同决定：

```text
RootPreference
→ 混合 Soil 中偏向吃什么

Affinity
→ 单元素通道能吃到多高
→ 吸收后转成 Growth 有多高效

Soil Supply
→ 实际有没有这么多元素可吃
```

当前 Tree RootPreference 已锁定：

```text
CFG_TreeRootPreference[7]
=
[0.80, 1.00, 0.85, 0.75, 1.00, 0.70, 0.90]
```

顺序仍为：

```text
Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo
```

RootPreference 每个分量严格位于 0～1。它不再与 Growth Affinity 使用同一组数值。

### 4.1 总吸收上限

当前基础生长链统一使用：

```text
CFG_MaxTotalAbsorbPerHour = 1.0
```

当前版本使用同一总吸收上限：

```text
Seed
Seedling
Sapling
```

Seed / Seedling 通过 GrowthThreshold 推进到下一阶段。Sapling 是当前版本的主要长期玩法阶段，不再继续推进到 Mature；Mature 的最终设计延后。

任意 dt：

```text
MaxTotalAbsorbThisUpdate
=
1.0 × dtHours
```

总实际吸收还必须满足：

```text
Σ AbsorbElems[i]
<= MaxTotalAbsorbThisUpdate

AbsorbElems[i]
<= SOIL_Elems[i]
```

### 4.2 单元素饱和

单元素基础吸收上限份额：

```text
SingleElementBaseCapShare = 0.30
```

某个元素的理论单通道上限：

```text
ElementCap[i]
=
CFG_MaxTotalAbsorbPerHour
× 0.30
× Affinity[i]
```

当前 Tree 基础 Affinity：

```text
[0.85, 1.15, 0.90, 0.75, 1.20, 0.70, 0.95]
```

因此理论单元素吸收上限 / h：

| 元素 | Cap / h |
| --- | ---: |
| Fire | 0.255 |
| Hydro | 0.345 |
| Anemo | 0.270 |
| Electro | 0.225 |
| Dendro | 0.360 |
| Cryo | 0.210 |
| Geo | 0.285 |

这里故意允许 Affinity 同时带来两层收益：

```text
高 Affinity
→ 对应元素通道上限更高
→ 同样元素转换 Growth 也更高效
```

这为后续“培养高亲和、高产量的特化品种”预留长期价值。

单元素即使供应无限，也不能直接填满 1.0/h；多种元素通道可以叠加，熟练玩家可以用主元素 + 辅助元素在“元素倾向”和“总生长速度”之间做配比。

Soil 中某元素实际供应不足时，实际吸收还会进一步低于该通道上限。因此早期只收一种随机元素球，不仅受到 30% 基准 Cap 限制，还会受到自然刷新供给不足的限制。

**尚未锁定：**

- ElementCap 最终读取当前 Stage 的 BaseAffinity 还是实时 EffectiveAffinity；
- 多元素在 RootPreference、各自 ElementCap 与 Soil 可用量之间的最终重分配算法。

实现阶段不得自行补这两个规则。

### 4.3 Seed / Seedling 与 Sapling 的状态边界

Seed 和 Seedling 没有 Tree Reserve：

```text
Seed / Seedling

Soil
→ Calculate_Absorption
→ 按 Growth Affinity 直接转成 TREE_Growth
```

进入 Sapling 后才开始拥有：

```text
TREE_Elems[7] / Reserve
```

后续才进入：

```text
Soil
→ Reserve
→ Growth metabolism
→ Level 1：Tree self + each Leaf
→ Level 2：each Leaf self + its attached Flower / Fruit
```

因此 Reserve 是小树开始形成复杂器官后的内部缓冲，不参与 Seed / Seedling 的基础成长。

### 4.4 培养速度的结构性检查

普通随机七元素、能够吃满 1.0/h 时，当前 RootPreference 加权后的基础平均 Growth Affinity 约为：

```text
0.9504
```

所以满速普通 Growth 约：

```text
0.9504 Growth / hour
```

理论策略检查：

```text
普通随机七元素：
Absorb ≈ 1.0/h
Growth ≈ 0.9504/h

纯 Dendro：
Absorb cap = 0.36/h
Growth ≈ 0.432/h

Hydro + Dendro：
Absorb cap = 0.705/h
Growth ≈ 0.829/h

Hydro + Dendro + Geo：
Absorb cap ≈ 0.99/h
Growth ≈ 1.10/h
```

这意味着“只喂目标元素”很准但慢；懂配比的玩家可以用辅助元素补总吞吐，并可能比完全随机杂食更高效。这是有意保留的培养深度。

完整数值速查与推算见 [基础生长数值速查](growth-balance-baseline.md)。


---

## 5. Seed → Seedling → Sapling

正式 Tree Stage 之前，水瓜以半埋在土中的 Seed 状态存在。

当前 Tree 主阶段：

```text
Seed
→ Seedling
→ Sapling
```

Tree 的 `Mature` 最终阶段仍延后设计；它与本文后面的 `Mature Fruit` 是两个不同概念，当前不得混用。

Seed 不计入正式 Tree Stage 编号，但它和 Seedling 一样都直接从 Soil 吸收并形成 Growth，不再使用独立的 GerminationProgress / GerminationRate 计时器。

### 5.1 Seed → Seedling

Seed 没有 Reserve：

```text
Soil
→ Absorb
→ Growth Conversion
→ SEED_Growth[7]
```

当前阈值：

```text
SeedGrowthThreshold = 45
```

普通随机混合供给、满吸收时：

```text
AverageGrowthAffinity ≈ 0.9504
FullSpeedGrowth ≈ 0.9504 / h

45 / 0.9504
≈ 47.35 h
```

因此积极玩家第一次把 Soil 做到 80 以上并规律维护时，第三个自然日 / 超过约 48 小时再次上线，应已经看到发芽后的 Seedling。

Seed Growth 本身已经保存七元素组成，因此发芽前后的轻微颜色变化、粒子逸散等表现可以直接读取真实 Growth / Affinity，不再额外维护一套 Germination Exposure。

Stage 切换：

```text
Seed Growth 达到 45
→ 当前 EffectiveAffinity 固化为 Seedling BaseAffinity
→ Growth 清零
→ 进入 Seedling
```

### 5.2 Seedling → Sapling

Seedling 同样没有 Reserve：

```text
Soil
→ Absorb
→ Growth Conversion
→ TREE_Growth[7]
```

当前阈值：

```text
SeedlingGrowthThreshold = 90
```

普通随机混合供给、满吸收时：

```text
90 / 0.9504
≈ 94.70 h
```

因此两个早期阶段理论合计：

```text
≈ 142.0 h
≈ 5.92 days
```

真实随机、漏球和非满 Soil 会留出少量余量，使积极玩家自然落在“约一周进入 Sapling”的目标窗口。

### 5.3 Sapling：当前版本的主要长期阶段

进入 Sapling 后：

- 开始拥有 `TREE_Elems[7] / Reserve`；
- 开始进入 Tree Reserve → Growth 的代谢；
- 开始抽叶、开花、结果和长期亲和塑形；
- 总吸收上限仍为 1.0/h；
- 当前版本不再推进到 Mature，最终成株设计延后；
- 当前树冠上限为 3 片叶。

Sapling 的主要体验不再是“等待下一 Stage”，而是：

```text
维护 Soil / Reserve
→ 主干亲和逐轮塑形
→ 每日尝试出芽
→ 叶片竞争生长预算
→ 花 / 果生产
→ 玩家通过掐芽改变“扩张叶片”与“主干塑形”的取舍
```

### 5.4 每日 04:00 出芽检查

出芽是每日离散事件，不在每个 Growth Tick 中投概率。

当前统一使用服务器时间：

```text
DailyBudCheckAt = 04:00
```

每跨过一个 04:00 边界，先把上一事件边界到 04:00 之间的连续 Growth 结算完，再根据 04:00 当时的真实状态进行一次出芽判断。

如果已经存在 Active Bud，则当天不再投新的出芽概率。

当前概率：

| 当前已形成叶片数 | 04:00 出芽概率 |
| ---: | ---: |
| 0 | 0.80 |
| 1 | 0.40 |
| 2 | 0.01 |
| 3 | 0 |

因此：

- 0 → 1 叶是快速建立基础生产能力；
- 1 → 2 叶是几天内逐渐形成的正常扩张；
- 2 → 3 叶是长期低概率的旺盛状态；
- 3 叶是当前版本树冠上限，不再继续出芽。

如果 04:00 检查失败，当天不补投；下一次机会是下一个 04:00。

### 5.5 Bud Growth 路由与“掐芽催熟”

Tree Reserve 每次代谢产生本 Tick 的生长养分预算后，先完成第一层 `Tree -> Tree self + each Leaf` 分流；每片 Leaf 再只在自己当次获得的预算内部，向自身与其附属 Flower / Fruit 做第二层分流。剩余的 Tree Own Budget 再按 Tree Affinity 转成“主干自身 GrowthGain”。

没有 Active Bud 时：

```text
Tree Own GrowthGain
→ TREE_Growth[7]
```

存在 Active Bud 时：

```text
Tree Own GrowthGain
→ BUD_Growth[7]

TREE_Growth 暂停增加
```

Bud 当前 Growth 阈值：

```text
BudGrowthThreshold = 20
```

玩家在芽未完成时采掉它：

```text
TREE_Growth[i] += BUD_Growth[i]
BUD_Growth = 0
Destroy Bud
```

因此“掐芽催熟”不依赖额外 Buff。玩家只是取消这次叶片扩张，把芽期投入完整退回主干，使主干更快完成自己的 100 Growth 亲和塑形周期。

如果不掐：

```text
Σ BUD_Growth >= 20
→ Bud 完成
→ 按此刻 Tree 的标准父子器官遗传规则生成 SmallLeaf
→ SmallLeaf 从自己的独立 Affinity 初值开始后续生命周期
→ 这 20 Growth 已经真正投入器官，不再回主干
```

### 5.6 叶片数量与主干预算

沿用旧版“子器官先分流、主干拿剩余”的设计。当前每片已形成叶片占用约 0.3 的 Tree Growth Nutrient Budget：

```text
0 叶：
Tree 1.0

1 叶：
Tree 0.7
Leaf A 0.3

2 叶：
Tree 0.4
Leaf A 0.3
Leaf B 0.3

3 叶：
Tree 0.1
Leaf A 0.3
Leaf B 0.3
Leaf C 0.3
```

这里的比例作用于“本 Tick 的生长养分预算”，不是从已经累计的 TREE_Growth 中持续扣值。

所以第三片叶虽然增加生产器官，但会让主干自身 Growth 几乎停止；这是当前设计的预期取舍。

有 Active Bud 时，Bud 只接管上表中的 Tree 份额，不会改变任何 Leaf 的第一层预算；Flower / Fruit 也只在所属母叶的预算内部继续分流。

### 5.7 第一周与 Sapling 体验目标

```text
Day 0
→ 第一次进入
→ 积极玩家通常把 Soil 做到 80+
→ 休闲玩家可以直接做到 100

约 47h
→ Seedling
→ 第三个自然日上线时应已经看到发芽后的幼苗

再约 95h
→ Sapling

理论满速总计约 6 天
→ 真实体验约一周
→ 正式进入长期抽叶 / 花果玩法
```

进入 Sapling 以后，当前参数的第一轮平衡目标是：

- 第一片叶很快开始形成；
- 大约一周逐渐进入两叶主状态；
- 第三片叶在前几周只出现在少量植株上；
- 玩家掐芽可以明显提高主干亲和塑形速度，但会放弃叶片生产扩张；
- 当前版本不以进入 Mature 作为主要目标。


---

## 6. Sapling 起的树体内部储备、休眠与生长

Tree Reserve 从 Sapling 开始进入模型。Seed / Seedling 不拥有 Reserve。

树内部储备总量：

```text
TreeReserveTotal = Σ TREE_Elems[i]
```

树体颜色可以读取当前 Reserve 组成作为表现来源之一，因此进入 Sapling 后，植株本身能够持续显示当前内部营养倾向。

### 6.1 休眠迟滞

当前沿用已有基线：

```text
Growing:
TreeReserveTotal < 30
→ Dormant

Dormant:
TreeReserveTotal >= 80
→ Growing
```

Dormant：

- 仍允许继续从 Soil 吸收；
- 暂停正常 Growth Conversion；
- 不死亡；
- 达到恢复阈值后重新启动生长。

`30 / 80` 当前仍属于 Sapling 长期平衡需要复核的基线，不在本轮早期阶段数值中重新锁死。

### 6.2 Tree Reserve 生长代谢

当前基线：

```text
TreeGrowthRetentionPerHour = 0.99
```

任意结算周期：

```text
Consumed[i]
=
TREE_Elems[i]
× (1 - 0.99 ^ dtHours)
```

这些养分先按第一层规则分成 Tree self budget 与各 Leaf budget；各 Leaf 如有附属 Flower / Fruit，再只在自己的 Leaf budget 内做第二层分流。Tree self budget 按完整 Growth Affinity 转换为 Tree Own GrowthGain。

当前叶片分流基线为每片 0.3；0 / 1 / 2 / 3 叶对应主干剩余 1.0 / 0.7 / 0.4 / 0.1。存在 Active Bud 时，Tree Own GrowthGain 改写入 BUD_Growth；否则写入 TREE_Growth。

Sapling 的 Reserve 上限、初始 Reserve、叶 / 花 / 果后续阈值与实际周产量仍需继续平衡。


---

## 7. 叶片与开花前生命周期

当前 Sapling 后半段的玩家可见链统一为：

```text
Bud
→ SmallLeaf
→ LargeLeaf
→ FlowerBud
→ Flower
→ Green Fruit
→ Mature Fruit
```

Bud 是正式叶片出生前的 Growth 门槛；SmallLeaf / LargeLeaf / FlowerBud 则使用**生命周期 elapsed-time boundary**。这里不要把所有状态都强行改造成 GrowthThreshold，也不要给每个阶段建立独立 Timer。

### 7.1 SmallLeaf → LargeLeaf → FlowerBud

Bud 达到 20 后生成 SmallLeaf，并在出生瞬间从当前 Tree 做一次标准亲和继承。之后 Leaf Affinity 与 Tree 脱钩。

当前时间体验基线：

```text
SmallLeaf
→ 约 12h 后进入 LargeLeaf

LargeLeaf
→ 再约 12h 后形成 FlowerBud

FlowerBud
→ 再约 24h 到达 bloom boundary
```

这些时间只定义生命周期边界。在线和离线都由统一 settlement 根据实际经过时间推进；不为 SmallLeaf / LargeLeaf / FlowerBud 分别维护倒计时器。

### 7.2 叶片养分与 Affinity

叶片仍然没有独立 Reserve。每次 settlement 先按 0/1/2/3 叶规则完成 `Tree -> Tree self + each Leaf` 的第一层预算分配；每片 Leaf 得到自己的 Growth Nutrient Budget 后，再只在该预算内部用于叶片自身与其附属生殖器官。Flower / Fruit 不直接从整株 Tree 总预算或其它叶片的共享池取值。

既有 Leaf baseline 保持不变：

- SmallLeaf / 嫩叶阶段当前不设置环境损耗；
- 叶片在尚未锁定的发育阶段继续根据自己的 Growth 独立塑形 Effective Affinity；
- 成叶自身保留率基线仍为 `0.6`，约 `40%` 可逸散到环境；
- 这些是养分行为，不要求再建立一套独立生命周期 Timer。

Leaf 的颜色 / 形态可以读取自己的 Growth / Effective Affinity；Tree 后续亲和变化不会实时同步给已经出生的 Leaf。

### 7.3 开花边界与离线可见性

开花是希望玩家实际看到的事件。

如果一次离线恢复**首次跨过某个 FlowerBud 的 bloom boundary**：

```text
先把该器官结算到 bloom boundary
→ 切换为刚开始的 Flower
→ 本次离线恢复不再继续推进这个 Flower 的后续 Growth
→ 玩家登录后从可见花期开始继续正常 settlement
```

其他 Tree / Soil / 其他器官仍按自己的事件边界正常恢复。这里不引入 scheduler、Timer Manager 或复杂的未来事件框架；只是在现有事件边界回放中把首次开花作为一个可见性停点。

## 8. 花与果

Flower 与 Fruit 继续视为同一个生殖器官的连续生命周期，但从开花开始改用**生殖器官 Growth**推进物理成熟：

```text
Flower:       Growth 0 -> 30
Green Fruit:  30 <= Growth < 100
Mature Fruit: Growth >= 100
```

这里的 Growth 是同一条连续成长轴。实现时可以由器官 Growth 数据推导总进度，不要求为了这个表述额外保存一份重复 scalar。

### 8.1 Flower：0 -> 30

Flower：

- 从父级 Leaf 本 Tick 的 Growth Nutrient Budget 中优先分流；
- 继续根据实际进入自身的 Growth 塑形 Effective Affinity；
- 仍可存在花期环境逸散；
- 不从已经累计的 `LEAF_Growth` 中持续扣值。

当前 Flower 的营养 sink 目标约为：

```text
FlowerSinkShare ≈ 0.50
```

即正常情况下约拿走父级 Leaf 当前生长预算的一半。该值是当前 baseline，不要求另建 FlowerTimer。

在正常供给下，“玩家可见花期约 12h”继续作为体验目标。实际何时达到 30 由统一 Growth settlement 决定。

当：

```text
Reproductive Growth >= 30
```

发生：

```text
Flower 凋谢
→ 形成 Fruit
→ 当前 Affinity 固定 / locked
→ 开始 Fruit 阶段
```

这个 `30` 是 Affinity 的结果锁定点。

### 8.2 Green Fruit：30 -> 100

Fruit 沿同一 Growth 轴从 30 继续向 100 推进。当前 Green Fruit 是极强 nutrient sink：

```text
GreenFruitSinkShare = 0.80 ~ 0.90
```

这只是平衡目标区间，当前不收敛为唯一最终数字。它只作用于所属母叶当次获得的 Growth Nutrient Budget：例如取 85% 时，该母叶自身只保留 15%，因此母叶自身成长几乎停止；其它叶片与 Tree 的第一层预算不变。

进入 Fruit 后：

- Affinity 不再继续塑形；
- 不再使用 Flower 的环境蒸发语义；
- 开始累计**结果以后实际进入果实的七元素量**：

```text
FruitElementAmount[7]
```

这个向量是 Fruit Flavor 的持久化事实源。

### 8.3 Mature Fruit：100+

当：

```text
Reproductive Growth >= 100
```

Fruit 跨过物理成熟边界，同时触发所属母叶的同步成熟：

```text
Green Fruit -> Mature Fruit
parent Leaf -> fibrous Aquamelon Leaf state
```

这是同一个 `Growth = 100` 成熟事件的两个结果。`AquamelonLeaf` 不是“叶片单独放久以后按时间自然成熟”的阶段；在 Fruit 达到 100 之前，母叶仍保持肥厚 / fleshy 的叶片形态，Fruit 达到 100 时才同步转为纤维质更强的成熟叶形态。

`100` 当前**不表示**：

- Flavor locked；
- Element accumulation stopped；
- 自动采摘；
- 老化阶段开始。

Mature Fruit 仍可继续接受元素，但 nutrient sink / 富集效率大幅降低。当前 baseline：

```text
MatureFruitSinkShare ≈ 0.20
```

因此成熟后继续留果仍有意义；约 20% 只从所属母叶当次预算中分流，母叶恢复大部分自身成长，其它叶片与 Tree 的第一层预算不受影响。

Mature Fruit 可像成熟叶一样出现少量“亮晶晶逸散”视觉，用来提示仍有元素流动 / 富集；当前只记录视觉意图，不实现 VFX / shader / material system。

### 8.4 Fruit Flavor：直接读取结果后元素比例

v0 不存在额外的 `element amount -> flavor value` 转换。

当：

```text
FruitElementTotal = Σ FruitElementAmount[e]
```

且总量大于 0 时：

```text
FlavorRatio[e]
= FruitElementAmount[e] / FruitElementTotal
```

当总量为 0 时，视为尚未形成 Flavor。

因此当前只需要持久化 `FruitElementAmount[7]`；`FlavorRatio[7]` 是派生解释，不需要无理由再存一份重复向量。

Mature Fruit 在 100 之后仍继续累计 `FruitElementAmount`，所以 `FlavorRatio` 也可以继续变化。Affinity 已经锁定，不会因此重新塑形。

### 8.5 Green Fruit / Mature Fruit 的采摘价值与物理形态

Fruit 从形成开始就可以被玩家采摘。

**Green Fruit**：

- 是主动早摘可获得的独立料理材料，不是失败成果；
- 果皮仍有弹性；
- 内部是混沌、尚未清晰分层的粘液；
- 不同元素可以形成完全不同的内部形态；
- 允许出现特定元素析出 / 结晶等特殊口感；
- 多元素混合状态可以较草率、尚未稳定整合。

**Mature Fruit**：

- 果皮逐渐木质化，最终形成明显的深褐色果壳；
- 内部形成清晰结构：

```text
果壳
→ 光滑内膜
→ 果肉膜
→ 清澈水瓜水
```

- 主要提供稳定的水瓜汁类素材。

外观必须直接提示成长阶段：

```text
Green Fruit
青绿色基础果皮 + 当前元素颜色 / 纹理影响

30 -> 100
从青绿、柔软感逐渐过渡到深褐、木质感

Mature Fruit
明显深褐木质果壳
```

这些目前只属于视觉设计要求，不要求实现 shader / texture runtime。

### 8.6 成熟后的未来语义插口

成熟后持续富集未来可以被用于更多 Flavor 催化、特殊质地 / 形态、过量精炼或更晚生命周期（例如“老种子”）。

当前只记录“这里存在未来扩展可能”。不定义阈值、公式、状态名、接口，也不建立 catalyst / refinement / old-seed framework。

## 9. 采摘、世界材料与上游养分回流

### 9.1 活体器官 -> 世界材料

当前不使用“同一个 Item + stage 字段”来覆盖不同采摘阶段。已经确认的每一种采摘结果都保持独立 material identity：

| 活体状态 | 采摘后的 Material | 中文 |
| --- | --- | --- |
| SmallLeaf | `TenderLeaf` | 嫩叶 |
| LargeLeaf | `ThickLeaf` | 肥厚的叶片 |
| Fruit Growth = 100 后同步纤维化的 parent Leaf | `AquamelonLeaf` | 水瓜树叶 |
| Green Fruit，`30 <= Growth < 100` | `GreenFruit` | 青果 |
| Mature Fruit，`Growth >= 100` | `Aquamelon` | 水瓜 |

其中：

```text
before Fruit Growth 100:
Green Fruit
+ Thick / fleshy parent Leaf

Fruit Growth reaches 100:
Green Fruit -> Mature Fruit
parent Leaf -> fibrous Aquamelon Leaf
```

因此 `AquamelonLeaf` 的形成由所属 Fruit 的成熟事件触发，不由叶片自身额外计时。

采摘执行的是：

```text
Living Organ
-> harvest
-> world Material
```

转换完成后，该材料退出植物生长模拟，不再继续运行：

- Tree / Leaf nutrient allocation；
- organ Growth；
- on-tree enrichment。

世界材料作为场景中的独立对象存在，可以被搬运或直接放在地面；本轮不设计 inventory slot、stack size、container、pickup capacity 等系统。

### 9.2 材料的最小元素数据语义

当前每个具体材料实例至少具有以下元素相关语义：

```text
MaterialType
ElementAmount[7]
Affinity[7]
```

`FlavorRatio` 仍然只由元素量比例派生：

```text
FlavorRatio[e]
= ElementAmount[e] / sum(ElementAmount)
```

总元素量为 0 时视为尚未形成 Flavor。当前只锁定这些语义，不提前设计统一的 generic material / item / component framework，也不把上述具体材料压缩为 `Material(type, stage)`。

活体器官转换为世界材料时如何把其当前 Growth / FruitElementAmount 等运行态映射到材料的 `ElementAmount`，留到对应实现 Spec；本轮不额外发明转换公式。

### 9.3 已确认的最小加工路线

Processing 把一个世界材料转换为一个或多个新的世界材料实体。产物不是原材料上的 component / tag，而是新的独立 material identity，并拥有自己的 `ElementAmount[7]` / `Affinity[7]` 语义。

Green Fruit 路线：

```text
GreenFruit / 青果
-> 剥开
-> GreenFruitPeel / 青果皮
 + GreenFruitFlesh / 青果肉
```

- `GreenFruitPeel`：有弹性的独立材料；
- `GreenFruitFlesh`：胶冻 / 凝胶质地，承接青果内部混沌、尚未稳定分层的元素形态；不同元素可以形成明显不同质感，未来允许出现结晶、颗粒等表现。

Mature Aquamelon 路线：

```text
Aquamelon / 水瓜
-> 破开
-> AquamelonShell x2
 + AquamelonJuice x1
```

- `AquamelonShell`：两个半球形、木质 / 硬壳的独立材料实体；
- `AquamelonJuice`：一份稳定的成熟水瓜液体产物。

水瓜壳还确认存在一次继续处理：

```text
AquamelonShell
-> 进一步处理 / 剥取
-> AquamelonFlesh
 + remaining shell material
```

`AquamelonFlesh` / 水瓜肉从成熟水瓜壳内侧剥出，有弹性、口感类似椰果。当前只确认“可以从水瓜壳剥出一份水瓜肉”；剩余壳是否改名、质量、单果总产量、工具、耗时和损耗均不在本轮定义。

以下 identity 必须保持区分：

```text
GreenFruitFlesh != AquamelonFlesh
GreenFruitPeel  != AquamelonShell
```

当前不保留一个同时覆盖青果皮与成熟果壳的 generic `AquamelonPeel`。成熟果内部仍可在生物形态描述中存在“果壳 / 光滑内膜 / 果肉膜 / 清澈水瓜水”，但这些解剖层不自动等于可拾取 Material；`AquamelonPulpMembrane` 当前不是已经锁定的独立掉落材料。

本轮也不定义 Processing 时 `ElementAmount` 如何在多个产物之间分配、`Affinity` 如何继承 / 改变、yield / mass conservation / quality / freshness 等公式。

### 9.4 采摘后的 leaf-local sink

Fruit 从形成后即可采摘；Green Fruit 不作为惩罚、失败或“没等够”的低级成果。

如果玩家移除 Flower 或采摘 Fruit：

```text
当前生殖器官的 leaf-local nutrient sink 消失
-> 所属母叶重新获得完整的自身 Leaf budget
-> 其它叶片与 Tree 的第一层预算保持不变
```

未来是否由此形成多汁叶、再次开花或其它分支，仍留给后续 Spec；当前不额外定义触发阈值或状态。

## 10. 当前生命周期中的 Affinity 边界

当前 Sapling 器官链只需要以下 Affinity 语义：

```text
Tree 当前亲和
→ SmallLeaf 出生时一次性标准遗传
→ Leaf / Flower 根据自己的 Growth 独立塑形
→ Flower Growth 到 30、形成 Fruit 时锁定
→ Fruit 阶段不再塑形 Affinity
```

Fruit 形成以后继续变化的是 `FruitElementAmount[7]` 与其派生的 `FlavorRatio[7]`，不是 Affinity。

当前版本不实现重新播种、多代亲和遗传、成熟后精炼或“老种子”生命周期。成熟后持续富集只为这些未来方向保留语义插口，不提前建立框架。

## 11. 当前体验目标

本系统的平衡目标不是让低频玩家“错过一天就停长”，也不是让长期挂机线性换取无限产量。

当前希望形成：

- 第一次进入的玩家通常会想尽可能多做一些事，正常目标是把 Soil 做到至少 80；休闲玩家可以直接浇满 100；
- 积极玩家第三个自然日 / 超过约 48 小时再次上线时，应已经看到发芽后的幼苗；
- 积极玩家持续规律维护约一周，应进入 Sapling，开始进入抽叶 / 开花阶段；
- 半休闲玩家形成“第一次浇透 → 第二次补水并看到发芽过程 → 第三次已发芽”的连续反馈；
- 每周一次玩家第一次浇满 100，一周后回来时应看到已经发芽并继续成长了一段时间的植物，同时 Soil 已明显需要再次维护；
- 完全不了解系统的新人把随机元素球都投入土壤，通常得到普通水瓜，但随机输入保留偶然形成 Hydro / Dendro 倾向、发现特殊水瓜的机会；
- 主动只供给单元素可以稳定定向，但受到单元素通道 Cap 和自然供给不足双重限制，总成长明显变慢；
- 有经验的玩家可以用目标元素 + 辅助元素补足吞吐，在性状与产量之间寻找更高效的配比。

成熟期仍保留以下待反推的周产量目标：

| 上线习惯 | 目标 |
| --- | ---: |
| 每天维护 | 约 4–6 个水瓜 / 周 |
| 每周 2–3 天 | 约 2–4 个水瓜 / 周 |
| 每周 1 天 | 约 2 个水瓜 / 周，且再次上线时 Soil 已明显需要维护 |

完整体验—数值速查见 [基础生长数值速查](growth-balance-baseline.md)。


---

## 12. 当前实现边界

第一轮可见闭环优先实现：

```text
元素球
→ Soil
→ Seed：直接吸收并形成 Growth
→ Seedling：直接吸收并形成 Growth
→ Sapling：开始拥有 Reserve
→ Tree / Leaf 第一层分流
→ 各 Leaf 内部的 Flower / Fruit 第二层分流
→ 叶片阶段变化
→ 颜色变化
→ 采集
```

暂时不要求同时实现：

- 花 / 果完整链；
- 汁液成熟；
- 遗传；
- 气候反馈；
- 复杂多代育种。

这些内容已经在模型中预留接口，但应继续按 SDD Feature / Spec 分批实现。
