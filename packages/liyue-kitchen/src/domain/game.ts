/** U2 authoritative world state. No React, PixiJS or browser APIs in this module. */
import { ELEMENTS, U2_CONFIG, elementIndex, vectorSum, zeros, type Element, type Vector } from "./config.ts";
import { advancePlotOneUH, newLedger, newTree, type GardenPlot, type NightLedger, type TreeStage } from "./growth.ts";

export const PLOT_IDS = ["P01", "P02", "P03", "P04", "P05", "P06", "P07"] as const;
export type PlotId = (typeof PLOT_IDS)[number];
export type Plot = GardenPlot & { id: PlotId };
export type Notice = Readonly<{ kind: "info" | "success" | "locked"; message: string }>;
export type GameEvent = { id: string; day: number; worldUH: number; kind: string; message: string };
export type SeedItem = { id: string; kind: "Seed"; location: "inventory" };
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
  schemaVersion: 1;
  day: number;
  worldUH: number;
  phase: "DAY_WORK" | "DAY_CONFIRM";
  pendingEndDay: number | null;
  adeptalEnergy: number;
  plots: Record<PlotId, Plot>;
  selectedPlotId: PlotId | null;
  items: Record<string, SeedItem>;
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
  | { type: "PLANT_SEED"; itemId: string; plotId: PlotId }
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
    schemaVersion: 1, day: 1, worldUH: 0, phase: "DAY_WORK", pendingEndDay: null,
    adeptalEnergy: 0, plots, selectedPlotId: null,
    items: { "item:seed:1": { id: "item:seed:1", kind: "Seed", location: "inventory" } },
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
    if (!p.open) return notice(state, "locked", `${p.id} 尚未开垦。洞天仙力开垦将在后续阶段开放。`);
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
    case "PLANT_SEED": {
      const p = validPlot(state, command.plotId);
      const seed = Object.hasOwn(state.items, command.itemId) ? state.items[command.itemId] : null;
      if (!seed || seed.kind !== "Seed" || seed.location !== "inventory") return notice(state, "locked", "种子已不存在，无法再次播种。");
      if (!p || !p.open) return notice(state, "locked", "此地格未开垦，种子未消耗。");
      if (p.plant) return notice(state, "locked", "此地格已有植物，种子未消耗。");
      const tree = newTree(`plant:${state.nextObjectSeq++}`);
      p.plant = tree;
      delete state.items[seed.id];
      state.selectedPlotId = p.id;
      event(state, "plant", `种植 ${tree.id} 到 ${p.id}，消耗 ${seed.id}`);
      return notice(state, "success", `已在 ${p.id} 播下水瓜种子，开始凝聚元素并浇灌。`);
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