import { writeFileSync } from "node:fs";
import { join } from "node:path";

const outputPath = join(process.cwd(), "public", "templates", "after_sales_feedback_test_480.csv");
const header = [
  "项目名称",
  "问卷来源",
  "提交时间",
  "区域",
  "省份",
  "城市",
  "服务中心名称",
  "服务场景",
  "服务评分",
  "推荐意愿评分",
  "开放反馈原话",
  "是否愿意联系",
  "问题是否解决",
  "联系方式",
];

const projects = [
  { name: "A 项目：五一售后服务专项", startDay: 1, endDay: 10 },
  { name: "B 项目：端午服务保障专项", startDay: 15, endDay: 20 },
  { name: "C 项目：夏季补能体验回访", startDay: 21, endDay: 31 },
  { name: "D 项目：6月服务体验常规回访", startDay: 32, endDay: 41 },
];

const cities = [
  { region: "华南", province: "广东", city: "深圳", centers: ["深圳福田服务中心", "深圳南山服务中心", "深圳龙岗服务中心"], baseline: 4.3 },
  { region: "华南", province: "广东", city: "广州", centers: ["广州天河服务中心", "广州番禺服务中心", "广州白云服务中心"], baseline: 3.1 },
  { region: "华东", province: "上海", city: "上海", centers: ["上海闵行服务中心", "上海浦东服务中心", "上海嘉定服务中心"], baseline: 3.8 },
  { region: "华东", province: "浙江", city: "杭州", centers: ["杭州滨江服务中心", "杭州余杭服务中心", "杭州萧山服务中心"], baseline: 4.2 },
  { region: "华北", province: "北京", city: "北京", centers: ["北京朝阳服务中心", "北京亦庄服务中心", "北京海淀服务中心"], baseline: 3.0 },
  { region: "华北", province: "天津", city: "天津", centers: ["天津河西服务中心", "天津滨海服务中心"], baseline: 3.5 },
  { region: "西南", province: "四川", city: "成都", centers: ["成都高新服务中心", "成都武侯服务中心", "成都成华服务中心"], baseline: 4.1 },
  { region: "西南", province: "重庆", city: "重庆", centers: ["重庆渝北服务中心", "重庆南岸服务中心"], baseline: 3.6 },
  { region: "华中", province: "湖北", city: "武汉", centers: ["武汉光谷服务中心", "武汉汉口服务中心", "武汉武昌服务中心"], baseline: 3.4 },
  { region: "西北", province: "陕西", city: "西安", centers: ["西安高新服务中心", "西安曲江服务中心"], baseline: 3.3 },
];

const sources = ["问卷星", "腾讯问卷", "App内问卷", "短信链接", "企微链接"];
const scenarios = ["到店服务", "移动服务", "补能体验", "App/OTA", "活动/社群"];

const textBuckets = {
  positive: {
    到店服务: ["接待主动，维修项目解释清楚，交付时也提醒了后续保养注意事项。", "到店后排队时间短，服务顾问能主动同步进度。", "门店环境整洁，结算前把费用和项目都讲清楚了。"],
    移动服务: ["移动服务按约定时间到达，处理过程很顺畅。", "上门技师沟通清楚，完成后还说明了注意事项。", "移动服务预约确认很快，节省了到店时间。"],
    补能体验: ["补能引导清楚，排队信息比较准确。", "充电车位管理有序，现场人员会主动协调。", "补能体验比上次好，等待时间可接受。"],
    "App/OTA": ["App 预约入口清楚，状态更新及时。", "OTA 提示清楚，升级后功能使用正常。", "线上预约后服务中心很快回电确认。"],
    "活动/社群": ["活动权益说明清楚，现场组织比较有序。", "社群提醒及时，活动后的回访也比较认真。", "活动体验不错，工作人员能主动解答问题。"],
  },
  neutral: {
    到店服务: ["整体服务可以，但等待区信息提醒还可以再清楚一点。", "维修结果解释基本清楚，希望下次能更早同步预计完成时间。"],
    移动服务: ["移动服务完成了，但预约确认时间略长。", "上门处理没有问题，希望到达前提醒更明确。"],
    补能体验: ["补能基本顺利，高峰期排队时间稍长。", "充电体验还可以，但现场指引不够醒目。"],
    "App/OTA": ["App 能完成预约，但状态文案不够直观。", "OTA 升级完成了，希望失败提示更清楚。"],
    "活动/社群": ["活动内容还可以，但权益规则需要再简单一点。", "社群通知及时，但报名确认稍慢。"],
  },
  negative: {
    到店服务: ["到店后等待时间太长，维修进度没有主动同步。", "服务顾问解释不清楚，我问了几次才知道维修项目包含什么。", "交付时没有说明问题原因，体验比较被动。"],
    移动服务: ["移动服务预约后等了两天才确认，沟通回复慢。", "上门时间临时变更，没有提前说明原因。", "移动服务完成后没有同步处理结果。"],
    补能体验: ["充电排队时间比预期长，占位提醒不够清楚。", "补能车位被占用，现场协调效率不高。", "高峰期排队信息不准确，到了才知道要等很久。"],
    "App/OTA": ["App 预约失败后没有明确提示，只能反复提交。", "OTA 升级失败原因不清楚，客服也没有给到明确处理方式。", "App 状态更新慢，服务中心已经处理但页面还显示待确认。"],
    "活动/社群": ["活动权益说明不清楚，到现场才知道限制条件。", "社群回复慢，活动变更没有提前通知。", "活动后没有回访，问题反馈也没有结果。"],
  },
};

function dayToDate(dayIndex) {
  return dayIndex <= 31 ? { month: 5, day: dayIndex } : { month: 6, day: dayIndex - 31 };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreFor(city, scenarioIndex, rowInCity) {
  const scenarioDrag = scenarioIndex === 2 || scenarioIndex === 3 ? -0.35 : scenarioIndex === 4 ? -0.15 : 0;
  const wave = (((rowInCity * 7 + scenarioIndex * 3) % 9) - 4) * 0.18;
  return clamp(Math.round(city.baseline + scenarioDrag + wave), 1, 5);
}

function npsFor(rating, rowIndex) {
  if (rating >= 5) return rowIndex % 3 === 0 ? 10 : 9;
  if (rating === 4) return rowIndex % 4 === 0 ? 9 : 8;
  if (rating === 3) return rowIndex % 3 === 0 ? 8 : 7;
  if (rating === 2) return rowIndex % 2 === 0 ? 5 : 6;
  return rowIndex % 2 === 0 ? 3 : 4;
}

function feedbackText(rating, scenario, seed) {
  const bucket = rating >= 4 ? textBuckets.positive[scenario] : rating === 3 ? textBuckets.neutral[scenario] : textBuckets.negative[scenario];
  return bucket[seed % bucket.length];
}

function consentFor(rating, seed) {
  if (rating <= 2) return seed % 4 === 0 ? "未询问" : "是";
  if (rating === 3) return seed % 3 === 0 ? "是" : "未询问";
  return seed % 5 === 0 ? "是" : "否";
}

function resolvedFor(rating, seed) {
  if (rating <= 2) return seed % 3 === 0 ? "是" : "否";
  if (rating === 3) return seed % 2 === 0 ? "是" : "否";
  return "是";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const rows = [header];
let id = 1;

for (const city of cities) {
  for (let rowInCity = 0; rowInCity < 48; rowInCity += 1) {
    const project = projects[rowInCity % projects.length];
    const source = sources[(rowInCity + city.city.length) % sources.length];
    const scenario = scenarios[(rowInCity + city.centers.length) % scenarios.length];
    const scenarioIndex = scenarios.indexOf(scenario);
    const center = city.centers[rowInCity % city.centers.length];
    const daySpan = project.endDay - project.startDay + 1;
    const dayIndex = project.startDay + ((rowInCity * 3 + city.city.length) % daySpan);
    const { month, day } = dayToDate(dayIndex);
    const hour = 9 + ((rowInCity * 5 + city.city.length) % 10);
    const minute = (rowInCity * 11 + city.city.charCodeAt(0)) % 60;
    const submittedAt = `2026-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
    const rating = scoreFor(city, scenarioIndex, rowInCity);
    const recommendationScore = npsFor(rating, rowInCity);
    const consent = consentFor(rating, rowInCity);

    rows.push([
      project.name,
      source,
      submittedAt,
      city.region,
      city.province,
      city.city,
      center,
      scenario,
      rating,
      recommendationScore,
      feedbackText(rating, scenario, rowInCity + city.city.length),
      consent,
      resolvedFor(rating, rowInCity),
      consent === "是" ? `已脱敏-${String(id).padStart(4, "0")}` : "",
    ]);
    id += 1;
  }
}

const csv = `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
writeFileSync(outputPath, `\uFEFF${csv}`, "utf8");
