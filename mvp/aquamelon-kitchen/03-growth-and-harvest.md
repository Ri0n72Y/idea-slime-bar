# 植物生命周期、亲和与收获

## 1. Growth 达标事件

| 事件 | 阈值 | 当前账户的处理 |
| --- | ---: | --- |
| Seed → Seedling | Tree 累计 45G | 不清零，继续累计同一Growth与亲和状态 |
| Seedling → Sapling | **同一 Tree 累计 90G** | 七维逐项 1G→1V 初始 Reserve；重开 Sapling Tree Growth；同时创建首 Bud |
| Sapling 主干塑形/出芽 | Tree 本周期 100G | 固化亲和并重置本轮Growth；有叶位且无Active Bud时**同一事件出芽一枚**，不升级Mature Tree |
| Active Bud → SmallLeaf | Bud 20G | 生成独立叶；芽销毁 |
| SmallLeaf → LargeLeaf + FlowerBud | 本叶 26G | **同步**成肥厚叶与所属花苞；只重置本叶 Growth |
| FlowerBud → Flower | 生殖累计 **12G** | 花果自由元素账户不清零，亲和第一次固化 |
| Flower → GreenFruit | 生殖累计 **40G** | 不清零，亲和第二次固化并锁果实亲和 |
| GreenFruit → MatureFruit | 生殖累计 **90G** | 锁定成熟，母叶同步纤维化，随后才结算首次合法元素反应 |

不同器官各有自己的成长账户；**Tree、Leaf、Bud 与生殖账户不能彼此相加或混成整树总 G**。数值达到阈值才发生状态变化，没有硬性小时倒计时。

## 2. Tree 与 Leaf 的遗传

- 基础亲和 `BaseAffinity[7]` 是本阶段基线；有效亲和 `EffectiveAffinity[7]` 由本阶段 Growth 元素份额产生偏移。
- 当阶段 Growth 总量非零时，`EffectiveAffinity[i] = BaseAffinity[i] + ExtraAffinity × Growth[i] / ΣGrowth`；总量为零则等于 BaseAffinity；当前 `ExtraAffinity=1`。
- Sapling主干每完成一轮100G塑形，固化自身亲和基线并重置本周期Growth；若仍有空叶位且无Active Bud，则同时生成一枚Bud，Tree阶段不变。
- SmallLeaf 出生时一次性继承当前 Tree 的亲和偏移：`LeafBase[i] = LeafTemplate[i] + 0.5 × (TreeEffective[i] − TreeBase[i])`。
- SmallLeaf 出生后独立学习亲和；Tree 后续变化不自动回写它的 Affinity。
- Bud 不长期维护单独 Affinity；它用 `BUD_Growth[7]` 累积芽期倾向。
- 玩家掐芽时，芽内每一维Growth全部回流Tree Growth，不额外损耗；返还使Tree达到100G时正常触发塑形与空叶位出芽，G不复制。Bud不额外叠加亲和，Tree Affinity已用于上游V预算。
- 叶自己的 Growth 到26G时可重开自身阶段账户；这**不意味着**所属生殖成长账户清零。

## 3. Flower / Fruit 的唯一物质账户

- FlowerBud 出生时创建唯一七维自由元素库存 `E_free[7]`，从0开始。
- 花苞、花、青果、成熟水瓜连续使用这一账户；12G、40G、90G是阶段边界而非分开的三笔 Growth。
- 直到初次成熟前：`M = ΣE_free`；反应之后：`M = ΣE_free + ΣProducts.amount`。
- **花苞出生亲和**：在SmallLeaf达到26G时，先以该叶**升级前**的`LeafEffectiveAffinity−LeafBaseAffinity`计算`FlowerBudBaseAffinity[i] = FlowerTemplateAffinity[i] + 0.5×(LeafEffectiveAffinity[i]−LeafBaseAffinity[i])`，再固化叶亲和、重置**叶自身** Growth 并形成LargeLeaf。FlowerBud从0开启生殖`E_free[7]`。
- **12G／40G 固化**：花苞从0到12G累计的七元素组成只用于开花时第一次亲和塑形；开花后新增的12→40G组成用于结果时第二次亲和塑形，形成GreenFruit后锁定。每段按`EffectiveAffinity[i] = BaseAffinity[i] + ExtraAffinity × 该段新增Growth[i]/Σ该段新增Growth`计算（该段总量为0则保留Base）；固化时将Effective作为下一段Base。**12G与40G不是重置或消费生殖库存的事件**，应使用只读阶段起点快照/累计增量计算新增Growth，不持有第二份可消费七维库存。
- GreenFruit 形成时锁定结果亲和；后来改变的是自由元素量和反应产物，不再次修改果实亲和。
- 成熟先锁定形态与阶段，反应可以改变元素自由量或 M，但不能让 MatureFruit 倒退成 GreenFruit。
- 成熟果仍挂树时，由已纤维化母叶提供本次V预算的40%；这份V经果实自身锁定亲和转换成新G后，再按[本果M的线性富集倍率](02-data-and-balance.md)逐渐减速（M=90G倍率50%，150G为0）。40%是母叶预算份额而非富集倍率；采摘后供给终止，反应变化不能令成熟阶段倒退。
- 花苞出生后的全部生殖Growth都在同一份可食物质账户中；果实自由元素`E_free[7]`和`Products[]`的数量均是G，**不保存V或另一份重复的可消耗Growth库存**。
- `Flavor` 只在最终品尝时从实际材料派生，不在每次生长、采摘和反应时持久化另一套风味值。

## 4. 芽、叶、果的数量与营养竞争

- 同时已形成叶片最多三片，已有叶片优先得到各自的名义 30% Tree 预算；这里的预算是[按实时Reserve和Tree Affinity逐元素生成的动态V](02-data-and-balance.md)，而非固定每uh消耗量。
- 每片叶的生殖器官仅从**所属母叶当次V预算**分流；花苞/花/青果取80%，成熟水瓜降至40%并随自身M增加进一步减速。母叶在果实成熟时纤维化，但仍挂树的果实继续得到这部分供给。
- 同一次生长结算先按 Tree Affinity 生成七维可分流 V 预算，再分配给各叶与 Tree/Bud；某叶及附属器官**未实际取用的** V 返还父级当次预算。LargeLeaf 自身份额的60%用于生长、40%属于环境逸散。**Tree/Bud 自身份额不再乘 Tree Affinity**；叶及生殖器官的生长转换由自身亲和决定，不重新套用树的预算倍率。Reserve 只对本次实际用于生长或环境逸散的 V 扣一次。
- 第一枚Bud在进入Sapling的同一事件产生；主干每累计满一轮100G，若有空叶位且无Bud则在塑形事件生成一枚Bud。已有Bud时Tree份额先进入Bud，不再重复出芽。
- 模型日04:00另保留每24uh至多一次的出芽投签，当前0/1/2/3叶概率80%/40%/1%/0%；只在有叶位且没有Active Bud时有效，周期出芽与投签不能重复创建。
- 采果后如叶仍存在可以复花，但必须来自**采果后的新增 Growth**；新阈值尚未批准，不得用固定等待时长或采果前 Growth 替代。

## 5. 采摘与材料身份

| 活体对象 | 采摘成的独立材料 |
| --- | --- |
| SmallLeaf | `TenderLeaf` |
| LargeLeaf | `ThickLeaf` |
| 成熟果同步纤维化的母叶 | `AquamelonLeaf` |
| GreenFruit | `GreenFruit` |
| MatureFruit | `Aquamelon` |

- GreenFruit 青绿、柔软、内部未稳定分层；成熟果有木质硬壳、内膜、果肉膜和清澈水瓜水的形态线索。
- 采摘是活体→**独立地面材料**，采后停止根系与叶片分流、Growth 和挂果富集；不会自动放入背包。
- 青果和熟果采摘时完整转移 `E_free[7]`、`Products[]` 与必要材料身份和 Affinity；转移不能产生一份额外库存。
- 参赛快捷加工合同见 [07-juice-and-ai-prompt.md](07-juice-and-ai-prompt.md)：熟果唯一转换为一份水瓜汁；其他材料路线不在本次 P0 流程中。
