import { describe, expect, it } from "vitest";
import {
  buildFindingsForScenario,
  buildFocusRegionInsights,
  buildMetricSummary,
  buildRegionTree,
  filterRecordsByDate,
  filterRecordsByGeoSelection,
} from "./analysisRules";
import { mapSurveyExportToFeedback } from "./importMapper";
import { createScenarioOutput } from "./outputTemplates";
import type { ThirdPartySurveyExport } from "./types";

const exportFixture: ThirdPartySurveyExport = {
  exportId: "export-1",
  platform: "问卷星",
  exportedAt: "2026-05-27T09:00:00+08:00",
  sourceName: "华南售后体验回访问卷",
  projectName: "A 项目：五一售后服务专项",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-10",
  records: [
    {
      id: "fb-1",
      submittedAt: "2026-05-26T18:20:00+08:00",
      platform: "问卷星",
      region: "华南",
      city: "深圳",
      serviceCenter: "深圳南山服务中心",
      serviceScenario: "移动服务",
      rating: 2,
      npsScore: 4,
      feedbackText: "移动服务预约后等了两天才确认，沟通回复慢，最后解释也不清楚。",
      contact: { name: "周先生", phoneMasked: "138****2468", consentState: "已授权联系" },
    },
    {
      id: "fb-2",
      submittedAt: "2026-05-26T19:10:00+08:00",
      platform: "问卷星",
      region: "华南",
      city: "广州",
      serviceCenter: "广州番禺服务中心",
      serviceScenario: "到店服务",
      rating: 5,
      npsScore: 10,
      feedbackText: "接待很主动，维修结果解释得清楚，交付时还提醒了后续保养注意事项。",
      contact: { consentState: "拒绝联系" },
    },
  ],
};

describe("after-sales text workbench domain flow", () => {
  it("keeps third-party survey feedback normalized without leaking raw contact fields", () => {
    const records = mapSurveyExportToFeedback(exportFixture);

    expect(records).toHaveLength(2);
    expect(records[0].sourceLabel).toBe("问卷星 · 华南售后体验回访问卷");
    expect(records[0].contact?.phoneMasked).toBe("138****2468");
    expect(records[0].feedbackText).toContain("移动服务预约");
  });

  it("builds evidence-backed findings for a service issue closure scenario", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const findings = buildFindingsForScenario(records, "服务问题闭环");

    expect(findings.some((finding) => finding.severity === "高")).toBe(true);
    expect(findings[0].evidenceQuotes.length).toBeGreaterThan(0);
    expect(findings[0].evidenceQuotes[0].quote).toContain("等了两天");
  });

  it("renders scenario output with copyable text and evidence references", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const metrics = buildMetricSummary(records);
    const findings = buildFindingsForScenario(records, "区域/城市下钻");
    const output = createScenarioOutput("区域/城市下钻", findings, metrics);

    expect(output.title).toContain("区域");
    expect(output.copyableText).toContain("证据原话");
    expect(output.copyableText).toContain("关键指标");
    expect(output.sections.every((section) => section.evidenceQuoteIds.length > 0)).toBe(true);
  });

  it("renders service issue closure as task list instead of a generic report", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const metrics = buildMetricSummary(records);
    const findings = buildFindingsForScenario(records, "服务问题闭环");
    const output = createScenarioOutput("服务问题闭环", findings, metrics);

    expect(output.outputKind).toBe("closure-list");
    expect(output.executiveSummary).toContain("不是总报告");
    expect(output.sections[0].content).toContain("时限");
    expect(output.sections[0].content).toContain("回访口径");
  });

  it("builds a region tree grouped by region, city and service center", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const regionTree = buildRegionTree(records);

    expect(regionTree[0].cities[0].serviceCenters[0].records[0].id).toBe("fb-1");
    expect(regionTree[0].totalFeedback).toBeGreaterThan(0);
  });

  it("filters by project time range and geography selection", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const filteredRecords = filterRecordsByDate(records, "2026-05-26", "2026-05-26");
    const cityRecords = filterRecordsByGeoSelection(filteredRecords, { regions: [], cities: ["深圳"] });
    const centerRecords = filterRecordsByGeoSelection(filteredRecords, {
      regions: [],
      cities: [],
      serviceCenter: { city: "深圳", serviceCenter: "深圳南山服务中心" },
    });

    expect(filteredRecords).toHaveLength(2);
    expect(cityRecords).toHaveLength(1);
    expect(centerRecords).toHaveLength(1);
    expect(centerRecords[0].id).toBe("fb-1");
  });

  it("summarizes service metrics beyond NPS for decision making", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const summary = buildMetricSummary(records);

    expect(summary.totalFeedback).toBe(2);
    expect(summary.followUpCount).toBe(1);
    expect(summary.lowScoreCount).toBe(1);
    expect(summary.detractorCount).toBe(1);
    expect(summary.promoterCount).toBe(1);
    expect(summary.passiveCount).toBe(0);
    expect(summary.negativeRate).toBeGreaterThan(0);
    expect(summary.satisfactionRate).toBe(50);
    expect(summary.contactAuthorizationRate).toBe(50);
    expect(summary.metricDimensions.length).toBeGreaterThan(8);
    expect(summary.metricGroups).toHaveLength(5);
    expect(summary.stageBreakdown.length).toBeGreaterThan(0);
    expect(summary.riskiestServiceCenter?.serviceCenter).toBe("深圳南山服务中心");
  });

  it("calculates the NPS index from NPS respondents instead of all feedback records", () => {
    const records = mapSurveyExportToFeedback({
      ...exportFixture,
      records: [
        {
          ...exportFixture.records[0],
          id: "promoter",
          npsScore: 10,
          rating: undefined,
        },
        {
          ...exportFixture.records[1],
          id: "missing-nps",
          npsScore: undefined,
          rating: 5,
        },
      ],
    });

    const summary = buildMetricSummary(records);
    const npsMetric = summary.metricDimensions.find((metric) => metric.label === "净推荐值（NPS）");

    expect(summary.netPromoterScore).toBe(100);
    expect(summary.npsRespondentCount).toBe(1);
    expect(npsMetric?.value).toBe("100");
    expect(npsMetric?.helper).toContain("范围为 -100 到 100");
  });

  it("finds good and risky service areas for focus review", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const insights = buildFocusRegionInsights(records);

    expect(insights.some((insight) => insight.tone === "good")).toBe(true);
    expect(insights.some((insight) => insight.tone === "risk")).toBe(true);
    expect(insights.every((insight) => insight.evidenceQuotes.length > 0)).toBe(true);
    expect(insights.every((insight) => insight.evidenceQuotes.every((quote) => quote.reasonToUse.includes("代表性依据")))).toBe(true);
  });

  it("returns multiple typical good and risky service areas when the scope contains enough candidates", () => {
    const records = mapSurveyExportToFeedback({
      ...exportFixture,
      records: [
        ...exportFixture.records,
        {
          ...exportFixture.records[0],
          id: "fb-3",
          city: "上海",
          serviceCenter: "上海浦东服务中心",
          rating: 1,
          npsScore: 3,
          feedbackText: "到店后等待太久，问题解释不清楚，第二次到店还是没有解决。",
        },
        {
          ...exportFixture.records[1],
          id: "fb-4",
          city: "南京",
          serviceCenter: "南京江宁服务中心",
          rating: 5,
          npsScore: 10,
          feedbackText: "接待人员主动解释维修项目，交车提醒很完整，整体体验很好。",
        },
      ],
    });

    const insights = buildFocusRegionInsights(records);

    expect(insights.filter((insight) => insight.tone === "good")).toHaveLength(2);
    expect(insights.filter((insight) => insight.tone === "risk")).toHaveLength(2);
    expect(insights.map((insight) => insight.serviceCenter)).toContain("南京江宁服务中心");
    expect(insights.map((insight) => insight.serviceCenter)).toContain("上海浦东服务中心");
  });
});
