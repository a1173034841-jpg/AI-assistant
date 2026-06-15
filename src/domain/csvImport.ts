import type {
  ConsentState,
  FeedbackImportRecord,
  Region,
  ServiceScenario,
  SurveyPlatform,
  ThirdPartySurveyExport,
} from "./types";

type CsvImportOptions = {
  fileName?: string;
  exportedAt?: string;
};

export type CsvImportResult = {
  exports: ThirdPartySurveyExport[];
  errors: string[];
  warnings: string[];
};

type ImportedRecord = {
  projectName: string;
  platform: SurveyPlatform;
  record: FeedbackImportRecord;
};

const columnAliases = {
  projectName: ["项目名称", "项目", "活动名称", "问卷名称"],
  platform: ["问卷来源", "来源", "数据来源", "渠道"],
  submittedAt: ["提交时间", "填写时间", "完成时间", "提交日期"],
  region: ["区域", "大区"],
  city: ["城市", "所在城市"],
  serviceCenter: ["服务中心名称", "服务中心", "门店", "网点名称"],
  serviceScenario: ["服务场景", "服务类型", "场景"],
  rating: ["服务评分", "总体评分", "满意度评分"],
  recommendationScore: ["推荐意愿评分", "推荐分", "NPS"],
  feedbackText: ["开放反馈原话", "开放反馈", "反馈原话", "用户原话", "问题描述"],
  contactConsent: ["是否愿意联系", "是否授权联系", "授权联系"],
  contactInfo: ["联系方式", "脱敏联系方式"],
} as const;

export function parseAfterSalesFeedbackCsv(csvText: string, options: CsvImportOptions = {}): CsvImportResult {
  const rows = parseCsv(csvText).filter((row) => !isEmptyRow(row));
  if (rows.length < 2) {
    return { exports: [], errors: ["CSV 中没有可导入的反馈数据。"], warnings: [] };
  }

  const header = rows[0].map(normalizeHeader);
  const records: ImportedRecord[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  rows.slice(1).forEach((row, rowIndex) => {
    const lineNumber = rowIndex + 2;
    const getValue = (column: keyof typeof columnAliases) => getColumnValue(row, header, columnAliases[column]);
    const projectName = getValue("projectName");
    const submittedAtValue = getValue("submittedAt");
    const submittedAt = normalizeSubmittedAt(submittedAtValue);
    const city = getValue("city");
    const serviceCenter = getValue("serviceCenter");
    const feedbackText = getValue("feedbackText");
    const rating = toNumber(getValue("rating"));
    const npsScore = toNumber(getValue("recommendationScore"));

    const missingFields = [
      projectName ? "" : "项目名称",
      submittedAt ? "" : "提交时间",
      city ? "" : "城市",
      serviceCenter ? "" : "服务中心名称",
      feedbackText ? "" : "开放反馈原话",
      rating === undefined && npsScore === undefined ? "服务评分或推荐意愿评分" : "",
    ].filter(Boolean);

    if (missingFields.length > 0) {
      errors.push(`第 ${lineNumber} 行缺少${missingFields.join("、")}，已跳过。`);
      return;
    }

    const platform = normalizePlatform(getValue("platform"));
    const contactInfo = getValue("contactInfo");
    const record: FeedbackImportRecord = {
      id: `import-${String(records.length + 1).padStart(4, "0")}`,
      submittedAt,
      platform,
      region: normalizeRegion(getValue("region")),
      city,
      serviceCenter,
      serviceScenario: normalizeServiceScenario(getValue("serviceScenario")),
      rating,
      npsScore,
      feedbackText,
      contact: {
        ...(contactInfo ? { phoneMasked: contactInfo } : {}),
        consentState: normalizeConsentState(getValue("contactConsent")),
      },
    };

    records.push({ projectName, platform, record });
  });

  if (records.length === 0 && errors.length === 0) {
    warnings.push("未识别到可分析记录，请检查表头是否符合标准模板。");
  }

  return {
    exports: groupRecordsIntoExports(records, options),
    errors,
    warnings,
  };
}

function groupRecordsIntoExports(records: ImportedRecord[], options: CsvImportOptions): ThirdPartySurveyExport[] {
  const groups = new Map<string, ImportedRecord[]>();
  for (const item of records) {
    const key = `${item.projectName}||${item.platform}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const sourceName = options.fileName?.trim() || "CSV 导入";
  const exportedAt = options.exportedAt ?? new Date().toISOString();

  return Array.from(groups.values()).map((group, index) => {
    const dates = group.map((item) => item.record.submittedAt.slice(0, 10)).sort();
    return {
      exportId: `csv-import-${String(index + 1).padStart(3, "0")}`,
      platform: group[0].platform,
      exportedAt,
      sourceName,
      projectName: group[0].projectName,
      periodStart: dates[0] ?? "",
      periodEnd: dates.at(-1) ?? "",
      records: group.map((item) => item.record),
    };
  });
}

function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

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
      row.push(normalizeCell(cell));
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(normalizeCell(cell));
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") continue;

    cell += char;
  }

  row.push(normalizeCell(cell));
  rows.push(row);
  return rows;
}

function getColumnValue(row: string[], header: string[], aliases: readonly string[]): string {
  const normalizedAliases = aliases.map(normalizeHeader);
  const index = header.findIndex((item) => normalizedAliases.includes(item));
  return index >= 0 ? row[index]?.trim() ?? "" : "";
}

function normalizeSubmittedAt(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalized = trimmed.replace(/\//g, "-").replace(" ", "T");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) return "";

  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}+08:00`;
}

function normalizePlatform(value: string): SurveyPlatform {
  const text = value.replace(/\s/g, "").toLowerCase();
  if (text.includes("腾讯")) return "腾讯问卷";
  if (text.includes("金数据")) return "金数据";
  if (text.includes("app")) return "App内问卷";
  if (text.includes("短信")) return "短信链接";
  if (text.includes("企微") || text.includes("企业微信")) return "企微链接";
  if (text.includes("问卷星")) return "问卷星";
  return "其他来源";
}

function normalizeRegion(value: string): Region | undefined {
  const regions: Region[] = ["华南", "华东", "华北", "西南", "华中", "西北", "东北"];
  return regions.find((region) => value.includes(region));
}

function normalizeServiceScenario(value: string): ServiceScenario {
  const text = value.replace(/\s/g, "").toLowerCase();
  if (text.includes("移动") || text.includes("上门")) return "移动服务";
  if (text.includes("补能") || text.includes("充电") || text.includes("超充")) return "补能体验";
  if (text.includes("app") || text.includes("ota") || text.includes("软件")) return "App/OTA";
  if (text.includes("活动") || text.includes("社群")) return "活动/社群";
  if (text.includes("到店") || text.includes("门店")) return "到店服务";
  return "其他";
}

function normalizeConsentState(value: string): ConsentState {
  const text = value.trim();
  if (["是", "愿意", "已授权", "授权", "同意"].some((item) => text.includes(item))) return "已授权联系";
  if (["否", "拒绝", "不愿意", "不同意"].some((item) => text.includes(item))) return "拒绝联系";
  return "未询问";
}

function normalizeHeader(value: string): string {
  return normalizeCell(value).replace(/\s/g, "");
}

function normalizeCell(value: string): string {
  return value.trim().replace(/^\uFEFF/, "");
}

function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => !cell.trim());
}

function toNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}
