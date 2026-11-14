import { useSyncExternalStore } from "react";
import { gameStore } from "./domain/store";
import { CrystalScene } from "./scene/CrystalScene";

const unavailable = "后续阶段开放";

export function App() {
  const state = useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot);
  const choosePlot = (plotId: keyof typeof state.plots) => {
    gameStore.dispatch({ type: "SELECT_PLOT", plotId });
  };

  return (
    <div className="game-shell">
      <header className="header-area region" data-testid="region-header">
        <div className="brand">
          <span className="brand-kicker">LIYUE · KITCHEN</span>
          <h1>璃月厨房 <small>还得自己种</small></h1>
        </div>
        <div className="header-stats">
          <span className="pill" data-testid="day">第 {state.day} 天</span>
          <span className="pill" data-testid="energy">洞天仙力 {state.adeptalEnergy}</span>
        </div>
        <button type="button" className="action" disabled title={unavailable}>结束今日 · 未开放</button>
      </header>

      <main className="main-area">
        <section className="region visitors" aria-label="访客区" data-testid="region-visitors">
          <h2>访客与对话</h2>
          <div className="quiet-panel">
            <span className="icon-disc">客</span>
            <p>尚无访客</p>
            <small>角色、来物与对话将在 U9 开放</small>
          </div>
        </section>

        <section className="region crystal-region" aria-label="洞天水晶球" data-testid="region-crystal">
          <div className="crystal-title">
            <h2>洞天水晶球</h2>
            <span>一心 · 六隅</span>
          </div>
          <CrystalScene state={state} onChoose={choosePlot} />
          <div className="crystal-footer">
            <span data-testid="selected-plot">当前地格：{state.selectedPlotId ?? "未选择"}</span>
            <span>点按地格查看状态</span>
          </div>
        </section>

        <aside className="right-column">
          <section className="region orders" aria-label="限时委托" data-testid="region-orders">
            <h2>限时委托</h2>
            <div className="empty-state">委托板尚未启用</div>
            <p className="hint">U5 开放委托发布与交付</p>
            <button type="button" disabled title={unavailable}>查看委托 · 未开放</button>
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
          <div className="workbench-placeholder"><span>◎</span><p>待加工水瓜</p></div>
          <button type="button" disabled title={unavailable}>剥壳 · 未开放</button>
        </section>
        <div className="bottom-center">
          <section className="region inventory" aria-label="物品栏" data-testid="region-inventory">
            <h2>物品栏 <small>0 件</small></h2>
            <p className="hint">开局种子将在 U2 发放</p>
            <div className="inventory-slots" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          </section>
          <section className="region storage" aria-label="仓储区" data-testid="region-storage">
            <h2>仓储区</h2>
            <p className="hint">这里将存放完整水瓜与加工材料</p>
            <div className="storage-slots" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
          </section>
        </div>
        <section className="region juicing" aria-label="榨汁与装杯" data-testid="region-juicing">
          <h2>榨汁与装杯</h2>
          <div className="workbench-placeholder"><span>◉</span><p>待放入果肉与空杯</p></div>
          <div className="actions">
            <button type="button" disabled title={unavailable}>榨汁</button>
            <button type="button" disabled title={unavailable}>装杯</button>
          </div>
        </section>
      </div>

      <footer className={`region status-area notice-${state.notice.kind}`} aria-live="polite" data-testid="region-feedback">
        <strong>状态反馈</strong>
        <span data-testid="feedback">{state.notice.message}</span>
        <span className="version">WEB U1 · 交互验证</span>
      </footer>
    </div>
  );
}
