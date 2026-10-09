# 七元素图标 · 像素颜色对照

七张上传的实际 PNG：`assets/elements/{Fire,Hydro,Anemo,Electro,Dendro,Cryo,Geo}.png`。

**七元素实测 HEX 与旧参考色的最终记录在 [element-reference.md](./element-reference.md)。** 本次数据由 GitHub 仓库中的原图字节解码并计算，不再仅有动态网页模板。

| 元素 | 实测主体 HEX | 旧参考 HEX |
|---|---|---|
| 火（Fire） | **`#D56C45`** | `#EC4923` |
| 水（Hydro） | **`#4389CB`** | `#498FCC` |
| 风（Anemo） | **`#339F84`** | `#359697` |
| 雷（Electro） | **`#8742CE`** | `#6957C2` |
| 草（Dendro） | **`#8EAF43`** | `#66AD16` |
| 冰（Cryo） | **`#68B8BF`** | `#35AACC` |
| 岩（Geo） | **`#C2A045`** | `#CC9046` |

打开 [交互式对比页面](../../assets/elements/color-comparison.html)，可将原图、实测主体色、旧参考色和两种重新着色的版本并排查看。网页可调整 alpha/饱和度阈值并导出 JSON；调整参数后结果可能与文档默认值不同。

**同一算法、默认参数：** `alpha≥150`，HSV 饱和度 `≥20%`，明度 `>0.08`；36 个 10° 色相桶、中心左右各两个桶形成占优的色相簇，簇内逐 RGB 分量按像素 alpha / 饱和度加权中位数取主色。详见 [完整取色方法和 Git Blob SHA](./element-reference.md)。

色号是**这七张上传素材的主体色**，不是 BWiki 页面公布的 HEX、并非官方通用元素配色。此前参考值保留用于视觉对照，不覆盖实测值。尚未进行新的浏览器内人工视觉确认，也未变更 Web/千星奇域的视觉或玩法实现。
