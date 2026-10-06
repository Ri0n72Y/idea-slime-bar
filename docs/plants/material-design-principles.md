# 植物材料设计原则：结构组织与生长累积组织

本文记录植物器官或材料在采摘 / Processing 后形成多个 Material 时，如何判断元素相关语义的 v0 方法。

它只整理已经被当前水瓜设计实际验证过的原则，不建立完整植物生物学框架，也不设计 generic item / material / processing system。

## 1. 先区分材料身份，再判断生长累积由谁承载

一个活体器官或世界材料可以在 Processing 后生成多个不同 Material。多个产物具有不同 biological / material identity，并不意味着来源器官在生长期形成的所有累积都应平均拆分、固定比例拆分或复制到每个产物。

当前先区分两类组织：

### growth-accumulating / storage tissue

真正承担生长期持续富集、储存结果的组织。

如果来源器官在树上继续获得 growth accumulation，应先判断这份持续增加的累积实际上由哪个组织承载，再把这层语义绑定到对应材料。

### structural tissue

已经形成、已经“长好”的结构组织，例如稳定果皮、果壳或从成熟结构中剥离出的组织。

它们可以拥有自己的 `ElementAmount[7]`、`Affinity[7]` 等材料属性，但不会仅仅因为整个果实之后继续挂树富集，就自动继续承接那份果实的 growth accumulation。

结构组织自己的基础 `ElementAmount` 从哪里来、具体是多少，当前不定义。

## 2. Affinity 与 ElementAmount 是两个独立判断

### Affinity

`Affinity[7]` 表达材料 / 组织的元素倾向或性质。当前 v0 默认：

```text
source Material / Organ Affinity[7]
-> every derived Material inherits the full Affinity[7]
```

因此 Processing 产生多个子材料时，各子材料都完整继承来源的 Affinity。

当前不做：

- 按质量拆分 Affinity；
- 按组织衰减 Affinity；
- 按比例守恒 Affinity；
- 为每个 Processing 产物重新计算 Affinity。

### ElementAmount / growth accumulation

`ElementAmount[7]` 包含数量语义。来源器官生长期持续形成的 growth accumulation，只应归属于真正承担富集 / 储存功能的组织。

因此：

```text
full Affinity inheritance
!=
full ElementAmount copying
```

不能因为多个产物都完整继承 Affinity，就推导它们也必须复制同一份 growth accumulation。

## 3. 当前设计步骤

当一个植物器官会被拆成多个材料时，按以下顺序判断：

1. 先识别每个产物的 biological / material identity。
2. 判断哪个组织是真正的 growth accumulation carrier。
3. 判断哪些组织已经是 formed structural tissue。
4. Processing 产物的 Affinity 当前默认完整继承来源。
5. 只把持续生长形成的 accumulation 绑定到实际承载它的组织。
6. 没有明确玩法需求时，不提前设计复杂的 ElementAmount 分配、比例守恒或组织衰减公式。

“完整继承 Affinity”和“growth accumulation 只落在特定组织”必须保持为两个独立判断。

## 4. Processing 后多个材料的语义关系

Processing 可以把一个来源材料转换成多个独立 Material。

当前只锁定：

- 子材料保持各自独立 identity；
- 所有子材料完整继承来源材料的 `Affinity[7]`；
- 来源器官持续生长形成的 accumulation 只跟随被识别出的 carrier；
- formed structural tissue 不自动复制这份持续累积；
- structural material 仍可拥有自己的 `ElementAmount[7]`，只是基础来源与数值尚未定义。

当前不进一步定义固定比例拆分、mass conservation、yield、quality、cooking value、Flavor conversion 或 generic processing engine。

## 5. 当前已验证示例：Aquamelon

水瓜是这套方法的第一个实际例子：

| 来源与产物 | 当前分类 |
| --- | --- |
| `GreenFruit -> GreenFruitFlesh` | Green Fruit growth accumulation carrier |
| `GreenFruit -> GreenFruitPeel` | formed structural tissue |
| `Aquamelon -> AquamelonJuice` | Mature Aquamelon growth accumulation carrier |
| `Aquamelon -> AquamelonShell` | formed structural tissue |
| `AquamelonShell -> AquamelonFlesh` | formed structural material |
| `AquamelonShell -> remaining shell` | formed structural material |

这些产物当前都完整继承各自来源材料的 Affinity。结构材料“不承载 Fruit 在树上持续增加的那份 growth accumulation”，不代表它们没有 ElementAmount。

水瓜生命周期、`FruitElementAmount[7]` 与实际 Processing 路线的 source of truth 见 [水瓜厨房：七元素养分与生长系统](../../mvp/watermelon-kitchen/growth-system.md)。
