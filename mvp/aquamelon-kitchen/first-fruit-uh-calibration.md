# 水瓜厨房：首轮五次上线数值基线（2026-10-10）

> **设计决策已确认**：Seed/Seedling 连续 Growth；Sapling 一次性按 1 Growth = 1 V Reserve 逐元素转入、TreeGrowth 重新开始；首次 Bud 与 Sapling 同时出现；SmallLeaf 达 26 G 时直接进入 LargeLeaf 并创建 FlowerBud；花苞、花、青果从所属母叶预算统一取得 **80%**；花→果生殖 Growth 始终连续累计，**12 / 40 / 90 G**；Flower 和 GreenFruit 各进行一次亲和固化。每片叶仍取得 Tree 本次预算的 **30%**。此文件取代此前以「Sapling60uh、花苞/花40%、26/40/90」为前提的首周试算**设计依据**。

## 1. 唯一时间与玩家反馈目标

单位只用 [uh](../../docs/plants/uh-time-unit.md)，千星1uh=现实1小时，Web默认1uh=10秒；Tick仅是积分事件。玩家在0uh播种并补满土，此后每日在24/48/72/96uh固定时刻补土：

| 上线 | 时刻 | 最迟应出现的可见成果 |
| --- | ---: | --- |
| 首次 | 0uh | 播种 |
| 第二次 | 24uh | Seedling（发芽） |
| 第三次 | 48uh | SmallLeaf（第一片小叶） |
| 第四次 | 72uh | Flower（可见花朵） |
| 第五次 | 96uh | Mature Aquamelon，可主动采摘 |

成果由实际 Growth 跨阈值触发，**不得用对应的24uh时点强制升级**；以上只是主动玩家回访时的验收目标。首个 Sapling 在48uh前形成，先前「约60uh Sapling」指标已被新上线反馈合同取代。

## 2. Growth 与 Reserve：两个不同生命周期段

- Seed 和 Seedling 都没有 Reserve，按实际 Soil 根系吸入 × 相应 Affinity 累加到**同一条** `TreeGrowth[7]`。累计 `sum(TreeGrowth)>=45` 时变为 Seedling，**不清零**该 Growth，也不在此重算一次已计入的亲和偏移；累计 `>=90` 时变为 Sapling。
- Sapling 转换是**逐元素严格 `TreeReserve[i] = TreeGrowth[i]`**，即1 Growth→1 V Reserve。生长的 Affinity>1 所产生的 Growth 放大**完整保留**，这是植物允许的生产收益，不按原摄取V反向缩减。转移后 `Sapling.TreeGrowth[7]=0`，不能同时保留可再次用于 Tree 自身 Growth 的旧值。
- Sapling 出生时立即创建第一枚 `Bud`（Growth初始0）。**不要求先经过一次 Dormant→Reserve80V 的启动等待**，正常生长后因长期缺养才适用当前的30/80V休眠迟滞。第二、第三枚Bud的随机机会仍待单独确认。
- Bud累计20G→SmallLeaf；SmallLeaf本叶阶段 Growth 累计26G→LargeLeaf，固化本叶亲和、清零**本叶阶段 Growth**，同时直接生成附属 FlowerBud，**不再额外等待18G**。

## 3. 花果唯一累计轴与分流

```text
LargeLeaf + FlowerBud: ReproductiveGrowth[7]=0
  ├─ sum(Growth) >= 12 → Flower       （第一次 Affinity 固化；Growth不清零）
  ├─ sum(Growth) >= 40 → GreenFruit   （第二次 Affinity 固化并锁定；Growth不清零）
  └─ sum(Growth) >= 90 → MatureFruit  （成熟；Growth不清零）
```

- 第一层每片 Leaf 固定取得树本次 Growth Nutrient Budget 的 **30%**；第二层 FlowerBud / Flower / GreenFruit 统一取得**该母叶份额的80%**，即在有一片叶时，首枚生殖器官取当次 Tree Budget 的 `0.30 × 0.80 = 24%`。未取得的预算仍归母叶使用；不同叶片不会额外从Tree全局二次提款。
- Flower 时固化此刻 EffectiveAffinity 为本阶段新基线；其后塑形只读取**第一次固化之后新增加**的 Growth，不能复用先前Growth重复放大；GreenFruit 时第二次固化并锁定果实 Affinity。**生殖 Growth[7] 一条向量连续累积，花、果形态变化均不清零**。 `FruitElementAmount[7]` 另从GreenFruit形成后累计，用于风味，不和生殖 Growth 合并。
- MatureFruit形成后留树低速继续富集的分流，沿用 **20%候选**，不随本轮「成熟前统一80%」一同变成80%。GreenFruit可提前采摘，材料加工身份和亲和继承等旧规则仍有效。

## 4. 每日玩家的**条件性期望数值对照**

**仅用于复算的一组完整数值条件**：Soil容量1000V、固定比例留存0.998/uh、单球均值80V、每次补土按七元素各1/7的期望向量填满1000V；Seed / Seedling / Sapling 根系上限候选 `2 / 1.85 / 16 V/uh`；Soil单通道与根系总吞吐的浓度log1p候选 `H=120V,K=25V`；Reserve容量180V、100V以上满速成长、100–180V根系ln限流、30/80V休眠迟滞；Tree预算参考速率候选 `B0=5.4V/uh`，Affinity>1**允许放大实际预算总额**不归一化；每叶30%，成熟前三种生殖状态80%。**除了上面明确确认的生命周期/分流/阈值，不应把这些拟合值全部当作最终已锁定的实现配置。**

| 达到事件 | 期望模型中的uh |
| --- | ---: |
| Seedling / Sapling+首Bud | 21 / 43 |
| SmallLeaf / LargeLeaf+FlowerBud | 46 / 57 |
| Flower（生殖累计12G） | **64** |
| GreenFruit（生殖累计40G） | **76** |
| Mature Aquamelon（生殖累计90G） | **95** |

玩家第72uh能看到Flower，第96uh能采摘MatureFruit；第96uh预计Soil约766V、Reserve约130V，植物Growing。**积分步长为1uh，首次成熟只比96uh上线提前1uh；未验证更小步长、实际随机球、真实客户端或CI**。这些结果不构成每个玩家的概率保证。

## 5. 后续计算边界

- **下一轮对每周仅在0uh补一次1000V Soil 的玩家只进行数值推演**，使用本文件的相同机制与候选数值，不预先加低频补偿、Growth阶段等待钟或独立参数。应报告事件时刻、Soil/Reserve曲线、首次Dormant时刻、168uh真实活动状态；低频供养再次校准前不修改本文件已确认的每日基线。
- 采果后母叶复花 Growth 条件尚未锁定，因此首果推演不能替代稳定周产量；第二/第三片叶的独立概率事件也不是本轮确定性首果的约束。
- 此文件为设计规格与独立期望分析，**不代表已经修改Cordis/TypeScript、千星节点图或完成Web实测**。

