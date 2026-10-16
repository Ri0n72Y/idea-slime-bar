# 水瓜厨房：基础生长功能需求

完整数值时间合同见 [uh 统一规范](../../docs/plants/uh-time-unit.md)；所有时长用 **uh**，所有养分速率用 **V/uh**。一次 Tick 仅是推进 `Δuh` 的技术结算，不能成为独立的速度单位。本页是**当前需求**，不存档已经废弃的计算公式。

## 1. 权威状态

世界长期状态由 Soil、Tree、活体器官、元素球和地面材料各自持有，所有模型均使用 Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo 的七维数组。千星奇域以服务端节点图为权威，Web 以 Cordis 领域状态为权威；平台共享规则、分离实现，不共享代码。

- `Soil[7]`：七元素储备，容量1000V，收集后实时更新，当前数值校准按固定比例 `0.99/uh` 自然损耗。
- `TreeReserve[7]`：仅Sapling起存在。首次进入Sapling时逐元素按`TreeReserve[i]=TreeGrowth[i]`转入（1Growth=1V Reserve），此后才承接实际根系吸收；与Sapling本体新TreeGrowth分开。
- `TreeGrowth[7]`：实际已转化的生长度及亲和塑形材料，Seed / Seedling 直接累计。
- `BaseAffinity[7]`、`EffectiveAffinity[7]`、`RootPreference[7]`：转换基线、动态倾向和摄取偏好彼此独立。
- `BudGrowth[7]`、每片叶自身 Growth[7] 与各叶的生殖账户独立，只通过一次预算分流相互联系。生殖账户**不另建 Growth 与 FruitElementAmount 两份库存**，花苞出生即持续累计 `E_free[7]`，成熟反应产生的稳定物质量归 `Products[]`。
- 生殖物质量 `M = ΣE_free[7] + ΣProducts.amount`；成熟前尚无产物，`M = ΣE_free`。经 Affinity 转换的器官 Growth 即加入对应七元素物质，不再以结果为起点独立计量食用元素。
- World Material：独立地面道具。采摘青果／熟果完整保留其 `E_free[7]`、`Products[]`、材料身份及 Affinity，不是背包格子；加工分配另议。

## 2. 吸收与预算

1. 统一时间映射得到 `Δuh`；按 `V/uh × Δuh` 计算根系总吸收上限。
2. Soil 超量时七元素同比压缩至1000，再处理蒸发和真实根系吸收。植物不能获取不存在的元素；偏好、亲和通道 cap 与总 cap 同时生效。
3. Seed / Seedling根系吸收按亲和转成**同一条连续TreeGrowth[7]**，累计45G变Seedling时不清零、累计90G变Sapling时将Growth按七维严格1:1转入初始Reserve，Sapling的TreeGrowth归零。高Affinity塑形产生的Growth直接作为植物生产收益，不回退成原始摄取V。Sapling之后根系吸入先进入Reserve。
4. Sapling **根据当前Reserve[7]和Tree Affinity动态形成本步GrowthNutrientBudget[7]**；取用总量不得超过各元素自身储备。本轮采用Reserve总量0～180V归一化S曲线（中点M=95V、宽度W=12V），**取消30/80V休眠迟滞**；根系七元素共享唯一Soil总量对数系数`ln(1+sum(Soil)/200)/ln(6)`，各元素仅另受自身库存、偏好和通道cap限制。详见[期望校准](first-fruit-uh-calibration.md)。
5. **每片Leaf固定获得Tree本次预算的30%**；不能实际取用的部分回Tree本次预算。**FlowerBud/Flower/GreenFruit统一得到母叶本次份额的80%**，即第一片叶的生殖器官取得Tree当次预算的24%，不从其他叶或Tree全局二次扣费；MatureFruit之后低效继续富集的20%仍为单独候选。
6. 剩余 Tree 本步预算转换为 TreeGrowth，Active Bud 存在时转入 BudGrowth；不建立花/果跨叶共享预算池。
7. 不因为把结算间隔由1 uh细分为1/12或1/60 uh而重复吸收、重复 Growth 或重复投随机机会。

## 3. 元素球与玩家动作

- 「富集」由玩家主动生成等概率纯元素球，单球初始**期望80 V**，实际随机上下限尚待确认；每球独立计量，按统一模型半衰期 **0.25 uh** 及本次 `Δuh` 衰减（`BALL_Elems[i] *= 0.5 ** (Δuh / 0.25)`），总元素量 **<1 V** 时销毁。
- 「收集」立即使元素球消失并将当前剩余元素量写入 Soil；「清空场地」只处理未收集元素球。
- 土壤七元素存量和种子/树体 Growth 总进度可以作为普通 UI；亲和向量和七元素分项成长只向 Debug 开放。
- Debug 强制推进 `Δuh` 与正常结算走同一个权威路径，所做的人工改值不污染普通模式。
- 多个世界材料独立存在，采集、加工、汁液试调预览是按已有玩法模块执行的显式按钮，不自动加入背包。

## 4. 生命周期

| Growth 达标事件 | 阈值 |
| --- | ---: |
| Seed → Seedling | 连续TreeGrowth累计45 |
| Seedling → Sapling | 同一TreeGrowth累计90，逐维转换Reserve |
| Bud → SmallLeaf | 20 |
| SmallLeaf → LargeLeaf | 26 |
| LargeLeaf → 附属 FlowerBud | SmallLeaf达到26G升为LargeLeaf时同步出现，**无额外18G** |
| FlowerBud → Flower | 生殖Growth累计**12** |
| Flower → GreenFruit | 生殖 Growth 40 |
| GreenFruit → Aquamelon | 生殖 Growth 90 |

**SmallLeaf→LargeLeaf：** 叶自身Growth达到26G时固化其亲和，**仅清零叶自己的阶段Growth**，LargeLeaf与FlowerBud同一步生成；新花苞的 `E_free[7]` 从0开始，**累计12→40→90G**分别开花、成青果、成熟。开花和结果各进行一次亲和固化，只使用该次固化后的新增Growth继续塑形，**任何一次形态切换均不清空自由元素物质账户**。成熟后 Stage 锁定，反应及物质量变化不会回退。时长由实际Growth/uh决定，不添加器官隐藏计时器。

出生器官一次性继承父器官的亲和偏移，随后自成独立成长轴。**开花时第一次、结果时第二次固化生殖亲和**。花期所有 `E_free` 随发育进入可食果实；熟果后仍可继续富集和反应，Flavor 仅在最终品尝时生成，Growth达标不自动采摘。

Sapling 主干 Growth 100 为 Affinity 塑形循环，不进入 Mature Tree。活叶上限3片，芽20 Growth 才生成新叶；掐芽将 BudGrowth 完整返还树干。**首次Bud随Sapling同步出生**，不经过旧0叶80%的额外随机等待；当前已移除Dormant和80V唤醒条件；原概率值0叶80%/1叶40%/2叶1%/3叶0仍需为后续芽明确机会频率后才能进入高频结算。

母叶的花/果取用是 leaf-local 二级分流。果实成熟与母叶变为纤维化水瓜树叶同步；采摘后可复花，但需要采果后新增 Growth 的正式阈值，不准用隐藏的固定等待钟替代。

## 5. 材料与加工

- 青果和成熟水瓜的采摘是**完整物质账户转移**：自由七元素 `E_free[7]` 与已经产生的 `Products[]` 均保留，花期累计物质不丢失，也不因采摘复制一份。
- 已确认加工路线的材料身份：GreenFruit → GreenFruitPeel + GreenFruitFlesh；Aquamelon → AquamelonShell ×2 + AquamelonJuice；AquamelonShell → AquamelonFlesh + remaining shell。**加工后的各产物元素分配尚未决定**，不能沿用汁液/青果肉独占全部账户的旧规则。
- 最终 `Flavor` 仅在品尝时计算；不持久化旧 `FruitElementAmount` 或 `FlavorRatio` 作为最终口味合同。加工路线与品尝计算另行明确，不新增通用道具框架。

## 6. 离线与验收

使用同一 `Δuh` 模型从上次状态推进到当前世界时间，跨越实际 Growth 阈值时分段。出芽的概率频率、可见花期停点和断粮恢复另行确定；离线玩家不得因不上线被写入另一套成长率或隐藏元素来源。

验收必须包括：七元素供给足/不足、种子到成熟水瓜完整链、**每日0播种/24uh见幼苗/48uh有小叶/72uh见花/96uh收获（当前期望首果98uh，尚未达标）**、Sapling初Bud、两叶互不抢养分、花果连续生殖Growth与双亲和固化、成熟后继续富集、采摘/材料加工、用户每24/72/168uh浇水的真实土壤轨迹。结果均区分源代码模拟、实际 Web 试玩与千星服务端验收，不能互相冒充。
