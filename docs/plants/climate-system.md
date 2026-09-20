# 气候系统（占位）

本文件为未来气候 / 环境反馈系统预留接口。

当前版本**不实现气候模拟**。

植物养分—生长系统中，某些器官会把一部分养分明确标记为：

```text
EnvironmentLoss
```

例如成叶可能把部分养分通过蒸腾、挥发或元素逸散释放到环境中。

当前处理：

```text
EnvironmentLoss
→ 直接视为损耗
```

未来可以改为：

```text
EnvironmentLoss
→ Local Climate / Environment Reservoir
→ 影响湿度、温度、元素环境、其他植物或事件
```

在气候系统正式设计前，不为这些环境量增加额外玩法规则。
