import { applyCommand, newGame, newOpeningGame, type Command, type GameState } from "./game.ts";
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
          const loaded = await options.persistence!.load();
          if (loaded) state = loaded;
          if (!loaded) {
            state = options.createNew?.() ?? state;
            saveStatus = "saving"; emit();
            // Never expose a writable new game until its initial snapshot is
            // committed. Initialization and all later revisions use the SAME
            // write queue; a slow initial save cannot overwrite player actions.
            const initialSnapshot = structuredClone(state);
            writes = writes.then(() => options.persistence!.save(initialSnapshot));
            await writes;
          }
          saveStatus = "saved";
          ready = true; emit();
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
      if (!ready || replacing) return;
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
    /** Switch worlds only after the single IndexedDB writer commits.
     * On failure, both the live world and previous persisted save remain intact.
     * Dispatch is suspended during the switch to prevent stale queued writes.
     */
    replaceGame: async (candidate: GameState): Promise<void> => {
      if (!ready || replacing) throw new Error("存档正在处理，请稍后再试");
      const validated = validateSave({ version: SAVE_VERSION, game: candidate });
      if (!validated) throw new Error("新存档未通过校验");
      replacing = true;
      saveStatus = "saving"; error = ""; emit();
      const snapshot = structuredClone(validated);
      const task = writes.catch(() => {}).then(async () => {
        if (options.persistence) await options.persistence.save(snapshot);
      });
      writes = task;
      try {
        await task;
        state = validated;
        revision++;
        saveStatus = "saved";
        emit();
      } catch (cause) {
        saveStatus = "error";
        error = `存档切换失败：${String(cause)}`;
        emit();
        throw cause;
      } finally {
        replacing = false;
      }
    },
    whenSaved: (): Promise<void> => writes,
  };
}

export const gameStore = createGameStore(newOpeningGame(), {
  createNew: () => newOpeningGame(createWorldSeed()),
  initialReady: false,
  persistence: { load: loadGame, save: saveGame },
});