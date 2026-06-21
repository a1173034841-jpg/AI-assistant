import { chromium } from "playwright";
import { resolve } from "node:path";

const pageUrl = process.env.AUDIT_URL ?? "http://127.0.0.1:5174/";
const csvPath = resolve("data/manual-test/manual_after_sales_upload_sample_2026-06-17.csv");
const checks = [];

async function expectText(page, text, label, timeout = 8000) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout });
  checks.push(label);
}

async function expectNoText(page, text, label) {
  const count = await page.getByText(text, { exact: false }).count();
  if (count > 0) throw new Error(`${label}: unexpected "${text}"`);
  checks.push(label);
}

async function clickPrimary(page, name) {
  await page.getByRole("button", { name }).first().click();
}

async function clickSecondary(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });

  try {
    await page.goto(pageUrl, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });

    await clickPrimary(page, "新建项目");
    await page.locator('input[type="file"]').setInputFiles(csvPath);
    await expectText(page, "180 条反馈", "manual csv import uses real 180-row count");
    await expectText(page, "无必填缺失", "manual csv import has no fake required-confirmation count");

    await clickSecondary(page, "字段映射");
    await expectText(page, "推荐意愿完整", "field mapping shows real nps completeness");
    await expectText(page, "服务评分完整", "field mapping shows real rating completeness");
    await expectNoText(page, "64 条", "field mapping does not leak demo missing-nps count");
    await expectNoText(page, "22 条", "field mapping does not leak demo missing-rating count");

    await clickSecondary(page, "导入校验");
    await expectText(page, "180", "validation shows real row count");

    await clickPrimary(page, "报告仪表盘");
    await clickSecondary(page, "筛选范围");
    await expectNoText(page, "杭州", "manual csv removes demo Hangzhou center");
    await expectText(page, "深圳福田服务中心", "manual csv exposes uploaded service center");

    await clickSecondary(page, "报告输出");
    await page.getByRole("button", { name: /服务问题闭环/ }).click();
    const closureText = await page.locator(".scenario-report-body").innerText();
    const closureMatch = closureText.match(/命中 ([\d,]+) 条原文/);
    if (!closureMatch) throw new Error(`closure report count missing: ${closureText}`);
    const closureCount = Number(closureMatch[1].replace(/,/g, ""));

    await page.getByRole("button", { name: /活动体验复盘/ }).click();
    const activityText = await page.locator(".scenario-report-body").innerText();
    const activityMatch = activityText.match(/命中 ([\d,]+) 条原文/);
    if (!activityMatch) throw new Error(`activity report count missing: ${activityText}`);
    const activityCount = Number(activityMatch[1].replace(/,/g, ""));
    if (activityCount <= 0) throw new Error(`activity report should match uploaded activity records, got ${activityCount}`);
    if (activityCount === closureCount) throw new Error(`scenario counts should differ after classification, both ${activityCount}`);
    checks.push("scenario report counts use real classified records");

    const reportEvidenceCount = await page.locator(".report-panel .evidence-card").count();
    if (reportEvidenceCount !== Math.min(20, activityCount)) throw new Error(`report evidence should paginate scenario records, got ${reportEvidenceCount} for ${activityCount}`);
    checks.push("scenario evidence paginates actual matched records");

    await clickPrimary(page, "AI 问答");
    await page.getByRole("button", { name: "新建对话" }).click();
    await page.getByLabel("AI 问答输入").fill("深圳福田服务中心低分原因是什么？");
    await page.getByRole("button", { name: /发送查询/ }).click();
    await page.locator(".message.ai-message").filter({ hasText: /数据查询结果|模型接口暂未返回|当前范围/ }).first().waitFor({ timeout: 25000 });
    await expectText(page, "深圳福田服务中心低分原因", "qa conversation auto name is visible after answer", 10000);

    await clickPrimary(page, "报告仪表盘");
    await clickPrimary(page, "AI 问答");
    await expectText(page, "深圳福田服务中心低分原因", "qa history persists after route switch");

    await clickPrimary(page, "新建项目");
    await expectText(page, "180 条反馈", "import status persists after route switch");

    console.log(`manual import flow audit passed: ${checks.length} checks`);
    for (const check of checks) console.log(`- ${check}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
