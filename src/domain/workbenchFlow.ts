export type StepId = "import" | "scope" | "report";

export type WorkbenchWorkflowStep = {
  id: StepId;
  label: string;
  status: string;
  description: string;
  guide: string;
};

export function buildWorkbenchWorkflowSteps(
  activeStepId: StepId,
  state: {
    importStatus: string;
    filterLabel: string;
    scopeLabel: string;
    reportLabel: string;
  },
): WorkbenchWorkflowStep[] {
  return [
    {
      id: "import",
      label: "1 导入与自动复盘",
      status: state.importStatus,
      description: "字段校验与自动复盘",
      guide: "先导入问卷结果。系统完成字段识别和导入校验后，立即展示本批数据的核心结论、风险线索和可执行建议。",
    },
    {
      id: "scope",
      label: "2 筛选与下钻",
      status: activeStepId === "scope" ? "正在筛选" : "已设定",
      description: state.filterLabel,
      guide: "在这一步集中完成时间、项目、地区、城市、服务中心筛选，并保留指标、服务中心下钻和原始评论查看能力。",
    },
    {
      id: "report",
      label: "3 报告与追问",
      status: state.reportLabel,
      description: state.scopeLabel,
      guide: "生成总报告和专项交付内容，并通过追问 Agent 围绕当前筛选范围继续分析细节。",
    },
  ];
}
