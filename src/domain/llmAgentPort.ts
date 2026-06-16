import { answerWorkbenchQuestion, type WorkbenchAgentAnswer } from "./agentRules";
import type { AgentRunStage } from "./agentConversation";
import type { SupabaseAgentRetrievalScope } from "./supabaseAgentRetrievalPort";
import type { AnalysisFinding, MetricSummary, NormalizedFeedback } from "./types";

export type WorkbenchAgentRequest = {
  question: string;
  records: NormalizedFeedback[];
  metrics: MetricSummary;
  findings: AnalysisFinding[];
  scopeLabel: string;
  retrievalScope?: SupabaseAgentRetrievalScope;
  onProgress?: (stage: AgentRunStage) => void;
  onToken?: (delta: string, fullText: string) => void;
  onReasoningToken?: (delta: string, fullText: string) => void;
};

export type WorkbenchAgentPort = {
  answer: (request: WorkbenchAgentRequest) => Promise<WorkbenchAgentAnswer>;
};

export const localRuleAgentPort: WorkbenchAgentPort = {
  answer: async (request) => answerWorkbenchQuestion(request),
};
