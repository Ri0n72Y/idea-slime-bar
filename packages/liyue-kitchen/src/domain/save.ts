import { PLOT_IDS, type GameItem, type GameState, type ItemLocation } from "./game.ts";

const DB_NAME = "liyue-kitchen";
const STORE_NAME = "game-saves";
const SAVE_KEY = "primary";
export const SAVE_VERSION = 3 as const;

type SaveRecord = { version: number; game: unknown };
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isVector = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length === 7 && v.every(n => typeof n === "number" && Number.isFinite(n) && n >= 0);
const validLocation = (value: unknown): value is ItemLocation => {
  if (!isObject(value)) return false;
  if (value.kind === "inventory" || value.kind === "storage")
    return Object.keys(value).length === 1;
  if (value.kind === "workbench")
    return Object.keys(value).length === 2 && (value.slot === "peel" || value.slot === "juice");
  return value.kind === "ground" && PLOT_IDS.includes(value.plotId as never) &&
    typeof value.x === "number" && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1 &&
    typeof value.y === "number" && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1;
};
const validReaction = (value: unknown): boolean => {
  if (!isObject(value) || !isObject(value.products)) return false;
  return (value.firstReaction === null || typeof value.firstReaction === "string") &&
    typeof value.charged === "boolean" && typeof value.burning === "boolean" &&
    Object.values(value.products).every(n => typeof n === "number" && Number.isFinite(n) && n >= 0);
};
const validSource = (value: unknown): boolean =>
  isObject(value) && PLOT_IDS.includes(value.plotId as never) &&
  typeof value.plantId === "string" && value.plantId.length > 0 &&
  typeof value.leafId === "string" && value.leafId.length > 0;

const validItem = (id: string, value: unknown): value is GameItem => {
  if (!isObject(value) || value.id !== id || !validLocation(value.location)) return false;
  const loc = value.location;
  if (value.kind === "Seed") return loc.kind === "inventory";
  if (!validSource(value.source)) return false;
  if (value.kind === "Shell")
    return loc.kind !== "workbench" && typeof value.parentItemId === "string" &&
      value.parentItemId.length > 0 && !Object.hasOwn(value, "free") &&
      !Object.hasOwn(value, "reaction") && !Object.hasOwn(value, "baseAffinity");
  if (!["Aquamelon", "PeeledFlesh", "RawJuice", "AquamelonJuiceCup"].includes(String(value.kind)) ||
      !isVector(value.free) || !isVector(value.baseAffinity) || !validReaction(value.reaction) ||
      !(value.lockedAffinity === null || isVector(value.lockedAffinity))) return false;
  if (value.kind !== "Aquamelon" &&
      (typeof value.parentItemId !== "string" || value.parentItemId.length === 0)) return false;
  if (loc.kind === "workbench" && (
    (loc.slot === "peel" && value.kind !== "Aquamelon" && value.kind !== "PeeledFlesh") ||
    (loc.slot === "juice" && value.kind !== "PeeledFlesh" &&
      value.kind !== "RawJuice" && value.kind !== "AquamelonJuiceCup")
  )) return false;
  return true;
};

/** Validate and migrate U2 (v1) / U3 (v2) to the current U4 material schema. */
export function validateSave(value: unknown): GameState | null {
  if (!isObject(value) || (value.version !== 1 && value.version !== 2 && value.version !== SAVE_VERSION) ||
      !isObject(value.game)) return null;
  const legacySeed = value.version === 1;
  const g = structuredClone(value.game);
  if (g.schemaVersion !== value.version || !Number.isSafeInteger(g.day) || (g.day as number) < 1 ||
      !Number.isSafeInteger(g.worldUH) || (g.worldUH as number) < 0 ||
      !Number.isSafeInteger(g.nextObjectSeq) || (g.nextObjectSeq as number) < 2 ||
      !Number.isSafeInteger(g.dayCondenseLimit) || !Number.isSafeInteger(g.dayCondenseUsed) ||
      (g.dayCondenseUsed as number) > (g.dayCondenseLimit as number) ||
      !Number.isSafeInteger(g.randomState) || !isVector(g.heldElements) ||
      !isObject(g.plots) || !isObject(g.items) || !isObject(g.looseBalls) ||
      !Array.isArray(g.eventLog) || (g.phase !== "DAY_WORK" && g.phase !== "DAY_CONFIRM"))
    return null;
  if (g.phase === "DAY_CONFIRM" && g.pendingEndDay !== g.day) return null;
  if (g.phase === "DAY_WORK" && g.pendingEndDay !== null) return null;
  for (const [index, id] of PLOT_IDS.entries()) {
    const plot = g.plots[id];
    if (!isObject(plot) || plot.id !== id || plot.open !== (index === 0) || !isVector(plot.soil) ||
        plot.soil.reduce((a, b) => a + b, 0) > 1000 + 1e-6) return null;
    if (plot.plant !== null) {
      const tree = plot.plant;
      if (!isObject(tree) || typeof tree.id !== "string" || !isVector(tree.treeGrowth) ||
          !isVector(tree.reserve) || !Array.isArray(tree.leaves) || !isVector(tree.treeBaseAffinity))
        return null;
      for (const leaf of tree.leaves) {
        if (!isObject(leaf) || typeof leaf.id !== "string" || !isVector(leaf.growth) ||
            !isVector(leaf.baseAffinity)) return null;
        if (leaf.fruit !== null) {
          const fruit = leaf.fruit;
          if (!isObject(fruit) || !isVector(fruit.free) || !isVector(fruit.baseAffinity) ||
              !isVector(fruit.stageStart) || !validReaction(fruit.reaction) ||
              !(fruit.lockedAffinity === null || isVector(fruit.lockedAffinity))) return null;
        }
      }
    }
  }
  if (legacySeed) {
    for (const [id, item] of Object.entries(g.items)) {
      if (!isObject(item) || item.id !== id || item.kind !== "Seed" ||
          item.location !== "inventory") return null;
      item.location = { kind: "inventory" };
    }
    g.selectedItemId = null;
  }
  g.schemaVersion = SAVE_VERSION;
  if (Object.entries(g.items).some(([id, item]) => !validItem(id, item))) return null;
  const plotsById = g.plots as Record<string, unknown>;
  if (Object.values(g.items).some(item => isObject(item) && isObject(item.location) &&
      item.location.kind === "ground" &&
      (!isObject(plotsById[item.location.plotId as string]) ||
        (plotsById[item.location.plotId as string] as Record<string, unknown>).open !== true)))
    return null;
  if (g.selectedItemId !== null &&
      (typeof g.selectedItemId !== "string" || !Object.hasOwn(g.items, g.selectedItemId))) return null;
  if (Object.values(g.looseBalls).some(ball => !isObject(ball) || !ball.id ||
      ball.initialV !== 50 || !Number.isInteger(ball.createdUH) ||
      (ball.createdUH as number) > (g.worldUH as number))) return null;

  // Each source may own at most one edible material and one zero-G shell.
  const edibleSources = new Set<string>(), shellSources = new Set<string>();
  const occupiedSlots = new Set<string>();
  for (const item of Object.values(g.items)) {
    if (!isObject(item) || item.kind === "Seed") continue;
    const source = item.source as { plotId: string; plantId: string; leafId: string };
    const key = `${source.plotId}/${source.plantId}/${source.leafId}`;
    const sources = item.kind === "Shell" ? shellSources : edibleSources;
    if (sources.has(key)) return null;
    sources.add(key);
    const loc = item.location;
    if (isObject(loc) && loc.kind === "workbench") {
      if (occupiedSlots.has(String(loc.slot))) return null;
      occupiedSlots.add(String(loc.slot));
    }
    const plot = plotsById[source.plotId];
    if (!isObject(plot) || plot.open !== true) return null;
    const tree = plot.plant;
    if (!isObject(tree) || tree.id !== source.plantId || !Array.isArray(tree.leaves)) return null;
    const leaf = tree.leaves.find(l => isObject(l) && l.id === source.leafId);
    if (!isObject(leaf) || leaf.fruit !== null) return null;
  }
  for (const item of Object.values(g.items)) {
    if (!isObject(item) || item.kind !== "Shell") continue;
    const src = item.source as { plotId: string; plantId: string; leafId: string };
    const key = `${src.plotId}/${src.plantId}/${src.leafId}`;
    if (Object.values(g.items).some(other => isObject(other) && other.kind === "Aquamelon" &&
      isObject(other.source) && `${other.source.plotId}/${other.source.plantId}/${other.source.leafId}` === key))
      return null;
  }
  return g as GameState;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, SAVE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
  });
}
async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      let result: T;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
export async function loadGame(): Promise<GameState | null> {
  const record = await transact<SaveRecord | undefined>("readonly", store => store.get(SAVE_KEY));
  if (record === undefined) return null;
  const game = validateSave(record);
  if (!game) throw new Error("存档损坏或版本不受支持；不会覆盖已有存档");
  if (record.version !== SAVE_VERSION) await saveGame(game);
  return game;
}
export async function saveGame(game: GameState): Promise<void> {
  const record: SaveRecord = { version: SAVE_VERSION, game: structuredClone(game) };
  await transact<IDBValidKey>("readwrite", store => store.put(record, SAVE_KEY));
}
