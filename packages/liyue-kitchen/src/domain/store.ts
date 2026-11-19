import { applyCommand, newGame, type Command, type GameState } from "./game.ts";
import { loadGame, saveGame, validateSave, SAVE_VERSION } from "./save.ts";
import { createWorldSeed } from "./worldSeed.ts";

type Persistence = { load: () => Promise<GameState | null>; save: (state: GameState) => Promise<void> };

/** One state owner, one serialized IndexedDB writer, one hydration decision. */
export function createGameStore(initialState: GameState = newGame(), options: {
  initialReady?: boolean; persistence?: Persistence; createNew?: () => GameState;
} = {}) {
  let state = initialState;
  let ready = options.initialReady ?? true;
  let saveStatus: "ready" | "saving" | "saved" | "error" = "ready";
  let error = "";
  let bootPromise: Promise<void> | null = null;
  let writes = Promise.resolve();
  let revision = 0;
  let replacing = false;
  const listeners = new Set<() => void>();
  const emit = () => { listeners.forEach(listener => listener()); };
  return {
    getSnapshot: () => state,
    isReady: () => ready,
    getSaveStatus: () => saveStatus,
    getError: () => error,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start: (): Promise<void> => {
      if (bootPromise) return bootPromise;
      if (ready) return Promise.resolve();
      if (!options.persistence) throw new Error("No persistence configured");
      bootPromise = (async () => {
        try {
          c¶»§q«^