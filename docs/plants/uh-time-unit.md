# uh：统一模型时间单位

`uh` = **unit hour（等效小时）**，是水瓜厨房与千星奇域共享数值模型中唯一的时间量纲。养分流量、Growth 生成速度、元素衰减和生命周期校准都按 **V/uh** 或 **Growth/uh** 描述，不按一次结算事件描述。

全部养分与 Growth 速率用 V/uh、G/uh 表示；一次 Tick 只负责推进真实 `Δuh`，不能把每次执行都算成一个完整 uh。

## 同一模型，不同时间映射

| 平台或精度 | 1 uh 对应现实时间 | 一次结算推进的 uh |
| --- | --- | --- |
| 千星奇域正式多人方案，每整小时结算 | 3600 秒 | 1 |
| 千星奇域2D Lua单机参赛Demo | **10 秒** | 每10秒推进1（可细分） |
| 千星奇域，每 5 分钟结算 | 3600 秒 | 1/12 |
| 千星奇域，每分钟结算 | 3600 秒 | 1/60 |
| Web 默认 | **10 秒**（可调） | 每 10 秒结算时为 1 |
| Web 每秒连续结算 | **10 秒**（可调） | 默认 0.1 |

Web 只是压缩同一模型的实际耗时，不存在另一套专属吸收、Growth、Affinity 或生命周期数值。调快 Web 时间不会增加一个 uh 内能产生的养分量。结算 Tick 是技术事件，不是速率单位。场景如果暂停、恢复或离线回放，累计的 `Δuh` 仍依同一个模型结算。

## 结算合同

- 设 `Δuh = elapsedSeconds / realSecondsPerUH`，其中千星正式多人方案`realSecondsPerUH=3600`，Web与千星本地2D单机参赛Demo为`10`。
- **速率线性上限**：`MaxAbsorbThisStep = MaxRootAbsorbVPerUH × Δuh`。实际七元素吸收另受 Soil 存量、RootPreference、单元素 Affinity 通道上限约束。
- **土壤自然蒸发**：`Soil[i] *= SoilRetentionPerUH ** Δuh`，当前校准保留率为 `0.99/uh`；土壤容量1000V、超量按七元素比例压缩。
- **树体生长预算**：根系吸收进入 `TreeReserve[7]`；M=95/W=12归一化S曲线与B0=5.4V/uh计算 `B_ref`，七元素基准份额各为 `B_ref/7`，分别按当前 Tree EffectiveAffinity 调整并以对应 Reserve 限额得到 `BudgetV[i]`。不做七维总额归一化或跨元素缺额重分配。预算仍为 V，未用预算不扣费；实际生长及环境逸散的 V 从 Reserve 统一扣一次。
- **分流与转换**：每片叶取得预算中可使用的 V 份额，花/果只在所属母叶份额内分流；未用 V 返还父级本次预算。Tree/Bud 直接将其实际用量累加 Growth，不能再乘 Tree Affinity；叶、花、果按各自的 Growth 转换规则处理所得 V，不对同一份预算重复施加 Tree Affinity。
- **离散事件**：按对应 Growth 门槛、已经确认的事件条件触发。将结算间隔细分不能让随机判定重复获得额外机会；出芽检查频率及由原每日概率换算连续风险的方案需另行确认。
- **元素球**：仅由玩家主动「富集」生成，单球随机纯元素初始**固定50 V**（只随机元素类型），半衰期 **0.25 uh**，`BALL_Elems[i] *= 0.5 ** (Δuh / 0.25)`，剩余七元素总量 **<1 V** 则销毁。0.25uh在本地Lua单机Demo中对应现实2.5秒，按当前时间尺度衰减。
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

Seed与Seedling共用连续TreeGrowth（累计45→90），Seedling时不清零；进入Sapling时按七元素逐维**1Growth=1V Reserve**，并把Sapling TreeGrowth置零，首次Bud同步生成、当前无30/80V休眠唤醒门槛。**SmallLeaf本叶26G**时固化亲和且只清零本叶阶段Growth，LargeLeaf与FlowerBud同时出现；生殖账户 `E_free[7]` 从0开始，**累计12G开花、40G青果、90G成熟**；开花与结果两次固化Affinity但不清零自由元素，全部花期Growth进入可食果实。成熟后反应产物并入同一账户的 `Products[]`，Stage锁定，采摘完整继承，Flavor只在品尝时生成。花期具体时长取决于实际Growth/uh，不是固定等待；采果后的再次开花仍需校准。每片叶固定Tree预算30%，花苞/花/青果统一取母叶预算**80%**。

## 玩家供给与目标

同一套 V/uh 模型面对不同的玩家上线频率，**唯一预期变化是 Soil[7] 的真实供给历史**。体验校准参考：积极玩家第2/3/4/5次上线（24/48/72/96uh）分别看见Seedling/SmallLeaf/Flower/可采成熟水瓜；每周首次168 uh回访时应有至少一颗成熟水瓜且生长预算接近零（不再存在休眠状态）；稳定期每日维护约每168 uh有4–6果、间歇维护2–4果、每周维护约2果。这是目标，不是已实现的产量承诺。

根系上限按Seed/Seedling/Sapling分别采用2/1.85/16 V/uh；B0=5.4V/uh，固定50V新输入下的首果时间仍需验算。Reserve容量180V，Growth Budget按R=0～180V的归一化S曲线（M=95V、W=12V）连续变化，Sapling不设置休眠迟滞。根系七元素共享Soil总量对数吞吐系数`ln(1+sum(Soil)/200)/ln(6)`；根系自身在Reserve100～180V乘`ln(1+(180-R)/80)/ln2`限流（R≤100时因子1，R≥180时0）。**Affinity>1可以使最终 Growth 超过所消耗的 V**，但不能先按父器官亲和放大一份 Growth，再将它作为子器官可使用的 V 重复转换。土壤容量1000V和固定比例自然蒸发仍需与不同上线习惯联合校准；详见[第一周期望值复算](../../mvp/aquamelon-kitchen/02-data-and-balance.md)。

权威详细规则：[水瓜生长系统](../../mvp/aquamelon-kitchen/03-growth-and-harvest.md)、[数值基线](../../mvp/aquamelon-kitchen/02-data-and-balance.md)。
