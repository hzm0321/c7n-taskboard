import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ApiError, listProjectSkills } from "../api";
import { useTaskboardI18n } from "../i18n";
import type { ProjectSkills } from "../types";
import { Button } from "./ui/button";
import "./ProjectSkillsView.css";

interface ProjectSkillsViewProps {
  projectId: string;
  workspacePath?: string;
  codexProjectId?: string;
  codexThreadId?: string;
}

export function ProjectSkillsView({ projectId, workspacePath, codexProjectId, codexThreadId }: ProjectSkillsViewProps) {
  const { text } = useTaskboardI18n();
  const [data, setData] = useState<ProjectSkills | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError(null);
    void listProjectSkills(projectId, { workspacePath, codexProjectId, codexThreadId }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError && (err.code === "LOCAL_COMPANION_REQUIRED" || err.code === "LOCAL_ONLY")
          ? text("读取项目技能需要连接本地 Taskboard 服务。", "Reading project skills requires the local Taskboard service.")
          : err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [projectId, workspacePath, codexProjectId, codexThreadId, revision, text]);

  return (
    <div className="project-skills-container">
      <div className="project-skills-content">
        <header className="project-skills-header">
          <div className="project-skills-heading">
            <h1>{text("技能", "Skills")}</h1>
            {data && <span>{text(`${data.skills.length} 个技能`, `${data.skills.length} skills`)}</span>}
          </div>
          <Button variant="ghost" size="icon" type="button" className="icon-button"
            aria-label={text("刷新技能列表", "Refresh skills")}
            title={text("刷新技能列表", "Refresh skills")}
            disabled={loading}
            onClick={() => setRevision((current) => current + 1)}>
            <RefreshCw />
          </Button>
        </header>

        {data?.workspacePath && <p className="project-skills-workspace">{data.workspacePath}</p>}

        {loading ? (
          <p className="project-skills-status" role="status">{text("正在读取项目技能…", "Loading project skills…")}</p>
        ) : error ? (
          <div className="project-skills-status" role="alert">
            <h2>{text("无法读取项目技能", "Unable to read project skills")}</h2>
            <p>{error}</p>
            <Button variant="outline" size="sm" type="button" className="button secondary"
              onClick={() => setRevision((current) => current + 1)}>
              {text("重试", "Try again")}
            </Button>
          </div>
        ) : !data?.workspacePath ? (
          <div className="project-skills-status">
            <h2>{text("未关联工程目录", "No workspace linked")}</h2>
            <p>{text("当前项目尚未关联本机工程目录。", "This project has no local workspace linked.")}</p>
          </div>
        ) : data.skills.length === 0 ? (
          <div className="project-skills-status">
            <h2>{text("未发现技能", "No skills found")}</h2>
            <p>{text("工程的常见技能目录中没有找到 SKILL.md。", "No SKILL.md files were found in the project's standard skill directories.")}</p>
          </div>
        ) : (
          <ul className="project-skills-list" aria-label={text("项目技能", "Project skills")}>
            {data.skills.map((skill) => (
              <li key={skill.path}>
                <div className="project-skill-heading">
                  <h2>{skill.name}</h2>
                  <code>{skill.path}</code>
                </div>
                <p>{skill.description || text("暂无说明", "No description")}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
