# World Model

## Overview

World Model 定义世界状态如何表示。

世界采用轻量的 Entity + Component 模型。Entity 只提供稳定标识，Component 保存世界状态。行为和计算不放在 Entity 或 Component 中，而由 System 统一处理。

## Entity

Entity 是世界中的一个具体对象，本身不承载游戏行为。

一株水瓜、一台机器和玩家都可以是 Entity。不同 Entity 通过组合不同 Component 获得自己的状态结构。

同一种内容可以对应多个 Entity。例如两株水瓜引用同一个水瓜内容定义，但各自拥有独立的生长、水分和位置状态。

## Component

Component 是附着在 Entity 上的纯状态数据。

例如：

- Transform：位置和空间信息
- Growth：生长阶段和进度
- Hydration：水分状态
- Inventory：库存状态
- Rooting：根系和入土状态

Component 不实现 `update()`、`grow()` 或其他对象行为。

不同 Entity 可以自由组合需要的 Component，不要求继承统一的对象层级，也不要求引入完整 ECS 框架。

## Component Store

Component Store 保存 Entity 与 Component，并为 System 提供查询能力。

System 根据所需 Component 查询一组 Entity，再对这一组状态进行聚合计算。例如 Growth System 可以查询同时拥有植物内容和 Growth Component 的 Entity。

具体索引、存储布局和查询实现后续按开发需要确定。

## Content reference

Entity 的运行时状态与内容定义分离。

Entity 可以通过稳定的内容标识引用 Content Registry 中的植物、物品或其他定义。Content Definition 描述静态内容，Component 保存具体世界实例的可变状态。

## Authority

World Server 中的 Component 状态是权威状态。

客户端只接收 Snapshot、State Patch 或 Event 用于表现和交互，不能直接覆盖服务端 Component。

System 的执行和 Component 的变更规则见 [Simulation Model](./simulation-model.md)。
