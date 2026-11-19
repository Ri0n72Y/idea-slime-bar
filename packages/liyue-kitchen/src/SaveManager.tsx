import { useState, type ChangeEvent } from "react";
import { newGame, type GameState } from "./domain/game";
import { saveEnvelope, validateSave } from "./domain/save";
import { gameStore } from "./domain/store";
import { createWorldSeed } from "./domain/worldSeed";
import "./saveManager.css";

const MAX_BACKUP_SIZE = 8 * 1024 * 1024;
type Props = { onClose: () => void; onWorldChanged: () => void };
function description(game: GameState) {
  return `第 ${game.day} 天 · ${Object.keys(game.items).length} 件物品 · ${Object.values(game.plots).filter(p => p.open).length} 块已开垦地格 · ${game.adeptalEnergy.balance} 仙力`;
}
function errorText(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause);
}

export function SaveManager({ onClose, onWorldChanged }: Props) {
  const [pendingImport, setPendingImport] = useState<{ name: string; game: GameState } | null>(null);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const exportBackup = async () => {
    setBusy(true);
    setFeedback("");
    try {
      await gameStore.whenSaved();
      if (gameStore.getSaveStatus() !== "saved") throw new Error("当前存档尚未成功写入，暂不能导出");
      const snapshot = saveEnvelope(gameStore.getSnapshot());
      if (!validateSave(snapshot)) throw new Error("当前存档未通过校验");
      const blob = new Blob([JSON.stringify(s���q�^