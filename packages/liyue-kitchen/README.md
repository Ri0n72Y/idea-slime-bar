# 璃月厨房 · Web U2

独立 React + TypeScript + Vite + PixiJS 8 游戏。U1 的十区域/七格继续保留。本 U2 打通唯一种子→真实跨层拖放→元素球凝聚收集→指定地格浇灌→确认结束今日→真实 K uh 生长与次晨报告。

## 运行

```sh
pnpm install --frozen-lockfile
pnpm --filter @idea-slime-bar/liyue-kitchen dev
pnpm --filter @idea-slime-bar/liyue-kitchen typecheck
pnpm --filter @idea-slime-bar/liyue-kitchen test:domain
pnpm --filter @idea-slime-bar/liyue-kitchen build
pnpm --filter @idea-slime-bar/liyue-kitchen test:e2e
```

## 领域与持久化

- `src/domain/game.ts` 是唯一可消费的 `GameState` 和命令入口，`growth.ts` 执行逐uh七维生长，`reactions.ts` 单独检查合法自然Growth触发的反应，`config.ts` 保存设计与试玩参数。
- `src/domain/save.ts` 用 IndexedDB 保存版本1的纯JSON世界状态；读取先验证，不重发种子，不存 Pixi/DOM/React 对象。旧版本无可用迁移合同则拒绝覆盖原存档。
- `src/domain/store.ts` 串行保存每笔成功命令，初始先读档再开放交互；存档有错误时停止覆盖原有记录。
- 物品栏 React DOM 发出真实指针拖放，`CrystalScene.tsx` 使用 Pixi 图元实际六边形命中区完成落点确认；元素球也是 Pixi 场景真实点击对象。
- 玩家手动点「结束今日」并确认后才推进24个uh，次晨报告包含前后七维账本与事件（内部数据），普通界面只展示阶段/颜色/元素图标。

## 数值候选与测试证据

见 [U2-BALANCE-TRACE.md](U2-BALANCE-TRACE.md)。每日共享 N=8 次为待 Lead 校准的试玩候选，每次纯元素球固定50V；K=24uh同样为候选。不可把示例随机轨迹当作平衡定稿。领域测试用 Node 22 `--experimental-strip-types`；Playwright 使用 Chromium 在1600×900桌面及1280×720模拟触屏进行真实输入并输出截图。运行是否通过以当前PR准确HEAD的CI为准。

## 阶段边界

U3采摘、U4加工、U5订单、U6开垦、U7科技、U9访客及Tauri v2仍禁用；不制造可执行的虚假生产入口。
