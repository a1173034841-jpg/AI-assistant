import type { ServiceStage, SurveyTemplateField, WorkbenchScenario } from "./types";

export const surveyTemplateFields: SurveyTemplateField[] = [
  {
    id: "score",
    label: "本次服务体验评分",
    type: "nps",
    required: true,
    helperText: "用 0-10 分记录推荐意愿，可换算 NPS、低分反馈和满意度波动。",
  },
  {
    id: "scenario",
    label: "本次反馈主要关于",
    type: "singleSelect",
    required: true,
    helperText: "到店服务、移动服务、补能、App/OTA、活动/社群或其他。",
  },
  {
    id: "feedback",
    label: "请描述这次体验中最想反馈的地方",
    type: "text",
    required: true,
    helperText: "提示车主说清楚发生了什么、影响是什么、希望怎么处理。",
  },
  {
    id: "location",
    label: "城市 / 服务中心",
    type: "text",
    required: false,
    helperText: "优先通过问卷链接参数自动带入，减少车主手动填写。",
  },
  {
    id: "contactConsent",
    label: "是否愿意被联系",
    type: "consent",
    required: false,
    helperText: "用于负反馈闭环，默认不强制收集。",
  },
  {
    id: "contact",
    label: "姓名 / 联系方式",
    type: "contact",
    required: false,
    helperText: "演示数据只保留脱敏信息，真实姓名和手机号不进入分析台。",
  },
];

export const scenarios: WorkbenchScenario[] = [
  "服务问题闭环",
  "满意度归因",
  "区域/城市下钻",
  "活动体验复盘",
  "口碑素材与风险",
];

export const stageKeywords: Record<ServiceStage, string[]> = {
  服务发起: ["预约", "App 提交", "排队", "等了", "远程诊断", "移动服务", "确认"],
  服务接待: ["接待", "解释不清", "态度", "沟通", "回复慢", "说明"],
  服务质量: ["没修好", "复发", "配件", "交付", "维修结果", "保养"],
  补能体验: ["充电", "排队", "占位费", "速度", "费用", "超充"],
  软件与智能化: ["OTA", "App", "辅助驾驶", "功能", "推送", "蓝牙"],
  用户运营: ["活动", "权益", "社群", "礼品", "车主俱乐部", "露营"],
};

export const stageIssueTags: Record<ServiceStage, string[]> = {
  服务发起: ["App预约", "移动服务", "服务等待"],
  服务接待: ["服务解释", "沟通效率", "服务态度"],
  服务质量: ["维修结果", "交付体验", "问题复发"],
  补能体验: ["充电排队", "费用理解", "补能效率"],
  软件与智能化: ["App使用", "OTA理解", "功能误解"],
  用户运营: ["活动体验", "权益感知", "社群反馈"],
};
