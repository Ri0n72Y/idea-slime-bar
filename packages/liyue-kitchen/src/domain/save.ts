import { PLOT_IDS, OPENING_SOURCE, OPENING_SEED_ID, OPENING_FRUIT_ID, OPENING_SEED_POSITION, sourceKey, type GameItem, type GameState, type ItemLocation, type SourceIdentity } from "./game.ts";
import { ECONOMY_CANDIDATE, newEnergyAccount } from "./economy.ts";
import { DISCOVERY_NODES, migrateDiscoveryEvidence } from "./discovery.ts";
import { COLLECT_BAG, newLabor, newTechnology } from "./technology.ts";
import { ELEMENTS } from "./config.ts";
import { createOrder, type KitchenOrder } from "./orders.ts";
import { VISITOR_GIFT_EVENT, VISITOR_GIFT_ID, VISITOR_ID, isVisitorOrderId, newVisitor } from "./visitors.ts";

const DB_NAME = "liyue-kitchen";
const STORE_NAME = "game-saves";
const SAVE_KEY = "primary";
export const SAVE_VERSION = 6 as const;

type SaveRecord = { version: number; game: unknown };
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isVector = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length === 7 && v.every(n => typeof n === "number" && Number.isFinite(n) && n >= 0);
const validLocation = (value: unknown): value is ItemLocation => {
  if (!isObject(value)) return false;
  if (value.kind === "inventory" || value.kind === "storage")
    return Object.keys(value).length === 1;
  if (value.kind === "workshop-ground")
    return Object.keys(value).length === 3 && typeof value.x === "number" && typeof value.y === "number" &&
      Number.isFinite(value.x) && Number.isFinite(value.y) && value.x === OPENING_SEED_POSITION.x && value.y === OPENING_SEED_POSITION.y;
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
  if (value.kind === "Seed") return (loc.kind === "inventory" || loc.kind === "ground" || loc.kind === "workshop-ground") &&
    (!Object.hasOwn(value, "origin") || validSource(value.origin)) &&
    (!Object.hasOwn(value, "affinity") || isVector(value.affinity));
  if (loc.kind === "workshop-ground") return false;
  if (value.kind === "VisitorGift") return loc.kind !== "workbench" &&
    id === VISITOR_GIFT_ID && value.visitorId === VISITOR_ID &&
    value.eventId === VISITOR_GIFT_EVENT && value.title === "旅人木牌";
  if (!validSource(value.source)) return false;
  if (value.kind === "Shell")
    return loc.kind !== "workbench" && typeof value.parentItemId === "string" &&
      value.parentItemId.length > 0 && !Object.hasOwn(value, "free") &&
      !Object.hasOwn(value, "reaction") && !Object.hasOwn(value, "baseAffinity") &&
      (!Object.hasOwn(value, "traits") || isVector(value.traits));
  if (!["Aquamelon", "PeeledFlesh", "RawJuice", "AquamelonJuiceCup"].includes(String(value.kind)) ||
      !isVector(value.free) || !isVector(value.baseAffinity) || !validReaction(value.reaction) ||
      !(value.lockedAffinity === null || isVector(value.lockedAffinity))) return false;
  if (Object.hasOwn(value, "batchId") || Object.hasOwn(value, "volumeMl")) {
    if ((value.kind !== "RawJuice" && value.kind !== "AquamelonJuiceCup") ||
        typeof value.batchId !== "string" || !value.batchId ||
        !Number.isSafeInteger(value.volumeMl) || (value.volumeMl as number) <= 0) return false;
  }
  if (value.kind !== "Aquamelon" &&
      (typeof value.parentItemId !== "string" || value.parentItemId.length === 0)) return false;
  if (loc.kind === "workbench" && (
    (loc.slot === "peel" && value.kind !== "Aquamelon" && value.kind !== "PeeledFlesh") ||
    (loc.slot === "juice" && value.kind !== "PeeledFlesh" &&
      value.kind !== "RawJuice" && value.kind !== "AquamelonJuiceCup")
  )) return false;
  return true;
};

/** Validate U2/U3/U4 snapshots and upgrade to U5/U6 without minting resources. */
export function validateSave(value: unknown): GameState | null {
  if (!isObject(value) || (value.version !== 1 && value.version !== 2 && value.version !== 3 && value.version !== 4 && value.version !== 5 && value.version !== SAVE_VERSION) ||
      !isObject(value.game)) return null;
  const legacySeed = value.version === 1;
  const g = structuredClone(value.game);
  if (g.schemaVersion !== value.version || !Number.isSafeInteger(g.day) || (g.day as number) < 1 ||
      !Number.isSafeInteger(g.worldUH) || (g.worldUH as number) < 0 ||
      !Number.isSafeInteger(g.nextObjectSeq) || (g.nextObjectSeq as number) < 2 ||
      !Number.isSafeInteger(g.dayCondenseLimit) || (g.dayCondenseLimit as number) < 0 ||
      !Number.isSafeInteger(g.dayCondenseUsed) || (g.dayCondenseUsed as number) < 0 ||
      (g.dayCondenseUsed as number) > (g.dayCondenseLimit as number) ||
      !Number.isSafeInteger(g.randomState) || (g.randomState as number) < 1 ||
      (g.randomState as number) > 0xffffffff || !isVector(g.heldElements) ||
      !isObject(g.plots) || !isObject(g.items) || !isObject(g.looseBalls) ||
      !Array.isArray(g.eventLog) || (g.phase !== "DAY_WORK" && g.phase !== "DAY_CONFIRM"))
    return null;
  if (g.phase === "DAY_CONFIRM" && g.pendingEndDay !== g.day) return null;
  if (g.phase === "DAY_WORK" && g.pendingEndDay !== null) return null;
  for (const [index, id] of PLOT_IDS.entries()) {
    const plot = g.plots[id];
    if (!isObject(plot) || plot.id !== id || typeof plot.open !== "boolean" || (index === 0 && !plot.open) ||
        (value.version < 4 && plot.open !== (index === 0)) || !isVector(plot.soil) ||
        // Reject impossible numeric floods independent of the CURRENT tuning.
        // A prior valid save may exceed a newly lowered soilCapacityV.
        plot.soil.reduce((a, b) => a + b, 0) > 1e10) return null;
    if (!plot.open && plot.plant !== null) return null;
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
  if (value.version < 4) {
    // Existing U4 items have a real harvested source and must survive future replanting.
    const archived = new Set<string>();
    for (const item of Object.values(g.items)) if (isObject(item) && isObject(item.source)) {
      const src = item.source;
      if (!validSource(src)) return null;
      const plot = g.plots[src.plotId as string];
      if (!isObject(plot) || !isObject(plot.plant) || plot.plant.id !== src.plantId ||
          !Array.isArray(plot.plant.leaves) ||
          !plot.plant.leaves.some(l => isObject(l) && l.id === src.leafId && l.fruit === null))
        return null;
      archived.add(`${src.plotId}/${src.plantId}/${src.leafId}`);
    }
    g.harvestedSources = [...archived];
    g.adeptalEnergy = newEnergyAccount();
    g.orders = { "order:first": createOrder("order:first", g.day as number, "aquamelon", true) };
  }
  if (value.version < 5) {
    g.discoveries = {};
    g.technology = newTechnology();
    g.labor = newLabor();
    // Prior games already performed real actions. Recover available evidence
    // from the retained event journal; never invent missing labor.
    const recorded = new Set<string>();
    for (const e of g.eventLog) if (isObject(e) && e.kind === "collect") {
      const found = typeof e.message === "string" ? e.message.match(/(ball:\d+)/) : null;
      if (found && !recorded.has(found[1]) && recorded.size < COLLECT_BAG.manualRequired)
        recorded.add(found[1]);
    }
    (g.labor as ReturnType<typeof newLabor>).manualBallIds = [...recorded];
    const elements = new Set<string>();
    for (const e of g.eventLog) if (isObject(e) && e.kind === "water" && typeof e.message === "string") {
      const el = e.message.match(/^灌注 (Fire|Hydro|Anemo|Electro|Dendro|Cryo|Geo) /)?.[1];
      if (el) elements.add(el);
    }
    (g.labor as ReturnType<typeof newLabor>).wateredElements = [...elements] as ReturnType<typeof newLabor>["wateredElements"];
    migrateDiscoveryEvidence(g as GameState);
  }
  if (value.version < SAVE_VERSION) g.visitor = newVisitor();
  g.schemaVersion = SAVE_VERSION;
  if (!isObject(g.discoveries) || !isObject(g.technology) || !isObject(g.labor) ||
      !Array.isArray(g.labor.manualBallIds) || !Array.isArray(g.labor.wateredElements))
    return null;
  const nodeDefs = new Map(DISCOVERY_NODES.map(n => [n.id, n]));
  for (const [id, record] of Object.entries(g.discoveries)) {
    if (!nodeDefs.has(id as never) || !isObject(record) || record.id !== id ||
        !Number.isSafeInteger(record.completedAtDay) ||
        (record.completedAtDay as number) < 1 || (record.completedAtDay as number) > (g.day as number) ||
        typeof record.eventId !== "string" || !record.eventId ||
        typeof record.sourceId !== "string" || !record.sourceId) return null;
  }
  const manual = g.labor.manualBallIds;
  const elements = g.labor.wateredElements;
  if (manual.length > 100 ||
      manual.some(id => typeof id !== "string" || !/^ball:\d+$/.test(id)) ||
      new Set(manual).size !== manual.length ||
      elements.some(el => !ELEMENTS.includes(el as never)) ||
      new Set(elements).size !== elements.length ||
      !Object.hasOwn(g.technology, "collectBag")) return null;
  const bag = g.technology.collectBag;
  if (bag !== null && (!isObject(bag) || !Number.isSafeInteger(bag.unlockedAtDay) ||
      (bag.unlockedAtDay as number) < 1 || (bag.unlockedAtDay as number) > (g.day as number) ||
      !Array.isArray(bag.evidenceIds) || (bag.evidenceIds as unknown[]).length < 1 ||
      (bag.evidenceIds as unknown[]).length > manual.length ||
      !(bag.evidenceIds as string[]).every(id => manual.includes(id)) ||
      !Object.hasOwn(g.discoveries, "A18"))) return null;
  if (!isObject(g.visitor) || g.visitor.id !== VISITOR_ID ||
      !Array.isArray(g.visitor.issuedOrderIds) ||
      typeof g.visitor.lastLine !== "string" || g.visitor.lastLine.length > 500 ||
      g.visitor.issuedOrderIds.some(id => typeof id !== "string" || !isVisitorOrderId(id)) ||
      new Set(g.visitor.issuedOrderIds).size !== g.visitor.issuedOrderIds.length)
    return null;
  const v = g.visitor;
  const issued = v.issuedOrderIds as string[];
  for (const field of ["metAtDay", "clueAtDay", "giftAtDay", "thankedAtDay"]) {
    const day = v[field];
    if (day !== null && (!Number.isSafeInteger(day) || (day as number) < 1 || (day as number) > (g.day as number)))
      return null;
  }
  if ((v.clueAtDay !== null && v.metAtDay === null) ||
      (v.giftAtDay !== null && v.clueAtDay === null) ||
      (issued.length > 0 && v.clueAtDay === null) ||
      (v.thankedAtDay !== null && (v.clueAtDay === null || !issued.length)) ||
      (v.clueAtDay !== null && (v.clueAtDay as number) < (v.metAtDay as number)) ||
      (v.giftAtDay !== null && (v.giftAtDay as number) < (v.clueAtDay as number)) ||
      (v.thankedAtDay !== null && (v.thankedAtDay as number) < (v.clueAtDay as number))) return null;
  if ((v.giftAtDay !== null) !== Object.hasOwn(g.items, VISITOR_GIFT_ID) ||
      (v.clueAtDay !== null) !== Object.hasOwn(g.discoveries, "V01") ||
      (v.thankedAtDay !== null) !== Object.hasOwn(g.discoveries, "V02")) return null;
  if (!isObject(g.adeptalEnergy) || !isObject(g.orders) ||
      !Array.isArray(g.harvestedSources)) return null;
  const a = g.adeptalEnergy;
  if (![a.balance, a.earnedTotal, a.spentTotal].every(n =>
        Number.isSafeInteger(n) && (n as number) >= 0) ||
      (a.earnedTotal as number) - (a.spentTotal as number) !== a.balance ||
      !Array.isArray(a.rewardedIds) ||
      a.rewardedIds.some(id => typeof id !== "string" || !id) ||
      new Set(a.rewardedIds).size !== a.rewardedIds.length) return null;
  // Existing v1-v6 saves predate historical receipts; migrate once without
  // changing spentTotal or inferring past purchases from the *current* prices.
  if (!Object.hasOwn(a, "spendLedger")) a.spendLedger = { legacy: a.spentTotal };
  if (!isObject(a.spendLedger)) return null;
  const receipts = Object.entries(a.spendLedger);
  if (receipts.some(([key, amount]) =>
        !(/^plot:P0[2-7]$/.test(key) || key === "tech:collectBag" || key === "legacy") ||
        !Number.isSafeInteger(amount) || (amount as number) < 0) ||
      receipts.reduce((sum, [, amount]) => sum + (amount as number), 0) !== a.spentTotal)
    return null;
  const legacy = Object.hasOwn(a.spendLedger, "legacy");
  for (const id of PLOT_IDS.slice(1)) {
    const paid = Object.hasOwn(a.spendLedger, "plot:" + id);
    if (paid && (!(g.plots as Record<string, {open:boolean}>)[id].open ||
        (a.spendLedger["plot:" + id] as number) < 1)) return null;
  }
  if (Object.hasOwn(a.spendLedger, "tech:collectBag") &&
      (!bag || (a.spendLedger["tech:collectBag"] as number) < 1)) return null;
  if (!legacy) {
    for (const id of PLOT_IDS.slice(1))
      if ((g.plots as Record<string, {open:boolean}>)[id].open &&
          !Object.hasOwn(a.spendLedger, "plot:" + id)) return null;
    if (bag && !Object.hasOwn(a.spendLedger, "tech:collectBag")) return null;
  }
  // Every purchase currently costs at least one unit. The ledger, not today's
  // config, establishes its historical exact cost.
  const actualPurchases = PLOT_IDS.slice(1).filter(id =>
    (g.plots as Record<string, {open:boolean}>)[id].open).length + (bag ? 1 : 0);
  if ((a.spentTotal as number) < actualPurchases) return null;
  if ((v.metAtDay !== null) !== a.rewardedIds.includes("visitor:yan:greet") ||
      (v.clueAtDay !== null) !== a.rewardedIds.includes("visitor:yan:clue") ||
      (v.thankedAtDay !== null) !== a.rewardedIds.includes("visitor:yan:thanks")) return null;
  const sourceKeys = new Set<string>();
  for (const key of g.harvestedSources) {
    if (typeof key !== "string" || !/^P0[1-7]\/[^/]+\/[^/]+$/.test(key) ||
        sourceKeys.has(key)) return null;
    sourceKeys.add(key);
  }
  const orderRecords = g.orders as Record<string, unknown>;
  const usedDeliveryIds = new Set<string>();
  for (const [id, raw] of Object.entries(g.orders)) {
    if (!isObject(raw) || raw.id !== id ||
        (raw.visitorId !== "board" && raw.visitorId !== VISITOR_ID) ||
        (raw.visitorId === VISITOR_ID) !== issued.includes(id) ||
        (raw.itemKind !== "aquamelon" && raw.itemKind !== "juice_cup") ||
        !Number.isSafeInteger(raw.postedDay) || (raw.postedDay as number) < 1 ||
        !Number.isSafeInteger(raw.dueDay) || (raw.dueDay as number) < (raw.postedDay as number) ||
        !Number.isSafeInteger(raw.rewards) || (raw.rewards as number) <= 0 ||
        !Number.isSafeInteger(raw.quantity) || (raw.quantity as number) < 1 ||
        !["available", "accepted", "completed", "expired"].includes(String(raw.state)) ||
        !Array.isArray(raw.deliveredItemIds) ||
        raw.deliveredItemIds.some(x => typeof x !== "string" || !x) ||
        (raw.acceptedDay !== null && (!Number.isSafeInteger(raw.acceptedDay) ||
           (raw.acceptedDay as number) < (raw.postedDay as number) ||
           (raw.acceptedDay as number) > (raw.dueDay as number)))) return null;
    const delivered = raw.deliveredItemIds as string[];
    if ((raw.state === "completed") !== (delivered.length === raw.quantity) ||
        (raw.state === "completed") !== a.rewardedIds.includes(`order:${id}`) ||
        (raw.state === "accepted" && raw.acceptedDay === null) ||
        (raw.state === "available" && raw.acceptedDay !== null) ||
        (raw.state === "expired" && (raw.dueDay as number) >= (g.day as number)) ||
        delivered.some(id => Object.hasOwn(g.items as Record<string, unknown>, id) || usedDeliveryIds.has(id))) return null;
    for (const deliveredId of delivered) usedDeliveryIds.add(deliveredId);
  }
  if (issued.some(id => !Object.hasOwn(orderRecords, id) ||
        (orderRecords[id] as KitchenOrder).visitorId !== VISITOR_ID ||
        (orderRecords[id] as KitchenOrder).postedDay < (v.clueAtDay as number)) ||
      issued.filter(id => {
        const state = (orderRecords[id] as KitchenOrder).state;
        return state === "available" || state === "accepted";
      }).length > 1 ||
      (v.thankedAtDay !== null && !issued.some(id =>
        (orderRecords[id] as KitchenOrder).state === "completed"))) return null;
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
      !ELEMENTS.includes(ball.element as never) ||
      typeof ball.initialV !== "number" || !Number.isFinite(ball.initialV) ||
      ball.initialV <= 0 || ball.initialV > 1e10 ||
      !Number.isSafeInteger(ball.slot) || (ball.slot as number) < 0 ||
      !Number.isInteger(ball.createdUH) || (ball.createdUH as number) < 0 ||
      (ball.createdUH as number) > (g.worldUH as number))) return null;

  // A harvested source can persist after its tree is replaced, but its
  // material and seed IDs remain unique and traceable in the archived ledger.
  const edibleSources = new Set<string>(), shellSources = new Set<string>();
  const opening = g.opening;
  const batches = g.juiceBatches;
  const initialKey = sourceKey(OPENING_SOURCE);
  const sameVector = (a: unknown, b: unknown) => isVector(a) && isVector(b) &&
    a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  if (opening !== undefined) {
    if (!isObject(opening) || !isVector(opening.affinity) ||
        Math.abs(opening.affinity.reduce((a,b)=>a+b,0) - ELEMENTS.length) > 1e-7 ||
        !(opening.plantedPlantId === null || typeof opening.plantedPlantId === "string") ||
        !(opening.firstCupOrderId === null || typeof opening.firstCupOrderId === "string") ||
        !isObject(batches)) return null;
    const seed = g.items[OPENING_SEED_ID];
    if (opening.plantedPlantId === null) {
      if (!isObject(seed) || seed.kind !== "Seed" || !sameVector(seed.affinity, opening.affinity) ||
          !isObject(seed.location) || (seed.location.kind !== "workshop-ground" && seed.location.kind !== "ground")) return null;
    } else if (seed !== undefined || !Object.values(g.plots).some(p =>
        isObject(p) && isObject(p.plant) && p.plant.id === opening.plantedPlantId) &&
        !g.harvestedSources.some(k => typeof k === "string" && k.split("/")[1] === opening.plantedPlantId)) return null;
  }
  if (batches !== undefined) {
    if (!isObject(batches)) return null;
    const batchSources = new Set<string>(), deliveredBatchIds = new Set<string>();
    let firstCupProven = !isObject(opening) || opening.firstCupOrderId === null;
    for (const [batchId, batch] of Object.entries(batches)) {
      if (!isObject(batch) || !validSource(batch.source) || !isVector(batch.traits) || !Number.isSafeInteger(batch.totalMl) ||
          !Number.isSafeInteger(batch.cupMl) || (batch.cupMl as number) <= 0 ||
          (batch.totalMl as number) < (batch.cupMl as number) ||
          (batch.totalMl as number) > 1e7 || (batch.totalMl as number) % (batch.cupMl as number) !== 0 ||
          !isObject(batch.delivered)) return null;
      const key = sourceKey(batch.source as SourceIdentity);
      if (batchSources.has(key) || (!sourceKeys.has(key) && !(key === initialKey && isObject(opening))) ||
          (key === initialKey && isObject(opening) && !sameVector(batch.traits, opening.affinity))) return null;
      batchSources.add(key);
      let ml = 0, raws = 0;
      for (const item of Object.values(g.items)) {
        if (!isObject(item) || item.batchId !== batchId) continue;
        if (!validSource(item.source) || sourceKey(item.source as SourceIdentity) !== key ||
            !sameVector(item.lockedAffinity ?? item.baseAffinity, batch.traits) ||
            !Number.isSafeInteger(item.volumeMl) || (item.volumeMl as number) <= 0) return null;
        if (item.kind === "RawJuice") {
          if (++raws > 1 || item.id !== batchId || (item.volumeMl as number) % (batch.cupMl as number) !== 0) return null;
        } else if (item.kind !== "AquamelonJuiceCup" || item.volumeMl !== batch.cupMl) return null;
        ml += item.volumeMl as number;
      }
      for (const [id, amount] of Object.entries(batch.delivered)) {
        if (amount !== batch.cupMl || !usedDeliveryIds.has(id) || deliveredBatchIds.has(id)) return null;
        deliveredBatchIds.add(id);
        const order = Object.values(orderRecords).find(o => isObject(o) && Array.isArray(o.deliveredItemIds) && o.deliveredItemIds.includes(id));
        if (!isObject(order) || order.itemKind !== "juice_cup") return null;
        if (key === initialKey && isObject(opening) && order.id === opening.firstCupOrderId && order.visitorId === "board") firstCupProven = true;
        ml += amount as number;
      }
      if (ml !== batch.totalMl) return null;
    }
    if (!firstCupProven) return null;
  }
  if (isObject(opening) && isObject(batches) && !usedDeliveryIds.has(OPENING_FRUIT_ID) &&
      !Object.values(g.items).some(item => isObject(item) && item.kind !== "Shell" && validSource(item.source) &&
        sourceKey(item.source as SourceIdentity) === initialKey) &&
      !Object.values(batches).some(batch => isObject(batch) && validSource(batch.source) &&
        sourceKey(batch.source as SourceIdentity) === initialKey)) return null;
  const originSeeds = new Set<string>(), occupiedSlots = new Set<string>();
  for (const item of Object.values(g.items)) {
    if (!isObject(item)) return null;
    if (item.kind === "VisitorGift") continue;
    if (item.kind === "Seed") {
      if (isObject(item.location) && item.location.kind === "workshop-ground" &&
          (opening === undefined || item.id !== OPENING_SEED_ID)) return null;
      if (Object.hasOwn(item, "origin")) {
        const src = item.origin as { plotId: string; plantId: string; leafId: string };
        const key = `${src.plotId}/${src.plantId}/${src.leafId}`;
        if (!sourceKeys.has(key) || originSeeds.has(key)) return null;
        originSeeds.add(key);
      }
      continue;
    }
    const source = item.source as { plotId: string; plantId: string; leafId: string };
    const key = `${source.plotId}/${source.plantId}/${source.leafId}`;
    if (!sourceKeys.has(key) && !(opening !== undefined && key === initialKey)) return null;
    const sourceSet = item.kind === "Shell" ? shellSources : edibleSources;
    if (typeof item.batchId === "string") {
      if (!isObject(batches) || !Object.hasOwn(batches, item.batchId)) return null;
    } else {
      if (sourceSet.has(key)) return null;
      sourceSet.add(key);
      if (isObject(batches) && item.kind !== "Shell" &&
          Object.values(batches).some(b => isObject(b) && validSource(b.source) &&
            sourceKey(b.source as SourceIdentity) === key)) return null;
    }
    if (key === initialKey && isObject(opening) &&
        !sameVector(item.kind === "Shell" ? item.traits : item.baseAffinity, opening.affinity)) return null;
    const loc = item.location;
    if (isObject(loc) && loc.kind === "workbench") {
      if (occupiedSlots.has(String(loc.slot))) return null;
      occupiedSlots.add(String(loc.slot));
    }
    const plot = plotsById[source.plotId];
    if (!isObject(plot) || plot.open !== true) return null;
    const tree = plot.plant;
    if (isObject(tree) && tree.id === source.plantId && Array.isArray(tree.leaves)) {
      const leaf = tree.leaves.find(l => isObject(l) && l.id === source.leafId);
      if (!isObject(leaf) || leaf.fruit !== null) return null;
    }
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
/** Share the exact IndexedDB save envelope with downloadable backups. */
export function saveEnvelope(game: GameState): SaveRecord {
  return { version: SAVE_VERSION, game: structuredClone(game) };
}
export async function saveGame(game: GameState): Promise<void> {
  const record = saveEnvelope(game);
  await transact<IDBValidKey>("readwrite", store => store.put(record, SAVE_KEY));
}
