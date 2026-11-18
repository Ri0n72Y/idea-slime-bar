# Vercel 交互验收

验证顺序：Coder 先提交 PR，GitHub 仅执行类型检查、领域测试、数值重放和构建；Vercel 为对应 HEAD 创建 Preview，确认 READY 和 Git SHA 一致后，在实际部署地址运行 Playwright。Reviewer 独立核对 PR、测试证据；Lead 合并后，Experience QA 再验收 Production。

- 当前项目 Vercel ID：`prj_VzGBScFrTWp4UZA8IKqzX8Yjot8L`。Preview 需要明确核对与 PR HEAD 对应；不能用旧版 Production 代替。
- 使用 GitHub Actions 的 `Vercel deployed browser acceptance` 手动运行，选择部署的**准确提交 ref**，填入该提交的 40 位 SHA 和 `https://*.vercel.app/` READY 部署 URL。脚本拒绝 ref/SHA 不一致以及无效 URL。
- 若 Preview 使用 Vercel Authentication，配置仓库 `VERCEL_AUTOMATION_BYPASS_SECRET` Actions Secret（由有权限的管理员在 Vercel 创建 bypass 后填入 GitHub）；不可把 bypass 写入代码、工件、Issue 或输出。未配置时需要独立验证可访问性；HTTP 登录页不能当做游戏 PASS。
- 本地复测：`PLAYWRIGHT_BASE_URL=https://<verified-deployment>.vercel.app pnpm --filter @idea-slime-bar/liyue-kitchen test:e2e`。此模式不启动本地 Vite。需授权的站点应通过安全环境变量提供 bypass。
- 证据包括准确部署 URL / SHA、桌面 1600×900 与模拟触摸 1280×720 的交互截图和测试状态；独立 QA 的真实玩家体验和手机真机仍单独判断。

禁止在未验明部署身份前把测试标记为通过。生产版验收不得依赖未合并的预览结果。
