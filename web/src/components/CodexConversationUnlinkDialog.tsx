import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { unlinkCodexConversation } from "../api";
import { useTaskboardI18n } from "../i18n";
import type { Task } from "../types";
import { Button } from "./ui/button";

export function CodexConversationUnlinkDialog({ task, onClose, onUnlinked }: {
  task: Task;
  onClose: () => void;
  onUnlinked: (task: Task) => void;
}) {
  const { text } = useTaskboardI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { dialog.current?.showModal(); }, []);

  async function unlink() {
    setSaving(true);
    setError(null);
    try {
      const updated = await unlinkCodexConversation(task);
      onUnlinked(updated);
      onClose();
      toast.success(text("已取消关联 Codex 对话", "Codex conversation unlinked"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} className="codex-conversation-dialog codex-unlink-dialog" role="alertdialog"
      aria-labelledby="codex-unlink-title" aria-describedby="codex-unlink-description"
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
      <header className="codex-conversation-header">
        <div className="codex-conversation-heading">
          <div>
            <h2 id="codex-unlink-title">{text("取消关联此会话？", "Unlink this conversation?")}</h2>
            <p id="codex-unlink-description">{text("取消后，任务将不再关联该会话。Codex 会话和聊天记录会保留，你可以随时重新关联。", "This task will no longer be linked. The Codex conversation and messages will be kept, and you can link it again at any time.")}</p>
          </div>
          <Button className="icon-button" variant="ghost" size="none" type="button" disabled={saving} onClick={onClose} aria-label={text("关闭取消关联弹框", "Close unlink dialog")}><X size={18} aria-hidden="true" /></Button>
        </div>
      </header>
      <div className="codex-unlink-task"><span>{task.externalKey ?? task.identifier}</span><strong>{task.title}</strong></div>
      <footer>
        {error && <p className="project-dialog-error" role="alert">{error}</p>}
        <div>
          <Button className="button secondary" variant="outline" size="sm" type="button" autoFocus disabled={saving} onClick={onClose}>{text("保留关联", "Keep linked")}</Button>
          <Button className="button primary" variant="default" size="sm" type="button" disabled={saving} onClick={() => void unlink()}>{saving ? text("取消关联中…", "Unlinking…") : text("确定取消关联", "Confirm unlink")}</Button>
        </div>
      </footer>
    </dialog>
  );
}
