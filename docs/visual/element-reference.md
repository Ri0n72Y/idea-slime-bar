# 七元素视觉参考（Aquamelon Kitchen）

> 2026-10-09 实测记录。主体色来自本仓库上传的七张 PNG **实际像素**，并非从网络元素配色表推定的游戏官方 HEX。本文为视觉素材参考，不修改游戏玩法、七维元素顺序或运行时代码。

## 七元素主体色（本图实测）

图标数据：`assets/elements/{Fire,Hydro,Anemo,Electro,Dendro,Cryo,Geo}.png`。上传素材均为 **30×30 RGBA PNG**，以 [PR #20 的素材版本](https://github.com/Ri0n72Y/idea-slime-bar/pull/20) 为实测基准。

| 图标 | 元素 | **实测主体色** | 旧参考色（非实测） | ΔE76 | 纳入取色的可见像素 |
|---|---|---|---|---:|---:|
| ![火](../../assets/elements/Fire.png) | 火 / `Fire` | **`#D56C45`** | `#EC4923` | 27.4 | 429 |
| ![水](../../assets/elements/Hydro.png) | 水 / `Hydro` | **`#4389CB`** | `#498FCC` | 3.9 | 496 |
| ![风](../../assets/elements/Anemo.png) | 风 / `Anemo` | **`#339F84`** | `#359697` | 17.3 | 454 |
| ![雷](../../assets/elements/Electro.png) | 雷 / `Electro` | **`#8742CE`** | `#6957C2` | 22.3 | 457 |
| ![草](../../assets/elements/Dendro.png) | 草 / `Dendro` | **`#8EAF43`** | `#66AD16` | 20.7 | 470 |
| ![冰](../../assets/elements/Cryo.png) | 冰 / `Cryo` | **`#68B8BF`** | `#35AACC` | 16.4 | 443 |
| ![岩](../../assets/elements/Geo.png) | 岩 / `Geo` | **`#C2A045`** | `#CC9046` | 13.8 | 436 |

**解释：** “实测主体色”是上传图标在默认过滤条件下占优势色相簇的代表 RGB 中位数。旧参考色来自先前独立收集的元素配色资料，**不是**这七张 PNG 的实测色。两者之间的 `ΔE76` 仅表示 Lab 空间颜色距离（数字越小通常越相近），**不是**正式视觉验收结论，也不证明任何一方是官方标准色。

## 可复现方法

与 [网页颜色对比工具](../../assets/elements/color-comparison.html) 中的取色逻辑一致：

1. 通过 GitHub 文件接口以 Base64 形式读取上述七张**仓库原 PNG**，解码其 RGBA 像素；本次并非根据旧 HEX 估算。
2. 仅保留 alpha **≥150** 的像素。对其 HSV 计算色相、饱和度及明度；仅把饱和度 **≥20%** 且 HSV 明度 **>0.08** 的像素视为候选有彩色像素。
3. 按色相每 **10°** 分为 36 桶，像素权重为 `(alpha / 255) × (0.75 + 0.25 × saturation)`。查找加权权重最大的**连续五个色相桶（中心 ±2 桶）**。
4. 对选中主色相簇中的 R/G/B 各通道分别求**加权中位数**，合成为大写 `#RRGGBB`；不把白色、透明背景或抗锯齿边缘直接当作主色。
5. 对每张图输出取样数并与旧参考色计算 CIE Lab **ΔE76**（标准 sRGB→Lab D65）；本次七张图满足筛选条件的像素数等于上表“可见像素”数。

固定取色参数：`alpha=150`，`saturation=0.20`。更改取色滑块、改用其他尺寸素材、重新着色或重新导出图标时，结果可能改变，届时应记录新的参数/源版本。

## 文件身份与完整性

这些取色数据对应以下 Git Blob（便于确认原图是否换版）：

- `assets/elements/Fire.png` — `1546c3a9738b1f580ade08e8620a64a8c3ffe2e7`
- `assets/elements/Hydro.png` — `28e49ea3ebddc7603f4ecde697d9cf4a9524bc35`
- `assets/elements/Anemo.png` — `8ea17477dba2ea07c6ac2cca1dd91f221419c568`
- `assets/elements/Electro.png` — `54d6a555afb859dde406f6cf1abe79a73ab745f1`
- `assets/elements/Dendro.png` — `c2b0b794789deaef6b76dc6ac56158b88a07e3db`
- `assets/elements/Cryo.png` — `5d5eab66c3aff4f2ace2ee8af568a27e63981df4`
- `assets/elements/Geo.png` — `1ae8d8171c390d9c46c756e35e5421afa23a18c2`

当前得到的是**静态像素计算结果**；浏览器里的人眼匹配/色彩适配尚需单独确认。请使用 [对比网页](../../assets/elements/color-comparison.html) 复核实际显示。

## 设计边界

- 元素向量固定顺序：`Fire / Hydro / Anemo / Electro / Dendro / Cryo / Geo`，对应 **火／水／风／雷／草／冰／岩**。
- 可以把此表用于 UI 色彩选择的候选依据，但**不自动替换**任何运行时元素颜色常量、材质、Web UI 或千星奇域节点图。
- 图标源自用户提交的《原神》相关素材；若要进一步发布或商业使用，仍需确认原图的权利与许可条件。
