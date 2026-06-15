export type AgentQuestionIntent =
  | "data_inventory"
  | "metric_explanation"
  | "attribution_analysis"
  | "evidence_trace"
  | "range_filter"
  | "operation_action"
  | "tool_usage"
  | "general_workbench";

export type AgentQuestionRejectReason = "empty" | "clearly_unrelated" | "sensitive_data";

export type AgentQuestionClassification =
  | {
      allowed: true;
      intent: AgentQuestionIntent;
      reason: string;
    }
  | {
      allowed: false;
      reason: AgentQuestionRejectReason;
      message: string;
    };

const sensitiveTerms = ["手机号", "手机号码", "电话号码", "车牌", "VIN", "vin", "住址", "身份证", "姓名"];
const unrelatedTerms = ["诗", "天气", "股票", "菜谱", "翻译", "笑话", "旅游", "电影", "小说", "游戏攻略"];

const intentRules: Array<{
  intent: AgentQuestionIntent;
  reason: string;
  terms: string[];
}> = [
  {
    intent: "tool_usage",
    reason: "question asks how to use this workbench",
    terms: ["怎么导入", "如何导入", "怎么上传", "怎么用", "模板", "CSV", "Excel", "表格", "按钮", "报告怎么看"],
  },
  {
    intent: "operation_action",
    reason: "question asks for follow-up action, closure, work order or callback list",
    terms: ["闭环", "回访", "授权", "工单", "跟进", "处理", "动作", "建议", "责任", "清单", "外发"],
  },
  {
    intent: "metric_explanation",
    reason: "question asks about metric value, metric definition or calculation method",
    terms: ["净推荐值", "NPS", "推荐者", "贬损者", "被动者", "满意率", "评分", "指标", "口径", "怎么算", "计算", "均值"],
  },
  {
    intent: "attribution_analysis",
    reason: "question asks for reason, concentration, abnormality, trend or comparison",
    terms: ["为什么", "原因", "归因", "集中", "异常", "下降", "上升", "变化", "对比", "拖累", "风险", "低分", "负向", "影响", "主要影响", "等待时间"],
  },
  {
    intent: "data_inventory",
    reason: "question asks about current data coverage, source channels, projects, regions or sample counts",
    terms: [
      "数据来源",
      "问卷来源",
      "来源",
      "渠道",
      "平台",
      "覆盖",
      "多少",
      "几个",
      "多少个",
      "多少条",
      "反馈量",
      "样本",
      "项目数",
      "城市",
      "服务中心",
      "问卷星",
      "腾讯问卷",
      "App",
    ],
  },
  {
    intent: "evidence_trace",
    reason: "question asks for source evidence or original feedback",
    terms: ["原话", "证据", "评论", "反馈内容", "支撑", "依据", "样本明细", "列出"],
  },
  {
    intent: "range_filter",
    reason: "question asks for filtering or drilling by time, project or geography",
    terms: ["筛选", "下钻", "范围", "时间", "日期", "周", "月", "季度", "项目", "区域", "华南", "华东", "城市", "全国"],
  },
  {
    intent: "general_workbench",
    reason: "question is broadly related to the current after-sales workbench context",
    terms: ["售后", "服务", "报告", "复盘", "运营", "问题", "当前", "这个结果", "这批数据", "本批"],
  },
];

export function classifyAgentQuestion(question: string): AgentQuestionClassification {
  const normalized = question.trim();
  if (!normalized) {
    return {
      allowed: false,
      reason: "empty",
      message: "请输入一个与当前售后反馈数据、指标、报告或运营动作相关的问题。",
    };
  }

  if (containsAny(normalized, sensitiveTerms)) {
    return {
      allowed: false,
      reason: "sensitive_data",
      message: "当前工作台不输出真实手机号、车牌、VIN、住址、姓名等敏感信息。可以改问授权状态、回访数量或脱敏后的样本范围。",
    };
  }

  if (containsAny(normalized, unrelatedTerms)) {
    return {
      allowed: false,
      reason: "clearly_unrelated",
      message: "我只能回答本工具、当前工作台、本批售后反馈数据、指标口径、报告结论、原话证据和运营闭环相关的问题。",
    };
  }

  const matchedRule = intentRules.find((rule) => containsAny(normalized, rule.terms));
  if (matchedRule) {
    return {
      allowed: true,
      intent: matchedRule.intent,
      reason: matchedRule.reason,
    };
  }

  return {
    allowed: true,
    intent: "general_workbench",
    reason: "question is treated as an in-page follow-up for the current workbench context",
  };
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}
