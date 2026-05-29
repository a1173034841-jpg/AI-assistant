export type SurveyPlatform =
  | "问卷星"
  | "腾讯问卷"
  | "金数据"
  | "App内问卷"
  | "短信链接"
  | "企微链接";

export type Region = "华南" | "华东" | "华北" | "西南";

export type ServiceScenario =
  | "到店服务"
  | "移动服务"
  | "补能体验"
  | "App/OTA"
  | "活动/社群"
  | "其他";

export type ServiceStage =
  | "服务发起"
  | "服务接待"
  | "服务质量"
  | "补能体验"
  | "软件与智能化"
  | "用户运营";

export type Sentiment = "正向" | "中性" | "负向";
export type Severity = "低" | "中" | "高";
export type ConsentState = "未询问" | "已授权联系" | "拒绝联系";

export type SurveyTemplateField = {
  id: string;
  label: string;
  type: "rating" | "nps" | "singleSelect" | "text" | "contact" | "consent";
  required: boolean;
  helperText?: string;
};

export type OptionalContactInfo = {
  name?: string;
  phoneMasked?: string;
  consentState: ConsentState;
};

export type FeedbackImportRecord = {
  id: string;
  submittedAt: string;
  platform: SurveyPlatform;
  region?: Region;
  city?: string;
  serviceCenter?: string;
  serviceScenario: ServiceScenario;
  rating?: number;
  npsScore?: number;
  feedbackText: string;
  contact?: OptionalContactInfo;
};

export type ThirdPartySurveyExport = {
  exportId: string;
  platform: SurveyPlatform;
  exportedAt: string;
  sourceName: string;
  projectName: string;
  periodStart: string;
  periodEnd: string;
  records: FeedbackImportRecord[];
};

export type NormalizedFeedback = FeedbackImportRecord & {
  sourceLabel: string;
  displayLocation: string;
};

export type WorkbenchScenario =
  | "服务问题闭环"
  | "满意度归因"
  | "区域/城市下钻"
  | "活动体验复盘"
  | "口碑素材与风险";

export type EvidenceQuote = {
  feedbackId: string;
  quote: string;
  sentiment: Sentiment;
  serviceStage: ServiceStage;
  reasonToUse: string;
  scoreSource: {
    rating?: number;
    npsScore?: number;
    submittedAt: string;
    sourceLabel: string;
    location: string;
    serviceScenario: ServiceScenario;
  };
};

export type MetricDimension = {
  label: string;
  value: string;
  unitLabel: string;
  typeLabel: string;
  helper: string;
};

export type MetricGroup = {
  title: string;
  description: string;
  metrics: MetricDimension[];
};

export type FocusRegionInsight = {
  title: string;
  tone: "good" | "risk";
  location: string;
  serviceCenter: string;
  totalFeedback: number;
  representativeCount: number;
  commonPattern: string;
  recommendedAction: string;
  evidenceQuotes: EvidenceQuote[];
};

export type AnalysisFinding = {
  id: string;
  title: string;
  serviceStage: ServiceStage;
  sentiment: Sentiment;
  severity: Severity;
  issueTags: string[];
  summary: string;
  evidenceQuotes: EvidenceQuote[];
  recommendedAction: string;
  reviewRequired: boolean;
};

export type ScenarioOutput = {
  scenario: WorkbenchScenario;
  title: string;
  executiveSummary: string;
  outputKind?: "report" | "closure-list";
  sections: Array<{
    heading: string;
    content: string;
    meta?: string;
    actionLabel?: string;
    evidenceQuoteIds: string[];
    evidenceQuotes: EvidenceQuote[];
  }>;
  copyableText: string;
};

export type MetricSummary = {
  totalFeedback: number;
  averageRating: number;
  averageNps: number;
  netPromoterScore: number;
  npsRespondentCount: number;
  negativeRate: number;
  satisfactionRate: number;
  contactAuthorizationRate: number;
  lowScoreCount: number;
  detractorCount: number;
  promoterCount: number;
  passiveCount: number;
  followUpCount: number;
  reviewRequiredCount: number;
  metricDimensions: MetricDimension[];
  metricGroups: MetricGroup[];
  topStage?: ServiceStage;
  topNegativeStage?: ServiceStage;
  riskiestServiceCenter?: {
    serviceCenter: string;
    city: string;
    negativeCount: number;
    totalFeedback: number;
  };
  stageBreakdown: Array<{ stage: ServiceStage; count: number }>;
  scenarioBreakdown: Array<{ scenario: ServiceScenario; count: number }>;
};

export type RegionTree = Array<{
  region: Region | "未标注";
  totalFeedback: number;
  cities: Array<{
    city: string;
    totalFeedback: number;
    serviceCenters: Array<{
      serviceCenter: string;
      totalFeedback: number;
      records: NormalizedFeedback[];
    }>;
  }>;
}>;
