import { describe, expect, it } from "vitest";
import { buildWorkbenchWorkflowSteps } from "./workbenchFlow";

describe("workbench workflow", () => {
  it("keeps the main path as import auto recap, scope filtering, and report generation", () => {
    const steps = buildWorkbenchWorkflowSteps("scope", {
      importStatus: "已通过",
      filterLabel: "2026-05-01 至 2026-06-01 · 项目 / 地区 / 服务中心",
      scopeLabel: "月 · 2026-05-01 至 2026-06-01 · 全部项目 · 全国",
      reportLabel: "已自动生成",
    });

    expect(steps.map((step) => step.id)).toEqual(["import", "scope", "report"]);
    expect(steps.map((step) => step.label)).toEqual(["1 导入与自动复盘", "2 筛选与下钻", "3 报告与追问"]);
    expect(steps[0].guide).toContain("核心结论");
    expect(steps[1].guide).toContain("时间、项目、地区、城市、服务中心");
    expect(steps[2].guide).toContain("Agent");
    expect(steps[2].guide).toContain("当前筛选范围");
  });
});
