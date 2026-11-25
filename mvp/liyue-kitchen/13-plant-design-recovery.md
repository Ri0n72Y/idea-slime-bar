# 植物长期培育｜原始设计恢复与版本差异

> **最新规则：** [19｜器官成长与经营合同](19-organ-growth-and-economy-contract.md)。与19冲突的候选和历史算例已替代；不再作为当前产率或经济校准依据。

> 本文是来源梳理和迁移依据，不新增生长公式或批准数值。当前采用[09](09-daily-growth-balance.md)及[12](12-element-ecosystem.md)已批准的1d/24uh及生态规则；历史参数只在明确恢复后进入当前合同。

## 1. 大树（Mature Tree，不是MatureFruit或Mature Leaf）

- [最初水瓜世界观](https://github.com/Ri0n72Y/idea-slime-bar/blob/3a2d187224f531c3b87ebc602fe3bac3e82093fa/docs/plants/aquamelon.md)：半人高成熟株四片巨大肥厚叶、四果；早版无可见花，后由真实花期模型替换。四叶是历史形态基线，不等于七元素版Mature已批准叶位。
- [最早七元素成长](https://github.com/Ri0n72Y/idea-slime-bar/blob/b62d15afae408ec7cc59d02cd235eb9461cd641b/mvp/watermelon-kitchen/growth-system.md) §5：Seedling→Sapling→Mature。各Stage具有独立Base/Effective Affinity、Growth、吸收上限和成长阈值；阶段只向前。早期小树2叶、每叶0.3；正常约2–3周长成Mature，主动掰叶减少分流约1周的快速路线。原体验目标普通玩家每周约2片可收获叶、勤劳玩家约4片（旧时间尺度，不是当前果实产率）。Mature更高吸收、更多叶位，后续Growth用于持续生成器官，消耗Growth不退阶段；具体大树叶位、单叶分流、升级门槛尚待平衡。
- [早期数值基线](https://github.com/Ri0n72Y/idea-slime-bar/blob/8f356c035220eae962586d14d03ebce59b158d95/mvp/watermelon-kitchen/growth-system.md)：一度各树Stage共用1V/h总上限，明确Sapling→Mature阈值、成熟时间、Reserve及周产量待后续数值。
- [小树芽叶循环改版](https://github.com/Ri0n72Y/idea-slime-bar/blob/bbc5c913504733e085ccdb2b7e824ff7e99bab5d/mvp/watermelon-kitchen/growth-system.md)：Mature延期、小树成为长期玩法阶段，最多3叶，主干每100G周期塑形而不升级，Bud20G，掐芽返还主干。
- 当前用户确认恢复长期培养及Mature扩展。小树改为双叶、每叶40%名义预算；历史2–3周/约1周加速是体验参考，不能直接套旧现实时间。大树升级与100G周期如何兼容需要迁移确认。未找到已定稿的大树升级阈值、根吸收、Reserve、预算、叶位/分配的完整数值。

## 2. 叶片、生殖与采果

| 来源/版本 | 已有规则 |
| --- | --- |
| [最早成长](https://github.com/Ri0n72Y/idea-slime-bar/blob/b62d15afae408ec7cc59d02cd235eb9461cd641b/mvp/watermelon-kitchen/growth-system.md) §7 | Tender→Thick→Mature；叶无独立Reserve，未定型时连续学习；Tender无损耗、Thick持续Growth、Mature自身60%留存/40%释放，继续供给花果且自身Growth较慢。Stage转换固化亲和并重开阶段Growth；按固化BaseAffinity达到表现阈值决定变种形态，多主元素视觉优先级未定。 |
| [早期器官链](https://github.com/Ri0n72Y/idea-slime-bar/blob/4e5ae45d73f343d4c1375d7f580cb27c52902e4b/mvp/watermelon-kitchen/growth-system.md) §7–9 | 叶出生时继承Tree当前偏移，之后独立；叶内分流只影响本母叶；果实成熟时母叶同步纤维化；旧成熟果分流约20%，明确母叶恢复大部分自身成长；移除花果后母叶恢复完整预算，复花方向预留。 |
| [当前参赛生命周期](https://github.com/Ri0n72Y/idea-slime-bar/blob/main/mvp/aquamelon-kitchen/03-growth-and-harvest.md) / [数值](https://github.com/Ri0n72Y/idea-slime-bar/blob/main/mvp/aquamelon-kitchen/02-data-and-balance.md) | Bud20G、SmallLeaf26G同步LargeLeaf和花苞；生殖累计12/40/90G；未成熟花果80%母叶预算、成熟果40%且富集按90–150G线性减速；LargeLeaf自身60/40；采果后复花必须来自新增Growth，具体阈值未确认。 |
| [现行growth.ts](https://github.com/Ri0n72Y/idea-slime-bar/blob/main/packages/liyue-kitchen/src/domain/growth.ts) | FibrousLeaf的leafV为0，采果后该叶不再生长；无复花分支，无Mature Tree阶段。属于现有实现与恢复目标的差异。 |

迁移原则：保留后期已定的20/26/12/40/90G及80%/40%（不恢复早期elapsed-time、30/100G、50%/80–90%/20%）。恢复成熟母叶自身生长和采果后完整叶预算。需明确FibrousLeaf是否沿用成叶60/40（历史Mature Leaf有该规则、当前参赛仅显式LargeLeaf）、成熟果未实际取用的额度如何在母叶和Tree间返还、复花触发所需新增Growth及其与叶自身性状账户关系。不得清除母叶已形成的V和培养成果；新一轮生殖独立开户。未找到已确认的复花具体阈值；[验收缺项](https://github.com/Ri0n72Y/idea-slime-bar/blob/main/mvp/aquamelon-kitchen/10-acceptance-and-gaps.md)明确记为未定。

## 3. 元素、形态与亲和

- [通用养分—生长](https://github.com/Ri0n72Y/idea-slime-bar/blob/main/docs/plants/nutrient-growth-system.md)：Growth七维而非单标量；Effective=Base+ExtraAffinity×GrowthShare（ExtraAffinity=1），未定型连续学习，阶段固化；新器官用自身模板加父器官当前Effective−Base的偏移×继承率0.5，不复制父器官完整亲和、不实时同步。RootPreference与亲和分工、预算/真实V消耗/最终G转换保持原合同。遗传方向：繁殖材料锁定亲和传给下一代；扰动与稳定机制未定。
- [早期元素培养](https://github.com/Ri0n72Y/idea-slime-bar/blob/4e5ae45d73f343d4c1375d7f580cb27c52902e4b/mvp/watermelon-kitchen/elemental-cultivation.md)及最初成长§7.5：叶/花成长可由Growth和Effective Affinity动态显色；阶段固定时由Affinity达到VariantThreshold产生变种形态；普通外观仍有隐藏亲和，多元素越阈值的优先级未定。
- [参赛视觉](https://github.com/Ri0n72Y/idea-slime-bar/blob/main/mvp/aquamelon-kitchen/08-ui-and-visuals.md)：七维归一混色，70% BaseAffinity底色+30%当前Growth色，正量即参与、无染色阈值；果实首个真实反应产物锁定名称/图标，余自由元素叠色30%，风扩散无产物不锁形。该混色是染色表现，不能等同于已定的叶片变种形态判定。
- [反应合同](https://github.com/Ri0n72Y/idea-slime-bar/blob/main/mvp/aquamelon-kitchen/04-elemental-reactions.md)已详细定义果实反应：90G首次成熟事件，主动新增元素严格>30G，普通反应/持续反应/风扩散及有限优先级。当前用户明确叶片也具元素反应形态；未找到叶片自身反应资格、首次反应事件与外形锁定的独立完整参数。不得直接将果实90G门槛或整套触发规则冒充原叶片合同。
- 长期亲和问题来自MVP反复100G固化：每轮非零Growth使Base总和增加1。固化原本用于有限阶段，不代表无限重复仍需相同学习强度。恢复Mature后需核对阶段塑形与持续出器官的边界；不提前限制亲和或增加新公式。当前继承只传当前阶段偏移，不能未经确认改成累积全历史偏移。

## 4. 当前迁移次序

> 成叶恢复及复花数值候选见[14｜成叶持续成长与复花](14-leaf-regrowth-and-reflowering.md)，待审定。
> 大树阶段及主干成长迁移候选见[15｜大树阶段与主干成长](15-mature-tree-and-trunk-growth.md)。

1. 先恢复母叶持续成长和采果后完整预算，确定旧成叶60/40、富集未用预算与同叶复花的最小数值合同。
2. 再恢复大树阶段与原修剪/主干催长取舍，核对双叶小树和大树储备/吸收/分配。保留首周成长阈值与1d模式。
3. 叶片染色使用已有数据规则；元素变种及反应形态仅补实际缺失的器官资格和阈值，与美术表现分开。
4. 按长期培育的情景A复算正常果实产量、V外流与供给；不再使用旧三果清株轨迹作长期依据，不引入低光教程/额外补偿，不批量随机模拟。

本轮查阅现行完整通用文档、最早水瓜世界观、七元素成长历史及明确延期提交、现行MVP合同/代码；未能穷尽所有历史会话或证明未找到的参数从未讨论过。若有更早明确数值，应优先恢复并以来源修订本记录。
