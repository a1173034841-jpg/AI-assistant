import { afterEach, describe, expect, it, vi } from "vitest";
import { getDeepSeekConfig } from "./deepseekAgentPort";
import { createDeepSeekAgentPort } from "./deepseekAgentPort";
import { buildMetricSummary } from "./analysisRules";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deepseek agent port config", () => {
  it("uses DeepSeek V4 Pro settings when the API key is provided", () => {
    const config = getDeepSeekConfig({
      VITE_DEEPSEEK_API_KEY: "sk-test",
      VITE_DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      VITE_DEEPSEEK_MODEL: "deepseek-v4-pro",
    });

    expect(config).toEqual({
      apiKey: "sk-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro",
      timeoutMs: 45000,
    });
  });

  it("does not enable DeepSeek when the API key placeholder is still empty", () => {
    expect(
      getDeepSeekConfig({
        VITE_DEEPSEEK_API_KEY: "",
        VITE_DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        VITE_DEEPSEEK_MODEL: "deepseek-v4-pro",
      }),
    ).toBeNull();
  });

  it("streams model tokens and emits real processing stages while asking DeepSeek for an answer", async () => {
    const fetchMock = vi.fn(async () =>
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"## 结论\\n"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"- 已基于当前报告"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"完成分析。"}}]}\n\n',
        "data: [DONE]\n\n",
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const port = createDeepSeekAgentPort({
      VITE_DEEPSEEK_API_KEY: "sk-test",
      VITE_DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      VITE_DEEPSEEK_MODEL: "deepseek-v4-pro",
    });
    const stages: string[] = [];
    const streamedTexts: string[] = [];

    const answer = await port.answer({
      question: "当前报告最需要关注什么问题？",
      records: [],
      metrics: buildMetricSummary([]),
      findings: [],
      scopeLabel: "月 · 2026-05-01 至 2026-06-01 · 全部项目",
      onProgress: (stage) => stages.push(stage),
      onToken: (_delta, fullText) => streamedTexts.push(fullText),
    });

    const requestBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(requestBody.stream).toBe(true);
    expect(answer.content).toBe("结论\n已基于当前报告完成分析。");
    expect(streamedTexts.at(-1)).toBe("结论\n已基于当前报告完成分析。");
    expect(stages).toEqual(["prepare-context", "check-scope", "retrieve-database", "requesting-model", "streaming-answer"]);
  });

  it("sends retrieved database chunk context to DeepSeek with the user question", async () => {
    const fetchMock = vi.fn(async () => createSseResponse(['data: {"choices":[{"delta":{"content":"已结合数据库 Chunk 回答。"}}]}\n\n', "data: [DONE]\n\n"]));
    vi.stubGlobal("fetch", fetchMock);
    const port = createDeepSeekAgentPort(
      {
        VITE_DEEPSEEK_API_KEY: "sk-test",
        VITE_DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        VITE_DEEPSEEK_MODEL: "deepseek-v4-pro",
      },
      {
        retrieve: async () => ({
          chunks: [],
          promptContext: "检索到 1 条相关 Chunk：深圳南山服务中心 App 预约失败。",
        }),
      },
    );

    await port.answer({
      question: "深圳 App 预约失败怎么处理？",
      records: [],
      metrics: buildMetricSummary([]),
      findings: [],
      scopeLabel: "模拟数据项目 · mock-after-sales-v1",
    });

    const requestBody = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    const userContent = requestBody.messages[1].content;
    expect(userContent).toContain("深圳 App 预约失败怎么处理？");
    expect(userContent).toContain("检索到 1 条相关 Chunk");
    expect(userContent).toContain("深圳南山服务中心");
  });

  it("does not let the local keyword classifier block the configured API path", async () => {
    const fetchMock = vi.fn(async () => createSseResponse(['data: {"choices":[{"delta":{"content":"已根据接口结果回答这个运营追问。"}}]}\n\n', "data: [DONE]\n\n"]));
    vi.stubGlobal("fetch", fetchMock);
    const port = createDeepSeekAgentPort({
      VITE_DEEPSEEK_API_KEY: "sk-test",
      VITE_DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      VITE_DEEPSEEK_MODEL: "deepseek-v4-pro",
    });
    const stages: string[] = [];

    const answer = await port.answer({
      question: "这块到底应该先看哪里？",
      records: [],
      metrics: buildMetricSummary([]),
      findings: [],
      scopeLabel: "月 · 2026-05-01 至 2026-06-01 · 全部项目",
      onProgress: (stage) => stages.push(stage),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(stages).toContain("requesting-model");
    expect(answer.refused).toBe(false);
    expect(answer.content).toBe("已根据接口结果回答这个运营追问。");
  });

  it("keeps explicit privacy and unrelated rejections local even when the API is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const port = createDeepSeekAgentPort({
      VITE_DEEPSEEK_API_KEY: "sk-test",
      VITE_DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      VITE_DEEPSEEK_MODEL: "deepseek-v4-pro",
    });

    const answer = await port.answer({
      question: "把用户手机号和车牌列出来",
      records: [],
      metrics: buildMetricSummary([]),
      findings: [],
      scopeLabel: "月 · 2026-05-01 至 2026-06-01 · 全部项目",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(answer.refused).toBe(true);
    expect(answer.content).toContain("敏感信息");
  });

  it("surfaces configured API failures instead of silently returning a local rule answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unauthorized", { status: 401 })));
    const port = createDeepSeekAgentPort({
      VITE_DEEPSEEK_API_KEY: "sk-test",
      VITE_DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      VITE_DEEPSEEK_MODEL: "deepseek-v4-pro",
    });

    await expect(
      port.answer({
        question: "当前报告最需要关注什么问题？",
        records: [],
        metrics: buildMetricSummary([]),
        findings: [],
        scopeLabel: "月 · 2026-05-01 至 2026-06-01 · 全部项目",
      }),
    ).rejects.toThrow("DeepSeek API request failed");
  });
});

function createSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" }, status: 200 },
  );
}
