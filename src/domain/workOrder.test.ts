import { describe, expect, it } from "vitest";
import { buildFindingsForScenario, buildFocusRegionInsights } from "./analysisRules";
import { createWorkOrderDraftFromInsight, createWorkOrderEmailDraft } from "./workOrder";
import { mapSurveyExportToFeedback } from "./importMapper";
import type { ThirdPartySurveyExport } from "./types";

const exportFixture: ThirdPartySurveyExport = {
  exportId: "export-work-order",
  platform: "问卷星",
  exportedAt: "2026-05-27T09:00:00+08:00",
  sourceName: "售后体验回访问卷",
  projectName: "A 项目：五一售后服务专项",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-10",
  records: [
    {
      id: "fb-work-order-1",
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
      id: "fb-work-order-2",
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

describe("work order draft", () => {
  it("creates an email work order from a service center insight with evidence and action", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const insight = buildFocusRegionInsights(records).find((item) => item.tone === "risk");
    const finding = buildFindingsForScenario(records, "服务问题闭环")[0];

    if (!insight) throw new Error("risk insight missing");

    const draft = createWorkOrderDraftFromInsight({
      insight,
      scopeLabel: "2026-05-01 至 2026-05-10 · 全部项目 · 华南",
      relatedFinding: finding,
      channel: "email",
    });

    expect(draft.channel).toBe("email");
    expect(draft.serviceCenter).toBe("深圳南山服务中心");
    expect(draft.subject).toContain("深圳南山服务中心");
    expect(draft.copyableText).toContain("移动服务预约后等了两天才确认");
    expect(draft.copyableText).toContain("处理要求");
    expect(draft.copyableText).toContain("工单编号");
    expect(draft.copyableText).toContain("处理时限");
    expect(draft.copyableText).toContain("回访要求");
    expect(draft.copyableText).not.toContain("典型概况");
    expect(draft.copyableText).not.toContain("沉淀成");
    expect(draft.evidence[0]).toMatchObject({
      submittedAt: "2026-05-06T18:20:00+08:00",
      rating: 2,
      recommendationScore: 4,
    });
    expect(draft.integrationTargetOptions).toEqual(["email", "feishu", "wecom", "dingtalk"]);
  });

  it("builds a simplified email draft for the generated work order", () => {
    const records = mapSurveyExportToFeedback(exportFixture);
    const insight = buildFocusRegionInsights(records).find((item) => item.tone === "risk");

    if (!insight) throw new Error("risk insight missing");

    const draft = createWorkOrderDraftFromInsight({
      insight,
      scopeLabel: "2026-05-01 至 2026-05-10 · 全部项目 · 华南",
      channel: "email",
    });
    const emailDraft = createWorkOrderEmailDraft(draft, "shenzhen.service@example.com");

    expect(emailDraft.to).toBe("shenzhen.service@example.com");
    expect(emailDraft.subject).toBe(draft.subject);
    expect(emailDraft.body).toBe(draft.copyableText);
    expect(emailDraft.mailtoHref).toContain("mailto:shenzhen.service@example.com");
    expect(emailDraft.mailtoHref).toContain(encodeURIComponent(draft.subject));
    expect(emailDraft.mailtoHref).toContain(encodeURIComponent(draft.copyableText));
  });
});
