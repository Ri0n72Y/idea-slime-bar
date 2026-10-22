# 千星 Lua：模块结构与已验证编辑器经验

> 当前千星2D参赛版本全部游戏计算与动态UI均在**本地Lua**，不使用服务端节点图或多人同步。原模块化Seed切片来自已合并[PR #30](https://github.com/Ri0n72Y/idea-slime-bar/pull/30)，并不等于整个器官和反应链已实机完成。

- **实机验证**：`script.object`可取得已挂载`ClientUIContainerControl`，`FindChild`可定位预先布置的子控件，Lua已能更新基础文字、响应最小点击。
- **模块设计证据**：现有`WK2_Entry.lua`和`WK2/{config,vector,curves,state,soil,seed,step,present}.lua`作为小型职责分离范例，源码只覆盖到Seed→Sapling切片；Sapling后续结算未实现的状态不能冒称完成。
- **资源映射**：所有经`require`加载的Lua文件仍需在千星客户端脚本资源管理器分别建立资源映射；仓库存在文件不代表编辑器已打包加载。
- **唯一状态**：Game计算并持有world，UI只读取投影并提交实际动作，Taste仅读取果汁快照；不要在按钮或另一模块中保存第二份权威物质量。
- **时间**：参赛1uh=现实10秒，单一Lua调度累计`Δuh`；Debug快进使用同一计算入口，随机机会按模型日去重，不能按UI帧率结算。
- **编辑器边界**：控件位置/尺寸/锚点由创作者手工确定；Lua负责内容、名称、图片资源ID与颜色；PNG路径不能直接当`SetImage`可用的编辑器图片ID。
- **证据限制**：`SetVisible`、图片更换/染色、TextWindow完整长文本、手机触控、系统复制与多文件模块的最终运行，还不能以官方API存在或Web CI通过代替千星编辑器实机证据。
- **玩法合同**：按[动态根系与七维预算](../mvp/aquamelon-kitchen/02-data-and-balance.md)、[Growth/器官](../mvp/aquamelon-kitchen/03-growth-and-harvest.md)、[元素/视觉](../mvp/aquamelon-kitchen/08-ui-and-visuals.md)、[反应结算](../mvp/aquamelon-kitchen/04-elemental-reactions.md)、[风味](../mvp/aquamelon-kitchen/06-flavor-contract.md)实现。根系实际吸收先入Reserve，生长Budget按当前R与Δuh动态计算；`/7`只表示元素数量，不能按固定7V执行，也不能把树倍率重复乘到Growth。
