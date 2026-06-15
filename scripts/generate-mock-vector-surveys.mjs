import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outputDir = join(process.cwd(), "data", "mock-vector-surveys");
const mockBatchId = "mock-after-sales-v1";
const mockSchemaVersion = "2026-06-09";

mkdirSync(outputDir, { recursive: true });

const platforms = [
  ...Array(9).fill("问卷星"),
  ...Array(7).fill("腾讯问卷"),
  ...Array(2).fill("App内问卷"),
  "短信链接",
  "企微链接",
];

const sourceChannels = ["App", "短信链接", "企微", "小程序", "服务顾问代录"];
const devices = ["微信内置浏览器", "iOS", "Android", "PC"];

const issueTagsByStage = {
  服务发起: ["App预约", "移动服务", "服务等待"],
  服务接待: ["服务解释", "沟通效率", "服务态度"],
  服务质量: ["维修结果", "交付体验", "问题复发"],
  补能体验: ["充电排队", "费用理解", "补能效率"],
  软件与智能化: ["App使用", "OTA理解", "功能误解"],
  用户运营: ["活动体验", "权益感知", "社群反馈"],
};

const domainDictionary = [
  "预约",
  "App预约",
  "排队",
  "等待",
  "远程诊断",
  "移动服务",
  "接待",
  "解释不清",
  "态度",
  "沟通",
  "回复慢",
  "维修结果",
  "没修好",
  "复发",
  "配件",
  "交付",
  "保养",
  "充电",
  "占位费",
  "超充",
  "费用",
  "OTA",
  "App",
  "辅助驾驶",
  "蓝牙",
  "活动",
  "权益",
  "社群",
  "礼品",
  "车主课堂",
  "回访",
  "授权联系",
  "服务中心",
  "服务顾问",
  "进度同步",
  "口碑风险",
  "人工复核",
];

const cities = [
  { region: "华南", province: "广东", city: "深圳", platePrefix: "粤B", centers: ["深圳南山服务中心", "深圳福田服务中心"] },
  { region: "华南", province: "广东", city: "广州", platePrefix: "粤A", centers: ["广州天河服务中心", "广州番禺服务中心"] },
  { region: "华南", province: "广东", city: "东莞", platePrefix: "粤S", centers: ["东莞松山湖服务中心", "东莞南城服务中心"] },
  { region: "华东", province: "上海", city: "上海", platePrefix: "沪A", centers: ["上海闵行服务中心", "上海浦东服务中心"] },
  { region: "华东", province: "浙江", city: "杭州", platePrefix: "浙A", centers: ["杭州滨江服务中心", "杭州余杭服务中心"] },
  { region: "华东", province: "江苏", city: "南京", platePrefix: "苏A", centers: ["南京江宁服务中心", "南京建邺服务中心"] },
  { region: "华东", province: "江苏", city: "苏州", platePrefix: "苏E", centers: ["苏州工业园服务中心", "苏州吴中服务中心"] },
  { region: "华北", province: "北京", city: "北京", platePrefix: "京N", centers: ["北京朝阳服务中心", "北京亦庄服务中心"] },
  { region: "华北", province: "天津", city: "天津", platePrefix: "津B", centers: ["天津滨海服务中心", "天津河西服务中心"] },
  { region: "华北", province: "山东", city: "济南", platePrefix: "鲁A", centers: ["济南历下服务中心", "济南高新服务中心"] },
  { region: "华北", province: "山东", city: "青岛", platePrefix: "鲁B", centers: ["青岛崂山服务中心", "青岛市北服务中心"] },
  { region: "西南", province: "四川", city: "成都", platePrefix: "川A", centers: ["成都高新服务中心", "成都金牛服务中心"] },
  { region: "西南", province: "重庆", city: "重庆", platePrefix: "渝A", centers: ["重庆渝北服务中心", "重庆南岸服务中心"] },
  { region: "西南", province: "云南", city: "昆明", platePrefix: "云A", centers: ["昆明盘龙服务中心", "昆明呈贡服务中心"] },
  { region: "华中", province: "湖北", city: "武汉", platePrefix: "鄂A", centers: ["武汉光谷服务中心", "武汉汉口服务中心"] },
  { region: "华中", province: "湖南", city: "长沙", platePrefix: "湘A", centers: ["长沙岳麓服务中心", "长沙雨花服务中心"] },
  { region: "华中", province: "河南", city: "郑州", platePrefix: "豫A", centers: ["郑州郑东服务中心", "郑州高新服务中心"] },
  { region: "西北", province: "陕西", city: "西安", platePrefix: "陕A", centers: ["西安高新服务中心", "西安曲江服务中心"] },
  { region: "西北", province: "甘肃", city: "兰州", platePrefix: "甘A", centers: ["兰州城关服务中心", "兰州新区服务中心"] },
  { region: "东北", province: "辽宁", city: "沈阳", platePrefix: "辽A", centers: ["沈阳浑南服务中心", "沈阳铁西服务中心"] },
  { region: "东北", province: "辽宁", city: "大连", platePrefix: "辽B", centers: ["大连高新服务中心", "大连甘井子服务中心"] },
];

const surveyDirections = [
  {
    key: "quality_warranty",
    label: "质量维保型",
    surveyName: "质量维保型售后回访问卷",
    questionCount: 21,
    accountPrefix: "wjx",
    projects: ["春季保养回访", "维修质量专项复盘", "问题复发闭环回访"],
    projectType: "质量维保复盘",
    scenarios: ["到店服务", "移动服务"],
    stages: ["服务质量", "服务接待", "服务发起"],
    feedback: {
      正向: [
        "维修项目解释清楚，交付时也提醒了后续保养注意事项，整体比较放心。",
        "保养完成后车辆状态正常，服务顾问把检查结果讲得很清楚。",
        "上门检查准时到达，处理过程专业，结束后还说明了后续观察点。",
      ],
      中性: [
        "维修结果基本可以，但希望交付前能更早同步预计完成时间。",
        "保养流程完成了，费用说明还算清楚，但等待配件的信息可以更及时。",
        "问题暂时解决，后续还要再观察是否复发。",
      ],
      负向: [
        "同一个问题处理后又复发了，第二次到店还是没有彻底解决。",
        "配件等待时间比承诺久，期间没有主动同步进度。",
        "交付时没有说明故障原因和处理结果，我不清楚到底修了什么。",
      ],
    },
  },
  {
    key: "satisfaction_nps",
    label: "满意度/NPS型",
    surveyName: "满意度与NPS售后回访问卷",
    questionCount: 19,
    accountPrefix: "txwj",
    projects: ["月度满意度回访", "区域服务体验追踪", "服务口碑NPS复盘"],
    projectType: "满意度追踪",
    scenarios: ["到店服务", "移动服务", "补能体验", "App/OTA", "活动/社群"],
    stages: ["服务发起", "服务接待", "服务质量", "补能体验", "软件与智能化", "用户运营"],
    feedback: {
      正向: [
        "整体体验比上次好，接待主动，问题解释清楚，所以愿意推荐。",
        "服务中心响应很快，过程透明，最后结果也符合预期。",
        "这次从预约到交付都比较顺，工作人员态度也很好。",
      ],
      中性: [
        "整体还可以，但有些流程提醒不够清楚，所以推荐意愿一般。",
        "服务结果没问题，等待时间略长，体验没有明显惊喜。",
        "满意度中等，主要是沟通效率还有提升空间。",
      ],
      负向: [
        "这次体验低于预期，等待时间长，问题解释也不够清楚。",
        "推荐意愿不高，主要因为服务结果和沟通都没有让我放心。",
        "服务中心回复慢，问题没有一次讲明白，我不太愿意推荐。",
      ],
    },
  },
  {
    key: "service_process",
    label: "服务流程体验型",
    surveyName: "服务流程体验售后回访问卷",
    questionCount: 22,
    accountPrefix: "app",
    projects: ["到店流程体验复盘", "移动服务流程回访", "端午服务保障复盘"],
    projectType: "服务流程复盘",
    scenarios: ["到店服务", "移动服务"],
    stages: ["服务发起", "服务接待"],
    feedback: {
      正向: [
        "预约后确认很快，到店有人及时接待，进度同步也比较主动。",
        "移动服务按约定时间到达，整个流程很顺，不用反复催。",
        "取车交付很顺畅，服务顾问把后续注意事项说清楚了。",
      ],
      中性: [
        "流程基本顺畅，但到店后等待区的进度提醒还可以更清楚。",
        "预约能完成，不过确认时间稍微有点长。",
        "服务顾问态度可以，希望下次能提前说明预计等待时间。",
      ],
      负向: [
        "到店后等待时间太长，期间没人主动告诉我还要等多久。",
        "预约时间改了两次，前后说法不一致，影响安排。",
        "服务过程中进度反馈少，我需要自己反复去问。",
      ],
    },
  },
  {
    key: "digital_energy",
    label: "补能/App/智能化体验型",
    surveyName: "补能App智能化体验问卷",
    questionCount: 20,
    accountPrefix: "app",
    projects: ["夏季补能体验回访", "App预约体验复盘", "OTA功能理解回访"],
    projectType: "数字化触点复盘",
    scenarios: ["补能体验", "App/OTA"],
    stages: ["补能体验", "软件与智能化", "服务发起"],
    feedback: {
      正向: [
        "App预约入口清楚，状态更新及时，服务中心也很快确认。",
        "补能站点指引比较清楚，现场人员能主动协调排队。",
        "OTA提示内容比较明确，升级后功能使用正常。",
      ],
      中性: [
        "App能完成预约，但状态文案不够直观，需要自己理解。",
        "补能基本顺利，高峰期排队时间稍长。",
        "OTA升级完成了，希望失败提示和处理方式更清楚。",
      ],
      负向: [
        "App预约失败后没有明确提示，只能反复提交。",
        "充电排队信息不准确，到现场才知道要等很久。",
        "OTA失败原因不清楚，客服也没有给到明确处理方式。",
      ],
    },
  },
  {
    key: "user_operation",
    label: "活动/用户运营与口碑风险型",
    surveyName: "活动用户运营与口碑风险问卷",
    questionCount: 21,
    accountPrefix: "wecom",
    projects: ["端午车主活动反馈", "车主社群权益回访", "用户运营口碑素材复盘"],
    projectType: "用户运营活动",
    scenarios: ["活动/社群"],
    stages: ["用户运营", "服务接待"],
    feedback: {
      正向: [
        "活动组织有序，权益说明清楚，工作人员能主动解答问题。",
        "社群提醒及时，车主课堂内容有价值，愿意继续参加。",
        "礼品和权益兑现符合预期，现场体验比预想更好。",
      ],
      中性: [
        "活动内容还可以，但规则说明有点复杂，希望下次更简单。",
        "社群通知及时，报名确认稍慢，整体体验一般。",
        "权益兑现没有问题，但现场动线可以更清楚。",
      ],
      负向: [
        "活动权益说明不清楚，到现场才知道有限制条件。",
        "报名成功后通知太晚，差点错过集合时间。",
        "社群回复慢，活动变更没有提前通知，容易产生误解。",
      ],
    },
  },
];

const rawCommonHeaders = [
  "提交序号",
  "答卷ID",
  "平台来源",
  "问卷名称",
  "项目名称",
  "来源渠道",
  "提交时间",
  "答题时长",
  "提交设备",
  "IP属地/城市",
  "用户账号",
  "手机号",
  "车牌号",
  "VIN",
  "是否模拟数据",
  "模拟数据批次",
  "问卷方向",
  "题目数量",
  "服务城市",
  "服务中心",
  "服务场景",
  "总体评分",
  "推荐意愿评分",
  "问题是否解决",
  "是否愿意被联系",
  "一句话反馈",
  "匿名分析授权",
];

const directionHeaders = [
  "维保服务类型",
  "问题描述是否准确记录",
  "维修方案解释评分",
  "是否按承诺时间完成",
  "是否出现配件等待",
  "交付结果说明评分",
  "问题是否复发",
  "复发或未解决描述",
  "维保结果满意度",
  "费用或保修说明评分",
  "是否出现新增损伤或遗漏",
  "风险事件描述",
  "维保最需改进环节",
  "是否需要进一步回访",
  "是否愿意留下正向评价",
  "正向评价原因",
  "满意度主要影响因素",
  "最满意环节",
  "最不满意环节",
  "服务人员态度评分",
  "服务响应速度评分",
  "服务结果信任评分",
  "是否比上次更好",
  "体验变化原因",
  "是否愿意继续选择该服务中心",
  "优先改进建议",
  "服务需求发起方式",
  "预约过程评分",
  "预约时间是否符合预期",
  "到店或上门提醒是否清晰",
  "是否及时接待",
  "等待时间评分",
  "是否说明流程和预计耗时",
  "是否及时获得进度反馈",
  "流程问题类型",
  "等待或沟通问题描述",
  "取车或服务结束交付评分",
  "是否说明后续注意事项",
  "最浪费时间环节",
  "是否需要改进流程",
  "是否有值得表扬细节",
  "表扬细节描述",
  "数字化或补能体验类型",
  "App预约或提交评分",
  "App消息提醒评分",
  "App问题类型",
  "App问题描述",
  "OTA或软件说明评分",
  "是否存在智能化误解",
  "智能化误解描述",
  "补能站点可用性评分",
  "补能问题类型",
  "补能问题描述",
  "远程诊断是否解决",
  "最需改进数字化触点",
  "是否影响智能化信任",
  "用户运营触达类型",
  "活动或权益了解渠道",
  "活动权益规则说明评分",
  "活动报名签到流程评分",
  "工作人员响应评分",
  "活动或社群内容价值评分",
  "礼品权益是否符合预期",
  "权益不符描述",
  "是否增强品牌好感",
  "是否有主动分享素材",
  "可分享素材描述",
  "是否存在投诉或负面传播风险",
  "口碑风险描述",
  "后续活动优先改进项",
  "是否愿意继续参加活动",
];

const rawHeaders = [...rawCommonHeaders, ...directionHeaders];

const normalizedHeaders = [
  "feedback_id",
  "answer_id",
  "submitted_at",
  "platform",
  "source_name",
  "source_channel",
  "survey_direction",
  "question_count",
  "project_name",
  "project_type",
  "region",
  "province",
  "city",
  "service_center",
  "service_scenario",
  "service_stage",
  "rating",
  "nps_score",
  "sentiment",
  "severity",
  "issue_tags",
  "feedback_text",
  "contact_consent",
  "issue_resolved",
  "review_required",
  "mock_user_id",
  "phone_masked",
  "vehicle_plate_mock",
  "vin_mock",
  "answer_duration_seconds",
  "submitted_device",
  "is_synthetic",
  "mock_batch_id",
  "mock_schema_version",
  "pii_scan_status",
];

function pad(value, length) {
  return String(value).padStart(length, "0");
}

function pick(items, seed) {
  return items[seed % items.length];
}

function sentimentFor(localIndex) {
  const slot = localIndex % 20;
  if (slot < 9) return "负向";
  if (slot < 15) return "正向";
  return "中性";
}

function ratingFor(sentiment, seed) {
  if (sentiment === "正向") return seed % 3 === 0 ? 5 : 4;
  if (sentiment === "中性") return 3;
  return seed % 10 < 7 ? 2 : 1;
}

function npsFor(rating, seed) {
  if (rating >= 5) return seed % 2 === 0 ? 10 : 9;
  if (rating === 4) return seed % 3 === 0 ? 9 : 8;
  if (rating === 3) return seed % 2 === 0 ? 8 : 7;
  if (rating === 2) return seed % 2 === 0 ? 6 : 5;
  return seed % 2 === 0 ? 4 : 3;
}

function severityFor(sentiment, rating, reviewRequired) {
  if (reviewRequired || rating <= 1) return "高";
  if (sentiment === "负向" || rating <= 2) return "中";
  return "低";
}

function contactConsentFor(sentiment, rating, seed) {
  if (rating <= 2 && seed % 3 === 0) return "已授权联系";
  if (sentiment === "中性" && seed % 8 === 0) return "已授权联系";
  if (sentiment === "正向" && seed % 15 === 0) return "已授权联系";
  return seed % 5 === 0 ? "未询问" : "拒绝联系";
}

function issueResolvedFor(sentiment, rating, seed) {
  if (rating <= 2) return seed % 4 === 0 ? "是" : "否";
  if (sentiment === "中性") return seed % 3 === 0 ? "不确定" : "是";
  return "是";
}

function dateFor(globalIndex) {
  const dayOffset = (globalIndex * 3) % 45;
  const base = new Date(Date.UTC(2026, 4, 1, 1, 0, 0));
  base.setUTCDate(base.getUTCDate() + dayOffset);
  const hour = 9 + ((globalIndex * 7) % 10);
  const minute = (globalIndex * 13) % 60;
  return `2026-${pad(base.getUTCMonth() + 1, 2)}-${pad(base.getUTCDate(), 2)} ${pad(hour, 2)}:${pad(minute, 2)}:00`;
}

function toIsoChina(value) {
  return `${value.replace(" ", "T")}+08:00`;
}

function mockPhone(globalIndex) {
  const prefixes = ["138", "139", "136", "135", "188", "177"];
  return `${pick(prefixes, globalIndex)}****${pad(globalIndex, 4).slice(-4)}`;
}

function mockPlate(city, globalIndex) {
  const suffix = globalIndex % 4 === 0 ? `DM${pad(globalIndex, 4).slice(-4)}` : `MK${pad(globalIndex, 3).slice(-3)}`;
  return `${city.platePrefix}-${suffix}`;
}

function mockVin(globalIndex) {
  return `LFAKE${pad(globalIndex, 12)}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(fileName, headers, rows) {
  const csv = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  writeFileSync(join(outputDir, fileName), `\uFEFF${csv}\n`, "utf8");
}

function scoreText(rating) {
  if (rating >= 4) return "符合预期";
  if (rating === 3) return "基本可以";
  return "低于预期";
}

function issueTagsFor(stage, seed) {
  const tags = issueTagsByStage[stage];
  const first = pick(tags, seed);
  const second = pick(tags, seed + 1);
  return first === second ? [first] : [first, second];
}

function buildFeedback(direction, sentiment, city, center, stage, issueTags, seed) {
  const base = pick(direction.feedback[sentiment], seed);
  const issueHint = sentiment === "负向" ? `主要集中在${issueTags.join("、")}。` : sentiment === "正向" ? `值得复用的点是${issueTags[0]}。` : `后续可继续观察${issueTags[0]}。`;
  const timeHint = pick(["工作日上午", "工作日下午", "周末上午", "周末傍晚", "节前高峰", "雨天到店", "下班后", "午休时段", "活动结束后"], seed);
  const userNeed = pick(["希望提前同步进度", "希望解释更直接", "希望减少等待", "希望结果更可追溯", "希望线上状态更准确", "希望后续有人回访", "希望服务口径一致"], seed * 3);
  const followHint = pick(["这次我在", "本次发生在", "这次体验来自", "我反馈的是", "本次样本对应"], seed * 5);
  const detailHint = pick(
    [
      "我主要关注首次响应。",
      "我主要关注交付前说明。",
      "我主要关注线上状态同步。",
      "我主要关注现场等待安排。",
      "我主要关注后续闭环动作。",
      "我主要关注服务顾问口径。",
      "我主要关注预约变更提醒。",
      "我主要关注费用和权益解释。",
      "我主要关注问题复核安排。",
      "我主要关注跨渠道信息一致性。",
    ],
    seed * 11,
  );
  return `${base}${issueHint}${followHint}${city.city}${center}，时间是${timeHint}，${userNeed}。${detailHint}样本号 MOCK-${pad(seed, 4)}。`;
}

function emptyRawRow() {
  return Object.fromEntries(rawHeaders.map((header) => [header, ""]));
}

function baseRawRow({ globalIndex, localIndex, direction, platform, city, center, scenario, rating, npsScore, submittedAt, sourceChannel, device, mockUserId, phone, plate, vin, sentiment, feedbackText, issueResolved, contactConsent }) {
  return {
    ...emptyRawRow(),
    提交序号: String(globalIndex),
    答卷ID: `${direction.accountPrefix}_ans_${pad(globalIndex, 6)}`,
    平台来源: platform,
    问卷名称: direction.surveyName,
    项目名称: pick(direction.projects, localIndex),
    来源渠道: sourceChannel,
    提交时间: submittedAt,
    答题时长: `${60 + ((globalIndex * 17) % 240)}秒`,
    提交设备: device,
    "IP属地/城市": city.city,
    用户账号: mockUserId,
    手机号: phone,
    车牌号: plate,
    VIN: vin,
    是否模拟数据: "是",
    模拟数据批次: mockBatchId,
    问卷方向: direction.label,
    题目数量: direction.questionCount,
    服务城市: city.city,
    服务中心: center,
    服务场景: scenario,
    总体评分: rating,
    推荐意愿评分: npsScore,
    问题是否解决: issueResolved,
    是否愿意被联系: contactConsent,
    一句话反馈: feedbackText,
    匿名分析授权: "是",
    满意度主要影响因素: sentiment === "负向" ? "等待时间/解释不清/处理结果" : "服务态度/响应速度/结果可信",
  };
}

function fillDirectionAnswers(row, { direction, sentiment, rating, stage, issueTags, feedbackText, issueResolved, seed }) {
  if (direction.key === "quality_warranty") {
    row.维保服务类型 = pick(["常规保养", "故障维修", "返修复查", "上门检测"], seed);
    row.问题描述是否准确记录 = rating >= 4 ? "是" : "否";
    row.维修方案解释评分 = rating;
    row.是否按承诺时间完成 = rating >= 3 ? "是" : "否";
    row.是否出现配件等待 = rating <= 2 && seed % 2 === 0 ? "是" : "否";
    row.交付结果说明评分 = rating;
    row.问题是否复发 = rating <= 2 && seed % 3 !== 0 ? "是" : "否";
    row["复发或未解决描述"] = rating <= 2 ? feedbackText : "";
    row.维保结果满意度 = scoreText(rating);
    row["费用或保修说明评分"] = Math.max(1, Math.min(5, rating + (seed % 2)));
    row.是否出现新增损伤或遗漏 = rating <= 1 ? "需复核" : "否";
    row.风险事件描述 = rating <= 1 ? "模拟高风险样本，需人工复核是否存在交付遗漏。" : "";
    row.维保最需改进环节 = issueTags.join("、");
    row.是否需要进一步回访 = rating <= 2 ? "是" : "否";
    row.是否愿意留下正向评价 = sentiment === "正向" ? "是" : "否";
    row.正向评价原因 = sentiment === "正向" ? feedbackText : "";
  }

  if (direction.key === "satisfaction_nps") {
    row.最满意环节 = sentiment === "负向" ? "暂无明显满意环节" : pick(["响应速度", "服务态度", "维修结果", "交付说明"], seed);
    row.最不满意环节 = sentiment === "正向" ? "暂无明显不满意环节" : issueTags.join("、");
    row.服务人员态度评分 = Math.max(1, rating);
    row.服务响应速度评分 = Math.max(1, rating - (sentiment === "负向" ? 1 : 0));
    row.服务结果信任评分 = rating;
    row.是否比上次更好 = sentiment === "正向" ? "是" : sentiment === "中性" ? "差不多" : "否";
    row.体验变化原因 = feedbackText;
    row.是否愿意继续选择该服务中心 = rating >= 4 ? "是" : rating === 3 ? "不确定" : "否";
    row.优先改进建议 = sentiment === "负向" ? `优先改进${issueTags[0]}` : "保持当前服务稳定性";
  }

  if (direction.key === "service_process") {
    row.服务需求发起方式 = pick(["App预约", "电话预约", "企微联系", "服务顾问代约"], seed);
    row.预约过程评分 = rating;
    row.预约时间是否符合预期 = rating >= 3 ? "是" : "否";
    row.到店或上门提醒是否清晰 = rating >= 4 ? "清晰" : "不够清晰";
    row.是否及时接待 = rating >= 3 ? "是" : "否";
    row.等待时间评分 = Math.max(1, rating - (sentiment === "负向" ? 1 : 0));
    row.是否说明流程和预计耗时 = rating >= 4 ? "是" : "否";
    row.是否及时获得进度反馈 = rating >= 3 ? "是" : "否";
    row.流程问题类型 = sentiment === "负向" ? issueTags.join("、") : "暂无明显流程问题";
    row.等待或沟通问题描述 = sentiment === "负向" ? feedbackText : "";
    row.取车或服务结束交付评分 = rating;
    row.是否说明后续注意事项 = rating >= 4 ? "是" : "否";
    row.最浪费时间环节 = sentiment === "负向" ? pick(["预约确认", "到店等待", "维修进度沟通", "交付说明"], seed) : "无明显浪费";
    row.是否需要改进流程 = sentiment === "负向" ? "是" : "否";
    row.是否有值得表扬细节 = sentiment === "正向" ? "是" : "否";
    row.表扬细节描述 = sentiment === "正向" ? feedbackText : "";
  }

  if (direction.key === "digital_energy") {
    row.数字化或补能体验类型 = stage === "补能体验" ? "补能体验" : pick(["App预约", "OTA升级", "智能功能", "远程诊断"], seed);
    row.App预约或提交评分 = stage === "补能体验" ? "" : rating;
    row.App消息提醒评分 = stage === "补能体验" ? "" : Math.max(1, rating - (sentiment === "负向" ? 1 : 0));
    row.App问题类型 = stage === "软件与智能化" && sentiment === "负向" ? issueTags.join("、") : "";
    row.App问题描述 = stage === "软件与智能化" && sentiment !== "正向" ? feedbackText : "";
    row.OTA或软件说明评分 = stage === "软件与智能化" ? rating : "";
    row.是否存在智能化误解 = stage === "软件与智能化" && sentiment === "负向" ? "是" : "否";
    row.智能化误解描述 = stage === "软件与智能化" && sentiment === "负向" ? feedbackText : "";
    row.补能站点可用性评分 = stage === "补能体验" ? rating : "";
    row.补能问题类型 = stage === "补能体验" && sentiment === "负向" ? issueTags.join("、") : "";
    row.补能问题描述 = stage === "补能体验" && sentiment !== "正向" ? feedbackText : "";
    row.远程诊断是否解决 = issueResolved;
    row.最需改进数字化触点 = pick(["App预约", "消息提醒", "OTA说明", "补能排队", "远程诊断"], seed);
    row.是否影响智能化信任 = rating <= 2 ? "是" : "否";
  }

  if (direction.key === "user_operation") {
    row.用户运营触达类型 = pick(["车主活动", "社群通知", "权益回访", "车主课堂"], seed);
    row.活动或权益了解渠道 = pick(["企微", "App", "服务中心海报", "短信链接", "社群"], seed);
    row.活动权益规则说明评分 = rating;
    row.活动报名签到流程评分 = Math.max(1, rating - (sentiment === "负向" ? 1 : 0));
    row.工作人员响应评分 = rating;
    row.活动或社群内容价值评分 = rating;
    row.礼品权益是否符合预期 = rating >= 3 ? "是" : "否";
    row.权益不符描述 = rating <= 2 ? feedbackText : "";
    row.是否增强品牌好感 = sentiment === "正向" ? "是" : sentiment === "中性" ? "一般" : "否";
    row.是否有主动分享素材 = sentiment === "正向" ? "是" : "否";
    row.可分享素材描述 = sentiment === "正向" ? feedbackText : "";
    row.是否存在投诉或负面传播风险 = sentiment === "负向" && seed % 2 === 0 ? "是" : "否";
    row.口碑风险描述 = sentiment === "负向" ? feedbackText : "";
    row.后续活动优先改进项 = sentiment === "负向" ? issueTags.join("、") : "保持活动组织和权益说明清晰";
    row.是否愿意继续参加活动 = rating >= 4 ? "是" : rating === 3 ? "不确定" : "否";
  }
}

function chunkRecord(record, chunkType, text) {
  return {
    chunk_id: `${record.feedback_id}_${chunkType}`,
    feedback_id: record.feedback_id,
    chunk_type: chunkType,
    survey_direction: record.survey_direction,
    project_name: record.project_name,
    submitted_at: record.submitted_at,
    region: record.region,
    city: record.city,
    service_center: record.service_center,
    service_scenario: record.service_scenario,
    service_stage: record.service_stage,
    sentiment: record.sentiment,
    severity: record.severity,
    issue_tags: record.issue_tags.split("|"),
    tokens: tokenizeForAfterSales(text),
    text,
    metadata: {
      rating: Number(record.rating),
      nps_score: Number(record.nps_score),
      contact_consent: record.contact_consent,
      issue_resolved: record.issue_resolved,
      review_required: record.review_required === "true",
      is_synthetic: true,
      mock_batch_id: mockBatchId,
      mock_schema_version: mockSchemaVersion,
    },
  };
}

function tokenizeForAfterSales(text) {
  const tokens = new Set();
  for (const term of domainDictionary) {
    if (text.includes(term)) tokens.add(term);
  }
  const normalized = text.replace(/[^\u4e00-\u9fa5A-Za-z0-9]+/g, " ");
  for (const part of normalized.split(/\s+/).filter(Boolean)) {
    if (/^[A-Za-z0-9]+$/.test(part)) {
      tokens.add(part);
      continue;
    }
    for (let index = 0; index < part.length - 1; index += 1) {
      tokens.add(part.slice(index, index + 2));
    }
    for (let index = 0; index < part.length - 2; index += 1) {
      tokens.add(part.slice(index, index + 3));
    }
  }
  return Array.from(tokens).slice(0, 80);
}

function chunksFor(record) {
  const location = `${record.region}/${record.city}/${record.service_center}`;
  return [
    chunkRecord(record, "record_summary", `${record.survey_direction}反馈，项目为${record.project_name}，地点${location}，场景${record.service_scenario}，评分${record.rating}，NPS ${record.nps_score}，情绪${record.sentiment}。`),
    chunkRecord(record, "feedback_text", `${record.feedback_text} 来源为${record.platform}，服务环节归因为${record.service_stage}。`),
    chunkRecord(record, "issue_reason", `问题标签：${record.issue_tags.replace(/\|/g, "、")}。严重度${record.severity}，解决状态${record.issue_resolved}。`),
    chunkRecord(record, "closure_signal", `联系授权状态：${record.contact_consent}。低分或高风险样本需要进入闭环清单：${Number(record.rating) <= 2 || record.review_required === "true" ? "是" : "否"}。`),
    chunkRecord(record, "vehicle_context", `透明假车辆字段：车牌${record.vehicle_plate_mock}，VIN ${record.vin_mock}，仅用于字段占位和隐私扫描验证。`),
    chunkRecord(record, "survey_context", `问卷名称${record.source_name}，问卷方向${record.survey_direction}，题目数量${record.question_count}，来源渠道${record.source_channel}，模拟批次${record.mock_batch_id}。`),
  ];
}

const rawRows = [];
const normalizedRows = [];
const chunks = [];

for (const [directionIndex, direction] of surveyDirections.entries()) {
  for (let localIndex = 0; localIndex < 100; localIndex += 1) {
    const globalIndex = directionIndex * 100 + localIndex + 1;
    const city = pick(cities, globalIndex * 7 + directionIndex * 3);
    const center = pick(city.centers, globalIndex + localIndex);
    const platform = pick(platforms, globalIndex - 1);
    const sourceChannel = pick(sourceChannels, globalIndex + directionIndex);
    const device = pick(devices, globalIndex + localIndex);
    const scenario = pick(direction.scenarios, localIndex + directionIndex);
    const stage = pick(direction.stages, localIndex * 2 + directionIndex);
    const sentiment = sentimentFor(localIndex);
    const rating = ratingFor(sentiment, globalIndex);
    const npsScore = npsFor(rating, globalIndex);
    const reviewRequired = globalIndex % 10 === 0;
    const severity = severityFor(sentiment, rating, reviewRequired);
    const issueTags = issueTagsFor(stage, globalIndex);
    const submittedAt = dateFor(globalIndex);
    const contactConsent = contactConsentFor(sentiment, rating, globalIndex);
    const issueResolved = issueResolvedFor(sentiment, rating, globalIndex);
    const mockUserId = `${direction.accountPrefix}_user_${pad(globalIndex, 4)}`;
    const phone = mockPhone(globalIndex);
    const plate = mockPlate(city, globalIndex);
    const vin = mockVin(globalIndex);
    const feedbackText = buildFeedback(direction, sentiment, city, center, stage, issueTags, globalIndex);
    const sourceName = direction.surveyName;

    const rawRow = baseRawRow({
      globalIndex,
      localIndex,
      direction,
      platform,
      city,
      center,
      scenario,
      rating,
      npsScore,
      submittedAt,
      sourceChannel,
      device,
      mockUserId,
      phone,
      plate,
      vin,
      sentiment,
      feedbackText,
      issueResolved,
      contactConsent,
    });
    fillDirectionAnswers(rawRow, { direction, sentiment, rating, stage, issueTags, feedbackText, issueResolved, seed: globalIndex });
    rawRows.push(rawRow);

    const normalized = {
      feedback_id: `fb_mock_${pad(globalIndex, 6)}`,
      answer_id: rawRow.答卷ID,
      submitted_at: toIsoChina(submittedAt),
      platform,
      source_name: sourceName,
      source_channel: sourceChannel,
      survey_direction: direction.label,
      question_count: direction.questionCount,
      project_name: rawRow.项目名称,
      project_type: direction.projectType,
      region: city.region,
      province: city.province,
      city: city.city,
      service_center: center,
      service_scenario: scenario,
      service_stage: stage,
      rating,
      nps_score: npsScore,
      sentiment,
      severity,
      issue_tags: issueTags.join("|"),
      feedback_text: feedbackText,
      contact_consent: contactConsent,
      issue_resolved: issueResolved,
      review_required: String(reviewRequired),
      mock_user_id: mockUserId,
      phone_masked: phone,
      vehicle_plate_mock: plate,
      vin_mock: vin,
      answer_duration_seconds: 60 + ((globalIndex * 17) % 240),
      submitted_device: device,
      is_synthetic: "true",
      mock_batch_id: mockBatchId,
      mock_schema_version: mockSchemaVersion,
      pii_scan_status: "baseline_passed_pending_presidio",
    };
    normalizedRows.push(normalized);
    chunks.push(...chunksFor(normalized));
  }
}

writeCsv("mock_after_sales_surveys_raw_500.csv", rawHeaders, rawRows);
writeCsv("mock_after_sales_feedback_records_500.csv", normalizedHeaders, normalizedRows);
writeFileSync(
  join(outputDir, "mock_after_sales_feedback_chunks.jsonl"),
  `${chunks.map((chunk) => JSON.stringify(chunk)).join("\n")}\n`,
  "utf8",
);

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = typeof key === "function" ? key(item) : item[key];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]), "zh-Hans-CN"));
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function duplicateCount(rows, fields) {
  const seen = new Set();
  let duplicates = 0;
  for (const row of rows) {
    const key = fields.map((field) => row[field]).join("||");
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  return duplicates;
}

function hasRawPhone(value) {
  return /(^|[^A-Z0-9])1[3-9]\d{9}([^A-Z0-9]|$)/.test(value);
}

const rawPhoneViolations = normalizedRows.filter((row) => hasRawPhone(row.phone_masked) || hasRawPhone(row.feedback_text));
const directionCounts = countBy(normalizedRows, "survey_direction");
const platformCounts = countBy(normalizedRows, "platform");
const sentimentCounts = countBy(normalizedRows, "sentiment");
const stageCounts = countBy(normalizedRows, "service_stage");
const scenarioCounts = countBy(normalizedRows, "service_scenario");
const chunkCounts = countBy(chunks, "chunk_type");
const lowScoreCount = normalizedRows.filter((row) => Number(row.rating) <= 2 || Number(row.nps_score) <= 6).length;
const contactCount = normalizedRows.filter((row) => row.contact_consent === "已授权联系").length;
const reviewCount = normalizedRows.filter((row) => row.review_required === "true").length;
const syntheticCount = normalizedRows.filter((row) => row.is_synthetic === "true").length;
const regionCount = new Set(normalizedRows.map((row) => row.region)).size;
const cityCount = new Set(normalizedRows.map((row) => row.city)).size;
const centerCount = new Set(normalizedRows.map((row) => row.service_center)).size;

const qualityReport = `# 模拟售后问卷数据质量报告

## 1. 批次

- 批次：${mockBatchId}
- Schema 版本：${mockSchemaVersion}
- 原始问卷记录：${rawRows.length}
- 标准化反馈记录：${normalizedRows.length}
- Chunk 数量：${chunks.length}
- 是否全为透明假数据：${syntheticCount === normalizedRows.length ? "是" : "否"}

## 2. 五类问卷分布

${markdownTable(["问卷方向", "记录数"], directionCounts)}

## 3. 平台分布

${markdownTable(["平台", "记录数"], platformCounts)}

## 4. 情绪与风险分布

${markdownTable(["情绪", "记录数"], sentimentCounts)}

- 低分或贬损样本：${lowScoreCount}
- 授权联系样本：${contactCount}
- 需人工复核样本：${reviewCount}

## 5. 地域与服务中心覆盖

- 区域数：${regionCount}
- 城市数：${cityCount}
- 服务中心数：${centerCount}

${markdownTable(["服务环节", "记录数"], stageCounts)}

${markdownTable(["服务场景", "记录数"], scenarioCounts)}

## 6. Chunk 分布

${markdownTable(["Chunk 类型", "数量"], chunkCounts)}

## 7. 去重与乱码基础检查

- 答卷 ID 重复数：${duplicateCount(normalizedRows, ["answer_id"])}
- 用户 + 时间 + 原话重复数：${duplicateCount(normalizedRows, ["mock_user_id", "submitted_at", "feedback_text"])}
- 服务中心 + 评分 + 原话重复数：${duplicateCount(normalizedRows, ["service_center", "rating", "feedback_text"])}
- 明文 11 位手机号命中数：${rawPhoneViolations.length}
- UTF-8 写入：是
- 是否包含真实 IP 字段：否，仅保留 IP 属地/城市模拟字段

## 8. 透明假数据字段

- 假账号示例：${normalizedRows[0].mock_user_id}
- 脱敏假手机号示例：${normalizedRows[0].phone_masked}
- 假车牌示例：${normalizedRows[0].vehicle_plate_mock}
- 假 VIN 示例：${normalizedRows[0].vin_mock}
- 所有记录均带 mock_batch_id：${normalizedRows.every((row) => row.mock_batch_id === mockBatchId) ? "是" : "否"}

## 9. Microsoft Presidio 审计

基础报告生成时状态：待运行 \`scripts/audit-mock-surveys-presidio.py\`。

如果本机已安装 \`presidio-analyzer\` 和 \`presidio-anonymizer\`，该脚本会在下方追加 Presidio 扫描结果；如果未安装，会输出依赖缺失说明。最终入库判断以后续“Presidio 实际运行结果”为准。
`;

writeFileSync(join(outputDir, "mock_after_sales_data_quality_report.md"), qualityReport, "utf8");

const importPlan = `# 模拟售后问卷向量入库执行说明

## 1. 文件

| 文件 | 用途 |
| --- | --- |
| mock_after_sales_surveys_raw_500.csv | 模拟问卷星 / 腾讯问卷等平台导出原始表 |
| mock_after_sales_feedback_records_500.csv | 清洗后的标准化反馈记录 |
| mock_after_sales_feedback_chunks.jsonl | 向量入库前 Chunk |
| mock_after_sales_data_quality_report.md | 数据质量、去重、脱敏与 Presidio 审计报告 |

## 2. 推荐入库顺序

\`\`\`txt
survey_sources
-> projects
-> service_centers
-> import_batches
-> feedback_records
-> feedback_record_chunks
-> metric_snapshots
\`\`\`

## 3. 检索职责

- SQL：时间、项目、区域、城市、服务中心、评分、NPS、授权联系等结构化筛选。
- BM25：等待时间、解释不清、问题复发、App预约失败、充电排队、权益说明等精准关键词。
- Chunk / Vector：相似表达归并、跨问卷方向召回、Agent 追问上下文和报告证据选择。

## 4. Chunk 入库字段建议

| 字段 | 说明 |
| --- | --- |
| chunk_id | Chunk 唯一 ID |
| feedback_id | 对应 feedback_records |
| chunk_type | record_summary / feedback_text / issue_reason / closure_signal / vehicle_context / survey_context |
| content | JSONL 中的 text 字段 |
| metadata | JSONL 中的 metadata、地区、服务环节、情绪等 |
| embedding | 后续由 embedding 服务生成 |
| search_document | 由 content + metadata 文本生成的 BM25 字段 |

## 5. 入库前阻断规则

- \`is_synthetic\` 必须为 true。
- \`mock_batch_id\` 必须为 ${mockBatchId}。
- Presidio 审计如发现未脱敏真实手机号、疑似真实车牌、疑似真实 VIN 或详细住址，应阻断入库。
- 当前假车牌和假 VIN 仅用于字段占位、检索与脱敏校验，不作为真实车辆档案。

## 6. Supabase REST 入库脚本

先执行 dry-run，确认文件、环境变量和目标行数：

\`\`\`powershell
node scripts/import-mock-vector-surveys-to-supabase.mjs
\`\`\`

确认 \`.env.local\` 中存在 \`SUPABASE_SERVICE_ROLE_KEY\` 或 \`SUPABASE_ANON_KEY\`，且目标表字段已与本批 JSON payload 对齐后，再执行真实写入：

\`\`\`powershell
node scripts/import-mock-vector-surveys-to-supabase.mjs --execute
\`\`\`

当前脚本会准备以下表的写入 payload：

- \`survey_sources\`
- \`projects\`
- \`service_centers\`
- \`import_batches\`
- \`feedback_records\`
- \`feedback_record_chunks\`
`;

writeFileSync(join(outputDir, "mock_after_sales_vector_import_plan.md"), importPlan, "utf8");

console.log(
  JSON.stringify(
    {
      outputDir,
      rawRecords: rawRows.length,
      normalizedRecords: normalizedRows.length,
      chunks: chunks.length,
      directionCounts: Object.fromEntries(directionCounts),
      chunkCounts: Object.fromEntries(chunkCounts),
      rawPhoneViolations: rawPhoneViolations.length,
    },
    null,
    2,
  ),
);
