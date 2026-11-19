/** Only the browser's genuine new-world entry point draws entropy.
 * Domain fixtures continue to call newGame(explicitSeed) for reproducibility.
 */
export function createWorldSeed(random: { getRandomValues: (values: Uint32Array) => Uint32Array } = globalThis.crypto): number {
  const values = new Uint32Array(1);
  random.getRandomValues(values);
  // xorshift32 has an absorbing zero state; preserve its nonzero invariant.
  return values[0] || 1;
}
