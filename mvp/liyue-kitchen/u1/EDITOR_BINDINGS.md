# 璃月厨房 U1 — Lua 动态布局与编辑器最小配置

当前源码：`mvp/liyue-kitchen/u1/client_main.lua`。状态：**待千星编辑器注册真实模板、DSH 模拟器运行与用户实机验证**。旧 U1 模拟器 PASS 针对静态控件版，不能转移至本版本。

## 编辑器只需提供的资源

1. 在「界面布局」创建并激活一个全屏**客户端控件容器**；其中保留一个名为 `LK_C_Root` 的客户端**容器节点**，将 `client_main.lua` 的客户端脚本映射绑定到这个节点。根节点覆盖整个画布，保持激活、可见；脚本依赖 `script.object` 指向该容器。移除旧版根下手工放置的 `LK_T_*`、`LK_C_Plot*` 等静态 U1 控件，避免重影。
2. 在「客户端控件模板」库各建立**以下八个父节点模板**。模板内部不挂 Lua 脚本；实例化只能使用已注册模板的父节点，不能将布局里的服务器控件或模板的子节点 ID 直接作为实例化来源。
3. 进入客户端脚本资源的「编辑脚本变量」，创建下表八个**整数**参数，分别填写编辑器中该客户端控件模板的真实**模板索引**。索引来自编辑器选中模板时显示的索引，不能使用运行时控件 ID 或猜测值。`script:GetParam` 读取该整数并传给 `game.InstantiateClientUIControl`。

| Lua 参数 | 编辑器客户端模板类型 | 视觉/交互配置 |
| --- | --- | --- |
| `LK_TPL_CONTAINER` | 容器节点 | 空白、无子节点；运行时作为 `LK_U1_Runtime`，占满根画布 |
| `LK_TPL_FRAME` | 图片 | 透明/半透明底 + 连续矩形边框；可按目标尺寸拉伸；仅装饰、**不抢光标** |
| `LK_TPL_ORB` | 图片 | 透明水晶球圆形边缘；仅装饰、**不抢光标** |
| `LK_TPL_HEX_OPEN` | 图片 | 已开垦六边形地格；装饰层 |
| `LK_TPL_HEX_LOCKED` | 图片 | 锁定六边形地格；装饰层 |
| `LK_TPL_SELECTION` | 图片 | 金色六边形空心高亮环，中央透明；默认隐藏；不能挡文字与点击 |
| `LK_TPL_TEXT` | 文本框 | 左对齐，文字背景透明、无射线交互；字号与内容由 Lua 修改 |
| `LK_TPL_HIT` | 光标检测区域 | 无可见图片，开启射线检测；仅七块地格可触发点击 |

**没有统一的固定 `templateIndex` 值。** 每个奇域的实际模板索引由编辑器资源确定。现有仓库不包含这八个实际模板及其已注册索引；完成编辑器配置前，脚本会输出 `binding_failed reason=missing_template_index ...` 并拒绝构造假界面。

## 布局与事件

所有布局都由 `client_main.lua` 内的 `LAYOUT` 声明，参考画布 **1920×1080**，坐标原点位于左上角。运行时通过官方 `game.GetUICanvasSize()` 获取当前画布，以 `min(width/1920, height/1080)` 统一缩放并居中；使用 `SetAnchorMin/Max(0.5,0.5)`、`SetPivot(0.5,0.5)`、`SetAnchoredPosition`、`SetSizeDelta` 和字体字号缩放。PC 1600×900 与手机 1280×720 同属 16:9，缩放倍率分别为 5/6 与 2/3；画布发生变化时 `OnUpdate` 重排现有实例，不重新创建。千星控制器安全区和屏幕刘海区仍需实机检查。

Lua 运行时创建十个可见、独立边界的区域：**顶栏、访客、洞天水晶球、委托、探索、剥壳、物品栏、仓储、榨汁/装杯、反馈**。九个矩形区域用 `LK_TPL_FRAME`，中央水晶球以 `LK_TPL_ORB` 的圆形轮廓作为边框。区域文本与边框位置使用同一份 `LAYOUT` 数据，物品栏/仓储共 14 个空槽位边框。

七格中心与顺时针顺序：`P01` 中心 `(930,407)`，外围依次 `P02` `(930,252)`、`P03` `(1063,330)`、`P04` `(1063,484)`、`P05` `(930,561)`、`P06` `(797,484)`、`P07` `(797,330)`（均为参考画布左上坐标）。每格创建独立地块图片、透明高亮环、状态文字与 `LK_C_PlotNN` 光标检测区域。**热区在最上层创建**，环与底图为装饰层，不应阻止热区接收点击。

实际状态：P01 已开垦，可选中或取消；P02～P07 锁定，点击只提示拒绝。顶部初始第 1 天、仙力 0。结束今日、访客、凝聚、仓储、加工、委托及探索均仅显示禁用/待开发文本，**不接入 U2～U9**。

生命周期：每次 `OnStart` 先移除旧监听，销毁上次的同名 `LK_U1_Runtime`，再用八个模板索引构建场景。`OnDestroy` 清理该场景与七个监听；实例销毁使用官方 `game.DestroyClientUIControl`。各控件通过运行时返回值管理，不再要求编辑器预放 35 个命名控件。

## DSH / 千星验证步骤

DSH 模拟器中需要将**真实 U1 Lua 原文件**配置到对应客户端脚本映射，并在测试存档注册与编辑器一致的模板索引，确认模拟器支持 `game.InstantiateClientUIControl`、`game.DestroyClientUIControl`、`game.GetUICanvasSize`、`script:GetParam`、尺寸与锚点 API。若沙箱缺少正式 API，应保留明确的阻塞日志和原因，**不得使用沙箱专有 Lua 创建方法替代**。

- PC 1600×900、手机 1280×720：检查十个完整区域边框、七格可见、文字不溢出（特别是右下工作区）、金色环不压状态文字；保存两端截图。
- 点击 P01、再次 P01，再点击 P02～P07：确认选中/取消/锁定拒绝及 `[LK/U1] plot_click` 日志；水晶球边缘、背景图片与状态文字不能抢点击。
- 重复 `OnStart`、退出重进：确认 `LK_U1_Runtime` 仅一份，每个 `LK_C_PlotNN` 仅一条点击监听；旧对象销毁，没有资源或按钮重复创建。
- 点击禁用功能区：不能产生种子、订单、生产物、仙力或游戏日推进。模拟器运行结果与真实千星编辑器运行结果分别记录，不以模拟器截图替代用户实机验收。

此次环境能执行 Lua 5.3 **语法解析**，没有连接千星编辑器，也没有可调用的 DSH 模拟器。故**动态模板创建、运行时布局、真实点击、图层和 PC/手机视觉均 UNVERIFIED**，原先 U1 沙箱 PASS 不适用于本版。按 Request 不恢复 `mock_click.lua`，不提交新的假控件 Lua 测试。

## API 依据

- 千星官方客户端控件与脚本说明：https://act.mihoyo.com/ys/ugc/tutorial/detail/mhbgxf0nynww
- 社区从千星 Lua 注释生成的 API 索引：`game`（`InstantiateClientUIControl` / `DestroyClientUIControl` / `GetUICanvasSize`）：https://haminpants.github.io/miliastra-lua-api/global/game.html
- 控件通用锚点、位置、尺寸、销毁前状态：https://haminpants.github.io/miliastra-lua-api/class/ClientUIBaseControl.html
- `Script:GetParam`：https://haminpants.github.io/miliastra-lua-api/class/Script.html
- 模拟器支持范围（仅可行性线索，实际环境版本仍待验证）：https://github.com/1475505/miliastra-beyond-simulator/blob/master/studio/docs/control-support.md