import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, type RefObject, type SyntheticEvent } from "react";
import { CODEX_AGENT_ACTOR, actorKey, assigneeTargetForActor } from "../actors";
import { taskPriorityLabel, taskStatusLabel, useTaskboardI18n } from "../i18n";
import { labelPresentation } from "../labels";
import type { TaskCardPresentation } from "../taskConversations";
import { TASK_PRIORITIES, TASK_STATUSES, type ActorIdentity, type Task, type TaskDraft, type TaskStatus } from "../types";
import { ActorAvatar } from "./ActorAvatar";
import { LinearIcon } from "./LinearIcon";
import { DueDateIcon, PriorityIcon, StatusIcon } from "./SemanticIcons";
import { TaskConversationMenu } from "./TaskConversationMenu";
import { TaskPropertyPicker } from "./TaskPropertyPicker";

const COLLAPSED_BY_DEFAULT = new Set<TaskStatus>(["backlog", "done", "canceled"]);

interface IssueListViewProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  tasks: Task[];
  presentations: Record<string, TaskCardPresentation>;
  currentUser: ActorIdentity;
  hasActiveFilters: boolean;
  selectedTaskIds: Set<string>;
  onToggleSelection: (taskId: string, checked: boolean) => void;
  onToggleSelectAll?: (checked: boolean) => void;
  onOpenTask: (task: Task) => void;
  onOpenConversation: (conversation: TaskCardPresentation["conversations"][number]) => void;
  onUpdate: (task: Task, changes: Partial<TaskDraft>) => Promise<Task>;
}

function createdDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(value));
}

function calendarDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

export function IssueListView({
  scrollRef,
  tasks,
  presentations,
  currentUser,
  hasActiveFilters,
  selectedTaskIds,
  onToggleSelection,
  onToggleSelectAll,
  onOpenTask,
  onOpenConversation,
  onUpdate,
}: IssueListViewProps) {
  const { language, locale, text } = useTaskboardI18n();
  const [collapsed, setCollapsed] = useState(() => new Set(COLLAPSED_BY_DEFAULT));
  const [priorityMenuTaskId, setPriorityMenuTaskId] = useState<string | null>(null);
  const [assigneeMenuTaskId, setAssigneeMenuTaskId] = useState<string | null>(null);

  const allSelected = tasks.length > 0 && tasks.every((t) => selectedTaskIds.has(t.id));
  const someSelected = tasks.some((t) => selectedTaskIds.has(t.id));
  const selectAllState: boolean | "indeterminate" = allSelected ? true : someSelected ? "indeterminate" : false;

  function stopRow(event: SyntheticEvent) {
    event.stopPropagation();
  }

  function toggleStatus(status: TaskStatus) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  return (
    <div className="issue-list-view" ref={scrollRef}>
      <div className="issue-list-column-headings">
        <span className="issue-list-selection">
          <Checkbox
            checked={selectAllState}
            disabled={tasks.length === 0}
            onCheckedChange={(checked) => onToggleSelectAll?.(checked === true)}
            aria-label={text("全选所有任务", "Select all issues")}
          />
        </span>
        <span>{text("任务", "Task")}</span>
        <span className="issue-list-metadata-headings">
          <span>{text("优先级", "Priority")}</span>
          <span>{text("标签", "Labels")}</span>
          <span>{text("截止日期", "Due")}</span>
          <span>{text("对话", "Chat")}</span>
          <span>{text("负责人", "Assignee")}</span>
        </span>
        <span>{text("创建日期", "Created")}</span>
        <span>{text("自动化", "Automation")}</span>
      </div>
      <div className="issue-list-groups">
        {TASK_STATUSES.map((status) => {
          const statusTasks = tasks.filter((task) => task.status === status);
          const isCollapsed = collapsed.has(status);
          const statusLabel = taskStatusLabel(language, status);
          return (
            <section className={`issue-list-group status-${status}`} key={status}>
              <Button variant="ghost" size="none" className="issue-list-group-header" type="button" onClick={() => toggleStatus(status)} aria-expanded={!isCollapsed}>
                <LinearIcon name={isCollapsed ? "chevronRight" : "chevronDown"} />
                <span className="issue-list-status-icon"><StatusIcon status={status} color="currentColor" size={14} /></span>
                <strong>{statusLabel}</strong>
                <span className="issue-list-group-count">{statusTasks.length}</span>
              </Button>
              {!isCollapsed && (
                <div className="issue-list-rows">
                  {statusTasks.length ? statusTasks.map((task) => {
                    const currentUserKey = actorKey(currentUser);
                    const currentAssignee = actorKey(task.assignee) === currentUserKey ? currentUser : task.assignee;
                    const assigneeOptions = [currentAssignee, currentUser, CODEX_AGENT_ACTOR]
                      .filter((actor, index, actors) => (
                        actors.findIndex((candidate) => actorKey(candidate) === actorKey(actor)) === index
                      ));
                    const displayIdentifier = task.externalKey ?? task.identifier;
                    return (
                      <div
                        className={`issue-list-row${presentations[task.id]?.unread ? " is-unread" : ""}${selectedTaskIds.has(task.id) ? " is-selected" : ""}`}
                        role="button"
                        tabIndex={0}
                        key={task.id}
                        onClick={() => onOpenTask(task)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") onOpenTask(task);
                        }}
                      >
                        <span className="issue-list-selection" onClick={stopRow} onKeyDown={stopRow}>
                          <Checkbox
                            checked={selectedTaskIds.has(task.id)}
                            onCheckedChange={(checked) => onToggleSelection(task.id, checked === true)}
                            aria-label={text(`选择任务 ${displayIdentifier}`, `Select issue ${displayIdentifier}`)}
                          />
                        </span>
                        <span className="issue-list-title-cell">
                          <small>{displayIdentifier}</small>
                          <strong title={task.title}>{task.title}</strong>
                          {presentations[task.id]?.unread && <span className="task-unread-dot" aria-label={text("有未读更新", "Unread updates")} />}
                        </span>
                        <span className="issue-list-metadata" aria-label={text("任务属性", "Issue properties")}>
                          <span className="issue-list-priority-control" onClick={stopRow} onKeyDown={stopRow}>
                            <TaskPropertyPicker
                              value={task.priority}
                              options={TASK_PRIORITIES.map((priority) => ({
                                value: priority,
                                label: taskPriorityLabel(language, priority),
                                icon: <PriorityIcon priority={priority} size={14} />,
                                className: `priority-${priority}`,
                              }))}
                              open={priorityMenuTaskId === task.id}
                              className="issue-list-property-picker"
                              triggerClassName={`issue-list-priority priority-${task.priority}`}
                              ariaLabel={text(`${displayIdentifier} 优先级`, `${displayIdentifier} priority`)}
                              onOpenChange={(open) => {
                                setPriorityMenuTaskId(open ? task.id : null);
                                if (open) setAssigneeMenuTaskId(null);
                              }}
                              onChange={(priority) => void onUpdate(task, { priority }).catch(() => {})}
                            />
                          </span>
                          <span className="issue-list-labels">
                            {task.labels.slice(0, 2).map((label) => {
                              const presentation = labelPresentation(label, language);
                              return (
                                <i className={presentation.tone ? `tone-${presentation.tone}` : ""} key={label}>
                                  {presentation.tone && <span aria-hidden="true" />}
                                  <b>{presentation.name}</b>
                                </i>
                              );
                            })}
                            {task.labels.length > 2 && <b>+{task.labels.length - 2}</b>}
                          </span>
                          {task.dueDate && (
                            <label className="issue-list-date" onClick={stopRow}>
                              <DueDateIcon color="currentColor" size={12} />
                              <span>{calendarDate(task.dueDate, locale)}</span>
                              <input
                                type="date"
                                aria-label={text(`${displayIdentifier} 截止日期`, `${displayIdentifier} due date`)}
                                value={task.dueDate}
                                onChange={(event) => void onUpdate(task, {
                                  dueDate: event.target.value || null,
                                  ...(event.target.value ? {} : { recurrence: null }),
                                }).catch(() => {})}
                              />
                            </label>
                          )}
                          <TaskConversationMenu
                            conversations={presentations[task.id]?.conversations ?? []}
                            onOpenConversation={onOpenConversation}
                          />
                          <span className="issue-list-assignee-control" onClick={stopRow} onKeyDown={stopRow}>
                            <TaskPropertyPicker
                              value={actorKey(task.assignee)}
                              options={assigneeOptions.map((actor) => ({
                                value: actorKey(actor),
                                label: actorKey(actor) === currentUserKey
                                  ? `${actor.name}${text("（我）", " (me)")}`
                                  : actor.name,
                                icon: <ActorAvatar actor={actor} className="task-property-assignee-avatar" />,
                              }))}
                              open={assigneeMenuTaskId === task.id}
                              disabled={task.source === "jira"}
                              className="issue-list-property-picker issue-list-assignee-picker"
                              triggerClassName="issue-list-assignee"
                              triggerContent={(
                                <>
                                  <ActorAvatar actor={task.assignee} />
                                  <span>{task.assignee.name}</span>
                                </>
                              )}
                              ariaLabel={text(`${displayIdentifier} 负责人`, `${displayIdentifier} assignee`)}
                              title={text(`负责人：${task.assignee.name}`, `Assignee: ${task.assignee.name}`)}
                              onOpenChange={(open) => {
                                setAssigneeMenuTaskId(open ? task.id : null);
                                if (open) setPriorityMenuTaskId(null);
                              }}
                              onChange={(value) => {
                                const selected = assigneeOptions.find((actor) => actorKey(actor) === value);
                                const target = selected ? assigneeTargetForActor(selected, currentUser) : undefined;
                                if (target) void onUpdate(task, { assigneeTarget: target }).catch(() => {});
                              }}
                            />
                          </span>
                        </span>
                        <time
                          dateTime={task.createdAt}
                          title={text(
                            `创建于 ${new Date(task.createdAt).toLocaleString(locale)}`,
                            `Created ${new Date(task.createdAt).toLocaleString(locale)}`,
                          )}
                        >
                          {createdDate(task.createdAt, locale)}
                        </time>
                        <span
                          className="issue-list-automation-cell"
                          onClick={stopRow}
                          onKeyDown={stopRow}
                          onPointerDown={stopRow}
                          onMouseDown={stopRow}
                        >
                          {task.status === "todo" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="inline-flex"
                                  onClick={stopRow}
                                  onPointerDown={stopRow}
                                  onMouseDown={stopRow}
                                >
                                  <Switch
                                    size="sm"
                                    aria-label={task.automationEnabled ? text("关闭自动化", "Disable automation") : text("开启自动化", "Enable automation")}
                                    checked={Boolean(task.automationEnabled)}
                                    onClick={stopRow}
                                    onPointerDown={stopRow}
                                    onMouseDown={stopRow}
                                    onCheckedChange={(checked) => void onUpdate(task, { automationEnabled: checked }).catch(() => {})}
                                  />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {task.automationEnabled ? text("关闭自动化", "Disable automation") : text("开启自动化", "Enable automation")}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                      </div>
                    );
                  }) : (
                    <div className="issue-list-empty">
                      {hasActiveFilters
                        ? text("当前筛选下没有匹配任务", "No issues match the current filters")
                        : text(`没有${statusLabel}任务`, `No ${statusLabel.toLowerCase()} issues`)}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
