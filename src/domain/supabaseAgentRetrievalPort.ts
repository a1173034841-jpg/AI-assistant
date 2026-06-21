import {
  buildAgentRetrievalPromptContext,
  rankAgentChunks,
  tokenizeAgentQuestion,
  type AgentRetrievalChunk,
  type RankedAgentRetrievalChunk,
} from "./supabaseAgentRetrieval";

type SupabaseRetrievalEnv = {
  VITE_SUPABASE_REST_URL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

export type SupabaseAgentRetrievalConfig = {
  restUrl: string;
  anonKey: string;
  mockBatchId: string;
  requestTimeoutMs: number;
};

export type SupabaseAgentRetrievalRequest = {
  question: string;
  limit?: number;
  scope?: SupabaseAgentRetrievalScope;
};

export type SupabaseAgentRetrievalResult = {
  chunks: RankedAgentRetrievalChunk[];
  promptContext: string;
};

export type SupabaseAgentRetrievalScope = {
  projectNames?: string[];
  cities?: string[];
  serviceCenters?: string[];
};

type SupabaseChunkRow = {
  id: string;
  feedback_record_id: string;
  chunk_index: number;
  chunk_text: string;
  metadata: AgentRetrievalChunk["metadata"];
};

export function getSupabaseAgentRetrievalConfig(env: SupabaseRetrievalEnv): SupabaseAgentRetrievalConfig | null {
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  const restUrl =
    env.VITE_SUPABASE_REST_URL?.trim() ||
    (env.VITE_SUPABASE_URL?.trim() ? `${env.VITE_SUPABASE_URL.trim().replace(/\/+$/, "")}/rest/v1` : "");

  if (!anonKey || !restUrl) return null;

  return {
    restUrl: restUrl.replace(/\/+$/, ""),
    anonKey,
    mockBatchId: "mock-after-sales-v1",
    requestTimeoutMs: 12000,
  };
}

export function createSupabaseAgentRetrievalPort(env: SupabaseRetrievalEnv): {
  retrieve: (request: SupabaseAgentRetrievalRequest) => Promise<SupabaseAgentRetrievalResult>;
} {
  const config = getSupabaseAgentRetrievalConfig(env);

  return {
    retrieve: async (request) => {
      if (!config) return { chunks: [], promptContext: buildAgentRetrievalPromptContext([]) };

      const rows = await fetchMockBatchChunks(config, request.question);
      const chunks = rows.map(mapSupabaseChunkRow);
      const scopedChunks = filterChunksByScope(chunks, request.scope);
      const hasScopeFilter = hasRetrievalScopeFilter(request.scope);
      const ranked = rankAgentChunks({
        question: request.question,
        chunks: hasScopeFilter ? scopedChunks : chunks,
        limit: request.limit ?? 8,
      });

      return {
        chunks: ranked,
        promptContext: buildAgentRetrievalPromptContext(ranked),
      };
    },
  };
}

function hasRetrievalScopeFilter(scope?: SupabaseAgentRetrievalScope): boolean {
  return Boolean(scope?.projectNames?.length || scope?.cities?.length || scope?.serviceCenters?.length);
}

function filterChunksByScope(
  chunks: AgentRetrievalChunk[],
  scope?: SupabaseAgentRetrievalScope,
): AgentRetrievalChunk[] {
  if (!scope) return chunks;
  const projectNames = new Set(scope.projectNames ?? []);
  const cities = new Set(scope.cities ?? []);
  const serviceCenters = new Set(scope.serviceCenters ?? []);
  if (!projectNames.size && !cities.size && !serviceCenters.size) return chunks;

  return chunks.filter((chunk) => {
    const projectName = typeof chunk.metadata.project_name === "string" ? chunk.metadata.project_name : "";
    const city = typeof chunk.metadata.city === "string" ? chunk.metadata.city : "";
    const serviceCenter = typeof chunk.metadata.service_center === "string" ? chunk.metadata.service_center : "";
    const projectMatched = !projectNames.size || projectNames.has(projectName);
    const cityMatched = !cities.size || cities.has(city);
    const centerMatched = !serviceCenters.size || serviceCenters.has(serviceCenter);
    return projectMatched && cityMatched && centerMatched;
  });
}

async function fetchMockBatchChunks(config: SupabaseAgentRetrievalConfig, question: string): Promise<SupabaseChunkRow[]> {
  const terms = buildSupabaseSearchTerms(question);
  const filteredRows = terms.length ? await fetchChunkPage(config, terms, 0, 199, "metadata") : [];
  const fallbackRows = await fetchChunkPage(config, terms, 0, 199, "none");
  return uniqueRowsById([...filteredRows, ...fallbackRows]);
}

function uniqueRowsById(rows: SupabaseChunkRow[]): SupabaseChunkRow[] {
  const map = new Map<string, SupabaseChunkRow>();
  for (const row of rows) {
    if (!map.has(row.id)) map.set(row.id, row);
  }
  return Array.from(map.values());
}

async function fetchChunkPage(
  config: SupabaseAgentRetrievalConfig,
  terms: string[],
  from: number,
  to: number,
  filterMode: "metadata" | "none",
): Promise<SupabaseChunkRow[]> {
  const query = new URLSearchParams({
    select: "id,feedback_record_id,chunk_index,chunk_text,metadata",
    "metadata->>mock_batch_id": `eq.${config.mockBatchId}`,
  });
  if (filterMode === "metadata" && terms.length) {
    query.set(
      "or",
      `(${terms
        .flatMap((term) => [
          `metadata->>city.ilike.*${escapePostgrestLike(term)}*`,
          `metadata->>service_center.ilike.*${escapePostgrestLike(term)}*`,
          `metadata->>project_name.ilike.*${escapePostgrestLike(term)}*`,
        ])
        .join(",")})`,
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(`${config.restUrl}/feedback_record_chunks?${query.toString()}`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        Range: `${from}-${to}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) return [];
    return (await response.json()) as SupabaseChunkRow[];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function buildSupabaseSearchTerms(question: string): string[] {
  return tokenizeAgentQuestion(question)
    .filter((token) => token.length >= 2)
    .filter((token) => !/^\d+$/.test(token))
    .slice(0, 8);
}

function escapePostgrestLike(term: string): string {
  return term.replace(/[%*,()]/g, "");
}

function mapSupabaseChunkRow(row: SupabaseChunkRow): AgentRetrievalChunk {
  return {
    id: row.id,
    feedbackRecordId: row.feedback_record_id,
    chunkIndex: row.chunk_index,
    chunkText: row.chunk_text,
    metadata: row.metadata ?? {},
  };
}
