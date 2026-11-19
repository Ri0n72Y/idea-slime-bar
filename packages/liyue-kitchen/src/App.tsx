import "./u2.css";
import "./u3.css";
import "./u4.css";
import "./batch-a.css";
import "./batch-b.css";
import "./batch-c.css";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { ELEMENTS, ELEMENT_VIEW, U2_CONFIG } from "./domain/config";
import { gameStore } from "./domain/store";
import { fruitMass, remainingCondenses, stageLabel, type GameItem, type ItemLocation, type PlotId, type WorkbenchSlot } from "./domain/game";
import { CrystalScene, type SceneDropTarget } from "./scene/CrystalScene";
import { ECONOMY_CANDIDATE } from "./domain/economy";
import type { KitchenOrder } from "./domain/orders";
import { visibleDiscoveries, type DiscoveryId } from "./domain/discovery";
import { COLLECT_BAG } from "./domain/technology";
import { VISITOR_ID, visitorChoices, visitorPresent } from "./domain/visitors";
import { growthStageLabel, itemLocationLabel, playerEventText, plotLabel } from "./uiLabels";
import { eligibleOrderItems, itemTitle, nextActionHint, orderItemTitle, orderSelectionWarning } from "./experience";
import "./experience.css";
import { SaveManager } from "./SaveManager";

/** Fixed, authored knowledge graph coordinates; hidden discoveries have no visible node/edge. */
const graphCoordinates: Record<DiscoveryId, { x: number; y: number }> = {
  A00: { x: 24, y: 250 }, A01: { x: 208, y: 40 },
  A02: { x: 208, y: 255 }, A07: { x: 208, y: 468 },
  A03: { x: 391, y: 40 }, A18: { x: 391, y¶»§q«^