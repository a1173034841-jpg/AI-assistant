import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const inputPath = join(process.cwd(), "data", "mock-vector-surveys", "mock_after_sales_feedback_records_500.csv");
const outputDir = join(process.cwd(), "data", "manual-test");
const outputPath = join(outputDir, "manual_after_sales_upload_sample_2026-06-17.csv");

const targetProjects = new Set([
  "春季保养回访",
  "App预约体验复盘",
  "端午车主活动反馈",
  "维修质量专项复盘",
  "问题复发闭环回访",
  "到店流程体验复盘",
  "夏季补能体验回访",
]);

const headerMap = [
  ["项目名称", "project_name"],
  ["问卷来源", "platform"],
  ["提交时间", "submitted_at"],
  ["区域", "region"],
  ["省份", "province"],
  ["城市", "city"],
  ["服务中心名称", "service_center"],
  ["服务场景", "service_scenario"],
  ["服务评分", "rating"],
  ["推荐意愿评分", "nps_score"],
  ["开放反馈原话", "feedback_text"],
  ["是否愿意联系", "contact_consent"],
  ["问题是否解决", "issue_resolved"],
  ["联系方式", "phone_masked"],
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") continue;
    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((item) => item.trim()));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeConsent(value) {
  if (value === "已授权联系") return "是";
  if (value === "拒绝联系") return "否";
  return "未询问";
}

function normalizeSubmittedAt(value) {
  return value.replace("T", " ").replace(/\+08:00$/, "").replace(/\+00:00$/, "");
}

const parsed = parseCsv(readFileSync(inputPath, "utf8"));
const sourceHeaders = parsed[0];
const records = parsed.slice(1).map((row) =>
  Object.fromEntries(sourceHeaders.map((key, index) => [key, row[index] ?? ""])),
);

const balancedRows = records
  .filter((record) => targetProjects.has(record.project_name))
  .sort((a, b) =>
    a.project_name.localeCompare(b.project_name, "zh-CN") ||
    a.region.localeCompare(b.region, "zh-CN") ||
    a.city.localeCompare(b.city, "zh-CN") ||
    a.submitted_at.localeCompare(b.submitted_at),
  )
  .slice(0, 180);

const outputRows = [
  headerMap.map(([label]) => label),
  ...balancedRows.map((record) =>
    headerMap.map(([, sourceKey]) => {
      if (sourceKey === "submitted_at") return normalizeSubmittedAt(record[sourceKey]);
      if (sourceKey === "contact_consent") return normalizeConsent(record[sourceKey]);
      return record[sourceKey];
    }),
  ),
];

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, `\uFEFF${outputRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");

const summary = {
  outputPath,
  rowCount: outputRows.length - 1,
  projects: Array.from(new Set(balancedRows.map((record) => record.project_name))).sort((a, b) => a.localeCompare(b, "zh-CN")),
  regions: Array.from(new Set(balancedRows.map((record) => record.region))).sort((a, b) => a.localeCompare(b, "zh-CN")),
  centers: new Set(balancedRows.map((record) => record.service_center)).size,
  lowScoreRows: balancedRows.filter((record) => Number(record.rating) <= 2).length,
  contactRows: balancedRows.filter((record) => normalizeConsent(record.contact_consent) === "是").length,
};

console.log(JSON.stringify(summary, null, 2));
