import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  Filter,
  FolderOpen,
  LockKeyhole,
  Mail,
  MessageSquareText,
  MoveRight,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Send,
  Settings,
  Star,
  Trash2,
  UploadCloud,
  UserCircle,
} from "lucide-react";
import { getAppViewMode } from "./viewMode";
import {
  buildAutoConversationTitle,
  removeQaConversationRecord,
  type AgentRunStage,
} from "../domain/agentConversation";
import { buildFindingsForScenario, buildMetricSummary } from "../domain/analysisRules";
import { answerWorkbenchQuestion, buildSuggestedAgentQuestions } from "../domain/agentRules";
import { createDeepSeekAgentPort } from "../domain/deepseekAgentPort";
import { createSupabaseAgentRetrievalPort } from "../domain/supabaseAgentRetrievalPort";
import { createWorkOrderDraftFromInsight, createWorkOrderEmailDraft, type WorkOrderDraft } from "../domain/workOrder";
import type { EvidenceQuote as DomainEvidenceQuote, FocusRegionInsight, NormalizedFeedback, Region, ServiceScenario, SurveyPlatform } from "../domain/types";
import { PortfolioDeck } from "../portfolio/PortfolioDeck";
import "../styles/app.css";

const appAgentRetrievalPort = createSupabaseAgentRetrievalPort(import.meta.env);
const appAgentPort = createDeepSeekAgentPort(import.meta.env, appAgentRetrievalPort);

type ScreenId = "home" | "import" | "projects" | "drilldown" | "report" | "query" | "profile";
type PrimaryNavId = "new-project" | "projects" | "dashboard" | "query" | "profile";
type StatusTone = "pass" | "warning" | "risk" | "neutral";
type QaScopeMode = "free" | "filtered";
type NavIcon = "plus" | "folder" | "chart" | "message" | "settings";
type EvidencePageSize = 10 | 20 | 50 | 100;

type Evidence = {
  quote: string;
  rating: string;
  nps: string;
  submittedAt: string;
  source: string;
  location: string;
  scenario: string;
  reason: string;
  tone: StatusTone;
};

type RawFeedbackRecord = Evidence & {
  feedbackId: string;
  projectName: string;
  recordNumber: number;
};

type ImportedProject = {
  id: string;
  name: string;
  type: string;
  dateRange: string;
  count: string;
};

type DrilldownFilter = {
  timeRange: string;
  timePeriod: string;
  customTimeRange: string;
  customStartDate: string;
  customEndDate: string;
  selectedProjectIds: string[];
  selectedRegions: string[];
  selectedCities: string[];
  selectedCenters: string[];
  selectedTopics: string[];
};

type ScreenMeta = {
  id: ScreenId;
  title: string;
  summary: string;
};

type SecondaryNavItem = {
  id: string;
  title: string;
  summary: string;
  screen: ScreenId;
};

type QaThread = {
  id: string;
  title: string;
  meta: string;
  turns?: QaMessage[];
  evidenceQuotes?: DomainEvidenceQuote[];
  scopeSnapshot?: QaScopeSnapshot;
  reasoningContent?: string;
};

type QaMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type QaScopeSnapshot = {
  mode: QaScopeMode;
  filter: DrilldownFilter;
  contextProjectId: string | null;
  label: string;
};

type PrimaryNavItem = {
  id: PrimaryNavId;
  title: string;
  summary: string;
  icon: NavIcon;
  defaultSecondaryId: string;
  items: SecondaryNavItem[];
};

const screenMeta: Record<ScreenId, ScreenMeta> = {
  home: {
    id: "home",
    title: "工作台首页",
    summary: "最近项目、待处理导入、近期报告和可继续问答",
  },
  import: {
    id: "import",
    title: "新建项目",
    summary: "上传反馈表、确认字段映射与数据质量",
  },
  projects: {
    id: "projects",
    title: "查看项目",
    summary: "查看过往所有项目、导入批次和最近报告",
  },
  drilldown: {
    id: "drilldown",
    title: "报告仪表盘",
    summary: "按业务维度查看指标、范围、风险对象和证据",
  },
  report: {
    id: "report",
    title: "报告仪表盘",
    summary: "先看总报告，再进入专项和反馈原文",
  },
  query: {
    id: "query",
    title: "AI 问答",
    summary: "新建问答、查看记录，并围绕当前数据继续提问",
  },
  profile: {
    id: "profile",
    title: "个人中心",
    summary: "个人设置、账号状态、隐私和数据权限",
  },
};

const primaryNavItems: PrimaryNavItem[] = [
  {
    id: "new-project",
    title: "新建项目",
    summary: "导入反馈数据并生成初始复盘",
    icon: "plus",
    defaultSecondaryId: "new-upload",
    items: [
      { id: "new-upload", title: "上传反馈数据", summary: "Excel / CSV 导入入口", screen: "import" },
      { id: "new-mapping", title: "字段映射", summary: "确认时间、项目、评分、原话字段", screen: "import" },
      { id: "new-validation", title: "导入校验", summary: "检查缺失、重复、隐私字段", screen: "import" },
      { id: "new-report", title: "生成初始复盘", summary: "校验通过后生成默认报告", screen: "import" },
      { id: "new-history", title: "导入历史", summary: "最近文件和处理状态", screen: "import" },
    ],
  },
  {
    id: "projects",
    title: "查看项目",
    summary: "查看过往项目和导入批次",
    icon: "folder",
    defaultSecondaryId: "projects-all",
    items: [
      { id: "projects-all", title: "全部项目", summary: "所有已导入项目", screen: "projects" },
      { id: "projects-recent", title: "最近项目", summary: "最近 30 天项目", screen: "projects" },
      { id: "projects-detail", title: "项目详情", summary: "项目范围、样本和报告状态", screen: "projects" },
      { id: "projects-batches", title: "导入批次", summary: "文件批次和导入记录", screen: "projects" },
      { id: "projects-archive", title: "归档项目", summary: "已完成或归档项目", screen: "projects" },
    ],
  },
  {
    id: "dashboard",
    title: "报告仪表盘",
    summary: "业务维度、报告和证据",
    icon: "chart",
    defaultSecondaryId: "dashboard-overview",
    items: [
      { id: "dashboard-overview", title: "总览", summary: "当前范围和核心指标", screen: "drilldown" },
      { id: "dashboard-scope", title: "筛选范围", summary: "时间、项目、区域一次筛选", screen: "drilldown" },
      { id: "dashboard-topic", title: "问题主题", summary: "等待、解释、同步、交付", screen: "drilldown" },
      { id: "dashboard-report", title: "报告输出", summary: "总复盘和专项输出", screen: "report" },
    ],
  },
  {
    id: "query",
    title: "AI 问答",
    summary: "新建问答和对话历史",
    icon: "message",
    defaultSecondaryId: "qa-new",
    items: [
      { id: "qa-new", title: "新建问答", summary: "默认进入新的提问", screen: "query" },
      { id: "qa-history", title: "问答记录", summary: "历史会话和收藏状态", screen: "query" },
    ],
  },
  {
    id: "profile",
    title: "个人中心",
    summary: "账号、隐私、数据和导出",
    icon: "settings",
    defaultSecondaryId: "profile-settings",
    items: [
      { id: "profile-settings", title: "个人设置", summary: "角色和偏好", screen: "profile" },
      { id: "profile-account", title: "账号状态", summary: "权限与审批状态", screen: "profile" },
      { id: "profile-privacy", title: "隐私设置", summary: "脱敏和数据边界", screen: "profile" },
      { id: "profile-data", title: "数据权限", summary: "区域级和项目级权限", screen: "profile" },
    ],
  },
];

const evidencePageSizeOptions: EvidencePageSize[] = [10, 20, 50, 100];

const evidenceQuotes: Evidence[] = [
  {
    quote: "预约后到店还是等了一个多小时，接待解释不清楚，只说系统里排队。",
    rating: "2/5",
    nps: "3/10",
    submittedAt: "2026-05-18 14:22",
    source: "问卷星",
    location: "杭州 / 西溪服务中心",
    scenario: "到店服务",
    reason: "低分样本，直接支撑等待时间和接待解释风险",
    tone: "risk",
  },
  {
    quote: "移动服务师傅提前联系，现场处理很快，还把后续保养注意事项讲清楚了。",
    rating: "5/5",
    nps: "10/10",
    submittedAt: "2026-05-21 09:48",
    source: "App 内问卷",
    location: "广州 / 天河服务中心",
    scenario: "移动服务",
    reason: "正向样本，可作为移动服务标准动作素材",
    tone: "pass",
  },
  {
    quote: "App 预约页面显示已确认，但门店说没有同步，最后人工帮忙重新排。",
    rating: "3/5",
    nps: "5/10",
    submittedAt: "2026-05-27 16:10",
    source: "企微链接",
    location: "成都 / 高新服务中心",
    scenario: "App/OTA",
    reason: "跨系统同步问题，适合进入需人工复核清单",
    tone: "warning",
  },
  {
    quote: "等候区已经坐满了，没人主动告知还要等多久，问了两次才说前面还有三台车。",
    rating: "2/5",
    nps: "2/10",
    submittedAt: "2026-05-18 15:06",
    source: "问卷星",
    location: "杭州 / 西溪服务中心",
    scenario: "到店服务",
    reason: "同一服务中心的等待告知问题，可与低分样本形成问题簇",
    tone: "risk",
  },
  {
    quote: "交车时功能变化讲得比较快，回家后才发现有些设置和之前说的不一样。",
    rating: "3/5",
    nps: "5/10",
    submittedAt: "2026-05-20 18:31",
    source: "App 内问卷",
    location: "北京 / 望京服务中心",
    scenario: "交付说明",
    reason: "交付解释波动样本，适合进入区域督查证据包",
    tone: "warning",
  },
  {
    quote: "维修进度中途没有更新，我只能自己打电话问，最后才知道配件还没到。",
    rating: "2/5",
    nps: "4/10",
    submittedAt: "2026-05-24 11:15",
    source: "企微链接",
    location: "成都 / 高新服务中心",
    scenario: "维修跟进",
    reason: "过程同步不足样本，可支撑服务问题闭环和回访动作",
    tone: "risk",
  },
];

const validationRows = [
  ["项目名称", "已识别", "2026 五一售后服务专项", "来自文件名和项目字段"],
  ["提交时间", "已通过", "1,240 / 1,240", "全部可解析为标准日期"],
  ["服务评分", "已通过", "1,218 / 1,240", "22 条缺失，已进入无评分样本"],
  ["推荐意愿", "需确认", "1,176 / 1,240", "64 条为空，不参与 NPS 计算"],
  ["联系方式", "已脱敏", "138****2187", "手机号、姓名仅显示脱敏结果"],
];

const drilldownRows = [
  ["华东", "杭州", "西溪服务中心", "186", "4.02", "高", "等待时间、解释不清"],
  ["华南", "广州", "天河服务中心", "142", "4.76", "低", "移动服务响应快"],
  ["西南", "成都", "高新服务中心", "128", "4.21", "中", "App 同步需复核"],
  ["华北", "北京", "望京服务中心", "119", "4.35", "中", "交付解释波动"],
];

const topicOptions = [
  { id: "等待时间", title: "等待时间", meta: "预约后到店仍长时间等待", tone: "risk" as const },
  { id: "解释不清", title: "解释不清", meta: "接待说明、权益说明或异常说明不足", tone: "warning" as const },
  { id: "App 同步", title: "App 同步", meta: "预约确认后门店信息未同步", tone: "warning" as const },
  { id: "交付解释", title: "交付解释", meta: "交付后注意事项和后续动作不清晰", tone: "warning" as const },
  { id: "移动服务", title: "移动服务", meta: "上门服务、提前联系和现场处理", tone: "pass" as const },
];

const timeTrendRows = [
  ["2026-05-01", "286", "4.42", "31", "活动首日咨询集中"],
  ["2026-05-08", "224", "4.27", "38", "节后到店等待上升"],
  ["2026-05-18", "196", "4.02", "52", "等待和解释问题集中"],
  ["2026-05-31", "184", "4.36", "24", "月末回访收口"],
];

const importedProjects: ImportedProject[] = [
  { id: "may-service", name: "五一售后服务专项", type: "售后服务", dateRange: "2026-05-01 至 2026-05-31", count: "1,240" },
  { id: "april-monthly", name: "四月售后月报", type: "月度复盘", dateRange: "2026-04-01 至 2026-04-30", count: "1,086" },
  { id: "energy-event", name: "补能体验活动反馈", type: "活动体验", dateRange: "2026-05-20 至 2026-05-28", count: "328" },
];

const projectComparisonRows = importedProjects.map((project, index) => [
  project.name,
  project.type,
  project.dateRange,
  `${project.count} 条`,
  index === 0 ? "服务体验稳定，等待解释需闭环" : index === 1 ? "月报已归档，可继续追问" : "字段待确认，需完成映射",
]);

const scenarioOutputs = ["服务问题闭环", "满意度归因", "区域城市督查端", "活动体验复盘", "口碑投诉与风险"];

const scenarioReports: Record<
  string,
  {
    headline: string;
    summary: string;
    bullets: string[];
    modules: Array<{ title: string; text: string }>;
    action: string;
  }
> = {
  服务问题闭环: {
    headline: "等待时间和接待解释是本期低分闭环的优先对象",
    summary:
      "低分样本主要集中在到店等待、接待解释不清和异常排队三个环节。建议先锁定杭州西溪服务中心，形成预约确认、到店排队、异常解释、回访确认四步闭环。",
    bullets: ["杭州西溪服务中心 186 条反馈中，等待与解释问题占比最高。", "低分反馈需要按是否可回访、是否需补偿、是否需流程整改拆分。", "闭环动作应沉淀为服务中心日清单，而不是只写进月报。"],
    modules: [
      { title: "低分样本分组", text: "按等待、解释、交付复发、系统同步拆分责任对象。" },
      { title: "回访优先级", text: "优先处理评分 2 分以下、NPS 3 分以下且留资样本。" },
      { title: "责任动作", text: "明确预约确认、排队提示、异常解释和回访完成标准。" },
      { title: "闭环检查", text: "输出服务中心可执行的日清单和复盘口径。" },
    ],
    action: "生成闭环清单",
  },
  满意度归因: {
    headline: "评分下滑不是单一服务问题，而是等待体验放大了解释压力",
    summary:
      "本期平均服务评分 4.31，较上期下降 0.18。满意度波动主要由等待时间、解释不清和 App 预约同步共同造成，正向样本集中在移动服务响应快和现场解释清楚。",
    bullets: ["评分下降样本集中在华东和西南两个区域。", "NPS 贬损者多提到等待和系统排队，推荐者多提到主动联系。", "满意度归因需要同时看评分、NPS、原话主因和服务中心分布。"],
    modules: [
      { title: "评分归因", text: "拆分服务评分、NPS、低分反馈和主因文本。" },
      { title: "推荐者画像", text: "提炼移动服务正向动作，作为区域复制样本。" },
      { title: "贬损者画像", text: "定位等待、解释和同步异常对体验的影响。" },
      { title: "波动解释", text: "形成可进入经营会的本期变化说明。" },
    ],
    action: "生成归因说明",
  },
  区域城市督查端: {
    headline: "督查重点应落在服务中心，而不是只停留在区域均值",
    summary:
      "区域均值会掩盖服务中心差异。当前建议将杭州西溪、成都高新、北京望京列为督查对象，分别看等待解释、App 同步和交付解释波动。",
    bullets: ["华东低分集中在杭州西溪服务中心，主因是等待和解释不清。", "西南需关注成都高新服务中心的 App 预约同步异常。", "华北北京望京服务中心存在交付解释波动，需要抽样复核。"],
    modules: [
      { title: "区域排序", text: "按评分、反馈量、风险等级筛出异常区域。" },
      { title: "城市定位", text: "比较城市内不同服务中心的表现差异。" },
      { title: "服务中心督查", text: "把问题落到具体门店、具体环节和复核动作。" },
      { title: "整改追踪", text: "保留本期范围，供后续周报继续追踪。" },
    ],
    action: "生成督查清单",
  },
  活动体验复盘: {
    headline: "活动体验复盘应拆成触达、到店、解释和交付四段",
    summary:
      "本期活动反馈总体稳定，但到店排队和权益解释仍会拉低体验。活动复盘需要同时关注触达是否清晰、现场是否承接、权益是否解释到位、交付是否留下后续动作。",
    bullets: ["活动触达样本未出现大面积误解，但现场承接存在波动。", "等待过长会削弱活动权益本身的正向感受。", "建议活动结束后按城市输出复盘表，而不是只看整体满意度。"],
    modules: [
      { title: "触达清晰度", text: "复核短信、App、企微入口的权益说明。" },
      { title: "现场承接", text: "检查到店排队、接待解释和活动签到体验。" },
      { title: "权益解释", text: "提炼用户最常问的权益疑问和标准答复。" },
      { title: "活动改进", text: "输出下次活动前必须检查的服务动作。" },
    ],
    action: "生成活动复盘",
  },
  口碑投诉与风险: {
    headline: "口碑风险集中在可传播的负向体验，需要先处理再复用正向素材",
    summary:
      "负向口碑主要来自等待、解释不清和预约同步异常；正向素材主要来自移动服务及时、师傅主动联系和注意事项讲解。内容复用前要先剔除未闭环风险样本。",
    bullets: ["高风险原话不应直接进入对外素材池，需要先进入处理清单。", "正向原话适合沉淀为移动服务标准动作和用户故事。", "投诉风险要按是否可联系、是否已处理、是否复发分别标记。"],
    modules: [
      { title: "负向风险池", text: "收集等待、解释、同步异常相关的可传播风险。" },
      { title: "投诉预警", text: "标记高情绪、高传播可能和需人工回访样本。" },
      { title: "正向素材", text: "筛出可复用的移动服务和解释清楚样本。" },
      { title: "发布前检查", text: "确认风险已闭环后再进入口碑素材使用。" },
    ],
    action: "生成风险清单",
  },
};

const queryThreads: QaThread[] = [
  { id: "hangzhou-risk", title: "杭州西溪服务中心低分原因", meta: "12 条证据 / 3 轮查询" },
  { id: "field-service-good", title: "移动服务正向案例提炼", meta: "8 条证据 / 2 轮查询" },
  { id: "app-sync", title: "App 预约同步异常", meta: "5 条证据 / 1 轮查询" },
];

const qaProjects = importedProjects;

const importHistory = [
  ["五一售后服务专项_2026-05.csv", "2026-06-01 09:32", "已导入", "1,240"],
  ["四月售后月报_2026-04.csv", "2026-05-02 10:18", "已导入", "1,086"],
  ["补能体验活动反馈.csv", "2026-05-28 17:45", "需配置", "328"],
];

const defaultTimePeriodValues: Record<string, string> = {
  全部时间: "",
  日: "2026-05-18",
  周: "2026-W20",
  月: "2026-05",
  季度: "2026-Q2",
  年: "2026",
  自定义: "",
};

const defaultDrilldownFilter: DrilldownFilter = {
  timeRange: "全部时间",
  timePeriod: defaultTimePeriodValues.全部时间,
  customTimeRange: "2026-05-01 至 2026-05-31",
  customStartDate: "2026-05-01",
  customEndDate: "2026-05-31",
  selectedProjectIds: [],
  selectedRegions: [],
  selectedCities: [],
  selectedCenters: [],
  selectedTopics: [],
};

const secondaryPanelCopy: Record<string, { title: string; text: string; metrics: string[] }> = {
  "new-upload": {
    title: "上传反馈数据",
    text: "把问卷星、腾讯问卷、App 问卷或短信链接导出的 Excel / CSV 放入当前批次，系统会先识别项目、时间和样本量。",
    metrics: ["支持 Excel / CSV", "最近文件 3 个", "本批 1,240 行"],
  },
  "new-mapping": {
    title: "字段映射",
    text: "确认提交时间、项目名称、区域、城市、服务中心、服务评分、推荐意愿和车主原话字段，避免后续报告口径跑偏。",
    metrics: ["必填字段 8 个", "自动匹配 94.8%", "待确认 2 项"],
  },
  "new-validation": {
    title: "导入校验",
    text: "检查缺失、重复、隐私字段和指标覆盖率。推荐意愿缺失样本不会进入 NPS 计算，但保留在原文池中。",
    metrics: ["缺失样本 64 条", "隐私字段已脱敏", "可进入复盘"],
  },
  "new-report": {
    title: "生成初始复盘",
    text: "校验通过后生成默认总复盘，先给运营一个可复制的整体判断，再进入报告仪表盘细分维度。",
    metrics: ["8 个默认模块", "42 个服务中心", "7 个区域"],
  },
  "new-history": {
    title: "导入历史",
    text: "查看最近导入文件、处理结果和需要继续配置的批次，方便追踪同一项目的多次补充导入。",
    metrics: ["已导入 2 批", "需配置 1 批", "累计 2,654 条"],
  },
  "projects-all": {
    title: "全部项目",
    text: "展示所有已经导入的业务项目，包含项目类型、时间范围、反馈量、报告状态和最近处理结果。",
    metrics: ["项目 3 个", "累计反馈 2,654 条", "报告 2 份"],
  },
  "projects-recent": {
    title: "最近项目",
    text: "聚合最近 30 天打开或导入的项目，适合快速回到正在复盘的售后专项、月报或活动反馈。",
    metrics: ["最近打开 3 个", "待配置 1 个", "可继续复盘"],
  },
  "projects-detail": {
    title: "项目详情",
    text: "查看单个项目的时间范围、来源渠道、服务中心覆盖、报告状态和下一步可进入的分析入口。",
    metrics: ["来源 3 类", "样本 1,240 条", "状态已生成"],
  },
  "projects-batches": {
    title: "导入批次",
    text: "按文件批次核对导入时间、处理状态和样本量，帮助运营判断同一项目是否存在补充数据。",
    metrics: ["批次 3 个", "异常 0 个", "需配置 1 个"],
  },
  "projects-archive": {
    title: "归档项目",
    text: "查看已完成或暂不继续分析的项目，保留报告和问答记录，但不参与默认当前范围。",
    metrics: ["归档 1 个", "可恢复", "记录保留"],
  },
  "dashboard-overview": {
    title: "总览",
    text: "默认展示当前项目、时间、区域和服务中心范围，以及核心指标、风险对象和下一步动作。",
    metrics: ["全部项目", "当前范围联动", "风险对象同步"],
  },
  "dashboard-time": {
    title: "时间维度",
    text: "按日、周、月、季度、年或自定义时间段切换趋势口径，时间按钮需要立即改变当前范围摘要。",
    metrics: ["当前 2026-05", "支持自定义", "趋势可比较"],
  },
  "dashboard-project": {
    title: "项目维度",
    text: "支持全部项目、单项目和多项目比较。每个项目必须显示类型、时间范围和反馈量。",
    metrics: ["单项目", "多项目", "项目类型"],
  },
  "dashboard-area": {
    title: "区域维度",
    text: "区域是城市父级，城市是服务中心父级；选择上级后才展示对应下级，切换上级会清理不合法选择。",
    metrics: ["7 个区域", "城市联动", "中心联动"],
  },
  "dashboard-topic": {
    title: "问题主题",
    text: "按等待、解释、同步、交付等主题查看低分主因，帮助运营从指标跳到可处理问题。",
    metrics: ["等待", "解释", "同步"],
  },
  "dashboard-report": {
    title: "报告输出",
    text: "进入总复盘和专项报告输出，专项入口切换后必须同步改变报告正文和摘要。",
    metrics: ["总复盘", "5 个专项", "可复制"],
  },
  "qa-new": {
    title: "新建问答",
    text: "默认打开一个自由对话。只有从仪表盘带着问题进入时，才在第一条消息中说明使用了当前范围。",
    metrics: ["自由提问", "可带入范围", "自动保存"],
  },
  "qa-history": {
    title: "问答历史",
    text: "历史记录用于回看和继续对话，不作为全局筛选器。收藏通过星标完成，不改变其他功能板块范围。",
    metrics: ["3 条历史", "星标收藏", "可继续问"],
  },
  "profile-settings": {
    title: "个人设置",
    text: "管理姓名、角色、偏好和默认工作区。这里不承载报告正文，也不承载指标下钻。",
    metrics: ["区域运营主管", "华东大区", "可编辑"],
  },
  "profile-account": {
    title: "账号状态",
    text: "查看登录状态、席位、权限和审批结果。只读状态用 badge 表达，可操作项用按钮表达。",
    metrics: ["账号正常", "席位已启用", "导出需审批"],
  },
  "profile-privacy": {
    title: "隐私与数据",
    text: "管理脱敏规则、个人数据导出和问答记录清理。敏感字段默认不进入复盘正文。",
    metrics: ["默认脱敏", "可导出", "可清理"],
  },
  "profile-data": {
    title: "数据权限",
    text: "查看区域级、项目级和导入权限，必要时申请更高范围的数据访问。",
    metrics: ["区域级", "项目级", "导入已开启"],
  },
};

const secondaryWorkspaceCopy: Record<string, {
  eyebrow: string;
  title: string;
  summary: string;
  items: Array<{ title: string; text: string; status: string; tone: StatusTone }>;
  action: string;
}> = {
  "new-upload": {
    eyebrow: "上传反馈数据",
    title: "导入入口与文件准备",
    summary: "把本次售后反馈表放入当前批次，先确认文件来源、格式和样本量。",
    items: [
      { title: "文件入口", text: "支持 Excel / CSV；上传后进入字段识别。", status: "可操作", tone: "pass" },
      { title: "标准模板", text: "模板包含项目、时间、评分、NPS、原话和服务中心字段。", status: "可下载", tone: "neutral" },
      { title: "批次识别", text: "当前批次识别为五一售后服务专项。", status: "已识别", tone: "pass" },
    ],
    action: "上传文件",
  },
  "new-mapping": {
    eyebrow: "字段映射",
    title: "确认字段映射关系",
    summary: "把导入字段映射到报告所需口径，避免后续筛选和指标计算跑偏。",
    items: [
      { title: "时间字段", text: "提交时间已匹配，可用于日、周、月、季度、年筛选。", status: "已通过", tone: "pass" },
      { title: "项目字段", text: "项目名称、项目类型和反馈量已识别。", status: "已通过", tone: "pass" },
      { title: "推荐意愿", text: "64 条为空，不参与 NPS 计算。", status: "需确认", tone: "warning" },
    ],
    action: "保存映射",
  },
  "new-validation": {
    eyebrow: "导入校验",
    title: "检查数据质量和隐私字段",
    summary: "先判断这批数据能否进入复盘，再处理缺失、重复和隐私问题。",
    items: [
      { title: "必填字段", text: "项目、时间、评分、原话字段满足复盘要求。", status: "已通过", tone: "pass" },
      { title: "指标覆盖", text: "服务评分覆盖 98.2%，推荐意愿覆盖 94.8%。", status: "可复盘", tone: "pass" },
      { title: "敏感信息", text: "手机号、姓名、车牌和 VIN 默认脱敏。", status: "已脱敏", tone: "pass" },
    ],
    action: "确认校验",
  },
  "new-report": {
    eyebrow: "生成初始复盘",
    title: "生成默认总复盘报告",
    summary: "校验完成后生成初始总报告，给运营一个可复制的整体判断。",
    items: [
      { title: "总复盘", text: "生成整体体验判断、指标变化和主要问题。", status: "已就绪", tone: "pass" },
      { title: "专项入口", text: "服务闭环、满意度归因、区域督查等专项可继续生成。", status: "5 个专项", tone: "neutral" },
      { title: "证据链", text: "每个结论都保留可追溯反馈原文。", status: "可追溯", tone: "pass" },
    ],
    action: "生成报告",
  },
  "new-history": {
    eyebrow: "导入历史",
    title: "导入批次与历史记录",
    summary: "查看最近文件、处理状态和需要继续配置的批次。",
    items: [
      { title: "五一售后服务专项", text: "2026-06-01 导入，1,240 行。", status: "已导入", tone: "pass" },
      { title: "四月售后月报", text: "2026-05-02 导入，1,086 行。", status: "已导入", tone: "pass" },
      { title: "补能体验活动反馈", text: "2026-05-28 导入，328 行。", status: "需配置", tone: "warning" },
    ],
    action: "查看批次",
  },
  "projects-all": {
    eyebrow: "全部项目",
    title: "所有已导入项目",
    summary: "查看所有业务项目、项目类型、时间范围、反馈量和报告状态。",
    items: [
      { title: "五一售后服务专项", text: "售后服务 / 2026-05 / 1,240 条反馈。", status: "已生成", tone: "pass" },
      { title: "四月售后月报", text: "月度复盘 / 2026-04 / 1,086 条反馈。", status: "已归档", tone: "neutral" },
      { title: "补能体验活动反馈", text: "活动体验 / 328 条反馈。", status: "需配置", tone: "warning" },
    ],
    action: "选择项目",
  },
  "projects-recent": {
    eyebrow: "最近项目",
    title: "最近打开与最近导入",
    summary: "把最近正在处理的项目放在前面，方便运营继续复盘。",
    items: [
      { title: "最近打开", text: "五一售后服务专项刚刚进入报告仪表盘。", status: "当前", tone: "pass" },
      { title: "最近导入", text: "补能体验活动反馈仍需确认字段。", status: "需配置", tone: "warning" },
      { title: "最近归档", text: "四月售后月报保留报告和问答记录。", status: "已归档", tone: "neutral" },
    ],
    action: "继续处理",
  },
  "projects-detail": {
    eyebrow: "项目详情",
    title: "项目范围、样本和报告状态",
    summary: "选中项目后查看来源渠道、覆盖区域、服务中心和下一步入口。",
    items: [
      { title: "来源渠道", text: "问卷星、App 内问卷、企微链接。", status: "3 类", tone: "neutral" },
      { title: "覆盖范围", text: "7 个区域、42 个服务中心。", status: "完整", tone: "pass" },
      { title: "报告状态", text: "总复盘已生成，专项可继续切换。", status: "可查看", tone: "pass" },
    ],
    action: "打开详情",
  },
  "projects-batches": {
    eyebrow: "导入批次",
    title: "导入批次和文件记录",
    summary: "按文件批次核对导入时间、处理状态和样本量。",
    items: [
      { title: "主批次", text: "五一售后服务专项_2026-05.csv。", status: "已导入", tone: "pass" },
      { title: "历史批次", text: "四月售后月报_2026-04.csv。", status: "已导入", tone: "pass" },
      { title: "待配置批次", text: "补能体验活动反馈.csv。", status: "需配置", tone: "warning" },
    ],
    action: "核对批次",
  },
  "projects-archive": {
    eyebrow: "归档项目",
    title: "归档项目与恢复入口",
    summary: "查看已完成项目，保留报告和问答记录，但不进入默认范围。",
    items: [
      { title: "四月售后月报", text: "月报已完成，可恢复到报告仪表盘查看。", status: "已归档", tone: "neutral" },
      { title: "问答记录", text: "历史查询保留，星标状态可继续查看。", status: "保留", tone: "pass" },
      { title: "数据范围", text: "归档项目不会影响默认当前范围。", status: "隔离", tone: "pass" },
    ],
    action: "恢复项目",
  },
  "dashboard-overview": {
    eyebrow: "总览",
    title: "当前范围和核心指标",
    summary: "先看当前范围、核心指标和风险对象，再决定是否进入报告或 AI 问答。",
    items: [
      { title: "当前范围", text: "全部时间 / 全部项目 / 全国。", status: "默认", tone: "neutral" },
      { title: "核心指标", text: "反馈量、评分、NPS、低分反馈随筛选更新。", status: "已更新", tone: "pass" },
      { title: "风险对象", text: "杭州西溪、成都高新、北京望京。", status: "3 个", tone: "warning" },
    ],
    action: "查看总览",
  },
  "dashboard-time": {
    eyebrow: "时间维度",
    title: "按时间粒度筛选当前反馈",
    summary: "日、周、月、季度、年和自定义时间段选择后立即应用到当前范围。",
    items: [
      { title: "日 / 周 / 月", text: "适合看短周期趋势和月度复盘。", status: "可切换", tone: "pass" },
      { title: "季度 / 年", text: "适合经营会和跨期比较。", status: "可切换", tone: "pass" },
      { title: "自定义", text: "可选择 2026-05 的三个自定义时间段。", status: "可选择", tone: "pass" },
    ],
    action: "切换时间",
  },
  "dashboard-project": {
    eyebrow: "项目维度",
    title: "按项目范围筛选和比较",
    summary: "支持全部项目、单项目、多项目比较，每个项目展示类型、时间和反馈量。",
    items: [
      { title: "全部项目", text: "默认展示累计 2,654 条反馈。", status: "默认", tone: "neutral" },
      { title: "单项目", text: "再次点击项目可取消选择。", status: "可反选", tone: "pass" },
      { title: "多项目", text: "可同时选择售后服务、月报、活动反馈。", status: "可多选", tone: "pass" },
    ],
    action: "选择项目",
  },
  "dashboard-area": {
    eyebrow: "区域维度",
    title: "区域、城市、服务中心联动筛选",
    summary: "区域是城市父级，城市是服务中心父级，切换上级会清理不合法下级。",
    items: [
      { title: "区域", text: "先选择华东、华南、西南或华北。", status: "父级", tone: "neutral" },
      { title: "城市", text: "未选区域时禁用，选区域后显示对应城市。", status: "联动", tone: "pass" },
      { title: "服务中心", text: "未选城市时禁用，选中后立即应用。", status: "即应用", tone: "pass" },
    ],
    action: "筛选区域",
  },
  "dashboard-topic": {
    eyebrow: "问题主题",
    title: "按问题主题查看风险对象",
    summary: "围绕等待、解释、同步、交付等主题查看风险对象和主因。",
    items: [
      { title: "等待时间", text: "集中在杭州西溪服务中心。", status: "高风险", tone: "risk" },
      { title: "解释不清", text: "影响低分和投诉风险。", status: "需闭环", tone: "warning" },
      { title: "App 同步", text: "成都高新服务中心需复核。", status: "需复核", tone: "warning" },
    ],
    action: "查看主题",
  },
  "profile-settings": {
    eyebrow: "个人设置",
    title: "个人设置与默认偏好",
    summary: "管理角色、默认区域、默认进入页面和个人偏好。",
    items: [
      { title: "角色", text: "区域运营主管 / 华东大区。", status: "已设置", tone: "pass" },
      { title: "默认范围", text: "默认进入最近项目和报告仪表盘。", status: "可编辑", tone: "neutral" },
      { title: "通知偏好", text: "导入完成和报告生成后提醒。", status: "开启", tone: "pass" },
    ],
    action: "编辑设置",
  },
  "profile-account": {
    eyebrow: "账号状态",
    title: "账号状态与权限审批",
    summary: "查看账号、席位、导入权限和导出审批状态。",
    items: [
      { title: "账号状态", text: "当前账号正常，可使用工作台。", status: "正常", tone: "pass" },
      { title: "导入权限", text: "可导入售后反馈 Excel / CSV。", status: "已开启", tone: "pass" },
      { title: "导出权限", text: "报告导出需要审批。", status: "需审批", tone: "warning" },
    ],
    action: "申请权限",
  },
  "profile-privacy": {
    eyebrow: "隐私设置",
    title: "隐私设置与数据清理",
    summary: "管理敏感字段脱敏、问答记录清理和导出边界。",
    items: [
      { title: "默认脱敏", text: "手机号、姓名、车牌、VIN 默认脱敏。", status: "开启", tone: "pass" },
      { title: "问答记录", text: "可清理个人问答历史。", status: "可清理", tone: "neutral" },
      { title: "导出边界", text: "导出前只显示授权范围内的数据。", status: "受控", tone: "pass" },
    ],
    action: "管理隐私",
  },
  "profile-data": {
    eyebrow: "数据权限",
    title: "数据权限与授权范围",
    summary: "查看区域级、项目级和导入权限。",
    items: [
      { title: "区域权限", text: "当前为华东大区区域级权限。", status: "区域级", tone: "pass" },
      { title: "项目权限", text: "可查看已授权项目和归档项目。", status: "已授权", tone: "pass" },
      { title: "默认范围", text: "默认进入全部项目和全部区域。", status: "全部", tone: "pass" },
    ],
    action: "查看授权",
  },
};

export function App() {
  const viewMode = typeof window === "undefined" ? "workbench" : getAppViewMode(window.location.search);
  return viewMode === "portfolio" ? <PortfolioDeck /> : <WorkbenchApp />;
}

function WorkbenchApp() {
  const initialScreen = getInitialScreen();
  const [activeScreen, setActiveScreen] = useState<ScreenId>(initialScreen);
  const [activePrimaryId, setActivePrimaryId] = useState<PrimaryNavId | null>(() => getPrimaryIdByScreen(initialScreen));
  const [activeSecondaryId, setActiveSecondaryId] = useState<string>(() => getDefaultSecondaryIdByScreen(initialScreen));
  const [primaryCollapsed, setPrimaryCollapsed] = useState(false);
  const [primaryPreviewOpen, setPrimaryPreviewOpen] = useState(false);
  const [secondaryNavOpen, setSecondaryNavOpen] = useState(initialScreen !== "home");
  const [previewCloseTimer, setPreviewCloseTimer] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [appliedFilter, setAppliedFilter] = useState<DrilldownFilter>(defaultDrilldownFilter);
  const [qaScopeMode, setQaScopeMode] = useState<QaScopeMode>("free");
  const [pendingQaQuestion, setPendingQaQuestion] = useState("");
  const activeMeta = screenMeta[activeScreen];
  const activePrimary = useMemo(
    () => activePrimaryId ? primaryNavItems.find((item) => item.id === activePrimaryId) ?? null : null,
    [activePrimaryId],
  );
  const activeSecondary = useMemo(
    () => activePrimary?.items.find((item) => item.id === activeSecondaryId) ?? activePrimary?.items[0] ?? null,
    [activePrimary, activeSecondaryId],
  );
  const notify = (message: string) => setNotice(message);
  const openPrimaryPreview = () => {
    if (previewCloseTimer) window.clearTimeout(previewCloseTimer);
    setPreviewCloseTimer(null);
    if (primaryCollapsed) setPrimaryPreviewOpen(true);
  };
  const closePrimaryPreview = () => {
    if (!primaryCollapsed) return;
    if (previewCloseTimer) window.clearTimeout(previewCloseTimer);
    const timer = window.setTimeout(() => {
      setPrimaryPreviewOpen(false);
      setPreviewCloseTimer(null);
    }, 160);
    setPreviewCloseTimer(timer);
  };

  useEffect(() => () => {
    if (previewCloseTimer) window.clearTimeout(previewCloseTimer);
  }, [previewCloseTimer]);

  const openScreen = (screen: ScreenId, secondaryId?: string, primaryId?: PrimaryNavId) => {
    const nextPrimaryId = primaryId ?? getPrimaryIdByScreen(screen);
    const nextSecondaryId = secondaryId ?? getDefaultSecondaryIdByScreen(screen);
    setNotice("");
    setActivePrimaryId(nextPrimaryId);
    setActiveSecondaryId(nextSecondaryId);
    setSecondaryNavOpen(screen !== "home");
    if (screen === "query") {
      setQaScopeMode("free");
      setPendingQaQuestion("");
    }
    setActiveScreen(screen);
  };
  const openInitialReportOutput = () => {
    openScreen("report", "dashboard-report", "dashboard");
    setSecondaryNavOpen(true);
    setPrimaryCollapsed(true);
    notify("已生成初始复盘，并打开报告输出");
  };
  const handlePrimaryChange = (primaryId: PrimaryNavId) => {
    const primary = primaryNavItems.find((item) => item.id === primaryId) ?? primaryNavItems[0];
    const secondary = primary.items.find((item) => item.id === primary.defaultSecondaryId) ?? primary.items[0];
    openScreen(secondary.screen, secondary.id, primary.id);
    setSecondaryNavOpen(true);
    setPrimaryCollapsed(true);
    setPrimaryPreviewOpen(false);
  };
  const handleSecondaryChange = (secondary: SecondaryNavItem) => {
    if (!activePrimary) return;
    openScreen(secondary.screen, secondary.id, activePrimary.id);
    setSecondaryNavOpen(true);
    setPrimaryCollapsed(true);
    setPrimaryPreviewOpen(false);
  };
  const openFilteredQa = (filter: DrilldownFilter) => {
    setAppliedFilter(filter);
    setQaScopeMode("filtered");
    setActivePrimaryId("query");
    setActiveSecondaryId("qa-new");
    setActiveScreen("query");
    setSecondaryNavOpen(true);
    setPrimaryCollapsed(true);
    setPrimaryPreviewOpen(false);
  };
  const openQaFromDashboard = (filter: DrilldownFilter, question: string) => {
    setAppliedFilter(filter);
    setPendingQaQuestion(question);
    setQaScopeMode("filtered");
    setActivePrimaryId("query");
    setActiveSecondaryId("qa-new");
    setActiveScreen("query");
    setSecondaryNavOpen(true);
    setPrimaryCollapsed(true);
    setPrimaryPreviewOpen(false);
    notify("已从报告仪表盘创建 AI 问答会话，并提交问题给 AI 问答");
  };

  return (
    <div className="workbench">
      <Header appliedFilter={appliedFilter} onAction={notify} />
      <div className="workbench-body">
        <Sidebar
          activePrimaryId={activePrimary?.id ?? null}
          activeSecondaryId={activeSecondary?.id ?? ""}
          collapsed={primaryCollapsed}
          previewOpen={primaryPreviewOpen}
          secondaryOpen={secondaryNavOpen}
          onPrimaryChange={handlePrimaryChange}
          onSecondaryChange={handleSecondaryChange}
          onToggleCollapse={() => {
            if (previewCloseTimer) window.clearTimeout(previewCloseTimer);
            setPreviewCloseTimer(null);
            setPrimaryCollapsed((value) => !value);
            setPrimaryPreviewOpen(false);
          }}
          onPreviewOpen={openPrimaryPreview}
          onPreviewClose={closePrimaryPreview}
        />
        <main className="screen-shell">
          <ScreenHeading activeMeta={activeMeta} primaryTitle={activePrimary?.title ?? "工作台"} secondaryTitle={activeSecondary?.title ?? "首页"} />
          {notice ? <ActionNotice message={notice} /> : null}
          {activeScreen === "home" ? <HomeScreen onOpenScreen={openScreen} /> : null}
          {activeScreen === "import" ? (
            <ImportScreen
              activeSecondaryId={activeSecondary?.id ?? "new-upload"}
              onAction={notify}
              onOpenScreen={openScreen}
              onOpenInitialReport={openInitialReportOutput}
            />
          ) : null}
          {activeScreen === "projects" ? (
            <ProjectsScreen
              activeSecondaryId={activeSecondary?.id ?? "projects-all"}
              onAction={notify}
              onCreateProject={() => {
                openScreen("import", "new-upload", "new-project");
                notify("已进入新建项目，可继续上传反馈数据");
              }}
              onOpenProject={(projectId) => {
                const project = projectId ? importedProjects.find((item) => item.id === projectId) : null;
                setAppliedFilter({ ...defaultDrilldownFilter, selectedProjectIds: projectId ? [projectId] : [] });
                openScreen("drilldown", "dashboard-scope", "dashboard");
                setSecondaryNavOpen(true);
                setPrimaryCollapsed(true);
                notify(project ? `已打开「${project.name}」，报告仪表盘已带入该项目范围` : "已打开全部项目范围，报告仪表盘未限定具体项目");
              }}
            />
          ) : null}
          {activeScreen === "drilldown" ? (
            <DrilldownScreen
              activeSecondaryId={activeSecondary?.id ?? "dashboard-overview"}
              initialFilter={appliedFilter}
              onAction={notify}
              onApplyFilter={setAppliedFilter}
              onNavigate={openScreen}
              onOpenFilteredQa={openFilteredQa}
              onOpenInlineQa={openQaFromDashboard}
            />
          ) : null}
          {activeScreen === "report" ? <ReportScreen activeSecondaryId={activeSecondary?.id ?? "dashboard-report"} appliedFilter={appliedFilter} onAction={notify} /> : null}
          {activeScreen === "query" ? (
            <AiQaScreen
              appliedFilter={appliedFilter}
              initialScopeMode={qaScopeMode}
              initialQuestion={pendingQaQuestion}
              onPendingQuestionHandled={() => {
                setPendingQaQuestion("");
              }}
              onAction={notify}
              activeSecondaryId={activeSecondary?.id ?? "qa-new"}
            />
          ) : null}
          {activeScreen === "profile" ? <ProfileScreen activeSecondaryId={activeSecondary?.id ?? "profile-settings"} onAction={notify} /> : null}
        </main>
      </div>
    </div>
  );
}

function getInitialScreen(): ScreenId {
  if (typeof window === "undefined") return "home";
  const screen = new URLSearchParams(window.location.search).get("screen");
  return Object.prototype.hasOwnProperty.call(screenMeta, screen ?? "") ? (screen as ScreenId) : "home";
}

function getPrimaryIdByScreen(screen: ScreenId): PrimaryNavId | null {
  if (screen === "home") return null;
  const match = primaryNavItems.find((primary) => primary.items.some((item) => item.screen === screen));
  return match?.id ?? "new-project";
}

function getDefaultSecondaryIdByScreen(screen: ScreenId): string {
  if (screen === "home") return "";
  const primary = primaryNavItems.find((item) => item.items.some((secondary) => secondary.screen === screen));
  const match = primary?.items.find((item) => item.screen === screen);
  return match?.id ?? primary?.defaultSecondaryId ?? "new-upload";
}

function NavIconView({ icon, size = 17 }: { icon: NavIcon; size?: number }) {
  const props = { size, strokeWidth: 2 };
  if (icon === "plus") return <PlusCircle {...props} />;
  if (icon === "folder") return <FolderOpen {...props} />;
  if (icon === "chart") return <BarChart3 {...props} />;
  if (icon === "message") return <MessageSquareText {...props} />;
  return <Settings {...props} />;
}

function Header({ appliedFilter, onAction }: { appliedFilter: DrilldownFilter; onAction: (message: string) => void }) {
  const contextStats = buildContextStats(appliedFilter);
  const buildSummaryText = () => {
    const stats = contextStats.map((item) => `${item.label}：${item.value}`).join("\n");
    return `售后复盘工作台\n${stats}\n当前结论：服务体验整体稳定，等待与解释问题需要优先闭环。`;
  };

  const copySummary = () => {
    const text = buildSummaryText();
    const writePromise = navigator.clipboard?.writeText(text);
    if (writePromise) void writePromise.catch(() => undefined);
    onAction("已复制当前页面摘要，可粘贴到周报或会议纪要");
  };

  const exportReport = () => {
    const report = [
      "# 售后复盘报告",
      "",
      buildSummaryText(),
      "",
      "## 核心指标",
      ...buildScopeMetricCards(appliedFilter).map((metric) => `- ${metric.label}：${metric.value}（${metric.helper}）`),
      "",
      "## 重点证据",
      ...evidenceQuotes.map((item, index) => `${index + 1}. ${item.quote}（${item.location}，${item.rating}，${item.nps}）`),
    ].join("\n");
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "after-sales-report-2026-05.md";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    onAction("已导出当前复盘报告 Markdown 文件");
  };

  return (
    <header className="topbar">
      <div className="brand-lockup">
        <WorkbenchLogo size={44} />
        <div>
          <strong>售后复盘工作台</strong>
          <span>上传数据、查看结论、筛选范围、继续提问</span>
        </div>
      </div>
      <div className="context-strip" aria-label="当前数据范围">
        {contextStats.map((item) => (
          <div className="context-item" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <div className="topbar-actions">
        <button className="ghost-button" type="button" onClick={copySummary}>
          <Copy size={15} />
          复制摘要
        </button>
        <button className="primary-button" type="button" onClick={exportReport}>
          <Download size={15} />
          导出报告
        </button>
      </div>
    </header>
  );
}

function WorkbenchLogo({ size = 32 }: { size?: number }) {
  return (
    <svg className="workbench-logo" width={size} height={size} viewBox="0 0 44 44" role="img" aria-label="售后复盘工作台">
      <rect x="2" y="2" width="40" height="40" rx="8" fill="#0F172A" />
      <path
        d="M12 14.5C12 11.5 14.5 9 17.6 9H27.2C30.4 9 33 11.5 33 14.7V21.7C33 24.9 30.4 27.3 27.2 27.3H22.3L16.4 32V27.3H17.6C14.5 27.3 12 24.8 12 21.8V14.5Z"
        fill="none"
        stroke="#008B8B"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <rect x="17" y="15" width="3" height="8" rx="1.2" fill="#A7F3D0" />
      <rect x="22" y="12.5" width="3" height="10.5" rx="1.2" fill="#FFFFFF" />
      <rect x="27" y="17" width="3" height="6" rx="1.2" fill="#A7F3D0" />
      <path d="M28.5 32.2L31.2 34.8L36.5 29.2" fill="none" stroke="#38A169" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Sidebar({
  activePrimaryId,
  activeSecondaryId,
  collapsed,
  previewOpen,
  secondaryOpen,
  onPrimaryChange,
  onSecondaryChange,
  onToggleCollapse,
  onPreviewOpen,
  onPreviewClose,
}: {
  activePrimaryId: PrimaryNavId | null;
  activeSecondaryId: string;
  collapsed: boolean;
  previewOpen: boolean;
  secondaryOpen: boolean;
  onPrimaryChange: (primary: PrimaryNavId) => void;
  onSecondaryChange: (secondary: SecondaryNavItem) => void;
  onToggleCollapse: () => void;
  onPreviewOpen: () => void;
  onPreviewClose: () => void;
}) {
  const activePrimary = activePrimaryId ? primaryNavItems.find((item) => item.id === activePrimaryId) ?? null : null;
  const showSecondary = Boolean(secondaryOpen && activePrimary && activePrimary.id !== "query");
  const expanded = !collapsed || previewOpen;
  const renderPrimaryNav = (showLabels: boolean) => (
    <nav className="primary-nav-list">
      {primaryNavItems.map((item) => (
        <button
          className={item.id === activePrimaryId ? "primary-nav-item active" : "primary-nav-item"}
          key={item.id}
          onClick={() => onPrimaryChange(item.id)}
          onMouseEnter={!showLabels ? onPreviewOpen : undefined}
          onFocus={!showLabels ? onPreviewOpen : undefined}
          title={showLabels ? undefined : item.title}
          type="button"
        >
          <span><NavIconView icon={item.icon} /></span>
          {showLabels ? (
            <div>
              <strong>{item.title}</strong>
              <small>{item.summary}</small>
            </div>
          ) : null}
        </button>
      ))}
    </nav>
  );

  return (
    <aside
      className={[
        "sidebar-shell",
        collapsed ? "collapsed" : "",
        previewOpen ? "preview-open" : "",
        showSecondary ? "secondary-open" : "",
      ].filter(Boolean).join(" ")}
      aria-label="功能导航"
    >
      <section
        className="primary-sidebar"
        onMouseLeave={collapsed ? onPreviewClose : undefined}
      >
        {collapsed ? (
          <div className="collapsed-rail" onMouseEnter={onPreviewOpen}>
            <button
              className="collapse-button"
              type="button"
              onClick={onToggleCollapse}
              onMouseEnter={onPreviewOpen}
              onFocus={onPreviewOpen}
              aria-label="展开导航"
            >
              <PanelLeftOpen size={16} />
            </button>
            {renderPrimaryNav(false)}
          </div>
        ) : null}
        {expanded ? (
          <div className={collapsed ? "primary-preview-panel" : "primary-expanded-panel"}>
            <div className="sidebar-topline">
              <strong>功能导航</strong>
              <button
                className="collapse-button"
                type="button"
                onClick={onToggleCollapse}
                aria-label={collapsed ? "展开导航" : "折叠导航"}
              >
                {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </button>
            </div>
            {renderPrimaryNav(true)}
          </div>
        ) : null}
      </section>
      {showSecondary && activePrimary ? (
        <section className="secondary-sidebar" aria-label={`${activePrimary.title}功能列表`}>
          <div className="secondary-sidebar-head">
            <span>{activePrimary.title}</span>
            <strong>{activePrimary.summary}</strong>
          </div>
          <nav className="secondary-nav-list">
            {activePrimary.items.map((item) => (
              <button
                className={item.id === activeSecondaryId ? "secondary-nav-item active" : "secondary-nav-item"}
                key={item.id}
                onClick={() => onSecondaryChange(item)}
                title={item.summary}
                type="button"
              >
                <strong>{item.title}</strong>
              </button>
            ))}
          </nav>
        </section>
      ) : null}
    </aside>
  );
}

function ActionNotice({ message }: { message: string }) {
  return (
    <div className="action-notice" aria-live="polite">
      <CheckCircle2 size={16} />
      <span>{message}</span>
    </div>
  );
}

function ScreenHeading({
  activeMeta,
  primaryTitle,
  secondaryTitle,
}: {
  activeMeta: ScreenMeta;
  primaryTitle: string;
  secondaryTitle: string;
}) {
  return (
    <section className="screen-heading">
      <div>
        <nav className="screen-breadcrumb" aria-label="当前页面层级">
          <strong>{primaryTitle}</strong>
          <ChevronRight size={14} />
          <strong>{secondaryTitle}</strong>
        </nav>
        <h1>{activeMeta.title}</h1>
      </div>
    </section>
  );
}

function HomeScreen({
  onOpenScreen,
}: {
  onOpenScreen: (screen: ScreenId, secondaryId?: string, primaryId?: PrimaryNavId) => void;
}) {
  return (
    <div className="screen-grid home-layout" data-route-panel="home">
      <section className="panel home-main-panel">
        <div className="panel-head">
          <div>
            <p>最近工作区</p>
            <h2>继续处理最近的数据、报告和问答</h2>
          </div>
          <StatusBadge tone="neutral">首页</StatusBadge>
        </div>
        <div className="home-kpi-grid">
          <MiniKpi label="待处理导入" value="1" tone="warning" />
          <MiniKpi label="最近项目" value="3" tone="pass" />
          <MiniKpi label="可继续报告" value="2" tone="pass" />
          <MiniKpi label="问答记录" value="3" tone="neutral" />
        </div>
        <div className="home-work-grid">
          {[
            { screen: "import" as const, secondary: "new-validation", primary: "new-project" as const, title: "继续导入校验", text: "补能体验活动反馈.csv 仍需确认字段映射。", action: "进入导入校验" },
            { screen: "projects" as const, secondary: "projects-all", primary: "projects" as const, title: "查看过往项目", text: "五一售后服务专项、四月售后月报和活动反馈。", action: "查看全部项目" },
            { screen: "drilldown" as const, secondary: "dashboard-scope", primary: "dashboard" as const, title: "继续报告仪表盘", text: "按时间、项目、区域、主题继续筛选和输出报告。", action: "进入筛选范围" },
            { screen: "query" as const, secondary: "qa-new", primary: "query" as const, title: "继续 AI 问答", text: "可以新建自由问答，也可以打开问答记录。", action: "进入新建问答" },
          ].map((item) => (
            <button className="home-work-card" key={item.title} type="button" onClick={() => onOpenScreen(item.screen, item.secondary, item.primary)}>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
              <small>{item.action}</small>
            </button>
          ))}
        </div>
      </section>
      <aside className="side-stack home-side">
        <section className="panel">
          <div className="panel-head compact">
            <div>
              <p>最近项目</p>
              <h2>可继续打开</h2>
            </div>
          </div>
          <div className="project-card-list">
            {importedProjects.map((project) => (
              <button key={project.id} type="button" onClick={() => onOpenScreen("projects", "projects-detail", "projects")}>
                <strong>{project.name}</strong>
                <span>{project.dateRange}</span>
                <small>{project.count} 条反馈 · {project.type}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head compact">
            <div>
              <p>最近问答</p>
              <h2>可继续追问</h2>
            </div>
          </div>
          <div className="home-rule-list">
            {queryThreads.map((thread) => (
              <button key={thread.id} type="button" onClick={() => onOpenScreen("query", "qa-new", "query")}>
                <strong>{thread.title}</strong>
                <span>{thread.meta}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function SecondaryWorkspace({ secondaryId }: { secondaryId: string }) {
  const copy = secondaryWorkspaceCopy[secondaryId] ?? secondaryWorkspaceCopy["dashboard-overview"];

  return (
    <div className="secondary-workspace" data-secondary-id={secondaryId}>
      <div className="secondary-workspace-head">
        <div>
          <span>{copy.eyebrow}</span>
          <strong>{copy.title}</strong>
          <p>{copy.summary}</p>
        </div>
      </div>
      <div className="secondary-workspace-grid">
        {copy.items.map((item) => (
          <article className={`secondary-workspace-card ${item.tone}`} key={item.title}>
            <div>
              <strong>{item.title}</strong>
              <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
            </div>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ImportScreen({
  activeSecondaryId,
  onAction,
  onOpenScreen,
  onOpenInitialReport,
}: {
  activeSecondaryId: string;
  onAction: (message: string) => void;
  onOpenScreen: (screen: ScreenId, secondaryId?: string, primaryId?: PrimaryNavId) => void;
  onOpenInitialReport: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [recognitionStatus, setRecognitionStatus] = useState("待复核");
  const hasSelectedFile = selectedFileName.length > 0;

  if (activeSecondaryId === "new-mapping") return <ImportMappingPage onAction={onAction} />;
  if (activeSecondaryId === "new-validation") return <ImportValidationPage onAction={onAction} />;
  if (activeSecondaryId === "new-report") return <ImportInitialReportPage onAction={onAction} onOpenReport={onOpenInitialReport} />;
  if (activeSecondaryId === "new-history") return <ImportHistoryPage onAction={onAction} onOpenScreen={onOpenScreen} />;

  const openUploadPicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    onAction(`已选择文件「${file.name}」，可继续字段映射和导入校验`);
  };
  const markTemplateDownload = () => onAction("已下载标准导入模板");
  const rerunRecognition = () => {
    if (!hasSelectedFile) {
      onAction("请先上传反馈数据文件");
      return;
    }
    setRecognitionStatus("已重新识别");
    onAction("已重新识别字段映射，推荐意愿字段仍需确认");
  };

  return (
    <div className="screen-grid import-layout" data-route-panel="new-upload">
      <section className="panel upload-panel">
        <div className="panel-head">
          <div>
            <p>{secondaryPanelCopy[activeSecondaryId]?.title ?? "数据进入"}</p>
            <h2>{activeSecondaryId === "new-mapping" ? "确认字段映射关系" : activeSecondaryId === "new-validation" ? "字段映射与数据质量" : activeSecondaryId === "new-report" ? "生成初始复盘报告" : activeSecondaryId === "new-history" ? "导入批次与历史记录" : "上传售后反馈 Excel / CSV"}</h2>
          </div>
          <StatusBadge tone={hasSelectedFile ? "pass" : "neutral"}>{hasSelectedFile ? "已选择文件" : "待上传"}</StatusBadge>
        </div>
        <div className="upload-zone">
          <input
            ref={fileInputRef}
            className="visually-hidden-file"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelected}
            aria-label="上传售后反馈表格"
          />
          <UploadCloud size={36} />
          <strong>拖拽文件到这里，或点击上传</strong>
          <span>支持问卷星、腾讯问卷、App 内问卷、短信和企微链接导出的标准表格</span>
          <em>{hasSelectedFile ? `当前文件：${selectedFileName}` : "尚未选择文件"}</em>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={openUploadPicker}>
              <UploadCloud size={15} />
              上传文件
            </button>
            <a
              className="ghost-button"
              href="/templates/after_sales_feedback_import_template.csv"
              download
              onClick={markTemplateDownload}
            >
              <Download size={15} />
              下载标准模板
            </a>
          </div>
        </div>
        <div className="compact-kpis">
          <MiniKpi label="识别项目" value={hasSelectedFile ? "1" : "-"} tone={hasSelectedFile ? "pass" : "neutral"} />
          <MiniKpi label="字段覆盖" value={hasSelectedFile ? "94.8%" : "待识别"} tone={hasSelectedFile ? "pass" : "neutral"} />
          <MiniKpi label="需确认" value={hasSelectedFile ? "2 项" : "-"} tone={hasSelectedFile ? "warning" : "neutral"} />
          <MiniKpi label="隐私字段" value={hasSelectedFile ? "已脱敏" : "待识别"} tone={hasSelectedFile ? "pass" : "neutral"} />
        </div>
      </section>
      <section className="panel validation-panel">
        <div className="panel-head">
          <div>
            <p>导入校验</p>
            <h2>字段映射与数据质量</h2>
          </div>
          <button className="ghost-button" type="button" onClick={rerunRecognition}>重新识别</button>
        </div>
        <div className="route-summary-grid">
          <MiniKpi label="识别状态" value={recognitionStatus} tone={recognitionStatus === "已重新识别" ? "pass" : "warning"} />
          <MiniKpi label="当前文件" value={hasSelectedFile ? (selectedFileName.endsWith(".csv") ? "CSV" : "Excel") : "未选择"} tone="neutral" />
          <MiniKpi label="字段覆盖" value={hasSelectedFile ? "94.8%" : "待识别"} tone={hasSelectedFile ? "pass" : "neutral"} />
          <MiniKpi label="需确认" value={hasSelectedFile ? "2 项" : "-"} tone={hasSelectedFile ? "warning" : "neutral"} />
        </div>
        {hasSelectedFile ? (
          <DataTable
            columns={["字段", "状态", "结果", "说明"]}
            rows={validationRows}
            toneColumn={1}
          />
        ) : (
          <div className="empty-state-panel">
            <strong>上传文件后开始识别</strong>
            <span>当前没有待校验的数据。</span>
          </div>
        )}
      </section>
      <div className="side-stack">
        <ImportStatusPanel hasSelectedFile={hasSelectedFile} />
      </div>
    </div>
  );
}

function ImportMappingPage({ onAction }: { onAction: (message: string) => void }) {
  const [mappingSaved, setMappingSaved] = useState(false);
  const [activeReminder, setActiveReminder] = useState("推荐意愿缺失 64 条");
  const [confirmedReminders, setConfirmedReminders] = useState<string[]>([]);
  const reminderItems = [
    { id: "推荐意愿缺失 64 条", title: "推荐意愿缺失", count: "64 条", field: "nps_score", result: "不参与 NPS，保留原文和评分", required: true },
    { id: "服务评分缺失 22 条", title: "服务评分缺失", count: "22 条", field: "service_score", result: "进入无评分样本，报告中单独标记", required: true },
    { id: "反馈原文字段预览", title: "反馈原文字段预览", count: "已抽样", field: "feedback_text", result: "原文池可分页查看，不放入初始复盘正文", required: false },
  ];
  const pendingReminderCount = reminderItems.filter((item) => item.required && !confirmedReminders.includes(item.id)).length;
  const recommendationConfirmed = confirmedReminders.includes("推荐意愿缺失 64 条");
  const serviceScoreConfirmed = confirmedReminders.includes("服务评分缺失 22 条");
  const feedbackPreviewConfirmed = confirmedReminders.includes("反馈原文字段预览");
  const activeReminderDetail = reminderItems.find((item) => item.id === activeReminder) ?? reminderItems[0];
  const confirmedRequiredCount = reminderItems.filter((item) => item.required && confirmedReminders.includes(item.id)).length;
  const requiredReminderCount = reminderItems.filter((item) => item.required).length;
  const mappingRows = [
    ["提交时间", "submit_time", "时间维度", "已通过"],
    ["项目名称", "project_name", "项目筛选", "已通过"],
    ["区域", "region", "区域筛选", "已通过"],
    ["城市", "city", "城市筛选", "已通过"],
    ["服务中心", "service_center", "服务中心筛选", "已通过"],
    ["车主原话", "feedback_text", "反馈原文", feedbackPreviewConfirmed ? "已确认" : "已通过"],
    ["服务评分", "service_score", "评分指标", serviceScoreConfirmed ? "已确认" : "需确认"],
    ["推荐意愿", "nps_score", "NPS 指标", recommendationConfirmed ? "已确认" : "需确认"],
  ];
  const confirmActiveReminder = () => {
    if (confirmedReminders.includes(activeReminder)) {
      onAction(`「${activeReminder}」已确认`);
      return;
    }
    setConfirmedReminders((current) => [...current, activeReminder]);
    setMappingSaved(false);
    onAction(`已确认「${activeReminder}」`);
  };

  return (
    <div className="screen-grid import-page-layout" data-route-panel="new-mapping">
      <section className="panel route-main-panel">
        <div className="panel-head">
          <div>
            <p>字段映射</p>
            <h2>确认导入字段和系统口径</h2>
          </div>
          <StatusBadge tone={mappingSaved ? "pass" : pendingReminderCount ? "warning" : "pass"}>
            {mappingSaved ? "映射已保存" : pendingReminderCount ? `${pendingReminderCount} 项需确认` : "可保存"}
          </StatusBadge>
        </div>
        <div className="route-summary-grid">
          <MiniKpi label="必填字段" value="8" tone="pass" />
          <MiniKpi label="自动匹配" value="94.8%" tone="pass" />
          <MiniKpi label="需确认" value={`${pendingReminderCount}`} tone={pendingReminderCount ? "warning" : "pass"} />
          <MiniKpi label="反馈原文" value="已保留" tone="pass" />
        </div>
        <DataTable columns={["业务字段", "表格字段", "用于哪个功能", "状态"]} rows={mappingRows} toneColumn={3} />
        <div className="route-action-bar">
          <div>
            <strong>字段映射会影响后续所有筛选、报告和 AI 问答</strong>
            <span>保存后，时间、项目、区域、城市、服务中心和反馈原文都会成为可查询字段。</span>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setMappingSaved(true);
              onAction("字段映射已保存，可进入导入校验");
            }}
            disabled={pendingReminderCount > 0}
          >
            {mappingSaved ? "已保存映射" : pendingReminderCount ? "先确认字段" : "保存映射"}
          </button>
        </div>
      </section>
      <aside className="side-stack">
        <section className="panel">
          <div className="panel-head compact">
            <div>
              <p>映射提醒</p>
              <h2>必须人工确认</h2>
            </div>
            <StatusBadge tone={pendingReminderCount ? "warning" : "pass"}>{confirmedRequiredCount}/{requiredReminderCount}</StatusBadge>
          </div>
          <div className="confirmation-progress" aria-label="人工确认进度">
            <span style={{ width: `${Math.round((confirmedRequiredCount / requiredReminderCount) * 100)}%` }} />
          </div>
          <div className="action-list">
            {reminderItems.map((item) => {
              const confirmed = confirmedReminders.includes(item.id);
              return (
              <button
                className={`${activeReminder === item.id ? "active" : ""} ${confirmed ? "confirmed" : ""}`.trim()}
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveReminder(item.id);
                  onAction(`已查看「${item.id}」`);
                }}
              >
                <span>{item.title}</span>
                <small>{confirmed ? "已确认" : item.required ? item.count : "预览"}</small>
              </button>
              );
            })}
          </div>
          <div className="confirmation-detail-card">
            <strong>{activeReminderDetail.title}</strong>
            <dl>
              <div><dt>字段</dt><dd>{activeReminderDetail.field}</dd></div>
              <div><dt>数量</dt><dd>{activeReminderDetail.count}</dd></div>
              <div><dt>处理</dt><dd>{activeReminderDetail.result}</dd></div>
            </dl>
          </div>
          <button className="primary-button confirm-reminder-button" type="button" onClick={confirmActiveReminder}>
            {confirmedReminders.includes(activeReminder) ? "已确认" : "确认当前项"}
          </button>
        </section>
      </aside>
    </div>
  );
}

function ImportValidationPage({ onAction }: { onAction: (message: string) => void }) {
  const [lastRunAt, setLastRunAt] = useState("刚刚");
  const [rerunCount, setRerunCount] = useState(0);
  const validationSummary = useMemo(() => {
    const rerunSuffix = rerunCount ? `第 ${rerunCount + 1} 次校验` : "首次校验";
    return [
      ["行数完整性", "1,240 / 1,240", "全部行可读取", "已通过"],
      ["时间解析", "1,240 / 1,240", "可用于日、周、月等周期", "已通过"],
      ["推荐意愿", "1,176 / 1,240", rerunCount ? `${rerunSuffix}后仍需人工确认` : "缺失样本不参与 NPS", "需确认"],
      ["隐私字段", "手机号、姓名、VIN", "默认脱敏后进入系统", "已脱敏"],
      ["重复反馈", rerunCount ? "0 条 / 已复扫" : "0 条", "未发现重复导入", "已通过"],
    ];
  }, [rerunCount]);

  return (
    <div className="screen-grid import-page-layout" data-route-panel="new-validation">
      <section className="panel route-main-panel">
        <div className="panel-head">
          <div>
            <p>导入校验</p>
            <h2>检查数据质量、缺失字段和隐私边界</h2>
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setRerunCount((value) => value + 1);
              setLastRunAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
              onAction("已重新运行导入校验");
            }}
          >
            重新校验
          </button>
        </div>
        <div className="route-summary-grid">
          <MiniKpi label="可读取行数" value="1,240" tone="pass" />
          <MiniKpi label="校验轮次" value={`${rerunCount + 1}`} tone="neutral" />
          <MiniKpi label="推荐缺失" value="64" tone="warning" />
          <MiniKpi label="隐私字段" value="已脱敏" tone="pass" />
        </div>
        <DataTable columns={["校验项", "结果", "说明", "状态"]} rows={validationSummary} toneColumn={3} />
        <PanelFooterNote title="最近校验" text={lastRunAt} />
      </section>
      <aside className="side-stack">
        <ImportStatusPanel />
      </aside>
    </div>
  );
}

function ImportInitialReportPage({ onAction, onOpenReport }: { onAction: (message: string) => void; onOpenReport: () => void }) {
  const [reportGenerated, setReportGenerated] = useState(false);

  return (
    <div className="screen-grid import-page-layout" data-route-panel="new-report">
      <section className="panel route-main-panel">
        <div className="panel-head">
          <div>
            <p>生成初始复盘</p>
            <h2>基于当前导入批次生成默认总复盘</h2>
          </div>
          <StatusBadge tone="pass">{reportGenerated ? "已生成" : "可生成"}</StatusBadge>
        </div>
        <div className="report-summary-band">
          {buildScopeMetricCards(defaultDrilldownFilter).map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
        <article className="scenario-report-body">
          <div className="scenario-report-header">
            <p>默认总复盘</p>
            <strong>服务体验整体稳定，但等待与解释问题拉低低分样本</strong>
          </div>
          <p>生成整体判断、核心指标、风险服务中心和下一步动作。</p>
        </article>
        <div className="report-blueprint-grid">
          {[
            { title: "总览结论", text: "生成整体判断、核心指标和风险摘要。" },
            { title: "风险对象", text: "定位区域、城市和服务中心。" },
            { title: "原文索引", text: "保留可追溯引用入口。" },
            { title: "下一步动作", text: "进入报告仪表盘。" },
          ].map((item, index) => (
            <article className="module-card" key={item.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
              <small>{item.text}</small>
            </article>
          ))}
        </div>
        <div className="route-action-bar">
          <div>
            <strong>生成后不会覆盖原始导入文件</strong>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setReportGenerated(true);
              onAction("初始复盘报告已生成");
              onOpenReport();
            }}
          >
            {reportGenerated ? "已生成初始复盘" : "生成初始复盘"}
          </button>
        </div>
      </section>
      <aside className="side-stack">
        <ReportGenerationChecklist />
      </aside>
    </div>
  );
}

function ReportGenerationChecklist() {
  return (
    <section className="panel report-generation-checklist">
      <div className="panel-head compact">
        <div>
          <p>生成边界</p>
          <h2>不展开原文列表</h2>
        </div>
      </div>
      <div className="report-generation-list">
        {[
          { title: "指标", text: "反馈量、评分、NPS、低分反馈。", tone: "pass" as const },
          { title: "风险对象", text: "区域、城市、服务中心和主因。", tone: "warning" as const },
          { title: "原文索引", text: "保留引用入口。", tone: "neutral" as const },
          { title: "下一步", text: "进入报告仪表盘。", tone: "pass" as const },
        ].map((item) => (
          <article className={`secondary-workspace-card ${item.tone}`} key={item.title}>
            <div>
              <strong>{item.title}</strong>
              <StatusBadge tone={item.tone}>{item.tone === "pass" ? "已确认" : item.tone === "warning" ? "需关注" : "说明"}</StatusBadge>
            </div>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ImportHistoryPage({
  onAction,
  onOpenScreen,
}: {
  onAction: (message: string) => void;
  onOpenScreen: (screen: ScreenId, secondaryId?: string, primaryId?: PrimaryNavId) => void;
}) {
  const [lastRefreshAt, setLastRefreshAt] = useState("未刷新");
  const [processingBatch, setProcessingBatch] = useState("未选择");
  const [historyRows, setHistoryRows] = useState(importHistory);
  const pendingBatchName = "补能体验活动反馈.csv";

  return (
    <div className="screen-grid import-page-layout" data-route-panel="new-history">
      <section className="panel route-main-panel">
        <div className="panel-head">
          <div>
            <p>导入历史</p>
            <h2>导入批次与处理记录</h2>
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              const refreshedAt = new Date().toLocaleTimeString("zh-CN", { hour12: false });
              setLastRefreshAt(refreshedAt);
              setHistoryRows((rows) =>
                rows.map((row) => row[0] === pendingBatchName ? [row[0], refreshedAt, "待配置", row[3]] : row),
              );
              onAction("已刷新导入历史");
            }}
          >
            刷新
          </button>
        </div>
        <div className="route-summary-grid">
          <MiniKpi label="最近刷新" value={lastRefreshAt} tone="neutral" />
          <MiniKpi label="当前处理" value={processingBatch} tone={processingBatch === "未选择" ? "warning" : "pass"} />
          <MiniKpi label="已导入批次" value="2" tone="pass" />
          <MiniKpi label="需配置批次" value="1" tone="warning" />
        </div>
        <DataTable columns={["文件", "导入时间", "状态", "行数"]} rows={historyRows} toneColumn={2} />
        <div className="route-action-bar">
          <div>
            <strong>同一项目允许多次补充导入</strong>
            <span>后续补充文件会保留批次记录，并在项目维度里合并展示。</span>
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setProcessingBatch(pendingBatchName);
              onOpenScreen("import", "new-mapping", "new-project");
              onAction(`已进入「${pendingBatchName}」字段映射`);
            }}
          >
            {processingBatch === "未选择" ? "继续处理" : "处理中"}
          </button>
        </div>
      </section>
      <aside className="side-stack">
        <ImportStatusPanel />
      </aside>
    </div>
  );
}

function ProjectsScreen({
  activeSecondaryId,
  onAction,
  onCreateProject,
  onOpenProject,
}: {
  activeSecondaryId: string;
  onAction: (message: string) => void;
  onCreateProject: () => void;
  onOpenProject: (projectId: string | null) => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeProjectChip, setActiveProjectChip] = useState("全部类型");
  const [archiveMessage, setArchiveMessage] = useState("未执行归档操作");
  const [archivedProjectIds, setArchivedProjectIds] = useState<string[]>(["april-monthly"]);
  const isArchiveView = activeSecondaryId === "projects-archive";
  const isRecentView = activeSecondaryId === "projects-recent";
  const isBatchView = activeSecondaryId === "projects-batches";
  const isDetailView = activeSecondaryId === "projects-detail";
  const routeProjects = importedProjects.filter((project, index) => {
    if (isArchiveView) return archivedProjectIds.includes(project.id);
    if (isRecentView) return index !== 1;
    return true;
  });
  const visibleProjects = routeProjects.filter((project, index) => {
    if (activeProjectChip === "售后服务") return project.type === "售后服务";
    if (activeProjectChip === "月度复盘") return project.type === "月度复盘";
    if (activeProjectChip === "活动体验") return project.type === "活动体验";
    if (activeProjectChip === "待配置优先") return project.id === "energy-event";
    if (activeProjectChip === "最近打开") return index === 0;
    if (activeProjectChip === "最近导入") return index <= 1;
    if (activeProjectChip === "已归档") return archivedProjectIds.includes(project.id);
    return true;
  });
  const projectRows = importedProjects.map((project, index) => [
    project.name,
    project.type,
    project.dateRange,
    project.count,
    archivedProjectIds.includes(project.id) ? "已归档" : index === 2 ? "需配置" : "已导入",
    archivedProjectIds.includes(project.id) ? "月报已归档" : index === 0 ? "总复盘已生成" : "等待字段确认",
  ]);
  const selectedProject = selectedProjectId
    ? importedProjects.find((project) => project.id === selectedProjectId) ?? null
    : null;
  const detailProject = selectedProject ?? visibleProjects[0] ?? routeProjects[0] ?? importedProjects[0];
  const projectViewTitle = getProjectPanelTitle(activeSecondaryId);
  const projectViewDescription = getProjectPanelDescription(activeSecondaryId, detailProject);

  useEffect(() => {
    setSelectedProjectId(null);
    setActiveProjectChip(getDefaultProjectChip(activeSecondaryId));
  }, [activeSecondaryId]);

  const toggleArchiveForProject = (project: ImportedProject) => {
    if (archivedProjectIds.includes(project.id)) {
      setArchivedProjectIds((current) => current.filter((id) => id !== project.id));
      setArchiveMessage(`已恢复：${project.name}`);
      onAction(`已恢复「${project.name}」`);
      return;
    }
    setArchivedProjectIds((current) => [...current, project.id]);
    setArchiveMessage(`已归档：${project.name}`);
    onAction(`已归档「${project.name}」`);
  };

  const toggleProject = (project: ImportedProject) => {
    if (selectedProjectId === project.id) {
      setSelectedProjectId(null);
      onAction(`已取消「${project.name}」选择，当前查看全部项目`);
      return;
    }
    setSelectedProjectId(project.id);
    onAction(`已选择「${project.name}」，可打开仪表盘或继续查看项目详情`);
  };

  return (
    <div className="screen-grid projects-layout" data-route-panel={activeSecondaryId}>
      <section className="panel projects-main-panel">
        <div className="panel-head">
          <div>
            <p>{secondaryPanelCopy[activeSecondaryId]?.title ?? "全部项目"}</p>
            <h2>{projectViewTitle}</h2>
            <span>{projectViewDescription}</span>
          </div>
          <button className="primary-button" type="button" onClick={onCreateProject}>
            <PlusCircle size={15} />
            新建项目
          </button>
        </div>
        <div className="project-summary-grid">
          <MiniKpi label="项目总数" value={String(importedProjects.length)} tone="pass" />
          <MiniKpi label="累计反馈" value={totalProjectCount(importedProjects)} tone="neutral" />
          <MiniKpi label="已生成报告" value="2" tone="pass" />
          <MiniKpi label="待配置" value="1" tone="warning" />
        </div>
        {isBatchView ? (
          <DataTable columns={["文件", "导入时间", "状态", "行数"]} rows={importHistory} toneColumn={2} />
        ) : isDetailView ? (
          <ProjectDetailView
            project={detailProject}
            selected={Boolean(selectedProject)}
            onAction={onAction}
            onOpen={() => onOpenProject(detailProject.id)}
            isArchived={archivedProjectIds.includes(detailProject.id)}
            onArchive={() => toggleArchiveForProject(detailProject)}
          />
        ) : (
          <>
            <ProjectFilterToolbar
              activeSecondaryId={activeSecondaryId}
              activeChip={activeProjectChip}
              onSelect={(chip) => {
                setActiveProjectChip(chip);
                onAction(`已应用「${chip}」项目筛选`);
              }}
            />
            <DataTable
              columns={["项目", "类型", "时间范围", "反馈量", "状态", "最近结果"]}
              rows={projectRows.filter((row) => visibleProjects.some((project) => project.name === row[0]))}
              toneColumn={4}
              selectedKey={
                selectedProject
                  ? projectRows.find((row) => row[0] === selectedProject.name)?.join("-")
                  : undefined
              }
              onRowClick={(row) => {
                const project = importedProjects.find((item) => item.name === row[0]);
                if (project) toggleProject(project);
              }}
            />
          </>
        )}
        <div className="project-action-strip">
          <strong>{selectedProject ? selectedProject.name : "全部项目"}</strong>
          <span>
            {selectedProject
              ? `${selectedProject.type} / ${selectedProject.dateRange} / ${selectedProject.count} 条反馈`
              : "未限定具体项目，默认展示所有已导入项目。"}
          </span>
          <div className="project-action-buttons">
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                if (!selectedProject) {
                  onAction("请先在项目列表中选择要归档的项目");
                  return;
                }
                toggleArchiveForProject(selectedProject);
              }}
            >
              {selectedProject && archivedProjectIds.includes(selectedProject.id) ? "恢复归档" : "归档所选项目"}
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                onOpenProject(selectedProject?.id ?? null);
              }}
            >
              打开报告仪表盘
            </button>
          </div>
          <small>{archiveMessage}</small>
        </div>
      </section>
      <aside className="side-stack">
        <section className="panel">
          <div className="panel-head compact">
            <div>
              <p>{isArchiveView ? "归档项目" : isBatchView ? "批次项目" : "项目选择"}</p>
              <h2>{selectedProject ? "已选项目" : "可点击选择或反选"}</h2>
            </div>
          </div>
          <div className="project-card-list">
            {visibleProjects.map((project) => (
              <button
                className={project.id === selectedProjectId ? "active" : ""}
                key={project.id}
                type="button"
                onClick={() => toggleProject(project)}
              >
                <strong>{project.name}</strong>
                <span>{project.dateRange}</span>
                <small>{project.count} 条反馈 · {project.type}</small>
              </button>
            ))}
          </div>
        </section>
        {isBatchView ? <HistoryPanel /> : <ProjectDetailAside project={detailProject} selected={Boolean(selectedProject)} />}
      </aside>
    </div>
  );
}

function getDefaultProjectChip(activeSecondaryId: string): string {
  if (activeSecondaryId === "projects-archive") return "已归档";
  if (activeSecondaryId === "projects-recent") return "最近打开";
  return "全部类型";
}

function getProjectPanelTitle(activeSecondaryId: string): string {
  if (activeSecondaryId === "projects-recent") return "最近打开与最近导入";
  if (activeSecondaryId === "projects-detail") return "项目详情、范围和报告状态";
  if (activeSecondaryId === "projects-batches") return "导入批次和文件记录";
  if (activeSecondaryId === "projects-archive") return "归档项目与恢复入口";
  return "过往项目与分析状态";
}

function getProjectPanelDescription(activeSecondaryId: string, project: ImportedProject): string {
  if (activeSecondaryId === "projects-recent") return "最近打开 / 最近导入";
  if (activeSecondaryId === "projects-detail") return `当前详情对象：${project.name} / ${project.type} / ${project.dateRange}`;
  if (activeSecondaryId === "projects-batches") return "导入时间 / 状态 / 样本行数";
  if (activeSecondaryId === "projects-archive") return "已归档项目";
  return "全部已导入项目";
}

function ProjectFilterToolbar({
  activeSecondaryId,
  activeChip,
  onSelect,
}: {
  activeSecondaryId: string;
  activeChip: string;
  onSelect: (chip: string) => void;
}) {
  const chips = activeSecondaryId === "projects-archive"
    ? ["已归档"]
    : activeSecondaryId === "projects-recent"
      ? ["最近打开", "最近导入", "待配置优先"]
      : ["全部类型", "售后服务", "月度复盘", "活动体验"];

  return (
    <div className="project-filter-toolbar" aria-label="项目筛选">
      <div>
        <strong>{activeSecondaryId === "projects-recent" ? "最近项目筛选" : activeSecondaryId === "projects-archive" ? "归档项目筛选" : "全部项目筛选"}</strong>
      </div>
      <div>
        {chips.map((chip) => (
          <button className={activeChip === chip ? "active" : ""} key={chip} type="button" onClick={() => onSelect(chip)}>
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProjectDetailView({
  project,
  selected,
  onAction,
  onOpen,
  isArchived,
  onArchive,
}: {
  project: ImportedProject;
  selected: boolean;
  onAction: (message: string) => void;
  onOpen: () => void;
  isArchived: boolean;
  onArchive: () => void;
}) {
  const [detailMode, setDetailMode] = useState("项目概览");
  const reportRows = [
    ["总复盘报告", project.dateRange, project.id === "energy-event" ? "待生成" : "已生成", project.id === "energy-event" ? "字段配置后生成" : "可继续查看"],
    ["服务问题闭环", project.dateRange, project.id === "energy-event" ? "待生成" : "已生成", project.id === "energy-event" ? "缺少评分字段" : "等待与解释问题"],
    ["满意度归因", project.dateRange, project.id === "energy-event" ? "待生成" : "已生成", project.id === "energy-event" ? "缺少 NPS 字段" : "评分与低分原因"],
  ];
  const batchRows = project.id === "may-service"
    ? [
        ["五一售后服务专项_2026-05.csv", "2026-06-01 09:32", "已导入", "1,240"],
        ["五一售后服务补充样本.csv", "2026-06-02 10:18", "已导入", "386"],
      ]
    : project.id === "energy-event"
      ? [["补能体验活动反馈.csv", "2026-05-30 11:42", "需配置", "328"]]
      : [["四月售后月报_2026-04.csv", "2026-05-03 14:20", "已导入", "1,086"]];
  const detailBody = detailMode === "报告输出记录" ? (
    <div className="project-detail-subsection">
      <strong>报告输出记录</strong>
      <DataTable columns={["报告", "范围", "状态", "摘要"]} rows={reportRows} toneColumn={2} />
    </div>
  ) : detailMode === "导入批次" ? (
    <div className="project-detail-subsection">
      <strong>导入批次</strong>
      <DataTable columns={["文件", "导入时间", "状态", "行数"]} rows={batchRows} toneColumn={2} />
    </div>
  ) : null;

  return (
    <div className="project-detail-view">
      <article>
        <span>{selected ? "已选中项目" : "默认详情对象"} / 当前查看：{detailMode}</span>
        <h3>{project.name}</h3>
        <p>{project.type} / {project.dateRange} / {project.count} 条反馈</p>
      </article>
      <dl>
        <div><dt>覆盖区域</dt><dd>7 个区域 / 42 个服务中心</dd></div>
        <div><dt>导入批次</dt><dd>{project.id === "may-service" ? "2 个批次" : "1 个批次"}</dd></div>
        <div><dt>报告状态</dt><dd>{project.id === "energy-event" ? "字段待配置" : "总复盘已生成"}</dd></div>
        <div><dt>最近更新</dt><dd>{project.id === "may-service" ? "2026-06-01 09:32" : "2026-05-28 17:45"}</dd></div>
      </dl>
      {detailBody}
      <div className="project-detail-actions">
        <button className="primary-button" type="button" onClick={onOpen}>打开该项目仪表盘</button>
        <button
          className={detailMode === "报告输出记录" ? "ghost-button active" : "ghost-button"}
          type="button"
          onClick={() => {
            setDetailMode("报告输出记录");
            onAction(`已打开「${project.name}」的报告输出记录`);
          }}
        >
          查看报告输出
        </button>
        <button
          className={detailMode === "导入批次" ? "ghost-button active" : "ghost-button"}
          type="button"
          onClick={() => {
            setDetailMode("导入批次");
            onAction(`已打开「${project.name}」的导入批次`);
          }}
        >
          查看导入批次
        </button>
        <button
          className={isArchived ? "ghost-button active" : "ghost-button"}
          type="button"
          onClick={() => {
            setDetailMode(isArchived ? "已恢复" : "已归档");
            onArchive();
          }}
        >
          {isArchived ? "恢复归档" : "归档项目"}
        </button>
      </div>
    </div>
  );
}

function ProjectDetailAside({ project, selected }: { project: ImportedProject; selected: boolean }) {
  return (
    <section className="panel project-detail-aside">
      <div className="panel-head compact">
        <div>
          <p>右侧详情</p>
          <h2>{selected ? "当前选中项目" : "未限定具体项目"}</h2>
        </div>
      </div>
      <div className="path-list">
        <p><span>项目</span><strong>{selected ? project.name : "全部项目"}</strong></p>
        <p><span>类型</span><strong>{selected ? project.type : "全部类型"}</strong></p>
        <p><span>时间</span><strong>{selected ? project.dateRange : "按项目列表选择"}</strong></p>
        <p><span>样本</span><strong>{selected ? `${project.count} 条反馈` : `${totalProjectCount(importedProjects)} 条反馈`}</strong></p>
      </div>
    </section>
  );
}

function getDashboardPanelTitle(activeSecondaryId: string): string {
  if (activeSecondaryId === "dashboard-scope") return "时间、项目、区域与主题";
  if (activeSecondaryId === "dashboard-topic") return "问题主题";
  return "当前范围总览";
}

function getDashboardRouteConfig(activeSecondaryId: string): {
  className: string;
  title: string;
  subtitle: string;
  resultTitle: string;
  resultHeading: string;
  resultText: string;
} {
  if (activeSecondaryId === "dashboard-scope") {
    return {
      className: "dashboard-scope-route",
      title: "筛选范围",
      subtitle: "时间、项目、区域同级筛选",
      resultTitle: "筛选范围结果",
      resultHeading: "指标与服务中心",
      resultText: "下游操作使用本页范围",
    };
  }
  if (activeSecondaryId === "dashboard-topic") {
    return {
      className: "dashboard-topic-route",
      title: "问题主题",
      subtitle: "按主题定位问题样本",
      resultTitle: "主题风险结果",
      resultHeading: "主题命中服务中心",
      resultText: "表格随主题选择更新",
    };
  }
  return {
    className: "dashboard-overview-route",
    title: "总览",
    subtitle: "核心指标、风险对象和处理入口",
    resultTitle: "总览结果",
    resultHeading: "指标与风险对象",
    resultText: "未筛选时展示全部数据",
  };
}

function getProfilePanelTitle(activeSecondaryId: string): string {
  if (activeSecondaryId === "profile-account") return "账号状态与权限审批";
  if (activeSecondaryId === "profile-privacy") return "隐私设置与数据清理";
  if (activeSecondaryId === "profile-data") return "数据权限与授权范围";
  return "个人设置与默认偏好";
}

function DrilldownScreen({
  activeSecondaryId,
  initialFilter,
  onAction,
  onApplyFilter,
  onNavigate,
  onOpenFilteredQa,
  onOpenInlineQa,
}: {
  activeSecondaryId: string;
  initialFilter: DrilldownFilter;
  onAction: (message: string) => void;
  onApplyFilter: (filter: DrilldownFilter) => void;
  onNavigate: (screen: ScreenId) => void;
  onOpenFilteredQa: (filter: DrilldownFilter) => void;
  onOpenInlineQa: (filter: DrilldownFilter, question: string) => void;
}) {
  const [filterState, setFilterState] = useState<DrilldownFilter>(initialFilter);
  const [inlineQaOpen, setInlineQaOpen] = useState(false);
  const [inlineQuestion, setInlineQuestion] = useState("");
  const [selectionAi, setSelectionAi] = useState<{ x: number; y: number; text: string } | null>(null);
  const [rawFeedbackOpen, setRawFeedbackOpen] = useState(false);
  const [workOrderDraft, setWorkOrderDraft] = useState<WorkOrderDraft | null>(null);
  const filteredRows = filterDrilldownRows(filterState);
  const riskRows = filteredRows.filter((row) => row[5] !== "低");
  const scopeMetrics = buildScopeMetricCards(filterState, filteredRows);
  const availableCities = getCitiesByRegions(filterState.selectedRegions);
  const availableCenters = getCentersByCities(filterState.selectedRegions, filterState.selectedCities);
  const dashboardRoute = getDashboardRouteConfig(activeSecondaryId);
  const showInlineScopeSummary = activeSecondaryId !== "dashboard-overview";
  const hasSelectedDashboardData = filterState.selectedRegions.length > 0
    || filterState.selectedCities.length > 0
    || filterState.selectedCenters.length > 0
    || filterState.selectedProjectIds.length > 0
    || filterState.selectedTopics.length > 0;

  useEffect(() => {
    setFilterState(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    setRawFeedbackOpen(false);
  }, [activeSecondaryId]);

  const updateFilter = (
    nextFilter: DrilldownFilter,
    _message?: string,
  ) => {
    setFilterState(nextFilter);
    onApplyFilter(nextFilter);
  };

  const updateRegion = (region: string) => {
    const nextRegions = filterState.selectedRegions.includes(region)
      ? filterState.selectedRegions.filter((item) => item !== region)
      : [...filterState.selectedRegions, region];
    const nextCities = filterState.selectedCities.filter((city) => cityBelongsToRegions(city, nextRegions));
    const nextCenters = filterState.selectedCenters.filter((center) => centerBelongsToCities(center, nextRegions, nextCities));
    updateFilter(
      { ...filterState, selectedRegions: nextRegions, selectedCities: nextCities, selectedCenters: nextCenters },
      nextRegions.includes(region) ? `已选择区域「${region}」` : `已取消区域「${region}」`,
    );
  };

  const updateCity = (city: string) => {
    const nextCities = filterState.selectedCities.includes(city)
      ? filterState.selectedCities.filter((item) => item !== city)
      : [...filterState.selectedCities, city];
    const nextCenters = filterState.selectedCenters.filter((center) => centerBelongsToCities(center, filterState.selectedRegions, nextCities));
    updateFilter(
      { ...filterState, selectedCities: nextCities, selectedCenters: nextCenters },
      nextCities.includes(city) ? `已选择城市「${city}」` : `已取消城市「${city}」`,
    );
  };

  const toggleSelection = (field: keyof Pick<
    DrilldownFilter,
    "selectedProjectIds" | "selectedRegions" | "selectedCities" | "selectedCenters" | "selectedTopics"
  >, label: string, value: string, displayValue = value) => {
    const current = filterState[field];
    const nextValues = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    updateFilter(
      { ...filterState, [field]: nextValues },
      nextValues.includes(value) ? `已选择${label}「${displayValue}」` : `已取消${label}「${displayValue}」`,
    );
  };

  const selectCenter = (row: string[]) => {
    toggleSelection("selectedCenters", "服务中心", row[2]);
  };

  const selectTimeRange = (value: string) => {
    const nextPeriod = defaultTimePeriodValues[value] ?? "";
    const nextCustomStart = value === "自定义" ? filterState.customStartDate : defaultDrilldownFilter.customStartDate;
    const nextCustomEnd = value === "自定义" ? filterState.customEndDate : defaultDrilldownFilter.customEndDate;
    updateFilter(
      {
        ...filterState,
        timeRange: value,
        timePeriod: value === "自定义" ? "" : nextPeriod,
        customStartDate: nextCustomStart,
        customEndDate: nextCustomEnd,
        customTimeRange: value === "自定义" ? `${nextCustomStart} 至 ${nextCustomEnd}` : defaultDrilldownFilter.customTimeRange,
      },
      value === "自定义" ? "已打开自定义时间段" : `已切换时间粒度为「${value}」`,
    );
  };

  const selectTimePeriod = (value: string) => {
    updateFilter({ ...filterState, timePeriod: value }, `已选择时间范围「${formatTimeRange(filterState.timeRange, filterState.customTimeRange, value)}」`);
  };

  const updateCustomDate = (field: "customStartDate" | "customEndDate", value: string) => {
    const nextFilter = {
      ...filterState,
      [field]: value,
    };
    const nextRange = `${field === "customStartDate" ? value : nextFilter.customStartDate} 至 ${field === "customEndDate" ? value : nextFilter.customEndDate}`;
    updateFilter({ ...nextFilter, customTimeRange: nextRange }, `已设置自定义时间段为「${nextRange}」`);
  };

  const goReport = () => {
    onApplyFilter(filterState);
    onNavigate("report");
    onAction(`已按「${buildDrilldownScope(filterState)}」生成报告范围`);
  };

  const goQa = () => {
    onOpenFilteredQa(filterState);
    onAction(`已带入「${buildDrilldownScope(filterState)}」，进入 AI 问答`);
  };

  const createWorkOrder = () => {
    if (filterState.selectedCenters.length === 0 || filterState.selectedTopics.length === 0) {
      onAction("请先选择服务中心和问题主题");
      return;
    }
    const targetRow = riskRows[0] ?? filteredRows[0];
    if (!targetRow) {
      onAction("当前筛选范围没有可生成工单的服务中心");
      return;
    }
    const draft = buildServiceCenterWorkOrderDraft(targetRow, buildDrilldownScope(filterState));
    setWorkOrderDraft(draft);
    setRawFeedbackOpen(true);
    onAction(`已生成「${draft.serviceCenter}」服务中心处理工单草稿`);
  };

  const submitInlineQa = () => {
    const trimmed = inlineQuestion.trim();
    if (!trimmed) {
      onAction("请输入要提交给 AI 的问题");
      return;
    }
    onOpenInlineQa(filterState, trimmed);
    setInlineQuestion("");
    setInlineQaOpen(false);
  };

  const captureSelectionForQa = (event: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? "";
    if (!selectedText || selectedText.length < 2) {
      setSelectionAi(null);
      return;
    }
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const rect = range?.getBoundingClientRect();
    const ancestor = range?.commonAncestorContainer;
    if (!rect || !ancestor || !event.currentTarget.contains(ancestor)) {
      setSelectionAi(null);
      return;
    }
    setSelectionAi({
      x: Math.min(rect.right + 10, window.innerWidth - 180),
      y: Math.max(rect.top - 4, 76),
      text: selectedText.slice(0, 120),
    });
  };

  const openSelectionQa = () => {
    if (!selectionAi) return;
    setInlineQuestion(`请解释这段数据或文字：${selectionAi.text}`);
    setInlineQaOpen(true);
    setSelectionAi(null);
    onAction("已基于选中内容打开轻量 AI 问答输入框");
  };

  const renderFilterControls = () => (
    <>
      <div className="filter-cluster time-filter-cluster">
        <FilterGroup
          title="时间粒度"
          options={["全部时间", "日", "周", "月", "季度", "年", "自定义"]}
          active={filterState.timeRange}
          onSelect={selectTimeRange}
        />
        <TimePeriodSelector
          filterState={filterState}
          onPeriodValueChange={selectTimePeriod}
          onCustomDateChange={updateCustomDate}
        />
      </div>
      <MultiSelectGroup
        title="项目范围"
        variant="project"
        emptyLabel="全部项目"
        items={importedProjects.map((project) => ({
          id: project.id,
          title: project.name,
          meta: `${project.type} · ${project.dateRange}`,
          value: `${project.count} 条反馈`,
        }))}
        selectedIds={filterState.selectedProjectIds}
        onToggle={(projectId) => toggleSelection(
          "selectedProjectIds",
          "项目",
          projectId,
          importedProjects.find((project) => project.id === projectId)?.name ?? projectId,
        )}
        onClear={() => {
          updateFilter({ ...filterState, selectedProjectIds: [] }, "已恢复为全部项目");
        }}
      />
      <div className="filter-cluster location-filter-cluster">
        <MultiSelectGroup
          title="区域"
          variant="compact"
          emptyLabel="全国"
          items={uniqueColumn(drilldownRows, 0).map((region) => ({
            id: region,
            title: region,
            meta: `${drilldownRows.filter((row) => row[0] === region).length} 个服务中心`,
          }))}
          selectedIds={filterState.selectedRegions}
          onToggle={updateRegion}
          onClear={() => {
            updateFilter({ ...filterState, selectedRegions: [], selectedCities: [], selectedCenters: [] }, "已恢复为全国区域");
          }}
        />
        <MultiSelectGroup
          title="城市"
          variant="compact"
          emptyLabel={filterState.selectedRegions.length ? "全部城市" : "先选区域"}
          disabled={filterState.selectedRegions.length === 0}
          items={availableCities.map((city) => ({
            id: city,
            title: city,
            meta: `${drilldownRows.filter((row) => row[1] === city).map((row) => row[2]).join("、")}`,
          }))}
          selectedIds={filterState.selectedCities}
          onToggle={updateCity}
          onClear={() => {
            updateFilter({ ...filterState, selectedCities: [], selectedCenters: [] }, "已恢复为全部城市");
          }}
        />
        <MultiSelectGroup
          title="服务中心"
          variant="center"
          emptyLabel={filterState.selectedCities.length ? "全部服务中心" : "先选城市"}
          disabled={filterState.selectedCities.length === 0}
          items={availableCenters.map((row) => ({
            id: row[2],
            title: row[2],
            meta: `${row[0]} / ${row[1]} / ${row[3]} 条 / 风险 ${row[5]}`,
          }))}
          selectedIds={filterState.selectedCenters}
          onToggle={(center) => toggleSelection("selectedCenters", "服务中心", center)}
          onClear={() => {
            updateFilter({ ...filterState, selectedCenters: [] }, "已恢复为全部服务中心");
          }}
        />
      </div>
    </>
  );

  const renderTopicFilterControls = () => (
    <MultiSelectGroup
      title="问题主题"
      variant="topic"
      emptyLabel="全部主题"
      items={topicOptions.map((topic) => ({
        id: topic.id,
        title: topic.title,
        meta: topic.meta,
        value: topic.tone === "risk" ? "高风险" : topic.tone === "warning" ? "需关注" : "正向样本",
      }))}
      selectedIds={filterState.selectedTopics}
      onToggle={(topic) => toggleSelection("selectedTopics", "主题", topic)}
      onClear={() => {
        updateFilter({ ...filterState, selectedTopics: [] }, "已恢复为全部主题");
      }}
    />
  );

  const renderScopePanelContent = () => {
    if (activeSecondaryId === "dashboard-scope") {
      return (
        <div className="filter-groups parallel-filter-groups">
          {renderFilterControls()}
        </div>
      );
    }

    if (activeSecondaryId === "dashboard-topic") {
      return (
        <div className="filter-groups topic-only-filter-groups">
          {renderTopicFilterControls()}
        </div>
      );
    }

    return (
      <div className="overview-scope-grid">
        <CurrentScopeCard filterState={filterState} filteredRows={filteredRows} riskRows={riskRows} />
        <MiniKpi label="样本量" value={`${getCurrentScopeRawFeedbackTotal(filterState, filteredRows).toLocaleString()} 条`} tone="neutral" />
        <MiniKpi label="风险对象" value={`${riskRows.length} 个`} tone={riskRows.length ? "warning" : "pass"} />
        <MiniKpi label="服务中心" value={`${filteredRows.length} 个`} tone="neutral" />
      </div>
    );
  };

  const renderResultContent = () => {
    if (activeSecondaryId === "dashboard-topic") {
      return (
        <DataTable
          columns={["区域", "城市", "服务中心", "反馈量", "评分", "风险", "主因"]}
          rows={filteredRows}
          toneColumn={5}
          selectedKeys={filterState.selectedCenters.map((center) => drilldownRows.find((row) => row[2] === center)?.join("-") ?? center)}
          onRowClick={selectCenter}
        />
      );
    }

    return (
      <>
        <div className="metric-grid">
          {scopeMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
        <DataTable
          columns={["区域", "城市", "服务中心", "反馈量", "评分", "风险", "主因"]}
          rows={filteredRows}
          toneColumn={5}
          selectedKeys={filterState.selectedCenters.map((center) => drilldownRows.find((row) => row[2] === center)?.join("-") ?? center)}
          onRowClick={selectCenter}
        />
      </>
    );
  };

  return (
    <div
      className={`screen-grid drilldown-layout ${workOrderDraft ? "has-drilldown-side" : "no-drilldown-side"} ${dashboardRoute.className}`}
      data-route-panel={activeSecondaryId}
      onMouseUp={captureSelectionForQa}
    >
      <section className="panel filter-panel horizontal-filter-panel">
        <div className="panel-head">
          <div>
            <p>{dashboardRoute.title}</p>
            <h2>{getDashboardPanelTitle(activeSecondaryId)}</h2>
          </div>
          <Filter size={18} />
        </div>
        <div className="route-intro">
          <strong>{dashboardRoute.subtitle}</strong>
          {showInlineScopeSummary ? <span>{buildDrilldownScope(filterState)}</span> : null}
        </div>
        {renderScopePanelContent()}
      </section>
      <section className="panel metric-panel drilldown-results-panel">
        <div className="panel-head">
          <div>
            <p>{dashboardRoute.resultTitle}</p>
            <h2>{dashboardRoute.resultHeading}</h2>
            <span>{dashboardRoute.resultText}</span>
          </div>
          <StatusBadge tone={riskRows.length ? "warning" : "pass"}>{riskRows.length} 个风险对象</StatusBadge>
        </div>
        {renderResultContent()}
        <DashboardActionBar
          filteredRows={filteredRows}
          rawFeedbackOpen={rawFeedbackOpen}
          canCreateWorkOrder={filterState.selectedCenters.length > 0 && filterState.selectedTopics.length > 0}
          showWorkOrderAction={activeSecondaryId !== "dashboard-overview"}
          onToggleRawFeedback={() => setRawFeedbackOpen((value) => !value)}
          onGoReport={goReport}
          onGoQa={goQa}
          onCreateWorkOrder={createWorkOrder}
        />
        {rawFeedbackOpen ? (
          <EvidenceList compact filterState={filterState} filteredRows={filteredRows} />
        ) : null}
      </section>
      {workOrderDraft ? (
        <aside className="side-stack drilldown-side">
          <WorkOrderDraftCard draft={workOrderDraft} onAction={onAction} />
        </aside>
      ) : null}
      {selectionAi ? (
        <button
          className="selection-ai-popover"
          style={{ left: selectionAi.x, top: selectionAi.y }}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={openSelectionQa}
        >
          <MessageSquareText size={15} />
          AI 问答
        </button>
      ) : null}
      {inlineQaOpen ? (
        <div className="anchored-ai-entry selection-ai-entry">
          <div className="anchored-ai-panel">
            <div>
              <strong>向 AI 提问</strong>
              <span>{hasSelectedDashboardData ? buildDrilldownScope(filterState) : "未限定筛选范围，将围绕选中内容和当前仪表盘提问"}</span>
            </div>
            <textarea
              aria-label="仪表盘 AI 问答输入"
              placeholder="围绕当前选中的数据范围提问"
              value={inlineQuestion}
              onChange={(event) => setInlineQuestion(event.target.value)}
            />
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={() => setInlineQaOpen(false)}>取消</button>
              <button className="primary-button" type="button" onClick={submitInlineQa}>
                <Send size={15} />
                发送并进入问答
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReportScreen({ activeSecondaryId, appliedFilter, onAction }: { activeSecondaryId: string; appliedFilter: DrilldownFilter; onAction: (message: string) => void }) {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const selectedReport = selectedScenario ? scenarioReports[selectedScenario] : null;
  const effectiveReportFilter = buildReportFilter(appliedFilter, selectedScenario);
  const filterScope = buildDrilldownScope(effectiveReportFilter);
  const reportRows = filterDrilldownRows(effectiveReportFilter);
  const reportRiskRows = reportRows.filter((row) => row[5] !== "低");
  const reportMetrics = buildScopeMetricCards(effectiveReportFilter, reportRows);
  const reportTotal = getCurrentScopeRawFeedbackTotal(effectiveReportFilter, reportRows);
  const reportTitle = selectedScenario ?? "总复盘";
  const reportHeadline = selectedReport?.headline ?? "服务体验整体稳定，等待与解释问题拉低低分样本";
  const reportSummary = selectedReport?.summary ?? "本期总复盘汇总整体样本、核心指标、重点风险对象和可执行动作。";
  const buildReportText = () => [
    `# ${reportTitle}`,
    "",
    `范围：${filterScope}`,
    reportHeadline,
    "",
    reportSummary,
    "",
    "## 重点对象",
    ...reportRows.map((row) => `- ${row[0]} / ${row[1]} / ${row[2]}：反馈 ${row[3]}，评分 ${row[4]}，风险 ${row[5]}，主因 ${row[6]}`),
  ].join("\n");
  const copyReport = () => {
    const writePromise = navigator.clipboard?.writeText(buildReportText());
    if (writePromise) void writePromise.catch(() => undefined);
    onAction(`已复制「${reportTitle}」报告正文`);
  };
  const exportCurrentReport = () => {
    const blob = new Blob([buildReportText()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportTitle}-售后复盘.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    onAction(`已导出「${reportTitle}」报告文件`);
  };

  return (
    <div className="screen-grid report-layout" data-route-panel={activeSecondaryId} data-report-scenario={reportTitle}>
      <section className="panel report-panel">
        <div className="report-topline">
          <div className="report-title-block">
            <p>总复盘报告</p>
            <h2>{filterScope}：服务体验稳定，但重点风险需要继续闭环</h2>
            <span>{reportRows.length} 个服务中心 / {reportRiskRows.length} 个风险对象 / 当前视图：{reportTitle}</span>
          </div>
          <div className="button-row">
            <button className="ghost-button" type="button" onClick={copyReport}>
              <Copy size={15} />
              复制报告
            </button>
            <button className="primary-button" type="button" onClick={exportCurrentReport}>
              <Download size={15} />
              导出
            </button>
          </div>
        </div>
        <div className="report-summary-band">
          {reportMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
        <article className="scenario-report-body">
          <div className="scenario-report-header">
            <p>{selectedScenario ? "当前专项报告" : "当前总复盘"}</p>
            <h3>{reportTitle}</h3>
            <strong>{reportHeadline}</strong>
          </div>
          <p>{reportSummary}</p>
          <ul>
            {(selectedReport?.bullets ?? [`当前范围命中 ${reportTotal.toLocaleString()} 条反馈，覆盖 ${reportRows.length} 个服务中心。`, "低分反馈集中在等待时间、解释不清和预约同步异常。", "建议先从风险服务中心和可回访低分样本开始闭环。"]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <div className="module-grid">
          {(selectedReport?.modules ?? [
            { title: "整体判断", text: "服务体验稳定，但等待和解释问题影响低分样本。" },
            { title: "核心指标", text: "反馈量、评分、NPS 和低分反馈构成总复盘框架。" },
            { title: "风险对象", text: "杭州西溪、成都高新、北京望京进入重点跟踪。" },
            { title: "下一步动作", text: "进入专项报告或导出可执行闭环清单。" },
          ]).map((module, index) => (
            <article className="module-card" key={module.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{module.title}</strong>
              <small>{module.text}</small>
            </article>
          ))}
        </div>
        <EvidenceList
          compact
          filterState={effectiveReportFilter}
          filteredRows={reportRows}
          label="报告引用证据"
          heading="按当前范围分页"
        />
      </section>
      <aside className="side-stack report-side">
        <section className="panel">
          <div className="panel-head compact">
            <div>
              <p>专项切换</p>
              <h2>{reportTitle}</h2>
            </div>
          </div>
          <div className="scenario-preview">
            <strong>{selectedScenario ? `${selectedScenario}已生成` : "当前为总复盘"}</strong>
            <span>{reportHeadline}</span>
          </div>
          <div className="scenario-list">
            {scenarioOutputs.map((scenario) => (
              <button
                className={scenario === selectedScenario ? "active" : ""}
                key={scenario}
                type="button"
                onClick={() => {
                  const nextScenario = scenario === selectedScenario ? null : scenario;
                  setSelectedScenario(nextScenario);
                  onAction(nextScenario ? `已切换到「${scenario}」，报告正文和右侧内容已更新` : "已取消专项选择，回到总复盘报告");
                }}
              >
                <span>{scenario}</span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function AiQaScreen({
  appliedFilter,
  initialScopeMode,
  initialQuestion,
  onPendingQuestionHandled,
  onAction,
  activeSecondaryId,
}: {
  appliedFilter: DrilldownFilter;
  initialScopeMode: QaScopeMode;
  initialQuestion: string;
  onPendingQuestionHandled: () => void;
  onAction: (message: string) => void;
  activeSecondaryId: string;
}) {
  const initialMessages = useMemo<QaMessage[]>(
    () => (initialQuestion ? [{ id: "dashboard-user", role: "user", text: initialQuestion }] : []),
    [initialQuestion],
  );
  const initialScopeSnapshot = useMemo(
    () => buildQaScopeSnapshot(initialScopeMode, appliedFilter, null),
    [initialScopeMode, appliedFilter],
  );
  const draftConversationIdRef = useRef<string | null>(initialQuestion ? "dashboard-new" : null);
  const handledInitialQuestionRef = useRef("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [contextProjectId, setContextProjectId] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<QaScopeMode>(initialScopeMode);
  const [favoriteThreadIds, setFavoriteThreadIds] = useState<string[]>([]);
  const [conversationThreads, setConversationThreads] = useState<QaThread[]>(() => {
    if (!initialQuestion) return queryThreads;
    return [
      {
        id: "dashboard-new",
        title: buildAutoConversationTitle(initialQuestion),
        meta: "1 轮问答 / 来自仪表盘范围",
        turns: initialMessages,
        scopeSnapshot: initialScopeSnapshot,
      },
      ...queryThreads,
    ];
  });
  const [answerSaved, setAnswerSaved] = useState(Boolean(initialQuestion));
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [activeMessages, setActiveMessages] = useState<QaMessage[]>(initialMessages);
  const [activeEvidenceQuotes, setActiveEvidenceQuotes] = useState<DomainEvidenceQuote[]>([]);
  const [agentProgressStage, setAgentProgressStage] = useState<AgentRunStage | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [sourceReasoningContent, setSourceReasoningContent] = useState("");
  const selectedThreadForView = selectedThreadId
    ? conversationThreads.find((thread) => thread.id === selectedThreadId) ?? null
    : null;
  const visibleThreads = conversationThreads;
  const selectedThread = selectedThreadId
    ? selectedThreadForView
    : null;
  const activeScopeSnapshot = useMemo(
    () => selectedThreadForView
      ? selectedThreadForView.scopeSnapshot ?? buildQaScopeSnapshot("free", defaultDrilldownFilter, null)
      : buildQaScopeSnapshot(scopeMode, appliedFilter, contextProjectId),
    [selectedThreadForView, scopeMode, appliedFilter, contextProjectId],
  );
  const activeContextProject = getQaProjectById(activeScopeSnapshot.contextProjectId);
  const entryScope = selectedThreadForView
    ? `本对话范围：${activeScopeSnapshot.label}`
    : activeScopeSnapshot.mode === "filtered"
      ? `本对话使用仪表盘范围：${activeScopeSnapshot.label}`
      : "自由新对话";
  const contextLabel = activeContextProject
    ? `参考项目：${activeContextProject.name}`
      : selectedThreadForView
      ? selectedThreadForView.title
      : entryScope;
  const activeRecords = useMemo(() => buildQaAgentRecords(activeScopeSnapshot.filter, activeContextProject), [activeScopeSnapshot, activeContextProject]);
  const activeMetrics = useMemo(() => buildMetricSummary(activeRecords), [activeRecords]);
  const activeFindings = useMemo(() => buildFindingsForScenario(activeRecords, "服务问题闭环"), [activeRecords]);
  const suggestedQuestions = useMemo(
    () => buildSuggestedAgentQuestions({ records: activeRecords, metrics: activeMetrics, findings: activeFindings, scopeLabel: activeScopeSnapshot.label }),
    [activeRecords, activeMetrics, activeFindings, activeScopeSnapshot],
  );
  const lastUserMessageIndex = activeMessages.map((message) => message.role).lastIndexOf("user");

  const runQuestion = async (text: string, scopeOverride?: QaScopeSnapshot) => {
    const trimmed = text.trim();
    if (!trimmed) {
      onAction("请输入要查询的问题");
      return;
    }
    const draftThreadId = draftConversationIdRef.current;
    const shouldCreateNewThread = Boolean(draftThreadId) || !selectedThreadForView;
    const title = shouldCreateNewThread ? buildAutoConversationTitle(trimmed) : selectedThreadForView.title;
    const nextThreadId = draftThreadId ?? selectedThreadForView?.id ?? `qa-${Date.now()}`;
    const previousTurns = shouldCreateNewThread ? [] : selectedThreadForView?.turns ?? activeMessages;
    const userMessage: QaMessage = {
      id: `${nextThreadId}-user-${previousTurns.length + 1}`,
      role: "user",
      text: trimmed,
    };
    const pendingTurns = [...previousTurns, userMessage];
    const questionScope = scopeOverride
      ?? selectedThreadForView?.scopeSnapshot
      ?? activeScopeSnapshot;
    const questionContextProject = getQaProjectById(questionScope.contextProjectId);
    const questionRecords = buildQaAgentRecords(questionScope.filter, questionContextProject);
    const questionMetrics = buildMetricSummary(questionRecords);
    const questionFindings = buildFindingsForScenario(questionRecords, "服务问题闭环");
    const scopeLabel = questionScope.label;
    let latestStreamText = "";
    let latestReasoningText = "";

    setActiveMessages(pendingTurns);
    setSelectedThreadId(nextThreadId);
    setAnswerSaved(false);
    setEvidenceExpanded(false);
    setQuestion("");
    setStreamingAnswer("");
    setSourceReasoningContent("");
    setActiveEvidenceQuotes([]);
    setAgentProgressStage("prepare-context");
    setIsRunning(true);
    setConversationThreads((current) => {
      const pendingThread: QaThread = {
        id: nextThreadId,
        title,
        meta: "查询中",
        turns: pendingTurns,
        evidenceQuotes: [],
        scopeSnapshot: questionScope,
      };
      const withoutCurrent = current.filter((thread) => thread.id !== nextThreadId);
      return [pendingThread, ...withoutCurrent];
    });

    try {
      const answer = await appAgentPort.answer({
        question: trimmed,
        records: questionRecords,
        metrics: questionMetrics,
        findings: questionFindings,
        scopeLabel,
        retrievalScope: buildQaRetrievalScope(questionScope.filter, questionContextProject),
        onProgress: setAgentProgressStage,
        onToken: (_delta, fullText) => {
          latestStreamText = fullText;
          setStreamingAnswer(fullText);
        },
        onReasoningToken: (_delta, fullText) => {
          latestReasoningText = fullText;
          setSourceReasoningContent(fullText);
        },
      });
      setAgentProgressStage("archive-turn");
      const reasoningContent = latestReasoningText || answer.reasoningContent || "";
      const assistantMessage: QaMessage = {
        id: `${nextThreadId}-answer-${previousTurns.length + 2}`,
        role: "assistant",
        text: latestStreamText || answer.content || "本次请求没有返回有效回答。",
      };
      const nextTurns: QaMessage[] = [...pendingTurns, assistantMessage];
      const nextThread: QaThread = {
        id: nextThreadId,
        title,
        meta: `${Math.ceil(nextTurns.length / 2)} 轮问答 / ${answer.evidenceQuotes.length} 条引用证据`,
        turns: nextTurns,
        evidenceQuotes: answer.evidenceQuotes,
        scopeSnapshot: questionScope,
        reasoningContent,
      };
      draftConversationIdRef.current = null;
      setActiveMessages(nextTurns);
      setActiveEvidenceQuotes(answer.evidenceQuotes);
      setSourceReasoningContent(reasoningContent);
      setConversationThreads((current) => {
        const withoutCurrent = current.filter((thread) => thread.id !== nextThreadId);
        return [nextThread, ...withoutCurrent];
      });
      onAction(answer.refused ? "AI 问答返回边界提示" : `AI 问答已返回结果：「${title}」`);
    } catch {
      const fallbackAnswer = answerWorkbenchQuestion({
        question: trimmed,
        records: questionRecords,
        metrics: questionMetrics,
        findings: questionFindings,
        scopeLabel,
      });
      const errorTurns: QaMessage[] = [
        ...pendingTurns,
        {
          id: `${nextThreadId}-answer-fallback-${previousTurns.length + 2}`,
          role: "assistant",
          text: `模型接口暂未返回，已用当前范围数据先生成结果：${fallbackAnswer.content}`,
        },
      ];
      setActiveMessages(errorTurns);
      setActiveEvidenceQuotes(fallbackAnswer.evidenceQuotes);
      setConversationThreads((current) => {
        const fallbackThread: QaThread = {
          id: nextThreadId,
          title,
          meta: `${Math.ceil(errorTurns.length / 2)} 轮问答 / ${fallbackAnswer.evidenceQuotes.length} 条引用证据`,
          turns: errorTurns,
          evidenceQuotes: fallbackAnswer.evidenceQuotes,
          scopeSnapshot: questionScope,
          reasoningContent: "",
        };
        const withoutCurrent = current.filter((thread) => thread.id !== nextThreadId);
        return [fallbackThread, ...withoutCurrent];
      });
      setSourceReasoningContent("");
      onAction(`AI 问答已返回本地数据结果：「${title}」`);
    } finally {
      draftConversationIdRef.current = null;
      setIsRunning(false);
      setStreamingAnswer("");
    }
  };

  useEffect(() => {
    if (!initialQuestion || handledInitialQuestionRef.current === initialQuestion) return;
    handledInitialQuestionRef.current = initialQuestion;
    const dashboardScope = buildQaScopeSnapshot(initialScopeMode, appliedFilter, null);
    setScopeMode(initialScopeMode);
    void runQuestion(initialQuestion, dashboardScope);
    onPendingQuestionHandled();
  }, [initialQuestion]);

  useEffect(() => {
    if (initialQuestion) return;
    setScopeMode(initialScopeMode);
  }, [initialScopeMode, initialQuestion]);

  const submitQuestion = () => {
    void runQuestion(question);
  };

  const createConversation = () => {
    draftConversationIdRef.current = `qa-${Date.now()}`;
    onPendingQuestionHandled();
    setSelectedThreadId(null);
    setContextProjectId(null);
    setScopeMode("free");
    setAnswerSaved(false);
    setEvidenceExpanded(false);
    setActiveMessages([]);
    setActiveEvidenceQuotes([]);
    setAgentProgressStage(null);
    setStreamingAnswer("");
    setSourceReasoningContent("");
    setQuestion("");
    onAction("已开启新对话");
  };

  const applyConversationScope = (snapshot: QaScopeSnapshot, message: string) => {
    if (selectedThreadId) {
      setConversationThreads((current) =>
        current.map((thread) =>
          thread.id === selectedThreadId
            ? {
                ...thread,
                scopeSnapshot: snapshot,
              }
            : thread,
        ),
      );
    } else {
      setScopeMode(snapshot.mode);
      setContextProjectId(snapshot.contextProjectId);
    }
    setAnswerSaved(false);
    onAction(message);
  };

  const useFreeConversationScope = () => {
    const snapshot = buildQaScopeSnapshot("free", defaultDrilldownFilter, activeScopeSnapshot.contextProjectId);
    applyConversationScope(snapshot, "当前对话已改为自由范围");
  };

  const useDashboardConversationScope = () => {
    const snapshot = buildQaScopeSnapshot("filtered", appliedFilter, activeScopeSnapshot.contextProjectId);
    applyConversationScope(snapshot, "当前对话已使用仪表盘范围");
  };

  const updateConversationProject = (project: ImportedProject) => {
    const nextProjectId = project.id === activeScopeSnapshot.contextProjectId ? null : project.id;
    const baseFilter = activeScopeSnapshot.mode === "filtered" ? activeScopeSnapshot.filter : defaultDrilldownFilter;
    const snapshot = buildQaScopeSnapshot(activeScopeSnapshot.mode, baseFilter, nextProjectId);
    applyConversationScope(
      snapshot,
      nextProjectId ? `当前对话已参考「${project.name}」` : "当前对话已取消参考项目",
    );
  };

  const toggleFavorite = (threadId: string, threadTitle: string) => {
    const next = favoriteThreadIds.includes(threadId)
      ? favoriteThreadIds.filter((item) => item !== threadId)
      : [...favoriteThreadIds, threadId];
    setFavoriteThreadIds(next);
    onAction(next.includes(threadId) ? `已收藏「${threadTitle}」` : `已取消收藏「${threadTitle}」`);
  };

  const saveCurrentAnswer = () => {
    if (!selectedThreadForView && activeMessages.length === 0) {
      onAction("请先发送一个具体问题，再保存问答记录");
      return;
    }
    if (selectedThreadId && activeMessages.length > 0) {
      const firstQuestion = activeMessages.find((message) => message.role === "user")?.text ?? "当前回答";
      const savedThread: QaThread = {
        id: selectedThreadId,
        title: selectedThreadForView?.title ?? buildAutoConversationTitle(firstQuestion),
        meta: `${Math.ceil(activeMessages.length / 2)} 轮问答 / ${activeEvidenceQuotes.length} 条引用证据`,
        turns: activeMessages,
        evidenceQuotes: activeEvidenceQuotes,
        scopeSnapshot: selectedThreadForView?.scopeSnapshot ?? activeScopeSnapshot,
        reasoningContent: sourceReasoningContent,
      };
      setConversationThreads((current) => {
        const withoutCurrent = current.filter((thread) => thread.id !== selectedThreadId);
        return [savedThread, ...withoutCurrent];
      });
    }
    setAnswerSaved(true);
    onAction("已保存到问答记录");
  };

  const deleteThread = (threadId: string, threadTitle: string) => {
    const result = removeQaConversationRecord(conversationThreads, threadId, selectedThreadId);
    setConversationThreads(result.threads);
    setFavoriteThreadIds((current) => current.filter((id) => id !== threadId));
    setSelectedThreadId(result.selectedThreadId);
    const isOpenThread = selectedThreadId === threadId || activeMessages.some((message) => message.id.startsWith(`${threadId}-`));
    if (isOpenThread) {
      setActiveMessages([]);
      setActiveEvidenceQuotes([]);
      setAgentProgressStage(null);
      setStreamingAnswer("");
      setSourceReasoningContent("");
      setAnswerSaved(false);
      draftConversationIdRef.current = `qa-${Date.now()}`;
    }
    onAction(`已删除问答记录「${threadTitle}」`);
  };

  const toggleEvidenceExpanded = () => {
    setEvidenceExpanded((current) => {
      const next = !current;
      onAction(next ? "已展开本次回答的引用证据" : "已收起引用证据详情");
      return next;
    });
  };

  const isHistoryView = activeSecondaryId === "qa-history";

  return (
    <div className={isHistoryView ? "screen-grid data-query-layout qa-history-layout" : "screen-grid data-query-layout qa-new-layout"} data-route-panel={activeSecondaryId}>
      <section className="panel thread-list chatbot-history-panel">
        <div className="panel-head compact">
          <div>
            <p>{activeSecondaryId === "qa-history" ? "问答历史" : "新建问答"}</p>
            <h2>{isHistoryView ? "历史记录与收藏" : "新建对话"}</h2>
          </div>
        </div>
        <div className="qa-create-actions">
          <button className="primary-button" type="button" onClick={createConversation}>
            <MessageSquareText size={15} />
            新建对话
          </button>
        </div>
        <div className="qa-record-selector">
          <div className="selector-label">
            <span>问答记录</span>
            <strong>{selectedThread ? selectedThread.title : "不继续历史"}</strong>
          </div>
          <button
            className={selectedThreadId === null ? "thread all-active" : "thread"}
            type="button"
            onClick={() => {
              setSelectedThreadId(null);
              draftConversationIdRef.current = `qa-${Date.now()}`;
              setAnswerSaved(false);
              setActiveMessages([]);
              setActiveEvidenceQuotes([]);
              setAgentProgressStage(null);
              setStreamingAnswer("");
              setSourceReasoningContent("");
              setScopeMode("free");
              setContextProjectId(null);
              onAction("已回到新对话");
            }}
          >
            <strong>新对话</strong>
            <span>空白输入</span>
          </button>
        {visibleThreads.map((thread) => (
          <div className={thread.id === selectedThreadId ? "thread-row active" : "thread-row"} key={thread.id}>
            <button
              className="thread"
              type="button"
              onClick={() => {
                const nextThreadId = thread.id === selectedThreadId ? null : thread.id;
                draftConversationIdRef.current = null;
                setSelectedThreadId(nextThreadId);
                setAnswerSaved(Boolean(nextThreadId));
                setActiveMessages(nextThreadId ? thread.turns ?? buildLegacyThreadMessages(thread.id) : []);
                setActiveEvidenceQuotes(nextThreadId ? thread.evidenceQuotes ?? buildLegacyThreadEvidenceQuotes(thread.id) : []);
                setAgentProgressStage(null);
                setStreamingAnswer("");
                setSourceReasoningContent(nextThreadId ? thread.reasoningContent ?? "" : "");
                onAction(nextThreadId ? `已打开问答记录「${thread.title}」` : "已关闭问答记录");
              }}
            >
              <strong>{thread.title}</strong>
              <span>{thread.meta}</span>
            </button>
            <button
              className={favoriteThreadIds.includes(thread.id) ? "favorite-button active" : "favorite-button"}
              type="button"
              aria-label={favoriteThreadIds.includes(thread.id) ? `取消收藏 ${thread.title}` : `收藏 ${thread.title}`}
              onClick={() => toggleFavorite(thread.id, thread.title)}
            >
              <Star size={14} />
            </button>
            <button
              className="delete-thread-button"
              type="button"
              aria-label={`删除 ${thread.title}`}
              onClick={() => deleteThread(thread.id, thread.title)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        </div>
      </section>
      <section className="panel chat-panel chatbot-panel">
        <div className="chat-context-bar">
          <div className="chat-context-main">
            <strong>{isHistoryView ? "继续历史问答" : contextLabel}</strong>
            <span>{activeScopeSnapshot.label}</span>
          </div>
          <div className="chat-context-actions">
            <button
              className={activeScopeSnapshot.mode === "free" ? "ghost-button active" : "ghost-button"}
              type="button"
              onClick={useFreeConversationScope}
              disabled={isRunning}
            >
              自由范围
            </button>
            <button
              className={activeScopeSnapshot.mode === "filtered" ? "ghost-button active" : "ghost-button"}
              type="button"
              onClick={useDashboardConversationScope}
              disabled={isRunning}
            >
              <Filter size={15} />
              使用仪表盘范围
            </button>
            <StatusBadge tone={activeScopeSnapshot.mode === "filtered" ? "warning" : "neutral"}>
              {activeScopeSnapshot.mode === "filtered" ? "带入仪表盘范围" : "自由范围"}
            </StatusBadge>
          </div>
        </div>
        <div className="qa-reference-bar" aria-label="本次对话参考项目">
          <span>参考项目</span>
          {qaProjects.map((project) => (
            <button
              className={project.id === activeScopeSnapshot.contextProjectId ? "active" : ""}
              key={project.id}
              type="button"
              disabled={isRunning}
              onClick={() => updateConversationProject(project)}
            >
              <strong>{project.name}</strong>
              <small>{project.type} / {project.count} 条</small>
            </button>
          ))}
        </div>
        <div className="chat-transcript">
          {activeMessages.length === 0 ? (
            <div className="message empty-message">
              <span>新对话</span>
              <p>输入问题后开始查询。</p>
            </div>
          ) : (
            <>
              {activeMessages.map((message, index) => (
                <Fragment key={message.id}>
                  <div className={message.role === "user" ? "message user-message" : "message ai-message"}>
                    <span>{message.role === "user" ? "你的问题" : "数据查询结果"}</span>
                    <p>{message.text}</p>
                  </div>
                  {message.role === "user" && index === lastUserMessageIndex ? (
                    <ReasoningMessage
                      isRunning={isRunning}
                      reasoningContent={sourceReasoningContent}
                      hasAnswer={activeMessages.some((item) => item.role === "assistant")}
                    />
                  ) : null}
                </Fragment>
              ))}
            </>
          )}
          {streamingAnswer ? (
            <div className="message ai-message streaming">
              <span>实时返回</span>
              <p>{streamingAnswer}</p>
            </div>
          ) : null}
        </div>
        <div className="suggested-question-strip" aria-label="建议追问">
          {suggestedQuestions.slice(0, 3).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setQuestion(item);
                onAction("已填入建议追问");
              }}
              disabled={isRunning}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="composer">
          <textarea
            aria-label="AI 问答输入"
            placeholder={isHistoryView ? "继续追问当前历史记录，或先关闭历史记录再新建问题" : "输入一个新的售后数据问题，可以指定项目、时间、城市或服务中心"}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={isRunning}
          />
          <button className="primary-button" type="button" onClick={submitQuestion} disabled={isRunning}>
            <Send size={15} />
            {isRunning ? "查询中" : "发送查询"}
          </button>
        </div>
      </section>
      <AiQaSidePanel
        contextProject={activeContextProject}
        selectedThread={selectedThread}
        scopeSnapshot={activeScopeSnapshot}
        answerSaved={answerSaved}
        evidenceExpanded={evidenceExpanded}
        evidenceQuotes={activeEvidenceQuotes}
        hasAnswer={activeMessages.some((message) => message.role === "assistant")}
        onSaveCurrentAnswer={saveCurrentAnswer}
        onToggleEvidenceExpanded={toggleEvidenceExpanded}
      />
    </div>
  );
}

function ReasoningMessage({
  isRunning,
  reasoningContent,
  hasAnswer,
}: {
  isRunning: boolean;
  reasoningContent: string;
  hasAnswer: boolean;
}) {
  if (!isRunning && !reasoningContent && !hasAnswer) return null;

  return (
    <div className={reasoningContent ? "message reasoning-message active" : "message reasoning-message"} aria-label="AI 思考过程">
      <span>AI 思考过程</span>
      <p>
        {reasoningContent ||
          (isRunning
            ? "等待模型返回分析过程。"
            : "当前回答未返回可展示的分析过程。")}
      </p>
    </div>
  );
}

function ProfileScreen({ activeSecondaryId, onAction }: { activeSecondaryId: string; onAction: (message: string) => void }) {
  const route = getProfileRouteConfig(activeSecondaryId);
  const [activeProfileAction, setActiveProfileAction] = useState(route.actions[0]?.label ?? "查看状态");
  useEffect(() => {
    setActiveProfileAction(route.actions[0]?.label ?? "查看状态");
  }, [activeSecondaryId]);
  const actionCards = getProfileActionCards(activeSecondaryId, activeProfileAction, route.cards);
  const profileIdentity = [
    { title: "张伟", text: "区域运营主管 / 员工编号 AS-2024-9981", status: "华东大区", tone: "pass" as const },
    { title: "账号邮箱", text: "zhangwei.aftersales@example.com", status: "已验证", tone: "pass" as const },
    { title: "角色范围", text: "区域运营、服务中心督查、报告导出", status: "区域级", tone: "neutral" as const },
  ];

  return (
    <div className="screen-grid profile-layout" data-route-panel={activeSecondaryId}>
      <section className="panel profile-column profile-identity-panel">
        <div className="panel-head">
          <div>
            <p>个人资料</p>
            <h2>身份与角色</h2>
            <span>当前账号、默认区域和可用工作入口</span>
          </div>
          <UserCircle size={36} />
        </div>
        <div className="profile-card-stack">
          {profileIdentity.map((item) => (
            <article className={`secondary-workspace-card ${item.tone}`} key={item.title}>
              <div>
                <strong>{item.title}</strong>
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
              </div>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel profile-column profile-workspace-panel">
        <div className="panel-head">
          <div>
            <p>{route.eyebrow}</p>
            <h2>{route.title}</h2>
            <span>{route.summary}</span>
          </div>
        </div>
        <div className="compact-kpis profile-kpi-strip">
          {route.kpis.map((kpi) => (
            <MiniKpi key={kpi.label} {...kpi} />
          ))}
        </div>
        <div className="profile-action-grid">
          {route.actions.map(({ label, message }) => (
            <button
              className={activeProfileAction === label ? "active" : ""}
              key={label}
              type="button"
              onClick={() => {
                setActiveProfileAction(label);
                onAction(message);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="profile-route-grid">
          {actionCards.map((card) => (
            <article className={`secondary-workspace-card ${card.tone}`} key={card.title}>
              <div>
                <strong>{card.title}</strong>
                <StatusBadge tone={card.tone}>{card.status}</StatusBadge>
              </div>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel profile-column profile-summary-panel">
        <div className="panel-head compact">
          <div>
            <p>{route.sideEyebrow}</p>
            <h2>{route.sideTitle}</h2>
          </div>
        </div>
        <div className="profile-summary-stack route-specific-summary">
          {route.sideItems.map((item, index) => (
            <article className={index === 0 ? "secondary-workspace-card pass" : "secondary-workspace-card neutral"} key={item.title}>
              <div>
                <strong>{item.title}</strong>
                <StatusBadge tone={index === 0 ? "pass" : "neutral"}>{index === 0 ? "当前" : "可管理"}</StatusBadge>
              </div>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        <div className="profile-summary-subpanel">
          <strong>{route.supportTitle}</strong>
          {route.table ? (
            <DataTable columns={route.table.columns} rows={route.table.rows} toneColumn={route.table.toneColumn} />
          ) : (
            <div className="profile-list">
              {route.supportItems.map((item) => (
                <p key={item.title}>
                  <LockKeyhole size={16} />
                  <span>{item.title}</span>
                  <strong>{item.text}</strong>
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

function getProfileActionCards(activeSecondaryId: string, action: string, fallbackCards: Array<{ title: string; text: string; status: string; tone: StatusTone }>) {
  const profiles: Record<string, Record<string, Array<{ title: string; text: string; status: string; tone: StatusTone }>>> = {
    "profile-settings": {
      "个人设置": [
        { title: "角色名称", text: "区域运营主管，负责华东售后反馈复盘。", status: "已设置", tone: "pass" },
        { title: "默认入口", text: "登录后进入工作台首页。", status: "首页", tone: "neutral" },
        { title: "语言与格式", text: "中文界面，数字使用千分位显示。", status: "已设置", tone: "pass" },
      ],
      "默认范围": [
        { title: "默认区域", text: "华东大区。", status: "可改", tone: "neutral" },
        { title: "默认项目", text: "不预选项目，进入仪表盘显示全部项目。", status: "全部项目", tone: "pass" },
        { title: "默认时间", text: "不强制套用时间筛选。", status: "全部时间", tone: "pass" },
      ],
      "提醒偏好": [
        { title: "导入完成", text: "字段识别完成后提醒。", status: "开启", tone: "pass" },
        { title: "报告生成", text: "初始复盘生成后提醒。", status: "开启", tone: "pass" },
        { title: "工单邮件", text: "打开邮箱草稿后仍需人工确认发送。", status: "提醒", tone: "warning" },
      ],
    },
    "profile-account": {
      "导出权限": [
        { title: "报告导出", text: "当前可导出 Markdown 报告。", status: "可用", tone: "pass" },
        { title: "批量导出", text: "批量导出需主管审批。", status: "需审批", tone: "warning" },
        { title: "原文导出", text: "仅导出授权范围内原文。", status: "受控", tone: "pass" },
      ],
      "审批记录": [
        { title: "批量导出申请", text: "2026-06-09 提交，等待主管确认。", status: "待审批", tone: "warning" },
        { title: "导入权限", text: "2026-05-28 已开通。", status: "已通过", tone: "pass" },
        { title: "归档查看", text: "默认允许查看。", status: "已通过", tone: "pass" },
      ],
      "账号状态": [
        { title: "登录状态", text: "当前账号正常。", status: "正常", tone: "pass" },
        { title: "席位", text: "区域运营席位。", status: "有效", tone: "pass" },
        { title: "最近登录", text: "2026-06-09 22:18。", status: "已记录", tone: "neutral" },
      ],
    },
    "profile-privacy": {
      "脱敏规则": [
        { title: "手机号", text: "默认显示为 138****2187。", status: "开启", tone: "pass" },
        { title: "姓名 / 车牌 / VIN", text: "默认不进入报告正文。", status: "开启", tone: "pass" },
        { title: "证据引用", text: "引用前保留授权范围校验。", status: "受控", tone: "pass" },
      ],
      "问答记录": [
        { title: "历史问答", text: "当前 3 条，可在 AI 问答内删除。", status: "3 条", tone: "neutral" },
        { title: "收藏问答", text: "收藏状态保留在当前工作台会话。", status: "会话内", tone: "neutral" },
        { title: "清理边界", text: "清理个人记录不影响项目报告。", status: "隔离", tone: "pass" },
      ],
      "导出范围": [
        { title: "报告", text: "导出当前授权范围内报告。", status: "可导出", tone: "pass" },
        { title: "原文", text: "分页查看，按需导出。", status: "受控", tone: "pass" },
        { title: "工单", text: "最多带入代表证据，完整原文回到原文池查看。", status: "受控", tone: "pass" },
      ],
    },
    "profile-data": {
      "区域授权": [
        { title: "华东大区", text: "可查看杭州、上海等授权城市。", status: "已授权", tone: "pass" },
        { title: "跨区查看", text: "跨区域导出需审批。", status: "需审批", tone: "warning" },
        { title: "默认范围", text: "进入仪表盘不强制限定区域。", status: "全部区域", tone: "pass" },
      ],
      "项目授权": [
        { title: "五一售后服务专项", text: "可查看报告、原文和问答记录。", status: "已授权", tone: "pass" },
        { title: "四月售后月报", text: "已归档，可继续查看。", status: "已授权", tone: "pass" },
        { title: "补能体验活动反馈", text: "字段待配置。", status: "需配置", tone: "warning" },
      ],
      "归档权限": [
        { title: "查看归档", text: "归档项目不进入默认范围。", status: "可查看", tone: "pass" },
        { title: "恢复归档", text: "可从归档项目页恢复。", status: "可操作", tone: "pass" },
        { title: "删除项目", text: "仅管理员可处理删除申请。", status: "受限", tone: "neutral" },
      ],
    },
  };
  return profiles[activeSecondaryId]?.[action] ?? fallbackCards;
}

function getProfileRouteConfig(activeSecondaryId: string) {
  const fallback = secondaryWorkspaceCopy[activeSecondaryId] ?? secondaryWorkspaceCopy["profile-settings"];
  const baseCards = fallback.items;
  if (activeSecondaryId === "profile-account") {
    return {
      eyebrow: "账号状态",
      title: "账号状态与审批",
      summary: "账号、席位、导入权限、导出审批",
      kpis: [
        { label: "账号状态", value: "正常", tone: "pass" as const },
        { label: "导入权限", value: "已开启", tone: "pass" as const },
        { label: "导出权限", value: "需审批", tone: "warning" as const },
      ],
      actions: [
        { label: "导出权限", message: "当前查看：导出权限" },
        { label: "审批记录", message: "当前查看：审批记录" },
        { label: "账号状态", message: "当前查看：账号状态" },
      ],
      cards: baseCards,
      supportEyebrow: "审批状态",
      supportTitle: "权限申请记录",
      supportItems: [
        { title: "导出报告", text: "待主管审批" },
        { title: "导入数据", text: "已授权" },
        { title: "查看归档项目", text: "已授权" },
      ],
      sideEyebrow: "账号信息",
      sideTitle: "席位与登录",
      sideItems: [
        { title: "席位", text: "区域运营席位" },
        { title: "最近登录", text: "2026-06-09 22:18" },
      ],
    };
  }
  if (activeSecondaryId === "profile-privacy") {
    return {
      eyebrow: "隐私设置",
      title: "隐私设置与数据清理",
      summary: "脱敏规则、问答记录、导出边界",
      kpis: [
        { label: "默认脱敏", value: "开启", tone: "pass" as const },
        { label: "可清理记录", value: "3", tone: "neutral" as const },
        { label: "导出边界", value: "受控", tone: "pass" as const },
      ],
      actions: [
        { label: "脱敏规则", message: "当前查看：脱敏规则" },
        { label: "问答记录", message: "当前查看：问答记录" },
        { label: "导出范围", message: "当前查看：导出范围" },
      ],
      cards: baseCards,
      supportEyebrow: "隐私规则",
      supportTitle: "敏感字段处理",
      supportItems: [
        { title: "手机号", text: "默认脱敏显示" },
        { title: "VIN / 车牌", text: "不进入默认报告正文" },
        { title: "原话引用", text: "导出前保留授权校验" },
      ],
      sideEyebrow: "记录清理",
      sideTitle: "个人问答记录",
      sideItems: queryThreads.map((thread) => ({ title: thread.title, text: "可清理或保留" })),
    };
  }
  if (activeSecondaryId === "profile-data") {
    return {
      eyebrow: "数据权限",
      title: "数据权限与授权范围",
      summary: "区域级、项目级、导入、归档",
      kpis: [
        { label: "区域权限", value: "华东", tone: "pass" as const },
        { label: "项目权限", value: "3 项", tone: "pass" as const },
        { label: "归档权限", value: "可查看", tone: "neutral" as const },
      ],
      actions: [
        { label: "区域授权", message: "当前查看：区域授权" },
        { label: "项目授权", message: "当前查看：项目授权" },
        { label: "归档权限", message: "当前查看：归档权限" },
      ],
      cards: baseCards,
      supportEyebrow: "授权项目",
      supportTitle: "可访问项目",
      table: {
        columns: ["项目", "类型", "时间范围", "反馈量"],
        rows: importedProjects.map((project) => [project.name, project.type, project.dateRange, `${project.count} 条`]),
        toneColumn: undefined,
      },
      supportItems: [],
      sideEyebrow: "数据边界",
      sideTitle: "范围隔离",
      sideItems: [
        { title: "AI 问答", text: "按当前对话范围读取" },
        { title: "归档项目", text: "从归档页单独查看" },
      ],
    };
  }
  return {
    eyebrow: "个人设置",
    title: "个人设置与默认偏好",
    summary: "角色、默认区域、默认页面、通知偏好",
    kpis: [
      { label: "默认区域", value: "华东", tone: "pass" as const },
      { label: "默认页", value: "首页", tone: "neutral" as const },
      { label: "提醒", value: "开启", tone: "pass" as const },
    ],
    actions: [
      { label: "个人设置", message: "当前查看：个人设置" },
      { label: "默认范围", message: "当前查看：默认范围" },
      { label: "提醒偏好", message: "当前查看：提醒偏好" },
    ],
    cards: baseCards,
    supportEyebrow: "默认设置",
    supportTitle: "个人工作偏好",
    supportItems: [
      { title: "默认区域", text: "华东大区" },
      { title: "默认入口", text: "工作台首页" },
      { title: "提醒", text: "导入完成和报告生成后提醒" },
    ],
    sideEyebrow: "最近入口",
    sideTitle: "个人快捷方式",
    sideItems: [
      { title: "新建项目", text: "上传反馈数据" },
      { title: "报告仪表盘", text: "查看当前范围" },
    ],
  };
}

function HistoryPanel() {
  return (
    <section className="panel mini-panel">
      <div className="panel-head compact">
        <div>
          <p>历史导入</p>
          <h2>最近文件</h2>
        </div>
      </div>
      <div className="history-list">
        {importHistory.map((item) => (
          <p key={item[0]}>
            <span>{item[0]}</span>
            <strong>{item[2]} · {item[3]} 行</strong>
          </p>
        ))}
      </div>
    </section>
  );
}

function ImportStatusPanel({ hasSelectedFile = true }: { hasSelectedFile?: boolean }) {
  return (
    <aside className="panel import-status-panel">
      <div className="panel-head">
        <div>
          <p>导入状态</p>
          <h2>当前文件处理结果</h2>
        </div>
        <FileSpreadsheet size={18} />
      </div>
      <div className="import-status-list">
        {hasSelectedFile ? (
          <>
            <article className="import-status-item pass">
              <span>当前识别结果</span>
              <strong>1,240 条反馈</strong>
              <small>已完成字段识别和基础校验</small>
            </article>
            <article className="import-status-item warning">
              <span>需要人工确认</span>
              <strong>推荐意愿缺失 64 条</strong>
              <small>缺失样本不参与 NPS 计算</small>
            </article>
          </>
        ) : (
          <>
            <article className="import-status-item">
              <span>当前识别结果</span>
              <strong>未开始</strong>
              <small>上传文件后显示识别结果</small>
            </article>
            <article className="import-status-item">
              <span>人工确认</span>
              <strong>待识别</strong>
              <small>字段识别后显示确认项</small>
            </article>
          </>
        )}
      </div>
      <div className="import-history-section">
        <div className="section-mini-head">
          <span>历史导入</span>
          <strong>最近文件</strong>
        </div>
        <div className="history-list">
          {importHistory.map((item) => (
            <p key={item[0]}>
              <span>{item[0]}</span>
              <strong>{item[2]} · {item[3]} 行</strong>
            </p>
          ))}
        </div>
      </div>
    </aside>
  );
}

function PanelFooterNote({ title, text }: { title: string; text: string }) {
  return (
    <div className="panel-footer-note">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function CurrentScopeCard({
  filterState,
  filteredRows,
  riskRows,
}: {
  filterState: DrilldownFilter;
  filteredRows: string[][];
  riskRows: string[][];
}) {
  return (
    <section className="current-scope-card" aria-label="当前范围总览">
      <div>
        <span>当前范围</span>
        <strong>{buildDrilldownScope(filterState)}</strong>
      </div>
      <dl>
        <div><dt>时间</dt><dd>{formatTimeRange(filterState.timeRange, filterState.customTimeRange, filterState.timePeriod)}</dd></div>
        <div><dt>项目</dt><dd>{buildProjectScope(filterState.selectedProjectIds)}</dd></div>
        <div><dt>区域</dt><dd>{buildAreaScope(filterState.selectedRegions, filterState.selectedCities, filterState.selectedCenters)}</dd></div>
        <div><dt>结果</dt><dd>{getCurrentScopeRawFeedbackTotal(filterState, filteredRows).toLocaleString()} 条 / {riskRows.length} 个风险对象</dd></div>
      </dl>
    </section>
  );
}

function DashboardActionBar({
  filteredRows,
  rawFeedbackOpen,
  canCreateWorkOrder,
  showWorkOrderAction,
  onToggleRawFeedback,
  onGoReport,
  onGoQa,
  onCreateWorkOrder,
}: {
  filteredRows: string[][];
  rawFeedbackOpen: boolean;
  canCreateWorkOrder: boolean;
  showWorkOrderAction: boolean;
  onToggleRawFeedback: () => void;
  onGoReport: () => void;
  onGoQa: () => void;
  onCreateWorkOrder: () => void;
}) {
  const serviceCenterCount = filteredRows.length;
  return (
    <div className="dashboard-action-bar">
      <div className="dashboard-action-summary">
        <span>下一步动作</span>
        <strong>{serviceCenterCount.toLocaleString()} 个服务中心可继续处理</strong>
        <small>按上方范围继续</small>
      </div>
      <div className="dashboard-action-buttons">
        {showWorkOrderAction ? (
          <button className="primary-button critical-action" type="button" disabled={!canCreateWorkOrder} onClick={onCreateWorkOrder}>
            <Mail size={15} />
            生成服务工单
          </button>
        ) : null}
        <button className="ghost-button" type="button" onClick={onToggleRawFeedback}>
          <FileSpreadsheet size={15} />
          {rawFeedbackOpen ? "收起原文池" : "打开原文池"}
        </button>
        <button className="primary-button" type="button" onClick={onGoReport}>
          <MoveRight size={15} />
          进入报告输出
        </button>
        <button className="ghost-button" type="button" onClick={onGoQa}>
          <MessageSquareText size={15} />
          AI 问答
        </button>
      </div>
    </div>
  );
}

function AiQaSidePanel({
  contextProject,
  selectedThread,
  scopeSnapshot,
  answerSaved,
  evidenceExpanded,
  evidenceQuotes,
  hasAnswer,
  onSaveCurrentAnswer,
  onToggleEvidenceExpanded,
}: {
  contextProject: (typeof qaProjects)[number] | null;
  selectedThread: QaThread | null;
  scopeSnapshot: QaScopeSnapshot;
  answerSaved: boolean;
  evidenceExpanded: boolean;
  evidenceQuotes: DomainEvidenceQuote[];
  hasAnswer: boolean;
  onSaveCurrentAnswer: () => void;
  onToggleEvidenceExpanded: () => void;
}) {
  const evidenceTitle = selectedThread
    ? selectedThread.title
    : contextProject
      ? contextProject.name
      : scopeSnapshot.mode === "filtered"
        ? buildAreaScope(scopeSnapshot.filter.selectedRegions, scopeSnapshot.filter.selectedCities, scopeSnapshot.filter.selectedCenters)
        : "本轮回答";

  return (
    <aside className="side-stack ai-qa-side">
      <section className="panel qa-answer-evidence-panel">
        <div className="panel-head compact">
          <div>
            <p>本次回答引用</p>
            <h2>{evidenceTitle}</h2>
          </div>
        </div>
        <div className="answer-evidence-summary">
          <strong>{hasAnswer ? `${evidenceQuotes.length} 条引用证据` : "等待回答"}</strong>
          <span>{hasAnswer ? "本次回答引用" : "发送问题后显示"}</span>
        </div>
        <div className="answer-evidence-list">
          {!hasAnswer ? (
            <div className="answer-evidence-empty">暂无引用证据</div>
          ) : evidenceQuotes.length === 0 ? (
            <div className="answer-evidence-empty">本次回答未引用原话证据</div>
          ) : evidenceQuotes.map((item, index) => (
            <article className={`answer-evidence-card ${qaEvidenceTone(item)} ${evidenceExpanded ? "expanded" : ""}`} key={item.feedbackId}>
              <strong>证据 {index + 1}</strong>
              <p>{item.quote}</p>
              <span>{item.scoreSource.location} / {formatQaEvidenceScore(item)}</span>
              {evidenceExpanded ? (
                <dl>
                  <div><dt>提交时间</dt><dd>{item.scoreSource.submittedAt}</dd></div>
                  <div><dt>来源</dt><dd>{item.scoreSource.sourceLabel}</dd></div>
                  <div><dt>服务场景</dt><dd>{item.scoreSource.serviceScenario}</dd></div>
                  <div><dt>引用原因</dt><dd>{item.reasonToUse}</dd></div>
                </dl>
              ) : null}
            </article>
          ))}
        </div>
      </section>
      <section className="panel qa-actions-panel">
        <div className="panel-head compact">
          <div>
            <p>问答操作</p>
            <h2>保存与导出</h2>
          </div>
        </div>
        <div className="action-list">
          <button type="button" onClick={onSaveCurrentAnswer}>{answerSaved ? "已保存到问答记录" : "保存当前回答"}</button>
          <button type="button" onClick={onToggleEvidenceExpanded} disabled={!hasAnswer || evidenceQuotes.length === 0}>{evidenceExpanded ? "收起引用证据" : "展开引用证据"}</button>
        </div>
      </section>
    </aside>
  );
}

function WorkOrderDraftCard({ draft, onAction }: { draft: WorkOrderDraft; onAction: (message: string) => void }) {
  const [copyStatus, setCopyStatus] = useState("复制工单正文");
  const [mailStatus, setMailStatus] = useState("待人工发送");
  const recipientEmail = getServiceCenterEmail(draft.serviceCenter);
  const emailDraft = createWorkOrderEmailDraft(draft, recipientEmail);

  const copyWorkOrder = () => {
    const writePromise = navigator.clipboard?.writeText(draft.copyableText);
    if (writePromise) void writePromise.catch(() => undefined);
    setCopyStatus("工单正文已复制");
    onAction("工单正文已复制，可粘贴到邮件或协同系统");
  };

  return (
    <section className="panel work-order-draft-panel">
      <div className="panel-head compact">
        <div>
          <p>服务中心工单</p>
          <h2>工单草稿预览</h2>
        </div>
        <StatusBadge tone={mailStatus === "邮箱草稿已打开" ? "pass" : "warning"}>{mailStatus}</StatusBadge>
      </div>
      <div className="work-order-summary">
        <dl>
          <div><dt>工单编号</dt><dd>{draft.id}</dd></div>
          <div><dt>处理单位</dt><dd>{draft.city} / {draft.serviceCenter}</dd></div>
          <div><dt>接收邮箱</dt><dd>{recipientEmail}</dd></div>
          <div><dt>反馈范围</dt><dd>{draft.scopeLabel}</dd></div>
        </dl>
        <div className="work-order-copy">
          <strong>{draft.issueSummary}</strong>
          <span>{draft.suggestedAction}</span>
        </div>
      </div>
      <div className="work-order-evidence-list">
        <div className="work-order-evidence-heading">
          <strong>工单引用证据</strong>
          <span>{draft.evidence.length} 条</span>
        </div>
        {draft.evidence.map((item) => (
          <blockquote key={`${item.submittedAt}-${item.quote}`}>
            {item.quote}
            <small>{item.submittedAt} / {item.location} / 评分 {item.rating ?? "-"}</small>
          </blockquote>
        ))}
      </div>
      <div className="button-row work-order-actions">
        <button className="ghost-button" type="button" onClick={copyWorkOrder}>
          <Copy size={15} />
          {copyStatus}
        </button>
        <a
          className="primary-button"
          href={emailDraft.mailtoHref}
          onClick={() => {
            setMailStatus("邮箱草稿已打开");
            onAction("已打开邮箱草稿，需人工确认收件人和发送");
          }}
        >
          <Mail size={15} />
          打开邮箱草稿
        </a>
      </div>
    </section>
  );
}

function EvidenceList({
  compact = false,
  filterState,
  filteredRows,
  label,
  heading,
}: {
  compact?: boolean;
  filterState?: DrilldownFilter;
  filteredRows?: string[][];
  label?: string;
  heading?: string;
}) {
  const isScopedPool = Boolean(filterState && filteredRows);
  const scopeKey = useMemo(
    () => isScopedPool
      ? `${buildDrilldownScope(filterState ?? defaultDrilldownFilter)}|${(filteredRows ?? []).map((row) => row.join(":")).join(";")}`
      : "reference-evidence",
    [filterState, filteredRows, isScopedPool],
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<EvidencePageSize>(20);
  const total = isScopedPool
    ? getCurrentScopeRawFeedbackTotal(filterState ?? defaultDrilldownFilter, filteredRows ?? drilldownRows)
    : evidenceQuotes.length;
  const activePageSize = isScopedPool ? pageSize : evidenceQuotes.length;
  const pageCount = Math.max(1, Math.ceil(total / activePageSize));
  const startIndex = total === 0 ? 0 : (page - 1) * activePageSize + 1;
  const endIndex = Math.min(total, page * activePageSize);
  const items = isScopedPool
    ? buildRawFeedbackPage(filterState ?? defaultDrilldownFilter, filteredRows ?? drilldownRows, startIndex, endIndex)
    : evidenceQuotes.map((item, index) => ({
      ...item,
      feedbackId: `reference-${index + 1}`,
      projectName: "五一售后服务专项",
      recordNumber: index + 1,
    }));

  useEffect(() => {
    setPage(1);
  }, [scopeKey]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return (
    <section className={compact ? "panel evidence-panel compact" : "panel evidence-panel"}>
      <div className="panel-head compact">
        <div>
          <p>{label ?? (isScopedPool ? "当前范围原文池" : "报告引用证据")}</p>
          <h2>{heading ?? (isScopedPool ? "分页加载原文" : "可追溯引用")}</h2>
        </div>
      </div>
      {isScopedPool ? (
        <div className="evidence-pool-summary">
          <dl>
            <div><dt>命中原文</dt><dd>{total.toLocaleString()} 条</dd></div>
            <div><dt>当前显示</dt><dd>{startIndex}-{endIndex} 条</dd></div>
            <div><dt>每页数量</dt><dd>{activePageSize} 条</dd></div>
          </dl>
          <label className="evidence-page-size">
            <span>每页显示</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as EvidencePageSize);
                setPage(1);
              }}
            >
              {evidencePageSizeOptions.map((option) => (
                <option key={option} value={option}>{option} 条</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="evidence-reference-note">
          已引用 {items.length} 条
        </div>
      )}
      <div className="evidence-list">
        {items.map((item) => (
          <article className={`evidence-card ${item.tone}`} key={item.feedbackId}>
            <blockquote>{item.quote}</blockquote>
            <dl>
              <div><dt>样本编号</dt><dd>{item.feedbackId}</dd></div>
              <div><dt>项目</dt><dd>{item.projectName}</dd></div>
              <div><dt>评分 / NPS</dt><dd>{item.rating} / {item.nps}</dd></div>
              <div><dt>提交时间</dt><dd>{item.submittedAt}</dd></div>
              <div><dt>来源平台</dt><dd>{item.source}</dd></div>
              <div><dt>位置</dt><dd>{item.location}</dd></div>
              <div><dt>服务场景</dt><dd>{item.scenario}</dd></div>
              <div><dt>入选原因</dt><dd>{item.reason}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      {isScopedPool ? (
        <div className="evidence-pager">
          <button
            className="ghost-button"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            上一页
          </button>
          <span>第 {page} / {pageCount} 页</span>
          <button
            className="ghost-button"
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            下一页
          </button>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: StatusTone }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: string; tone: StatusTone }) {
  return (
    <div className={`mini-kpi ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  value,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  tone: StatusTone;
}) {
  return (
    <article className={`status-card ${tone}`}>
      {icon}
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function StatusBadge({ children, tone }: { children: React.ReactNode; tone: StatusTone }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

function FilterGroup({
  title,
  options,
  active,
  onSelect,
}: {
  title: string;
  options: string[];
  active: string;
  onSelect?: (option: string) => void;
}) {
  return (
    <div className="filter-group">
      <strong>{title}</strong>
      <div>
        {options.map((option) => (
          <button className={option === active ? "active" : ""} key={option} type="button" onClick={() => onSelect?.(option)}>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function TimePeriodSelector({
  filterState,
  onPeriodValueChange,
  onCustomDateChange,
}: {
  filterState: DrilldownFilter;
  onPeriodValueChange: (value: string) => void;
  onCustomDateChange: (field: "customStartDate" | "customEndDate", value: string) => void;
}) {
  if (filterState.timeRange === "全部时间") {
    return (
      <div className="time-period-group free-time-group">
        <strong>当前时间</strong>
        <p>全部时间</p>
      </div>
    );
  }

  if (filterState.timeRange === "自定义") {
    return (
      <div className="time-period-group custom-time-group">
        <strong>具体时间段</strong>
        <div className="custom-date-inputs">
          <label>
            <span>开始</span>
            <input
              type="date"
              value={filterState.customStartDate}
              onChange={(event) => onCustomDateChange("customStartDate", event.target.value)}
            />
          </label>
          <label>
            <span>结束</span>
            <input
              type="date"
              value={filterState.customEndDate}
              onChange={(event) => onCustomDateChange("customEndDate", event.target.value)}
            />
          </label>
        </div>
        <p>{filterState.customStartDate} 至 {filterState.customEndDate}</p>
      </div>
    );
  }

  const [quarterYear = "2026", quarterValue = "Q2"] = filterState.timePeriod.includes("-Q")
    ? filterState.timePeriod.split("-")
    : ["2026", "Q2"];

  if (filterState.timeRange === "季度") {
    return (
      <div className="time-period-group free-time-group">
        <strong>具体季度</strong>
        <div className="quarter-inputs">
          <label>
            <span>年份</span>
            <input
              type="number"
              min="2020"
              max="2035"
              value={quarterYear}
              onChange={(event) => onPeriodValueChange(`${event.target.value}-${quarterValue}`)}
            />
          </label>
          <label>
            <span>季度</span>
            <select
              value={quarterValue}
              onChange={(event) => onPeriodValueChange(`${quarterYear}-${event.target.value}`)}
            >
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>
          </label>
        </div>
        <p>{formatTimeRange(filterState.timeRange, filterState.customTimeRange, filterState.timePeriod)}</p>
      </div>
    );
  }

  const inputConfig: Record<string, { type: string; label: string; helper: string }> = {
    日: { type: "date", label: "具体日期", helper: "可选择导入表内任意日期" },
    周: { type: "week", label: "具体周", helper: "按自然周自由选择" },
    月: { type: "month", label: "具体月份", helper: "按月份自由选择" },
    年: { type: "number", label: "具体年份", helper: "输入任意年份" },
  };
  const config = inputConfig[filterState.timeRange] ?? inputConfig.日;

  return (
    <div className="time-period-group free-time-group">
      <strong>{config.label}</strong>
      <label className="single-time-input">
        <span>{config.helper}</span>
        <input
          type={config.type}
          min={filterState.timeRange === "年" ? "2020" : undefined}
          max={filterState.timeRange === "年" ? "2035" : undefined}
          value={filterState.timePeriod || defaultTimePeriodValues[filterState.timeRange] || ""}
          onChange={(event) => onPeriodValueChange(event.target.value)}
        />
      </label>
      <p>{formatTimeRange(filterState.timeRange, filterState.customTimeRange, filterState.timePeriod)}</p>
    </div>
  );
}

function MultiSelectGroup({
  title,
  variant = "compact",
  emptyLabel,
  items,
  selectedIds,
  onToggle,
  onClear,
  disabled = false,
}: {
  title: string;
  variant?: "project" | "compact" | "center" | "topic";
  emptyLabel: string;
  items: Array<{ id: string; title: string; meta: string; value?: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={disabled ? `multi-filter-group ${variant} disabled` : `multi-filter-group ${variant}`}>
      <div className="multi-filter-head">
        <strong>{title}</strong>
        <button className={selectedIds.length === 0 ? "active" : ""} type="button" onClick={onClear} disabled={disabled}>
          {emptyLabel}
        </button>
      </div>
      <div className="multi-filter-options">
        {disabled ? (
          <p className="filter-empty-hint">按层级选择后显示可选项</p>
        ) : items.map((item) => (
          <button
            className={selectedIds.includes(item.id) ? "active" : ""}
            key={item.id}
            type="button"
            onClick={() => onToggle(item.id)}
          >
            <span>{item.title}</span>
            <small>{item.meta}</small>
            {item.value ? <em>{item.value}</em> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function DataTable({
  columns,
  rows,
  toneColumn,
  selectedKey,
  selectedKeys,
  onRowClick,
}: {
  columns: string[];
  rows: string[][];
  toneColumn?: number;
  selectedKey?: string;
  selectedKeys?: string[];
  onRowClick?: (row: string[]) => void;
}) {
  const selectedSet = new Set(selectedKeys ?? (selectedKey ? [selectedKey] : []));
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              className={selectedSet.has(row.join("-")) ? "selected" : ""}
              key={row.join("-")}
              onClick={() => onRowClick?.(row)}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={(event) => {
                if (!onRowClick) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowClick(row);
                }
              }}
            >
              {row.map((cell, index) => (
                <td key={`${cell}-${index}`}>
                  {index === toneColumn ? <StatusBadge tone={cellTone(cell)}>{cell}</StatusBadge> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildDrilldownScope(filter: DrilldownFilter): string {
  return [
    formatTimeRange(filter.timeRange, filter.customTimeRange, filter.timePeriod),
    buildProjectScope(filter.selectedProjectIds),
    buildAreaScope(filter.selectedRegions, filter.selectedCities, filter.selectedCenters),
    buildTopicScope(filter.selectedTopics),
  ].join(" / ");
}

function buildContextStats(filter: DrilldownFilter): Array<{ label: string; value: string }> {
  const filteredRows = filterDrilldownRows(filter);
  return [
    { label: "项目范围", value: buildProjectScope(filter.selectedProjectIds) },
    { label: "时间范围", value: formatContextTimeRange(filter) },
    { label: "样本量", value: `${getCurrentScopeRawFeedbackTotal(filter, filteredRows).toLocaleString()} 条` },
    { label: "筛选范围", value: `${buildAreaScope(filter.selectedRegions, filter.selectedCities, filter.selectedCenters)} / ${buildTopicScope(filter.selectedTopics)}` },
  ];
}

function formatTimeRange(timeRange: string, customTimeRange?: string, timePeriod?: string): string {
  if (timeRange === "全部时间") return "全部时间";
  if (timeRange === "自定义") return customTimeRange ?? "自定义时间段";
  const value = timePeriod || defaultTimePeriodValues[timeRange] || "";
  if (!value) return timeRange;
  if (timeRange === "季度") return `季度：${value.replace("-Q", " Q")}`;
  if (timeRange === "周") return `周：${value}`;
  if (timeRange === "年") return `年：${value}`;
  if (timeRange === "月") return `月：${value}`;
  return `日：${value}`;
}

function formatContextTimeRange(filter: DrilldownFilter): string {
  const bounds = getTimeBoundsForFilter(filter);
  if (!bounds) return formatTimeRange(filter.timeRange, filter.customTimeRange, filter.timePeriod);
  return bounds.start === bounds.end ? bounds.start : `${bounds.start} 至 ${bounds.end}`;
}

function getTimeBoundsForFilter(filter: DrilldownFilter): { start: string; end: string } | null {
  if (filter.timeRange === "全部时间") return null;

  if (filter.timeRange === "自定义") {
    const [start, end] = filter.customTimeRange.split(" 至 ");
    return start && end ? { start, end } : null;
  }

  const value = filter.timePeriod || defaultTimePeriodValues[filter.timeRange] || "";
  if (!value) return null;

  if (filter.timeRange === "日") return { start: value, end: value };

  if (filter.timeRange === "周") {
    const match = value.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return null;
    return getIsoWeekBounds(Number(match[1]), Number(match[2]));
  }

  if (filter.timeRange === "月") {
    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    return {
      start: `${match[1]}-${match[2]}-01`,
      end: `${match[1]}-${match[2]}-${String(daysInMonth(year, month)).padStart(2, "0")}`,
    };
  }

  if (filter.timeRange === "季度") {
    const match = value.match(/^(\d{4})-?Q([1-4])$/);
    if (!match) return null;
    const year = Number(match[1]);
    const quarter = Number(match[2]);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    return {
      start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
      end: `${year}-${String(endMonth).padStart(2, "0")}-${String(daysInMonth(year, endMonth)).padStart(2, "0")}`,
    };
  }

  if (filter.timeRange === "年" && /^\d{4}$/.test(value)) {
    return { start: `${value}-01-01`, end: `${value}-12-31` };
  }

  return null;
}

function getIsoWeekBounds(year: number, week: number): { start: string; end: string } {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const start = new Date(jan4);
  start.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: formatUtcDate(start), end: formatUtcDate(end) };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function projectOverlapsTimeRange(project: ImportedProject, bounds: { start: string; end: string }): boolean {
  const projectBounds = getProjectDateBounds(project);
  if (!projectBounds) return true;
  return projectBounds.start <= bounds.end && projectBounds.end >= bounds.start;
}

function getProjectDateBounds(project: ImportedProject): { start: string; end: string } | null {
  const match = project.dateRange.match(/^(\d{4}-\d{2}-\d{2}) 至 (\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return { start: match[1], end: match[2] };
}

function buildProjectScope(selectedProjectIds: string[]): string {
  if (selectedProjectIds.length === 0) return "全部项目";
  const names = selectedProjectIds
    .map((id) => importedProjects.find((project) => project.id === id)?.name ?? id);
  if (names.length === 1) return names[0];
  return `${names.length} 个项目：${names.join("、")}`;
}

function buildAreaScope(selectedRegions: string[], selectedCities: string[], selectedCenters: string[]): string {
  if (selectedCenters.length) return `服务中心：${selectedCenters.join("、")}`;
  if (selectedCities.length) return `城市：${selectedCities.join("、")}`;
  if (selectedRegions.length) return `区域：${selectedRegions.join("、")}`;
  return "全国";
}

function buildTopicScope(selectedTopics: string[]): string {
  if (selectedTopics.length === 0) return "全部主题";
  if (selectedTopics.length === 1) return `主题：${selectedTopics[0]}`;
  return `${selectedTopics.length} 个主题：${selectedTopics.join("、")}`;
}

function buildReportFilter(filter: DrilldownFilter, scenario: string | null): DrilldownFilter {
  if (!scenario) return filter;
  const scenarioTopics: Record<string, string[]> = {
    服务问题闭环: ["等待时间", "解释不清"],
    满意度归因: ["等待时间", "解释不清", "移动服务"],
    区域城市督查端: ["等待时间", "App 同步", "交付解释"],
    活动体验复盘: ["交付解释", "移动服务"],
    口碑投诉与风险: ["等待时间", "解释不清", "App 同步"],
  };
  return {
    ...filter,
    selectedTopics: scenarioTopics[scenario] ?? filter.selectedTopics,
  };
}

function buildScopeMetricCards(filter: DrilldownFilter, filteredRows = filterDrilldownRows(filter)) {
  const total = getCurrentScopeRawFeedbackTotal(filter, filteredRows);
  const rowFeedbackTotal = getRowFeedbackTotal(filteredRows);
  const weightedScore = getWeightedAverageRating(filteredRows);
  const riskCount = filteredRows.filter((row) => row[5] !== "低").length;
  const highScoreFeedback = Math.round(total * getPositiveRatio(filteredRows));
  const lowScoreFeedback = Math.round(total * getRiskRatio(filteredRows));
  const nps = Math.max(-100, Math.min(100, Math.round(((highScoreFeedback - lowScoreFeedback) / Math.max(total, 1)) * 100)));
  const areaCount = uniqueColumn(filteredRows, 0).length;
  const centerCount = filteredRows.length;

  return [
    {
      label: "反馈量",
      value: total.toLocaleString(),
      helper: `覆盖 ${areaCount} 个区域 / ${centerCount} 个服务中心`,
      tone: "neutral" as const,
    },
    {
      label: "平均服务评分",
      value: weightedScore.toFixed(2),
      helper: filteredRows.length ? "按当前范围服务中心加权" : "当前范围暂无服务中心",
      tone: weightedScore < 4.2 ? "warning" as const : "pass" as const,
    },
    {
      label: "净推荐值",
      value: String(nps),
      helper: `高分反馈 ${highScoreFeedback.toLocaleString()} / 低分反馈 ${lowScoreFeedback.toLocaleString()}`,
      tone: nps < 20 ? "warning" as const : "pass" as const,
    },
    {
      label: "低分反馈",
      value: lowScoreFeedback.toLocaleString(),
      helper: riskCount ? `${riskCount} 个风险对象，优先看原文和工单` : "当前范围暂无风险对象",
      tone: lowScoreFeedback > 0 ? "risk" as const : "pass" as const,
    },
  ];
}

function buildSelectionLabel(items: string[], emptyLabel: string): string {
  if (items.length === 0) return emptyLabel;
  if (items.length === 1) return items[0];
  return `${items.length} 项：${items.join("、")}`;
}

function uniqueColumn(rows: string[][], index: number): string[] {
  return Array.from(new Set(rows.map((row) => row[index])));
}

function getCitiesByRegions(selectedRegions: string[]): string[] {
  const rows = selectedRegions.length
    ? drilldownRows.filter((row) => selectedRegions.includes(row[0]))
    : [];
  return uniqueColumn(rows, 1);
}

function getCentersByCities(selectedRegions: string[], selectedCities: string[]): string[][] {
  if (selectedCities.length === 0) return [];
  return drilldownRows.filter((row) => {
    const regionMatched = selectedRegions.length === 0 || selectedRegions.includes(row[0]);
    return regionMatched && selectedCities.includes(row[1]);
  });
}

function cityBelongsToRegions(city: string, selectedRegions: string[]): boolean {
  if (selectedRegions.length === 0) return false;
  return drilldownRows.some((row) => row[1] === city && selectedRegions.includes(row[0]));
}

function centerBelongsToCities(center: string, selectedRegions: string[], selectedCities: string[]): boolean {
  if (selectedCities.length === 0) return false;
  return drilldownRows.some((row) => {
    const regionMatched = selectedRegions.length === 0 || selectedRegions.includes(row[0]);
    return regionMatched && selectedCities.includes(row[1]) && row[2] === center;
  });
}

function filterDrilldownRows(filter: DrilldownFilter): string[][] {
  return drilldownRows.filter((row) => {
    const regionMatched = filter.selectedRegions.length === 0 || filter.selectedRegions.includes(row[0]);
    const cityMatched = filter.selectedCities.length === 0 || filter.selectedCities.includes(row[1]);
    const centerMatched = filter.selectedCenters.length === 0 || filter.selectedCenters.includes(row[2]);
    const rowTopics = getRowTopics(row);
    const topicMatched = filter.selectedTopics.length === 0 || filter.selectedTopics.some((topic) => rowTopics.includes(topic));
    return regionMatched && cityMatched && centerMatched && topicMatched;
  });
}

function getRowTopics(row: string[]): string[] {
  const reason = row[6];
  const topics = new Set<string>();
  if (reason.includes("等待")) topics.add("等待时间");
  if (reason.includes("解释")) topics.add("解释不清");
  if (reason.includes("App") || reason.includes("同步")) topics.add("App 同步");
  if (reason.includes("交付")) topics.add("交付解释");
  if (reason.includes("移动")) topics.add("移动服务");
  return Array.from(topics);
}

function projectCountValue(project: ImportedProject): number {
  return Number(project.count.replace(/,/g, ""));
}

function totalProjectCount(projects: ImportedProject[]): string {
  return projects.reduce((sum, project) => sum + projectCountValue(project), 0).toLocaleString();
}

function getRowFeedbackTotal(rows: string[][]): number {
  return rows.reduce((sum, row) => sum + Number(row[3].replace(/,/g, "")), 0);
}

function getWeightedAverageRating(rows: string[][]): number {
  const total = getRowFeedbackTotal(rows);
  if (total === 0) return 0;
  const weighted = rows.reduce((sum, row) => {
    const count = Number(row[3].replace(/,/g, ""));
    const rating = Number(row[4]);
    return sum + count * (Number.isFinite(rating) ? rating : 0);
  }, 0);
  return weighted / total;
}

function getRiskRatio(rows: string[][]): number {
  if (rows.length === 0) return 0;
  const weightedRisk = rows.reduce((sum, row) => {
    const count = Number(row[3].replace(/,/g, ""));
    const riskRatio = row[5] === "高" ? 0.26 : row[5] === "中" ? 0.16 : 0.05;
    return sum + count * riskRatio;
  }, 0);
  return weightedRisk / Math.max(getRowFeedbackTotal(rows), 1);
}

function getPositiveRatio(rows: string[][]): number {
  if (rows.length === 0) return 0;
  const weightedPositive = rows.reduce((sum, row) => {
    const count = Number(row[3].replace(/,/g, ""));
    const rating = Number(row[4]);
    const positiveRatio = rating >= 4.7 ? 0.64 : rating >= 4.3 ? 0.52 : rating >= 4.1 ? 0.44 : 0.34;
    return sum + count * positiveRatio;
  }, 0);
  return weightedPositive / Math.max(getRowFeedbackTotal(rows), 1);
}

function getActiveProjectsForFilter(filter: DrilldownFilter): ImportedProject[] {
  const selectedProjects = filter.selectedProjectIds
    .map((projectId) => importedProjects.find((project) => project.id === projectId))
    .filter((project): project is ImportedProject => Boolean(project));
  const projectPool = selectedProjects.length ? selectedProjects : importedProjects;
  const timeBounds = getTimeBoundsForFilter(filter);
  if (!timeBounds) return projectPool;
  return projectPool.filter((project) => projectOverlapsTimeRange(project, timeBounds));
}

function getCurrentScopeRawFeedbackTotal(filter: DrilldownFilter, filteredRows: string[][]): number {
  const activeProjects = getActiveProjectsForFilter(filter);
  if (activeProjects.length === 0) return 0;
  const projectTotal = activeProjects.reduce((sum, project) => sum + projectCountValue(project), 0);
  const hasRowScope = filter.selectedRegions.length > 0
    || filter.selectedCities.length > 0
    || filter.selectedCenters.length > 0
    || filter.selectedTopics.length > 0;

  if (!hasRowScope) return projectTotal;

  const rowTotal = getRowFeedbackTotal(filteredRows);
  if (rowTotal === 0) return 0;

  const baseRowTotal = getRowFeedbackTotal(drilldownRows);
  if (!filter.selectedRegions.length && !filter.selectedCities.length && !filter.selectedCenters.length && filter.selectedTopics.length) {
    return Math.round(projectTotal * (rowTotal / Math.max(baseRowTotal, 1)));
  }

  return rowTotal;
}

function buildRawFeedbackPage(
  filter: DrilldownFilter,
  filteredRows: string[][],
  startIndex: number,
  endIndex: number,
): RawFeedbackRecord[] {
  if (startIndex === 0 || endIndex === 0 || startIndex > endIndex) return [];

  const rowPool = filteredRows.length ? filteredRows : drilldownRows;
  const projectPool = getActiveProjectsForFilter(filter);
  if (projectPool.length === 0) return [];

  return Array.from({ length: endIndex - startIndex + 1 }, (_, offset) => {
    const recordNumber = startIndex + offset;
    const source = evidenceQuotes[(recordNumber - 1) % evidenceQuotes.length];
    const row = rowPool[(recordNumber - 1) % rowPool.length] ?? drilldownRows[0];
    const project = projectPool[(recordNumber - 1) % projectPool.length] ?? importedProjects[0];
    const topic = filter.selectedTopics.length
      ? filter.selectedTopics[(recordNumber - 1) % filter.selectedTopics.length]
      : row[6];
    const tone: StatusTone = row[5] === "高" ? "risk" : row[5] === "中" ? "warning" : source.tone;

    return {
      ...source,
      feedbackId: `FB-${String(recordNumber).padStart(5, "0")}`,
      projectName: project.name,
      recordNumber,
      location: `${row[1]} / ${row[2]}`,
      scenario: topic.includes("App") ? "App/OTA" : topic.includes("移动") ? "移动服务" : source.scenario,
      reason: `${row[0]}${row[1]}${row[2]}当前范围样本：${row[6]}；${source.reason}`,
      tone,
    };
  });
}

function cellTone(value: string): StatusTone {
  if (["已识别", "已通过", "已脱敏", "已导入", "低"].includes(value)) return "pass";
  if (["需确认", "需配置", "待配置", "中"].includes(value)) return "warning";
  if (["错误", "异常", "高"].includes(value)) return "risk";
  return "neutral";
}

function buildServiceCenterWorkOrderDraft(row: string[], scopeLabel: string): WorkOrderDraft {
  const [region, city, serviceCenter, count, rating, risk, reason] = row;
  const insight: FocusRegionInsight = {
    title: `${serviceCenter}${risk === "高" ? "高风险处理" : "体验问题复核"}`,
    tone: risk === "低" ? "good" : "risk",
    location: city,
    serviceCenter,
    totalFeedback: Number(count.replace(/,/g, "")) || 0,
    representativeCount: buildDomainEvidenceQuotes(row).length,
    commonPattern: `${region}${city}${serviceCenter}：${reason}，当前评分 ${rating}，风险等级 ${risk}`,
    recommendedAction:
      "请服务中心核实对应低分样本，明确等待、解释、同步或交付问题的原因、责任人、处理时限和回访口径，并在下次复盘前回传处理结果。",
    evidenceQuotes: buildDomainEvidenceQuotes(row),
  };

  return createWorkOrderDraftFromInsight({
    insight,
    scopeLabel,
    channel: "email",
  });
}

function buildDomainEvidenceQuotes(row: string[]): DomainEvidenceQuote[] {
  const [, city, serviceCenter, , , risk, reason] = row;
  const matchedEvidence = evidenceQuotes.filter((item) => item.location.includes(city) || item.location.includes(serviceCenter));
  const fallbackEvidence = evidenceQuotes.filter((item) => item.tone !== "pass");
  const items = [...matchedEvidence, ...fallbackEvidence].filter((item, index, source) =>
    source.findIndex((candidate) => candidate.quote === item.quote) === index,
  );

  return items.map((item, index) => ({
    feedbackId: `dashboard-${serviceCenter}-${index + 1}`,
    quote: item.quote,
    sentiment: item.tone === "pass" ? "正向" : item.tone === "risk" ? "负向" : "中性",
    serviceStage: inferServiceStage(reason),
    reasonToUse: `${risk}风险服务中心工单证据：${item.reason}`,
    scoreSource: {
      rating: parseScore(item.rating),
      npsScore: parseScore(item.nps),
      submittedAt: item.submittedAt,
      sourceLabel: item.source,
      location: item.location,
      serviceScenario: inferServiceScenario(item.scenario),
    },
  }));
}

function buildQaAgentRecords(filter: DrilldownFilter, contextProject?: ImportedProject | null): NormalizedFeedback[] {
  const rows = filterDrilldownRows(filter);
  const projects = contextProject
    ? [contextProject]
    : filter.selectedProjectIds.length
      ? filter.selectedProjectIds
        .map((projectId) => importedProjects.find((project) => project.id === projectId))
        .filter((project): project is ImportedProject => Boolean(project))
      : importedProjects;
  const activeRows = rows.length ? rows : drilldownRows;
  return activeRows.flatMap((row) =>
    evidenceQuotes.map((evidence, index) => {
      const project = projects[index % projects.length] ?? importedProjects[0];
      return mapEvidenceToNormalizedFeedback(evidence, row, project, `${row[2]}-${index + 1}`);
    }),
  );
}

function mapEvidenceToNormalizedFeedback(
  evidence: Evidence,
  row: string[],
  project: ImportedProject,
  idSuffix: string,
): NormalizedFeedback {
  const [region, city, serviceCenter] = row;
  return {
    id: `app-qa-${idSuffix}`,
    submittedAt: evidence.submittedAt.replace(" ", "T"),
    platform: normalizeSurveyPlatform(evidence.source),
    region: normalizeRegion(region),
    city,
    serviceCenter,
    serviceScenario: normalizeServiceScenario(evidence.scenario),
    rating: parseScore(evidence.rating),
    npsScore: parseScore(evidence.nps),
    feedbackText: evidence.quote,
    contact: {
      consentState: evidence.tone === "risk" ? "已授权联系" : "未询问",
    },
    sourceLabel: evidence.source,
    displayLocation: `${city} / ${serviceCenter}`,
    projectName: project.name,
    projectType: project.type,
  };
}

function buildQaAgentScopeLabel(filter: DrilldownFilter, contextProject?: ImportedProject | null): string {
  return [
    formatTimeRange(filter.timeRange, filter.customTimeRange, filter.timePeriod),
    contextProject ? contextProject.name : buildProjectScope(filter.selectedProjectIds),
    buildAreaScope(filter.selectedRegions, filter.selectedCities, filter.selectedCenters),
    buildTopicScope(filter.selectedTopics),
  ].join(" / ");
}

function buildQaScopeSnapshot(mode: QaScopeMode, filter: DrilldownFilter, contextProjectId: string | null): QaScopeSnapshot {
  const contextProject = getQaProjectById(contextProjectId);
  const snapshotFilter = cloneDrilldownFilter(mode === "filtered" ? filter : defaultDrilldownFilter);
  return {
    mode,
    filter: snapshotFilter,
    contextProjectId,
    label: buildQaAgentScopeLabel(snapshotFilter, contextProject),
  };
}

function getQaProjectById(projectId: string | null): ImportedProject | null {
  if (!projectId) return null;
  return qaProjects.find((project) => project.id === projectId) ?? null;
}

function cloneDrilldownFilter(filter: DrilldownFilter): DrilldownFilter {
  return {
    ...filter,
    selectedProjectIds: [...filter.selectedProjectIds],
    selectedRegions: [...filter.selectedRegions],
    selectedCities: [...filter.selectedCities],
    selectedCenters: [...filter.selectedCenters],
    selectedTopics: [...filter.selectedTopics],
  };
}

function buildQaRetrievalScope(filter: DrilldownFilter, contextProject?: ImportedProject | null) {
  const projectNames = contextProject
    ? [contextProject.name]
    : filter.selectedProjectIds
      .map((projectId) => importedProjects.find((project) => project.id === projectId)?.name)
      .filter((name): name is string => Boolean(name));
  return {
    projectNames,
    cities: filter.selectedCities,
    serviceCenters: filter.selectedCenters,
  };
}

function buildLegacyThreadMessages(threadId: string): QaMessage[] {
  const question = buildLegacyThreadQuestion(threadId);
  const answer = buildLegacyThreadAnswer(threadId);
  return [
    { id: `${threadId}-question`, role: "user", text: question },
    { id: `${threadId}-answer`, role: "assistant", text: answer },
  ];
}

function buildLegacyThreadEvidenceQuotes(threadId: string): DomainEvidenceQuote[] {
  if (threadId === "field-service-good") return buildDomainEvidenceQuotes(drilldownRows[1]);
  if (threadId === "app-sync") return buildDomainEvidenceQuotes(drilldownRows[2]);
  return buildDomainEvidenceQuotes(drilldownRows[0]);
}

function buildLegacyThreadQuestion(threadId: string): string {
  if (threadId === "field-service-good") return "移动服务正向案例可以提炼成哪些标准动作？";
  if (threadId === "app-sync") return "App 预约同步异常主要影响哪些服务中心？";
  return "杭州西溪服务中心低分主要集中在哪些环节？";
}

function buildLegacyThreadAnswer(threadId: string): string {
  if (threadId === "field-service-good") {
    return "正向样本集中在提前联系、到场准时、处理后解释清楚三个动作。建议把这三个动作写成移动服务检查项，并复制给承担上门服务的服务中心。";
  }
  if (threadId === "app-sync") {
    return "App 预约同步异常主要出现在预约确认后门店未同步的场景，会放大等待和解释压力，建议进入人工复核清单。";
  }
  return "低分主要集中在到店等待和接待解释两个环节。建议先把预约确认、到店排队和异常解释口径做成闭环清单。";
}

function qaEvidenceTone(evidence: DomainEvidenceQuote): StatusTone {
  if (evidence.sentiment === "负向") return "risk";
  if (evidence.sentiment === "中性") return "warning";
  return "pass";
}

function formatQaEvidenceScore(evidence: DomainEvidenceQuote): string {
  const rating = evidence.scoreSource.rating ?? "-";
  const nps = evidence.scoreSource.npsScore ?? "-";
  return `${rating}/5 / NPS ${nps}`;
}

function normalizeSurveyPlatform(value: string): SurveyPlatform {
  if (value === "问卷星" || value === "企微链接" || value === "短信链接" || value === "金数据" || value === "腾讯问卷") return value;
  if (value === "App 内问卷") return "App内问卷";
  return "其他来源";
}

function normalizeRegion(value: string): Region | undefined {
  if (value === "华南" || value === "华东" || value === "华北" || value === "西南" || value === "华中" || value === "西北" || value === "东北") return value;
  return undefined;
}

function normalizeServiceScenario(value: string): ServiceScenario {
  if (value === "到店服务" || value === "移动服务" || value === "补能体验" || value === "App/OTA" || value === "活动/社群") return value;
  return "其他";
}

function parseScore(value: string): number | undefined {
  const parsed = Number(value.split("/")[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inferServiceStage(reason: string): DomainEvidenceQuote["serviceStage"] {
  if (reason.includes("App") || reason.includes("同步")) return "软件与智能化";
  if (reason.includes("等待") || reason.includes("解释")) return "服务接待";
  if (reason.includes("交付")) return "服务质量";
  return "服务接待";
}

function inferServiceScenario(value: string): DomainEvidenceQuote["scoreSource"]["serviceScenario"] {
  if (value === "到店服务" || value === "移动服务" || value === "补能体验" || value === "App/OTA" || value === "活动/社群") return value;
  return "其他";
}

function getServiceCenterEmail(serviceCenter: string): string {
  const directory: Record<string, string> = {
    西溪服务中心: "xixi.service-center@example.com",
    天河服务中心: "tianhe.service-center@example.com",
    高新服务中心: "gaoxin.service-center@example.com",
    望京服务中心: "wangjing.service-center@example.com",
  };
  return directory[serviceCenter] ?? "service-center-owner@example.com";
}
