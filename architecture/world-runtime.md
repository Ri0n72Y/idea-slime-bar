# World Runtime

## Overview

World Server 是一个由 Cordis 驱动的活动存档与世界状态服务。

它不承担 Godot 的场景、物理和逐帧游戏运行，而是保存需要持久化、跨客户端共享或在客户端关闭后继续存在的世界状态。

一个世界对应：

- 一个 World Server 进程
- 一个 Cordis Context
- 一份独立的世界存档
- 一份该世界使用的 Content Package 列表

## Responsibilities

World Server 主要提供：

- Persistent World State
- Entity / Component Store
- Content Registry
- World Clock
- Scheduler
- Persistence
- Client Sync
- Gameplay Plugin 所需的共享 Service

Gameplay Plugin 可以直接处理世界操作，也可以注册需要批量或按时间运行的 System。

## Single-player

单机模式下，打开世界等同于启动一个本地 World Server，再由 Godot 连接该服务。

```mermaid
flowchart LR
    Open[Open World]
    Start[Start Local World Server]
    Packages[Load Content Packages]
    Save[Load World Save]
    Ready[World Ready]
    Godot[Start Godot Client]
    Connect[Connect localhost]

    Open --> Start
    Start --> Packages
    Packages --> Save
    Save --> Ready
    Ready --> Godot
    Godot --> Connect
```

远程世界使用同一运行模型，只改变 World Server 的连接地址。

## Time and scheduled work

World Clock 维护需要由世界服务理解的时间。Scheduler 负责需要在未来重新计算或完成的长期任务。

典型内容包括：

- 植物生长
- 加工进度
- 自动化生产
- 需要脱离当前 Godot 场景继续推进的状态

这些过程可以根据经过的世界时间直接计算，不要求 World Server 以固定高频 tick 模拟整个游戏。

具体计算方式见 [World Simulation](./simulation-model.md)。

## Persistence

World Server 持有权威存档。

只有进入 World Model 的状态才需要持久化。Godot 的动画帧、velocity、碰撞接触和其他瞬时运行状态不属于世界存档。

世界操作或服务器 System 修改持久状态后，由统一的存储层保存，并将相关变化同步给已连接客户端。

MVP 可以使用本地 SQLite 和资源目录。Gameplay Plugin 不直接依赖具体数据库实现。

## Content loading

World Server 启动时根据世界的 Content Package 列表加载内容定义和可选的服务端扩展，再加载引用这些内容的世界存档。

存档不应依赖当前程序中硬编码的植物或角色列表，而应通过稳定的 Content ID 引用已加载内容。
