import { useEffect, useRef, useState } from "react";
import { Application, Graphics, Polygon, Text } from "pixi.js";
import { ELEMENT_VIEW } from "../domain/config";
import type { GameState, PlotId } from "../domain/game";
import { stageLabel } from "../domain/game";
import { plotGeometry } from "./plotGeometry";

type Props = {
  state: GameState;
  hoverPlotId: PlotId | null;
  onChoose: (plotId: PlotId) => void;
  onCollect: (ballId: string) => void;
  /** Registers the actual Pixi cell hit-shapes for cross-layer React drag/drop. */
  onRegisterDropTarget: (pick: (clientX: number, clientY: number) => PlotId | null) => () => void;
};
type PlotHit = { id: PlotId; shape: Polygon };

function draw(app: Application, state: GameState, hover: PlotId | null,
  choose: (id: PlotId) => void, collect: (id: string) => void): PlotHit[] {
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
      text: pos.id,
      style: { fontFamily: "Arial, sans-serif", fontSize: Math.max(12, radius * 0.31),
        fontWeight: "bold", fill: plot.open ? 0xf0f9db : 0xc3ceca },
    });
    label.anchor.set(0.5);
    label.position.set(pos.x, pos.y - radius * 0.28);
    label.eventMode = "none";
    app.stage.addChild(label);

    const caption = new Text({
      text: plot.open ? (plot.plant ? stageLabel(state, pos.id) : selected ? "已选中" : "可用") : "锁定",
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
    }
  }

  // Every loose ball is a real world item with a stable identity, rendered and collected by Pixi.
  for (const ball of Object.values(state.looseBalls)) {
    const angle = -Math.PI / 2 + (ball.slot / 8) * 2 * Math.PI + 0.18;
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
  return plotHits;
}

/** A single Pixi app owns all plot/ball hit areas; React never guesses IDs from a CSS rectangle. */
export function CrystalScene({ state, hoverPlotId, onChoose, onCollect, onRegisterDropTarget }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stateRef = useRef(state), hoverRef = useRef(hoverPlotId);
  const chooseRef = useRef(onChoose), collectRef = useRef(onCollect);
  const hitsRef = useRef<PlotHit[]>([]);
  const [error, setError] = useState("");
  stateRef.current = state;
  hoverRef.current = hoverPlotId;
  chooseRef.current = onChoose;
  collectRef.current = onCollect;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let unregister: (() => void) | undefined;
    const app = new Application();
    const pick = (clientX: number, clientY: number): PlotId | null => {
      if (!appRef.current) return null;
      const bounds = app.canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0 || clientX < bounds.left || clientX > bounds.right ||
        clientY < bounds.top || clientY > bounds.bottom) return null;
      const x = (clientX - bounds.left) * app.screen.width / bounds.width;
      const y = (clientY - bounds.top) * app.screen.height / bounds.height;
      return hitsRef.current.find(hit => hit.shape.contains(x, y))?.id ?? null;
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
            id => chooseRef.current(id), id => collectRef.current(id));
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
      id => chooseRef.current(id), id => collectRef.current(id));
  }, [state, hoverPlotId]);

  return (
    <div className="crystal-host" ref={hostRef} data-testid="crystal-host" aria-label="七格洞天水晶球">
      {error && <p className="renderer-error" role="alert">{error}</p>}
    </div>
  );
}