import { PLOT_IDS, type GameItem, type GameState, type ItemLocation } from "./game.ts";
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
  if (value.kind === "workbench")
    return Object.keys(value).length === 2 && (value.slot === "peel" || value.slot === "juice");
  return value.kind === "ground" && PLOT_IDS.includes(value.plotId as never) &&
    typeof value.x === "number" && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1¶»§q«^