import { applyCommand, newGame, type Command, type GameState } from "./game.ts";
import { loadGame, saveGame } from "./save.ts";

type Persistence = { load: () => Promise<GameState | null>; save: (state: GameState) => Promise<void> };

/** One state owner, one serialized IndexedDB writer, one hydration decision. */
export function createGameStore(initialState: GameState = newGame(), options: {
  initialReady?: boolean; persistence?: Persistence;
} = {}) {
  let state = initialState;
  let ready = options.initialReady ?? true;
  let saveStatus: "ready" | "saving" | "saved" | "error" = "ready";
  let error = "";
  let bootPromise: Promise<void> | null = null;
  let writes = Promise.resolve();
  let revision = 0;
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
          const loaded = await options.persistence!.load();
          if (loaded) state = loaded;
          ready = true; emit();
          if (!loaded) {
            saveStatus = "saving"; emit();
            await options.persistence!.save(state);
            saveStatus = "saved"; emit();
          } else { saveStatus = "saved"; emit(); }
        } catch (cause) {
          error = `存档读取失败：${String(cause)}`;
          saveStatus = "error";
          // Do not initialize/persist a second Seed over an unreadable save.
          ready = false; emit();
          throw cause;
        }
      })();
      return bootPromise;
    },
    dispatch: (command: Command): void => {
      if (!ready) return;
      const next = applyCommand(state, command);
      if (next === state) return;
      state = next;
      revision++;
      saveStatus = options.persistence ? "saving" : "saved";
      emit();
      if (!options.persistence) return;
      const currentRevision = revision;
      const snapshot = structuredClone(next);
      writes = writes.catch(() => {}).then(async () => {
        await options.persistence!.save(snapshot);
        if (revision === currentRevision) { saveStatus = "saved"; emit(); }
      }).catch(cause => {
        if (revision === currentRevision) {
          error = `存档写入失败：${String(cause)}`;
          saveStatus = "error"; emit();
        }
      });
    },
    whenSaved: (): Promise<void> => writes,
  };
}

export const gameStore = createGameStore(newGame(), {
  initialReady: false,
  persistence: { load: loadGame, save: saveGame },
});