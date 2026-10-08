# Growth Tick — 统一离散结算语义

> 2026-10-08 基线。此前的 `RatePerHour + dtHours` 和「在线结算读取真实墙钟时间」已被本规则取代。Tick 数量与 Tick 对应的游戏时间是两个不同参数。

## 核心合同

- 唯一计算步长是 `dtTick`，为非负整数。一次 Tick 执行一轮 Soil → Tree → Reserve → Growth → Leaf → Flower/Fruit 的权威结算。
- 所有速率、上限、衰减、代谢均定义为 **per Tick**；连续 `N` Tick 是 `N` 次真实结算，不允许把 `N` 当作一次跨阶段的捷径。
- `tick:time` 单独定义 Tick 和游戏时间的映射以及在线触发间隔。修改映射不重算单 Tick 吸收上限，也不放大本 Tick Growth Budget。
- 器官年龄、采果后一个游戏日重新开花都读取模拟游戏时间，**不**直接读取浏览器墙钟作为游戏日期。出芽检查分两种配置：**Web 每 Tick 结束立即检查**；千星奇域按服务器时间每日 04:00 检查。
- 自动 Tick 与 Debug 强制 Tick 都调用同一个 settlement；Debug 的一次点击立即推进一次真正的 Tick。

配置概念：

```ts
{
  'tick:time': {
    gameMinutesPerTick: 60,
    realMillisecondsPerTick: 20_000 // Web 试玩；客户端为 3_600_000
  },
  maxTotalAbsorbPerTick: 6,
  soilRetentionPerTick: 0.99,
  treeRetentionPerTick: 0.9,
  budCheckMode: 'perTick' // Web；千星奇域使用 'daily04'
}
```

出芽概率表（无叶 80%、一叶 40%、二叶 1%）共享，但检查频率按运行环境区分；已有 Active Bud 或三片叶时跳过。Web 的自动 Tick 和 Debug Tick 同样在每次结算后立即检查，不进行日期去重，也不等待 04:00。

其中游戏分钟数与现实触发间隔仅决定 **时间推进/调用频率**。吸收、衰减和预算是独立、需要分别调平衡的数值。当前 Web 支持整除 60 的游戏分钟映射，以保持整点事件不跨 Tick 被跳过。

千星奇域的正式默认时间映射：**1 Tick = 1 游戏小时**。Web 也可以映射成 1 游戏小时，但把实时触发间隔缩短，从而加速玩家体验。千星奇域历史数值 `MaxAbsorbPerTick=1`、`SoilRetentionPerTick=0.99`、`TreeRetentionPerTick=0.99` 是旧参数换单位后的基线，**未被新体验目标自动重新批准**。

## 最小结算顺序

1. Soil 总量大于容量时整体等比例压缩，随后进行每 Tick 的蒸发。
2. 世界元素球按每 Tick 的半衰期衰减；总元素量小于 1 时销毁。
3. Tree 根据 BaseAffinity + RootPreference、单元素 Cap 和多元素总量归一化从 Soil 吸收；绝不因时间映射更改每 Tick 吸收量。
4. Seed / Seedling 直接把吸收转成 Growth，并在达到阈值时固化 Affinity、清空当前 Growth、升级。
5. Sapling 吸收进 Reserve，满足激活条件后按每 Tick retention 消耗 Reserve；从该 Tick 的 Growth Nutrient Budget 向叶分流，Tree 自己的份额用于主干塑形或 Active Bud。
6. 每片 Leaf 只从自己分到的 Leaf Nutrient Budget 中继续给附属 Flower / Fruit 分流；Flower / Fruit 不单独向整株 Tree 索取预算。
7. 更新器官 Growth / EffectiveAffinity，检查阶段阈值。芽期转叶、Flower 30、Fruit 100 等必须经过真实阶段。
8. 本 Tick 的结算和新器官出生事件采用 **Tick 结束时的游戏时刻**；完成结算后检查器官年龄/复花，再按运行环境处理出芽（Web 立即；千星奇域每日 04:00）。

比例类参数按 `RetentionPerTick ** dtTick` 结算（若批量计算没有跨越阶段才可数学合并）；线性上限是 `MaxAmountPerTick × dtTick`，但跨阶段推进仍必须逐 Tick 走 canonical settlement。

## 调度与离线

Web 原生浏览器在线只需定期调用 `advance(1)`；Debug 的 `advance(1)` 也是完全相同的计算。暂停页面造成的真实时间差，不直接作为 `dtHours` 补进 domain；未来如需要离线补算，应先明确应补的整数 `dtTick`，并按边界回放。当前未增加离线 scheduler。

千星奇域服务器实际 Tick 调度由游戏节点图支持，本文只确定计算单位与时间映射，不推测客户端可以在服务端使用脚本。

## 营养职责

父级 Reserve 只承担该 Tick 的 nutrient budget；Growth 是已经转化成结构/亲和塑形的累计，不再作为可输送营养扣回。Leaf 的器官后代只共享本叶份额。FruitElementAmount 继续作为果实富集累计，材料加工不反向修改存活的器官。

目前不定义通用植物 scheduler、结构组织的基础元素量、通用 item 框架或额外 Growth 奖励。
