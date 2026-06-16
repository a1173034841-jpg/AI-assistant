import type { AnalysisFinding, EvidenceQuote, MetricSummary, NormalizedFeedback } from "./types";
import { classifyAgentQuestion } from "./agentIntentClassifier";

export type WorkbenchAgentInput = {
  question: string;
  records: NormalizedFeedback[];
  metrics: MetricSummary;
  findings: AnalysisFinding[];
  scopeLabel: string;
};

export type WorkbenchAgentAnswer = {
  refused: boolean;
  content: string;
  reasoningContent?: string;
  evidenceQuotes: EvidenceQuote[];
};

export function answerWorkbenchQuestion(input: WorkbenchAgentInput): WorkbenchAgentAnswer {
  const classification = classifyAgentQuestion(input.question);
  if (!classification.allowed) {
    return {
      refused: true,
      content: classification.message,
      evidenceQuotes: [],
    };
  }

  if (classification.intent === "data_inventory") {
    return answerDataInventoryQuestion(input);
  }

  if (classification.intent === "tool_usage") {
    return answerToolUsageQuestion();
  }

  const topFinding = input.findings[0];
  const evidenceQuotes = input.findings.flatMap((finding) => finding.evidenceQuotes).slice(0, 3);
  const riskText = topFinding
    ? `当前优先关注“${topFinding.serviceStage}”：${topFinding.summary}`
    : "当前范围暂未形成明确问题，需要补充样本或调整筛选范围。";

  return {
    refused: false,
    content: [
      `当前范围：${input.scopeLabel}。`,
      `净推荐值为 ${input.metrics.netPromoterScore}，推荐者 ${input.metrics.promoterCount} 条、贬损者 ${input.metrics.detractorCount} 条，低分反馈 ${input.metrics.lowScoreCount} 条。`,
      riskText,
      evidenceQuotes.length ? `回答依据来自当前筛选范围内的指标和 ${evidenceQuotes.length} 条原话证据。` : "当前缺少可引用原话，建议人工复核后再外发结论。",
    ].join(" "),
    evidenceQuotes,
  };
}

function answerDataInventoryQuestion(input: WorkbenchAgentInput): WorkbenchAgentAnswer {
  const sourceCounts = input.records.reduce((counts, record) => {
    const source = record.platform || record.sourceLabel.split("·")[0]?.trim() || "未标注来源";
    counts.set(source, (counts.get(source) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const projectCount = new Set(input.records.map((record) => record.projectName).filter(Boolean)).size;
  const cityCount = new Set(input.records.map((record) => record.city).filter(Boolean)).size;
  const serviceCenterCount = new Set(input.records.map((record) => record.serviceCenter).filter(Boolean)).size;
  const sourceSummary = Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => `${source} ${count} 条`)
    .join("、");

  return {
    refused: false,
    content: [
      `当前范围共有 ${input.records.length} 条反馈，覆盖 ${projectCount} 个项目、${cityCount} 个城市、${serviceCenterCount} 个服务中心。`,
      sourceCounts.size
        ? `一共涉及 ${sourceCounts.size} 个数据来源，分别是：${sourceSummary}。`
        : "当前范围没有可统计的数据来源，建议先确认导入表格中的“问卷来源”或“数据来源”字段。",
      "这个回答基于当前筛选范围内的结构化导入字段统计。",
    ].join(" "),
    evidenceQuotes: [],
  };
}

function answerToolUsageQuestion(): WorkbenchAgentAnswer {
  return {
    refused: false,
    content:
      "当前 MVP 支持导入第三方问卷导出的 CSV 表格。建议先按标准模板整理项目名称、问卷来源、提交时间、城市、服务中心、服务评分、推荐意愿评分和开放反馈原话等字段，再点击导入区域的“选择 CSV 文件”。导入后系统会自动校验字段，并基于当前数据生成复盘和可追问上下文。",
    evidenceQuotes: [],
  };
}

export function buildSuggestedAgentQuestions(input: Omit<WorkbenchAgentInput, "question">): string[] {
  const topFinding = input.findings[0];
  const riskiestCenter = input.metrics.riskiestServiceCenter;
  const projectNames = Array.from(new Set(input.records.map((record) => record.projectName))).filter(Boolean);
  const authorizedLowScoreCount = input.records.filter(
    (record) =>
      record.contact?.consentState === "已授权联系" &&
      ((record.rating ?? 5) <= 2 || (record.npsScore ?? 10) <= 6),
  ).length;
  const questions = [
    `当前范围的净推荐值为什么是 ${input.metrics.netPromoterScore}？请结合推荐者和贬损者解释。`,
    topFinding
      ? `${topFinding.serviceStage}为什么成为当前优先问题？请列出证据原话。`
      : "当前范围为什么没有形成明确高发问题？需要补充哪些样本？",
    riskiestCenter
      ? `${riskiestCenter.city}/${riskiestCenter.serviceCenter}为什么被标记为风险服务中心？`
      : "当前范围有没有需要优先关注的风险服务中心？",
    authorizedLowScoreCount
      ? `请列出 ${authorizedLowScoreCount} 条已授权联系且低分的反馈，整理成回访清单。`
      : "当前有没有已授权联系且需要回访的低分反馈？",
    projectNames.length > 1
      ? `这 ${projectNames.length} 个项目里，哪个项目最拖累当前体验表现？`
      : `请总结${projectNames[0] ? `“${projectNames[0]}”` : "当前项目"}下一步最应该处理的 3 个动作。`,
  ];

  return Array.from(new Set(questions)).slice(0, 5);
}
