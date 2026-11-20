# Research provenance — game UI attention, diegetic workbench, onboarding

> 2026-11-20. Archival rationale for `game-ui-art-direction`. This is not a production requirement or a claim that the design has passed playtesting.

## Question

When a game relies on the player operating visible items in a single workbench, how should the UI allocate attention and guide players without becoming a web dashboard? How much of a reference game's layout should be copied if the actual emotional loop differs?

## Evidence and comparisons

1. **Probably Stolen — Cyberpunk Shopkeeper Sim** ([Steam](https://store.steampowered.com/app/4348910/Probably_Stolen__Cyberpunk_Pawnshop_Simulator/), [gameplay screenshots](https://indiebunny.com/games/probably-stolen-cyberpunk-pawnshop-simulator)): the camera presents a customer service window, a physical counter for goods, machinery and storage in one room. Actual screenshots show items and workstation details, not a row of equally weighted cards. Its rent/payment indicators reflect the game's economic pressure. For 《璃月厨房》 only the in-world counter, proximity of actions, and contextual paper/board treatment transfer; rent pressure, policing, bargaining and high-density item urgency do not.
2. **Unity — [Video Game UI Basics](https://unity.com/blog/video-game-ui-ux-basics)** (2026): distinguishes in-world versus conventional interface layers, stresses keeping core play visible, appropriate feedback and legible controls. Treat as design guidance, not fixed percentage ratios.
3. **NN/g — [10 Usability Heuristics Applied to Video Games](https://www.nngroup.com/articles/usability-heuristics-applied-video-games/)** (2019): progressive disclosure and showing only relevant information reduce overwhelming UI; actionable error messages aid recovery.
4. **NN/g — [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)**: start with essential options and reveal more when needed. In a game, this favors small context-anchored help plus an accessible help book over a permanent verbose footer.
5. **Apple Developer — [Onboarding for Games](https://developer.apple.com/app-store/onboarding-for-games/)**: teach core actions first, defer nonessential features until after onboarding, allow contextual help and replay.
6. **Roblox Creator Hub — [Onboarding techniques](https://create.roblox.com/docs/production/game-design/onboarding-techniques)**: highlight the actionable thing in the world and give short prompts near the next action; avoid long text that players ignore. Some hints may persist until completion but should communicate a single action rather than occupy a large permanent pane.
7. **Game UI Database** ([overview](https://www.gamedeveloper.com/design/game-ui-database-relaunches-with-new-features-video-support-and-over-55-000-screenshots)): a screen reference corpus useful for checking hierarchy across shipped games. Screenshots illustrate patterns, not tested universal layout ratios.
8. **Community task-skill pattern** ([RetroGame game-ui-hud-flow-design](https://github.com/BraveZY/RetroGame/blob/main/.codex/skills/game-ui-hud-flow-design/SKILL.md)): design UI flow, state hierarchy, onboarding and review separately from asset drawing and runtime code. Use only as a comparison of workflow boundaries.

## Observations from the project, distinct from external evidence

- As of inspection on 2026-11-20, `packages/liyue-kitchen/src/workshop.css` defines a default workshop with 25% / 49% / 26% columns. The left 25% shelf's first 30% height is a `garden-portal`. The NPC fills 35% of the entire central column's height. The workshop has no live tree miniature inside its portal. Source: `src/App.tsx`, `src/workshop.css`.
- `src/experience.css` allows persistent next-action guidance to occupy up to 49% of the bottom bar, while `workshop.css` sets that bar to 7% of screen height. The hint is shown by default unless localStorage holds `liyue-kitchen-guidance=hidden`.
- `src/scene/CrystalScene.tsx` uses geometric text/dots for tree states; `plotGeometry.ts` hard caps hex radius at 70 screen pixels and draws the enclosing circle at 2.96× that radius. The separate garden scene displays all 7 hexes, including locked plots.
- We inspected archived browser screenshots from the earlier U1–U9 layout (`liyue-ui-evidence.zip`). They prove the old rectangular experience at 1600×900 but **do not verify the currently deployed workshop**. Current structural conclusions are code-derived. Live QA / current screenshots remain required.
- The approved planning document `mvp/liyue-kitchen/10-workshop-first-layout.md` (design branch as of 2026-11-19) intentionally keeps **workshop first, garden as second scene**, and gives plant growth a preview on the portal. The 2026-11-20 user revision requests smaller NPC emphasis, larger recognizable sphere, truthful plant miniatures, and less guidance occupation. Preserve the two-scene and state contracts while changing visual weights.

## Design interpretation and alternatives

- Proposed layout ratios in `docs/visual/liyue-workshop-layout-v2.md` are **project estimates**, not measurements extracted from Probably Stolen.
- Reject returning to a primary screen with seven large locked hex cards: this conflicts with the agreed workshop-first architecture and user request to hide unopened plots.
- Reject replacing the portal with a static ornamental crystal: the portal must reflect the real current plant and fruit states, and must open the real garden.
- Reject eliminating help entirely: wrong-drop guidance and optional next-step instructions are necessary for recoverable, non-punitive play.
- Favor a hybrid: physical workshop with an always-visible meaningful orb preview, small visitor window, storage and tools around the counter, and details shown contextually; garden continues to hold full plant-level controls.

## Revision test

After a Coder implementation, compare current 1600×900 and 1280×720 images, verify gameplay click and drag flows, ask Experience QA for blind first-use observations, and update the reusable skill only if observed failures justify a rule change.
