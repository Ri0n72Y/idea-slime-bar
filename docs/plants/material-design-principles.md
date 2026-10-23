# 植物材料设计原则：采摘继承与加工边界

本文件区分材料身份、Affinity性质和真实物质量。水瓜的生长与采摘规则见[水瓜生命周期](../../mvp/aquamelon-kitchen/03-growth-and-harvest.md)，反应记账见[元素反应](../../mvp/aquamelon-kitchen/04-elemental-reactions.md)。

## 1. 材料身份与物质量

青果、成熟水瓜及加工产物有各自独立的材料身份。结构组织和生长累积组织可在形态上区分，但身份不能替代物质量分账。

`Affinity[7]`是非守恒的材料性质；子材料继承Affinity不意味着可以复制来源的元素物质量。

## 2. 果实账户与采摘

花苞出生以后形成的全部元素Growth（G）属于唯一生殖物质账户；尚未转化为G的V仅存在于元素球、Soil、Tree Reserve及当次临时预算。**青果、成熟果都不拥有额外的V储备。**

成熟前果实持有七元素自由G `E_free[7]`；成熟后的反应产物`Products[]`同样以G记账：

`M = ΣE_free[7] + ΣProducts.amount`

青果或成熟水瓜摘下成为独立世界材料时，完整转移这一个物质账户与必要的Affinity、身份事实。采摘不丢失已积累的G、不复制库存，也不重新计算Flavor。

## 3. 加工身份与分账

**当前2D Lua P0：** `Aquamelon → AquamelonJuice ×1`。唯一果汁承接果实全部`E_free[7]+Products[]`，原熟果消耗；没有需要分账的额外副产物。

后续深入加工曾确定以下可用材料身份路径：

- `GreenFruit → GreenFruitPeel + GreenFruitFlesh`
- `Aquamelon → AquamelonShell ×2 + AquamelonJuice`
- `AquamelonShell → AquamelonFlesh + remaining shell material`

这些路线不属于当前P0，其**材料身份不等于物质分配公式**。若要启用多产物加工，须先确认各子材料分别得到多少真实G，不能把整份`E_free+Products`复制给每个产物。不会因增加加工流程自动引入通用物品框架。

`Flavor`只在最终品尝时，由实际材料组成派生，不在采摘或加工时另存一套风味数值。
