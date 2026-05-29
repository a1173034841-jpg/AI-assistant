import { ArrowRight, BarChart3, Clock3, GitBranch, ShieldCheck, Sparkles } from "lucide-react";
import { surveyTemplateFields } from "../domain/taxonomy";

type SurveyTemplatePreviewProps = {
  onOpenWorkbench: () => void;
};

export function SurveyTemplatePreview({ onOpenWorkbench }: SurveyTemplatePreviewProps) {
  return (
    <section className="survey-layout">
      <div className="intro-panel">
        <p className="eyebrow">给车主填写的问卷</p>
        <h2>少问几道题，把服务问题问清楚</h2>
        <p className="lead">
          问卷仍然放在问卷星、腾讯问卷、App 内问卷或短信链接里。这里不重新造问卷系统，只定义一套字段：
          让车主用最少动作说清楚分数、触点、问题、城市和服务中心，方便后面导出 Excel/CSV 做分析。
        </p>
        <div className="principle-grid">
          <div>
            <Clock3 size={20} />
            <strong>30 秒内能填完</strong>
            <span>评分、服务触点、开放反馈放在前面，减少跳出。</span>
          </div>
          <div>
            <Sparkles size={20} />
            <strong>服务结束后马上发</strong>
            <span>交车、上门服务完成、活动结束后推送链接，记忆还新鲜。</span>
          </div>
          <div>
            <ShieldCheck size={20} />
            <strong>联系信息不强制</strong>
            <span>低分用户可选择授权回访，默认不要求填写手机号。</span>
          </div>
        </div>
        <div className="field-usage-panel">
          <h3>这些字段后面会用在哪里</h3>
          <div>
            <BarChart3 size={18} />
            <span>服务评分和推荐意愿评分用于判断低分、贬损者、推荐者和满意度波动。</span>
          </div>
          <div>
            <GitBranch size={18} />
            <span>城市、服务中心和链接参数用来做区域、城市、网点下钻。</span>
          </div>
          <div>
            <ShieldCheck size={18} />
            <span>授权联系只进入问题闭环，不作为公开报告内容。</span>
          </div>
        </div>
        <button className="primary-action" onClick={onOpenWorkbench}>
          导入问卷结果
          <ArrowRight size={18} />
        </button>
      </div>

      <div className="survey-card">
        <div className="survey-card-header">
          <span>售后服务体验反馈</span>
          <small>字段可复制到第三方问卷平台</small>
        </div>
        <div className="field-list">
          {surveyTemplateFields.map((field) => (
            <div className="field-row" key={field.id}>
              <div>
                <strong>{field.label}</strong>
                <p>{field.helperText}</p>
              </div>
              <span className={field.required ? "required-badge" : "optional-badge"}>
                {field.required ? "必填" : "可选"}
              </span>
            </div>
          ))}
        </div>
        <div className="privacy-note">问卷提示建议：反馈仅用于服务体验改进；如选择愿意被联系，服务团队会进一步核实并处理问题。</div>
      </div>
    </section>
  );
}
