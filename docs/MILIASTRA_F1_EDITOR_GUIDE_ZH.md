# 千星奇域 F1：Soil / Tree 服务端状态与首次编辑器验收

对应 [Issue #8](https://github.com/Ri0n72Y/idea-slime-bar/issues/8)。本手册针对 **第一版 F1**，假设编辑器里没有任何水瓜资源。源码位于 `packages/genshin/src/aquamelon-kitchen/`。

## 1. 边界与资源清单

- **WK_Soil_Plot**：场景中的普通物件（Soil / Plot），拥有 `SOIL_Elems` 和测试浇水变量；挂载服务器实体节点图 `WK_Soil_Water`。
- **WK_Aquamelon_Tree**：场景中的普通物件（Aquamelon Tree），拥有 Tree 变量；挂载只读服务器实体节点图 `WK_Tree_State`。
- **Level / Stage Config**：使用编辑器**已有的关卡实体**即可；F1 没有读取 CFG 的执行逻辑，因此不新建配置元件、GUID、信号或独立物件。日后的 F2 才决定 CFG 变量绑定。
- 两个物件都可以先使用编辑器现有的基础占位模型，不需要自建元件、模型、复合节点或树木表现。
- **仅 Soil 需要「选项卡」通用组件**，用于手动触发测试输入。两者均需「自定义变量」组件。没有脚本自动创建这些组件。
- 所有状态都由服务器实体自定义变量持有。**这里的“状态”只保证实体在本局存在时可读写，不等于跨关卡、退出重进或离线持久化**；后者仍待对应 Feature 实机确认。

七元素列表固定索引：`0 Fire / 1 Hydro / 2 Anemo / 3 Electro / 4 Dendro / 5 Cryo / 6 Geo`。所有完整向量必须含 **7 个浮点值**。

## 2. 新建 Soil、Tree 物件

1. 打开一个用于开发的空关卡；在编辑器「实体摆放」选择可用的普通**物件**，摆放两个不同的物件。将其分别命名为 `WK_Soil_Plot` 和 `WK_Aquamelon_Tree`；确保二者在游戏开始时被创建并且不会立刻销毁。
2. 选中 `WK_Soil_Plot` →「组件」页签 → 查找「自定义变量」。若缺失，使用「添加通用组件」新增「自定义变量」→「详细编辑」。
3. 在 Soil 的自定义变量组件中逐条添加（名字区分大小写）：

   | 名称 | 编辑器类型 | 初始值 | 作用 |
   | --- | --- | --- | --- |
   | `SOIL_Elems` | 浮点数列表 | `[0,0,0,0,0,0,0]` | 唯一 Soil 元素事实源 |
   | `SOIL_WaterTabId` | 整数 | **步骤 4 读取的真实选项卡 ID** | 事件过滤 |
   | `SOIL_WaterElementIndex` | 整数 | `1` | 测试 Hydro 输入 |
   | `SOIL_WaterAmount` | 浮点数 | `10` | 单次测试输入量，非玩法默认值 |

4. Soil →「组件」→「添加通用组件」→「选项卡」。在组件中至少配置「测试浇水」和一个用于重新切换的「空/等待」选项；记录**测试浇水选项的编辑器真实选项卡 ID**，回填 `SOIL_WaterTabId`。不要把 NodeGraph 的 `1073741830` 当成选项卡 ID。若界面没有显示可取得的选项卡 ID，先停止绑定，保留组件截图/字段名交给 Mate，不要猜常量。
5. 选中 `WK_Aquamelon_Tree` →「组件」→「自定义变量」→「详细编辑」，逐条添加：

   | 名称 | 编辑器类型 | 初始值 |
   | --- | --- | --- |
   | `TREE_Stage` | 整数 | `0`（F1 Seed；1=Seedling、2=Sapling） |
   | `TREE_Elems` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
   | `TREE_Growth` | 浮点数列表 | `[0,0,0,0,0,0,0]` |
   | `TREE_BaseAffinity` | 浮点数列表 | `[0.85,1.15,0.90,0.75,1.20,0.70,0.95]` |
   | `TREE_EffectiveAffinity` | 浮点数列表 | `[0.85,1.15,0.90,0.75,1.20,0.70,0.95]` |
   | `TREE_RootPreference` | 浮点数列表 | `[0.80,1.00,0.85,0.75,1.00,0.70,0.90]` |
   | `LastGrowthTickAt` | 浮点数 | `0`（未运行 Tick；本轮不读写） |

6. 逐项确认名字、类型、**列表长度 7**及数值顺序正确。Seed / Seedling 没有 Reserve：`TREE_Elems` 预留为全 0，不在此阶段读取用于生长。此处只初始化阶段，不自动推进阶段。保存关卡。

## 3. 生成、导入并挂载 `.gia`

1. 获取包含本 F1 PR 分支的代码，根目录安装仓库锁定依赖：`pnpm install --frozen-lockfile`。已有依赖则不用重复安装。
2. 在仓库根目录执行 **`pnpm --filter @idea-slime-bar/genshin build`**，对应 `packages/genshin/package.json` 的 `gsts`。当前 `gsts.config.ts` 只编译两个 F1 入口，**不会**编译旧 `WK_Element_ApplyInput` 连续衰减图及模板 `main.ts`。
3. 预期在 `packages/genshin/dist/` 下生成 **`WK_Soil_Water.gia`**、**`WK_Tree_State.gia`**（并有同名 `.gs.ts`/`.json` 中间产物）。这是**预期文件名与产物根目录**，具体是否保留 `src/aquamelon-kitchen/` 子目录以及编译成功与否尚待实际 build 输出核验；以编译器报告的实际路径为准，不能把尚未执行的 build 视为已生成。
4. 在编辑器打开「千星沙箱」→「服务器节点图」资源管理器。使用编辑器提供的节点图 / 资产导入入口，手动选择真实生成的 `WK_Soil_Water.gia` 和 `WK_Tree_State.gia`，检查图类型为**服务器／实体节点图**。请勿使用自动 map 注入。
5. 将 `WK_Soil_Water` 挂载到 **WK_Soil_Plot**；将 `WK_Tree_State` 挂载到 **WK_Aquamelon_Tree**。图中的 `self` 必须分别指向自己所属的物件，不能互换；如导入后显示 `_GSTS_` 前缀，请按原始图名确认。
6. 在导入图内检查事件入口分别是「**选项卡被选中时**」与「**实体创建时**」；前者与 Soil 选项卡事件关联，检查三个输入变量和 `SOIL_Elems` 读取名；后者检查 Tree 自定义变量名。组件里的变量名是运行时绑定，不需要填固定实体 GUID；如果导入器保留了未绑定的泛型或引用引脚，按「整数/浮点/浮点数列表」和当前实体完成绑定后保存。**不需要编辑器复合节点**。
7. 保存地图再进入试玩。若当前编辑器版本没有上述导入/挂载入口，请记录实际显示的菜单或截图，不以猜测的资源 ID 或替代节点绕过。

## 4. 实机测试与回传

1. 进入试玩，打开**服务器节点图日志**；应看到 `WK_Tree_State F1 stage / reserve total / growth total:`，随后 `0 / 0 / 0`。若静态摆放的物件没有触发「实体创建时」，记录是否出现日志；不要直接判定状态已成功加载。
2. 与 Soil 物件交互，选择「测试浇水」。应有 `WK_Soil_Water F1 element index / current amount:`，随后 `1 / 10`。用运行时实体自定义变量检查 `SOIL_Elems = [0,10,0,0,0,0,0]`；只看到日志不等于已证明持久写回。
3. 切换到「空/等待」选项，再次选择「测试浇水」；期望读回 `1 / 20` 且 Soil Hydro=20。两次操作都不能改变其它六个元素、Tree Reserve 或 Growth。
4. 结束试玩，在编辑器修改测试输入索引为 `4`、数量为 `5`，保存并重新试玩；验证只增加 Dendro。测试大于 100 的总量时也**不应立即压缩**，因为容量归一化属于后续 F3/F2。
5. 退出、重开试玩后检查：若恢复为组件默认值，记录为「本局内状态」，不要宣称具备离线持久化；若发生其它行为，记录实际数据由 Lead 在未来持久化 Spec 中处理。

请回传：编辑器版本、两个导入图的实际文件路径/挂载对象、选项卡真实 ID、服务器日志、Soil 初始及两次点击后的七元素值、Tree 阶段/Reserve/Growth 值，以及退出重进观察。截图即可。**只有拿到这些实机证据才能勾选 imported/user-tested**。

## 5. 当前明确不做

本图只增加一维测试元素量，**不做容量挤出、归一化、蒸发或吸收**。旧 `WK_Element_ApplyInput.ts` 保留为历史实验源码，但不再参与本 F1 编译；不可导入为正式运行图。没有 Growth Tick、04:00、离线结算、叶/花/果、Lua 或多人机制，也没有新增 CI 工作流。F1 的 `SOIL_WaterAmount=10` 仅是方便验收的输入，不是 F3 水球配方。

证据状态：**source 提交后可审查；CI 类型检查需见对应 PR HEAD 结果；`.gia` generated、editor imported、user-tested 均不能由源码或 CI 自动推断**。
