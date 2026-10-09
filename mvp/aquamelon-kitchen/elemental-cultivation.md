# 水瓜厨房 MVP：七元素培养与水瓜汁混合

本设计稿保留七元素培养表现与下游料理设计记录。**当前 Sapling 生命周期、Fruit Affinity 锁定点、`FruitElementAmount[7]` 与 v0 `FlavorRatio` 的 source of truth 已迁移到 [七元素养分与生长系统](growth-system.md)。本文后半部旧六维 Taste / 绽放 / 水瓜汁公式只作为延后设计草稿，不得覆盖当前 v0 Fruit Flavor 语义。**

**植物如何从土壤获取元素、如何形成 Growth Vector、如何经历 Stage、叶片 / 花 / 果如何持续学习亲和与分流养分，已经迁移到 [七元素养分与生长系统](growth-system.md)。本文件不再作为这些生长规则的 source of truth。**

第一版的培养链已经更新为“土壤储备 → 树体储备 → Growth Tick → 器官生长”。

```text
浇灌元素到土壤
↓
土壤形成七元素储备并持续蒸发
↓
树按 Stage 吸收能力、RootPreference 与单元素饱和规则从土壤吸收
↓
树体内部形成七元素 Reserve
↓
Growth Tick 消耗 Reserve 并形成七元素 Growth Vector
↓
Tree 先向各 Leaf 做第一层预算分流；每片 Leaf 再只在自己的预算内向附属 Flower / Fruit 分流
↓
器官按自身亲和、Stage 与损耗继续生长
↓
Growth / Affinity 决定颜色与形态
↓
采摘后的活体器官先转换为独立 world Material，再由已确认的材料加工关系进入料理链
↓
玩家根据结果反向调整下一轮培养
```

生长与养分流的 source of truth 见 [七元素养分与生长系统](growth-system.md) 和根目录 [Growth Tick](../../docs/plants/growth-tick.md)。

本版本不扩展第二种元素反应，不设计复杂料理、多人互动、顾客经营和生产系统。

相关背景见 [千星奇域水瓜树](setting.md) 和 [水瓜厨房 MVP 需求](requirements.md)。

## 生长与七元素数据来源

旧版曾在本文件中定义“浇灌直接写入树体、树体元素连续衰减、器官生成时做一次静态元素快照”。

这些规则已经被新的养分—生长模型替代。

当前应按以下文档理解：

- [七元素养分与生长系统](growth-system.md)：千星奇域水瓜树的土壤、树体 Reserve、Growth Vector、Stage、叶片、花果与体验目标。
- [开发约定](development-conventions.md)：七元素向量、Reserve / Growth / Affinity 的实现层语义。
- [通用植物养分—生长系统](../../docs/plants/nutrient-growth-system.md)：跨项目的抽象模型。
- [Growth Tick](../../docs/plants/growth-tick.md)：每次生长 Tick 的统一执行顺序。

### RootPreference 与 Growth Affinity

旧版把同一组 Affinity 同时用于“从来源提取元素”和“转化为 Growth”。这一语义已经废弃。

当前正式分为两类参数：

#### RootPreference

RootPreference 表示 Tree 根系在混合 Soil 中“更容易吃什么”。

```text
TREE_RootPreference[7]
range = 0~1
```

它只用于：

```text
SOIL_Elems
→ TREE_Elems / Reserve
```

RootPreference 不参与 Growth 转换、不参与当前 Affinity 连续学习，也不能通过大于 1 来提高吸收效率。

具体七元素 RootPreference 数值尚未确定，后续需要结合普通玩家、定向培养和单元素减速目标一起平衡。

#### Growth Affinity

Affinity 保留原有“吃进去以后长得多有效”的语义，并允许超过 1。

当前已有基础值继续作为 Growth Affinity 参考：

| 元素 | Tree | Leaf | Flower / Fruit |
| --- | ---: | ---: | ---: |
| 火 | 0.85 | 0.75 | 1.00 |
| 水 | 1.15 | 1.10 | 1.00 |
| 风 | 0.90 | 1.00 | 1.00 |
| 雷 | 0.75 | 0.85 | 1.00 |
| 草 | 1.20 | 1.30 | 1.00 |
| 冰 | 0.70 | 0.90 | 1.00 |
| 岩 | 0.95 | 0.80 | 1.00 |

Stem 已退出当前器官模型，不再保留 Stem Affinity。

Growth Affinity 用于：

```text
Reserve → Growth 转换：
使用完整 Affinity

未定型 Stage：
在 Base Affinity 上持续学习

Stage 变化：
固定当前 Effective Affinity
→ 作为下一 Stage 的 Base Affinity
```

因此不再存在：

```text
从来源提取：
min(Affinity, 1)
```

这一旧规则。

### 浇灌与容量归一化

玩家浇灌的是土壤，不直接修改树体 Reserve。

土壤总容量当前以 100 为第一版基线。元素球进入 Soil 时直接：

```text
SOIL_Elems += BALL_Elems
```

捕获时不做容量计算，允许总量暂时超过 100。

下一次 Soil Growth Tick 开始时，如果：

```text
SoilTotal > Capacity
```

则整体等比例压缩：

```text
KeepRatio = Capacity / SoilTotal
SOIL_Elems[i] *= KeepRatio
```

超出的部分当前直接丢弃。

例如：

```text
旧土：
雷 50 / 水 30 / 草 20

加入雷 50 后：
雷 100 / 水 30 / 草 20
总量 150

下一 Tick：
× 100 / 150

结果：
雷 ≈ 66.67 / 水 20 / 草 ≈ 13.33
```

连续投同一元素会逐步替换原有组成，但不会在捕获瞬间通过“先挤旧土再加入”的旧算法处理。


### 旧“元素锁定”规则

旧版定义的“树体元素锁定后不衰减、不被挤出”建立在旧模型上。

新的土壤—Reserve—Growth Tick 模型下，锁定究竟作用于土壤、树体 Reserve、Affinity 还是其他培养机制尚未重新设计。

因此：

> **元素锁定能力暂时退出当前实现 source of truth，等待后续单独设计，不要把旧锁定语义直接迁移到新系统。**

### 旧连续衰减公式

以下旧公式：

```text
TreeElementNew
=
TreeElementOld × (1 - DecayRate)^ElapsedHours
```

不再用于树体 Reserve。

当前基础节奏改为统一 Growth Tick，并使用实际 dt：

```text
CFG_GrowthUpdateIntervalSeconds ≈ 60
SoilRetentionPerHour = 0.99
TreeGrowthRetentionPerHour = 0.99
```

在线更新周期只控制反馈频率，真实变化量按 `RatePerHour + dt` 计算。

树体内部元素的减少主要来自“用于生长的实际代谢和 Tree → Leaf 第一层分流”；Flower / Fruit 只继续分流所属母叶已经获得的预算，而不是额外从整株 Tree 抽取。树体不再额外叠加统一的自然蒸发。

## 培养结果与玩家体验目标

七元素培养不是“输入一个配方就得到固定产品”的系统，而是一个有随机扰动、可观察、可学习并逐渐可控的培养过程。

### 普通玩家：随机输入得到普通水瓜

完全不了解系统的新人玩家，可以把随机刷出的元素球都投入土壤。

目标结果：

- 七元素输入长期相对分散；
- 最终不形成明显单一元素主导；
- 产出以普通水瓜为主；
- 每个果实仍因随机输入略有差异，但完整味道向量应与普通水瓜基线大体接近。

随机输入仍允许偶然形成偏水、偏草等方向，因此新人有机会偶然获得一两个 Hydro Aquamelon、Dendro Aquamelon 等特殊果实。它应当像“第一次发现培养系统存在”的惊喜，而不是无需理解就能稳定复制的配方。

### 定向培养：有效，但不是免费收益

玩家如果只投入某一种元素，应当能够明显推动该元素性状。

但单元素不能独自撑满 Tree 的完整吸收吞吐量：

```text
只供给单元素
→ 目标元素持续富集
→ 该元素达到自身有效吸收饱和
→ 其他元素无法补足根系吞吐
→ 总吸收 / 生长速度明显下降
```

因此“只浇一种”是简单、有效但低效的定向培养方法。

更熟练的玩家需要在：

```text
目标元素占比
×
其他元素提供的生长支撑
```

之间寻找配比。

### 果实类型不是单一标签替代完整组成

当前培养结果至少区分三种方向：

```text
普通水瓜
→ 没有明显主元素

单元素水瓜
→ 某元素达到显著水平
→ 且与第二 / 第三元素拉开明显差距

元素反应型水瓜
→ 两种相关元素都处于较高水平
→ 第一元素没有形成明显单一主导
→ 满足对应元素反应条件
```

“显著水平”“明显差距”的具体阈值尚未确定。

当前水 + 草的绽放 / 草原核水瓜属于第一种元素反应型水瓜。其他元素反应暂不扩展。

即使两个果实都被归类为同一种单元素水瓜，它们的其他六种元素含量也可以不同，因此完整风味和性状仍然会有批次差异。

### 高纯度不等于高品质

接近完全纯净的单元素水瓜应当：

- 很难稳定培养；
- 因单元素吸收饱和而成长较慢、产量偏低；
- 风味和性状非常极端；
- 未必适合直接食用；
- 更可能作为特殊料理、加工或工业型原料。

因此培养的目标不是简单把某个元素堆到 100，而是根据用途寻找合适的组成。

### 玩家如何掌握系统

正式玩家不依赖精确元素数值 UI。

有经验的玩家应主要通过世界表现推断状态，例如：

```text
土壤颜色
→ 当前 Soil 元素组成

树干 / 树体颜色
→ TREE_Elems / Reserve 的主要组成

叶片 / 花朵颜色与形态
→ 已形成的 Growth / Effective Affinity

果实颜色、形态与风味
→ 最终培养结果
```

Debug UI 可以显示精确向量，但正式体验应鼓励玩家通过观察、记录和重复实验掌握培养。

## 元素颜色

第一版元素主题色采用以下参考值：

| 元素 | HEX | RGB |
| --- | --- | --- |
| 火 | `#EC4923` | 236, 73, 35 |
| 水 | `#00BFFF` | 0, 191, 255 |
| 风 | `#359697` | 53, 150, 151 |
| 雷 | `#945DC4` | 148, 93, 196 |
| 草 | `#66AD16` | 102, 173, 22 |
| 冰 | `#4682B4` | 70, 130, 180 |
| 岩 | `#DEBD6C` | 222, 189, 108 |

颜色参考：[《原神七元素主题色颜色代码汇总》](https://www.cnblogs.com/Genius-Society/p/17209549.html)。

这些颜色属于 MVP 的全局视觉配置，后续可以统一替换，不散落在具体材质或节点逻辑中。

## MVP 显色规则

第一版仍然不做综合色，也不向正式玩家显示精确元素 UI。

但显色的数据来源已经从“生成时元素快照”改为新版养分—生长状态。

### 树体

树体可以根据当前 `TREE_Elems` Reserve 的主要组成动态表现当前内部营养倾向。

### 未定型器官

Tender / Thick / Flower 等仍在发育的 Stage，可以随着当前 Growth Vector 与 Effective Affinity 的变化改变颜色或形态。

### Stage 固定

进入下一 Stage 时，当前 Effective Affinity 会成为新 Stage 的 Base Affinity。

如果某元素 Affinity 达到：

```text
VariantThreshold
```

则器官可以进入对应的元素颜色 / 变种形态；没有任何元素达到阈值时保持普通形态。

普通外观不代表内部没有元素亲和，隐藏 Affinity 仍然保留。

多个元素同时超过阈值时的视觉优先级由后续表现 Spec 确定，不在本文件自行补规则。

千星奇域中的视觉实现仍采用：

```text
基础素材
+
元素主题色叠加
+
正片叠底材质
```

第一版调试基线：

```text
ColorStrength = 1
```

## 果实与后续料理数据边界

当前 v0 已确认的 Fruit 数据边界是：

```text
Flower Growth 0 -> 30
→ Growth=30 形成 Fruit，并锁定当前 Affinity
→ 30 <= Growth < 100：Green Fruit
→ Growth >= 100：Mature Fruit
```

Fruit 形成以后不再塑形 Affinity，而是累计：

```text
FruitElementAmount[7]
```

当前 v0 的 Flavor **不做额外数值转换**：

```text
FruitElementTotal = Σ FruitElementAmount[e]

FlavorRatio[e]
= FruitElementAmount[e] / FruitElementTotal
```

总量为 0 时视为尚未形成 Flavor。`FruitElementAmount[7]` 是持久化事实，`FlavorRatio[7]` 是派生解释，不应无必要重复保存。

Mature Fruit 到 Growth=100 后仍可以继续低效率累积元素，因此 FlavorRatio 仍会变化。100 只表示物理成熟，不表示 Flavor locked 或元素累计停止。

Green Fruit / Mature Fruit 的物理形态、采摘价值和生殖器官 nutrient sink 以 [七元素养分与生长系统](growth-system.md) 为准。

**下游感官设计共识：** 料理/材料未来以 [三阶段 Taste 与口腔感官模型](taste-model.md) 描述入口（Entry）、中段（Body）、回味（Finish）；每阶段包括五味（甜、酸、苦、咸、鲜，0～5）、四种口腔感官（涩、辣、麻、凉，0～1）及可选的特色标签。此模型**不等于**现行七元素 `FlavorRatio`，尚未制定转换公式，不授权修改运行时。

## 历史/延后草稿：旧六维 Taste、绽放与水瓜汁

以下内容来自更早的料理层设计。**旧六维 Taste 的结构已经被 [三阶段五味四感官共识](taste-model.md) 取代**；绽放修正与水瓜汁旧公式仍是延后草稿。它们均**不属于 v0 Fruit Flavor source of truth，也不进入本轮实现**。

后续如果实现感官转换、绽放、取汁或混合，需要基于当时的 `FruitElementAmount / FlavorRatio` 和新三阶段语义形成独立 Spec；**不得恢复旧六维 Taste 作为正式字段**，也不得直接把下面旧公式接入当前 Growth Tick。

尤其当前不存在：

```text
FruitElementAmount
→ six-dimensional Taste
```

这样的 v0 conversion pipeline。下面公式仅保留设计参考。

## 延后草稿的历史迁移说明

下面的口味、绽放和水瓜汁规则继续保留为**历史设计草稿**，不再视为当前已确定的 v0 下游结果。

但它们旧文中的输入曾被写成一次性的 `OrganElement` 快照。新的果实模型已经变为：

```text
Flower Stage
→ 持续 Growth / Affinity 学习
→ 进入 Fruit Stage 时固定 Affinity 与外层形态
→ Fruit Stage 继续累积汁液 / 内容物
→ 成熟果实
```

因此未来若重新启用这些料理扩展，需要在对应 Spec 中重新明确：

- 口味读取 Fruit Stage 的哪一组最终向量；
- 绽放检测读取果皮、内容物还是两者组合；
- 水瓜汁继承哪一层成熟数据。

在这些输入尚未重新锁定前，下面的数值公式保留，但**不要直接按旧 `OrganElement` 数据源实现。**

## 历史草稿：果实基础六维 Taste（已被新结构取代）

以下是当时设计的六个旧口味维度，仅供比较：

```text
Sweet       甜
Sour        酸
Bitter      苦
Astringent  涩
Fresh       清爽
Tingle      刺激
```

范围均为 0～100。

普通水瓜基础值：

| 口味 | 基础值 |
| --- | ---: |
| 甜 | 45 |
| 酸 | 6 |
| 苦 | 3 |
| 涩 | 5 |
| 清爽 | 55 |
| 刺激 | 0 |

## 延后草稿：七元素 Taste 修正

下表表示某元素达到 100 时的最大修正：

| 元素 | 甜 | 酸 | 苦 | 涩 | 清爽 | 刺激 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 火 | +8 | 0 | +2 | 0 | -15 | +30 |
| 水 | +10 | -2 | -1 | -5 | +25 | 0 |
| 风 | +2 | +8 | 0 | -3 | +20 | +6 |
| 雷 | -3 | +15 | +2 | 0 | +2 | +25 |
| 草 | +4 | 0 | +10 | +15 | +10 | 0 |
| 冰 | +3 | +5 | 0 | 0 | +30 | 0 |
| 岩 | +2 | 0 | +7 | +15 | -5 | 0 |

果实口味仍按完整七元素组成共同修正，而不是只读取“主元素标签”：

```text
Taste
=
BaseFruitTaste
+
Σ(
  FinalFruitElement[element] / 100
  × ElementTasteModifier[element]
)
```

`FinalFruitElement` 的正式数据来源仍需在 Fruit Spec 中与新版 Growth / Affinity / 汁液模型完成映射。

最终各维度限制在 0～100。

因此两个同为 Hydro Aquamelon 的果实，只要其他元素组成不同，味道仍然可以不同。玩家第一版不看到这些精确数值。口味值用于生成饮品结果及后续评价。

## 延后草稿：水 + 草绽放

第一版只实现水元素与草元素的“绽放”性状，不实现其他元素反应。

触发条件：

```text
Hydro >= 25
AND
Dendro >= 25
AND
Hydro + Dendro >= 60
```

满足条件：

```text
Bloom = true
```

### 绽放强度

```text
BloomStrength
=
clamp(
  (min(Hydro, Dendro) - 20) × 4,
  0,
  100
)
```

例如：

| 水 | 草 | 绽放强度 |
| ---: | ---: | ---: |
| 25 | 35 | 20 |
| 30 | 30 | 40 |
| 40 | 45 | 80 |
| 50 | 50 | 100 |

## 草种子性状体

达到绽放条件的果实会形成“草种子性状体”。

它不是新的水瓜树种子，也不能用于繁殖，而是水、草元素在果实中形成的稳定特殊组织。

相比普通水瓜，它需要产生明显的质变：

- 果实基础色仍由最强元素决定；
- 果实内部出现可辨认的草种子状特殊组织；
- 果肉或汁液出现柔软的种子状悬浮物；
- 料理后仍保留明显不同于普通水瓜汁的性状表现。

第一版不把草种子性状体拆成独立可采集 Item。

数据上只保存：

```text
Bloom
BloomStrength
```

## 绽放口味修正

基础元素口味计算完成后，再按照 BloomStrength 加入反应修正。

BloomStrength = 100 时：

| 口味 | 修正 |
| --- | ---: |
| 甜 | +15 |
| 酸 | 0 |
| 苦 | -8 |
| 涩 | -10 |
| 清爽 | +20 |
| 刺激 | 0 |

实际修正：

```text
BloomTasteModifier
=
BloomConfig.TasteModifier
× BloomStrength / 100
```

这一反应的目标是让水与草产生质变，而不是简单叠加：

- 水元素提供清甜和清爽；
- 草元素原本会增加植物性的苦涩；
- 绽放发生后，苦涩明显降低，甜和清爽进一步提升；
- 同时出现草种子性状体。

## 延后草稿：果实与水瓜汁

下面“果实直接取汁 / 水瓜汁继承果实快照”的旧写法已经被当前材料身份合同覆盖，不再作为 v0 Processing source of truth。

当前已确认的 Mature Aquamelon 路线是：

```text
Aquamelon
-> AquamelonShell x2
 + AquamelonJuice x1
```

`AquamelonJuice` 是独立 world Material。Processing 时 `ElementAmount` 如何从 Aquamelon 分配到两个 Shell 与一份 Juice、`Affinity` 如何继承 / 变化，本轮明确不定义；因此不得直接把旧“整份七元素快照复制给水瓜汁”的规则接回当前实现。

后续如果重新启用水瓜汁颜色、味道和元素反应，应读取当时对应 Material Spec 已锁定的数据语义，而不是恢复旧的固定料理 ID 或快照复制规则。

## 延后草稿：混合水瓜汁

第一版只允许混合 1～3 份等体积水瓜汁。

不加入：

- 水
- 糖
- 冰块
- 固体配料
- 加热
- 其他烹饪技法
- 自定义体积比例

混合后每种元素取参与水瓜汁的算术平均：

```text
MixedElement[element]
=
Σ JuiceElement[element] / JuiceCount
```

随后从最终元素组成重新计算：

```text
MixedElement
↓
DominantElement
↓
主题色 + 正片叠底
↓
基础口味 + 七元素口味修正
↓
检测水草绽放
↓
如触发：
  BloomStrength
  绽放口味修正
  草种子性状体表现
```

混合结果不保留复杂加工历史。

相同最终元素组成应得到相同的基础颜色、口味和元素反应结果。

## 延后草稿：料理闭环示例

玩家先将水瓜树培养成偏水状态。

果实在成熟过程中形成偏水的最终元素组成，并显示水元素主题色。玩家采摘后制成水系水瓜汁。

之后玩家改变培养方式，获得偏草果实并制成草系水瓜汁。

例如：

```text
水系汁：
水 60

草系汁：
草 60
```

混合后：

```text
水 30
草 30
```

满足绽放条件。

饮品因此出现：

- 草种子性状体；
- 与普通水瓜汁不同的特殊质地；
- 更高的甜和清爽；
- 更低的苦和涩。

玩家并不知道“水 30 / 草 30”这些内部数值，只能通过蓝色、绿色原料和最终发生的明显质变理解二者之间存在特殊关系。

这一发现会反向推动玩家尝试直接将水瓜树培养成水、草同时富集的状态，从而完成第一版：

```text
培养
→ 观察
→ 采集
→ 制作
→ 发现
→ 再培养
```

的核心闭环。

## 第一版边界

本设计稿到此为止。

第一版不继续设计：

- 第二种元素反应；
- 多元素综合色；
- 元素 UI 和精确数值展示；
- 叶片的口味和料理用途；
- 草种子性状体的独立采集；
- 更复杂的料理材料与加工方式；
- 多人互动对元素状态的隐藏影响；
- 顾客评价生成；
- 元素锁定能力的获取方式。
