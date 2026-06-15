import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ClipboardCopy, Mail } from "lucide-react";
import {
  buildCoreMetricDashboardCards,
  getAuxiliaryMetricGroups,
  getLinkedFindingsForMetricCard,
  getMetricFindingReason,
} from "../domain/metricDrilldown";
import { createWorkOrderDraftFromInsight, type WorkOrderDraft } from "../domain/workOrder";
import type { AnalysisFinding, FocusRegionInsight, MetricSummary, WorkbenchScenario } from "../domain/types";

type AnalysisWorkspaceProps = {
  sectionRef?: RefObject<HTMLElement | null>;
  findings: AnalysisFinding[];
  scenario: WorkbenchScenario;
  metrics: MetricSummary;
  scopeLabel: string;
  focusInsights: FocusRegionInsight[];
};

export function AnalysisWorkspace({
  sectionRef,
  findings,
  scenario,
  metrics,
  scopeLabel,
  focusInsights,
}: AnalysisWorkspaceProps) {
  const topFinding = findings[0];
  const goodInsights = focusInsights.filter((insight) => insight.tone === "good");
  const riskInsights = focusInsights.filter((insight) => insight.tone === "risk");
  const metricDashboardCards = useMemo(() => buildCoreMetricDashboardCards(metrics), [metrics]);
  const auxiliaryMetricGroups = useMemo(() => getAuxiliaryMetricGroups(metrics), [metrics]);
  const [workOrderDraft, setWorkOrderDraft] = useState<WorkOrderDraft | null>(null);
  const [selectedMetricGroup, setSelectedMetricGroup] = useState("体验表现");
  const workOrderPreviewRef = useRef<HTMLElement | null>(null);
  const selectedMetricCard = metricDashboardCards.find((card) => card.title === selectedMetricGroup) ?? metricDashboardCards[0];
  const linkedFindings = useMemo(
    () => getLinkedFindingsForMetricCard(selectedMetricCard, findings),
    [findings, selectedMetricCard],
  );

  const createWorkOrder = (insight: FocusRegionInsight) => {
    const relatedFinding =
      insight.tone === "good"
        ? findings.find((finding) => finding.sentiment === "正向") ?? topFinding
        : findings.find((finding) => finding.sentiment === "负向") ?? topFinding;
    setWorkOrderDraft(
      createWorkOrderDraftFromInsight({
        insight,
        scopeLabel,
        relatedFinding,
        channel: "email",
      }),
    );
  };

  useEffect(() => {
    if (workOrderDraft) {
      workOrderPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [workOrderDraft]);

  return (
    <section className="analysis-column step-section" ref={sectionRef}>
      <div className="column-header">
        <p className="eyebrow">3. 诊断结论与指标解释</p>
        <h2>{scopeLabel}</h2>
      </div>
      <section className="recommendation-panel">
        <span>优先诊断结论</span>
        <h3>{topFinding ? topFinding.title : "当前范围暂无明确问题"}</h3>
        <p>
          {topFinding
            ? `${topFinding.summary} 建议动作：${topFinding.recommendedAction}`
            : "请调整项目、日期或服务中心范围后再查看建议报告。"}
        </p>
        <small>当前专项：{scenario}</small>
      </section>
      <section className="focus-panel">
        <div className="section-heading">
          <span>区域表现对比</span>
        </div>
        {workOrderDraft ? <WorkOrderDraftPanel draft={workOrderDraft} sectionRef={workOrderPreviewRef} /> : null}
        <FocusInsightGroup title="好区域典型" subtitle="可复制的服务动作和共性" insights={goodInsights} onCreateWorkOrder={createWorkOrder} />
        <FocusInsightGroup title="风险区域典型" subtitle="需要优先回访、督办或复盘的共性" insights={riskInsights} onCreateWorkOrder={createWorkOrder} />
      </section>
      <section className="metric-system-panel">
        <div className="section-heading">
          <span>核心运营指标</span>
          <strong>点击指标后查看对应问题、证据和动作</strong>
        </div>
        <div className="donut-dashboard-grid">
          {metricDashboardCards.map((card) => (
            <button
              className={`donut-card donut-${card.tone} ${selectedMetricCard?.title === card.title ? "active" : ""}`}
              key={card.title}
              onClick={() => setSelectedMetricGroup(card.title)}
              type="button"
            >
              <div
                className="donut-chart"
                style={{ "--donut-angle": `${card.progress * 3.6}deg` } as CSSProperties}
                aria-label={`${card.title} ${card.primaryValue}`}
              >
                <strong>{card.primaryValue}</strong>
                <span>{card.primaryLabel}</span>
              </div>
              <div className="donut-card-body">
                <h3>{card.title}</h3>
                <p>{card.evidenceLabel}</p>
                <small>{card.role}</small>
                <small>{card.helper}</small>
              </div>
            </button>
          ))}
        </div>
        {selectedMetricCard ? (
          <div className="metric-dashboard-detail">
            <div>
              <strong>{selectedMetricCard.title}</strong>
              <span>{selectedMetricCard.description}</span>
            </div>
            <div className="metric-purpose-row">
              <p>
                <span>作用</span>
                <strong>{selectedMetricCard.role}</strong>
              </p>
              <p>
                <span>动作</span>
                <strong>{selectedMetricCard.actionLabel}</strong>
              </p>
            </div>
            <div className="metric-detail-list">
              {selectedMetricCard.metrics.map((metric) => (
                <p key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>
                    {metric.value}
                    {metric.unitLabel}
                  </strong>
                </p>
              ))}
            </div>
          </div>
        ) : null}
        <div className="auxiliary-metric-panel">
          {auxiliaryMetricGroups.map((group) => (
            <article key={group.title}>
              <div>
                <strong>{group.title}</strong>
                <span>{group.description}</span>
              </div>
              <div className="auxiliary-metric-list">
                {group.metrics.map((metric) => (
                  <p key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>
                      {metric.value}
                      {metric.unitLabel}
                    </strong>
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-metric-panel">
        <div className="section-heading">
          <span>指标下钻明细</span>
          <strong>{selectedMetricCard?.title ?? "暂无维度"}</strong>
        </div>
        <div className="metric-strip scenario-metrics">
          {(selectedMetricCard?.metrics ?? []).map((metric) => (
            <div key={metric.label}>
              <em>{metric.typeLabel}</em>
              <span>{metric.label}</span>
              <strong>
                {metric.value}
                {metric.unitLabel ? <small>{metric.unitLabel}</small> : null}
              </strong>
              <details className="metric-source">
                <summary>口径说明</summary>
                <p>{metric.helper}</p>
              </details>
            </div>
          ))}
        </div>
      </section>
      <section className="finding-panel">
        <div className="section-heading">
          <span>{selectedMetricCard?.title ?? "当前指标"} · 对应问题</span>
          <strong>{selectedMetricCard?.diagnosisTitle ?? "支撑总报告与分报告的分析依据"}</strong>
        </div>
        <p className="finding-panel-helper">
          {selectedMetricCard?.diagnosisHelper ??
            "这里不是交付报告。它用于追溯系统为什么得出这些结论：总报告负责整体判断，分报告负责专项交付，诊断依据负责说明每个结论背后的问题、动作和原话来源。"}
        </p>
        {selectedMetricCard?.linkLabels.length ? (
          <div className="finding-linkage-row" aria-label="当前维度挂钩关键项">
            <strong>挂钩关键项</strong>
            <div className="tag-row">
              {selectedMetricCard.linkLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        ) : null}
        <div className="finding-stack">
          {linkedFindings.length ? (
            linkedFindings.map((finding, index) => (
              <article className="finding-card" key={finding.id}>
                <div className="finding-topline">
                  <div>
                    <span className="finding-index">诊断项 {index + 1}</span>
                    <h3>{finding.title}</h3>
                  </div>
                  <div className="badge-row">
                    <span className={`sentiment sentiment-${finding.sentiment}`}>{finding.sentiment}</span>
                    <span className={`severity severity-${finding.severity}`}>{finding.severity}</span>
                  </div>
                </div>
                <div className="finding-diagnosis-grid">
                  <div>
                    <strong>入选原因</strong>
                    <span>{getMetricFindingReason(selectedMetricCard, finding)}</span>
                  </div>
                  <div>
                    <strong>问题判断</strong>
                    <span>{finding.summary}</span>
                  </div>
                  <div>
                    <strong>下一步动作</strong>
                    <span>{finding.recommendedAction}</span>
                  </div>
                </div>
                <div className="finding-tag-line">
                  <strong>涉及标签</strong>
                  <div className="tag-row">
                    {finding.issueTags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="quote-box">
                  <strong>原话依据</strong>
                  {finding.evidenceQuotes.map((quote) => (
                    <blockquote key={`${finding.id}-${quote.feedbackId}`}>
                      {quote.quote}
                      <small>{quote.reasonToUse}</small>
                    </blockquote>
                  ))}
                </div>
                {finding.reviewRequired ? <div className="review-note">信息不足，建议人工复核</div> : null}
              </article>
            ))
          ) : (
            <div className="finding-empty">
              <strong>{selectedMetricCard?.emptyText ?? "当前维度暂无需要展开的问题依据。"}</strong>
              <span>当前指标没有命中可展开的问题样本，可切换时间、项目、地区或服务中心继续查看。</span>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function FocusInsightGroup({
  title,
  subtitle,
  insights,
  onCreateWorkOrder,
}: {
  title: string;
  subtitle: string;
  insights: FocusRegionInsight[];
  onCreateWorkOrder: (insight: FocusRegionInsight) => void;
}) {
  if (!insights.length) {
    return (
      <div className="focus-group-empty">
        <strong>{title}</strong>
        <span>当前范围暂未形成足够典型样本。</span>
      </div>
    );
  }

  return (
    <div className="focus-group">
      <div className="focus-group-title">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="focus-grid">
        {insights.map((insight, index) => (
          <article className={`focus-card focus-${insight.tone}`} key={`${insight.title}-${insight.serviceCenter}`}>
            <span>{insight.title} {index + 1}</span>
            <h3>
              {insight.location} / {insight.serviceCenter}
            </h3>
            <p>{insight.commonPattern}</p>
            <small>
              代表样本 {insight.representativeCount} 条 / 当前范围 {insight.totalFeedback} 条
            </small>
            <div className="next-action">
              <strong>{insight.tone === "good" ? "复用建议" : "整改建议"}</strong>
              <span>{insight.recommendedAction}</span>
            </div>
            <button className="work-order-trigger" type="button" onClick={() => onCreateWorkOrder(insight)}>
              <Mail size={15} />
              生成工单草稿
            </button>
            <details className="evidence-details">
              <summary>查看代表性原话与入选依据</summary>
              <div className="evidence-popover">
                <div className="representative-rule">
                  <strong>代表性判定</strong>
                  <span>优先选择情绪方向一致、命中当前高频服务环节和服务场景、服务评分/推荐意愿评分与结论一致、原话足够具体且可追溯到城市和服务中心的样本。</span>
                </div>
                {insight.evidenceQuotes.map((quote) => (
                  <blockquote key={`${insight.title}-${quote.feedbackId}`}>
                    {quote.quote}
                    <small>{quote.reasonToUse}</small>
                    <small>
                      服务评分 {quote.scoreSource.rating ?? "-"} / 推荐意愿评分 {quote.scoreSource.npsScore ?? "-"} ·{" "}
                      {quote.scoreSource.location}
                    </small>
                  </blockquote>
                ))}
              </div>
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}

function WorkOrderDraftPanel({ draft, sectionRef }: { draft: WorkOrderDraft; sectionRef: RefObject<HTMLElement | null> }) {
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => {
    setCopyStatus("");
  }, [draft.id]);

  const copyDraft = async () => {
    try {
      await navigator.clipboard?.writeText(draft.copyableText);
      setCopyStatus("工单正文已复制");
    } catch {
      setCopyStatus("复制失败，请手动选择下方正文");
    }
  };
  const mailtoUrl = `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.copyableText)}`;

  return (
    <section className="work-order-panel" ref={sectionRef}>
      <div className="section-heading">
        <span>工单草稿预览</span>
        <strong>{draft.subject}</strong>
      </div>
      <div className="work-order-preview-grid">
        <p>
          <span>工单编号</span>
          <strong>{draft.id}</strong>
        </p>
        <p>
          <span>处理对象</span>
          <strong>{draft.city} / {draft.serviceCenter}</strong>
        </p>
        <p>
          <span>统计范围</span>
          <strong>{draft.scopeLabel}</strong>
        </p>
        <p>
          <span>处理要求</span>
          <strong>{draft.suggestedAction}</strong>
        </p>
      </div>
      <p>{draft.issueSummary}</p>
      <pre className="work-order-copy-preview">{draft.copyableText}</pre>
      <div className="work-order-meta">
        <span>当前通道：邮箱</span>
        <span>可替换：飞书 / 企业微信 / 钉钉</span>
        <span>接收方：{draft.recipientHint}</span>
      </div>
      <div className="work-order-evidence">
        {draft.evidence.slice(0, 2).map((item) => (
          <blockquote key={`${item.submittedAt}-${item.quote}`}>
            {item.quote}
            <small>
              {item.submittedAt} · {item.location} · 服务评分 {item.rating ?? "-"} / 推荐意愿评分 {item.recommendationScore ?? "-"}
            </small>
          </blockquote>
        ))}
      </div>
      <div className="work-order-actions">
        <button className="button-secondary" type="button" onClick={copyDraft}>
          <ClipboardCopy size={15} />
          {copyStatus === "工单正文已复制" ? "已复制" : "复制工单正文"}
        </button>
        <a className="button-primary" href={mailtoUrl}>
          <Mail size={15} />
          打开邮件草稿
        </a>
      </div>
      {copyStatus ? <small className="copy-status">{copyStatus}</small> : null}
    </section>
  );
}
