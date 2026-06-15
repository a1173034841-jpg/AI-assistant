import { describe, expect, it } from "vitest";
import {
  buildAfterSalesQaAnswer,
  buildAgentProgressSteps,
  buildAgentConversationTitle,
  buildAutoConversationTitle,
  createAgentConversationTurn,
  getAgentProgressPercent,
  removeQaConversationRecord,
  toNaturalLanguageAnswer,
} from "./agentConversation";

describe("agent conversation model", () => {
  it("marks previous agent stages as completed and the current stage as active", () => {
    const steps = buildAgentProgressSteps("streaming-answer");

    expect(steps.map((step) => `${step.id}:${step.status}`)).toEqual([
      "prepare-context:completed",
      "check-scope:completed",
      "retrieve-database:completed",
      "requesting-model:completed",
      "streaming-answer:active",
      "archive-turn:pending",
    ]);
    expect(getAgentProgressPercent("streaming-answer")).toBe(83);
  });

  it("stores each question and final answer with time, project scope and report context", () => {
    const turn = createAgentConversationTurn({
      id: "agent-turn-001",
      askedAt: "2026-06-01 17:12",
      question: "广州低分反馈集中在哪些服务中心？",
      answer: "广州番禺服务中心和广州白云服务中心低分集中，主要涉及等待时间和解释不清。",
      scopeLabel: "月 · 2026-05-01 至 2026-06-01 · A 项目",
      reportTitle: "总报告：管理层复盘摘要",
      scenario: "区域/城市下钻",
      refused: false,
      evidenceCount: 2,
    });

    expect(turn).toMatchObject({
      id: "agent-turn-001",
      askedAt: "2026-06-01 17:12",
      projectScope: "月 · 2026-05-01 至 2026-06-01 · A 项目",
      reportTitle: "总报告：管理层复盘摘要",
      scenario: "区域/城市下钻",
      evidenceCount: 2,
    });
  });

  it("converts markdown-like model output into natural language paragraphs", () => {
    expect(toNaturalLanguageAnswer("## 结论\n- 广州低分集中在等待时间。\n- 建议先回访已授权用户。")).toBe(
      "结论\n广州低分集中在等待时间。\n建议先回访已授权用户。",
    );
  });

  it("uses project scope as the GPT-like conversation thread title", () => {
    expect(buildAgentConversationTitle({ mode: "all" })).toBe("全部项目");
    expect(buildAgentConversationTitle({ mode: "selected", projectNames: ["五一售后服务专项"] })).toBe(
      "五一售后服务专项",
    );
    expect(buildAgentConversationTitle({ mode: "selected", projectNames: ["五一售后服务专项", "端午关怀回访"] })).toBe(
      "项目组合：五一售后服务专项、端午关怀回访",
    );
    expect(buildAgentConversationTitle({ mode: "byType", projectTypes: ["节假日专项"] })).toBe("项目类型：节假日专项");
  });

  it("auto names a new chatbot conversation from the first real question", () => {
    expect(buildAutoConversationTitle("等待时间主要影响哪些服务中心？")).toBe("等待时间影响服务中心");
    expect(buildAutoConversationTitle("杭州西溪服务中心低分原因是什么，怎么闭环？")).toBe("杭州西溪低分闭环");
  });

  it("builds an operational answer instead of a generic placeholder", () => {
    const answer = buildAfterSalesQaAnswer({
      question: "等待时间主要影响哪些服务中心？",
      scopeLabel: "月：2026-05 / 全部项目 / 全国",
      projectName: "五一售后服务专项",
    });

    expect(answer).toContain("杭州西溪服务中心");
    expect(answer).toContain("等待");
    expect(answer).toContain("下一步");
  });

  it("removes a conversation and clears selection when the selected record is deleted", () => {
    const result = removeQaConversationRecord(
      [
        { id: "qa-1", title: "等待时间影响服务中心", meta: "2 轮" },
        { id: "qa-2", title: "杭州西溪低分闭环", meta: "1 轮" },
      ],
      "qa-1",
      "qa-1",
    );

    expect(result.threads.map((thread) => thread.id)).toEqual(["qa-2"]);
    expect(result.selectedThreadId).toBeNull();
  });
});
