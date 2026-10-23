# 数据、单位与数值基线

## 1. 七元素顺序与身份

所有七维数组固定顺序：`Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo`（火、水、风、雷、草、冰、岩）。

- `V`：尚未转化为Growth的元素养分量，用于元素球、`Soil[7]`和`TreeReserve[7]`；本次Growth Budget中的V只是待使用的临时额度，不是第二份持久化库存。
- `G`：由V完成一次生长转换形成的元素Growth；Tree/Bud自身取得V后按`1V→1G`累加，叶及花果按对应器官亲和与效率转换。**果实内的`E_free[7]`和`Products[]`始终以G计量，没有V库存。**
- `uh`：模型等效小时；**参赛单机版本 1 uh = 10 秒现实时间**。
- 一次结算事件可以推进分数 `Δuh`；UI 每帧绘制不等于多次成长事件。
- `1 U = 30 G` 是**反应份额**，不是 Growth 阶段阈值或真实时间。

## 2. 已确认常量

| 项目 | 值 | 备注 |
| --- | --- | --- |
| Soil 总容量 | 1000 V | 七维合计超量按比例压至容量 |
| Soil 保留率 | 0.99 / uh | 本步每分量乘 `0.99^Δuh` |
| 球元素类型 | 七种等概率；每球纯一种元素 | 仅玩家主动富集生成 |
| 元素球初始量 | **固定 50 V** | 仅元素类型随机，初始数量不随机 |
| 球半衰期 | 0.25 uh | 参赛版相当于现实 **2.5 秒** |
| 球销毁 | 当前剩余量 `< 1 V` | 收集应按当前实际残量 |
| Tree Reserve 容量 | 180 V | Sapling 起才有 Reserve |
| 每叶名义预算份额 | 30% | 最多三片叶；未使用部分回 Tree |
| 花苞/花/青果份额 | 母叶当次预算的 80% | 不是再扣一份 Tree 总预算 |
| MatureFruit 份额 | 母叶当次预算的 **40%** | 母叶纤维化后在果实仍挂树期间继续供给，采摘即停止 |
| LargeLeaf 自身 Growth 效率 | 60% | 自身取得且留用的 V 中60%形成 Growth，40%作为明确环境逸散，不是未使用额度 |
| 成熟后富集倍率 | **本果M=90G时为50%，M=150G时线性降至0** | 与成熟果取得母叶预算40%为两个不同倍率，用果实自身G物质量M判断 |
| 继承率 | 0.5 | 继承父器官的亲和偏移 |
| ExtraAffinity | 1 | Growth 组成所造成的亲和偏移系数 |
| 最大叶片 | 3 | 首芽在进入 Sapling 时立即生成 |

元素球指数衰减：`remaining = initial × 0.5^(elapsedUH / 0.25)`；普通模式不展示内部精确 V。

## 3. 七维基础参数

| 元素 | 火 | 水 | 风 | 雷 | 草 | 冰 | 岩 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| RootPreference | 0.80 | 1.00 | 0.85 | 0.75 | 1.00 | 0.70 | 0.90 |
| Tree BaseAffinity | 0.85 | 1.15 | 0.90 | 0.75 | 1.20 | 0.70 | 0.95 |
| Leaf 模板 Affinity | 0.75 | 1.10 | 1.00 | 0.85 | 1.30 | 0.90 | 0.80 |
| Flower/Fruit 模板 Affinity | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |

**RootPreference** 决定根系倾向吃什么；**Affinity** 决定相应元素的生长效率和形态塑形；二者不能混用。

## 4. 土壤 → 根系

- 七维 Soil 的总量记 `S`，唯一共享土壤效率系数：`F_soil(S) = ln(1 + S/200) / ln(6)`。
- 各通道候选量受实际 Soil 分量、RootPreference、亲和通道上限约束；通道基础上限份额为 `0.30 × 对应 Tree BaseAffinity`。
- **七维吸收候选公式**（土壤已完成本步容量裁剪及自然蒸发之后；各量均非负）：对每个元素`i`，令 `StageCap` 为所在阶段的根系V/uh上限，`C_i = min(Soil[i] × RootPreference[i], StageCap × 0.30 × TreeBaseAffinity[i] × Δuh)`。RootPreference影响能从本次土壤获得的量，单通道基础cap只使用**当前Tree BaseAffinity**而非实时EffectiveAffinity。
- **共享根系预算**：`RootLimit = StageCap × F_soil(S) × Δuh × F_root(R)`，Seed/Seedling取`F_root=1`，Sapling按下文Reserve分段函数；若`ΣC_i>RootLimit`则全部候选同乘`RootLimit/ΣC_i`，否则实际吸收等于候选。各元素从土壤扣除的恰为实际吸收量，不能将根系系数二次施加或令任一维变负。
- **结算口径**：这一候选算法已存在于已完成的 Seed/Seedling Lua 根系切片；Sapling在共享上限乘已确定的Reserve充盈因子，仍只有一次共享土壤效率。实际一步分数uh可与整uh存在数值积分误差，需验收。
- 参赛基线阶段根系总 cap：Seed `2.0`、Seedling `1.85`、Sapling `16` V/uh；为本地 Demo **设计采用值**，不等于已通过实机校准。
- 参赛版 Sapling 根系充盈系数 `F_root(R)=1 (R≤100)`；`ln(1+(180-R)/80)/ln(2) (100<R<180)`；`0 (R≥180)`，其中 `R=ΣTreeReserve`；只作用于根系吸收上限，不替代 Reserve→Growth 的 S 曲线。
- Soil 蒸发、根系吸收、Tree Reserve → Growth 是三个独立步骤，不共享“0.99 保留率”。

## 5. Sapling Reserve → Growth Budget

- Seed / Seedling：根系吸收直接进入 Tree Growth，不创建 Tree Reserve。
- Sapling：根系吸收先进入 `TreeReserve[7]`。每次生长结算基于储备充盈度确定本步可用的 `GrowthNutrientBudget[7]`；**预算每一维仍是 V 单位的未转换养分**。它先在树与子器官之间分流，随后由实际使用者形成 Growth，不能在生成预算时预先生成 Tree Growth。
- Reserve 总量 `R` 范围 0～180 V；采用归一化宽 S 曲线，`sig(x)=1/(1+e^(-x))`，`F_growth(R)=[sig((R−95)/12)−sig(−95/12)]/[sig((180−95)/12)−sig(−95/12)]`。
- 中点 `M=95 V`，宽度 `W=12 V`；随 Reserve 连续变化，`R=0` 时预算为0，`R=180` 时达到曲线最大值。
- 参赛版采用基准预算速率 **`B0=5.4 V/uh`**；这是当前设计定值，实际产率仍需复测，不能声称千星实机已验证。
- **Tree Affinity 用于决定本次七元素养分取出量**，不是树干自身 Growth 的额外倍率。Tree/Bud 将自身实际取得的 V 直接累加到对应 Growth 维度，**不再乘 Tree Affinity**。叶、花、果取得分流后的真实 V，按自身器官 Growth 亲和规则转换；这一步不可重新施加 Tree Affinity，也不能将上游 Budget 当成已生成的 Growth 再转换。
- **七维 Budget 计算**：每次先完成本步根系实际吸收与Reserve入账，再读取**当下** `R=ΣTreeReserve` 和当前Tree EffectiveAffinity，令 `B_ref=B0×F_growth(R)×Δuh`，七种元素各有相同的基准份额 `BaseV[i]=B_ref/7`。本次对每个元素直接按树的当前亲和调整取出额度：`BudgetV[i]=min(Reserve[i], BaseV[i]×max(0,TreeEffectiveAffinity[i]))`。**`/7` 仅指七种元素，不表示每次固定取7V或各维固定1V**。`B_ref` 随本次真实 `R`、`Δuh` 连续变化：以 `Δuh=1`、当前 `B0=5.4V/uh` 为例，`R=95V` 时参考预算约 `2.70V`（每元素基准约 `0.386V`），`R=120V` 时约 `4.81V`（每元素约 `0.687V`）；各维再乘当步 Tree EffectiveAffinity 并由实际库存截断。
- **预算总额随 Tree Affinity 和可用库存变化**：不按七维亲和总和重新归一化来保持`ΣBudgetV=B_ref`；`B_ref`只是本次结算的动态参考尺度，**不是固定每次7V、根系每次吸收量或保证消费的总V**。每一维实际取出不超过自身 Reserve；某维库存不足形成的缺额不自动转移给另一种元素，避免改变已经确定的逐元素基准及亲和倍率。
- **一次结算中的完整顺序**：按七种元素的基准份额与 Tree Affinity 形成待分流的 `BudgetV[7]`（仍是 V）→ 各叶取得各自 V 份额 → 叶在本叶与花果间分流 → 未实际取用的 V 返还父级本次预算 → Tree/Bud 取得剩余 V，按 `TreeGrowthGain[i]=TreeUsedV[i]` 直接结算，**不重复乘 Tree Affinity** → 其他器官按各自生长合同转换其实际用于生长的 V → 真实用于生长或环境逸散的 V 从 Reserve 统一扣一次。
- 子器官 `ExtractionAffinity=min(Affinity,1)` 如用于接受父级预算，只影响它能取得多少真实 V；最终 `GrowthGain` 使用完整自身亲和。树自身亲和绝不再次乘到子器官已取得的份额上。
- 每叶最多名义取 Tree 本步预算 30%；多叶时 Tree 名义余额分别为 0叶100%、1叶70%、2叶40%、3叶10%。
- FlowerBud、Flower、GreenFruit取得所属母叶当次V预算的80%；**MatureFruit降为40%**。其母叶虽在成熟时纤维化，果实挂树期间仍为其供给，采摘即停止。成熟果的V份额经过本果锁定亲和转为新G，再按`F_enrich(M)`减速并记入同一个`E_free[7]`；40%是**母叶预算份额**，不是固定成长速度。未用V返回父级预算，真实取用/逸散V对Tree Reserve只扣一次，果实不产生V库存。
- 无 Active Bud 时，剩余树份额逐维直接进入 `TREE_Growth`；有 Active Bud 时，逐维进入 `BUD_Growth`。两者均不再次乘 Tree Affinity。

## 6. 成熟后线性富集（参赛已定）

- 初次成熟时生殖累计达到90G，先锁定MatureFruit，再触发合法反应；此后成熟果从母叶本次V预算取得40%，经自身亲和转为新G，再按本果M对应的线性富集倍率逐渐减速。成熟前已形成的G不改写或转回V。
- 令 `M = ΣE_free + ΣProducts.amount`，成熟前合法生殖 Growth 的当前速度为基准100%。
- 成熟后`F_enrich(M) = clamp((150 − M)/60, 0, 1) × 0.5`作用于新生成的G；M为**本次新Growth输入前果实自身G物质量**，不可用Tree Reserve或母叶Growth替代。
- 示例：M=90/105/120/135/150G 时，相对成熟前生殖速度分别为50%/37.5%/25%/12.5%/0%。
- **150G是自然富集停止点，不是产物硬截断点**：风扩散依反应规则可改变 `M`，不丢弃/截断产品；若M回到150G以下，按公式重新获得富集能力。
- 成熟后仅使用上述线性富集倍率，不另设硬物质量上限。

## 7. 后续出芽与数值验收

- 第一枚Bud在进入Sapling的同一事件立即生成；同时最多一个Active Bud，已有叶与Bud占位合计不超过3。
- **Tree Growth周期出芽**：主树干本周期`TREE_Growth`累计达到100G，固化本周期亲和并重置本轮Growth；若有空叶位且无Active Bud，同一事件生成一枚Bud。不复制已用于周期塑形的G。0叶掐芽将Bud积累的G返还主干，之后仍能通过100G主干周期再出芽。
- **模型日出芽机会**：在没有Active Bud且叶位未满时，模型日04:00每24uh最多投签一次；当前0/1/2/3叶概率为80%/40%/1%/0%。与Growth周期触发去重，已由周期生成的Bud不能同事件再生成第二枚，不因Tick细分增加抽签次数。
- 固定50V元素球下的首果时间与长期产率属于后续数值验收，不将未经验证的产量写成既成事实，也不作为当前文档定稿或P0首次跑通的阻断条件。
- 跨分数uh结算的随机去重、叶片未吸尽预算的实际返还、真实生长轨迹与演示输入仍须用数值验收验证；不新增未经批准的消费上限。
