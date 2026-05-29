import type { AnalysisFinding, MetricSummary, ScenarioOutput, WorkbenchScenario } from "./types";

export function createScenarioOutput(
  scenario: WorkbenchScenario,
  findings: AnalysisFinding[],
  metrics: MetricSummary,
): ScenarioOutput {
  const selectedFindings = findings.slice(0, 4);
  const title = scenarioTitle(scenario);
  const isClosureList = scenario === "服务问题闭环";
  const sections = isClosureList
    ? selectedFindings.map((finding, index) => buildClosureTask(finding, index))
    : selectedFindings.map((finding) => ({
        heading: finding.title,
        content: `${finding.summary} 动作：${finding.recommendedAction}`,
        evidenceQuoteIds: finding.evidenceQuotes.map((quote) => quote.feedbackId),
        evidenceQuotes: finding.evidenceQuotes,
      }));
  const executiveSummary = buildExecutiveSummary(scenario, selectedFindings, metrics);

  return {
    scenario,
    title,
    executiveSummary,
    outputKind: isClosureList ? "closure-list" : "report",
    sections,
    copyableText: renderCopyableText(title, executiveSummary, selectedFindings, metrics),
  };
}

export function createExecutiveReport(findings: AnalysisFinding[], metrics: MetricSummary): ScenarioOutput {
  const selectedFindings = findings.slice(0, 5);
  const title = "售后体验总报告";
  const actionItems = buildExecutiveActions(selectedFindings, metrics);
  const executiveSummary = selectedFindings.length
    ? [
        `本批样本最需要处理的不是“反馈有多少”，而是低分集中在哪里、哪个环节在拖累体验、下周谁要跟进。`,
        `当前共 ${metrics.totalFeedback} 条反馈，低分 ${metrics.lowScoreCount} 条，贬损者 ${metrics.detractorCount} 条，负向占比 ${metrics.negativeRate}%。`,
        metrics.topNegativeStage ? `主要风险环节是${metrics.topNegativeStage}。` : "",
        metrics.riskiestServiceCenter
          ? `优先服务中心是 ${metrics.riskiestServiceCenter.city} / ${metrics.riskiestServiceCenter.serviceCenter}。`
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "当前反馈不足，需要补充更多车主原话后再生成总报告。";
  const sections = actionItems.map((item) => ({
    heading: item.heading,
    content: item.content,
    evidenceQuoteIds: item.evidenceQuoteIds,
    evidenceQuotes: item.evidenceQuotes,
  }));

  return {
    scenario: "区域/城市下钻",
    title,
    executiveSummary,
    outputKind: "report",
    sections,
    copyableText: renderCopyableText(title, executiveSummary, selectedFindings, metrics),
  };
}

function buildClosureTask(finding: AnalysisFinding, index: number) {
  const primaryQuote = finding.evidenceQuotes[0];
  const location = primaryQuote?.scoreSource.location ?? "当前筛选范围";
  const priority = finding.severity === "高" ? "高优先级" : finding.severity === "中" ? "中优先级" : "观察项";
  const deadline = finding.severity === "高" ? "48 小时内首次回访，7 日内复盘处理结果" : "本周内核实原因，下周例会复盘";
  const callbackScript = primaryQuote
    ? `回访时先核实原话中提到的“${primaryQuote.quote.slice(0, 24)}”是否仍存在，再确认服务中心处理状态。`
    : "回访时先核实问题是否仍存在，再确认服务中心处理状态。";

  return {
    heading: `${index + 1}. ${location} · ${finding.serviceStage}`,
    meta: `${priority} · ${finding.sentiment} · ${finding.severity}严重度`,
    content: [
      `问题：${finding.summary}`,
      `动作：${finding.recommendedAction}`,
      `时限：${deadline}`,
      `回访口径：${callbackScript}`,
    ].join("\n"),
    actionLabel: priority,
    evidenceQuoteIds: finding.evidenceQuotes.map((quote) => quote.feedbackId),
    evidenceQuotes: finding.evidenceQuotes,
  };
}

function buildExecutiveActions(findings: AnalysisFinding[], metrics: MetricSummary) {
  const highRiskFinding = findings.find((finding) => finding.severity === "高") ?? findings[0];
  const positiveFinding = findings.find((finding) => finding.sentiment === "正向");
  const riskCenter = metrics.riskiestServiceCenter;

  return [
    {
      heading: "1. 本周先处理的风险",
      content: riskCenter
        ? `${riskCenter.city} / ${riskCenter.serviceCenter} 是当前优先处理对象，需拉出低分原话，确认是否需要服务中心回访、区域督办或专项复盘。`
        : "当前没有形成明显服务中心集中风险，建议继续扩大样本或按城市查看低分记录。",
      evidenceQuoteIds: highRiskFinding?.evidenceQuotes.map((quote) => quote.feedbackId) ?? [],
      evidenceQuotes: highRiskFinding?.evidenceQuotes ?? [],
    },
    {
      heading: "2. 体验下降的主要原因",
      content: metrics.topNegativeStage
          ? `${metrics.topNegativeStage}是当前最影响体验的环节。报告应优先解释该环节发生了什么、覆盖哪些城市、是否影响服务评分和净推荐值。`
        : "当前没有明显负向环节，需要结合更多时间段或项目批次继续观察。",
      evidenceQuoteIds: highRiskFinding?.evidenceQuotes.map((quote) => quote.feedbackId) ?? [],
      evidenceQuotes: highRiskFinding?.evidenceQuotes ?? [],
    },
    {
      heading: "3. 下周复盘要追的动作",
      content: highRiskFinding
        ? highRiskFinding.recommendedAction
        : "补充问卷样本后再生成责任动作。",
      evidenceQuoteIds: highRiskFinding?.evidenceQuotes.map((quote) => quote.feedbackId) ?? [],
      evidenceQuotes: highRiskFinding?.evidenceQuotes ?? [],
    },
    {
      heading: "4. 可以保留的正向样本",
      content: positiveFinding
        ? positiveFinding.recommendedAction
        : "当前筛选范围内正向样本不足，暂不建议输出服务故事或外部口碑素材。",
      evidenceQuoteIds: positiveFinding?.evidenceQuotes.map((quote) => quote.feedbackId) ?? [],
      evidenceQuotes: positiveFinding?.evidenceQuotes ?? [],
    },
  ];
}

function scenarioTitle(scenario: WorkbenchScenario): string {
  const titles: Record<WorkbenchScenario, string> = {
    服务问题闭环: "服务问题闭环清单",
    满意度归因: "满意度与低分归因报告",
    "区域/城市下钻": "区域、城市与服务中心下钻报告",
    活动体验复盘: "活动体验复盘报告",
    口碑素材与风险: "口碑素材与风险摘要",
  };

  return titles[scenario];
}

function buildExecutiveSummary(
  scenario: WorkbenchScenario,
  findings: AnalysisFinding[],
  metrics: MetricSummary,
): string {
  if (!findings.length) return "当前反馈不足，需要补充更多车主原话后再生成结论。";
  if (scenario === "服务问题闭环") {
    return `这不是总报告，而是给服务运营执行的闭环任务清单。它只保留需要处理的低分、负向或已授权联系样本：本批低分 ${metrics.lowScoreCount} 条、待跟进 ${metrics.followUpCount} 条。每条任务都需要明确对象、问题、证据、处理动作和复盘时限。`;
  }
  const majorStages = findings.map((finding) => finding.serviceStage).join("、");
  const nextAction = firstAction(findings);
  return `本次${scenario}聚焦 ${majorStages}。本批样本中低分 ${metrics.lowScoreCount} 条、待跟进 ${metrics.followUpCount} 条，建议先执行：${nextAction}`;
}

function renderCopyableText(
  title: string,
  summary: string,
  findings: AnalysisFinding[],
  metrics: MetricSummary,
): string {
  const body = findings
    .map((finding, index) => {
      const quotes = finding.evidenceQuotes.map((quote) => `  - 证据原话：${quote.quote}`).join("\n");
      return `${index + 1}. ${finding.title}\n结论：${finding.summary}\n${quotes}\n  - 下一步动作：${finding.recommendedAction}`;
    })
    .join("\n\n");

  return `# ${title}\n\n${summary}\n\n关键指标：反馈 ${metrics.totalFeedback} 条；平均评分 ${metrics.averageRating}；净推荐值 ${metrics.netPromoterScore}；负向占比 ${metrics.negativeRate}%；待跟进 ${metrics.followUpCount} 条。\n\n${body}`;
}

function firstAction(findings: AnalysisFinding[]): string {
  return findings.find((finding) => finding.severity === "高")?.recommendedAction ?? findings[0].recommendedAction;
}
