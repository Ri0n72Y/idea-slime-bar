# 水瓜厨房 MVP：七元素养分、生长与材料

本文件为**现行玩法规则**；使用 [uh（等效小时）](../../docs/plants/uh-time-unit.md) 作为唯一数值时间单位，吸收速率为 V/uh，Growth 由实际养分与亲和度转换累计。Tick 只表示推进 `Δuh` 的结算事件，不能定义另一套速度或要求阶段固定等待一段时间。正式千星多人方案1uh对应现实1小时；Web及本地Lua单机参赛Demo采用1uh=现实10秒；共享玩法数值，运行时实现独立。

## 1. 总体养分流

```text
富集的元素球（玩家收集）
     ↓
Soil_Elems[7] （容量1000；自然蒸发0.99/uh）
     ↓ 根系取用：Soil、RootPreference、Affinity、单元素/总吸收V/uh上限
Seed / Seedling → 直接转换到自身 Growth[7]
Sapling         → TREE_Elems[7] / Reserve
                     ↓ 当前 Reserve × Tree Affinity 动态生成当步预算
                  GrowthNutrientBudget[7]
                     ↓ 子器官优先实际吸收
       ┌─────────────┴──────────────────┐
       ↓                                ↓
  每片 Leaf 份额                  Tree 剩余预算
       ↓                                ↓
本叶 Flower/Fruit 附属分流       TREE_Growth 或 Active Bud
```

- Reserve 是尚未转化的真实七元素 V；Growth 是已形成器官生长与亲和偏移的七维事实。
- 每个器官只在本次父器官给予的预算中吸收；子器官未实际取用的份额返还父器官，不因生成固定名义份额而丢失。
- Seed、Seedling 没有 Tree Reserve；进入 Sapling 才持久化 Reserve。
- Reserve 动态生长预算**由当前 Reserve 与 Tree Affinity 共同决定**。Tree Reserve容量180 V；本轮采用无休眠的0～180 V归一化S曲线（`M=95 V, W=12 V`），并非旧版`R≥100 V`满速、`R/100`下降的函数。**Tree Affinity>1允许实际预算提取总额放大，不进行七元素加权Affinity归一化**；每种元素不能提取超过自身Reserve。B0=5.4 V/uh是当前期望校准参数，不是已验证的运行时配置。见[首轮数值校准](first-fruit-uh-calibration.md)。
- Soil 自然蒸发属于世界环境损耗，**不能与 Tree Reserve → Growth Budget 混为一谈**。

## 2. 时间与计算尺度

```text
Δuh = 实际经过秒数 / 当前平台 realSecondsPerUH
MaxRootAbsorbThisStep = MaxRootAbsorbVPerUH × Δuh
Soil_Elems[i] *= SoilRetentionPerUH ** Δuh
```

`SoilRetentionPerUH = 0.99`；该参数仅用于 Soil。千星可以每1 uh、1/12 uh或1/60 uh结算；Web当前1 uh=10秒，可以用更细时间片更新 UI，但要累计出完全相同的 uh 代谢。出芽等随机事件的次数不能随细分结算间隔增加。

当前模拟的生命周期事件全部按 Growth 阈值跨越处理，只有玩家实际可见花期等表现策略可能要求在离线回放时安排一个展示停点；这个停点不得丢失已累计 Growth。

## 3. 土壤与元素球

- `SOIL_Elems[7]` 是元素存量，容量1000 V。玩家点击「富集」生成等概率的一个纯净元素球，点击「收集」立即将球**当前剩余量**加入 Soil 并移除该球；「清空场地」不影响已经进入 Soil 的储备。
- 元素球没有普通玩法的自动刷新。每次「富集」生成等概率纯元素球，初始元素量**固定50 V**（七种元素身份等概率随机，数量不再随机）；球按统一模型时间 **半衰期 0.25 uh**（对应千星的15分钟基线）衰减：`BALL_Elems[i] *= 0.5 ** (Δuh / 0.25)`；总元素量 **<1 V** 时销毁。Web 时间压缩只改变这些 uh 在现实中经历多久，不改变球的生命周期数值。
- Soil 若总量超过1000，下一次结算开始时按 `1000 / SoilTotal` 对七维存量等比例缩放；之后自然蒸发、再被植物吸收。超量直接损失，不设置隐藏回收池。
- RootPreference = `[0.80, 1.00, 0.85, 0.75, 1.00, 0.70, 0.90]`。
- Tree 初始 Base Affinity = `[0.85, 1.15, 0.90, 0.75, 1.20, 0.70, 0.95]`。
- 单元素通道基础上限份额为 `0.30 × 对应 Tree Base Affinity`；根系阶段上限当前校准值Seed/Seedling/Sapling为`2.0/1.85/16 V/uh`。七元素**共享唯一的Soil总量效率系数**：`F_soil=ln(1+sum(Soil)/200)/ln(6)`（Soil总容量1000 V），无须为每种元素另建浓度系数。各通道另受各自Soil可用量、RootPreference、Affinity及通道上限约束；通道候选量合计若超过`阶段总cap × F_soil`则同比缩减。Sapling根系在Reserve≤100 V时不受储备充盈度限流，100～180 V时仍按既有ln函数逐渐限流、到180 V停止吸收；**这一根系限流与Reserve→Growth Budget的S曲线是不同机制**。详见[第一周期望校准](first-fruit-uh-calibration.md)。
- Stage只改变**已配置的阶段根系上限**，不提供隐形加速；同一阶段三类玩家使用完全相同的上限。玩家元素搭配仍可改变摄取比例与亲和学习方向。

## 4. Growth 驱动的亲和塑形

水瓜树当前 Stage 的 Effective Affinity 只由本阶段已经形成的 `TREE_Growth[7]` 决定，不读取 `TREE_Elems[7]` 的当前储备比例。

当前配置：

```text
ExtraAffinity = 1
CFG_AffinityInherifanceRate = 0.5
```

计算：

```text
GrowthTotal = Σ TREE_Growth[i]

GrowthShare[i]
= TREE_Growth[i] / GrowthTotal

AffinityOffset[i]
= ExtraAffinity × GrowthShare[i]

TREE_EffectiveAffinity[i]
= TREE_BaseAffinity[i] + AffinityOffset[i]
```

当 `GrowthTotal = 0`：

```text
AffinityOffset[i] = 0
TREE_EffectiveAffinity[i] = TREE_BaseAffinity[i]
```

因此：

> Reserve 表示“当前体内还储存着什么”，Growth 表示“这些元素已经把植物长成了什么”。

只有 Growth 会塑造当前亲和。

### Seed / Seedling 连续 Growth 与 Sapling 转换

Seed 和 Seedling 没有 Reserve，使用同一条 `TREE_Growth[7]` 连续累积：总Growth达45变为Seedling而不清零、总Growth达90进入Sapling。成长轴到Sapling的边界按逐元素 `TREE_Reserve[i] = TREE_Growth[i]` 严格1 Growth→1 V Reserve；Affinity放大的Growth完整保留。结转后清零Sapling的本体 `TREE_Growth[7]`，不重复获得同一份Growth。早期的亲和塑形不应在Seedling升级时重复固化。

### Sapling 主干亲和循环

Sapling 不再继续升级到 Mature。当前主干 Growth 只用于自身亲和塑形和出芽竞争。

当前主干一轮 Growth 上限：

```text
SaplingTreeGrowthCycle = 100
```

当：

```text
Σ TREE_Growth >= 100
```

时：

```text
根据本轮 TREE_Growth[7] 的组成更新 / 固定 Tree Affinity
→ TREE_Growth 开启下一轮累计
→ Tree Stage 不变化
```

因此“主干长满”表示完成一次树体亲和塑形周期，不表示进入新的 Tree Stage。

### 叶芽与 SmallLeaf 的亲和继承

Bud 继续使用独立的：

```text
BUD_Growth[7]
```

Bud 的职责是承接当前 Tree Own GrowthGain、形成芽期元素倾向并累计到阈值 20。MVP 不再为 Bud 额外建立一套需要长期保留的独立 Affinity 状态。

当 Bud 达到阈值时：

```text
Σ BUD_Growth >= 20
→ Bud 完成
→ 生成 SmallLeaf
```

SmallLeaf 出生这一刻，使用现有的标准父子器官亲和继承规则，从**此刻主干的当前亲和**计算自己的 Affinity 初值：

```text
ParentOffset[i]
= TREE_EffectiveAffinity[i] - TREE_BaseAffinity[i]

SMALL_LEAF_BaseAffinity[i]
= CFG_LeafAffinity[i]
  + ParentOffset[i] × CFG_AffinityInherifanceRate
```

当前继承率仍为：

```text
CFG_AffinityInherifanceRate = 0.5
```

这是一次性遗传。SmallLeaf 出生后拥有自己的 Base / Effective Affinity，并只根据自己的后续 Growth 独立塑形；Tree 之后如何变化，不会实时回写 Leaf Affinity。

如果玩家在 Bud 完成前掐掉芽：

```text
TREE_Growth[i] += BUD_Growth[i]
Destroy Bud
```

即芽期已经形成的 Growth 完整退回主干，不产生额外损耗。

---


## 5. 生命阶段与预算

| 事件 | Growth 达标条件 |
| --- | ---: |
| Seed → Seedling | 连续 Tree Growth 累计 45 |
| Seedling → Sapling | **同一条**连续 Tree Growth 累计 90；逐元素 1G→1V Reserve |
| Sapling 自身亲和再塑形 | TREE_Growth 100（只循环塑形，不升级 Mature Tree） |
| Bud → SmallLeaf | BUD_Growth 20 |
| SmallLeaf → LargeLeaf | 本叶 Growth 26 |
| LargeLeaf → 生成 FlowerBud | SmallLeaf 达26G升为 LargeLeaf 时**同步生成**，无额外18G |
| FlowerBud → Flower | 同一生殖 Growth 累计 **12** |
| Flower → GreenFruit | 同一生殖 Growth 40 |
| GreenFruit → Mature Aquamelon | 同一生殖 Growth 90 |

每段的典型 **uh** 是由真实Growth推导的体验目标，不是隐藏倒计时；已确认的每日上线反馈为24uh发芽、48uh有小叶、72uh开花、96uh有成熟水瓜。详见[首轮数值基线](first-fruit-uh-calibration.md)。

- Seed/Seedling共用一条Growth（累计45→90），45G时只切换显示阶段，90G时按逐维1G→1V转入Sapling初始Reserve并清空Sapling TreeGrowth；在Sapling出现的同一刻**生成第一枚Active Bud**，不需要等待首次概率检查或从0V Reserve强制休眠唤醒。
- Sapling 从 Soil 读取养分进入 Reserve；按动态预算取用并向已有叶片优先分流。已形成叶上限3片；每叶第一层预算名义份额30%，0/1/2/3叶时 Tree 余额分别为100%/70%/40%/10%，若叶未实际吸收则未用份额回归 Tree。
- 在没有 Bud 时 Tree 预算结算为 TREE_Growth，达到100完成一次亲和塑形周期；有 Active Bud 时原本属于主干自身的 GrowthGain 进入 BUD_Growth。掐芽时全部 BUD_Growth 回到 TREE_Growth；Bud 达20则形成独立 SmallLeaf，继承出生时父亲和偏移。
- **首次Bud在Sapling生成时立即创建**；后续在每24uh固定模型日机会点（04:00）只判定一次：已有1叶40%、2叶1%、3叶0%。原0叶80%不适用于首芽，结算次数不能制造额外随机机会。
- **移除30/80 V的Dormant/Growing休眠迟滞**：Reserve不足时只通过0～180 V连续生长预算曲线自然减速；Reserve为0时Growth Budget为0，根系仍可继续吸收。没有初次启动唤醒门槛或后续休眠触发。

## 6. Leaf → Flower → Fruit

生殖器官是所属母叶的附属器官，**只取母叶本次获得的预算，不影响其他叶片，也不二次向 Tree 索要养分**。

- SmallLeaf出生时继承当前Tree亲和偏移，之后用自己的Leaf Growth[7]塑形。**SmallLeaf达到26G时**固化其亲和为LargeLeaf的BaseAffinity，并且只清零叶自身阶段Growth；**LargeLeaf与附属FlowerBud同时出现**，不再额外累积18G等待花苞。新花苞的 `E_free[7]` 从0开始累计经亲和转换形成的生殖Growth；花期全部积累均成为可食果实物质，阶段转换不重置。
- FlowerBud 的生殖账户即 `E_free[7]`；成熟之前 `M = ΣE_free`，**累计12G为Flower、40G为GreenFruit、90G为MatureFruit**。不是另一份独立的 `ReproductiveGrowth[7]` 物质库存；阶段转换时自由元素不清零。成熟达到90G后先锁定 MatureFruit 阶段，再按已确认反应规则形成 `Products[]`。
- **FlowerBud、Flower、GreenFruit统一取得母叶本次养分预算的80%（本轮锁定）**，而每片叶从Tree获得的首层份额仍是30%。MatureFruit后的**自然富集速度**按当前果实物质量M采用`0.5×clamp((150-M)/60,0,1)`倍率：90G起为成熟前同条件速度的50%，150G为0；不再采用原固定20%或指数衰减候选。LargeLeaf自身Growth保留效率60%，SmallLeaf没有同类损耗；这些不是Reserve提取比例。
- **开花时第一次固化生殖亲和，形成GreenFruit时第二次固化并锁定果实亲和**；两次固化之间只使用新增加的Growth继续塑形，不能重复计算固化前Growth。两次固化都不清空 `E_free[7]`。花苞与花期已经积累的 `E_free[7]` 全量进入青果及熟果，不生成结果后才开始的第二套元素储备。
- 花苞/花的可见时长由实际预算、Growth 0→12→40累计速率确定，**不引入独立倒计时**；前述57/64/76/95uh是旧0.998蒸发和`R/100`预算下的历史试算，**不属于当前M=95/W=12基线**；当前每日首果98uh，更多节点见[新校准](first-fruit-uh-calibration.md)。
- GreenFruit 在成熟前物质量 `M=ΣE_free` 达90G时成为成熟 Aquamelon，母叶同步纤维化为可采的 AquamelonLeaf；成熟事件锁定阶段，随后元素反应改变 `E_free`／`Products` 或总量 `M` 也不回退。成熟后按90～150G线性递减倍率继续向 `E_free` 富集，不自动采收；150G只停止自然富集、不裁剪反应产物。
- 果实在生长、反应、采摘时均不持久化最终品尝结论；最终按当前`E_free[7]+Products[]`及[七元素与反应风味](taste-model.md)解释，不采用旧27项Taste数值映射。
- 收获后如果母叶仍在，可在母叶采果后的新 Growth 达标时重生 FlowerBud；其具体新增 Growth 阈值尚需正式确定，**不采用固定24 uh时钟，也不复用母叶历史 Growth 直接触发**。

## 7. 外观与采摘价值

GreenFruit 外观青绿、柔软，内部是未稳定分层的元素粘液；结果以后即可早摘用于独立料理。随着生殖 Growth 接近90，外皮逐渐呈深褐木质质感，内部形成稳定的果壳、光滑内膜、果肉膜、清澈水瓜水。成熟果仍可表现少量闪光逸散。

采摘后活体器官转换为独立地面 Material，不再参加养分分配；不会自动进背包。加工不是通用 Recipe 框架，具体身份和继承关系如下。


## 8. 采摘、世界材料与上游养分回流

### 8.1 活体器官 -> 世界材料

当前不使用“同一个 Item + stage 字段”来覆盖不同采摘阶段。已经确认的每一种采摘结果都保持独立 material identity：

| 活体状态 | 采摘后的 Material | 中文 |
| --- | --- | --- |
| SmallLeaf | `TenderLeaf` | 嫩叶 |
| LargeLeaf | `ThickLeaf` | 肥厚的叶片 |
| Fruit Growth = 90 后同步纤维化的 parent Leaf | `AquamelonLeaf` | 水瓜树叶 |
| Green Fruit，`40 <= ReproductiveGrowth < 90` | `GreenFruit` | 青果 |
| Mature Fruit，`Growth >= 90` | `Aquamelon` | 水瓜 |

其中：

```text
before Fruit Growth 90:
Green Fruit
+ Thick / fleshy parent Leaf

Fruit Growth reaches 90:
Green Fruit -> Mature Fruit
parent Leaf -> fibrous Aquamelon Leaf
```

因此 `AquamelonLeaf` 的形成由所属 Fruit 的成熟事件触发，不由叶片自身额外计时。

采摘执行的是：

```text
Living Organ
-> harvest
-> world Material
```

转换完成后，该材料退出植物生长模拟，不再继续运行：

- Tree / Leaf nutrient allocation；
- organ Growth；
- on-tree enrichment。

世界材料作为场景中的独立对象存在，可以被搬运或直接放在地面；本轮不设计 inventory slot、stack size、container、pickup capacity 等系统。

### 8.2 果实采摘的数据语义

花苞阶段开始积累并进入青果、熟果的物质只有一个权威账户，成熟之前是 `E_free[7]`；成熟反应之后以 `E_free[7]` 和 `Products[]` 表示，`M = ΣE_free + ΣProducts.amount`。花期物质全部可食，不因结果而损失、复制或重新计量。

采摘青果或成熟水瓜时，独立世界材料完整继承该果实当时的 `E_free[7]`、`Products[]` 和已确认的材料身份、Affinity 语义。采摘是状态转移／快照，不新增第二套 `FruitElementAmount[7]`，不重新计算 `FlavorRatio`，也不生成最终 `Flavor`。

`MaterialType` 和 `Affinity[7]` 仍表达材料身份与元素倾向。其他叶片、果皮、汁液等加工产物的数据承载和物质分配按后续加工设计分别确定；不得将原有通用 `ElementAmount[7]` 或某种加工产物默认视作完整果实账户。

### 8.3 已确认的最小加工路线

Processing 把一个世界材料转换为一个或多个新的世界材料实体。产物不是原材料上的 component / tag，而是新的独立 material identity；`Affinity[7]` 的非数量语义独立于物质分配。加工后的 `E_free[7]`、`Products[]` 如何归属这些材料仍待独立设计，不能预先把各子材料定义为持有完整果实库存。

Green Fruit 路线：

```text
GreenFruit / 青果
-> 剥开
-> GreenFruitPeel / 青果皮
 + GreenFruitFlesh / 青果肉
```

- `GreenFruitPeel`：有弹性的独立材料；
- `GreenFruitFlesh`：胶冻 / 凝胶质地，承接青果内部混沌、尚未稳定分层的元素形态；不同元素可以形成明显不同质感，未来允许出现结晶、颗粒等表现。

Mature Aquamelon 路线：

```text
Aquamelon / 水瓜
-> 破开
-> AquamelonShell x2
 + AquamelonJuice x1
```

- `AquamelonShell`：两个半球形、木质 / 硬壳的独立材料实体；
- `AquamelonJuice`：一份稳定的成熟水瓜液体产物。

水瓜壳还确认存在一次继续处理：

```text
AquamelonShell
-> 进一步处理 / 剥取
-> AquamelonFlesh
 + remaining shell material
```

`AquamelonFlesh` / 水瓜肉从成熟水瓜壳内侧剥出，有弹性、口感类似椰果。当前只确认“可以从水瓜壳剥出一份水瓜肉”；剩余壳是否改名、质量、单果总产量、工具、耗时和损耗均不在本轮定义。

以下 identity 必须保持区分：

```text
GreenFruitFlesh != AquamelonFlesh
GreenFruitPeel  != AquamelonShell
```

当前不保留一个同时覆盖青果皮与成熟果壳的 generic `AquamelonPeel`。成熟果内部仍可在生物形态描述中存在“果壳 / 光滑内膜 / 果肉膜 / 清澈水瓜水”，但这些解剖层不自动等于可拾取 Material；`AquamelonPulpMembrane` 当前不是已经锁定的独立掉落材料。

上述多材料加工路线保留供完整版本；**2D Lua参赛版**确定「一颗成熟水瓜→唯一一份果汁」：旧熟果材料退出、汁材料完整承接`E_free[7]+Products[]`，不生成瓜壳/果肉副产物也不复制账本。多产物加工的物质分配仍待将来设计。不得提前指定 `GreenFruitFlesh` 或 `AquamelonJuice` 独占 `E_free[7] + Products[]`，也不能将该账户完整复制给每一个子材料。Processing 产物的 Affinity 既有继承原则不构成元素数量的分配公式。此处不定义各产物数量、质量守恒比例、yield、quality、freshness 或通用 Processing 框架。

### 8.4 采摘后的 leaf-local sink

Fruit 从形成后即可采摘；Green Fruit 不作为惩罚、失败或“没等够”的低级成果。

如果玩家移除 Flower 或采摘 Fruit：

```text
当前生殖器官的 leaf-local nutrient sink 消失
-> 所属母叶重新获得完整的自身 Leaf budget
-> 其它叶片与 Tree 的第一层预算保持不变
```

未来是否由此形成多汁叶、再次开花或其它分支，仍留给后续 Spec；当前不额外定义触发阈值或状态。

### 8.5 当前生命周期中的 Affinity 边界

当前 Sapling 器官链只需要以下 Affinity 语义：

```text
Tree 当前亲和
→ SmallLeaf 出生时一次性标准遗传
→ Leaf / Flower 根据自己的 Growth 独立塑形
→ 生殖 Growth 到 40、形成 GreenFruit 时锁定
→ Fruit 阶段不再塑形 Affinity
```

形成 GreenFruit 并锁定 Affinity 后，继续变化的是同一物质账户的 `E_free[7]`；成熟之后反应产物归入 `Products[]`。最终 Flavor 仅在品尝时派生，不随生长持久化。

当前版本不实现重新播种、多代亲和遗传、成熟后精炼或“老种子”生命周期。成熟后持续富集只为这些未来方向保留语义插口，不提前建立框架。

## 9. 体验与实施边界

积极玩家的**上线次数反馈目标**仍为24uh见Seedling、48uh见SmallLeaf、72uh见Flower、96uh可采摘成熟水瓜；当前M=95/W=12独立期望试算中每日首果98uh、隔天103uh、每3天104uh、每周138uh。168uh预计成熟果数分别2/2/2/1，**每日96uh首果仍晚2uh，每周第二叶已成为LargeLeaf**。不再使用休眠机制，长期稳定周产量仍未验证；各玩家类型仅有浇水时间的差异，不另配Growth倍率。详见[完整期望数据](first-fruit-uh-calibration.md)。

在 Reserve×Affinity 动态预算、根系上限、出芽风险频率与采收复花阈值全部落实前，任何旧固定百分比代谢、等待小时阈值或按平台另设的成长倍率都不应被写入当前设计或作为最终数值结论。千星正式游戏由服务端节点图实现，Web 是同一模型的现实时间加速实验，不共享代码。
