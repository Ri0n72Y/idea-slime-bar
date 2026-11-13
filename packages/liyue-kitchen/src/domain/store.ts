import { applyCommand, newGame, type Command, type GameState } from "./game.ts";

export function createGameStore(initialState: GameState = newGame()) {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: (): GameState => state,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispatch: (command: Command): void => {
      const next = applyCommand(state, command);
      if (next === state) return;
      state = next;
      listeners.forEach((listener) => listener());
    },
  };
}

export const gameStore = createGameStore();
