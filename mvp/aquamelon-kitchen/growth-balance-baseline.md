# 水瓜厨房：基础生长数值速查

> **2026-10-08 新目标及单位优先声明**：此文下方按 `RatePerHour / dtHours` 推算的数值与新目标冲突，是历史参考而非现行目标或自动批准的参数。正式单位是 `dtTick`，千星奇域默认每 Tick 对应 1 游戏小时。新的积极玩家目标是约 **24 Tick** 到 Seedling、**72 Tick** 到 Sapling 并开始开花结果，**168 Tick** 内获得至少一个果实。Seed 45 / Seedling 90 / Bud 20 / Flower 30 / Fruit 100 等阶段阈值暂不随之更改。当前历史吞吐上限 1/Tick 与 Reserve retention 0.99/Tick 仍不足以完成该目标；需单独校准千星奇域供应/吸收/Reserve 消耗等参数，**不可**直接复制 Web 的快速数值。Web 正在使用独立的 `tick:time`、吸收与代谢配置进行试玩校准。参见 [Growth Tick](../../docs/plants/growth-tick.md) 与 `packages/plugins/src/aquamelon/config.ts`。


本文汇总当前已经确认的基础生长数值、对应体验目标，以及基于这些数值做出的第一轮推算。它用于快速校准后续设计，不替代 `growth-system.md` 的机制定义。

状态约定：

- **已定**：本轮讨论已经明确确认；
- **推算**：由已定数值计算出的体验检查值，可随以后新增机制变化；
- **待定**：仍需后续讨论，不能由实现阶段自行补齐。

---

## 1. 玩家体验目标

### 新手前一周

目标不是让玩家看进度条，而是让登录节奏本身产生阶段性反馈。

| 玩家类型 | 体验目标 |
| --- | --- |
| 积极玩家 | 第一次进入时会尽量多做事，正常把 Soil 做到至少 80；第三个自然日 / 超过约 48 小时再次上线时，应已经看到发芽后的幼苗；持续规律维护约一周，应进入 Sapling，开始进入抽叶 / 开花阶段 |
| 半休闲玩家 | 第一次浇透；第二次上线补水并看到发芽中的变化；第三次上线时应已经发芽 |
| 每周一次玩家 | 第一次把 Soil 浇到 100；约一周后第二次上线时，应看到已经发芽并继续生长了一段时间的幼苗，同时土地已经明显需要再次浇灌 |
| 随机新人 | 把遇到的元素球基本都投入 Soil；通常得到普通水瓜，但长期应存在偶然撞出明显 Hydro / Dendro 倾向乃至第一期隐藏“草原核水瓜”的可能 |

Seed / Seedling 阶段要尽早提供轻反馈：

- Growth 尚未完成时可以用非常轻微的颜色变化、元素粒子逸散等方式表现正在形成的元素倾向；
- 正式玩家界面不显示精确七元素数值；
- Debug UI 可以显示精确状态。

### 成熟后的长期维护目标

这部分是 Sapling 长期生产循环的产量目标，**当前尚未完成最终数值反推**：

| 上线习惯 | 周产量体验目标 |
| --- | ---: |
| 每天维护 | 约 4–6 个水瓜 / 周 |
| 每周 2–3 天 | 约 2–4 个水瓜 / 周 |
| 每周 1 天 | 约 2 个水瓜 / 周，并且再次上线时 Soil 已明显需要维护 |

---

## 2. Soil 基线

### 已定参数

```text
CFG_SoilCapacity = 100
CFG_SoilRetentionPerHour = 0.99
```

土壤自然损耗按当前含量做指数衰减：

```text
SOIL_Elems[i]
*= 0.99 ^ dtHours
```

因此 100 Soil 在**只考虑自然衰减、不考虑植物吸收**时约剩：

| 时间 | 剩余 |
| ---: | ---: |
| 24h | 78.6 |
| 48h | 61.7 |
| 72h | 48.5 |
| 168h / 7d | 18.5 |

### 超容量规则

元素球进入 Soil 时直接：

```text
SOIL_Elems[i] += BALL_Elems[i]
```

允许临时超过 100。下一次 Soil Growth Tick 开头：

```text
SoilTotal = Σ SOIL_Elems[i]

if SoilTotal > 100:
    KeepRatio = 100 / SoilTotal
    SOIL_Elems[i] *= KeepRatio
```

新旧元素不区分优先级，所有元素统一等比例压缩。

示例：

```text
初始：
Electro 50
Hydro   30
Dendro  20
= 100

再加入 Electro 50
→ 100 / 30 / 20
= 150

下一 Tick：
× 100/150

→ 66.67 / 20 / 13.33
= 100
```

连续加入同一元素形成逐次残留、逐步替换，不存在“新输入直接清掉旧 Soil”。

---

## 3. 元素球刷新与衰减

### 已定参数

```text
BallInitialAmount = random(8, 10)

BallHalfLife = 15 min

BallDestroyThreshold:
Σ BALL_Elems < 1
→ Destroy

BallSpawnCheckInterval = 5 min
```

每 5 分钟最多尝试生成 1 个新球。

场上压力读取当前所有未捕获元素球的**元素总量**，不是球数量：

```text
FieldBallTotal
=
Σ all active BALL_Elems
```

生成概率：

```text
SpawnChance
=
1 / (1 + (FieldBallTotal / 28)^3)
```

没有硬性“最多 8 个球”的限制。目标是通过总元素压力形成软上限，使大部分时间场上不超过约 8 个有效球。

### 球自身连续衰减

```text
BALL_Elems
*= 0.5 ^ (dtMinutes / 15)
```

以初始量 9 为例：

| 球龄 | 剩余 |
| ---: | ---: |
| 0 min | 9.00 |
| 15 min | 4.50 |
| 30 min | 2.25 |
| 45 min | 1.125 |
| 约 48 min | < 1，销毁 |

### 登录时的离线场景恢复

登录时不额外发“补偿球”，而是按正常刷新规则回放最近最多约 30 分钟：

```text
SimulateWindow
=
min(actualOfflineElapsed, 30 min)
```

在该时间窗内按每 5 分钟一次的正常生成检查回放；每个生成成功的球保存实际出生时间，并根据：

```text
age = Now - SpawnTime
```

按 15 分钟半衰期衰减到登录时的真实剩余量。

这使玩家刚上线就通常有东西可处理，但长期离线不会无限积攒资源。

### 推算：无人收球时的软稳态

以平均初始量 9 计算，第一轮模拟得到：

| 指标 | 推算值 |
| --- | ---: |
| 平均场上球数 | ≈ 7.0 |
| 球数中位数 | ≈ 7 |
| 约 90% 情况 | ≤ 8 个 |
| 平均场上元素总量 | ≈ 27.4 |
| 稳态 15 min 新生球 | ≈ 2.1 个 |

这些是用于验证刷新公式是否符合“大概率约 8 个以内”的推算值，不是额外配置常量。

---

## 4. Tree RootPreference 与 Growth Affinity

七元素固定顺序：

```text
Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo
```

### 已定 RootPreference

```text
CFG_TreeRootPreference[7]
=
[0.80, 1.00, 0.85, 0.75, 1.00, 0.70, 0.90]
```

语义：

- RootPreference 决定混合 Soil 中根系更偏向吃什么；
- 其每个分量严格位于 0–1；
- 普通水瓜天然略偏 Hydro / Dendro，但不做完全均衡补偿，以保留随机培养中的发现空间。

### 当前 Tree Growth Affinity

```text
CFG_TreeAffinity[7]
=
[0.85, 1.15, 0.90, 0.75, 1.20, 0.70, 0.95]
```

Affinity：

- 决定吸收后转化为 Growth 的效率；
- 同时影响单元素通道的最大吸收上限；
- 可以超过 1；
- 继续参与连续学习、Stage 固化和后续遗传。

---

## 5. 根系总吸收与单元素饱和

### 已定总吸收上限

```text
CFG_MaxTotalAbsorbPerHour = 1.0
```

当前基础设计中，Seed / Seedling / Sapling **不因 Stage 改变这个总吸收上限**；Mature 最终设计延后。

Stage 的主要时间差异通过：

```text
GrowthThreshold
```

控制，而不是通过让后期阶段“根越大，每小时吃得越多”。

### 已定单元素基准上限

```text
SingleElementBaseCapShare = 0.30
```

某元素的理论单通道上限：

```text
ElementCap[i]
=
CFG_MaxTotalAbsorbPerHour
× 0.30
× Affinity[i]
```

因此当前 Tree 基线：

| 元素 | Affinity | 理论单元素吸收上限 / h |
| --- | ---: | ---: |
| Fire | 0.85 | 0.255 |
| Hydro | 1.15 | 0.345 |
| Anemo | 0.90 | 0.270 |
| Electro | 0.75 | 0.225 |
| Dendro | 1.20 | 0.360 |
| Cryo | 0.70 | 0.210 |
| Geo | 0.95 | 0.285 |

体验目的：

- 单元素定向培养有效，但不能靠一种元素填满 1.0/h；
- 高 Affinity 同时提高单元素吸收通道和 Growth 转换效率，为“高亲和、高产量特化品种”埋长期培养钩子；
- 多元素可以叠加各自通道，使总吸收逐渐接近 1.0/h；
- Soil 中目标元素本身不足时，实际吸收还要受可用量限制，因此早期强行单元素培养会进一步遇到供应不足和“干枯”问题。

**待定：** 单元素 Cap 最终读取当前 Stage 的 Base Affinity 还是实时 Effective Affinity，尚未最终锁定；实现阶段不得自行选择。

**待定：** 多元素在 RootPreference、各元素 Cap 和 Soil 可用量之间的最终重分配算法尚未完全锁定。

---

## 6. Seed → Seedling → Sapling 的第一周节奏

### 状态边界已定

Seed 和 Seedling **没有 Tree Reserve**。

```text
Seed / Seedling:

Soil
→ Calculate Absorption
→ 直接按 Growth Affinity 转成 Growth Vector
```

进入 Sapling 后才开始拥有：

```text
TREE_Elems[7] / Reserve
```

并从这里进入后续抽叶、开花和器官分流模型。

因此旧的：

```text
Seed / Seedling
→ Reserve
→ 每小时消耗 Reserve 1%
→ Growth
```

不再成立。

### 已定阶段阈值

普通随机混合供给、能够吃满 `1.0/h` 时，根据当前 RootPreference 加权后的基线平均 Growth Affinity：

```text
AverageGrowthAffinity
≈ 0.9504
```

所以：

```text
FullSpeedGrowth
≈ 0.9504 Growth / hour
```

第一阶段：

```text
Seed → Seedling
GrowthThreshold = 45

45 / 0.9504
≈ 47.35 h
```

第二阶段：

```text
Seedling → Sapling
GrowthThreshold = 90

90 / 0.9504
≈ 94.70 h
```

合计：

```text
≈ 142.0 h
≈ 5.92 days
```

这给真实随机、漏球、非满 Soil 留出少量余量，使积极玩家自然落在“约一周进入 Sapling”的体验窗口。

### 与登录体验对应

```text
Day 0
→ 第一次进入，积极玩家通常把 Soil 做到 80+
→ 休闲玩家可以直接做到 100

约 47h
→ Seedling
→ 第三个自然日上线时应已经看到发芽后的幼苗

再约 95h
→ Sapling

总计约 6 天理论满速
→ 真实体验约一周
→ 开始进入抽叶 / 开花阶段
```

每周一次的玩家第一次把 Soil 做到 100 后，即使后来不再补充，也应在第二次一周后上线时看到已经发芽并成长了一段时间的植株，而不是仍停留在种子状态。

---

## 7. 培养策略的理论速度检查

以下假设目标元素在 Soil 中始终足够，只用于验证吸收结构，不代表真实随机元素球供给。

### 普通随机七元素

均衡 Soil 下，RootPreference 加权后的平均转换效率约：

```text
0.9504 Growth / h
```

总吸收可以达到：

```text
1.0 / h
```

因此：

```text
Seed ≈ 47.35 h
Seedling ≈ 94.70 h
```

### 纯 Dendro

```text
AbsorbCap
=
0.30 × 1.20
=
0.36 / h

Growth
=
0.36 × 1.20
=
0.432 / h
```

理论上：

```text
Seed ≈ 104 h
Seedling ≈ 208 h
```

真实自然刷新中单一 Dendro 供应还可能不足，因此实际通常更慢。

### Hydro + Dendro

```text
Hydro Cap  = 0.345
Dendro Cap = 0.360

Total Absorb Cap
= 0.705 / h

Growth
= 0.345 × 1.15
+ 0.360 × 1.20
≈ 0.829 / h
```

虽然吸收量只有理论满吞吐的约 70.5%，但两种元素 Growth Affinity 都高，因此 Growth 仍接近普通随机培养的约 87%。

### Hydro + Dendro + Geo

```text
0.345 + 0.360 + 0.285
=
0.99 / h
```

Growth 约：

```text
1.10 / h
```

这说明“懂配比的玩家”可以在保留目标元素倾向的同时，用第三 / 第四元素补足总吞吐，甚至比完全随机杂食更高效。

这属于有意保留的培养深度，而不是需要抹平的误差。

---

## 8. 每日维护量的第一轮检查

如果 Soil 从 100 开始，连续 24h 每小时先按 0.99 保留、再由植物最多吸收 1：

```text
24h 后 Soil
≈ 57.14

恢复到 100
需要补
≈ 42.86
```

按当前元素球模型，长时间离线后登录补算最近 30min，第一轮模拟约得到：

```text
登录瞬间：
≈ 5.2 个球
≈ 27 元素总量
```

如果登录后继续在线约 10min，并及时牵引新生球：

```text
登录残留
≈ 27

+
约 2 个新鲜球
≈ 18

=
约 45 元素
```

这与每天把高负荷生长后的 Soil 从约 57 补回 100 所需的约 42.9 非常接近。

因此当前参数组合支持以下目标：

> 每天上线约十分钟，轻松牵引几个球，就能够把植物维持在接近满速状态；继续长时间在线不会因为植物总吸收上限而线性无限增加生长速度。

这些登录球数量 / 元素量属于当前刷新公式的推算结果，不作为硬编码产量。

---

## 9. Sapling：当前版本主玩法阶段

当前版本不再要求 Sapling 继续成长为 Mature。Sapling 本身就是主要长期玩法阶段，当前树冠上限为 3 片叶。

主干本身继续累计 Growth，但用途改为周期性亲和塑形：

```text
SaplingTreeGrowthCycle = 100

Σ TREE_Growth >= 100
→ 根据本轮 Growth 组成更新 / 固定 Tree Affinity
→ 开启下一轮主干 Growth 累计
→ Stage 不变化
```

因此“主干长满”不再解锁下一个 Stage。

---

## 10. 每日出芽事件

出芽只在服务器时间每天 04:00 检查一次。

```text
DailyBudCheckAt = 04:00
```

当前概率已经锁定：

| 当前叶片数 | 当日出芽概率 |
| ---: | ---: |
| 0 | 0.80 |
| 1 | 0.40 |
| 2 | 0.01 |
| 3 | 0 |

如果 04:00 时已经存在尚未完成的 Active Bud，则当天跳过，不再补投。

这一组概率的体验含义：

- 第一片叶基本会很快建立；
- 第二片叶通常需要再等几天；
- 第三片叶在前几周属于少量旺盛植株；
- 第四片叶当前版本不产生。

---

## 11. Bud Growth 与掐芽催熟

Bud 拥有独立七元素 Growth：

```text
BUD_Growth[7]
BudGrowthThreshold = 20
```

Tree Reserve 产生本 Tick Growth Nutrient Budget 后，先按已有叶片数量分流：

```text
0叶：Tree 1.0
1叶：Tree 0.7 / Leaf 0.3
2叶：Tree 0.4 / Leaf A 0.3 / Leaf B 0.3
3叶：Tree 0.1 / Leaf A 0.3 / Leaf B 0.3 / Leaf C 0.3
```

这里的比例作用于**本 Tick 生长养分预算**，不是持续从已经累计的 TREE_Growth 中扣值。

没有 Bud：

```text
Tree Own GrowthGain
→ TREE_Growth
```

有 Bud：

```text
Tree Own GrowthGain
→ BUD_Growth

TREE_Growth 暂停增加
```

如果玩家在 Bud 完成前掐掉嫩叶芽：

```text
TREE_Growth[i] += BUD_Growth[i]
BUD_Growth = 0
Destroy Bud
```

因此芽期 Growth 不损失，而是回到主干。这就是当前版本“掐芽催熟”的真实机制：

> 放弃一次叶片扩张，把已经投入芽的 Growth 退回主干，让主干更快完成 100 Growth 的亲和塑形周期。

如果 Bud 正常长到 20：

```text
Σ BUD_Growth >= 20
→ Bud 完成
→ 以此刻 Tree 的当前亲和按标准父子器官继承规则生成 SmallLeaf
→ SmallLeaf 后续独立塑形自己的 Affinity
```

这 20 Growth 已经成为器官，不再退回主干；SmallLeaf 的 Affinity 只在出生瞬间继承一次，不实时跟随 Tree。

三片叶时，主干只剩约 0.1 的预算，几乎停止自身 Growth；这是当前设计的正确结果，而不是需要修正的异常。

---

## 12. 登录时的离线事件回放

当前数值设计的目标不是模拟“24 小时在线世界”，而是在登录时恢复离线期间真正应该发生的结果。

因此离线计算不是只做一次总 dt，也不能简单在最后补投若干次随机事件。

应按关键事件边界分段：

```text
LastUpdate
→ 下一个 04:00
→ Bud 达到 20
→ SmallLeaf / LargeLeaf / FlowerBud 的 elapsed-time boundary
→ Flower / Fruit 的 Reproductive Growth = 30 / 100
→ Tree Growth 达到 100
→ 下一个 04:00
→ ...
→ Now
```

每个连续区间使用真实 dt 批量计算 Soil / Reserve / Growth；到 04:00 边界时，必须先完成此前 Growth，再读取当时真实叶数和 Bud 状态投一次当天的出芽概率。

示意：

```text
9/27 18:00 last update
↓
9/28 04:00
先计算 10h Growth
→ 再投当天 Bud

如果成功：
04:00 后 Tree Own Growth → BUD_Growth

如果 Bud 在当天达到20：
→ Bud → Leaf

↓
9/29 04:00
基于此刻真实 LeafCount / ActiveBud 再投一次
...
↓
Login Now
```

短时间重登不会重复获得当天 04:00 的机会。

开花可见性是离线恢复中的一个特殊事件边界：如果某个 FlowerBud 在本次离线恢复中首次跨过 bloom boundary，则该器官只结算到“Flower 刚开始”，本次离线恢复不再继续推进它的 Flower Growth。玩家登录后再从可见花期继续；不为此建立独立 scheduler / timer framework。

---

## 13. 第一轮叶片时间推算

以下只作为当前平衡检查，不是硬编码时间。

假设：

- Sapling 刚进入时 Reserve 从 0 开始；
- Soil 长期足够，吸收维持约 1.0/h；
- `TreeGrowthRetentionPerHour = 0.99`；
- 普通混合 Growth Affinity 暂按平均 `0.9504`；
- 暂不叠加尚未解决的实时 EffectiveAffinity 正反馈；
- 每片叶固定分流 0.3；
- Bud 需要 20 Growth。

Reserve 进入稳态后，Bud 的理论成长速度约为：

| 已有叶数 | Bud 获得的 Tree 份额 | Bud Growth / h | 20 Growth 理论时间 |
| ---: | ---: | ---: | ---: |
| 0 | 1.0 | ≈ 0.950 | ≈ 21.0h |
| 1 | 0.7 | ≈ 0.665 | ≈ 30.1h |
| 2 | 0.4 | ≈ 0.380 | ≈ 52.6h |

考虑 Sapling 初期 Reserve 从 0 热机，以及每天 04:00 的真实出芽概率后，第一轮事件模拟约得到：

| 事件 | 平均时间 | 中位数 | 90% 玩家此前完成 |
| --- | ---: | ---: | ---: |
| 第一芽出现 | ≈ 0.75d | ≈ 0.62d | ≈ 1.62d |
| 第一片叶形成 | **≈ 3.20d** | **≈ 3.11d** | **≈ 3.54d** |
| 第二芽出现 | ≈ 5.13d | ≈ 4.56d | ≈ 7.71d |
| 第二片叶形成 | **≈ 6.84d** | **≈ 6.28d** | **≈ 9.16d** |

所以当前参数自然形成：

```text
进入 Sapling
→ 第1天左右常见第一芽
→ 第3天左右第一片叶
→ 第5天左右常见第二芽
→ 第6~7天进入两叶主状态
```

第三片叶因为同时受到“每天 1%”和“只有 0.4 主干预算”两层限制，会成为长期小概率状态。

当前模拟约为：

```text
14天内形成第3叶 ≈ 5%
30天内 ≈ 19%
60天内 ≈ 40%

第3叶形成时间中位数 ≈ 78天
平均值 ≈ 108天
```

这符合“绝大部分两片叶、少量三片叶”的当前目标。

---

## 14. Sapling 后半段生命周期数值基线

当前可见链已经锁定为：

```text
Bud
→ SmallLeaf
→ LargeLeaf
→ FlowerBud
→ Flower
→ Green Fruit
→ Mature Fruit
```

### 开花前：elapsed-time boundary

```text
Bud Growth = 20
→ SmallLeaf

SmallLeaf: 12h
→ LargeLeaf

LargeLeaf: 再 12h
→ FlowerBud

FlowerBud: 再约 24h
→ bloom boundary / Flower
```

SmallLeaf / LargeLeaf / FlowerBud 统一由 settlement 按经过时间推进，不为每个阶段建立独立 timer。

Bud 完成生成 SmallLeaf 时，以当时 Tree 的当前亲和按标准父子器官规则做一次性继承；Leaf 出生后独立塑形，不实时跟随 Tree。

### 开花后：Reproductive Growth

```text
Flower:       0 -> 30
Green Fruit:  30 <= Growth < 100
Mature Fruit: Growth >= 100
```

正常供给下 Flower 约 12h 达到 30 是体验目标，不是独立 FlowerTimer。

达到 30：

```text
Flower 凋谢
→ Fruit 形成
→ 当前 Affinity locked
→ 开始累计 FruitElementAmount[7]
```

达到 100 只代表 Green Fruit -> Mature Fruit 的物理成熟边界。

### 生殖器官 nutrient sink

这里是**第二层、leaf-local 分流**。第一层 `Tree -> Tree self + each Leaf` 的 0/1/2/3 叶预算保持不变；Flower / Fruit 的 sink 分母只等于“所属母叶本次 settlement 获得的 Growth Nutrient Budget”，不会重新分配 Tree 或其它叶片的预算。

| 阶段 | Sink baseline / target | 设计含义 |
| --- | ---: | --- |
| Flower | ≈ 50% | 从母叶预算取约一半，母叶自身仍保留约一半 |
| Green Fruit | 80–90% | 从母叶预算取绝大部分，使该母叶自身成长几乎停滞；实现时再校准区间 |
| Mature Fruit | ≈ 20% | 从母叶预算取少量继续富集，母叶恢复大部分自身成长 |

Green Fruit 的 `80–90%` 当前故意保留为区间，不擅自收敛到单一数字。多叶同时结果时，每个 Fruit 只在自己的母叶预算内部独立分流，不做跨叶归一化或全局 sink cap。

三叶 Tree 示例，若 Leaf A 挂 Green Fruit 且本次 sink 取 85%：

```text
Level 1:
Tree   = 0.1
Leaf A = 0.3
Leaf B = 0.3
Leaf C = 0.3

Level 2 inside Leaf A:
Fruit A     = 0.3 * 0.85 = 0.255
Leaf A self = 0.3 * 0.15 = 0.045

Tree / Leaf B / Leaf C 保持 0.1 / 0.3 / 0.3
```

摘除 Fruit 只会让所属母叶重新获得完整的自身 Leaf budget；不会触发其它叶片或 Tree 的第一层预算重分配。

### Fruit Flavor 与成熟后继续富集

Fruit 形成后只累计实际进入果实的七元素量：

```text
FruitElementAmount[7]
```

Flavor 不做额外转换：

```text
FlavorRatio[e]
= FruitElementAmount[e] / Σ FruitElementAmount
```

总量为 0 时视为尚未形成 Flavor。`FruitElementAmount` 是持久化事实，`FlavorRatio` 是派生值。

Mature Fruit 到 100 后仍继续按约 20% 的低 sink 累计元素，因此 FlavorRatio 仍可变化；100 不锁 Flavor、不停止元素累计，也不自动采摘。

### 采摘与物理形态

- Green Fruit 从形成后即可采摘，是独立料理材料，不是失败状态；果皮有弹性，内部为未稳定分层的元素粘液，可出现析出 / 结晶等元素质地。
- 30 -> 100 的外观从青绿色、柔软感逐渐过渡到深褐、木质感。
- Mature Fruit 形成深褐木质果壳，内部结构稳定为“果壳 → 光滑内膜 → 果肉膜 → 清澈水瓜水”，主要提供稳定水瓜汁类素材。
- Mature Fruit 可用少量亮晶晶逸散提示仍在低效率富集；这里只是视觉要求。

成熟后的更多 Flavor 催化、特殊质地、过量精炼或“老种子”只保留未来语义插口，本轮不定义规则。

## 15. 当前继续设计的边界

当前下一步仍是完善 Sapling 长期生产循环，而不是扩展新的生命周期框架。

仍需确认：

- Sapling Reserve 的进入 / 上限 / 恢复规则；
- `30 / 80` Dormant / Growing 迟滞是否继续作为最终值；
- 在现有吸收 / Reserve / Affinity 公式下，具体 Growth rate 如何校准，才能稳定实现 Flower 约 12h、Green Fruit 的目标成熟节奏与周产量；
- 成果采摘后叶片如何继续循环 / 再次开花；
- 每天玩家 4–6 果 / 周、每周 2–3 天玩家 2–4 果 / 周、每周一次玩家约 2 果 / 周的最终产量；
- 单元素 Cap 到底读取 BaseAffinity 还是 EffectiveAffinity；
- 多元素吸收预算的最终重分配算法。

已经确认的 SmallLeaf / LargeLeaf / FlowerBud 时间边界、Flower 0->30、Fruit 30->100、Affinity 锁定点、FruitElementAmount / FlavorRatio 与三档 nutrient sink 不再作为“待实现者自行补全”的开放问题。

### 2026-10-08 Web 可重复校准场景（非千星奇域正式数值）

当前 `WEB_BALANCE`：1 Tick = 1 游戏小时；每 **20 秒现实时间**自动执行一个 Tick；`maxTotalAbsorbPerTick=6`；土壤每 Tick 保留 `0.99`；Sapling Reserve 每 Tick 保留 `0.90`；随机元素球每次约 8–10，半衰期 8 Tick。

样例采用固定初始随机种子 `0x51a7e123`：开始时 Soil=0；每当 Soil 总元素量不足 55，玩家连续执行 7 次「凝聚元素 + 引导至土壤」（共 14 次点击）；所有结算调用同一个 `advanceWorld(state, 1, WEB_BALANCE)`。不进行直接 Growth 注入，也不跳阶段。

独立数值推演给出以下 **尚未经过实际试玩验证** 的里程碑：

| 实际阶段 / 边界 | 累计 Tick（推演） | 现实时间（20秒/Tick） |
| --- | ---: | ---: |
| Seedling | 7 | 2分20秒 |
| Sapling | 19 | 6分20秒 |
| 首次 Active Bud | 28 | 9分20秒 |
| SmallLeaf | 34 | 11分20秒 |
| LargeLeaf | 46 | 15分20秒 |
| FlowerBud | 58 | 19分20秒 |
| Flower | 82 | 27分20秒 |
| GreenFruit | 110 | 36分40秒 |
| MatureFruit | 147 | 49分钟 |

这一强投入场景到首个 MatureFruit 预计凝聚/引导 **154 个球、308 次按钮操作**，约 6.3 次操作/分钟。不是每个随机种子、投入习惯或离线节奏都能复现此时间；实际操作校准仍应观察玩家行为。

同一投入策略但使用千星奇域的**历史** `1 / Tick` 吸收和 `0.99 / Tick` Reserve retention，独立推演约 **40 Tick** 到 Seedling、**110 Tick** 到 Sapling，第一周（168 Tick）尚未进入首次 SmallLeaf。新目标 24 / 72 / 168 Tick 尚未达标；要取得正式参数必须由 Lead 确认供应与预算如何调整，不能将 Web 的 6 / Tick 或 0.90 retention 隐式同步过去。

本轮移除了旧的 Domain Tests 与 `check:domain` 验证入口；上述数值仍属于独立推演，不等同于已完成的 TypeScript typecheck、Web production build 或真实试玩。
