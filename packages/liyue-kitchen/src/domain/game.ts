/** U2 authoritative world state. No React, PixiJS or browser APIs in this module. */
import { ELEMENTS, U2_CONFIG, elementIndex, vectorSum, zeros, type Element, type Vector } from "./config.ts";
import { advancePlotOneUH, newLedger, newTree, type GardenPlot, type NightLedger, type TreeStage } from "./growth.ts";
import { reproductiveMass, type ReactionState } from "./reactions.ts";
import { processWorkbench, type ProcessAction } from "./processing.ts";
import { ECONOMY_CANDIDATE, newEnergyAccount, rewardEnergy, unlockPlot, type EnergyAccount } from "./economy.ts";
import { acceptOrder, advanceOrdersAtMorning, deliverOrder, initialOrders, type KitchenOrder } from "./orders.ts";

export const PLOT_IDS = ["P01", "P02", "P03", "P04", "P05", "P06", "P07"] as const;
export type PlotId = (typeof PLOT_IDS)[number];
export type Plot = GardenPlot & { id: PlotId };
export type Notice = Readonly<{ kind: "info" | "success" | "locked"; message: string }>;
export type GameEvent = { id: string; day: number; worldUH: number; kind: string; message: string };
/** A world item has one persistent ID and exactly one location. */
export type WorkbenchSlot = "peel" | "juice";
export type ItemLocation =
  | { kind: "inventory" }
  | { kind: "storage" }
  | { kind: "ground"; plotId: PlotId; x: number; y: number }
  | { kind: "workbench"; slot: WorkbenchSlot };
export type SourceIdentity = { plotId: PlotId; plantId: string; leafId: string };
export type SeedItem = { id: string; kind: "Seed"; location: ItemLocation; origin?: SourceIdentity };
export type EdibleKind = "Aquamelon" | "PeeledFlesh" | "RawJuice" | "AquamelonJuiceCup";
export type EdibleItem = {
  id: string; kind: EdibleKind; location: ItemLocation; source: SourceIdentity;
  free: Vector; reaction: ReactionState; baseAffinity: Vector; lockedAffinity: Vector | null;
  parentItemId?: string;
};
export type AquamelonItem = EdibleItem & { kind: "Aquamelon" };
export type ShellItem = {
  id: string; kind: "Shell"; location: ItemLocation; source: SourceIdentity;
  parentItemId: string; // no edible E_free or Products on a shell
};
export type GameItem = SeedItem | EdibleItem | ShellItem;
export function isEdible(item: GameItem): item is EdibleItem {
  return item.kind !== "Seed" && item.kind !== "Shell";
}
export function fruitMass(item: EdibleItem): number {
  return reproductiveMass(item.free, item.reaction);
}

export type ElementBall = { id: string; element: Element; initialV: 50; createdUH: number; slot: number };
export type NightReport = {
  fromDay: number; toDay: number; fromUH: number; toUH: number;
  ledger: NightLedger;
  plots: Record<PlotId, {
    soilBefore: Vector; soilAfter: Vector; reserveBefore: Vector; reserveAfter: Vector;
    treeGrowthBefore: Vector; treeGrowthAfter: Vector;
    stageBefore: TreeStage | null; stageAfter: TreeStage | null;
    leafCountBefore: number; leafCountAfter: number;
    fruitCountAfter: number;
  }>;
  events: string[];
};
export type GameState = {
  schemaVersion: 4;
  day: number;
  worldUH: number;
  phase: "DAY_WORK" | "DAY_CONFIRM";
  pendingEndDay: number | null;
  adeptalEnergy: EnergyAccount;
  orders: Record<string, KitchenOrder>;
  /** Harvested source IDs remain valid even if the parent plant is later replaced. */
  harvestedSources: string[];
  plots: Record<PlotId, Plot>;
  selectedPlotId: PlotId | null;
  selectedItemId: string | null;
  items: Record<string, GameItem>;
  looseBalls: Record<string, ElementBall>;
  heldElements: Vector; // actual V acquired, not extra material copies
  dayCondenseUsed: number;
  dayCondenseLimit: number;
  nextObjectSeq: number;
  randomState: number;
  eventLog: GameEvent[];
  lastNightReport: NightReport | null;
  notice: Notice;
};
export type Command =
  | { type: "SELECT_PLOT"; plotId: PlotId }
  | { type: "UNLOCK_PLOT"; plotId: PlotId }
  | { type: "PLANT_SEED"; itemId: string; plotId: PlotId }
  | { type: "HARVEST"; plotId: PlotId; plantId: string; leafId: string }
  | { type: "SELECT_ITEM"; itemId: string }
  | { type: "MOVE_ITEM"; itemId: string; destination: ItemLocation }
  | { type: "PROCESS_ITEM"; itemId: string; action: ProcessAction }
  | { type: "ACCEPT_ORDER"; orderId: string }
  | { type: "DELIVER_ORDER"; orderId: string; itemIds: string[] }
  | { type: "REJECT_DROP"; reason: string }
  | { type: "CONDENSE" }
  | { type: "COLLECT_BALL"; ballId: string }
  | { type: "WATER_PLOT"; element: Element; plotId: PlotId }
  | { type: "REQUEST_END_DAY" }
  | { type: "CANCEL_END_DAY" }
  | { type: "CONFIRM_END_DAY"; expectedDay: number };

export function newGame(seed = 0x17a5b7e1): GameState {
  const plots = Object.fromEntries(PLOT_IDS.map((id, i) => [id, {
    id, open: i === 0, soil: zeros(), plant: null,
  }])) as Record<PlotId, Plot>;
  return {
    schemaVersion: 4, day: 1, worldUH: 0, phase: "DAY_WORK", pendingEndDay: null,
    adeptalEnergy: newEnergyAccount(), orders: initialOrders(), harvestedSources: [],
    plots, selectedPlotId: null, selectedItemId: null,
    items: { "item:seed:1": { id: "item:seed:1", kind: "Seed", location: { kind: "inventory" } } },
    looseBalls: {}, heldElements: zeros(), dayCondenseUsed: 0,
    dayCondenseLimit: U2_CONFIG.condensesPerDay, nextObjectSeq: 2,
    randomState: (seed >>> 0) || 1, eventLog: [], lastNightReport: null,
    notice: { kind: "info", message: "拖动物品栏中唯一的种子到水晶球中心地格。" },
  };
}

export function nextRandom(state: GameState): number {
  let x = state.randomState >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.randomState = x >>> 0;
  return state.randomState / 0x100000000;
}
function event(state: GameState, kind: string, message: string) {
  state.eventLog.push({ id: `event:${state.nextObjectSeq++}`, day: state.day,
    worldUH: state.worldUH, kind, message });
  if (state.eventLog.length > 240) state.eventLog.splice(0, state.eventLog.length - 240);
}
function notice(state: GameState, kind: Notice["kind"], message: string) {
  state.notice = { kind, message };
  return state;
}
function work(state: GameState): boolean { return state.phase === "DAY_WORK"; }
function validPlot(state: GameState, id: PlotId): Plot | null {
  return Object.hasOwn(state.plots, id) ? state.plots[id] : null;
}
function snapshotPlot(plot: Plot) {
  return {
    soil: [...plot.soil] as Vector,
    reserve: [...(plot.plant?.reserve ?? zeros())] as Vector,
    treeGrowth: [...(plot.plant?.treeGrowth ?? zeros())] as Vector,
    stage: plot.plant?.stage ?? null,
    leaves: plot.plant?.leaves.length ?? 0,
  };
}

/** Every successful command atomically returns a cloned next state. Invalid identity is a no-op. */
export function applyCommand(previous: GameState, command: Command): GameState {
  if (command.type === "SELECT_PLOT") {
    const p = validPlot(previous, command.plotId);
    if (!p) return previous;
    const state = structuredClone(previous);
    if (!p.open) return notice(state, "locked", `${p.id} 尚未开垦。消耗 ${ECONOMY_CANDIDATE.plotCosts[p.id as keyof typeof ECONOMY_CANDIDATE.plotCosts]} 洞天仙力可开垦。`);
    state.selectedPlotId = state.selectedPlotId === p.id ? null : p.id;
    return notice(state, state.selectedPlotId ? "success" : "info",
      state.selectedPlotId ? `已选中 ${p.id}，可以播种或浇灌。` : `已取消选择 ${p.id}。`);
  }
  if (command.type === "REJECT_DROP") {
    if (!work(previous)) return previous;
    return notice(structuredClone(previous), "locked", command.reason);
  }
  if (command.type === "CANCEL_END_DAY") {
    if (previous.phase !== "DAY_CONFIRM") return previous;
    const state = structuredClone(previous);
    state.phase = "DAY_WORK"; state.pendingEndDay = null;
    return notice(state, "info", "已取消结束今日；世界时间没有推进。");
  }
  if (command.type === "CONFIRM_END_DAY") {
    if (previous.phase !== "DAY_CONFIRM" || previous.pendingEndDay !== command.expectedDay ||
      previous.day !== command.expectedDay) return previous;
    const state = structuredClone(previous);
    const fromDay = state.day, fromUH = state.worldUH;
    const ledger = newLedger();
    const oldSnapshots = Object.fromEntries(PLOT_IDS.map(id => [id, snapshotPlot(state.plots[id])])) as
      Record<PlotId, ReturnType<typeof snapshotPlot>>;
    const nightEvents: string[] = [];
    // Never multiply a single-hour result by K. Time is advanced one actual model hour at a time.
    for (let n = 0; n < U2_CONFIG.nightUH; n++) {
      state.worldUH++;
      for (const id of PLOT_IDS) {
        const events: string[] = [];
        advancePlotOneUH(state.plots[id], state.worldUH, () => nextRandom(state), events, ledger);
        for (const description of events) {
          nightEvents.push(`第 ${state.worldUH}uh · ${id} · ${description}`);
          event(state, "growth", description);
        }
      }
    }
    // Loose balls age only as a consequence of the committed world-time progression.
    for (const ball of Object.values(state.looseBalls)) {
      const remaining = ball.initialV * Math.pow(0.5, (state.worldUH - ball.createdUH) / U2_CONFIG.ballHalfLifeUH);
      ledger.ballDecayedV += ball.initialV - Math.max(0, remaining);
      if (remaining < 1) delete state.looseBalls[ball.id];
    }
    const plots = Object.fromEntries(PLOT_IDS.map(id => {
      const before = oldSnapshots[id], after = snapshotPlot(state.plots[id]);
      return [id, {
        soilBefore: before.soil, soilAfter: after.soil,
        reserveBefore: before.reserve, reserveAfter: after.reserve,
        treeGrowthBefore: before.treeGrowth, treeGrowthAfter: after.treeGrowth,
        stageBefore: before.stage, stageAfter: after.stage,
        leafCountBefore: before.leaves, leafCountAfter: after.leaves,
        fruitCountAfter: state.plots[id].plant?.leaves.filter(l => l.fruit).length ?? 0,
      }];
    })) as NightReport["plots"];
    state.day++;
    // One completed, nutrient-fed night is the first verifiable planting-cycle reward.
    for (const id of PLOT_IDS) {
      const tree = state.plots[id].plant;
      if (!tree || (tree.stage === "Seed" && vectorSum(tree.treeGrowth) <= 0)) continue;
      if (rewardEnergy(state, `cycle:${tree.id}`, ECONOMY_CANDIDATE.growthCycle)) {
        event(state, "reward", `有效种植周期 ${tree.id}：+${ECONOMY_CANDIDATE.growthCycle} 仙力`);
        nightEvents.push(`${id} 实际生长：获得 ${ECONOMY_CANDIDATE.growthCycle} 仙力。`);
      }
    }
    const orderEvents = advanceOrdersAtMorning(state);
    for (const description of orderEvents) {
      nightEvents.push(description);
      event(state, "order", description);
    }
    state.phase = "DAY_WORK";
    state.pendingEndDay = null;
    state.dayCondenseUsed = 0;
    state.lastNightReport = { fromDay, toDay: state.day, fromUH, toUH: state.worldUH, ledger, plots, events: nightEvents };
    event(state, "morning", `次晨第 ${state.day} 天，凝聚额度已恢复。`);
    return notice(state, "success", `第 ${fromDay} 天结算完成：经过 ${U2_CONFIG.nightUH}uh，今日凝聚额度已重置。`);
  }
  if (!work(previous)) return previous;
  const state = structuredClone(previous);
  switch (command.type) {
    case "UNLOCK_PLOT": {
      const result = unlockPlot(state, command.plotId);
      if (!result.ok) return notice(state, "locked", result.reason);
      event(state, "unlock", `${command.plotId} 已开垦，花费 ${result.cost} 仙力`);
      state.selectedPlotId = command.plotId;
      return notice(state, "success", `已开垦 ${command.plotId}，花费 ${result.cost} 仙力。`);
    }
    case "ACCEPT_ORDER": {
      const result = acceptOrder(state, command.orderId);
      if (!result.ok) return notice(state, "locked", result.reason);
      event(state, "order", result.message);
      return notice(state, "success", result.message);
    }
    case "DELIVER_ORDER": {
      const result = deliverOrder(state, command.orderId, command.itemIds);
      if (!result.ok) return notice(state, "locked", result.reason);
      event(state, "order", `${command.orderId}: ${result.itemIds.join(",")}；${result.message}`);
      return notice(state, "success", result.message);
    }
    case "PLANT_SEED": {
      const p = validPlot(state, command.plotId);
      const seed = Object.hasOwn(state.items, command.itemId) ? state.items[command.itemId] : null;
      if (!seed || seed.kind !== "Seed" || seed.location.kind !== "inventory") return notice(state, "locked", "种子已不存在，无法再次播种。");
      if (!p || !p.open) return notice(state, "locked", "此地格未开垦，种子未消耗。");
      if (p.plant) {
        const old = p.plant;
        // A cycle can be restarted only after a real harvest; never destroy attached fruit.
        const harvested = state.harvestedSources.some(key =>
          key.startsWith(`${p.id}/${old.id}/`));
        if (!harvested || old.leaves.some(leaf => leaf.fruit !== null))
          return notice(state, "locked", "此格仍在生长或有未采果实，不能更换植株。");
        event(state, "recycle", `清理已采收植株 ${old.id}，在 ${p.id} 开启下一轮种植`);
      }
      const tree = newTree(`plant:${state.nextObjectSeq++}`);
      p.plant = tree;
      delete state.items[seed.id];
      state.selectedPlotId = p.id;
      event(state, "plant", `种植 ${tree.id} 到 ${p.id}，消耗 ${seed.id}`);
      return notice(state, "success", `已在 ${p.id} 播下水瓜种子，开始凝聚元素并浇灌。`);
    }
    case "HARVEST": {
      const p = validPlot(state, command.plotId);
      if (!p?.open || p.plant?.id !== command.plantId) {
        return notice(state, "locked", "地格或植株身份已失效，未采摘。");
      }
      const leaf = p.plant.leaves.find(l => l.id === command.leafId);
      if (!leaf?.fruit || leaf.fruit.stage !== "MatureFruit") {
        return notice(state, "locked", "只有成熟且尚未采摘的水瓜可以采收。");
      }
      const fruit = leaf.fruit;
      // The original edible account leaves the tree. Never keep two owners.
      const id = `item:aquamelon:${state.nextObjectSeq++}`;
      const groundCount = Object.values(state.items).filter(
        item => item.location.kind === "ground").length;
      const item: AquamelonItem = {
        id, kind: "Aquamelon",
        location: { kind: "ground", plotId: p.id,
          x: 0.36 + (groundCount % 3) * 0.07, y: 0.69 + (Math.floor(groundCount / 3) % 2) * 0.06 },
        source: { plotId: p.id, plantId: p.plant.id, leafId: leaf.id },
        free: [...fruit.free], baseAffinity: [...fruit.baseAffinity],
        reaction: { ...structuredClone(fruit.reaction), charged: false, burning: false },
        lockedAffinity: fruit.lockedAffinity ? [...fruit.lockedAffinity] : null,
      };
      leaf.fruit = null;
      state.items[id] = item;
      const sourceKey = `${p.id}/${p.plant.id}/${leaf.id}`;
      state.harvestedSources.push(sourceKey);
      // One seed originates from exactly one real mature fruit. This makes every
      // subsequent cycle possible even if the corresponding commission expires.
      const seedId = `item:seed:${state.nextObjectSeq++}`;
      state.items[seedId] = { id: seedId, kind: "Seed", location: { kind: "inventory" },
        origin: { ...item.source } };
      state.selectedItemId = id;
      rewardEnergy(state, `harvest:${sourceKey}`, ECONOMY_CANDIDATE.matureHarvest);
      event(state, "harvest", `采摘 ${leaf.id} → ${id} + ${seedId}；${fruitMass(item).toFixed(3)}G`);
      return notice(state, "success",
        `成熟水瓜已采摘（${id}），留种 ${seedId}，获得 ${ECONOMY_CANDIDATE.matureHarvest} 仙力。`);
    }
    case "SELECT_ITEM": {
      const item = Object.hasOwn(state.items, command.itemId) ? state.items[command.itemId] : null;
      if (!item) return notice(state, "locked", "物品不存在。");
      state.selectedItemId = state.selectedItemId === item.id ? null : item.id;
      return notice(state, "info", state.selectedItemId ? `选中 ${item.id}` : "已取消物品选择。");
    }
    case "MOVE_ITEM": {
      const item = Object.hasOwn(state.items, command.itemId) ? state.items[command.itemId] : null;
      if (!item || item.kind === "Seed") return notice(state, "locked", "物品不存在或无法搬运。");
      const dest = command.destination;
      if (dest.kind !== "inventory" && dest.kind !== "storage" && dest.kind !== "ground" &&
          dest.kind !== "workbench")
        return notice(state, "locked", "未知放置位置。");
      if (dest.kind === "workbench") {
        if (dest.slot !== "peel" && dest.slot !== "juice")
          return notice(state, "locked", "未知工作台。");
        if (dest.slot === "peel" ? item.kind !== "Aquamelon" :
          item.kind !== "PeeledFlesh" && item.kind !== "RawJuice")
          return notice(state, "locked", "工作台不接受这种材料。");
        if (Object.values(state.items).some(other => other.id !== item.id &&
            other.location.kind === "workbench" && other.location.slot === dest.slot))
          return notice(state, "locked", "工作台已被占用，材料未移动。");
      }
      if (dest.kind === "ground" && (
        !validPlot(state, dest.plotId)?.open ||
        !Number.isFinite(dest.x) || !Number.isFinite(dest.y) ||
        dest.x < 0 || dest.x > 1 || dest.y < 0 || dest.y > 1
      )) return notice(state, "locked", "地面位置无效或地格尚未开垦。");
      if (JSON.stringify(item.location) === JSON.stringify(dest)) return previous;
      item.location = structuredClone(dest);
      state.selectedItemId = item.id;
      event(state, "move", `移动 ${item.id} → ${dest.kind}`);
      return notice(state, "success", `${item.id} 已移至${dest.kind === "inventory" ? "物品栏" : dest.kind === "storage" ? "仓储" :
        dest.kind === "workbench" ? (dest.slot === "peel" ? "剥壳台" : "榨汁台") : "水晶球地面"}。`);
    }
    case "PROCESS_ITEM": {
      const result = processWorkbench(state, command.itemId, command.action);
      if (!result.ok) return notice(state, "locked", result.reason);
      event(state, "process", `${result.inputId} → ${result.outputIds.join(" + ")}`);
      return notice(state, "success", result.message);
    }
    case "CONDENSE": {
      if (state.dayCondenseUsed >= state.dayCondenseLimit) return notice(state, "locked", "今日凝聚额度已用尽。");
      const element = ELEMENTS[Math.floor(nextRandom(state) * 7)];
      const ball: ElementBall = { id: `ball:${state.nextObjectSeq++}`, element,
        initialV: U2_CONFIG.ballInitialV, createdUH: state.worldUH, slot: state.dayCondenseUsed };
      state.looseBalls[ball.id] = ball;
      state.dayCondenseUsed++;
      event(state, "condense", `凝聚 ${ball.id}：${element}，初始 50V`);
      return notice(state, "success", `元素球已凝聚。请点击水晶球旁的元素球收集。`);
    }
    case "COLLECT_BALL": {
      const ball = Object.hasOwn(state.looseBalls, command.ballId) ? state.looseBalls[command.ballId] : null;
      if (!ball) return previous;
      const amount = ball.initialV * Math.pow(0.5, (state.worldUH - ball.createdUH) / U2_CONFIG.ballHalfLifeUH);
      delete state.looseBalls[ball.id];
      if (amount < 1) return notice(state, "locked", "元素球已消散。未获得养分。");
      state.heldElements[elementIndex(ball.element)] += amount;
      event(state, "collect", `收集 ${ball.id}：${ball.element} ${amount.toFixed(3)}V`);
      return notice(state, "success", `收集了 ${ball.element} 元素球。请选择地格浇灌。`);
    }
    case "WATER_PLOT": {
      const p = validPlot(state, command.plotId);
      if (!p || !p.open) return notice(state, "locked", "不可向锁定或未知地格浇灌。");
      const idx = ELEMENTS.indexOf(command.element);
      if (idx < 0 || state.heldElements[idx] <= 0) return notice(state, "locked", "没有可用的该元素养分。");
      const amount = state.heldElements[idx];
      state.heldElements[idx] = 0;
      p.soil[idx] += amount;
      const total = vectorSum(p.soil);
      let overflow = 0;
      if (total > U2_CONFIG.soilCapacityV) {
        const ratio = U2_CONFIG.soilCapacityV / total;
        overflow = total - U2_CONFIG.soilCapacityV;
        for (let i = 0; i < 7; i++) p.soil[i] *= ratio;
      }
      event(state, "water", `灌注 ${command.element} ${amount.toFixed(3)}V → ${p.id}; soil overflow ${overflow.toFixed(3)}V`);
      return notice(state, "success", `${p.id} 土壤已浇灌 ${command.element}；夜间将按根系规则吸收。`);
    }
    case "REQUEST_END_DAY": {
      state.phase = "DAY_CONFIRM";
      state.pendingEndDay = state.day;
      return notice(state, "info", "确认结束今日？尚未收集的元素球会随世界时间推进而消散。");
    }
  }
}

export function remainingCondenses(state: GameState): number {
  return state.dayCondenseLimit - state.dayCondenseUsed;
}
export function stageLabel(state: GameState, plotId: PlotId): string {
  const plot = state.plots[plotId];
  if (!plot.open) return "锁定";
  if (!plot.plant) return "空地";
  const tree = plot.plant;
  const fruit = tree.leaves.find(l => l.fruit)?.fruit;
  const large = tree.leaves.some(l => l.stage === "LargeLeaf");
  return fruit ? `${tree.stage} · ${fruit.stage}` : tree.leaves.length
    ? `${tree.stage} · ${large ? "肥厚叶" : "小叶"}` : tree.budGrowth ? `${tree.stage} · 芽` : tree.stage;
}