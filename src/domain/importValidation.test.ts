import { describe, expect, it } from "vitest";
import { buildImportValidationSummary } from "./importValidation";
import type { ThirdPartySurveyExport } from "./types";

const validExport: ThirdPartySurveyExport = {
  exportId: "export-1",
  platform: "问卷星",
  exportedAt: "2026-05-11T10:00:00+08:00",
  sourceName: "五一售后回访问卷",
  projectName: "A 项目：五一售后服务专项",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-10",
  records: [
    {
      id: "fb-1",
      submittedAt: "2026-05-01T09:30:00+08:00",
      platform: "问卷星",
      region: "华南",
      city: "深圳",
      serviceCenter: "深圳南山服务中心",
      serviceScenario: "移动服务",
      rating: 2,
      npsScore: 4,
      feedbackText: "预约确认慢，后续解释不清楚。",
      contact: { phoneMasked: "138****2400", consentState: "已授权联系" },
    },
    {
      id: "fb-2",
      submittedAt: "2026-05-10T18:30:00+08:00",
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

describe("import validation", () => {
  it("computes validation results from selected project exports", () => {
    const summary = buildImportValidationSummary([validExport]);

    expect(summary.overallStatus).toBe("pass");
    expect(summary.stats).toEqual({
      sourceCount: 1,
      recordCount: 2,
      inferredStart: "2026-05-01",
      inferredEnd: "2026-05-10",
    });
    expect(summary.items.find((item) => item.id === "project-consistency")?.status).toBe("pass");
    expect(summary.items.find((item) => item.id === "required-fields")?.metric).toBe("2/2");
    expect(summary.items.find((item) => item.id === "metric-coverage")?.detail).toContain("评分 2 条");
    expect(summary.items.find((item) => item.id === "privacy-check")?.status).toBe("pass");
  });

  it("reports warnings and failures for incomplete or risky imports", () => {
    const brokenExport: ThirdPartySurveyExport = {
      ...validExport,
      periodStart: "2026-05-03",
      periodEnd: "2026-05-09",
      records: [
        {
          ...validExport.records[0],
          id: "fb-broken",
          submittedAt: "2026-05-02T09:30:00+08:00",
          city: "",
          serviceCenter: "",
          rating: undefined,
          npsScore: undefined,
          feedbackText: "",
          contact: { phoneMasked: "13812345678", consentState: "已授权联系" },
        },
      ],
    };

    const summary = buildImportValidationSummary([brokenExport]);

    expect(summary.overallStatus).toBe("fail");
    expect(summary.items.find((item) => item.id === "time-range")?.status).toBe("warning");
    expect(summary.items.find((item) => item.id === "required-fields")?.status).toBe("fail");
    expect(summary.items.find((item) => item.id === "metric-coverage")?.status).toBe("fail");
    expect(summary.items.find((item) => item.id === "privacy-check")?.status).toBe("fail");
  });
});
