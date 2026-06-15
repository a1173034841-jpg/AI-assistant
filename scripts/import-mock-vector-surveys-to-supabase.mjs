import { readFileSync } from "node:fs";
import { join } from "node:path";

const shouldExecute = process.argv.includes("--execute");
const dataDir = join(process.cwd(), "data", "mock-vector-surveys");
const batchId = "mock-after-sales-v1";

function loadEnv() {
  const text = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

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

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function uniqueBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}

const env = loadEnv();
const restUrl = env.SUPABASE_REST_URL || (env.SUPABASE_URL ? `${env.SUPABASE_URL}/rest/v1` : "");
const apiKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
const normalizedRows = readRows("mock_after_sales_feedback_records_500.csv");
const chunkRows = readFileSync(join(dataDir, "mock_after_sales_feedback_chunks.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

if (!restUrl) {
  console.error("Missing SUPABASE_REST_URL or SUPABASE_URL in .env.local.");
  process.exit(1);
}

if (!apiKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in .env.local. Dry-run can continue, --execute cannot.");
  if (shouldExecute) process.exit(1);
}

const surveySources = uniqueBy(normalizedRows, (row) => row.source_name).map((row) => ({
  platform: row.platform,
  source_name: row.source_name,
  source_type: row.source_channel,
  external_source_id: `${batchId}:${row.source_name}`,
}));

const projects = uniqueBy(normalizedRows, (row) => row.project_name).map((row) => ({
  project_name: row.project_name,
  project_type: row.project_type,
  period_start: "2026-05-01",
  period_end: "2026-06-14",
  status: "mock",
}));

const serviceCenters = uniqueBy(normalizedRows, (row) => `${row.city}|${row.service_center}`).map((row) => ({
  region: row.region,
  city: row.city,
  service_center_name: row.service_center,
  external_center_id: `${batchId}:${row.city}:${row.service_center}`,
}));

const importBatch = {
  import_batch_code: batchId,
  file_name: "mock_after_sales_surveys_raw_500.csv",
  source_id: undefined,
  exported_at: new Date().toISOString(),
  imported_at: new Date().toISOString(),
  period_start: "2026-05-01",
  period_end: "2026-06-14",
  total_records: normalizedRows.length,
  valid_records: normalizedRows.length,
  warning_count: 0,
  error_count: 0,
  status: "validated",
  validation_summary: {
    is_synthetic: true,
    mock_batch_id: batchId,
    chunk_count: chunkRows.length,
    presidio_status: "passed",
  },
};

function buildFeedbackRecords({ importBatchId, projectIdByName, sourceIdByName, centerIdByName }) {
  return normalizedRows.map((row) => ({
  import_batch_id: importBatchId,
  project_id: projectIdByName.get(row.project_name),
  source_id: sourceIdByName.get(row.source_name),
  service_center_id: centerIdByName.get(`${row.city}|${row.service_center}`),
  source_record_id: row.feedback_id,
  submitted_at: row.submitted_at,
  platform: row.platform,
  project_name: row.project_name,
  project_type: row.project_type,
  region: row.region,
  city: row.city,
  service_center: row.service_center,
  service_scenario: row.service_scenario,
  service_stage: row.service_stage,
  rating: Number(row.rating),
  nps_score: Number(row.nps_score),
  sentiment: row.sentiment,
  severity: row.severity,
  issue_tags: row.issue_tags.split("|"),
  feedback_text: row.feedback_text,
  contact_name: row.mock_user_id,
  consent_state: row.contact_consent,
  review_required: row.review_required === "true",
  follow_up_required: row.contact_consent === "已授权联系" || Number(row.rating) <= 2 || row.review_required === "true",
  phone_masked: row.phone_masked,
  raw_payload: {
    source_name: row.source_name,
    source_channel: row.source_channel,
    survey_direction: row.survey_direction,
    question_count: Number(row.question_count),
    issue_resolved: row.issue_resolved,
    mock_user_id: row.mock_user_id,
    vehicle_plate_mock: row.vehicle_plate_mock,
    vin_mock: row.vin_mock,
    is_synthetic: true,
    mock_batch_id: batchId,
  },
  search_document: `${row.project_name} ${row.city} ${row.service_center} ${row.service_scenario} ${row.service_stage} ${row.issue_tags.replace(/\|/g, " ")} ${row.feedback_text}`,
  }));
}

function buildFeedbackChunks({ feedbackIdByMockId }) {
  const chunkIndexByFeedback = new Map();
  return chunkRows.map((chunk) => ({
  feedback_record_id: feedbackIdByMockId.get(chunk.feedback_id),
  chunk_index: (() => {
    const current = chunkIndexByFeedback.get(chunk.feedback_id) ?? 0;
    chunkIndexByFeedback.set(chunk.feedback_id, current + 1);
    return current;
  })(),
  chunk_text: chunk.text,
  token_count: chunk.tokens.length,
  metadata: {
    chunk_type: chunk.chunk_type,
    tokens: chunk.tokens,
    survey_direction: chunk.survey_direction,
    project_name: chunk.project_name,
    submitted_at: chunk.submitted_at,
    region: chunk.region,
    city: chunk.city,
    service_center: chunk.service_center,
    service_scenario: chunk.service_scenario,
    service_stage: chunk.service_stage,
    sentiment: chunk.sentiment,
    severity: chunk.severity,
    issue_tags: chunk.issue_tags,
    ...chunk.metadata,
    is_synthetic: true,
    mock_batch_id: batchId,
  },
  search_document: `${chunk.chunk_type} ${chunk.text} ${chunk.tokens.join(" ")}`,
  }));
}

const payloads = [
  ["survey_sources", surveySources],
  ["projects", projects],
  ["service_centers", serviceCenters],
  ["import_batches", [importBatch]],
];

async function postRows(table, rows, { returning = "minimal" } = {}) {
  const inserted = [];
  for (const batch of chunkArray(rows, 100)) {
    const response = await fetch(`${restUrl}/${table}`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Prefer: `resolution=merge-duplicates,return=${returning}`,
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${table} import failed: ${response.status} ${response.statusText} ${body}`);
    }

    if (returning === "representation") {
      inserted.push(...(await response.json()));
    }
  }
  return inserted;
}

async function deleteRows(table, filter) {
  const response = await fetch(`${restUrl}/${table}?${filter}`, {
    method: "DELETE",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Prefer: "return=minimal",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${table} cleanup failed: ${response.status} ${response.statusText} ${body}`);
  }
}

async function getRows(table, query) {
  const response = await fetch(`${restUrl}/${table}?${query}`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${table} query failed: ${response.status} ${response.statusText} ${body}`);
  }

  return response.json();
}

async function ensureReferenceRows(table, rows, query, keyFn) {
  const existing = await getRows(table, query);
  const existingByKey = new Map(existing.map((row) => [keyFn(row), row]));
  const missing = rows.filter((row) => !existingByKey.has(keyFn(row)));

  if (missing.length > 0) {
    const inserted = await postRows(table, missing, { returning: "representation" });
    for (const row of inserted) {
      existingByKey.set(keyFn(row), row);
    }
    console.log(`inserted ${inserted.length} missing rows into ${table}`);
  } else {
    console.log(`reused ${existing.length} rows from ${table}`);
  }

  return Array.from(existingByKey.values());
}

console.log(
  JSON.stringify(
    {
      mode: shouldExecute ? "execute" : "dry-run",
      restUrlConfigured: Boolean(restUrl),
      keyConfigured: Boolean(apiKey),
      tables: Object.fromEntries(payloads.map(([table, rows]) => [table, rows.length])),
      deferredTables: {
        feedback_records: normalizedRows.length,
        feedback_record_chunks: chunkRows.length,
      },
      note: shouldExecute
        ? "Will write rows through Supabase REST."
        : "Dry-run only. Add SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY and pass --execute to write.",
    },
    null,
    2,
  ),
);

if (shouldExecute) {
  await deleteRows("feedback_record_chunks", `metadata->>mock_batch_id=eq.${batchId}`);
  await deleteRows("feedback_records", `raw_payload->>mock_batch_id=eq.${batchId}`);
  await deleteRows("import_batches", `import_batch_code=eq.${batchId}`);
  console.log(`cleaned previous ${batchId} import batch, feedback records, and chunks`);

  const insertedSources = await ensureReferenceRows(
    "survey_sources",
    surveySources,
    "select=id,source_name,external_source_id,platform,source_type&limit=1000",
    (row) => row.external_source_id,
  );

  const insertedProjects = await ensureReferenceRows(
    "projects",
    projects,
    "select=id,project_name,project_type,status&period_start,period_end&status=eq.mock&limit=1000",
    (row) => row.project_name,
  );

  const insertedCenters = await ensureReferenceRows(
    "service_centers",
    serviceCenters,
    "select=id,region,city,service_center_name,external_center_id&limit=1000",
    (row) => row.external_center_id,
  );

  const sourceIdByName = new Map(insertedSources.map((source) => [source.source_name, source.id]));
  const projectIdByName = new Map(insertedProjects.map((project) => [project.project_name, project.id]));
  const centerIdByName = new Map(insertedCenters.map((center) => [`${center.city}|${center.service_center_name}`, center.id]));

  importBatch.source_id = insertedSources[0]?.id;
  const insertedBatches = await postRows("import_batches", [importBatch], { returning: "representation" });
  const importBatchId = insertedBatches[0]?.id;
  console.log(`imported ${insertedBatches.length} rows into import_batches`);

  const feedbackRecords = buildFeedbackRecords({ importBatchId, projectIdByName, sourceIdByName, centerIdByName });
  const insertedFeedback = await postRows("feedback_records", feedbackRecords, { returning: "representation" });
  console.log(`imported ${insertedFeedback.length} rows into feedback_records`);

  const feedbackIdByMockId = new Map(insertedFeedback.map((record) => [record.source_record_id, record.id]));
  const feedbackChunks = buildFeedbackChunks({ feedbackIdByMockId });
  const missingChunkLinks = feedbackChunks.filter((chunk) => !chunk.feedback_record_id).length;
  if (missingChunkLinks > 0) {
    throw new Error(`Cannot link ${missingChunkLinks} chunks to inserted feedback_records.`);
  }
  await postRows("feedback_record_chunks", feedbackChunks);
  console.log(`imported ${feedbackChunks.length} rows into feedback_record_chunks`);
}
