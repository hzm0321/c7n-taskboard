import type { TaskboardLanguage } from "./i18n";

const LABEL_COLORS = [
  { name: "缺陷", color: "#eb5757" },
  { name: "特性", color: "#bb87fc" },
  { name: "改进", color: "#4ea7fc" },
  { name: "文档", color: "#5b8cff" },
  { name: "测试", color: "#0f766e" },
  { name: "维护", color: "#d99b25" },
] as const;

export function labelColor(name: string): string {
  return LABEL_COLORS.find((label) => label.name === name)?.color ?? "#8b8d92";
}

export type LabelTone = "bug" | "feature" | null;

export function labelDisplayName(name: string, language: TaskboardLanguage = "zh"): string {
  if (name === "缺陷" || name.toLocaleUpperCase() === "BUG") return "BUG";
  if (name === "特性" || name === "新功能") return language === "zh" ? "新功能" : "Feature";
  if (name === "改进") return language === "zh" ? "改进" : "Improvement";
  if (name === "文档") return language === "zh" ? "文档" : "Documentation";
  if (name === "测试") return language === "zh" ? "测试" : "Testing";
  if (name === "维护") return language === "zh" ? "维护" : "Maintenance";
  return name;
}

export function labelTone(name: string): LabelTone {
  if (name === "缺陷" || name.toLocaleUpperCase() === "BUG") return "bug";
  if (name === "特性" || name === "新功能") return "feature";
  return null;
}

export function labelPresentation(name: string, language: TaskboardLanguage = "zh") {
  const tone = labelTone(name);
  return {
    name: labelDisplayName(name, language),
    tone,
    color: tone === "bug" ? "#eb5757" : tone === "feature" ? "#bb87fc" : labelColor(name),
  };
}
