import { describe, expect, it } from "vitest";
import { buildFindingsForScenario, buildMetricSummary } from "./analysisRules";
import { answerWorkbenchQuestion, buildSuggestedAgentQuestions } from "./agentRules";
import { mapSurveyExportToFeedback } from "./importMapper";
import type { ThirdPartySurveyExport } from "./types";

const exportFixture: ThirdPartySurveyExport = {
  exportId: "export-agent",
  platform: "问卷星",
  exportedAt: "2026-05-27T09:00:00+08:00",
  sourceName: "售后体验回访问卷",
  projectName: "A 项目：五一售后服务专项",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-10",
  records: [
    {
      id: "fb-agent-1",
      submittedAt: "2026-05-06T18:20:00+08:00",
      platform: "问卷星",
      region: "华南",
      city: "深圳",
      serviceCenter: "深圳南山服务中心",
      serviceScenario: "移动服务",
      rating: 2,
      npsScore: 4,
      feedbackText: "移动服务预约后等了两天才确认，沟通回复慢。",
      contact: { consentState: "已授权联系" },
    },
    {
      id: "fb-agent-2",
      submittedAt: "2026-05-07T19:10:00+08:00",
      platform: "问卷星",
      region: "华南",
      city: "广州",
      serviceCenter: "广州番禺服务中心",
      serviceScenario: "到店服务",
      rating: 5,
      npsScore: 10,
      feedbackText: "接待主动，维修结果解释清楚。",
      contact: { consentState: "拒绝联系" },
    },
  ],
};

describe("workbench agent rules", () => {
  it("answers relevant metric questions from current workbench data", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const metrics = buildMetricSummary(records);
    const findings = buildFindingsForScenario(records, "区域/城市下钻");
    const answer = answerWorkbenchQuestion({
      question: "当前净推荐值是多少，主要风险是什么？",
      records,
      metrics,
      findings,
      scopeLabel: "2026-05-01 至 2026-05-10 · 全部项目 · 全国",
    });

    expect(answer.refused).toBe(false);
    expect(answer.content).toContain("净推荐值");
    expect(answer.content).toContain(`${metrics.netPromoterScore}`);
    expect(answer.evidenceQuotes.length).toBeGreaterThan(0);
  });

  it("refuses questions unrelated to this after-sales analysis tool", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const answer = answerWorkbenchQuestion({
      question: "帮我写一首诗，再查一下天气",
      records,
      metrics: buildMetricSummary(records),
      findings: buildFindingsForScenario(records, "区域/城市下钻"),
      scopeLabel: "2026-05-01 至 2026-05-10 · 全部项目 · 全国",
    });

    expect(answer.refused).toBe(true);
    expect(answer.content).toContain("只能回答本工具");
    expect(answer.evidenceQuotes).toHaveLength(0);
  });

  it("answers data source questions as valid operations analysis context", () => {
    const records = mapSurveyExportToFeedback({
      ...exportFixture,
      records: [
        ...exportFixture.records,
        {
          ...exportFixture.records[0],
          id: "fb-agent-3",
          platform: "腾讯问卷",
          city: "上海",
          serviceCenter: "上海浦东服务中心",
        },
      ],
    });
    const answer = answerWorkbenchQuestion({
      question: "一共涉及多少个数据来源？",
      records,
      metrics: buildMetricSummary(records),
      findings: buildFindingsForScenario(records, "区域/城市下钻"),
      scopeLabel: "2026-05-01 至 2026-05-10 · 全部项目 · 全国",
    });

    expect(answer.refused).toBe(false);
    expect(answer.content).toContain("2 个数据来源");
    expect(answer.content).toContain("问卷星 2 条");
    expect(answer.content).toContain("腾讯问卷 1 条");
  });

  it("answers data coverage questions with current projects, cities and service centers", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const answer = answerWorkbenchQuestion({
      question: "当前覆盖多少个城市和服务中心？",
      records,
      metrics: buildMetricSummary(records),
      findings: buildFindingsForScenario(records, "区域/城市下钻"),
      scopeLabel: "2026-05-01 至 2026-05-10 · 全部项目 · 全国",
    });

    expect(answer.refused).toBe(false);
    expect(answer.content).toContain("覆盖 1 个项目");
    expect(answer.content).toContain("2 个城市");
    expect(answer.content).toContain("2 个服务中心");
  });

  it("answers tool usage questions instead of treating platform names as data inventory", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const answer = answerWorkbenchQuestion({
      question: "怎么导入问卷星表格？",
      records,
      metrics: buildMetricSummary(records),
      findings: buildFindingsForScenario(records, "区域/城市下钻"),
      scopeLabel: "2026-05-01 至 2026-05-10 · 全部项目 · 全国",
    });

    expect(answer.refused).toBe(false);
    expect(answer.content).toContain("CSV");
    expect(answer.content).toContain("导入");
  });

  it("suggests follow-up questions from the current filtered data", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const metrics = buildMetricSummary(records);
    const findings = buildFindingsForScenario(records, "区域/城市下钻");
    const questions = buildSuggestedAgentQuestions({
      records,
      metrics,
      findings,
      scopeLabel: "2026-05-01 至 2026-05-10 · 全部项目 · 全国",
    });

    expect(questions.length).toBeGreaterThanOrEqual(4);
    expect(questions.some((question) => question.includes("深圳南山服务中心"))).toBe(true);
    expect(questions.some((question) => question.includes("已授权联系"))).toBe(true);
    expect(questions.every((question) => question.includes("天气") === false)).toBe(true);
  });
});
