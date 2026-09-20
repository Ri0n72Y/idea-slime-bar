# 水瓜厨房 MVP：七元素培养与水瓜汁混合

本设计稿定义“水瓜厨房”第一版 MVP 中已经确定的元素培养、器官性状、果实口味和水瓜汁混合规则。

第一版的培养链已经更新为“土壤储备 → 树体储备 → Growth Tick → 器官生长”。

```text
浇灌元素到土壤
↓
土壤形成七元素储备并持续蒸发
↓
树按 Stage 吸收上限与元素亲和从土壤吸收
↓
树体内部形成七元素 Reserve
↓
Growth Tick 消耗 Reserve 并形成七元素 Growth Vector
↓
树向叶 / 花 / 果等子器官分流
↓
器官按自身亲和、Stage 与损耗继续生长
↓
Growth / Affinity 决定颜色与形态
↓
果实成熟后进入料理链
↓
玩家根据结果反向调整下一轮培养
```

生长与养分流的 source of truth 见 [七元素养分与生长系统](growth-system.md) 和根目录 [Growth Tick](../../docs/plants/growth-tick.md)。

本版本不扩展第二种元素反应，不设计复杂料理、多人互动、顾客经营和生产系统。

相关背景见 [千星奇域水瓜树](setting.md) 和 [水瓜厨房 MVP 需求](requirements.md)。

## 全局配置

所有可调数值必须集中到全局配置中，不直接写死在具体水瓜树、器官或料理逻辑里。

第一版至少需要覆盖以下配置类别：

```text
ElementMvpConfig
├── Soil
│   ├── MaxElementLoad
│   └── EvaporationRatePerTick
├── GrowthTickInterval
├── Tree
│   ├── BaseAffinity[7]
│   ├── GrowthConsumeRatePerTick
│   ├── StageMaxAbsorbPerTick
│   └── StageGrowthThreshold
├── OrganAffinity
├── OrganRetentionRate
├── OrganChildAllocation
├── AffinityLearningConfig
├── ElementColor[7]
├── VariantThreshold
├── ColorStrength
├── BaseFruitTaste[6]
├── ElementTasteModifier[7][6]
└── BloomConfig
```

具体字段布局以对应 Spec 为准，不要求现在一次性建立完整结构。

以下数值均为第一版调试参数，可以在开发过程中直接调整全局配置。

## 元素培养与生长

旧版“浇灌直接写入 TREE_Elems → TREE_Elems 连续衰减 → 器官生成时一次性快照”的模型已经被新版养分流替代。

当前正式模型：

```text
SOIL_Elems
→ Tree Absorption
→ TREE_Elems (Reserve)
→ Growth Tick
→ TREE_Growth
→ Child Organ Allocation
→ Organ Growth / Affinity Learning
```

完整规则见 [七元素养分与生长系统](growth-system.md)。

### 土壤

玩家浇灌的是土壤。

```text
SOIL_Elems : float[7]
MaxSoilElementLoad = 100
```

输入导致超载时，超出部分按照浇灌前土壤已有元素的比例从整个旧储备中挤出，包括旧的同种元素。

例如：

```text
雷50 火30 水20
+ 雷10

先按 50/30/20 挤出 10
→ 雷45 火27 水18

再加入雷10
→ 雷55 火27 水18
```

因此单一元素培养存在自然边际递减。

土壤每个 Growth Tick 以当前调试基线 `1%` 蒸发。

### 树体 Reserve

树体内部七元素储备：

```text
TREE_Elems : float[7]
```

它不是浇灌输入本身，而是树按当前 Stage 的吸收上限与 Affinity 从土壤中逐步得到的内部储备。

树体当前颜色可以读取 Reserve 组成。

### Growth Vector

树和器官的生长进度改为七元素向量：

```text
TREE_Growth : float[7]
ORGAN_Growth : float[7]
```

生长代谢先消耗 Reserve，再向子器官分流，剩余元素按完整 Affinity 转换成 Growth。

提取元素时：

```text
ExtractionAffinity = min(Affinity, 1)
```

转换 Growth 时：

```text
GrowthGain[i]
=
GrowthNutrient[i] × Affinity[i]
```

因此亲和高于 1 不会从来源中多拿元素，但可以把同样 1 单位元素转化成超过 1 的对应生长度。

### Stage 与连续学习

树、叶和花果都有 Stage。

进入下一 Stage 时：

```text
Growth 清零
当前 Effective Affinity
→ 固定为下一 Stage 的 Base Affinity
```

只保留连续学习，不再使用阶段跃迁时的离散元素加成。

器官的当前元素 / Growth 构成会持续影响 Effective Affinity；具体学习函数由对应 Spec 决定。

### 树 Stage

```text
Seedling
→ Sapling
→ Mature
```

不同 Stage 拥有不同的 `MaxAbsorbPerTick`，表现根系成长。

当前体验目标：

- Seedling 普通玩家一周内进入 Sapling；
- Sapling 最多有 2 个叶片位；
- 两片叶存在时，树自身约保留 0.4 生长预算，每片叶约分得 0.3；
- Sapling 普通玩家每周约成熟 2 片叶，勤劳玩家约 4 片，用对元素可以更高；
- Sapling 正常约 2～3 周进入 Mature；
- 玩家主动掰掉叶片、减少子器官分流并持续催长，可以探索出约 1 周进入 Mature 的路线。

### 叶片 Stage

```text
Tender
→ Thick
→ Mature
```

叶片没有长期 Reserve，从树的本 Tick 生长预算中吸多少就当次使用。

当前方向：

- Tender 无环境损耗，成长快；
- Thick 继续学习并过渡；
- Mature 自身预算约 60% 用于 Growth、40% 逸散到环境；
- Mature 仍可以向花 / 果继续供给养分。

### 花与果

花与果视为同一器官的两个 Stage：

```text
Flower
→ Fruit
```

Flower：

- 持续学习 Affinity；
- 存在环境蒸发；
- 花期 Growth / Affinity 决定未来果皮颜色、形态与 Fruit Stage 亲和。

Fruit：

- Affinity 固定；
- 不再继续学习；
- 不再按花期方式蒸发；
- 后续养分主要累积为汁液 / 内容物直到成熟。

### 元素锁定

旧版 `TREE_Locks` 的语义不能直接套入新版“土壤 → 树 → 器官”养分流。

在新的锁定 Spec 完成前，不把旧版锁定逻辑视为当前生长系统的一部分。

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

以下口味、绽放和水瓜汁规则暂时保留为后续料理层设计。

但新版生长系统下，果实数据来源不再是旧的“生成时 OrganElement 快照”。

未来进入 Fruit Spec 时，需要把这些公式的输入统一映射到：

```text
花期固定下来的 Affinity / 外层形态
+
Fruit Stage 实际累积的汁液 / 果实元素组成
```

在这一映射 Spec 完成前，不应直接把旧 `OrganElement` 公式接到新版 Growth Tick。

## 果实基础口味

第一版只使用六个口味维度：

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

## 七元素口味修正

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

果实口味：

```text
Taste
=
BaseFruitTaste
+
Σ(
  OrganElement[element] / 100
  × ElementTasteModifier[element]
)
```

最终各维度限制在 0～100。

玩家第一版不看到这些数值。口味值用于生成饮品结果及后续评价。

## MVP 唯一元素反应：水 + 草

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

## 果实与水瓜汁

第一版料理前处理只有：

```text
水瓜果实
↓
取汁
↓
水瓜汁
```

暂不模拟出汁率、损耗和不同榨取方式。

水瓜汁继承果实的七元素快照。

颜色、口味和元素反应根据这份元素数据重新计算，不依赖固定料理 ID。

## MVP 唯一料理：混合水瓜汁

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

## 第一版闭环示例

玩家先将水瓜树培养成偏水状态。

新生果实读取当时元素状态，显示为水元素主题色。玩家采摘后制成水系水瓜汁。

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
- 茎秆、叶片的口味和料理用途；
- 草种子性状体的独立采集；
- 更复杂的料理材料与加工方式；
- 多人互动对元素状态的隐藏影响；
- 顾客评价生成；
- 元素锁定能力的获取方式。
