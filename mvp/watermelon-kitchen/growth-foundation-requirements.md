# 水瓜厨房：基础生长链需求草案

本文用于逐条收敛“浇水 → 土壤元素 → 树体吸收 → Growth Tick → 三阶段成熟 → Debug”的第一条基础生长链。

当前只记录已经讨论到的方向和待确认问题，**不作为实现 Spec，也不直接进入开发**。后续每次只处理一个小节，确认后再继续下一项。

---

## 0. 当前目标边界

本轮希望最终形成的最小链路：

~~~text
Debug 生成元素球
→ 元素球落入 Soil 感应范围
→ Soil 捕获并累加到 SOIL_PendingElems
→ Level 发起 Growth Tick
→ Soil 在 Tick 开始时批量合并 Pending 并进行一次容量竞争
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
- [x] 提取养分时 Affinity > 1 按 1 处理；转换 Growth 时使用完整 Affinity。
- [x] 只保留连续学习，不使用阶段跃迁时的离散元素奖励。
- [x] Soil 容量竞争在本轮实现：超容量时按旧土壤全部元素当前比例挤出，再加入新输入。
- [x] Debug UI 需要在游戏中查看 / 修改当前作物的自定义变量。
- [x] Debug UI 通过生成指定元素 / 数量的测试元素球来模拟浇水，而不是直接给 Soil 加数值。
- [x] 元素球进入 Soil 感应范围后才完成实际浇水。
- [x] `generate_elem_ball` 作为独立、未来可复用的节点图能力。
- [x] Growth Tick 改为“单位时间速率 + 实际 dt”的结算模型；在线更新周期只控制反馈频率，不控制最终生长总量。
- [x] 在线第一版倾向约 60 秒结算一次；未来可改成 30 秒等，不需要重新平衡每小时速率。
- [x] 土壤蒸发与树体 Growth 消耗当前都以“每小时保留约 99%”作为测试基线，并按 dt 使用连续时间公式。
- [x] Debug UI 必须能够立即推进下一次 Growth Tick；调试推进使用一个标准在线更新步长，不需要真实等待下一次调度。

### 已选方向，但实现细节未确认

- [x] Debug UI → `generate_elem_ball` → 元素球 → Soil 感应 → `SOIL_PendingElems` → 下一 Growth Tick 批量容量竞争 → `SOIL_Elems`。
- [~] Debug UI 作为开发期 Crop Inspector，处理 Soil / Tree Reserve / Tree Growth / Stage / Affinity / 手动 Tick 等状态。
- [~] Level 作为 Growth Tick 的调度起点；更具体的信号与顺序尚未确认。
- [~] 正常在线结算读取真实经过时间 dt；Debug 的“推进下一 Tick”属于额外的开发期时间推进能力。

### 仍待讨论

- [x] 父子器官亲和度：由当前 Stage 的 Growth Vector 计算亲和偏移；Stage 升级时固化为自身下一阶段 Base；生成子器官时按继承率传递偏移，自身亲和不变。
- [x] 元素球使用 `BALL_Elems[7]`；当前版本只生成纯净单元素球；在以 Tree 为中心的可配置圆环范围随机生成，并避免出生即进入 Soil 捕获区；靠近玩家时缓慢飘向玩家；颜色由所含元素决定；元素量随 Growth Tick 衰减。
- [x] Soil 容量竞争：Pending 整体优先进入；若 Pending 本身不超过容量，则旧 Soil 按比例缩放为剩余容量；若 Pending 本身超过容量，则旧 Soil 全部挤出，Pending 自身按组成比例缩放到容量。
- [ ] Growth Tick 的信号 / 流水线顺序。
- [ ] Soil Growth Tick 的具体行为。
- [ ] Tree 从 Soil 吸收的具体公式。
- [ ] Reserve → Growth 的完整公式与边界。
- [ ] 各 Stage 的 GrowthThreshold / MaxAbsorbPerTick。
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
~~~

后续是否补充其他器官模板亲和，等对应器官进入范围再决定。

### Soil

职责：

- 保存土壤七元素储备；
- 感应进入范围的元素球；
- 执行土壤容量竞争；
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

Debug UI 不直接修改 `SOIL_Elems`。

正式测试路径：

~~~text
Debug UI
→ 选择纯净元素与元素量
→ generate_elem_ball
→ 在 Tree 周围圆环随机生成元素球
→ 玩家靠近时元素球缓慢向玩家飘动
→ 元素球进入 Soil 感应区
→ Soil 捕获
→ BALL_Elems 累加到 SOIL_PendingElems
→ 元素球实体被消费
→ 下一次 Growth Tick
→ Pending 批量合并进 Soil
~~~

这样 Debug 测试与未来正式玩法共用同一条“元素球 → Soil”输入链。

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

这样未来允许混合元素球时不需要修改接口。

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

不使用“每 Tick 固定减 X”的写法。

元素球被 Soil 捕获并销毁后，不再继续执行元素球衰减。

### 3.4 Soil 捕获与 Pending 池

Soil 拥有感应区。

当带有 `ElementBall` 标签的实体进入感应区：

~~~text
SOIL_PendingElems[i]
+= BALL_Elems[i]
~~~

随后消费 / 销毁该元素球。

捕获事件**不立即修改 `SOIL_Elems`，也不立即执行容量竞争**。

因此短时间内多个元素球：

~~~text
Ball A
Ball B
Ball C
...
~~~

会先合并成一个七元素输入向量：

~~~text
SOIL_PendingElems[7]
~~~

这样容量竞争的最终结果不会依赖多个碰撞事件的先后顺序。

### 3.5 方案 A：下一 Growth Tick 批量结算

当前确认采用方案 A。

在下一次 Soil Growth Tick 开始时：

~~~text
1. 读取 SOIL_PendingElems
2. 将整个 Pending Vector 作为一次输入
3. 与当前 SOIL_Elems 做一次容量竞争
4. 写回新的 SOIL_Elems
5. 清空 SOIL_PendingElems
6. 再继续本 Tick 的 Soil 衰减
7. 再进入 Tree 吸收
~~~

因此“捕获”与“真正进入土壤储备”是两个不同步骤：

~~~text
Capture
→ Pending

Next Growth Tick
→ Commit Pending
→ Soil Reservoir
~~~

Debug UI 可以使用 `Advance One Growth Tick` 立即推进这一步，因此开发测试不需要等待正常的一分钟调度。


---

## 4. 土壤容量竞争 —— 公式与边界已确认

本轮容量竞争直接接收整个 `SOIL_PendingElems[7]`，而不是逐个元素球处理。

定义：

~~~text
S[i] = CurrentSoil[i]
I[i] = InputElems[i]

S_total = Σ S[i]
I_total = Σ I[i]

C = Capacity
~~~

核心规则：

> 同一批 Pending 作为一个整体优先进入土壤；只有空间不足时才挤出旧 Soil。容量竞争与元素球碰撞先后顺序无关。

倾向拆成独立纯计算节点图：

~~~text
soil_element_mix_calc
~~~

输入：

~~~text
CurrentSoil[7]
InputElems[7]
Capacity
~~~

输出：

~~~text
ResultSoil[7]
~~~

### 4.1 Pending 为 0

如果：

~~~text
I_total = 0
~~~

则本次不发生容量竞争：

~~~text
ResultSoil = CurrentSoil
~~~

### 4.2 Soil + Pending 没有超过容量

如果：

~~~text
S_total + I_total <= C
~~~

直接相加：

~~~text
ResultSoil[i]
=
S[i] + I[i]
~~~

### 4.3 Pending 能装下，但 Soil + Pending 超容量

如果：

~~~text
I_total < C

且

S_total + I_total > C
~~~

Pending 全部保留。

旧 Soil 能占用的剩余容量：

~~~text
OldCapacity
=
C - I_total
~~~

旧 Soil 按原组成比例整体缩放：

~~~text
OldKeepRatio
=
OldCapacity / S_total
~~~

最终：

~~~text
ResultSoil[i]
=
S[i] × OldKeepRatio
+
I[i]
~~~

例如：

~~~text
C = 100
S_total = 80
I_total = 40

OldCapacity = 60
OldKeepRatio = 60 / 80 = 0.75
~~~

即旧 Soil 整体保留 75%，然后完整加入 Pending。

### 4.4 Pending 本身达到或超过整个容量

如果：

~~~text
I_total >= C
~~~

则旧 Soil 被全部挤出。

Pending 自身按照组成比例缩放到容量：

~~~text
InputKeepRatio
=
C / I_total

ResultSoil[i]
=
I[i] × InputKeepRatio
~~~

例如：

~~~text
C = 100

Pending:
Fire = 80
Hydro = 60

I_total = 140
~~~

最终约为：

~~~text
Fire  = 57.14
Hydro = 42.86
Old Soil = 0
~~~

因此即使一批 Pending 自己超过容量，也不会因为捕获顺序不同而得到不同结果。

### 4.5 数值边界

正常玩法中的 Soil / Pending 元素量都必须：

~~~text
>= 0
~~~

负数没有玩法语义。

如果 Debug UI 试图写入负值，则在 Debug 写入边界直接 clamp 到 0，不让容量竞争函数承担负值语义。

如果 Debug 人工把 `SOIL_Elems` 改到超过 Capacity：

- 暂时允许这个非法调试状态存在；
- 当下一次存在非零 Pending、真正执行容量竞争时，公式会自然把 Soil 恢复到容量约束；
- 不额外为 Debug 非法状态设计正式玩法规则。

### 4.6 算法摘要

~~~text
if I_total == 0:
    Result = S

else if I_total >= C:
    Result = I × C / I_total

else:
    OldCapacity = C - I_total

    if S_total <= OldCapacity:
        Result = S + I
    else:
        Result = S × OldCapacity / S_total + I
~~~

保证：

~~~text
ResultTotal <= Capacity
~~~

并且在合法输入下：

- Pending 内各元素地位平等；
- 新输入在自身能装下时不会被旧 Soil 反向挤出；
- 旧 Soil 的淘汰始终保持原有组成比例；
- 批量结算结果不依赖多个元素球的碰撞先后顺序。


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

### 待讨论：调度流水线

当前方向：

Level 负责发起全局 Growth Tick。

但不希望 Soil、Tree、Leaf、Flower 等全部无序同时监听同一个广播，然后各自读取彼此状态。

更倾向于把 Growth Tick 作为**流水线起点**：

~~~text
Level: GrowthTick
→ Soil 完成本 Tick
→ Tree 开始本 Tick
→ Tree 完成预算与自身结算
→ 子器官开始本 Tick
~~~

原则候选：

> 上游先完成本 Tick 并确定下游输入，再触发下游。

当前本轮只有 Soil + Tree，因此最小顺序先讨论：

~~~text
Level GrowthTick
→ Soil Growth
→ Soil 完成
→ Tree Growth
→ Tree 完成
~~~

仍需重点确认：

- 用全局信号还是关卡信号；
- Soil 完成后如何通知 Tree；
- 数据通过信号参数传递，还是先写实体状态再发“完成”信号；
- 多棵树 / 多块土时如何对应；
- 将来多个子器官是并行还是父级先分预算再分别触发；
- Tick 的离线补算如何保持同样顺序。

**本节暂不定实现方案。**

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
- [>] 5. Growth Tick 的信号 / 流水线顺序
- [ ] 6. Soil Growth Tick
- [ ] 7. Tree Growth Tick：吸收
- [ ] 8. Tree Growth Tick：Reserve → Growth
- [ ] 9. Seedling → Sapling → Mature
- [ ] 10. Debug Crop Inspector
- [ ] 11. 文件拆分与最终 Spec / Issue

在以上内容逐条确认前，不进入实际实现。
