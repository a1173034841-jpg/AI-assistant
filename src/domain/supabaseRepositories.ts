export type SupabaseRepositoryName =
  | "FeedbackRepository"
  | "MetricsRepository"
  | "ReportRepository"
  | "AgentRepository"
  | "UserRepository";

export type RetrievalMode = "SQL" | "BM25" | "Chunk";

export type SupabaseRepositoryDescriptor = {
  name: SupabaseRepositoryName;
  databaseTarget: "Supabase";
  purpose: string;
  tables: string[];
  retrievalModes: RetrievalMode[];
};

export const SUPABASE_REPOSITORIES: SupabaseRepositoryDescriptor[] = [
  {
    name: "FeedbackRepository",
    databaseTarget: "Supabase",
    purpose: "管理导入批次、问卷来源、项目、服务中心和标准化反馈记录。",
    tables: ["import_batches", "survey_sources", "projects", "feedback_records", "service_centers"],
    retrievalModes: ["SQL", "BM25"],
  },
  {
    name: "MetricsRepository",
    databaseTarget: "Supabase",
    purpose: "读取时间、项目、地区和服务中心维度的指标快照与聚合结果。",
    tables: ["metric_snapshots", "feedback_records", "projects", "service_centers"],
    retrievalModes: ["SQL"],
  },
  {
    name: "ReportRepository",
    databaseTarget: "Supabase",
    purpose: "管理总报告、专项报告、报告分段和原话证据引用。",
    tables: ["report_runs", "report_sections", "evidence_quotes"],
    retrievalModes: ["SQL", "BM25"],
  },
  {
    name: "AgentRepository",
    databaseTarget: "Supabase",
    purpose: "保存项目对话、追问记录和未来检索上下文。",
    tables: ["agent_messages", "report_runs", "evidence_quotes", "feedback_records"],
    retrievalModes: ["SQL", "BM25", "Chunk"],
  },
  {
    name: "UserRepository",
    databaseTarget: "Supabase",
    purpose: "管理账号设置、默认筛选偏好、数据权限和接口可用状态。",
    tables: ["user_profiles", "user_preferences", "user_permissions"],
    retrievalModes: ["SQL"],
  },
];

export function getSupabaseRepositoryByName(name: SupabaseRepositoryName): SupabaseRepositoryDescriptor | undefined {
  return SUPABASE_REPOSITORIES.find((repository) => repository.name === name);
}
