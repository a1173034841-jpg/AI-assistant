import type { RefObject } from "react";
import { getScenarioMetricDimensions, getScenarioReviewFocus } from "../domain/analysisRules";
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
  const scenarioMetrics = getScenarioMetricDimensions(metrics, scenario);
  const topFinding = findings[0];
  const goodInsights = focusInsights.filter((insight) => insight.tone === "good");
  const riskInsights = focusInsights.filter((insight) => insight.tone === "risk");

  return (
    <section className="analysis-column step-section" ref={sectionRef}>
      <div className="column-header">
        <p className="eyebrow">3. 诊断结论与指标解释</p>
        <h2>{scopeLabel}</h2>
        <p className="column-subtitle">{getScenarioReviewFocus(scenario)}</p>
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
          <strong>提炼好区域与风险区域的典型样本</strong>
        </div>
        <FocusInsightGroup title="好区域典型" subtitle="可复制的服务动作和共性" insights={goodInsights} />
        <FocusInsightGroup title="风险区域典型" subtitle="需要优先回访、督办或复盘的共性" insights={riskInsights} />
      </section>
      <section className="metric-system-panel">
        <div className="section-heading">
          <span>数据分析体系</span>
          <strong>体验结果、问题风险、闭环处理、范围覆盖、数据质量</strong>
        </div>
        <div className="metric-group-stack">
          {metrics.metricGroups.map((group) => (
            <article className="metric-group" key={group.title}>
              <div>
                <h3>{group.title}</h3>
                <p>{group.description}</p>
              </div>
              <div className="metric-strip scenario-metrics">
                {group.metrics.map((metric) => (
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
            </article>
          ))}
        </div>
      </section>
      <section className="scenario-metric-panel">
        <div className="section-heading">
          <span>当前专项重点指标</span>
          <strong>{scenario}</strong>
        </div>
        <div className="metric-strip scenario-metrics">
          {scenarioMetrics.map((metric) => (
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
      <div className="finding-stack">
        {findings.map((finding) => (
          <article className="finding-card" key={finding.id}>
            <div className="finding-topline">
              <h3>{finding.title}</h3>
              <div className="badge-row">
                <span className={`sentiment sentiment-${finding.sentiment}`}>{finding.sentiment}</span>
                <span className={`severity severity-${finding.severity}`}>{finding.severity}</span>
              </div>
            </div>
            <p>{finding.summary}</p>
            <div className="next-action">
              <strong>马上处理</strong>
              <span>{finding.recommendedAction}</span>
            </div>
            <div className="tag-row">
              {finding.issueTags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="quote-box">
              <strong>证据原话</strong>
              {finding.evidenceQuotes.map((quote) => (
                <blockquote key={`${finding.id}-${quote.feedbackId}`}>
                  {quote.quote}
                  <small>{quote.reasonToUse}</small>
                </blockquote>
              ))}
            </div>
            {finding.reviewRequired ? <div className="review-note">信息不足，建议人工复核</div> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function FocusInsightGroup({
  title,
  subtitle,
  insights,
}: {
  title: string;
  subtitle: string;
  insights: FocusRegionInsight[];
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
            <details className="evidence-details">
              <summary>查看代表性原话与入选依据</summary>
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
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}
