import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ApiError } from "../shared/api-fields.mjs";

// Desktop project assignments determine sidebar grouping; cwd can be a worktree.
export async function listCodexConversations(codexStatePath, projectName) {
  let state;
  try {
    state = JSON.parse(await readFile(codexStatePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { projectName, groups: [], threads: [] };
    throw new ApiError(502, "CODEX_PROJECTS_UNAVAILABLE", "无法读取本地 Codex 项目分组");
  }
  const groups = Object.entries(state["local-projects"] ?? {})
    .filter(([, project]) => project.name?.trim() === projectName.trim())
    .map(([id, project]) => ({ id, name: project.name }));
  if (!groups.length) return { projectName, groups, threads: [] };

  const directory = path.dirname(codexStatePath);
  const databases = (await readdir(directory)).filter((name) => /^state_\d+\.sqlite$/.test(name))
    .sort((a, b) => Number(b.match(/\d+/)[0]) - Number(a.match(/\d+/)[0]));
  if (!databases.length) throw new ApiError(404, "CODEX_SESSIONS_UNAVAILABLE", "未找到本地 Codex 会话数据库");
  const database = new DatabaseSync(path.join(directory, databases[0]), { readOnly: true });
  try {
    const query = database.prepare("SELECT id, title, cwd, updated_at FROM threads WHERE id = ? AND archived = 0");
    const groupIds = new Set(groups.map((group) => group.id));
    const threads = Object.entries(state["thread-project-assignments"] ?? {}).flatMap(([id, assignment]) => {
      if (assignment.projectKind !== "local" || !groupIds.has(assignment.projectId)) return [];
      const row = query.get(id);
      if (!row || !path.isAbsolute(row.cwd)) return [];
      return [{
        id: row.id, title: row.title || "未命名对话", updatedAt: new Date(row.updated_at * 1000).toISOString(),
        binding: {
          threadId: row.id, codexProjectId: assignment.projectId, codexProjectKind: "local",
          codexHostId: "local", workspacePath: row.cwd,
        },
      }];
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { projectName, groups, threads };
  } finally {
    database.close();
  }
}
