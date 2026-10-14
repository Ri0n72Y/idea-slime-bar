# Aquamelon Kitchen — 千星 Lua 模块化内核 v1

> 设计／工程切片（2026-10-14），以仓库 `main@aaeb0360` 已合并的 10-13 生长数值文档为执行基线；同时复核目前 `main@d94333e` 新增的果实反应/感官设计。**不复制 Web 当前运行代码，不修改现有 PR #28 的客户端试玩，也不替代 F1 服务器权威实现。**

## 1. 采用的事实、证据与信任分层

1. [growth-balance-baseline.md](../mvp/aquamelon-kitchen/growth-balance-baseline.md)：Soil 容量1000V、0.99/uh自然保留、每种元素7维有序、Grow／Reserve分离、完整器官阈值、分流与未锁定值。
2. [first-fruit-uh-calibration.md](../mvp/aquamelon-kitchen/first-fruit-uh-calibration.md)：土壤共享系数 `ln(1+S/200)/ln(6)`、M95/W12 归一化S曲线、阶段吸收上限候选2/1.85/16 V/uh、B0=5.4 V/uh候选；期望轨迹来自独立校准，不是代码行为保证。
3. [growth-system.md](../mvp/aquamelon-kitchen/growth-system.md) 与 [uh-time-unit.md](plants/uh-time-unit.md)：Seed 45G不清零，90G逐维1G→1V Reserve，初Bud同步产生；RootPreference与Affinity功能不同；唯一 `Δuh` 模型时间。
4. 千星实机回传：`script.object` 可访问当前用户手动布置的 `ClientUIContainerControl` 并操作 UI；全局 `GetClientUIRoots`/PrintClientUITree 曾返回0，不能依赖它作为入口。
5. 社区 [MiliUI](https://github.com/MyPingO/MiliUi/blob/main/docs/Installation.md) 使用 `require("MiliUI/init")`，证实可通过**客户端脚本映射**加载模块；官方 [客户端脚本上传规则](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhbgxf0nynww) 要求每个需要上传的本地 Lua 文件建立资源映射。不推断普通 Lua 的任意文件 IO 或 `package.path` 可用。

**文档冲突处理**：`development-conventions.md` 的历史文本还存在Soil 100V、Seedling清空Growth、Leaf/Flower旧阈值；这些不能凌驾于上述较新的 `growth-balance-baseline.md` / `growth-system.md` / 10-13 calibration。历史Web `WEB_BALANCE`、每Tick代谢比例和Dormant状态绝不作为本版参数来源。

## 2. 模块关系：按因果边界拆，不按每个函数建一个文件

```text
   [千星 Editor 静态 UI]          [平台时钟/服务端持久化：未来]
            |                                |
       WK2_Entry.lua (event/view only)       |
            |                                |
      State + Step + Present <---- step(world, deltaUH)
              |
     +--------+-----------+
     |                    |
  Soil.settle()         Seed.grow()
     |                    |
  Curves.soil        Vector / Affinity
     +---------- Config ----+
```

**数据向上，不反向依赖 UI**。只有入口脚本知道 `script`、`game`、`Enum`、按钮名与文本框名。纯领域模块没有编辑器 API、DOM、Cordis、信号、文件 IO 或隐藏全局状态；通过 `require` 返回模块表，状态从参数传入，便于逐文件阅读、独立数值复核和未来将入口切为服务器消息适配器。

| 文件（`packages/genshin/lua/` 下） | 唯一职责 | 主接口 |
| --- | --- | --- |
| `WK2/config.lua` | 现行事实与**校准候选**集中列明 | config table |
| `WK2/vector.lua` | 长度7的显式向量操作 | zero/copy/sum/add/scale |
| `WK2/curves.lua` | 无状态的 Soil 对数系数与 Reserve S 曲线 | soilEfficiency/growthEfficiency |
| `WK2/state.lua` | 内存世界创建、铺土／播种、显式Debug土壤输入 | new/placeSoil/plant/debugSupply |
| `WK2/soil.lua` | 土壤溢出、自然保留、Seed根吸收 | settle |
| `WK2/seed.lua` | 早期亲和学习与45/90阈值事件 | grow |
| `WK2/step.lua` | 以显式 `Δuh` 协调单次领域结算 | advance |
| `WK2/present.lua` | 世界快照到纯文本的只读投影 | snapshot |
| `WK2_Entry.lua` | `script.object`、现有8按钮、Snapshot/History | OnStart |

9 个文件均在**200行以下**。不引入通用 DI 容器、事件总线、实体组件系统、继承层次、工厂注册表或跨平台框架。这不是将一个巨大脚本拆成互相隐式耦合的九个切片：每个模块只公开少量面向业务的明确函数。

## 3. 当前已实现的可执行切片与不足

- 以 **Lua的1..7** 存储七元素，顺序仍为 Fire/Hydro/Anemo/Electro/Dendro/Cryo/Geo。需要与千星服务器固定0..6索引交互时，只允许在未来平台适配边界完成换算。
- `world.soil=nil` 表示没有铺土；`tree=nil` 表示未播种；`tree.reserve=nil` 明确区分 Seed/Seedling 的**无Reserve**与 Sapling 的正好0V。
- 土壤首次结算时超量同比压至1000，再进行 `0.99^Δuh` 自然保留；同一 Soil Total 的对数系数控制根系共享上限。根系候选阶段Cap来自配置；当前单元素通道按 **Tree BaseAffinity** 计算。这是可替换的校准策略，Base vs Effective最终口径未锁定，不据此声称重现实测轨迹。
- Seed/Seedling的一条Growth轴不断累积：45G只变成Seedling，不清零、不二次固化；累计90G转Sapling时Growth逐维转为Reserve、Sapling本体Growth清零，并产生第一枚Bud。早期Growth塑造的有效Affinity此时仅作为Sapling新基线固化一次；此转换点的具体复核请独立Reviewer确认。
- `Step.advance(world, Δuh)` 目前只接受 `0 < Δuh ≤ 1`；这是**首个细分结算切片**，不是任意大跨度离线重放实现。调用者如要前进10uh，必须执行10次 1uh 结算，并在出现未实现事件时停止。
- 到达 Sapling 后 **明确返回 `SAPLING_SETTLEMENT_NOT_IMPLEMENTED`，不推进时钟，不消耗 Soil**，不假装Reserve预算、分流、Bud增长、花果或随机出芽已迁移。M95/W12 S曲线目前仅为纯函数计算，尚未接到真实Sapling养分预算，不用旧Web固定百分比偷代替。
- 客户端 `AddElement` 保留一个标明 `DEBUG` 的**80V定量土壤注入**用于调试，绝不是已实现“富集→生成随机元素球→衰减→收集”。`NextTick` 暂代表人工推进 **1uh**，名称仅为旧静态按钮的绑定兼容；`Next10Ticks` 执行最多10次单uh结算。
- **这版不启动客户端自动10秒Tick，也不实现3600秒真实时钟**：前者属于Web压缩映射，后者在客户端掉线/后台不可被当作权威长期时间。真实千星世界钟、持久化、离线、服务端结算将作为后续独立边界。

因此当前完成的是**新数值下的模块化核心骨架和 Seed→Sapling 入口垂直切片**，**不是完整果园游戏**。

## 4. 编辑器装载合同：不碰用户布置的 UI

1. 使用当前手工静态布局与默认布局；保留客户端控件根上挂载的旧试玩脚本配置，直到单独切换入口。此分支的 `WK2_Entry.lua` **不能同时和 PR #28 的 `WK_TextTrial.lua` 挂在同一控件**，避免重复注册按钮事件。
2. 在「千星沙箱 → 客户端脚本资源管理器」映射 `WK2_Entry` 和其余8个 `WK2/...` 模块（完整路径见上表），使 `require("WK2/vector")` 等与资源映射路径一致；**仅创建磁盘文件不足以让客户端加载模块**。无需把纯模块挂到 UI：只有 `WK2_Entry.lua` 挂到已经存在的客户端根控件。
3. 入口只读取 `script.object`，并调用 `root:FindChild` 获取 `Snapshot`、`History`、`PlaceSoil`、`PlantSeed`、`ElementPrev`、`ElementNext`、`AddElement`、`NextTick`、`Next10Ticks`、`Reset`。**不修改这些控件的位置、大小、锚点、字号、可见性或静态文案**。
4. 首先在「窗口 → 日志 → 客户端脚本 → 确认选择」查看 `WK2: attached <root name>`，再人工按铺土、播种、Debug添加元素、1uh/10uh结算。UI适配只在获得实机证据时局部修正，不推翻用户的静态布局。

## 5. 下一阶段按边界增加，而非一次性封装全游戏

- **F2-Sapling**：单独设计Reserve容量限制、100～180V对数吸收约束、M95/W12预算的**七元素分配与上限**、Tree Base/Effective读取时点、预算返还。需按仓库现行校准文档检查，不接受无来源的默认公式。
- **F2-Organs**：把Leaf first-level预算30% + leaf-local生殖80%做成预算分配结果，器官状态机实现Bud20/SmallLeaf26/Reproductive12→40→90，并严格保留其连续Growth与固化边界。未锁定的复花Threshold和出芽机会频率使用明确的 **pending**，不可随机猜数。
- **F2-Time & State**：引入权威的 `Δuh` 调度／持久化端口，解决跨Threshold精确分段与离线事件顺序，再让千星服务端节点图接管权威状态；客户端Lua只发请求／显示状态。先固定权限边界，不添加客户端“防作弊”伪检查。
- **F4 ElementBalls / Materials / Processing**：按已确认的材料身份与元素载体拆独立状态和操作，不把所有东西塞进 `state.lua` 或 `WK2_Entry.lua`；仍禁止自动背包和未确定的加工比例。
- **Fruit Reaction／Flavor 另立专域**：最新 main `d94333e` 已合入 [fruit-reaction-settlement-design.md](../mvp/aquamelon-kitchen/fruit-reaction-settlement-design.md) 及七元素感官文件，不能继续假设结果后只有一个裸 `FruitElementAmount[7]` 数组就足够表达所有反应。新反应专题提出 `E_free[7]+Products[]`、初次成熟90G、1U=30G、事件跨阈值去重、SRP优先级、风扩散例外；该专题自己的范围声明明确**尚未正式替代现有 MVP 生长／运行时合同**，与现有 Growth 和果实账户定义仍需集成决议。实施前设独立 **Fruit Ledger／Reaction Engine／Sensory Projection** 边界：第一层存独立账本与已发生事件，第二层只做确定性物质量结算，第三层呈现感官描述，不把风味意向反向驱动元素质量或 Soil/Tree Growth。本 PR **不实现或预判这处跨文档冲突**。
- **UI及未来2D/3D**：文本、像素图、3D场景是**不同适配器**；换皮不重写七元素、亲和与成长规则。用户维护界面静态布局，不引入运行时自动重排。

## 6. 审查与验证分级

- **源码层**：模块 `require` 路径一致、单文件≤200行、无千星UI引用泄漏到领域、Seed45不清空、Sapling90逐维结转并产生第一Bud、Sapling未实现时不会错误结算。
- **数值层**：与本次独立校准同一`Δuh`切分对照；特别注意小步吸收的分段时序、跨阈值插值与土壤浓度系数的解释是否严格等价。当前不声称已与CSV复算一致。
- **官方编辑器层**：每个 `require` 模块需建立脚本映射；只绑定入口脚本、旧入口互斥；按钮交互与文字显示可感知。
- **CI层**：当前仓库CI基于pnpm和Web/TS，不能以其绿灯声称Lua语法、Lua模块装载或原神千星实机验收通过。本分支不加本地执行或新CI工作流。

**待审查风险（不可跳过）**：90G边界Affinity固化点、当前根系单通道选用BaseAffinity的候选选择、1uh以外的离线精确积分、`require` 在创作者关卡真实映射路径的兼容，以及**新果实反应90G账户与现行MVP果实成长/累积账户的权威集成决议**。这些应在F2继续开发前由独立Reviewer/实机证据核对。
