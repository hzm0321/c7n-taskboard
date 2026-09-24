import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { getAppUpdateStatus, startAppUpdate, type AppUpdateStatus } from "../api";
import { useTaskboardI18n } from "../i18n";

export function AppUpdateButton({ onError }: { onError: (message: string) => void }) {
  const { text } = useTaskboardI18n();
  const [status, setStatus] = useState<AppUpdateStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const busy = Boolean(status?.busy);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const next = await getAppUpdateStatus();
        if (active) setStatus(next);
      } catch {
        if (active) setStatus(null);
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, busy ? 2_000 : 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [busy]);

  if (!status?.supported || (!status.available && !busy)) return null;

  async function update() {
    setStarting(true);
    try {
      const next = await startAppUpdate();
      setStatus(next);
      const targetUrl = next.downloadUrl || (next.version
        ? `https://github.com/hzm0321/c7n-taskboard/releases/tag/v${next.version}`
        : "https://github.com/hzm0321/c7n-taskboard/releases/latest");
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(false);
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="none"
          className="header-integration-trigger header-update-button no-drag"
          type="button"
          disabled={starting || busy}
          onClick={() => void update()}
          aria-label={text("更新软件", "Update app")}
        >
          <Download size={14} aria-hidden="true" />
          <span>{starting || busy ? text("更新中…", "Updating…") : text("更新", "Update")}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {starting || busy
          ? text("正在更新软件…", "Updating app…")
          : (status.message || text("更新软件", "Update app"))}
      </TooltipContent>
    </Tooltip>
  );
}
