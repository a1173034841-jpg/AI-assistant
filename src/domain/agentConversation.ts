import type { ProjectSelection, WorkbenchScenario } from "./types";

export type AgentRunStage =
  | "prepare-context"
  | "check-scope"
  | "retrieve-database"
  | "requesting-model"
  | "streaming-answer"
  | "archive-turn";

export type AgentProgressStep = {
  id: AgentRunStage;
  label: string;
  description: string;
  status: "completed" | "active" | "pending";
};

export type AgentConversationTurn = {
  id: string;
  askedAt: string;
  question: string;
  answer: string;
  projectScope: string;
  reportTitle: string;
  scenario: WorkbenchScenario;
  refused: boolean;
  evidenceCount: number;
};

export type QaConversationRecord = {
  id: string;
  title: string;
  meta: string;
};

const progressStepDefinitions: Array<Omit<AgentProgressStep, "status">> = [
  {
    id: "prepare-context",
    label: "整理范围",
    description: "读取当前筛选范围、指标和可用原话证据。",
  },
  {
    id: "check-scope",
    label: "检查边界",
    description: "确认问题属于售后运营数据可回答范围。",
  },
  {
    id: "retrieve-database",
    label: "检索证据",
    description: "从当前数据和向量检索结果中召回相关证据片段。",
  },
  {
    id: "requesting-model",
    label: "请求模型",
    description: "把范围、证据和问题提交给问答模型。",
  },
  {
    id: "streaming-answer",
    label: "返回结果",
    description: "问答模型正在逐段返回回答。",
  },
  {
    id: "archive-turn",
    label: "保存记录",
    description: "保存问题、答案、时间和范围。",
  },
];

export function buildAgentProgressSteps(activeStage: AgentRunStage): AgentProgressStep[] {
  const activeIndex = progressStepDefinitions.findIndex((step) => step.id === activeStage);
  return progressStepDefinitions.map((step, index) => ({
    ...step,
    status: index < activeIndex ? "completed" : index === activeIndex ? "active" : "pending",
  }));
}

export function getAgentProgressPercent(activeStage: AgentRunStage): number {
  const activeIndex = progressStepDefinitions.findIndex((step) => step.id === activeStage);
  if (activeIndex < 0) return 0;
  return Math.round(((activeIndex + 1) / progressStepDefinitions.length) * 100);
}

export function toNaturalLanguageAnswer(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/```[\w-]*\n?/g, "")
    .replace(/\n?```/g, "")
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s*/, "")
        .replace(/^>\s*/, "")
        .replace(/^[-*+]\s+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\s+\|+\s*/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function buildAgentConversationTitle(selection: ProjectSelection): string {
  if (selection.mode === "all") return "全部项目";
  if (selection.mode === "byType") return `项目类型：${selection.projectTypes.join("、")}`;
  if (selection.projectNames.length === 1) return selection.projectNames[0];
  return `项目组合：${selection.projectNames.join("、")}`;
}

export function buildAutoConversationTitle(question: string): string {
  const compact = question.replace(/[？?。！!，,、\s]/g, "");
  const centerMatch = compact.match(/([\u4e00-\u9fa5A-Za-z0-9]{2,12}服务中心)/);
  if (centerMatch?.[1] && compact.includes("低分")) return `${centerMatch[1]}低分闭环`;
  if (compact.includes("等待")) return "等待时间影响服务中心";
  if (compact.includes("App") || compact.includes("预约")) return "预约同步异常分析";
  if (compact.includes("满意度") || compact.includes("评分")) return "满意度变化原因";
  if (compact.length <= 12) return compact || "新问答";
  return compact.slice(0, 12);
}

export function buildAfterSalesQaAnswer(input: {
  question: string;
  scopeLabel: string;
  projectName?: string | null;
}): string {
  const project = input.projectName ? `项目：${input.projectName}` : "项目：全部已导入项目";
  const lowerQuestion = input.question.toLowerCase();
  const isWaitQuestion = input.question.includes("等待") || lowerQuestion.includes("wait");
  const isAppQuestion = input.question.includes("App") || input.question.includes("预约") || input.question.includes("同步");

  if (isWaitQuestion) {
    return `结论：等待时间需要回到当前范围内的服务中心和原文证据判断。${project}，范围：${input.scopeLabel}。请优先查看“到店仍等待较久”“无人主动告知排队时长”“异常解释不清”三类表达。下一步：按命中服务中心生成闭环动作。`;
  }

  if (isAppQuestion) {
    return `结论：预约同步异常需要按当前范围内的项目、城市和服务中心确认。${project}，范围：${input.scopeLabel}。用户反馈如果出现“页面已确认、门店未同步”，应进入人工复核清单。下一步：检查门店确认节点。`;
  }

  return `结论：当前范围内最需要关注的问题应由已导入反馈、筛选范围和引用证据共同决定。${project}，范围：${input.scopeLabel}。下一步：按命中的服务中心生成闭环工单，并回到原文池查看完整命中样本。`;
}

export function removeQaConversationRecord(
  threads: QaConversationRecord[],
  threadId: string,
  selectedThreadId: string | null,
): { threads: QaConversationRecord[]; selectedThreadId: string | null } {
  return {
    threads: threads.filter((thread) => thread.id !== threadId),
    selectedThreadId: selectedThreadId === threadId ? null : selectedThreadId,
  };
}

export function createAgentConversationTurn(input: {
  id: string;
  askedAt: string;
  question: string;
  answer: string;
  scopeLabel: string;
  reportTitle: string;
  scenario: WorkbenchScenario;
  refused: boolean;
  evidenceCount: number;
}): AgentConversationTurn {
  return {
    id: input.id,
    askedAt: input.askedAt,
    question: input.question,
    answer: toNaturalLanguageAnswer(input.answer),
    projectScope: input.scopeLabel,
    reportTitle: input.reportTitle,
    scenario: input.scenario,
    refused: input.refused,
    evidenceCount: input.evidenceCount,
  };
}
