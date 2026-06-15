import type { ReactNode, RefObject } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { shouldRenderScenarioReport } from "../domain/reportDelivery";
import type { MetricDimension, MetricSummary, ScenarioOutput } from "../domain/types";

type ScenarioOutputPanelProps = {
  sectionRef?: RefObject<HTMLElement | null>;
  executiveOutput: ScenarioOutput;
  metrics: MetricSummary;
  output: ScenarioOutput;
  showScenarioOutput: boolean;
  scenarioControl?: ReactNode;
};

export function ScenarioOutputPanel({
  sectionRef,
  executiveOutput,
  metrics,
  output,
  showScenarioOutput,
  scenarioControl,
}: ScenarioOutputPanelProps) {
  async function copyOutput(text: string) {
    await navigator.clipboard?.writeText(text);
  }

  const deliveryMetrics = pickDeliveryMetrics(metrics);
  const dataReviewGroups = buildDataReviewGroups(metrics);

  return (
    <aside className="output-column step-section" ref={sectionRef}>
      <div className="column-header">
        <p className="eyebrow">可交付内容</p>
        <h2>总报告看判断，专项清单看执行</h2>
      </div>
      <div className="delivery-metric-strip" aria-label="报告关键指标">
        {deliveryMetrics.map((metric) => (
          <div key={metric.label}>
            <span>
              {metric.label}
              <button aria-label={`${metric.label}口径说明`} className="metric-help" title={metric.helper} type="button">
                ?
              </button>
            </span>
            <strong>
              {metric.value}
              {metric.unitLabel ? <small>{metric.unitLabel}</small> : null}
            </strong>
          </div>
        ))}
      </div>
      <section className="data-review-panel" aria-label="纯数据复盘">
        <div className="data-review-header">
          <span>纯数据复盘</span>
          <strong>先看结构，再看报告</strong>
        </div>
        <div className="data-review-grid">
          {dataReviewGroups.map((group) => (
            <article key={group.title}>
              <div>
                <strong>{group.title}</strong>
                <span>{group.description}</span>
              </div>
              <div className="data-review-items">
                {group.items.map((item) => (
                  <p key={item.label}>
                    <span>
                      {item.label}
                      <button aria-label={`${item.label}口径说明`} className="metric-help" title={item.helper} type="button">
                        ?
                      </button>
                    </span>
                    <strong>{item.value}</strong>
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      <ReportBlock output={executiveOutput} onCopy={copyOutput} primary />
      {scenarioControl}
      {shouldRenderScenarioReport(showScenarioOutput) ? (
        <ReportBlock output={output} onCopy={copyOutput} />
      ) : (
        <section className="scenario-report-placeholder">
          <strong>分报告暂未生成</strong>
          <span>请在下方“专项交付”中选择服务问题闭环、满意度归因、区域/城市下钻、活动体验复盘或口碑素材与风险，系统会在总报告之后生成对应分报告。</span>
        </section>
      )}
    </aside>
  );
}

function pickDeliveryMetrics(metrics: MetricSummary): MetricDimension[] {
  const labels = ["反馈量", "平均服务评分", "净推荐值", "低分反馈", "待跟进"];
  const byLabel = new Map(metrics.metricDimensions.map((metric) => [metric.label, metric]));
  return labels.map((label) => byLabel.get(label)).filter((metric): metric is MetricDimension => Boolean(metric));
}

function buildDataReviewGroups(metrics: MetricSummary) {
  const metricValue = (label: string) => metrics.metricDimensions.find((metric) => metric.label === label);
  const formatMetric = (label: string) => {
    const metric = metricValue(label);
    return {
      label,
      value: metric ? `${metric.value}${metric.unitLabel}` : "-",
      helper: metric?.helper ?? "当前指标暂无口径说明。",
    };
  };

  return [
    {
      title: "体验结果",
      description: "判断本期体验整体表现。",
      items: [formatMetric("平均服务评分"), formatMetric("净推荐值"), formatMetric("满意率")],
    },
    {
      title: "问题风险",
      description: "判断负向问题是否集中。",
      items: [formatMetric("低分反馈"), formatMetric("负向占比"), formatMetric("口碑风险")],
    },
    {
      title: "闭环处理",
      description: "判断运营要处理多少反馈。",
      items: [formatMetric("待跟进"), formatMetric("联系授权率"), formatMetric("需人工复核")],
    },
    {
      title: "范围覆盖",
      description: "判断报告覆盖是否足够。",
      items: [formatMetric("反馈量"), formatMetric("覆盖城市"), formatMetric("覆盖服务中心")],
    },
  ];
}

function ReportBlock({
  output,
  onCopy,
  primary = false,
}: {
  output: ScenarioOutput;
  onCopy: (text: string) => void;
  primary?: boolean;
}) {
  return (
    <section className={primary ? "report-block primary-report" : "report-block"}>
      <div className={primary ? "output-kind-badge executive" : "output-kind-badge task"}>
        {primary ? <Check size={14} /> : <ClipboardCopy size={14} />}
        {primary ? "总报告：管理层复盘摘要" : output.outputKind === "closure-list" ? "专项清单：服务运营待办" : "专项报告：场景下钻材料"}
      </div>
      <h3>{output.title}</h3>
      <p className="output-summary">{output.executiveSummary}</p>
      <div className="output-sections">
        {output.sections.map((section) => (
          <article className={output.outputKind === "closure-list" ? "closure-task" : ""} key={section.heading}>
            {section.meta ? <span className="task-meta">{section.meta}</span> : null}
            <h3>{section.heading}</h3>
            {output.outputKind === "closure-list" ? (
              <div className="task-lines">
                {section.content.split("\n").map((line) => {
                  const [label, ...rest] = line.split("：");
                  return (
                    <p key={line}>
                      <strong>{label}</strong>
                      <span>{rest.join("：")}</span>
                    </p>
                  );
                })}
              </div>
            ) : (
              <p>{section.content}</p>
            )}
            <details className="evidence-details">
              <summary>{section.evidenceQuoteIds.length} 条原话支撑</summary>
              {section.evidenceQuotes.map((quote) => (
                <blockquote key={`${section.heading}-${quote.feedbackId}`}>
                  {quote.quote}
                  <small>{quote.reasonToUse}</small>
                  <small>
                    服务评分 {quote.scoreSource.rating ?? "-"} / 推荐意愿评分 {quote.scoreSource.npsScore ?? "-"} ·{" "}
                    {quote.scoreSource.location} · {quote.scoreSource.sourceLabel}
                  </small>
                </blockquote>
              ))}
            </details>
          </article>
        ))}
      </div>
      <button className="copy-button button-primary" onClick={() => onCopy(output.copyableText)} type="button">
        <ClipboardCopy size={18} />
        复制{primary ? "总报告" : "分报告"}
      </button>
    </section>
  );
}
