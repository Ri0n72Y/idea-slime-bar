import test from "node:test";
import assert from "node:assert/strict";
import { playerEventText, growthStageLabel } from "./uiLabels.ts";

test("real Growth events hide plant/leaf identities and translate stages", () => {
  const cases = [
    ["plant:2 萌发：Seed → Seedling（45G）", "这株水瓜 萌发：种子期 → 幼苗期（45G）"],
    ["plant:2:leaf:1：Bud → SmallLeaf（20G）", "这片叶子：叶芽 → 小叶（20G）"],
    ["plant:2:leaf:1：SmallLeaf → LargeLeaf + FlowerBud（26G）", "这片叶子：小叶 → 肥厚叶 + 花蕾（26G）"],
    ["plant:2:leaf:1：GreenFruit → MatureFruit（生殖累计90G）", "这片叶子：青果 → 成熟水瓜（生殖累计90G）"],
    ["plant:2：Growth 周期出芽", "这株水瓜：生长 周期出芽"],
    ["P01 · plant:2:leaf:1：Flower → GreenFruit（生殖累计40G）",
      "1号地 · 这片叶子：开花 → 青果（生殖累计40G）"],
    ["获得 item:seed:1", "获得 对应物件"],
  ] as const;
  for (const [raw, expected] of cases) {
    assert.equal(playerEventText(raw), expected);
    assert.doesNotMatch(playerEventText(raw), /plant:|item:|P01|SmallLeaf|Bud|GreenFruit|Growth/);
  }
  assert.equal(growthStageLabel("Seedling · LargeLeaf"), "幼苗期 · 肥厚叶");
});
