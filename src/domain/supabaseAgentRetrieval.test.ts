import { describe, expect, it } from "vitest";
import {
  buildAgentRetrievalPromptContext,
  rankAgentChunks,
  tokenizeAgentQuestion,
  type AgentRetrievalChunk,
} from "./supabaseAgentRetrieval";

const chunks: AgentRetrievalChunk[] = [
  {
    id: "chunk-1",
    feedbackRecordId: "fb-1",
    chunkIndex: 0,
    chunkText: "深圳南山服务中心 App 预约失败后没有明确提示，只能反复提交。",
    metadata: {
      chunk_type: "feedback_text",
      tokens: ["深圳", "南山", "服务中心", "App预约", "失败", "提示"],
      project_name: "App预约体验复盘",
      city: "深圳",
      service_center: "深圳南山服务中心",
      service_stage: "软件与智能化",
      sentiment: "负向",
      severity: "中",
      rating: 2,
      nps_score: 5,
      contact_consent: "已授权联系",
    },
  },
  {
    id: "chunk-2",
    feedbackRecordId: "fb-2",
    chunkIndex: 0,
    chunkText: "成都高新服务中心活动组织有序，权益说明清楚。",
    metadata: {
      chunk_type: "positive_material",
      tokens: ["成都", "活动", "权益", "说明"],
      project_name: "端午车主活动反馈",
      city: "成都",
      service_center: "成都高新服务中心",
      service_stage: "用户运营",
      sentiment: "正向",
      severity: "低",
      rating: 5,
      nps_score: 9,
      contact_consent: "拒绝联系",
    },
  },
  {
    id: "chunk-3",
    feedbackRecordId: "fb-3",
    chunkIndex: 0,
    chunkText: "北京亦庄服务中心配件等待时间比承诺久，期间没有主动同步进度。",
    metadata: {
      chunk_type: "closure_signal",
      tokens: ["北京", "配件", "等待", "进度同步", "回访"],
      project_name: "维修质量专项复盘",
      city: "北京",
      service_center: "北京亦庄服务中心",
      service_stage: "服务质量",
      sentiment: "负向",
      severity: "高",
      rating: 1,
      nps_score: 4,
      contact_consent: "已授权联系",
    },
  },
];

describe("supabase agent retrieval", () => {
  it("tokenizes after-sales questions with domain terms", () => {
    expect(tokenizeAgentQuestion("深圳 App 预约失败的问题集中在哪些服务中心？")).toEqual(
      expect.arrayContaining(["深圳", "App预约", "预约", "失败", "服务中心"]),
    );
  });

  it("ranks chunks by question terms and operational metadata", () => {
    const ranked = rankAgentChunks({
      question: "深圳 App 预约失败的问题如何处理？",
      chunks,
      limit: 2,
    });

    expect(ranked[0].id).toBe("chunk-1");
    expect(ranked[0].score).toBeGreaterThan(0);
  });

  it("prioritizes explicitly mentioned city evidence over generic app matches from other cities", () => {
    const ranked = rankAgentChunks({
      question: "深圳 App 预约失败的问题怎么处理？",
      chunks: [
        {
          id: "shanghai-summary",
          feedbackRecordId: "fb-shanghai",
          chunkIndex: 0,
          chunkText: "上海静安服务中心 App 预约失败与 OTA 推送失败反复出现，用户多次提交后仍无法完成预约。",
          metadata: {
            chunk_type: "record_summary",
            tokens: ["上海", "App预约", "失败", "OTA", "预约"],
            project_name: "App预约体验复盘",
            city: "上海",
            service_center: "上海静安服务中心",
            service_stage: "软件与智能化",
            sentiment: "负向",
            severity: "高",
            rating: 1,
          },
        },
        {
          id: "shenzhen-feedback",
          feedbackRecordId: "fb-shenzhen",
          chunkIndex: 1,
          chunkText: "深圳福田服务中心用户反馈预约进店后服务说明不完整，需要补充主动沟通和二次确认。",
          metadata: {
            chunk_type: "feedback_text",
            tokens: ["深圳", "预约", "服务说明", "沟通"],
            project_name: "服务到店体验复盘",
            city: "深圳",
            service_center: "深圳福田服务中心",
            service_stage: "服务接待",
            sentiment: "负向",
            severity: "中",
            rating: 2,
          },
        },
      ],
      limit: 2,
    });

    expect(ranked[0].id).toBe("shenzhen-feedback");
  });

  it("keeps the best chunk from each feedback record so top results cover more samples", () => {
    const ranked = rankAgentChunks({
      question: "深圳预约问题怎么处理？",
      chunks: [
        {
          id: "fb-1-summary",
          feedbackRecordId: "fb-1",
          chunkIndex: 0,
          chunkText: "深圳预约问题摘要：App 预约失败、预约进店失败、预约后未确认。",
          metadata: {
            chunk_type: "record_summary",
            tokens: ["深圳", "预约", "App预约", "失败"],
            city: "深圳",
            service_center: "深圳南山服务中心",
            sentiment: "负向",
            rating: 2,
          },
        },
        {
          id: "fb-1-feedback",
          feedbackRecordId: "fb-1",
          chunkIndex: 2,
          chunkText: "用户原话：预约后没人主动确认到店时间，希望服务中心补充电话确认。",
          metadata: {
            chunk_type: "feedback_text",
            tokens: ["预约", "主动确认", "服务中心"],
            city: "深圳",
            service_center: "深圳南山服务中心",
            sentiment: "负向",
            rating: 2,
          },
        },
        {
          id: "fb-2-feedback",
          feedbackRecordId: "fb-2",
          chunkIndex: 1,
          chunkText: "深圳福田服务中心的预约接待说明不完整，需要明确到店前提醒口径。",
          metadata: {
            chunk_type: "feedback_text",
            tokens: ["深圳", "预约", "接待", "说明"],
            city: "深圳",
            service_center: "深圳福田服务中心",
            sentiment: "负向",
            rating: 3,
          },
        },
      ],
      limit: 3,
    });

    expect(new Set(ranked.map((chunk) => chunk.feedbackRecordId))).toEqual(new Set(["fb-1", "fb-2"]));
    expect(ranked).toHaveLength(2);
    expect(ranked.find((chunk) => chunk.feedbackRecordId === "fb-1")?.id).toBe("fb-1-feedback");
  });

  it("boosts closure chunks for callback and follow-up questions", () => {
    const ranked = rankAgentChunks({
      question: "请列出需要回访的低分闭环样本",
      chunks,
      limit: 1,
    });

    expect(ranked[0].id).toBe("chunk-3");
  });

  it("prefers negative feedback evidence for improvement-action questions", () => {
    const ranked = rankAgentChunks({
      question: "深圳福田服务中心需要做什么改进动作？",
      chunks: [
        {
          id: "positive-action",
          feedbackRecordId: "fb-positive",
          chunkIndex: 0,
          chunkText: "深圳福田服务中心维修项目解释清楚，交付提醒完整，值得复用。",
          metadata: {
            chunk_type: "feedback_text",
            tokens: ["深圳", "福田", "服务中心", "维修", "解释", "动作"],
            city: "深圳",
            service_center: "深圳福田服务中心",
            sentiment: "正向",
            severity: "低",
            rating: 5,
          },
        },
        {
          id: "negative-action",
          feedbackRecordId: "fb-negative",
          chunkIndex: 0,
          chunkText: "深圳福田服务中心同一问题处理后复发，服务解释和沟通效率不足。",
          metadata: {
            chunk_type: "feedback_text",
            tokens: ["深圳", "福田", "服务中心", "问题复发", "解释", "沟通"],
            city: "深圳",
            service_center: "深圳福田服务中心",
            sentiment: "负向",
            severity: "高",
            rating: 1,
          },
        },
      ],
      limit: 1,
    });

    expect(ranked[0].id).toBe("negative-action");
  });

  it("builds compact prompt context from ranked chunks", () => {
    const context = buildAgentRetrievalPromptContext(
      rankAgentChunks({ question: "App 预约失败", chunks, limit: 1 }),
    );

    expect(context).toContain("检索到 1 条相关 Chunk");
    expect(context).toContain("数据性质：模拟数据");
    expect(context).toContain("数据批次：mock-after-sales-v1");
    expect(context).toContain("深圳南山服务中心");
    expect(context).toContain("App 预约失败");
  });
});
