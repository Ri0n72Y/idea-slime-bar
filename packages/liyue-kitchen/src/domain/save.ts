import { PLOT_IDS, type GameState } from "./game.ts";

const DB_NAME = "liyue-kitchen";
const STORE_NAME = "game-saves";
const SAVE_KEY = "primary";
export const SAVE_VERSION = 1 as const;

type SaveRecord = { version: number; game: GameState };
const isVector = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length === 7 && v.every(n => typeof n === "number" && Number.isFinite(n) && n >= 0);

/** Reject broken or incompatible saves before they become the unique game state. */
export function validateSave(value: unknown): GameState | null {
  if (typeof value !== "object" || value === null) return null;
  const rec = value as Partial<SaveRecord>;
  if (rec.version !== SAVE_VERSION || !rec.game || rec.game.schemaVersion !== SAVE_VERSION) return null;
  const g = rec.game;
  if (!Number.isSafeInteger(g.day) || g.day < 1 || !Number.isSafeInteger(g.worldUH) || g.worldUH < 0 ||
    !Number.isSafeInteger(g.nextObjectSeq) ||
    !Number.isSafeInteger(g.dayCondenseLimit) || !Number.isSafeInteger(g.dayCondenseUsed) ||
    g.dayCondenseUsed > g.dayCondenseLimit || !Number.isSafeInteger(g.randomState) ||
    !isVector(g.heldElements) || !g.plots || !g.items || !g.looseBalls || !Array.isArray(g.eventLog)) return null;
  if (g.phase !== "DAY_WORK" && g.phase !== "DAY_CONFIRM") return null;
  if (g.phase === "DAY_CONFIRM" && g.pendingEndDay !== g.day) return null;
  if (g.phase === "DAY_WORK" && g.pendingEndDay !== null) return null;
  for (const [i, id] of PLOT_IDS.entries()) {
    const plot = g.plots[id];
    if (!plot || plot.id !== id || plot.open !== (i === 0) || !isVector(plot.soil) ||
      plot.soil.reduce((a, b) => a + b, 0) > 1000 + 1e-6) return null;
    const plant = plot.plant;
    if (plant && (typeof plant.id !== "string" || !isVector(plant.treeGrowth) || !isVector(plant.reserve) ||
      !Array.isArray(plant.leaves) || !isVector(plant.treeBaseAffinity) ||
      plant.leaves.some(l => !isVector(l.growth) || !isVector(l.baseAffinity) ||
        (l.fruit && (!isVector(l.fruit.free) || !isVector(l.fruit.baseAffinity)))))) return null;
  }
  if (Object.values(g.items).some(x => x.kind !== "Seed" || x.location !== "inventory" || !x.id)) return null;
  if (Object.values(g.looseBalls).some(x => !x.id || x.initialV !== 50 ||
    !Number.isInteger(x.createdUH) || x.createdUH > g.worldUH)) return null;
  return structuredClone(g);
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
  if (!game) throw new Error(`存档损坏或版本不受支持（需要版本 ${SAVE_VERSION}）；不会覆盖已有存档`);
  return game;
}
export async function saveGame(game: GameState): Promise<void> {
  const record: SaveRecord = { version: SAVE_VERSION, game: structuredClone(game) };
  await transact<IDBValidKey>("readwrite", store => store.put(record, SAVE_KEY));
}