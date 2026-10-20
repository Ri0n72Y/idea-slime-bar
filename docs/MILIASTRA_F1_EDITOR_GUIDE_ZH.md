# 千星奇域 F1：Soil / Tree 与 Lua Debug Panel 实机安装指南

> 适用：[Issue #8](https://github.com/Ri0n72Y/idea-slime-bar/issues/8) / [PR #9](https://github.com/Ri0n72Y/idea-slime-bar/pull/9)。2026-10-09 按官方 **7.1（2026-09-23）** 的编辑器、客户端脚本、控件和外部资产文档重新校对。仅指导**单 Soil + 单 Tree 的开发试玩关卡**，不代表已通过千星实机验收。

## 0. 先明确交付边界

本次源码：
- `packages/genshin/src/aquamelon-kitchen/WK_Soil_Water.ts`：`WK_Soil_Water` 服务器**实体节点图**，编译 ID `1073741830`。
- `packages/genshin/src/aquamelon-kitchen/WK_Tree_State.ts`：`WK_Tree_State` 服务器**实体节点图**，编译 ID `1073741831`。
- `packages/genshin/src/aquamelon-kitchen/WK_F1_DebugPanel.lua`：客户端 UI 脚本，**不是** `.gia`。
- `packages/genshin/gsts.config.ts`：只选入这两张 F1 图；不要导入旧连续衰减实验图 `WK_Element_ApplyInput`。

**执行路径：**创建动态物件和关卡自定义变量 → 注册信号 → 编译 `.gia` → **资产导入导出管理加载、转存** → 节点图管理器确认并挂载 → 创建客户端 UI 容器 → 建立 Lua 脚本映射并挂载 → 试玩读回。

权威数据只在服务器实体 `SOIL_Elems / TREE_*`。关卡 `WK_DBG_*` 变量是给 Lua 读取的**调试镜像**，不得用于真正生长结算。Lua 只显示草稿、发送服务器信号。当前没有 F2 Growth Tick；**「立即执行下一个 Tick」只检查信号通路，绝不假装长大**。

## 1. 创建 Soil、Tree 和确认关卡实体

1. 新建或打开**超限模式**的测试关卡；先保存一次。进入「实体摆放」，选择能编辑「通用组件」与「节点图」的**动态物件**，分别放置 `WK_Soil_Plot`、`WK_Aquamelon_Tree`。**不要使用静态物件**：官方说明静态物件不支持组件和节点图。可以使用简单占位模型，但必须是可配置的动态物件。
2. 到「实体编辑」找到**关卡实体**（创建关卡时已自动生成，通常有特殊图标），无需另外放一个“Config 物件”。F1 直接使用现有关卡实体的「自定义变量」组件存放 Debug 镜像；不需创建 Growth Tick 配置资源。
3. 分别选中 Soil / Tree，在其「通用组件」→「自定义变量」→「详细编辑」中新增变量。若该组件尚不存在，用「添加通用组件」添加。变量名、类型、初始值必须匹配；添加后不要随意重命名或更改类型。

### Soil：动态物件上的自定义变量

| 名称 | 编辑器类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `SOIL_Elems` | **浮点数列表** | `[0,0,0,0,0,0,0]` | F1 唯一 Soil 权威状态 |
| `SOIL_WaterTabId` | 整数 | `-1` | 旧选项卡兼容入口；仅 Lua 调试时不会触发 |
| `SOIL_WaterElementIndex` | 整数 | `1` | 旧选项卡兼容入口 |
| `SOIL_WaterAmount` | 浮点数 | `10` | 旧选项卡兼容入口 |

**F1 的 Lua 路线不要求添加选项卡组件**；保留三个兼容变量仅因为现有 `WK_Soil_Water` 图仍包含旧选项卡事件。不要为这次操作额外做两个交互选项。若将来主动启用旧选项卡，再从组件列表添加「选项卡」，将真实**选项序号**填入 `SOIL_WaterTabId`，不要把编译图 ID 当成选项序号。

### Tree：动态物件上的自定义变量

| 名称 | 编辑器类型 | 默认值 |
| --- | --- | --- |
| `TREE_Stage` | 整数 | `0`（0 Seed / 1 Seedling / 2 Sapling；仅 F1 调试标识） |
| `TREE_Elems` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
| `TREE_Growth` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
| `TREE_BaseAffinity` | 浮点数列表 | `[0.85,1.15,0.90,0.75,1.20,0.70,0.95]` |
| `TREE_EffectiveAffinity` | 浮点数列表 | `[0.85,1.15,0.90,0.75,1.20,0.70,0.95]` |
| `TREE_RootPreference` | 浮点数列表 | `[0.80,1.00,0.85,0.75,1.00,0.70,0.90]` |
| `LastGrowthTickAt` | 浮点数 | `0`（F2 前只读） |

所有完整向量都必须有**七个浮点值**，固定顺序为 `0 Fire / 1 Hydro / 2 Anemo / 3 Electro / 4 Dendro / 5 Cryo / 6 Geo`。Seed/Seedling 不消耗 Tree Reserve；目前并不会自动推进阶段。

### Level：现有「关卡实体」的镜像自定义变量

在关卡实体 →「通用组件」→「自定义变量」→「详细编辑」里创建**全部 10 项**，确保它们是编辑器中**预先声明的组件默认变量**，而不是仅运行时由服务器临时创建；否则 Lua 端未必能同步读取。

| 名称 | 类型 | 默认值 |
| --- | --- | --- |
| `WK_DBG_SOIL_Elems` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
| `WK_DBG_TREE_Stage` | 整数 | `0` |
| `WK_DBG_TREE_Elems` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
| `WK_DBG_TREE_Growth` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
| `WK_DBG_TREE_BaseAffinity` | 浮点数列表 | `[0.85,1.15,0.90,0.75,1.20,0.70,0.95]` |
| `WK_DBG_TREE_EffectiveAffinity` | 浮点数列表 | 同上 |
| `WK_DBG_TREE_RootPreference` | 浮点数列表 | `[0.80,1.00,0.85,0.75,1.00,0.70,0.90]` |
| `WK_DBG_LastGrowthTickAt` | 浮点数 | `0` |
| `WK_DBG_NextTickRequests` | 整数 | `0` |
| `WK_DBG_NextTickResult` | 字符串 | `F2_NOT_CONNECTED` |

特别提醒：官方文档指出**列表变量通过引用就地修改，不会自动触发「自定义变量变化时」事件**。本方案通过服务器显式 `stage.set` 同步镜像、客户端刷新读取；**镜像是否在 Lua 中实时可读仍需实机核验**，不要只看日志就宣布成功。

## 2. 先创建三个服务器信号

在「千星沙箱」打开**信号管理器**，按如下**名称与参数顺序**配置并保存：

| 信号名 | 参数，严格按顺序 | 作用 |
| --- | --- | --- |
| `WK_Debug_Refresh` | 无 | Soil/Tree 各自把原始状态同步到关卡镜像 |
| `WK_Debug_Write` | `Field` 整数、`Index` 整数、`Value` 浮点数 | 请求服务器**设置**指定字段的绝对值 |
| `WK_Debug_NextTick` | 无 | 下一 Tick 请求；当前 F1 只返回未接入回执 |

`Field`：`0` Soil，`1` Tree Stage，`2` Reserve，`3` Growth，`4` Base Affinity，`5` Effective Affinity，`6` RootPreference。`Index` 是 0–6，Stage 不用索引。不要猜测任何信号 ID，**手工核对生成节点图里的「监听信号」及其参数引脚**。编辑器的信号是**全局广播**；本次只摆一个 Soil 和一棵 Tree，避免所有同类实体同时响应调试写入。

## 3. 编译两张 `.gia`，并走正确的「外部资产」导入流程

1. 获取当前 PR #9 对应分支源码。使用项目已有的 pnpm 环境，在仓库根目录执行：
   ```sh
   pnpm --filter @idea-slime-bar/genshin build
   ```
2. 检查 `packages/genshin/dist/` 下实际生成的 `.gia`，目标图名为 `WK_Soil_Water` / `WK_Tree_State`。编译器可能保留源文件子目录，以**编译输出中的真实路径和文件名**为准。必须实际确认 **两张服务器实体图**的 `.gia` 都存在；Typecheck/CI PASS 不证明已经生成这些文件。若编译报错，先保存错误输出，停止导入。
3. 在**局内编辑器**打开「**资产导入导出管理**」→「**加载外部资产**」→「**打开目录**」。将真实的 `.gia` 文件复制到编辑器打开的外部资产目录（不要把 `.gs.ts`、`.json` 或 `.lua` 当 `.gia` 导入）。
4. 返回编辑器，点击「**加载外部资产**」；在加载结果中确认文件可识别，选择对应资源并点击「**转存所选资产**」，选择默认页签或专用 `WK_F1` 页签。**这一步是资产转存，不等于实体已经挂载该节点图。** 如果资源无法识别/转存，记录加载结果与编辑器版本，不自行改格式或重试自动注入。
5. 打开「千星沙箱」→「**服务器节点图资源管理器**」，在实体节点图分类中确认转存后的 `WK_Soil_Water`、`WK_Tree_State` 是否可见，打开检查：
   - 类型均为**服务器实体节点图**；
   - `WK_Soil_Water` 有 `WK_Debug_Write / WK_Debug_Refresh`（以及兼容的选项卡事件）；
   - `WK_Tree_State` 有 `WK_Debug_Write / WK_Debug_Refresh / WK_Debug_NextTick`；
   - 同名信号的事件参数类型正确，不存在未接引脚、失效节点或资源缺失警告。
6. 回到「实体编辑」：选 `WK_Soil_Plot` →「节点图」→「新增节点图」→ 挂载 `WK_Soil_Water`；选 `WK_Aquamelon_Tree` →同样挂载 `WK_Tree_State`。以真实编辑器菜单为准，确保**每张图只挂载到各自一个动态物件**。`self` 是图所挂的当前实体，`stage` 是系统关卡实体；无需为本 F1 硬编码实体 GUID。
7. 保存地图。源码里的 `1073741830/1831` 是编译图 ID，不是选项卡编号、信号 ID，也不要求你先造同 ID 的空图。**本轮不用自动注入、手动复合节点、额外元件资源。**

## 4. 创建 7.1 客户端 Debug Panel

1. 「**界面控件组管理**」→「**界面布局**」→「**添加界面控件**」→「**客户端控件容器**」→选中容器→「**画布设置**」→「**前往编辑**」。**客户端控件必须放在这个容器画布内**，不能拿旧版服务器控件代替；没有容器，Lua 与客户端控件不会正常运行。
2. 将默认根容器节点命名为 **`WK_DebugRoot`**（供 `game.FindClientUIRoot('WK_DebugRoot')` 查找），并在它下面**直接**创建以下控件。名字**区分大小写**，必须与源码一致：

   | 类型 | 名称 | 作用 |
   | --- | --- | --- |
   | 客户端文本视窗 | `Snapshot` | 显示 8 组字段快照与 Next Tick 两行回执 |
   | 客户端文本框 | `EditorValue` | 当前选择字段、元素、草稿数值、步长 |
   | 客户端文本框 | `Status` | 请求说明/反馈 |
   | 13 个客户端预设按钮 | `FieldPrev`、`FieldNext`、`ElementPrev`、`ElementNext`、`StepPrev`、`StepNext`、`Decrease`、`Increase`、`Zero`、`Apply`、`ReloadDraft`、`Refresh`、`NextTick` | 字段切换、数值编辑、发送和刷新 |

3. 按钮可见文本可以设置为：字段←/→、元素←/→、步长−/+、数值−/+、归零、应用、读取当前值、刷新、**立即执行下一个 Tick**。启用按钮的可交互/光标点击能力；不必为按钮提供脚本中硬编码的模板索引，脚本会根据根下的**控件名字**找到按钮。
4. 给面板足够的显示区域，让 `Snapshot` 的多行文本视窗和按钮不重叠；用锚点在常见分辨率下查看表现。这是手工 UI 资源配置，Lua 不能从无到有创建编辑器资产。
5. 返回界面布局确认**客户端控件容器初始可见且已激活**；并在界面布局默认应用配置里检查当前试玩玩家/职业是否实际使用了**包含该容器的布局**（可从「打开玩家编辑」进入相关职业配置）。若布局根本没被玩家使用，代码正确也看不到面板。

## 5. 建立 Lua 映射并挂到客户端控件

1. 「**千星沙箱 → 客户端脚本资源管理器**」中，在客户端脚本文件夹右键「**新建脚本映射**」，映射到本地真实文件 `packages/genshin/src/aquamelon-kitchen/WK_F1_DebugPanel.lua`。也可选「新建客户端脚本」，但必须确保关联内容是本仓库最新版 Lua，避免编辑器另建一个不同内容的脚本。
2. 回到容器画布，选中客户端根控件 **`WK_DebugRoot`** →「**脚本**」页签 →「**添加脚本**」→选取刚建的脚本映射。只复制文件、不在编辑器建立映射并挂载，脚本不会打包执行。
3. 保存客户端控件、界面布局与关卡，然后启动**试玩**。面板 Lua 在 `game.IsTestPlay()` 为假时自行隐藏；**该检测不是服务器权限**，调试写入信号只能留在开发测试地图，不能直接发布给普通玩家。

## 6. 分段试玩验收（失败就停在当前步）

1. **控件与 Lua：**打开客户端脚本日志；确认出现面板而不是 `Missing WK_DebugRoot` / `Missing debug control`。如面板不出现，优先查第 4 步的默认应用布局、容器可见/激活、根名称和第 5 步的脚本映射。
2. **服务器状态：**打开服务器节点图日志。Tree 初始化图应有 `WK_Tree_State F1 ready`。点击 `Refresh`，`Snapshot` 应读到 Soil 七个 0、Tree Stage 0、Growth/Reserve 七个 0、Affinity 与 RootPreference 默认向量。若只见日志不见列表，不要声称 UI 读回成功：核对 Level 10 个变量及其类型、关卡镜像是否真的改变，并记录 Lua `game.GetGlobalCustomVariableValue` 实机的列表格式（源码按 Lua 的 1–7 下标读取，这仍需实机确认）。
3. **Soil 写入：**选择 Soil → Hydro（索引 1），步长 10，草稿 0→10，按 `Apply`，再按 `Refresh`。应观察**原始 Soil 实体** `SOIL_Elems=[0,10,0,0,0,0,0]` 与 Level `WK_DBG_SOIL_Elems` 以及面板都一致；再设置 20，检验绝对值写入而非加 20。Tree 不变。
4. **Tree 写入：**分别设置 Tree Reserve-Dendro=5、Tree Growth-Hydro=12、Tree Stage=2、RootPreference 某项 0.50、Affinity 某项 0.85，逐次按 `Apply/Refresh`，核对原始 Tree 实体、关卡镜像与面板结果一致。尝试调试 RootPreference 超 1，应被限制/拒绝；`LastGrowthTickAt` 不能通过 UI 写入。
5. **Next Tick（目前只是握手）：**点击 `NextTick`，面板显示 `sent=1`、服务器 `ACK=1`、`NOT_EXECUTED_F2_MISSING`；再点击 `ACK=2`。服务器日志提示 F2 尚未实现。**Soil / Reserve / Growth / LastGrowthTickAt 均不能因点击发生变化。** 若只看到本地 sent 增长而 ACK 不变，说明服务器链路尚未接通。
6. **边界：**Soil Hydro 设置 150，当前不会立即压成 100（容量归一化属于 F2/F3）；退出试玩再次进入，分别记录原始状态与镜像是否恢复默认值，**不要推断支持离线持久化**。
7. 记录并回传：**编辑器版本与模式、两张实际生成 `.gia` 的路径、外部资产转存记录、挂载截图、10 个 Level 变量与 3 个信号配置、UI/脚本映射截图、客户端与服务端日志、Soil/Tree 的真实运行时数值**。没有实机结果前，`generated/imported/user-tested` 均属于未验证。

## 7. 常见错误与停止条件

- **找不到组件/节点图页签：**可能误用了静态物件；换成真正可编辑组件的**动态物件**。
- **.gia 文件找不到导入：**不要在服务器节点图管理器里寻找“选文件”按钮；先使用**资产导入导出管理 → 加载外部资产 → 打开目录 → 加载 → 转存**。
- **转存成功但未运行：**转存并非挂载，仍需到 Soil/Tree 的「节点图」页签手动绑定；保存关卡再试玩。
- **UI 无法显示：**确认正在使用包含客户端控件容器的布局，并且容器初始可见、已激活；确认客户端脚本映射和根控件脚本挂载。
- **点击有效但快照不刷新：**区分「本地请求已发送」「服务器接收」「原始实体写入」「Level 镜像同步」「Lua 读取」，依次排查；列表原地修改没有普通变量变化事件。
- **NextTick 不生长：**这是**预期行为**，`NOT_EXECUTED_F2_MISSING` 表明 F2 未接入，不要在 Lua 里补生长公式。
- **多株同时改变：**信号全局广播，本 F1 仅支持单 Soil / 单 Tree，禁止把这些调试图作为多实例方案或直接发布。
- **编译器仅类型检查通过：**不等于 `gsts` 已生成 `.gia`，更不等于实机导入成功；缺少实际证据则保持未验证。

## 8. 校对依据

- [官方 7.1 更新日志](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhiufi00ceh4)：客户端控件与客户端脚本为 7.1 新增能力。
- [官方：物件](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhlh4n9m4i56)：静态/动态物件边界。
- [官方：关卡](https://act.mihoyo.com/ys/ugc/tutorial/detail/mh3pgiraqkiu) · [自定义变量](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhso1b9wjica) · [信号](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhlaj0r9bldi)。
- [官方：资产导入与转存教程](https://act.mihoyo.com/ys/ugc/tutorial/course/detail/mhgf8i0hvzag) · [节点图挂载](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhjwjrr5n73i)。
- [官方：客户端控件与脚本](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhbgxf0nynww) · [客户端控件 API](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhtakr07vej4) · [界面控件组管理](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhewyi0fjfvs)。

> 本次仅校对操作与验证合同，**不新增运行时代码、不跑本地 pnpm、不新建 CI、不合并 PR**。已存在 F1 的 NextTick 按钮仍是 F2 接入前的明示占位。
