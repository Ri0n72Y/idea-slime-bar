# Editor Boundaries

This template is code-first, but not editor-free. AI should prefer implementing gameplay rules in code while clearly separating runtime logic from editor-authored resources and configuration.

Language note:
- Use this file when working in English.
- When working in Chinese, prefer `docs/EDITOR_BOUNDARIES_ZH.md` so editor and gameplay terminology stays idiomatic.

## Core Rule
- Prefer code for runtime logic: state machines, timers, wave flow, economy, validation, spawning, destruction, settlement, and signal-driven orchestration.
- Do not assume editor resources already exist. If a feature depends on editor-authored assets, components, templates, or IDs, call that out explicitly.
- Do not describe editor capabilities from guesswork. If local editor references exist, check them first.

## What Must Be Done In The Editor
- Scene and map setup: terrain, spawn points, revive points, navigation, placed entities, layout, decoration.
- Node graph containers and final binding: automatic injection requires the target NodeGraph to already exist and be saved in the map; manual `.gia` import does not require a pre-created empty graph with the same ID, while post-import resource attachment, variable/structure binding, and editor references still remain editor work.
- Prefabs / prefab groups / assets: buildings, enemies, drops, effects, UI assets, audio assets, icons.
- Component attachment and base configuration: components can be configured in the editor and used by code, but are not created dynamically at runtime.
- Paths, patrols, and baked navigation-related content.
- UI layout, UI control groups, interaction buttons, timer controls, scoreboard controls.
- Signal definitions in the sandbox signal manager.
- Global timer definitions in the global timer manager.
- Shop templates, currency definitions, backpack templates, and shop components.
- Ability units, combat presets, and other battle-side authored data.
- Text bubbles, minimap markers, sound-effect players, nameplates, and similar presentation resources.

## What Should Usually Be Implemented In Code
- Game phases and state transitions.
- Build / occupy / unlock logic.
- Economy calculations, rewards, prices, and production cycles.
- Wave scheduling, spawn sequencing, and alive-count tracking.
- Runtime prefab creation, removal, and settlement triggers.
- UI visibility switching, control-group activation, and button event handling.
- Signal routing and cross-entity coordination.

## Critical Boundary Notes
- Components are editor-authored. Runtime logic may toggle or modify some component behavior, but should not assume components can be added or removed during play.
- Normal timers can be created directly in node graphs.
- Global timers must be defined in the editor first; code only references them by name.
- `createPrefab` / `createPrefabGroup` create authored prefab resources at runtime; they do not create new editor assets.
- Shop flow is not "open from nothing". It requires editor-authored currency, shop templates, backpack support, and a shop component.
- If using standard attack flow, authored ability units are required. If those are missing, code may need a simpler fallback such as direct HP loss.

## Generated Node Graph And Editor Boundary

This project uses a mixed workflow: TypeScript generates node-graph logic, while the editor remains responsible for resource binding and editor-authored configuration. Generated graphs are optimized first for runtime semantics, not for matching the readability or layout of a hand-authored graph.

### Prefer manual `.gia` import by default

- Server node graphs have been verified to work through the flow `TypeScript -> compile -> .gia -> manual editor import`.
- In this workflow, graph IDs mainly serve compilation, merge, or automatic injection concerns; manual import should not be assumed to require a one-to-one match with an existing editor graph ID.
- This conclusion only applies to graph types that have actually been verified. Client graphs, filters, skill graphs, and other graph types must be validated independently.
- Automatic injection remains optional rather than a default project requirement. Introduce map IDs, target graph IDs, and empty-graph safety checks only when automatic replacement, batch synchronization, or continuous injection is actually needed.

Recommended default flow:

```text
Write TypeScript
-> compile to .gia
-> manually import in the editor
-> complete resource / variable / structure bindings
-> run validation
```

### TypeScript is the main source of truth for algorithmic logic

- State machines, numeric logic, loops, branches, and runtime data reads/writes should normally live in TypeScript.
- `.gia` files and final visual graphs are primarily build artifacts; developers are not expected to maintain a hand-arranged visual graph that mirrors source code exactly.
- Review generated graphs for semantic equivalence: event entry, data sources, branch conditions, loop bounds, write-back targets, and final outputs matter more than node placement or visual similarity to a hand-authored graph.

### Source-level functions are not editor subgraphs

- Reusable source functions such as `gstsServer*` reduce TypeScript duplication but do not guarantee a separate reusable node-graph asset after compilation.
- The compiler may inline or merge several source functions into one graph, producing long wires, repeated reads, and poor human readability.
- If a piece of logic must remain a clear, reusable, independently debuggable editor-side subgraph, author it explicitly as an editor graph asset instead of relying only on a TypeScript function abstraction.

### Manual editor binding is a first-class development step

When the compiler cannot safely represent an editor structure, do not degrade the data model merely to make everything code-generated. The following are valid manual binding boundaries:

- custom structures and dynamic fields;
- nodes whose concrete pins depend on structure declarations in the map;
- prefabs, attachment points, components, presentation resources, and presets;
- entity/resource/configuration references that require editor context;
- dynamic node parameters not yet represented reliably by the compiler type system.

Code may temporarily use clearly marked placeholders or bridge values to validate algorithms, but the final workflow must document every editor-side replacement or binding so experimental constants are not mistaken for production configuration.

### Generated-graph review order

Review generated graphs in this order:

1. Runtime semantics match the design.
2. List indices, loop bounds, and type conversions are correct.
3. Custom-variable, live-list-reference, and write-back semantics are correct.
4. Manual editor bindings are explicit.
5. Optimize visual layout or split modules only when humans must maintain the graph directly.

Do not add local variables, repeated nodes, or extra abstractions solely to make generated graphs look more like hand-authored ones when they add no runtime value.

## AI Working Rules
- For any feature request, separate the answer into:
  - code changes
  - editor setup still required
- If blocked by missing editor setup, say exactly what is missing instead of silently assuming it exists.
- When proposing a design, choose the most code-driven approach that still respects editor boundaries.
- If local editor reference docs are available in the workspace, prefer them as the factual source for editor behavior before making claims.
- When responding in Chinese, prefer the terminology used by the Chinese docs rather than ad hoc English-to-Chinese translation.

## Suggested Response Pattern
- First state what can be implemented in code now.
- Then list the minimum editor configuration required.
- Then note any assumptions about IDs, templates, authored components, or assets.

## Optional Reference
- For broader editor-side documentation and terminology, you may consult [Miliastra-knowledge](https://github.com/1475505/Miliastra-knowledge).
- If local editor docs exist in the workspace, prefer those as the primary source of truth. This repository is supplemental, not a template dependency.
