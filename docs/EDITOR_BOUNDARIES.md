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

## Feature Development Workflow

For each feature, this project follows an entity-first, small-graph, explicit-reuse workflow.

This matches common component- and scene-oriented game-editor engineering practice: define objects and responsibilities first, then split behavior into maintainable units; extract reusable, stateless, or high-complexity logic instead of continuously expanding one event graph.

### 1. Decompose the feature into entities first

Before implementing a feature, define the entities it needs. For each entity, record at least:

- name and purpose;
- its single responsibility in the feature;
- runtime properties / custom variables it owns;
- editor-authored assets, components, attachment points, presets, or entity dependencies;
- events / signals it receives or emits;
- which state it owns versus state owned by another entity or the level.

Do not begin from "which nodes should be drawn". Node graphs should follow from entity responsibilities.

### 2. Design node-graph scripts from those responsibilities

Each node-graph script should stay as close as practical to:

- one responsibility;
- clear inputs and outputs;
- one simple flow;
- explicit state ownership;
- no unrelated mixing of orchestration, calculation, and presentation concerns.

A script should usually correspond to one event entry or one clear state transition, such as initialization, receiving input, applying one settlement step, spawning one object, or advancing one phase.

### 3. Split complex flows into multiple scripts

If a flow has several distinct stages, do not keep expanding one large graph. Split it into multiple node-graph scripts coordinated through events, signals, state variables, or entity relationships.

Typical cases include:

- initialization that combines persistent-state loading, offline settlement, repair, and later spawning;
- an entity that otherwise handles input, spawning, and lifecycle management in one graph;
- flows with multiple independently testable stages.

The split criterion is not a fixed node-count limit. A script should still be describable accurately in one sentence.

### 4. Put complex math in a dedicated node graph

Complex formulas, reusable numeric transforms, or calculations whose wiring should be reviewed independently should not be inlined into the main generated flow.

Use this process:

1. create a dedicated node-graph source file for the calculation;
2. generate its `.gia` with TypeScript / genshin-ts;
3. manually import it into the editor;
4. package it as a compound node;
5. keep the compound-node name identical to the source graph filename.

Example:

```text
element_decay_calc
```

The source file, imported graph, and resulting compound node all use the same name.

Complex math graphs should stay calculation-focused: explicit inputs, explicit outputs, and no unrelated external entity-state orchestration.

### 5. Main flows use explicit manual compound-node call sites

When a main flow needs one of these compound nodes, do not ask genshin-ts to inline the complex formula again.

The generated script should leave a simple, recognizable placeholder at the call site and explicitly name the compound node that must be connected manually. The annotation must reference the graph filename directly, for example:

```text
MANUAL: connect compound node element_decay_calc
```

After import, replace or connect that location to the identically named compound node.

The placeholder implementation must use a genshin-ts-supported node that is known not to alter final runtime semantics. Until that exact mechanism is standardized, do not assume a no-op or comment node exists.

### 6. Standard feature delivery structure

Use the following decomposition by default:

```text
Feature
├── Entities
│   ├── Entity A
│   │   ├── Responsibility
│   │   ├── Runtime Properties
│   │   └── Editor Bindings
│   └── Entity B
│       ├── Responsibility
│       ├── Runtime Properties
│       └── Editor Bindings
│
├── NodeGraph Scripts
│   ├── simple_flow_a.ts
│   ├── simple_flow_b.ts
│   └── simple_flow_c.ts
│
├── Reusable Compound Graphs
│   └── complex_math_calc.ts / .gia
│
└── Manual Editor Work
    ├── import .gia
    ├── package compound nodes
    ├── connect marked call sites
    └── bind assets / structures / components
```

### 7. Review criteria

Before implementation, a feature should answer:

- What entities exist?
- What single responsibility does each entity own?
- Who owns each piece of state?
- Can each script graph be described in one sentence?
- Is there complex math that should become an independent compound node?
- Which parts require manual editor binding?
- Does every manual call site name the exact compound-node source file?

If one generated graph handles several stages, contains many cross-region wires, or requires understanding the whole graph to reason about one local behavior, prefer decomposition over adding more nodes to the same graph.

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
