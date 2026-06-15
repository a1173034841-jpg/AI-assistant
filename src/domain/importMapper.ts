import type { NormalizedFeedback, ThirdPartySurveyExport } from "./types";

export function mapSurveyExportToFeedback(source: ThirdPartySurveyExport): NormalizedFeedback[] {
  return source.records.map((record) => ({
    ...record,
    sourceLabel: `${source.platform} · ${source.sourceName}`,
    displayLocation: [record.region, record.city, record.serviceCenter].filter(Boolean).join(" / ") || "未标注",
    projectName: source.projectName,
    projectType: inferProjectType(source.projectName),
  }));
}

function inferProjectType(projectName: string): string {
  if (projectName.includes("服务专项")) return "售后服务专项";
  if (projectName.includes("月中") || projectName.includes("回访")) return "服务回访";
  if (projectName.includes("周度") || projectName.includes("监测")) return "常规监测";
  if (projectName.includes("App")) return "App 触点反馈";
  if (projectName.includes("活动") || projectName.includes("社群")) return "用户运营活动";
  return "未分类项目";
}
