# World Model

## Overview

World Model 定义 World Server 中的权威游戏世界如何表示。

世界采用轻量的 Entity + Component 模型。Entity 提供稳定标识，Component 保存具有世界语义的状态，System 读取和修改这些状态。

Godot Scene Tree 是对当前世界的客户端投影，不是 Server World Model 的替代品，也不要求与 Server Entity 一一对应。

## Entity

Entity 表示世界中的一个可识别对象。

例如：

- 玩家 Character
- 一株水瓜
- 一个掉落物
- 一台加工设备
- 一个 Guest
- 一套餐具

Entity 本身不承担完整游戏行为。不同 Entity 通过组合 Component 表达状态，并通过 Content ID 引用对应内容定义。

同一种内容可以对应多个 Entity。例如多株水瓜都引用同一个 `plant.aquamelon` 内容定义，但拥有各自独立的位置、生长和水分状态。

## Component

Component 保存 Server 需要运行、持久化或同步的世界状态。

例如：

- Transform：具有世界意义的位置
- Character：角色身份与内容引用
- Inventory：库存
- Growth：植物生长状态
- Hydration：水分状态
- Processing：加工状态
- GuestState：客人当前状态
- Item：物品状态

Component 以数据为主，不要求通过对象方法承担行为。跨 Entity 或跨 Component 的游戏计算由 System 聚合处理。

## Client-only state

并不是 Godot 中的所有状态都需要成为 Server Component。

以下内容通常只属于客户端表现：

- animation frame
- particle state
- camera state
- hover / selection
- 临时 UI 状态
- 插值状态
- 仅用于视觉效果的节点

Server World Model 只保存游戏世界真正需要知道的状态。

## Component Store

Component Store 保存 Server Entity 与 Component，并向 Gameplay System 提供查询和修改能力。

System 可以按照 Component 组合查询需要处理的一组 Entity。例如 Growth System 可以查询所有拥有 Growth Component 的植物，Movement / Transform 相关 System 可以处理需要同步的 Character。

具体索引、存储布局和查询优化由实现阶段决定，不要求引入完整 ECS 框架。

## Content reference

Entity 的实例状态与内容定义分离。

Entity 通过稳定 Content ID 引用 Content Registry，例如：

```text
plant.aquamelon
character.slime
item.aquamelon
```

Content Definition 描述该内容的静态规则和默认数据；Component 保存当前世界中具体实例的动态状态。

这种分离允许 Content Package 增加新的植物、Character、物品和其他内容，而不要求修改 World Server Core。

## Authority

World Server 中的世界状态是权威状态。

Godot 可以为操作响应进行本地预测、插值和即时表现，但需要根据 Server 同步结果更新客户端世界。

对于移动等实时交互，Server 不需要逐帧复制 Godot 内部物理状态，但需要维护足以表示权威世界位置和交互结果的状态。

## Replication

并非所有 Component 都必须以相同方式同步。

有些状态需要频繁同步，例如 Character Transform；有些状态只在变化时同步，例如 Inventory；有些主要用于 Server 内部计算，只需要向客户端投影结果。

具体复制策略属于 World Protocol 和后续实现规格，不在本架构中固定。
