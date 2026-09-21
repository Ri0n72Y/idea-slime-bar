# Growth Tick

Growth Tick 是植物养分—生长系统的一次**离散结算事件**，不是植物世界中的固定自然时间单位。

植物真正的生长规律尽量使用“单位时间速率 + 实际经过时间 `dt`”描述；在线 Growth Tick 只是定期采样并结算这段时间内应该发生的变化。

因此：

```text
自然规律：
RatePerHour + dt

在线：
按 GrowthUpdateInterval 周期调用一次 Growth Tick

离线：
直接根据真实离线 dt 结算，或按离散事件边界分段结算
```

这样可以在不重新平衡数值的情况下，把在线更新频率从 15 分钟调整为 1 分钟、30 秒或其他值。

## 时间模型

一次 Growth Tick 至少接收：

```text
dtSeconds
```

并统一转换：

```text
dtHours = dtSeconds / 3600
```

所有“每小时”参数根据 `dtHours` 计算本次变化。

### 线性速率

适合吸收上限、固定生成速率等：

```text
AmountThisUpdate
=
RatePerHour × dtHours
```

例如：

```text
MaxAbsorbPerHour = 12
dt = 5 min

MaxAbsorbThisUpdate
= 12 × 5 / 60
= 1
```

### 比例衰减 / 比例消耗

对“每小时损失当前量的 X%”这类规则，不应简单把 `X%` 乘以 Tick 次数，而应使用连续时间等价形式。

例如每小时保留 99%：

```text
RetentionPerHour = 0.99

New
=
Old × RetentionPerHour ^ dtHours
```

对应本次消耗：

```text
Consumed
=
Old × (1 - RetentionPerHour ^ dtHours)
```

这样无论在线每 60 秒、30 秒还是 15 分钟更新，跑满一小时后的理论结果一致。

## 在线更新频率

具体植物可以配置：

```text
GrowthUpdateIntervalSeconds
```

它只决定“在线多久结算一次”，不直接决定植物的实际生长速度。

例如：

| 更新间隔 | 每小时调用次数 | 相对 15 分钟一次 |
| ---: | ---: | ---: |
| 15 min | 4 | 1× |
| 1 min | 60 | 15× |
| 30 sec | 120 | 30× |
| 1 sec | 3600 | 900× |

对于慢节奏植物玩法，1 秒更新通常没有必要。较短的在线更新周期主要用于提高反馈连续性，而不是改变成长总量。

## 总览

```mermaid
flowchart TD
    A[Growth Tick(dt)]
    --> B[1. 从来源获取养分]
    --> C[2. 更新内部 Reserve]
    --> D[3. 判断是否允许生长代谢]
    --> E[4. 决定本次时间段的生长养分预算]
    --> F[5. 优先向子器官分配]
    --> G[6. 子器官吸收 / 损耗 / 生长]
    --> H[7. 父器官处理剩余预算]
    --> I[8. 按 Growth Affinity 转为 Growth Vector]
    --> J[9. 连续学习 Effective Affinity]
    --> K[10. 检查 Stage / 生成器官]
```

## 1. 从来源获取养分

器官先读取其来源。

来源可以是：

- 土壤；
- 植株内部储备；
- 茎；
- 叶；
- 其他上级器官。

根据当前 Stage 获取单位时间吸收能力：

```text
MaxAbsorbPerHour(stage)
```

当前结算周期的最大吸收量：

```text
MaxAbsorbThisUpdate
=
MaxAbsorbPerHour(stage) × dtHours
```

对每种养分，提取亲和限制为：

```text
ExtractionAffinity[i] = min(Affinity[i], 1)
```

因此高于 1 的 Affinity 不会让器官从来源中提取超过实际供给的养分。

## 2. 更新内部 Reserve

如果器官拥有内部储备：

```text
Reserve[i] += Absorbed[i]
Source[i]  -= Absorbed[i]
```

如果器官没有内部储备，则本次结算吸收到的养分直接成为本次可用养分，不跨结算保存。

例如：

- 植株通常拥有内部 Reserve；
- 叶片可以采用无 Reserve 模式，从茎 / 树体吸多少就处理多少；
- 花也可以采用无 Reserve 模式；
- 果实可以拥有独立的汁液 / 内容物累积状态。

## 3. 判断是否允许生长代谢

某些器官可能因为内部储备过低、休眠、未激活或其他状态而暂停把养分转换成 Growth。

暂停生长不必等同于暂停吸收。

因此可以存在：

```text
仍在吸收
但不进行 Growth Conversion
```

的恢复阶段。

## 4. 决定本次时间段的生长养分预算

拥有 Reserve 的器官，从 Reserve 中决定本次时间段用于生长的养分。

如果规则是“每小时消耗当前 Reserve 的 1%”，则定义：

```text
GrowthRetentionPerHour = 0.99
```

本次实际消耗：

```text
Consumed[i]
=
Reserve[i] × (1 - GrowthRetentionPerHour ^ dtHours)
```

这样不会因为在线 Tick 频率改变而改变总消耗速度。

无 Reserve 器官则直接把本次获得的可用养分作为其生长预算。

## 5. 优先向子器官分配

父器官先把生长预算的一部分分配给当前正在生长的子器官。

例如：

```text
ParentBudget
├── Child A Allocation
├── Child B Allocation
└── Parent Remainder
```

分配比例可以由：

- 子器官数量；
- 子器官 Stage；
- 固定权重；
- 亲和；
- 其他具体作物规则

决定。

## 6. 子器官处理自己的份额

子器官依次处理：

1. 按 Extraction Affinity 接受自己真正能吸收的部分；
2. 不能吸收的部分按照具体规则退回父器官预算；
3. 对实际吸收的养分应用该 Stage 的环境损耗；
4. 剩余养分按照完整 Growth Affinity 转换成自身 Growth Vector；
5. 更新自己的连续学习状态；
6. 检查自己的 Stage。

## 7. 父器官处理剩余预算

子器官处理后：

```text
ParentRemaining
=
原始生长预算
- 子器官实际拿走并使用的养分
- 明确进入环境的损耗
```

没有被子器官吸收的部分，如果规则没有指定损耗，则继续回到父器官本次的生长预算。

系统不设置统一的隐藏“转换损耗”。

## 8. 转换为 Growth Vector

父器官对每种剩余养分进行：

```text
GrowthGain[i]
=
GrowthNutrient[i] × FullAffinity[i]
```

这里使用完整 Affinity，不限制为 1。

因此：

```text
1 nutrient × 1.3 affinity
→ 1.3 growth
```

Growth Vector 累积：

```text
Growth[i] += GrowthGain[i]
```

## 9. 连续学习

未定型 Stage 根据当前内部养分组成 / Growth 组成持续更新 Effective Affinity。

本系统只规定：

- 学习是连续的；
- 高占比养分会提高对应 Effective Affinity；
- 不产生离散阶段奖励；
- 学习速度同样应尽量使用单位时间参数，避免受在线更新频率影响；
- 具体函数由植物 Spec 决定。

## 10. Stage 与器官生成

结算末检查当前 Stage 的成长条件。

若满足：

```text
Stage -> NextStage
Growth = zero vector
BaseAffinity = current EffectiveAffinity
```

如果当前已经是不会继续升级的成熟植物 Stage，则可以改为检查器官生成条件：

```text
GrowthTotal >= OrganSpawnCost
→ Spawn Organ
→ 扣除对应 Growth
```

植物 Stage 本身不会因为扣除 Growth 而回退。

## 在线调度与真实 dt

在线调度器可以按固定间隔请求 Growth Tick，但 Tick 应尽量读取真实经过时间：

```text
dt
=
Now - LastGrowthUpdateAt
```

例如配置为每 60 秒更新一次，但服务器实际在 73 秒后才触发，则本次应按约 73 秒结算，而不是假装只过去 60 秒。

这可以降低节点图 Timer 不精确导致的长期漂移。

## Debug 强制下一 Tick

调试界面可以提供：

```text
Advance One Growth Tick
```

用于**立即执行下一次 Growth Tick**，无需等待在线调度器。

为了让该操作具备稳定的测试意义，Debug 强制 Tick 使用配置的标准在线间隔：

```text
dtSeconds = GrowthUpdateIntervalSeconds
```

而不是使用按钮点击时距上一次真实结算只过去的几秒钟。

它属于开发期时间推进能力，会人为让植物向前模拟一个标准更新步长，不属于正式玩家玩法。

## 离线结算

离线结算不应简单模拟成成千上万个在线 Tick。

重新进入世界时：

```text
OfflineDt
=
Now - LastGrowthUpdateAt
```

对于具有闭式解的连续过程，例如：

- 比例蒸发；
- 比例消耗；
- 固定速率发芽 / Growth；

直接使用真实 `OfflineDt` 计算。

对于会跨越离散边界的过程，例如：

- Stage 升级；
- 生成子器官；
- 花 → 果；
- 成熟；

可以按“计算到下一个事件边界 → 应用事件 → 继续处理剩余时间”的方式分段结算，而不是逐分钟重放。

具体离线跨事件算法由对应玩法 Spec 决定。

## 与气候的接口

任何明确标记为：

```text
EnvironmentLoss
```

的养分，未来都可以被气候系统消费，例如影响局部湿度、元素环境或其他生态状态。

在气候系统未实现前：

```text
EnvironmentLoss
→ 直接丢弃
```

接口说明见 [气候系统占位](climate-system.md)。
