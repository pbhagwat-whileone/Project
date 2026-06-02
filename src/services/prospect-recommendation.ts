import type { SupabaseClient } from "@supabase/supabase-js";
import { generateWithFallback } from "@/ai/generation";
import type { Connection, Database, MatchedChunk } from "@/types/database";
import type { RankedContact } from "@/types/database";
import { searchKnowledgeChunks } from "@/services/vector-search";
import { scorePosition } from "@/utils/contact-ranking";

export type IndustryExpertise = {
  industry: string;
  projectCount: number;
  expertiseScore: number;
};

export type CompanyRecommendation = {
  company: string;
  industry: string;
  recommendationScore: number;
  connectionCount: number;
  topContact: RankedContact | null;
  matchingProjectCount: number;
  suggestedReason: string;
  country: string | null;
  companySize: string | null;
  revenueBand: string | null;
  industryMatchScore: number;
  connectionScore: number;
  seniorityScore: number;
};

export type CompanyDetail = CompanyRecommendation & {
  connections: Connection[];
  matchingProjects: MatchedChunk[];
  outreachRecommendation: string;
};

type CompanyCacheRow = {
  company_name: string;
  industry: string | null;
  country: string | null;
  company_size: string | null;
  revenue_band: string | null;
};

type ChunkRow = {
  project_name: string | null;
  industry: string | null;
};

function normalizeIndustry(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function industriesMatch(a: string, b: string): boolean {
  const na = normalizeIndustry(a);
  const nb = normalizeIndustry(b);
  if (!na || !nb || na === "unknown" || nb === "unknown") return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export async function analyzeIndustryExpertise(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<IndustryExpertise[]> {
  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("id")
    .eq("user_id", userId);

  const docIds = (docs ?? []).map((d) => d.id);
  if (!docIds.length) return [];

  const { data: chunks } = await supabase
    .from("knowledge_chunks")
    .select("project_name, industry")
    .in("document_id", docIds);

  const projectsByIndustry = new Map<string, Set<string>>();

  for (const chunk of (chunks ?? []) as ChunkRow[]) {
    const industry = chunk.industry?.trim() || "Unknown";
    const projectKey = chunk.project_name?.trim() || "Unknown Project";
    const set = projectsByIndustry.get(industry) ?? new Set<string>();
    set.add(projectKey);
    projectsByIndustry.set(industry, set);
  }

  const maxCount = Math.max(
    ...[...projectsByIndustry.values()].map((s) => s.size),
    1
  );

  return [...projectsByIndustry.entries()]
    .map(([industry, projects]) => ({
      industry,
      projectCount: projects.size,
      expertiseScore: Math.round((projects.size / maxCount) * 100),
    }))
    .sort((a, b) => b.projectCount - a.projectCount);
}

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

async function inferCompanyMetadata(
  supabase: SupabaseClient<Database>,
  userId: string,
  companyName: string,
  connections: Connection[],
  cache: Map<string, CompanyCacheRow>
): Promise<CompanyCacheRow> {
  const cached = cache.get(companyName);
  if (cached?.industry) return cached;

  const titles = connections
    .map((c) => c.position)
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");

  const prompt = `Infer company metadata from LinkedIn connection data.

Company: ${companyName}
Contact titles: ${titles || "Unknown"}

Return ONLY valid JSON:
{
  "industry": "primary industry sector",
  "country": "headquarters country or null",
  "company_size": "employee range estimate or null",
  "revenue_band": "revenue range estimate or null"
}`;

  try {
    const response = await generateWithFallback(prompt, "COMPANY_CLASSIFICATION", {
      responseMimeType: "application/json",
    });

    const parsed = JSON.parse(response.text ?? "{}") as {
      industry?: string;
      country?: string;
      company_size?: string;
      revenue_band?: string;
    };

    const row: CompanyCacheRow = {
      company_name: companyName,
      industry: parsed.industry?.trim() || "Unknown",
      country: parsed.country?.trim() || null,
      company_size: parsed.company_size?.trim() || null,
      revenue_band: parsed.revenue_band?.trim() || null,
    };

    await supabase.from("company_industry_cache").upsert({
      user_id: userId,
      company_name: companyName,
      industry: row.industry,
      country: row.country,
      company_size: row.company_size,
      revenue_band: row.revenue_band,
      updated_at: new Date().toISOString(),
    });

    cache.set(companyName, row);
    return row;
  } catch (error) {
    console.error("Company metadata inference failed:", companyName, error);
    const fallback: CompanyCacheRow = {
      company_name: companyName,
      industry: "Unknown",
      country: null,
      company_size: null,
      revenue_band: null,
    };
    return fallback;
  }
}

function countMatchingProjects(
  expertise: IndustryExpertise[],
  companyIndustry: string
): number {
  for (const exp of expertise) {
    if (industriesMatch(exp.industry, companyIndustry)) {
      return exp.projectCount;
    }
  }
  return 0;
}

function computeIndustryMatchScore(
  companyIndustry: string,
  expertise: IndustryExpertise[]
): number {
  if (!expertise.length) return 0;

  let best = 0;
  for (const exp of expertise) {
    if (industriesMatch(exp.industry, companyIndustry)) {
      best = Math.max(best, exp.expertiseScore);
    }
  }
  return best;
}

function buildSuggestedReason(
  industry: string,
  matchingProjectCount: number,
  connectionCount: number,
  topContact: RankedContact | null
): string {
  const parts: string[] = [];

  if (matchingProjectCount > 0) {
    parts.push(
      `Strong ${industry} project history (${matchingProjectCount} matching project${matchingProjectCount === 1 ? "" : "s"})`
    );
  }

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
  industryMatchScore: number,
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
    industryMatchScore * 0.6 +
    connectionScore * 0.2 +
    seniorityScoreNormalized * 0.2;

  return {
    recommendationScore: Math.round(recommendationScore),
    connectionScore: Math.round(connectionScore),
    seniorityScoreNormalized: Math.round(seniorityScoreNormalized),
  };
}

async function loadCompanyCache(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Map<string, CompanyCacheRow>> {
  const { data } = await supabase
    .from("company_industry_cache")
    .select("company_name, industry, country, company_size, revenue_band")
    .eq("user_id", userId);

  const map = new Map<string, CompanyCacheRow>();
  for (const row of data ?? []) {
    map.set(row.company_name, row);
  }
  return map;
}

export async function getCompanyRecommendations(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CompanyRecommendation[]> {
  const [{ data: connections }, expertise, cache] = await Promise.all([
    supabase.from("connections").select("*").eq("user_id", userId),
    analyzeIndustryExpertise(supabase, userId),
    loadCompanyCache(supabase, userId),
  ]);

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
    const metadata = await inferCompanyMetadata(
      supabase,
      userId,
      company,
      companyConnections,
      cache
    );

    const topContact = pickTopContact(companyConnections);
    const industry = metadata.industry ?? "Unknown";
    const industryMatchScore = computeIndustryMatchScore(industry, expertise);
    const matchingProjectCount = countMatchingProjects(expertise, industry);
    const seniorityRaw = topContact?.score ?? 0;

    const scores = scoreRecommendation(
      industryMatchScore,
      companyConnections.length,
      maxConnections,
      seniorityRaw
    );

    recommendations.push({
      company,
      industry,
      recommendationScore: scores.recommendationScore,
      connectionCount: companyConnections.length,
      topContact,
      matchingProjectCount,
      suggestedReason: buildSuggestedReason(
        industry,
        matchingProjectCount,
        companyConnections.length,
        topContact
      ),
      country: metadata.country,
      companySize: metadata.company_size,
      revenueBand: metadata.revenue_band,
      industryMatchScore,
      connectionScore: scores.connectionScore,
      seniorityScore: scores.seniorityScoreNormalized,
    });
  }


  return recommendations.sort(
    (a, b) => b.recommendationScore - a.recommendationScore
  );
}

const CACHE_COMPANY_NAME = "__CACHED_RECOMMENDATIONS__";

export async function generateAndCacheRecommendations(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CompanyRecommendation[]> {
  const recommendations = await getCompanyRecommendations(supabase, userId);
  
  await supabase.from("company_industry_cache").upsert({
    user_id: userId,
    company_name: CACHE_COMPANY_NAME,
    industry: JSON.stringify(recommendations),
    country: null,
    company_size: null,
    revenue_band: null,
    updated_at: new Date().toISOString(),
  });

  return recommendations;
}

export async function getCachedRecommendations(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CompanyRecommendation[]> {
  const { data } = await supabase
    .from("company_industry_cache")
    .select("industry")
    .eq("user_id", userId)
    .eq("company_name", CACHE_COMPANY_NAME)
    .single();

  if (!data?.industry) return [];

  try {
    return JSON.parse(data.industry) as CompanyRecommendation[];
  } catch (error) {
    console.error("Failed to parse cached recommendations", error);
    return [];
  }
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
  const [expertise, cache] = await Promise.all([
    analyzeIndustryExpertise(supabase, userId),
    loadCompanyCache(supabase, userId),
  ]);

  const metadata = await inferCompanyMetadata(
    supabase,
    userId,
    company,
    companyConns,
    cache
  );

  const topContact = pickTopContact(companyConns);
  const industry = metadata.industry ?? "Unknown";
  const industryMatchScore = computeIndustryMatchScore(industry, expertise);
  const matchingProjectCount = countMatchingProjects(expertise, industry);
  const maxConnections = Math.max(
    ...[...grouped.values()].map((g) => g.length),
    1
  );
  const scores = scoreRecommendation(
    industryMatchScore,
    companyConns.length,
    maxConnections,
    topContact?.score ?? 0
  );

  const match: CompanyRecommendation = {
    company,
    industry,
    recommendationScore: scores.recommendationScore,
    connectionCount: companyConns.length,
    topContact,
    matchingProjectCount,
    suggestedReason: buildSuggestedReason(
      industry,
      matchingProjectCount,
      companyConns.length,
      topContact
    ),
    country: metadata.country,
    companySize: metadata.company_size,
    revenueBand: metadata.revenue_band,
    industryMatchScore,
    connectionScore: scores.connectionScore,
    seniorityScore: scores.seniorityScoreNormalized,
  };

  const query = `${match.company} ${match.industry} ${match.topContact?.position ?? ""}`;
  const matchingProjects = await searchKnowledgeChunks(
    supabase,
    userId,
    query,
    5
  );

  const expertiseSummary = expertise
    .slice(0, 6)
    .map((e) => `${e.industry}: ${e.projectCount} projects`)
    .join("\n");

  const outreachPrompt = `You are an outreach strategist for WhileOne, a technology consultancy.

Target company: ${match.company}
Industry: ${match.industry}
Recommendation score: ${match.recommendationScore}/100
Connections: ${match.connectionCount}
Top contact: ${match.topContact?.position ?? "Unknown"}
Matching projects: ${match.matchingProjectCount}

WhileOne industry expertise:
${expertiseSummary || "No project history available."}

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
  expertise: IndustryExpertise[];
  matchingProjects: MatchedChunk[];
}> {
  const detail = await getCompanyDetail(supabase, userId, companyName);
  const expertise = await analyzeIndustryExpertise(supabase, userId);

  if (!detail) {
    const matchingProjects = await searchKnowledgeChunks(
      supabase,
      userId,
      companyName,
      3
    );
    return { recommendation: null, expertise, matchingProjects };
  }

  const { connections, matchingProjects, outreachRecommendation, ...rec } =
    detail;

  return {
    recommendation: rec,
    expertise,
    matchingProjects,
  };
}
