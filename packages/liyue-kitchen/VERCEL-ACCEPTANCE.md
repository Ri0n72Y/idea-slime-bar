# Vercel 交互验收

此验收在 PR 阶段自动触发，不依赖合并到 main。GitHub 代码工作流保留类型、领域测试、数值重放和构建；独立 `Vercel deployed browser acceptance` 工作流针对 **同一 PR HEAD 的真实 Preview 部署**运行浏览器交互。

- Vercel Project：`prj_VzGBScFrTWp4UZA8IKqzX8Yjot8L`；项目与团队 ID 是公共标识，固定在仓库验收脚本中。必须由 Vercel API 验证 `projectId`、`meta.githubCommitSha`、`meta.githubCommitRef`、`readyState=READY`，不能使用用户手填 URL 或旧 Preview。
- 需要由仓库管理员安全配置 `VERCEL_TOKEN` GitHub Actions Secret，且只能读取本 Vercel Project 的部署信息；无权限或未配置会明确失败，不能用本地测试冒充 Preview PASS。对来自 Fork 的外部 PR，GitHub 默认不提供 Secrets，因此远端验收会失败闭锁。涉及不可信代码时应在受保护环境审批后运行。
- Preview 若有 Vercel Authentication，配置 `VERCEL_AUTOMATION_BYPASS_SECRET` Actions Secret（由管理员在 Vercel 创建）；不要把任何令牌写入源码、Issue、PR、工件或日志。登录页不得算作游戏通过。
- 浏览器测试通过独立测试进程运行真实领域命令构造可复现世界，再写入**隔离的 Playwright 浏览器 Profile**；Vercel 的正式构建没有测试命令入口、测试服务路由或 `/src` 动态导入。UI 操作、存档恢复、材料消耗均由线上编译资源执行，保持原有游戏规则。
- `PLAYWRIGHT_BASE_URL=https://<verified-deployment>.vercel.app/ pnpm --filter @idea-slime-bar/liyue-kitchen test:e2e` 会关闭本地 webServer。自动工作流通过 Vercel API 获取并注入已验明的 URL。
- 验收证据须同时包含：HEAD SHA、Vercel 部署 ID/URL/READY、桌面 1600×900、模拟触摸 1280×720 的实际浏览器交互结果及截图。生产版的用户体验、真实手机和最终视觉验收交给 Experience QA。

禁止把 Dev Vite 的旧 Playwright PASS 或单纯 Vercel READY 当作当前 Preview 的完整交互验收。
