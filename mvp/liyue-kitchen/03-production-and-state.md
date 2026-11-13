# 生产链、领域状态与存档

## 生产与材料守恒

```text
每日随机元素球（纯一种元素，初始 50V）
  → 收集 → 指定开放地格 Soil[7]
  → 独立 TreeReserve / Growth / organ / reaction
  → 每晚统一 K uh 结算，七格各自独立
  → MatureAquamelon
       ├→ 完整水瓜订单
       └→ 剥壳 → PeeledFlesh + Shell
                     → 榨汁 → RawJuice + 空杯 → 装杯 → AquamelonJuiceCup
```

- 初期只实现剥壳、榨汁、装杯三种白天即时动作；一果一份汁。煮锅、研钵和复杂料理不属于 MVP。
- 从完整果实经果肉、原汁、杯装果汁转移 `E_free[7]` 与 `Products[]`；任一时刻只有一个有效的可食载体持有这些物质。原物件在加工时消耗，果壳单独记录 ID 且暂不承载元素 G。
- 每件种子、果实、材料、杯、成品有稳定 `itemId`；位置仅在物品栏、地面、仓储、工作台与订单等容器之间转移，不能复制。
- 订单交付必须检查具体物品种类与数量，水瓜订单不接受果肉，果汁订单只接受已装杯果汁。
- 领域计算沿用现有 V/G、Growth、反应、感官规则；加工不额外引入元素反应。

## 单一状态源（类型示意）

```ts
interface GameState {
  day: number;
  phase: "DAY_START" | "DAY_WORK" | "DAY_CONFIRM" | "NIGHT_RESOLVE";
  dayAdvanceUH: number;       // K，初始值需校准
  dayCondenseUsed: number;
  dayCondenseLimit: number;    // N，初始值需校准
  plots: Record<string, PlotState>;  // 固定七格，每格独立 Soil/Plant
  items: Record<string, ItemState>;
  looseBalls: Record<string, ElementBallState>;
  machines: Record<string, MachineState>;
  orders: Record<string, OrderState>;
  adeptalEnergy: {
    balance: number;
    earnedTotal: number;
    spentTotal: number;
    rewardedIds: string[];
  };
  discoveries: Record<string, DiscoveryState>;
  tech: Record<string, TechState>;
  visitors: Record<string, VisitorState>;  // U9
  eventLog: GameEvent[];
}
```

上面是领域边界示意，实际类型按模块定义，避免一个文件承担所有职责。游戏领域层独立于 React 和 PixiJS。

命令应当是确定性的：`newGame`、`plant(seedId, plotId)`、`collectBall`、`waterPlot`、`endDay`、`harvest`、`processItem`、`deliverOrder`、`unlockPlot`。每个命令校验前置条件并原子更新状态，生成可供渲染、探索和调试复核的事件；失败不能产生半成品或重复奖励。

## 昼夜结算

1. 校验 `endDay` 命令，确定当天投入、未收集元素球及状态快照。
2. 同一世界时钟推进 `K uh`，按已有规则逐步结算七个地块的 Soil、Reserve、Growth 与反应，不通过总产量乘 K 近似。
3. 结算设备（若后续引入跨夜设备）、限时订单截止日与探索事件。
4. 生成次晨简报并以一次事务提交新状态，避免重复成长、重复领奖及物品复制。

白天 `Δuh = 0`。渲染帧率、React 重绘和拖拽频率不能推进领域时间。随机过程使用可重放的随机种子，便于数值复现。

## Web 与存档

- React 管理主菜单、HUD、详情及面板。PixiJS 渲染游戏场景，使用统一的指针/触摸事件并把 `itemId/plotId` 发送至领域命令。
- 领域状态通过订阅驱动视图，不把 PixiJS 对象、DOM 节点或 React 状态写进存档。
- 持久化优先 IndexedDB：记录版本号、世界状态、事件/随机状态及内容版本；读取时验证、迁移旧版本。新游戏和读档须分开，读档不得再次生成开局种子。
- Playwright 验证可见操作、重进、存档恢复、非法操作与屏幕截图；领域关键规则另用针对性确定性测试，不重建假的 UI 控件体系。
- Tauri v2 后续复用 Web 客户端与游戏领域状态；平台存储封装在适配层，不提前引入 Rust 领域逻辑。

## 待校准参数

`K`、每日 `N`、首果耗时、首单期限、奖励和地格解锁成本、空杯初始供给。由首轮真实数值仿真和可玩性测试确定，不在 UI 实施时任意写死。
