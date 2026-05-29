# 数据与分析规格

## 1. 数据策略

MVP 使用本地模拟数据，模拟来自问卷星、腾讯问卷和 App 问卷导出的售后反馈。

数据重点不是做 Dashboard，而是支撑：

```txt
问卷导出
-> 字段映射
-> 项目 / 日期筛选
-> 指标计算
-> 重点关注
-> 专项归因
-> 证据原话
-> 报告输出
```

## 2. 基础枚举

```ts
type SurveyPlatform = "问卷星" | "腾讯问卷" | "金数据" | "App内问卷" | "短信链接" | "企微链接";

type Region = "华南" | "华东" | "华北" | "西南";

type ServiceScenario =
  | "到店服务"
  | "移动服务"
  | "补能体验"
  | "App/OTA"
  | "活动/社群"
  | "其他";

type ServiceStage =
  | "服务发起"
  | "服务接待"
  | "服务质量"
  | "补能体验"
  | "软件与智能化"
  | "用户运营";
```

## 3. 第三方问卷导出

```ts
type ThirdPartySurveyExport = {
  exportId: string;
  platform: SurveyPlatform;
  exportedAt: string;
  sourceName: string;
  projectName: string;
  periodStart: string;
  periodEnd: string;
  records: FeedbackImportRecord[];
};
```

导入识别规则：

- `projectName` 优先读取表格中的项目 / 活动 / 问卷名称列，没有则使用文件名建议。
- `periodStart` 和 `periodEnd` 从提交时间列的最早和最晚日期推断。
- 字段映射需要运营确认。
- `projectName` 是业务分析对象，`platform` 和 `sourceName` 是来源通道；同一项目可以合并多份来源文件。

导入后校验规则：

| 校验项 | 计算口径 | 状态 |
| --- | --- | --- |
| 业务项目一致性 | 当前合并来源文件的 `projectName` 是否只有一个 | 通过 / 异常 |
| 来源文件与样本量 | 当前项目下来源文件数量和反馈记录数量 | 通过 / 异常 |
| 时间范围推断 | 根据 `submittedAt` 取最早和最晚日期，并与项目声明周期比对 | 通过 / 需确认 / 异常 |
| 必填字段完整性 | 检查提交时间、来源、城市、服务中心、服务场景、服务评分或推荐意愿评分、开放反馈原话 | 通过 / 异常 |
| 指标字段覆盖 | 统计服务评分、推荐意愿评分、城市与服务中心可计算记录数 | 通过 / 需确认 / 异常 |
| 隐私字段检查 | 检测疑似明文手机号、VIN、车牌、地址等信息 | 通过 / 异常 |

校验结果进入步骤一的“导入后校验”面板。面板展示的是当前项目真实计算结果，不是静态说明。存在“异常”时应先修正导入表；存在“需确认”时可以进入下一步，但运营需要确认日期范围或字段映射。

标准导入模板字段：

| 字段 | 要求 | 进入分析 |
| --- | --- | --- |
| 项目名称 | 必填 | 识别本次问卷批次和报告标题 |
| 问卷来源 | 建议 | 区分问卷星、腾讯问卷、App 内问卷等来源通道 |
| 提交时间 | 必填 | 推断项目周期，支持日期筛选和倒序评论 |
| 区域 / 省份 / 城市 | 必填 | 支持全国、区域、城市多选分析 |
| 服务中心名称 | 必填 | 下钻到网点，识别风险服务中心 |
| 服务场景 | 必填 | 区分到店、移动服务、补能、App/OTA 等场景 |
| 服务评分 / 推荐意愿评分 | 必填 | 计算体验结果、净推荐值、推荐者、贬损者和满意率 |
| 开放反馈原话 | 必填 | 生成归因、证据原话、报告段落和处理动作 |
| 是否愿意联系 | 建议 | 计算联系授权率，筛选可回访样本 |
| 问题是否解决 | 建议 | 判断闭环状态和待跟进问题 |
| 联系方式 | 可选 | 仅用于模拟跟进信号，MVP 不保存真实个人信息 |

## 4. 标准化反馈记录

```ts
type FeedbackImportRecord = {
  id: string;
  submittedAt: string;
  platform: SurveyPlatform;
  region?: Region;
  city?: string;
  serviceCenter?: string;
  serviceScenario: ServiceScenario;
  rating?: number;
  npsScore?: number;
  feedbackText: string;
  contact?: OptionalContactInfo;
};
```

隐私规则：

- MVP 不存储真实姓名、手机号、车牌、VIN 或住址。
- 示例联系方式必须脱敏。
- 联系方式只作为是否可跟进的信号。

## 5. 工作台场景

```ts
type WorkbenchScenario =
  | "服务问题闭环"
  | "满意度归因"
  | "区域/城市下钻"
  | "活动体验复盘"
  | "口碑素材与风险";
```

## 6. 指标维度

```ts
type MetricDimension = {
  label: string;
  value: string;
  helper: string;
};
```

核心指标：

- 反馈量
- 平均评分
- 净推荐值（NPS）
- 推荐者 / 贬损者
- 被动者
- 满意率
- 低分反馈
- 负向占比
- 待跟进
- 联系授权率
- 需人工复核
- 风险服务中心
- 高发服务环节

## 7. 重点关注

```ts
type FocusRegionInsight = {
  title: string;
  tone: "good" | "risk";
  location: string;
  serviceCenter: string;
  totalFeedback: number;
  representativeCount: number;
  commonPattern: string;
  recommendedAction: string;
  evidenceQuotes: EvidenceQuote[];
};
```

用途：

- 做得好的区域：提炼可复制共性。
- 做得差的区域：提炼问题共性和闭环动作。

## 8. 证据原话

```ts
type EvidenceQuote = {
  feedbackId: string;
  quote: string;
  sentiment: Sentiment;
  serviceStage: ServiceStage;
  reasonToUse: string;
  scoreSource: {
    rating?: number;
    npsScore?: number;
    submittedAt: string;
    sourceLabel: string;
    location: string;
    serviceScenario: ServiceScenario;
  };
};
```

每条证据必须能追溯：

- 原话
- 评分
- 推荐意愿评分
- 提交时间
- 来源问卷
- 城市 / 服务中心
- 服务场景

## 9. 分析原则

- 每个核心结论至少要有 1 条证据原话。
- 证据原话必须来自输入反馈。
- 不虚构车主没有提到的信息。
- 情绪和严重程度不确定时标记为需人工复核。
- 负向高严重度反馈优先进入问题闭环。
- 正向具体反馈优先进入口碑素材候选。

## 10. 模拟数据覆盖要求

- 不少于 40 条反馈。
- 至少包含 1 个千级样本项目，模拟主机厂一周几百到几千条售后反馈的真实规模。
- 覆盖问卷星、腾讯问卷、App 内问卷。
- 覆盖 4 个区域。
- 覆盖多个城市和服务中心。
- 覆盖 6 类服务环节。
- 至少 10 条负向反馈。
- 至少 8 条正向样本。
- 至少 6 条需人工复核或需跟进反馈。

大样本处理原则：

- 指标计算、重点关注和报告生成面向完整筛选范围。
- 页面默认展示聚合结果、风险定位和代表证据，不一次性渲染全部原始评论。
- 原始评论只在服务中心下钻后展示，并采用分页或虚拟列表作为生产实现方向。
- 周度千级样本可由前端原型直接演示；月度数万级样本需要后台解析、异步分析和缓存报告结果。
