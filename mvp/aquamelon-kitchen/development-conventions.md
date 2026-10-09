# 水瓜厨房 MVP：开发约定


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
- 按模型统一的 `MaxRootAbsorbVPerUH` 总吸收上限（4/5/6 V/uh仍在校准）；
- 单元素有效吸收上限；
- 实际 dt。

单元素基础通道上限：

```text
ElementCap[i]
=
MaxRootAbsorbVPerUH × 0.30 × Affinity[i] × Δuh
```

因此 Growth Affinity 虽然不再充当“RootPreference / 提取权重”，但会影响对应元素通道的最大吸收量。单一元素不能独自撑满根系总吸收上限；同一 uh 内的上限不会因结算频率改变。

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

当前生殖器官模板：

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


## 配置及时间字段

所有速率以 [uh（等效小时）](../../docs/plants/uh-time-unit.md) 计算；**以 Tick 次数、物理小时、游戏小时混合表示速度的写法已由 uh 替代**。千星现实3600秒推进1 uh，Web当前10秒推进1 uh；细分结算使用 `Δuh`，不复制整 uh 的养分预算。

规范配置应包含：SoilRetentionPerUH=0.99、容量100V、RootPreference[7]、Affinity[7]、根系总吸收V/uh上限、单元素基础通道份额0.30、种子/器官Growth阈值与平台现实秒数/uh映射。

- 统一吸收上限的最终值正在4/5/6 V/uh之间校准，不预先固定成一个历史值。
- Sapling TreeReserve[7] 必须依据当次 Reserve 与 Tree Affinity 动态生成成长预算；取用系数/额外上限尚未确认，不存在正式的固定 Reserve 抽取百分比。
- 每片叶可优先实际取用树本次预算的30%，未用额度归还 Tree；附属 Flower/Fruit 只从本叶当次预算分流。
- Seed/Seedling阈值45/90；Sapling主干塑形100；Bud20；Leaf26/18；生殖同一 Growth 26/40/90。花开和结果不清零该生殖向量。
- 出芽机会按0/1/2/3叶概率0.80/0.40/0.01/0计；**按 uh 如何触发和细分机会次数**需统一确认，不假定每次结算都重复投概率，也不使用硬性每日固定时刻作为 Growth 阶段条件。

时间持久化记录实际世界更新时间及必要的离散事件去重状态，恢复时从上次时间推进累计 `Δuh` 并在真正的 Growth 跨阈值时处理阶段事件；不得另行使用按每次 Tick 累加固定一小时的近似器。

元素球与土壤只使用同一 uh 计时体系。玩家主动「富集→收集」元素球、清空场地不影响已经进入 Soil 的存量；元素球随 `Δuh` 半衰，收集即时结算实际剩余量，不会自己自动刷新。

## Sapling Bud 与分流状态约定

```text
0叶：Tree 1.0
1叶：Tree 0.7 / Leaf 0.3
2叶：Tree 0.4 / Leaf A 0.3 / Leaf B 0.3
3叶：Tree 0.1 / Leaf A 0.3 / Leaf B 0.3 / Leaf C 0.3
```

上述是叶片优先取用份额上限；未能实际吸收的部分返回 Tree 预算。存在 Active Bud 时仅 Tree 自身份额形成的 GrowthGain 改写入 `BUD_Growth[7]`，达到20产生叶；掐芽时已累积量完整返回 `TREE_Growth[7]`。叶片自主生长、结果与其他叶互不重新分配。

离线结算按每一实际 Growth 状态边界分段；出芽随机机会须按正式确认的 uh 风险频率去重。FlowerBud、Flower、GreenFruit、MatureFruit 从花苞诞生沿同一生殖 Growth[7] 持续增长。

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
