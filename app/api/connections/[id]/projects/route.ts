import { NextResponse } from "next/server";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";
import { searchKnowledgeChunks } from "@/infrastructure/vector-store/vectorSearch";
import { enrichProfile } from "@/services/integrations/tavily/tavilyProfileEnrichment";
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

    // Cache mechanism disabled due to removal of connection_project_cache
    // Generating new matches directly
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
      projects = await searchKnowledgeChunks(supabase, user.id, ultimateQuery, 3);
    }

    const projectsWithSummary = projects.map((p) => ({
      ...p,
      summary: p.chunk_text.slice(0, 200),
    }));


    // Upsert to cache logic removed (connection_project_cache table deleted)
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
