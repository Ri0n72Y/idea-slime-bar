# 水瓜厨房 MVP

本目录是“水瓜厨房”第一版 MVP 的开发入口，也是当前 MVP 的 source of truth。

目标平台是《原神·千星奇域》UGC。当前 MVP 不按照仓库根目录 `architecture/` 中的 Cordis + Godot 正式架构实现；这些架构文档属于独立的长期正式项目方向，不作为本轮千星奇域原型的开发约束。

新上下文进入开发时，先读本文件，再按“必读顺序”读取其余文档。当前基础生长链仍在逐项收敛，不能仅凭旧 roadmap 直接跳过未完成设计。

## 当前状态

**设计状态：总体闭环与数据边界已收敛；Seed → Seedling → Sapling 的第一周数值基线已经锁定，Sapling 现作为当前版本主要长期玩法阶段，重点转向每日出芽、叶片分流、花果循环与产量。**

当前已经固定：

- 第一版 MVP 的目标、完成条件和明确不做内容；
- 千星奇域水瓜树的世界设定；
- 点击对象、史莱姆自动移动、劳动与搬运的基础交互；
- 土壤 → 树体 → 子器官的七元素养分流模型；
- 统一 Growth Tick、固定 1.0/h 总吸收上限、RootPreference、单元素 30%×Affinity Cap、内部储备与 Growth Vector；
- Stage 升级时清空 Growth，并固定当前连续学习得到的亲和作为下一阶段基准；
- Sapling 每日服务器时间 04:00 的出芽检查、0/1/2/3叶概率 0.80 / 0.40 / 0.01 / 0；
- Bud 独立 Growth、20 Growth 成叶、掐芽时 Growth 完整回主干；
- 0/1/2/3叶时第一层预算固定为 Tree 1.0 / 0.7 / 0.4 / 0.1，每片叶约0.3；Flower / Fruit 只在所属母叶的0.3预算内部继续分流，不影响其它叶片；
- Sapling 主干100 Growth只更新自身亲和，不进入下一 Stage；
- 叶片的 Bud / SmallLeaf / LargeLeaf 生命周期，以及 Fruit Growth=100 时 parent Leaf 同步转为纤维质 Aquamelon Leaf；
- Bud→SmallLeaf→LargeLeaf→FlowerBud 使用集中时间边界；Flower/Fruit 使用同一生殖 Growth 轴 0→30→100；
- 基于服务器时间和事件边界的离线 Growth settlement；首次跨 bloom boundary 时让玩家登录后看到花期；
- 全局可调配置与七元素固定索引；
- 只显示最强元素颜色、不提供元素 UI；
- Fruit 形成后累计 `FruitElementAmount[7]`，v0 Flavor 直接派生为七元素比例；Mature Fruit 后仍可低效率继续富集；
- 第一种元素反应：水 + 草 → 绽放 / 草种子性状体；
- 活体器官采摘后的独立 world Material identity，以及 GreenFruit 与 Mature Aquamelon 两条不同加工路线；
- 1～3 份等体积水瓜汁混合及结果重算。

当前不扩展第二种元素反应、更多料理、顾客经营或多人系统。基础生长链以 [growth-foundation-requirements.md](growth-foundation-requirements.md) 的 checklist 为当前设计进度来源；未确认的吸收 / Growth / Stage 数值不得由实现阶段自行补全。

## 必读顺序

1. [requirements.md](requirements.md)  
   第一版 MVP 的目的、边界和完成标准。开发时先用它判断“该不该做”。

2. [setting.md](setting.md)  
   千星奇域水瓜树的世界设定。解释为什么只有一棵长期培养的树、为什么会受七元素影响，以及多人长期方向。

3. [development-conventions.md](development-conventions.md)  
   当前实现层开发约定。固定七元素索引、Reserve / Growth / Affinity 向量表示，以及节点图中的统一数据访问方式。

4. [growth-system.md](growth-system.md)  
   当前植物生长的主要 source of truth。定义土壤储备、树体内部储备、Growth Tick、Stage、叶片、花果、连续学习与体验目标。

5. [growth-foundation-requirements.md](growth-foundation-requirements.md)  
   当前正在逐条收敛的基础生长链 checklist。记录哪些规则已经确认、当前讨论到哪里，以及哪些内容还不能进入实现。

6. [growth-balance-baseline.md](growth-balance-baseline.md)  
   当前基础生长数值速查。集中记录 Soil、元素球、RootPreference、吸收上限、单元素 Cap、Seed / Seedling 阈值，以及对应的新手登录体验和第一轮推算。

7. [elemental-cultivation.md](elemental-cultivation.md)  
   七元素培养结果、表现与后续料理规则。RootPreference 与 Growth Affinity 已分离；口味、绽放、水瓜汁等下游规则继续保留在本文件。

8. [interaction.md](interaction.md)  
   MVP 的输入与劳动方式：玩家不直接控制史莱姆移动，而是点击可交互对象下达行动。

9. [implementation-roadmap.md](implementation-roadmap.md)  
   当前实现地图与 SDD 工作流。用 Mermaid 和 Checklist 列出待实现功能、依赖关系、可选择起点，以及“Feature → Flow Blocks → Files → GitHub Issue/Spec → 开发 → 验收”的标准流程。

## 当前核心闭环

```text
元素浇灌
↓
土壤七元素储备
↓
Growth Tick：土壤蒸发 / RootPreference + 单元素饱和吸收
↓
Seed / Seedling：直接转成 Growth
↓
Sapling 起：进入树体 Reserve
↓
每日04:00检查出芽 + Bud / Leaf 长期循环
↓
SmallLeaf 12h → LargeLeaf 12h → FlowerBud 约24h → 可见开花
↓
Flower Growth 0→30，在母叶预算内约50% sink，持续塑形 Affinity
↓
Growth=30 形成 Fruit 并锁定 Affinity
↓
Green Fruit 30→100，在母叶预算内80–90%强 sink；Mature Fruit 100+ 在母叶预算内约20%继续富集
↓
FruitElementAmount → 派生 FlavorRatio
↓
Fruit Growth=100：Green Fruit → Mature Fruit；parent Leaf 同步纤维化为 Aquamelon Leaf
↓
采摘：SmallLeaf → TenderLeaf；LargeLeaf → ThickLeaf；Aquamelon Leaf → AquamelonLeaf
↓
采摘：Green Fruit → GreenFruit；Mature Fruit → Aquamelon
↓
GreenFruit → GreenFruitPeel + GreenFruitFlesh
Aquamelon → AquamelonShell x2 + AquamelonJuice
AquamelonShell → AquamelonFlesh + remaining shell material
↓
后续混合 / 料理
↓
玩家观察结果
↓
反向决定下一轮培养
```

第一条优先验证的可见闭环是：**土壤供给 → 树体成长 → 叶片生成与变色 → 玩家采集 → 再生**。

完整第一版仍要证明：**玩家会为了想得到某种器官或水瓜汁结果，主动改变下一轮水瓜树的培养方式。**

## 开发切入顺序

具体功能拆分、依赖关系和可选择起点统一以 [implementation-roadmap.md](implementation-roadmap.md) 为准。

以下列表保留为高层实现依赖顺序：

1. 建立土壤七元素储备、Growth / Stage / Affinity 基础状态；Sapling 起再引入 Tree Reserve。
2. 建立统一 Growth Tick，并支持按 UTC 时间补算离线 Tick。
3. 实现元素球刷新 / 半衰、土壤浇灌与容量归一化、土壤蒸发、RootPreference / 单元素饱和吸收。
4. 实现 Seed → Seedling → Sapling 的直接 Growth 转换，再进入 Sapling 起的 Reserve / Growth 模型。
5. 实现每日04:00出芽事件、Bud=20、掐芽回流、最多3叶和 Tree/Leaf 分流。
6. 实现 SmallLeaf / LargeLeaf / FlowerBud 的集中时间结算，再实现 Flower 0→30、Fruit 30→100、阶段 sink 与 Affinity 锁定。
7. 接入最小点击劳动和叶片采集，按 SmallLeaf → TenderLeaf、LargeLeaf → ThickLeaf 的材料 identity 形成第一条可重复的可见闭环。
8. 再接入元素球、`FruitElementAmount → FlavorRatio`、Growth=100 的母叶同步成熟、GreenFruit / Aquamelon 采摘与已确认的最小材料加工；绽放、六维 Taste 与料理扩展另开 Spec。
9. 最后把各独立功能串成完整“培养 → 采集 → 制作 → 发现 → 再培养”闭环。

这里描述的是实现依赖顺序，不额外增加新的玩法设计。

## 新元素反应策划（尚未并入 MVP 实现合同）

[果实元素反应结算：设计基线与待解冲突](fruit-reaction-settlement-design.md) 记录了后续策划讨论确认的 90G 初次成熟数值基线、1U=30G、严格 >1U 的主动触发条件、KQM 实验优先级作为默认触发方向、单次 1U 消耗及挂果富集／复合反应。**已澄清花与果实只使用一份连续的七维 Growth 向量：30G结果、90G初次成熟**；但当前 main 仍写有 Fruit Growth=100 及独立 FruitElementAmount/FlavorRatio。策划稿不直接覆盖现有实现合同，待下一轮同步旧文档和实现边界。

## 未来更新备忘

[future-updates.md](future-updates.md) 记录当前已经出现、但明确不进入本轮 MVP 的设计方向。现阶段主要包括植物健康度：均衡培养最稳定、定向培养获得特色但增加生理压力、极端纯元素培养可能低产且更适合特殊加工。

该文件不是当前实现 source of truth；未来真正开发这些能力时需要重新形成独立 Spec。

## 外部基础资料

以下文档仍然有效，但不是本目录中的 MVP source of truth：

- [普通水瓜 Aquamelon](../../docs/plants/aquamelon.md)：原世界水瓜的基础形态、部位和材料来源。
- [植物养分—生长系统](../../docs/plants/nutrient-growth-system.md)：跨世界、跨植物复用的通用养分 / Growth / Affinity / Stage 模型。
- [Growth Tick](../../docs/plants/growth-tick.md)：通用的单次生长结算顺序。
- [气候系统占位](../../docs/plants/climate-system.md)：当前仅接收器官环境逸散接口，不实现气候反馈。
- [游戏概念](../../docs/overview.md)：正式项目的总体世界与设计原则。

## 历史玩法文档

以下文档来自“反复播种 + 加工设备 + 餐厅经营 + 积分扩张”的早期 MVP 方案。它们可以提供未来设计参考，但**不能覆盖本目录的现行 MVP 规则**：

- [旧种植方案](../../docs/gameplay/farming.md)
- [旧加工方案](../../docs/gameplay/processing.md)
- [旧餐厅与顾客方案](../../docs/gameplay/restaurant.md)
- [旧 MVP 积分与解锁](../../docs/gameplay/progression.md)

尤其需要注意：

- 当前千星奇域 MVP 只有一棵长期培养、不会自然凋亡的水瓜树，不执行“留种 → 播种 → 再种植”循环；
- 当前千星奇域 MVP 的材料加工以本目录已确认的 GreenFruit / Aquamelon 路线为准，不要求旧加工设备链；后续水瓜汁混合建立在 `AquamelonJuice` 材料之上；
- 顾客经营、积分扩张和生产压力都不是当前第一版完成条件。

## 尚未设计、不要自行补全

进入开发时，以下内容仍应保持未定义状态，不应由实现者自行扩写：

- RootPreference、固定 1.0/h 总吸收上限、单元素 `0.30 × Affinity` Cap、Seed → Seedling = 45、Seedling → Sapling = 90、Sapling 主干100 Growth周期、Bud=20、每日04:00出芽概率、0~3叶分流、SmallLeaf/LargeLeaf/FlowerBud 时间边界、Flower 0→30、Fruit 30→100、Affinity lock、三档 leaf-local 生殖 sink 与 FruitElementAmount / FlavorRatio 已锁定；仍未锁定的是单元素 Cap 读取 Base / Effective Affinity、多元素重分配、Reserve 上限 / 休眠细节、具体 Growth rate 校准与最终产量；
- 元素球的刷新位置、牵引细节、多人归属与元素种类的进一步叙事规则；
- 元素锁定能力的获取、解除和表现方式；
- 第二种及之后的元素反应；
- 叶片进入料理后的口味和用途；
- 草种子性状体作为独立材料的玩法；
- 更复杂的料理加工和配料；
- Processing 产物之间的 `ElementAmount` 分配、`Affinity` 继承 / 变化、yield / mass conservation 公式；
- 传统 inventory slot、stack size、container、pickup capacity 与 generic item/component framework；
- 顾客评价生成；
- 多人访问、材料交换和互动对树体的隐藏影响。

如果开发步骤触及这些边界，应先回到设计讨论，而不是自行补规则。
