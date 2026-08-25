# World Protocol

## Overview

World Protocol 是客户端与 World Server 之间的边界。

客户端不直接访问 Gameplay Plugin、Cordis Service、Component Store 或世界存储，只通过协议读取世界状态并提交操作请求。

协议主要包含两类数据：

- Command：客户端请求世界执行操作
- State / Event：服务端返回状态变化和世界事件

## Data flow

```mermaid
sequenceDiagram
    participant C as Client
    participant G as World Gateway
    participant K as World Kernel
    participant S as World Systems
    participant P as Persistence

    C->>G: Command
    G->>K: Submit Command
    K->>S: Run World Step
    S-->>K: Change Set
    K->>K: Apply Changes
    K->>P: Persist
    K-->>G: State Patch / Event
    G-->>C: State Patch / Event
```

一次操作的基本过程是：

1. 客户端发送 Command。
2. World Gateway 将 Command 提交给 World Kernel。
3. World Scheduler 执行相关 System。
4. System 产生 Change Set。
5. World Kernel 统一应用并持久化状态变化。
6. World Server 将 State Patch 或 Event 发送给客户端。

客户端不需要知道具体 System 如何计算结果。

## Transport

MVP 可以使用：

- HTTP：连接、初始数据和普通查询
- WebSocket：持续的 Command、Event 和状态更新

具体消息格式和版本策略后续单独定义。

## Client boundary

Godot、Web 和其他客户端共享同一套 World Protocol。

客户端可以有不同的交互方式和表现形式，但不能各自实现独立的世界规则。任何会改变权威世界状态的行为都必须经过 World Server。
