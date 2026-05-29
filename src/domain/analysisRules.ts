import { stageIssueTags, stageKeywords } from "./taxonomy";
import type {
  AnalysisFinding,
  FeedbackImportRecord,
  FocusRegionInsight,
  MetricSummary,
  EvidenceQuote,
  NormalizedFeedback,
  RegionTree,
  Region,
  Sentiment,
  ServiceScenario,
  ServiceStage,
  Severity,
  WorkbenchScenario,
} from "./types";

export type GeoSelection = {
  regions: Region[];
  cities: string[];
  serviceCenter?: {
    city: string;
    serviceCenter: string;
  };
};

export function buildFindingsForScenario(
  records: NormalizedFeedback[],
  scenario: WorkbenchScenario,
): AnalysisFinding[] {
  const eligibleRecords = filterRecordsForScenario(records, scenario);
  const findingsByStage = new Map<ServiceStage, NormalizedFeedback[]>();

  for (const record of eligibleRecords) {
    const stage = detectServiceStage(record.feedbackText);
    const existing = findingsByStage.get(stage) ?? [];
    findingsByStage.set(stage, [...existing, record]);
  }

  return Array.from(findingsByStage.entries())
    .map(([stage, stageRecords], index) => createFinding(index + 1, stage, stageRecords, scenario))
    .sort((a, b) => severityScore(b.severity) - severityScore(a.severity));
}

export function buildFocusRegionInsights(records: NormalizedFeedback[]): FocusRegionInsight[] {
  const centers = groupByCenter(records);
  const centerSummaries = Array.from(centers.values()).map((centerRecords) => {
    const positiveRecords = centerRecords.filter((record) => detectSentiment(record) === "正向");
    const negativeRecords = centerRecords.filter((record) => detectSentiment(record) === "负向");
    const city = centerRecords[0].city ?? "未标注城市";
    const serviceCenter = centerRecords[0].serviceCenter ?? "未标注服务中心";

    return {
      city,
      serviceCenter,
      records: centerRecords,
      positiveRecords,
      negativeRecords,
      averageRating: average(centerRecords.map((record) => record.rating).filter((value): value is number => value !== undefined)),
      negativeCount: negativeRecords.length,
      positiveCount: positiveRecords.length,
    };
  });

  const bestCenters = centerSummaries
    .filter((item) => item.positiveCount > 0)
    .sort((a, b) => b.positiveCount - a.positiveCount || b.averageRating - a.averageRating || b.records.length - a.records.length)
    .slice(0, 3);
  const worstCenters = centerSummaries
    .filter((item) => item.negativeCount > 0)
    .sort((a, b) => b.negativeCount - a.negativeCount || a.averageRating - b.averageRating || b.records.length - a.records.length)
    .slice(0, 3);

  return [
    ...bestCenters.map((center) =>
      createFocusInsight({
          tone: "good",
          title: "可复制的好区域",
          location: center.city,
          serviceCenter: center.serviceCenter,
          records: center.records,
          representativeRecords: center.positiveRecords,
          recommendedAction: "把这类服务动作沉淀成区域话术和服务中心案例，优先复制到同类服务场景。",
        }),
    ),
    ...worstCenters.map((center) =>
      createFocusInsight({
          tone: "risk",
          title: "需要处理的差区域",
          location: center.city,
          serviceCenter: center.serviceCenter,
          records: center.records,
          representativeRecords: center.negativeRecords,
          recommendedAction: "先拉出低分样本做回访核实，再要求服务中心给出原因、责任人和下周复盘状态。",
        }),
    ),
  ];
}

export function buildMetricSummary(records: NormalizedFeedback[]): MetricSummary {
  const totalFeedback = records.length;
  const ratings = records.map((record) => record.rating).filter((value): value is number => value !== undefined);
  const npsScores = records.map((record) => record.npsScore).filter((value): value is number => value !== undefined);
  const negativeCount = records.filter((record) => detectSentiment(record) === "负向").length;
  const lowScoreCount = records.filter((record) => (record.rating ?? 5) <= 2 || (record.npsScore ?? 10) <= 6).length;
  const detractorCount = records.filter((record) => record.npsScore !== undefined && record.npsScore <= 6).length;
  const passiveCount = records.filter((record) => record.npsScore !== undefined && record.npsScore >= 7 && record.npsScore <= 8).length;
  const promoterCount = records.filter((record) => record.npsScore !== undefined && record.npsScore >= 9).length;
  const npsRespondentCount = npsScores.length;
  const netPromoterScore = calculateNetPromoterScore(promoterCount, detractorCount, npsRespondentCount);
  const followUpCount = records.filter((record) => record.contact?.consentState === "已授权联系" || detectSeverity(record) === "高").length;
  const authorizedCount = records.filter((record) => record.contact?.consentState === "已授权联系").length;
  const reviewRequiredCount = records.filter((record) => record.rating === undefined || record.npsScore === undefined).length;
  const stageBreakdown = countBy(records.map((record) => detectServiceStage(record.feedbackText))).map(([stage, count]) => ({
    stage,
    count,
  }));
  const negativeStageBreakdown = countBy(
    records.filter((record) => detectSentiment(record) === "负向").map((record) => detectServiceStage(record.feedbackText)),
  );
  const metricDimensions = buildMetricDimensions({
    totalFeedback,
    ratings,
    negativeCount,
    lowScoreCount,
    detractorCount,
    passiveCount,
    promoterCount,
    npsRespondentCount,
    followUpCount,
    authorizedCount,
    reviewRequiredCount,
    regionCount: new Set(records.map((record) => record.region).filter(Boolean)).size,
    cityCount: new Set(records.map((record) => record.city).filter(Boolean)).size,
    serviceCenterCount: new Set(records.map((record) => record.serviceCenter).filter(Boolean)).size,
  });

  return {
    totalFeedback,
    averageRating: average(ratings),
    averageNps: average(npsScores),
    netPromoterScore,
    npsRespondentCount,
    negativeRate: totalFeedback ? Math.round((negativeCount / totalFeedback) * 100) : 0,
    satisfactionRate: totalFeedback ? Math.round((records.filter((record) => (record.rating ?? 0) >= 4).length / totalFeedback) * 100) : 0,
    contactAuthorizationRate: totalFeedback ? Math.round((authorizedCount / totalFeedback) * 100) : 0,
    lowScoreCount,
    detractorCount,
    passiveCount,
    promoterCount,
    followUpCount,
    reviewRequiredCount,
    metricDimensions,
    metricGroups: buildMetricGroups(metricDimensions),
    topStage: stageBreakdown[0]?.stage,
    topNegativeStage: negativeStageBreakdown[0]?.[0],
    riskiestServiceCenter: findRiskiestServiceCenter(records),
    stageBreakdown,
    scenarioBreakdown: countBy(records.map((record) => record.serviceScenario)).map(([scenario, count]) => ({
      scenario,
      count,
    })),
  };
}

export function filterRecordsByGeoSelection(records: NormalizedFeedback[], selection: GeoSelection): NormalizedFeedback[] {
  if (selection.serviceCenter) {
    const serviceCenter = selection.serviceCenter;
    return records.filter(
      (record) =>
        record.city === serviceCenter.city &&
        record.serviceCenter === serviceCenter.serviceCenter,
    );
  }

  return records.filter((record) => {
    const regionMatched = selection.regions.length ? record.region !== undefined && selection.regions.includes(record.region) : true;
    const cityMatched = selection.cities.length ? record.city !== undefined && selection.cities.includes(record.city) : true;
    return regionMatched && cityMatched;
  });
}

export function getScenarioMetricDimensions(metrics: MetricSummary, scenario: WorkbenchScenario) {
  const byLabel = new Map(metrics.metricDimensions.map((item) => [item.label, item]));
  const pick = (labels: string[]) =>
    labels.map((label) => byLabel.get(label)).filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (scenario === "服务问题闭环") return pick(["待跟进", "低分反馈", "联系授权率", "需人工复核"]);
  if (scenario === "满意度归因") return pick(["平均服务评分", "净推荐值（NPS）", "推荐者/贬损者", "负向占比"]);
  if (scenario === "区域/城市下钻") return pick(["反馈量", "风险服务中心", "高发环节", "负向占比"]);
  if (scenario === "活动体验复盘") return pick(["活动反馈", "满意率", "负向占比", "可沉淀正向"]);
  return pick(["可沉淀正向", "口碑风险", "联系授权率", "需人工复核"]);
}

export function getScenarioReviewFocus(scenario: WorkbenchScenario): string {
  const focus: Record<WorkbenchScenario, string> = {
    服务问题闭环: "看低分和已授权联系样本，判断哪些服务中心需要回访、督办和下周追踪。",
    满意度归因: "看服务评分、净推荐值和推荐者/贬损者结构，解释分数为什么变化。",
    "区域/城市下钻": "看区域、城市、服务中心之间的差异，找到风险聚集点。",
    活动体验复盘: "只看活动/社群相关反馈，拆解触达、现场执行和权益说明。",
    口碑素材与风险: "同时筛正向素材和负向风险，判断哪些能沉淀，哪些要先处理。",
  };
  return focus[scenario];
}

export function filterRecordsByDate(
  records: NormalizedFeedback[],
  startDate: string,
  endDate: string,
): NormalizedFeedback[] {
  const start = new Date(`${startDate}T00:00:00+08:00`).getTime();
  const end = new Date(`${endDate}T23:59:59+08:00`).getTime();
  return records.filter((record) => {
    const submittedAt = new Date(record.submittedAt).getTime();
    return submittedAt >= start && submittedAt <= end;
  });
}

export function sortRecordsByTime(records: NormalizedFeedback[]): NormalizedFeedback[] {
  return [...records].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

export function getRecordsForServiceCenter(
  records: NormalizedFeedback[],
  city: string,
  serviceCenter: string,
): NormalizedFeedback[] {
  return sortRecordsByTime(
    records.filter((record) => record.city === city && record.serviceCenter === serviceCenter),
  );
}

export function formatDateLabel(value: FeedbackImportRecord["submittedAt"]): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function buildRegionTree(records: NormalizedFeedback[]): RegionTree {
  const regions = new Map<string, NormalizedFeedback[]>();
  for (const record of records) {
    const region = record.region ?? "未标注";
    regions.set(region, [...(regions.get(region) ?? []), record]);
  }

  return Array.from(regions.entries()).map(([region, regionRecords]) => {
    const cities = new Map<string, NormalizedFeedback[]>();
    for (const record of regionRecords) {
      const city = record.city ?? "未标注城市";
      cities.set(city, [...(cities.get(city) ?? []), record]);
    }

    return {
      region: region as RegionTree[number]["region"],
      totalFeedback: regionRecords.length,
      cities: Array.from(cities.entries()).map(([city, cityRecords]) => {
        const serviceCenters = new Map<string, NormalizedFeedback[]>();
        for (const record of cityRecords) {
          const serviceCenter = record.serviceCenter ?? "未标注服务中心";
          serviceCenters.set(serviceCenter, [...(serviceCenters.get(serviceCenter) ?? []), record]);
        }

        return {
          city,
          totalFeedback: cityRecords.length,
          serviceCenters: Array.from(serviceCenters.entries()).map(([serviceCenter, serviceCenterRecords]) => ({
            serviceCenter,
            totalFeedback: serviceCenterRecords.length,
            records: serviceCenterRecords,
          })),
        };
      }),
    };
  });
}

function filterRecordsForScenario(records: NormalizedFeedback[], scenario: WorkbenchScenario): NormalizedFeedback[] {
  if (scenario === "服务问题闭环") {
    return records.filter((record) => detectSentiment(record) === "负向" || record.contact?.consentState === "已授权联系");
  }

  if (scenario === "满意度归因") {
    return records.filter((record) => record.npsScore !== undefined || record.rating !== undefined);
  }

  if (scenario === "活动体验复盘") {
    const activityRecords = records.filter((record) => record.serviceScenario === "活动/社群");
    return activityRecords.length ? activityRecords : records;
  }

  if (scenario === "口碑素材与风险") {
    const opinionRecords = records.filter((record) => detectSentiment(record) !== "中性");
    return opinionRecords.length ? opinionRecords : records;
  }

  return records;
}

function createFinding(
  sequence: number,
  stage: ServiceStage,
  records: NormalizedFeedback[],
  scenario: WorkbenchScenario,
): AnalysisFinding {
  const sentiment = dominantSentiment(records);
  const severity = dominantSeverity(records);
  const evidenceQuotes = records.slice(0, 3).map((record) => createEvidenceQuote(record, stage));
  const issueTags = stageIssueTags[stage];

  return {
    id: `${scenario}-${stage}-${sequence}`,
    title: `${stage} · ${issueTags[0]}`,
    serviceStage: stage,
    sentiment,
    severity,
    issueTags,
    summary: summarizeFinding(stage, sentiment, records),
    evidenceQuotes,
    recommendedAction: recommendAction(stage, sentiment, scenario),
    reviewRequired: records.some((record) => !record.rating && !record.npsScore),
  };
}

function createEvidenceQuote(record: NormalizedFeedback, stage: ServiceStage): EvidenceQuote {
  return {
    feedbackId: record.id,
    quote: record.feedbackText,
    sentiment: detectSentiment(record),
    serviceStage: stage,
    reasonToUse: `${record.displayLocation} 的原话能说明${stage}的具体影响`,
    scoreSource: {
      rating: record.rating,
      npsScore: record.npsScore,
      submittedAt: record.submittedAt,
      sourceLabel: record.sourceLabel,
      location: record.displayLocation,
      serviceScenario: record.serviceScenario,
    },
  };
}

function createEvidenceQuoteWithReason(
  record: NormalizedFeedback,
  stage: ServiceStage,
  reasonToUse: string,
): EvidenceQuote {
  return {
    ...createEvidenceQuote(record, stage),
    reasonToUse,
  };
}

function createFocusInsight(input: {
  title: string;
  tone: "good" | "risk";
  location: string;
  serviceCenter: string;
  records: NormalizedFeedback[];
  representativeRecords: NormalizedFeedback[];
  recommendedAction: string;
}): FocusRegionInsight {
  const stages = countBy(input.representativeRecords.map((record) => detectServiceStage(record.feedbackText))).slice(0, 2);
  const scenarios = countBy(input.representativeRecords.map((record) => record.serviceScenario)).slice(0, 2);
  const evidenceQuotes = rankRepresentativeRecords(input.representativeRecords, input.tone, stages, scenarios)
    .slice(0, 2)
    .map((record) =>
      createEvidenceQuoteWithReason(
        record,
        detectServiceStage(record.feedbackText),
        buildRepresentativeReason(record, input.tone, stages, scenarios),
      ),
    );
  const stageText = stages.map(([stage, count]) => `${stage}${count}条`).join("、") || "暂无明显环节";
  const scenarioText = scenarios.map(([scenario, count]) => `${scenario}${count}条`).join("、") || "暂无明显场景";

  return {
    title: input.title,
    tone: input.tone,
    location: input.location,
    serviceCenter: input.serviceCenter,
    totalFeedback: input.records.length,
    representativeCount: input.representativeRecords.length,
    commonPattern: `${stageText}，主要涉及${scenarioText}。`,
    recommendedAction: input.recommendedAction,
    evidenceQuotes,
  };
}

function rankRepresentativeRecords(
  records: NormalizedFeedback[],
  tone: "good" | "risk",
  stages: Array<[ServiceStage, number]>,
  scenarios: Array<[ServiceScenario, number]>,
): NormalizedFeedback[] {
  const topStages = new Set(stages.map(([stage]) => stage));
  const topScenarios = new Set(scenarios.map(([scenario]) => scenario));

  return [...records].sort((a, b) => {
    const scoreGap = representativeScore(b, tone, topStages, topScenarios) - representativeScore(a, tone, topStages, topScenarios);
    if (scoreGap !== 0) return scoreGap;
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });
}

function representativeScore(
  record: NormalizedFeedback,
  tone: "good" | "risk",
  topStages: Set<ServiceStage>,
  topScenarios: Set<ServiceScenario>,
): number {
  const sentimentMatched = tone === "good" ? detectSentiment(record) === "正向" : detectSentiment(record) === "负向";
  const scoreMatched =
    tone === "good"
      ? (record.rating ?? 0) >= 4 || (record.npsScore ?? 0) >= 9
      : (record.rating ?? 5) <= 2 || (record.npsScore ?? 10) <= 6;

  return [
    sentimentMatched ? 3 : 0,
    topStages.has(detectServiceStage(record.feedbackText)) ? 3 : 0,
    topScenarios.has(record.serviceScenario) ? 2 : 0,
    scoreMatched ? 2 : 0,
    record.feedbackText.length >= 18 ? 1 : 0,
    record.city && record.serviceCenter ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function buildRepresentativeReason(
  record: NormalizedFeedback,
  tone: "good" | "risk",
  stages: Array<[ServiceStage, number]>,
  scenarios: Array<[ServiceScenario, number]>,
): string {
  const stage = detectServiceStage(record.feedbackText);
  const scenario = record.serviceScenario;
  const stageRank = stages.findIndex(([item]) => item === stage) + 1;
  const scenarioRank = scenarios.findIndex(([item]) => item === scenario) + 1;
  const scoreText =
    tone === "good"
      ? `服务评分 ${record.rating ?? "-"} / 推荐意愿评分 ${record.npsScore ?? "-"} 支撑正向判断`
      : `服务评分 ${record.rating ?? "-"} / 推荐意愿评分 ${record.npsScore ?? "-"} 支撑风险判断`;
  const stageText = stageRank ? `命中当前卡片第 ${stageRank} 高频服务环节“${stage}”` : `服务环节为“${stage}”`;
  const scenarioText = scenarioRank ? `第 ${scenarioRank} 高频服务场景“${scenario}”` : `服务场景为“${scenario}”`;
  return `代表性依据：情绪与本卡片一致，${stageText}，${scenarioText}，且${scoreText}。`;
}

function buildMetricDimensions(input: {
  totalFeedback: number;
  ratings: number[];
  negativeCount: number;
  lowScoreCount: number;
  detractorCount: number;
  passiveCount: number;
  promoterCount: number;
  npsRespondentCount: number;
  followUpCount: number;
  authorizedCount: number;
  reviewRequiredCount: number;
  regionCount: number;
  cityCount: number;
  serviceCenterCount: number;
}) {
  const {
    totalFeedback,
    ratings,
    negativeCount,
    lowScoreCount,
    detractorCount,
    passiveCount,
    promoterCount,
    npsRespondentCount,
    followUpCount,
    authorizedCount,
    reviewRequiredCount,
    regionCount,
    cityCount,
    serviceCenterCount,
  } = input;
  const satisfiedCount = ratings.filter((value) => value >= 4).length;

  return [
    createMetric("反馈量", `${totalFeedback}`, "条", "样本数", "当前项目、时间和地区范围内的有效反馈记录数。"),
    createMetric("平均服务评分", `${average(ratings)}`, "分", "均值", "体验评分字段的平均值，用于判断整体满意度趋势。"),
    createMetric(
      "净推荐值（NPS）",
      `${calculateNetPromoterScore(promoterCount, detractorCount, npsRespondentCount)}`,
      "",
      "指数",
      "NPS = 推荐者占比 - 贬损者占比，只用回答推荐意愿 0-10 分的样本计算，范围为 -100 到 100。负数表示贬损者占比高于推荐者占比。",
    ),
    createMetric("推荐者/贬损者", `${promoterCount}/${detractorCount}`, "条", "结构", "前一个数字是推荐者样本数，后一个数字是贬损者样本数。9-10 分为推荐者，0-6 分为贬损者。"),
    createMetric("被动者", `${passiveCount}`, "条", "样本数", "推荐意愿 7-8 分用户数量，通常说明体验可以但不够稳定。"),
    createMetric("低分反馈", `${lowScoreCount}`, "条", "样本数", "评分 1-2 或推荐意愿 0-6 分的优先处理样本数。"),
    createMetric("负向占比", `${totalFeedback ? Math.round((negativeCount / totalFeedback) * 100) : 0}`, "%", "比例", "负向反馈数占当前反馈量的比例，根据分数和文本情绪共同判断。"),
    createMetric("满意率", `${totalFeedback ? Math.round((satisfiedCount / totalFeedback) * 100) : 0}`, "%", "比例", "评分 4-5 的反馈占当前反馈量的比例。"),
    createMetric("待跟进", `${followUpCount}`, "条", "样本数", "已授权联系或严重度高、需要运营继续处理的样本数。"),
    createMetric("联系授权率", `${totalFeedback ? Math.round((authorizedCount / totalFeedback) * 100) : 0}`, "%", "比例", "已授权联系样本占当前反馈量的比例。"),
    createMetric("需人工复核", `${reviewRequiredCount}`, "条", "质检", "缺少评分、推荐意愿评分或关键字段，需要人工确认的记录数。"),
    createMetric("风险服务中心", "见反馈池", "", "定位", "按负向反馈数和样本量排序，用于定位风险网点。"),
    createMetric("高发环节", "见归因卡片", "", "定位", "按服务环节聚类后的高频问题，用于定位流程断点。"),
    createMetric("活动反馈", `${totalFeedback}`, "条", "样本数", "活动/社群专项下的反馈样本量。"),
    createMetric("可沉淀正向", `${promoterCount}`, "条", "样本数", "高分且文本正向的候选素材数量。"),
    createMetric("口碑风险", `${negativeCount}`, "条", "样本数", "需要先处理再外部回应的负向样本数量。"),
    createMetric("覆盖区域", `${regionCount}`, "个", "覆盖", "当前筛选范围内覆盖的大区数量。"),
    createMetric("覆盖城市", `${cityCount}`, "个", "覆盖", "当前筛选范围内覆盖的城市数量。"),
    createMetric("覆盖服务中心", `${serviceCenterCount}`, "个", "覆盖", "当前筛选范围内覆盖的服务中心数量。"),
  ];
}

function createMetric(label: string, value: string, unitLabel: string, typeLabel: string, helper: string) {
  return { label, value, unitLabel, typeLabel, helper };
}

function buildMetricGroups(metricDimensions: ReturnType<typeof buildMetricDimensions>) {
  const byLabel = new Map(metricDimensions.map((metric) => [metric.label, metric]));
  const pick = (labels: string[]) =>
    labels.map((label) => byLabel.get(label)).filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));

  return [
    {
      title: "体验结果指标",
      description: "回答本期服务体验整体表现如何。",
      metrics: pick(["平均服务评分", "净推荐值（NPS）", "满意率", "推荐者/贬损者", "被动者"]),
    },
    {
      title: "问题风险指标",
      description: "回答哪些反馈说明体验风险正在聚集。",
      metrics: pick(["低分反馈", "负向占比", "口碑风险", "风险服务中心", "高发环节"]),
    },
    {
      title: "闭环处理指标",
      description: "回答哪些样本需要运营继续处理。",
      metrics: pick(["待跟进", "联系授权率"]),
    },
    {
      title: "范围覆盖指标",
      description: "回答当前报告覆盖哪些地区和网点。",
      metrics: pick(["反馈量", "覆盖区域", "覆盖城市", "覆盖服务中心"]),
    },
    {
      title: "数据质量指标",
      description: "回答当前数据是否足够支撑报告结论。",
      metrics: pick(["需人工复核"]),
    },
  ];
}

function calculateNetPromoterScore(promoterCount: number, detractorCount: number, npsRespondentCount: number): number {
  if (!npsRespondentCount) return 0;
  return Math.round(((promoterCount / npsRespondentCount) * 100 - (detractorCount / npsRespondentCount) * 100) * 10) / 10;
}

function detectServiceStage(text: string): ServiceStage {
  const hitCounts = Object.entries(stageKeywords).map(([stage, keywords]) => ({
    stage: stage as ServiceStage,
    count: keywords.filter((keyword) => text.includes(keyword)).length,
  }));

  return hitCounts.sort((a, b) => b.count - a.count)[0]?.count
    ? hitCounts.sort((a, b) => b.count - a.count)[0].stage
    : "服务接待";
}

function detectSentiment(record: NormalizedFeedback): Sentiment {
  const text = record.feedbackText;
  if (record.rating !== undefined && record.rating <= 2) return "负向";
  if (record.npsScore !== undefined && record.npsScore <= 6) return "负向";
  if (["等了", "慢", "不清楚", "没修好", "排队", "不满", "投诉"].some((word) => text.includes(word))) return "负向";
  if (record.rating !== undefined && record.rating >= 4 && (record.npsScore ?? 10) >= 8) return "正向";
  if (["清楚", "主动", "方便", "满意", "不错", "专业"].some((word) => text.includes(word))) return "正向";
  return "中性";
}

function detectSeverity(record: NormalizedFeedback): Severity {
  if (record.rating !== undefined && record.rating <= 2) return "高";
  if (record.npsScore !== undefined && record.npsScore <= 6) return "高";
  if (["投诉", "没修好", "复发", "等了两天", "失望"].some((word) => record.feedbackText.includes(word))) return "高";
  if (detectSentiment(record) === "负向") return "中";
  return "低";
}

function dominantSentiment(records: NormalizedFeedback[]): Sentiment {
  return mostCommon(records.map(detectSentiment));
}

function dominantSeverity(records: NormalizedFeedback[]): Severity {
  const severities = records.map(detectSeverity);
  if (severities.includes("高")) return "高";
  if (severities.includes("中")) return "中";
  return "低";
}

function summarizeFinding(stage: ServiceStage, sentiment: Sentiment, records: NormalizedFeedback[]): string {
  const locations = topLocations(records);
  const serviceScenarios = topScenarios(records);
  if (sentiment === "负向") {
    return `${stage}出现集中负反馈，主要来自${locations}，涉及${serviceScenarios}。需要先核实低分样本，再把责任人、处理时限和回访口径落到服务中心。`;
  }
  if (sentiment === "正向") {
    return `${stage}有可复用的正向样本，主要来自${locations}，适合沉淀为服务话术、门店案例或车主故事素材。`;
  }
  return `${stage}反馈方向尚不单一，主要来自${locations}，建议结合评分、城市和服务中心继续复核。`;
}

function recommendAction(stage: ServiceStage, sentiment: Sentiment, scenario: WorkbenchScenario): string {
  if (scenario === "服务问题闭环") return `建立${stage}问题闭环清单：标记责任服务中心、48 小时内完成首次回访，并在下周复盘处理结果。`;
  if (scenario === "满意度归因") return `把${stage}作为分数波动解释项，拆出低分原因、影响城市和可立即修正的服务动作。`;
  if (scenario === "区域/城市下钻") return `按区域、城市、服务中心逐级下钻${stage}问题，先处理负向反馈集中且样本量较高的网点。`;
  if (scenario === "活动体验复盘") return `复盘活动触达、现场执行和权益说明，保留有效做法，调整造成低分的提醒或交付环节。`;
  if (scenario === "口碑素材与风险" && sentiment === "正向") return `整理为可发布素材候选，发布前确认授权、去除个人信息，并保留原话证据。`;
  if (scenario === "口碑素材与风险") return `列入口碑风险摘要，先判断是否需要客服介入，再给品牌/内容团队提供不扩散的回应口径。`;
  if (sentiment === "负向") return `围绕${stage}建立跟进清单，优先核实高严重度反馈并同步相关服务中心。`;
  return `将${stage}中的正向做法沉淀为服务话术或案例，供区域团队复用。`;
}

function findRiskiestServiceCenter(records: NormalizedFeedback[]): MetricSummary["riskiestServiceCenter"] {
  const centerMap = groupByCenter(records);

  const ranked = Array.from(centerMap.entries())
    .map(([key, centerRecords]) => {
      const [city, serviceCenter] = key.split("|") as [string, string];
      return {
        city,
        serviceCenter,
        totalFeedback: centerRecords.length,
        negativeCount: centerRecords.filter((record) => detectSentiment(record) === "负向").length,
      };
    })
    .filter((item) => item.negativeCount > 0)
    .sort((a, b) => b.negativeCount - a.negativeCount || b.totalFeedback - a.totalFeedback);

  return ranked[0];
}

function groupByCenter(records: NormalizedFeedback[]): Map<string, NormalizedFeedback[]> {
  const centerMap = new Map<string, NormalizedFeedback[]>();
  for (const record of records) {
    const key = `${record.city ?? "未标注城市"}|${record.serviceCenter ?? "未标注服务中心"}`;
    centerMap.set(key, [...(centerMap.get(key) ?? []), record]);
  }
  return centerMap;
}

function topLocations(records: NormalizedFeedback[]): string {
  return countBy(records.map((record) => record.city ?? record.region ?? "未标注地区"))
    .slice(0, 2)
    .map(([location, count]) => `${location}${count}条`)
    .join("、") || "未标注地区";
}

function topScenarios(records: NormalizedFeedback[]): string {
  return countBy(records.map((record) => record.serviceScenario as ServiceScenario))
    .slice(0, 2)
    .map(([scenario, count]) => `${scenario}${count}条`)
    .join("、") || "未标注场景";
}

function severityScore(severity: Severity): number {
  return severity === "高" ? 3 : severity === "中" ? 2 : 1;
}

function mostCommon<T extends string>(items: T[]): T {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function countBy<T extends string>(items: T[]): Array<[T, number]> {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}
