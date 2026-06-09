import { NextResponse } from "next/server";
import { companySearchSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/lib/supabase/server";
import { fetchAllRecords } from "@/utils/supabase-utils";
import { findBestContact } from "@/utils/company-utils";
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

    console.log("Actual Connection Count:", actualCount);
    console.log("Returned Connection Count:", connections.length);

    if (parsed.data.company === "SiPearl") {
      const siPearlExistsInFetch = connections.some(
        c => c.company?.toLowerCase().includes("sipearl")
      );
      console.log("SiPearl exists in fetched data:", siPearlExistsInFetch);
    }

    console.log("SEARCH QUERY:", parsed.data.company);
    console.log("TOTAL CONNECTIONS:", connections?.length);

    const siPearlRecords = (connections ?? []).filter(
      c => c.company === "SiPearl"
    );

    console.log("SIPEARL RECORDS FOUND:", siPearlRecords.length);
    console.log("SIPEARL RECORDS:", siPearlRecords);

    const contact = findBestContact(
      parsed.data.company,
      connections ?? []
    );

    if (!contact) {
      return NextResponse.json({
        contact: null,
        projects: [],
        message: "No matching company could be identified, so project recommendations were not generated.",
      });
    }

    const { data: metrics } = await supabase
      .from("connection_relationship_metrics")
      .select("*")
      .eq("connection_id", contact.id)
      .single();

    if (metrics) {
      contact.relationship_score = metrics.relationship_score;
      contact.conversation_summary = metrics.conversation_summary;
    }

    const rawQuery = parsed.data.company;
    const normalizedQuery = rawQuery.toLowerCase().trim();
    const resolvedCompany = contact?.company || rawQuery;
    const contactTitle = contact?.position || "";

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
      contact,
      projects: projects.map((p) => ({
        ...p,
        summary: p.chunk_text.slice(0, 200),
      })),
      message: contact ? null : "No LinkedIn connection found.",
    });


  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
