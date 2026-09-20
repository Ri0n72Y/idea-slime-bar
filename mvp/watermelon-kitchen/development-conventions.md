# 水瓜厨房 MVP：开发约定

本文件记录千星奇域“水瓜厨房”MVP 的实现层约定。它不新增玩法规则，只约束七元素索引、向量表示、配置与运行时数据的组织方式。

生长与养分语义以 [七元素养分与生长系统](growth-system.md) 和根目录 [Growth Tick](../../docs/plants/growth-tick.md) 为准。

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

---

## CFG 结构体

全局元素配置统一保存为结构体 `CFG`，挂载在关卡节点上。

当前已经确定的基础亲和列表：

```text
CFG
├── Affinity : float[7]   # 树基础亲和
├── Stem     : float[7]
├── Leaf     : float[7]
└── Fruit    : float[7]
```

四个列表都严格遵循固定顺序：

```text
[Fire, Hydro, Anemo, Electro, Dendro, Cryo, Geo]
```

### 默认值

`Affinity`：

```text
[0.85, 1.15, 0.90, 0.75, 1.20, 0.70, 0.95]
```

`Stem`：

```text
[0.85, 0.75, 0.80, 0.75, 1.15, 0.80, 1.30]
```

`Leaf`：

```text
[0.75, 1.10, 1.00, 0.85, 1.30, 0.90, 0.80]
```

`Fruit`：

```text
[1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00]
```

因此同一元素索引可以直接跨配置读取，例如索引 `4` 始终代表 Dendro：

```text
CFG.Affinity[4]
CFG.Stem[4]
CFG.Leaf[4]
CFG.Fruit[4]
```

随着 Growth Tick 落地，以下参数也应进入全局配置，而不是散落在节点图中：

```text
GrowthTickInterval
SoilMaxElementLoad
SoilEvaporationRatePerTick
TreeGrowthConsumeRatePerTick
StageMaxAbsorbPerTick
StageGrowthThreshold
OrganRetentionRate
OrganChildAllocation
AffinityLearningConfig
VariantThreshold
```

具体字段名和结构体嵌套在对应 Spec 中确定。

---

## 七元素向量类型

新版养分流中必须区分“储备”和“生长”两类向量。

### 1. Reserve / Nutrient Vector

表示真实存在、可以继续被吸收或消耗的七元素量：

```text
SOIL_Elems : float[7]
TREE_Elems : float[7]
```

其中：

- `SOIL_Elems` 是土壤七元素储备；
- `TREE_Elems` 是树体内部七元素储备。

树体颜色等当前状态表现读取的是 Reserve，而不是 Growth。

### 2. Growth Vector

表示某个 Stage 中已经被转化为组织生长的七元素组成：

```text
TREE_Growth : float[7]
LEAF_Growth : float[7]
FLOWER_Growth : float[7]
...
```

Growth 不是可再次被上游吸收的营养库存。

Stage 升级时：

```text
Growth = [0, 0, 0, 0, 0, 0, 0]
```

然后从下一 Stage 重新累积。

### 3. Affinity Vector

每个会吸收 / 成长的器官可以拥有：

```text
BaseAffinity      : float[7]
EffectiveAffinity : float[7]
```

- BaseAffinity：当前 Stage 开始时固定下来的基准亲和；
- EffectiveAffinity：当前 Stage 连续学习后的实时亲和。

进入下一 Stage：

```text
Next.BaseAffinity = Current.EffectiveAffinity
```

然后继续学习。

---

## Stage

Stage 使用离散状态，不通过 Growth 数值倒推。

例如树：

```text
Seedling
Sapling
Mature
```

叶：

```text
Tender
Thick
Mature
```

花和果：

```text
Flower
Fruit
```

进入下一 Stage 后，即使 Growth Vector 被清零，也不得回退到前一个 Stage。

不同 Stage 可以拥有不同：

- `MaxAbsorbPerTick`；
- GrowthThreshold；
- 环境损耗率；
- 子器官槽位；
- 子器官分流比例；
- 表现规则。

---

## 提取亲和与生长亲和

同一 Affinity 在两个阶段使用不同规则。

### 从来源提取

```text
ExtractionAffinity[i] = min(Affinity[i], 1)
```

亲和超过 1 时不允许突破来源真实拥有的元素。

### 转换为 Growth

```text
GrowthGain[i]
=
GrowthNutrient[i] × Affinity[i]
```

这里使用完整 Affinity。

因此：

```text
1 草 × 1.3
→ 1.3 草生长度
```

是允许的。

---

## Continuous Learning

只保留连续学习，不使用离散的“阶段元素奖励”。

当前 Stage 中：

```text
内部元素 / Growth 组成变化
→ EffectiveAffinity 连续变化
```

具体函数由对应器官 Spec 确定。

Stage 变化时，把当前 EffectiveAffinity 固定为下一 Stage 的 BaseAffinity。

---

## 时间字段

离线结算统一使用服务器 UTC 时间。

至少需要区分：

```text
LastGrowthTickAt
```

用于计算错过的 Growth Tick。

元素球等独立实体可以拥有自己的时间戳。

旧版只依赖 `TREE_LastElementUpdateAt` 连续衰减的模型已经被 Growth Tick 养分流替代；如果为了迁移或实验继续保留该字段，不应再把它当作最终生长系统的唯一时间 source of truth。

---

## 元素锁定

旧版设计包含 `TREE_Locks : bool[7]`。

新版引入土壤储备、树体储备和器官养分流后，“锁定”究竟作用于：

- 土壤蒸发；
- 树体代谢；
- 亲和学习；
- 容量竞争；
- 或某一特定器官

需要重新设计。

在新的锁定 Spec 完成前：

> 不把旧版 `TREE_Locks` 语义自动套入新版 Growth Tick。

Debug UI 可以暂时保留该字段用于旧实验图，但正式实现不得据此扩展规则。

---

## 七元素向量通用约定

只要数据语义是一组完整七元素值，默认：

- 长度固定为 7；
- 顺序固定为 Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo；
- 使用同一个元素索引访问不同配置和运行态数据；
- 不为七元素复制七套独立字段；
- 不在局部节点图中自行改变顺序。

这包括：

- Soil Reserve；
- Tree Reserve；
- Tree Growth；
- Leaf / Flower / Fruit Growth；
- Base / Effective Affinity；
- 水瓜汁元素组成；
- 后续需要完整七元素组成的其他数据。

---

## 节点图实现原则

涉及七元素的批量逻辑优先按固定索引处理：

```text
i = 0..6

SOIL_Elems[i]
TREE_Elems[i]
TREE_Growth[i]
OrganGrowth[i]
BaseAffinity[i]
EffectiveAffinity[i]
```

复杂向量公式优先单独生成节点图并打包为复合节点。

主流程只负责：

- Tick 编排；
- Stage 编排；
- 器官关系；
- 状态读写；
- 调用复合计算节点。

不要重新把完整养分计算、亲和学习和 Stage 编排堆到一张大型节点图中。
