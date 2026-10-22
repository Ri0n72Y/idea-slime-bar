# 植物材料设计原则：采摘继承与加工待定

本文件仅规定已确认的材料身份、Affinity 与果实物质账户之间的边界，不建立通用物品或加工框架。水瓜的权威生长与采摘合同见 [七元素养分与生长系统](../../mvp/aquamelon-kitchen/03-growth-and-harvest.md)，成熟后反应记账见 [果实元素反应结算](../../mvp/aquamelon-kitchen/04-elemental-reactions.md)。

## 1. 材料身份不同于物质量

青果、成熟水瓜及其未来加工产物可以具有各自独立的 biological / material identity。结构组织与生长累积组织在形态上可以区分，但**不能仅凭这种分类先行决定** `E_free[7]` 和 `Products[]` 在加工产物间的比例或归属。

`Affinity[7]` 表示材料的元素倾向，是**非守恒的性质**。既有 Processing 设计中子材料可完整继承来源 Affinity；这不意味着能够重复复制其元素物质量。

## 2. 青果和成熟果的采摘已确认

花苞出生以后积累的全部 Growth 属于最终可食果实的同一物质账户。成熟之前以 `E_free[7]` 表示；成熟后普通反应把自由元素转化成 `Products[]`，二者共同构成果实账户：

`M = ΣE_free[7] + ΣProducts.amount`

青果或成熟水瓜从活体摘下，成为独立地面世界材料时，**完整继承这一账户**以及已确认的材料身份和 Affinity。采摘不丢失花期元素、不复制第二份库存、不产生最终 Flavor，也不会因反应后物质量变化回退成熟阶段。

## 3. 加工路线的身份已确定，物质分配尚未确定

目前存在以下明确的材料身份转换：

- `GreenFruit → GreenFruitPeel + GreenFruitFlesh`
- `Aquamelon → AquamelonShell ×2 + AquamelonJuice`
- `AquamelonShell → AquamelonFlesh + remaining shell material`

这仅确认**有哪些材料**，不是其元素数量分配规则。不能预设青果肉或水瓜汁独占整份 `E_free + Products`，也不能把它完整复制给每个子材料；结构材料是否携带以及携带多少自由元素或反应产物，都属于下一轮加工设计。当前既不设固定比例，也不新建泛化的 Processing 引擎。

`Flavor` 仅在最终品尝时由实际材料组成派生，不以采摘或加工时的元素占比预先固定最终味道。
