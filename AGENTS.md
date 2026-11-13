# Repository guidance

## Active project

Current development is **《璃月厨房：还得自己种》 Web MVP**, scoped to `mvp/liyue-kitchen/` design docs and the future `packages/liyue-kitchen/` application.

Read first:
- `mvp/liyue-kitchen/README.md` — game intent, technology and design rules
- `mvp/liyue-kitchen/05-ui-driven-implementation.md` — U1–U9 feature/acceptance contracts
- Team Index #7 and the assigned Member/Work Issue — role and actual task

## Implementation boundaries

- React + TypeScript + Vite for HUD, menus and ordinary panels; PixiJS 8 for the 2D game scene, drawables and pointer/touch interaction.
- Keep game state, simulation, unique IDs and domain commands independent of React, PixiJS and DOM nodes.
- A visible feature is complete only after real browser interaction and state evidence. Use Playwright for user-facing operations. Test numerical rules deterministically where useful; do not create fake UI tests that replace actual interaction.
- Implement only the assigned U stage. Never claim an unimplemented UI, visual asset, feature, platform build or test is complete.
- Use an independent implementation PR; Coder does not self-review or merge. Independent Reviewer reports findings; Lead decides integration.
- Do not inherit other projects' roles or tasks. Existing packages are separate reference code; they are not the Web MVP application.
- Tauri v2 is future packaging. Do not introduce Rust business logic or mobile packaging into the initial Web stage.

## Other repository areas

When explicitly assigned work in another module, follow its module-specific contracts and documentation. This root guide does not reassign such work to the Liyue Kitchen team.
