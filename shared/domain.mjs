export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "canceled",
];
export const TASK_PRIORITIES = ["none", "urgent", "high", "medium", "low"];

export const DEFAULT_PROJECT_ID = "local";
export const JIRA_PROJECT_ID = "jira-my-tasks";
export const DEFAULT_LABEL_NAMES = [
  "缺陷",
  "特性",
  "改进",
  "文档",
  "测试",
  "维护",
];

export function isTaskStatus(value) {
  return TASK_STATUSES.includes(value);
}

export function isTaskPriority(value) {
  return TASK_PRIORITIES.includes(value);
}
