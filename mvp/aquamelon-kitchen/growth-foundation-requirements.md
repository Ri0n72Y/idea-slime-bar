# 水瓜厨房：基础生长功能需求

完整数值时间合同见 [uh 统一规范](../../docs/plants/uh-time-unit.md)；所有时长用 **uh**，所有养分速率用 **V/uh**。一次 Tick 仅是推进 `Δuh` 的技术结算，不能成为独立的速度单位。本页是**当前需求**，不存档已经废弃的计算公式。

## 1. 权威状态

世界长期状态由 Soil、Tree、活体器官、元素球和地面材料各自持有，所有模型均使用 Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo 的七维数组。千星奇域以服务端节点图为权威，Web 以 Cordis 领域状态为权威；平台共享规则、分离实现，不共享代码。

- `Soil[7]`：七元素储备，容量100V，收集后实时更新，蒸发率按 `0.99/uh`。
- `TreeReserve[7]`：仅 Sapling 起存在，承接根系吸收的真实 V，不能与 TreeGrowth 混用。
- `TreeGrowth[7]`：实际已转化的生长度及亲和塑形材料，Seed / Seedling 直接累计。
- `BaseAffinity[7]`、`EffectiveAffinity[7]`、`RootPreference[7]`：转换基线、动态倾向和摄取偏好彼此独立。
- `BudGrowth[7]`、每片叶自身 Growth[7]、各叶附属生殖器官的 Growth[7]：分开存储，只通过一次预算分流相互联系。
- `FruitElementAmount[7]`：结果以后真正进入可食果实的元素 V，用于导出 FlavorRatio，不等于花苞/花阶段的生殖 Growth。
- World Material：独立地面道具，携带 MaterialType、ElementAmount[7]、Affinity[7]，不是背包格子。

## 2. 吸收与预算

1. 统一时间映射得到 `Δuh`；按 `V/uh × Δuh` 计算根系总吸收上限。
2. Soil 超量时七元素同比压缩至100，再处理蒸发和真实根系吸收。植物不能获取不存在的元素；偏好、亲和通道 cap 与总 cap 同时生效。
3. Seed / Seedling 的根系吸收直接按当前器官亲和转换 Growth；Sapling 起先进入 Reserve。
4. Sapling **根据当前 Reserve[7] 和 Tree Affinity 动态形成本步 GrowthNutrientBudget[7]**；取用总量不得超过储备，生成式的系数与上限待正式校准。
5. 按每片叶的既有30%份额优先让其实际取用预算。若某叶不能完全取用，未消费的预算回到 Tree 本次预算。该叶的 FlowerBud / Flower / Fruit 只能从母叶本次已取得的份额继续分流。
6. 剩余 Tree 本步预算转换为 TreeGrowth，Active Bud 存在时转入 BudGrowth；不建立花/果跨叶共享预算池。
7. 不因为把结算间隔由1 uh细分为1/12或1/60 uh而重复吸收、重复 Growth 或重复投随机机会。

## 3. 元素球与玩家动作

- 「富集」由玩家主动生成等概率纯元素球，单球初始量 **8～10 V**；每球独立计量，按统一模型半衰期 **0.25 uh** 及本次 `Δuh` 衰减（`BALL_Elems[i] *= 0.5 ** (Δuh / 0.25)`），总元素量 **<1 V** 时销毁。
- 「收集」立即使元素球消失并将当前剩余元素量写入 Soil；「清空场地」只处理未收集元素球。
- 土壤七元素存量和种子/树体 Growth 总进度可以作为普通 UI；亲和向量和七元素分项成长只向 Debug 开放。
- Debug 强制推进 `Δuh` 与正常结算走同一个权威路径，所做的人工改值不污染普通模式。
- 多个世界材料独立存在，采集、加工、汁液试调预览是按已有玩法模块执行的显式按钮，不自动加入背包。

## 4. 生命周期

| Growth 达标事件 | 阈值 |
| --- | ---: |
| Seed → Seedling | 45 |
| Seedling → Sapling | 90 |
| Bud → SmallLeaf | 20 |
| SmallLeaf → LargeLeaf | 26 |
| LargeLeaf → 附属 FlowerBud | 18 |
| FlowerBud → Flower | 生殖 Growth 26 |
| Flower → GreenFruit | 生殖 Growth 40 |
| GreenFruit → Aquamelon | 生殖 Growth 90 |

**SmallLeaf→LargeLeaf：** 本叶阶段 Growth[7] 达 26，先把本叶当前 EffectiveAffinity 固化为 LargeLeaf BaseAffinity，再将**叶自身阶段 Growth[7] 清零**；LargeLeaf 从零另积累 18 Growth 才生成 FlowerBud。**FlowerBud 新生时另建生殖 Growth[7]=0**；此后 FlowerBud→Flower→GreenFruit→Aquamelon 沿同一条生殖向量持续累计，开花与结果时**不清零**。叶自身阶段 Growth 与生殖 Growth 是独立状态。所有 12 / 12 / 24 / 12 uh 时长只用于拟合养分供给与阈值，**不是**强制等待门槛。

出生器官一次性继承父器官的亲和偏移，随后自成独立成长轴。花谢结果时锁定生殖器官亲和，结果后才统计 FruitElementAmount 与风味比例。熟果后元素积累仍可继续，Growth 达标不自动采摘。

Sapling 主干 Growth 100 为 Affinity 塑形循环，不进入 Mature Tree。活叶上限3片，芽20 Growth 才生成新叶；掐芽将 BudGrowth 完整返还树干。概率值为 0叶80%、1叶40%、2叶1%、3叶0，独立确认机会频率后才能把它应用于高频结算。

母叶的花/果取用是 leaf-local 二级分流。果实成熟与母叶变为纤维化水瓜树叶同步；采摘后可复花，但需要采果后新增 Growth 的正式阈值，不准用隐藏的固定等待钟替代。

## 5. 材料与加工

- GreenFruit 与 Aquamelon 是不同阶段、不同材料；青果肉与水瓜汁承载随果实持续积累的成长元素，果皮、果壳及剩余结构组织不复制这一部分。
- GreenFruit → GreenFruitPeel + GreenFruitFlesh；Aquamelon → AquamelonShell ×2 + AquamelonJuice；AquamelonShell → AquamelonFlesh + remaining shell。
- 全部 Processing 产物完整继承来源 Affinity[7]，ElementAmount 由结构与生长累积承载关系决定；不补充未批准的质量守恒比例或通用道具框架。
- Fruit Flavor 直接是实际 FruitElementAmount 七元素占比，零元素量时尚无 Flavor；无 Taste 六维公式。

## 6. 离线与验收

使用同一 `Δuh` 模型从上次状态推进到当前世界时间，跨越实际 Growth 阈值时分段。出芽的概率频率、可见花期停点和断粮恢复另行确定；离线玩家不得因不上线被写入另一套成长率或隐藏元素来源。

验收必须包括：七元素供给足/不足、种子到成熟水瓜完整链、Active Bud、两叶互不抢养分、花果同一 Growth、成熟后继续富集、采摘/材料加工、用户每24/72/168 uh补土的真实土壤轨迹。结果均区分源代码模拟、实际 Web 试玩与千星服务端验收，不能互相冒充。
