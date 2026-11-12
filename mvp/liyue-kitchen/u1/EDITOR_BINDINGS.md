# U1 — 千星 16:9 主场景与 Lua 绑定

状态：**待实际千星奇域编辑器搭建 / 待实机复测**。本目录提供可映射 Lua 脚本、编辑器控件清单和本地模拟测试，**不包含编辑器关卡存档或真实游戏截图**。

## 1. 加载和静态布局

1. 在千星奇域创建 16:9 横屏客户端 UI 页面，推荐以 **1920×1080** 作为静态布局参考尺寸；锚点适配其他同宽高比的分辨率。创建名为 `LK_C_Root` 的**根容器节点控件**，启用 `showCursor`，保持根容器 `active`，不能把根挂载的 Lua 宿主关闭。
2. 将本目录 `client_main.lua` 导入客户端脚本资源，创建相应 **Lua 脚本映射**，挂在 `LK_C_Root` 上。不得将脚本当作服务器节点图或 Node/网页程序运行。
3. 以下全部 `LK_*` 控件必须是 `LK_C_Root` 的**直接子控件**，名称逐字匹配；脚本使用 `root:GetChild(name)` 查找，不依赖屏幕坐标或控件 ID 的偶然顺序。
4. UI 图片、文字、布局、字体、边框和颜色由编辑器手动配置；Lua 只更新已存在文本与地格选中边框显隐。所需的水晶球、六边形、柜台、设备贴图资源尚未随 U1 导入，不能视为已经完成静态场景。

### 静态区域（1920×1080 参考像素）

| 区域 | 建议范围/位置 | 编辑器要求 |
| --- | --- | --- |
| 顶栏 | x=40～1880, y=24～112 | 游戏名称、`LK_T_Day`、`LK_T_AdeptalEnergy`、`LK_T_Condense`、`LK_T_EndDay`；结束今日灰显且**无交互事件** |
| 左侧访客留白 | x=40～390, y=150～715 | 只放 `LK_T_Visitor` 文本与空位；不创建对话或发放物品控件 |
| 中央水晶球 | 中心约 (960,430)，可视直径约 620 | 透明圆球视觉、球内空地与**七个可见的六边形**（一中心＋六外围）；`LK_T_Ground` |
| 水晶球正下方 | x=460～1450, y=755～1050 | `LK_T_Inventory`、`LK_T_Storage`，分别有**空的物品槽**及仓储容器，无种子图标 |
| 左下剥壳工作区 | x=45～400, y=755～1050 | `LK_T_ShellStation`，仅设备预留/不可加工 |
| 右下榨汁／装杯工作区 | x=1500～1870, y=755～1050 | `LK_T_Juicer`，仅设备预留/不可加工 |
| 右侧委托/探索 | x=1510～1875, y=150～715 | `LK_T_OrderPanel`、`LK_T_Discovery`，没有真实订单、交单或探索结果 |
| 反馈区 | 水晶球下缘或上缘 | `LK_T_SelectedPlot`、`LK_T_Feedback`，鼠标点击后可清楚读到状态 |

### 七格蜂巢地块（全是可见六边形）

| 地格 | 稳定 `plotId` | 参考中心坐标 | U1 状态 | 必须存在的三个直接子控件 |
| --- | --- | --- | --- | --- |
| 中心 | `P01` | (960,430) | 已开垦 | `LK_C_Plot01` / `LK_T_Plot01State` / `LK_I_Plot01Selected` |
| 上方 | `P02` | (960,263) | 未开垦 | `LK_C_Plot02` / `LK_T_Plot02State` / `LK_I_Plot02Selected` |
| 右上 | `P03` | (1105,346) | 未开垦 | `LK_C_Plot03` / `LK_T_Plot03State` / `LK_I_Plot03Selected` |
| 右下 | `P04` | (1105,514) | 未开垦 | `LK_C_Plot04` / `LK_T_Plot04State` / `LK_I_Plot04Selected` |
| 下方 | `P05` | (960,597) | 未开垦 | `LK_C_Plot05` / `LK_T_Plot05State` / `LK_I_Plot05Selected` |
| 左下 | `P06` | (815,514) | 未开垦 | `LK_C_Plot06` / `LK_T_Plot06State` / `LK_I_Plot06Selected` |
| 左上 | `P07` | (815,346) | 未开垦 | `LK_C_Plot07` / `LK_T_Plot07State` / `LK_I_Plot07Selected` |

每格需额外在编辑器创建**静态六边形底图**，中心使用开放色调，外围六格使用锁定/灰调。`LK_C_PlotNN` 必须使用 **光标检测区域控件**，覆盖该格六边形内部、开启射线检测，建议初始命中矩形约 105×105；不要扩大到与相邻地格重叠。`LK_T_PlotNNState` 用 **文本框控件**，置于命中区不拦截输入的图层。`LK_I_PlotNNSelected` 使用 **图片控件**，编辑器预置透明高亮边框、初始隐藏，始终不阻挡光标射线。检查水晶球其他前景美术是否挡住点击。

其他 14 个动态文字控件（均为文本框）：

`LK_T_Day`、`LK_T_AdeptalEnergy`、`LK_T_Condense`、`LK_T_Visitor`、`LK_T_Inventory`、`LK_T_Storage`、`LK_T_Ground`、`LK_T_ShellStation`、`LK_T_Juicer`、`LK_T_OrderPanel`、`LK_T_Discovery`、`LK_T_EndDay`、`LK_T_SelectedPlot`、`LK_T_Feedback`。

**固定图形与空物品槽**均由编辑器布局，不得根据本脚本 `Game` 中的空库存自动假设真实创建了种子或物品。

## 2. 点击调用与权威状态

- 每个光标检测区域按 `Enum.CursorEventType.CursorClick` 绑定一次，闭包固定对应 `P01..P07`；无需读取鼠标坐标来猜测 `plotId`。
- `Game.plots[P01].unlocked = true`；其余六格 `unlocked = false`。这是 U1 初始显示状态，**未实现**消耗仙力开垦。
- 点击 `P01`：`Game.selectedPlotId = "P01"`，选中框可见，文本提示“已选中”。再次点击：清除选中与高亮。
- 点击任一锁定格：对应 `plotId` 出现在拒绝反馈中，**不改变**当前已选地格；不会扣仙力或开垦。控制台输出 `[LK/U1] plot_click ...` 可复核。
- 顶栏显示第 1 天、仙力 0，属于 **U1 显示初始化值**，未接入存档、订单、凝聚额度或结算；“结束今日”必须呈现禁用，不绑定点击函数。其余生产与探索区域同理。
- 一旦必需控件缺失，脚本输出 `[LK/U1] binding_failed missing=...`，不注册半套事件；可先依据日志补齐编辑器对象。
- `OnStart` 在检查宿主与事件枚举前先清理旧监听；每条监听保存注册时的事件类型，清理时不读取当前全局 `Enum`。重复启动、启动条件失效和 `OnDestroy` 都应移除旧订阅。

## 3. 实机操作与应保存的证据

1. 在千星编辑器完成脚本映射、控件布局、运行 16:9 关卡并截图全景；七格、所有固定区域及空物品槽应同时可见。建议再以另一种 16:9 分辨率复核锚点。
2. 点击中心 `P01`，截图选中框与“当前地格 P01”，记录控制台 `status=selected`。再次点击中心确认 `status=deselected`、高亮消失。
3. 先选中中心再依次点击外围 `P02..P07`，记录六条 `status=locked` 的日志，每次确认 `selected=P01`、仙力仍为 0、天数仍为 1。
4. 点击空物品栏、仓储、工作台、委托、探索、结束今日区域，确认**没有错误成功反馈**，没有凭空创建物品、订单或跨日。
5. 保存实机截图、10～30 秒屏幕录制、脚本控制台日志、编辑器布局对象列表与当前游戏版本。没有这些证据，U1 验收状态保持 **Unverified**。

## 4. 离线测试与平台 API 来源

从仓库根目录运行 `texlua mvp/liyue-kitchen/u1/tests/mock_click.lua`（或 `lua5.3 mvp/liyue-kitchen/u1/tests/mock_click.lua`）。本轮实际使用 LuaTeX 附带的 **Lua 5.3** 执行，输出：`PASS U1 mock: plot click behavior, repeated start, missing host/Enum/control cleanup, and OnDestroy`。测试覆盖成功启动后重复启动、缺失 `script.object` 重入、缺失全局 `Enum` 重入、控件漏绑重入及 `OnDestroy` 清理；千星客户端运行时和编辑器行为仍未验证。

`tests/mock_click.lua` 使用假控件树触发 Lua 回调，验证七个地格映射、中心选择/取消、锁定拒绝、渲染和监听清理，以及漏绑时不注册监听。该测试不加载编辑器资源，不测试真实光标、视觉/分辨率或平台存档能力。

本轮使用的 Lua 接口：`script.object`、`OnStart`/`OnDestroy`、`GetChild`、`AddCursorEventListener`/`RemoveCursorEventListener`、`SetVisible`、文本 `.text`、`showCursor`、`raycastTarget`。参考：
- 官方 7.1 文档：https://act.mihoyo.com/ys/ugc/tutorial/detail/mhtakr07vej4
- API 辅助索引：https://haminpants.github.io/miliastra-lua-api/class/ClientUICursorEventAreaControl.html
- 仓库内只读参考：`mvp/aquamelon-kitchen/09-lua-editor-notes.md`（已验证 Lua 宿主/文字/鼠标，未确认完整新关卡）

## 5. 本轮明确未实现／未验证

- 未执行编辑器导入、贴图制作、静态对象配置及真实 16:9 渲染；没有截图与录屏。
- 未验证新关卡客户端脚本映射、`GetChild` 实际树结构、真实控件命中区、遮挡/鼠标行为与脚本重入。
- 未创建种子、物品 ID、拖动或种植；未实现元素、昼夜、采摘、生产、订单、经济、探索或访客。下一阶段 U2 的全部工作必须由 Lead 另行分派。
