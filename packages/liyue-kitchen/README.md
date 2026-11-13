# 璃月厨房 · Web U1

独立 React + TypeScript + Vite + PixiJS 8 客户端。此阶段仅实现十个清晰分区、中央七格水晶球和地格选择。U2+ 所有玩法入口均不可操作。

## 本地运行

```sh
pnpm install
pnpm --filter @idea-slime-bar/liyue-kitchen dev
pnpm --filter @idea-slime-bar/liyue-kitchen typecheck
pnpm --filter @idea-slime-bar/liyue-kitchen test:domain
pnpm --filter @idea-slime-bar/liyue-kitchen exec playwright install chromium
pnpm --filter @idea-slime-bar/liyue-kitchen test:e2e
```

验收尺寸：桌面 1600×900、触摸横屏 1280×720。PixiJS 按实际画布大小重排地格并处理指针输入。React 展示状态，唯一领域状态由 `domain/store.ts` 维护；任何帧绘制都不推进游戏日，不生成物品或订单。

Playwright 会点击真实 Canvas 并生成截图到 test-results；截图与通过情况需由实际 CI/浏览器运行确认。独立审查前不得将测试规格等同于已通过证据。
