# 水瓜厨房 MVP：七元素养分、生长与材料

本文件为**现行玩法规则**；使用 [uh（等效小时）](../../docs/plants/uh-time-unit.md) 作为唯一数值时间单位，吸收速率为 V/uh，Growth 由实际养分与亲和度转换累计。Tick 只表示推进 `Δuh` 的结算事件，不能定义另一套速度或要求阶段固定等待一段时间。千星默认1 uh对应现实1小时，Web默认1 uh对应现实10秒且可调；两端共享玩法数值、独立实现。

## 1. 总体养分流

```text
富集的元素球（玩家收集）
     ↓
Soil_Elems[7] （容量1000；自然蒸发0.998/uh）
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
- Reserve 动态生长预算**由当前 Reserve 与 Tree Affinity 共同决定**。Tree Reserve容量180 V；总量≥100 V时**满速预算**、低于100 V时按`R/100`降速。**Tree Affinity>1允许预算提取总额放大，不再将七元素加权Affinity结果归一化到固定总额**；每种元素仍不能超过实际Reserve。预算参考系数尚待校准；不要改成固定百分比消耗。
- Soil 自然蒸发属于世界环境损耗，**不能与 Tree Reserve → Growth Budget 混为一谈**。

## 2. 时间与计算尺度

```text
Δuh = 实际经过秒数 / 当前平台 realSecondsPerUH
MaxRootAbsorbThisStep = MaxRootAbsorbVPerUH × Δuh
Soil_Elems[i] *= SoilRetentionPerUH ** Δuh
```

`SoilRetentionPerUH = 0.998`；该参数仅用于 Soil。千星可以每1 uh、1/12 uh或1/60 uh结算；Web当前1 uh=10秒，可以用更细时间片更新 UI，但要累计出完全相同的 uh 代谢。出芽等随机事件的次数不能随细分结算间隔增加。

当前模拟的生命周期事件全部按 Growth 阈值跨越处理，只有玩家实际可见花期等表现策略可能要求在离线回放时安排一个展示停点；这个停点不得丢失已累计 Growth。

## 3. 土壤与元素球

- `SOIL_Elems[7]` 是元素存量，容量1000 V。玩家点击「富集」生成等概率的一个纯净元素球，点击「收集」立即将球**当前剩余量**加入 Soil 并移除该球；「清空场地」不影响已经进入 Soil 的储备。
- 元素球没有普通玩法的自动刷新。每次「富集」生成等概率纯元素球，初始元素量**期望80 V**（具体上下限待定）；球按统一模型时间 **半衰期 0.25 uh**（对应千星的15分钟基线）衰减：`BALL_Elems[i] *= 0.5 ** (Δuh / 0.25)`；总元素量 **<1 V** 时销毁。Web 时间压缩只改变这些 uh 在现实中经历多久，不改变球的生命周期数值。
- Soil 若总量超过1000，下一次结算开始时按 `1000 / SoilTotal` 对七维存量等比例缩放；之后自然蒸发、再被植物吸收。超量直接损失，不设置隐藏回收池。
- RootPreference = `[0.80, 1.00, 0.85, 0.75, 1.00, 0.70, 0.90]`。
- Tree 初始 Base Affinity = `[0.85, 1.15, 0.90, 0.75, 1.20, 0.70, 0.95]`。
- 单元素通道基础上限份额为 `0.30 × 对应 Tree Affinity`；根系上限按 Seed / Seedling / Sapling 阶段分别校准（当前候选2.0/1.85/14 V/uh，并未最终批准）。Sapling Reserve≤100 V时根系满速，100～180 V时按ln下降，180 V时停止吸收；多元素仍受 Soil 可用量、RootPreference、通道cap与阶段总cap限制。见[第一周期望校准](first-fruit-uh-calibration.md)。
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

### Seed / Seedling Stage 升级

Seed / Seedling 自身进入下一 Stage：

```text
TREE_EffectiveAffinity
→ 下一 Stage TREE_BaseAffinity

TREE_Growth
→ 清零
```

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
| Seed → Seedling | Seed Growth 45 |
| Seedling → Sapling | Seedling Growth 90 |
| Sapling 自身亲和再塑形 | TREE_Growth 100（只循环塑形，不升级 Mature Tree） |
| Bud → SmallLeaf | BUD_Growth 20 |
| SmallLeaf → LargeLeaf | 本叶 Growth 26 |
| LargeLeaf → 生成 FlowerBud | 本叶新阶段 Growth 18 |
| FlowerBud → Flower | 同一生殖 Growth 26 |
| Flower → GreenFruit | 同一生殖 Growth 40 |
| GreenFruit → Mature Aquamelon | 同一生殖 Growth 90 |

每段的典型成长 **uh** 只是按正常养分供给反算 Growth 阈值的体验目标，例如嫩叶约12 uh、肥厚叶约12 uh、花苞约24 uh、可见花期约12 uh。不存在强制等待到相应时间才进阶的隐藏计时器。

- Seed 生长达45时固化当前亲和，进入 Seedling 后按下一阶段重新积累 Growth；Seedling 达90后进入 Sapling 并获得 Reserve。
- Sapling 从 Soil 读取养分进入 Reserve；按动态预算取用并向已有叶片优先分流。已形成叶上限3片；每叶第一层预算名义份额30%，0/1/2/3叶时 Tree 余额分别为100%/70%/40%/10%，若叶未实际吸收则未用份额回归 Tree。
- 在没有 Bud 时 Tree 预算结算为 TREE_Growth，达到100完成一次亲和塑形周期；有 Active Bud 时原本属于主干自身的 GrowthGain 进入 BUD_Growth。掐芽时全部 BUD_Growth 回到 TREE_Growth；Bud 达20则形成独立 SmallLeaf，继承出生时父亲和偏移。
- 出芽0/1/2/3叶原概率值为80%/40%/1%/0。**投掷机会频率和是否按等效 uh 拆分为连续风险待统一批准**，禁止把一次结算事件自动当成一次新出芽机会。
- Sapling Reserve 活性/休眠门槛 `30/80` 目前是需继续校准的候选边界；因供养中断进入休眠时仍允许根系恢复吸收。

## 6. Leaf → Flower → Fruit

生殖器官是所属母叶的附属器官，**只取母叶本次获得的预算，不影响其他叶片，也不二次向 Tree 索要养分**。

- SmallLeaf 出生时继承当前 Tree 的亲和偏移，之后按自己的 Leaf Growth[7] 塑形。**SmallLeaf 的阶段 Growth 达到 26 时，先将当前 EffectiveAffinity 固化为 LargeLeaf BaseAffinity，再将该叶阶段 Growth[7] 清零**；LargeLeaf 从新的零基线累计 **18 Growth**，达标后生成附属 FlowerBud。这里清零的只是母叶自己的阶段 Growth；**FlowerBud 新建的 ReproductiveGrowth[7] 从零开始，此后开花、结果、成熟均不重置该生殖向量**。
- FlowerBud 拥有独立于母叶的 `ReproductiveGrowth[7]`；**花苞 0→26、Flower 26→40、GreenFruit 40→90、成熟果 90+ 全程沿同一向量累计，开花和结果都不清零。**
- FlowerBud / Flower 占母叶本次养分预算**40%**，GreenFruit 占85%（80%～90%校准区间的当前候选），成熟果占20%。LargeLeaf 自身组织的 Growth 保留效率为60%，SmallLeaf 没有同类损耗；这些不等于 Reserve 的抽取比例。
- 花和果继续按自身 Growth 的元素组成塑形亲和；形成 GreenFruit 时锁定当前生殖亲和，并从此开始累计另外一份 `FruitElementAmount[7]`；之前用于器官形成的 Growth 不被复制成可食元素储备。
- 花结果约12 uh是期望的可见体验，由 Growth 26→40 与真实供养速率共同决定；不独立倒计时。
- GreenFruit 达生殖 Growth 90 时成为成熟 Aquamelon，母叶同步纤维化为可采的 AquamelonLeaf；成熟后仍可以低效率继续富集，Flavor 不锁定、不自动采收。
- `FlavorRatio[i] = FruitElementAmount[i] / Σ FruitElementAmount`，总量为0时不生成 Flavor。元素量与风味之间不新增历史 Taste/绽放算法。
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
| Green Fruit，`40 <= Growth < 90` | `GreenFruit` | 青果 |
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

### 8.2 材料的最小元素数据语义

当前每个具体材料实例至少具有以下元素相关语义：

```text
MaterialType
ElementAmount[7]
Affinity[7]
```

`FlavorRatio` 仍然只由元素量比例派生：

```text
FlavorRatio[e]
= ElementAmount[e] / sum(ElementAmount)
```

总元素量为 0 时视为尚未形成 Flavor。当前只锁定这些语义，不提前设计统一的 generic material / item / component framework，也不把上述具体材料压缩为 `Material(type, stage)`。

活体器官转换为世界材料时如何把其当前 Growth / FruitElementAmount 等运行态映射到材料的 `ElementAmount`，留到对应实现 Spec；本轮不额外发明转换公式。

### 8.3 已确认的最小加工路线

Processing 把一个世界材料转换为一个或多个新的世界材料实体。产物不是原材料上的 component / tag，而是新的独立 material identity，并拥有自己的 `ElementAmount[7]` / `Affinity[7]` 语义。

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

当前 Processing 应用 [植物材料设计原则](../../docs/plants/material-design-principles.md) 的 v0 边界：

- 每个 Processing 产物都完整继承其来源材料的 `Affinity[7]`。Affinity 表达材料 / 组织的元素倾向，当前不按质量拆分、不做组织衰减，也不作为守恒数量重新计算。
- `GreenFruitFlesh` 是 Green Fruit 的 growth accumulation carrier：Green Fruit 形成后在树上持续累计的 `FruitElementAmount[7]` / growth accumulation 由它承载；`GreenFruitPeel` 是已经形成的结构组织，不承载这部分持续生长累积。
- `AquamelonJuice` 是 Mature Aquamelon 的 growth accumulation carrier：成熟果继续挂树富集形成的 `FruitElementAmount[7]` / growth accumulation 由它承载；`AquamelonShell` 是已经形成的结构组织，不承载这部分继续增长的累积。
- `AquamelonShell -> AquamelonFlesh + remaining shell material` 中，`AquamelonFlesh` 与 remaining shell 都是从已经形成的成熟组织中取得的结构材料，不作为 on-tree growth accumulation carrier；二者仍完整继承来源 `AquamelonShell` 的 Affinity。
- “结构组织不承载持续生长累积”不等于“结构材料没有元素”。这些材料仍可拥有自己的 `ElementAmount[7]`；其基础来源与数值当前未定义。

这里锁定的是生长累积的**承载语义**，不是 Processing 数值分配公式。当前仍不设计固定比例拆分、mass conservation、yield、quality、freshness 或 generic processing engine。

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

Fruit 形成以后继续变化的是 `FruitElementAmount[7]` 与其派生的 `FlavorRatio[7]`，不是 Affinity。

当前版本不实现重新播种、多代亲和遗传、成熟后精炼或“老种子”生命周期。成熟后持续富集只为这些未来方向保留语义插口，不提前建立框架。

## 9. 体验与实施边界

积极玩家的校准目标为20–22 uh见 Seedling、**60 uh见 Sapling**、168 uh内成熟首果；**每周上线一次的玩家第168 uh回访亦应得到成熟水瓜，且Soil已干、Reserve约30V；每日上线玩家应更早收获且Reserve更健康**；每天维护的成熟生产目标约4–6果/168 uh，间歇维护2–4果/168 uh，每周一次约2果/168 uh。三个行为仅通过 Soil 的真实补给历史形成差异，不用不同的成长公式。

在 Reserve×Affinity 动态预算、根系上限、出芽风险频率与采收复花阈值全部落实前，任何旧固定百分比代谢、等待小时阈值或按平台另设的成长倍率都不应被写入当前设计或作为最终数值结论。千星正式游戏由服务端节点图实现，Web 是同一模型的现实时间加速实验，不共享代码。
