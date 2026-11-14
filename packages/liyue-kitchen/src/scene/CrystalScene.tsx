import { useEffect, useRef, useState } from "react";
import { Application, Graphics, Text } from "pixi.js";
import type { GameState, PlotId } from "../domain/game";
import { plotGeometry } from "./plotGeometry";

type Props = { state: GameState; onChoose: (plotId: PlotId) => void };

function draw(app: Application, state: GameState, choose: (id: PlotId) => void): void {
  app.stage.removeChildren().forEach((child) => child.destroy({ children: true }));
  const width = app.screen.width;
  const height = app.screen.height;
  if (width <= 0 || height <= 0) return;

  const { radius, positions } = plotGeometry(width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const orbRadius = radius * 2.96;

  const glow = new Graphics()
    .circle(centerX, centerY, orbRadius + 9)
    .fill({ color: 0x9ccbbb, alpha: 0.08 })
    .circle(centerX, centerY, orbRadius)
    .fill({ color: 0x18443e, alpha: 0.64 })
    .stroke({ width: 3, color: 0x81c9b9, alpha: 0.85 })
    .circle(centerX, centerY, orbRadius - 8)
    .stroke({ width: 1, color: 0xc6e9db, alpha: 0.36 });
  glow.eventMode = "none";
  app.stage.addChild(glow);

  const backdrop = new Graphics();
  backdrop.moveTo(centerX - orbRadius * 0.8, centerY + orbRadius * 0.55)
    .quadraticCurveTo(centerX, centerY + orbRadius * 0.78, centerX + orbRadius * 0.8, centerY + orbRadius * 0.55)
    .stroke({ width: 2, color: 0x68a18b, alpha: 0.25 });
  backdrop.eventMode = "none";
  app.stage.addChild(backdrop);

  for (const pos of positions) {
    const plot = state.plots[pos.id];
    const selected = state.selectedPlotId === pos.id;
    if (selected) {
      const halo = new Graphics().regularPoly(pos.x, pos.y, radius + 7, 6, Math.PI / 6)
        .stroke({ width: 4, color: 0xf4d78b });
      halo.eventMode = "none";
      app.stage.addChild(halo);
    }

    const cell = new Graphics()
      .regularPoly(pos.x, pos.y, radius * 0.94, 6, Math.PI / 6)
      .fill({ color: plot.open ? 0x3e866c : 0x293c3b, alpha: 0.95 })
      .stroke({ width: 2, color: plot.open ? 0xc2e6ac : 0x778884, alpha: 0.9 });
    // Pixi owns hit testing; the UI never infers plot identity from fixed coordinates.
    cell.eventMode = "static";
    cell.cursor = "pointer";
    cell.on("pointertap", () => choose(pos.id));
    app.stage.addChild(cell);

    const label = new Text({
      text: pos.id,
      style: { fontFamily: "Arial, sans-serif", fontSize: Math.max(12, radius * 0.31), fontWeight: "bold", fill: plot.open ? 0xf0f9db : 0xc3ceca },
    });
    label.anchor.set(0.5);
    label.position.set(pos.x, pos.y - radius * 0.1);
    label.eventMode = "none";
    app.stage.addChild(label);

    const caption = new Text({
      text: plot.open ? (selected ? "已选中" : "可用") : "锁定",
      style: { fontFamily: "Arial, sans-serif", fontSize: Math.max(11, radius * 0.21), fill: plot.open ? 0xe4f2da : 0xb0c3bd },
    });
    caption.anchor.set(0.5);
    caption.position.set(pos.x, pos.y + radius * 0.25);
    caption.eventMode = "none";
    app.stage.addChild(caption);
  }
}

/** Mounts a single Pixi renderer; state changes only redraw its display objects. */
export function CrystalScene({ state, onChoose }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stateRef = useRef(state);
  const chooseRef = useRef(onChoose);
  const [error, setError] = useState("");

  stateRef.current = state;
  chooseRef.current = onChoose;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    const app = new Application();

    void (async () => {
      try {
        await app.init({
          width: Math.max(1, host.clientWidth),
          height: Math.max(1, host.clientHeight),
          backgroundAlpha: 0,
          antialias: true,
          preference: "webgl",
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
        });
        if (disposed) {
          app.destroy({ removeView: true }, { children: true });
          return;
        }
        appRef.current = app;
        app.canvas.dataset.testid = "crystal-canvas";
        app.canvas.setAttribute("aria-label", "七格洞天水晶球");
        app.canvas.style.display = "block";
        app.canvas.style.width = "100%";
        app.canvas.style.height = "100%";
        host.appendChild(app.canvas);
        const repaint = () => {
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          app.renderer.resize(width, height);
          draw(app, stateRef.current, (id) => chooseRef.current(id));
        };
        observer = new ResizeObserver(repaint);
        observer.observe(host);
        repaint();
      } catch (cause) {
        if (!disposed) setError(`PixiJS 初始化失败：${String(cause)}`);
      }
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      if (appRef.current === app) {
        appRef.current = null;
        app.destroy({ removeView: true }, { children: true });
      }
    };
  }, []);

  useEffect(() => {
    const app = appRef.current;
    if (app) draw(app, state, (id) => chooseRef.current(id));
  }, [state]);

  return (
    <div className="crystal-host" ref={hostRef} data-testid="crystal-host" aria-label="七格洞天水晶球">
      {error && <p className="renderer-error" role="alert">{error}</p>}
    </div>
  );
}
