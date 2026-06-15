import { readFileSync } from "node:fs";
import { join } from "node:path";

const dataDir = join(process.cwd(), "data", "mock-vector-surveys");

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

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((item) => item.trim()));
}

function readRows(fileName) {
  const parsed = parseCsv(readFileSync(join(dataDir, fileName), "utf8"));
  const header = parsed[0];
  return parsed.slice(1).map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])));
}

function countBy(items, accessor) {
  return items.reduce((counts, item) => {
    const key = accessor(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function duplicateCount(items, accessor) {
  const seen = new Set();
  let duplicates = 0;
  for (const item of items) {
    const key = accessor(item);
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  return duplicates;
}

const rawRows = readRows("mock_after_sales_surveys_raw_500.csv");
const normalizedRows = readRows("mock_after_sales_feedback_records_500.csv");
const chunks = readFileSync(join(dataDir, "mock_after_sales_feedback_chunks.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const report = readFileSync(join(dataDir, "mock_after_sales_data_quality_report.md"), "utf8");

const byDirection = countBy(normalizedRows, (row) => row.survey_direction);
const byChunkType = countBy(chunks, (chunk) => chunk.chunk_type);
const rawPhonePattern = /(^|[^A-Z0-9])1[3-9]\d{9}([^A-Z0-9]|$)/;
const duplicateFeedbackTextCombos = duplicateCount(
  normalizedRows,
  (row) => `${row.service_center}|${row.rating}|${row.feedback_text}`,
);
const presidioZeroLine = "\u4e0d\u5141\u8bb8\u5b9e\u4f53\u547d\u4e2d\u6570\uff1a0";
const presidioPassText = "\u901a\u8fc7\uff1a\u672a\u53d1\u73b0\u672a\u5141\u8bb8\u7684 Presidio PII \u5b9e\u4f53";

const checks = [
  ["raw rows", rawRows.length === 500, rawRows.length],
  ["normalized rows", normalizedRows.length === 500, normalizedRows.length],
  [
    "five directions 100 each",
    Object.keys(byDirection).length === 5 && Object.values(byDirection).every((count) => count === 100),
    byDirection,
  ],
  ["chunks 3000", chunks.length === 3000, chunks.length],
  [
    "six chunk types 500 each",
    Object.keys(byChunkType).length === 6 && Object.values(byChunkType).every((count) => count === 500),
    byChunkType,
  ],
  [
    "synthetic flags",
    normalizedRows.every((row) => row.is_synthetic === "true"),
    normalizedRows.filter((row) => row.is_synthetic !== "true").length,
  ],
  [
    "mock batch id",
    normalizedRows.every((row) => row.mock_batch_id === "mock-after-sales-v1"),
    normalizedRows.filter((row) => row.mock_batch_id !== "mock-after-sales-v1").length,
  ],
  ["no raw phone", !rawPhonePattern.test(JSON.stringify(normalizedRows)), "checked"],
  ["low duplicate text combos", duplicateFeedbackTextCombos <= 25, duplicateFeedbackTextCombos],
  ["presidio violations zero", report.includes(presidioZeroLine) && report.includes(presidioPassText), "checked"],
];

let failed = false;
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${JSON.stringify(detail)}`);
  if (!ok) failed = true;
}

if (failed) {
  process.exitCode = 1;
}
