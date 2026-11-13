# 璃月厨房：还得自己种

当前开发项目为单机 2D Web 游戏《璃月厨房：还得自己种》。

- 前端：React + TypeScript + Vite
- 2D 画面及交互：PixiJS 8
- 游戏规则：独立 TypeScript 领域状态和命令
- 测试：实际浏览器、Playwright 与可复现的领域验证
- 后续分发：Tauri v2；先完成 Web 可玩版本

**当前 Web MVP 尚未实现。** 实施任务从 [U1 主场景与七格交互](https://github.com/Ri0n72Y/idea-slime-bar/issues/37) 开始，之后按 U1～U9 推进。不要将仓库现有的其他原型代码直接当成本项目实现。

## 开发入口

- [MVP 设计与规则](mvp/liyue-kitchen/README.md)
- [U1～U9 开发验收](mvp/liyue-kitchen/05-ui-driven-implementation.md)
- [团队及角色入口](https://github.com/Ri0n72Y/idea-slime-bar/issues/7)

新游戏代码约定放在 `packages/liyue-kitchen/`。当前仓库已有 `packages/web`、`packages/plugins`、`packages/genshin` 等其他实验和领域代码，它们不属于此 MVP 的现行界面实现；只有经明确选择的数值规则可用作参考。

项目采用 pnpm workspace。构建/启动命令以新 Web 应用真正建立后的 `package.json` 为准，不预设当前仓库已有可运行的璃月厨房入口。
