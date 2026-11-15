import type { EdibleItem, EdibleKind, GameState, ShellItem, WorkbenchSlot } from "./game.ts";

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

  const edibleId = `item:${plan.output.toLowerCase()}:${state.nextObjectSeq++}`;
  const output: EdibleItem = {
    ...item, id: edibleId, kind: plan.output, parentItemId: item.id,
    // A cup is the finished item. It remains on the machine until the player moves it.
    location: { kind: "workbench", slot: plan.slot },
  };
  delete state.items[item.id];
  state.items[output.id] = output;
  const outputIds = [output.id];
  if (action === "PEEL") {
    const shell: ShellItem = {
      id: `item:shell:${state.nextObjectSeq++}`, kind: "Shell",
      parentItemId: item.id, source: { ...item.source }, location: { kind: "storage" },
    };
    state.items[shell.id] = shell;
    outputIds.push(shell.id);
  }
  state.selectedItemId = output.id;
  return { ok: true, inputId: itemId, outputIds,
    message: `${plan.title}完成：获得 ${plan.output}${action === "PEEL" ? " 和果壳（已入仓储）" : ""}。` };
}
