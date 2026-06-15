import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { BarChart3, Bot, DatabaseZap, Download, SlidersHorizontal, UploadCloud, UserCircle } from "lucide-react";
import {
  buildAutoRecapModules,
  buildFindingsForScenario,
  buildFocusRegionInsights,
  buildMetricSummary,
  buildProjectOptionsForTimeRange,
  buildRegionTree,
  filterRecordsByDate,
  filterRecordsByGeoSelection,
  filterRecordsByProjectSelection,
  getTimeGrainDateRange,
  normalizeDateRange,
  type GeoSelection,
  type TimeGrain,
} from "../domain/analysisRules";
import {
  buildAgentConversationTitle,
  buildAgentProgressSteps,
  createAgentConversationTurn,
  getAgentProgressPercent,
  type AgentConversationTurn,
  type AgentProgressStep,
  type AgentRunStage,
} from "../domain/agentConversation";
import { buildSuggestedAgentQuestions, type WorkbenchAgentAnswer } from "../domain/agentRules";
import { createDeepSeekAgentPort } from "../domain/deepseekAgentPort";
import { createSupabaseAgentRetrievalPort } from "../domain/supabaseAgentRetrievalPort";
import { buildCoreMetricDashboardCards, type CoreMetricDashboardCard } from "../domain/metricDrilldown";
import { createExecutiveReport, createScenarioOutput } from "../domain/outputTemplates";
import { SUPABASE_REPOSITORIES } from "../domain/supabaseRepositories";
import { scenarios } from "../domain/taxonomy";
import type {
  AutoRecapModule,
  NormalizedFeedback,
  ProjectSelection,
  Region,
  ThirdPartySurveyExport,
  WorkbenchScenario,
} from "../domain/types";
import { WORKBENCH_AREAS, type WorkbenchAreaId } from "../domain/workbenchAreas";
import { AnalysisWorkspace } from "./AnalysisWorkspace";
import { FeedbackPool } from "./FeedbackPool";
import { ScenarioOutputPanel } from "./ScenarioOutputPanel";

const agentRetrievalPort = createSupabaseAgentRetrievalPort(import.meta.env);
const agentPort = createDeepSeekAgentPort(import.meta.env, agentRetrievalPort);

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

const timeGrainOptions: Array<{ id: TimeGrain; label: string; helper: string }> = [
  { id: "day", label: "日", helper: "看单日异常" },
  { id: "week", label: "周", helper: "周报与专项复盘" },
  { id: "month", label: "月", helper: "月度运营复盘" },
  { id: "quarter", label: "季度", helper: "季度趋势判断" },
  { id: "year", label: "年", helper: "年度经营回看" },
  { id: "custom", label: "自定义", helper: "运营指定时间段" },
];

type WorkbenchShellProps = {
  exports: ThirdPartySurveyExport[];
  scenario: WorkbenchScenario;
  onScenarioChange: (scenario: WorkbenchScenario) => void;
  feedbackRecords: NormalizedFeedback[];
  importState: {
    status: "loading" | "ready" | "error";
    message: string;
    details: string[];
  };
  onImportCsv: (file: File) => Promise<void>;
};

type AgentThreadSummary = {
  key: string;
  title: string;
  meta: string;
  turnCount: number;
  latestQuestion?: string;
  latestAnswer?: string;
};

export function WorkbenchShell({
  exports,
  scenario,
  onScenarioChange,
  feedbackRecords,
  importState,
  onImportCsv,
}: WorkbenchShellProps) {
  const [activeAreaId, setActiveAreaId] = useState<WorkbenchAreaId>("import");
  const [downloadStatus, setDownloadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [timeGrain, setTimeGrain] = useState<TimeGrain>("custom");
  const fullDateRange = useMemo(() => inferRecordDateRange(feedbackRecords), [feedbackRecords]);
  const [startDate, setStartDate] = useState(fullDateRange.startDate);
  const [endDate, setEndDate] = useState(fullDateRange.endDate);
  const [projectSelection, setProjectSelection] = useState<ProjectSelection>({ mode: "all" });
  const [geoSelection, setGeoSelection] = useState<GeoSelection>({ regions: [], cities: [] });
  const [agentQuestion, setAgentQuestion] = useState("当前净推荐值是多少，主要风险是什么？");
  const [agentPendingQuestion, setAgentPendingQuestion] = useState("");
  const [agentStreamingAnswer, setAgentStreamingAnswer] = useState("");
  const [agentIsRunning, setAgentIsRunning] = useState(false);
  const [agentProgressStage, setAgentProgressStage] = useState<AgentRunStage | null>(null);
  const [agentConversationTurnsByProject, setAgentConversationTurnsByProject] = useState<Record<string, AgentConversationTurn[]>>({});
  const [scenarioOutputVisible, setScenarioOutputVisible] = useState(false);

  useEffect(() => {
    const defaultRange = getTimeGrainDateRange(fullDateRange, "custom");
    setTimeGrain("custom");
    setStartDate(defaultRange.startDate);
    setEndDate(defaultRange.endDate);
    setProjectSelection({ mode: "all" });
    setGeoSelection({ regions: [], cities: [] });
    setAgentPendingQuestion("");
    setAgentStreamingAnswer("");
    setAgentIsRunning(false);
    setAgentProgressStage(null);
    setScenarioOutputVisible(false);
    setActiveAreaId("import");
  }, [fullDateRange.endDate, fullDateRange.startDate]);

  const timeFilteredRecords = useMemo(
    () => filterRecordsByDate(feedbackRecords, startDate, endDate),
    [endDate, feedbackRecords, startDate],
  );
  const projectOptions = useMemo(() => buildProjectOptionsForTimeRange(timeFilteredRecords), [timeFilteredRecords]);
  const selectedProjectRecords = useMemo(
    () => filterRecordsByProjectSelection(timeFilteredRecords, projectSelection),
    [projectSelection, timeFilteredRecords],
  );
  const scopedRecords = useMemo(
    () => filterRecordsByGeoSelection(selectedProjectRecords, geoSelection),
    [geoSelection, selectedProjectRecords],
  );
  const findings = useMemo(() => buildFindingsForScenario(scopedRecords, scenario), [scopedRecords, scenario]);
  const focusInsights = useMemo(() => buildFocusRegionInsights(scopedRecords), [scopedRecords]);
  const metrics = useMemo(() => buildMetricSummary(scopedRecords), [scopedRecords]);
  const dashboardCards = useMemo(() => buildCoreMetricDashboardCards(metrics), [metrics]);
  const regionTree = useMemo(() => buildRegionTree(selectedProjectRecords), [selectedProjectRecords]);
  const executiveFindings = useMemo(() => buildFindingsForScenario(scopedRecords, "区域/城市下钻"), [scopedRecords]);
  const output = useMemo(() => createScenarioOutput(scenario, findings, metrics), [findings, metrics, scenario]);
  const executiveOutput = useMemo(() => createExecutiveReport(executiveFindings, metrics), [executiveFindings, metrics]);
  const currentAgentReportTitle = scenarioOutputVisible ? output.title : executiveOutput.title;
  const agentProgressSteps = useMemo(
    () => (agentProgressStage ? buildAgentProgressSteps(agentProgressStage) : []),
    [agentProgressStage],
  );
  const agentProgressPercent = agentProgressStage ? getAgentProgressPercent(agentProgressStage) : 0;
  const scopeLabel = buildScopeLabel(startDate, endDate, timeGrain, projectSelection, geoSelection);
  const currentProjectConversationKey = buildAgentConversationTitle(projectSelection);
  const agentThreadSummaries = useMemo(
    () =>
      buildAgentThreadSummaries({
        allRecordCount: timeFilteredRecords.length,
        currentKey: currentProjectConversationKey,
        currentRecordCount: scopedRecords.length,
        projectOptions,
        projectSelection,
        turnsByProject: agentConversationTurnsByProject,
      }),
    [
      agentConversationTurnsByProject,
      currentProjectConversationKey,
      projectOptions,
      projectSelection,
      scopedRecords.length,
      timeFilteredRecords.length,
    ],
  );
  const currentProjectConversationTurns = agentConversationTurnsByProject[currentProjectConversationKey] ?? [];
  const suggestedAgentQuestions = useMemo(
    () =>
      buildSuggestedAgentQuestions({
        records: scopedRecords,
        metrics,
        findings: executiveFindings,
        scopeLabel,
      }),
    [executiveFindings, metrics, scopeLabel, scopedRecords],
  );
  const autoRecapModules = useMemo(
    () =>
      buildAutoRecapModules({
        records: scopedRecords,
        metrics,
        findings: executiveFindings,
        focusInsights,
        scopeLabel,
      }),
    [executiveFindings, focusInsights, metrics, scopeLabel, scopedRecords],
  );
  const applyTimeGrain = (nextTimeGrain: TimeGrain) => {
    setTimeGrain(nextTimeGrain);
    const nextRange = getTimeGrainDateRange(fullDateRange, nextTimeGrain);
    setStartDate(nextRange.startDate);
    setEndDate(nextRange.endDate);
  };
  const handleStartDateChange = (value: string) => {
    setTimeGrain("custom");
    setStartDate(value);
  };
  const handleEndDateChange = (value: string) => {
    setTimeGrain("custom");
    setEndDate(value);
  };

  useEffect(() => {
    setAgentPendingQuestion("");
    setAgentStreamingAnswer("");
    setAgentProgressStage(null);
  }, [currentAgentReportTitle, scopeLabel]);

  const selectedProjectNames =
    projectSelection.mode === "selected"
      ? projectSelection.projectNames
      : projectSelection.mode === "byType"
        ? projectOptions.filter((project) => projectSelection.projectTypes.includes(project.projectType)).map((project) => project.projectName)
        : projectOptions.map((project) => project.projectName);

  const toggleProject = (projectName: string) => {
    setProjectSelection((current) => {
      const currentNames = current.mode === "selected" ? current.projectNames : [];
      const nextNames = currentNames.includes(projectName)
        ? currentNames.filter((item) => item !== projectName)
        : [...currentNames, projectName];
      return nextNames.length ? { mode: "selected", projectNames: nextNames } : { mode: "all" };
    });
    clearGeoSelection();
  };
  const selectProjectType = (projectType: string) => {
    setProjectSelection((current) => {
      const currentTypes = current.mode === "byType" ? current.projectTypes : [];
      const nextTypes = currentTypes.includes(projectType)
        ? currentTypes.filter((item) => item !== projectType)
        : [...currentTypes, projectType];
      return nextTypes.length ? { mode: "byType", projectTypes: nextTypes } : { mode: "all" };
    });
    clearGeoSelection();
  };
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
  const resetAllProjects = () => {
    setProjectSelection({ mode: "all" });
    clearGeoSelection();
  };
  const selectAgentThread = (threadKey: string) => {
    if (agentIsRunning || threadKey === currentProjectConversationKey) return;
    if (threadKey === "全部项目") {
      resetAllProjects();
      return;
    }
    const project = projectOptions.find((item) => item.projectName === threadKey);
    if (!project) return;
    setProjectSelection({ mode: "selected", projectNames: [project.projectName] });
    clearGeoSelection();
  };
  const runAgentQuestion = async () => {
    const questionText = agentQuestion.trim();
    if (!questionText || agentIsRunning) return;

    const askedAt = formatAgentAskedAt(new Date());
    const turnId = `agent-turn-${Date.now()}`;
    const conversationKey = currentProjectConversationKey;
    setAgentPendingQuestion(questionText);
    setAgentStreamingAnswer("");
    setAgentIsRunning(true);
    setAgentProgressStage("prepare-context");
    setAgentQuestion("");

    try {
      const answer = await agentPort.answer({
        question: questionText,
        records: scopedRecords,
        metrics,
        findings: executiveFindings,
        scopeLabel,
        onProgress: setAgentProgressStage,
        onToken: (_delta, fullText) => setAgentStreamingAnswer(fullText),
      });
      setAgentProgressStage("archive-turn");
      setAgentConversationTurnsByProject((current) => ({
        ...current,
        [conversationKey]: [
          createAgentConversationTurn({
            id: turnId,
            askedAt,
            question: questionText,
            answer: answer.content,
            scopeLabel,
            reportTitle: currentAgentReportTitle,
            scenario,
            refused: answer.refused,
            evidenceCount: answer.evidenceQuotes.length,
          }),
          ...(current[conversationKey] ?? []),
        ].slice(0, 20),
      }));
    } catch {
      const answer: WorkbenchAgentAnswer = {
        refused: true,
        content: "本次追问没有成功返回。请稍后重试，或检查当前数据是否已完成导入。",
        evidenceQuotes: [],
      };
      setAgentProgressStage("archive-turn");
      setAgentConversationTurnsByProject((current) => ({
        ...current,
        [conversationKey]: [
          createAgentConversationTurn({
            id: turnId,
            askedAt,
            question: questionText,
            answer: answer.content,
            scopeLabel,
            reportTitle: currentAgentReportTitle,
            scenario,
            refused: true,
            evidenceCount: 0,
          }),
          ...(current[conversationKey] ?? []),
        ].slice(0, 20),
      }));
    } finally {
      setAgentIsRunning(false);
      setAgentProgressStage(null);
      setAgentPendingQuestion("");
      setAgentStreamingAnswer("");
    }
  };
  const selectScenarioOutput = (nextScenario: WorkbenchScenario) => {
    onScenarioChange(nextScenario);
    setScenarioOutputVisible(true);
  };
  const downloadImportTemplate = async () => {
    await downloadCsvAsset({
      path: "/templates/after_sales_feedback_import_template.csv",
      filename: "售后反馈标准导入模板.csv",
      successMessage: "模板已开始下载",
      failureMessage: "模板下载失败，请稍后重试",
    });
  };
  const downloadCsvAsset = async ({
    path,
    filename,
    successMessage,
    failureMessage,
  }: {
    path: string;
    filename: string;
    successMessage: string;
    failureMessage: string;
  }) => {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error("csv asset request failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDownloadStatus(successMessage);
    } catch {
      setDownloadStatus(failureMessage);
    }
  };
  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await onImportCsv(file);
    event.currentTarget.value = "";
  };

  return (
    <section className="workbench-page">
      <div className="area-nav" aria-label="工作台功能区">
        {WORKBENCH_AREAS.map((area) => {
          const status =
            area.id === "import"
              ? exports.length
                ? `${exports.length} 次导入`
                : "待导入"
              : area.id === "dashboard"
                ? `${scopedRecords.length} 条反馈`
                : area.id === "agent"
                  ? `${currentProjectConversationTurns.length} 轮追问`
                  : "Supabase";

          return (
            <button
              className={area.id === activeAreaId ? "area-tab active" : "area-tab"}
              key={area.id}
              onClick={() => setActiveAreaId(area.id)}
              type="button"
            >
              <span className="area-tab-icon" aria-hidden="true">
                {area.id === "import" ? <SlidersHorizontal size={18} /> : null}
                {area.id === "dashboard" ? <BarChart3 size={18} /> : null}
                {area.id === "agent" ? <Bot size={18} /> : null}
                {area.id === "profile" ? <UserCircle size={18} /> : null}
              </span>
              <span className="area-tab-copy">
                <strong>{area.label}</strong>
                <small>{area.summary}</small>
              </span>
              <em>{status}</em>
            </button>
          );
        })}
      </div>
      <section className="guided-workbench">
        {activeAreaId === "import" ? (
          <section className="area-workspace import-area">
            <div className="panel step-section import-primary-panel import-center-panel">
              <p className="panel-label">导入</p>
              <div className="import-box">
                <strong>售后反馈表格</strong>
                <span className="import-example">示例：五一售后服务专项_2026-05.csv</span>
                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelection}
                />
                <div className="import-action-row">
                  <button
                    className="button-primary"
                    type="button"
                    disabled={importState.status === "loading"}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud size={16} />
                    {importState.status === "loading" ? "正在导入" : "上传 CSV 文件"}
                  </button>
                  <button className="button-secondary" onClick={downloadImportTemplate} type="button">
                    <Download size={15} />
                    下载模板
                  </button>
                </div>
                {downloadStatus ? <small className="download-status">{downloadStatus}</small> : null}
                <div className={`import-state import-state-${importState.status}`} aria-live="polite">
                  <strong>{formatImportStateLabel(importState.status)}</strong>
                  <span>{importState.message}</span>
                  {importState.details.length ? (
                    <ul>
                      {importState.details.slice(0, 4).map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="panel import-history-panel">
              <div className="section-heading">
                <span>历史导入</span>
                <strong>{exports.length ? `${exports.length} 个导入文件` : "暂无导入文件"}</strong>
              </div>
              <div className="import-history-list">
                {exports.length ? (
                  exports.map((item) => (
                    <article key={item.exportId}>
                      <div>
                        <strong>{item.projectName}</strong>
                        <span>{item.platform} · {item.sourceName}</span>
                      </div>
                      <small>{item.periodStart} 至 {item.periodEnd}</small>
                      <em>{item.records.length} 条</em>
                    </article>
                  ))
                ) : (
                  <div className="empty-note">导入表格后，这里会显示历史记录。</div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeAreaId === "dashboard" ? (
          <section className="area-workspace dashboard-area">
            <div className="dashboard-selection-grid">
              <div className="panel step-section dashboard-selection-panel">
                <p className="panel-label">Selection</p>
                <div className="scope-order-note compact">
                  <strong>{fullDateRange.startDate} 至 {fullDateRange.endDate}</strong>
                </div>
                <div className="time-grain-grid">
                  {timeGrainOptions.map((item) => (
                    <button
                      className={timeGrain === item.id ? "time-grain active" : "time-grain"}
                      key={item.id}
                      onClick={() => applyTimeGrain(item.id)}
                      type="button"
                    >
                      <strong>{item.label}</strong>
                      <span>{item.helper}</span>
                    </button>
                  ))}
                </div>
                <div className="date-filter">
                  <label>
                    开始日期
                    <input type="date" value={startDate} onChange={(event) => handleStartDateChange(event.target.value)} />
                  </label>
                  <label>
                    结束日期
                    <input type="date" value={endDate} onChange={(event) => handleEndDateChange(event.target.value)} />
                  </label>
                </div>
                <div className="dashboard-project-picker">
                  <button className={projectSelection.mode === "all" ? "source-item active" : "source-item"} onClick={resetAllProjects} type="button">
                    <strong>全部项目</strong>
                    <small>{timeFilteredRecords.length} 条反馈 · 当前时间范围</small>
                  </button>
                  <div className="project-type-row">
                    {Array.from(new Set(projectOptions.map((project) => project.projectType))).map((projectType) => (
                      <button
                        className={
                          projectSelection.mode === "byType" && projectSelection.projectTypes.includes(projectType)
                            ? "filter-chip active"
                            : "filter-chip"
                        }
                        key={projectType}
                        onClick={() => selectProjectType(projectType)}
                        type="button"
                      >
                        <span>{projectType}</span>
                        <small>{projectOptions.filter((project) => project.projectType === projectType).length}</small>
                      </button>
                    ))}
                  </div>
                  <div className="source-list project-list compact-list">
                    {projectOptions.map((project) => (
                      <button
                        className={selectedProjectNames.includes(project.projectName) && projectSelection.mode !== "all" ? "source-item active" : "source-item"}
                        key={project.projectName}
                        onClick={() => toggleProject(project.projectName)}
                        type="button"
                      >
                        <strong>{project.projectName}</strong>
                        <small>{project.projectType} · {project.totalFeedback} 条</small>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <GeoFilterPanel
                regionTree={regionTree}
                selectedRegions={geoSelection.regions}
                selectedCities={geoSelection.cities}
                selectedCenter={geoSelection.serviceCenter}
                onToggleRegion={toggleRegion}
                onToggleCity={toggleCity}
                onSelectCenter={selectCenter}
                onClearGeoSelection={clearGeoSelection}
              />
            </div>
            <div className="dashboard-live-grid">
              <DashboardDonutBoard cards={dashboardCards} scopeLabel={scopeLabel} />
              <DashboardAgentPanel
                conversationTitle={currentProjectConversationKey}
                conversationTurns={currentProjectConversationTurns}
                isRunning={agentIsRunning}
                pendingQuestion={agentPendingQuestion}
                progressPercent={agentProgressPercent}
                progressSteps={agentProgressSteps}
                question={agentQuestion}
                suggestedQuestions={suggestedAgentQuestions}
                streamingAnswer={agentStreamingAnswer}
                onQuestionChange={setAgentQuestion}
                onSubmit={runAgentQuestion}
              />
            </div>
            <div className="dashboard-overview-grid">
              <AutoRecapPreview modules={autoRecapModules} expanded />
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
                showSelectionControls={false}
              />
            </div>
            <div className="dashboard-report-grid">
              <AnalysisWorkspace
                findings={findings}
                focusInsights={focusInsights}
                scenario={scenario}
                metrics={metrics}
                scopeLabel={scopeLabel}
              />
              <ScenarioOutputPanel
                executiveOutput={executiveOutput}
                metrics={metrics}
                output={output}
                showScenarioOutput={scenarioOutputVisible}
                scenarioControl={
                  <div className="panel scenario-panel delivery-control-panel">
                    <div className="scenario-panel-header">
                      <p className="panel-label">专项交付</p>
                      <h3>{scenarioOutputVisible ? scenario : "选择一个专项生成分报告"}</h3>
                      <span>总报告先给整体判断；需要下钻材料时，再从这里选择 1 个专项，分报告会出现在下方。</span>
                    </div>
                    <div className="scenario-list">
                      {scenarios.map((item) => {
                        const guide = scenarioGuides[item];
                        return (
                          <button
                            className={item === scenario && scenarioOutputVisible ? "active" : ""}
                            key={item}
                            onClick={() => selectScenarioOutput(item)}
                            type="button"
                          >
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
                  </div>
                }
              />
            </div>
          </section>
        ) : null}

        {activeAreaId === "agent" ? (
          <section className="area-workspace agent-area">
            <div className="panel agent-scope-card">
              <div>
                <p className="panel-label">当前对话范围</p>
                <h3>{currentProjectConversationKey}</h3>
                <span>{scopeLabel}</span>
              </div>
              <div className="agent-scope-metrics">
                <p><strong>{scopedRecords.length}</strong><span>反馈</span></p>
                <p><strong>{projectOptions.length}</strong><span>项目</span></p>
                <p><strong>{metrics.followUpCount}</strong><span>待闭环</span></p>
              </div>
            </div>
            <AgentPanel
              conversationTitle={currentProjectConversationKey}
              conversationTurns={currentProjectConversationTurns}
              isRunning={agentIsRunning}
              pendingQuestion={agentPendingQuestion}
              progressPercent={agentProgressPercent}
              progressSteps={agentProgressSteps}
              question={agentQuestion}
              selectedThreadKey={currentProjectConversationKey}
              suggestedQuestions={suggestedAgentQuestions}
              streamingAnswer={agentStreamingAnswer}
              threadSummaries={agentThreadSummaries}
              onQuestionChange={setAgentQuestion}
              onSelectThread={selectAgentThread}
              onSubmit={runAgentQuestion}
            />
          </section>
        ) : null}

        {activeAreaId === "profile" ? (
          <section className="area-workspace profile-area">
            <div className="profile-grid">
              <section className="panel profile-card">
                <p className="panel-label">账号</p>
                <h3>售后运营账号</h3>
                <div className="profile-list">
                  <p><span>默认角色</span><strong>区域运营 / 服务运营 / 用户运营</strong></p>
                  <p><span>默认范围</span><strong>{scopeLabel}</strong></p>
                  <p><span>隐私策略</span><strong>敏感信息不展示</strong></p>
                </div>
              </section>
              <section className="panel profile-card">
                <p className="panel-label">数据库</p>
                <h3>后端数据库：Supabase</h3>
                <div className="database-status">
                  <DatabaseZap size={18} />
                  <span>数据端口已预留，当前页面使用已导入表格进行分析。</span>
                </div>
                <div className="repository-grid">
                  {SUPABASE_REPOSITORIES.map((repository) => (
                    <article key={repository.name}>
                      <strong>{repository.name}</strong>
                      <span>{repository.purpose}</span>
                      <small>{repository.tables.join(" / ")}</small>
                    </article>
                  ))}
                </div>
              </section>
              <section className="panel profile-card">
                <p className="panel-label">导入历史</p>
                <h3>{exports.length ? `${exports.length} 个导入文件` : "暂无导入文件"}</h3>
                <div className="profile-list">
                  {exports.slice(0, 6).map((item) => (
                    <p key={item.exportId}>
                      <span>{item.platform}</span>
                      <strong>{item.projectName} · {item.records.length} 条</strong>
                    </p>
                  ))}
                </div>
              </section>
              <section className="panel profile-card">
                <p className="panel-label">Agent 记录</p>
                <h3>{Object.values(agentConversationTurnsByProject).flat().length} 轮追问</h3>
                <div className="profile-list">
                  {agentThreadSummaries.slice(0, 6).map((thread) => (
                    <p key={thread.key}>
                      <span>{thread.title}</span>
                      <strong>{thread.turnCount ? `${thread.turnCount} 轮` : "未追问"}</strong>
                    </p>
                  ))}
                </div>
              </section>
            </div>
          </section>
        ) : null}
      </section>
    </section>
  );
}

function AutoRecapPreview({
  modules,
  compact = false,
  expanded = false,
}: {
  modules: AutoRecapModule[];
  compact?: boolean;
  expanded?: boolean;
}) {
  const visibleModules = compact ? modules.slice(0, 4) : modules;
  const className = ["auto-recap-panel", compact ? "" : "panel", expanded ? "expanded" : ""].filter(Boolean).join(" ");

  return (
    <section className={className}>
      <div className="section-heading">
        <span>自动复盘</span>
        <strong>默认 8 个模块</strong>
      </div>
      <div className="auto-recap-grid">
        {visibleModules.map((module, index) => (
          <article key={module.id}>
            <span>{index + 1}</span>
            <h3>{module.title}</h3>
            <p>{module.summary}</p>
            {expanded ? (
              <ul>
                {module.dataPoints.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function DashboardDonutBoard({
  cards,
  scopeLabel,
}: {
  cards: CoreMetricDashboardCard[];
  scopeLabel: string;
}) {
  return (
    <section className="panel dashboard-donut-board">
      <div className="section-heading">
        <span>数据大仪表盘</span>
        <strong>{scopeLabel}</strong>
      </div>
      <div className="dashboard-donut-grid">
        {cards.map((card) => (
          <article className={`dashboard-donut-card donut-${card.tone}`} key={card.key}>
            <div
              className="donut-chart dashboard-donut-chart"
              style={{ "--donut-angle": `${card.progress * 3.6}deg` } as CSSProperties}
              aria-label={`${card.title} ${card.primaryValue}`}
            >
              <strong>{card.primaryValue}</strong>
              <span>{card.primaryLabel}</span>
            </div>
            <div>
              <h3>{card.title}</h3>
              <p>{card.helper}</p>
              <small>{card.actionLabel}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DashboardAgentPanel({
  question,
  conversationTitle,
  conversationTurns,
  isRunning,
  pendingQuestion,
  progressPercent,
  progressSteps,
  suggestedQuestions,
  streamingAnswer,
  onQuestionChange,
  onSubmit,
}: {
  question: string;
  conversationTitle: string;
  conversationTurns: AgentConversationTurn[];
  isRunning: boolean;
  pendingQuestion: string;
  progressPercent: number;
  progressSteps: AgentProgressStep[];
  suggestedQuestions: string[];
  streamingAnswer: string;
  onQuestionChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <section className="agent-panel dashboard-agent-panel">
      <div className="agent-panel-header">
        <div>
          <strong>追问当前仪表盘</strong>
          <span>当前范围：{conversationTitle}</span>
        </div>
        <small>只回答当前仪表盘、附近数据、原话证据和售后运营动作相关问题。</small>
      </div>
      <AgentChatTranscript
        conversationTitle={conversationTitle}
        isRunning={isRunning}
        pendingQuestion={pendingQuestion}
        progressPercent={progressPercent}
        progressSteps={progressSteps}
        streamingAnswer={streamingAnswer}
        turns={conversationTurns.slice(0, 6)}
      />
      <div className="agent-composer compact-agent-composer">
        <div className="agent-suggestion-row" aria-label="基于当前仪表盘生成的建议问题">
          {suggestedQuestions.slice(0, 3).map((suggestion) => (
            <button className="agent-suggestion" disabled={isRunning} key={suggestion} onClick={() => onQuestionChange(suggestion)} type="button">
              {suggestion}
            </button>
          ))}
        </div>
        <textarea
          disabled={isRunning}
          placeholder="追问当前仪表盘，例如：这个服务中心低分主要集中在哪里？"
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          rows={3}
        />
        <button className="button-primary" type="button" onClick={onSubmit} disabled={isRunning || !question.trim()}>
          <Bot size={16} />
          {isRunning ? "Agent 正在处理" : "追问当前仪表盘"}
        </button>
      </div>
    </section>
  );
}

function GeoFilterPanel({
  regionTree,
  selectedRegions,
  selectedCities,
  selectedCenter,
  onToggleRegion,
  onToggleCity,
  onSelectCenter,
  onClearGeoSelection,
}: {
  regionTree: ReturnType<typeof buildRegionTree>;
  selectedRegions: Region[];
  selectedCities: string[];
  selectedCenter?: {
    city: string;
    serviceCenter: string;
  };
  onToggleRegion: (region: Region) => void;
  onToggleCity: (city: string) => void;
  onSelectCenter: (center: { city: string; serviceCenter: string }) => void;
  onClearGeoSelection: () => void;
}) {
  const regionOptions = regionTree
    .filter((item) => isSelectableWorkbenchRegion(item.region))
    .map((item) => ({
      region: item.region as Region,
      totalFeedback: item.totalFeedback,
    }));
  const cityOptions = regionTree.flatMap((region) =>
    region.cities.map((city) => ({
      region: region.region,
      city: city.city,
      totalFeedback: city.totalFeedback,
      serviceCenters: city.serviceCenters,
    })),
  );
  const visibleCityOptions = selectedRegions.length
    ? cityOptions.filter((city) => isSelectableWorkbenchRegion(city.region) && selectedRegions.includes(city.region))
    : cityOptions;
  const visibleServiceCenters = cityOptions
    .filter((city) => !selectedRegions.length || (isSelectableWorkbenchRegion(city.region) && selectedRegions.includes(city.region)))
    .filter((city) => !selectedCities.length || selectedCities.includes(city.city))
    .flatMap((city) =>
      city.serviceCenters.map((center) => ({
        city: city.city,
        serviceCenter: center.serviceCenter,
        totalFeedback: center.totalFeedback,
      })),
    )
    .slice(0, 12);

  return (
    <div className="panel step-section geo-picker-panel">
      <div className="geo-picker-header">
        <div>
          <p className="panel-label">地区与服务中心</p>
          <h3>筛选分析范围</h3>
        </div>
        <button className="button-secondary" type="button" onClick={onClearGeoSelection}>
          全部地区
        </button>
      </div>
      <div className="filter-section">
        <div className="filter-section-title">
          <strong>区域</strong>
          <span>可多选</span>
        </div>
        <div className="filter-chip-grid">
          {regionOptions.map((region) => (
            <button
              className={selectedRegions.includes(region.region) ? "filter-chip active" : "filter-chip"}
              key={region.region}
              onClick={() => onToggleRegion(region.region)}
              type="button"
            >
              <span>{region.region}</span>
              <small>{region.totalFeedback}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="filter-section">
        <div className="filter-section-title">
          <strong>城市</strong>
          <span>{selectedRegions.length ? "当前区域内城市" : "全部城市"}</span>
        </div>
        <div className="filter-chip-grid city-chip-grid">
          {visibleCityOptions.map((city) => (
            <button
              className={selectedCities.includes(city.city) ? "filter-chip active" : "filter-chip"}
              key={`${city.region}-${city.city}`}
              onClick={() => onToggleCity(city.city)}
              type="button"
            >
              <span>{city.city}</span>
              <small>{city.totalFeedback}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="filter-section">
        <div className="filter-section-title">
          <strong>服务中心</strong>
          <span>{selectedCities.length ? "当前城市" : "可直接选择"}</span>
        </div>
        <div className="service-center-list">
          {visibleServiceCenters.map((center) => (
            <button
              className={
                selectedCenter?.city === center.city && selectedCenter.serviceCenter === center.serviceCenter
                  ? "service-center-row active"
                  : "service-center-row"
              }
              key={`${center.city}-${center.serviceCenter}`}
              onClick={() => onSelectCenter({ city: center.city, serviceCenter: center.serviceCenter })}
              type="button"
            >
              <strong>{center.city} / {center.serviceCenter}</strong>
              <span>{center.totalFeedback} 条</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function isSelectableWorkbenchRegion(region: Region | "未标注"): region is Region {
  return region !== "未标注";
}

function buildAgentThreadSummaries({
  allRecordCount,
  currentKey,
  currentRecordCount,
  projectOptions,
  projectSelection,
  turnsByProject,
}: {
  allRecordCount: number;
  currentKey: string;
  currentRecordCount: number;
  projectOptions: ReturnType<typeof buildProjectOptionsForTimeRange>;
  projectSelection: ProjectSelection;
  turnsByProject: Record<string, AgentConversationTurn[]>;
}): AgentThreadSummary[] {
  const createThread = (key: string, title: string, meta: string): AgentThreadSummary => {
    const turns = turnsByProject[key] ?? [];
    const latestTurn = turns[0];
    return {
      key,
      title,
      meta,
      turnCount: turns.length,
      latestQuestion: latestTurn?.question,
      latestAnswer: latestTurn?.answer,
    };
  };

  const threads = [
    createThread("全部项目", "全部项目", `${allRecordCount} 条反馈 · 当前时间范围`),
    ...projectOptions.map((project) =>
      createThread(project.projectName, project.projectName, `${project.projectType} · ${project.totalFeedback} 条反馈`),
    ),
  ];

  if (!threads.some((thread) => thread.key === currentKey)) {
    const title = buildAgentConversationTitle(projectSelection);
    threads.unshift(createThread(currentKey, title, `${currentRecordCount} 条反馈 · 当前项目组合`));
  }

  return threads;
}

function AgentPanel({
  question,
  conversationTitle,
  conversationTurns,
  isRunning,
  pendingQuestion,
  progressPercent,
  progressSteps,
  selectedThreadKey,
  suggestedQuestions,
  streamingAnswer,
  threadSummaries,
  onQuestionChange,
  onSelectThread,
  onSubmit,
}: {
  question: string;
  conversationTitle: string;
  conversationTurns: AgentConversationTurn[];
  isRunning: boolean;
  pendingQuestion: string;
  progressPercent: number;
  progressSteps: AgentProgressStep[];
  selectedThreadKey: string;
  suggestedQuestions: string[];
  streamingAnswer: string;
  threadSummaries: AgentThreadSummary[];
  onQuestionChange: (value: string) => void;
  onSelectThread: (threadKey: string) => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <section className="agent-panel agent-chat-workspace">
      <AgentThreadList
        selectedThreadKey={selectedThreadKey}
        threads={threadSummaries}
        onSelectThread={onSelectThread}
      />
      <div className="agent-chat-panel">
        <div className="agent-panel-header">
          <div>
            <strong>追问 Agent</strong>
            <span>当前对话：{conversationTitle}</span>
          </div>
          <small>只回答当前数据、指标、报告结论和售后运营闭环相关问题。</small>
        </div>
        <AgentChatTranscript
          conversationTitle={conversationTitle}
          isRunning={isRunning}
          pendingQuestion={pendingQuestion}
          progressPercent={progressPercent}
          progressSteps={progressSteps}
          streamingAnswer={streamingAnswer}
          turns={conversationTurns}
        />
        <div className="agent-composer">
          <div className="agent-composer-note">
            <strong>快捷追问</strong>
            <span>下面只是建议问题。你也可以直接输入任何与当前项目、数据来源、指标、原话证据或报告动作相关的问题。</span>
          </div>
          <div className="agent-suggestion-row" aria-label="基于当前项目生成的建议问题">
            {suggestedQuestions.map((suggestion) => (
              <button className="agent-suggestion" disabled={isRunning} key={suggestion} onClick={() => onQuestionChange(suggestion)} type="button">
                {suggestion}
              </button>
            ))}
          </div>
          <textarea
            disabled={isRunning}
            placeholder={`自由追问 ${conversationTitle}，例如：一共涉及多少个数据来源？`}
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            rows={3}
          />
          <button className="button-primary" type="button" onClick={onSubmit} disabled={isRunning || !question.trim()}>
            <Bot size={16} />
            {isRunning ? "Agent 正在处理" : "发送追问"}
          </button>
        </div>
      </div>
    </section>
  );
}

function AgentProgress({ steps, percent }: { steps: AgentProgressStep[]; percent: number }) {
  const activeStep = steps.find((step) => step.status === "active");
  return (
    <div className="agent-progress is-running">
      <div className="agent-progress-header">
        <strong>Agent 处理进度</strong>
        <span>{activeStep ? activeStep.label : "已完成"}</span>
      </div>
      <div className="agent-progress-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <small>{activeStep?.description}</small>
    </div>
  );
}

function NaturalLanguageAnswer({ content }: { content: string }) {
  return (
    <div className="agent-answer-content">
      {content.split("\n").filter(Boolean).map((paragraph, index) => (
        <p key={`${index}-${paragraph}`}>{paragraph}</p>
      ))}
    </div>
  );
}

function formatAgentTurnMeta(turn: AgentConversationTurn): string {
  const evidenceText = turn.evidenceCount ? `${turn.evidenceCount} 条原话证据` : "无引用原话";
  return `${turn.reportTitle} · ${turn.scenario} · ${evidenceText}`;
}

function AgentThreadList({
  selectedThreadKey,
  threads,
  onSelectThread,
}: {
  selectedThreadKey: string;
  threads: AgentThreadSummary[];
  onSelectThread: (threadKey: string) => void;
}) {
  return (
    <aside className="agent-thread-list" aria-label="项目对话列表">
      <div className="agent-thread-list-header">
        <strong>项目对话</strong>
        <span>{threads.length} 个项目</span>
      </div>
      <div className="agent-thread-items">
        {threads.map((thread) => (
          <button
            className={thread.key === selectedThreadKey ? "agent-thread active" : "agent-thread"}
            key={thread.key}
            onClick={() => onSelectThread(thread.key)}
            type="button"
          >
            <span className="agent-thread-title">{thread.title}</span>
            <span className="agent-thread-meta">{thread.meta}</span>
            <span className="agent-thread-footer">
              <small>{thread.turnCount ? `${thread.turnCount} 轮追问` : "未追问"}</small>
              {thread.latestQuestion ? <small>{thread.latestQuestion}</small> : null}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function AgentChatTranscript({
  conversationTitle,
  isRunning,
  pendingQuestion,
  progressPercent,
  progressSteps,
  streamingAnswer,
  turns,
}: {
  conversationTitle: string;
  isRunning: boolean;
  pendingQuestion: string;
  progressPercent: number;
  progressSteps: AgentProgressStep[];
  streamingAnswer: string;
  turns: AgentConversationTurn[];
}) {
  const orderedTurns = [...turns].reverse();
  const isEmpty = !orderedTurns.length && !isRunning;

  return (
    <div className="agent-transcript" aria-live="polite">
      {isEmpty ? (
        <div className="agent-chat-empty">
          <strong>{conversationTitle}</strong>
          <span>选中这个项目后，可以围绕当前筛选范围连续追问。每轮问答会沉淀在这里，不再展开成报告卡片。</span>
        </div>
      ) : null}
      {orderedTurns.map((turn) => (
        <div className="agent-message-group" key={turn.id}>
          <div className="agent-message user-message">
            <span>你</span>
            <p>{turn.question}</p>
          </div>
          <div className={turn.refused ? "agent-message assistant-message refused" : "agent-message assistant-message"}>
            <span>Agent · {turn.askedAt}</span>
            <NaturalLanguageAnswer content={turn.answer} />
            <small>{formatAgentTurnMeta(turn)}</small>
          </div>
        </div>
      ))}
      {isRunning && pendingQuestion ? (
        <div className="agent-message-group pending">
          <div className="agent-message user-message">
            <span>你</span>
            <p>{pendingQuestion}</p>
          </div>
          {progressSteps.length ? <AgentProgress percent={progressPercent} steps={progressSteps} /> : null}
          {streamingAnswer ? (
            <div className="agent-message assistant-message streaming">
              <span>Agent 正在生成</span>
              <NaturalLanguageAnswer content={streamingAnswer} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatAgentAskedAt(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildScopeLabel(
  startDate: string,
  endDate: string,
  timeGrain: TimeGrain,
  projectSelection: ProjectSelection,
  geoSelection: GeoSelection,
): string {
  const range = normalizeDateRange(startDate, endDate);
  const timeLabel = `${formatTimeGrain(timeGrain)} · ${range.startDate} 至 ${range.endDate}`;
  const projectLabel = formatProjectSelection(projectSelection);
  if (geoSelection.serviceCenter) {
    return `${timeLabel} · ${projectLabel} · ${geoSelection.serviceCenter.city} / ${geoSelection.serviceCenter.serviceCenter}`;
  }
  const regionLabel = geoSelection.regions.length ? `区域：${geoSelection.regions.join("、")}` : "";
  const cityLabel = geoSelection.cities.length ? `城市：${geoSelection.cities.join("、")}` : "";
  const geoLabel = [regionLabel, cityLabel].filter(Boolean).join(" · ");
  return geoLabel ? `${timeLabel} · ${projectLabel} · ${geoLabel}` : `${timeLabel} · ${projectLabel} · 全国`;
}

function formatProjectSelection(selection: ProjectSelection): string {
  if (selection.mode === "all") return "全部项目";
  if (selection.mode === "byType") return `项目类型：${selection.projectTypes.join("、")}`;
  return `项目：${selection.projectNames.join("、")}`;
}

function formatTimeGrain(timeGrain: TimeGrain): string {
  const labels: Record<TimeGrain, string> = {
    day: "日",
    week: "周",
    month: "月",
    quarter: "季度",
    year: "年",
    custom: "自定义",
  };
  return labels[timeGrain];
}

function formatImportStateLabel(status: "loading" | "ready" | "error"): string {
  if (status === "loading") return "正在处理";
  if (status === "ready") return "已导入";
  return "需要处理";
}

function inferRecordDateRange(records: NormalizedFeedback[]) {
  const dates = records.map((record) => record.submittedAt.slice(0, 10)).filter(Boolean).sort();
  return {
    startDate: dates[0] ?? "2026-05-01",
    endDate: dates.at(-1) ?? "2026-05-31",
  };
}
