---
name: game-ui-art-direction
description: Review and redesign an existing game's playable screen, spatial HUD, in-world workbench UI, onboarding prompts, and visual hierarchy. Use when core gameplay is hidden by panels, guidance takes too much room, or a reference game's layout must be adapted without copying its rules.
---

# Game UI art direction

Design from **the player's actions and actual state**, not from equal-width UI columns or a concept image alone. This skill produces a layout/experience contract for an Art Lead; it does not draw final assets or change gameplay code.

## Inputs to inspect

- Read the current playable loop and the latest approved layout, including later user changes.
- Inspect the current rendered screen **and** code/scene composition if available; label screenshots as historical when they are not the same build. If live rendering is unavailable, base structural claims on current source and mark visual verification pending.
- Identify current game states, actions, direct interactions, input types, screen sizes, and ownership boundaries. Do not invent objects or data to fill an attractive screen.
- Review reference-game screenshots as examples of **attention and spatial behavior**; distinguish transferable layout patterns from genre-specific pressure, economies, or mechanics.

## Decision procedure

1. **Prioritize player verbs.** State the primary loop in 2–5 verbs. For each screen, choose its primary focus and at most two supporting actions. Put that focus in the area where the player naturally looks and acts; do not give a rare NPC, tutorial, or administrative panel the largest permanent region.
2. **Classify information.** Keep persistent essentials small (time/day, actionable resources, current interactive object). Show local information beside its object when needed (order, selection, status). Move history, research, manuals, and detailed instructions to optional drawers/books/overlays. Feedback must be legible and tied to the causative action.
3. **Design physical space before decorative frames.** For workshop-style games, map actions to visible devices, counter surfaces, shelves, paper notes, drawers and windows. Reserve an unobstructed focal zone for the primary interactive object. Avoid dividing one coherent room into equal-sized web-dashboard cards. Give interactable things recognizable affordances; nonfunctional decorations must not look like buttons.
4. **Assign a layout budget.** Specify relative region widths, vertical bands, minimum object diameters, and states in a reference aspect ratio. A round object must remain round (equal rendered axes, no stretched elliptical container). Review busy and empty states; an absent visitor must not reserve a large empty column. Check how the proposed UI scales to target devices.
5. **Tie visuals to real game state.** For a miniature/overview, show a truthful summary of plant growth and unlocks, not a stock plant picture. Initial empty state must stay empty until real planting; locked/invisible content must respect the approved visual contract. An overview and a detailed scene read the same state; never synthesize a second copy of an object or reward.
6. **Teach beside the next action.** Use just-in-time, optional, dismissible guidance, preferably highlighting the real seed, planter, machine, or customer. A long fixed tutorial is a reference/help page, not a permanent HUD. Preserve precise wrong-action recovery and a way to reopen instructions. Let experienced players pursue their own workflow.
7. **Separate artistic and technical ownership.** Art Lead approves composition, emphasis and visual language. Painter creates cohesive complete scene art first. Technical Artist decomposes approved art into reusable assets and fills technical gaps; Coder integrates actual events and input; QA checks real interactions. Do not give Painter a large pre-sliced item order.
8. **Validate across states, not only beauty shots.** Review no visitor/visitor, empty plot/planted/mature, held items/dragging, accepted/expired order, guidance shown/hidden, modal open, and both mouse and touch. Ensure feedback, cancel and return paths remain accessible.

## Deliverable contract

Provide, compactly:

- **Current evidence:** screenshot/deployment/commit, relevant source files, and unverified aspects.
- **Attention audit:** main player loop, what dominates now, why this conflicts with the loop, what must stay visible.
- **Layout blueprint:** reference resolution, ratio, region bounds or percentages, object scale and responsive behavior. Mark every numerical budget as a design proposal until play-tested.
- **State-to-surface map:** visual object → real state → action → feedback; specify optional/hidden states and input interactions.
- **Guidance policy:** first-use, ordinary play, error/recovery and returning player; describe placement and dismissal.
- **Integration and test boundaries:** existing components/test IDs to preserve, design changes for Coder, art delivery boundaries for Painter/TA, browser tests for QA.

## Completion checks

- Within a short glance, the player can identify the main object and next available action.
- The largest persistent visual region belongs to core play, not to guidance or a secondary character.
- A real state change visibly updates the relevant in-world object; decorative previews are never mistaken for generated resources.
- No gameplay-critical object or click/drop area is hidden by a panel, tutorial, gloss layer, or clipped sprite.
- Readability, touch targets, tooltip access and return paths survive the smallest required viewport.
- Actual browser/engine tests are required before claiming implementation or player-experience acceptance; a source review or static wireframe alone is not a pass.

## Sources and evolution

Read `references/research-history.md` when assessing the rationale or revising the skill. Store game-specific layout coordinates and approved art constraints in their owning project document (for this project, `docs/visual/liyue-workshop-layout-v2.md`), not in this reusable runtime file. Revise the skill after at least one actual redesign and observed UX feedback; remove rules that add no value.
