# 水瓜厨房 MVP：开发约定

> 2026-10-08 时间修订：本文遗留的 `dtHours` / 每小时速率 / 每分钟在线结算及「约一周 Sapling」是历史实现口径；统一改按 `dtTick`、per-Tick 数值与独立 `tick:time` 映射。千星奇域 1 Tick = 1 游戏小时，新目标约 1 天 Seedling、3 天 Sapling、第一周至少一果。Web 快速参数不作为千星奇域正式平衡。详见 [Growth Tick](../../docs/plants/growth-tick.md)。


本文件记录千星奇域“水瓜厨房”MVP 的实现层约定。它不新增玩法规则，只约束数据结构、字段组织和七元素向量的索引方式。

生长语义以 [七元素养分与生长系统](growth-system.md) 为准；通用养分模型与 Growth Tick 见根目录 `docs/plants/`。

## 七元素固定顺序

所有七元素相关的列表、数组和逐元素运算统一使用以下固定顺序：

| 索引 | 元素 |
| ---: | --- |
| 0 | Fire |
| 1 | Hydro |
| 2 | Anemo |
| 3 | Electro |
| 4 | Dendro |
| 5 | Cryo |
| 6 | Geo |

开发过程中不得调整这一顺序，也不得在不同数据结构中使用不同顺序。

凡表示完整七元素向量的数据，长度固定为 7。节点图中按索引读写，不再为七个元素分别创建一组独立变量。

## 七元素向量类型

后续实现中，只要数据语义是“一组完整的七元素值”，默认都遵循：

- 长度固定为 7；
- 顺序固定为 Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo；
- 使用同一个元素索引访问不同配置和运行态数据；
- 不为七种元素复制七套独立字段；
- 不在局部节点图中自行改变元素顺序。

当前主要向量类型包括：

```text
SOIL_Elems[7]              土壤元素储备

TREE_Elems[7]              树体内部 Reserve（Sapling 起使用；Seed / Seedling 不使用）
TREE_Growth[7]             树体当前 Growth Vector；Sapling 中按100为一个主干亲和塑形周期
BUD_Growth[7]              Active Bud 的独立 Growth Vector；芽被掐时完整退回 TREE_Growth
TREE_BaseAffinity[7]       当前 Stage / 周期的基础亲和
TREE_EffectiveAffinity[7]  当前 Stage 连续学习后的有效亲和
TREE_RootPreference[7]     根系对七元素的吸收偏好，范围 0~1

LEAF_Growth[7]
LEAF_BaseAffinity[7]
LEAF_EffectiveAffinity[7]

FLOWER_Growth[7]
FLOWER_BaseAffinity[7]
FLOWER_EffectiveAffinity[7]
```

果实阶段后续还会拥有汁液 / 内容物相关向量，具体字段在对应 Spec 中确定。

## Reserve 与 Growth 不得混用

`Elems` / `Reserve` 表示实际仍存在、可以被继续输送和代谢的元素储备。

`Growth` 表示已经被消耗并转化成器官形态的生长度。

两者语义不同：

```text
Reserve
→ Growth Tick 消耗
→ Growth Vector
```

Growth 不得重新当作可输送养分使用。

Seed / Seedling 是当前明确例外：两者没有 Tree Reserve，直接执行：

```text
Soil
→ Absorb
→ Growth Conversion
→ Growth Vector
```

进入 Sapling 后才开始使用 `TREE_Elems[7]` / Reserve。

Seed / Seedling 升级时清空当前 Stage 的 Growth Vector，不清空 Reserve。Sapling 不再继续升级到 Mature；`TREE_Growth` 达到 100 只触发一次树体亲和更新 / 固化，并开始下一轮主干 Growth 累积。

## RootPreference 与 Affinity 的边界

`RootPreference` 与 `Affinity` 是两个不同参数，不再复用同一组数值。

### RootPreference：从 Soil 吃什么

`TREE_RootPreference[7]` 只用于决定 Soil → Tree 吸收时的元素偏好：

```text
SOIL_Elems
→ AbsorbElems

Seed / Seedling:
AbsorbElems → Growth

Sapling 起:
AbsorbElems → TREE_Elems / Reserve
```

每个分量必须满足：

```text
0 <= RootPreference[i] <= 1
```

它表示根系对不同元素的吸收偏好，不表示生长效率，也不允许自身通过超过 1 来提高总吸收量。

当前已锁定：

```text
CFG_TreeRootPreference[7]
=
[0.80, 1.00, 0.85, 0.75, 1.00, 0.70, 0.90]
```

最终吸收还需要同时考虑：

- 当前 Soil 可用元素；
- 固定的总吸收上限 `CFG_MaxTotalAbsorbPerHour = 1.0`；
- 单元素有效吸收上限；
- 实际 dt。

单元素基础通道上限：

```text
ElementCap[i]
=
1.0 × 0.30 × Affinity[i]
```

因此 Growth Affinity 虽然不再充当“RootPreference / 提取权重”，但会影响对应元素通道的最大吸收量。单一元素不能独自撑满完整 1.0/h 吞吐量。

尚未最终锁定：ElementCap 使用 BaseAffinity 还是实时 EffectiveAffinity，以及多元素预算在 RootPreference / Cap / Soil 可用量之间的最终重分配算法。

### Affinity：吃进去以后长得多有效

Affinity 不再作为 Soil → Tree 的“偏好权重”；偏好由 RootPreference 独立承担。

Affinity 当前有两类作用：

```text
1. 决定对应元素的单通道吸收上限
2. 决定吸收后的 Growth Conversion 效率
```

Sapling 起的 Growth Conversion 路径：

```text
TREE_Elems / Reserve
→ Growth Conversion
→ Growth Vector
```

Seed / Seedling 则是吸收后直接进入 Growth Conversion。

Growth 转换时使用完整 Affinity：

```text
GrowthGain[i]
=
GrowthNutrient[i] × Affinity[i]
```

因此 Affinity 可以超过 1，并继续参与：

- 连续学习；
- Stage 固化；
- 后续父子器官继承；
- 表型 / 元素倾向。

不要再实现旧规则：

```text
ExtractionAffinity = min(Affinity, 1)
```


## Base Affinity 与 Effective Affinity

未定型 Stage 使用连续学习：

```text
BaseAffinity
→ 当前环境 / 内部组成
→ EffectiveAffinity
```

Seed / Seedling 进入下一 Stage 时：

```text
BaseAffinity = 当前 EffectiveAffinity
Growth = zero vector
```

Sapling 没有下一 Stage。当前主干每累计满 100 Growth，按本轮 Growth 组成更新 / 固定自身 Affinity，然后开始下一轮主干 Growth 累积。

不实现离散“升级时额外 +100% / +200% 某元素亲和”的奖励。

## 默认亲和配置

当前已有数值继续作为**Growth Affinity 的基础参考值**。Stem 已退出当前器官模型，不再保留 Stem Affinity。

### Tree Growth Affinity

```text
[0.85, 1.15, 0.90, 0.75, 1.20, 0.70, 0.95]
```

### Leaf Growth Affinity

```text
[0.75, 1.10, 1.00, 0.85, 1.30, 0.90, 0.80]
```

### Flower / Fruit lineage Growth Affinity

当前旧配置：

```text
[1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00]
```

先作为花 / 果器官的基础亲和起点。Flower → Fruit 的 Stage 固定与后续汁液累积方式以 `growth-system.md` 和后续 Spec 为准。

### Tree RootPreference

当前已锁定：

```text
[0.80, 1.00, 0.85, 0.75, 1.00, 0.70, 0.90]
```

约束：

```text
length = 7
order = Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo
range = [0, 1]
```

该配置故意不把七元素完全拉平，使 Hydro / Dendro 在随机培养中保留一定自然富集机会。


## CFG 边界

旧版 `CFG.Affinity / Stem / Leaf / Fruit` 结构仍可作为当前编辑器配置的基础数据来源，但新的生长系统还需要：

- Growth Tick 间隔；
- 土壤蒸发率；
- Tree RootPreference 基础值（当前已锁定）；
- 固定总吸收上限 `CFG_MaxTotalAbsorbPerHour = 1.0`；
- 单元素基础 Cap `0.30 × Affinity`；
- Seed / Seedling 的 GrowthThreshold（当前已锁定为 45 / 90）；
- Sapling 主干 Growth 周期阈值（当前 100）；
- Bud GrowthThreshold（当前 20）；
- 每日 04:00 出芽概率（0叶0.80 / 1叶0.40 / 2叶0.01 / 3叶0）；
- 子器官分流比例（当前 Leaf 每片 0.3；0/1/2/3叶时 Tree 剩余 1.0/0.7/0.4/0.1）；
- 各器官 Stage 的环境损耗；
- 连续学习参数；
- 表型阈值。

这些字段的**最终编辑器结构和命名**不在本文件先行拍板，由对应 Feature Spec 确定，再回写本文件。

不要为了提前补齐 CFG 而自行发明未确认字段。

## 时间字段

统一 Growth Tick 后，不再把旧的“树体元素连续衰减时间戳”作为核心模型。

至少需要语义上的：

```text
LastGrowthTickAt
LastBudCheck / 可等价判断是否已处理某个服务器日 04:00
```

用于：

- 在线 Tick 调度；
- 离线期间根据真实经过时间补算连续 Growth；
- 登录时按事件边界回放每日 04:00 出芽检查；
- 防止短时间重登重复触发同一个服务器日的出芽机会。

元素球仍拥有自己的出生 / 保存时间规则，不与 Growth Tick 时间戳混为一谈。

当前元素球数值基线：

```text
InitialAmount = 8~10
HalfLife = 15 min
Destroy when total < 1
Spawn check = every 5 min
SpawnChance = 1 / (1 + (FieldBallTotal / 28)^3)
Login catch-up window = max recent 30 min
```

登录补算按真实 SpawnTime 和球龄计算半衰，不额外制造一套“登录补偿球”。

## Sapling Bud 与分流状态约定

Sapling 的出芽不是每 Tick 随机事件，而是服务器时间每日 04:00 的离散事件。

当前规则：

```text
LeafCount 0 → 0.80
LeafCount 1 → 0.40
LeafCount 2 → 0.01
LeafCount 3 → 0
```

如果 04:00 已存在 Active Bud，则跳过当天检查。

Tree Reserve 形成的本 Tick生长养分预算先向已存在叶片分流：

```text
0叶：Tree 1.0
1叶：Tree 0.7 / Leaf 0.3
2叶：Tree 0.4 / Leaf A 0.3 / Leaf B 0.3
3叶：Tree 0.1 / Leaf A 0.3 / Leaf B 0.3 / Leaf C 0.3
```

有 Active Bud 时，Tree 份额转换得到的 GrowthGain 写入 `BUD_Growth[7]`，而不是 `TREE_Growth[7]`。Bud 累计满 20 后成为正式叶片；若玩家提前掐芽，则：

```text
TREE_Growth[i] += BUD_Growth[i]
BUD_Growth = zero vector
```

Bud 是持久世界状态，不是一次 Tick 的临时变量，因为离线回放和玩家采芽都需要跨 Tick 读取。

离线补算不得简单把完整离线时长压成一次最终计算；至少需要按 04:00、Bud 达到阈值、Tree Growth 达到100、Leaf / Flower / Fruit 阈值等离散事件边界分段。

## 节点图实现原则

涉及七元素的批量逻辑优先使用固定索引：

```text
i = 0..6

SOIL_Elems[i]
TREE_Elems[i]
TREE_Growth[i]
TREE_EffectiveAffinity[i]
LEAF_Growth[i]
...
```

复杂数学或重复向量变换应优先封装为独立公式能力；当前服务端节点图实现可以由独立计算图手动打包为复合节点。

业务流程不要机械按函数拆成多个事件节点图。一次 Tree Growth Update 保持为一个完整流程，内部调用 Calculate_Absorption、Convert_Nutrient_To_Growth 等公式能力。

短生命周期的 `AbsorbElems`、比例、临时转换结果等只通过节点连线 / 局部值传递，不落为跨节点图共享的实体变量。实体变量只保存真正需要持久化的世界状态。

器官通信采用消费者主动获取：Tree 读取 / 修改自己的配对 Soil；Soil 不需要知道 Tree 的成长规则。事件 / 信号只承担流程触发和实例路由，不承担养分等业务数据传输。

## 旧字段迁移

以下旧语义不再作为新实现的 source of truth：

```text
TREE_LastElementUpdateAt
器官生成时一次性 OrganElement 快照后永久冻结
浇灌直接写入 TREE_Elems
树体元素按旧连续公式直接自然衰减
```

已有实验节点图可以继续作为 genshin-ts 编译 / 导入验证材料，但正式功能实现应按新的土壤—Reserve—Growth Tick 模型重新拆 Spec。
