import { describe, expect, it } from "vitest";
import { classifyAgentQuestion } from "./agentIntentClassifier";

describe("agent intent classifier", () => {
  it.each([
    ["一共涉及多少个数据来源？", "data_inventory"],
    ["当前覆盖多少个城市和服务中心？", "data_inventory"],
    ["净推荐值为什么是负的？", "metric_explanation"],
    ["广州低分主要集中在哪里？", "attribution_analysis"],
    ["等待时间主要影响哪些服务中心？", "attribution_analysis"],
    ["列出支撑这个结论的原话", "evidence_trace"],
    ["把已授权低分反馈整理成回访清单", "operation_action"],
    ["怎么导入问卷星表格？", "tool_usage"],
  ] as const)("allows relevant workbench question: %s", (question, intent) => {
    expect(classifyAgentQuestion(question)).toMatchObject({
      allowed: true,
      intent,
    });
  });

  it.each(["来源有几个？", "这些样本覆盖哪些地方？", "这个结果怎么算的？"] as const)(
    "keeps short but contextual operations questions answerable: %s",
    (question) => {
      expect(classifyAgentQuestion(question).allowed).toBe(true);
    },
  );

  it("keeps ambiguous in-page operations questions answerable by the API agent", () => {
    expect(classifyAgentQuestion("这块到底应该先看哪里？")).toMatchObject({
      allowed: true,
      intent: "general_workbench",
    });
  });

  it.each([
    ["帮我写一首诗", "clearly_unrelated"],
    ["查一下今天北京天气", "clearly_unrelated"],
    ["推荐一只股票", "clearly_unrelated"],
    ["把用户手机号和车牌列出来", "sensitive_data"],
  ] as const)("rejects unsafe or unrelated question: %s", (question, reason) => {
    expect(classifyAgentQuestion(question)).toMatchObject({
      allowed: false,
      reason,
    });
  });
});
