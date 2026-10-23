import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { JSON_SCHEMA, load as loadYaml } from "js-yaml";

const SKILL_DIRECTORIES = [
  ".agents/skills",
  ".claude/skills",
  ".codex/skills",
  ".cursor/skills",
  ".github/skills",
  "skills",
];

function skillMetadata(source, directoryName) {
  const frontmatter = source.replace(/^\uFEFF/, "").match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---(?:[ \t]*\r?\n|[ \t]*$)/);
  let metadata;
  if (frontmatter) {
    try {
      metadata = loadYaml(frontmatter[1], { schema: JSON_SCHEMA });
    } catch {
      // A skill without readable metadata still appears under its directory name.
    }
  }
  return {
    name: typeof metadata?.name === "string" && metadata.name.trim() ? metadata.name.trim() : directoryName,
    description: typeof metadata?.description === "string" ? metadata.description.trim() : "",
  };
}

export async function scanProjectSkills(workspacePath) {
  if (!workspacePath) return { workspacePath: null, skills: [] };
  const root = path.resolve(workspacePath);
  if (!(await stat(root)).isDirectory()) throw new Error("Project workspace is not a directory");
  const skills = [];
  const seen = new Set();
  for (const sourceDirectory of SKILL_DIRECTORIES) {
    let entries;
    try {
      entries = await readdir(path.join(root, sourceDirectory), { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const relativePath = path.posix.join(sourceDirectory, entry.name, "SKILL.md");
      const filename = path.join(root, relativePath);
      let source, actualPath;
      try {
        actualPath = await realpath(filename);
        if (seen.has(actualPath)) continue;
        source = await readFile(filename, "utf8");
      } catch (error) {
        if (error.code === "ENOENT" || error.code === "ENOTDIR") continue;
        throw error;
      }
      seen.add(actualPath);
      skills.push({ ...skillMetadata(source, entry.name), path: relativePath, sourceDirectory });
    }
  }
  skills.sort((left, right) => left.name.localeCompare(right.name) || left.path.localeCompare(right.path));
  return { workspacePath: root, skills };
}
