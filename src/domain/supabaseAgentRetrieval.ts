export type AgentRetrievalMetadata = {
  chunk_type?: string;
  tokens?: string[];
  project_name?: string;
  city?: string;
  service_center?: string;
  service_stage?: string;
  sentiment?: string;
  severity?: string;
  rating?: number;
  nps_score?: number;
  contact_consent?: string;
  [key: string]: unknown;
};

export type AgentRetrievalChunk = {
  id: string;
  feedbackRecordId: string;
  chunkIndex: number;
  chunkText: string;
  metadata: AgentRetrievalMetadata;
};

export type RankedAgentRetrievalChunk = AgentRetrievalChunk & {
  score: number;
  matchedTerms: string[];
};

const domainTerms = [
  "App预约",
  "预约",
  "失败",
  "等待",
  "排队",
  "解释不清",
  "回访",
  "闭环",
  "低分",
  "授权",
  "服务中心",
  "配件",
  "复发",
  "权益",
  "活动",
  "补能",
  "充电",
  "OTA",
  "进度同步",
  "沟通",
  "交付",
  "维修",
];

export function tokenizeAgentQuestion(question: string): string[] {
  const normalized = question.replace(/\s+/g, "");
  const tokens = new Set<string>();

  for (const term of domainTerms) {
    if (normalized.includes(term.replace(/\s+/g, ""))) tokens.add(term);
  }

  const segments = question
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const segment of segments) {
    if (/^[A-Za-z0-9]+$/.test(segment)) {
      tokens.add(segment);
      continue;
    }
    for (let index = 0; index < segment.length - 1; index += 1) {
      tokens.add(segment.slice(index, index + 2));
    }
    for (let index = 0; index < segment.length - 2; index += 1) {
      tokens.add(segment.slice(index, index + 3));
    }
  }

  return Array.from(tokens);
}

export function rankAgentChunks(input: {
  question: string;
  chunks: AgentRetrievalChunk[];
  limit?: number;
}): RankedAgentRetrievalChunk[] {
  const questionTokens = tokenizeAgentQuestion(input.question);
  const asksClosure = ["回访", "闭环", "低分", "授权", "跟进"].some((term) => input.question.includes(term));
  const asksRisk = ["风险", "负向", "投诉", "严重"].some((term) => input.question.includes(term));
  const asksAction = ["怎么处理", "如何处理", "处理", "动作", "建议", "改善", "改进", "优化", "排查"].some((term) =>
    input.question.includes(term),
  );
  const explicitCities = collectExplicitMetadataMatches(input.question, input.chunks, "city");
  const explicitServiceCenters = collectExplicitMetadataMatches(input.question, input.chunks, "service_center");

  const ranked = input.chunks
    .map((chunk) => {
      const chunkTokens = new Set([...(chunk.metadata.tokens ?? []), ...tokenizeAgentQuestion(chunk.chunkText)]);
      const matchedTerms = questionTokens.filter((token) => chunkTokens.has(token) || chunk.chunkText.includes(token));
      let score = matchedTerms.length * 2;

      const city = typeof chunk.metadata.city === "string" ? chunk.metadata.city : "";
      const serviceCenter = typeof chunk.metadata.service_center === "string" ? chunk.metadata.service_center : "";

      if (city && explicitCities.size) score += explicitCities.has(city) ? 15 : -10;
      if (serviceCenter && explicitServiceCenters.size) score += explicitServiceCenters.has(serviceCenter) ? 18 : -12;
      if (chunk.metadata.project_name && input.question.includes(String(chunk.metadata.project_name))) score += 3;
      if (chunk.metadata.chunk_type === "feedback_text") score += asksAction ? 8 : 4;
      if (chunk.metadata.chunk_type === "issue_reason") score += asksAction ? 5 : 2;
      if (asksAction && chunk.metadata.chunk_type === "record_summary") score -= 4;
      if (asksAction && chunk.metadata.chunk_type === "survey_context") score -= 3;
      if (asksClosure && chunk.metadata.chunk_type === "closure_signal") score += 6;
      if (asksClosure && chunk.metadata.contact_consent === "已授权联系") score += 3;
      if (asksClosure && Number(chunk.metadata.rating ?? 5) <= 2) score += 3;
      if (asksRisk && chunk.metadata.sentiment === "负向") score += 3;
      if ((asksAction || asksClosure) && chunk.metadata.sentiment === "负向") score += 8;
      if (asksAction && chunk.metadata.sentiment === "正向") score -= 6;
      if (asksAction && Number(chunk.metadata.rating ?? 5) <= 2) score += 4;
      if (chunk.metadata.severity === "高") score += 1;

      return { ...chunk, score, matchedTerms };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || compareChunkTypePriority(a, b) || a.chunkIndex - b.chunkIndex);

  return dedupeRankedChunksByFeedbackRecord(ranked, asksAction)
    .slice(0, input.limit ?? 8);
}

function collectExplicitMetadataMatches(
  question: string,
  chunks: AgentRetrievalChunk[],
  metadataKey: "city" | "service_center",
): Set<string> {
  const matches = new Set<string>();
  for (const chunk of chunks) {
    const value = chunk.metadata[metadataKey];
    if (typeof value === "string" && value && question.includes(value)) matches.add(value);
  }
  return matches;
}

function compareChunkTypePriority(a: RankedAgentRetrievalChunk, b: RankedAgentRetrievalChunk): number {
  return getChunkTypePriority(b.metadata.chunk_type) - getChunkTypePriority(a.metadata.chunk_type);
}

function getChunkTypePriority(chunkType: AgentRetrievalMetadata["chunk_type"]): number {
  if (chunkType === "feedback_text") return 4;
  if (chunkType === "issue_reason") return 3;
  if (chunkType === "closure_signal") return 2;
  if (chunkType === "record_summary") return 1;
  return 0;
}

function dedupeRankedChunksByFeedbackRecord(
  chunks: RankedAgentRetrievalChunk[],
  prefersActionableChunk: boolean,
): RankedAgentRetrievalChunk[] {
  const bestByFeedbackRecord = new Map<string, RankedAgentRetrievalChunk>();
  for (const chunk of chunks) {
    const currentBest = bestByFeedbackRecord.get(chunk.feedbackRecordId);
    if (!currentBest || isBetterChunkForFeedback(chunk, currentBest, prefersActionableChunk)) {
      bestByFeedbackRecord.set(chunk.feedbackRecordId, chunk);
    }
  }
  return Array.from(bestByFeedbackRecord.values()).sort(
    (a, b) => b.score - a.score || compareChunkTypePriority(a, b) || a.chunkIndex - b.chunkIndex,
  );
}

function isBetterChunkForFeedback(
  candidate: RankedAgentRetrievalChunk,
  currentBest: RankedAgentRetrievalChunk,
  prefersActionableChunk: boolean,
): boolean {
  const candidatePriority = getChunkTypePriority(candidate.metadata.chunk_type);
  const currentPriority = getChunkTypePriority(currentBest.metadata.chunk_type);
  if (prefersActionableChunk && candidatePriority > currentPriority && candidate.score >= currentBest.score - 12) {
    return true;
  }
  return (
    candidate.score > currentBest.score ||
    (candidate.score === currentBest.score && candidatePriority > currentPriority) ||
    (candidate.score === currentBest.score && candidatePriority === currentPriority && candidate.chunkIndex < currentBest.chunkIndex)
  );
}

export function buildAgentRetrievalPromptContext(chunks: RankedAgentRetrievalChunk[]): string {
  if (!chunks.length) {
    return "数据库 Chunk 检索未命中相关样本。回答时必须说明当前问题缺少可引用的数据库证据。";
  }

  const lines = chunks.map((chunk, index) => {
    const metadata = chunk.metadata;
    return [
      `#${index + 1}`,
      `项目：${metadata.project_name ?? "未标注"}`,
      `地点：${[metadata.city, metadata.service_center].filter(Boolean).join(" / ") || "未标注"}`,
      `环节：${metadata.service_stage ?? "未标注"}`,
      `情绪：${metadata.sentiment ?? "未标注"}`,
      `评分：${metadata.rating ?? "未标注"}`,
      `NPS：${metadata.nps_score ?? "未标注"}`,
      `授权：${metadata.contact_consent ?? "未标注"}`,
      `Chunk：${chunk.chunkText}`,
    ].join("；");
  });

  return [
    `检索到 ${chunks.length} 条相关 Chunk，供 Agent 回答时引用：`,
    "数据性质：模拟数据；数据批次：mock-after-sales-v1；回答时必须把这些样本表述为模拟问卷样本，不得表述为真实用户数据。",
    ...lines,
  ].join("\n");
}
