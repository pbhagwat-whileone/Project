import { NextResponse } from "next/server";
import { companySearchSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/lib/supabase/server";
import { fetchAllRecords } from "@/utils/supabase-utils";
import { findRecommendedContacts, rankContactsWithMetrics } from "@/utils/company-utils";
import { searchKnowledgeChunks } from "@/services/vector-search";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = companySearchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { count: actualCount } = await supabase
      .from("connections")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const queryBuilder = supabase
      .from("connections")
      .select("*")
      .eq("user_id", user.id);

    const connections = await fetchAllRecords<any>(queryBuilder);

    const uniqueMap = new Map<string, any>();
    connections.forEach((c: any) => {
      const key = c.profile_url?.toLowerCase()?.trim() || `${c.first_name?.toLowerCase()?.trim() || ""}|${c.last_name?.toLowerCase()?.trim() || ""}|${c.company?.toLowerCase()?.trim() || ""}`;
      
      if (uniqueMap.has(key)) {
        const existing = uniqueMap.get(key)!;
        if (c.connection_owner_name && !existing.connection_owners.includes(c.connection_owner_name)) {
          existing.connection_owners.push(c.connection_owner_name);
        }
      } else {
        uniqueMap.set(key, { ...c, connection_owners: c.connection_owner_name ? [c.connection_owner_name] : [] });
      }
    });

    const groupedConnections = Array.from(uniqueMap.values()).map(c => ({
      ...c,
      connection_owner_name: c.connection_owners.join(", ")
    }));

    console.log("Actual Connection Count:", actualCount);
    console.log("Grouped Connection Count:", groupedConnections.length);

    if (parsed.data.company === "SiPearl") {
      const siPearlExistsInFetch = groupedConnections.some(
        c => c.company?.toLowerCase().includes("sipearl")
      );
      console.log("SiPearl exists in fetched data:", siPearlExistsInFetch);
    }

    console.log("SEARCH QUERY:", parsed.data.company);
    console.log("TOTAL CONNECTIONS:", groupedConnections?.length);

    const siPearlRecords = (groupedConnections ?? []).filter(
      c => c.company === "SiPearl"
    );

    console.log("SIPEARL RECORDS FOUND:", siPearlRecords.length);
    console.log("SIPEARL RECORDS:", siPearlRecords);

    const recommendedContacts = findRecommendedContacts(
      parsed.data.company,
      groupedConnections ?? []
    );

    if (!recommendedContacts.length) {
      return NextResponse.json({
        contacts: [],
        projects: [],
        message: "No matching company could be identified, so project recommendations were not generated.",
      });
    }

    // Fetch metrics for all recommended contacts
    const contactIds = recommendedContacts.map(c => c.id);

    const { data: metricsData } = await supabase
      .from("connection_relationship_metrics")
      .select("*")
      .in("connection_id", contactIds);

    const metricsMap: Record<string, any> = {};
    metricsData?.forEach(m => {
      metricsMap[m.connection_id] = m;
    });

    const rankedContacts = rankContactsWithMetrics(recommendedContacts, metricsMap);
    
    // Default to the very top contact to drive semantic search
    const primaryContact = rankedContacts[0];

    const rawQuery = parsed.data.company;
    const normalizedQuery = rawQuery.toLowerCase().trim();
    const resolvedCompany = primaryContact?.company || rawQuery;
    const contactTitle = primaryContact?.position || "";

    const { data: cacheRow } = await supabase
      .from("company_industry_cache")
      .select("industry")
      .eq("user_id", user.id)
      .ilike("company_name", resolvedCompany)
      .maybeSingle();

    const industry = cacheRow?.industry && cacheRow.industry !== "Unknown" 
      ? cacheRow.industry 
      : "";

    const queryParts = [resolvedCompany];
    if (contactTitle) queryParts.push(contactTitle);
    if (industry) queryParts.push(industry);
    
    // Build semantic query using company, role, and industry
    const finalQuery = queryParts.join(" ").trim();

    let projects = await searchKnowledgeChunks(
      supabase,
      user.id,
      finalQuery,
      3
    );

    if (projects.length === 0) {
      // Fallback search if exact company name matching yields zero results
      const fallbackQueryParts = [];
      if (industry) fallbackQueryParts.push(industry);
      if (contactTitle) fallbackQueryParts.push(contactTitle);
      
      const fallbackQuery = fallbackQueryParts.join(" ").trim();
      
      if (fallbackQuery && fallbackQuery !== finalQuery) {
        projects = await searchKnowledgeChunks(
          supabase,
          user.id,
          fallbackQuery,
          3
        );
      }
    }


    return NextResponse.json({
      contacts: rankedContacts,
      projects: projects.map((p) => ({
        ...p,
        summary: p.chunk_text.slice(0, 200),
      })),
      message: rankedContacts.length ? null : "No LinkedIn connection found.",
    });


  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
