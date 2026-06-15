import type { AnalysisFinding, MetricDimension, MetricGroup, MetricSummary } from "./types";

type CoreMetricKey = "experience" | "negative-risk" | "root-stage" | "center-risk" | "closure";
type MetricTone = "success" | "danger" | "warning" | "info" | "neutral";

export type CoreMetricDashboardCard = {
  key: CoreMetricKey;
  title: string;
  description: string;
  role: string;
  evidenceLabel: string;
  actionLabel: string;
  tone: MetricTone;
  primaryLabel: string;
  primaryValue: string;
  progress: number;
  helper: string;
  metrics: MetricDimension[];
  diagnosisTitle: string;
  diagnosisHelper: string;
  linkLabels: string[];
  emptyText: string;
};

export function buildCoreMetricDashboardCards(metrics: MetricSummary): CoreMetricDashboardCard[] {
  const totalFeedback = Math.max(metrics.totalFeedback, 1);
  const byLabel = new Map(metrics.metricDimensions.map((metric) => [metric.label, metric]));
  const metric = (label: string) => byLabel.get(label);
  const makeMetric = (label: string, value: string, unitLabel: string, typeLabel: string, helper: string) => ({
    label,
    value,
    unitLabel,
    typeLabel,
    helper,
  });
  const riskiestCenter = metrics.riskiestServiceCenter;
  const topStageCount =
    metrics.stageBreakdown.find((item) => item.stage === (metrics.topNegativeStage ?? metrics.topStage))?.count ?? 0;

  return [
    {
      key: "experience",
      title: "本期服务满意度",
      description: "用评分、净推荐值和低分样本判断本期售后体验。",
      role: "支撑总报告的体验判断",
      evidenceLabel: "看低分、负向原话和高严重度样本",
      actionLabel: "定位拉低满意度的原因",
      tone: "success",
      primaryLabel: metric("满意率")?.label ?? "满意率",
      primaryValue: formatMetricValue(metric("满意率")),
      progress: calculateMetricProgress(metric("满意率"), totalFeedback),
      helper: "点击后查看拉低本期满意度的主要问题。",
      metrics: compactMetrics([
        metric("平均服务评分"),
        metric("净推荐值"),
        metric("满意率"),
        metric("推荐者/贬损者"),
        metric("低分反馈"),
      ]),
      diagnosisTitle: "影响本期服务满意度的问题",
      diagnosisHelper: "这里展示会影响服务评分、净推荐值和满意率的反馈。它服务于总报告的整体判断，不替代分报告。",
      linkLabels: ["平均服务评分", "净推荐值", "满意率", "低分反馈"],
      emptyText: "当前本期服务满意度没有明显拖累项。",
    },
    {
      key: "negative-risk",
      title: "低分与负反馈",
      description: "识别低分、负向原话、疑似投诉和口碑风险。",
      role: "支撑分报告的问题风险筛选",
      evidenceLabel: "看低分、负向和疑似投诉原话",
      actionLabel: "判断哪些问题需要优先复盘",
      tone: "danger",
      primaryLabel: metric("负向占比")?.label ?? "负向占比",
      primaryValue: formatMetricValue(metric("负向占比")),
      progress: calculateMetricProgress(metric("负向占比"), totalFeedback),
      helper: "点击后查看低分、负向和疑似投诉反馈。",
      metrics: compactMetrics([metric("负向占比"), metric("低分反馈"), metric("口碑风险"), metric("高发环节")]),
      diagnosisTitle: "低分与负反馈对应的问题",
      diagnosisHelper: "这里展示已经形成风险的反馈，用于决定分报告里哪些问题需要展开，不和总报告的整体结论重复。",
      linkLabels: ["负向占比", "低分反馈", "口碑风险", "高严重度"],
      emptyText: "当前没有形成明确负向风险问题。",
    },
    {
      key: "root-stage",
      title: "问题集中环节",
      description: "定位问题主要发生在哪个售后服务环节。",
      role: "支撑总报告和分报告的归因",
      evidenceLabel: "看高发环节下的问题和原话",
      actionLabel: "判断预约、接待、维修交付等环节谁在拖累体验",
      tone: "info",
      primaryLabel: "高发环节",
      primaryValue: metrics.topNegativeStage ?? metrics.topStage ?? "暂无",
      progress: calculateMetricProgress(makeMetric("高发环节样本", `${topStageCount}`, "条", "样本数", ""), totalFeedback),
      helper: "点击后查看问题最多的服务环节及原话。",
      metrics: [
        makeMetric("高发环节", metrics.topNegativeStage ?? metrics.topStage ?? "暂无", "", "归因", "当前范围内反馈最集中的服务环节。"),
        makeMetric("环节样本", `${topStageCount}`, "条", "样本数", "当前高发环节对应的反馈数量。"),
        ...compactMetrics([metric("负向占比"), metric("低分反馈")]),
      ],
      diagnosisTitle: "问题集中环节对应的证据",
      diagnosisHelper: "这里解释问题为什么集中在该服务环节。它给总报告提供主因，也给分报告提供下钻入口。",
      linkLabels: ["高发环节", "服务阶段", "问题标签", "原话证据"],
      emptyText: "当前主因环节下暂无可展开问题。",
    },
    {
      key: "center-risk",
      title: "重点关注服务中心",
      description: "识别需要区域或服务运营介入的城市和服务中心。",
      role: "支撑区域/城市下钻和工单分发",
      evidenceLabel: "看服务中心维度的低分和负向原话",
      actionLabel: "判断哪些服务中心要回访、督办或复盘",
      tone: "warning",
      primaryLabel: "风险样本",
      primaryValue: riskiestCenter ? `${riskiestCenter.negativeCount}条` : "暂无",
      progress: calculateMetricProgress(
        makeMetric("风险样本", `${riskiestCenter?.negativeCount ?? 0}`, "条", "样本数", ""),
        totalFeedback,
      ),
      helper: riskiestCenter ? `${riskiestCenter.city} / ${riskiestCenter.serviceCenter}` : "当前范围暂无重点关注服务中心。",
      metrics: [
        makeMetric("风险服务中心", riskiestCenter?.serviceCenter ?? "暂无", "", "定位", "负向反馈相对集中的服务中心。"),
        makeMetric("风险城市", riskiestCenter?.city ?? "暂无", "", "定位", "风险服务中心所在城市。"),
        makeMetric("负向样本", `${riskiestCenter?.negativeCount ?? 0}`, "条", "样本数", "该服务中心的负向反馈数量。"),
        makeMetric("网点样本", `${riskiestCenter?.totalFeedback ?? 0}`, "条", "样本数", "该服务中心纳入当前范围的反馈数量。"),
      ],
      diagnosisTitle: "重点关注服务中心对应的问题",
      diagnosisHelper: "这里展示和服务中心直接相关的问题，用于区域下钻、工单分发和服务中心复盘。",
      linkLabels: ["风险服务中心", "城市", "负向样本", "服务中心原话"],
      emptyText: "当前没有形成明确重点关注服务中心。",
    },
    {
      key: "closure",
      title: "待回访/待闭环反馈",
      description: "确认哪些反馈需要回访、工单、责任确认或人工复核。",
      role: "支撑服务问题闭环清单",
      evidenceLabel: "看可回访、低分、高严重度和需复核样本",
      actionLabel: "形成后续处理清单",
      tone: "neutral",
      primaryLabel: metric("待跟进")?.label ?? "待跟进",
      primaryValue: formatMetricValue(metric("待跟进")),
      progress: calculateMetricProgress(metric("待跟进"), totalFeedback),
      helper: "点击后查看可转成回访或工单的反馈。",
      metrics: compactMetrics([metric("待跟进"), metric("联系授权率"), metric("需人工复核"), metric("低分反馈")]),
      diagnosisTitle: "待回访/待闭环反馈对应的问题",
      diagnosisHelper: "这里展示可以进入服务问题闭环清单的反馈。它不承担总报告判断，只承担执行分发。",
      linkLabels: ["待跟进", "联系授权率", "需人工复核", "处理动作"],
      emptyText: "当前没有形成明确待回访或待闭环反馈。",
    },
  ];
}

export function getAuxiliaryMetricGroups(metrics: MetricSummary): MetricGroup[] {
  const byLabel = new Map(metrics.metricDimensions.map((metric) => [metric.label, metric]));
  const pick = (labels: string[]) =>
    labels.map((label) => byLabel.get(label)).filter((metric): metric is MetricDimension => Boolean(metric));

  return [
    {
      title: "数据覆盖",
      description: "用于判断本次分析覆盖哪里，不直接代表好坏。",
      metrics: pick(["反馈量", "覆盖区域", "覆盖城市", "覆盖服务中心"]),
    },
    {
      title: "数据质量",
      description: "用于判断报告可信度，异常时提示人工确认。",
      metrics: pick(["需人工复核"]),
    },
  ];
}

export function getLinkedFindingsForMetricCard(
  card: CoreMetricDashboardCard | undefined,
  findings: AnalysisFinding[],
): AnalysisFinding[] {
  if (!card) return findings;

  if (card.key === "experience") {
    const linked = findings.filter((finding) => finding.sentiment !== "正向" || finding.severity !== "低");
    return linked.length ? linked : findings.slice(0, 3);
  }

  if (card.key === "negative-risk") {
    return findings.filter((finding) => finding.sentiment === "负向" || finding.severity === "高");
  }

  if (card.key === "root-stage") {
    const topStage = card.metrics.find((metric) => metric.label === "高发环节")?.value;
    if (!topStage || topStage === "暂无") return findings.slice(0, 1);
    return findings.filter((finding) => finding.serviceStage === topStage);
  }

  if (card.key === "center-risk") {
    const center = card.metrics.find((metric) => metric.label === "风险服务中心")?.value;
    if (!center || center === "暂无") return [];
    return findings.filter((finding) =>
      finding.evidenceQuotes.some((quote) => quote.scoreSource.location.includes(center)),
    );
  }

  if (card.key === "closure") {
    return findings.filter((finding) => finding.severity === "高" || finding.reviewRequired);
  }

  return findings;
}

export function getMetricFindingReason(card: CoreMetricDashboardCard | undefined, finding: AnalysisFinding): string {
  if (!card) return "命中当前筛选范围。";

  if (card.key === "experience") {
    return `命中本期服务满意度：${finding.sentiment}反馈 / ${finding.severity}严重度，会影响服务评分、净推荐值或满意率判断。`;
  }

  if (card.key === "negative-risk") {
    return `命中低分与负反馈：${finding.sentiment}反馈 / ${finding.severity}严重度，适合进入问题风险复盘。`;
  }

  if (card.key === "root-stage") {
    return `命中问题集中环节：该问题属于“${finding.serviceStage}”，与当前高发服务环节一致。`;
  }

  if (card.key === "center-risk") {
    const center = card.metrics.find((metric) => metric.label === "风险服务中心")?.value ?? "风险服务中心";
    return `命中重点关注服务中心：原话证据来自“${center}”，可追溯到具体服务中心。`;
  }

  if (card.key === "closure") {
    return `命中待回访/待闭环反馈：${finding.severity}严重度${finding.reviewRequired ? "，且需要人工复核" : ""}，可转入后续跟进。`;
  }

  return "命中当前指标。";
}

function compactMetrics(metrics: Array<MetricDimension | undefined>): MetricDimension[] {
  return metrics.filter((metric): metric is MetricDimension => Boolean(metric));
}

function formatMetricValue(metric: MetricDimension | undefined): string {
  if (!metric) return "-";
  return `${metric.value}${metric.unitLabel}`;
}

function calculateMetricProgress(metric: MetricDimension | undefined, totalFeedback: number): number {
  if (!metric) return 0;
  const numericValue = Number(metric.value);
  if (!Number.isFinite(numericValue)) return metric.value === "暂无" ? 0 : 100;
  if (metric.unitLabel === "%") return clampPercent(numericValue);
  if (metric.label === "平均服务评分") return clampPercent(numericValue * 20);
  if (metric.label === "净推荐值") return clampPercent((numericValue + 100) / 2);
  if (metric.label === "需人工复核") return clampPercent(100 - (numericValue / totalFeedback) * 100);
  if (metric.unitLabel === "条") return clampPercent((numericValue / totalFeedback) * 100);
  return clampPercent(numericValue);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
