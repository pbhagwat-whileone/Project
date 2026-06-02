import FuzzySet from "fuzzyset";
import type { Connection } from "@/types/database";
import type { RankedContact } from "@/types/database";
import { scorePosition } from "@/utils/contact-ranking";

function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company)\b\.?/gi, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findBestContact(
  companyQuery: string,
  connections: Connection[],
  threshold = 0.75
): RankedContact | null {
  if (!connections.length) return null;

  const normalizedQuery = normalizeCompany(companyQuery);

  // 1. Partial/contains matching first
  const containsMatches = connections.filter((c) => {
    if (!c.company) return false;

    const company = normalizeCompany(c.company);

    return (
      company.includes(normalizedQuery) ||
      normalizedQuery.includes(company)
    );
  });

  if (containsMatches.length > 0) {
    return pickBestFromPool(containsMatches);
  }

  // 2. Build company list for fuzzy matching
  const companies = [
    ...new Set(
      connections
        .map((c) => c.company?.trim())
        .filter((c): c is string => Boolean(c))
    ),
  ];

  if (!companies.length) return null;

  const fs = new FuzzySet(companies);
  const results = fs.get(companyQuery, null, threshold);

  if (!results || results.length === 0) {
    // 3. Exact normalized fallback
    const direct = connections.filter(
      (c) =>
        c.company &&
        normalizeCompany(c.company) === normalizedQuery
    );

    if (!direct.length) return null;

    return pickBestFromPool(direct);
  }

  // 4. Best fuzzy match
  const matchedCompany = results[0][1] as string;

  const pool = connections.filter(
    (c) => c.company === matchedCompany
  );

  return pickBestFromPool(pool);
}

function pickBestFromPool(pool: Connection[]): RankedContact | null {
  if (!pool.length) return null;

  const ranked = pool
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
