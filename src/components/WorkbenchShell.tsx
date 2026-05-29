import { useMemo, useState } from "react";
import {
  buildFindingsForScenario,
  buildFocusRegionInsights,
  buildMetricSummary,
  buildRegionTree,
  filterRecordsByDate,
  filterRecordsByGeoSelection,
  type GeoSelection,
} from "../domain/analysisRules";
import { buildImportValidationSummary } from "../domain/importValidation";
import { createExecutiveReport, createScenarioOutput } from "../domain/outputTemplates";
import { scenarios } from "../domain/taxonomy";
import type { NormalizedFeedback, Region, ThirdPartySurveyExport, WorkbenchScenario } from "../domain/types";
import { AnalysisWorkspace } from "./AnalysisWorkspace";
import { FeedbackPool } from "./FeedbackPool";
import { ScenarioOutputPanel } from "./ScenarioOutputPanel";

const scenarioGuides: Record<WorkbenchScenario, { audience: string; output: string; useWhen: string }> = {
  服务问题闭环: {
    audience: "服务运营、区域督导、服务中心负责人",
    output: "待办清单、责任对象、处理动作、时限和回访口径",
    useWhen: "低分、负向反馈或已授权联系样本需要继续处理",
  },
  满意度归因: {
    audience: "区域运营、服务运营、管理层复盘会",
    output: "评分变化解释、净推荐值结构、低分原因和证据原话",
    useWhen: "需要解释本期满意度为什么上升或下降",
  },
  "区域/城市下钻": {
    audience: "区域运营、城市经理、服务网络管理团队",
    output: "区域、城市、服务中心之间的差异和优先处理网点",
    useWhen: "需要定位问题集中在哪些城市或服务中心",
  },
  活动体验复盘: {
    audience: "用户运营、社群运营、活动执行团队",
    output: "活动亮点、不满点、权益说明和下次优化动作",
    useWhen: "复盘车主活动、社群运营或触达项目",
  },
  口碑素材与风险: {
    audience: "品牌口碑、内容团队、客服协同团队",
    output: "可沉淀正向素材、负向风险摘要和回应前处理建议",
    useWhen: "需要筛选服务故事素材或判断口碑风险",
  },
};

const importTemplateFields = [
  { field: "项目名称", requirement: "必填", usage: "识别本次问卷批次和报告标题" },
  { field: "问卷来源", requirement: "建议", usage: "区分问卷星、腾讯问卷、App 内问卷等来源通道" },
  { field: "提交时间", requirement: "必填", usage: "推断项目周期，支持日期筛选和倒序评论" },
  { field: "区域/省份/城市", requirement: "必填", usage: "支持全国、区域、城市多选分析" },
  { field: "服务中心名称", requirement: "必填", usage: "下钻到网点，识别风险服务中心" },
  { field: "服务场景", requirement: "必填", usage: "区分到店、移动服务、补能、App/OTA 等场景" },
  { field: "服务评分/推荐意愿评分", requirement: "必填", usage: "计算体验结果、净推荐值、推荐者、贬损者和满意率" },
  { field: "开放反馈原话", requirement: "必填", usage: "生成归因、证据原话、报告段落和处理动作" },
  { field: "是否愿意联系", requirement: "建议", usage: "计算联系授权率，筛选可回访样本" },
  { field: "问题是否解决", requirement: "建议", usage: "判断闭环状态和待跟进问题" },
  { field: "联系方式", requirement: "可选", usage: "仅用于模拟跟进信号，MVP 不保存真实个人信息" },
];

type WorkbenchShellProps = {
  exports: ThirdPartySurveyExport[];
  selectedExportId: string;
  onSelectExport: (id: string) => void;
  scenario: WorkbenchScenario;
  onScenarioChange: (scenario: WorkbenchScenario) => void;
  feedbackRecords: NormalizedFeedback[];
};

export function WorkbenchShell({
  exports,
  selectedExportId,
  onSelectExport,
  scenario,
  onScenarioChange,
  feedbackRecords,
}: WorkbenchShellProps) {
  const [activeStepId, setActiveStepId] = useState("import");
  const [downloadStatus, setDownloadStatus] = useState("");
  const selectedExport = exports.find((item) => item.exportId === selectedExportId) ?? exports[0];
  const selectedProjectName = selectedExport.projectName;
  const projectGroups = useMemo(() => buildProjectGroups(exports), [exports]);
  const selectedProjectGroup = projectGroups.find((item) => item.projectName === selectedProjectName);
  const selectedProjectExports = useMemo(
    () => exports.filter((item) => item.projectName === selectedProjectName),
    [exports, selectedProjectName],
  );
  const importValidation = useMemo(
    () => buildImportValidationSummary(selectedProjectExports),
    [selectedProjectExports],
  );
  const [startDate, setStartDate] = useState(selectedExport.periodStart);
  const [endDate, setEndDate] = useState(selectedExport.periodEnd);
  const [geoSelection, setGeoSelection] = useState<GeoSelection>({ regions: [], cities: [] });
  const dateFilteredRecords = useMemo(
    () => filterRecordsByDate(feedbackRecords, startDate, endDate),
    [endDate, feedbackRecords, startDate],
  );
  const scopedRecords = useMemo(
    () => filterRecordsByGeoSelection(dateFilteredRecords, geoSelection),
    [dateFilteredRecords, geoSelection],
  );
  const findings = useMemo(() => buildFindingsForScenario(scopedRecords, scenario), [scopedRecords, scenario]);
  const focusInsights = useMemo(() => buildFocusRegionInsights(scopedRecords), [scopedRecords]);
  const metrics = useMemo(() => buildMetricSummary(scopedRecords), [scopedRecords]);
  const regionTree = useMemo(() => buildRegionTree(dateFilteredRecords), [dateFilteredRecords]);
  const executiveFindings = useMemo(() => buildFindingsForScenario(scopedRecords, "区域/城市下钻"), [scopedRecords]);
  const output = useMemo(() => createScenarioOutput(scenario, findings, metrics), [findings, metrics, scenario]);
  const executiveOutput = useMemo(() => createExecutiveReport(executiveFindings, metrics), [executiveFindings, metrics]);
  const scopeLabel = buildScopeLabel(selectedProjectName, startDate, endDate, geoSelection);
  const workflowSteps = [
    {
      id: "import",
      label: "1 业务项目",
      description: selectedProjectName,
      status: "已选择",
      guide: "先选择业务项目，确定本次分析的数据池和来源文件；项目自带数据覆盖周期，但不等于最终分析时间。",
    },
    {
      id: "scope",
      label: "2 分析范围",
      description: scopeLabel,
      status: "已设定",
      guide: "再基于已选项目设定本次报告的分析时间、区域、城市或服务中心。",
    },
    {
      id: "analysis",
      label: "3 诊断与指标",
      description: scopedRecords.length ? `${scopedRecords.length} 条样本可分析` : "当前范围无样本",
      status: scopedRecords.length ? "可查看" : "无样本",
      guide: "先看总体判断、重点关注、指标口径和代表性证据。",
    },
    {
      id: "output",
      label: "4 报告与原话",
      description: scopedRecords.length ? "总报告、专项报告、原话支撑" : "请先调整统计范围",
      status: scopedRecords.length ? "可复制" : "未生成",
      guide: "最后选择运营动作场景，生成可复制的总报告或专项清单。",
    },
  ];
  const activeStepIndex = Math.max(
    workflowSteps.findIndex((step) => step.id === activeStepId),
    0,
  );
  const activeStep = workflowSteps[activeStepIndex];
  const goToStep = (stepId: string) => setActiveStepId(stepId);
  const goPrevious = () => setActiveStepId(workflowSteps[Math.max(activeStepIndex - 1, 0)].id);
  const goNext = () => setActiveStepId(workflowSteps[Math.min(activeStepIndex + 1, workflowSteps.length - 1)].id);
  const toggleRegion = (region: Region) => {
    setGeoSelection((current) => ({
      regions: current.regions.includes(region)
        ? current.regions.filter((item) => item !== region)
        : [...current.regions, region],
      cities: current.cities,
    }));
  };
  const toggleCity = (city: string) => {
    setGeoSelection((current) => ({
      regions: current.regions,
      cities: current.cities.includes(city)
        ? current.cities.filter((item) => item !== city)
        : [...current.cities, city],
    }));
  };
  const selectCenter = (center: { city: string; serviceCenter: string }) => {
    setGeoSelection({ regions: [], cities: [], serviceCenter: center });
  };
  const clearGeoSelection = () => setGeoSelection({ regions: [], cities: [] });
  const downloadImportTemplate = async () => {
    try {
      const response = await fetch("/templates/after_sales_feedback_import_template.csv");
      if (!response.ok) throw new Error("template request failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "售后反馈标准导入模板.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDownloadStatus("模板已开始下载");
    } catch {
      setDownloadStatus("下载失败，请稍后重试");
    }
  };

  return (
    <section className="workbench-page">
      <div className="workflow-bar" aria-label="工作台步骤定位">
        {workflowSteps.map((step, index) => (
          <button
            className={[
              "workflow-step",
              step.id === activeStepId ? "active" : "",
              index < activeStepIndex ? "completed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={step.id}
            onClick={() => goToStep(step.id)}
            type="button"
          >
            <span>{step.label}</span>
            <strong>{step.status}</strong>
            <small>{step.description}</small>
          </button>
        ))}
      </div>
      <p className="workflow-helper">
        操作顺序固定为：先选业务项目确定数据池，再选分析时间和地区；需要修改时可点击上方步骤或底部返回按钮。
      </p>

      <section className="guided-workbench">
        <div className="step-context">
          <div>
            <p className="eyebrow">当前步骤</p>
            <h2>{activeStep.label}</h2>
            <p>{activeStep.guide}</p>
          </div>
          <div className="step-scope-summary">
            <span>当前范围</span>
            <strong>{scopeLabel}</strong>
          </div>
        </div>

        {activeStepId === "import" ? (
          <section className="step-workspace project-step">
            <div className="panel step-section">
              <p className="panel-label">1. 确认业务项目数据池</p>
              <div className="order-note">
                <strong>为什么先选项目？</strong>
                <span>
                  项目决定要合并哪些问卷来源和样本；时间范围只是项目数据池里的分析切片，会在下一步单独确认。
                </span>
              </div>
              <div className="import-box">
                <strong>上传项目来源文件</strong>
                <span>一个业务项目可以包含多个来源文件，例如问卷星导出、腾讯问卷导出和 App 内问卷导出。</span>
                <button type="button">选择表格文件</button>
              </div>
              <div className="template-panel">
                <div className="template-panel-header">
                  <div>
                    <p>标准导入模板</p>
                    <span>建议先按模板整理问卷导出表，再上传到工作台。</span>
                  </div>
                  <button className="template-download-button" onClick={downloadImportTemplate} type="button">
                    下载 CSV 模板
                  </button>
                </div>
                {downloadStatus ? <small className="download-status">{downloadStatus}</small> : null}
                <div className="template-table" role="table" aria-label="售后反馈标准导入模板">
                  <div className="template-row template-head" role="row">
                    <span role="columnheader">字段</span>
                    <span role="columnheader">要求</span>
                    <span role="columnheader">进入分析</span>
                  </div>
                  {importTemplateFields.map((item) => (
                    <div className="template-row" key={item.field} role="row">
                      <span role="cell">{item.field}</span>
                      <strong className={`requirement requirement-${item.requirement}`} role="cell">
                        {item.requirement}
                      </strong>
                      <small role="cell">{item.usage}</small>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`import-detection validation-${importValidation.overallStatus}`}>
                <div className="validation-header">
                  <div>
                    <p>导入后校验</p>
                    <span>
                      已按当前业务项目合并 {importValidation.stats.sourceCount} 个来源文件、
                      {importValidation.stats.recordCount} 条反馈进行校验。
                    </span>
                  </div>
                  <strong>{formatValidationStatus(importValidation.overallStatus)}</strong>
                </div>
                <div className="validation-grid">
                  {importValidation.items.map((item) => (
                    <article className={`validation-card validation-${item.status}`} key={item.id}>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.metric}</span>
                      </div>
                      <p>{item.detail}</p>
                    </article>
                  ))}
                </div>
                <small className="validation-note">
                  校验通过代表可以进入分析；“需确认”建议在下一步修正时间或字段映射；“异常”需要先处理再生成报告。
                </small>
              </div>
            </div>

            <div className="panel">
              <div className="source-list-header">
                <strong>业务项目数据池</strong>
                <span>先选项目，系统只确定可分析样本池；下一步再确认本次报告使用哪段时间、哪些地区。</span>
              </div>
              <div className="source-list">
                {projectGroups.map((item) => (
                  <button
                    className={item.projectName === selectedProjectName ? "source-item active" : "source-item"}
                    key={item.projectName}
                    onClick={() => {
                      onSelectExport(item.primaryExportId);
                      setStartDate(item.periodStart);
                      setEndDate(item.periodEnd);
                      clearGeoSelection();
                    }}
                  >
                    <strong>{item.projectName}</strong>
                    <small>数据覆盖：{item.periodStart} 至 {item.periodEnd}</small>
                    <small>样本规模：{item.totalRecords} 条 · 来源文件：{item.sources.length} 个</small>
                    <span className="project-source-list">{item.sources.join(" / ")}</span>
                  </button>
                ))}
              </div>
              {selectedProjectGroup ? (
                <div className="capacity-note">
                  <strong>样本承载说明</strong>
                  <span>
                    当前项目 {selectedProjectGroup.totalRecords} 条，来自 {selectedProjectGroup.sources.length} 个来源。原型只渲染聚合指标、下钻列表和代表样本，避免一次性铺开全部原话。
                  </span>
                  <small>生产版建议采用后台解析、分页检索、虚拟列表和异步报告生成，支撑周度几千条、月度数万条反馈。</small>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeStepId === "scope" ? (
          <section className="step-workspace scope-step">
            <div className="panel step-section">
              <p className="panel-label">2. 设定分析时间</p>
              <div className="scope-order-note">
                <strong>当前项目</strong>
                <span>{selectedProjectName}</span>
                <small>下方日期默认取项目数据覆盖周期，可按周报、专项活动或复盘会议口径手动调整。</small>
              </div>
              <div className="date-filter">
                <label>
                  开始日期
                  <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label>
                  结束日期
                  <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
              </div>
              <button className="clear-scope-button" type="button" onClick={clearGeoSelection}>
                恢复全国 / 全部地区
              </button>
            </div>

            <FeedbackPool
              metrics={metrics}
              records={scopedRecords}
              regionTree={regionTree}
              scopeLabel={scopeLabel}
              selectedRegions={geoSelection.regions}
              selectedCities={geoSelection.cities}
              selectedCenter={geoSelection.serviceCenter}
              onToggleRegion={toggleRegion}
              onToggleCity={toggleCity}
              onSelectCenter={selectCenter}
              onClearGeoSelection={clearGeoSelection}
            />
          </section>
        ) : null}

        {activeStepId === "analysis" ? (
          <section className="step-workspace analysis-step">
            <div className="step-shortcuts">
              <button type="button" onClick={() => goToStep("import")}>修改项目</button>
              <button type="button" onClick={() => goToStep("scope")}>修改时间/地区</button>
            </div>
            <AnalysisWorkspace
              findings={findings}
              focusInsights={focusInsights}
              scenario={scenario}
              metrics={metrics}
              scopeLabel={scopeLabel}
            />
          </section>
        ) : null}

        {activeStepId === "output" ? (
          <section className="step-workspace output-step">
            <div className="panel scenario-panel delivery-control-panel">
              <div className="scenario-panel-header">
                <p className="panel-label">4. 选择交付类型</p>
                <h3>{scenario}</h3>
                <span>切换左侧交付类型，右侧总报告和专项内容会同步刷新。</span>
              </div>
              <div className="scenario-list">
                {scenarios.map((item) => {
                  const guide = scenarioGuides[item];
                  return (
                    <button className={item === scenario ? "active" : ""} key={item} onClick={() => onScenarioChange(item)} type="button">
                      <strong>{item}</strong>
                      <span>{guide.output}</span>
                    </button>
                  );
                })}
              </div>
              <div className="scenario-brief">
                <div>
                  <strong>适用对象</strong>
                  <span>{scenarioGuides[scenario].audience}</span>
                </div>
                <div>
                  <strong>使用场景</strong>
                  <span>{scenarioGuides[scenario].useWhen}</span>
                </div>
                <div>
                  <strong>输出内容</strong>
                  <span>{scenarioGuides[scenario].output}</span>
                </div>
              </div>
              <div className="step-shortcuts stacked output-actions">
                <button type="button" onClick={() => goToStep("analysis")}>返回诊断</button>
                <button type="button" onClick={() => goToStep("scope")}>修改范围</button>
              </div>
            </div>
            <ScenarioOutputPanel executiveOutput={executiveOutput} metrics={metrics} output={output} />
          </section>
        ) : null}

        <div className="step-navigation">
          <button type="button" onClick={goPrevious} disabled={activeStepIndex === 0}>
            上一步
          </button>
          <span>
            第 {activeStepIndex + 1} 步 / 共 {workflowSteps.length} 步
          </span>
          <button type="button" onClick={goNext} disabled={activeStepIndex === workflowSteps.length - 1 || scopedRecords.length === 0}>
            下一步
          </button>
        </div>
      </section>
    </section>
  );
}

function buildScopeLabel(projectName: string, startDate: string, endDate: string, geoSelection: GeoSelection): string {
  const timeLabel = `${projectName} · ${startDate} 至 ${endDate}`;
  if (geoSelection.serviceCenter) return `${timeLabel} · ${geoSelection.serviceCenter.city} / ${geoSelection.serviceCenter.serviceCenter}`;
  const regionLabel = geoSelection.regions.length ? `区域：${geoSelection.regions.join("、")}` : "";
  const cityLabel = geoSelection.cities.length ? `城市：${geoSelection.cities.join("、")}` : "";
  const geoLabel = [regionLabel, cityLabel].filter(Boolean).join(" · ");
  return geoLabel ? `${timeLabel} · ${geoLabel}` : `${timeLabel} · 全国`;
}

function formatValidationStatus(status: "pass" | "warning" | "fail"): string {
  if (status === "pass") return "已通过";
  if (status === "warning") return "需确认";
  return "存在异常";
}

function buildProjectGroups(exports: ThirdPartySurveyExport[]) {
  const groups = new Map<
    string,
    {
      projectName: string;
      primaryExportId: string;
      periodStart: string;
      periodEnd: string;
      totalRecords: number;
      sources: string[];
    }
  >();

  for (const item of exports) {
    const existing = groups.get(item.projectName);
    if (!existing) {
      groups.set(item.projectName, {
        projectName: item.projectName,
        primaryExportId: item.exportId,
        periodStart: item.periodStart,
        periodEnd: item.periodEnd,
        totalRecords: item.records.length,
        sources: [`${item.platform} · ${item.sourceName}`],
      });
      continue;
    }

    existing.periodStart = item.periodStart < existing.periodStart ? item.periodStart : existing.periodStart;
    existing.periodEnd = item.periodEnd > existing.periodEnd ? item.periodEnd : existing.periodEnd;
    existing.totalRecords += item.records.length;
    existing.sources.push(`${item.platform} · ${item.sourceName}`);
  }

  return Array.from(groups.values());
}
