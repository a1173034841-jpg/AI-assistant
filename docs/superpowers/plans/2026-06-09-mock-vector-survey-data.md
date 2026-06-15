# Mock Vector Survey Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 500 transparent fake after-sales survey responses, cleaned feedback records, vector-ready chunks, and a data quality report based on the confirmed PRD and five survey templates.

**Architecture:** Keep the production app untouched. Add a deterministic Node.js generator for raw survey exports, normalized records, chunk JSONL, and a baseline quality report; add an optional Python Presidio audit script that validates PII handling when Presidio is installed.

**Tech Stack:** Node.js ESM, CSV/JSONL files, optional Python 3.11 with `presidio-analyzer` and `presidio-anonymizer`.

---

### Task 1: Generate Mock Survey Data

**Files:**
- Create: `scripts/generate-mock-vector-surveys.mjs`
- Create outputs under: `data/mock-vector-surveys/`

- [ ] **Step 1: Create a deterministic Node.js generator**

Implement a generator that writes:

- `mock_after_sales_surveys_raw_500.csv`
- `mock_after_sales_feedback_records_500.csv`
- `mock_after_sales_feedback_chunks.jsonl`
- `mock_after_sales_data_quality_report.md`
- `mock_after_sales_vector_import_plan.md`

The generator must produce exactly 500 records, five directions with 100 records each, all marked `is_synthetic=true`, and transparent fake account, phone, plate, and VIN fields.

- [ ] **Step 2: Run the generator**

Run: `node scripts/generate-mock-vector-surveys.mjs`

Expected: the command exits 0 and reports 500 raw records, 500 normalized records, and chunk counts.

### Task 2: Add Presidio Audit Script

**Files:**
- Create: `scripts/audit-mock-surveys-presidio.py`
- Update output: `data/mock-vector-surveys/mock_after_sales_data_quality_report.md`

- [ ] **Step 1: Create the audit script**

Implement a Python script that:

- Reads the raw CSV and normalized CSV.
- Attempts to import `presidio_analyzer` and `presidio_anonymizer`.
- Adds custom pattern recognizers for Chinese vehicle plates and VIN-like strings.
- Scans account, phone, plate, VIN, city, service center, and open text columns.
- Appends a Presidio audit section to the data quality report.
- Exits with a clear message if Presidio is not installed.

- [ ] **Step 2: Run the audit script**

Run with Python 3.11 if available:

`C:\Users\ADMINN\AppData\Roaming\uv\python\cpython-3.11.15-windows-x86_64-none\python.exe scripts/audit-mock-surveys-presidio.py`

Expected: if Presidio is installed, the report gets a completed audit section. If missing, output explains the dependency gap without altering generated data.

### Task 3: Verify Artifacts

**Files:**
- Read generated files under: `data/mock-vector-surveys/`

- [ ] **Step 1: Verify counts and distribution**

Run a Node.js verification command to assert:

- Raw CSV has 500 data rows.
- Normalized CSV has 500 data rows.
- Each survey direction has 100 records.
- Chunk JSONL has at least 2,000 chunks.
- All rows are synthetic.
- No raw phone numbers with 11 visible digits exist.

- [ ] **Step 2: Verify docs and generated files are isolated**

Run: `git status --short`

Expected: only planned new/changed files are relevant; unrelated existing dirty files remain untouched.
