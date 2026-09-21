# 水瓜厨房：基础生长链需求草案

本文用于逐条收敛“浇水 → 土壤元素 → 树体吸收 → Growth Tick → 三阶段成熟 → Debug”的第一条基础生长链。

当前只记录已经讨论到的方向和待确认问题，**不作为实现 Spec，也不直接进入开发**。后续每次只处理一个小节，确认后再继续下一项。

---

## 0. 当前目标边界

本轮希望最终形成的最小链路：

~~~text
Debug 生成元素球
→ 元素球落入 Soil 感应范围
→ Soil 接收元素并进行容量竞争
→ Level 发起 Growth Tick
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
- [x] Growth Tick 当前采用约 1h / tick、土壤蒸发 1% / tick、树体 Growth 消耗 1% / tick 作为测试基线；这些不是最终平衡常量。

### 已选方向，但实现细节未确认

- [~] Debug UI → `generate_elem_ball` → 元素球 → Soil 感应 → 容量竞争 → `SOIL_Elems`。
- [~] Debug UI 作为开发期 Crop Inspector，处理 Soil / Tree Reserve / Tree Growth / Stage / Affinity / 手动 Tick 等状态。
- [~] Level 作为 Growth Tick 的调度起点；更具体的信号与顺序尚未确认。

### 仍待讨论

- [ ] 父子器官亲和度如何继承。
- [ ] 元素球字段、Prefab、生成位置和 Soil 感应方式。
- [ ] Soil 容量竞争的边界条件。
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

Stage：

~~~text
0 = Seedling
1 = Sapling
2 = Mature
~~~

### Player

职责：

- 持有 Debug UI 的选择状态；
- 生成测试元素球；
- 查看 / 修改指定 Soil / AquamelonTree 的自定义变量；
- 手动触发调试操作。

Debug 状态不应写入 Soil / Tree 本身。

---

## 2. 亲和度与遗传 —— 当前讨论项

当前确定：

- CFG 中保存各器官的基础亲和模板；
- Tree / Leaf / Fruit 各自拥有自己的亲和度遗传；
- 个体实际亲和不应只依赖全局 CFG；
- 只保留连续学习，不使用离散阶段奖励。

当前待确认的核心问题：

> 一个已经改变亲和度的树长出叶片时，叶片应该从纯 CFG_LeafAffinity 开始，还是继承这棵树当前的“表观亲和”？

当前候选方向：

~~~text
Leaf Base Affinity
=
CFG_LeafAffinity
×
Parent Affinity Modifier
~~~

即：

- CFG_LeafAffinity 保留“叶片这种器官天生是什么”；
- Parent Modifier 传递“这棵树已经被培养成什么样”；
- 不直接把 TREE_EffectiveAffinity 原样复制成 Leaf Affinity。

具体遗传公式、遗传强度和 Stage 固定方式尚未确认。

**当前正在讨论本节。**

---

## 3. Debug 元素球与浇水 —— 方向已确认，细节待讨论

当前方向：

Debug UI 不直接修改 SOIL_Elems 来模拟浇水。

而是：

~~~text
Debug UI
→ 选择元素 / 数量
→ generate_elem_ball
→ 生成一个元素球
→ 元素球落入 Soil 感应范围
→ Soil 接收元素球
→ 浇水结算
~~~

这样 Debug 测试和未来正式玩法共用同一条“元素球 → Soil”接口。

候选节点图：

~~~text
generate_elem_ball
WK_Soil_ReceiveElementBall
~~~

其中：

### generate_elem_ball

只负责：

- 根据元素类型；
- 元素量；
- 生成位置；

创建并初始化一个元素球。

应设计成未来可复用入口。

### WK_Soil_ReceiveElementBall

只负责：

- Soil 感应到元素球；
- 读取元素类型和元素量；
- 调用土壤容量竞争；
- 写回 SOIL_Elems；
- 消费 / 销毁该元素球。

具体元素球实体字段、Prefab、感应方式和落点尚未确认。

---

## 4. 土壤容量竞争 —— 规则已确认，边界待讨论

本轮确定要实现。

目标：

~~~text
旧土壤元素
+ 新输入元素
→ 总量超过容量
→ 按旧土壤当前比例整体挤出
→ 再加入完整新输入
~~~

示例：

~~~text
旧：
雷 50
火 30
水 20
总量 100

输入：
雷 +10

旧土按比例挤出 10：
雷 -5
火 -3
水 -2

再 +10 雷：

雷 55
火 27
水 18
~~~

倾向拆成一个独立小计算节点图：

~~~text
soil_element_mix_calc
~~~

目标是保持纯计算：

输入：

~~~text
CurrentSoil[7]
InputElementIndex
InputAmount
Capacity
~~~

输出：

~~~text
ResultSoil[7]
~~~

边界情况尚需逐条确认。

---

## 5. Growth Tick 调度 —— 待重点讨论

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
手动触发一次 Growth Tick
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

- [>] 1. 亲和度与父子器官遗传
- [ ] 2. Debug 元素球的数据结构与生成接口
- [ ] 3. Soil 感应元素球与浇水流程
- [ ] 4. 土壤容量竞争公式与边界
- [ ] 5. Growth Tick 的信号 / 流水线顺序
- [ ] 6. Soil Growth Tick
- [ ] 7. Tree Growth Tick：吸收
- [ ] 8. Tree Growth Tick：Reserve → Growth
- [ ] 9. Seedling → Sapling → Mature
- [ ] 10. Debug Crop Inspector
- [ ] 11. 文件拆分与最终 Spec / Issue

在以上内容逐条确认前，不进入实际实现。
