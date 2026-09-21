import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTaskboardI18n } from "../i18n";

export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const { text } = useTaskboardI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData(event.currentTarget);
      formData.append("access_key", "240e0eda-0207-4504-9203-5275aafb9764");
      formData.append("subject", "Taskboard 用户问题反馈");

      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        toast.success(text("反馈已发送成功，感谢您的建议！", "Feedback sent successfully. Thank you!"));
        onClose();
      } else {
        setError(data.message || text("提交失败，请稍后重试", "Submission failed, please try again"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className="feedback-dialog"
      aria-labelledby="feedback-dialog-title"
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting) onClose();
      }}
    >
      <header className="choerodon-sync-header">
        <div className="choerodon-sync-heading">
          <div>
            <h2 id="feedback-dialog-title">{text("问题反馈", "Feedback & Bug Report")}</h2>
            <p>{text("遇到问题或有改进建议？请填写下表反馈给我们。", "Encountered a problem or have suggestions? Let us know.")}</p>
          </div>
          <Button
            variant="ghost"
            size="none"
            type="button"
            className="icon-button"
            disabled={submitting}
            onClick={onClose}
            aria-label={text("关闭反馈弹框", "Close feedback dialog")}
          >
            <X size={18} />
          </Button>
        </div>
      </header>

      <form onSubmit={onSubmit} className="feedback-dialog-body">
        <label>
          <span>{text("称呼 / 联系人（可选）", "Name (Optional)")}</span>
          <input
            type="text"
            name="name"
            maxLength={100}
            disabled={submitting}
            placeholder={text("请输入您的姓名或昵称（选填）", "Enter your name (optional)")}
          />
        </label>
        <label>
          <span>{text("联系邮箱（可选）", "Email (Optional)")}</span>
          <input
            type="email"
            name="email"
            maxLength={240}
            disabled={submitting}
            placeholder={text("请输入您的联系邮箱（选填）", "Enter your email for reply (optional)")}
          />
        </label>
        <label>
          <span>{text("问题或建议描述（必填）", "Message (Required)")}</span>
          <textarea
            name="message"
            required
            rows={5}
            maxLength={3000}
            disabled={submitting}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={text("请详细描述您遇到的问题、期望的行为或建议…", "Describe the issue or suggestion in detail…")}
          />
        </label>

        {error && <p className="feedback-dialog-error" role="alert">{error}</p>}

        <footer className="feedback-dialog-footer">
          <Button
            variant="outline"
            size="sm"
            className="button secondary"
            type="button"
            disabled={submitting}
            onClick={onClose}
          >
            {text("取消", "Cancel")}
          </Button>
          <Button
            variant="default"
            size="sm"
            className="button primary"
            type="submit"
            disabled={submitting || !message.trim()}
          >
            {submitting ? text("提交中…", "Submitting…") : text("提交反馈", "Submit")}
          </Button>
        </footer>
      </form>
    </dialog>
  );
}
