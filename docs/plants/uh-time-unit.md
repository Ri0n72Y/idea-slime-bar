# uh：统一模型时间单位

`uh` = **unit hour（等效小时）**，是水瓜厨房与千星奇域共享数值模型中唯一的时间量纲。养分流量、Growth 生成速度、元素衰减和生命周期校准都按 **V/uh** 或 **Growth/uh** 描述，不按一次结算事件描述。

**旧的 `dtTick`、`dtHours`、`per Tick`、`RatePerHour` 和「游戏小时」计算口径已被本规范替代。** 代码中尚未迁移的字段名不是新的规范，不能再被引用为设计事实。所有旧式按结算次数乘固定数值的速率，在移植前必须换算到每 uh 的速率；既有数据若来源于不同旧参数，不得自动声明数值等价。

## 同一模型，不同时间映射

| 平台或精度 | 1 uh 对应现实时间 | 一次结算推进的 uh |
| --- | --- | --- |
| 千星奇域，每整小时结算 | 3600 秒 | 1 |
| 千星奇域，每 5 分钟结算 | 3600 秒 | 1/12 |
| 千星奇域，每分钟结算 | 3600 秒 | 1/60 |
| Web 默认 | **10 秒**（可调） | 每 10 秒结算时为 1 |
| Web 每秒连续结算 | **10 秒**（可调） | 默认 0.1 |

Web 只是压缩同一模型的实际耗时，不存在另一套专属吸收、Growth、Affinity 或生命周期数值。调快 Web 时间不会增加一个 uh 内能产生的养分量。结算 Tick 是技术事件，不是速率单位。场景如果暂停、恢复或离线回放，累计的 `Δuh` 仍依同一个模型结算。

## 结算合同

- 设 `Δuh = elapsedSeconds / realSecondsPerUH`，其中千星 `realSecondsPerUH=3600`，Web 默认 `10`。
- **速率线性上限**：`MaxAbsorbThisStep = MaxRootAbsorbVPerUH × Δuh`。实际七元素吸收另受 Soil 存量、RootPreference、单元素 Affinity 通道上限约束。
- **土壤自然蒸发**：`Soil[i] *= SoilRetentionPerUH ** Δuh`，当前校准保留率为 `0.998/uh`；土壤容量1000V、超量按七元素比例压缩。
- **树体生长预算**：根系吸收进入 `TreeReserve[7]`，由当前 `Reserve[7]` 和 Tree Affinity 动态形成本次 `GrowthNutrientBudget[7]`。其具体系数与每元素实际取用上限**尚在校准**；不可把土壤自然蒸发系数借用作树体代谢。
- **分流**：每片叶优先取本次树预算中的既定份额；叶片未实际用到的部分交还树的当次预算；每片叶的花/果只在本叶所得预算内继续分流，不影响其他叶；剩余预算用于 Tree Growth 或活跃 Bud Growth。
- **离散事件**：按对应 Growth 门槛、已经确认的事件条件触发。将结算间隔细分不能让随机判定重复获得额外机会；出芽检查频率及由原每日概率换算连续风险的方案需另行确认。
- **元素球**：仅由玩家主动「富集」生成，单球随机纯元素初始**期望值80 V**（具体上下限待定），半衰期 **0.25 uh**，`BALL_Elems[i] *= 0.5 ** (Δuh / 0.25)`，剩余七元素总量 **<1 V** 则销毁。15分钟对应的是千星1 uh=现实1小时的时间基准；Web加速后仍以0.25 uh衰减，不沿用15分钟现实等待。
- **高精度**：分数 `Δuh` 小步计算时，容量压缩、活性边界、吸收竞争和 Growth 阶段跨越的顺序可能影响结果；不得只替换参数名就宣称整步与细步等价。

## 器官成长数值

| 成长边界 | 累计 Growth 阈值 |
| --- | ---: |
| Seed → Seedling | 连续TreeGrowth总量45 |
| Seedling → Sapling | 连续TreeGrowth总量90，逐元素1G→1V初始Reserve |
| Bud → 嫩叶 | 20 |
| 嫩叶 → 肥厚叶（叶自身成长轴） | 26 |
| 肥厚叶 + 花苞同步出生 | SmallLeaf自身26G达到即发生，不另需18G |
| 花苞 → 开花（生殖成长轴） | 累计**12** |
| 开花 → 青果（同一生殖成长轴） | 40 |
| 青果 → 成熟水瓜（同一生殖成长轴） | 90 |

Seed与Seedling共用连续TreeGrowth（累计45→90），Seedling时不清零；进入Sapling时按七元素逐维**1Growth=1V Reserve**，并把Sapling TreeGrowth置零，首次Bud同步生成、不要求先达到80V才能Growing。**SmallLeaf本叶26G**时固化亲和且只清零本叶阶段Growth，LargeLeaf与FlowerBud同时出现；生殖Growth[7]独立从0开始，**累计12G开花、40G青果、90G成熟**，开花与结果两次固化Affinity但不清零Growth；结果后才另记FruitElementAmount[7]。花期具体时长取决于实际Growth/uh，不是固定等待；采果后的再次开花仍需校准。每片叶固定Tree预算30%，花苞/花/青果统一取母叶预算**80%**。

## 玩家供给与目标

同一套 V/uh 模型面对不同的玩家上线频率，**唯一预期变化是 Soil[7] 的真实供给历史**。体验校准参考：积极玩家第2/3/4/5次上线（24/48/72/96uh）分别看见Seedling/SmallLeaf/Flower/可采成熟水瓜；每周首次168 uh回访时亦应有成熟水瓜并接近休眠；稳定期每日维护约每168 uh有4–6果、间歇维护2–4果、每周维护约2果。这是目标，不是已实现的产量承诺。

根系上限按Seed/Seedling/Sapling阶段分别校准、各平台同一套数值。Reserve容量180V，达到100V后Growth Budget保持满速，低于100V按储备充盈度递减；根系在100–180V区间按ln下降。**Tree Affinity>1可以真实增加提取预算总额**，不额外归一化削弱这一收益。土壤容量1000V和固定比例自然蒸发仍需与不同上线习惯联合校准；详见[第一周期望值复算](../../mvp/aquamelon-kitchen/first-fruit-uh-calibration.md)。

权威详细规则：[水瓜生长系统](../../mvp/aquamelon-kitchen/growth-system.md)、[数值基线](../../mvp/aquamelon-kitchen/growth-balance-baseline.md)。
