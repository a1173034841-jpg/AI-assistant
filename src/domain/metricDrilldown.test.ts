import { describe, expect, it } from "vitest";
import { buildFindingsForScenario, buildMetricSummary } from "./analysisRules";
import { buildCoreMetricDashboardCards, getAuxiliaryMetricGroups, getLinkedFindingsForMetricCard } from "./metricDrilldown";
import { mapSurveyExportToFeedback } from "./importMapper";
import type { ThirdPartySurveyExport } from "./types";

const exportFixture: ThirdPartySurveyExport = {
  exportId: "export-drilldown",
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
      contact: { consentState: "已授权联系" },
    },
    {
      id: "fb-2",
      submittedAt: "2026-05-26T19:10:00+08:00",
      platform: "问卷星",
      region: "华南",
      city: "深圳",
      serviceCenter: "深圳南山服务中心",
      serviceScenario: "移动服务",
      rating: 1,
      npsScore: 2,
      feedbackText: "预约排队很久，移动服务确认慢，问题没有说清楚。",
      contact: { consentState: "拒绝联系" },
    },
    {
      id: "fb-3",
      submittedAt: "2026-05-26T20:10:00+08:00",
      platform: "问卷星",
      region: "华东",
      city: "上海",
      serviceCenter: "上海浦东服务中心",
      serviceScenario: "到店服务",
      rating: 5,
      npsScore: 10,
      feedbackText: "接待主动，维修结果解释清楚，交付提醒完整。",
      contact: { consentState: "拒绝联系" },
    },
    {
      id: "fb-4",
      submittedAt: "2026-05-27T10:10:00+08:00",
      platform: "问卷星",
      region: "华北",
      city: "北京",
      serviceCenter: "北京亦庄服务中心",
      serviceScenario: "App/OTA",
      rating: 3,
      npsScore: 7,
      feedbackText: "App 推送说明不够清楚，服务人员后面有解释。",
      contact: { consentState: "未询问" },
    },
  ],
};

describe("metric drilldown", () => {
  it("keeps only action-oriented core dashboards and moves coverage or quality to auxiliary context", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const metrics = buildMetricSummary(records);
    const cards = buildCoreMetricDashboardCards(metrics);
    const auxiliaryGroups = getAuxiliaryMetricGroups(metrics);

    expect(cards.map((card) => card.title)).toEqual([
      "本期服务满意度",
      "低分与负反馈",
      "问题集中环节",
      "重点关注服务中心",
      "待回访/待闭环反馈",
    ]);
    expect(cards.map((card) => card.role)).toEqual([
      "支撑总报告的体验判断",
      "支撑分报告的问题风险筛选",
      "支撑总报告和分报告的归因",
      "支撑区域/城市下钻和工单分发",
      "支撑服务问题闭环清单",
    ]);
    expect(cards.every((card) => card.evidenceLabel.includes("看"))).toBe(true);
    expect(cards.every((card) => card.linkLabels.length > 0)).toBe(true);
    expect(cards.map((card) => card.title)).not.toContain("范围覆盖指标");
    expect(cards.map((card) => card.title)).not.toContain("数据质量指标");
    expect(auxiliaryGroups.map((group) => group.title)).toEqual(["数据覆盖", "数据质量"]);
  });

  it("links every core dashboard to its own problem findings instead of reusing one generic list", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const metrics = buildMetricSummary(records);
    const findings = buildFindingsForScenario(records, "区域/城市下钻");
    const cards = buildCoreMetricDashboardCards(metrics);

    const linkedByTitle = new Map(cards.map((card) => [card.title, getLinkedFindingsForMetricCard(card, findings)]));

    expect(linkedByTitle.get("本期服务满意度")?.length).toBeGreaterThan(0);
    expect(linkedByTitle.get("低分与负反馈")?.every((finding) => finding.sentiment === "负向" || finding.severity === "高")).toBe(true);
    expect(linkedByTitle.get("问题集中环节")?.every((finding) => finding.serviceStage === metrics.topNegativeStage)).toBe(true);
    expect(
      linkedByTitle
        .get("重点关注服务中心")
        ?.every((finding) =>
          finding.evidenceQuotes.some((quote) => quote.scoreSource.location.includes(metrics.riskiestServiceCenter?.serviceCenter ?? "")),
        ),
    ).toBe(true);
    expect(linkedByTitle.get("待回访/待闭环反馈")?.every((finding) => finding.severity === "高" || finding.reviewRequired)).toBe(true);
  });
});
