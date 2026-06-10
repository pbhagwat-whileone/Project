import FuzzySet from "fuzzyset";
import type { Connection, RankedContact } from "@/types/database";

const TITLE_RANKS: { pattern: RegExp; score: number }[] = [
  { pattern: /\bfounder\b/i, score: 100 },
  { pattern: /\bco-?founder\b/i, score: 99 },
  { pattern: /\bceo\b/i, score: 95 },
  { pattern: /\bcto\b/i, score: 90 },
  { pattern: /\bcio\b/i, score: 88 },
  { pattern: /\bchief\b/i, score: 85 },
  { pattern: /\bvp\b|\bvice president\b/i, score: 80 },
  { pattern: /\bdirector\b/i, score: 70 },
  { pattern: /\bhead of\b|\bhead,\b/i, score: 65 },
  { pattern: /\bmanager\b/i, score: 55 },
  { pattern: /\blead\b/i, score: 50 },
  { pattern: /\bsenior engineer\b/i, score: 40 },
  { pattern: /\bengineer\b/i, score: 30 },
];

export function scorePosition(position: string | null | undefined): number {
  if (!position) return 0;
  let max = 0;
  for (const { pattern, score } of TITLE_RANKS) {
    if (pattern.test(position)) {
      max = Math.max(max, score);
    }
  }
  return max;
}

export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function findRecommendedContacts(
  companyQuery: string,
  connections: Connection[],
  threshold = 0.75
): RankedContact[] {
  if (!connections.length) {
    return [];
  }

  const normalizedQuery = normalizeCompany(companyQuery);

  const exactMatches = connections.filter((c) => {
    if (!c.company) return false;
    return normalizeCompany(c.company) === normalizedQuery;
  });

  const prefixMatches = connections.filter((c) => {
    if (!c.company) return false;
    const company = normalizeCompany(c.company);
    return company && normalizedQuery && company.startsWith(normalizedQuery);
  });

  const containsMatches = connections.filter((c) => {
    if (!c.company) return false;
    const company = normalizeCompany(c.company);
    return company && normalizedQuery && company.includes(normalizedQuery);
  });

  let pool: Connection[] = [];

  if (exactMatches.length > 0) {
    pool = exactMatches;
  } else if (prefixMatches.length > 0) {
    pool = prefixMatches;
  } else if (containsMatches.length > 0) {
    pool = containsMatches;
  } else if (normalizedQuery.length > 4) {
    const companies = [
      ...new Set(
        connections
          .map((c) => c.company?.trim())
          .filter((c): c is string => Boolean(c))
      ),
    ];
    const fs = new FuzzySet(companies);
    const results = fs.get(companyQuery, null, threshold);

    if (results && results.length > 0) {
      const matchedCompany = results[0][1] as string;
      pool = connections.filter((c) => c.company === matchedCompany);
    }
  }

  if (pool.length === 0) return [];

  // Default ranking (just by seniority)
  return pool
    .map((c) => ({
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      company: c.company,
      position: c.position,
      email: c.email,
      profile_url: c.profile_url,
      score: scorePosition(c.position),
      connection_owner_name: c.connection_owner_name,
    }))
    .sort((a, b) => b.score - a.score);
}

export function rankContactsWithMetrics(
  rankedContacts: RankedContact[],
  metricsMap: Record<string, any>
): RankedContact[] {
  return rankedContacts.map(contact => {
    const metrics = metricsMap[contact.id];
    let relationshipScore = 0;
    let recencyScore = 0;
    let totalMessages = 0;
    let lastContactDate = null;
    let relationshipClassification = null;

    if (metrics) {
      totalMessages = metrics.message_count || 0;
      const conversationCount = metrics.conversation_count || 0;
      
      // Compute core relationship sub-score (0-100)
      relationshipScore = Math.min(100, (totalMessages * 2) + (conversationCount * 10));

      if (metrics.last_contact_date) {
        lastContactDate = metrics.last_contact_date;
        const daysSince = (Date.now() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24);
        recencyScore = Math.max(0, 100 - daysSince);
      }

      relationshipClassification = metrics.relationship_classification;
    }

    const seniorityScore = contact.score || 0;
    
    // Total Score = (Relationship * 0.6) + (Seniority * 0.25) + (Recency * 0.15)
    const combinedScore = (relationshipScore * 0.6) + (seniorityScore * 0.25) + (recencyScore * 0.15);

    return {
      ...contact,
      relationship_score: Math.round(combinedScore), // Note: returning combined score in this field for UI
      total_messages: totalMessages,
      last_interaction_date: lastContactDate,
      relationship_classification: relationshipClassification,
      conversation_summary: metrics?.conversation_summary || null,
      discussion_topics: metrics?.discussion_topics || null,
      interaction_timeline: metrics?.interaction_timeline || null,
      recent_highlights: metrics?.recent_highlights || null
    };
  }).sort((a, b) => (b.relationship_score || 0) - (a.relationship_score || 0));
}
