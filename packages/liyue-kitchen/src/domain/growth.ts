import {
  U2_CONFIG, TREE_BASE, LEAF_TEMPLATE, FRUIT_TEMPLATE, ROOT_PREFERENCE,
  zeros, vectorSum, type Vector,
} from "./config.ts";
import { advanceSustained, newReactionState, reactGrowth, reproductiveMass, type ReactionState } from "./reactions.ts";

export type TreeStage = "Seed" | "Seedling" | "Sapling";
export type LeafStage = "SmallLeaf" | "LargeLeaf" | "FibrousLeaf";
export type FruitStage = "FlowerBud" | "Flower" | "GreenFruit" | "MatureFruit";

export type Fruit = {
  stage: FruitStage;
  free: Vector; // E_free: G only, the single consumable reproductive account
  reaction: ReactionState;
  baseAffinity: Vector;
  lockedAffinity: Vector | null;
  stageStart: Vector; // read-only origin snapshot for 12G/40G affinity plasticity
};
export type Leaf = {
  id: string;
  stage: LeafStage;
  growth: Vector;
  baseAffinity: Vector;
  fruit: Fruit | null;
};
export type Tree = {
  id: string;
  stage: TreeStage;
  treeGrowth: Vector;
  treeBaseAffinity: Vector;
  reserve: Vector; // V, only Sapling has reserve
  budGrowth: Vector | null;
  leaves: Leaf[];
  nextLeafId: number;
};
export type GardenPlot = { id: string; open: boolean; soil: Vector; plant: Tree | null };

export type NightLedger = {
  soilEvaporatedV: number;
  rootAbsorbedV: number;
  reserveConsumedV: number;
  directTreeConvertedV: number;
  organConsumedV: number;
  newTreeGrowthG: number;
  newOrganGrowthG: number;
  leafEnvironmentalLossV: number;
  windNetGrowthG: number;
  ballDecayedV: number;
};
export const newLedger = (): NightLedger => ({
  soilEvaporatedV: 0, rootAbsorbedV: 0, reserveConsumedV: 0,
  directTreeConvertedV: 0, organConsumedV: 0,
  newTreeGrowthG: 0, newOrganGrowthG: 0, leafEnvironmentalLossV: 0,
  windNetGrowthG: 0, ballDecayedV: 0,
});

export function newTree(plantId: string): Tree {
  return { id: plantId, stage: "Seed", treeGrowth: zeros(), treeBaseAffinity: [...TREE_BASE],
    reserve: zeros(), budGrowth: null, leaves: [], nextLeafId: 1 };
}

function effectiveAffinity(base: Vector, growth: Vector): Vector {
  const total = vectorSum(growth);
  return base.map((x, i) => x + (total > 0 ? growth[i] / total : 0)) as Vector;
}
function inherit(template: Vector, actual: Vector, parentBase: Vector): Vector {
  return template.map((x, i) => x + 0.5 * (actual[i] - parentBase[i])) as Vector;
}
function sigmoid(x: number) { return 1 / (1 + Math.exp(-x)); }
function reserveGrowthFactor(value: number): number {
  const lo = sigmoid(-95 / 12), hi = sigmoid((180 - 95) / 12);
  return Math.max(0, Math.min(1, (sigmoid((value - 95) / 12) - lo) / (hi - lo)));
}
function rootReserveFactor(r: number): number {
  if (r <= 100) return 1;
  if (r >= 180) return 0;
  return Math.log(1 + (180 - r) / 80) / Math.log(2);
}
function rootCap(stage: TreeStage) { return stage === "Seed" ? 2 : stage === "Seedling" ? 1.85 : 16; }

/** One explicit model hour: soil retention, one root budget, reserve budget and organ events. */
export function advancePlotOneUH(plot: GardenPlot, hour: number, random: () => number,
  events: string[], ledger: NightLedger): void {
  if (!plot.open) return;
  for (let i = 0; i < 7; i++) {
    const before = plot.soil[i];
    plot.soil[i] *= U2_CONFIG.soilRetentionPerUH;
    ledger.soilEvaporatedV += before - plot.soil[i];
  }
  const tree = plot.plant;
  if (!tree) return;

  const soilTotal = vectorSum(plot.soil);
  const stageCap = rootCap(tree.stage);
  const reserveTotal = vectorSum(tree.reserve);
  const rootBudget = stageCap * Math.log(1 + soilTotal / 200) / Math.log(6) *
    (tree.stage === "Sapling" ? rootReserveFactor(reserveTotal) : 1);
  const candidates = plot.soil.map((v, i) => Math.min(
    v * ROOT_PREFERENCE[i], stageCap * 0.30 * tree.treeBaseAffinity[i],
  )) as Vector;
  const candidateSum = vectorSum(candidates);
  const scaleByRoot = candidateSum > 0 ? Math.min(1, rootBudget / candidateSum) : 0;
  const wouldAbsorb = candidateSum * scaleByRoot;
  const capacityLeft = tree.stage === "Sapling" ? Math.max(0, U2_CONFIG.reserveCapacityV - reserveTotal) : Infinity;
  const capacityScale = wouldAbsorb > 0 ? Math.min(1, capacityLeft / wouldAbsorb) : 1;
  const absorption = candidates.map(x => x * scaleByRoot * capacityScale) as Vector;
  for (let i = 0; i < 7; i++) {
    plot.soil[i] = Math.max(0, plot.soil[i] - absorption[i]);
    ledger.rootAbsorbedV += absorption[i];
    if (tree.stage === "Sapling") tree.reserve[i] += absorption[i];
    else {
      tree.treeGrowth[i] += absorption[i]; // Seed/Seedling: 1 V -> 1 G, no reserve
      ledger.directTreeConvertedV += absorption[i];
      ledger.newTreeGrowthG += absorption[i];
    }
  }
  if (tree.stage === "Seed" && vectorSum(tree.treeGrowth) >= 45 - 1e-8) {
    tree.stage = "Seedling";
    events.push(`${tree.id} 萌发：Seed → Seedling（45G）`);
  }
  if (tree.stage === "Seedling" && vectorSum(tree.treeGrowth) >= 90 - 1e-8) {
    tree.stage = "Sapling";
    // One account transfer G→V, not a second copy of the 90G.
    tree.reserve = [...tree.treeGrowth];
    tree.treeGrowth = zeros();
    tree.budGrowth = zeros();
    events.push(`${tree.id} 成为幼树：Seedling → Sapling（90G），首芽出生`);
    return; // Threshold occurred in this hour; no second Sapling budget in the same step.
  }
  if (tree.stage !== "Sapling") return;

  // Continue already active one-hour reactions before this hour's new Growth.
  for (const leaf of tree.leaves) if (leaf.fruit?.stage === "MatureFruit") {
    advanceSustained(leaf.fruit.free, leaf.fruit.reaction, events);
  }

  const R = vectorSum(tree.reserve);
  const refBudget = U2_CONFIG.reserveBudgetVPerUH * reserveGrowthFactor(R);
  const treeAffinity = effectiveAffinity(tree.treeBaseAffinity, tree.treeGrowth);
  const budget = tree.reserve.map((v, i) => Math.min(v, refBudget / 7 * Math.max(0, treeAffinity[i]))) as Vector;
  const remaining = [...budget] as Vector;
  const growthAdded = new Map<Leaf, Vector>();

  // At most three independent leaf budgets, 30% nominal each. No duplicate budget.
  for (const leaf of tree.leaves) {
    const leafAffinity = effectiveAffinity(leaf.baseAffinity, leaf.growth);
    const newFruitGrowth = zeros();
    // Every channel in this uh uses the SAME pre-input fruit mass and affinity.
    // Sequential per-element recomputation would make enrichment depend on element order.
    const fruit = leaf.fruit;
    const fruitMassAtStepStart = fruit ? reproductiveMass(fruit.free, fruit.reaction) : 0;
    const fruitAffinityAtStepStart = fruit
      ? (fruit.lockedAffinity ?? effectiveAffinity(fruit.baseAffinity,
        fruit.free.map((v, i) => Math.max(0, v - fruit.stageStart[i])) as Vector)) : null;
    const enrichmentAtStepStart = fruit?.stage === "MatureFruit"
      ? 0.5 * Math.max(0, Math.min(1, (150 - fruitMassAtStepStart) / 60)) : 1;
    for (let i = 0; i < 7; i++) {
      const grant = budget[i] * 0.30 * Math.min(1, Math.max(0, leafAffinity[i]));
      if (grant <= 0) continue;
      const fruitShare = leaf.fruit ? (leaf.fruit.stage === "MatureFruit" ? 0.4 : 0.8) : 0;
      const fruitV = grant * fruitShare;
      const leafV = leaf.stage === "FibrousLeaf" ? 0 : grant - fruitV;
      // A fibrous mother does not grow; unused V goes back into the tree budget.
      const actualV = leafV + fruitV;
      remaining[i] -= actualV;
      ledger.organConsumedV += actualV;
      ledger.reserveConsumedV += actualV;
      if (leafV > 0) {
        const efficiency = leaf.stage === "LargeLeaf" ? 0.60 : 1;
        const gained = leafV * efficiency * leafAffinity[i];
        leaf.growth[i] += gained;
        ledger.newOrganGrowthG += gained;
        if (leaf.stage === "LargeLeaf") ledger.leafEnvironmentalLossV += leafV * 0.4;
      }
      if (fruitV > 0 && fruit && fruitAffinityAtStepStart) {
        const gained = fruitV * fruitAffinityAtStepStart[i] * enrichmentAtStepStart;
        fruit.free[i] += gained;
        newFruitGrowth[i] += gained;
        ledger.newOrganGrowthG += gained;
      }
    }
    if (leaf.fruit) growthAdded.set(leaf, newFruitGrowth);
  }

  for (let i = 0; i < 7; i++) {
    const gain = Math.max(0, remaining[i]);
    if (tree.budGrowth) tree.budGrowth[i] += gain;
    else tree.treeGrowth[i] += gain;
    ledger.newTreeGrowthG += gain;
    ledger.directTreeConvertedV += gain;
    ledger.reserveConsumedV += gain;
    tree.reserve[i] = Math.max(0, tree.reserve[i] - budget[i]);
  }

  // Threshold events are state transitions, not elapsed-hour shortcuts.
  if (tree.budGrowth && vectorSum(tree.budGrowth) >= 20 - 1e-8 && tree.leaves.length < 3) {
    const inherited = inherit(LEAF_TEMPLATE, effectiveAffinity(tree.treeBaseAffinity, tree.treeGrowth), tree.treeBaseAffinity);
    // Bud has completed its own 20G threshold; a new leaf starts an independent Growth account.
    const growth = zeros();
    const leaf: Leaf = { id: `${tree.id}:leaf:${tree.nextLeafId++}`, stage: "SmallLeaf",
      growth, baseAffinity: inherited, fruit: null };
    tree.leaves.push(leaf);
    tree.budGrowth = null;
    events.push(`${leaf.id}：Bud → SmallLeaf（20G）`);
  }
  for (const leaf of tree.leaves) {
    if (leaf.stage === "SmallLeaf" && vectorSum(leaf.growth) >= 26 - 1e-8) {
      const eff = effectiveAffinity(leaf.baseAffinity, leaf.growth);
      const fruitBase = inherit(FRUIT_TEMPLATE, eff, leaf.baseAffinity);
      leaf.baseAffinity = eff;
      leaf.growth = zeros(); // Leaf-only reset; reproductive free is continuous.
      leaf.stage = "LargeLeaf";
      leaf.fruit = { stage: "FlowerBud", free: zeros(), reaction: newReactionState(),
        baseAffinity: fruitBase, lockedAffinity: null, stageStart: zeros() };
      events.push(`${leaf.id}：SmallLeaf → LargeLeaf + FlowerBud（26G）`);
    }
    const fruit = leaf.fruit;
    if (!fruit) continue;
    const mass = reproductiveMass(fruit.free, fruit.reaction);
    if (fruit.stage === "FlowerBud" && mass >= 12 - 1e-8) {
      fruit.baseAffinity = effectiveAffinity(fruit.baseAffinity,
        fruit.free.map((v, i) => Math.max(0, v - fruit.stageStart[i])) as Vector);
      fruit.stageStart = [...fruit.free];
      fruit.stage = "Flower";
      events.push(`${leaf.id}：FlowerBud → Flower（生殖累计12G）`);
    }
    if (fruit.stage === "Flower" && mass >= 40 - 1e-8) {
      fruit.baseAffinity = effectiveAffinity(fruit.baseAffinity,
        fruit.free.map((v, i) => Math.max(0, v - fruit.stageStart[i])) as Vector);
      fruit.lockedAffinity = [...fruit.baseAffinity];
      fruit.stageStart = [...fruit.free];
      fruit.stage = "GreenFruit";
      events.push(`${leaf.id}：Flower → GreenFruit（生殖累计40G）`);
    }
    if (fruit.stage === "GreenFruit" && mass >= 90 - 1e-8) {
      fruit.stage = "MatureFruit";
      leaf.stage = "FibrousLeaf";
      events.push(`${leaf.id}：GreenFruit → MatureFruit（生殖累计90G）`);
    }
    if (fruit.stage === "MatureFruit") {
      const before = reproductiveMass(fruit.free, fruit.reaction);
      ledger.windNetGrowthG += reactGrowth(fruit.free, fruit.reaction, growthAdded.get(leaf) ?? zeros(), events);
      if (reproductiveMass(fruit.free, fruit.reaction) < 0 || before < 0) throw new Error("Invalid reproductive mass");
    }
  }
  if (vectorSum(tree.treeGrowth) >= 100 - 1e-8) {
    tree.treeBaseAffinity = effectiveAffinity(tree.treeBaseAffinity, tree.treeGrowth);
    tree.treeGrowth = zeros();
    events.push(`${tree.id}：主干100G周期塑形`);
    if (tree.budGrowth === null && tree.leaves.length < 3) {
      tree.budGrowth = zeros();
      events.push(`${tree.id}：Growth 周期出芽`);
    }
  }
  // Model-day 04:00, not a bonus roll whenever "end day" is clicked.
  if (hour % 24 === 4 && tree.budGrowth === null && tree.leaves.length < 3) {
    const chances = [0.8, 0.4, 0.01, 0];
    if (random() < chances[tree.leaves.length]) {
      tree.budGrowth = zeros();
      events.push(`${tree.id}：04:00 模型日出芽`);
    }
  }
}