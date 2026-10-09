# 时间单位 uh 与 V/hr 统一速率口径

> 2026-10-09 用户确认的**模型校准口径**。此文优先于仍使用 `per Tick`、`gameMinutesPerTick` 或 Web 独立快速平衡参数的旧分析。**本轮仅记录模型合同，不代表现有 TypeScript/Cordis 或千星节点图已实现。**

## 1. 定义

- **V**：七元素养分存量单位。`Soil[7]` / `Tree Reserve[7]` 记录仍可使用的实际元素量；器官 `Growth[7]` 是养分经亲和转换后形成的生长累积，**不是**可再次分配的 V 储备。
- **V/hr**：正式设计中的每标准小时养分流量或吸收上限；数值不依附引擎结算次数。
- **uh**：*unit hour*（等效小时），特指模型中与上述 `hr` 对应的**一小时等效时间**。为了避免把「游戏里的一个小时」与 Web 实际耗时混淆，在数值分析中以 `V/uh` 表示 `V/hr`；**二者数值完全相同**，仅改变标注，不重新平衡。
- **Tick**：一次结算/刷新操作，**不是**模型单位；可推进一个完整 uh，也可推进任意分数 uh。对于 V/uh 线性吸收上限，当前步长 `Δuh` 的上限为 `Rate × Δuh`。

| 运行场景 | 1 uh 实际历时 | 每 Tick 推进 | 每 uh Tick 数 |
| --- | --- | --- | --- |
| 千星奇域：每小时结算 | 现实 1 小时 | 1 uh | 1 |
| 千星奇域：每 5 分钟结算 | 现实 1 小时 | 1/12 uh | 12 |
| 千星奇域：每 1 分钟结算 | 现实 1 小时 | 1/60 uh | 60 |
| Web 当前默认加速 | 现实 10 秒 | 若每10秒结算则 1 uh | 1 |
| Web 未来每 1 秒展示/细算 | 现实 10 秒 | 0.1 uh | 10 |

Web 将 `realSecondsPerUH` 作为可调加速参数，当前默认 `10`；例如改为 20 秒代表 1 uh 会让进程以现实时间的半速演示，**不改变**任何 V/uh、Affinity、Growth、器官阈值、元素球基础量或分流规则。千星相应系数固定为 3600 秒/uh。

## 2. 数值与 Tick 解耦

```text
deltaUH = 实际经过秒数 / realSecondsPerUH
RootAbsorbMaxV = MaxRootAbsorbVPerUH * deltaUH
SoilAfterEvap[i] = SoilBeforeEvap[i] * SoilRetentionPerUH ** deltaUH
```

- 实际根系吸收再受七元素 Soil 可用量、RootPreference、单元素亲和通道上限、总上限限制。**根系吸收的 V 首先进入 Tree Reserve，不等于立即产生相同 V 的 Growth Budget。**
- Sapling 每个 `Δuh` 根据 **Reserve[7] 和 Tree Affinity[7] 动态生成当步 Growth Nutrient Budget[7]**；随后叶片优先实际取用，再由叶片分给花果；未被叶片实际取用的预算回归 Tree 当步预算；最后剩余预算转成 Tree Growth，若存在 Active Bud 则转入 Bud Growth。**正式 Budget 生成系数/上限尚在校准**，不得将原 Web `treeRetentionPerTick=0.90` 或千星旧 `0.99` 当作已批准的公式。
- 器官阶段由真实 **Growth 达标**触发，小时仅用于校准正常供养下的时间体验。当前获准作为本轮校准的阶段数值：SmallLeaf→LargeLeaf `26`；LargeLeaf→FlowerBud `18`；生殖器官 FlowerBud→Flower `26`、Flower→GreenFruit `40`、GreenFruit→MatureFruit `90`。FlowerBud→Flower→Fruit **同一生殖 Growth[7] 延续，不在开花处清零**。
- 原 04:00 出芽、`每Tick投概率`或更高频率细算的事件概率**不可混为一谈**。若用户决定解除固定时刻但保留每天累计概率 `pDay`，候选换算为 `p(Δuh) = 1 - (1 - pDay) ** (Δuh/24)`，需正式独立确认。不允许因为 Tick 从 1h 改为 5min 就将概率重复投 12 次原样数值。
- 在线与离线共用相同模型时间和事件阈值；Tick 的调度精度与保存/回放策略是实现问题，不给低频玩家隐式加速，也不以离线为由取消 Growth。

## 3. 三档供给行为的体验目标

**三档玩家使用完全相同的 V/uh、Growth、Affinity、出芽及成熟规则。** 本轮唯一希望用来解释成长差异的外生条件是：不同上线和收集习惯引起的 **Soil[7] 元素供给轨迹**。

| 玩家习惯 | 土壤/上线概念场景（用于校准） | 希望看到的体验 |
| --- | --- | --- |
| 每日上线 | 初次主动浇到约80～100，日常持续补充 | 最近修订目标：约24 uh 到 Seedling、72 uh 到 Sapling、168 uh 内获得首果；稳定生产后约4～6果/168 uh |
| 每隔几天 | 首次浇透，数天一次补水（校准样例可取每72 uh，非强制上线规定） | 多次上线间成长继续但随 Soil 变少而放缓；第二次补充见过程、第三次应看到 Seedling；长期约2～4果/168 uh |
| 每周上线 | 初始 Soil 浇到100，每168 uh 补一次（校准样例） | 一周后回来至少看到 Seedling 和进一步的成长，Soil 明显需要补充；长期约2果/168 uh |

这些是**体验目标，不是现有参数已达到的结论**。旧文档中「约48小时见 Seedling、约一周到 Sapling」是更早一轮目标，2026-10-08 后更快的 `24/72/168 uh` 是本轮积极玩家优先校准参照，不能混成同一次模拟的两套判定。

## 4. 当前实现差异与未定问题

- 现有 `packages/plugins/src/aquamelon/config.ts` 同时存在不同 `GENSHIN_BALANCE` / `WEB_BALANCE` 吸收/代谢数值；这是**尚未统一的原型实现现状**，而不是用户确认 Web 和千星应拥有不同玩法的授权。
- 现有 `advanceWorld` 仍只接收整数 `dtTick`，`treeRetentionPerTick` 作为 Reserve 百分比消耗，也未兑现本文件的新模型。
- 新版 `GrowthBudget(Reserve[7], TreeAffinity[7], Δuh)` 的**实际取用公式、额外上限**，以及每片叶的实际取用/未用返还通道仍待校准；目前不能据过去 `0.9/0.99` 模拟宣布首果所需的 uh 为固定值。
- Soil 容量100、每小时保留0.99以及根系吸收4/5/6 V/uh若同时采用，**不同频率上线玩家可能面临比原定目标更长的断供**。必须通过真实 Soil[7] 随机元素供给的完整情景模拟验证，而不是暗加离线资源补偿。

相关设计源：[`growth-system.md`](../../mvp/aquamelon-kitchen/growth-system.md)、[`growth-balance-baseline.md`](../../mvp/aquamelon-kitchen/growth-balance-baseline.md)、[`growth-tick.md`](growth-tick.md)。
