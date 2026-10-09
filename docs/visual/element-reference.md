# 七元素视觉参考（Aquamelon Kitchen）

> 2026-10-09。仅为视觉参考资源/可追溯来源，不是元素反应玩法合同，不修改七元素数值向量、Growth 或千星奇域实现。

## 来源边界

1. **图标：** [原神 BWiki · 元素反应](https://wiki.biligame.com/ys/元素反应) 中用于表示七元素的「卡牌UI-元素-*.png」。记录的是页面实际引用的 **20px 缩略图**链接，见 [assets/elements/sources.json](../../assets/elements/sources.json)。
2. **色号：** 上述 BWiki 页面并未列出对应 HEX；因此色值单独采用 [萌娘百科 · Genshincolor 模板](https://moegirl.uk/Template:Genshincolor) 的**常规元素颜色**表。**绝不将这些值归为 BWiki 直接提供、游戏官方固定色或从图标取样得到的色号。**
3. **可用性：** 下载脚本已保存，但本次运行环境无法读取 BWiki 图片 CDN；**实际 PNG 尚未入 Git**，不能作为离线内置图标引用。取得素材后按本目录 README 验证和提交。

## 元素顺序、颜色和图标链接

下面的顺序与项目 `ElementVector[7]` 一致，不改变内部元素名称。

| 内部标识 | 中文 | 常规配色 HEX（来源：萌娘百科） | Wiki 图标名称 | 本地目标 |
|---|---|---|---|---|
| `Fire` | 火 | `#EC4923` | [卡牌UI-元素-火.png](https://patchwiki.biligame.com/images/ys/thumb/c/c6/bj6s4no20w4btn8no6gze4sfejhl51b.png/20px-%E5%8D%A1%E7%89%8CUI-%E5%85%83%E7%B4%A0-%E7%81%AB.png) | `assets/elements/icons/pyro.png`（未缓存） |
| `Hydro` | 水 | `#498FCC` | [卡牌UI-元素-水.png](https://patchwiki.biligame.com/images/ys/thumb/a/ab/6m3r7j2tmwx5x6zkvzs25davcm6add5.png/20px-%E5%8D%A1%E7%89%8CUI-%E5%85%83%E7%B4%A0-%E6%B0%B4.png) | `assets/elements/icons/hydro.png`（未缓存） |
| `Anemo` | 风 | `#359697` | [卡牌UI-元素-风.png](https://patchwiki.biligame.com/images/ys/thumb/3/35/nbqoy2m63thzml89w159ini4yq8gi6w.png/20px-%E5%8D%A1%E7%89%8CUI-%E5%85%83%E7%B4%A0-%E9%A3%8E.png) | `assets/elements/icons/anemo.png`（未缓存） |
| `Electro` | 雷 | `#6957C2` | [卡牌UI-元素-雷.png](https://patchwiki.biligame.com/images/ys/thumb/0/06/c93s7x8gg5hn9u5htu1walapzte7nf1.png/20px-%E5%8D%A1%E7%89%8CUI-%E5%85%83%E7%B4%A0-%E9%9B%B7.png) | `assets/elements/icons/electro.png`（未缓存） |
| `Dendro` | 草 | `#66AD16` | [卡牌UI-元素-草.png](https://patchwiki.biligame.com/images/ys/thumb/8/8c/6fjk9iisffn0kaua98bodhn3j0igkdx.png/20px-%E5%8D%A1%E7%89%8CUI-%E5%85%83%E7%B4%A0-%E8%8D%89.png) | `assets/elements/icons/dendro.png`（未缓存） |
| `Cryo` | 冰 | `#35AACC` | [卡牌UI-元素-冰.png](https://patchwiki.biligame.com/images/ys/thumb/4/44/ju6lyaklj98ichcjnlrg7268k1vsbif.png/20px-%E5%8D%A1%E7%89%8CUI-%E5%85%83%E7%B4%A0-%E5%86%B0.png) | `assets/elements/icons/cryo.png`（未缓存） |
| `Geo` | 岩 | `#CC9046` | [卡牌UI-元素-岩.png](https://patchwiki.biligame.com/images/ys/thumb/1/1c/kf0eavezs5z89l82fxzon2dlnf3et05.png/20px-%E5%8D%A1%E7%89%8CUI-%E5%85%83%E7%B4%A0-%E5%B2%A9.png) | `assets/elements/icons/geo.png`（未缓存） |

### 使用建议

- 如果未来 Web 使用这些参考色，读取 `sources.json` 的 `hex`；不要以主题色直接改变元素计算顺序或 ElementVector 数值。
- 普通/Debug 七元素展示权限按 UI Issue 约定，不因新增图标改变。
- 图标是《原神》游戏美术资产引用，使用前需核查权利；目前只把来源保存供审查，并未纳入 Web 打包或千星奇域资源。
