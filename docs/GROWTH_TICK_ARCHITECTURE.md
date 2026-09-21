# Growth Tick Architecture

## Overview

本文记录水瓜厨房植物生长系统当前确定的运行时架构约定。

目标：在千星奇域节点图环境中，实现可扩展的植物生长系统，同时保持节点图职责单一、减少公共状态传递。

## 核心原则

- 实体变量保存长期状态。
- 节点连线传递短期计算结果。
- 复杂数学公式独立编写为节点图，并手动打包为复合节点。
- 业务流程节点图负责调用复合节点和更新实体状态。
- 避免为了节点图拆分而制造大量临时公共变量。

## 器官模型

当前 MVP 只考虑两个器官：

```
Soil
 |
 v
AquamelonTree
```

后续扩展：

```
Tree
 ├─ Leaf
 ├─ Flower
 └─ Fruit
```

养分流方向遵循消费者主动获取原则：

```
Leaf -> Tree
Flower -> Leaf
Tree -> Soil
```

来源器官只保存资源，不负责管理消费者。

## Growth Tick 流程

Growth Tick 由关卡统一触发。

当前设计：

```
WORLD_GROWTH_TICK
        |
        v
Soil Update
        |
        v
Tree Growth Update
        |
        v
Future Child Organ Update
```

事件/信号主要负责控制流程，不负责传递业务数据。

## Soil

Soil 是资源容器。

负责：

- 保存元素向量
- 元素容量归一化
- 元素蒸发

不负责：

- 判断植物需求
- 主动分配养分
- 管理消费者列表

## Tree Growth Update

Tree 主动读取 Soil 状态。

流程：

```
读取 Soil_Elems
        |
        v
Calculate Absorption (Composite Node)
        |
        v
扣除 Soil 元素
增加 Tree 元素储备
        |
        v
Convert Nutrient To Growth (Composite Node)
        |
        v
更新 Growth / Stage / Affinity
```

## 复合节点规范

复杂公式不直接堆在主流程节点图中。

例如：

### Calculate Absorption

输入：

- Soil_Elems
- Tree_Affinity
- Tree_AbsorbLimit

输出：

- AbsorbElems

### Convert Nutrient To Growth

输入：

- Tree_Elems
- Tree_Affinity

输出：

- GrowthVector
- GrowthValue

主流程节点图只调用这些复合节点。

## 状态边界

持久状态示例：

```
SOIL_Elems[7]

TREE_Elems[7]
TREE_Growth[7]
TREE_Stage
TREE_Affinity[7]
```

不建议保存：

```
TemporaryAbsorbResult
TemporaryGrowthConversion
TemporaryRatio
```

这些属于单次 Tick 的局部计算，应通过节点连接传递。

## 设计理由

代码中常见：

```ts
 tree.growth(soil)
```

节点图环境无法自然表达对象递归调用，因此采用：

- 事件驱动流程
- 消费者主动读取来源
- 复合节点封装复杂计算

避免构造大量中间实体和通信变量。
