import "./u2.css";
import "./u3.css";
import "./u4.css";
import "./batch-a.css";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { ELEMENTS, ELEMENT_VIEW, U2_CONFIG } from "./domain/config";
import { gameStore } from "./domain/store";
import { fruitMass, remainingCondenses, stageLabel, type GameItem, type ItemLocation, type PlotId, type WorkbenchSlot } from "./domain/game";
import { CrystalScene, type SceneDropTarget } from "./scene/CrystalScene";
import { ECONOMY_CANDIDATE } from "./domain/economy";
import type { KitchenOrder } from "./domain/orders";

const unavailable = "后续阶段开放";
type DropTarget = { zone: "inventory" | "storage" | WorkbenchSlot | null; scene: SceneDropTarget };
type Drag = {
  itemId: string; kind: GameItem["kind"];
  pointerId: number; x: number; y: number;
  originX: number; originY: number; target: DropTarget | null;
};
const emptyScene: SceneDropTarget = { plotId: null, ground: null };
function dropTargetAt(x: number, y: number, pick: ((x: number, y: number) => SceneDropTarget) | null): DropTarget {
  const element = document.elementFromPoint(x, y);
  const zone = element?.closest("[data-item-drop-zone]")?.getAttribute("data-item-drop-zone");
  return {
    zone: zone === "inventory" || zone === "storage" || zone === "peel" || zone === "juice" ? zone : null,
    scene: pick?.(x, y) ?? emptyScene,
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
  const [reportDismissed, setReportDismissed] = useState<number | null>(null);

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
      const target = dropTargetAt(event.clientX, event.clientY, pickRef.current);
      const next = { ...current, x: event.clientX, y: event.clientY, target };
      dragRef.current = next;
      setDrag(next);
    };
    const up = (event: PointerEvent) => {
      const current = dragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const target = dropTargetAt(event.clientX, event.clientY, pickRef.current);
      dragRef.current = null;
      setDrag(null);
      if (Math.hypot(event.clientX - current.originX, event.clientY - current.originY) < 8) return;
      if (current.kind === "Seed") {
        if (target.scene.plotId && !target.zone)
          gameStore.dispatch({ type: "PLANT_SEED", itemId: current.itemId, plotId: target.scene.plotId });
        else gameStore.dispatch({ type: "REJECT_DROP", reason: "种子需拖到已开垦、空置的地格；未消耗种子。" });
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
  const itemLabel = (item: GameItem) => ({
    Seed: "水瓜种子", Aquamelon: "完整水瓜", PeeledFlesh: "水瓜果肉",
    Shell: "水瓜果壳", RawJuice: "水瓜原汁", AquamelonJuiceCup: "杯装水瓜汁",
  })[item.kind];
  const order = Object.values(state.orders).find(o => o.state === "available" || o.state === "accepted");
  const recentOrders = Object.values(state.orders).filter(
    o => o.state === "completed" || o.state === "expired").slice(-2).reverse();
  const orderName = (o: KitchenOrder) => o.itemKind === "aquamelon" ? "完整水瓜" : "杯装水瓜汁";
  const deliver = (o: KitchenOrder) => {
    const kind = o.itemKind === "aquamelon" ? "Aquamelon" : "AquamelonJuiceCup";
    // The explicitly selected material wins, even when invalid; domain returns a rejection.
    const candidate = state.selectedItemId && state.items[state.selectedItemId] ?
      [state.selectedItemId] : Object.values(state.items)
        .filter(item => item.kind === kind &&
          (item.location.kind === "storage" || item.location.kind === "inventory"))
        .slice(0, o.quantity).map(item => item.id);
    gameStore.dispatch({ type: "DELIVER_ORDER", orderId: o.id, itemIds: candidate });
  };
  const report = state.lastNightReport;
  const showReport = !!report && report.toDay !== reportDismissed;
  return (
    <div className="game-shell">
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
        <button type="button" className="action" data-testid="condense" disabled={state.phase !== "DAY_WORK" || remainingCondenses(state) <= 0}
          onClick={() => gameStore.dispatch({ type: "CONDENSE" })}>凝聚元素</button>
        <button type="button" className="action" data-testid="end-day" disabled={state.phase !== "DAY_WORK"}
          onClick={() => gameStore.dispatch({ type: "REQUEST_END_DAY" })}>结束今日</button>
      </header>

      <main className="main-area">
        <section className="region visitors" aria-label="访客区" data-testid="region-visitors">
          <h2>访客与对话</h2>
          <div className="quiet-panel">
            <span className="icon-disc">客</span>
            <p>尚无访客</p>
            <small>角色、来物与对话将在 U9 开放</small>
          </div>
          {report && <button type="button" className="report-reopen" data-testid="reopen-report"
            onClick={() => setReportDismissed(null)}>查看第 {report.fromDay} 天夜间简报</button>}
        </section>

        <section className="region crystal-region" aria-label="洞天水晶球" data-testid="region-crystal">
          <div className="crystal-title">
            <h2>洞天水晶球</h2>
            <span>{Object.keys(state.looseBalls).length} 枚元素球待收集 · 点击收集</span>
          </div>
          <CrystalScene state={state} hoverPlotId={drag?.target?.scene.plotId ?? null}
            onChoose={choosePlot} onCollect={collectBall} onHarvest={harvestFruit}
            onSelectItem={selectItem} onStartGroundDrag={startGroundDrag}
            onRegisterDropTarget={registerDropTarget} />
          <div className="crystal-footer">
            <span data-testid="selected-plot">当前地格：{state.selectedPlotId ?? "未选择"}</span>
            <span data-testid="plant-stage">{state.selectedPlotId ? stageLabel(state, state.selectedPlotId) : "拖放种子至开放地格"}</span>
            <div className="plot-purchases" data-testid="plot-purchases">
              {(["P02", "P03", "P04", "P05", "P06", "P07"] as const)
                .filter(id => !state.plots[id].open).map(id => (
                <button key={id} type="button" data-testid={`unlock-${id}`}
                  disabled={state.phase !== "DAY_WORK"}
                  onClick={() => gameStore.dispatch({ type: "UNLOCK_PLOT", plotId: id })}>
                  开垦 {id} · {ECONOMY_CANDIDATE.plotCosts[id]} 仙力
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="right-column">
          <section className="region orders" aria-label="限时委托" data-testid="region-orders">
            <h2>限时委托</h2>
            {order ? (
              <div className="order-panel" data-testid="active-order" data-order-id={order.id}>
                <p data-testid="order-requirement">{orderName(order)} × {order.quantity}</p>
                <p data-testid="order-deadline">第 {order.dueDay} 天截止（含当日）</p>
                <p>奖励 {order.rewards} 洞天仙力</p>
                <p data-testid="order-status">{order.state === "available" ? "待接受" : "已接受"}</p>
                {order.state === "available" ? (
                  <button type="button" data-testid="accept-order" disabled={state.phase !== "DAY_WORK"}
                    onClick={() => gameStore.dispatch({ type: "ACCEPT_ORDER", orderId: order.id })}>
                    接受委托
                  </button>
                ) : (
                  <button type="button" data-testid="deliver-order" disabled={state.phase !== "DAY_WORK"}
                    onClick={() => deliver(order)}>交付选中物品 / 仓储材料</button>
                )}
              </div>
            ) : <p className="hint">暂无可交付委托</p>}
            {recentOrders.map(o => <p key={o.id} className="order-history" data-testid="order-history">
              {o.id} · {orderName(o)} · {o.state === "completed" ? "已交付" : "已过期"}
            </p>)}
          </section>
          <section className="region exploration" aria-label="探索地图" data-testid="region-exploration">
            <h2>探索地图</h2>
            <div className="empty-state">等待第一项发现</div>
            <p className="hint">U7 开放探索图谱</p>
            <button type="button" disabled title={unavailable}>打开地图 · 未开放</button>
          </section>
        </aside>
      </main>

      <div className="bottom-area">
        <section className="region peeling" aria-label="剥壳工作台" data-testid="region-peeling">
          <h2>剥壳工作台</h2>
          <div className="workbench-placeholder workbench-drop" data-item-drop-zone="peel" data-testid="peel-drop">
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
            onClick={() => peelItem && gameStore.dispatch({ type: "PROCESS_ITEM", itemId: peelItem.id, action: "PEEL" })}>剥壳</button>
        </section>
        <div className="bottom-center">
          <section className="region inventory" aria-label="物品栏" data-testid="region-inventory" data-item-drop-zone="inventory">
            <h2>物品栏 <small>{inventoryItems.length} 件</small></h2>
            <div className="inventory-line">
{inventoryItems.map(item => (
                <div key={item.id} role="button" tabIndex={0}
                  aria-label={item.kind === "Seed" ? "拖拽水瓜种子" : `拖拽${itemLabel(item)} ${item.id}`}
                  className="seed-item" data-testid={item.kind === "Seed" ? "seed-item" : "fruit-inventory"}
                  data-item-id={item.id}
                  onPointerDown={e => startDrag(e, item.id)}
                  onClick={() => item.kind !== "Seed" && selectItem(item.id)}
                  onKeyDown={e => { if (e.key === "Enter") selectItem(item.id); }}>
                  <span>{item.kind === "Seed" ? "🌰" : item.kind === "Shell" ? "🐚" : "🍈"}</span>
                  <small>{itemLabel(item)} · {item.kind === "Seed" ? "" : item.id}</small>
                </div>
              ))}
              {!inventoryItems.length && <p className="hint">暂无物品</p>}
              <span className="hint">成熟水瓜留种一枚；拖动后续种子播种，旧树已采完可换种</span>
            </div>
          </section>
          <section className="region storage" aria-label="仓储区" data-testid="region-storage" data-item-drop-zone="storage">
            <h2>仓储区 <small>元素养分 · {storageItems.length} 件物品</small></h2>
            <div className="held-elements" data-testid="held-elements">
              {ELEMENTS.map(element => {
                const v = state.heldElements[ELEMENTS.indexOf(element)];
                if (v <= 0) return null;
                const info = ELEMENT_VIEW[element];
                return <button key={element} type="button" data-testid={`water-${element}`} aria-label={`向所选地格浇灌${info.name}元素`}
                  style={{ borderColor: info.css }} disabled={!state.selectedPlotId || state.phase !== "DAY_WORK"}
                  onClick={() => state.selectedPlotId && gameStore.dispatch({ type: "WATER_PLOT", element, plotId: state.selectedPlotId })}>
                  {info.icon} {info.name} · 浇灌</button>;
              })}
              {!state.heldElements.some(v => v > 0) && <p className="hint">收集元素球后在此选择浇灌</p>}
              {storageItems.map(item => (
                <div key={item.id} role="button" tabIndex={0} className="seed-item"
                  data-testid="fruit-storage" data-item-id={item.id}
                  onPointerDown={e => startDrag(e, item.id)} onClick={() => selectItem(item.id)}
                  onKeyDown={e => { if (e.key === "Enter") selectItem(item.id); }}>
                  {item.kind === "Shell" ? "🐚" : "🍈"} <small>{itemLabel(item)} · {item.id}</small>
                </div>
              ))}
            </div>
          </section>
        </div>
        <section className="region juicing" aria-label="榨汁与装杯" data-testid="region-juicing">
          <h2>榨汁与装杯</h2>
          <div className="workbench-placeholder workbench-drop" data-item-drop-zone="juice" data-testid="juice-drop">
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
              onClick={() => juiceItem && gameStore.dispatch({ type: "PROCESS_ITEM", itemId: juiceItem.id, action: "JUICE" })}>榨汁</button>
            <button type="button" data-testid="cup-action"
              disabled={state.phase !== "DAY_WORK" || juiceItem?.kind !== "RawJuice"}
              onClick={() => juiceItem && gameStore.dispatch({ type: "PROCESS_ITEM", itemId: juiceItem.id, action: "CUP" })}>装杯</button>
          </div>
        </section>
      </div>

      {selectedItem && selectedItem.kind !== "Seed" && (
        <div className="item-inspector" data-testid="selected-item">
          <strong data-testid="item-id">{selectedItem.id}</strong>
          <span>{itemLabel(selectedItem)}</span>
          <span data-testid="item-mass">{selectedItem.kind === "Shell" ? "0.000" :
            fruitMass(selectedItem).toFixed(3)}G</span>
          <span>原植株：{selectedItem.source.plantId} / {selectedItem.source.leafId}</span>
          <span>位置：{selectedItem.location.kind}</span>
          <span>首反应：{selectedItem.kind === "Shell" ? "无" :
            selectedItem.reaction.firstReaction ?? "无"}</span>
        </div>
      )}
      <footer className={`region status-area notice-${state.notice.kind}`} aria-live="polite" data-testid="region-feedback">
        <strong>状态反馈</strong>
        <span data-testid="feedback">{state.notice.message}</span>
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
            <p data-testid="report-stage">中心地格：{report.plots.P01.stageBefore ?? "空地"} → {report.plots.P01.stageAfter ?? "空地"}；叶片 {report.plots.P01.leafCountBefore} → {report.plots.P01.leafCountAfter}</p>
            <p>果实进度：当前 {report.plots.P01.fruitCountAfter} 个生殖器官；具体成长事件见下方。</p>
            <ul className="event-list">{(report.events.length ? report.events.slice(-12) : ["昨夜没有新的阶段转换"]).map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}</ul>
            <p className="hint">凝聚额度已重置，可继续培育。</p>
            <button type="button" data-testid="close-report" onClick={() => setReportDismissed(report.toDay)}>继续劳动</button>
          </div>
        </div>
      )}
      {drag && <div className={`drag-ghost ${drag.target?.zone || drag.target?.scene.ground ? "valid-target" : ""}`}
        data-testid={drag.kind === "Seed" ? "seed-drag-ghost" : "fruit-drag-ghost"}
        style={{ left: drag.x, top: drag.y }} aria-hidden="true">{drag.kind === "Seed" ? "🌰" : drag.kind === "Shell" ? "🐚" : "🍈"}</div>}
    </div>
  );
}