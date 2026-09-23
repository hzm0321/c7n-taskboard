import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTaskboardI18n } from "../i18n";
import type { Task } from "../types";

export function BulkArchiveDialog({ tasks, busy, onClose, onConfirm }: {
  tasks: Task[];
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { text } = useTaskboardI18n();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const isSingle = tasks.length === 1;

  return (
    <dialog
      ref={dialog}
      className="bulk-archive-dialog"
      role="alertdialog"
      aria-labelledby="bulk-archive-title"
      aria-describedby="bulk-archive-description"
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="choerodon-sync-header">
        <div className="choerodon-sync-heading">
          <div>
            <h2 id="bulk-archive-title">
              {isSingle
                ? text("是否归档该任务？", "Archive this issue?")
                : text(`是否归档选中的 ${tasks.length} 个任务？`, `Archive ${tasks.length} selected issues?`)}
            </h2>
            <p id="bulk-archive-description">
              {text("归档后可在已归档任务中恢复。", "You can restore them from archived issues.")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="none"
            type="button"
            className="icon-button"
            disabled={busy}
            onClick={onClose}
            aria-label={text("关闭归档弹框", "Close archive dialog")}
          >
            <X size={18} aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="bulk-archive-content">
        <div className="bulk-archive-tasks">
          <ul className="bulk-archive-list">
            {tasks.map((task) => (
              <li key={task.id} className="bulk-archive-item">
                <span className="bulk-archive-key">{task.externalKey ?? task.identifier}</span>
                <span className="bulk-archive-title" title={task.title}>{task.title}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="choerodon-sync-footer">
        <div className="choerodon-sync-actions">
          <Button
            className="button secondary"
            variant="outline"
            size="sm"
            type="button"
            autoFocus
            disabled={busy}
            onClick={onClose}
          >
            {text("取消", "Cancel")}
          </Button>
          <Button
            className="button danger"
            variant="destructive"
            size="sm"
            type="button"
            disabled={busy || tasks.length === 0}
            onClick={onConfirm}
          >
            {busy ? text("归档中…", "Archiving…") : text("确认归档", "Archive")}
          </Button>
        </div>
      </footer>
    </dialog>
  );
}
