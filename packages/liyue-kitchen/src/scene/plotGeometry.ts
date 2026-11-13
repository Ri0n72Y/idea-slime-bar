import { PLOT_IDS, type PlotId } from "../domain/game";

export type PlotPosition = Readonly<{ id: PlotId; x: number; y: number }>;

export function plotGeometry(width: number, height: number): {
  radius: number;
  positions: PlotPosition[];
} {
  const radius = Math.min(width / 11, height / 7, 70);
  const orbit = radius * 1.86;
  const cx = width / 2;
  const cy = height / 2;
  return {
    radius,
    positions: PLOT_IDS.map((id, index) => {
      const angle = ((index - 1) * Math.PI) / 3 - Math.PI / 2;
      return index === 0
        ? { id, x: cx, y: cy }
        : { id, x: cx + Math.cos(angle) * orbit, y: cy + Math.sin(angle) * orbit };
    }),
  };
}
