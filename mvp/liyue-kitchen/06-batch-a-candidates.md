# Batch A — U5/U6 candidate rules and verifiable calibration

Status: **implementation candidates; Lead approval required before integration**. This document accompanies [Work #54](https://github.com/Ri0n72Y/idea-slime-bar/issues/54).

## Sustainable seed supply

- First game creates one Seed as before.
- Every successfully harvested **MatureFruit** transfers its edible account into one Aquamelon and yields **one Seed with a new itemId** and the exact same fruit source (plotId/plantId/leafId). The seed holds no 7D edible Growth; no duplicate harvest can spawn another.
- Both the fruit and seed survive order expiry. A previously harvested plant may be replaced by dragging a real Seed into its plot only when **no fruit remains attached**. Original source IDs remain archived for saved material and seed provenance. Replanting spends the Seed and starts a distinct plantId/cycle.
- **Alternative for Lead:** move seed production to an explicit "reserve seeds" operation on the harvested fruit; this adds a new input control and can lock players out if the final fruit is handed to an order before reserving seeds. Automatic harvest seed minimizes permanent dead ends.

## Commission and economy candidates

| Parameter | Candidate | Reason / risk |
|---|---:|---|
| Daily free elemental condensations N | 8 | U2 default; shared across all unlocked plots |
| Night length K | 24 uh | U2 default; preserves model-day 04:00; no formula changes |
| First complete-fruit order window | +45 game days (posted D → due D+45) | provisional buffer; compare real first fruit trajectory |
| Renewal order window | +40 days | retry windows after expiration, including if the player misses first |
| First verified Growth cycle reward | 6 energy | only after actual organ/tree Growth in a confirmed night, once per plantId |
| Mature fruit harvest reward | 2 energy | once per plot/plant/leaf source; never for immature |
| Completed order reward | 16 energy | once per orderId after concrete itemIds consumed |
| P02 unlock | 8 energy | a growth cycle + one mature harvest can unlock even if first order expires |
| P03–P07 | 16 / 24 / 32 / 40 / 48 | scaling candidates, not yet approved |

`earnedTotal - spentTotal = balance` is preserved by both reward and purchase commands. A completed order creates the next **alternating** fruit/juice-cup offer. Expired orders create a fresh offer of the same kind on the next morning; no visitor, free item or free energy is injected.

**Potential risks:** Harvest-only seed supply begins after the first fruit; if players starve the sole plot before maturity, they must resume watering. Larger numbers of plots share unchanged N=8, which can reduce per-plot growth. Commission windows and later plot costs need Lead selection after replay.

## Reproducible Growth / random simulation

Execute `pnpm --filter @idea-slime-bar/liyue-kitchen simulate:balance`.

- Production `newGame(seed)`, `PLANT_SEED`, `CONDENSE`, `COLLECT_BALL`, `WATER_PLOT` use unmodified U2 domain commands.
- K=24 follows real `CONFIRM_END_DAY`; K=12 executes the identical `advancePlotOneUH` integrator in 12 discrete hours and preserves the 04:00 model-hour event. No multiplied-growth shortcut, fake fruit or mocked Growth.
- Replay 8 fixed seeds, N=4 or 8, K=12 or 24 (32 samples); at most 110 game nights. Report every first MatureFruit day, p50/p90/max and successes by first deadline. This is a small comparative playtest sample, not a statistical proof.
- The CI job runs the exact script and retains the console results. Lead must decide K/N, reward, deadline and P02 price; this PR must not silently label these values final.

## Acceptance boundaries

New commissioned fruit and juice-cup deliveries, stable seed and energy provenance, multi-plot nightly growth, IndexedDB v1–v3 migration, negative/replay guards and desktop/touch browser tests are implemented together. U7/U8/U9 are excluded; subjective art approval is later.
