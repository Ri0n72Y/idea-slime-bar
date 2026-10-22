# Aquamelon Kitchen — 千星奇域 2D Lua 单机 Demo

本目录是游戏规则与 Lua 2D 实施规格，不包含程序和图片资产。

**目标：**种植 → 七元素培养与遗传 → 花果成长及反应 → 收获 → 一份水瓜变一份果汁 → 生成完整 AI 品尝提示词。

**架构：**全部游戏状态、结算与 UI 控制使用本地 Lua；编辑器手工布置静态控件；不使用服务端节点图、多人同步、网络 AI 或后端。

**参赛时间：**1 uh = 10 秒现实时间；所有游戏数值仍以 uh 为单位，不随画面刷新改变。

## 阅读顺序

| 文件 | 内容 |
| --- | --- |
| [01-scope.md](01-scope.md) | P0、P1、技术与玩法范围 |
| [02-data-and-balance.md](02-data-and-balance.md) | 单位、七维数据、土壤、根系、预算与校准值 |
| [03-growth-and-harvest.md](03-growth-and-harvest.md) | 生命周期、亲和遗传、单一花果账户、采摘 |
| [04-elemental-reactions.md](04-elemental-reactions.md) | 反应消耗、产物及结算顺序 |
| [05-sensory-identity.md](05-sensory-identity.md) | 七元素感官及反应口感 |
| [06-flavor-contract.md](06-flavor-contract.md) | 七元素风味与反应产物的品尝数据合同 |
| [07-juice-and-ai-prompt.md](07-juice-and-ai-prompt.md) | 一果一汁、事实数据与 AI 品尝文本合同 |
| [08-ui-and-visuals.md](08-ui-and-visuals.md) | P0 界面、操作、图标名与实测主体色 |
| [09-lua-editor-notes.md](09-lua-editor-notes.md) | 已验证的一行一条 Lua 结构/绑定经验与必要边界 |
| [10-acceptance-and-gaps.md](10-acceptance-and-gaps.md) | 最小验收与确实尚未有确定数据的事项 |

## 状态口径

- **参赛已定**：纯本地 Lua、1uh=10秒、元素球固定50V、根系上限2/1.85/16、B0=5.4、100～180V归一对数限流、24uh一次后续出芽投签、45/90/20/26/12/40/90G生命周期、一果一汁、线性成熟富集（90G为原速度50%，150G为0）。
- **动态养分**：根系从Soil取得的实际V随土壤供给、根系上限及Tree Reserve变化；Sapling的`B_ref=B0×F_growth(R)×Δuh`随当前Reserve与结算时长变化。`/7`仅为七元素的等基准份额，每维再乘Tree EffectiveAffinity并以真实Reserve截断，**不是固定7V/次或固定1V/元素**；Tree/Bud得到的V直接形成Growth，不重复放大。详细合同见[数值基线](02-data-and-balance.md)。
- **显色已定**：初始七维亲和度确定底色，当前Growth或剩余自由元素归一混色按30%叠加；**首个实际生成的反应产物锁定整果名称/图标**，后续产物不改外形但仍影响风味。全部颜色运行时由Lua执行。
- **风味合同**：按七元素感官方向及全部现存反应产物的质地与口腔体验生成描述；`E_free[7]+Products[]` 是唯一果实物质账户。
- **反应主动资格**：初次成熟按本次真实新增元素或无法分辨时的候选优先级结算；成熟后的新反应由**本次新增元素**担任主动方，且其自由量须严格`>30G`，不能让已存在的被动元素替代触发。风扩散仅由本次新增风主动；感电首次启动另须双方各至少12G。规则见[元素反应](04-elemental-reactions.md)。
- **冻结与燃烧已定**：冻结直接按冰块处理；燃烧是草的生发被火激发的持续活跃热感，区别于超载爆炸式刺激。
- **待验证/少数未定**：复花阈值、固定50V输入下的真实产率、Lua图像/长文本/设备能力。
- **技术已验证范围**：千星本地Lua能取得已挂载UI宿主并更新已有文字控件，其余需区分文档API可用与实际编辑器验收。
