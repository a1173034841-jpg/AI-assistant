import type { NormalizedFeedback, ThirdPartySurveyExport } from "./types";

export function mapSurveyExportToFeedback(source: ThirdPartySurveyExport): NormalizedFeedback[] {
  return source.records.map((record) => ({
    ...record,
    sourceLabel: `${source.platform} · ${source.sourceName}`,
    displayLocation: [record.region, record.city, record.serviceCenter].filter(Boolean).join(" / ") || "未标注",
  }));
}
