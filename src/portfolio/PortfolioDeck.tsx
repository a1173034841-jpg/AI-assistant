import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Layers3,
  Route,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import "./portfolio.css";

type PortfolioSlide = {
  id: string;
  eyebrow: string;
  title: string;
  claim: string;
  proof: string[];
  visual: "origin" | "experience" | "pain" | "positioning" | "users" | "systems" | "flow" | "demo" | "boundary" | "value";
};

const portfolioSlides: PortfolioSlide[] = [
  {
    id: "origin",
    eyebrow: "01 / 项目来源",
    title: "从 Tesla 服务现场，到新能源售后洞察产品",
    claim: "我没有从空白处幻想一个 AI 产品，而是从真实服务触点里抽象出一个行业共性问题。",
    proof: ["车主活动、移动服务、NPS、CRM 触达都在制造反馈", "反馈收集不是终点，运营真正需要的是判断、证据和动作", "这个作品集展示的是痛点抽象能力，而不只是界面设计能力"],
    visual: "origin",
  },
  {
    id: "evidence",
    eyebrow: "02 / 经历证据",
    title: "我的经历能解释为什么是这个问题",
    claim: "Tesla 经历提供的是问题现场，不是产品边界；产品边界来自新能源售后运营的共同工作流。",
    proof: ["活动现场能看到用户情绪和服务期待", "移动服务能看到履约、解释和回访断点", "NPS 与 CRM 触达能看到数据和运营动作之间的距离"],
    visual: "experience",
  },
  {
    id: "pain",
    eyebrow: "03 / 行业痛点",
    title: "售后反馈很容易被收集，却很难被用起来",
    claim: "反馈分散在问卷、App、短信和企微里；分数能看到波动，但难解释为什么波动。",
    proof: ["开放反馈难以快速归因", "NPS 下降缺少可追溯证据", "服务中心、区域和项目之间的断点难定位"],
    visual: "pain",
  },
  {
    id: "positioning",
    eyebrow: "04 / 产品定位",
    title: "新能源车主服务体验 AI 洞察助手",
    claim: "它承接问卷和触达结果，把车主原话变成运营能交付的复盘材料。",
    proof: ["输入是标准 CSV / Excel 导出", "输出是可下钻、可复制、可追问的复盘报告", "核心价值是缩短从反馈到行动的距离"],
    visual: "positioning",
  },
  {
    id: "users",
    eyebrow: "05 / 目标用户",
    title: "不是给一个人看的 Dashboard，而是给多个运营角色协作",
    claim: "区域运营、服务运营、品牌口碑团队看到的是同一批反馈，但要交付不同材料。",
    proof: ["区域运营看差异和服务中心表现", "服务运营看低分、待回访和闭环动作", "品牌口碑看正向素材和风险解释"],
    visual: "users",
  },
  {
    id: "systems",
    eyebrow: "06 / 系统边界",
    title: "不替代 CRM、NPS、工单或 CDP",
    claim: "这个产品不是另起一套大平台，而是站在现有系统之上的 AI 洞察层。",
    proof: ["CRM 负责触达和客户关系", "NPS 负责满意度量化", "工单负责处理流转；本工具负责解释、证据和报告"],
    visual: "systems",
  },
  {
    id: "flow",
    eyebrow: "07 / MVP 流程",
    title: "导入反馈 -> 标签归因 -> 情绪分析 -> AI 报告 -> 行动建议",
    claim: "MVP 证明一件事：几百到几千条车主原话，可以被整理成可追溯的运营复盘。",
    proof: ["先做规则标签和字段标准化", "再做证据引用和指标口径说明", "最后通过 AI 问答继续追问当前范围"],
    visual: "flow",
  },
  {
    id: "demo",
    eyebrow: "08 / 原型演示",
    title: "真实可点的工作台，而不是一张概念图",
    claim: "作品集入口讲产品故事，原型入口展示具体交互和信息结构。",
    proof: ["Dashboard 展示当前范围和核心指标", "反馈列表保留原话证据", "报告页输出总复盘、专项报告和行动建议"],
    visual: "demo",
  },
  {
    id: "boundary",
    eyebrow: "09 / AI 边界",
    title: "规则标签 + LLM 分析，不做维修诊断",
    claim: "AI 的作用是辅助归纳和表达，不越权替代售后判断，更不输出车辆安全或维修诊断。",
    proof: ["只处理脱敏反馈和运营文本", "结论必须能回到证据原话", "异常或高风险场景进入人工复核"],
    visual: "boundary",
  },
  {
    id: "value",
    eyebrow: "10 / 面试价值",
    title: "这不是一个页面作品，而是一条产品化能力链",
    claim: "它展示我如何从真实经历发现问题，再抽象成行业产品机会，并落到可演示 MVP。",
    proof: ["真实经验不是故事背景，而是需求来源", "行业抽象避免把项目做窄", "可演示原型证明我能把想法推进到具体形态"],
    visual: "value",
  },
];

const portfolioMetrics = [
  { label: "样本规模", value: "500+", helper: "模拟多渠道反馈" },
  { label: "核心角色", value: "3 类", helper: "区域 / 服务 / 口碑" },
  { label: "输出形态", value: "5 类", helper: "报告、清单、证据、素材、追问" },
  { label: "AI 边界", value: "可追溯", helper: "结论回到原话" },
];

const visualIcons = {
  origin: Sparkles,
  experience: Route,
  pain: ClipboardList,
  positioning: BrainCircuit,
  users: Layers3,
  systems: Database,
  flow: Workflow,
  demo: BarChart3,
  boundary: ShieldCheck,
  value: CheckCircle2,
};

export function PortfolioDeck() {
  return (
    <main className="portfolio-deck" aria-label="AI 产品经理作品集动态演示稿">
      <PortfolioNav />
      <section className="portfolio-hero" id="portfolio-top">
        <div className="portfolio-hero-copy">
          <span>AI Productization Portfolio</span>
          <h1>新能源售后反馈 AI 洞察助手</h1>
          <p>一个把真实服务经验、行业痛点、产品定位和可演示 MVP 串起来的网页式作品集。</p>
          <div className="portfolio-hero-actions">
            <a className="portfolio-primary-link" href="#origin">
              开始演示
              <ArrowRight size={17} />
            </a>
            <a className="portfolio-secondary-link" href="/">
              打开产品原型
            </a>
          </div>
        </div>
        <div className="portfolio-hero-board" aria-label="作品集核心指标">
          {portfolioMetrics.map((metric) => (
            <article className="portfolio-metric-card" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </article>
          ))}
        </div>
      </section>

      {portfolioSlides.map((slide, index) => (
        <PortfolioSlideView index={index} key={slide.id} slide={slide} />
      ))}

      <section className="portfolio-close">
        <div>
          <span>Final CTA</span>
          <h2>把作品集故事讲完，再让面试官点进真实原型</h2>
          <p>这个入口负责 3 分钟产品叙事；原工作台负责展示页面、筛选、报告、证据和 AI 问答能力。</p>
        </div>
        <div className="portfolio-close-actions">
          <a className="portfolio-primary-link" href="/">
            打开产品原型
            <ArrowRight size={17} />
          </a>
          <a className="portfolio-secondary-link" href="/?screen=query">
            查看 AI 问答入口
          </a>
        </div>
      </section>
    </main>
  );
}

function PortfolioNav() {
  return (
    <nav className="portfolio-nav" aria-label="作品集章节导航">
      <a href="#portfolio-top" className="portfolio-brand">
        <span>Portfolio Deck</span>
        <strong>售后洞察 AI 助手</strong>
      </a>
      <div>
        {portfolioSlides.map((slide, index) => (
          <a key={slide.id} href={`#${slide.id}`} aria-label={`跳转到第 ${index + 1} 章：${slide.title}`}>
            {String(index + 1).padStart(2, "0")}
          </a>
        ))}
      </div>
    </nav>
  );
}

function PortfolioSlideView({ slide, index }: { slide: PortfolioSlide; index: number }) {
  const Icon = visualIcons[slide.visual];

  return (
    <section className="portfolio-slide" id={slide.id}>
      <div className="portfolio-slide-copy">
        <span>{slide.eyebrow}</span>
        <h2>{slide.title}</h2>
        <p>{slide.claim}</p>
        <ul>
          {slide.proof.map((item) => (
            <li key={item}>
              <CheckCircle2 size={15} />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className={`portfolio-visual portfolio-visual-${slide.visual}`} aria-hidden="true">
        <div className="portfolio-visual-index">{String(index + 1).padStart(2, "0")}</div>
        <Icon size={46} />
        <PortfolioVisualContent visual={slide.visual} />
      </div>
    </section>
  );
}

function PortfolioVisualContent({ visual }: { visual: PortfolioSlide["visual"] }) {
  if (visual === "flow") {
    return (
      <div className="portfolio-flow-line">
        {["导入", "归因", "情绪", "报告", "行动"].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    );
  }

  if (visual === "demo") {
    return (
      <div className="portfolio-dashboard-mini">
        <div />
        <div />
        <div />
        <FileText size={28} />
      </div>
    );
  }

  if (visual === "systems") {
    return (
      <div className="portfolio-system-stack">
        {["CRM", "NPS", "工单", "CDP", "AI 洞察层"].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    );
  }

  return (
    <div className="portfolio-signal-list">
      <span />
      <span />
      <span />
    </div>
  );
}
