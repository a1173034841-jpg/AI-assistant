import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAgentRetrievalPort, getSupabaseAgentRetrievalConfig } from "./supabaseAgentRetrievalPort";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("supabase agent retrieval port", () => {
  it("uses Vite anon Supabase settings for browser-safe retrieval", () => {
    expect(
      getSupabaseAgentRetrievalConfig({
        VITE_SUPABASE_REST_URL: "https://example.supabase.co/rest/v1",
        VITE_SUPABASE_ANON_KEY: "anon-key",
      }),
    ).toEqual({
      restUrl: "https://example.supabase.co/rest/v1",
      anonKey: "anon-key",
      mockBatchId: "mock-after-sales-v1",
      requestTimeoutMs: 12000,
    });
  });

  it("retrieves chunks from Supabase REST and ranks them for the user question", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            id: "chunk-1",
            feedback_record_id: "fb-1",
            chunk_index: 0,
            chunk_text: "深圳南山服务中心 App 预约失败后没有明确提示。",
            metadata: {
              chunk_type: "feedback_text",
              tokens: ["深圳", "App预约", "失败", "服务中心"],
              project_name: "App预约体验复盘",
              city: "深圳",
              service_center: "深圳南山服务中心",
              service_stage: "软件与智能化",
              sentiment: "负向",
              severity: "中",
              rating: 2,
              nps_score: 5,
              contact_consent: "已授权联系",
              mock_batch_id: "mock-after-sales-v1",
            },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const port = createSupabaseAgentRetrievalPort({
      VITE_SUPABASE_REST_URL: "https://example.supabase.co/rest/v1",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    });

    const result = await port.retrieve({
      question: "深圳 App 预约失败的问题是什么？",
      limit: 3,
    });

    expect(result.chunks[0].id).toBe("chunk-1");
    expect(result.promptContext).toContain("检索到 1 条相关 Chunk");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/feedback_record_chunks?"),
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: "anon-key",
          Authorization: "Bearer anon-key",
        }),
      }),
    );
    const firstRequestUrl = decodeURIComponent(String(fetchMock.mock.calls[0][0]));
    expect(firstRequestUrl).toContain("or=");
    expect(firstRequestUrl).toContain("metadata->>service_center.ilike");
    expect(firstRequestUrl).toContain("metadata->>city.ilike");
    expect(firstRequestUrl).toContain("metadata->>project_name.ilike");
    expect(firstRequestUrl).not.toContain("search_document.ilike");
  });

  it("combines filtered candidates with batch pages so explicit city matches are not missed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "wuhan-generic",
              feedback_record_id: "fb-wuhan",
              chunk_index: 1,
              chunk_text: "武汉汉口服务中心主要集中在服务等待、App预约。",
              metadata: {
                chunk_type: "feedback_text",
                tokens: ["武汉", "App预约", "服务等待"],
                city: "武汉",
                service_center: "武汉汉口服务中心",
                sentiment: "负向",
                rating: 1,
                mock_batch_id: "mock-after-sales-v1",
              },
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockImplementation(async () =>
        new Response(
          JSON.stringify([
            {
              id: "shenzhen-specific",
              feedback_record_id: "fb-shenzhen",
              chunk_index: 1,
              chunk_text: "深圳福田服务中心预约进店后说明不完整，需要补充主动沟通和二次确认。",
              metadata: {
                chunk_type: "feedback_text",
                tokens: ["深圳", "预约", "沟通"],
                city: "深圳",
                service_center: "深圳福田服务中心",
                sentiment: "负向",
                rating: 2,
                mock_batch_id: "mock-after-sales-v1",
              },
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const port = createSupabaseAgentRetrievalPort({
      VITE_SUPABASE_REST_URL: "https://example.supabase.co/rest/v1",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    });

    const result = await port.retrieve({
      question: "深圳 App 预约失败的问题怎么处理？",
      limit: 2,
    });

    expect(result.chunks[0].id).toBe("shenzhen-specific");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("or=");
    expect(String(fetchMock.mock.calls[1][0])).not.toContain("or=");
  });

  it("keeps retrieval evidence inside the explicit project scope when provided", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            id: "other-project",
            feedback_record_id: "fb-other",
            chunk_index: 1,
            chunk_text: "武汉汉口服务中心 App 预约问题。",
            metadata: {
              chunk_type: "feedback_text",
              tokens: ["App预约", "武汉"],
              project_name: "维修质量专项复盘",
              city: "武汉",
              service_center: "武汉汉口服务中心",
              rating: 1,
              mock_batch_id: "mock-after-sales-v1",
            },
          },
          {
            id: "target-project",
            feedback_record_id: "fb-target",
            chunk_index: 1,
            chunk_text: "东莞南城服务中心 App 预约同步失败。",
            metadata: {
              chunk_type: "feedback_text",
              tokens: ["App预约", "同步", "失败"],
              project_name: "App预约体验复盘",
              city: "东莞",
              service_center: "东莞南城服务中心",
              rating: 2,
              mock_batch_id: "mock-after-sales-v1",
            },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const port = createSupabaseAgentRetrievalPort({
      VITE_SUPABASE_REST_URL: "https://example.supabase.co/rest/v1",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    });

    const result = await port.retrieve({
      question: "App预约体验复盘里 App 预约失败集中在哪里？",
      limit: 3,
      scope: { projectNames: ["App预约体验复盘"] },
    });

    expect(result.chunks.map((chunk) => chunk.id)).toEqual(["target-project"]);
    expect(result.promptContext).toContain("App预约体验复盘");
    expect(result.promptContext).not.toContain("维修质量专项复盘");
  });
});
