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

TREE_Elems[7]              树体内部 Reserve
TREE_Growth[7]             树体当前 Stage 的 Growth Vector
TREE_BaseAffinity[7]       当前 Stage 的基础亲和
TREE_EffectiveAffinity[7]  当前 Stage 连续学习后的有效亲和

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

Stage 升级时清空的是当前 Stage 的 Growth Vector，不是内部 Reserve。

## Affinity 的统一语义

Affinity 有两种使用方式。

### 从来源提取元素

提取时：

```text
ExtractionAffinity[i] = min(Affinity[i], 1)
```

亲和超过 1 不允许从来源拿走超过实际供给的元素。

### 转换为 Growth

转换时使用完整 Affinity：

```text
GrowthGain[i]
=
GrowthNutrient[i] × Affinity[i]
```

因此 Affinity > 1 可以提高生长效率。

同一个亲和值在两个步骤中不要使用不同的临时解释。

## Base Affinity 与 Effective Affinity

未定型 Stage 使用连续学习：

```text
BaseAffinity
→ 当前环境 / 内部组成
→ EffectiveAffinity
```

进入下一 Stage 时：

```text
BaseAffinity = 当前 EffectiveAffinity
Growth = zero vector
```

下一 Stage 再从新的 BaseAffinity 开始连续学习。

不实现离散“升级时额外 +100% / +200% 某元素亲和”的奖励。

## 默认亲和配置

当前已经有的七元素亲和数值继续作为各类器官的**基础亲和参考值**，不再解释为“生成瞬间直接乘一次后冻结的快照系数”。

### Tree

```text
[0.85, 1.15, 0.90, 0.75, 1.20, 0.70, 0.95]
```

### Stem

```text
[0.85, 0.75, 0.80, 0.75, 1.15, 0.80, 1.30]
```

### Leaf

```text
[0.75, 1.10, 1.00, 0.85, 1.30, 0.90, 0.80]
```

### Flower / Fruit lineage

当前旧配置：

```text
[1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00]
```

先作为花 / 果器官的基础亲和起点。Flower → Fruit 的 Stage 固定与后续汁液累积方式以 `growth-system.md` 和后续 Spec 为准。

## CFG 边界

旧版 `CFG.Affinity / Stem / Leaf / Fruit` 结构仍可作为当前编辑器配置的基础数据来源，但新的生长系统还需要：

- Growth Tick 间隔；
- 土壤蒸发率；
- 各 Tree Stage 的 `MaxAbsorbPerTick`；
- 各 Stage 的 GrowthThreshold；
- 子器官分流比例；
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
```

用于：

- 在线 Tick 调度；
- 离线期间根据 UTC 时间计算漏掉的 Tick；
- 批量补算或等价近似。

元素球仍拥有自己的出生 / 保存时间规则，不与 Growth Tick 时间戳混为一谈。

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

复杂数学或重复向量变换应优先拆为独立计算图，再由编辑器打包复合节点。

主流程图保持小而单一，不把完整 Growth Tick、吸收、子器官分流、Stage 跳转和表现全部展开在一张图中。

## 旧字段迁移

以下旧语义不再作为新实现的 source of truth：

```text
TREE_LastElementUpdateAt
器官生成时一次性 OrganElement 快照后永久冻结
浇灌直接写入 TREE_Elems
树体元素按旧连续公式直接自然衰减
```

已有实验节点图可以继续作为 genshin-ts 编译 / 导入验证材料，但正式功能实现应按新的土壤—Reserve—Growth Tick 模型重新拆 Spec。
