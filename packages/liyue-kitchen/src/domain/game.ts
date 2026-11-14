/** U1: state and commands are independent of the UI and renderer. */
export const PLOT_IDS = ["P01", "P02", "P03", "P04", "P05", "P06", "P07"] as const;
export type PlotId = (typeof PLOT_IDS)[number];
export type Plot = Readonly<{ id: PlotId; open: boolean }>;
export type Notice = Readonly<{ kind: "info" | "success" | "locked"; message: string }>;
export type GameState = Readonly<{
  day: number;
  phase: "DAY_WORK";
  adeptalEnergy: number;
  plots: Readonly<Record<PlotId, Plot>>;
  selectedPlotId: PlotId | null;
  notice: Notice;
}>;

export type Command = Readonly<{ type: "SELECT_PLOT"; plotId: PlotId }>;

export function newGame(): GameState {
  const plots = Object.fromEntries(
    PLOT_IDS.map((id, index) => [id, { id, open: index === 0 }]),
  ) as Record<PlotId, Plot>;

  return {
    day: 1,
    phase: "DAY_WORK",
    adeptalEnergy: 0,
    plots,
    selectedPlotId: null,
    notice: { kind: "info", message: "点按水晶球中心地格，查看洞天土地。" },
  };
}

export function applyCommand(state: GameState, command: Command): GameState {
  switch (command.type) {
    case "SELECT_PLOT": {
      const plot = state.plots[command.plotId];
      if (!plot) return state;
      if (!plot.open) {
        return {
          ...state,
          notice: {
            kind: "locked",
            message: `${plot.id} 尚未开垦。洞天仙力开垦将在后续阶段开放。`,
          },
        };
      }
      const selectedPlotId = state.selectedPlotId === plot.id ? null : plot.id;
      return {
        ...state,
        selectedPlotId,
        notice: selectedPlotId
          ? { kind: "success", message: `已选中 ${plot.id}。种植功能尚未开放。` }
          : { kind: "info", message: `已取消选择 ${plot.id}。` },
      };
    }
  }
}
