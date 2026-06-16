import { chromium } from "playwright";

const baseUrl = process.env.AUDIT_URL ?? "http://127.0.0.1:5174/";
const checks = [];

async function expectText(page, text, label) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: 45000 }).catch(() => {});
  const count = await page.getByText(text, { exact: false }).count();
  if (count === 0) throw new Error(`${label}: missing text "${text}"`);
  checks.push(label);
}

async function expectNoText(page, text, label) {
  const count = await page.getByText(text, { exact: false }).count();
  if (count > 0) throw new Error(`${label}: unexpected text "${text}"`);
  checks.push(label);
}

async function expectRoutePanel(page, routeId, label) {
  const count = await page.locator(`[data-route-panel="${routeId}"]`).count();
  if (count === 0) throw new Error(`${label}: missing route panel "${routeId}"`);
  checks.push(label);
}

async function expectNoRoutePanel(page, routeId, label) {
  const count = await page.locator(`[data-route-panel="${routeId}"]`).count();
  if (count > 0) throw new Error(`${label}: stale route panel "${routeId}" is still visible`);
  checks.push(label);
}

async function expectContextValue(page, label, value, checkLabel) {
  const item = page.locator(".context-item").filter({ hasText: label }).first();
  await item.waitFor({ state: "visible", timeout: 45000 });
  const actual = (await item.locator("strong").innerText()).trim();
  if (actual !== value) throw new Error(`${checkLabel}: expected ${label} "${value}", got "${actual}"`);
  checks.push(checkLabel);
}

async function expectContextNoText(page, text, label) {
  const count = await page.locator(".context-strip").getByText(text, { exact: false }).count();
  if (count > 0) throw new Error(`${label}: unexpected top context text "${text}"`);
  checks.push(label);
}

async function expectSecondaryClosed(page, label) {
  const count = await page.locator(".secondary-sidebar").count();
  if (count !== 0) throw new Error(`${label}: secondary sidebar should be hidden before primary click`);
  checks.push(label);
}

async function expectSecondaryOpen(page, label) {
  const count = await page.locator(".secondary-sidebar").count();
  if (count !== 1) throw new Error(`${label}: secondary sidebar should be visible after primary click`);
  checks.push(label);
}

async function clickPrimary(page, name) {
  if ((await page.locator(".sidebar-shell.collapsed").count()) > 0) {
    await page.locator(".collapsed-rail .collapse-button").click();
    await page.waitForTimeout(80);
  }
  await page.locator(".primary-expanded-panel, .primary-preview-panel").getByRole("button", { name }).click();
}

async function clickSecondary(page, name) {
  await page.locator(".secondary-sidebar").getByRole("button", { name }).click();
}

async function expectSidebarHoverDoesNotOpenSecondary(page) {
  if ((await page.locator(".sidebar-shell.collapsed").count()) === 0) {
    await page.locator(".primary-expanded-panel .collapse-button").click();
  }
  await page.mouse.move(900, 120);
  await page.waitForTimeout(160);
  await page.locator(".collapsed-rail .collapse-button").hover();
  await page.waitForTimeout(220);
  const previewOpen = await page.locator(".sidebar-shell.collapsed.preview-open").count();
  if (previewOpen === 0) throw new Error("collapsed primary preview did not open on hover");
  await expectSecondaryClosed(page, "primary hover does not open secondary nav");
  await page.mouse.move(900, 120);
  await page.waitForTimeout(220);
  checks.push("collapsed hover previews primary only");
}

async function expectNoLargeBlankArea(page, label) {
  const result = await page.evaluate(() => {
    const panels = Array.from(document.querySelectorAll(".screen-grid > .panel, .screen-grid > .side-stack")).map((element) => {
      const rect = element.getBoundingClientRect();
      const visibleChildren = Array.from(element.children).filter((child) => {
        const childRect = child.getBoundingClientRect();
        return childRect.height > 0 && childRect.width > 0;
      });
      const contentBottom = visibleChildren.reduce((bottom, child) => {
        const childRect = child.getBoundingClientRect();
        return Math.max(bottom, childRect.bottom);
      }, rect.top);
      return {
        text: (element.textContent ?? "").trim().slice(0, 80),
        height: rect.height,
        blankBottom: Math.max(0, rect.bottom - contentBottom),
      };
    });
    return panels.filter((panel) => panel.height > 520 && panel.blankBottom > 260).slice(0, 5);
  });

  if (result.length) throw new Error(`${label}: large blank panels ${JSON.stringify(result)}`);
  checks.push(label);
}

async function expectVisibleTertiaryPanelsScrollable(page, label) {
  const result = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".screen-grid > .panel")).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        text: (element.textContent ?? "").trim().slice(0, 60),
        visible: rect.width > 0 && rect.height > 0,
        overflowY: window.getComputedStyle(element).overflowY,
      };
    }).filter((panel) => panel.visible && panel.overflowY !== "scroll"),
  );

  if (result.length) throw new Error(`${label}: non-scrollable tertiary panels ${JSON.stringify(result)}`);
  checks.push(label);
}

async function expectSmallRouteIconsVisible(page, label) {
  const issues = await page.evaluate(() => {
    const icons = Array.from(document.querySelectorAll("button svg, a.primary-button svg, .primary-nav-item svg"));
    return icons.map((icon) => {
      const rect = icon.getBoundingClientRect();
      const style = window.getComputedStyle(icon);
      const color = style.color || style.stroke;
      const strokeWidth = Number(icon.getAttribute("stroke-width") || style.strokeWidth || 0);
      return {
        html: icon.outerHTML.slice(0, 80),
        width: rect.width,
        height: rect.height,
        color,
        opacity: Number(style.opacity || 1),
        strokeWidth,
      };
    }).filter((icon) =>
      icon.width > 0 &&
      icon.height > 0 &&
      icon.width <= 18 &&
      icon.height <= 18 &&
      (icon.opacity < 0.55 || icon.color === "rgba(0, 0, 0, 0)" || icon.strokeWidth < 1.8),
    ).slice(0, 8);
  });

  if (issues.length) throw new Error(`${label}: weak small icons ${JSON.stringify(issues)}`);
  checks.push(label);
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(baseUrl);

  await expectText(page, "售后复盘工作台", "app loaded");
  await page.getByRole("button", { name: "复制摘要" }).click();
  await expectText(page, "已复制当前页面摘要", "topbar copy button provides real feedback");
  const reportDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出报告" }).click();
  const reportDownload = await reportDownloadPromise;
  if (!reportDownload.suggestedFilename().endsWith(".md")) throw new Error(`report export did not create markdown download: ${reportDownload.suggestedFilename()}`);
  checks.push("topbar export creates markdown download");
  await expectRoutePanel(page, "home", "default home route");
  await expectText(page, "一级导航", "tertiary heading shows primary level label");
  await expectText(page, "二级导航", "tertiary heading shows secondary level label");
  await expectText(page, "最近工作区", "home shows recent workspace");
  await expectText(page, "继续处理最近的数据、报告和问答", "home has concise work queue");
  await expectContextValue(page, "项目范围", "全部项目", "top context defaults to all projects when no project is selected");
  await expectContextValue(page, "时间范围", "全部时间", "top context defaults to all time before filtering");
  await expectContextValue(page, "样本量", "2,654 条", "top context sample count starts from all imported projects");
  await expectContextNoText(page, "2026 五一售后服务专项", "top context does not show a project before selection");
  await expectContextNoText(page, "问卷星 / App 内问卷 / 企微链接", "top context does not expose unverified source labels");
  await expectSecondaryClosed(page, "no secondary nav before primary click");
  await expectNoText(page, "Hover", "no internal hover wording");
  await expectNoText(page, "Codex", "no internal product wording");
  await expectNoText(page, "Agent", "no internal agent wording");
  await expectNoText(page, "Supabase", "no backend brand leakage");
  await expectNoText(page, "Stitch", "no design tool leakage");
  await expectSidebarHoverDoesNotOpenSecondary(page);

  await clickPrimary(page, "新建项目");
  await expectSecondaryOpen(page, "secondary nav opens after primary click");
  await expectRoutePanel(page, "new-upload", "new upload route");
  await expectNoText(page, "上传反馈表、确认字段映射与数据质量", "third-level heading subtitle removed");
  const templateDownloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载标准模板" }).click();
  const templateDownload = await templateDownloadPromise;
  if (!templateDownload.suggestedFilename().endsWith(".csv")) throw new Error(`template download did not create csv: ${templateDownload.suggestedFilename()}`);
  checks.push("template download creates csv");
  await page.locator('input[aria-label="上传售后反馈表格"]').setInputFiles("public/templates/after_sales_feedback_test_480.csv");
  await expectText(page, "当前文件：after_sales_feedback_test_480.csv", "upload input records selected file");
  await clickSecondary(page, "字段映射");
  await expectRoutePanel(page, "new-mapping", "field mapping is full route");
  await expectNoText(page, "拖拽文件到这里", "field mapping replaces upload page");
  await clickSecondary(page, "导入校验");
  await expectRoutePanel(page, "new-validation", "validation is full route");
  await expectNoRoutePanel(page, "new-mapping", "validation replaces mapping route");

  await clickPrimary(page, "查看项目");
  await expectRoutePanel(page, "projects-all", "all projects route");
  await page.locator(".project-filter-toolbar").getByRole("button", { name: "售后服务" }).click();
  let visibleProjectRows = await page.locator(".projects-main-panel .data-table tbody tr").count();
  if (visibleProjectRows !== 1) throw new Error(`project toolbar should filter to one service project, got ${visibleProjectRows}`);
  await page.locator(".project-filter-toolbar").getByRole("button", { name: "全部类型" }).click();
  visibleProjectRows = await page.locator(".projects-main-panel .data-table tbody tr").count();
  if (visibleProjectRows !== 3) throw new Error(`project toolbar should restore all projects, got ${visibleProjectRows}`);
  checks.push("project toolbar filters the project list");
  await page.getByRole("button", { name: /五一售后服务专项/ }).first().click();
  await expectText(page, "已选择「五一售后服务专项」", "project can be selected");
  await clickSecondary(page, "归档项目");
  await expectText(page, "未限定具体项目", "project selection clears on route switch");
  await clickSecondary(page, "项目详情");
  await expectRoutePanel(page, "projects-detail", "project detail route");
  await page.getByRole("button", { name: "查看报告输出" }).click();
  await expectText(page, "报告输出记录", "project detail report button works");
  await page.getByRole("button", { name: "查看导入批次" }).click();
  await expectText(page, "导入批次", "project detail batch button works");
  await page.locator(".project-detail-actions").getByRole("button", { name: "归档项目", exact: true }).click();
  await expectText(page, "已归档", "project archive entry works");
  await clickSecondary(page, "归档项目");
  await expectText(page, "五一售后服务专项", "archived project appears in archive route");
  await page.locator(".project-card-list").getByRole("button", { name: /五一售后服务专项/ }).click();
  await page.getByRole("button", { name: "恢复归档" }).first().click();
  await expectText(page, "已恢复：五一售后服务专项", "project restore updates archive state");

  await clickPrimary(page, "报告仪表盘");
  await expectRoutePanel(page, "dashboard-overview", "dashboard overview route");
  await expectText(page, "全部时间 / 全部项目 / 全国 / 全部主题", "dashboard overview starts without a time filter");
  const overviewWorkOrderButtons = await page.locator(".drilldown-side").getByRole("button", { name: "生成服务工单" }).count();
  if (overviewWorkOrderButtons > 0) throw new Error("dashboard overview should not show work order generation before a concrete issue is selected");
  checks.push("dashboard overview does not expose work order generation");
  await expectText(page, "筛选范围", "dashboard has one scope filter secondary entry");
  await expectNoText(page, "时间维度", "time dimension secondary entry merged into scope filter");
  await expectNoText(page, "项目维度", "project dimension secondary entry merged into scope filter");
  await expectNoText(page, "区域维度", "area dimension secondary entry merged into scope filter");
  let overviewFilterPanel = page.locator(".filter-panel");
  const overviewFilterGroups = await overviewFilterPanel.locator(".parallel-filter-groups, .multi-filter-group, .filter-group").count();
  if (overviewFilterGroups !== 0) throw new Error(`dashboard overview should not duplicate scope filters, got ${overviewFilterGroups}`);
  await overviewFilterPanel.locator(".current-scope-card").waitFor({ state: "visible", timeout: 4500 });
  checks.push("dashboard overview does not duplicate scope filter controls");
  await clickSecondary(page, "筛选范围");
  await expectRoutePanel(page, "dashboard-scope", "scope filter route");
  await expectText(page, "筛选范围", "dashboard scope filter page is visible");
  await expectText(page, "全部时间 / 全部项目 / 全国 / 全部主题", "dashboard starts from unfiltered parallel scope");
  let filterPanel = page.locator(".filter-panel");
  const parallelFilterCount = await filterPanel.locator(".parallel-filter-groups").count();
  if (parallelFilterCount !== 1) throw new Error(`dashboard should render one parallel filter group, got ${parallelFilterCount}`);
  for (const label of ["时间粒度", "项目范围", "区域", "城市", "服务中心"]) {
    await filterPanel.getByText(label, { exact: true }).waitFor({ state: "visible", timeout: 4500 });
  }
  if ((await filterPanel.getByText("问题主题", { exact: true }).count()) > 0) throw new Error("scope filter should not duplicate the issue-topic selector");
  checks.push("dashboard scope renders time project area without duplicated topic selector");

  await filterPanel.getByRole("button", { name: /五一售后服务专项/ }).first().click();
  await expectText(page, "全部时间 / 五一售后服务专项 / 全国 / 全部主题", "project-only scope does not require time or area changes");
  await expectContextValue(page, "项目范围", "五一售后服务专项", "top context reflects selected project");
  await expectContextValue(page, "样本量", "1,240 条", "top context sample count reflects selected project");
  await page.getByRole("button", { name: "进入报告输出" }).click();
  await expectRoutePanel(page, "dashboard-report", "project-only scope can enter report output");
  await expectText(page, "全部时间 / 五一售后服务专项 / 全国 / 全部主题", "report output receives project-only filter snapshot");

  await clickPrimary(page, "报告仪表盘");
  await expectText(page, "全部时间 / 五一售后服务专项 / 全国 / 全部主题", "dashboard keeps applied project filter after returning from report");
  await page.locator(".dashboard-action-bar").getByRole("button", { name: "AI 问答" }).click();
  await expectText(page, "从报告仪表盘带入：全部时间 / 五一售后服务专项 / 全国 / 全部主题", "project-only scope can enter AI QA");

  await clickPrimary(page, "报告仪表盘");
  await clickSecondary(page, "筛选范围");
  filterPanel = page.locator(".filter-panel");
  await filterPanel.getByRole("button", { name: /五一售后服务专项/ }).first().click();
  await expectText(page, "全部时间 / 全部项目 / 全国 / 全部主题", "project selection can be cleared without changing time or area");
  await expectContextValue(page, "项目范围", "全部项目", "top context returns to all projects after project clear");
  await expectContextValue(page, "样本量", "2,654 条", "top context restores all-time all-project sample count");

  await filterPanel.getByRole("button", { name: /^华东/ }).click();
  await expectText(page, "全部时间 / 全部项目 / 区域：华东 / 全部主题", "area-only scope does not require project changes");
  await expectContextValue(page, "样本量", "186 条", "top context sample count follows area filter");
  await filterPanel.getByRole("button", { name: /^杭州/ }).click();
  await filterPanel.getByRole("button", { name: /^西溪服务中心/ }).click();
  await expectText(page, "全部时间 / 全部项目 / 服务中心：西溪服务中心 / 全部主题", "city and service center cascade applies inside same filter panel");

  await filterPanel.getByRole("button", { name: "日" }).click();
  await filterPanel.locator('input[type="date"]').first().fill("2026-05-22");
  await expectText(page, "日：2026-05-22 / 全部项目 / 服务中心：西溪服务中心 / 全部主题", "time change preserves project and area filters");

  await filterPanel.getByRole("button", { name: "周" }).click();
  await filterPanel.locator('input[type="week"]').first().fill("2026-W22");
  await expectText(page, "周：2026-W22 / 全部项目 / 服务中心：西溪服务中心 / 全部主题", "free week period reflected in parallel scope");
  await filterPanel.getByRole("button", { name: "季度" }).click();
  await filterPanel.locator(".quarter-inputs").locator('input[type="number"]').fill("2026");
  await filterPanel.locator(".quarter-inputs select").selectOption("Q3");
  await expectText(page, "季度：2026 Q3 / 全部项目 / 服务中心：西溪服务中心 / 全部主题", "free quarter period reflected in parallel scope");
  await filterPanel.getByRole("button", { name: "自定义" }).click();
  await filterPanel.locator('input[type="date"]').first().fill("2026-05-03");
  await filterPanel.locator('input[type="date"]').last().fill("2026-05-19");
  await expectText(page, "2026-05-03 至 2026-05-19 / 全部项目 / 服务中心：西溪服务中心 / 全部主题", "custom date range reflected in parallel scope");
  checks.push("parallel filters are independent and shared by report and AI");

  await page.locator(".drilldown-results-panel").getByRole("button", { name: "打开原文池" }).click();
  await expectText(page, "分页加载原文", "raw feedback pool opens as paginated list");
  await expectText(page, "1-20 条", "raw feedback first page range visible");
  await page.locator(".drilldown-results-panel .evidence-page-size select").selectOption("10");
  await expectText(page, "1-10 条", "raw feedback page size selector changes visible range");
  let rawFeedbackCount = await page.locator(".drilldown-results-panel .evidence-card").count();
  if (rawFeedbackCount !== 10) throw new Error(`raw feedback pool should render one page of 10 cards after page-size change, got ${rawFeedbackCount}`);
  await page.locator(".drilldown-results-panel .evidence-page-size select").selectOption("20");
  rawFeedbackCount = await page.locator(".drilldown-results-panel .evidence-card").count();
  if (rawFeedbackCount !== 20) throw new Error(`raw feedback pool should render exactly one page of 20 cards, got ${rawFeedbackCount}`);
  checks.push("raw feedback pool renders only current page");
  await page.locator(".drilldown-results-panel").getByRole("button", { name: "下一页" }).click();
  await expectText(page, "21-40 条", "raw feedback next page changes visible range");

  await clickSecondary(page, "筛选范围");
  await expectRoutePanel(page, "dashboard-scope", "dashboard scope route");
  await expectNoText(page, "切换时间", "secondary explanation fake action removed");
  const timeLayout = await page.locator(".filter-panel .parallel-filter-groups").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const children = Array.from(element.children).map((child) => child.getBoundingClientRect());
    const rightEdge = Math.max(...children.map((child) => child.right));
    const timePeriod = element.querySelector(".time-period-group")?.getBoundingClientRect();
    return {
      width: rect.width,
      secondWidth: timePeriod?.width ?? 0,
      blankRight: Math.max(0, rect.right - rightEdge),
    };
  });
  if (timeLayout.secondWidth < 260) {
    throw new Error(`time filter layout still leaves a large blank area: ${JSON.stringify(timeLayout)}`);
  }
  checks.push("time filter controls use available width");
  const resultBlank = await page.locator(".drilldown-results-panel").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const children = Array.from(element.children).filter((child) => {
      const childRect = child.getBoundingClientRect();
      return childRect.width > 0 && childRect.height > 0;
    });
    const contentBottom = children.reduce((bottom, child) => Math.max(bottom, child.getBoundingClientRect().bottom), rect.top);
    return Math.max(0, rect.bottom - contentBottom);
  });
  if (resultBlank > 180) throw new Error(`dashboard result panel still has large blank bottom: ${resultBlank}`);
  checks.push("dashboard result panel avoids large internal blank");

  await clickSecondary(page, "筛选范围");
  await expectText(page, "项目范围", "project filter remains visible inside scope filter panel");
  filterPanel = page.locator(".filter-panel");
  await filterPanel.getByRole("button", { name: /五一售后服务专项/ }).first().click();
  await filterPanel.getByRole("button", { name: /四月售后月报/ }).first().click();
  await expectText(page, "2 个项目", "multi project selection reflected");
  await filterPanel.getByRole("button", { name: /四月售后月报/ }).first().click();
  await expectText(page, "五一售后服务专项", "project can be deselected");

  await clickSecondary(page, "问题主题");
  await expectRoutePanel(page, "dashboard-topic", "dashboard topic route");
  filterPanel = page.locator(".filter-panel");
  const topicOnlySelectorCount = await filterPanel.locator(".multi-filter-group.topic").count();
  if (topicOnlySelectorCount !== 1) throw new Error(`dashboard topic should render one topic selector, got ${topicOnlySelectorCount}`);
  for (const label of ["时间粒度", "项目范围", "区域", "城市", "服务中心"]) {
    const count = await filterPanel.getByText(label, { exact: true }).count();
    if (count > 0) throw new Error(`dashboard topic should not duplicate "${label}" filter`);
  }
  checks.push("dashboard topic only renders topic selector");
  await page.locator(".filter-panel").getByRole("button", { name: /^等待时间/ }).click();
  await expectText(page, "2026-05-03 至 2026-05-19 / 五一售后服务专项 / 服务中心：西溪服务中心 / 主题：等待时间", "topic selection completes work-order scope");
  await expectContextValue(page, "样本量", "186 条", "top context sample count follows topic filter");
  await expectNoText(page, "当前仪表盘内容已更新", "routine dashboard filters do not show global status prompts");
  const duplicateTopicCards = await page.locator(".drilldown-results-panel .topic-card-grid, .drilldown-results-panel .topic-card").count();
  if (duplicateTopicCards > 0) throw new Error(`dashboard topic result still duplicates topic selector cards: ${duplicateTopicCards}`);
  checks.push("dashboard topic keeps one selector and one result table");
  await page.locator(".filter-panel").getByRole("button", { name: /^等待时间/ }).click();
  await expectText(page, "全部主题", "topic selection can be cleared before work-order generation");

  await clickSecondary(page, "筛选范围");
  await expectText(page, "区域", "scope route still exposes region filter in same panel");
  filterPanel = page.locator(".filter-panel");
  await filterPanel.getByRole("button", { name: "全国" }).click();
  await expectText(page, "全国", "area filter can be cleared before selecting another cascade");
  await filterPanel.getByRole("button", { name: /^华东/ }).click();
  await filterPanel.getByRole("button", { name: /^杭州/ }).click();
  await filterPanel.getByRole("button", { name: /^西溪服务中心/ }).click();
  await expectText(page, "服务中心：西溪服务中心", "center selection reflected");
  const incompleteWorkOrderDisabled = await page.locator(".dashboard-action-bar").getByRole("button", { name: "生成服务工单" }).isDisabled();
  if (!incompleteWorkOrderDisabled) throw new Error("work order should wait until a concrete issue topic is selected");
  checks.push("work order generation waits for selected service center and issue topic");
  await clickSecondary(page, "问题主题");
  await page.locator(".filter-panel").getByRole("button", { name: /^等待时间/ }).click();
  await page.locator(".dashboard-action-bar").getByRole("button", { name: "生成服务工单" }).click();
  const sideWorkOrder = page.locator(".drilldown-side .work-order-draft-panel");
  await sideWorkOrder.waitFor({ state: "visible", timeout: 4500 });
  if ((await page.locator(".drilldown-results-panel .work-order-draft-panel").count()) > 0) throw new Error("work order draft should not be buried in the result panel");
  await expectText(page, "工单草稿预览", "work order draft can be created from dashboard risk scope");
  await sideWorkOrder.getByText("处理单位", { exact: false }).waitFor({ state: "visible", timeout: 4500 });
  await sideWorkOrder.getByText("工单引用证据", { exact: false }).waitFor({ state: "visible", timeout: 4500 });
  await expectNoText(page, "最多带入 2 条", "work order evidence does not use fixed two-item sampling");
  await page.getByRole("button", { name: "复制工单正文" }).click();
  await expectText(page, "工单正文已复制", "work order body can be copied");
  const mailtoHref = await page.getByRole("link", { name: "打开邮箱草稿" }).getAttribute("href");
  if (!mailtoHref?.startsWith("mailto:")) throw new Error(`work order email link is not mailto: ${mailtoHref}`);
  if (!mailtoHref.includes("xixi.service-center%40example.com") && !mailtoHref.includes("xixi.service-center@example.com")) {
    throw new Error(`work order email link does not target selected service center: ${mailtoHref}`);
  }
  checks.push("work order mailto draft is available");

  await clickSecondary(page, "报告输出");
  await expectRoutePanel(page, "dashboard-report", "report output route");
  const reportEvidence = page.locator(".report-panel .evidence-panel");
  await reportEvidence.getByText("报告引用证据", { exact: false }).waitFor({ state: "visible", timeout: 4500 });
  await reportEvidence.getByText("命中原文", { exact: false }).waitFor({ state: "visible", timeout: 4500 });
  const reportEvidenceCount = await reportEvidence.locator(".evidence-card").count();
  if (reportEvidenceCount !== 20) throw new Error(`report evidence should paginate current scope instead of fixed six items, got ${reportEvidenceCount}`);
  const fixedReportEvidenceNote = await reportEvidence.getByText("已引用 6 条", { exact: false }).count();
  if (fixedReportEvidenceNote > 0) throw new Error("report evidence still shows fixed six-item reference note");
  checks.push("report evidence is scoped and paginated");
  await page.getByRole("button", { name: /满意度归因/ }).click();
  let scenario = await page.locator(".report-layout").getAttribute("data-report-scenario");
  if (scenario !== "满意度归因") throw new Error(`report scenario attribute not updated: ${scenario}`);
  await page.getByRole("button", { name: /满意度归因/ }).click();
  scenario = await page.locator(".report-layout").getAttribute("data-report-scenario");
  if (scenario !== "总复盘") throw new Error(`report scenario did not toggle back: ${scenario}`);
  checks.push("report scenario toggles back to total report");

  await clickPrimary(page, "AI 问答");
  await expectRoutePanel(page, "qa-new", "qa new route");
  await expectSecondaryClosed(page, "qa has no secondary sidebar");
  await expectText(page, "自由新对话", "qa defaults to free conversation");
  await expectNoText(page, "可问内容", "qa side recommendation panel removed");
  await expectNoText(page, "推荐问题", "qa recommendation wording removed");
  const screenShellOverflow = await page.locator(".screen-shell").evaluate((element) => window.getComputedStyle(element).overflowY);
  if (screenShellOverflow !== "scroll") throw new Error(`third-level shell should expose stable vertical scrolling, got ${screenShellOverflow}`);
  checks.push("third-level shell has stable vertical scroll");
  await expectText(page, "暂无引用证据", "qa evidence starts empty before answer");
  const expandBeforeAnswerDisabled = await page.getByRole("button", { name: "展开引用证据" }).isDisabled();
  if (!expandBeforeAnswerDisabled) throw new Error("qa evidence expand should be disabled before an answer exists");
  checks.push("qa evidence does not show fake citations before answering");
  await page.getByRole("button", { name: "使用仪表盘范围" }).click();
  await expectText(page, "带入仪表盘范围", "qa scope can be applied");
  await page.getByRole("button", { name: "取消仪表盘范围" }).click();
  await expectText(page, "自由新对话", "qa scope can be deselected");
  await page.getByRole("button", { name: /五一售后服务专项/ }).first().click();
  await expectText(page, "参考项目：五一售后服务专项", "qa project can be selected");
  await page.getByRole("button", { name: /五一售后服务专项/ }).first().click();
  await expectText(page, "自由新对话", "qa project can be deselected without leaving chat");
  await page.getByRole("button", { name: /杭州西溪服务中心低分原因/ }).first().click();
  await expectText(page, "新对话", "qa history record can be deselected");
  await page.getByRole("button", { name: "新建对话" }).click();
  await page.locator(".composer textarea").fill("等待时间主要影响哪些服务中心？");
  await page.getByRole("button", { name: "发送查询" }).click();
  await expectText(page, "数据查询结果", "qa answer appears after sending");
  await expectText(page, "保存记录", "qa progress reaches archive stage");
  await expectText(page, "等待时间影响服务中心", "qa conversation is auto named from first question");
  const evidenceCount = await page.locator(".answer-evidence-card").count();
  if (evidenceCount < 1) throw new Error(`qa answer should expose cited evidence after answering, got ${evidenceCount}`);
  checks.push("qa answer evidence is tied to the current answer");
  await page.getByRole("button", { name: "展开引用证据" }).click();
  await expectText(page, "引用原因", "qa evidence expands details");
  await page.getByRole("button", { name: "收起引用证据" }).click();
  await page.getByRole("button", { name: "保存当前回答" }).click();
  await expectText(page, "等待时间主要影响哪些服务中心？", "qa saved answer appears in records");
  await expectText(page, "已保存到问答记录", "qa save action reflects saved state");
  await page.getByRole("button", { name: "新建对话" }).click();
  await page.locator(".composer textarea").fill("App 预约同步异常集中在哪里？");
  await page.getByRole("button", { name: "发送查询" }).click();
  await expectText(page, "预约同步异常分析", "qa can create another auto-named conversation");
  await page.getByRole("button", { name: /删除 预约同步异常分析/ }).click();
  const deletedRecordCount = await page.locator(".qa-record-selector").getByText("预约同步异常分析", { exact: false }).count();
  if (deletedRecordCount > 0) throw new Error("qa record can be deleted: record still visible in record list");
  checks.push("qa record can be deleted");
  await expectNoText(page, "历史规则", "qa removes explanatory rule copy");

  await clickPrimary(page, "个人中心");
  await expectRoutePanel(page, "profile-settings", "profile settings route");
  await clickSecondary(page, "账号状态");
  await expectRoutePanel(page, "profile-account", "profile account route");
  await expectText(page, "账号状态与审批", "profile account content visible");
  await clickSecondary(page, "隐私设置");
  await expectRoutePanel(page, "profile-privacy", "profile privacy route");
  await expectText(page, "隐私设置与数据清理", "profile privacy content visible");
  await clickSecondary(page, "数据权限");
  await expectRoutePanel(page, "profile-data", "profile data route");
  await expectText(page, "可访问项目", "profile data content visible");

  await expectVisibleTertiaryPanelsScrollable(page, "visible tertiary panels expose vertical scroll");
  await expectNoLargeBlankArea(page, "no large blank panels after route changes");
  await expectSmallRouteIconsVisible(page, "small route icons are visible");

  await browser.close();
  console.log(`UI audit passed: ${checks.length} checks`);
  for (const check of checks) console.log(`- ${check}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
