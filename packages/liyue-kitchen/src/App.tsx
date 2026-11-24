import "./u2.css";
import "./u3.css";
import "./u4.css";
import "./batch-a.css";
import "./batch-b.css";
import "./batch-c.css";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import { ELEMENTS, ELEMENT_VIEW, U2_CONFIG } from "./domain/config";
import { gameStore } from "./domain/store";
import { fruitMass, remainingCondenses, stageLabel, OPENING_SOURCE, sourceKey, type GameItem, type ItemLocation, type PlotId, type WorkbenchSlot } from "./domain/game";
import { CrystalScene, type SceneDropTarget } from "./scene/CrystalScene";
import { WorkshopScene, workshopOverlay, workshopRectOverlay, WORKSHOP_GEOMETRY, type WorkshopZone } from "./scene/WorkshopScene";
import { ECONOMY_CANDIDATE } from "./domain/economy";
import type { KitchenOrder } from "./domain/orders";
import { visibleDiscoveries, type DiscoveryId } from "./domain/discovery";
import { COLLECT_BAG } from "./domain/technology";
import { VISITOR_ID, visitorChoices, visitorPresent } from "./domain/visitors";
import { growthStageLabel, itemLocationLabel, playerEventText, plotLabel } from "./uiLabels";
import { eligibleOrderItems, itemTitle, nextActionHint, orderItemTitle, orderSelectionWarning } from "./experience";
import "./experience.css";
import { SaveManager } from "./SaveManager";
import "./workshop.css";
import "./workshop-pixi.css";

/** Fixed, authored knowledge graph coordinates; hidden discoveries have no visible node/edge. */
const graphCoordinates: Record<DiscoveryId, { x: number; y: number }> = {
  A00: { x: 24, y: 250 }, A01: { x: 208, y: 40 },
  A02: { x: 208, y: 255 }, A07: { x: 208, y: 468 },
  A03: { x: 391, y: 40 }, A18: { x: 391, y: 255 },
  H01: { x: 575, y: 374 }, A11: { x: 391, y: 468 },
  A12: { x: 575, y: 40 }, A17: { x: 759, y: 40 },
  A14: { x: 948, y: 40 }, A13: { x: 759, y: 260 },
  A16: { x: 948, y: 468 },
  V01: { x: 24, y: 465 }, V02: { x: 575, y: 505 },
};
type DropTarget = { zone: "inventory" | "storage" | "orb" | WorkbenchSlot | null; scene: SceneDropTarget };
type Drag = {
  itemId: string; kind: GameItem["kind"];
  pointerId: number; x: number; y: number;
  originX: number; originY: number; target: DropTarget | null;
};
const emptyScene: SceneDropTarget = { plotId: null, ground: null };
function dropTargetAt(x: number, y: number,
  pick: ((x: number, y: number) => SceneDropTarget) | null,
  workshopPick: ((x: number, y: number) => WorkshopZone) | null): DropTarget {
  const element = document.elementFromPoint(x, y);
  const domZone = element?.closest("[data-item-drop-zone]")?.getAttribute("data-item-drop-zone");
  // In the workshop only the shared Pixi world geometry authorizes drops.
  // DOM targets still support interaction, but cannot enlarge device hit areas.
  const semantic = workshopPick?.(x, y);
  const polygonZone = semantic === "peel" || semantic === "juice" ||
    semantic === "storage" || semantic === "inventory" || semantic === "orb" ? semantic : null;
  return {
    zone: workshopPick ? polygonZone :
      domZone === "inventory" || domZone === "storage" ? domZone : null,
    scene: workshopPick ? emptyScene : pick?.(x, y) ?? emptyScene,
  };
}

export function App() {
  const state = useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot);
  const ready = useSyncExternalStore(gameStore.subscribe, gameStore.isReady);
  const saveStatus = useSyncExternalStore(gameStore.subscribe, gameStore.getSaveStatus);
  const saveError = useSyncExternalStore(gameStore.subscribe, gameStore.getError);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const pickRef = useRef<((x: number, y: number) => SceneDropTarget) | null>(null);
  const workshopPickRef = useRef<((x: number, y: number) => WorkshopZone) | null>(null);
  const registerWorkshopPick = useCallback((pick: (x: number, y: number) => WorkshopZone) => {
    workshopPickRef.current = pick;
    return () => { if (workshopPickRef.current === pick) workshopPickRef.current = null; };
  }, []);
  // Real touch and CDP drag gestures may suppress the synthesized click.
  // A tap activates on pointer-up and ignores its subsequent synthetic click.
  const buttonTouchStart = useRef<{ key: string; id: number; x: number; y: number } | null>(null);
  const lastButtonTouch = useRef<{ at: number; x: number; y: number } | null>(null);
  const tapAction = (key: string, action: () => void) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === "touch")
        buttonTouchStart.current = { key, id: e.pointerId, x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerType !== "touch") return;
      const start = buttonTouchStart.current;
      buttonTouchStart.current = null;
      if (!start || start.key !== key || start.id !== e.pointerId ||
        Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) return;
      lastButtonTouch.current = { at: Date.now(), x: e.clientX, y: e.clientY };
      action();
    },
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === "touch") buttonTouchStart.current = null;
    },
    onClick: (e: ReactMouseEvent<HTMLButtonElement>) => {
      if (e.detail > 0 && lastButtonTouch.current &&
        Date.now() - lastButtonTouch.current.at < 1000 &&
        Math.hypot(e.clientX - lastButtonTouch.current.x,
          e.clientY - lastButtonTouch.current.y) < 16) return;
      action();
    },
  });
  const [reportDismissed, setReportDismissed] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [scene, setScene] = useState<"workshop" | "garden">("workshop");
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const navigateScene = (destination: "workshop" | "garden") => {
    dragRef.current = null;
    setDrag(null);
    setScene(destination);
  };
  const [saveManagerOpen, setSaveManagerOpen] = useState(false);
  const [worldEpoch, setWorldEpoch] = useState(0);
  const worldChanged = () => {
    dragRef.current = null;
    setDrag(null);
    setMapOpen(false);
    setScene("workshop");
    setReportDismissed(null);
    setWorldEpoch(epoch => epoch + 1);
    setSaveManagerOpen(false);
  };
  const [showGuidance, setShowGuidance] = useState(() => {
    try { return window.localStorage.getItem("liyue-kitchen-guidance") !== "hidden"; }
    catch { return true; }
  });
  useEffect(() => {
    try { window.localStorage.setItem("liyue-kitchen-guidance", showGuidance ? "shown" : "hidden"); }
    catch { /* browser storage unavailable: in-session toggle still works */ }
  }, [showGuidance]);
  const [graphZoom, setGraphZoom] = useState(1);
  const graphViewportRef = useRef<HTMLDivElement | null>(null);
  const navigateGraph = (direction: -1 | 1) => {
    const viewport = graphViewportRef.current;
    if (viewport) viewport.scrollBy({ left: direction * Math.max(280, viewport.clientWidth * 0.7), behavior: "smooth" });
  };

  useEffect(() => { void gameStore.start().catch(() => {}); }, []);
  const registerDropTarget = useCallback((pick: (x: number, y: number) => SceneDropTarget) => {
    pickRef.current = pick;
    return () => { if (pickRef.current === pick) pickRef.current = null; };
  }, []);
  const choosePlot = (plotId: PlotId) => gameStore.dispatch({ type: "SELECT_PLOT", plotId });
  const collectBall = (ballId: string) => gameStore.dispatch({ type: "COLLECT_BALL", ballId });
  const harvestFruit = (plotId: PlotId, plantId: string, leafId: string) =>
    gameStore.dispatch({ type: "HARVEST", plotId, plantId, leafId });
  const selectItem = (itemId: string) => gameStore.dispatch({ type: "SELECT_ITEM", itemId });
  const beginDrag = (itemId: string, pointerId: number, x: number, y: number) => {
    const item = gameStore.getSnapshot().items[itemId];
    if (!item || !gameStore.isReady() || gameStore.getSnapshot().phase !== "DAY_WORK") return;
    const next: Drag = { itemId, kind: item.kind, pointerId, x, y,
      originX: x, originY: y, target: null };
    dragRef.current = next;
    setDrag(next);
  };
  const startGroundDrag = (itemId: string, pointerId: number, x: number, y: number) =>
    beginDrag(itemId, pointerId, x, y);
  const startDrag = (event: ReactPointerEvent, itemId: string) => {
    if (!ready || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    beginDrag(itemId, event.pointerId, event.clientX, event.clientY);
  };
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const target = dropTargetAt(event.clientX, event.clientY, pickRef.current, sceneRef.current === "workshop" ? workshopPickRef.current ?? (() => null) : null);
      const next = { ...current, x: event.clientX, y: event.clientY, target };
      dragRef.current = next;
      setDrag(next);
    };
    const up = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const target = dropTargetAt(event.clientX, event.clientY, pickRef.current, sceneRef.current === "workshop" ? workshopPickRef.current ?? (() => null) : null);
      dragRef.current = null;
      setDrag(null);
      if (Math.hypot(event.clientX - current.originX, event.clientY - current.originY) < 8) return;
      if (target.zone === "orb") {
        gameStore.dispatch({ type: "ENTER_ORB", itemId: current.itemId });
      } else if (current.kind === "Seed") {
        if (target.scene.plotId && !target.zone)
          gameStore.dispatch({ type: "PLANT_SEED", itemId: current.itemId, plotId: target.scene.plotId });
        else if (target.scene.ground && !target.zone)
          gameStore.dispatch({ type: "MOVE_ITEM", itemId: current.itemId, destination: { kind: "ground", ...target.scene.ground } });
        else gameStore.dispatch({ type: "REJECT_DROP", reason: sceneRef.current === "workshop"
          ? "将真实种子拖到水晶球圆形区域内，再进入园地播种；种子未消耗。"
          : "种子需拖到园地里已开垦、空置的地格；未消耗种子。" });
      } else {
        const destination: ItemLocation | null =
          target.zone === "peel" || target.zone === "juice"
            ? { kind: "workbench", slot: target.zone }
            : target.zone ? { kind: target.zone } :
              target.scene.ground ? { kind: "ground", ...target.scene.ground } : null;
        if (destination) gameStore.dispatch({ type: "MOVE_ITEM", itemId: current.itemId, destination });
        else gameStore.dispatch({ type: "REJECT_DROP", reason: "请将材料放在地面、物品栏、仓储或工作台。物品未移动。" });
      }
    };
    const cancel = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      dragRef.current = null;
      setDrag(null);
      gameStore.dispatch({ type: "REJECT_DROP", reason: "已取消拖放，物品位置不变。" });
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dragRef.current) return;
      dragRef.current = null;
      setDrag(null);
      gameStore.dispatch({ type: "REJECT_DROP", reason: "已取消拖放，物品位置不变。" });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", escape);
    };
  }, []);

  if (!ready) return (
    <main className="loading" data-testid="loading-save">
      <h1>璃月厨房 · 还得自己种</h1>
      <p>{saveError || "正在读取洞天存档…"}</p>
    </main>
  );

  const selectedItem = state.selectedItemId ? state.items[state.selectedItemId] : undefined;
  const inventoryItems = Object.values(state.items).filter(item => item.location.kind === "inventory");
  const storageItems = Object.values(state.items).filter(item => item.location.kind === "storage");
  const benchItems = Object.values(state.items).filter(item => item.location.kind === "workbench");
  const peelItem = benchItems.find(item => item.location.kind === "workbench" && item.location.slot === "peel");
  const juiceItem = benchItems.find(item => item.location.kind === "workbench" && item.location.slot === "juice");
  const itemLabel = itemTitle;
  const activeOrders = Object.values(state.orders).filter(o => o.state === "available" || o.state === "accepted");
  const recentOrders = Object.values(state.orders).filter(
    o => o.state === "completed" || o.state === "expired").slice(-2).reverse();
  const orderName = orderItemTitle;
  const chooseOrderItem = (id: string) => {
    if (state.selectedItemId !== id) gameStore.dispatch({ type: "SELECT_ITEM", itemId: id });
  };
  const deliver = (o: KitchenOrder) => {
    const kind = o.itemKind === "aquamelon" ? "Aquamelon" : "AquamelonJuiceCup";
    // The explicitly selected material wins, even when invalid; domain returns a rejection.
    const preferred = state.selectedItemId && state.items[state.selectedItemId] ?
      [state.selectedItemId] : [];
    // A deliberate invalid selection remains visible to the domain guard.
    // For configured multi-item commissions, fill only the remaining slots.
    const additional = Object.values(state.items)
      .filter(item => item.kind === kind && !preferred.includes(item.id) &&
        (item.location.kind === "storage" || item.location.kind === "inventory"))
      .slice(0, Math.max(0, o.quantity - preferred.length)).map(item => item.id);
    const candidate = [...preferred, ...additional];
    gameStore.dispatch({ type: "DELIVER_ORDER", orderId: o.id, itemIds: candidate });
  };
  const discoveries = visibleDiscoveries(state);
  const visibleNodeIds = new Set(discoveries.map(x => x.node.id));
  const discoveredCount = discoveries.filter(x => x.status === "completed").length;
  const eligibleForBag = state.labor.manualBallIds.length >= COLLECT_BAG.manualRequired &&
    !!state.discoveries.A18;
  const report = state.lastNightReport;
  const visiting = visitorPresent(state);
  const choices = visitorChoices(state);
  const showReport = !!report && report.toDay !== reportDismissed;
  const visitorPanel = (
<section className="region visitors" aria-label="访客区" data-testid="region-visitors">
          <h2>访客与对话</h2>
          {visiting ? (
            <div className="visitor-panel" data-testid="visitor-panel" data-visitor-id={VISITOR_ID}>
              <div className="visitor-identity">
                <div className="visitor-portrait" role="img" aria-label="阿砚的临时肖像占位，美术立绘待审核">
                  <div className="portrait-silhouette"><span /></div>
                </div>
                <div>
                  <strong data-testid="visitor-name">旅人 · 阿砚</strong>
                  <small>山道商路的行脚旅人</small>
                  <small>正式立绘待美术确认</small>
                </div>
              </div>
              <p className="visitor-line" data-testid="visitor-line">{state.visitor.lastLine}</p>
              <div className="visitor-actions" data-testid="visitor-choices">
                {choices.map(choice => (
                  <button type="button" key={choice.id}
                    data-testid={`visitor-choice-${choice.id}`}
                    title={choice.hint}
                    disabled={state.phase !== "DAY_WORK"}
                    {...tapAction(`visitor-${choice.id}`, () => gameStore.dispatch({ type: "TALK_VISITOR",
                      visitorId: VISITOR_ID, action: choice.id }))}>
                    {choice.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="quiet-panel" data-testid="visitor-absent">
              <span className="icon-disc">客</span>
              <p>尚无访客</p>
              <small>完成真实夜间生长后，旅人可能来访</small>
            </div>
          )}
          {report && <button type="button" className="report-reopen" data-testid="reopen-report"
            onClick={() => setReportDismissed(null)}>查看第 {report.fromDay} 天夜间简报</button>}
        </section>
  );
  const crystalPanel = (
<section className="region crystal-region" aria-label="洞天水晶球" data-testid="region-crystal">
          <div className="crystal-title">
            <h2>洞天水晶球</h2>
            <span>{Object.keys(state.looseBalls).length} 枚元素球待收集 · 点击收集</span>
          </div>
          <CrystalScene key={worldEpoch} state={state} hoverPlotId={drag?.target?.scene.plotId ?? null}
            onChoose={choosePlot} onCollect={collectBall} onHarvest={harvestFruit}
            onSelectItem={selectItem} onStartGroundDrag={startGroundDrag}
            onRegisterDropTarget={registerDropTarget} />
          <div className="crystal-footer">
            <span data-testid="selected-plot">当前地格：{state.selectedPlotId ? plotLabel(state.selectedPlotId) : "未选择"}</span>
            <span data-testid="plant-stage">{state.selectedPlotId ? growthStageLabel(stageLabel(state, state.selectedPlotId)) : "拖放种子至开放地格"}</span>
            <div className="plot-purchases" data-testid="plot-purchases">
              {(["P02", "P03", "P04", "P05", "P06", "P07"] as const)
                .filter(id => !state.plots[id].open).map(id => (
                <button key={id} type="button" data-testid={`unlock-${id}`}
                  disabled={state.phase !== "DAY_WORK"}
                  onClick={() => gameStore.dispatch({ type: "UNLOCK_PLOT", plotId: id })}>
                  开垦{plotLabel(id)} · {ECONOMY_CANDIDATE.plotCosts[id]}仙力
                </button>
              ))}
            </div>
          </div>
        </section>
  );
  const ordersPanel = (
<section className="region orders" aria-label="限时委托" data-testid="region-orders">
            <h2>限时委托</h2>
            <div className="orders-scroller">
            {activeOrders.length ? activeOrders.map(order => (
              <div className="order-panel" key={order.id} data-testid="active-order"
                data-order-id={order.id} data-visitor-id={order.visitorId}>
                <p data-testid="order-requirement" className="order-primary-label">
                  {order.visitorId === "board" ? "委托板" : "旅人阿砚"} · {orderName(order)} × {order.quantity}
                </p>
                <details className="order-details">
                  <summary>委托详情</summary>
                  <p data-testid="order-origin">{order.visitorId === "board" ? "委托板" : "旅人阿砚"}</p>
                  <p data-testid="order-deadline">第 {order.dueDay} 天截止（含当日）</p>
                  <p>奖励 {order.rewards} 洞天仙力</p>
                  <p data-testid="order-status">{order.state === "available" ? "待接受" : "已接受"}</p>
                  <p className="order-location-hint" data-testid={`order-location-${order.id}`}>
                    交单材料须放入物品栏或仓储区；水晶球地面的水瓜需先搬运。
                  </p>
                </details>
                {order.state === "available" ? (
                  <button type="button" className="order-main-action" data-testid="accept-order" disabled={state.phase !== "DAY_WORK"}
                    {...tapAction(`accept-${order.id}`, () => gameStore.dispatch({ type: "ACCEPT_ORDER", orderId: order.id }))}>
                    接受委托
                  </button>
                ) : (
                  <>
                    {orderSelectionWarning(state, order) && (
                      <p className="order-warning" role="status"
                        data-testid={`order-warning-${order.id}`}>
                        {orderSelectionWarning(state, order)}
                      </p>
                    )}
                    {eligibleOrderItems(state, order).length > 0 && (
                      <div className="order-candidates" data-testid={`order-candidates-${order.id}`}
                        aria-label="本单可交付材料">
                        {eligibleOrderItems(state, order).map(item => (
                          <button key={item.id} type="button"
                            data-testid={`choose-order-${order.id}-${item.id}`}
                            aria-pressed={state.selectedItemId === item.id}
                            disabled={state.phase !== "DAY_WORK"}
                            onClick={() => chooseOrderItem(item.id)}>
                            {state.selectedItemId === item.id ? "已选：" : "选用："}{itemTitle(item)}
                            （{item.location.kind === "storage" ? "仓储" : "物品栏"}）
                          </button>
                        ))}
                      </div>
                    )}
                    <button type="button" className="order-main-action" data-testid="deliver-order" disabled={state.phase !== "DAY_WORK"}
                      {...tapAction(`deliver-${order.id}`, () => deliver(order))}>交付选中物品 / 仓储材料</button>
                  </>
                )}
              </div>
            )) : <p className="hint">暂无可交付委托</p>}
            {recentOrders.map(o => <p key={o.id} className="order-history" data-testid="order-history">
              {o.visitorId === "board" ? "委托板" : "旅人阿砚"} · {orderName(o)} · {o.state === "completed" ? "已交付" : "已过期"}
            </p>)}
            </div>

          </section>
  );
  const explorationPanel = (
<section className="region exploration" aria-label="探索地图" data-testid="region-exploration">
            <h2>探索地图</h2>
            <div className="exploration-summary">
              <strong data-testid="discovery-progress">已发现 {discoveredCount} 项</strong>
              <small>通过真实种植、加工与交付留下证据</small>
            </div>
            <button type="button" data-testid="open-discoveries" onClick={() => setMapOpen(true)}>
              查看探索图谱与科技
            </button>
          </section>
  );
  const peelPanel = (
<section className="region peeling" aria-label="剥壳工作台" data-testid="region-peeling">
          <h2>剥壳工作台</h2>
          <div className="workbench-placeholder workbench-drop" style={workshopRectOverlay(WORKSHOP_GEOMETRY.peel, "peel")} data-item-drop-zone="peel" data-testid="peel-drop">
            {peelItem ? (
              <div className="seed-item workbench-item" role="button" tabIndex={0}
                data-testid="peel-item" data-item-id={peelItem.id}
                onPointerDown={e => startDrag(e, peelItem.id)}
                onClick={() => selectItem(peelItem.id)}
                onKeyDown={e => { if (e.key === "Enter") selectItem(peelItem.id); }}>
                🍈 <small>{itemLabel(peelItem)}</small>
              </div>
            ) : <><span>◎</span><p>拖入完整水瓜</p></>}
          </div>
          <button type="button" data-testid="peel-action"
            disabled={state.phase !== "DAY_WORK" || peelItem?.kind !== "Aquamelon"}
            {...tapAction("peel", () => peelItem && gameStore.dispatch({ type: "PROCESS_ITEM", itemId: peelItem.id, action: "PEEL" }))}>剥壳</button>
        </section>
  );
  const inventoryPanel = (
<section className="region inventory" aria-label="物品栏" data-testid="region-inventory" data-item-drop-zone="inventory">
            <h2>工作桌 · 物品栏 <small>{inventoryItems.length} 件</small></h2>
            <div className="inventory-line">
{inventoryItems.map(item => (
                <div key={item.id} role="button" tabIndex={0}
                  aria-label={item.kind === "Seed" ? "拖拽水瓜种子" : `拖拽${itemLabel(item)}`}
                  className="seed-item" data-testid={item.kind === "Seed" ? "seed-item" : "fruit-inventory"}
                  data-item-id={item.id}
                  onPointerDown={e => startDrag(e, item.id)}
                  onClick={() => item.kind !== "Seed" && selectItem(item.id)}
                  onKeyDown={e => { if (e.key === "Enter") selectItem(item.id); }}>
                  <span>{item.kind === "Seed" ? "🌰" : item.kind === "Shell" ? "🐚" : item.kind === "VisitorGift" ? "🎴" : "🍈"}</span>
                  <small>{itemLabel(item)}</small>
                </div>
              ))}
              {!inventoryItems.length && <p className="hint">暂无物品</p>}
              <span className="hint">成熟水瓜留种一枚；拖动后续种子播种，旧树已采完可换种</span>
            </div>
          </section>
  );
  const storagePanel = (
<section className="region storage" aria-label="仓储区" data-testid="region-storage" data-item-drop-zone="storage">
            <h2>仓储区 <small>{storageItems.length} 件物品 · 元素养分已收集 {state.heldElements.reduce((a, b) => a + b, 0).toFixed(0)}V</small></h2>
            <div className="held-elements" data-testid="held-elements">
              {scene === "garden" && ELEMENTS.map(element => {
                const v = state.heldElements[ELEMENTS.indexOf(element)];
                if (v <= 0) return null;
                const info = ELEMENT_VIEW[element];
                return <button key={element} type="button" data-testid={`water-${element}`} aria-label={`向所选地格浇灌${info.name}元素`}
                  style={{ borderColor: info.css }} disabled={!state.selectedPlotId || state.phase !== "DAY_WORK"}
                  onClick={() => state.selectedPlotId && gameStore.dispatch({ type: "WATER_PLOT", element, plotId: state.selectedPlotId })}>
                  {info.icon} {info.name} · 浇灌</button>;
              })}
              {scene === "garden" && !state.heldElements.some(v => v > 0) && <p className="hint">收集元素球后在此选择浇灌</p>}
              {storageItems.map(item => (
                <div key={item.id} role="button" tabIndex={0} className="seed-item"
                  data-testid="fruit-storage" data-item-id={item.id}
                  onPointerDown={e => startDrag(e, item.id)} onClick={() => selectItem(item.id)}
                  onKeyDown={e => { if (e.key === "Enter") selectItem(item.id); }}>
                  {item.kind === "Shell" ? "🐚" : item.kind === "VisitorGift" ? "🎴" : "🍈"} <small>{itemLabel(item)}</small>
                </div>
              ))}
            </div>
          </section>
  );
  const juicePanel = (
<section className="region juicing" aria-label="榨汁与装杯" data-testid="region-juicing">
          <h2>榨汁与装杯</h2>
          <div className="workbench-placeholder workbench-drop" style={workshopRectOverlay(WORKSHOP_GEOMETRY.machine, "juice")} data-item-drop-zone="juice" data-testid="juice-drop">
            {juiceItem ? (
              <div className="seed-item workbench-item" role="button" tabIndex={0}
                data-testid="juice-item" data-item-id={juiceItem.id}
                onPointerDown={e => startDrag(e, juiceItem.id)}
                onClick={() => selectItem(juiceItem.id)}
                onKeyDown={e => { if (e.key === "Enter") selectItem(juiceItem.id); }}>
                🧃 <small>{itemLabel(juiceItem)}</small>
              </div>
            ) : <><span>◉</span><p>拖入果肉 · 装杯机自带容器</p></>}
          </div>
          <div className="actions">
            <button type="button" data-testid="juice-action"
              disabled={state.phase !== "DAY_WORK" || juiceItem?.kind !== "PeeledFlesh"}
              {...tapAction("juice", () => juiceItem && gameStore.dispatch({ type: "PROCESS_ITEM", itemId: juiceItem.id, action: "JUICE" }))}>榨汁</button>
            <button type="button" data-testid="cup-action"
              disabled={state.phase !== "DAY_WORK" || juiceItem?.kind !== "RawJuice"}
              {...tapAction("cup", () => juiceItem && gameStore.dispatch({ type: "PROCESS_ITEM", itemId: juiceItem.id, action: "CUP" }))}>装杯</button>
          </div>
        </section>
  );
  return (
    <div className={`game-shell ${scene === "workshop" ? "workshop-shell" : "garden-shell"}`}>
      <header className="header-area region" data-testid="region-header">
        <div className="brand">
          <span className="brand-kicker">LIYUE · KITCHEN</span>
          <h1>璃月厨房 <small>还得自己种</small></h1>
        </div>
        <div className="header-stats">
          <span className="pill" data-testid="day">第 {state.day} 天</span>
          <span className="pill" data-testid="energy">洞天仙力 {state.adeptalEnergy.balance}</span>
          <span className="pill" data-testid="quota">凝聚 {remainingCondenses(state)}/{state.dayCondenseLimit}</span>
        </div>
        {scene === "garden" && <button type="button" className="action" data-testid="back-workshop"
          onClick={() => navigateScene("workshop")}>返回工坊</button>}
        <button type="button" className="action" data-testid="condense" disabled={state.phase !== "DAY_WORK" || remainingCondenses(state) <= 0}
          onClick={() => gameStore.dispatch({ type: "CONDENSE" })}>凝聚元素</button>
        {state.technology.collectBag && (
          <button type="button" className="action" data-testid="collect-all"
            disabled={state.phase !== "DAY_WORK" || !Object.keys(state.looseBalls).length}
            onClick={() => gameStore.dispatch({ type: "COLLECT_ALL_BALLS" })}>
            收集袋 · 全部收集
          </button>
        )}
        <button type="button" className="action" data-testid="save-open" onClick={() => setSaveManagerOpen(true)}>存档</button>
        <button type="button" className="action" data-testid="end-day" disabled={state.phase !== "DAY_WORK"}
          onClick={() => gameStore.dispatch({ type: "REQUEST_END_DAY" })}>结束今日</button>
      </header>

      {scene === "workshop" ? (
        <main className="workshop-scene workshop-pixi-scene" data-testid="workshop-scene"
          aria-label="璃月厨房工坊与 U 型连体柜台">
          <WorkshopScene state={state} onEnterGarden={() => { if (!dragRef.current) navigateScene("garden"); }}
            onRegisterHitTest={registerWorkshopPick} />
          {Object.values(state.items).map(item => item.location.kind === "workshop-ground" &&
            <button type="button" key={item.id} className="workshop-ground-item seed-item"
              style={workshopRectOverlay([item.location.x - 24, item.location.y - 24, 48, 48])}
              data-testid="workshop-ground-seed" data-item-id={item.id}
              aria-label="拖动工坊地面的水瓜种子" onPointerDown={e => startDrag(e, item.id)}
              onClick={() => selectItem(item.id)}>🌰</button>)}
          {state.opening && <section className="opening-task-board" style={workshopOverlay("tasks")}
            aria-label="开局任务板" data-testid="opening-task-board">
            <h2>开局任务</h2>
            <p data-testid="task-plant" data-completed={!!state.opening.plantedPlantId}>
              {state.opening.plantedPlantId ? "✓" : "○"} 将种子带入水晶球并播种</p>
            <p data-testid="task-juice" data-completed={!!state.opening.firstCupOrderId}>
              {state.opening.firstCupOrderId ? "✓" : "○"} 加工并交付首杯水瓜汁</p>
          </section>}
          <section className="region garden-entry workshop-orb-overlay" style={workshopOverlay("orb")} aria-label="水晶球设备"
            data-testid="garden-entry">
            <button type="button" className="workshop-orb-link" data-testid="enter-garden"
              {...tapAction("enter-garden", () => navigateScene("garden"))}>
              <strong>前往园地</strong>
              <small>查看植物、元素球与采摘</small>
            </button>
            <span className="workshop-orb-accessible" data-testid="orb-plant-preview"
              data-stage={state.plots.P01.plant?.stage ?? "Empty"}
              data-leaf-count={state.plots.P01.plant?.leaves.length ?? 0}>
              {state.plots.P01.plant ? growthStageLabel(state.plots.P01.plant.stage) : "空地"}
            </span>
            <span className="garden-overview" data-testid="garden-overview">
              已开垦 {Object.values(state.plots).filter(p => p.open).length}/7 格 ·
              待收集元素球 {Object.keys(state.looseBalls).length} 枚 ·
              挂果 {Object.values(state.plots).reduce((n, plot) =>
                n + (plot.plant?.leaves.filter(leaf => leaf.fruit !== null).length ?? 0), 0)} 枚
            </span>
          </section>
          <div className="workshop-customer-overlay" style={workshopOverlay("customer")} data-testid="customer-window">
            {visitorPanel}
          </div>
          <div className="workshop-shelf-overlay" style={workshopOverlay("shelf")} data-testid="display-shelf">
            {explorationPanel}
          </div>
          <div className="workshop-left-overlay" style={workshopOverlay("left")} data-testid="counter-left">
            <div className="workshop-machines-overlay">
              <div className="workshop-device-control" style={workshopOverlay("peel","left")}>{peelPanel}</div>
              <div className="workshop-device-control" style={workshopOverlay("juice","left")}>{juicePanel}</div>
            </div>
          </div>
          <div className="workshop-center-overlay" style={workshopOverlay("order")} data-testid="counter-middle">
            {ordersPanel}
          </div>
          <div className="workshop-right-overlay" style={workshopOverlay("right")} data-testid="counter-right"
            aria-label="右侧操作台（目前保留设备扩展位）" />
          <div className="workshop-cabinet-overlay" style={workshopOverlay("cabinets")} data-testid="counter-cabinets">
            <div className="workshop-storage-overlay" style={workshopOverlay("storage","cabinets")}>{storagePanel}</div>
            <div className="workshop-inventory-overlay" style={workshopOverlay("inventory","cabinets")}>{inventoryPanel}</div>
          </div>
        </main>
      ) : (
        <main className="garden-scene" data-testid="garden-scene">
          {crystalPanel}
          <aside className="garden-sidebar" aria-label="园地收纳与浇灌">
            {inventoryPanel}
            {storagePanel}
            {explorationPanel}
          </aside>
        </main>
      )}

      {mapOpen && (
        <div className="dialog-backdrop discovery-dialog" role="dialog" aria-modal="true"
          aria-label="探索图谱与科技" data-testid="discovery-dialog">
          <div className="dialog-pane discovery-pane">
            <header className="discovery-pane-header">
              <h2>探索图谱</h2>
              <button type="button" data-testid="close-discoveries" onClick={() => setMapOpen(false)}>
                返回洞天
              </button>
            </header>
            <div className="graph-controls">
              <p className="hint" data-testid="graph-navigation-hint">向右滚动或滑动查看后续发现；节点由实际行动点亮，尚未遇见的线索不会提前显示。</p>
              <button type="button" data-testid="graph-left" aria-label="查看左侧探索节点"
                onClick={() => navigateGraph(-1)}>向左查看</button>
              <button type="button" data-testid="graph-right" aria-label="查看右侧探索节点"
                onClick={() => navigateGraph(1)}>向右查看</button>
              <button type="button" data-testid="zoom-out"
                disabled={graphZoom <= 1}
                onClick={() => setGraphZoom(z => Math.max(1, +(z - 0.1).toFixed(2)))}>
                缩小
              </button>
              <span data-testid="graph-zoom">{Math.round(graphZoom * 100)}%</span>
              <button type="button" data-testid="zoom-in"
                disabled={graphZoom >= 1.5}
                onClick={() => setGraphZoom(z => Math.min(1.5, +(z + 0.1).toFixed(2)))}>
                放大
              </button>
            </div>
            <div className="discovery-viewport" data-testid="discovery-viewport" ref={graphViewportRef}
              tabIndex={0} aria-label="探索节点图，使用方向键或左右按钮浏览">
              <div className="discovery-zoom-space"
                style={{ width: 1140 * graphZoom, height: 660 * graphZoom }}>
                <div className="discovery-graph"
                  style={{ transform: `scale(${graphZoom})` }}>
                  <svg className="discovery-links" viewBox="0 0 1140 660" aria-hidden="true">
                    {discoveries.flatMap(({ node }) => node.prerequisites
                      .filter(id => visibleNodeIds.has(id))
                      .map(parent => (
                        <line key={`${parent}-${node.id}`}
                          x1={graphCoordinates[parent].x + 155}
                          y1={graphCoordinates[parent].y + 38}
                          x2={graphCoordinates[node.id].x}
                          y2={graphCoordinates[node.id].y + 38} />
                      )))}
                  </svg>
                  <div className="discovery-nodes" data-testid="discovery-nodes">
                    {discoveries.map(({ node, record, status }) => (
                      <div className={`discovery-node discovery-node-${status}`}
                        style={{ left: graphCoordinates[node.id].x, top: graphCoordinates[node.id].y }}
                        data-testid="discovery-node" data-node-id={node.id} data-status={status} key={node.id}>
                        <strong>{status === "locked" ? "未解锁的分支" : node.title}</strong>
                        <span>{status === "completed" ? `已发现 · 第 ${record?.completedAtDay} 天` :
                          status === "available" ? `待探索 · ${node.hint}` :
                          status === "hinted" ? "已有线索" : "尚无前置发现"}</span>
                        {record && <small data-testid={`discovery-evidence-${node.id}`}
                          data-event-id={record.eventId} data-source-id={record.sourceId}>
                          实证：第 {record.completedAtDay} 天 · {node.hint}
                        </small>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <section className="technology-panel" data-testid="technology-panel">
              <h3>省力科技 · {COLLECT_BAG.title}</h3>
              <p>亲手收集 {COLLECT_BAG.manualRequired} 枚元素球后，消耗 {COLLECT_BAG.cost} 洞天仙力购买。</p>
              <p data-testid="bag-qualification">
                {state.technology.collectBag ? "已永久解锁" :
                  `手动收集 ${state.labor.manualBallIds.length}/${COLLECT_BAG.manualRequired} · ${eligibleForBag ? "可购买" : "尚未满足条件"}`}
              </p>
              <button type="button" data-testid="buy-collect-bag"
                disabled={state.phase !== "DAY_WORK" || !!state.technology.collectBag}
                onClick={() => gameStore.dispatch({ type: "UNLOCK_TECH", techId: "collectBag" })}>
                {state.technology.collectBag ? "收集袋已解锁" : `购买收集袋 · ${COLLECT_BAG.cost} 仙力`}
              </button>
              {state.notice.kind === "locked" && <p data-testid="tech-feedback">{state.notice.message}</p>}
            </section>
          </div>
        </div>
      )}
      {selectedItem && selectedItem.kind !== "Seed" && (
        <div className="item-inspector" data-testid="selected-item" data-item-id={selectedItem.id}>
          <strong data-testid="item-id">物件详情</strong>
          <span>{itemLabel(selectedItem)}</span>
          {selectedItem.kind === "VisitorGift" ? (
            <span>赠物来源：旅人阿砚</span>
          ) : (
            <>
              <span data-testid="item-mass">{selectedItem.kind === "Shell" ? "0.000" :
                fruitMass(selectedItem).toFixed(3)}G</span>
              <span>来源：{sourceKey(selectedItem.source) === sourceKey(OPENING_SOURCE) ? "开局储藏水瓜" : plotLabel(selectedItem.source.plotId)}</span>
              <span>首反应：{selectedItem.kind === "Shell" ? "无" :
                selectedItem.reaction.firstReaction ?? "无"}</span>
            </>
          )}
          <span>位置：{itemLocationLabel(selectedItem.location.kind)}</span>
        </div>
      )}
      <footer className={`region status-area notice-${state.notice.kind}`} aria-live="polite" data-testid="region-feedback">
        <div className="experience-hint" data-testid="next-step-guide">
          <button type="button" data-testid="guide-toggle" aria-expanded={showGuidance}
            onClick={() => setShowGuidance(!showGuidance)}>
            {showGuidance ? "收起提示" : "显示下一步"}
          </button>
          {showGuidance && <span data-testid="next-step-text">{nextActionHint(state, scene)}</span>}
        </div>
        <strong>状态反馈</strong>
        <span data-testid="feedback">{playerEventText(state.notice.message)}</span>
        <span className="version" data-testid="save-status">{saveStatus === "saved" ? "已保存" : saveStatus === "saving" ? "保存中…" : saveStatus === "error" ? "存档异常" : "已载入"}</span>
      </footer>
      {state.phase === "DAY_CONFIRM" && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="确认结束今日" data-testid="end-day-dialog">
          <div className="dialog-pane">
            <h2>结束第 {state.day} 天？</h2>
            <p>将推进 {state.lastNightReport ? "下一轮 " : ""}{U2_CONFIG.nightUH}uh。未收集元素球会消散，随后进入次晨。</p>
            <div className="dialog-actions">
              <button type="button" data-testid="cancel-day" onClick={() => gameStore.dispatch({ type: "CANCEL_END_DAY" })}>继续今日</button>
              <button type="button" data-testid="confirm-day" onClick={() => gameStore.dispatch({ type: "CONFIRM_END_DAY", expectedDay: state.day })}>确认结算</button>
            </div>
          </div>
        </div>
      )}
      {showReport && report && state.phase !== "DAY_CONFIRM" && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="次晨简报" data-testid="night-report">
          <div className="dialog-pane report-pane">
            <h2>第 {report.toDay} 天 · 次晨简报</h2>
            <p>昨夜经过 {report.toUH - report.fromUH} uh。根系已实际吸收养分，土壤保留率与器官成长按小时结算。</p>
            <p data-testid="report-stage">中心地格：{growthStageLabel(report.plots.P01.stageBefore ?? "空地")} → {growthStageLabel(report.plots.P01.stageAfter ?? "空地")}；叶片 {report.plots.P01.leafCountBefore} → {report.plots.P01.leafCountAfter}</p>
            <p>果实进度：当前 {report.plots.P01.fruitCountAfter} 个生殖器官；具体成长事件见下方。</p>
            <ul className="event-list">{(report.events.length ? report.events.slice(-12) : ["昨夜没有新的阶段转换"]).map((item, i) => <li key={`${i}-${item}`}>{playerEventText(item)}</li>)}</ul>
            <p className="hint">凝聚额度已重置，可继续培育。</p>
            <button type="button" data-testid="close-report" onClick={() => setReportDismissed(report.toDay)}>继续劳动</button>
          </div>
        </div>
      )}
      {saveManagerOpen && <SaveManager onClose={() => setSaveManagerOpen(false)} onWorldChanged={worldChanged} />}
      {drag && <div className={`drag-ghost ${drag.target?.zone || drag.target?.scene.ground ? "valid-target" : ""}`}
        data-testid={drag.kind === "Seed" ? "seed-drag-ghost" : "fruit-drag-ghost"}
        style={{ left: drag.x, top: drag.y }} aria-hidden="true">{drag.kind === "Seed" ? "🌰" : drag.kind === "Shell" ? "🐚" : drag.kind === "VisitorGift" ? "🎴" : "🍈"}</div>}
    </div>
  );
}