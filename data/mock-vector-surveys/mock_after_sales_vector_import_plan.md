# 模拟售后问卷向量入库执行说明

## 1. 文件

| 文件 | 用途 |
| --- | --- |
| mock_after_sales_surveys_raw_500.csv | 模拟问卷星 / 腾讯问卷等平台导出原始表 |
| mock_after_sales_feedback_records_500.csv | 清洗后的标准化反馈记录 |
| mock_after_sales_feedback_chunks.jsonl | 向量入库前 Chunk |
| mock_after_sales_data_quality_report.md | 数据质量、去重、脱敏与 Presidio 审计报告 |

## 2. 推荐入库顺序

```txt
survey_sources
-> projects
-> service_centers
-> import_batches
-> feedback_records
-> feedback_record_chunks
-> metric_snapshots
```

## 3. 检索职责

- SQL：时间、项目、区域、城市、服务中心、评分、NPS、授权联系等结构化筛选。
- BM25：等待时间、解释不清、问题复发、App预约失败、充电排队、权益说明等精准关键词。
- Chunk / Vector：相似表达归并、跨问卷方向召回、Agent 追问上下文和报告证据选择。

## 4. Chunk 入库字段建议

| 字段 | 说明 |
| --- | --- |
| chunk_id | Chunk 唯一 ID |
| feedback_id | 对应 feedback_records |
| chunk_type | record_summary / feedback_text / issue_reason / closure_signal / vehicle_context / survey_context |
| content | JSONL 中的 text 字段 |
| metadata | JSONL 中的 metadata、地区、服务环节、情绪等 |
| embedding | 后续由 embedding 服务生成 |
| search_document | 由 content + metadata 文本生成的 BM25 字段 |

## 5. 入库前阻断规则

- `is_synthetic` 必须为 true。
- `mock_batch_id` 必须为 mock-after-sales-v1。
- Presidio 审计如发现未脱敏真实手机号、疑似真实车牌、疑似真实 VIN 或详细住址，应阻断入库。
- 当前假车牌和假 VIN 仅用于字段占位、检索与脱敏校验，不作为真实车辆档案。

## 6. Supabase REST 入库脚本

先执行 dry-run，确认文件、环境变量和目标行数：

```powershell
node scripts/import-mock-vector-surveys-to-supabase.mjs
```

确认 `.env.local` 中存在 `SUPABASE_SERVICE_ROLE_KEY` 或 `SUPABASE_ANON_KEY`，且目标表字段已与本批 JSON payload 对齐后，再执行真实写入：

```powershell
node scripts/import-mock-vector-surveys-to-supabase.mjs --execute
```

当前脚本会准备以下表的写入 payload：

- `survey_sources`
- `projects`
- `service_centers`
- `import_batches`
- `feedback_records`
- `feedback_record_chunks`
