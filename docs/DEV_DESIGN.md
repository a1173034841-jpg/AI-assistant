# 新能源车主服务体验 AI 洞察助手开发设计

## 1. 技术栈

MVP 默认使用 React 本地原型。

推荐后续实现：

- Vite + React + TypeScript
- 本地 JSON 模拟数据
- Tailwind CSS 或普通 CSS
- 规则分类函数 + LLM 接口占位层
- 图表库可选 Recharts

第一版可以先不接真实 LLM，使用 mock 分析结果保证 Demo 稳定；后续再替换成真实模型调用。

## 2. 页面结构

### Dashboard 首页

- 顶部 KPI：反馈数、平均 NPS、负面反馈占比、待跟进数
- 区域筛选：全部、华南、华东、华北、西南
- 渠道筛选：问卷、社群、App 评价、售后回访、活动反馈
- 高频问题标签 Top 5
- 情绪分布
- 服务环节归因
- AI 洞察报告卡片

### 反馈列表页

- 反馈文本
- 区域 / 城市 / 车型 / 渠道
- 情绪
- 问题标签
- 严重程度
- 是否需跟进

### 洞察报告页

- 本期核心问题
- NPS 波动原因
- 典型车主原话
- 待跟进问题
- 运营动作建议

## 3. 模拟数据结构

```ts
type FeedbackItem = {
  id: string;
  date: string;
  region: "华南" | "华东" | "华北" | "西南";
  city: string;
  brand: string;
  vehicleModel: string;
  channel: "问卷" | "社群" | "App评价" | "售后回访" | "活动反馈";
  serviceStage: "服务发起" | "服务接待" | "服务质量" | "补能体验" | "软件与智能化" | "用户运营";
  feedbackText: string;
  rating: number;
  npsScore: number;
  isFollowupRequired: boolean;
};
```

## 4. AI 分析输出结构

```ts
type FeedbackAnalysis = {
  feedbackId: string;
  sentiment: "正向" | "中性" | "负向";
  issueTags: string[];
  serviceStage: FeedbackItem["serviceStage"];
  severity: "低" | "中" | "高";
  rootCauseSummary: string;
  representativeQuote: string;
  recommendedAction: string;
  followupPriority: "无需跟进" | "普通跟进" | "优先跟进";
};
```

## 5. Dashboard 聚合结构

```ts
type DashboardSummary = {
  totalFeedback: number;
  averageNps: number;
  negativeRatio: number;
  followupCount: number;
  tagDistribution: Array<{ tag: string; count: number }>;
  sentimentDistribution: Array<{ sentiment: string; count: number }>;
  stageBreakdown: Array<{ stage: string; count: number }>;
  regionComparison: Array<{ region: string; averageNps: number; negativeRatio: number }>;
  aiInsightReport: string;
};
```

## 6. 数据流

1. 前端加载本地 `feedback.json`。
2. 规则层根据关键词和字段生成初始标签。
3. AI 分析层生成情绪、根因摘要、建议动作和跟进优先级。
4. 聚合层生成 Dashboard 指标。
5. 页面层展示 KPI、图表、反馈列表和报告。

## 7. 规则标签逻辑

第一版用关键词 + 字段映射：

- 出现“预约、排队、等了、App 提交”：服务发起
- 出现“解释不清、态度、接待”：服务接待
- 出现“没修好、复发、配件”：服务质量
- 出现“充电、排队、占位费、速度”：补能体验
- 出现“OTA、App、辅助驾驶、功能”：软件与智能化
- 出现“活动、权益、社群、礼品”：用户运营

如果多类命中，按反馈原始 `serviceStage` 优先，其次按关键词数量。

## 8. LLM 分析 Prompt 占位

输入：

- 车主反馈原文
- 渠道
- 服务环节
- 评分
- NPS

输出 JSON：

- `sentiment`
- `issueTags`
- `severity`
- `rootCauseSummary`
- `recommendedAction`
- `followupPriority`

约束：

- 不输出维修诊断。
- 不给安全驾驶建议。
- 不虚构车主没有提到的信息。
- 如果信息不足，标记为“需人工复核”。

## 9. 演示数据建议

准备 40-60 条模拟反馈，覆盖：

- 4 个区域
- 5 个渠道
- 6 个服务环节
- 正向、中性、负向三类情绪
- 至少 10 条需要优先跟进的问题
- 至少 8 条可作为好评传播素材的正向反馈

## 10. Demo 验收路径

1. 打开 Dashboard。
2. 展示区域总览 KPI。
3. 切换到华南区域。
4. 查看高频问题标签。
5. 点击“移动服务 / 服务等待”相关反馈。
6. 展示典型原话和待跟进问题。
7. 打开 AI 洞察报告。
8. 用 3 分钟讲清楚产品价值。

## 11. 边界与风险

- 不接真实个人数据，避免隐私风险。
- 不生成维修诊断，避免安全风险。
- 不宣称替代主机厂现有系统。
- 不把模拟数据包装成真实客户数据。
- 不把 Tesla 单品牌经验夸大成全行业结论。

## 12. 后续迭代

- 接入真实问卷 CSV
- 支持自定义标签体系
- 支持区域周报导出
- 支持 LLM 真实调用
- 支持多品牌对比
- 支持服务中心待跟进任务流

