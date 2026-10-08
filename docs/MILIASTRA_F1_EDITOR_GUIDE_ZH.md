# 千星奇域 F1：Soil / Tree + Lua Debug Panel 实机安装指南

适用：[Issue #8](https://github.com/Ri0n72Y/idea-slime-bar/issues/8)、PR #9。手动建立资源，不假定编辑器里已有 Soil/Tree/UI/信号。当前版本 **F1 only**，Lua 负责显示和编辑输入，**服务器节点图是唯一状态写入者**。

本次交付：
- `packages/genshin/src/aquamelon-kitchen/WK_Soil_Water.ts` → 服务器实体图 `WK_Soil_Water.gia`，编译 ID `1073741830`（延续旧 ID）。
- `packages/genshin/src/aquamelon-kitchen/WK_Tree_State.ts` → 服务器实体图 `WK_Tree_State.gia`，编译 ID `1073741831`。
- `packages/genshin/src/aquamelon-kitchen/WK_F1_DebugPanel.lua` → **客户端 Lua 源码**，不是 `.gia`；手动映射并挂载到客户端控件。
- **新增 NextTick 调试按钮**：向服务器发送一次 `WK_Debug_NextTick` 请求；**当前 F1 没有 Growth Tick 实现，服务器明确返回 `NOT_EXECUTED_F2_MISSING`，不会增加 Growth 或修改时间戳**。未来 F2 应接同一入口，调用真正的结算图。
- `packages/genshin/gsts.config.ts` 只编译上面两张 F1 服务器图；不导入旧 `WK_Element_ApplyInput.ts` 衰减实验图。

## 1. 创建场景实体与原始自定义变量

在测试关卡「实体摆放」中创建两个可持续存在的普通物件，分别命名：
- `WK_Soil_Plot`（Soil 自身保存 Soil 向量）
- `WK_Aquamelon_Tree`（Tree 自身保存 Tree 阶段、Reserve、Growth、Affinity 等）

选中每个物件 →「组件」→「自定义变量」（若没有则「添加通用组件」）→「详细编辑」。按下表逐条添加**强类型**自定义变量。

| 实体 | 变量名 | 类型 | 默认值 |
| --- | --- | --- | --- |
| Soil | `SOIL_Elems` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
| Soil | `SOIL_WaterTabId` | 整数 | `-1`（未配置旧版选项卡时） |
| Soil | `SOIL_WaterElementIndex` | 整数 | `1` |
| Soil | `SOIL_WaterAmount` | 浮点数 | `10` |
| Tree | `TREE_Stage` | 整数 | `0`（0=Seed / 1=Seedling / 2=Sapling） |
| Tree | `TREE_Elems` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
| Tree | `TREE_Growth` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
| Tree | `TREE_BaseAffinity` | 浮点数列表 | `[0.85,1.15,0.90,0.75,1.20,0.70,0.95]` |
| Tree | `TREE_EffectiveAffinity` | 浮点数列表 | 同 `TREE_BaseAffinity` |
| Tree | `TREE_RootPreference` | 浮点数列表 | `[0.80,1.00,0.85,0.75,1.00,0.70,0.90]` |
| Tree | `LastGrowthTickAt` | 浮点数 | `0`（预留、不执行 Tick） |

七元素列表固定顺序：`0 Fire / 1 Hydro / 2 Anemo / 3 Electro / 4 Dendro / 5 Cryo / 6 Geo`。所有列表恰好 7 个**浮点**值，索引 0..6（Lua 数组显示时使用 1..7）。F1 Seed/Seedling 不消耗 Tree Reserve。

可选：继续使用旧版 Soil 选项卡测试浇水时，再给 Soil 添加「选项卡」组件，将真实测试浇水选项 ID 填入 `SOIL_WaterTabId`；**Lua Debug Panel 方案不需要选项卡**。

## 2. 创建关卡调试镜像变量（只给 Lua 读，不是事实源）

选中**已有的关卡实体** →「组件」→「自定义变量」→「详细编辑」；添加如下 10 个变量，它们必须提前以组件默认值形式创建，以保证客户端可同步读取。不要把它们定义在 Soil/Tree 上，也不要把它们用于真正的 Growth 计算。

| 关卡变量 | 类型 | 默认值 |
| --- | --- | --- |
| `WK_DBG_SOIL_Elems` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
| `WK_DBG_TREE_Stage` | 整数 | `0` |
| `WK_DBG_TREE_Elems` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
| `WK_DBG_TREE_Growth` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
| `WK_DBG_TREE_BaseAffinity` | 浮点数列表 | `[0.85,1.15,0.90,0.75,1.20,0.70,0.95]` |
| `WK_DBG_TREE_EffectiveAffinity` | 浮点数列表 | 同上 |
| `WK_DBG_TREE_RootPreference` | 浮点数列表 | `[0.80,1.00,0.85,0.75,1.00,0.70,0.90]` |
| `WK_DBG_LastGrowthTickAt` | 浮点数 | `0` |
| `WK_DBG_NextTickRequests` | 整数 | `0`（服务器已收到的按钮请求次数） |
| `WK_DBG_NextTickResult` | 字符串 | `F2_NOT_CONNECTED`（未结算） |

服务端 F1 图在实体创建、收到 Debug 写入或刷新信号时，将原始变量写入对应关卡镜像。**不要在编辑器中直接编辑镜像来模拟 Soil 输入**；那只是改了副本，不会改变原始实体。

## 3. 在千星沙箱的信号管理器中创建三个信号

1. 打开「千星沙箱」→「信号管理器」。
2. 新建 `WK_Debug_Refresh`，**没有参数**。
3. 新建 `WK_Debug_NextTick`，**没有参数**；这是手动下一 Tick 的调试请求入口，F1 尚不会执行生长。
4. 新建 `WK_Debug_Write`，严格按以下顺序创建三个参数（包括大小写和类型）：

   | 参数名 | 类型 | 语义 |
   | --- | --- | --- |
   | `Field` | 整数 | `0` Soil，`1` Tree Stage，`2` Tree Reserve，`3` Tree Growth，`4` Base Affinity，`5` Effective Affinity，`6` RootPreference |
   | `Index` | 整数 | 七元素索引 0..6；Stage 不使用索引 |
   | `Value` | 浮点数 | 该分量的**新绝对值**，不是增量 |

5. 保存关卡。信号名称和参数顺序必须与源码中 `defineSignal(...)` 相同；信号不存在、类型或顺序不符会阻断正确的节点图事件连接。不要凭空编造信号 ID。

服务端约束：Soil/Reserve/Growth 非负且不高于 100000；Affinity 非负且不高于 10；RootPreference 0..1；Tree Stage 限 0..2；`LastGrowthTickAt` 只读。不执行 F2 容量归一化或任何自动生长。两张实体图通过接收同一信号并按 `Field` 分类处理输入；仅支持 F1 单 Soil、单 Tree。

## 4. 生成和导入两张服务器 `.gia`

1. 获取 PR #9 最新提交，使用已有 pnpm 安装依赖后运行：
   ```sh
   pnpm --filter @idea-slime-bar/genshin build
   ```
2. 预期产生 `WK_Soil_Water.gia`、`WK_Tree_State.gia`，根目录在 `packages/genshin/dist/`；若输出保留源文件的子目录，使用真实输出路径，**不要在未运行时把预期文件视为已生成**。
3. 打开「千星沙箱」→「服务器节点图资源管理器」→导入真实生成的两张 `.gia`，确认它们是**服务器实体节点图**，不是客户端节点图。
4. 将 `WK_Soil_Water` 挂载到 `WK_Soil_Plot`，将 `WK_Tree_State` 挂载到 `WK_Aquamelon_Tree`。检查图内 `self` 指向挂载物件，`stage` 对应关卡实体。检查监听事件中 `WK_Debug_Write` 三个参数和 `WK_Debug_Refresh`，若导入后信号脚位缺失则在编辑器中按同名信号重新绑定。
5. 保存地图。不需要地图自动注入、不需要复合节点、不需要额外编辑器元件。

## 5. 手动创建客户端 Debug Panel

**7.1 正式入口：**「界面控件组管理 → 界面布局 → 添加界面控件 → 客户端控件容器 → 画布设置 → 前往编辑」。

1. 在当前测试布局中创建一个**专用于开发的**客户端控件容器，设为「初始可见」及运行时激活。进入容器画布，在其默认根容器节点设置名称 `WK_DebugRoot`。这要与 Lua 的 `game.FindClientUIRoot('WK_DebugRoot')` 精确对应。
2. 在根容器下面直接添加这些**客户端**控件（不要用旧版服务器 UI 按钮）：
   - `Snapshot`：**文本视窗**，尽可能占据上部，用于 8 行变量读回。
   - `EditorValue`：**文本框**，显示当前编辑的字段、元素、草稿值及步长。
   - `Status`：**文本框**，显示「已发送 / 等待刷新」。
   - 以下 **13 个预设按钮**，其根级子控件名称严格为：
     `FieldPrev`、`FieldNext`、`ElementPrev`、`ElementNext`、`StepPrev`、`StepNext`、`Decrease`、`Increase`、`Zero`、`Apply`、`ReloadDraft`、`Refresh`、`NextTick`。
3. 给按钮设置可辨认的静态文本（字段←/→、元素←/→、步长−/+、数值−/+、归零、应用、重载草稿、刷新、**立即执行下一个 Tick**），并启用按钮「可交互 / 光标检测」。按钮尺寸、位置在画布中手动布局即可，Lua 不创建编辑器资产。
4. 打开「千星沙箱 → 客户端脚本资源管理器」。在任意客户端脚本文件夹右键「**新建脚本映射**」，将映射指向仓库内 `packages/genshin/src/aquamelon-kitchen/WK_F1_DebugPanel.lua` 的真实本地路径。
5. 选择 `WK_DebugRoot` 客户端控件 →「脚本」页签 →「添加脚本」→选中刚刚的映射。**仅保存 Lua 源文件不足以加载脚本，必须建立映射并挂载。**
6. 保存布局与关卡。该面板仅在 `game.IsTestPlay()` 时显示；正式局中 Lua 会隐藏 `WK_DebugRoot`。调试信号及写入图仍是**仅开发关卡使用的入口**，正式发布前须从正式地图移除；不能把客户端的 `IsTestPlay` 当成服务器访问控制。

官方说明入口：[客户端控件和客户端脚本](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhbgxf0nynww) / [客户端控件 API](https://act.mihoyo.com/ys/ugc/tutorial/detail/mhtakr07vej4)。

## 6. 首次实机验收

1. 在编辑器选择「节点图日志 → 服务器节点图」和「客户端脚本日志」，启动**试玩**。若客户端脚本报「Missing debug control」，对照第 5 步检查根控件名称及各个子控件。
2. 面板 `Snapshot` 应显示 Soil/Tree 8 项原始状态和两行 Next Tick 回执（原始默认均如第 1、2 步）。若为 `?`，按 **Refresh**，观察 Level 镜像是否同步；同时检查两张服务器图是否挂载及关卡镜像变量是否已经声明。
3. 默认选中 Soil 和 Fire；使用 FieldNext/Prev 与 ElementNext/Prev 将选择切换到 Soil/Hydro。选择步长为 `10`，将草稿从 `0` 改到 `10`，按 **Apply** 后 **Refresh**；应读回 Soil: `[0,10,0,0,0,0,0]`。
4. 将 Hydro 调成 20，按 Apply/Refresh，确认变成 `[0,20,0,0,0,0,0]`；不要把「已发送」文本当成已确认写回。
5. 切到 Tree Reserve → Dendro，设置 5；Tree Growth → Hydro，设置 12；Tree Stage 设置 2。每次 Apply/Refresh 后核对 Mirror 与**原始 Tree 实体**的自定义变量都变化；Soil 保持不变。
6. Affinity/RootPreference 使用 0.01 或 0.1 步长修改并确认精度和合法范围。检查根系偏好不会超过 1；检查 `LastGrowthTickAt` 为只读。
7. Soil Hydro 改成 150，确认本 F1 不会立即压到 100。因为容量规范化只会在将来的 F2/F3 Soil Tick 时执行。
8. 点击 **立即执行下一个 Tick**（`NextTick`）一次，查看面板底部的 `Next Tick: server ACK=1 / sent=1` 和 `Next Tick result: NOT_EXECUTED_F2_MISSING`；服务器日志应有 `WK_Debug_NextTick rejected: F2 Growth Tick not implemented`。再次点击，ACK 应为 2。**这里只验证按钮→服务器→客户端回执，不代表生长结算已发生**；Soil、Tree Growth、Tree Reserve 和 `LastGrowthTickAt` 均须不变。若 ACK 不增长，先检查信号管理器是否创建 `WK_Debug_NextTick`，以及 Tree 节点图是否重新导入；不能把发送当成执行成功。
9. 退出试玩、重新开始，记录状态是否恢复组件默认值；这不代表离线保存或跨局持久化已实现。验证截图、信号定义、客户端脚本日志、服务器日志、两个实体及关卡镜像的读回值后再推进下一轮。

如编辑器版本缺少所述入口、某一官方 API 报错或列表同步语义不同，请保留**实际菜单/错误截图**，不要替换成猜测的 API、GUID 或自动注入流程。当前仅交付源代码与绑定说明，`.gia` 是否实际生成、导入成功和 Lua 是否实际运行，必须由编译结果与实机验证确认。

## 7. 状态和不包含的功能

- **已提交源码**：server TS + Lua Debug Panel（含 NextTick 请求与未接入回执）+ 手动编辑器指南。
- **现有 CI**：`pnpm typecheck` 与 Web build；**没有** `gsts` build 或 Lua 集成测试，绿灯不等于可导入。
- **仍待用户实机**：真实 `.gia`、自定义变量与信号定义、控制容器、脚本映射、状态写入回读、重进表现。
- NextTick **尚不能加速生长**：F2 完成后由服务器结算器负责推进一次真实 Tick，不能在 F1 偷偷增加 Growth、修改时间戳或添加第二套公式。
- 不做完整 Growth Tick、04:00 出芽、离线结算、花果、多人玩法、生产用 Lua 计算或新 CI workflow。
