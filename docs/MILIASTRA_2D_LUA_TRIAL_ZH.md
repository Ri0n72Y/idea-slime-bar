# Aquamelon Kitchen · 千星 Lua 文字试玩（独立探索支线）

## 定位和边界

本支线与现有 Web 版本、千星正式 F1 PR #9 **并列，不覆盖、不合并它们的运行状态**。源文件：
- \`packages/genshin/src/aquamelon-kitchen/2d/WK_TextTrial.lua\`。

这是**单机、客户端内存试玩**：没有服务器节点图、信号、永久存档、离线回放、多人同步。数据仅存在当前 Lua 脚本运行内；关卡重进会重置。正式千星版仍要让服务器掌握权威状态，并从 Web 的 canonical domain / MVP 设计迁移完整 Growth Tick，不能把这个局部 Lua 测试计算作为权威实现。

**本次可试玩：**铺土、播种、七元素选择、向土壤临时直接加入 10 单位、每 10 秒自动推进一次 Tick、手动前进 1 / 10 Tick、查看 Soil / Growth / Reserve、重置。土壤溢出同比压到 100、0.99 自然保留、根系单元素 cap/总 6 cap、Seed 45→Seedling 90→Sapling 阈值与 Web v0 的试验系数一致。**Sapling 只收集 Reserve**；不自创树苗代谢、芽叶、花果与加工计算。\`AddElement\` 是试玩辅助按钮，**不等价于** Web 的元素球生命周期/捕获动作。

不要把 Lua 游戏内的 \`NextTick\` 与 PR #9 的服务器 \`WK_Debug_NextTick\` 混用；**这两个是不同测试世界**。当前 F1 的信号仍是未执行 F2 的回执。

## 社区做法及取舍

1. 官方 7.1 新增客户端容器、文本视窗、预设按钮、图片、客户端 Lua，支持\`game.FindClientUIRoot\`、\`root:FindChild\`、\`AddCursorEventListener\`、\`OnUpdate(dt)\`。
   - https://act.mihoyo.com/ys/ugc/tutorial/detail/mhiufi00ceh4
   - https://act.mihoyo.com/ys/ugc/tutorial/detail/mhbgxf0nynww
   - https://act.mihoyo.com/ys/ugc/tutorial/detail/mhtakr07vej4
   - https://act.mihoyo.com/ys/ugc/tutorial/course/home （3.21 点击收集教程）
2. 社区 \`1475505/miliastra-beyond-simulator\` 支持外部 Lua/UI 沙箱、Web/MCP/DSH 接入及导入导出，但支持的是**官方 API 的一个模拟子集**；先模拟试玩，最后仍须千星实机验收。
   - https://github.com/1475505/miliastra-beyond-simulator
3. \`1475505/Miliastra-toolbox-primitive-shape\` 与 \`1475505/Miliastra-image-editor-webui\` 用图元、图片模板、GIA/Lua 输出 2D 画面，可作为下一步像素美术工具链；不适合在这个最小文字试玩中预先引入。
   - https://github.com/1475505/Miliastra-toolbox-primitive-shape
   - https://github.com/1475505/Miliastra-image-editor-webui

## 官方编辑器最小接入步骤

1. 在测试关卡选择当前试玩角色**实际应用的界面布局**：界面控件组管理 → 界面布局 → 添加「客户端控件容器」，确保容器**初始可见、激活**。
2. 选中该容器 → 画布设置 → 前往编辑。将客户端画布根容器命名为 \`WK_TextTrialRoot\`。
3. 在根容器下**直接添加**两个客户端「文本视窗」：\`Snapshot\`（大号、多行状态）和 \`History\`（较小的最近操作日志）。
4. 同层添加以下 **8 个客户端预设按钮**，名称必须精确匹配（大小写敏感）。显示文字可自由写：
   - \`PlaceSoil\`（铺土）、\`PlantSeed\`（播种）、\`ElementPrev\`（上个元素）、\`ElementNext\`（下个元素）
   - \`AddElement\`（向土壤加所选元素 10）、\`NextTick\`（推进 1 Tick）、\`Next10Ticks\`（快进 10 Tick）、\`Reset\`（重置）
5. 设定按钮可点击、布局画布给 \`Snapshot\` 足够空间。千星沙箱 → 客户端脚本资源管理器 → 新建脚本映射 → 指向源码 \`WK_TextTrial.lua\` 的实际本地文件路径。
6. 选中 **\`WK_TextTrialRoot\` 客户端根控件** → 脚本 → 添加脚本 → 选择映射。保存控件容器、界面布局、关卡，开始试玩。脚本从 \`OnStart\` 注册按钮，在 \`OnUpdate\` 根据累计真实帧时间推进，仅当 Lua 与界面容器确实运行时才会结算。
7. 如果 UI 未显示，先检查**该玩家实际应用的布局**、容器可见且激活、根控件名称与脚本映射；如果报 \`missing button\`，逐项核对八个按钮名称和直接子节点层级。

这份试玩不涉及 \`.gia\` 生成，也**不要求加载**当前 F1 Soil / Tree 节点图；刻意降低首次实机操作成本。

## 操作验证清单

1. 启动：显示「空地、尚未播种」，按钮不报错。
2. 先尝试播种与加元素，状态不变；铺土后可以播种，重复铺土/播种不应复制实体。
3. 默认水元素，点击加元素一次，Soil Hydro 为 10，Tree Growth 仍 0（尚未 Tick）。
4. 点击 \`NextTick\`：Tick +1，土壤先保留 99%、之后吸收；水元素 Growth 开始增加（Seed/Seedling）。
5. 重复补充元素并用 \`Next10Ticks\` 快进：Seed Growth 达 45 转 Seedling，清空该阶段 Growth 并固化有效亲和；再达 90 进入 Sapling。
6. Sapling 阶段：后续吸收增加 Reserve；**不会出现未实现的叶片或成熟水瓜**。
7. \`Reset\` 返回初始状态；退出关卡后重进数据重新初始化。日志检查客户端是否有运行时错误。
8. 分别在 PC 和手机画布检查两块文本和按钮是否可读、可点。**模拟器绿灯不算官方实机验证**。

## 后续阶段（需另立 Issue 确认）

- 先做一次 Web canonical 状态与 Lua 状态**同样操作序列的比较**，逐项确认基础七元素、Tick 和 stage 语义；然后迁移完整器官/材料/元素球规则，防止独立 Lua 实验分叉。
- 像素 2D：沿用同一操作键和状态读口，用客户端图片模板/图元、Tween 和网格视窗替换文字表现；优先“植物单体+状态面板”，不是一开始就画完整农场。
- 3D：最后迁移到场景实体、动画与服务端权威算图。客户端 Lua 回归视图和输入请求角色；持久化、多人一致性、离线 Growth Tick 不能依赖本地 Lua 内存。

本次仅源码 + 编辑器说明，不声称本地 Lua 已执行、外部模拟器已实际试玩，或千星真机验收成功。不增加仓库 CI/测试工作流，也不触碰 PR #9。
