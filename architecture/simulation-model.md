# Simulation Model

## Overview

World Server 使用 Component + System 的方式执行权威世界计算。

Entity 和 Component 描述世界当前状态，System 负责读取一组 Component、执行规则并修改世界状态。世界计算以 System 为主要单位聚合处理，而不是让每个 Entity 自己拥有独立的 `update()`。

Godot 负责客户端表现和客户端侧物理，但不会取代 Server 对世界规则和权威状态的计算。

## System

System 是 Server 世界计算的基本单位。

一个 System 可以：

- 查询具有特定 Component 的 Entity
- 读取或修改这些 Component
- 创建或删除 Entity
- 产生普通 Gameplay Event
- 根据世界时间或玩家操作推进状态

例如：

- Growth System 处理植物生长
- Hydration System 处理植物水分状态
- Processing System 处理加工进度
- Guest System 处理客人世界状态
- Transform / Movement 相关 System 处理需要 Server 维护的位置状态
- Automation System 处理自动化生产

Gameplay Plugin 可以注册一个或多个 System。

## Aggregation

System-first 的主要目的，是让同类计算集中在一起。

例如 Growth System 查询所有需要更新的 Growth Component，再根据世界时间统一计算；而不是让每株植物拥有自己的计时器和 `grow()` 循环。

这并不要求每次运行 System 都扫描全部 Entity。实现可以根据 Component 索引、变化集合、空间区域或计划时间只处理相关对象。

具体优化策略不属于当前架构约束。

## Update cadence

World Server 会持续推进世界，但不要求所有 System 使用同一种更新频率。

### Frequent systems

对需要较及时同步的状态，可以采用较高频率执行，例如：

- Character Transform
- 与附近交互有关的空间状态
- 其他需要快速同步给多个客户端的状态

其执行频率不需要等同于 Godot 的渲染帧率。

### Time-driven systems

长时间过程主要按照 World Time 或 Scheduler 计算，例如：

- Growth
- Processing
- fermentation
- Guest waiting
- Automation

这类 System 可以直接使用时间差结算状态，而不需要在没有变化时持续高频空转。

### Event-driven systems

玩家操作或其他世界事件可以触发对应计算，例如：

- Plant
- Water
- Harvest
- Start Processing
- Serve
- Clean
- Pickup

这些行为仍然作用于 Server World Model，并由对应 Gameplay 规则验证和执行。

## Schedule

World Server 可以维护不同用途的 System Schedule，而不要求把所有游戏逻辑放进一个固定的大型 Phase Graph。

例如可以存在：

- frequent update schedule
- world-time schedule
- scheduled task processing
- action / event processing

同一 Schedule 内部可以根据需要声明 System 的先后关系。

Cordis dependency graph 只描述模块和 Service 的依赖关系，不用于代替 System 的执行顺序。

## World time

World Time 是长期世界过程的共同时间基准。

例如植物从 10:00 生长到 14:00，Growth System 可以直接根据经过时间计算当前阶段，而不需要执行大量逐秒 tick。

客户端可以显示并预测时间表现，但权威世界时间来自 World Server。

## State changes

System 最终修改的是 Server World Model。

实现可以直接通过受控的 Component Store API 修改状态，也可以内部使用 Change Set、Command Buffer 或其他批量提交机制。架构不强制所有 Gameplay System 必须围绕某一种提交抽象实现。

无论采用哪种实现方式，持久化和客户端同步都基于 Server 已确认的世界状态。

## Events

Gameplay Event 是 System 和插件之间的一种普通解耦机制，本质上可以由 Cordis Event Bus 或相近机制承载。

例如种植、加工完成、服务完成或清理完成可以发出事件，临时的 MVP Score Plugin 可以监听这些事件并增加分数。

Event 不是独立于 Component + System 的另一套世界模型，也不要求所有状态变化都转化为 Event。

## Cordis boundary

Cordis 负责：

- Gameplay Plugin 的加载和卸载
- Service 与模块依赖
- System、Component 和内容扩展的注册生命周期

Server Simulation 负责：

- 权威世界状态
- System 执行
- World Time
- 不同 cadence 的世界更新
- Gameplay Rule 的计算

Cordis 的模块生命周期与游戏世界的 System 更新是两套不同层次的机制。
