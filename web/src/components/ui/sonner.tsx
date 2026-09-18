import { useLayoutEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  const [layer] = useState(() => {
    const element = document.createElement("div");
    element.className = "sonner-top-layer";
    element.setAttribute("popover", "manual");
    return element;
  });

  useLayoutEffect(() => {
    const syncLayer = () => {
      // Modal dialogs make outside content inert. Keep toasts inside the active
      // modal, then promote them above it with the browser's native top layer.
      const parent = Array.from(document.querySelectorAll("dialog:modal")).at(-1) ?? document.body;
      if (layer.parentElement !== parent) {
        layer.hidePopover();
        parent.appendChild(layer);
      }
      if (!layer.matches(":popover-open")) layer.showPopover();
    };
    syncLayer();
    const observer = new MutationObserver(syncLayer);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    return () => {
      observer.disconnect();
      layer.hidePopover();
      layer.remove();
    };
  }, [layer]);

  return createPortal(
    <Sonner
      className="toaster group"
      richColors
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={{
        "--normal-bg": "var(--surface-raised)",
        "--normal-text": "var(--text-primary)",
        "--normal-border": "var(--border)",
        "--success-text": "var(--toast-success-text)",
        "--info-text": "var(--toast-info-text)",
        "--warning-text": "var(--toast-warning-text)",
        "--error-text": "var(--toast-error-text)",
        "--border-radius": "8px",
      } as CSSProperties}
      {...props}
    />,
    layer,
  );
}

export { Toaster };
