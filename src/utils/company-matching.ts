import FuzzySet from "fuzzyset";
import type { Connection } from "@/types/database";
import type { RankedContact } from "@/types/database";
import { scorePosition } from "@/utils/contact-ranking";

function normalizeCompany(name: string): string {
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
  console.log("========================================");
  console.log("FIND BEST CONTACT START");
  console.log("RAW QUERY:", companyQuery);

  if (!connections.length) {
    console.log("NO CONNECTIONS");
    return null;
  }

  const normalizedQuery = normalizeCompany(companyQuery);

  console.log("NORMALIZED QUERY:", normalizedQuery);
  console.log("TOTAL CONNECTIONS:", connections.length);

  const exactMatches = connections.filter((c) => {
    if (!c.company) return false;
    return normalizeCompany(c.company) === normalizedQuery;
  });

  const prefixMatches = connections.filter((c) => {
    if (!c.company) return false;

    const company = normalizeCompany(c.company);

    if (!company || !normalizedQuery) {
      return false;
    }

    return company.startsWith(normalizedQuery);
  });

  const containsMatches = connections.filter((c) => {
    if (!c.company) return false;

    const company = normalizeCompany(c.company);

    if (!company || !normalizedQuery) {
      return false;
    }

    return company.includes(normalizedQuery);
  });

  console.log(
    "EXACT MATCHES:",
    exactMatches.map((c) => ({
      company: c.company,
      position: c.position,
    }))
  );

  console.log(
    "PREFIX MATCHES:",
    prefixMatches.map((c) => ({
      company: c.company,
      position: c.position,
    }))
  );

  console.log(
    "CONTAINS MATCHES:",
    containsMatches.map((c) => ({
      company: c.company,
      position: c.position,
    }))
  );

  if (exactMatches.length > 0) {
    const result = pickBestFromPool(exactMatches);

    console.log("RETURNING EXACT MATCH:");
    console.log({
      company: result?.company,
      name: `${result?.first_name ?? ""} ${result?.last_name ?? ""}`.trim(),
      position: result?.position,
    });

    return result;
  }

  if (prefixMatches.length > 0) {
    const result = pickBestFromPool(prefixMatches);

    console.log("RETURNING PREFIX MATCH:");
    console.log({
      company: result?.company,
      name: `${result?.first_name ?? ""} ${result?.last_name ?? ""}`.trim(),
      position: result?.position,
    });

    return result;
  }

  if (containsMatches.length > 0) {
    const result = pickBestFromPool(containsMatches);

    console.log("RETURNING CONTAINS MATCH:");
    console.log({
      company: result?.company,
      name: `${result?.first_name ?? ""} ${result?.last_name ?? ""}`.trim(),
      position: result?.position,
    });

    return result;
  }

  if (normalizedQuery.length <= 4) {
    console.log("SHORT QUERY PROTECTION TRIGGERED");
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

  console.log("UNIQUE COMPANIES:", companies.length);

  console.log(
    "COMPANIES CONTAINING QUERY:",
    companies.filter((c) =>
      normalizeCompany(c).includes(normalizedQuery)
    )
  );

  console.log(
    "FIRST 50 COMPANIES:",
    companies.slice(0, 50)
  );

  const fs = new FuzzySet(companies);

  const results = fs.get(companyQuery, null, threshold);

  if (!results || results.length === 0) {
    console.log("NO FUZZY MATCHES");
    return null;
  }

  console.log("FUZZY RESULTS:");
  console.log(results.slice(0, 10));

  const matchedCompany = results[0][1] as string;

  console.log("SELECTED FUZZY COMPANY:", matchedCompany);

  const pool = connections.filter(
    (c) => c.company === matchedCompany
  );

  console.log(
    "FUZZY POOL:",
    pool.map((c) => ({
      company: c.company,
      position: c.position,
    }))
  );

  const result = pickBestFromPool(pool);

  console.log("RETURNING FUZZY MATCH:");
  console.log({
    company: result?.company,
    name: `${result?.first_name ?? ""} ${result?.last_name ?? ""}`.trim(),
    position: result?.position,
  });

  console.log("========================================");

  return result;
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
