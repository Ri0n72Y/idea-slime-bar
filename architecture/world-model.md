# World Model

## Overview

World Model 定义世界状态如何表示。

世界中的植物、玩家、物品、容器和其他对象都作为 Entity 保存。Entity Store 持有这些实体及其可变状态，Gameplay Plugin 通过 World Services 读取和修改它们。

## Entity

Entity 是世界中的一个具体对象，至少需要稳定的标识和内容类型。

例如，一株水瓜和另一株水瓜是两个不同的 Entity，但都可以引用同一个水瓜内容定义。

Entity 保存运行时状态，不负责定义完整的游戏规则。

## Components

世界模型采用轻量的 Entity + Component 组织方式。

不同对象可以组合自己需要的状态，而不是把所有植物、物品和角色字段塞进一个统一的大型结构。

例如植物可以组合位置、生长、含水状态和其他组件；玩家可以组合位置、库存、史莱姆身体和能力相关组件。

具体 Component 类型随系统实现逐步定义，不要求引入完整 ECS 框架。

## Entity Store

Entity Store 提供世界实体的统一读取、创建、修改和删除能力。

Gameplay Plugin 负责解释这些状态的含义。例如 Farming 负责植物生长规则，但植物实体本身仍由 Entity Store 管理。

## Authority

Entity Store 中的服务端状态是权威状态。

客户端收到的是 Snapshot、State Patch 或 Event，用于表现和交互，不能直接覆盖服务端实体。

## Persistence

Entity 的持久化通过 World Runtime 提供的存储能力完成。

具体数据库表、序列化格式和迁移策略后续单独定义。
