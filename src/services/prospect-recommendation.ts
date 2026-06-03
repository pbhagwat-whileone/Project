import type { SupabaseClient } from "@supabase/supabase-js";
import { generateWithFallback } from "@/ai/generation";
import type { Connection, Database, MatchedChunk } from "@/types/database";
import type { RankedContact } from "@/types/database";
import { searchKnowledgeChunks } from "@/services/vector-search";
import { scorePosition } from "@/utils/company-utils";

export type CompanyRecommendation = {
  company: string;
  recommendationScore: number;
  connectionCount: number;
  topContact: RankedContact | null;
  suggestedReason: string;
  connectionScore: number;
  seniorityScore: number;
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

function pickTopContact(connections: Connection[]): RankedContact | null {
  if (!connections.length) return null;

  const ranked = connections
    .map((c) => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      company: c.company,
      position: c.position,
      email: c.email,
      profile_url: c.profile_url,
      score: scorePosition(c.position),
    }))
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
  connectionCount: number,
  maxConnections: number,
  seniorityScore: number
): {
  recommendationScore: number;
  connectionScore: number;
  seniorityScoreNormalized: number;
} {
  const connectionScore =
    maxConnections > 0 ? (connectionCount / maxConnections) * 100 : 0;
  const seniorityScoreNormalized = Math.min(seniorityScore, 100);

  const recommendationScore =
    connectionScore * 0.5 +
    seniorityScoreNormalized * 0.5;

  return {
    recommendationScore: Math.round(recommendationScore),
    connectionScore: Math.round(connectionScore),
    seniorityScoreNormalized: Math.round(seniorityScoreNormalized),
  };
}

export async function getCompanyRecommendations(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CompanyRecommendation[]> {
  const { data: connections } = await supabase
    .from("connections")
    .select("*")
    .eq("user_id", userId);

  const grouped = groupConnectionsByCompany(connections ?? []);
  if (!grouped.size) {
    return [];
  }

  const maxConnections = Math.max(
    ...[...grouped.values()].map((g) => g.length),
    1
  );

  const recommendations: CompanyRecommendation[] = [];

  for (const [company, companyConnections] of grouped) {
    const topContact = pickTopContact(companyConnections);
    const seniorityRaw = topContact?.score ?? 0;

    const scores = scoreRecommendation(
      companyConnections.length,
      maxConnections,
      seniorityRaw
    );

    recommendations.push({
      company,
      recommendationScore: scores.recommendationScore,
      connectionCount: companyConnections.length,
      topContact,
      suggestedReason: buildSuggestedReason(
        companyConnections.length,
        topContact
      ),
      connectionScore: scores.connectionScore,
      seniorityScore: scores.seniorityScoreNormalized,
    });
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
  const { data: connections } = await supabase
    .from("connections")
    .select("*")
    .eq("user_id", userId);

  const grouped = groupConnectionsByCompany(connections ?? []);
  const companyConnections = [...grouped.entries()].find(
    ([name]) => name.toLowerCase() === companyName.toLowerCase()
  );

  if (!companyConnections) return null;

  const [company, companyConns] = companyConnections;
  const topContact = pickTopContact(companyConns);

  const maxConnections = Math.max(
    ...[...grouped.values()].map((g) => g.length),
    1
  );
  const scores = scoreRecommendation(
    companyConns.length,
    maxConnections,
    topContact?.score ?? 0
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
  };

  const query = `${match.company} ${match.topContact?.position ?? ""}`;
  const matchingProjects = await searchKnowledgeChunks(
    supabase,
    userId,
    query,
    5
  );

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
