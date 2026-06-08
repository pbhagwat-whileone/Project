import { NextResponse } from "next/server";
import { companySearchSchema } from "@/lib/validators";
import { createClient, requireUser } from "@/lib/supabase/server";
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
    const { data: connections } = await supabase
      .from("connections")
      .select("*")
      .eq("user_id", user.id);

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
