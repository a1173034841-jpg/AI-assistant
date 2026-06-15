import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";

const batchId = "mock-after-sales-v1";
const outputDir = join(process.cwd(), "test-results");
const outputJsonPath = join(outputDir, "real-agent-question-smoke.json");
const outputMdPath = join(outputDir, "real-agent-question-smoke.md");

function loadEnv() {
  const text = readFileSync(join(process.cwd(), ".env.local"), "utf8").replace(/^\uFEFF/, "");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    env[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return env;
}

const env = loadEnv();
const viteServer = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});
const { buildFindingsForScenario, buildMetricSummary } = await viteServer.ssrLoadModule("/src/domain/analysisRules.ts");
const { createDeepSeekAgentPort } = await viteServer.ssrLoadModule("/src/domain/deepseekAgentPort.ts");
const { createSupabaseAgentRetrievalPort } = await viteServer.ssrLoadModule("/src/domain/supabaseAgentRetrievalPort.ts");
const restUrl = (
  env.SUPABASE_REST_URL ||
  env.VITE_SUPABASE_REST_URL ||
  (env.SUPABASE_URL || env.VITE_SUPABASE_URL ? `${env.SUPABASE_URL || env.VITE_SUPABASE_URL}/rest/v1` : "")
).replace(/\/+$/, "");
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!restUrl || !supabaseKey) {
  throw new Error("Missing Supabase REST URL or key in .env.local.");
}

const viteEnv = {
  VITE_SUPABASE_REST_URL: env.VITE_SUPABASE_REST_URL || restUrl,
  VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || env.SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY,
  VITE_DEEPSEEK_API_KEY: env.VITE_DEEPSEEK_API_KEY,
  VITE_DEEPSEEK_BASE_URL: env.VITE_DEEPSEEK_BASE_URL,
  VITE_DEEPSEEK_MODEL: env.VITE_DEEPSEEK_MODEL,
  VITE_DEEPSEEK_TIMEOUT_MS: env.VITE_DEEPSEEK_TIMEOUT_MS || process.env.VITE_DEEPSEEK_TIMEOUT_MS || "30000",
};

const retrievalPort = createSupabaseAgentRetrievalPort(viteEnv);
const agentPort = createDeepSeekAgentPort(viteEnv, retrievalPort);
const smokeQuestionLimit = Number(process.env.SMOKE_QUESTION_LIMIT || env.SMOKE_QUESTION_LIMIT || "8");

async function fetchSupabaseRows(table, query, ranges) {
  const pages = await Promise.all(
    ranges.map(async ([from, to]) => {
      const response = await fetch(`${restUrl}/${table}?${query}`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Range: `${from}-${to}`,
        },
      });
      if (!response.ok) {
        throw new Error(`${table} query failed: ${response.status} ${response.statusText} ${await response.text()}`);
      }
      return response.json();
    }),
  );
  return pages.flat();
}

function mapFeedbackRow(row) {
  return {
    id: row.source_record_id,
    submittedAt: row.submitted_at,
    platform: normalizePlatform(row.platform),
    region: row.region,
    city: row.city,
    serviceCenter: row.service_center,
    serviceScenario: normalizeScenario(row.service_scenario),
    rating: row.rating ?? undefined,
    npsScore: row.nps_score ?? undefined,
    feedbackText: row.feedback_text,
    contact: {
      name: row.contact_name || undefined,
      phoneMasked: row.phone_masked || undefined,
      consentState: normalizeConsent(row.consent_state || row.raw_payload?.contact_consent),
    },
    sourceLabel: `${row.platform || "未标注来源"} · ${row.raw_payload?.source_name || row.project_name}`,
    displayLocation: `${row.city || "未标注城市"} / ${row.service_center || "未标注服务中心"}`,
    projectName: row.project_name,
    projectType: row.project_type,
  };
}

function normalizePlatform(value) {
  const allowed = new Set(["问卷星", "腾讯问卷", "金数据", "App内问卷", "短信链接", "企微链接", "其他来源"]);
  return allowed.has(value) ? value : "其他来源";
}

function normalizeScenario(value) {
  const allowed = new Set(["到店服务", "移动服务", "补能体验", "App/OTA", "活动/社群", "其他"]);
  return allowed.has(value) ? value : "其他";
}

function normalizeConsent(value) {
  if (value === "已授权联系" || value === "拒绝联系" || value === "未询问") return value;
  return "未询问";
}

function countBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "zh-CN"));
}

function recordsForCenter(records, center) {
  return records.filter((record) => record.city === center.city && record.serviceCenter === center.serviceCenter);
}

function recordsForProject(records, projectName) {
  return records.filter((record) => record.projectName === projectName);
}

function recordsForScenario(records, scenario) {
  return records.filter((record) => record.serviceScenario === scenario);
}

function recordsForLastWeek(records) {
  const latest = Math.max(...records.map((record) => new Date(record.submittedAt).getTime()));
  const start = latest - 6 * 24 * 60 * 60 * 1000;
  return records.filter((record) => {
    const time = new Date(record.submittedAt).getTime();
    return time >= start && time <= latest;
  });
}

function pickSmokeCases(records) {
  const topCenters = countBy(records, (record) => `${record.city}|${record.serviceCenter}`)
    .slice(0, 8)
    .map(([key]) => {
      const [city, serviceCenter] = key.split("|");
      return { city, serviceCenter };
    });
  const topProjects = countBy(records, (record) => record.projectName).map(([projectName]) => projectName);
  const appProject = topProjects.find((projectName) => projectName.includes("App")) || "App预约体验复盘";
  const activityProject = topProjects.find((projectName) => projectName.includes("活动")) || "端午车主活动反馈";
  const qualityProject = topProjects.find((projectName) => projectName.includes("维修")) || "维修质量专项复盘";
  const firstCenter = topCenters[0];
  const secondCenter = topCenters[1] || firstCenter;
  const shenzhenCenter = topCenters.find((center) => center.city === "深圳") || { city: "深圳", serviceCenter: "深圳福田服务中心" };
  const shanghaiCenter = topCenters.find((center) => center.city === "上海") || { city: "上海", serviceCenter: "上海浦东服务中心" };
  const suzhouCenter = topCenters.find((center) => center.city === "苏州") || { city: "苏州", serviceCenter: "苏州吴中服务中心" };
  const beijingCenter = topCenters.find((center) => center.city === "北京") || firstCenter;

  return [
    {
      id: "last-week-center-score",
      scopeType: "lastWeekCenter",
      center: firstCenter,
      scenario: "满意度归因",
      question: `上周${firstCenter.serviceCenter}的服务检查评分是多少？请说明平均服务评分、NPS 和低分数量。`,
    },
    {
      id: "center-evidence-quotes",
      scopeType: "center",
      center: shenzhenCenter,
      scenario: "服务问题闭环",
      question: `${shenzhenCenter.serviceCenter}低分反馈的证据原话是什么？列出最能说明问题的样本。`,
    },
    {
      id: "center-improvement-actions",
      scopeType: "center",
      center: shenzhenCenter,
      scenario: "服务问题闭环",
      question: `${shenzhenCenter.serviceCenter}需要做什么改进动作？请按服务中心可执行事项回答。`,
    },
    {
      id: "app-appointment-issue",
      scopeType: "project",
      projectName: appProject,
      scenario: "满意度归因",
      question: `${appProject}里 App 预约失败或预约同步问题集中在哪里？要怎么处理？`,
    },
    {
      id: "activity-review",
      scopeType: "project",
      projectName: activityProject,
      scenario: "活动体验复盘",
      question: `${activityProject}的活动体验复盘结论是什么？哪些正向素材可以沉淀？`,
    },
    {
      id: "quality-closure",
      scopeType: "project",
      projectName: qualityProject,
      scenario: "服务问题闭环",
      question: `${qualityProject}里哪些样本需要进入闭环回访？优先级怎么排？`,
    },
    {
      id: "city-comparison",
      scopeType: "multiCenter",
      centers: [shanghaiCenter, suzhouCenter],
      scenario: "区域/城市下钻",
      question: `${shanghaiCenter.city}和${suzhouCenter.city}两个城市的售后反馈差异是什么？哪个服务中心风险更高？`,
    },
    {
      id: "beijing-evidence-action",
      scopeType: "center",
      center: beijingCenter,
      scenario: "服务问题闭环",
      question: `${beijingCenter.serviceCenter}的负向证据原话是什么？下一步应该让门店做哪三件事？`,
    },
  ];
}

function recordsForCase(records, smokeCase) {
  if (smokeCase.scopeType === "lastWeekCenter") {
    return recordsForCenter(recordsForLastWeek(records), smokeCase.center);
  }
  if (smokeCase.scopeType === "center") {
    return recordsForCenter(records, smokeCase.center);
  }
  if (smokeCase.scopeType === "project") {
    return recordsForProject(records, smokeCase.projectName);
  }
  if (smokeCase.scopeType === "multiCenter") {
    return smokeCase.centers.flatMap((center) => recordsForCenter(records, center));
  }
  if (smokeCase.scopeType === "scenario") {
    return recordsForScenario(records, smokeCase.serviceScenario);
  }
  return records;
}

function buildScopeLabel(smokeCase, scopedRecords) {
  const dates = scopedRecords.map((record) => record.submittedAt.slice(0, 10)).sort();
  const dateText = dates.length ? `${dates[0]} 至 ${dates.at(-1)}` : "无样本";
  if (smokeCase.scopeType === "lastWeekCenter") {
    return `模拟数据批次 ${batchId} · 上周 · ${dateText} · ${smokeCase.center.city}/${smokeCase.center.serviceCenter}`;
  }
  if (smokeCase.scopeType === "center") {
    return `模拟数据批次 ${batchId} · ${dateText} · ${smokeCase.center.city}/${smokeCase.center.serviceCenter}`;
  }
  if (smokeCase.scopeType === "project") {
    return `模拟数据批次 ${batchId} · ${dateText} · 项目：${smokeCase.projectName}`;
  }
  if (smokeCase.scopeType === "multiCenter") {
    return `模拟数据批次 ${batchId} · ${dateText} · ${smokeCase.centers.map((center) => `${center.city}/${center.serviceCenter}`).join(" vs ")}`;
  }
  return `模拟数据批次 ${batchId} · ${dateText}`;
}

function buildRetrievalScope(smokeCase) {
  if (smokeCase.scopeType === "lastWeekCenter" || smokeCase.scopeType === "center") {
    return {
      cities: [smokeCase.center.city],
      serviceCenters: [smokeCase.center.serviceCenter],
    };
  }
  if (smokeCase.scopeType === "project") {
    return {
      projectNames: [smokeCase.projectName],
    };
  }
  if (smokeCase.scopeType === "multiCenter") {
    return {
      cities: smokeCase.centers.map((center) => center.city),
      serviceCenters: smokeCase.centers.map((center) => center.serviceCenter),
    };
  }
  return undefined;
}

function summarizeChunks(retrieval) {
  return retrieval.chunks.slice(0, 3).map((chunk) => ({
    chunkId: chunk.id,
    score: chunk.score,
    feedbackRecordId: chunk.feedbackRecordId,
    city: chunk.metadata.city,
    serviceCenter: chunk.metadata.service_center,
    projectName: chunk.metadata.project_name,
    chunkType: chunk.metadata.chunk_type,
    text: chunk.chunkText.slice(0, 180),
  }));
}

async function runSmokeCase(records, smokeCase) {
  const scopedRecords = recordsForCase(records, smokeCase);
  const metrics = buildMetricSummary(scopedRecords);
  const findings = buildFindingsForScenario(scopedRecords, smokeCase.scenario);
  const scopeLabel = buildScopeLabel(smokeCase, scopedRecords);
  const retrievalScope = buildRetrievalScope(smokeCase);
  console.error(`[smoke] ${smokeCase.id}: scoped ${scopedRecords.length} records; retrieving chunks`);
  const retrievalStartedAt = Date.now();
  const retrieval = await retrievalPort.retrieve({ question: smokeCase.question, limit: 8, scope: retrievalScope });
  console.error(`[smoke] ${smokeCase.id}: retrieved ${retrieval.chunks.length} chunks in ${Date.now() - retrievalStartedAt}ms; asking model`);

  const stages = [];
  let streamedAnswer = "";
  let answer = null;
  let error = null;
  try {
    answer = await agentPort.answer({
      question: smokeCase.question,
      records: scopedRecords,
      metrics,
      findings,
      scopeLabel,
      retrievalScope,
      onProgress: (stage) => {
        stages.push(stage);
        console.error(`[smoke] ${smokeCase.id}: ${stage}`);
      },
      onToken: (_delta, fullText) => {
        streamedAnswer = fullText;
      },
    });
    console.error(`[smoke] ${smokeCase.id}: answer length ${answer.content.length}; streamed ${streamedAnswer.length}`);
  } catch (caughtError) {
    error = caughtError instanceof Error ? caughtError : new Error("Unknown smoke test error");
    console.error(`[smoke] ${smokeCase.id}: ERROR ${error.message}`);
  }

  const modelReturned = Boolean(answer && !answer.refused && stages.includes("streaming-answer") && streamedAnswer.trim().length > 0);
  const retrievalPassed = retrieval.chunks.length > 0 && retrieval.promptContext.includes("数据性质：模拟数据");
  const stagePassed = ["prepare-context", "check-scope", "retrieve-database", "requesting-model", "streaming-answer"].every((stage) =>
    stages.includes(stage),
  );

  return {
    id: smokeCase.id,
    question: smokeCase.question,
    scopeLabel,
    scenario: smokeCase.scenario,
    scopedRecordCount: scopedRecords.length,
    metrics: {
      averageRating: metrics.averageRating,
      netPromoterScore: metrics.netPromoterScore,
      lowScoreCount: metrics.lowScoreCount,
      negativeRate: metrics.negativeRate,
      followUpCount: metrics.followUpCount,
    },
    retrieval: {
      chunkCount: retrieval.chunks.length,
      promptHasMockMarker: retrieval.promptContext.includes("数据性质：模拟数据"),
      topChunks: summarizeChunks(retrieval),
    },
    agent: {
      refused: answer?.refused ?? false,
      stages,
      answerPreview: answer?.content.slice(0, 360) ?? "",
      answerLength: answer?.content.length ?? 0,
      streamedLength: streamedAnswer.length,
      evidenceQuoteCount: answer?.evidenceQuotes.length ?? 0,
      errorMessage: error?.message ?? null,
    },
    passed: scopedRecords.length > 0 && retrievalPassed && stagePassed && modelReturned,
  };
}

function buildMarkdownReport(results, datasetSummary) {
  const lines = [
    "# Real Agent Question Smoke Test",
    "",
    `- 数据批次：${batchId}`,
    `- Supabase feedback_records：${datasetSummary.totalRecords}`,
    `- 测试问题数：${results.length}`,
    `- 通过数：${results.filter((result) => result.passed).length}`,
    `- 失败数：${results.filter((result) => !result.passed).length}`,
    "",
  ];

  for (const [index, result] of results.entries()) {
    lines.push(`## ${index + 1}. ${result.question}`);
    lines.push("");
    lines.push(`- 结果：${result.passed ? "PASS" : "FAIL"}`);
    lines.push(`- 范围：${result.scopeLabel}`);
    lines.push(`- 范围样本数：${result.scopedRecordCount}`);
    lines.push(`- 指标：平均评分 ${result.metrics.averageRating}，NPS ${result.metrics.netPromoterScore}，低分 ${result.metrics.lowScoreCount}，负向占比 ${result.metrics.negativeRate}%`);
    lines.push(`- Supabase Chunk：${result.retrieval.chunkCount} 条，模拟标记：${result.retrieval.promptHasMockMarker ? "有" : "无"}`);
    lines.push(`- Agent 阶段：${result.agent.stages.join(" -> ")}`);
    if (result.agent.errorMessage) {
      lines.push(`- 错误：${result.agent.errorMessage}`);
    }
    lines.push("- Top Chunk：");
    for (const chunk of result.retrieval.topChunks) {
      lines.push(`  - ${chunk.city}/${chunk.serviceCenter} · ${chunk.projectName} · ${chunk.chunkType} · score ${chunk.score}`);
      lines.push(`    ${chunk.text}`);
    }
    lines.push("- Agent 回答摘录：");
    lines.push(`  ${result.agent.answerPreview.replace(/\n/g, "\n  ")}`);
    lines.push("");
  }

  return lines.join("\n");
}

const query = new URLSearchParams({
  select:
    "source_record_id,submitted_at,platform,project_name,project_type,region,city,service_center,service_scenario,service_stage,rating,nps_score,sentiment,severity,feedback_text,contact_name,phone_masked,consent_state,raw_payload",
  "raw_payload->>mock_batch_id": `eq.${batchId}`,
}).toString();

try {
  const rows = await fetchSupabaseRows("feedback_records", query, [
    [0, 249],
    [250, 499],
  ]);
  const records = rows.map(mapFeedbackRow);
  const smokeCases = pickSmokeCases(records).slice(0, smokeQuestionLimit);
  const results = [];

  for (const smokeCase of smokeCases) {
    console.error(`[smoke] starting ${smokeCase.id}: ${smokeCase.question}`);
    let result;
    try {
      result = await runSmokeCase(records, smokeCase);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown smoke test failure";
      console.error(`[smoke] ${smokeCase.id}: FAIL ${message}`);
      result = {
        id: smokeCase.id,
        question: smokeCase.question,
        scopeLabel: "运行失败",
        scenario: smokeCase.scenario,
        scopedRecordCount: 0,
        metrics: {
          averageRating: 0,
          netPromoterScore: 0,
          lowScoreCount: 0,
          negativeRate: 0,
          followUpCount: 0,
        },
        retrieval: {
          chunkCount: 0,
          promptHasMockMarker: false,
          topChunks: [],
        },
        agent: {
          refused: true,
          stages: [],
          answerPreview: "",
          answerLength: 0,
          streamedLength: 0,
          evidenceQuoteCount: 0,
          errorMessage: message,
        },
        passed: false,
      };
    }
    results.push(result);
    console.log(
      JSON.stringify({
        id: result.id,
        passed: result.passed,
        question: result.question,
        scopedRecordCount: result.scopedRecordCount,
        chunkCount: result.retrieval.chunkCount,
        stages: result.agent.stages,
        topChunk: result.retrieval.topChunks[0],
        answerPreview: result.agent.answerPreview,
      }),
    );
  }

  const datasetSummary = {
    batchId,
    totalRecords: records.length,
    dateRange: [
      records.map((record) => record.submittedAt).sort()[0],
      records.map((record) => record.submittedAt).sort().at(-1),
    ],
    topCenters: countBy(records, (record) => `${record.city}/${record.serviceCenter}`).slice(0, 8),
    topProjects: countBy(records, (record) => record.projectName).slice(0, 8),
  };
  const report = {
    generatedAt: new Date().toISOString(),
    datasetSummary,
    results,
    passed: results.every((result) => result.passed),
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(outputMdPath, buildMarkdownReport(results, datasetSummary), "utf8");

  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        outputJsonPath,
        outputMdPath,
        passCount: results.filter((result) => result.passed).length,
        total: results.length,
      },
      null,
      2,
    ),
  );

  if (!report.passed) {
    process.exitCode = 1;
  }
} finally {
  await viteServer.close();
}
