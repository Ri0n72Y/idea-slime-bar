# Growth Tick Architecture

本文件描述植物生长的一次结算过程。当前千星2D单机实现由**本地Lua**持有世界状态和执行计算，UI只呈现快照及提交玩家操作。具体数值见[水瓜数值基线](../mvp/aquamelon-kitchen/02-data-and-balance.md)，生命周期见[生长与收获](../mvp/aquamelon-kitchen/03-growth-and-harvest.md)。

## 结算单位和状态

1uh是模型等效小时；当前2D单机演示映射为现实10秒。Growth Tick推进实际的`Δuh`，不是按帧重复计算一次完整uh。

- 元素球、`Soil[7]`、`TreeReserve[7]`保存真实待生长养分**V**。
- 树、芽、叶、花果只有经过生长转换的元素**G**；花果唯一物质账户为`E_free[7]+Products[]`，单位均为G。
- `GrowthNutrientBudget[7]`仅是本次待分流V额度，不是第二份持久库存。
- `Affinity[7]`表示元素倾向，不是可消费物质量。

## 一次结算

```text
本次真实Δuh
   ↓
元素球衰减 / Soil蒸发及容量约束
   ↓
根系从Soil实际吸收V → 加入Sapling TreeReserve
   ↓
按入账后R与Δuh计算动态参考预算B_ref
   ↓
七维各按 B_ref/7 × TreeEffectiveAffinity[i]
并以真实Reserve[i]截断，得到BudgetV[7]
   ↓
各叶取得当次预算份额 → 母叶内再向花果分流
未实际取用V退回本次父级预算
   ↓
Tree/Bud按1V→1G形成Growth
叶及生殖器官按各自亲和与效率将取用V转为G
   ↓
明确逸散及实际消耗的V统一从Reserve结账一次
   ↓
按Growth门槛触发阶段变化、亲和固化与出芽
   ↓
用唯一世界状态更新UI
```

`B_ref=B0×F_growth(R)×Δuh`，`BudgetV[i]=min(Reserve[i],B_ref/7×max(0,TreeEffectiveAffinity[i]))`。这里7是元素个数，**不是固定7V/次**；不按总预算重新归一化，不跨元素转移不足的V。

## 主干、叶片和果实

- 进入Sapling的同一事件生成首枚Bud；Tree每完成100G塑形周期，若还有叶位且无活跃Bud，同一事件生成一枚。模型日04:00另有一次按当前叶数的出芽机会，不能重复创建；芽被掐掉时，其G返还Tree并照常检查100G边界。
- 最多三片成叶；各叶获取本次Tree预算30%，花苞/花/青果取母叶预算80%。成熟水瓜从已纤维化母叶获得40%，**成熟后新G**按其当前物质量`M=ΣE_free+ΣProducts.amount`逐渐降低富集倍率，M达到150G后自然富集停止。
- 熟果被采摘后停止母叶供给，其全部自由G与反应产物成为独立材料的唯一物质账户。加工仅按[一果一汁合同](../mvp/aquamelon-kitchen/07-juice-and-ai-prompt.md)转换。

完整结算顺序、分数uh与事件边界以[Growth Tick](plants/growth-tick.md)为准。实现时不要另外持有一份UI状态、临时物质库存，或为未来多人开发新增服务端节点图。
