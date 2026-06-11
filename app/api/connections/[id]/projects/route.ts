import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/lib/supabase/server";
import { searchKnowledgeChunks } from "@/services/vector-search";
import { enrichProfile } from "@/services/tavily-profile-enrichment";
import type { MatchedChunk } from "@/types/database";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: connectionId } = await params;

    if (!connectionId) {
      return NextResponse.json({ error: "Connection ID is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Check cache
    const { data: cache } = await supabase
      .from("connection_project_cache")
      .select("*")
      .eq("connection_id", connectionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (cache) {
      const generatedAt = new Date(cache.generated_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      if (generatedAt > thirtyDaysAgo) {
        console.log("[ProjectMatching Cache] Loaded:", cache.matched_projects);
        return NextResponse.json({
          projects: cache.matched_projects,
          source: "cache",
        });
      }
    }

    // Cache missing or expired, generate new matches
    const { data: profile } = await supabase
      .from("connection_profiles")
      .select("expertise_tags, technology_tags, activity_signals")
      .eq("connection_id", connectionId)
      .maybeSingle();

    let profileData = profile;

    if (!profileData) {
      console.log("[ProjectMatching] Connection ID:", connectionId);
      console.log("[ProjectMatching] Profile Lookup Result:", profileData);
      console.log("[ProjectMatching] Profile Table Source:", "connection_profiles");
      console.log("[ProjectMatching] Auto-triggering Profile Enrichment...");

      const { data: conn } = await supabase
        .from("connections")
        .select("profile_url")
        .eq("id", connectionId)
        .maybeSingle();

      if (conn?.profile_url) {
        try {
          const enriched = await enrichProfile(supabase, connectionId, conn.profile_url);
          if (enriched) {
            profileData = {
              expertise_tags: enriched.expertise_tags,
              technology_tags: enriched.technology_tags,
              activity_signals: enriched.activity_signals,
            };
          }
        } catch (enrichErr) {
          console.error("[ProjectMatching] Auto-enrichment failed:", enrichErr);
        }
      }
    }

    const safeProfile = profileData || { expertise_tags: [], technology_tags: [], activity_signals: [] };

    console.log("[ProjectMatching] Expertise:", safeProfile.expertise_tags);
    console.log("[ProjectMatching] Technology:", safeProfile.technology_tags);
    console.log("[ProjectMatching] Activity:", safeProfile.activity_signals);

    const queryParts: string[] = [];
    
    console.log("[ProjectMatching] Connection:", connectionId);
    console.log("[ProjectMatching] Expertise Tags:", safeProfile.expertise_tags);
    console.log("[ProjectMatching] Technology Tags:", safeProfile.technology_tags);
    console.log("[ProjectMatching] Activity Signals:", safeProfile.activity_signals);

    if (Array.isArray(safeProfile.expertise_tags)) {
      queryParts.push(safeProfile.expertise_tags.join(" "));
    }
    if (Array.isArray(safeProfile.technology_tags)) {
      queryParts.push(safeProfile.technology_tags.join(" "));
    }
    if (Array.isArray(safeProfile.activity_signals)) {
      queryParts.push(safeProfile.activity_signals.join(" "));
    }

    const finalQuery = queryParts.join(" ").trim();
    console.log("[ProjectMatching] Retrieval Query:", finalQuery);

    let projects: MatchedChunk[] = [];

    if (finalQuery) {
      projects = await searchKnowledgeChunks(supabase, user.id, finalQuery, 3);
    } else {
      // Fallback if no tags: get connection role/company
      const { data: conn } = await supabase
        .from("connections")
        .select("company, position")
        .eq("id", connectionId)
        .maybeSingle();
      
      if (conn) {
        const fallbackQuery = [conn.company, conn.position].filter(Boolean).join(" ");
        if (fallbackQuery) {
          projects = await searchKnowledgeChunks(supabase, user.id, fallbackQuery, 3);
        }
      }
    }

    const projectsWithSummary = projects.map((p) => ({
      ...p,
      summary: p.chunk_text.slice(0, 200),
    }));

    // Upsert to cache
    console.log("[ProjectMatching] Writing Cache:", projectsWithSummary.length);
    await supabase.from("connection_project_cache").upsert({
      connection_id: connectionId,
      user_id: user.id,
      retrieval_query: finalQuery,
      matched_projects: projectsWithSummary,
      generated_at: new Date().toISOString(),
    });

    console.log("[ProjectMatching API] Returning Projects:", projectsWithSummary);
    console.log("[ProjectMatching API] Count:", projectsWithSummary.length);
    return NextResponse.json({
      projects: projectsWithSummary,
      source: "generated",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
