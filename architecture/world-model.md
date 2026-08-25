# World Model

## Overview

World Model 只描述需要由 World Server 保存或跨客户端共享的世界状态。

Godot 的完整 Scene Tree 和运行时状态不会复制到 World Server。进入 World Model 的对象采用轻量的 Entity + Component 组织方式，便于不同 Gameplay Plugin 查询、修改和扩展。

## Entity

Entity 是世界状态中的稳定对象标识。

植物、库存中的物品、加工任务、客人、餐具以及玩家的持久状态都可以由 Entity 表示。一个 Godot Node 不要求对应一个 Entity，反过来也不要求每个 Entity 在当前场景中拥有 Node。

Entity 本身不承载对象行为。

## Component

Component 是附着在 Entity 上的持久或共享状态数据。

例如：

- ContentRef：引用稳定的 Content ID
- PersistentTransform：需要保存的场景与位置
- Inventory：库存状态
- Growth：植物生长状态
- ProcessingJob：加工任务状态
- GuestState：客人的世界状态
- Reward：可拾取报酬

Component 以数据为主，不实现逐对象 `update()`。

不同 Entity 可以组合不同 Component，不要求继承统一对象层级，也不要求引入完整 ECS 框架。

## Client-only state

以下状态通常不进入 World Model：

- velocity
- animation frame
- physics contact
- navigation path
- camera state
- hover / selection
- temporary UI state

这些由 Godot Client 自行维护。

## Component Store

Component Store 保存 Entity 与 Component，并提供查询和修改能力。

Gameplay Plugin 可以直接通过世界 Service 修改明确的状态，也可以由 System 查询一组 Component 后进行批量计算。Component + System 是组织服务器世界计算的主要思想，但不是要求所有交互都经过同一种调度方式。

## Content reference

运行时状态与内容定义分离。

Entity 通过稳定的 Content ID 引用 Content Registry。例如两株水瓜都引用同一个 `plant.aquamelon` 定义，但拥有各自独立的 Growth、位置和库存关系。

Content Definition 保存静态配置和表现资源引用，Component 保存具体世界实例的可变状态。

## Authority

World Server 对进入 World Model 的状态负责，并以这些状态作为持久化和多客户端同步的依据。

Godot 对其本地逐帧运行状态负责。客户端只在需要保存或改变共享世界时与 World Server 同步，不要求服务器成为 Godot 物理世界的逐帧权威副本。
