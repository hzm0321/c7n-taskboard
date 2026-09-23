import { useEffect, useRef, useState } from "react";
import { FolderOpen, MessageSquare, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { getCodexConversations, linkCodexConversation } from "../api";
import { useTaskboardI18n } from "../i18n";
import type { CodexConversationCatalog, Task } from "../types";

export function CodexConversationDialog({ task, onClose, onLinked }: {
  task: Task;
  onClose: () => void;
  onLinked: (task: Task) => void;
}) {
  const { text, locale } = useTaskboardI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [catalog, setCatalog] = useState<CodexConversationCatalog | null>(null);
  const [groupId, setGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const threads = catalog?.threads.filter((thread) => thread.binding.codexProjectId === groupId
    && `${thread.title} ${thread.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? [];

  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    setLoading(true);
    setError(null);
    setSelected("");
    void getCodexConversations(task.projectId).then((value) => {
      if (active) {
        setCatalog(value);
        setGroupId((current) => value.groups.some((group) => group.id === current)
          ? current : value.groups.find((group) => group.name.trim() === value.projectName.trim())?.id ?? "");
      }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [task.projectId, reload]);

  async function link() {
    setSaving(true);
    setError(null);
    try {
      const updated = await linkCodexConversation(task, selected, groupId);
      onLinked(updated);
      onClose();
      toast.success(text("已关联 Codex 对话", "Codex conversation linked"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} className="codex-conversation-dialog" aria-labelledby="codex-conversation-title" aria-describedby="codex-conversation-description"
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
      <header className="codex-conversation-header">
        <div className="codex-conversation-heading">
          <div>
            <h2 id="codex-conversation-title">{text("关联对话", "Link conversation")}</h2>
            <p id="codex-conversation-description">{text("选择已有的 Codex 会话，关联到当前任务。", "Link an existing Codex conversation to this task.")}</p>
          </div>
          <Button className="icon-button" variant="ghost" size="none" type="button" disabled={saving} onClick={onClose} aria-label={text("关闭关联对话弹框", "Close conversation dialog")}><X size={18} aria-hidden="true" /></Button>
        </div>
      </header>
      <div className="codex-conversation-scope">
        <label className="sr-only" htmlFor="codex-conversation-group">{text("Codex 会话分组", "Codex project group")}</label>
        <Select value={groupId} disabled={loading || saving || !catalog?.groups.length} onValueChange={(value) => { setGroupId(value); setSelected(""); setQuery(""); }}>
          <SelectTrigger id="codex-conversation-group" size="sm"><FolderOpen size={14} aria-hidden="true" /><SelectValue placeholder={text("选择会话分组", "Select a group")} /></SelectTrigger>
          <SelectContent container={dialog.current}>
            <SelectGroup>{catalog?.groups.map((group) => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectGroup>
          </SelectContent>
        </Select>
        <span>{text("未归档会话", "Unarchived conversations")}</span>
      </div>
      <div className="codex-conversation-search">
        <label className="codex-conversation-search-field">
          <Search size={16} aria-hidden="true" />
        <input type="search" aria-label={text("搜索 Codex 会话", "Search Codex conversations")} placeholder={text("搜索会话标题或 ID", "Search title or ID")} value={query} disabled={loading || saving} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <Button className="button secondary" variant="outline" size="sm" type="button" disabled={loading || saving} onClick={() => setReload((value) => value + 1)}><RefreshCw size={14} aria-hidden="true" />{text("刷新", "Refresh")}</Button>
      </div>
      <div className="codex-conversation-list-heading">
        <span>{text("可关联会话", "Available conversations")}</span>
        <span>{loading ? text("正在读取…", "Loading…") : text(`${threads.length} 个`, `${threads.length} results`)}</span>
      </div>
      <div className="codex-conversation-list" aria-busy={loading}>
        {loading ? <p className="codex-conversation-empty">{text("正在加载…", "Loading…")}</p>
          : catalog && !catalog.groups.length ? <div className="codex-conversation-empty">
            <MessageSquare size={24} aria-hidden="true" />
            <h3>{text("未找到 Codex 会话分组", "No Codex project groups found")}</h3>
            <p>{text("请先在 Codex 中创建项目分组，再点击刷新。", "Create a Codex project group, then refresh.")}</p>
          </div>
          : catalog && !groupId ? <p className="codex-conversation-empty">{text("请选择 Codex 会话分组", "Select a Codex project group")}</p>
          : catalog && !threads.length ? <p className="codex-conversation-empty">{query ? text("没有匹配的会话", "No matching conversations") : text("该分组暂无未归档会话", "No unarchived conversations in this group")}</p>
          : <div role="radiogroup" aria-label={text("选择 Codex 会话", "Choose a Codex conversation")}>
            {threads.map((thread) => <label key={thread.id} className={`codex-conversation-option${selected === thread.id ? " is-selected" : ""}`}>
              <input type="radio" name="codex-conversation" value={thread.id} checked={selected === thread.id} disabled={saving} onChange={() => setSelected(thread.id)} />
              <span className="codex-conversation-option-content">
                <strong title={thread.id}>{thread.title}</strong>
                <small>{text("更新于 ", "Updated ")}<time dateTime={thread.updatedAt}>{new Date(thread.updatedAt).toLocaleString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time></small>
                <small className="codex-conversation-workspace" title={thread.binding.workspacePath}><FolderOpen size={13} aria-hidden="true" /><span>{thread.binding.workspacePath}</span></small>
              </span>
            </label>)}
          </div>}
      </div>
      <footer>
        {error && <p className="project-dialog-error" role="alert">{error}</p>}
        <div><span>{selected ? text("已选择 1 个会话", "1 conversation selected") : text("请选择一个会话", "Select a conversation")}</span>
          <Button className="button secondary" variant="outline" size="sm" type="button" disabled={saving} onClick={onClose}>{text("取消", "Cancel")}</Button>
          <Button className="button primary" variant="default" size="sm" type="button" disabled={loading || saving || !groupId || !selected} onClick={() => void link()}>{saving ? text("关联中…", "Linking…") : text("关联所选对话", "Link selected conversation")}</Button>
        </div>
      </footer>
    </dialog>
  );
}
