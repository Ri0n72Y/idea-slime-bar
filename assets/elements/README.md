# 七元素图标资源（BWiki 引用）

资料源：[BWiki 元素反应](https://wiki.biligame.com/ys/元素反应)。此页面使用七张「卡牌UI-元素-*.png」PNG 图标；每张图的 **20px 实际缩略图地址**已记录在 [sources.json](./sources.json)。

## 当前状态

**已提交：** 7 个 Wiki 图片地址 + 七元素名称/顺序 + HEX 色值 + 来源信息 + 同步脚本。

**未提交：** 七个本地 PNG 二进制文件。当前执行环境不能访问 BWiki 图片 CDN，不能把远程 URL 冒称为离线图片。本目录 `icons/` 需要在具有互联网的环境中执行：

```bash
node assets/elements/sync.mjs
```

脚本会获取七张实际 BWiki 的 20px 缩略图、确认 PNG 头、再保存至 `assets/elements/icons/{pyro,hydro,anemo,electro,dendro,cryo,geo}.png`，输出每文件 SHA-256。**下载成功并人工目视检查后，另行将七个 PNG 加入 Git**；不允许未经核对就宣称已经镜像到仓库。此脚本不是 CI 或 Domain Test，不会自动执行。

## 颜色口径

提供的 BWiki **元素反应**页面引用七元素图标，但没有逐项明示十六进制色值。这里的 `hex` 来自另一份明确列出常规元素色码的 [萌娘百科 Genshincolor](https://moegirl.uk/Template:Genshincolor) 参考表，**不是** BWiki 页面自身的官方/逐像素取样值，也不是从图标测出的颜色。

更详细的表和来源：[元素视觉参考](../../docs/visual/element-reference.md)。

## 使用与权利

这是供水瓜厨房原型比对的第三方游戏图标参考；著作权、商标及再分发条件需遵循原素材权利人的规定。BWiki 页面标示 CC BY-NC-SA 4.0 的站点内容协议，不代表游戏图标的全部底层权利均获许可。未经确认，不自动部署至商业站点或千星奇域客户端。当前不改动任何 UI/玩法与运行代码。
