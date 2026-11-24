import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Polygon, Circle, Text } from "pixi.js";
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
type Region = { zone: Exclude<WorkshopZone, null>; polygon: Polygon | Circle };
type Palette = { wood: number; dark: number; ink: number; cream: number };

const WIDTH = 1600;
const TOP = 56;
const HEIGHT = 809;
const PALETTE: Palette = {
  wood: 0xe8c79a, dark: 0x58422e, ink: 0x263b53, cream: 0xfff0cc,
};
// World coordinates: #62 v5. All scene drawing, hit testing and React
// overlay anchors share this contract.
type WorldRect = readonly [number, number, number, number];
export const WORKSHOP_GEOMETRY = {
  window: [550,145,520,235], windowFrame: [520,122,580,283],
  orb: { x:248, y:278, r:106 },
  orbBase: [155,345,190,60], shelf: [1190,200,380,205],
  surface: [0,514,135,444,510,444,510,405,1090,405,1090,444,1460,444,1600,514,1600,572,1215,580,1180,568,1080,492,1040,480,560,480,520,492,420,568,385,580,0,580],
  leftCabinet: [0,580,385,580,420,568,420,845,0,845],
  leftInner: [420,568,520,492,550,480,550,735,420,845],
  middleCabinet: [550,480,1050,480,1050,735,550,735],
  rightInner: [1050,480,1080,492,1180,568,1180,845,1050,735],
  rightCabinet: [1180,568,1215,580,1600,580,1600,845,1180,845],
  floor: [550,735,1050,735,1180,845,1600,845,1600,865,0,865,0,845,420,845],
  rug: [550,735,1050,735,1180,845,420,845],
  sink: [40,480,200,65],
  peel: [245,495,175,62],
  machine: [420,335,78,130],
  machineFoot: [420,444,78,24],
  storage: [40,610,325,210], inventory: [1230,610,330,210],
  overlays: {
    orb: [100,135,296,270],
    customer: [550,145,520,195],
    shelf: [1190,200,380,205],
    left: [245,318,295,239],
    peel: [245,405,175,152],
    juice: [420,318,120,150],
    order: [560,340,480,140],
    right: [1200,475,340,90],
    cabinets: [0,580,1600,265],
    storage: [40,610,325,210],
    inventory: [1230,610,330,210],
  },
} satisfies {window: WorldRect;windowFrame: WorldRect;orb:{x:number;y:number;r:number};orbBase: WorldRect;shelf:WorldRect;surface:number[];leftCabinet:number[];leftInner:number[];middleCabinet:number[];rightInner:number[];rightCabinet:number[];floor:number[];rug:number[];sink:WorldRect;peel:WorldRect;machine:WorldRect;machineFoot:WorldRect;storage:WorldRect;inventory:WorldRect;overlays:Record<string,WorldRect>};
const G = WORKSHOP_GEOMETRY;
export function workshopOverlay(key: keyof typeof G.overlays, parent?: keyof typeof G.overlays) {
  const [x,y,w,h] = G.overlays[key];
  const [px,py,pw,ph]: WorldRect = parent ? G.overlays[parent] : [0,TOP,WIDTH,HEIGHT];
  return { left: `${(x-px)/pw*100}%`, top: `${(y-py)/ph*100}%`,
    width: `${w/pw*100}%`, height: `${h/ph*100}%` };
}
const boxPolygon = ([x,y,w,h]: WorldRect) => new Polygon([x,y,x+w,y,x+w,y+h,x,y+h]);
const U_POLYGON = G.surface;
const HITS: Region[] = [
  {zone:"orb",polygon:new Circle(G.orb.x,G.orb.y,G.orb.r)},
  {zone:"juice",polygon:boxPolygon(G.machine)},
  {zone:"juice",polygon:boxPolygon(G.machineFoot)},
  {zone:"peel",polygon:boxPolygon(G.peel)},
  {zone:"storage",polygon:boxPolygon(G.storage)},
  {zone:"inventory",polygon:boxPolygon(G.inventory)},
  {zone:"right",polygon:new Polygon([1090,444,1460,444,1600,514,1600,572,1215,580,1180,568,1080,492,1040,480,1090,480])},
  {zone:"counter",polygon:new Polygon(U_POLYGON)},
  {zone:"customer",polygon:boxPolygon(G.window)},
  {zone:"shelf",polygon:boxPolygon(G.shelf)},
  {zone:"player",polygon:new Polygon(G.floor)},
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
  rect(stage, ...G.windowFrame, 0x67573d, 0x333d39, 4);
  rect(stage, ...G.window, 0x9dcad4);
  graphics(stage, g => g.circle(930,205,37).fill({color:0xf2e9b3,alpha:.55}));
  polygon(stage,[550,340,625,270,735,328,820,250,940,318,1070,262,1070,380,550,380],0x739b8c);
  polygon(stage,[550,359,660,311,760,354,850,309,970,348,1070,310,1070,380,550,380],0x597c70);
  for (const x of [550,806,1060]) rect(stage,x,145,10,235,0x524e44);
  rect(stage,550,145,520,10,0x514b3b);
  rect(stage,550,370,520,10,0x514b3b);
  if(visitorPresent(game)) graphics(stage,g=>{
    g.circle(810,290,24).fill(0xdfc39b);
    g.roundRect(770,316,80,54,22).fill(0x486357);
  });
}
function shelf(stage:Container) {
  rect(stage,...G.shelf,0x66513c,0x413e32,4);
  for(let n=0;n<3;n++) {
    const y=209+n*64;
    rect(stage,1203,y,354,58,0xd7dfd8,0x8b806c);
    rect(stage,1203,y+50,354,8,0x8e7a58);
  }
  graphics(stage,g=>{
    g.ellipse(1260,242,28,16).fill(0x81aa87);
    g.circle(1365,240,18).fill(0xe6c17e);
    g.roundRect(1470,223,42,36,4).fill(0xb0a2a0);
    g.roundRect(1238,286,65,35,5).fill(0xe2cba8);
    g.circle(1390,303,20).fill(0xafca87);
  });
}
function orb(stage: Container, state: GameState) {
  rounded(stage,...G.orbBase,8,0x967d57,0x58422e,3);
  const preview = new Container();
  const scale = G.orb.r/94;
  preview.scale.set(scale);
  preview.position.set(G.orb.x-194*scale,G.orb.y-249*scale);
  stage.addChild(preview);
  // True circle instead of an aspect-ratio-dependent ellipse.
  graphics(preview, g => {
    g.circle(194, 249, 94).fill({ color: 0x295e65, alpha: 0.14 });
    g.circle(194, 249, 94).stroke({ color: 0x637ea0, width: 5 });
    g.circle(194, 249, 87).fill({ color: 0x72adbc, alpha: 0.27 });
    g.circle(176, 218, 42).fill({ color: 0xe0fdff, alpha: 0.11 });
    g.ellipse(194, 292, 67, 14).fill({ color: 0x967d57, alpha: 0.9 });
  });
  const plant = state.plots.P01.plant;
  if (!plant) {
    label(preview, "等待播种", 144, 245, 16, 0x4b707a);
    graphics(preview, g => g.ellipse(192, 287, 10, 6).fill(0xdbc78f));
  } else if (plant.stage === "Seed") {
    graphics(preview, g => g.ellipse(194, 281, 12, 7).fill(0xc9d69c));
  } else {
    line(preview, [195, 289, 192, 264, 198, 231, 190, 211, 203, 189], 0x84694a, 8);
    if (plant.stage === "Seedling") {
      line(preview, [195, 260, 175, 240], 0x88a85f, 5);
      line(preview, [196, 252, 215, 235], 0x88a85f, 5);
      graphics(preview, g => {
        g.ellipse(172, 235, 19, 9).fill(0x8aaf79);
        g.ellipse(216, 231, 19, 9).fill(0xa2c581);
      });
    } else {
      line(preview, [196, 251, 168, 226, 149, 216], 0x84694a, 5);
      line(preview, [197, 228, 223, 205, 235, 190], 0x84694a, 5);
      line(preview, [197, 270, 226, 249, 243, 247], 0x84694a, 5);
      plant.leaves.forEach((leaf, i) => {
        const points = [[155, 217], [235, 193], [245, 246]];
        const [x, y] = points[i % 3];
        graphics(preview, g => g.ellipse(x, y, 23, 12)
          .fill({ color: leaf.stage === "SmallLeaf" ? 0x9abc82 : 0x86ba7b })
          .stroke({ color: 0x4a6d50, width: 2 }));
        const fruit = leaf.fruit;
        if (fruit) {
          graphics(preview, g => g.circle(x + 12, y + 20,
            fruit.stage === "MatureFruit" ? 12 : 7)
            .fill(fruit.stage === "MatureFruit" ? 0xffc477 : 0xb0d17a)
            .stroke({ color: 0x927653, width: 2 }));
        }
      });
    }
  }
  graphics(preview, g => g.arc(171, 220, 68, -2.55, -1.65)
    .stroke({ color: 0xe3f5eb, alpha: 0.7, width: 6 }));
}
function counter(stage: Container) {
  polygon(stage,U_POLYGON,PALETTE.wood,PALETTE.dark,5);
  line(stage,[385,580,420,568,520,492,560,480,1040,480,1080,492,1180,568,1215,580],0x86684a,5);
  rect(stage,510,405,580,39,0xb7a07c);
  polygon(stage,[40,505,68,480,240,480,220,545,40,545],0xc2d1d1,0x55717a,3);
  rounded(stage,...G.peel,8,0xc1b49a,0x7a6040,3);
  rounded(stage,...G.machine,7,0x9aaeb0,0x647a79,3);
  rounded(stage,...G.machineFoot,4,0x788b88,0x647a79,2);
}
function cabinets(stage: Container) {
  polygon(stage,G.floor,0x8daaa0);
  polygon(stage,G.rug,0x84a78b,0x7a9072,2);
  polygon(stage,G.leftCabinet,0xc1b8ae,0x5b584c,4);
  polygon(stage,G.leftInner,0x9d9284,0x5b584c,4);
  polygon(stage,G.middleCabinet,0xc1b4a5,0x5b584c,4);
  polygon(stage,G.rightInner,0x9d9284,0x5b584c,4);
  polygon(stage,G.rightCabinet,0xc1b8ae,0x5b584c,4);
  rect(stage,...G.storage,0xa8b7a4,0x6b736c,3);
  rect(stage,...G.inventory,0xb5c3b8,0x777c71,3);
  rect(stage,560,490,480,45,0xd4c4a4,0x8d816b);
  rect(stage,560,540,340,185,0x796b5a,0x58422e,3);
  rect(stage,570,623,320,8,0xd4c4a4);
  for(const x of [590,630,670,710]) rounded(stage,x,584,27,35,4,0xdde1d8,0x647a79);
  rounded(stage,910,540,135,185,8,0x9aaeb0,0x647a79,3);
  line(stage,[915,600,1040,600],0x667974,3);
  line(stage,[925,558,925,583],0xe6e9df,5);
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
  rect(root, 0, 405, 1600, 460, 0xc2bcae);
  // Backdrop, then floor and cabinetry, then tabletop and equipment.
  // Separate Graphics layers ensure objects in front also cover earlier text.
  rect(root,0,405,1600,39,0xb7a07c);
  const back = new Container();
  root.addChild(back);
  orb(back,state);
  landscape(back,state);
  shelf(back);
  const front = new Container();
  root.addChild(front);
  cabinets(front);
  counter(front);

  const uHit = new Graphics();
  uHit.poly(U_POLYGON).fill({ color: 0xffffff, alpha: 0.001 });
  uHit.eventMode = "static";
  uHit.cursor = "default";
  uHit.hitArea = new Polygon(U_POLYGON);
  root.addChild(uHit);

  const ballHit = new Graphics();
  ballHit.circle(G.orb.x, G.orb.y, G.orb.r).fill({ color: 0xffffff, alpha: 0.001 });
  ballHit.eventMode = "static";
  ballHit.cursor = "pointer";
  ballHit.hitArea = new Circle(G.orb.x,G.orb.y,G.orb.r);
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
