# 水瓜厨房：基础生长数值速查

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

这部分是后续 Sapling / Mature 平衡的产量目标，**当前尚未完成数值反推**：

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

当前基础设计中，Seed / Seedling / Sapling / Mature **不因 Stage 改变这个总吸收上限**。

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

## 9. 当前继续设计的边界

下一阶段讨论从 Sapling 开始：

```text
Sapling
→ 开始拥有 Reserve
→ TreeGrowthRetentionPerHour = 0.99 的生长代谢
→ 叶片 / 花 / 果分流
→ 成熟产量
```

需要继续反推：

- Sapling → Mature 的 GrowthThreshold；
- Sapling Reserve 的进入 / 上限 / 恢复规则；
- `30 / 80` Dormant / Growing 迟滞是否继续作为最终值；
- Tree Growth 与叶片、花果的分流；
- 每天玩家 4–6 果 / 周、每周 2–3 天玩家 2–4 果 / 周、每周一次玩家约 2 果 / 周的成熟期数值；
- 单元素 Cap 到底读取 BaseAffinity 还是 EffectiveAffinity；
- 多元素吸收预算的最终重分配算法。

在这些数值确认前，不由实现阶段自行补全。
