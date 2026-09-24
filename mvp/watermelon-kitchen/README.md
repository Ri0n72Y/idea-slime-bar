# 水瓜厨房 MVP

本目录是“水瓜厨房”第一版 MVP 的开发入口，也是当前 MVP 的 source of truth。

目标平台是《原神·千星奇域》UGC。当前 MVP 不按照仓库根目录 `architecture/` 中的 Cordis + Godot 正式架构实现；这些架构文档属于独立的长期正式项目方向，不作为本轮千星奇域原型的开发约束。

新上下文进入开发时，先读本文件，再按“必读顺序”读取其余文档。当前基础生长链仍在逐项收敛，不能仅凭旧 roadmap 直接跳过未完成设计。

## 当前状态

**设计状态：总体闭环与数据边界已收敛；基础生长链仍在逐项确认，当前重点是 Soil → Tree 的 RootPreference / 吸收饱和公式。**

当前已经固定：

- 第一版 MVP 的目标、完成条件和明确不做内容；
- 千星奇域水瓜树的世界设定；
- 点击对象、史莱姆自动移动、劳动与搬运的基础交互；
- 土壤 → 树体 → 子器官的七元素养分流模型；
- 统一 Growth Tick、按阶段根系规模、RootPreference、内部储备与 Growth Vector；
- Stage 升级时清空 Growth，并固定当前连续学习得到的亲和作为下一阶段基准；
- 叶片的嫩叶 / 肥厚叶 / 成叶阶段与子器官分流；
- 花与果作为同一器官的两个阶段；
- 基于 UTC 时间的离线 Growth Tick 补算方向；
- 全局可调配置与七元素固定索引；
- 只显示最强元素颜色、不提供元素 UI；
- 七元素对果实六维口味的基础修正；
- 第一种元素反应：水 + 草 → 绽放 / 草种子性状体；
- 果实 → 水瓜汁；
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

6. [elemental-cultivation.md](elemental-cultivation.md)  
   七元素培养结果、表现与后续料理规则。RootPreference 与 Growth Affinity 已分离；口味、绽放、水瓜汁等下游规则继续保留在本文件。

7. [interaction.md](interaction.md)  
   MVP 的输入与劳动方式：玩家不直接控制史莱姆移动，而是点击可交互对象下达行动。

8. [implementation-roadmap.md](implementation-roadmap.md)  
   当前实现地图与 SDD 工作流。用 Mermaid 和 Checklist 列出待实现功能、依赖关系、可选择起点，以及“Feature → Flow Blocks → Files → GitHub Issue/Spec → 开发 → 验收”的标准流程。

## 当前核心闭环

```text
元素浇灌
↓
土壤七元素储备
↓
Growth Tick：土壤蒸发 / 树体按 Stage、RootPreference 与单元素饱和规则吸收
↓
树体内部 Reserve
↓
生长预算向叶 / 花 / 果分流
↓
按亲和转换为 Growth Vector
↓
连续学习亲和 + Stage 变化
↓
器官颜色 / 形态变化
↓
采集器官与果实
↓
后续取汁 / 混合 / 料理
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

1. 建立土壤七元素储备、树体 Reserve / Growth / Stage / Affinity 基础状态。
2. 建立统一 Growth Tick，并支持按 UTC 时间补算离线 Tick。
3. 实现土壤浇灌与容量归一化、土壤蒸发、树体按 Stage / RootPreference / 单元素饱和吸收。
4. 实现树体 Growth 转换与 Seedling → Sapling → Mature。
5. 实现叶片生成、叶片三个 Stage、子器官分流、连续学习与显色。
6. 接入最小点击劳动和叶片采集，形成第一条可重复的可见闭环。
7. 再接入元素球、花果、口味、绽放、取汁与水瓜汁混合。
8. 最后把各独立功能串成完整“培养 → 采集 → 制作 → 发现 → 再培养”闭环。

这里描述的是实现依赖顺序，不额外增加新的玩法设计。

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
- 当前第一版料理只做水瓜汁混合，不要求旧加工设备链；
- 顾客经营、积分扩张和生产压力都不是当前第一版完成条件。

## 尚未设计、不要自行补全

进入开发时，以下内容仍应保持未定义状态，不应由实现者自行扩写：

- RootPreference 的七元素基础值、单元素吸收饱和公式、各 Stage 的最终 GrowthThreshold / MaxAbsorbPerHour、连续学习函数和成熟产量仍需通过当前设计 checklist、Spec 与调试平衡确定；
- 元素球的刷新位置、牵引细节、多人归属与元素种类的进一步叙事规则；
- 元素锁定能力的获取、解除和表现方式；
- 第二种及之后的元素反应；
- 叶片进入料理后的口味和用途；
- 草种子性状体作为独立材料的玩法；
- 更复杂的料理加工和配料；
- 顾客评价生成；
- 多人访问、材料交换和互动对树体的隐藏影响。

如果开发步骤触及这些边界，应先回到设计讨论，而不是自行补规则。
