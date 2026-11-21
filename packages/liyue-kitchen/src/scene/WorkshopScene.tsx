import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Polygon, Text } from "pixi.js";
import type { GameState } from "../domain/game.ts";
import { visitorPresent } from "../domain/visitors.ts";

/**
 * Fixed 1600×900 authored scene coordinates. The parent begins at world y=56;
 * rendering and polygon hit-testing share the same 1600×809 affine transform.
 *
 * The Pixi shapes are the actual scenery AND the real non-rectangular hit areas.
 * React is only an accessible overlay for existing business controls.
 */
export type WorkshopZone =
  | "orb" | "customer" | "shelf" | "counter" | "peel" | "juice"
  | "storage" | "inventory" | "right" | "player" | null;

type Props = {
  state: GameState;
  onEnterGarden: () => void;
  onRegisterHitTest: (pick: (clientX: number, clientY: number) => WorkshopZone) => () => void;
};
type Region = { zone: Exclude<WorkshopZone, null>; polygon: Polygon };
type Palette = { wood: number; dark: number; ink: number; cream: number };

const WIDTH = 1600;
const TOP = 56;
const HEIGHT = 809;
const PALETTE: Palette = {
  wood: 0xe8c79a, dark: 0x58422e, ink: 0x263b53, cream: 0xfff0cc,
};
const U_POLYGON = [
  120, 410, 182, 352, 430, 352, 1010, 352, 1293, 352, 1360, 407,
  1360, 538, 1320, 580, 1008, 580, 941, 464, 499, 464,
  430, 580, 163, 580, 120, 536,
];
const U_INNER = [
  430, 580, 499, 464, 941, 464, 1008, 580,
  1008, 820, 430, 820,
];
const HITS: Region[] = [
  { zone: "orb", polygon: new Polygon(Array.from({ length: 32 }, (_, i) => {
    const phi = i * 2 * Math.PI / 32;
    return [194 + 88 * Math.cos(phi), 255 + 88 * Math.sin(phi)];
  }).flat()) },
  // These boundaries are authored as polygons instead of DOM bounding boxes.
  { zone: "peel", polygon: new Polygon([
    120, 409, 183, 352, 282, 352, 282, 557, 258, 580, 164, 580, 120, 535,
  ]) },
  { zone: "juice", polygon: new Polygon([
    282, 352, 430, 352, 499, 464, 430, 580, 282, 580,
  ]) },
  { zone: "right", polygon: new Polygon([
    1010, 352, 1293, 352, 1360, 407, 1360, 538,
    1320, 580, 1008, 580, 941, 464,
  ]) },
  { zone: "counter", polygon: new Polygon(U_POLYGON) },
  { zone: "storage", polygon: new Polygon([340, 592, 698, 592, 698, 814, 340, 814]) },
  { zone: "inventory", polygon: new Polygon([703, 592, 1121, 592, 1121, 814, 703, 814]) },
  { zone: "customer", polygon: new Polygon([480, 92, 960, 92, 960, 352, 480, 352]) },
  { zone: "shelf", polygon: new Polygon([1000, 88, 1520, 88, 1520, 388, 1000, 388]) },
  { zone: "player", polygon: new Polygon(U_INNER) },
];

// Pixi 8 graphics are append-only within a frame. Reuse one batched Graphics
// per scene instead of allocating/rendering a separate GPU object per line.
const graphicsLayers = new WeakMap<Container, Graphics>();
function graphics(parent: Container, draw: (g: Graphics) => void): Graphics {
  let g = graphicsLayers.get(parent);
  if (!g) {
    g = new Graphics();
    parent.addChild(g);
    graphicsLayers.set(parent, g);
  }
  draw(g);
  return g;
}
function rect(parent: Container, x: number, y: number, w: number, h: number,
  fill: number, stroke?: number, thickness = 2, alpha = 1) {
  graphics(parent, g => {
    g.rect(x, y, w, h).fill({ color: fill, alpha });
    if (stroke !== undefined) g.rect(x, y, w, h).stroke({ color: stroke, width: thickness });
  });
}
function rounded(parent: Container, x: number, y: number, w: number, h: number, r: number,
  fill: number, stroke?: number, thickness = 2, alpha = 1) {
  graphics(parent, g => {
    g.roundRect(x, y, w, h, r).fill({ color: fill, alpha });
    if (stroke !== undefined) g.roundRect(x, y, w, h, r).stroke({ color: stroke, width: thickness });
  });
}
function polygon(parent: Container, points: number[], fill: number,
  stroke?: number, thickness = 2, alpha = 1) {
  graphics(parent, g => {
    g.poly(points).fill({ color: fill, alpha });
    if (stroke !== undefined) g.poly(points).stroke({ color: stroke, width: thickness, join: "round" });
  });
}
function line(parent: Container, points: number[], color: number, width = 2, alpha = 1) {
  graphics(parent, g => g.poly(points).stroke({ color, width, alpha, join: "round" }));
}
function label(parent: Container, caption: string, x: number, y: number,
  size = 20, color = 0x263b53, weight: "normal" | "bold" = "bold") {
  const t = new Text({
    text: caption,
    style: { fontFamily: "Arial, Microsoft YaHei, sans-serif", fontSize: size,
      fontWeight: weight, fill: color, align: "center" },
  });
  t.position.set(x, y);
  parent.addChild(t);
  return t;
}
function landscape(stage: Container, game: GameState) {
  // The one and only outside-facing window: physically ends at the U bar top.
  rounded(stage, 473, 88, 494, 273, 10, 0x67573d, 0x333d39, 4);
  rect(stage, 480, 92, 480, 260, 0x9dcad4);
  for (let i = 0; i < 14; i++)
    rect(stage, 483, 97 + i * 14, 473, 14,
      i % 2 === 0 ? 0xa8d0d9 : 0x9ecad3, undefined, 0, 0.42);
  graphics(stage, g => g.circle(835, 155, 47).fill({ color: 0xf2e9b3, alpha: 0.55 }));
  polygon(stage, [480, 300, 555, 245, 645, 293, 730, 227, 845, 285, 960, 225, 960, 352, 480, 352], 0x739b8c);
  polygon(stage, [480, 323, 580, 271, 690, 315, 765, 269, 864, 306, 960, 259, 960, 352, 480, 352], 0x597c70);
  for (let i = 0; i < 7; i++) {
    const x = 494 + i * 71;
    line(stage, [x, 335, x, 292 - i % 3 * 12], 0x496b5c, 5);
    graphics(stage, g => g.circle(x, 287 - i % 3 * 12, 18).fill(0x568273));
  }
  rect(stage, 483, 92, 11, 260, 0x524e44);
  rect(stage, 947, 92, 11, 260, 0x524e44);
  rect(stage, 716, 92, 8, 260, 0x55564c);
  rect(stage, 480, 92, 480, 12, 0x514b3b);
  rect(stage, 480, 341, 480, 11, 0x514b3b);
  // Window tenant is a visual placeholder. Actual story and decisions stay in
  // the original visitor business panel, read from GameState.
  if (visitorPresent(game)) {
    graphics(stage, g => {
      g.circle(709, 245, 24).fill(0xdfc39b);
      g.roundRect(669, 271, 80, 64, 22).fill(0x486357);
    });
  }
}
function shelf(stage: Container) {
  rounded(stage, 995, 83, 535, 309, 12, 0x66513c, 0x413e32, 4);
  rounded(stage, 1003, 94, 519, 292, 7, 0xd7dfd8, 0x8b806c);
  // Exactly three horizontal display shelves in the reference image.
  for (let n = 0; n < 3; n++) {
    const y = 131 + n * 79;
    rounded(stage, 1028, y, 468, 64, 3, 0xbecbd0, 0x5d7890);
    rect(stage, 1028, y + 57, 468, 8, 0x8e7a58);
  }
  // These objects do not mint GameItems or count toward delivery.
  graphics(stage, g => {
    g.ellipse(1112, 179, 36, 22).fill(0x81aa87);
    g.circle(1112, 153, 22).fill(0x8ab4a0).stroke({ color: 0x3d6d5c, width: 3 });
    g.circle(1258, 157, 18).fill(0xe6c17e);
    g.roundRect(1380, 143, 51, 44, 4).fill(0xb0a2a0);
    g.roundRect(1078, 216, 75, 43, 5).fill(0xe2cba8);
    g.circle(1278, 230, 24).fill(0xafca87);
    g.roundRect(1396, 218, 40, 37, 6).fill(0x8aafbd);
  });
}
function orb(stage: Container, state: GameState) {
  rounded(stage, 35, 92, 341, 331, 15, 0xd1e2ec, 0x43576f, 4);
  rounded(stage, 48, 107, 313, 301, 9, 0xdae5e9);
  for (let i = 0; i < 5; i++) {
    line(stage, [52, 122 + i * 60, 355, 122 + i * 60], 0xc2d2da, 1, 0.65);
  }
  // True circle instead of an aspect-ratio-dependent ellipse.
  graphics(stage, g => {
    g.circle(194, 249, 99).fill({ color: 0x295e65, alpha: 0.14 });
    g.circle(194, 249, 94).stroke({ color: 0x637ea0, width: 5 });
    g.circle(194, 249, 87).fill({ color: 0x72adbc, alpha: 0.27 });
    g.circle(176, 218, 42).fill({ color: 0xe0fdff, alpha: 0.11 });
    g.ellipse(194, 292, 67, 14).fill({ color: 0x967d57, alpha: 0.9 });
  });
  const plant = state.plots.P01.plant;
  if (!plant) {
    label(stage, "等待播种", 144, 245, 16, 0x4b707a);
    graphics(stage, g => g.ellipse(192, 287, 10, 6).fill(0xdbc78f));
  } else if (plant.stage === "Seed") {
    graphics(stage, g => g.ellipse(194, 281, 12, 7).fill(0xc9d69c));
  } else {
    line(stage, [195, 289, 192, 264, 198, 231, 190, 211, 203, 189], 0x84694a, 8);
    if (plant.stage === "Seedling") {
      line(stage, [195, 260, 175, 240], 0x88a85f, 5);
      line(stage, [196, 252, 215, 235], 0x88a85f, 5);
      graphics(stage, g => {
        g.ellipse(172, 235, 19, 9).fill(0x8aaf79);
        g.ellipse(216, 231, 19, 9).fill(0xa2c581);
      });
    } else {
      line(stage, [196, 251, 168, 226, 149, 216], 0x84694a, 5);
      line(stage, [197, 228, 223, 205, 235, 190], 0x84694a, 5);
      line(stage, [197, 270, 226, 249, 243, 247], 0x84694a, 5);
      plant.leaves.forEach((leaf, i) => {
        const points = [[155, 217], [235, 193], [245, 246]];
        const [x, y] = points[i % 3];
        graphics(stage, g => g.ellipse(x, y, 23, 12)
          .fill({ color: leaf.stage === "SmallLeaf" ? 0x9abc82 : 0x86ba7b })
          .stroke({ color: 0x4a6d50, width: 2 }));
        const fruit = leaf.fruit;
        if (fruit) {
          graphics(stage, g => g.circle(x + 12, y + 20,
            fruit.stage === "MatureFruit" ? 12 : 7)
            .fill(fruit.stage === "MatureFruit" ? 0xffc477 : 0xb0d17a)
            .stroke({ color: 0x927653, width: 2 }));
        }
      });
    }
  }
  graphics(stage, g => g.arc(171, 220, 68, -2.55, -1.65)
    .stroke({ color: 0xe3f5eb, alpha: 0.7, width: 6 }));
  rounded(stage, 106, 366, 177, 34, 14, 0xc3d8d8, 0x758f91);
  label(stage, "水晶球 · 进入园地", 112, 374, 18, 0x24434c);
}
function counter(stage: Container) {
  // Front-most layer. Unlike the old CSS rectangle composition, a single
  // Pixi polygon actually forms the left/center/right connected U surface.
  polygon(stage, U_POLYGON.map((v, i) => i % 2 ? v + 10 : v + 6), 0x493c31, undefined, 0, 0.26);
  polygon(stage, U_POLYGON, PALETTE.wood, PALETTE.dark, 6);
  polygon(stage, [
    126, 412, 185, 357, 427, 357, 1009, 357, 1290, 357, 1352, 410,
    1350, 420, 1286, 369, 1006, 369, 433, 369, 187, 369, 133, 420,
  ], PALETTE.cream, undefined, 0, 0.85);
  // Edge of recessed center: a single shared contour at y=464.
  line(stage, [430, 579, 499, 464, 941, 464, 1008, 579], 0x86684a, 7);
  line(stage, [439, 559, 504, 456, 939, 456, 995, 559], 0xffebcd, 4);
  rounded(stage, 142, 378, 128, 50, 11, 0xc2d1d1, 0x55717a, 3);
  rounded(stage, 289, 376, 115, 45, 8, 0xc1b49a, 0x7a6040, 3);
  rounded(stage, 1030, 395, 132, 84, 14, 0xd9c7a5, 0x9f825d, 3);
  rounded(stage, 1190, 395, 129, 84, 14, 0xd9c7a5, 0x9f825d, 3);
  label(stage, "设备扩展位", 1104, 406, 17, 0x796b5a);
  label(stage, "设备扩展位", 1263, 406, 17, 0x796b5a);
}
function cabinets(stage: Container) {
  // Cabinet walls are real scenery; only the overlaid storage/inventory lists
  // are GameItems. No separate cup/fridge inventory exists.
  rect(stage, 120, 580, 1240, 240, 0xc1b8ae, 0x5b584c, 6);
  rect(stage, 126, 588, 213, 225, 0xc6b3ac, 0x94786c, 3);
  rect(stage, 341, 588, 354, 225, 0xa8b7a4, 0x6b736c, 3);
  rect(stage, 700, 588, 417, 225, 0xb5c3b8, 0x777c71, 3);
  rect(stage, 1122, 588, 231, 225, 0xc1b4a5, 0x94786c, 3);
  line(stage, [229, 591, 229, 811], 0x807164, 3);
  graphics(stage, g => {
    g.circle(210, 705, 7).fill(0x7b6551);
    g.circle(250, 705, 7).fill(0x7b6551);
  });
  rect(stage, 1142, 625, 185, 27, 0xd4c4a4, 0x8d816b);
  label(stage, "杯架 / 环境展示", 1150, 632, 15, 0x4a5355);
  rounded(stage, 1190, 671, 94, 115, 10, 0x9aaeb0, 0x647a79, 3);
  line(stage, [1195, 714, 1279, 714], 0x667974, 3);
  line(stage, [1204, 688, 1204, 703], 0xe6e9df, 5);
  polygon(stage, [320, 822, 990, 822, 1065, 864, 250, 864], 0x84a78b, 0x7a9072, 2, 0.23);
}

function drawScene(app: Application, state: GameState, enterGarden: () => void) {
  app.stage.removeChildren().forEach(c => c.destroy({ children: true }));
  const root = new Container();
  root.position.set(0, -TOP);
  app.stage.addChild(root);
  app.stage.scale.set(app.screen.width / WIDTH, app.screen.height / HEIGHT);

  // Reference foreground/backdrop composition, not diagnostic blueprint boxes.
  rect(root, 0, 56, 1600, 808, 0xe1e7e7);
  for (let i = 0; i < 12; i++) {
    rect(root, 0, 56 + i * 26, 1600, 26, 0xd5dee5, undefined, 0, i % 2 ? 0.18 : 0.07);
  }
  rect(root, 0, 334, 1600, 528, 0xc2bcae);
  rect(root, 0, 813, 1600, 51, 0x8daaa0);
  for (let i = 0; i < 16; i++)
    line(root, [i * 110 - 10, 824, i * 110 + 55, 863], 0x78978f, 1, 0.5);

  // Background regions and only exterior window.
  orb(root, state);
  landscape(root, state);
  shelf(root);
  rect(root, 0, 56, 22, 810, 0x9caab5);
  rect(root, 1578, 56, 22, 810, 0x9caab5);
  rect(root, 402, 92, 16, 288, 0xbec4c7, 0x7e868e, 2);
  rect(root, 975, 88, 14, 302, 0xbec4c7, 0x7e868e, 2);

  // Cabinets are under and behind the contiguous work surface.
  cabinets(root);
  counter(root);

  const uHit = new Graphics();
  uHit.poly(U_POLYGON).fill({ color: 0xffffff, alpha: 0.001 });
  uHit.eventMode = "static";
  uHit.cursor = "default";
  uHit.hitArea = new Polygon(U_POLYGON);
  root.addChild(uHit);

  const ballHit = new Graphics();
  ballHit.circle(194, 249, 88).fill({ color: 0xffffff, alpha: 0.001 });
  ballHit.eventMode = "static";
  ballHit.cursor = "pointer";
  ballHit.hitArea = new Polygon(Array.from({ length: 32 }, (_, i) => {
    const rad = i * Math.PI / 16;
    return [194 + 88 * Math.cos(rad), 249 + 88 * Math.sin(rad)];
  }).flat());
  ballHit.on("pointertap", () => enterGarden());
  root.addChild(ballHit);
}

function visualSignature(state: GameState): string {
  const plant = state.plots.P01.plant;
  return [
    visitorPresent(state) ? "visitor" : "empty",
    plant?.stage ?? "Empty",
    ...(plant?.leaves.map(leaf =>
      `${leaf.id}:${leaf.stage}:${leaf.fruit?.stage ?? "no-fruit"}`) ?? []),
  ].join("|");
}

export function WorkshopScene({ state, onEnterGarden, onRegisterHitTest }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const lastVisualRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  const enterRef = useRef(onEnterGarden);
  stateRef.current = state;
  enterRef.current = onEnterGarden;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const app = new Application();
    let disposed = false;
    let observer: ResizeObserver | null = null;
    let unregister = () => {};
    const hit = (clientX: number, clientY: number): WorkshopZone => {
      if (!appRef.current) return null;
      const b = app.canvas.getBoundingClientRect();
      if (!b.width || !b.height || clientX < b.left || clientX > b.right ||
        clientY < b.top || clientY > b.bottom) return null;
      const x = (clientX - b.left) * WIDTH / b.width;
      const y = TOP + (clientY - b.top) * HEIGHT / b.height;
      return HITS.find(region => region.polygon.contains(x, y))?.zone ?? null;
    };
    const resize = () => {
      if (disposed || !appRef.current) return;
      app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
      drawScene(app, stateRef.current, () => enterRef.current());
      lastVisualRef.current = visualSignature(stateRef.current);
      app.renderer.render(app.stage);
    };
    void (async () => {
      try {
        await app.init({
          width: Math.max(1, host.clientWidth),
          height: Math.max(1, host.clientHeight),
          backgroundAlpha: 0, preference: "webgl", antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
        });
        if (disposed) { app.destroy({ removeView: true }, { children: true }); return; }
        // Workshop scenery is static between GameState updates. Headless software
        // WebGL must not redraw hundreds of shapes at 60fps continuously.
        app.ticker.stop();
        appRef.current = app;
        app.canvas.dataset.testid = "workshop-canvas";
        app.canvas.setAttribute("aria-label", "璃月厨房工坊场景");
        app.canvas.style.display = "block";
        app.canvas.style.width = "100%";
        app.canvas.style.height = "100%";
        host.appendChild(app.canvas);
        observer = new ResizeObserver(resize);
        observer.observe(host);
        unregister = onRegisterHitTest(hit);
        resize();
      } catch (reason) {
        if (!disposed) console.error("Pixi workshop initialization failed", reason);
      }
    })();
    return () => {
      disposed = true;
      unregister();
      observer?.disconnect();
      appRef.current = null;
      if (app.renderer) app.destroy({ removeView: true }, { children: true });
    };
  }, [onRegisterHitTest]);

  useEffect(() => {
    const app = appRef.current;
    const signature = visualSignature(state);
    if (app && lastVisualRef.current !== signature) {
      drawScene(app, state, () => enterRef.current());
      lastVisualRef.current = signature;
      app.renderer.render(app.stage);
    }
  }, [state]);

  return <div className="workshop-pixi-host" ref={hostRef} data-testid="workshop-pixi"
    aria-label="Pixi 工坊与多边形交互场景" />;
}
