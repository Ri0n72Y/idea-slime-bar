# 璃月厨房 · 数值配置

**唯一可编辑的游戏数值数据**：`src/domain/balance.config.json`。修改 JSON 后重新构建、部署即可生效，无需同步手工修改 Growth、Game、Reaction、Economy、Order、Technology、Visitor 或 Save 的源码。当前默认值逐项保留 PR #70 已实现版本，本文件不包含策划 PR #66 的新玩法候选。

## 参数区

| 区域 | 作用 |
| --- | --- |
| `world` | 凝聚次数、每球 V、半衰期、收集最低 V、夜间 UH、土壤/Reserve 容量和损耗 |
| `affinity` | 七元素的 Root/Tree/Leaf/Fruit 初始偏好 |
| `growth` | 根系限额与预算、Reserve S 曲线、树/叶/花果转段门槛、继承、分配、成熟果富集、叶片效率、出芽时间与概率 |
| `reactions` | 反应触发/消费阈值、感电/燃烧持续系数、风扩散及各元素组合实际消耗 |
| `orders` | 首单/续单截止天数、一次交货的件数 |
| `economy` | Growth/采摘/交单仙力奖励、六块可购买地格的价格 |
| `technology` | 收集袋费用、人工收集/多元素浇灌发现门槛 |
| `visitors` | 访客到来最早日期和三项仙力奖励 |

`balance.ts` 在模块加载时校验范围、向量长度、概率、Growth 门槛顺序、叶片预算和反应的最低消费保障；非法配置明确抛错。游戏运行时使用经验证、深度冻结的配置对象，不能通过 UI 调参。格式内的七元素身份、状态名称、存档 schema 版本、浮点误差 EPS、唯一 ID 等属于规则/数据结构，保留在代码。

## 运行与回归

```sh
pnpm --filter @idea-slime-bar/liyue-kitchen typecheck
pnpm --filter @idea-slime-bar/liyue-kitchen test:domain
pnpm --filter @idea-slime-bar/liyue-kitchen test:balance-config
pnpm --filter @idea-slime-bar/liyue-kitchen build
pnpm --filter @idea-slime-bar/liyue-kitchen test:e2e
pnpm --filter @idea-slime-bar/liyue-kitchen test:balance-browser
```

`test:balance-config` 在系统临时目录复制领域模块，仅替换该副本的 JSON，核对替代参数实际进入世界创建、出球/收集/浇灌、成长、反应、委托、仙力账本、旧档导入以及非法配置校验，退出时清理副本。常规 GitHub 领域 CI 自动执行它。

`test:balance-browser` 先备份本地 JSON，在进程内暂时切换到替代参数，重新 TypeScript 检查和构建，再运行隔离的 Chromium 浏览器测试，最终无论成功或失败都恢复原文件。请在干净的独立工作树运行，**不要与正在运行的 Vite/Playwright 或其他编辑进程并行**；此脚本不写 Git，也不改正式默认值。

## 存档与调参边界

- 存档中的实际元素球 `initialV`、已浇灌 Soil、Reserve、订单 `dueDay/quantity/rewards` 和已完成购买费用保留历史实值，避免修改当前 JSON 后凭新价格重新计算旧交易或凭新球值复制元素。
- `adeptalEnergy.spendLedger` 记录真实地格/科技购买费用并与 `spentTotal` 守恒核对；较早存档以 `legacy` 收据承接旧花费，不凭今天的价格伪造历史支出。导入仍核对唯一物品、来源、金额平衡及有限向量。
- 新订单按新配置发布；已有未完成订单遵照其存档上的截止日和奖励。游戏日开始时凝聚额度更新为现行配置，当前日仍保留存档进度。
- 保存土壤与球原值不强行限制为**现行**的土壤容量/球初值，防止合法旧配置存档在调低参数后误拒。运行时再次浇灌仍使用现行容量限制；导入仅做独立的有限数值安全上限检查。
- 本次只覆盖**已实现玩法**；NPC 采购、菜谱、药剂和新生态机制仍由 #73 / PR #66 的后续实现决定，不能把配置字段视为其已上线的证据。
