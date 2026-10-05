# 水瓜厨房：基础生长链需求草案

本文用于逐条收敛“浇水 → 土壤元素 → 树体吸收 → Growth Tick → Seed / Seedling → Sapling 长期器官循环 → Debug”的第一条基础生长链。

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
→ Seed / Seedling：直接转化为 Growth
→ Sapling 起：先进入 TREE_Elems / Reserve，再进入 Growth / 器官分流
→ 每日 04:00 出芽检查
→ Bud / Leaf / Flower / Fruit 长期循环
→ Debug UI 可查看 / 修改当前作物状态
~~~

本文件现在同时记录已确认的 Sapling 后半段生命周期合同，但**本轮仍不进入 runtime 实现**。当前第一条实现切片暂不处理：

- Leaf / Flower / Fruit 的实际节点图与 runtime；
- 独立 scheduler / timer manager；
- 元素球自然刷新；
- 料理与具体 Flavor 扩展；
- 遗传落地；
- 最终数值平衡；
- 完整玩家交互。

---

## 0.1 当前确认状态

### 已明确确认

- [x] 本轮围绕基础生长链：浇水 → 土壤元素 → 树体吸收 / 累积 → Growth → Seedling → Sapling 长期器官循环 → Debug 查看修改。
- [x] 生长结算层当前固定 4 个状态所有者：Soil、AquamelonTree、Level、Player；采摘后的 world Material 是下游世界对象，不作为第五个 Growth Tick 状态所有者。
- [x] CFG 不再使用结构体，恢复为普通变量和 `float[7]` 列表，命名继续采用 `CFG_xxx`。
- [x] Level 保存 Tree / Leaf / Fruit 等器官的基础亲和模板。
- [x] Tree / Leaf / Fruit 将来各自拥有个体亲和，不只永久读取全局 CFG。
- [x] 当前版本 Tree 主阶段为 Seedling → Sapling；Sapling 是主要长期玩法阶段，Mature 最终设计延后。
- [x] Tree Reserve 与 Growth 分离；`TREE_Growth` 是七元素向量。
- [x] Seed / Seedling 升级后清空当前 Growth 并在新阶段重新累计；Sapling 不再升级，主干每累计 100 Growth 完成一次自身亲和塑形周期。
- [x] `RootPreference[7]` 与 Growth Affinity 正式分离：RootPreference 负责混合 Soil 中“更偏向吃什么”，范围严格为 `0~1`；Affinity 不再充当吸收偏好权重，但会影响单元素吸收 Cap，并继续负责 Growth 转换效率、连续学习与遗传，允许超过 1。
- [x] 只保留连续学习，不使用阶段跃迁时的离散元素奖励。
- [x] Soil 捕获元素球时直接把 `BALL_Elems` 累加到 `SOIL_Elems`，不设 Pending 层、不在捕获时做容量计算。下一 Growth Tick 开始时若 Soil 总量超过容量，再对当前 `SOIL_Elems` 整体等比例压缩到容量，多余部分丢弃。
- [x] Debug UI 需要在游戏中查看 / 修改当前作物的自定义变量。
- [x] Debug UI 通过生成指定元素 / 数量的测试元素球来模拟浇水，而不是直接给 Soil 加数值。
- [x] 元素球进入 Soil 感应范围后才完成实际浇水。
- [x] `generate_elem_ball` 作为独立、未来可复用的节点图能力。
- [x] Growth Tick 改为“单位时间速率 + 实际 dt”的结算模型；在线更新周期只控制反馈频率，不控制最终生长总量。
- [x] 在线第一版倾向约 60 秒结算一次；未来可改成 30 秒等，不需要重新平衡每小时速率。
- [x] 土壤蒸发与 Sapling 起的 Tree Reserve Growth 消耗当前都以“每小时保留约 99%”作为测试基线，并按 dt 使用连续时间公式；Seed / Seedling 没有 Reserve。
- [x] Tree RootPreference 已锁定为 `[0.80, 1.00, 0.85, 0.75, 1.00, 0.70, 0.90]`。
- [x] 基础总吸收上限已锁定为 `CFG_MaxTotalAbsorbPerHour = 1.0`，当前所有 Tree Stage 使用同一总上限。
- [x] 单元素基础吸收 Cap 已锁定为 `0.30 × Affinity[i]`；高 Affinity 同时提高对应元素通道上限和 Growth 转换效率。
- [x] Seed / Seedling 不拥有 Reserve，吸收后直接转化为 Growth；Sapling 起才开始拥有 `TREE_Elems[7]`。
- [x] Seed → Seedling 的 GrowthThreshold 已锁定为 45；Seedling → Sapling 已锁定为 90。普通随机满速基线下约 47.35h + 94.70h，总计约 5.92 天。
- [x] Sapling 主干 Growth 周期阈值 = 100；达到后只更新 / 固定自身元素亲和，不进入下一 Stage。
- [x] 出芽只在服务器时间每日 04:00 检查一次：0叶 0.80、1叶 0.40、2叶 0.01、3叶 0。
- [x] Bud 使用独立 `BUD_Growth[7]`，阈值 = 20；Active Bud 存在时，Tree 自身本应获得的 GrowthGain 全部进入 Bud。
- [x] 玩家掐掉未完成 Bud 时，`BUD_Growth` 完整合并回 `TREE_Growth`；Bud 正常到 20 后生成 SmallLeaf，SmallLeaf 在出生瞬间按当前 Tree 的标准父子器官亲和继承规则取得自己的 Affinity 初值，之后独立塑形、不实时跟随 Tree。
- [x] 叶片分流继续使用本 Tick 生长养分预算：0叶 Tree 1.0；1叶 Tree 0.7 + Leaf 0.3；2叶 Tree 0.4 + 两叶各0.3；3叶 Tree 0.1 + 三叶各0.3。三叶时主干几乎停止是预期结果。
- [x] Bud → SmallLeaf 后的开花前生命周期使用集中 elapsed-time settlement：SmallLeaf 约 12h → LargeLeaf；再 12h → FlowerBud；再约 24h → bloom boundary。不得为三段分别建立独立 Timer。
- [x] 离线恢复首次跨过某个 FlowerBud 的 bloom boundary 时，该器官停在“Flower 刚开始”，本次离线恢复不继续推进其 Flower Growth；玩家登录后开始可见花期。不得因此建立复杂 scheduler。
- [x] Flower / Fruit 使用同一生殖器官 Growth 轴：Flower 0→30；到 30 花凋谢、形成 Fruit 并锁定当前 Affinity；Fruit 从 30 继续，30≤Growth<100 为 Green Fruit，Growth≥100 为 Mature Fruit。
- [x] 生殖器官 sink 是第二层、leaf-local 分流：分母只等于所属母叶本次 settlement 获得的 Growth Nutrient Budget；Flower ≈50%、Green Fruit 80–90%（保留校准区间）、Mature Fruit ≈20%。它们不参与 `Tree -> Tree self + each Leaf` 的第一层预算竞争，也不改变其它叶片的预算。
- [x] Fruit 形成后不再塑形 Affinity，改为累计 `FruitElementAmount[7]`；`FlavorRatio[e] = FruitElementAmount[e] / ΣFruitElementAmount`，总量为 0 时尚未形成 Flavor。FlavorRatio 为派生值，不额外持久化重复向量。
- [x] Fruit 形成后即可采摘；Green Fruit 是独立料理材料而非失败状态。Growth=100 只表示物理成熟，不锁 Flavor、不停止元素累计、不自动采摘。
- [x] Mature Fruit 达到 100 后仍可从所属母叶当次预算中按约 20% 的低 sink 继续富集，所以 `FruitElementAmount` / `FlavorRatio` 仍可变化；未来催化 / 精炼 / 老种子只保留语义插口，不定义规则。
- [x] 叶片采摘 identity 已确认：SmallLeaf -> `TenderLeaf` / 嫩叶；LargeLeaf -> `ThickLeaf` / 肥厚的叶片。
- [x] Fruit Growth 达到 100 时，Green Fruit -> Mature Fruit 与 parent Leaf -> fibrous Aquamelon Leaf 同步发生；该叶采摘后为 `AquamelonLeaf` / 水瓜树叶，不是叶片自身按时间自然成熟。
- [x] 果实采摘 identity 已确认：Green Fruit -> `GreenFruit` / 青果；Mature Fruit -> `Aquamelon` / 水瓜。采摘后 world Material 退出 Tree / Leaf nutrient allocation、organ Growth 与 on-tree enrichment。
- [x] 当前具体材料保持独立 MaterialType；每个材料至少携带 `MaterialType`、`ElementAmount[7]`、`Affinity[7]` 语义，`FlavorRatio` 继续从 ElementAmount 比例派生，不重复持久化。
- [x] GreenFruit 加工已确认：`GreenFruit -> GreenFruitPeel + GreenFruitFlesh`；Aquamelon 加工已确认：`Aquamelon -> AquamelonShell x2 + AquamelonJuice x1`；`AquamelonShell` 可继续处理出 `AquamelonFlesh` + remaining shell material。
- [x] `GreenFruitFlesh != AquamelonFlesh`，`GreenFruitPeel != AquamelonShell`；不建立同时覆盖两者的 generic `AquamelonPeel`，`AquamelonPulpMembrane` 当前也不是锁定的独立拾取材料。
- [x] Processing 产物拥有独立元素数据的能力已保留，但 ElementAmount / Affinity 如何在产物间分配、yield / mass conservation 等公式本轮保持未定义。
- [x] 离线恢复按事件边界回放：连续 Growth 区间用真实 dt 批算；跨过 04:00 时先结算此前 Growth，再用当时真实 LeafCount / Bud 状态投一次出芽；SmallLeaf / LargeLeaf / FlowerBud 边界与 Flower/Fruit 的 30 / 100 也进入同一集中 settlement，首次跨 bloom boundary 时遵守可见花期停点。
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
- [>] Tree 从 Soil 吸收：RootPreference、总吸收上限 1.0/h、单元素 `0.30 × Affinity` Cap 和 Stage 不改变总吸收上限均已确认；仍待确认 Base / Effective Affinity 取值以及多元素重分配算法。
- [>] Sapling 起 Reserve → Growth：Tree / Leaf 第一层分流、Bud Growth 路由，以及每片 Leaf 内部的 Flower / Fruit 第二层 leaf-local sink baseline 已确认；仍待确认 Reserve 上限、Dormant 阈值以及实现时的具体 Growth rate 校准。
- [x] Stage：Seed → Seedling = 45、Seedling → Sapling = 90 已确认；Sapling 作为当前长期终态，不再推进 Mature。
- [x] Sapling 器官链：每日出芽、Bud=20、最多3叶、Tree/Leaf 分流、SmallLeaf/LargeLeaf/FlowerBud 时间边界、Flower 0→30、Fruit 30→100、Affinity 锁定点与 Fruit Flavor ratio 数据边界均已确认。
- [ ] Debug UI 的具体控件和交互。
- [ ] 最终文件拆分与 Spec / Issue。

---

## 1. 生长结算状态所有者边界

当前先固定 4 个 Growth Tick 状态所有者。采摘后生成的 world Material 属于下游世界对象，不改变这里的生长结算所有权划分：

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

`CFG_TreeRootPreference[7]` 已锁定：

~~~text
[0.80, 1.00, 0.85, 0.75, 1.00, 0.70, 0.90]
~~~

RootPreference 的每个分量必须位于 `0~1`。

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
BUD_Growth[7]              # 仅 Active Bud 存在时
TREE_BaseAffinity[7]
TREE_EffectiveAffinity[7]
TREE_RootPreference[7]
TREE_Stage
~~~

正式 Tree Stage 之前还有半埋在土里的 Seed 状态。当前版本阶段：

~~~text
Seed
→ 0 = Seedling
→ 1 = Sapling

Sapling = 当前长期玩法阶段
Mature = 延后设计
~~~

Seed 与 Seedling 当前都没有 Tree Reserve，直接：

~~~text
Soil
→ Absorb
→ Growth Conversion
→ Growth Vector
~~~

不再维护独立的 `GerminationProgress / GerminationRatePerHour`。

当前已锁定：

~~~text
Seed → Seedling:
GrowthThreshold = 45
普通随机满速 ≈ 47.35h

Seedling → Sapling:
GrowthThreshold = 90
普通随机满速 ≈ 94.70h
~~~

目标体验：积极玩家第三个自然日看到已经发芽的幼苗，持续规律维护约一周进入 Sapling。

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

### 2.4 Sapling 主干与出芽竞争 —— 已确认

Sapling 不再继续升级到 Mature。当前同一份 Tree Own GrowthGain 在“主干自身亲和塑形”和“当前 Active Bud”之间二选一：

~~~text
没有 Active Bud
→ Tree Own GrowthGain → TREE_Growth

存在 Active Bud
→ Tree Own GrowthGain → BUD_Growth
~~~

其中：

~~~text
TREE_Growth cycle = 100
BUD_Growth threshold = 20
~~~

Bud 正常到 20 后生成 SmallLeaf；玩家提前掐芽，则 Bud Growth 完整并回 TREE_Growth。

SmallLeaf 的初始 Affinity 不取 Bud 的实时状态，而是在出生这一刻直接使用 2.3 的标准子器官继承规则，从当前 Tree 继承一次。之后 SmallLeaf 只根据自己的 Growth 更新 Effective Affinity，不实时跟随 Tree。

因此“掐芽催熟”不是额外加速，而是主动放弃叶片扩张、把已投入芽的 Growth 收回主干。


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

当前数值基线：

~~~text
InitialAmount = random(8, 10)
HalfLife = 15 min
DestroyThreshold = total < 1
SpawnCheckInterval = 5 min
~~~

元素球未被捕获时：

- 玩家进入一定吸引范围后，元素球缓慢向该玩家飘动；
- 颜色根据 `BALL_Elems` 表现；
- 按真实时间使用 15 分钟半衰期：

~~~text
BALL_Elems[i]
*= 0.5 ^ (dtMinutes / 15)
~~~

当总量小于 1 时销毁。

每 5 分钟最多尝试生成 1 个新球。生成概率读取当前场上未捕获元素球的元素总量：

~~~text
FieldBallTotal
=
Σ all active BALL_Elems

SpawnChance
=
1 / (1 + (FieldBallTotal / 28)^3)
~~~

没有硬性 8 球上限；设计目标是通过总元素压力让大部分时间自然停留在约 8 个有效球以内。

登录时最多回放最近 30 分钟的正常刷新历史，并按每颗球真实 SpawnTime / age 计算衰减：

~~~text
SimulateWindow
=
min(actualOfflineElapsed, 30 min)
~~~

不额外创建独立的“登录补偿球”规则。

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


### 5.1 Soil → Tree 的当前吸收基线

RootPreference：

~~~text
CFG_TreeRootPreference[7]
=
[0.80, 1.00, 0.85, 0.75, 1.00, 0.70, 0.90]
~~~

固定总吸收上限：

~~~text
CFG_MaxTotalAbsorbPerHour = 1.0
~~~

当前 Seed / Seedling / Sapling 都使用同一个总吸收上限。Seed / Seedling 通过 GrowthThreshold 推进；Sapling 不再升级，而是在长期器官循环中持续使用同一吸收上限。

单元素基础 Cap：

~~~text
SingleElementBaseCapShare = 0.30

ElementCap[i]
=
1.0 × 0.30 × Affinity[i]
~~~

按当前 Tree 基础 Affinity：

~~~text
Fire     0.255 / h
Hydro    0.345 / h
Anemo    0.270 / h
Electro  0.225 / h
Dendro   0.360 / h
Cryo     0.210 / h
Geo      0.285 / h
~~~

RootPreference 决定混合 Soil 中“更偏向吃什么”；Affinity 决定对应元素通道的最大吞吐，同时继续决定吸收后 Growth Conversion 的效率。

这故意形成：

~~~text
高 Affinity
→ 单元素通道更高
→ 同样元素转化 Growth 更高效
→ 为未来高亲和高产品种留下长期价值
~~~

Seed / Seedling：

~~~text
Soil
→ Absorb
→ 直接 Growth Conversion
~~~

Sapling 起：

~~~text
Soil
→ Reserve
→ Growth metabolism / 器官分流
~~~

当前仍待确认：

- ElementCap 使用 BaseAffinity 还是实时 EffectiveAffinity；
- 多元素在 RootPreference、各元素 Cap、Soil 可用量之间的最终重分配算法；
- Sapling 起 Reserve → Growth 的完整数值。

维护体验与详细推算统一见 [基础生长数值速查](growth-balance-baseline.md)。

### 5.2 培养结果的体验目标

吸收与后续 Growth / 果实规则最终需要支持以下玩家层次：

- 完全不了解系统的新人，把随机遇到的元素球都投入土壤，通常得到没有明显元素倾向、带少量随机差异的普通水瓜；当前 v0 的 Fruit Flavor 直接由结果后累计七元素量的比例解释，不在本基础链中转换成另一套味道数值；
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

## 7. 活体器官、世界材料与最小加工 —— 已确认

当前材料身份合同只回答“什么活体阶段采摘成什么材料、已确认的最小加工会产出什么”。它不建立背包、堆叠、容器或通用 Item / Processing framework。

~~~text
SmallLeaf -> TenderLeaf / 嫩叶
LargeLeaf -> ThickLeaf / 肥厚的叶片

Fruit Growth reaches 100:
Green Fruit -> Mature Fruit
parent Leaf -> fibrous Aquamelon Leaf

fibrous parent Leaf -> harvest -> AquamelonLeaf / 水瓜树叶

Green Fruit -> harvest -> GreenFruit / 青果
Mature Fruit -> harvest -> Aquamelon / 水瓜
~~~

`AquamelonLeaf` 的成熟与所属 Fruit 的 `Growth = 100` 是同一个事件，不新增 Leaf timer，也不改 Flower / Fruit 的 0 -> 30 -> 100 时间线。

采摘后的材料退出植物 Growth 模拟。材料实例至少保留：

~~~text
MaterialType
ElementAmount[7]
Affinity[7]
~~~

`FlavorRatio` 继续由 `ElementAmount` 的比例派生；是否最终采用统一数据结构，本轮不决定。

当前 Processing 只锁定三条关系：

~~~text
GreenFruit
-> GreenFruitPeel
 + GreenFruitFlesh

Aquamelon
-> AquamelonShell x2
 + AquamelonJuice x1

AquamelonShell
-> AquamelonFlesh
 + remaining shell material
~~~

`GreenFruitFlesh` 与 `AquamelonFlesh` 是不同材料；`GreenFruitPeel` 与 `AquamelonShell` 也是不同材料。成熟果的“果肉膜”仍可作为解剖描述存在，但当前不强制变成独立拾取 Material。

本轮明确不定义：

- inventory / stack / container；
- generic material / item component framework；
- generic processing graph / recipe engine；
- Processing 时 `ElementAmount` 的产物分配；
- Processing 时 `Affinity` 的继承 / 变化；
- yield / mass conservation / quality / durability / freshness / spoilage。

---

## 8. 讨论顺序

后续按以下顺序逐条确认，不一次展开多个主题：

- [x] 1. 亲和度与父子器官遗传
- [x] 2. Debug 元素球的数据结构与生成接口
- [x] 3. Soil 感应元素球与浇水流程
- [x] 4. 土壤容量竞争公式与边界
- [x] 5. Growth Tick 的信号 / 流水线顺序
- [x] 6. Soil Growth Tick
- [>] 7. Tree Growth Tick：吸收 / RootPreference / 单元素饱和（数值基线已锁，剩余分配算法待确认）
- [>] 8. Tree Growth Tick：Sapling 起 Reserve → Growth（Tree/Leaf/Bud 分流与 Flower / Fruit sink baseline 已锁，Reserve 与具体 Growth rate 校准待确认）
- [x] 9. Seed → Seedling → Sapling（45 / 90 已锁；Sapling 为当前长期终态）
- [x] 10. Sapling 每日出芽 / Bud / 0~3叶 / Flower / Fruit 生命周期合同（时间边界、30/100、Affinity lock、FruitElementAmount / FlavorRatio 已锁）
- [ ] 11. Debug Crop Inspector
- [ ] 12. 文件拆分与最终 Spec / Issue

在以上内容逐条确认前，不进入实际实现。
