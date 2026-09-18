import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, CheckCheck, Filter, Link2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { getChoerodonSyncPreview, syncChoerodonIssues } from "../api";
import { useTaskboardI18n } from "../i18n";
import type { ChoerodonSyncPreview } from "../types";
import { taskboardStorage } from "../storage";
import { toast } from "sonner";
import { ActorAvatar } from "./ActorAvatar";

const groupTones = ["blue", "amber", "violet", "green", "rose", "cyan"];

export function ChoerodonSyncDialog({ project, onClose, onSynced }: {
  project: { id: string; name: string };
  onClose: () => void;
  onSynced: () => Promise<void>;
}) {
  const { text } = useTaskboardI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selectContainer, setSelectContainer] = useState<HTMLDivElement | null>(null);
  const filterStorageKey = `taskboard.choerodon-sync-filters.${project.id}`;
  const [typeFilter, setTypeFilter] = useState(() => taskboardStorage.getItem(`${filterStorageKey}.type`) ?? "all");
  const [assigneeFilter, setAssigneeFilter] = useState(() => taskboardStorage.getItem(`${filterStorageKey}.assignee`) ?? "all");
  const [groupFilter, setGroupFilter] = useState(() => taskboardStorage.getItem(`${filterStorageKey}.group`) ?? "");
  const allCheckbox = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ChoerodonSyncPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const issues = preview?.issues ?? [];
  const groupColors = new Map(preview?.groups.map((group, index) => [group.id, groupTones[index % groupTones.length]]));
  const types = [...new Set(issues.map((issue) => issue.type))];
  const assignees = [...new Map(issues.map((issue) => [issue.assignee.id, issue.assignee])).values()];
  const filteredIssues = issues.filter((issue) => (
    (groupFilter === "all" || issue.groupId === groupFilter)
    && (typeFilter === "all" || issue.type === typeFilter)
    && (assigneeFilter === "all" || issue.assignee.id === assigneeFilter)
  ));
  const visibleSelectedCount = filteredIssues.filter((issue) => selected.has(issue.id)).length;
  const hiddenSelectedCount = selected.size - visibleSelectedCount;
  const allSelected = filteredIssues.length > 0 && visibleSelectedCount === filteredIssues.length;
  const hasFilters = (groupFilter !== "all" && groupFilter !== "") || typeFilter !== "all" || assigneeFilter !== "all";

  useEffect(() => {
    if (groupFilter) taskboardStorage.setItem(`${filterStorageKey}.group`, groupFilter);
    taskboardStorage.setItem(`${filterStorageKey}.type`, typeFilter);
    taskboardStorage.setItem(`${filterStorageKey}.assignee`, assigneeFilter);
  }, [filterStorageKey, typeFilter, assigneeFilter, groupFilter]);

  function clearFilters() {
    setGroupFilter("all");
    setTypeFilter("all");
    setAssigneeFilter("all");
  }

  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    setLoading(true);
    setError(null);
    void getChoerodonSyncPreview(project.id).then((value) => {
      if (!active) return;
      setPreview(value);
      setGroupFilter((current) => current || value.groups.find((group) => group.name === "待开发")?.id || "all");
      setSelected(new Set());
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [project.id, reload]);

  useEffect(() => {
    if (allCheckbox.current) allCheckbox.current.indeterminate = visibleSelectedCount > 0 && !allSelected;
  }, [visibleSelectedCount, allSelected]);

  async function sync() {
    if (!preview || !selected.size || syncing) return;
    setSyncing(true);
    setError(null);
    try {
      const value = await syncChoerodonIssues(project.id, preview.sourceKey, [...selected]);
      await onSynced();
      onClose();
      toast.success(text("同步猪齿鱼成功", "Choerodon synced successfully"), {
        description: text(`新增 ${value.created} 条，更新 ${value.updated} 条，未变更 ${value.unchanged} 条`, `${value.created} created, ${value.updated} updated, ${value.unchanged} unchanged`),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <dialog ref={dialog} className="choerodon-sync-dialog" aria-labelledby="choerodon-sync-title"
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => { event.preventDefault(); if (!syncing) onClose(); }}>
      <header className="choerodon-sync-header">
        <div className="choerodon-sync-heading">
          <div>
            <h2 id="choerodon-sync-title">{text("同步猪齿鱼", "Sync Choerodon")}</h2>
            <p>{text("筛选并勾选要同步的看板任务", "Filter and select tasks to sync")}</p>
          </div>
          <Button variant="ghost" size="none" type="button" className="icon-button" disabled={syncing} onClick={onClose} aria-label={text("关闭同步弹框", "Close sync dialog")}><X size={18} /></Button>
        </div>
        <div className="choerodon-sync-route">
          <span>{preview ? `${preview.project.name} / ${preview.board.name}` : text("正在读取看板…", "Loading board…")}</span>
          <ArrowRight size={14} aria-hidden="true" />
          <span className="choerodon-sync-target">{text("当前项目", "Current project")}<strong>{project.name}</strong></span>
        </div>
      </header>
      <div className="choerodon-sync-filters">
        <div className="choerodon-sync-filter">
          <label htmlFor="choerodon-sync-group">{text("任务分组", "Task group")}</label>
          <Select value={groupFilter} onValueChange={setGroupFilter} disabled={loading || syncing}>
            <SelectTrigger id="choerodon-sync-group"><SelectValue placeholder={text("请选择分组", "Select a group")} /></SelectTrigger>
            <SelectContent container={selectContainer}>
              <SelectItem value="all">{text("全部分组", "All groups")}</SelectItem>
              {preview?.groups.map((group) => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="choerodon-sync-filter">
          <label htmlFor="choerodon-sync-type">{text("任务类型", "Task type")}</label>
          <Select value={typeFilter} onValueChange={setTypeFilter} disabled={loading || syncing}>
            <SelectTrigger id="choerodon-sync-type"><SelectValue /></SelectTrigger>
            <SelectContent container={selectContainer}>
              <SelectItem value="all">{text("全部类型", "All types")}</SelectItem>
              {types.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="choerodon-sync-filter">
          <label htmlFor="choerodon-sync-assignee">{text("负责人", "Assignee")}</label>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter} disabled={loading || syncing}>
            <SelectTrigger id="choerodon-sync-assignee"><SelectValue /></SelectTrigger>
            <SelectContent container={selectContainer}>
              <SelectItem value="all">{text("全部人员", "All assignees")}</SelectItem>
              {assignees.map((assignee) => <SelectItem key={assignee.id} value={assignee.id}>{assignee.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="none" className="choerodon-sync-text-button" type="button" disabled={!hasFilters || syncing || loading} onClick={clearFilters}>{text("清除筛选", "Clear filters")}</Button>
      </div>
      <div className="choerodon-sync-selection">
        <label>
          <input ref={allCheckbox} type="checkbox" checked={allSelected} disabled={loading || syncing || !filteredIssues.length}
            onChange={(event) => {
              const checked = event.target.checked;
              setSelected((current) => {
                const next = new Set(current);
                filteredIssues.forEach((issue) => { if (checked) next.add(issue.id); else next.delete(issue.id); });
                return next;
              });
            }} />
          {text("全选当前结果", "Select all results")}
        </label>
        <span role="status">{text(`显示 ${filteredIssues.length} / ${issues.length} 条任务`, `Showing ${filteredIssues.length} / ${issues.length} tasks`)}</span>
      </div>
      <div className="choerodon-sync-body" aria-busy={loading}>
        {loading ? <p className="choerodon-sync-empty">{text("正在加载看板任务…", "Loading tasks…")}</p>
          : !error && filteredIssues.length === 0 ? <div className="choerodon-sync-empty">
            <Filter size={24} aria-hidden="true" />
            <h3>{hasFilters ? text("没有符合筛选条件的任务", "No matching tasks") : text("当前看板暂无任务", "No tasks on this board")}</h3>
            {hasFilters && <><p>{text("试试其他任务分组、类型或负责人，或清除筛选查看全部任务。", "Try a different group, type or assignee, or clear the filters.")}</p><Button variant="outline" size="sm" className="button secondary" type="button" onClick={clearFilters}>{text("查看全部任务", "Show all tasks")}</Button></>}
          </div>
          : <div className="choerodon-sync-grid">
            {filteredIssues.map((issue) => (
              <label key={issue.id} className={`choerodon-sync-card${selected.has(issue.id) ? " is-selected" : ""}`}>
                <div className="choerodon-sync-card-top">
                  <input type="checkbox" aria-label={text(`同步 ${issue.key}`, `Sync ${issue.key}`)}
                    checked={selected.has(issue.id)} disabled={syncing}
                    onChange={(event) => {
                      setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(issue.id); else next.delete(issue.id); return next; });
                    }} />
                  <span>{issue.key}</span>
                  <span className="choerodon-sync-badge" data-tone={groupColors.get(issue.groupId)} title={issue.groupName}>{issue.groupName}</span>
                </div>
                <h3>{issue.title}</h3>
                <div className="choerodon-sync-card-meta">
                  <span className="choerodon-sync-type">{issue.type}</span>
                  {issue.status !== issue.groupName && <span>{issue.status}</span>}
                  <span className="choerodon-sync-priority" data-priority={issue.priority} title={`${text("优先级", "Priority")} · ${issue.priorityName}`} aria-label={`${text("优先级", "Priority")} · ${issue.priorityName}`}>
                    {text("优先级", "Priority")} · {issue.priorityName}
                  </span>
                  {issue.dueDate && <span className="choerodon-sync-date"><CalendarDays size={12} aria-hidden="true" />{issue.dueDate}</span>}
                </div>
                <div className="choerodon-sync-card-bottom">
                  <span className="choerodon-sync-person">
                    <ActorAvatar actor={issue.assignee} className="task-property-assignee-avatar" />
                    <span className="task-property-trigger-label">{issue.assignee.name}</span>
                  </span>
                  <span className="choerodon-sync-mapping">{issue.localIdentifier
                    ? <><Link2 size={12} aria-hidden="true" />{text(`已关联 ${issue.localIdentifier}`, `Linked ${issue.localIdentifier}`)}</>
                    : text("待首次同步", "Not synced yet")}</span>
                </div>
              </label>
            ))}
          </div>}
      </div>
      <div ref={setSelectContainer} />
      <footer className="choerodon-sync-footer">
        {error && <p className="project-dialog-error" role="alert">{error} {!preview && <Button variant="outline" size="sm" type="button" className="button secondary" onClick={() => setReload((value) => value + 1)}>{text("重试", "Retry")}</Button>}</p>}
        <div className="choerodon-sync-actions">
          <div className="choerodon-sync-summary">
            <div><CheckCheck size={16} aria-hidden="true" /><strong>{text(`已选 ${selected.size} 条`, `${selected.size} selected`)}</strong>
              {selected.size > 0 && <Button variant="ghost" size="none" type="button" className="choerodon-sync-text-button" disabled={syncing} onClick={() => { setSelected(new Set()); }}>{text("清空选择", "Clear selection")}</Button>}
            </div>
            <p>{hiddenSelectedCount > 0
              ? text(`其中 ${hiddenSelectedCount} 条不在当前筛选内，也会同步`, `${hiddenSelectedCount} outside the current filters will also sync`)
              : text("重复同步更新原任务，保留本地开发状态", "Repeated sync updates the same task and keeps local status")}</p>
          </div>
          <Button variant="outline" size="sm" className="button secondary" type="button" disabled={syncing} onClick={onClose}>{text("关闭", "Close")}</Button>
          <Button variant="default" size="sm" className="button primary" type="button" disabled={loading || syncing || !selected.size} onClick={() => void sync()}>
            {syncing ? text("同步中…", "Syncing…") : text(`同步已选 (${selected.size})`, `Sync selected (${selected.size})`)}
          </Button>
        </div>
      </footer>
    </dialog>
  );
}
