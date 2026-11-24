import { useState, type ChangeEvent } from "react";
import { newOpeningGame, type GameState } from "./domain/game";
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
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `liyue-kitchen-day-${gameStore.getSnapshot().day}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setFeedback("备份已导出，请妥善保管 JSON 文件。");
    } catch (cause) {
      setFeedback(`导出失败：${errorText(cause)}`);
    } finally {
      setBusy(false);
    }
  };

  const selectImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setPendingImport(null);
    setRestartConfirm(false);
    setFeedback("");
    if (!file) return;
    if (file.size > MAX_BACKUP_SIZE) {
      setFeedback("导入失败：文件超过 8MB 限制。");
      return;
    }
    setBusy(true);
    try {
      const contents: unknown = JSON.parse(await file.text());
      const game = validateSave(contents);
      if (!game) throw new Error("存档格式不正确、已损坏或版本不受支持");
      setPendingImport({ name: file.name, game });
      setFeedback("校验成功。确认后才会替换当前进度。建议先导出当前存档。");
    } catch (cause) {
      setFeedback(`导入失败：${errorText(cause)}。原存档保持不变。`);
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setBusy(true);
    setFeedback("");
    try {
      await gameStore.replaceGame(pendingImport.game);
      onWorldChanged();
    } catch (cause) {
      setFeedback(`导入失败：${errorText(cause)}。原存档保持不变。`);
    } finally {
      setBusy(false);
    }
  };

  const confirmRestart = async () => {
    setBusy(true);
    setFeedback("");
    try {
      await gameStore.replaceGame(newOpeningGame(createWorldSeed()));
      onWorldChanged();
    } catch (cause) {
      setFeedback(`重新开始失败：${errorText(cause)}。原存档保持不变。`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop save-manager-backdrop" role="dialog" aria-modal="true" aria-label="存档管理" data-testid="save-dialog">
      <section className="dialog-pane save-manager-pane">
        <header className="save-manager-heading">
          <h2>存档管理</h2>
          <button type="button" data-testid="save-close" disabled={busy} onClick={onClose}>返回游戏</button>
        </header>
        <p data-testid="save-current-summary">当前进度：{description(gameStore.getSnapshot())}</p>
        <div className="save-manager-actions">
          <button type="button" data-testid="save-export" disabled={busy} onClick={() => void exportBackup()}>导出当前存档</button>
          <label className={busy ? "file-upload disabled" : "file-upload"}>
            选择备份文件
            <input type="file" accept=".json,application/json" aria-label="选择备份文件" data-testid="save-import-file"
              disabled={busy} onChange={event => void selectImport(event)} />
          </label>
          <button type="button" data-testid="save-restart" disabled={busy}
            onClick={() => { setPendingImport(null); setFeedback(""); setRestartConfirm(true); }}>重新开始</button>
        </div>
        {pendingImport && (
          <section className="save-confirmation" data-testid="save-import-confirmation">
            <h3>确认导入备份？</h3>
            <p>文件：{pendingImport.name}</p>
            <p data-testid="save-import-summary">将恢复：{description(pendingImport.game)}</p>
            <p className="save-danger">导入将覆盖当前存档进度。</p>
            <div className="dialog-actions">
              <button type="button" data-testid="save-import-cancel" disabled={busy} onClick={() => setPendingImport(null)}>取消</button>
              <button type="button" data-testid="save-import-confirm" disabled={busy} onClick={() => void confirmImport()}>确认导入并覆盖</button>
            </div>
          </section>
        )}
        {restartConfirm && (
          <section className="save-confirmation" data-testid="save-restart-confirmation">
            <h3>确定重新开始？</h3>
            <p>当前存档将被覆盖；新世界拥有独立随机种子，并只发放一枚初始种子。请先导出需要保留的进度。</p>
            <div className="dialog-actions">
              <button type="button" data-testid="save-restart-cancel" disabled={busy} onClick={() => setRestartConfirm(false)}>取消</button>
              <button type="button" data-testid="save-restart-confirm" disabled={busy} onClick={() => void confirmRestart()}>确认重新开始</button>
            </div>
          </section>
        )}
        {feedback && <p className="save-feedback" role="status" data-testid="save-manager-feedback">{feedback}</p>}
      </section>
    </div>
  );
}
