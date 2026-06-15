import { answerWorkbenchQuestion, type WorkbenchAgentAnswer } from "./agentRules";
import { toNaturalLanguageAnswer } from "./agentConversation";
import type { WorkbenchAgentPort, WorkbenchAgentRequest } from "./llmAgentPort";
import type { SupabaseAgentRetrievalResult } from "./supabaseAgentRetrievalPort";

type DeepSeekEnv = {
  VITE_DEEPSEEK_API_KEY?: string;
  VITE_DEEPSEEK_BASE_URL?: string;
  VITE_DEEPSEEK_MODEL?: string;
  VITE_DEEPSEEK_TIMEOUT_MS?: string;
};

type DeepSeekConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type DeepSeekStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
    };
  }>;
};

type AgentRetrievalPort = {
  retrieve: (request: { question: string; limit?: number; scope?: WorkbenchAgentRequest["retrievalScope"] }) => Promise<SupabaseAgentRetrievalResult>;
};

const defaultBaseUrl = "https://api.deepseek.com";
const defaultModel = "deepseek-v4-pro";

export function getDeepSeekConfig(env: DeepSeekEnv): DeepSeekConfig | null {
  const apiKey = env.VITE_DEEPSEEK_API_KEY?.trim();
  if (!apiKey || apiKey === "YOUR_DEEPSEEK_API_KEY") return null;

  return {
    apiKey,
    baseUrl: (env.VITE_DEEPSEEK_BASE_URL || defaultBaseUrl).replace(/\/+$/, ""),
    model: env.VITE_DEEPSEEK_MODEL || defaultModel,
    timeoutMs: normalizeTimeout(env.VITE_DEEPSEEK_TIMEOUT_MS),
  };
}

export function createDeepSeekAgentPort(env: DeepSeekEnv, retrievalPort?: AgentRetrievalPort): WorkbenchAgentPort {
  const config = getDeepSeekConfig(env);

  return {
    answer: async (request) => {
      request.onProgress?.("prepare-context");
      const localAnswer = answerWorkbenchQuestion(request);
      request.onProgress?.("check-scope");
      if (!config || localAnswer.refused) return localAnswer;

      try {
        request.onProgress?.("retrieve-database");
        const retrieval = retrievalPort ? await retrievalPort.retrieve({ question: request.question, limit: 8, scope: request.retrievalScope }) : null;
        request.onProgress?.("requesting-model");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
        try {
          const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: config.model,
              temperature: 0.2,
              stream: true,
              messages: [
                {
                  role: "system",
                  content:
                    "你是新能源主机厂售后运营反馈分析工作台的分析助手。只回答当前工具、当前筛选数据、售后服务运营、指标、报告结论和原话证据相关问题。回答必须是自然语言短段落，不使用 Markdown 标题、列表、表格或代码块。结论要克制、可追溯、面向运营动作。",
                },
                {
                  role: "user",
                  content: buildPrompt(request, retrieval?.promptContext),
                },
              ],
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            throw new Error(`DeepSeek API request failed: ${response.status} ${response.statusText}`.trim());
          }

          request.onProgress?.("streaming-answer");
          const streamedContent = await readDeepSeekAnswerStream(response, request.onToken);
          const content = toNaturalLanguageAnswer(streamedContent);
          if (!content) throw new Error("DeepSeek API returned an empty answer.");

          return {
            refused: false,
            content,
            evidenceQuotes: localAnswer.evidenceQuotes,
          };
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error("DeepSeek API request failed.");
      }
    },
  };
}

function normalizeTimeout(value?: string): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 5000 && parsed <= 120000) return parsed;
  return 45000;
}

async function readDeepSeekAnswerStream(
  response: Response,
  onToken?: WorkbenchAgentRequest["onToken"],
): Promise<string> {
  if (!response.body) return readFallbackJsonAnswer(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let isDone = false;

  while (!isDone) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
      const result = consumeSseBuffer(buffer, fullText, onToken);
      buffer = result.remainingBuffer;
      fullText = result.fullText;
      isDone = result.isDone;
    }
    if (done) break;
  }

  if (buffer.trim() && !isDone) {
    const result = consumeSseBuffer(`${buffer}\n\n`, fullText, onToken);
    fullText = result.fullText;
  }

  return fullText;
}

async function readFallbackJsonAnswer(response: Response): Promise<string> {
  const data = (await response.json()) as DeepSeekChatResponse;
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

function consumeSseBuffer(
  buffer: string,
  fullText: string,
  onToken?: WorkbenchAgentRequest["onToken"],
): { fullText: string; remainingBuffer: string; isDone: boolean } {
  const events = buffer.split(/\n\n/);
  const remainingBuffer = events.pop() ?? "";
  let isDone = false;
  let nextFullText = fullText;

  for (const event of events) {
    for (const line of event.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      if (payload === "[DONE]") {
        isDone = true;
        break;
      }

      const delta = parseStreamDelta(payload);
      if (!delta) continue;
      nextFullText += delta;
      onToken?.(delta, toNaturalLanguageAnswer(nextFullText));
    }
    if (isDone) break;
  }

  return { fullText: nextFullText, remainingBuffer, isDone };
}

function parseStreamDelta(payload: string): string {
  try {
    const data = JSON.parse(payload) as DeepSeekStreamChunk;
    return data.choices?.map((choice) => choice.delta?.content ?? choice.message?.content ?? "").join("") ?? "";
  } catch {
    return "";
  }
}

function buildPrompt(request: WorkbenchAgentRequest, databaseChunkContext?: string): string {
  const records = request.records.slice(0, 20).map((record) => ({
    submittedAt: record.submittedAt,
    projectName: record.projectName,
    city: record.city,
    serviceCenter: record.serviceCenter,
    serviceScenario: record.serviceScenario,
    rating: record.rating,
    npsScore: record.npsScore,
    feedbackText: record.feedbackText,
    consentState: record.contact?.consentState,
  }));
  const findings = request.findings.slice(0, 5).map((finding) => ({
    serviceStage: finding.serviceStage,
    severity: finding.severity,
    summary: finding.summary,
    evidenceQuotes: finding.evidenceQuotes.slice(0, 3),
  }));

  return JSON.stringify(
    {
      question: request.question,
      scopeLabel: request.scopeLabel,
      metrics: request.metrics,
      findings,
      records,
      databaseChunkContext:
        databaseChunkContext ||
        "当前未接入数据库 Chunk 检索上下文，仅可使用当前前端筛选数据、指标和报告证据回答。",
      instruction:
        "请基于以上当前筛选范围和数据库 Chunk 检索结果回答，不要编造未给出的数据；涉及风险或动作时引用原话证据；如果数据库 Chunk 与问题无关，请说明证据不足；输出为自然语言短段落，不使用 Markdown。",
    },
    null,
    2,
  );
}
