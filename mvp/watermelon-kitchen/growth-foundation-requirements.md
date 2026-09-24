# 水瓜厨房：基础生长链需求草案

本文用于逐条收敛“浇水 → 土壤元素 → 树体吸收 → Growth Tick → 三阶段成熟 → Debug”的第一条基础生长链。

当前只记录已经讨论到的方向和待确认问题，**不作为实现 Spec，也不直接进入开发**。后续每次只处理一个小节，确认后再继续下一项。

---

## 0. 当前目标边界

本轮希望最终形成的最小链路：

~~~text
Debug 生成元素球
→ 元素球落入 Soil 感应范围
→ Soil 捕获后直接累加到 SOIL_Elems
→ Level 发起 Growth Tick
→ Soil 在 Tick 开始时检查总量；若超容量则对当前 SOIL_Elems 整体等比例压缩
→ Soil 完成本 Tick
→ AquamelonTree 从 Soil 吸收
→ TREE_Elems / Reserve
→ 元素被转化为 TREE_Growth
→ Seedling → Sapling → Mature
→ Debug UI 可查看 / 修改当前作物状态
~~~

暂不处理：

- 叶片实际生长流程；
- 花 / 果；
- 子器官分流；
- 元素球自然刷新；
- 料理；
- 遗传落地；
- 最终数值平衡；
- 完整玩家交互。

---

## 0.1 当前确认状态

### 已明确确认

- [x] 本轮只围绕基础生长链：浇水 → 土壤元素 → 树体吸收 / 累积 → Growth → Seedling / Sapling / Mature → Debug 查看修改。
- [x] 本轮实体固定为 4 类：Soil、AquamelonTree、Level、Player。
- [x] CFG 不再使用结构体，恢复为普通变量和 `float[7]` 列表，命名继续采用 `CFG_xxx`。
- [x] Level 保存 Tree / Leaf / Fruit 等器官的基础亲和模板。
- [x] Tree / Leaf / Fruit 将来各自拥有个体亲和，不只永久读取全局 CFG。
- [x] Tree Stage 固定为 Seedling → Sapling → Mature。
- [x] Tree Reserve 与 Growth 分离；`TREE_Growth` 是七元素向量。
- [x] Stage 升级后清空当前 Growth，并在新 Stage 重新累计；Stage 本身不回退。
- [x] `RootPreference[7]` 与 Growth Affinity 正式分离：RootPreference 只负责 Soil → Tree Reserve 的“吃什么”，范围严格为 `0~1`；Affinity 不再参与吸收，继续负责 Reserve → Growth 的转换效率、连续学习与遗传，并允许超过 1。
- [x] 只保留连续学习，不使用阶段跃迁时的离散元素奖励。
- [x] Soil 捕获元素球时直接把 `BALL_Elems` 累加到 `SOIL_Elems`，不设 Pending 层、不在捕获时做容量计算。下一 Growth Tick 开始时若 Soil 总量超过容量，再对当前 `SOIL_Elems` 整体等比例压缩到容量，多余部分丢弃。
- [x] Debug UI 需要在游戏中查看 / 修改当前作物的自定义变量。
- [x] Debug UI 通过生成指定元素 / 数量的测试元素球来模拟浇水，而不是直接给 Soil 加数值。
- [x] 元素球进入 Soil 感应范围后才完成实际浇水。
- [x] `generate_elem_ball` 作为独立、未来可复用的节点图能力。
- [x] Growth Tick 改为“单位时间速率 + 实际 dt”的结算模型；在线更新周期只控制反馈频率，不控制最终生长总量。
- [x] 在线第一版倾向约 60 秒结算一次；未来可改成 30 秒等，不需要重新平衡每小时速率。
- [x] 土壤蒸发与树体 Growth 消耗当前都以“每小时保留约 99%”作为测试基线，并按 dt 使用连续时间公式。
- [x] Debug UI 必须能够立即推进下一次 Growth Tick；调试推进使用一个标准在线更新步长，不需要真实等待下一次调度。

### 已选方向，但实现细节未确认

- [x] Debug UI → `generate_elem_ball` → 元素球 → Soil 感应 → 直接累加 `SOIL_Elems`；下一 Growth Tick 再统一执行容量归一化。
- [~] Debug UI 作为开发期 Crop Inspector，处理 Soil / Tree Reserve / Tree Growth / Stage / Affinity / 手动 Tick 等状态。
- [x] Level 作为 Growth Tick 的调度起点；Soil 先完成容量归一化与蒸发，再进入 Tree 的一次完整 Growth Update。事件 / 信号只承担流程触发，不携带养分等业务数据。
- [~] 正常在线结算读取真实经过时间 dt；Debug 的“推进下一 Tick”属于额外的开发期时间推进能力。

### 仍待讨论

- [x] 父子器官亲和度：由当前 Stage 的 Growth Vector 计算亲和偏移；Stage 升级时固化为自身下一阶段 Base；生成子器官时按继承率传递偏移，自身亲和不变。
- [x] 元素球使用 `BALL_Elems[7]`；当前版本只生成纯净单元素球；在以 Tree 为中心的可配置圆环范围随机生成，并避免出生即进入 Soil 捕获区；靠近玩家时缓慢飘向玩家；颜色由所含元素决定；元素量随 Growth Tick 衰减。
- [x] Soil 容量约束：不存在 Pending。元素球捕获时只做 `SOIL_Elems += BALL_Elems`；下一 Growth Tick 若 `ΣSOIL_Elems > Capacity`，则整体等比例压缩到容量。
- [x] Growth Tick 的信号 / 流水线顺序与状态边界。
- [x] Soil Growth Tick：容量归一化 → 蒸发 → 进入 Tree Growth Update。
- [>] Tree 从 Soil 吸收的具体公式：已确认 RootPreference、Stage / dt 与“单元素不能撑满总吞吐量”的体验目标，具体 RootPreference 数值、单元素吸收饱和公式与各 Stage 速率仍待确认。
- [ ] Reserve → Growth 的完整公式与边界。
- [ ] 各 Stage 的 GrowthThreshold / MaxAbsorbPerHour。
- [ ] Debug UI 的具体控件和交互。
- [ ] 最终文件拆分与 Spec / Issue。

---

## 1. 实体边界

当前先固定 4 个实体 / 状态所有者：

### Level

职责候选：

- 保存全局 CFG 配置；
- 发起 Growth Tick；
- 作为生长流水线的调度起点。

配置继续使用普通变量 / 列表，不使用结构体。

基础命名继续采用：

~~~text
CFG_xxx
~~~

其中至少会有：

~~~text
CFG_TreeAffinity[7]
CFG_LeafAffinity[7]
CFG_FruitAffinity[7]
CFG_TreeRootPreference[7]
~~~

`CFG_TreeRootPreference[7]` 的具体七元素数值尚未确定；它不能直接复制 Affinity。RootPreference 的每个分量必须位于 `0~1`。

后续是否补充其他器官模板亲和，等对应器官进入范围再决定。

### Soil

职责：

- 保存土壤七元素储备；
- 感应进入范围的元素球；
- 在 Growth Tick 开头执行土壤容量归一化；
- 参与 Growth Tick 中的蒸发 / 供给。

基础状态：

~~~text
SOIL_Elems[7]
~~~

### AquamelonTree

职责：

- 从 Soil 获取元素；
- 保存内部元素储备；
- 保存 Growth Vector；
- 保存当前 Stage；
- 执行自身 Growth Tick 逻辑。

基础状态候选：

~~~text
TREE_Elems[7]
TREE_Growth[7]
TREE_BaseAffinity[7]
TREE_EffectiveAffinity[7]
TREE_RootPreference[7]
TREE_Stage
~~~

正式 Tree Stage 之前还有半埋在土里的 Seed 状态。Seed 在土壤满足激活条件后开始累计发芽进度，目标体验约 1～2 天，但具体时间作为参数可调。

Seed 暂不计入三个 Tree Stage：

~~~text
Seed
→ Germination
→ 0 = Seedling
→ 1 = Sapling
→ 2 = Mature
~~~

发芽进度使用单位时间速率：

~~~text
GerminationProgress
+= GerminationRatePerHour × dtHours
~~~

“浇够水”的具体激活阈值仍待确认。

### Player

职责：

- 持有 Debug UI 的选择状态；
- 生成测试元素球；
- 查看 / 修改指定 Soil / AquamelonTree 的自定义变量；
- 手动触发调试操作。

Debug 状态不应写入 Soil / Tree 本身。

---

## 2. 亲和度与遗传 —— 当前规则已确认

当前规则：

- CFG 中保存 Tree / Leaf / Fruit 等器官的基础亲和模板；
- 个体拥有自己的 Base Affinity 与 Effective Affinity；
- 亲和学习只读取当前 Stage 已经形成的 Growth Vector；
- Reserve / 当前储存元素不参与亲和学习，也不参与遗传；
- 只保留连续学习，不使用离散阶段奖励；
- 子器官只在“生成”这一瞬间继承一次父器官当前偏移；
- 当前继承率固定为：

~~~text
CFG_AffinityInherifanceRate = 0.5
~~~

### 2.1 Growth Vector → 当前亲和偏移

先计算当前 Stage 的总 Growth：

~~~text
GrowthTotal
=
Σ Growth[i]
~~~

当 `GrowthTotal > 0`：

~~~text
GrowthShare[i]
=
Growth[i] / GrowthTotal
~~~

当前总额外亲和：

~~~text
ExtraAffinity = 1
~~~

将这 1.0 的额外亲和按七元素 Growth 占比分配：

~~~text
AffinityOffset[i]
=
ExtraAffinity × GrowthShare[i]
~~~

当前实际亲和：

~~~text
EffectiveAffinity[i]
=
BaseAffinity[i] + AffinityOffset[i]
~~~

因此：

- Growth 总量决定“是否达到成长事件 / Stage 阈值”；
- Growth 的七元素构成决定完整 `ExtraAffinity = 1` 如何分配；
- Reserve 中当前还存着什么元素不直接影响 Effective Affinity；
- 只有已经真正转化成 Growth 的元素才会塑造亲和。

当 `GrowthTotal = 0` 时：

~~~text
AffinityOffset[i] = 0
EffectiveAffinity[i] = BaseAffinity[i]
~~~

### 2.2 自身长大：固化为下一 Stage Base

如果本次成长结果是该器官自身进入下一 Stage：

~~~text
Current EffectiveAffinity
→ Next Stage BaseAffinity
~~~

随后：

~~~text
Growth = zero vector
~~~

下一 Stage 从新的 BaseAffinity 和空 Growth Vector 重新累计。

因此同一个器官会把上一 Stage 已经形成的“表观亲和”固化成下一 Stage 的基础亲和。

### 2.3 生成子器官：只传递偏移

如果本次成长结果不是自身长大，而是生成一个子器官，则父器官自身的 Base / Effective Affinity 都不因此改变。

先取父器官当前偏移：

~~~text
ParentAffinityOffset[i]
=
ParentEffectiveAffinity[i]
-
ParentBaseAffinity[i]
~~~

按当前继承率：

~~~text
InheritedOffset[i]
=
ParentAffinityOffset[i]
× CFG_AffinityInherifanceRate
~~~

子器官以自己的器官 CFG 模板为起点：

~~~text
ChildBaseAffinity[i]
=
CFG_ChildAffinity[i]
+
InheritedOffset[i]
~~~

当前：

~~~text
CFG_AffinityInherifanceRate = 0.5
~~~

因此子器官保留“它是什么器官”的基础模板，同时继承父器官当前已经长出来的一半亲和偏移。

子器官出生后，再根据自己的 Growth Vector 独立计算 Effective Affinity。

### 2.4 当前暂不处理的分叉

在 Sapling 阶段，之后会同时存在：

~~~text
Growth 达标
├── 自身继续长大
└── 生成 / 培养叶片
~~~

这意味着同一份 Growth 未来可能面对多个成长目标。

当前还不决定：

- 两个目标的触发优先级；
- 是否使用同一个 GrowthThreshold；
- 长叶是否消耗 Tree Growth；
- Tree Growth 在生成叶片后是否部分保留；
- “长大”和“长叶”能否同时发生。

这一问题先挂起，不阻塞当前只实现 Tree 自身 Seedling → Sapling → Mature 的基础流程。


---

## 3. Debug 元素球与浇水 —— 当前规则已确认

Debug UI 不直接修改 `SOIL_Elems`，而是仍然通过真实元素球路径测试。

正式测试路径：

~~~text
Debug UI
→ 选择纯净元素与元素量
→ generate_elem_ball
→ 在 Tree 周围圆环随机生成元素球
→ 玩家靠近时元素球缓慢向玩家飘动
→ 元素球进入 Soil 感应区
→ Soil 捕获
→ BALL_Elems 直接累加到 SOIL_Elems
→ 元素球实体被消费
~~~

这里不再设置 `SOIL_PendingElems`。

### 3.1 元素球数据

元素球核心状态：

~~~text
BALL_Elems : float[7]
Tag        : ElementBall
~~~

虽然数据结构保留完整七元素向量，但当前版本只允许纯净元素球：

~~~text
同一颗球只有一个 BALL_Elems[i] > 0
~~~

元素球视觉根据 `BALL_Elems` 决定。当前纯净球直接使用唯一非零元素对应的颜色。

### 3.2 generate_elem_ball

`generate_elem_ball` 接收：

~~~text
InputElems : float[7]
~~~

当前调用方保证它是纯净单元素向量。

生成位置：

~~~text
以当前 Tree / 种植区中心为圆心
→ 在 [SpawnRadiusMin, SpawnRadiusMax] 圆环内
→ 随机角度生成
~~~

圆环内径必须大于 Soil 的直接捕获范围，基本保证元素球不会在生成瞬间就被 Soil 捕获。

具体半径数值、Prefab 和编辑器资源在实现 Spec 中确定。

### 3.3 元素球在线行为

元素球未被捕获时：

- 玩家进入一定吸引范围后，元素球缓慢向该玩家飘动；
- 颜色根据 `BALL_Elems` 表现；
- 元素量随时间衰减。

衰减沿用统一 Growth Tick 时间模型：

~~~text
BALL_Elems[i]
*= CFG_ElemBallRetentionPerHour ^ dtHours
~~~

元素球被 Soil 捕获并销毁后，不再继续执行元素球衰减。

### 3.4 Soil 捕获

Soil 拥有感应区。

当带有 `ElementBall` 标签的实体进入感应区时，只执行最简单的累加：

~~~text
SOIL_Elems[i]
+= BALL_Elems[i]
~~~

随后消费 / 销毁该元素球。

捕获阶段：

- 不执行容量比例计算；
- 不裁剪到 100；
- 不维护 Pending；
- 允许 `SOIL_Elems` 暂时超过容量。

容量约束统一留到下一次 Soil Growth Tick 开始时处理。

因此多个元素球连续进入时，本质上只是：

~~~text
SOIL_Elems
+= BallA
+= BallB
+= BallC
...
~~~

不需要额外的批处理状态。


---

## 4. 土壤容量约束 —— 最终方案已确认

Soil 不再区分“旧元素”和“新输入”，也不维护 Pending。

元素球被捕获时已经直接累加进：

~~~text
SOIL_Elems[7]
~~~

下一次 Soil Growth Tick 开始时，只检查当前 Soil 总量：

~~~text
SoilTotal
=
Σ SOIL_Elems[i]

C = Capacity
~~~

### 4.1 未超过容量

如果：

~~~text
SoilTotal <= C
~~~

则 Soil 不变。

### 4.2 超过容量

如果：

~~~text
SoilTotal > C
~~~

计算：

~~~text
KeepRatio
=
C / SoilTotal
~~~

然后所有元素统一等比例压缩：

~~~text
SOIL_Elems[i]
*= KeepRatio
~~~

于是：

~~~text
Σ SOIL_Elems[i]
=
C
~~~

超出的总量：

~~~text
Overflow
=
SoilTotal - C
~~~

当前版本直接丢弃。

未来气候系统可以把 `Overflow` 接入环境元素逸散，但本轮不处理。

### 4.3 示例

初始：

~~~text
雷 50
水 30
草 20
总量 100
~~~

捕获一个 50 雷元素球后，立即累加：

~~~text
雷 100
水 30
草 20
总量 150
~~~

此时可以暂时超过容量。

下一 Growth Tick：

~~~text
KeepRatio
=
100 / 150
=
2 / 3
~~~

归一化后：

~~~text
雷 ≈ 66.67
水 = 20
草 ≈ 13.33
总量 = 100
~~~

之后如果又捕获 50 雷：

~~~text
雷 ≈ 116.67
水 = 20
草 ≈ 13.33
总量 = 150
~~~

下一 Growth Tick 再压缩：

~~~text
雷 ≈ 77.78
水 ≈ 13.33
草 ≈ 8.89
总量 = 100
~~~

这形成的是逐次残留、逐步替换的递推过程。

### 4.4 数值边界

正常玩法元素量必须：

~~~text
>= 0
~~~

Debug UI 写入负数时，在 Debug 输入边界 clamp 到 0。

容量归一化每次 Soil Growth Tick 开头执行，因此 Debug 即使直接把 Soil 改到超容量，也会在下一 Tick 自动恢复。

### 4.5 算法摘要

~~~text
SoilTotal = Σ max(SOIL_Elems[i], 0)

if SoilTotal > Capacity:
    KeepRatio = Capacity / SoilTotal

    for each i:
        SOIL_Elems[i] *= KeepRatio
~~~

这一步完成后再继续：

~~~text
Soil evaporation
→ Tree absorption
~~~

不再需要独立的 `soil_element_mix_calc` 或 Pending 合并流程。


---

## 5. Growth Tick 时间模型与调度 —— 时间模型已确认，流水线待重点讨论

### 已确认：时间模型

Growth Tick 只表示一次结算事件，不再代表固定的自然时间单位。

正式规则使用：

~~~text
RatePerHour + dt
~~~

在线第一版倾向：

~~~text
CFG_GrowthUpdateIntervalSeconds = 60
~~~

每次正常在线结算读取：

~~~text
dt = Now - LastGrowthUpdateAt
~~~

如果 Timer 延迟，例如 60 秒计划实际 73 秒触发，就按 73 秒结算。

比例蒸发 / 消耗使用：

~~~text
New = Old × RetentionPerHour ^ dtHours
~~~

而不是“每 Tick 固定乘一次”。

离线结算也使用同一套 dt 公式，不逐分钟模拟在线 Tick；离散 Stage / 器官事件以后再做事件边界分段。

Debug UI 提供：

~~~text
Advance One Growth Tick
~~~

点击后立即推进一个标准在线步长：

~~~text
dt = CFG_GrowthUpdateIntervalSeconds
~~~

这是开发期时间推进，不属于正式玩家能力。

### 已确认：调度流水线与状态边界

Level 负责发起 Growth Tick。当前 Soil + Tree 的最小顺序固定为：

~~~text
Level GrowthTick
→ Soil：容量归一化
→ Soil：蒸发
→ Tree：一次完整 Growth Update
    → 读取配对 Soil
    → Calculate_Absorption
    → 修改 SOIL_Elems / TREE_Elems
    → Convert_Nutrient_To_Growth
    → 更新 TREE_Growth / Stage / Affinity
~~~

器官通信采用**消费者主动获取**：

~~~text
Tree
→ 读取 / 修改自己的配对 Soil
~~~

Soil 不需要知道 Tree 的类型、亲和、Stage 或成长规则。

事件 / 信号只负责触发流程和必要的实例路由，不负责传递养分向量或一次 Tick 的中间计算结果。多株植物仍需要用植物 / 实例身份确保事件落到正确对象；具体信号 API 留到实现 Spec 验证。

Tree 的一次 Growth Update 保持为一个完整业务流程，不机械拆成 TreeAbsorb.gia → TreeGrowth.gia → TreeStage.gia 再用公共变量通信。

状态原则：

~~~text
长期世界状态
→ 实体变量

一次 Tick 的短期结果
→ 节点连线 / 局部值

复杂数学
→ 独立公式能力（当前服务端实现可封装为复合节点）
~~~

例如 AbsorbElems、转换比例、临时 Growth 结果都不落为跨节点图共享的持久变量。

当前计划的两个主要公式边界是：

~~~text
Calculate_Absorption
Convert_Nutrient_To_Growth
~~~

这描述的是职责边界，不提前锁死 7.1 之后具体使用哪一种编辑器执行形式。


### 5.1 Soil → Tree Reserve 的当前设计目标

保留：

~~~text
SOIL_Elems
→ TREE_Elems / Reserve
→ TREE_Growth
~~~

这两层不是为了增加一次重复计算，而是用于表达外部环境与植物内部储备的不同状态。Tree Reserve 还承担离线缓冲、后续器官分流以及未来健康 / 富集 / 疾病系统的扩展接口。

Soil → Tree 这一步不再使用 Growth Affinity，而使用独立的：

~~~text
TREE_RootPreference[7]
~~~

语义是“根系更容易吃什么”，每个分量严格限制在：

~~~text
0 <= RootPreference[i] <= 1
~~~

Growth Affinity 保持原有语义：元素进入 Reserve 后，决定它转换成 Growth 的效率，并继续参与连续学习与遗传。

吸收公式还必须满足一个新的体验约束：

> 单一元素即使供应充足，也不能独自填满植物全部吸收 / 生长吞吐量。

因此不能把 MaxAbsorbPerHour(stage) 简单全部分配给当前唯一存在的元素。每个元素需要存在独立的有效吸收上限 / 饱和机制；多种元素共同存在时，各元素贡献可以叠加，使总吸收接近当前 Stage 的完整根系能力。

期望体验：

- 每天浇灌：可以长期保持接近满速成长；
- 约 3 天维护一次：仍属于高速成长；
- 约 7 天不补充：土壤应接近 / 达到完全耗尽；Tree Reserve 再提供一层缓冲；
- 只浇一种元素：定向培养有效，但因为其他元素不能补足吸收配额，总成长速度明显下降；
- 均衡 / 混合供给：更容易维持高吞吐量。

具体 RootPreference 数值、单元素饱和公式和 Stage 吸收速率仍是当前第 7 项需要继续收敛的内容。

### 5.2 培养结果的体验目标

吸收与后续 Growth / 果实规则最终需要支持以下玩家层次：

- 完全不了解系统的新人，把随机遇到的元素球都投入土壤，通常得到没有明显元素倾向、带少量随机差异的普通水瓜，整体味道接近普通水瓜基线；
- 新人仍可能偶然得到一两个亲和较高的 Hydro / Dendro 等元素水瓜，但复现性低，作为“发现系统存在”的惊喜；
- 有意识只投单元素能够稳定推动目标元素性状，但以显著降低生长速度为代价；
- “单元素水瓜”要求某一元素达到显著水平，并与第二 / 第三元素拉开足够差距；其他元素仍然存在，因此同类元素水瓜之间仍会有风味差异；
- 两种元素都处于较高水平、但第一元素没有形成明显单一主导时，可以形成元素反应型水瓜。水 + 草的草原核 / 绽放水瓜是当前第一个例子；其他反应暂不设计；
- 接近完全纯净的元素水瓜应当难培养、产量低、风味可能过于极端，更可能成为加工 / 工业型原料，而不是天然的最高品质。

上述分类阈值与“显著领先”的具体数字尚未锁定，后续在果实 / 元素培养设计中继续确认。

---

## 6. Debug UI —— 目标已确认，交互细节待讨论

当前目标不是做通用 GM 工具，而是做第一版 Crop Inspector。

需要至少能够：

~~~text
查看 / 修改：
SOIL_Elems[7]
TREE_Elems[7]
TREE_Growth[7]
TREE_Stage
TREE_BaseAffinity[7]
TREE_EffectiveAffinity[7]
TREE_RootPreference[7]

查看：
Soil Total
Tree Reserve Total
Tree Growth Total

操作：
生成指定元素 / 数量的测试元素球
立即推进下一次 Growth Tick（标准在线 dt）
~~~

Debug UI 状态归 Player 所有。

当前不要求：

- 输入任意变量名动态反射；
- 支持所有实体类型；
- 正式玩家 UI；
- 自动选择场景中的任意作物。

---

## 7. 讨论顺序

后续按以下顺序逐条确认，不一次展开多个主题：

- [x] 1. 亲和度与父子器官遗传
- [x] 2. Debug 元素球的数据结构与生成接口
- [x] 3. Soil 感应元素球与浇水流程
- [x] 4. 土壤容量竞争公式与边界
- [x] 5. Growth Tick 的信号 / 流水线顺序
- [x] 6. Soil Growth Tick
- [>] 7. Tree Growth Tick：吸收 / RootPreference / 单元素饱和
- [ ] 8. Tree Growth Tick：Reserve → Growth
- [ ] 9. Seedling → Sapling → Mature
- [ ] 10. Debug Crop Inspector
- [ ] 11. 文件拆分与最终 Spec / Issue

在以上内容逐条确认前，不进入实际实现。
