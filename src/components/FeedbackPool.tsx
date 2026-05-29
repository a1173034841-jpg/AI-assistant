import { formatDateLabel } from "../domain/analysisRules";
import type { MetricSummary, NormalizedFeedback, Region, RegionTree } from "../domain/types";

type FeedbackPoolProps = {
  records: NormalizedFeedback[];
  regionTree: RegionTree;
  metrics: MetricSummary;
  scopeLabel: string;
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
};

export function FeedbackPool({
  records,
  regionTree,
  metrics,
  scopeLabel,
  selectedRegions,
  selectedCities,
  selectedCenter,
  onToggleRegion,
  onToggleCity,
  onSelectCenter,
  onClearGeoSelection,
}: FeedbackPoolProps) {
  const centerRecords = selectedCenter
    ? [...records].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).slice(0, 12)
    : [];
  const regionOptions = regionTree
    .filter((item) => isSelectableRegion(item.region))
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
    ? cityOptions.filter((city) => isSelectableRegion(city.region) && selectedRegions.includes(city.region))
    : cityOptions;
  const visibleServiceCenters = cityOptions
    .filter((city) => !selectedCities.length || selectedCities.includes(city.city))
    .flatMap((city) =>
      city.serviceCenters.map((center) => ({
        city: city.city,
        serviceCenter: center.serviceCenter,
        totalFeedback: center.totalFeedback,
      })),
    )
    .slice(0, 10);
  const npsMetric = metrics.metricDimensions.find((item) => item.label === "净推荐值（NPS）");

  return (
    <div className="panel feedback-summary">
      <p className="panel-label">地区范围与原始反馈</p>
      <div className="scope-note">
        <span>当前统计范围</span>
        <strong>{scopeLabel}</strong>
      </div>
      <div className="summary-grid">
        <div>
          <strong>{metrics.totalFeedback}</strong>
          <span>当前反馈</span>
        </div>
        <div>
          <strong>{regionTree.length}</strong>
          <span>覆盖区域</span>
        </div>
        <div>
          <strong>{metrics.followUpCount}</strong>
          <span>待闭环</span>
        </div>
      </div>
      <div className="geo-filter-tools">
        <button type="button" onClick={onClearGeoSelection}>
          全国 / 全部地区
        </button>
        <small>筛选顺序：全国视角、区域多选、城市多选、服务中心下钻。</small>
      </div>
      {!selectedCenter && metrics.riskiestServiceCenter ? (
        <div className="risk-center">
          <span>风险网点提示</span>
          <button
            type="button"
            onClick={() =>
              onSelectCenter({
                city: metrics.riskiestServiceCenter?.city ?? "",
                serviceCenter: metrics.riskiestServiceCenter?.serviceCenter ?? "",
              })
            }
          >
            {metrics.riskiestServiceCenter.city} / {metrics.riskiestServiceCenter.serviceCenter}
          </button>
          <small>{metrics.riskiestServiceCenter.negativeCount} 条负向反馈</small>
        </div>
      ) : null}
      <div className="geo-filter-panel">
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
            <strong>服务中心下钻</strong>
            <span>{selectedCities.length ? "当前城市" : "选择城市后更精准"}</span>
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
      <div className="metric-list">
        <div>平均服务评分 <strong>{metrics.averageRating}</strong></div>
        <div>净推荐值（NPS） <strong>{npsMetric?.value}</strong></div>
        <div>推荐/贬损 <strong>{metrics.promoterCount}/{metrics.detractorCount}</strong></div>
        <div>满意率 <strong>{metrics.satisfactionRate}%</strong></div>
        <div>低分反馈 <strong>{metrics.lowScoreCount}</strong></div>
        <div>负向占比 <strong>{metrics.negativeRate}%</strong></div>
      </div>
      <p className="metric-hint">
        净推荐值（NPS）= 推荐者占比 - 贬损者占比，范围为 -100 到 100；负数表示当前范围内贬损者占比高于推荐者占比，不代表推荐意愿评分出现负分。
      </p>
      {selectedCenter ? (
        <div className="mini-list">
          <div className="mini-list-header">
            <strong>该服务中心原始评论</strong>
            <span>按提交时间倒序</span>
          </div>
          {centerRecords.map((record) => (
            <article key={record.id}>
              <span>
                {formatDateLabel(record.submittedAt)} · {record.city} · {record.serviceCenter}
              </span>
              <p>{record.feedbackText}</p>
              <small>
                服务评分 {record.rating ?? "-"} / 推荐意愿评分 {record.npsScore ?? "-"} · {record.serviceScenario} · {record.sourceLabel}
              </small>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isSelectableRegion(region: Region | "未标注"): region is Region {
  return region !== "未标注";
}
