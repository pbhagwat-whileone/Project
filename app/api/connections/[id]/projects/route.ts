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
      .maybeSingle() as { data: any };

    if (cache) {
      const generatedAt = new Date(cache.generated_at);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      if (generatedAt > thirtyDaysAgo && cache.matched_projects && cache.matched_projects.length > 0) {
        console.log("[ProjectMatching Cache] Loaded:", cache.matched_projects.length, "projects");
        return NextResponse.json({
          projects: cache.matched_projects,
          source: "cache",
        });
      }
    }

    // Cache missing or expired, generate new matches
    const { data: profile } = await supabase
      .from("connection_profiles")
      .select("expertise_tags, technology_tags, activity_signals, headline")
      .eq("connection_id", connectionId)
      .maybeSingle();

    let profileData = profile;

    if (!profileData) {
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
              headline: enriched.headline,
            };
          }
        } catch (enrichErr) {
          console.error("[ProjectMatching] Auto-enrichment failed:", enrichErr);
        }
      }
    }

    const safeProfile = profileData || { expertise_tags: [], technology_tags: [], activity_signals: [], headline: null };

    console.log("--- PROJECT MATCHING PIPELINE TRACE ---");
    console.log("1. Profile enrichment values:");
    console.log("   - expertise_tags:", safeProfile.expertise_tags);
    console.log("   - technology_tags:", safeProfile.technology_tags);
    console.log("   - activity_signals:", safeProfile.activity_signals);

    const queryParts: string[] = [];

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

    let projects: MatchedChunk[] = [];
    let queryUsed = "";

    if (finalQuery) {
      queryUsed = finalQuery;
      console.log("2. Final retrieval query sent to vector search:", queryUsed);
      projects = await searchKnowledgeChunks(supabase, user.id, finalQuery, 3);
    } else {
      const { data: conn } = await supabase
        .from("connections")
        .select("company, position")
        .eq("id", connectionId)
        .maybeSingle();

      const fallbackQuery = [conn?.company, conn?.position, safeProfile.headline].filter(Boolean).join(" ");
      const ultimateQuery = fallbackQuery || "software engineering technology consulting projects";
      queryUsed = ultimateQuery;
      console.log("2. Final retrieval query sent to vector search (FALLBACK):", queryUsed);
      projects = await searchKnowledgeChunks(supabase, user.id, ultimateQuery, 3);
    }

    const projectsWithSummary = projects.map((p) => ({
      ...p,
      summary: p.chunk_text.slice(0, 200),
    }));

    console.log("[ProjectMatching] Writing Cache:", projectsWithSummary.length, "projects");
    console.log("[ProjectMatching] Cache Payload:", projectsWithSummary);

    // Upsert to cache
    await supabase.from("connection_project_cache").upsert({
      connection_id: connectionId,
      user_id: user.id,
      retrieval_query: finalQuery || "fallback",
      matched_projects: projectsWithSummary,
      generated_at: new Date().toISOString(),
    } as any);

    console.log("[ProjectMatching API] Returning Projects Count:", projectsWithSummary.length);
    console.log("[ProjectMatching API] Returning Projects Payload:", projectsWithSummary);

    return NextResponse.json({
      projects: projectsWithSummary,
      source: "generated",
    });
  } catch (err) {
    console.error("[ProjectMatching API Error]:", err);
    const message = err instanceof Error ? err.message : "Failed to generate projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
