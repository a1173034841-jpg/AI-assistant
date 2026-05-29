import type { ThirdPartySurveyExport } from "../domain/types";

const comments = [
  ["华南", "深圳", "深圳南山服务中心", "移动服务", 2, 4, "移动服务预约后等了两天才确认，沟通回复慢，最后解释也不清楚。"],
  ["华南", "广州", "广州番禺服务中心", "到店服务", 5, 10, "接待很主动，维修结果解释得清楚，交付时还提醒了后续保养注意事项。"],
  ["华东", "上海", "上海浦东服务中心", "App/OTA", 2, 5, "App 预约页面提交后没有提示，后来到店才发现时间没有约上。"],
  ["华北", "北京", "北京亦庄服务中心", "补能体验", 3, 7, "超充排队时间比预期久，占位费规则看得不是很明白。"],
  ["西南", "成都", "成都高新服务中心", "活动/社群", 5, 9, "车主活动组织得不错，工作人员解释权益很清楚，社群氛围也好。"],
  ["华南", "深圳", "深圳龙岗服务中心", "到店服务", 1, 3, "到店后等了很久才有人接待，维修结果也没有说清楚，体验比较失望。"],
  ["华东", "杭州", "杭州滨江服务中心", "移动服务", 4, 9, "移动服务上门很方便，师傅沟通专业，节省了我去店里的时间。"],
  ["华北", "天津", "天津空港服务中心", "App/OTA", 3, 6, "OTA 推送说明太简略，不知道更新后哪些功能变化了。"],
  ["西南", "重庆", "重庆渝北服务中心", "补能体验", 2, 5, "充电速度比预期慢，排队时现场也没人解释。"],
  ["华东", "南京", "南京江宁服务中心", "到店服务", 5, 10, "接待人员态度很好，问题解释清楚，交车也很顺利。"],
  ["华南", "佛山", "佛山南海服务中心", "活动/社群", 4, 8, "活动路线安排不错，但礼品领取规则可以提前说清楚。"],
  ["华北", "北京", "北京朝阳服务中心", "移动服务", 2, 5, "移动服务时间变更没有及时通知，我等了一下午。"],
  ["西南", "昆明", "昆明官渡服务中心", "到店服务", 3, 7, "维修完成了，但配件等待时间较长，希望能提前同步进度。"],
  ["华东", "苏州", "苏州工业园服务中心", "补能体验", 4, 8, "充电站环境不错，费用说明如果再清楚一点会更好。"],
  ["华南", "东莞", "东莞松山湖服务中心", "App/OTA", 1, 4, "App 蓝牙钥匙经常连接不上，提交反馈后回复也慢。"],
  ["华北", "青岛", "青岛崂山服务中心", "活动/社群", 5, 10, "露营活动体验很好，工作人员耐心，车主之间交流也很顺畅。"],
  ["西南", "成都", "成都武侯服务中心", "移动服务", 4, 9, "移动服务师傅准时到达，处理过程很专业。"],
  ["华东", "上海", "上海闵行服务中心", "到店服务", 2, 5, "接待解释不清楚，我问了几次才知道维修项目包含什么。"],
  ["华南", "广州", "广州天河服务中心", "补能体验", 2, 6, "充电排队时有人占位，现场处理不及时。"],
  ["华北", "北京", "北京顺义服务中心", "App/OTA", 4, 8, "App 最近稳定多了，预约保养流程也比之前顺。"],
  ["西南", "重庆", "重庆南岸服务中心", "活动/社群", 3, 7, "活动内容不错，但集合时间提醒不够明显。"],
  ["华东", "杭州", "杭州萧山服务中心", "移动服务", 1, 3, "预约移动服务后临时取消，没有说明原因。"],
  ["华南", "深圳", "深圳宝安服务中心", "到店服务", 4, 8, "接待效率不错，等待区也比较安静。"],
  ["华北", "济南", "济南历下服务中心", "补能体验", 3, 6, "充电费用规则有点复杂，希望 App 里提示更明显。"],
  ["西南", "贵阳", "贵阳观山湖服务中心", "App/OTA", 2, 5, "辅助驾驶功能提示不够清楚，交付时也没有讲明白。"],
  ["华东", "宁波", "宁波鄞州服务中心", "活动/社群", 5, 9, "车主课堂讲得很实用，对新功能理解更清楚了。"],
  ["华南", "珠海", "珠海香洲服务中心", "移动服务", 4, 9, "上门服务体验很好，师傅还提醒我检查胎压。"],
  ["华北", "石家庄", "石家庄裕华服务中心", "到店服务", 2, 5, "服务态度一般，维修结果说明比较简单。"],
  ["西南", "成都", "成都天府服务中心", "补能体验", 5, 10, "超充站引导清楚，工作人员主动协助新车主。"],
  ["华东", "上海", "上海嘉定服务中心", "App/OTA", 3, 7, "功能更新后有点不适应，希望推送说明更完整。"],
  ["华南", "中山", "中山城区服务中心", "活动/社群", 2, 5, "活动报名成功后通知太晚，差点错过集合时间。"],
  ["华北", "天津", "天津滨海服务中心", "移动服务", 5, 9, "移动服务真的方便，不用请假去店里。"],
  ["西南", "重庆", "重庆江北服务中心", "到店服务", 1, 4, "问题复发了，第二次到店还是没有彻底解决。"],
  ["华东", "南京", "南京鼓楼服务中心", "补能体验", 4, 8, "充电速度可以，排队提示如果更准确就好了。"],
  ["华南", "深圳", "深圳福田服务中心", "App/OTA", 5, 9, "App 预约比之前顺畅，提醒也及时。"],
  ["华北", "北京", "北京海淀服务中心", "活动/社群", 4, 8, "车主分享会内容不错，希望下次增加移动服务专题。"],
  ["西南", "成都", "成都金牛服务中心", "移动服务", 2, 5, "远程诊断说可以上门，后来又让我到店，前后说法不一致。"],
  ["华东", "苏州", "苏州吴中服务中心", "到店服务", 5, 10, "从接待到交付都很顺，解释也很专业。"],
  ["华南", "惠州", "惠州惠城服务中心", "补能体验", 2, 5, "充电排队没人维护秩序，体验比较差。"],
  ["华北", "青岛", "青岛市北服务中心", "App/OTA", 4, 8, "App 使用基本顺畅，就是服务记录入口有点深。"],
] as const;

export const mockSurveyExports: ThirdPartySurveyExport[] = [
  {
    exportId: "wjx-20260510-service",
    platform: "问卷星",
    exportedAt: "2026-05-10T18:30:00+08:00",
    sourceName: "售后服务体验回访问卷",
    projectName: "A 项目：五一售后服务专项",
    periodStart: "2026-05-01",
    periodEnd: "2026-05-10",
    records: comments.slice(0, 10).map((item, index) => toRecord(item, index, "问卷星")),
  },
  {
    exportId: "txwj-20260510-service",
    platform: "腾讯问卷",
    exportedAt: "2026-05-10T19:10:00+08:00",
    sourceName: "五一服务专项补充回访",
    projectName: "A 项目：五一售后服务专项",
    periodStart: "2026-05-01",
    periodEnd: "2026-05-10",
    records: comments.slice(10, 16).map((item, index) => toRecord(item, index + 10, "腾讯问卷")),
  },
  {
    exportId: "txwj-20260520-region",
    platform: "腾讯问卷",
    exportedAt: "2026-05-20T20:10:00+08:00",
    sourceName: "服务中心月中回访问卷",
    projectName: "B 项目：服务中心月中回访",
    periodStart: "2026-05-15",
    periodEnd: "2026-05-20",
    records: comments.slice(16, 28).map((item, index) => toRecord(item, index + 16, "腾讯问卷")),
  },
  {
    exportId: "app-20260520-region",
    platform: "App内问卷",
    exportedAt: "2026-05-20T21:00:00+08:00",
    sourceName: "服务完成页月中反馈",
    projectName: "B 项目：服务中心月中回访",
    periodStart: "2026-05-15",
    periodEnd: "2026-05-20",
    records: comments.slice(28, 32).map((item, index) => toRecord(item, index + 28, "App内问卷")),
  },
  {
    exportId: "app-20260527-mixed",
    platform: "App内问卷",
    exportedAt: "2026-05-27T11:00:00+08:00",
    sourceName: "App 售后完成页反馈导出",
    projectName: "C 项目：App 售后完成页常规反馈",
    periodStart: "2026-05-21",
    periodEnd: "2026-05-27",
    records: comments.slice(32).map((item, index) => toRecord(item, index + 32, "App内问卷")),
  },
  {
    exportId: "wjx-20260524-weekly",
    platform: "问卷星",
    exportedAt: "2026-05-24T20:30:00+08:00",
    sourceName: "周度售后体验监测问卷",
    projectName: "D 项目：周度售后体验监测",
    periodStart: "2026-05-18",
    periodEnd: "2026-05-24",
    records: buildLargeRecords(720, "问卷星", 1000),
  },
  {
    exportId: "app-20260524-weekly",
    platform: "App内问卷",
    exportedAt: "2026-05-24T21:00:00+08:00",
    sourceName: "App 售后完成页周度反馈",
    projectName: "D 项目：周度售后体验监测",
    periodStart: "2026-05-18",
    periodEnd: "2026-05-24",
    records: buildLargeRecords(560, "App内问卷", 2000),
  },
];

function toRecord(
  item: (typeof comments)[number],
  index: number,
  platform: "问卷星" | "腾讯问卷" | "App内问卷",
): ThirdPartySurveyExport["records"][number] {
  const [region, city, serviceCenter, serviceScenario, rating, npsScore, feedbackText] = item;
  const consentState = rating <= 2 ? "已授权联系" : rating >= 5 ? "拒绝联系" : "未询问";

  return {
    id: `fb-${String(index + 1).padStart(3, "0")}`,
    submittedAt: buildSubmittedAt(index),
    platform,
    region,
    city,
    serviceCenter,
    serviceScenario,
    rating,
    npsScore,
    feedbackText,
    contact: {
      name: rating <= 2 ? "模拟车主" : undefined,
      phoneMasked: rating <= 2 ? `138****${String(2400 + index).slice(-4)}` : undefined,
      consentState,
    },
  };
}

function buildSubmittedAt(index: number): string {
  const day = index < 16 ? 1 + (index % 10) : index < 32 ? 15 + ((index - 16) % 6) : 21 + ((index - 32) % 7);
  return `2026-05-${String(day).padStart(2, "0")}T${String(9 + (index % 9)).padStart(2, "0")}:20:00+08:00`;
}

function buildLargeRecords(
  count: number,
  platform: "问卷星" | "腾讯问卷" | "App内问卷",
  idOffset: number,
): ThirdPartySurveyExport["records"] {
  return Array.from({ length: count }, (_, index) => {
    const base = comments[index % comments.length];
    const record = toRecord(base, idOffset + index, platform);
    const day = 18 + (index % 7);
    const hour = 8 + (index % 12);
    const minute = (index * 7) % 60;
    return {
      ...record,
      id: `fb-large-${platform}-${String(index + 1).padStart(4, "0")}`,
      submittedAt: `2026-05-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`,
    };
  });
}
