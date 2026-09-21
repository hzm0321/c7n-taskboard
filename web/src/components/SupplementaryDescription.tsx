import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { uploadAttachment } from "../api";
import { createInlineMediaSegments, inlineMediaFiles, inlineMediaImages, serializeInlineMedia } from "../documentModel";
import { resolveInlineAttachments, uploadInlineAttachments } from "../inlineAttachments";
import { useTaskboardI18n } from "../i18n";
import type { Attachment, Task } from "../types";
import { DescriptionDocument } from "./DescriptionDocument";
import { InlineMediaComposer, type InlineMediaComposerHandle } from "./InlineMediaComposer";
import { AttachmentIcon } from "./SemanticIcons";

type DocumentProps = ComponentProps<typeof DescriptionDocument>;

export function SupplementaryDescription({ task, attachments, referenceTasks, onSave, onError, onOpenTask, onOpenAttachment }: {
  task: Task;
  attachments: Attachment[];
  referenceTasks: Task[];
  onSave: (value: string, uploaded: Attachment[]) => Promise<void>;
  onError: (error: string | readonly [string, string] | null) => void;
  onOpenTask: DocumentProps["onOpenTask"];
  onOpenAttachment: DocumentProps["onOpenAttachment"];
}) {
  const { text } = useTaskboardI18n();
  const value = task.supplementaryDescription ?? "";
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [segments, setSegments] = useState(() => createInlineMediaSegments(value, referenceTasks, attachments));
  const composer = useRef<InlineMediaComposerHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pickerOpen = useRef(false);
  const saveInFlight = useRef(false);

  useLayoutEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => composer.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  function edit() {
    setSegments(createInlineMediaSegments(value, referenceTasks, attachments));
    setEditing(true);
  }

  async function save() {
    if (saveInFlight.current) return;
    const draft = serializeInlineMedia(segments).trim();
    const pending = [...inlineMediaImages(segments), ...inlineMediaFiles(segments)];
    if (draft === value && pending.length === 0) {
      setEditing(false);
      return;
    }
    saveInFlight.current = true;
    setSaving(true);
    onError(null);
    try {
      const uploaded = await uploadInlineAttachments(pending, (file, kind) => uploadAttachment(task.id, file, kind));
      const resolved = resolveInlineAttachments(draft, pending, uploaded).trim();
      setSegments(createInlineMediaSegments(resolved, referenceTasks, [...attachments, ...uploaded]));
      await onSave(resolved, uploaded);
      setEditing(false);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="issue-supplementary-description" aria-label={text("补充描述", "Supplementary description")}>
      <h3>{text("补充描述", "Supplementary description")}</h3>
      {editing ? (
        <div className="issue-description-composer"
          onMouseDownCapture={(event) => {
            if (event.target instanceof Element && event.target.closest(".inline-media-image > button, .inline-media-attachment > button, .issue-description-attach-button")) event.preventDefault();
          }}
          onBlur={(event) => {
            if (event.target === event.currentTarget) return;
            if (pickerOpen.current || event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            const editor = event.currentTarget;
            requestAnimationFrame(() => {
              if (editor.isConnected && !editor.contains(document.activeElement) && !pickerOpen.current) void save();
            });
          }}
        >
          <InlineMediaComposer
            ref={composer}
            segments={segments}
            referenceTasks={referenceTasks}
            completionContext={{ projectId: task.projectId, surface: "issue-description" }}
            placeholder={text("添加补充描述…", "Add supplementary description…")}
            ariaLabel={text("补充描述", "Supplementary description")}
            allowAttachments
            disabled={saving}
            onChange={setSegments}
            onError={onError}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setEditing(false);
              }
            }}
          />
          <Button variant="ghost" size="none" type="button"
            className="comment-attach-button issue-description-attach-button"
            disabled={saving}
            aria-label={text("添加补充描述附件", "Add supplementary description attachments")}
            title={text("添加附件", "Add attachments")}
            onClick={() => { pickerOpen.current = true; fileInput.current?.click(); }}
          ><AttachmentIcon color="currentColor" /></Button>
          <input type="file" multiple hidden
            ref={(input) => {
              fileInput.current = input;
              if (input) input.oncancel = () => {
                pickerOpen.current = false;
                requestAnimationFrame(() => composer.current?.focus());
              };
            }}
            onChange={(event) => {
              pickerOpen.current = false;
              if (event.currentTarget.files) composer.current?.addFiles(event.currentTarget.files);
              event.currentTarget.value = "";
              requestAnimationFrame(() => composer.current?.focus());
            }}
          />
        </div>
      ) : (
        <div className={`issue-description-read${value ? "" : " empty"}`} role="button" tabIndex={0}
          aria-label={text("编辑补充描述", "Edit supplementary description")}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a, button, img, video")) return;
            if (window.getSelection()?.isCollapsed === false) return;
            edit();
          }}
          onKeyDown={(event) => {
            if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              edit();
            }
          }}
        >
          {value ? <DescriptionDocument value={value} referenceTasks={referenceTasks} attachments={attachments}
            enableImagePreview onOpenTask={onOpenTask} onOpenAttachment={onOpenAttachment} />
            : text("添加补充描述…", "Add supplementary description…")}
        </div>
      )}
    </section>
  );
}
