import { describe, expect, it } from "vitest";
import { WORKBENCH_AREAS, getWorkbenchAreaById } from "./workbenchAreas";

describe("workbench areas", () => {
  it("defines the four product areas approved for the MVP", () => {
    expect(WORKBENCH_AREAS.map((area) => area.id)).toEqual(["import", "dashboard", "agent", "profile"]);
    expect(WORKBENCH_AREAS.map((area) => area.label)).toEqual(["导入", "数据大仪表盘", "Agent 追问", "个人中心"]);
  });

  it("keeps import focused on ingestion and import history instead of filters or reports", () => {
    const area = getWorkbenchAreaById("import");

    expect(area?.owns).toEqual(expect.arrayContaining(["模板下载", "CSV 导入", "导入校验", "历史导入"]));
    expect(area?.excludes).toEqual(expect.arrayContaining(["时间筛选", "项目筛选", "地区筛选", "服务中心选择", "自动复盘", "总报告"]));
  });

  it("makes the dashboard the owner of selection, service center choice, donut metrics, and dashboard questions", () => {
    const area = getWorkbenchAreaById("dashboard");

    expect(area?.owns).toEqual(
      expect.arrayContaining(["时间筛选", "项目筛选", "服务中心选择", "圆饼式指标盘", "仪表盘追问", "总报告", "专项报告"]),
    );
    expect(area?.principle).toContain("时间优先");
  });

  it("separates project conversations and account data from the dashboard", () => {
    expect(getWorkbenchAreaById("agent")?.owns).toEqual(expect.arrayContaining(["项目对话列表", "连续追问", "相关性判断"]));
    expect(getWorkbenchAreaById("profile")?.owns).toEqual(expect.arrayContaining(["账号设置", "数据库状态", "导入历史", "Agent 记录"]));
  });
});
