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
    persistence: { lo¶»§q«^