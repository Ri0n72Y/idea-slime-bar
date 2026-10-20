# Aquamelon Kitchen — 2D Lua 参赛文档索引

本目录仅记录**千星奇域2D Lua单机参赛版的实施边界**；**玩法数值、感官、显色和反应的唯一现行合同均直接维护在既有原文档中**，不再复制第二套v3数值正文。

- 架构：游戏计算、世界状态、UI动态控制、颜色计算、提示词都由本地Lua处理；1uh=10秒，无服务端节点图、多人同步或网络AI。
- P0：种植→七元素球培养→完整Growth、遗传与反应→成熟采摘→**一熟果一份汁**→提供完整AI品尝提示词。
- P1：像素画、放大镜和底部状态栏、手套工具，P0完成之后再做。
- 千星编辑器预置静态图片、控件和布局；Lua负责动态读取和更新。已验证的最小`script.object/FindChild`与基础文字/点击可作为技术起点；图片切换、多模块require、长文本/剪贴板等仍须编辑器实机测试。

**现行规则直接阅读：**

1. [Growth、土壤、根系、成熟后富集与采摘](../../mvp/aquamelon-kitchen/growth-system.md)
2. [数值参数与校准适用范围](../../mvp/aquamelon-kitchen/growth-balance-baseline.md)
3. [元素颜色、RGB加权叠色与首次反应外形](../../mvp/aquamelon-kitchen/elemental-cultivation.md)
4. [七元素及每一种反应的实际风味](../../mvp/aquamelon-kitchen/taste-model.md)
5. [反应触发、产物、持续状态、R1/R2](../../mvp/aquamelon-kitchen/fruit-reaction-settlement-design.md)
6. [七元素图标与主体色](../visual/element-reference.md)
7. [唯一数值时间单位](../plants/uh-time-unit.md)
8. [MVP入口](../../mvp/aquamelon-kitchen/README.md)与[实施 Issue #34](https://github.com/Ri0n72Y/idea-slime-bar/issues/34)

这是一份**导航**，不产生独立的Growth阈值、配色算法或Taste版本。
