import { NextResponse } from "next/server";
import { fetchEvents } from "@/domains/discover/services/eventsIntelligence";
import { createClient, requireUser } from "@/infrastructure/database/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    await requireUser();

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    // Read the cache regardless, because we need it as a fallback if Tavily fails or returns 0
    const { data: cacheRow } = await supabase
      .from("discover_events_cache")
      .select("events")
      .eq("id", 1)
      .maybeSingle() as { data: any };

    const hasCache = cacheRow && cacheRow.events && cacheRow.events.length > 0;

    // 1. If we have cache, return it immediately to unblock UI.
    if (hasCache) {
      if (refresh) {
        // Background refresh
        fetchEvents().then(async (freshEvents) => {
          if (freshEvents && freshEvents.length > 0) {
            await supabase.from("discover_events_cache").upsert({
              id: 1,
              events: freshEvents,
              updated_at: new Date().toISOString()
            } as any);
          }
        }).catch(err => {
          console.error("[Events API] Background refresh failed:", err);
        });
      }
      return NextResponse.json({ data: cacheRow.events, source: refresh ? "cache_stale_refreshing" : "cache" });
    }

    // 2. No cache exists. We must await the fetch.
    const freshEvents = await fetchEvents();
    
    // 3. Cache Policy: Only overwrite if we got valid data
    if (freshEvents && freshEvents.length > 0) {
      await supabase.from("discover_events_cache").upsert({
        id: 1,
        events: freshEvents,
        updated_at: new Date().toISOString()
      } as any);
      return NextResponse.json({ data: freshEvents, source: "fresh" });
    }

    // 4. Total failure: No cache exists, and fetch returned 0.
    return NextResponse.json({ data: [], source: "empty" });

  } catch (error: any) {
    console.error("[Events API] Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events", details: error.message },
      { status: 500 }
    );
  }
}
