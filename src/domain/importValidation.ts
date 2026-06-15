import type { FeedbackImportRecord, ThirdPartySurveyExport } from "./types";

export type ImportValidationStatus = "pass" | "warning" | "fail";

export type ImportValidationItem = {
  id: string;
  label: string;
  status: ImportValidationStatus;
  metric: string;
  detail: string;
};

export type ImportValidationSummary = {
  overallStatus: ImportValidationStatus;
  stats: {
    sourceCount: number;
    recordCount: number;
    inferredStart: string;
    inferredEnd: string;
  };
  items: ImportValidationItem[];
};

const requiredFieldChecks: Array<{
  label: string;
  isPresent: (record: FeedbackImportRecord) => boolean;
}> = [
  { label: "提交时间", isPresent: (record) => isNonEmpty(record.submittedAt) && !Number.isNaN(new Date(record.submittedAt).getTime()) },
  { label: "来源", isPresent: (record) => isNonEmpty(record.platform) },
  { label: "城市", isPresent: (record) => isNonEmpty(record.city) },
  { label: "服务中心", isPresent: (record) => isNonEmpty(record.serviceCenter) },
  { label: "服务场景", isPresent: (record) => isNonEmpty(record.serviceScenario) },
  { label: "服务评分或推荐意愿评分", isPresent: (record) => typeof record.rating === "number" || typeof record.npsScore === "number" },
  { label: "开放反馈原话", isPresent: (record) => isNonEmpty(record.feedbackText) },
];

export function buildImportValidationSummary(exports: ThirdPartySurveyExport[]): ImportValidationSummary {
  const records = exports.flatMap((item) => item.records);
  const projectNames = new Set(exports.map((item) => item.projectName).filter(Boolean));
  const sourceNames = new Set(exports.map((item) => item.sourceName).filter(Boolean));
  const sourceLabels = Array.from(new Set(exports.map((item) => `${item.platform} · ${item.sourceName}`)));
  const inferredRange = inferDateRange(records);
  const missingRequired = countMissingRequired(records);
  const ratingCount = records.filter((record) => typeof record.rating === "number").length;
  const npsCount = records.filter((record) => typeof record.npsScore === "number").length;
  const locationCount = records.filter((record) => isNonEmpty(record.city) && isNonEmpty(record.serviceCenter)).length;
  const privacyRiskCount = records.filter(hasRawPrivateSignal).length;
  const declaredRangeMatches =
    inferredRange.inferredStart === minDate(exports.map((item) => item.periodStart)) &&
    inferredRange.inferredEnd === maxDate(exports.map((item) => item.periodEnd));

  const items: ImportValidationItem[] = [
    {
      id: "project-consistency",
      label: "业务项目识别",
      status: projectNames.size > 0 && exports.length > 0 ? "pass" : "fail",
      metric: `${projectNames.size || 0} 个项目`,
      detail:
        projectNames.size > 0
          ? `已识别 ${projectNames.size} 个业务项目，可在时间范围内选择全部、单个或多个项目分析。`
          : "没有识别到业务项目名称，需要先补充项目字段或手动确认归属。",
    },
    {
      id: "source-files",
      label: "来源文件与样本量",
      status: records.length > 0 ? "pass" : "fail",
      metric: `${sourceNames.size} 个文件 / ${exports.length} 个分组 / ${records.length} 条`,
      detail:
        records.length > 0
          ? `当前导入文件：${Array.from(sourceNames).join("、")}。来源渠道：${sourceLabels.join("、")}。`
          : "没有可分析的反馈记录。",
    },
    {
      id: "time-range",
      label: "时间范围推断",
      status: inferredRange.inferredStart && inferredRange.inferredEnd ? (declaredRangeMatches ? "pass" : "warning") : "fail",
      metric:
        inferredRange.inferredStart && inferredRange.inferredEnd
          ? `${inferredRange.inferredStart} 至 ${inferredRange.inferredEnd}`
          : "未识别",
      detail: declaredRangeMatches
        ? "已根据提交时间列推断项目周期，和当前项目范围一致。"
        : "提交时间推断范围与项目声明范围不完全一致，进入下一步前建议运营确认日期。",
    },
    {
      id: "required-fields",
      label: "必填字段完整性",
      status: missingRequired.total === 0 ? "pass" : "fail",
      metric: `${records.length - missingRequired.affectedRecords}/${records.length}`,
      detail:
        missingRequired.total === 0
          ? "提交时间、城市、服务中心、服务场景、服务评分或推荐意愿评分、开放反馈原话均可用于分析。"
          : `发现 ${missingRequired.affectedRecords} 条记录缺少必填字段，涉及：${missingRequired.labels.join("、")}。`,
    },
    {
      id: "metric-coverage",
      label: "指标字段覆盖",
      status: ratingCount > 0 || npsCount > 0 ? (ratingCount === records.length && npsCount === records.length ? "pass" : "warning") : "fail",
      metric: `评分 ${ratingCount} 条 / 推荐意愿 ${npsCount} 条`,
      detail:
        ratingCount > 0 || npsCount > 0
          ? `评分 ${ratingCount} 条、推荐意愿评分 ${npsCount} 条、城市和服务中心 ${locationCount} 条可计算。`
          : "没有识别到评分或推荐意愿字段，无法计算体验结果指标。",
    },
    {
      id: "privacy-check",
      label: "隐私字段检查",
      status: privacyRiskCount > 0 ? "fail" : "pass",
      metric: privacyRiskCount > 0 ? `${privacyRiskCount} 条风险` : "未发现明文风险",
      detail:
        privacyRiskCount > 0
          ? "检测到疑似明文手机号、VIN、车牌或地址信息，导入前需要脱敏。"
          : "联系方式仅允许脱敏或授权状态信号，未发现明显明文个人信息。",
    },
  ];

  return {
    overallStatus: summarizeStatus(items),
    stats: {
      sourceCount: sourceNames.size,
      recordCount: records.length,
      inferredStart: inferredRange.inferredStart,
      inferredEnd: inferredRange.inferredEnd,
    },
    items,
  };
}

function countMissingRequired(records: FeedbackImportRecord[]) {
  const missingLabels = new Set<string>();
  let total = 0;
  let affectedRecords = 0;

  for (const record of records) {
    let recordMissing = false;
    for (const check of requiredFieldChecks) {
      if (!check.isPresent(record)) {
        missingLabels.add(check.label);
        total += 1;
        recordMissing = true;
      }
    }
    if (recordMissing) affectedRecords += 1;
  }

  return { total, affectedRecords, labels: Array.from(missingLabels) };
}

function inferDateRange(records: FeedbackImportRecord[]) {
  const dates = records
    .map((record) => toDateOnly(record.submittedAt))
    .filter((date): date is string => Boolean(date));
  return {
    inferredStart: minDate(dates),
    inferredEnd: maxDate(dates),
  };
}

function hasRawPrivateSignal(record: FeedbackImportRecord): boolean {
  const text = [record.feedbackText, record.contact?.name, record.contact?.phoneMasked].filter(Boolean).join(" ");
  const rawPhone = /(?<!\d)1[3-9]\d{9}(?!\d)/;
  const vin = /\b[A-HJ-NPR-Z0-9]{17}\b/i;
  const licensePlate = /[\u4e00-\u9fa5][A-Z][A-Z0-9]{5,6}/;
  const address = /[\u4e00-\u9fa5]{2,}(路|街|巷|弄|小区|大厦|广场)\d{1,4}号?/;
  return [rawPhone, vin, licensePlate, address].some((pattern) => pattern.test(text));
}

function summarizeStatus(items: ImportValidationItem[]): ImportValidationStatus {
  if (items.some((item) => item.status === "fail")) return "fail";
  if (items.some((item) => item.status === "warning")) return "warning";
  return "pass";
}

function isNonEmpty(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function toDateOnly(value: string): string | undefined {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return undefined;
  return value.slice(0, 10);
}

function minDate(values: string[]): string {
  return values.filter(Boolean).sort()[0] ?? "";
}

function maxDate(values: string[]): string {
  return values.filter(Boolean).sort().at(-1) ?? "";
}
