import type { SupabaseClient } from "@supabase/supabase-js";
import { generateWithFallback } from "@/ai/generation";
import type { Connection, Database, MatchedChunk, ConnectionRelationshipMetrics } from "@/types/database";
import type { RankedContact } from "@/types/database";
import { searchKnowledgeChunks } from "@/services/vector-search";
import { scorePosition } from "@/utils/company-utils";
import { fetchAllRecords } from "@/utils/supabase-utils";

export type CompanyRecommendation = {
  company: string;
  recommendationScore: number;
  connectionCount: number;
  topContact: RankedContact | null;
  suggestedReason: string;
  connectionScore: number;
  seniorityScore: number;
  projectScore: number;
  relationshipScore: number;
};

export type CompanyDetail = CompanyRecommendation & {
  connections: Connection[];
  matchingProjects: MatchedChunk[];
  outreachRecommendation: string;
};

function groupConnectionsByCompany(
  connections: Connection[]
): Map<string, Connection[]> {
  const map = new Map<string, Connection[]>();
  for (const c of connections) {
    if (!c.company?.trim()) continue;
    const key = c.company.trim();
    const list = map.get(key) ?? [];
    list.push(c);
    map.set(key, list);
  }
  return map;
}

function pickTopContact(connections: Connection[], metricsMap?: Map<string, ConnectionRelationshipMetrics>): RankedContact | null {
  if (!connections.length) return null;

  const ranked = connections
    .map((c) => {
      const metric = metricsMap?.get(c.id);
      const relScore = metric?.relationship_score || 0;
      const baseScore = scorePosition(c.position);
      return {
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        company: c.company,
        position: c.position,
        email: c.email,
        profile_url: c.profile_url,
        score: baseScore + relScore,
        relationship_score: relScore,
        conversation_summary: metric?.conversation_summary || null,
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0];
}

function buildSuggestedReason(
  connectionCount: number,
  topContact: RankedContact | null
): string {
  const parts: string[] = [];

  if (connectionCount > 1) {
    parts.push(`${connectionCount} LinkedIn connections`);
  } else if (connectionCount === 1) {
    parts.push("1 LinkedIn connection");
  }

  if (topContact?.position && topContact.score >= 65) {
    parts.push(`senior contact (${topContact.position})`);
  }

  if (!parts.length) {
    return "Potential outreach target based on connection network.";
  }

  return `${parts.join(" and ")}.`;
}

function scoreRecommendation(
  projectScore: number,
  connectionCount: number,
  maxConnections: number,
  seniorityScore: number,
  relationshipScore: number = 0
): {
  recommendationScore: number;
  connectionScore: number;
  seniorityScoreNormalized: number;
  projectScore: number;
  relationshipScoreNormalized: number;
} {
  const connectionScore =
    maxConnections > 0 ? (connectionCount / maxConnections) * 100 : 0;
  const seniorityScoreNormalized = Math.min(seniorityScore, 100);
  const relationshipScoreNormalized = Math.min(relationshipScore * 2, 100);

  const recommendationScore =
    projectScore * 0.40 +
    connectionScore * 0.20 +
    seniorityScoreNormalized * 0.20 +
    relationshipScoreNormalized * 0.20;

  return {
    recommendationScore: Math.round(recommendationScore),
    connectionScore: Math.round(connectionScore),
    seniorityScoreNormalized: Math.round(seniorityScoreNormalized),
    projectScore: Math.round(projectScore),
    relationshipScoreNormalized: Math.round(relationshipScoreNormalized),
  };
}

export type RecommendationStreamEvent =
  | { type: 'cached_batch'; data: CompanyRecommendation[] }
  | { type: 'calculated'; data: CompanyRecommendation }
  | { type: 'error'; data: string }
  | { type: 'complete' };

/**
 * Generates an asynchronous stream of company recommendations.
 * 
 * Flow:
 * 1. Fetches all known connections and groups them by company.
 * 2. Pre-loads all previously cached recommendation scores from `company_score_cache`.
 * 3. Immediately yields a bulk `cached_batch` event containing all pre-computed companies.
 * 4. Iterates over remaining uncached companies, scores them against the vector DB,
 *    caches the result, and yields them individually via `calculated` events.
 * 
 * This enables Server-Sent Events (SSE) progressive rendering on the frontend.
 */
export async function* getCompanyRecommendationsStream(
  supabase: SupabaseClient<Database>,
  userId: string
): AsyncGenerator<RecommendationStreamEvent, void, unknown> {
  const connectionsQuery = supabase
    .from("connections")
    .select("*")
    .eq("user_id", userId)
    .order("id", { ascending: true });

  const connections = await fetchAllRecords<Connection>(connectionsQuery);

  const metricsQuery = supabase
    .from("connection_relationship_metrics")
    .select("*")
    .eq("user_id", userId);
  const metricsRecords = await fetchAllRecords<ConnectionRelationshipMetrics>(metricsQuery);
  const metricsMap = new Map<string, ConnectionRelationshipMetrics>();
  metricsRecords?.forEach((m) => metricsMap.set(m.connection_id, m));

  const grouped = groupConnectionsByCompany(connections ?? []);
  if (!grouped.size) {
    yield { type: 'complete' };
    return;
  }

  const maxConnections = Math.max(
    ...[...grouped.values()].map((g) => g.length),
    1
  );

  const { data: cacheRows } = await supabase
    .from("company_industry_cache")
    .select("company_name, industry")
    .eq("user_id", userId);

  const industryMap = new Map<string, string>();
  for (const row of cacheRows ?? []) {
    industryMap.set(row.company_name.toLowerCase(), row.industry || "");
  }

  const { data: scoreCacheRows } = await supabase
    .from("company_score_cache")
    .select("*")
    .eq("user_id", userId);

  const dbCache = new Map<string, any>();
  for (const row of scoreCacheRows ?? []) {
    dbCache.set(row.company_name.toLowerCase(), row);
  }

  const cachedBatch: CompanyRecommendation[] = [];
  const uncachedList: [string, any[]][] = [];

  for (const [company, companyConnections] of grouped) {
    const cached = dbCache.get(company.toLowerCase());
    if (cached) {
      const topContact = pickTopContact(companyConnections, metricsMap);
      cachedBatch.push({
        company,
        recommendationScore: cached.recommendation_score,
        connectionCount: companyConnections.length,
        topContact,
        suggestedReason: buildSuggestedReason(companyConnections.length, topContact),
        connectionScore: cached.connection_score,
        seniorityScore: cached.seniority_score,
        projectScore: cached.project_relevance_score,
        relationshipScore: topContact?.relationship_score || 0,
      });
    } else {
      uncachedList.push([company, companyConnections]);
    }
  }

  // 1. Immediately yield all cached companies in a single batch
  if (cachedBatch.length > 0) {
    yield { type: 'cached_batch', data: cachedBatch };
  }

  // 2. Process uncached companies progressively
  for (const [company, companyConnections] of uncachedList) {
    const topContact = pickTopContact(companyConnections);
    const seniorityRaw = topContact?.score ?? 0;

    try {
      const industry = industryMap.get(company.toLowerCase());
      const queryParts = [company];
      if (topContact?.position) queryParts.push(topContact.position);
      if (industry && industry !== "Unknown") queryParts.push(industry);

      const query = queryParts.join(" ");
      let matchingProjects = await searchKnowledgeChunks(supabase, userId, query, 3);

      if (matchingProjects.length === 0) {
        const fallbackQueryParts = [];
        if (industry && industry !== "Unknown") fallbackQueryParts.push(industry);
        if (topContact?.position) fallbackQueryParts.push(topContact.position);

        const fallbackQuery = fallbackQueryParts.join(" ").trim();
        if (fallbackQuery && fallbackQuery !== query) {
          matchingProjects = await searchKnowledgeChunks(supabase, userId, fallbackQuery, 3);
        }
      }

      let projectScore = 0;
      let avgSimilarity = 0;
      const topProjects: string[] = [];

      if (matchingProjects.length > 0) {
        avgSimilarity = matchingProjects.reduce((acc, p) => acc + p.similarity, 0) / matchingProjects.length;
        projectScore = Math.min(100, Math.round(avgSimilarity * 100));
        topProjects.push(...matchingProjects.map(p => p.project_name || p.document_id));
      }

      const scores = scoreRecommendation(
        projectScore,
        companyConnections.length,
        maxConnections,
        seniorityRaw,
        topContact?.relationship_score || 0
      );

      const rec: CompanyRecommendation = {
        company,
        recommendationScore: scores.recommendationScore,
        connectionCount: companyConnections.length,
        topContact,
        suggestedReason: buildSuggestedReason(companyConnections.length, topContact),
        connectionScore: scores.connectionScore,
        seniorityScore: scores.seniorityScoreNormalized,
        projectScore: scores.projectScore,
        relationshipScore: scores.relationshipScoreNormalized,
      };

      await supabase.from("company_score_cache").upsert({
        user_id: userId,
        company_name: company,
        project_relevance_score: scores.projectScore,
        recommendation_score: scores.recommendationScore,
        matching_project_count: matchingProjects.length,
        average_similarity: avgSimilarity,
        connection_score: scores.connectionScore,
        seniority_score: scores.seniorityScoreNormalized,
        top_project_names: topProjects,
        industry: industry || null,
        last_calculated_at: new Date().toISOString(),
      });

      yield { type: 'calculated', data: rec };
    } catch (error) {
      console.error("Vector search quota/rate limit hit during company scoring. Exiting loop.", error);
      yield { type: 'error', data: 'Embedding quota reached or vector search failed. Resuming next time.' };
      break;
    }
  }

  yield { type: 'complete' };
}

export async function getCompanyRecommendations(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CompanyRecommendation[]> {
  const recommendations: CompanyRecommendation[] = [];
  const generator = getCompanyRecommendationsStream(supabase, userId);

  for await (const event of generator) {
    if (event.type === 'cached_batch') {
      recommendations.push(...event.data);
    } else if (event.type === 'calculated') {
      recommendations.push(event.data);
    }
  }

  return recommendations.sort(
    (a, b) => b.recommendationScore - a.recommendationScore
  );
}

export async function getCompanyDetail(
  supabase: SupabaseClient<Database>,
  userId: string,
  companyName: string
): Promise<CompanyDetail | null> {
  const connectionsQuery = supabase
    .from("connections")
    .select("*")
    .eq("user_id", userId)
    .order("id", { ascending: true });

  const fetchedConnections = await fetchAllRecords<Connection>(connectionsQuery);
  const uniqueConns = new Map<string, Connection>();
  fetchedConnections.forEach((c) => uniqueConns.set(c.id, c));
  const connections = Array.from(uniqueConns.values());

  const metricsQuery = supabase
    .from("connection_relationship_metrics")
    .select("*")
    .eq("user_id", userId);
  const metricsRecords = await fetchAllRecords<ConnectionRelationshipMetrics>(metricsQuery);
  const metricsMap = new Map<string, ConnectionRelationshipMetrics>();
  metricsRecords?.forEach((m) => metricsMap.set(m.connection_id, m));

  const grouped = groupConnectionsByCompany(connections);
  const companyConnections = [...grouped.entries()].find(
    ([name]) => name.toLowerCase() === companyName.toLowerCase()
  );

  if (!companyConnections) return null;

  const [company, companyConns] = companyConnections;
  const topContact = pickTopContact(companyConns, metricsMap);

  const maxConnections = Math.max(
    ...[...grouped.values()].map((g) => g.length),
    1
  );

  const { data: cacheRow } = await supabase
    .from("company_industry_cache")
    .select("industry")
    .eq("user_id", userId)
    .ilike("company_name", company)
    .maybeSingle();

  const industry = cacheRow?.industry && cacheRow.industry !== "Unknown" ? cacheRow.industry : "";

  const queryParts = [company];
  if (topContact?.position) queryParts.push(topContact.position);
  if (industry) queryParts.push(industry);

  const query = queryParts.join(" ");

  let matchingProjects = await searchKnowledgeChunks(
    supabase,
    userId,
    query,
    5
  );

  if (matchingProjects.length === 0) {
    const fallbackQueryParts = [];
    if (industry) fallbackQueryParts.push(industry);
    if (topContact?.position) fallbackQueryParts.push(topContact.position);

    const fallbackQuery = fallbackQueryParts.join(" ").trim();
    if (fallbackQuery && fallbackQuery !== query) {
      matchingProjects = await searchKnowledgeChunks(
        supabase,
        userId,
        fallbackQuery,
        5
      );
    }
  }

  let projectScore = 0;
  let avgSimilarity = 0;
  const topProjects: string[] = [];

  if (matchingProjects.length > 0) {
    avgSimilarity = matchingProjects.reduce((acc, p) => acc + p.similarity, 0) / matchingProjects.length;
    projectScore = Math.min(100, Math.round(avgSimilarity * 100));
    topProjects.push(...matchingProjects.map(p => p.project_name || p.document_id));
  }

  const scores = scoreRecommendation(
    projectScore,
    companyConns.length,
    maxConnections,
    topContact?.score ?? 0,
    topContact?.relationship_score || 0
  );

  const match: CompanyRecommendation = {
    company,
    recommendationScore: scores.recommendationScore,
    connectionCount: companyConns.length,
    topContact,
    suggestedReason: buildSuggestedReason(
      companyConns.length,
      topContact
    ),
    connectionScore: scores.connectionScore,
    seniorityScore: scores.seniorityScoreNormalized,
    projectScore: scores.projectScore,
    relationshipScore: scores.relationshipScoreNormalized,
  };

  await supabase.from("company_score_cache").upsert({
    user_id: userId,
    company_name: company,
    project_relevance_score: scores.projectScore,
    recommendation_score: scores.recommendationScore,
    matching_project_count: matchingProjects.length,
    average_similarity: avgSimilarity,
    connection_score: scores.connectionScore,
    seniority_score: scores.seniorityScoreNormalized,
    top_project_names: topProjects,
    industry: industry || null,
    last_calculated_at: new Date().toISOString(),
  });

  const outreachPrompt = `You are an outreach strategist for WhileOne, a technology consultancy.

Target company: ${match.company}
Recommendation score: ${match.recommendationScore}/100
Connections: ${match.connectionCount}
Top contact: ${match.topContact?.position ?? "Unknown"}

Write a concise 3-4 sentence outreach recommendation explaining why this company is a strong target and the best angle to approach them. Be specific and actionable. Do not fabricate metrics.`;

  let outreachRecommendation = match.suggestedReason;

  try {
    const response = await generateWithFallback(outreachPrompt, "RECOMMENDATION_REASONING");
    outreachRecommendation = response.text?.trim() || match.suggestedReason;
  } catch (error) {
    console.error("Outreach recommendation generation failed:", error);
  }

  return {
    ...match,
    connections: companyConns,
    matchingProjects,
    outreachRecommendation,
  };
}

export async function getRecommendationForEmail(
  supabase: SupabaseClient<Database>,
  userId: string,
  companyName: string
): Promise<{
  recommendation: CompanyRecommendation | null;
  matchingProjects: MatchedChunk[];
}> {
  const detail = await getCompanyDetail(supabase, userId, companyName);

  if (!detail) {
    const matchingProjects = await searchKnowledgeChunks(
      supabase,
      userId,
      companyName,
      3
    );
    return { recommendation: null, matchingProjects };
  }

  const { connections, matchingProjects, outreachRecommendation, ...rec } =
    detail;

  return {
    recommendation: rec,
    matchingProjects,
  };
}
