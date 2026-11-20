import assert from "node:assert/strict";
import test from "node:test";
import { newGame, type GameState } from "./game.ts";
import { createGameStore } from "./store.ts";
import { saveEnvelope, validateSave } from "./save.ts";
import { createWorldSeed } from "./worldSeed.ts";

test("production world seeds use independent entropy and xorshift's nonzero domain", () => {
  let next = 8;
  const rng = { getRandomValues: (a: Uint32Array) => { a[0] = next++; return a; } };
  assert.equal(createWorldSeed(rng), 8);
  assert.equal(createWorldSeed(rng), 9);
  assert.equal(createWorldSeed({ getRandomValues: (a: Uint32Array) => { a[0] = 0; return a; } }), 1);
  assert.equal(newGame(123).randomState, newGame(123).randomState);
  const state = newGame(createWorldSeed(rng));
  assert.equal(validateSave(saveEnvelope(state))?.randomState, 10);
});

test("initial hydration creates a random world only when no save exists", async () => {
  const existing = newGame(111);
  let called = 0;
  const loaded = createGameStore(newGame(), {
    initialReady: false,
    createNew: () => { called++; return newGame(222); },
    persistence: { load: async () => existing, save: async () => { throw new Error("unneeded"); } },
  });
  await loaded.start();
  assert.equal(called, 0);
  assert.equal(loaded.getSnapshot().randomState, 111);
  const saved: GameState[] = [];
  const fresh = createGameStore(newGame(), {
    initialReady: false, createNew: () => { called++; return newGame(333); },
    persistence: { load: async () => null, save: async g => { saved.push(structuredClone(g)); } },
  });
  await fresh.start();
  assert.equal(called, 1);
  assert.equal(fresh.getSnapshot().randomState, 333);
  assert.equal(saved[0].randomState, 333);
});

test("replacement serializes writes and never exposes an uncommitted world", async () => {
  const snapshots: GameState[] = [];
  let release!: () => void;
  const blocker = new Promise<void>(resolve => { release = resolve; });
  const store = createGameStore(newGame(11), {
    persistence: { load: async () => null, save: async g => { if (g.randomState === 22) await blocker; snapshots.push(structuredClone(g)); } },
  });
  const replacement = store.replaceGame(newGame(22));
  assert.equal(store.getSnapshot().randomState, 11);
  store.dispatch({ type: "CONDENSE" });
  assert.equal(store.getSnapshot().dayCondenseUsed, 0);
  release();
  await replacement;
  assert.equal(store.getSnapshot().randomState, 22);
  assert.deepEqual(snapshots.map(g => g.randomState), [22]);
});

test("failed import preserves both live and persisted worlds, and permits later retry", async () => {
  let persisted = newGame(101);
  let failing = true;
  const store = createGameStore(newGame(101), {
    persistence: { load: async () => persisted, save: async g => {
      if (failing) throw new Error("disk unavailable");
      persisted = structuredClone(g);
    } },
  });
  await assert.rejects(store.replaceGame(newGame(202)), /disk unavailable/);
  assert.equal(store.getSnapshot().randomState, 101);
  assert.equal(persisted.randomState, 101);
  assert.equal(store.getSaveStatus(), "error");
  failing = false;
  await store.replaceGame(newGame(303));
  assert.equal(persisted.randomState, 303);
  assert.equal(store.getSnapshot().randomState, 303);
});

test("invalid import never writes and the new-world reset only creates one Seed", async () => {
  let saves = 0;
  const store = createGameStore(newGame(1), {
    persistence: { load: async () => null, save: async () => { saves++; } },
  });
  const corrupt = { ...newGame(4), randomState: 0 };
  await assert.rejects(store.replaceGame(corrupt), /校验/);
  assert.equal(saves, 0);
  assert.equal(store.getSnapshot().randomState, 1);
  await store.replaceGame(newGame(55));
  assert.equal(Object.keys(store.getSnapshot().items).length, 1);
  assert.equal(store.getSnapshot().items["item:seed:1"].kind, "Seed");
  assert.equal(saves, 1);
});
