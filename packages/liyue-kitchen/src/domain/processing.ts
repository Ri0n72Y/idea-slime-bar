import type { EdibleItem, EdibleKind, GameState, ShellItem, WorkbenchSlot } from "./game.ts";
import { BALANCE } from "./balance.ts";

export type ProcessAction = "PEEL" | "JUICE" | "CUP";
type Plan = { input: EdibleKind; slot: WorkbenchSlot; output: EdibleKind; title: string };
const PLANS: Record<ProcessAction, Plan> = {
  PEEL: { input: "Aquamelon", slot: "peel", output: "PeeledFlesh", title: "剥壳" },
  JUICE: { input: "PeeledFlesh", slot: "juice", output: "RawJuice", title: "榨汁" },
  CUP: { input: "RawJuice", slot: "juice", output: "AquamelonJuiceCup", title: "装杯" },
};

/**
 * Works on a command-local cloned GameState. Delete the old edible carrier
 * before introducing its replacement, transferring the single material account.
 * No clock advance, reaction recalculation, ingredient duplication or EmptyCup.
 */
export function processWorkbench(state: GameState, itemId: string, action: ProcessAction):
  | { ok: true; inputId: string; outputIds: string[]; message: string }
  | { ok: false; reason: string } {
  const plan = PLANS[action];
  if (!plan) return { ok: false, reason: "未知加工动作。" };
  const item = Object.hasOwn(state.items, itemId) ? state.items[itemId] : null;
  if (!item || item.kind === "Seed" || item.kind === "Shell" ||
      item.kind !== plan.input || item.location.kind !== "workbench" ||
      item.location.slot !== plan.slot)
    return { ok: false, reason: "当前工作台缺少正确的加工材料。" };

  if (action === "CUP" && state.opening && item.batchId) {
    const batch = state.opening.batches[item.batchId];
    if (!batch || item.volumeMl === undefined || item.volumeMl < batch.cupMl)
      return { ok: false, reason: "原汁余量不足一杯。" };
    const id = `item:aquamelonjuicecup:${state.nextObjectSeq++}`;
    const cup: EdibleItem = { ...structuredClone(item), id, kind: "AquamelonJuiceCup",
      parentItemId: item.id, volumeMl: batch.cupMl, location: { kind: "storage" } };
    item.volumeMl -= batch.cupMl;
    if (item.volumeMl === 0) delete state.items[item.id];
    state.items[id] = cup;
    state.selectedItemId = id;
    return { ok: true, inputId: itemId, outputIds: [id],
      message: `装杯完成：${batch.cupMl}ml 成品已入仓储；原汁剩余 ${item.volumeMl}ml。` };
  }
  const edibleId = `item:${plan.output.toLowerCase()}:${state.nextObjectSeq++}`;
  const output: EdibleItem = {
    ...item, id: edibleId, kind: plan.output, parentItemId: item.id,
    // A cup is the finished item. It remains on the machine until the player moves it.
    location: { kind: "workbench", slot: plan.slot },
  };
  if (action === "JUICE" && state.opening) {
    const { fruitJuiceMl, cupMl } = BALANCE.processing;
    output.batchId = output.id;
    output.volumeMl = fruitJuiceMl;
    state.opening.batches[output.id] = { source: { ...item.source }, totalMl: fruitJuiceMl,
      cupMl, delivered: {} };
  }
  delete state.items[item.id];
  state.items[output.id] = output;
  const outputIds = [output.id];
  if (action === "PEEL") {
    const shell: ShellItem = {
      id: `item:shell:${state.nextObjectSeq++}`, kind: "Shell",
      parentItemId: item.id, source: { ...item.source }, location: { kind: "storage" },
      ...(state.opening ? { traits: [...(item.lockedAffinity ?? item.baseAffinity)] } : {}),
    };
    state.items[shell.id] = shell;
    outputIds.push(shell.id);
  }
  state.selectedItemId = output.id;
  return { ok: true, inputId: itemId, outputIds,
    message: action === "JUICE" && output.volumeMl !== undefined ? `榨汁完成：获得 ${output.volumeMl}ml 原汁。` :
      `${plan.title}完成：获得 ${plan.output}${action === "PEEL" ? " 和果壳（已入仓储）" : ""}。` };
}
