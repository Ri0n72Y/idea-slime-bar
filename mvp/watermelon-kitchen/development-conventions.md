# 水瓜厨房 MVP：开发约定

本文件记录千星奇域“水瓜厨房”MVP 的实现层约定。它不新增玩法规则，只约束数据结构、字段组织和七元素数据的索引方式。

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

## CFG 结构体

全局元素配置统一保存为结构体 `CFG`，挂载在关卡节点上。

`CFG` 当前包含四个浮点数列表：

```text
CFG
├── Affinity : float[7]
├── Stem     : float[7]
├── Leaf     : float[7]
└── Fruit    : float[7]
```

四个列表都严格遵循七元素固定顺序：

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

## 植物运行时七元素状态

植物自己的七元素值使用同样的数据表示方式，不再维护：

```text
TREE_Fire
TREE_Hydro
TREE_Anemo
...
```

而是保存为一个长度固定为 7 的浮点数列表，例如：

```text
TREE.Elements : float[7]
```

索引规则与 `CFG` 完全一致：

```text
TREE.Elements[0] = Fire
TREE.Elements[1] = Hydro
TREE.Elements[2] = Anemo
TREE.Elements[3] = Electro
TREE.Elements[4] = Dendro
TREE.Elements[5] = Cryo
TREE.Elements[6] = Geo
```

如果逐元素锁定状态采用列表保存，则同样使用长度为 7 的布尔列表并保持完全相同的索引顺序：

```text
TREE.Locks : bool[7]
```

不属于七元素向量的数据，例如上次元素结算时间戳，继续使用独立标量字段。

## 七元素向量的通用约定

后续实现中，只要数据语义是“一组完整的七元素值”，默认都遵循本文件约定：

- 长度固定为 7；
- 顺序固定为 Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo；
- 使用同一个元素索引访问不同配置和运行态数据；
- 不为七种元素复制七套独立字段；
- 不在局部节点图中自行改变元素顺序。

这包括后续的器官元素快照、水瓜汁元素组成等七元素向量。具体字段是否在当前阶段实现，仍以 README 的开发顺序和对应设计文档为准。

## 节点图实现原则

涉及七元素的批量逻辑优先按照固定索引处理：

```text
i = 0..6

TREE.Elements[i]
CFG.Affinity[i]
CFG.Stem[i]
CFG.Leaf[i]
CFG.Fruit[i]
```

同一个索引在整条数据链中始终表示同一个元素。这样可以让元素输入、衰减、器官快照、显色、口味和料理混合共享统一的数据布局，避免节点图中出现七套重复且容易错位的变量命名。
