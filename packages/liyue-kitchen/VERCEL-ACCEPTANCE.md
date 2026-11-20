# Vercel 部署核验与浏览器验收

## 授权与职责

项目通过已连接的 **Vercel 插件**读取部署信息；GitHub 与 Vercel 的现有集成负责构建及部署 Preview/Production。**不使用 `VERCEL_TOKEN` GitHub Actions Secret，也不把插件授权复制到 CI。**

- **Coder**：在 PR 中提交可复现的领域测试、类型检查、构建与 Playwright 技术证据。
- **Independent Reviewer**：核对源码、实际 PR HEAD、领域合同及技术 CI，不替代 UI/玩家体验验收。
- **Experience QA**：待 D/E/F 和正式美术集成达到统一验收节点、Lead 明确派发后，执行实际 Vercel 浏览器交互及视觉验收；物理手机另行记录。

## 通过 Vercel 插件核对部署身份

1. 从 GitHub 确定目标 PR 的 **HEAD SHA、分支**，以及对应的 Preview 或 Production 环境；不能凭旧 Preview URL 推断部署版本。
2. 通过已连接的 Vercel 插件，按项目 `idea-slime-bar`（Project ID：`prj_VzGBScFrTWp4UZA8IKqzX8Yjot8L`）、分支及提交查找部署；必要时读取部署详情。
3. 对照 **部署 ID、项目、Git Commit SHA、Git Branch、环境、URL、READY 状态**。PR 核验应选择 Preview，生产核验应选择 Production；提交不符、未就绪或认证不可用均明确记录为未核验，不算通过。
4. 在 PR 或 QA 证据中记录准确 HEAD、部署 ID、URL、状态和核对结果。插件读到 `READY` 只证明部署状态与身份，不构成浏览器交互通过。

## Playwright 与实际交互

保留原有 Playwright 用例及配置。开发时可在本地 Vite 上运行：

```sh
pnpm --filter @idea-slime-bar/liyue-kitchen test:e2e
```

当实际浏览器环境有权访问经插件核实的部署时，可对该部署运行用例：

```sh
PLAYWRIGHT_BASE_URL=https://<verified-deployment>.vercel.app/ pnpm --filter @idea-slime-bar/liyue-kitchen test:e2e
```

远端 URL 必须来自本轮身份核对；受保护 Preview 的登录页不能算作游戏验收结果。不能把本地 Vite 测试或单纯 `READY` 记作线上交互 PASS。完整 QA 需核对实际鼠标/触摸操作、领域状态、成功/拒绝反馈与屏幕证据，包括桌面 1600×900 及模拟触摸 1280×720，另行记录未验证项。

## 保留的 GitHub 技术 CI

- `.github/workflows/liyue-u1-ci.yml`：类型检查、领域测试、现有数值重放、构建。
- `.github/workflows/web-ci.yml`：Web 类型检查和构建。

上述工作流不依赖 Vercel 插件权限。Vercel 插件读取部署与定期统一体验 QA 分开实施；仓库不再运行原来的 GitHub Vercel 自动验收工作流。
