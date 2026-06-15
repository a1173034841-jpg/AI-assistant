import { describe, expect, it } from "vitest";
import { SUPABASE_REPOSITORIES, getSupabaseRepositoryByName } from "./supabaseRepositories";

describe("Supabase repository contract", () => {
  it("keeps Supabase as the database target without requiring a frontend dependency", () => {
    expect(SUPABASE_REPOSITORIES.every((repository) => repository.databaseTarget === "Supabase")).toBe(true);
    expect(SUPABASE_REPOSITORIES.map((repository) => repository.name)).toEqual([
      "FeedbackRepository",
      "MetricsRepository",
      "ReportRepository",
      "AgentRepository",
      "UserRepository",
    ]);
  });

  it("maps each repository to the tables needed by the final execution plan", () => {
    expect(getSupabaseRepositoryByName("FeedbackRepository")?.tables).toEqual(
      expect.arrayContaining(["import_batches", "survey_sources", "projects", "feedback_records", "service_centers"]),
    );
    expect(getSupabaseRepositoryByName("ReportRepository")?.tables).toEqual(
      expect.arrayContaining(["report_runs", "report_sections", "evidence_quotes"]),
    );
    expect(getSupabaseRepositoryByName("AgentRepository")?.tables).toEqual(expect.arrayContaining(["agent_messages"]));
  });

  it("keeps SQL, BM25, and Chunk retrieval responsibilities explicit", () => {
    expect(getSupabaseRepositoryByName("MetricsRepository")?.retrievalModes).toEqual(["SQL"]);
    expect(getSupabaseRepositoryByName("FeedbackRepository")?.retrievalModes).toEqual(expect.arrayContaining(["SQL", "BM25"]));
    expect(getSupabaseRepositoryByName("AgentRepository")?.retrievalModes).toEqual(expect.arrayContaining(["SQL", "BM25", "Chunk"]));
  });
});
