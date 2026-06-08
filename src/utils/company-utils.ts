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

export function findBestContact(
  companyQuery: string,
  connections: Connection[],
  threshold = 0.75
): RankedContact | null {
  if (!connections.length) {
    return null;
  }

  const normalizedQuery = normalizeCompany(companyQuery);

  console.log("RAW QUERY:", companyQuery);
  console.log("NORMALIZED QUERY:", normalizedQuery);

  const siPearlExists = connections.some(
    c => c.company === "SiPearl"
  );
  if (companyQuery === "SiPearl") {
    console.log("SIPEARL EXISTS:", siPearlExists);
  }

  const siPearlCompanies = connections
    .filter(c => c.company?.includes("SiPearl"))
    .map(c => ({
      original: c.company,
      normalized: normalizeCompany(c.company as string)
    }));
  console.log("SIPEARL COMPANIES:", siPearlCompanies);

  const exactMatches = connections.filter((c) => {
    if (!c.company) return false;
    return normalizeCompany(c.company) === normalizedQuery;
  });

  console.log("EXACT MATCH COUNT:", exactMatches.length);
  if (exactMatches.length > 0) {
    console.log(
      "EXACT MATCH COMPANIES:",
      exactMatches.map(c => c.company)
    );
  }

  const prefixMatches = connections.filter((c) => {
    if (!c.company) return false;

    const company = normalizeCompany(c.company);

    if (!company || !normalizedQuery) {
      return false;
    }

    return company.startsWith(normalizedQuery);
  });

  console.log("PREFIX MATCH COUNT:", prefixMatches.length);

  const containsMatches = connections.filter((c) => {
    if (!c.company) return false;

    const company = normalizeCompany(c.company);

    if (!company || !normalizedQuery) {
      return false;
    }

    return company.includes(normalizedQuery);
  });

  console.log("CONTAINS MATCH COUNT:", containsMatches.length);

  if (exactMatches.length > 0) {
    console.log("RETURNING EXACT MATCH");
    return pickBestFromPool(exactMatches);
  }

  if (prefixMatches.length > 0) {
    console.log("RETURNING PREFIX MATCH");
    return pickBestFromPool(prefixMatches);
  }

  if (containsMatches.length > 0) {
    console.log("RETURNING CONTAINS MATCH");
    return pickBestFromPool(containsMatches);
  }

  if (normalizedQuery.length <= 4) {
    console.log("NO MATCH FOUND");
    return null;
  }

  const companies = [
    ...new Set(
      connections
        .map((c) => c.company?.trim())
        .filter((c): c is string => Boolean(c))
    ),
  ];

  const fs = new FuzzySet(companies);

  const results = fs.get(companyQuery, null, threshold);

  if (!results || results.length === 0) {
    console.log("NO MATCH FOUND");
    return null;
  }

  console.log("FUZZY RESULTS:", results);
  const matchedCompany = results[0][1] as string;

  console.log("RETURNING FUZZY MATCH:", matchedCompany);

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
