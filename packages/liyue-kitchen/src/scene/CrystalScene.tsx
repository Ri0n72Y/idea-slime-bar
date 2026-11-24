import { useEffect, useRef, useState } from "react";
import { Application, Graphics, Polygon, Text } from "pixi.js";
import { ELEMENT_VIEW } from "../domain/config";
import type { GameState, PlotId } from "../domain/game";
import { fruitMass } from "../domain/game";
import { stageLabel } from "../domain/game";
import { growthStageLabel, plotLabel } from "../uiLabels";
import { plotGeometry } from "./plotGeometry";

export type SceneDropTarget = { plotId: PlotId | null; ground: { plotId: PlotId; x: number; y: number } | null };
type Props = {
  onHarvest: (plotId: PlotId, plantId: string, leafId: string) => void;
  onSelectItem: (itemId: string) => void;
  onStartGroundDrag: (itemId: string, pointerId: number, x: number, y: number) => void;
  state: GameState;
  hoverPlotId: PlotId | null;
  onChoose: (plotId: PlotId) => void;
  onCollect: (ballId: string) => void;
  /** Registers the actual Pixi cell hit-shapes for cross-layer React drag/drop. */
  onRegisterDropTarget: (pick: (clientX: number, clientY: number) => SceneDropTarget) => () => void;
};
type PlotHit = { id: PlotId; shape: Polygon };

function draw(app: Application, state: GameState, hover: PlotId | null,
  choose: (id: PlotId) => void, collect: (id: string) => void,
  harvest: (plotId: PlotId, plantId: string, leafId: string) => void,
  selectItem: (id: string) => void,
  startItemDrag: (id: string, pointerId: number, x: number, y: number) => void): PlotHit[] {
  app.stage.removeChildren().forEach(child => child.destroy({ children: true }));
  const width = app.screen.width, height = app.screen.height;
  if (width <= 0 || height <= 0) return [];

  const { radius, positions } = plotGeometry(width, height);
  const cx = width / 2, cy = height / 2, orbRadius = radius * 2.96;
  const glow = new Graphics()
    .circle(cx, cy, orbRadius + 9).fill({ color: 0x9ccbbb, alpha: 0.08 })
    .circle(cx, cy, orbRadius).fill({ color: 0x18443e, alpha: 0.64 })
    .stroke({ width: 3, color: 0x81c9b9, alpha: 0.85 })
    .circle(cx, cy, orbRadius - 8).stroke({ width: 1, color: 0xc6e9db, alpha: 0.36 });
  glow.eventMode = "none";
  app.stage.addChild(glow);

  const plotHits: PlotHit[] = [];
  for (const pos of positions) {
    const plot = state.plots[pos.id];
    const selected = state.selectedPlotId === pos.id;
    const hovering = hover === pos.id;
    if (selected || hovering) {
      const ring = new Graphics().regularPoly(pos.x, pos.y, radius + 7, 6, Math.PI / 6)
        .stroke({ width: 4, color: selected ? 0xf4d78b : 0xade6c3 });
      ring.eventMode = "none";
      app.stage.addChild(ring);
    }
    const cell = new Graphics().regularPoly(pos.x, pos.y, radius * 0.94, 6, Math.PI / 6)
      .fill({ color: plot.open ? 0x3e866c : 0x293c3b, alpha: 0.95 })
      .stroke({ width: 2, color: plot.open ? 0xc2e6ac : 0x778884, alpha: 0.9 });
    // The same Polygon is used by Pixi pointertap and React→Pixi seed release.
    const points: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      points.push(pos.x + Math.cos(a) * radius * 0.94,
        pos.y + Math.sin(a) * radius * 0.94);
    }
    const shape = new Polygon(points);
    cell.hitArea = shape;
    cell.eventMode = "static";
    cell.cursor = "pointer";
    cell.on("pointertap", () => choose(pos.id));
    app.stage.addChild(cell);
    plotHits.push({ id: pos.id, shape });

    const label = new Text({
      text: plotLabel(pos.id),
      style: { fontFamily: "Arial, sans-serif", fontSize: Math.max(12, radius * 0.31),
        fontWeight: "bold", fill: plot.open ? 0xf0f9db : 0xc3ceca },
    });
    label.anchor.set(0.5);
    label.position.set(pos.x, pos.y - radius * 0.28);
    label.eventMode = "none";
    app.stage.addChild(label);

    const caption = new Text({
      text: plot.open ? (plot.plant ? growthStageLabel(stageLabel(state, pos.id)) : selected ? "已选中" : "可用") : "锁定",
      style: { fontFamily: "Arial, sans-serif", fontSize: Math.max(10, radius * 0.17),
        fill: plot.open ? 0xe4f2da : 0xb0c3bd, wordWrap: true,
        wordWrapWidth: radius * 1.6, align: "center" },
    });
    caption.anchor.set(0.5);
    caption.position.set(pos.x, pos.y + radius * 0.23);
    caption.eventMode = "none";
    app.stage.addChild(caption);
    if (plot.plant) {
      const treeMark = new Text({ text: plot.plant.stage === "Sapling" ? "🌱" : "•",
        style: { fontFamily: "Arial, sans-serif", fontSize: Math.max(13, radius * 0.36), fill: 0xd8ec9f } });
      treeMark.anchor.set(0.5);
      treeMark.position.set(pos.x, pos.y + radius * 0.52);
      treeMark.eventMode = "none";
      app.stage.addChild(treeMark);
      // A harvested fruit is absent from the living leaf; only actual MatureFruit may be tapped.
      plot.plant.leaves.forEach((leaf, index) => {
        if (!leaf.fruit) return;
        const offset = (index - 1) * radius * 0.43;
        const fx = pos.x + offset, fy = pos.y - radius * 0.57;
        const mature = leaf.fruit.stage === "MatureFruit";
        const fruitMark = new Graphics().circle(fx, fy, Math.max(10, radius * 0.20))
          .fill({ color: mature ? 0xf0d075 : 0x759987, alpha: 0.96 })
          .stroke({ color: mature ? 0xfff1c1 : 0x8daaa4, width: 2 });
        fruitMark.eventMode = "static";
        fruitMark.cursor = "pointer";
        fruitMark.on("pointertap", event => {
          event.stopPropagation();
          harvest(pos.id, plot.plant!.id, leaf.id);
        });
        app.stage.addChild(fruitMark);
        const fruitText = new Text({ text: mature ? "摘" : "果",
          style: { fontFamily: "Arial, sans-serif", fontSize: Math.max(10, radius * 0.17),
            fill: mature ? 0x35291d : 0xe6ede4, fontWeight: "bold" } });
        fruitText.anchor.set(0.5);
        fruitText.position.set(fx, fy);
        fruitText.eventMode = "none";
        app.stage.addChild(fruitText);
      });
    }
  }

  // Every loose ball is a real world item with a stable identity, rendered and collected by Pixi.
  for (const ball of Object.values(state.looseBalls)) {
    const angle = -Math.PI / 2 + (ball.slot / Math.max(1, state.dayCondenseLimit)) * 2 * Math.PI + 0.18;
    const bx = cx + Math.cos(angle) * (orbRadius + 18);
    const by = cy + Math.sin(angle) * (orbRadius + 18);
    const info = ELEMENT_VIEW[ball.element];
    const orb = new Graphics().circle(bx, by, Math.max(14, radius * 0.23))
      .fill({ color: info.color, alpha: 0.92 })
      .stroke({ width: 2, color: 0xe5eddc });
    orb.eventMode = "static";
    orb.cursor = "pointer";
    orb.on("pointertap", () => collect(ball.id));
    app.stage.addChild(orb);
    const icon = new Text({ text: info.icon,
      style: { fontFamily: "Arial, sans-serif", fontSize: Math.max(13, radius * 0.23) } });
    icon.anchor.set(0.5);
    icon.position.set(bx, by);
    icon.eventMode = "none";
    app.stage.addChild(icon);
  }
  // World objects render AFTER cells: their actual Pixi hit areas win overlaps.
  for (const item of Object.values(state.items)) {
    if (item.location.kind !== "ground") continue;
    const ix = item.location.x * width, iy = item.location.y * height;
    const selected = state.selectedItemId === item.id;
    const symbol = new Graphics().circle(ix, iy, Math.max(15, radius * 0.26))
      .fill({ color: 0xc4a461, alpha: 1 })
      .stroke({ color: selected ? 0xffef99 : 0x624923, width: selected ? 4 : 2 });
    symbol.eventMode = "static";
    symbol.cursor = "grab";
    symbol.on("pointerdown", event => {
      event.stopPropagation();
      const b = app.canvas.getBoundingClientRect();
      startItemDrag(item.id, event.pointerId,
        b.left + event.global.x * b.width / app.screen.width,
        b.top + event.global.y * b.height / app.screen.height);
    });
    symbol.on("pointertap", event => {
      event.stopPropagation();
      selectItem(item.id);
    });
    app.stage.addChild(symbol);
    const tag = new Text({ text: item.kind === "Seed" ? "种" : item.kind === "VisitorGift" ? "牌" : item.kind === "Shell" ? "壳" : item.kind === "RawJuice" ? "汁" :
      item.kind === "AquamelonJuiceCup" ? "杯" : "瓜",
      style: { fontFamily: "Arial, sans-serif", fontSize: Math.max(14, radius * 0.28),
        fill: 0x35291d, fontWeight: "bold" } });
    tag.anchor.set(0.5);
    tag.position.set(ix, iy);
    tag.eventMode = "none";
    app.stage.addChild(tag);
    const label = new Text({ text: item.kind === "Seed" ? "水瓜种子" : item.kind === "VisitorGift" ? "纪念物" : `${item.kind === "Shell" ? "0" : fruitMass(item).toFixed(1)}G`,
      style: { fontFamily: "Arial, sans-serif", fontSize: Math.max(10, radius * 0.18),
        fill: 0xf3e6ba } });
    label.anchor.set(0.5);
    label.position.set(ix, iy + Math.max(19, radius * 0.34));
    label.eventMode = "none";
    app.stage.addChild(label);
  }
  return plotHits;
}

/** A single Pixi app owns all plot/ball hit areas; React never guesses IDs from a CSS rectangle. */
export function CrystalScene({ state, hoverPlotId, onChoose, onCollect, onHarvest, onSelectItem, onStartGroundDrag, onRegisterDropTarget }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stateRef = useRef(state), hoverRef = useRef(hoverPlotId);
  const chooseRef = useRef(onChoose), collectRef = useRef(onCollect);
  const harvestRef = useRef(onHarvest), selectRef = useRef(onSelectItem), dragRef = useRef(onStartGroundDrag);
  const hitsRef = useRef<PlotHit[]>([]);
  const [error, setError] = useState("");
  stateRef.current = state;
  hoverRef.current = hoverPlotId;
  chooseRef.current = onChoose;
  collectRef.current = onCollect;
  harvestRef.current = onHarvest;
  selectRef.current = onSelectItem;
  dragRef.current = onStartGroundDrag;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let unregister: (() => void) | undefined;
    const app = new Application();
    const pick = (clientX: number, clientY: number): SceneDropTarget => {
      const empty: SceneDropTarget = { plotId: null, ground: null };
      if (!appRef.current) return empty;
      const bounds = app.canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0 || clientX < bounds.left || clientX > bounds.right ||
        clientY < bounds.top || clientY > bounds.bottom) return empty;
      const x = (clientX - bounds.left) * app.screen.width / bounds.width;
      const y = (clientY - bounds.top) * app.screen.height / bounds.height;
      const { radius } = plotGeometry(app.screen.width, app.screen.height);
      const dx = x - app.screen.width / 2, dy = y - app.screen.height / 2;
      const ground = dx * dx + dy * dy <= (radius * 2.96) ** 2
        ? { plotId: "P01" as PlotId, x: x / app.screen.width, y: y / app.screen.height }
        : null;
      return { plotId: hitsRef.current.find(hit => hit.shape.contains(x, y))?.id ?? null, ground };
    };
    void (async () => {
      try {
        await app.init({
          width: Math.max(1, host.clientWidth), height: Math.max(1, host.clientHeight),
          backgroundAlpha: 0, antialias: true, preference: "webgl",
          resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
        });
        if (disposed) { app.destroy({ removeView: true }, { children: true }); return; }
        appRef.current = app;
        app.canvas.dataset.testid = "crystal-canvas";
        app.canvas.setAttribute("aria-label", "七格洞天水晶球");
        app.canvas.style.display = "block";
        app.canvas.style.width = "100%";
        app.canvas.style.height = "100%";
        host.appendChild(app.canvas);
        const repaint = () => {
          app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
          hitsRef.current = draw(app, stateRef.current, hoverRef.current,
            id => chooseRef.current(id), id => collectRef.current(id),
            (plotId, plantId, leafId) => harvestRef.current(plotId, plantId, leafId),
            id => selectRef.current(id),
            (id, pointerId, x, y) => dragRef.current(id, pointerId, x, y));
        };
        observer = new ResizeObserver(repaint);
        observer.observe(host);
        repaint();
        unregister = onRegisterDropTarget(pick);
      } catch (cause) {
        if (!disposed) setError(`PixiJS 初始化失败：${String(cause)}`);
      }
    })();
    return () => {
      disposed = true;
      unregister?.();
      observer?.disconnect();
      hitsRef.current = [];
      if (appRef.current === app) {
        appRef.current = null;
        app.destroy({ removeView: true }, { children: true });
      }
    };
  }, [onRegisterDropTarget]);

  useEffect(() => {
    const app = appRef.current;
    if (app) hitsRef.current = draw(app, state, hoverPlotId,
      id => chooseRef.current(id), id => collectRef.current(id),
      (plotId, plantId, leafId) => harvestRef.current(plotId, plantId, leafId),
      id => selectRef.current(id),
      (id, pointerId, x, y) => dragRef.current(id, pointerId, x, y));
  }, [state, hoverPlotId]);

  return (
    <div className="crystal-host" ref={hostRef} data-testid="crystal-host" aria-label="七格洞天水晶球">
      {error && <p className="renderer-error" role="alert">{error}</p>}
    </div>
  );
}