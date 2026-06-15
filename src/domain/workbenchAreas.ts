export type WorkbenchAreaId = "import" | "dashboard" | "agent" | "profile";

export type WorkbenchArea = {
  id: WorkbenchAreaId;
  label: string;
  title: string;
  summary: string;
  principle: string;
  owns: string[];
  excludes: string[];
};

export const WORKBENCH_AREAS: WorkbenchArea[] = [
  {
    id: "import",
    label: "导入",
    title: "导入数据，查看历史导入",
    summary: "上传反馈表格，查看最近导入记录和校验状态。",
    principle: "这里只处理数据进入和历史导入，不承担筛选、服务中心选择或报告判断。",
    owns: ["模板下载", "CSV 导入", "导入校验", "历史导入"],
    excludes: ["时间筛选", "项目筛选", "地区筛选", "服务中心选择", "自动复盘", "总报告", "专项报告", "Agent 对话"],
  },
  {
    id: "dashboard",
    label: "数据大仪表盘",
    title: "查看复盘、指标、证据和报告",
    summary: "先选择时间、项目、地区和服务中心，再查看圆饼式指标、复盘报告、证据和仪表盘追问。",
    principle: "时间优先，项目、地区和服务中心作为下钻维度；圆饼式指标看结构，总报告看判断，专项报告看执行。",
    owns: ["时间筛选", "项目筛选", "地区筛选", "服务中心选择", "圆饼式指标盘", "仪表盘追问", "8 模块自动复盘", "总报告", "专项报告", "原话证据"],
    excludes: ["字段映射操作", "账号设置", "项目对话列表"],
  },
  {
    id: "agent",
    label: "Agent 追问",
    title: "围绕项目连续追问",
    summary: "按项目保留对话，运营可以围绕当前数据、指标、报告、证据和闭环动作继续追问。",
    principle: "只回答本工具、本数据和售后运营分析相关问题；证据不足时说明不足。",
    owns: ["项目对话列表", "连续追问", "相关性判断", "证据引用"],
    excludes: ["问卷创建", "无关闲聊", "维修诊断建议"],
  },
  {
    id: "profile",
    label: "个人中心",
    title: "管理账号、数据和接口状态",
    summary: "查看个人设置、数据权限、导入历史、Agent 记录和后端数据库接口状态。",
    principle: "个人中心承接账号和数据库状态，不承接复盘报告本身。",
    owns: ["账号设置", "数据库状态", "导入历史", "Agent 记录", "权限配置"],
    excludes: ["总报告", "专项报告", "指标下钻"],
  },
];

export function getWorkbenchAreaById(areaId: WorkbenchAreaId): WorkbenchArea | undefined {
  return WORKBENCH_AREAS.find((area) => area.id === areaId);
}
