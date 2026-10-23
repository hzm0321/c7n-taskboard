import { Button } from "@/components/ui/button";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { resolveInlineAttachments } from "../inlineAttachments";
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  getProjectReadme,
  saveProjectReadme,
  uploadProjectReadmeAttachment,
} from "../api";
import { useTaskboardI18n } from "../i18n";
import type { Project, ProjectPrototypeLink, ProjectReadme, Task, TaskRelationSummary } from "../types";
import { DescriptionDocument } from "./DescriptionDocument";
import {
  createInlineMediaSegments,
  inlineMediaImages,
  serializeInlineMedia,
  type InlineMediaSegment,
} from "../documentModel";
import { InlineMediaComposer, type InlineMediaComposerHandle } from "./InlineMediaComposer";
import { LinearIcon } from "./LinearIcon";
import "./ProjectReadmeView.css";

type ProjectReadmeError = string | readonly [string, string];

interface ProjectReadmeViewProps {
  project: Project;
  tasks: Task[];
  referenceTasks: Task[];
  revision: number;
  onOpenTask: (task: TaskRelationSummary) => void;
  onError?: (error: ProjectReadmeError | null) => void;
}

export function ProjectReadmeView({
  project,
  tasks,
  referenceTasks,
  revision,
  onOpenTask,
  onError,
}: ProjectReadmeViewProps) {
  const { text } = useTaskboardI18n();
  const [readme, setReadme] = useState<ProjectReadme | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRequest, setLoadRequest] = useState(0);
  const [editing, setEditing] = useState(false);
  const [prototypeLinks, setPrototypeLinks] = useState<ProjectPrototypeLink[]>([]);
  const [linkErrors, setLinkErrors] = useState<Record<number, string>>({});
  const [segments, setSegments] = useState<InlineMediaSegment[]>(
    () => createInlineMediaSegments("", referenceTasks),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const composerRef = useRef<InlineMediaComposerHandle>(null);

  useEffect(() => {
    if (editing) return;
    let active = true;
    setSaveError(null);
    setLoadError(null);

    getProjectReadme(project.id)
      .then((data) => {
        if (!active) return;
        setReadme(data);
        setPrototypeLinks(data.prototypeLinks);
        setSegments(createInlineMediaSegments(data.content, referenceTasks));
      })
      .catch((err) => {
        if (!active) return;
        const message = err instanceof Error ? err.message : String(err);
        setLoadError(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [editing, loadRequest, project.id, revision]);

  useEffect(() => {
    if (!editing) return;
    requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
  }, [editing]);

  function startEditing() {
    if (!readme) return;
    setSegments(createInlineMediaSegments(readme.content, referenceTasks));
    setPrototypeLinks(readme.prototypeLinks);
    setLinkErrors({});
    setEditing(true);
    setSaveError(null);
  }

  function cancelEditing() {
    setSegments(createInlineMediaSegments(readme?.content ?? "", referenceTasks));
    setPrototypeLinks(readme?.prototypeLinks ?? []);
    setLinkErrors({});
    setEditing(false);
    setSaveError(null);
  }

  function updatePrototypeLink(index: number, changes: Partial<ProjectPrototypeLink>) {
    setPrototypeLinks((current) => current.map((link, position) => position === index ? { ...link, ...changes } : link));
    setLinkErrors({});
  }

  async function save() {
    if (saving || !readme) return;
    const normalizedLinks = prototypeLinks.map((link) => ({ name: link.name.trim(), url: link.url.trim() }));
    const errors: Record<number, string> = {};
    normalizedLinks.forEach((link, index) => {
      try {
        const url = new URL(link.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Invalid protocol");
      } catch {
        errors[index] = text("请输入有效的 HTTP 或 HTTPS 地址", "Enter a valid HTTP or HTTPS URL");
      }
    });
    setLinkErrors(errors);
    if (Object.keys(errors).length) {
      document.getElementById(`project-prototype-url-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
    const draftContent = serializeInlineMedia(segments);
    const inlineImages = inlineMediaImages(segments);
    if (draftContent === readme.content && inlineImages.length === 0
      && JSON.stringify(normalizedLinks) === JSON.stringify(readme.prototypeLinks)) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    onError?.(null);

    try {
      const uploaded = await Promise.all(
        inlineImages.map((image) => uploadProjectReadmeAttachment(project.id, image.file)),
      );
      const resolvedContent = resolveInlineAttachments(
        draftContent,
        inlineImages,
        uploaded,
      );
      const updated = await saveProjectReadme(project.id, resolvedContent, readme.version, normalizedLinks);
      setReadme(updated);
      setPrototypeLinks(updated.prototypeLinks);
      setSegments(createInlineMediaSegments(updated.content, referenceTasks));
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        setSaveError(text(
          "项目文档已被其他协作者或 Agent 更新，请刷新后重试。",
          "Project Docs were modified elsewhere. Please refresh and try again.",
        ));
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setSaveError(message);
        onError?.(message);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="project-readme-loading">
        <div className="project-readme-spinner" />
        <p>{text("正在加载项目文档…", "Loading Project Docs…")}</p>
      </div>
    );
  }

  if (loadError && !readme) {
    return (
      <div className="project-readme-loading" role="alert">
        <p>{loadError}</p>
        <Button variant="outline" size="sm"
          type="button"
          className="button secondary"
          onClick={() => {
            setLoading(true);
            setLoadRequest((current) => current + 1);
          }}
        >
          {text("重试", "Try again")}
        </Button>
      </div>
    );
  }

  const content = readme?.content ?? "";

  return (
    <div className="project-readme-container">
      <div className="project-readme-content">
        <header className="project-readme-header">
          <h1>{text("项目文档", "Project Docs")}</h1>
          <div className="project-readme-actions">
            {editing ? <>
              <Button variant="outline" size="sm" type="button" className="button secondary" disabled={saving} onClick={cancelEditing}>
                {text("取消", "Cancel")}
              </Button>
              <Button size="sm" type="button" className="button primary" disabled={saving} onClick={() => void save()}>
                {saving ? text("保存中…", "Saving…") : text("保存", "Save")}
              </Button>
            </> : (
              <Button variant="outline" size="sm" type="button" className="button secondary" disabled={!readme} onClick={startEditing}>
                <Pencil data-icon="inline-start" />
                {text("编辑", "Edit")}
              </Button>
            )}
          </div>
        </header>

        {saveError && (
          <div className="project-readme-alert error" role="alert">
            <LinearIcon name="alert" />
            <span>{saveError}</span>
          </div>
        )}

        {loadError && !editing && (
          <div className="project-readme-alert error" role="alert">
            <LinearIcon name="alert" />
            <span>{loadError}</span>
            <Button variant="outline" size="sm"
              type="button"
              className="button secondary"
              onClick={() => {
                setLoading(true);
                setLoadRequest((current) => current + 1);
              }}
            >
              {text("重试", "Try again")}
            </Button>
          </div>
        )}

        <section className="project-readme-section" aria-labelledby="project-prototypes-heading">
          <div className="project-readme-section-header">
            <h2 id="project-prototypes-heading">{text("原型地址", "Prototypes")}</h2>
            {editing && (
              <Button variant="ghost" size="sm" type="button" className="button project-prototype-add" disabled={saving} onClick={() => {
                setPrototypeLinks((current) => [...current, { name: "", url: "" }]);
                setLinkErrors({});
              }}>
                <Plus data-icon="inline-start" />
                {text("添加原型地址", "Add prototype")}
              </Button>
            )}
          </div>
          {editing ? (
            prototypeLinks.length ? <div className="project-prototype-editor">
              {prototypeLinks.map((link, index) => (
                <div className="project-prototype-row" key={index}>
                  <label className="project-prototype-field" htmlFor={`project-prototype-name-${index}`}>
                    <span>{text("原型名称（选填）", "Name (optional)")}</span>
                    <input
                      id={`project-prototype-name-${index}`}
                      aria-label={text(`原型名称 ${index + 1}`, `Prototype name ${index + 1}`)}
                      placeholder={text("例如：管理后台", "e.g. Admin portal")}
                      value={link.name}
                      disabled={saving}
                      onChange={(event) => updatePrototypeLink(index, { name: event.target.value })}
                    />
                  </label>
                  <label className="project-prototype-field" htmlFor={`project-prototype-url-${index}`}>
                    <span>{text("原型地址", "URL")}</span>
                    <input
                      id={`project-prototype-url-${index}`}
                      type="url"
                      inputMode="url"
                      aria-label={text(`原型地址 ${index + 1}`, `Prototype URL ${index + 1}`)}
                      aria-invalid={Boolean(linkErrors[index])}
                      aria-describedby={linkErrors[index] ? `project-prototype-error-${index}` : undefined}
                      placeholder="https://"
                      value={link.url}
                      disabled={saving}
                      onChange={(event) => updatePrototypeLink(index, { url: event.target.value })}
                    />
                    {linkErrors[index] && <span className="project-prototype-error" id={`project-prototype-error-${index}`} role="alert">{linkErrors[index]}</span>}
                  </label>
                  <Button variant="ghost" size="icon" type="button" className="icon-button project-prototype-remove" disabled={saving}
                    aria-label={text(`删除原型地址 ${index + 1}`, `Remove prototype ${index + 1}`)}
                    onClick={() => {
                      setPrototypeLinks((current) => current.filter((_link, position) => position !== index));
                      setLinkErrors({});
                    }}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div> : <p className="project-readme-empty">{text("暂无原型地址", "No prototypes yet")}</p>
          ) : (
            readme?.prototypeLinks.length ? <ul className="project-prototype-list">
              {readme.prototypeLinks.map((link, index) => (
                <li key={index}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <span className="project-prototype-link-copy">
                      <strong>{link.name || link.url}</strong>
                      {link.name && <span>{link.url}</span>}
                    </span>
                    <ExternalLink size={15} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul> : <p className="project-readme-empty">{text("暂无原型地址", "No prototypes yet")}</p>
          )}
        </section>

        <section className="project-readme-section" aria-labelledby="project-guidelines-heading">
          <div className="project-readme-section-header">
            <h2 id="project-guidelines-heading">{text("项目开发规范", "Development Guidelines")}</h2>
          </div>
          {editing ? (
          <div className="issue-description-composer">
            <InlineMediaComposer
              ref={composerRef}
              segments={segments}
              mentionTasks={tasks}
              referenceTasks={referenceTasks}
              completionContext={{
                projectId: project.id,
                surface: "issue-description",
              }}
              placeholder={text("填写项目架构、编码规范与开发约定…", "Add architecture, coding standards, and development conventions…")}
              ariaLabel={text("项目开发规范", "Development Guidelines")}
              disabled={saving}
              onChange={setSegments}
              onError={(message) => onError?.(message)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !saving) {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelEditing();
                }
              }}
            />
          </div>
        ) : (
          <div
            className={`issue-description-read${content ? "" : " empty"}`}
          >
            {content
              ? <DescriptionDocument
                  value={content}
                  referenceTasks={referenceTasks}
                  onOpenTask={onOpenTask}
                />
              : text("暂无项目开发规范", "No development guidelines yet")}
          </div>
        )}
        </section>
      </div>
    </div>
  );
}
