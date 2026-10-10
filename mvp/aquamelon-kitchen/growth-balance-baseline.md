# 水瓜厨房：uh 数值基线与体验校准

所有时序和速率采用 [uh 等效小时合同](../../docs/plants/uh-time-unit.md)。**uh 是唯一的模型时间单位**：千星 1 uh 对应现实1小时；Web 当前默认压缩为10秒。一次结算事件并不固定等于1 uh。养分流使用 V/uh，Growth 使用实际七维 Growth[7] 累计。

本页只记录仍然有效的数值、已确认的规则和明确未决定的部分；未定值不可由实现阶段自行补齐。

## 1. 用户体验目标（尚未达到最终校准）

| 玩家行为 | 早期里程碑目标 | 稳定期每168 uh产果目标 |
| --- | --- | --- |
| 每天固定时刻补土 | 第2次24uh见Seedling、第3次48uh见SmallLeaf、第4次72uh见Flower、第5次96uh可采成熟果 | 4–6（长期尚未验证） |
| 每隔几天上线补给 | 成长持续，断供时放缓、重新补充后恢复，不靠隐藏加速 | 2–4 |
| 每周上线补给 | 目标仍是首次168uh回访有成熟水瓜、土干、Reserve接近30V；**须用新12/40/90基线重算** | 约2（待验证） |

三类玩家**数值模型完全相同**，只允许 Soil[7] 的外部输入时刻与数量不同。Web 只缩短现实等待，不更改上述数值。

## 2. 元素与土壤

- 七元素顺序：`Fire/Hydro/Anemo/Electro/Dendro/Cryo/Geo`。
- 土壤七维容量总计**1000 V**，玩家主动富集并收集元素球；球的元素纯净、自然元素等概率，单球初始量**均值80 V**（具体波动范围尚未确定），半衰期为 **0.25 uh**，每次推进 `Δuh` 按 `0.5 ** (Δuh / 0.25)` 衰减，剩余总元素量 **<1 V** 时销毁。收集即加入 Soil，未被收集的元素球独立衰减，绝不自动再生。
- 土壤自然保留率为 `0.998/uh`（当前校准候选）：结算 `Δuh` 后，未吸收前的元素量乘以 `0.998 ** Δuh`；超容量时在结算开始按七元素等比例缩放至总量1000。
- 根系吸收先看 Soil 可用量和偏好，再受总上限 `MaxRootAbsorbVPerUH×Δuh` 与单元素通道上限约束；实际吸收不会超过任一元素现有库存。**同时，应对每种Soil元素分别叠加充盈度对数型效率**：较高库存维持吸收高位，进入低库存区间后效率陡降，而非仅按`min(soil_i×RootPreference,cap_i)`在最后才发现供给不足。浓度ln曲线的数值仍需校准，参考[首果期望校准](first-fruit-uh-calibration.md)。
- 当前 RootPreference 基线：`[0.80, 1.00, 0.85, 0.75, 1.00, 0.70, 0.90]`。
- Tree 初始基础 Affinity：`[0.85, 1.15, 0.90, 0.75, 1.20, 0.70, 0.95]`。单元素基础通道份额为 `0.30×对应 Affinity`；基础/实时亲和的具体读取阶段仍需校准。
- **根系上限可以按Seed / Seedling / Sapling阶段校准**，但三类玩家在同一阶段必须共用数值。当前每日首果期望试算候选为`2.0 / 1.85 / 16 V/uh`，尚未锁定；单纯4/5/6的历史对照不再作为现行基线。Sapling的根系吸收效率在Reserve总量≤100 V时为100%，100～180 V随ln曲线递减，180 V为0；见[第一周期望校准](first-fruit-uh-calibration.md)。

## 3. 树体生长预算与器官分流

Seed和Seedling没有Reserve，由Soil输入按亲和度直接形成**同一条连续TreeGrowth[7]**，累计45→90；90G进入Sapling时将七元素Growth严格逐维1G→1V转入初始Reserve，清零Sapling TreeGrowth；第一枚Bud同时出现，不等待首次随机检查和80V初始唤醒。此后根系吸收到Tree Reserve[7]。

**Tree 每次根据 Reserve[7] 与自身 Affinity 动态生成 Growth Nutrient Budget[7]**。Reserve总量达到100 V即**满速预算**，100～180 V不再因储备量额外加速，低于100 V则按`R/100`衰减；Tree Reserve总容量180 V。**Affinity>1允许相应元素提取预算大于其比例基准，从而放大总提取预算，不再按亲和加权总和归一化抵消这种收益**，但任何元素的提取不得超过真实储备。参考系数及每元素具体取用仍待校准，不存在将Reserve固定按10%或1%抽取的已批准规则。

叶片先从树本次预算实际取用，每片既定份额基线为30%；叶片未用份额归还父级 Tree 的本次预算。三叶占满时树至少保留自身成长空间。每片叶内部再单独向附属花果分流，其他叶片和树体不被二次扣费。

| 叶片已有数量 | 叶片名义份额（每片） | Tree 名义剩余份额 |
| ---: | ---: | ---: |
| 0 | — | 100% |
| 1 | 30% | 70% |
| 2 | 30% | 40% |
| 3 | 30% | 10% |

这只是第一层分流份额，不意味着没有吸收能力的叶片也一定消耗这30%。**FlowerBud / Flower / GreenFruit统一取得母叶本次预算的80%（已确认）**；成熟后继续20%低效富集仍是候选。LargeLeaf自身Growth保留率60%，嫩叶无同类损耗。二级分流不会额外扣Tree Reserve；每叶30%不变。

Active Bud 将原本属于 Tree 自身的 GrowthGain 暂时接入独立 BudGrowth[7]；掐芽时完整退回 TREE_Growth，已生长叶片的预算不受影响。

## 4. 成长阶段阈值（按 Growth，不按等待时间）

| 转换 | 对应 Growth 达标 |
| --- | ---: |
| Seed → Seedling | 连续TreeGrowth累计45 |
| Seedling → Sapling | **同一TreeGrowth累计90**，转为Sapling初始Reserve |
| Bud → SmallLeaf | 20 |
| SmallLeaf → LargeLeaf（本叶） | 26 |
| LargeLeaf → FlowerBud（本叶） | SmallLeaf达26G升LargeLeaf**同时出现**，不再需要18G |
| FlowerBud → Flower（生殖轴） | **累计12** |
| Flower → GreenFruit（同一生殖轴） | 40 |
| GreenFruit → Aquamelon（同一生殖轴） | 90 |

所有时长都是由实际Growth推得的体验目标，不是隐藏倒计时。SmallLeaf本叶26G时固化自身Affinity、清零**本叶阶段Growth**并立即变为LargeLeaf+FlowerBud；新的生殖Growth[7]从0开始，累计12G开花、40G结果、90G成熟。**开花与结果两次亲和固化**但不清零生殖Growth；两次间的Affinity塑形只读固化后的增量。结果后另累计FruitElementAmount派生Flavor。

Sapling 主干 Growth 达100只完成本次 Affinity 塑形周期，不升 Mature Tree。最多3叶，出芽概率按当前叶数0/1/2/3对应0.80/0.40/0.01/0；**各时段是否投一次以及如何换算为按 uh 连续风险**仍待统一，不能因结算精度增加而增加机会。

## 5. 收获与再生

GreenFruit 形成后就可采摘；Fruit Growth 达90为成熟 Aquamelon，母叶同步成为纤维化水瓜树叶。成熟后元素量仍可继续低效率富集，不锁定 Flavor。

实际采摘使活体器官转成地面材料，不再参加 Tree/Leaf 养分分配。两条加工路径：

- GreenFruit → GreenFruitPeel + GreenFruitFlesh。
- Aquamelon → AquamelonShell ×2 + AquamelonJuice；AquamelonShell 继续处理为 AquamelonFlesh 与剩余果壳。

加工所得材料按既定规则完整继承 Affinity；持续成长累积的元素量由青果肉或水瓜汁承载，成形的结构组织不复制这份生长累积。所有材料有独立的 ElementAmount[7] 与 Affinity[7]。

母叶保留时可再次形成花苞，但**采果后的新增 Growth 门槛尚待确认**；不得用固定等待24 uh代替 Growth 门槛，亦不得复用采收前历史 Growth 直接触发。

## 6. 未锁定的校准量

- Reserve × Tree Affinity → 每 uh 预算的参考系数B0、各元素不足时如何重分配；**Affinity>1放大实际预算**及Reserve100V满速规则已确认。当前每日试算使用B0=5.4V/uh，**仍是候选**。
- 单叶对七元素预算的实际取用上限、返还规则和溢出处理。
- Seed / Seedling / Sapling 根系上限最终V/uh档位、Reserve100～180 V **ln** 吸收曲线的精确实现与出芽概率的uh频率合同。
- 每周一次是否真实达到**168 uh内成熟果 + Soil干 + Reserve约30 V**；每日首果能否较每周**显著提前**，以及稳定周产量目标。详见[期望值数值对照](first-fruit-uh-calibration.md)。
- 采收后再次生花苞的新增 Growth 阈值，和离线首次开花的可见性策略。

只有经过同一 V/uh 模型复算并正式确认的结果，才能用于下一步实现和验收。
