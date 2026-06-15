# 售后问卷向量数据 PRD

## 1. 目标

为主机厂售后反馈报告工作台建立一套可生成、可清洗、可切分、可入库、可检索的模拟问卷数据底座。第一批数据用于向量数据库站位、混合检索验证和 Agent 追问验证，不用于真实用户分析。

本轮先确认数据产品设计，暂不生成 500 份答卷，暂不灌入生产数据库。

## 2. 背景

当前产品主线是：

```txt
问卷星 / 腾讯问卷 / App 问卷 / 短信 / 企微导出
-> 字段识别与映射确认
-> 导入校验与标准化入库
-> SQL 结构化统计
-> BM25 精准文本检索
-> Chunk / Vector 语义检索
-> 8 模块自动复盘与 Agent 追问
```

为了验证后续数据库、检索和报告链路，需要先准备一批足够接近真实售后运营场景的模拟问卷数据。数据必须覆盖不同来源、不同问卷方向、不同城市、不同服务中心、不同服务环节、不同情绪和不同问题严重度。

## 3. 交付范围

### 本轮交付

- 向量数据 PRD。
- 五套售后问卷模板确认稿。
- 每套问卷约 18-22 题。
- 模拟问卷星、腾讯问卷等第三方平台导出字段。
- 定义后续 500 份模拟答卷的数据结构、清洗规则、Chunk 规则、切词规则和入库规则。

### 下一轮交付

- 约 500 份完整模拟答卷。
- 每个方向约 100 份。
- 标准 CSV / Excel 可导入样例。
- 清洗后的标准化记录。
- 可用于向量入库的 Chunk JSONL 或表格。
- Presidio 扫描报告和数据质量报告。

## 4. 五个问卷方向

| 方向 | 目标 | 样本量 | 核心输出 |
| --- | --- | ---: | --- |
| 质量维保型 | 识别维修质量、保养、配件、交付和问题复发 | 100 | 服务质量问题、复发风险、待回访样本 |
| 满意度/NPS 型 | 解释总体满意、推荐意愿和不满意原因 | 100 | 体验结果、满意率、NPS、推荐/贬损结构 |
| 服务流程体验型 | 识别预约、接待、等待、沟通、取车流程问题 | 100 | 服务发起与接待问题、流程瓶颈 |
| 补能/App/智能化体验型 | 识别补能、App、OTA、智能功能使用问题 | 100 | 数字化与补能体验痛点 |
| 活动/用户运营与口碑风险型 | 识别活动体验、权益、社群、正向素材和风险原话 | 100 | 用户运营复盘、口碑素材、投诉风险 |

## 5. 数据对象

### 5.1 第三方平台导出层

模拟问卷星、腾讯问卷或其他问卷平台的原始导出字段。字段用于测试导入映射，不直接作为最终业务模型。

通用导出字段：

| 字段 | 说明 |
| --- | --- |
| 提交序号 | 第三方平台导出的行号 |
| 答卷 ID | 平台答卷唯一 ID，模拟值 |
| 平台来源 | 问卷星、腾讯问卷、金数据、App内问卷、短信链接、企微链接 |
| 问卷名称 | 对应五类问卷模板 |
| 项目名称 | 运营分析对象，例如春季保养回访、端午服务体验复盘 |
| 来源渠道 | 小程序、短信、App、企微、服务顾问代录 |
| 提交时间 | ISO 时间或平台导出时间格式 |
| 答题时长 | 秒 |
| 提交设备 | iOS、Android、PC、微信内置浏览器 |
| IP 属地/城市 | 只模拟城市，不生成真实 IP |
| 用户账号 | 透明假账号 |
| 手机号 | 脱敏假手机号 |
| 车牌号 | 透明假车牌 |
| VIN | 透明假 VIN |
| 是否模拟数据 | 固定为是 |
| 模拟数据批次 | 例如 mock-after-sales-v1 |

### 5.2 标准化反馈记录层

清洗后映射到工作台核心数据结构：

| 字段 | 说明 |
| --- | --- |
| feedback_id | 标准化反馈 ID |
| submitted_at | 提交时间 |
| platform | 问卷平台 |
| source_name | 来源文件或来源问卷 |
| project_name | 业务项目 |
| project_type | 项目类型 |
| region | 区域 |
| province | 省份 |
| city | 城市 |
| service_center | 服务中心 |
| service_scenario | 服务场景 |
| service_stage | 服务环节归因 |
| rating | 服务评分 |
| nps_score | 推荐意愿评分 |
| sentiment | 正向 / 中性 / 负向 |
| severity | 低 / 中 / 高 |
| issue_tags | 问题标签 |
| feedback_text | 开放反馈原话 |
| contact_consent | 未询问 / 已授权联系 / 拒绝联系 |
| issue_resolved | 是 / 否 / 不确定 |
| review_required | 是否需人工复核 |
| is_synthetic | 固定为 true |
| pii_scan_status | Presidio 扫描结果 |

## 6. 模拟数据原则

### 6.1 透明假数据

- 所有账号、姓名、手机号、车牌、VIN、IP 属地均为模拟值。
- 每条记录必须带 `is_synthetic=true`。
- 每批数据必须带 `mock_batch_id` 和 `mock_schema_version`。
- 不生成真实姓名、真实手机号、真实车牌、真实 VIN、真实住址、真实 IP。
- 车牌和 VIN 可以模拟，但必须在字段名或批次说明中明确为 mock。

### 6.2 假账号规则

| 类型 | 示例 |
| --- | --- |
| 问卷星用户 | wjx_user_0001 |
| 腾讯问卷用户 | txwj_user_0001 |
| App 用户 | app_user_0001 |
| 企微触达用户 | wecom_user_0001 |

### 6.3 假手机号规则

使用脱敏格式，例如：

```txt
138****0001
139****0102
136****2108
```

### 6.4 假车牌规则

模拟车牌允许覆盖燃油车与新能源车格式，但必须明显用于测试：

```txt
粤B-MK001
沪A-MK102
京N-MK208
苏E-MK360
粤B-DM0001
沪A-DM0102
```

### 6.5 假 VIN 规则

VIN 使用 17 位大写字母数字组合，避开 I、O、Q，并保留 mock 批次可追踪性：

```txt
Lmock000000000001
Lmock000000000102
Lmock000000000360
```

生产级校验时应换成符合 VIN 字符集与校验位规则的假 VIN 生成器。本阶段重点是隐私安全和字段占位。

## 7. Microsoft Presidio 隐私治理要求

本项目使用 Microsoft Presidio 作为入库前的 PII 检测和匿名化校验工具。Presidio 应用于三类数据：

- 开放反馈原话。
- 第三方平台导出表格字段。
- 标准化后的结构化 / 半结构化记录。

### 7.1 扫描目标

| 实体 | 处理策略 |
| --- | --- |
| 手机号 | 必须识别；只允许脱敏假手机号 |
| 姓名 | 不生成真实姓名；如出现疑似姓名则替换为模拟称呼 |
| 地址 | 不生成详细住址；只保留区域、城市、服务中心 |
| 车牌号 | 使用自定义 Presidio recognizer 检测 `CN_LICENSE_PLATE` |
| VIN | 使用自定义 Presidio recognizer 检测 `VEHICLE_VIN` |
| 邮箱 / 身份证 / 银行卡 | 不应出现；出现则阻断入库 |

### 7.2 推荐实现方式

- 使用 `presidio-analyzer` 扫描文本列和结构化字段。
- 使用 `presidio-anonymizer` 对违规 PII 做 mask、replace 或 redact。
- 针对中国车牌和 VIN 增加自定义 `PatternRecognizer`。
- 对 `feedback_text`、`contact_text`、`vehicle_plate_mock`、`vin_mock` 做扫描。
- 扫描后输出 `pii_scan_status`、`pii_entities_detected`、`pii_action`。

### 7.3 入库阻断规则

| 条件 | 结果 |
| --- | --- |
| 出现未脱敏真实手机号 | 阻断 |
| 出现疑似真实 VIN 且未标记 mock | 阻断 |
| 出现疑似真实车牌且未标记 mock | 阻断 |
| 出现详细住址 | 阻断 |
| 仅出现透明假账号、假车牌、假 VIN | 允许 |

## 8. 数据清洗规则

### 8.1 去重规则

按以下层级判重：

1. `platform + answer_id` 完全相同：删除重复行。
2. `mock_user_id + submitted_at 10 分钟窗口 + feedback_text` 相同：保留一条。
3. `vehicle_plate_mock + service_center + rating + feedback_text` 高度相似：标记疑似重复。
4. 开放反馈文本相似度高于 0.92：标记复核，不自动删除。

### 8.2 乱码整理

- 统一 UTF-8。
- 清理不可见控制字符。
- 统一全角/半角空格。
- 修正常见导出乱码占位。
- 删除 HTML 标签和多余换行。
- 保留用户原话中的语气词，但压缩重复标点。

### 8.3 字段标准化

- 时间统一为 ISO 字符串。
- 区域统一到华南、华东、华北、西南、华中、西北、东北。
- 服务场景统一到到店服务、移动服务、补能体验、App/OTA、活动/社群、其他。
- 服务环节统一到服务发起、服务接待、服务质量、补能体验、软件与智能化、用户运营。
- 评分统一为 1-5。
- NPS 统一为 0-10。

## 9. Chunk 分类规则

向量库不直接把整张问卷行粗暴入库，而是按运营追问场景切分为多个 Chunk。

| Chunk 类型 | 来源 | 用途 |
| --- | --- | --- |
| record_summary | 单条反馈结构化摘要 | Agent 快速理解一条反馈 |
| feedback_text | 开放反馈原话及上下文 | 语义召回相似表达 |
| issue_reason | 不满意原因、问题描述、改进建议 | 问题聚类和归因 |
| positive_material | 正向原话、可复用亮点 | 口碑素材和优秀案例 |
| closure_signal | 授权联系、未解决、低分、高严重度 | 闭环清单召回 |
| vehicle_context | 假车牌、假 VIN、车辆关联状态 | 测试车辆字段检索，不输出真实隐私 |
| survey_context | 问卷方向、项目、平台、题目答案摘要 | 跨问卷、跨项目追问 |

## 10. Chunk 内容结构

```json
{
  "chunk_id": "chunk_mock_000001_feedback_text",
  "feedback_id": "fb_mock_000001",
  "chunk_type": "feedback_text",
  "survey_direction": "服务流程体验型",
  "project_name": "端午服务体验复盘",
  "submitted_at": "2026-05-30T10:21:00+08:00",
  "region": "华南",
  "city": "深圳",
  "service_center": "深圳南山服务中心",
  "service_scenario": "到店服务",
  "service_stage": "服务接待",
  "sentiment": "负向",
  "severity": "中",
  "issue_tags": ["服务等待", "解释不清"],
  "text": "车主反馈到店后等待时间偏长，服务顾问对预计交付时间解释不清，评分 2 分，愿意被联系。",
  "metadata": {
    "rating": 2,
    "nps_score": 5,
    "contact_consent": "已授权联系",
    "is_synthetic": true,
    "mock_batch_id": "mock-after-sales-v1"
  }
}
```

## 11. 切词与检索规则

### 11.1 中文切词

MVP 阶段建议：

- BM25：使用 PostgreSQL `tsvector` 或后续专门中文分词方案承接精准关键词。
- 向量检索：不依赖强切词，直接对语义 Chunk 文本生成 embedding。
- 分析标签：使用项目内已有 `stageKeywords` 与 `stageIssueTags` 做服务环节归因。

### 11.2 领域词典

第一版词典至少覆盖：

- 服务发起：预约、App 提交、排队、远程诊断、移动服务、确认。
- 服务接待：接待、解释不清、态度、沟通、回复慢、说明。
- 服务质量：没修好、复发、配件、交付、维修结果、保养。
- 补能体验：充电、排队、占位费、速度、费用、超充。
- 软件与智能化：OTA、App、辅助驾驶、功能、推送、蓝牙。
- 用户运营：活动、权益、社群、礼品、车主俱乐部、露营。

## 12. 入库设计

### 12.1 SQL 表

与现有项目目标表保持一致：

- `survey_sources`
- `projects`
- `service_centers`
- `import_batches`
- `feedback_records`
- `feedback_record_chunks`
- `metric_snapshots`
- `report_runs`
- `report_sections`
- `evidence_quotes`
- `agent_messages`

### 12.2 向量字段

建议在 `feedback_record_chunks` 中承接向量检索字段：

| 字段 | 说明 |
| --- | --- |
| id | Chunk ID |
| feedback_record_id | 反馈记录 ID |
| chunk_type | Chunk 类型 |
| content | Chunk 文本 |
| metadata | JSON 元数据 |
| embedding | 向量字段，依赖 pgvector 或外部向量库 |
| search_document | BM25 / 全文检索字段 |
| created_at | 创建时间 |

### 12.3 入库顺序

```txt
survey_sources
-> projects
-> service_centers
-> import_batches
-> feedback_records
-> feedback_record_chunks
-> metric_snapshots
```

## 13. 验收标准

### 数据规模

- 总样本约 500 份。
- 五个方向各约 100 份。
- 覆盖至少 3 个平台来源。
- 覆盖至少 7 个区域。
- 覆盖至少 20 个城市。
- 覆盖至少 30 个服务中心。

### 内容覆盖

- 至少 120 条负向反馈。
- 至少 120 条正向反馈。
- 至少 80 条中性反馈。
- 至少 60 条低分反馈。
- 至少 60 条授权联系反馈。
- 至少 40 条需人工复核反馈。
- 每个服务环节均有正向、负向和中性样本。

### 检索验证

必须能回答以下追问：

- 哪些反馈提到了等待时间长？
- 找出授权联系且低分的反馈。
- 深圳服务中心主要问题是什么？
- 最近一周 App/OTA 相关负反馈有哪些？
- 哪些正向原话可以作为口碑素材？
- 质量维保型问卷里，问题复发集中在哪些服务中心？

## 14. 非目标

- 不生成真实用户数据。
- 不接入第三方问卷平台 API。
- 不替代正式数据治理。
- 不把模拟数据作为业务结论依据。
- 不在本轮直接实现完整向量数据库。
- 不做真实 CRM、工单或车辆档案联动。

## 15. 待确认项

- 五套问卷模板是否通过。
- 是否保留假车牌和假 VIN 两个字段。
- 500 份数据是否按每类严格 100 份，还是允许 90-110 浮动。
- 下一轮模拟数据文件格式：CSV、XLSX、JSONL 是否都需要。
- 向量库目标：Supabase pgvector、独立向量库，或先输出可导入 JSONL。
