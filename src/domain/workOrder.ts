import type { AnalysisFinding, FocusRegionInsight, WorkbenchScenario } from "./types";

export type WorkOrderDeliveryChannel = "email" | "feishu" | "wecom" | "dingtalk";

export type WorkOrderDraft = {
  id: string;
  channel: WorkOrderDeliveryChannel;
  integrationTargetOptions: WorkOrderDeliveryChannel[];
  recipientHint: string;
  subject: string;
  city: string;
  serviceCenter: string;
  scopeLabel: string;
  scenario: WorkbenchScenario;
  issueSummary: string;
  suggestedAction: string;
  evidence: Array<{
    quote: string;
    submittedAt: string;
    sourceLabel: string;
    location: string;
    rating?: number;
    recommendationScore?: number;
  }>;
  copyableText: string;
};

export type WorkOrderEmailDraft = {
  to: string;
  subject: string;
  body: string;
  mailtoHref: string;
};

export function createWorkOrderDraftFromInsight(input: {
  insight: FocusRegionInsight;
  scopeLabel: string;
  relatedFinding?: AnalysisFinding;
  channel?: WorkOrderDeliveryChannel;
}): WorkOrderDraft {
  const channel = input.channel ?? "email";
  const scenario = input.relatedFinding ? inferScenarioFromFinding(input.relatedFinding) : "区域/城市下钻";
  const evidence = input.insight.evidenceQuotes.map((quote) => ({
    quote: quote.quote,
    submittedAt: quote.scoreSource.submittedAt,
    sourceLabel: quote.scoreSource.sourceLabel,
    location: quote.scoreSource.location,
    rating: quote.scoreSource.rating,
    recommendationScore: quote.scoreSource.npsScore,
  }));
  const issueSummary = [
    input.insight.title,
    input.insight.commonPattern,
    input.relatedFinding?.summary,
  ].filter(Boolean).join("；");
  const workOrderType = input.insight.tone === "risk" ? "服务体验问题处理" : "优秀服务案例确认";
  const subject = `【售后反馈工单】${input.insight.location}/${input.insight.serviceCenter} · ${workOrderType}`;
  const suggestedAction = normalizeActionText(input.insight.recommendedAction, input.insight.tone);
  const workOrderId = `WO-${hashText(`${input.scopeLabel}-${input.insight.location}-${input.insight.serviceCenter}`)}`;
  const copyableText = [
    subject,
    "",
    `工单编号：${workOrderId}`,
    `工单类型：${workOrderType}`,
    `处理单位：${input.insight.location} / ${input.insight.serviceCenter}`,
    `反馈范围：${input.scopeLabel}`,
    `问题描述：${issueSummary}`,
    `处理要求：${suggestedAction}`,
    "处理时限：请在 48 小时内完成原因核实、责任人确认和首次处理反馈。",
    "回访要求：如样本已授权联系，请优先完成车主回访；如未授权，请由服务中心补充内部处理说明。",
    "结果回传：请回传处理结论、责任归属、完成时间和是否需要升级支持。",
    "",
    "反馈证据：",
    ...evidence.map(
      (item, index) =>
        `${index + 1}. ${item.submittedAt} · ${item.location} · 服务评分 ${item.rating ?? "-"} / 推荐意愿评分 ${item.recommendationScore ?? "-"} · ${item.sourceLabel}\n   “${item.quote}”`,
    ),
  ].join("\n");

  return {
    id: workOrderId,
    channel,
    integrationTargetOptions: ["email", "feishu", "wecom", "dingtalk"],
    recipientHint: `${input.insight.serviceCenter}负责人邮箱或协同应用群`,
    subject,
    city: input.insight.location,
    serviceCenter: input.insight.serviceCenter,
    scopeLabel: input.scopeLabel,
    scenario,
    issueSummary,
    suggestedAction,
    evidence,
    copyableText,
  };
}

export function createWorkOrderEmailDraft(draft: WorkOrderDraft, recipientEmail: string): WorkOrderEmailDraft {
  const to = recipientEmail.trim();
  const subject = draft.subject;
  const body = draft.copyableText;

  return {
    to,
    subject,
    body,
    mailtoHref: `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}

function inferScenarioFromFinding(finding: AnalysisFinding): WorkbenchScenario {
  if (finding.sentiment === "正向") return "口碑素材与风险";
  return "服务问题闭环";
}

function normalizeActionText(action: string, tone: "good" | "risk"): string {
  if (tone === "good") {
    return "请服务中心补充本次正向反馈对应的接待动作、沟通话术、执行节点和适用条件，用于后续区域经验复用。";
  }
  return action.replace("先拉出低分样本做回访核实，再要求服务中心给出原因、责任人和下周复盘状态。", "请先核实低分样本，明确问题原因、责任人、处理动作和回访口径，并在下周复盘中回传处理状态。");
}

function hashText(text: string): string {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 1000000;
  }
  return String(hash).padStart(6, "0");
}
