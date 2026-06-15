import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAfterSalesFeedbackCsv } from "./csvImport";

const templatePath = new URL("../../public/templates/after_sales_feedback_import_template.csv", import.meta.url);

describe("CSV feedback import", () => {
  it("parses a standard CSV into project and source grouped survey exports", () => {
    const csv = [
      "项目名称,问卷来源,提交时间,区域,省份,城市,服务中心名称,服务场景,服务评分,推荐意愿评分,开放反馈原话,是否愿意联系,问题是否解决,联系方式",
      "A 项目：五一售后服务专项,问卷星,2026-05-01 10:32,华南,广东,深圳,深圳南山服务中心,到店服务,5,9,接待很快，维修进度解释清楚。,否,是,",
      "A 项目：五一售后服务专项,App内问卷,2026-05-02 15:18,华南,广东,广州,广州天河服务中心,移动服务,2,3,预约后等待时间太长，临时改时间没有提前通知。,是,否,已脱敏-002",
      "B 项目：服务中心月中回访,腾讯问卷,2026-05-16 09:20,华东,上海,上海浦东服务中心,App/OTA,3,7,\"App 预约入口不好找，但到店后处理还可以。\",未询问,是,",
    ].join("\n");

    const result = parseAfterSalesFeedbackCsv(csv, {
      fileName: "售后反馈标准测试.csv",
      exportedAt: "2026-05-20T12:00:00+08:00",
    });

    expect(result.errors).toEqual([]);
    expect(result.exports).toHaveLength(3);
    expect(result.exports.map((item) => `${item.projectName}|${item.platform}`)).toEqual([
      "A 项目：五一售后服务专项|问卷星",
      "A 项目：五一售后服务专项|App内问卷",
      "B 项目：服务中心月中回访|腾讯问卷",
    ]);
    expect(result.exports[0]).toMatchObject({
      sourceName: "售后反馈标准测试.csv",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-01",
    });
    expect(result.exports[0].records[0]).toMatchObject({
      id: "import-0001",
      submittedAt: "2026-05-01T10:32:00+08:00",
      platform: "问卷星",
      region: "华南",
      city: "深圳",
      serviceCenter: "深圳南山服务中心",
      serviceScenario: "到店服务",
      rating: 5,
      npsScore: 9,
      contact: { consentState: "拒绝联系" },
    });
    expect(result.exports[1].records[0].contact).toEqual({
      phoneMasked: "已脱敏-002",
      consentState: "已授权联系",
    });
  });

  it("validates the downloadable template as a 10-20 row standard test table", () => {
    const templateCsv = readFileSync(templatePath, "utf8");
    const result = parseAfterSalesFeedbackCsv(templateCsv, {
      fileName: "after_sales_feedback_import_template.csv",
      exportedAt: "2026-06-01T00:00:00+08:00",
    });
    const rows = result.exports.flatMap((item) => item.records);

    expect(templateCsv.split(/\r?\n/)[0]).toBe(
      "项目名称,问卷来源,提交时间,区域,省份,城市,服务中心名称,服务场景,服务评分,推荐意愿评分,开放反馈原话,是否愿意联系,问题是否解决,联系方式",
    );
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.length).toBeLessThanOrEqual(20);
    expect(result.errors).toEqual([]);
    expect(new Set(result.exports.map((item) => item.projectName)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(result.exports.map((item) => item.platform)).size).toBeGreaterThanOrEqual(3);
  });

  it("reports missing required fields without creating unusable records", () => {
    const csv = [
      "项目名称,问卷来源,提交时间,区域,省份,城市,服务中心名称,服务场景,服务评分,推荐意愿评分,开放反馈原话,是否愿意联系,问题是否解决,联系方式",
      "A 项目：五一售后服务专项,问卷星,,华南,广东,深圳,深圳南山服务中心,到店服务,5,9,接待很快，维修进度解释清楚。,否,是,",
      "A 项目：五一售后服务专项,问卷星,2026-05-01 10:32,华南,广东,深圳,深圳南山服务中心,到店服务,5,9,接待很快，维修进度解释清楚。,否,是,",
    ].join("\n");

    const result = parseAfterSalesFeedbackCsv(csv, { fileName: "broken.csv" });

    expect(result.errors).toContain("第 2 行缺少提交时间，已跳过。");
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0].records).toHaveLength(1);
  });
});
